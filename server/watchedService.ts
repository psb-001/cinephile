/**
 * The core mechanic: one commit per watch.
 *
 * Every watch (a movie, a single episode, or each episode of a binge-marked
 * season) appends exactly one line to `watched.jsonl` on the target repo's
 * default branch via exactly one commit. The commit author date is the watch
 * date, so backdated watches light up past contribution squares.
 *
 * Season fan-out issues N commits in episode order - never one squashed
 * commit. This is the product's core delight and is unit-tested against a
 * mocked GitHub API.
 */
import { appendEntry, WATCHED_FILE } from './watched.js';
import { formatEpisodeCommitMessage, formatMovieCommitMessage } from './commitMessages.js';
import type { CommitAuthor, GitHubApi, RepoTarget, SeasonFanoutResult, WatchCommitResult, WatchedEntry } from './types.js';
import { buildEpisodeEntry, buildMovieEntry, parseWatchedLog } from './watched.js';
import type { EpisodeWatchInput, MovieWatchInput } from './watched.js';
import { errorMessage } from './github.js';

export interface WatchOptions {
  author: CommitAuthor;
  target: RepoTarget;
}

/**
 * Commit a single watched entry: read the current log, append one line, and
 * create exactly one commit on the target branch.
 */
export async function commitWatchedEntry(
  api: GitHubApi,
  opts: WatchOptions,
  entry: WatchedEntry,
  message: string,
): Promise<WatchCommitResult> {
  const { author, target } = opts;
  const { owner, repo, branch } = target;
  try {
    // 1. Current branch head and its tree.
    const headSha = await api.getRefHead(owner, repo, branch);
    const treeSha = await api.getCommitTree(owner, repo, headSha);

    // 2. Current log content (null if the file does not exist yet).
    const currentContent = await api.getFileContent(owner, repo, WATCHED_FILE, headSha);
    const newContent = appendEntry(currentContent, entry);

    // 3. Blob -> tree -> commit (exactly one), authored with the watch date.
    const blobSha = await api.createBlob(owner, repo, newContent);
    const newTreeSha = await api.createTree(owner, repo, treeSha, WATCHED_FILE, blobSha);
    const commitSha = await api.createCommit(owner, repo, message, newTreeSha, [headSha], {
      name: author.name,
      email: author.email,
      date: entry.watched_at,
    });

    // 4. Fast-forward the branch.
    await api.updateRef(owner, repo, branch, commitSha);

    return { ok: true, commitSha, message };
  } catch (err) {
    return { ok: false, message, error: errorMessage(err) };
  }
}

/** Mark a movie watched: exactly one commit. */
export async function markMovieWatched(
  api: GitHubApi,
  opts: WatchOptions,
  input: MovieWatchInput,
): Promise<WatchCommitResult> {
  const entry = buildMovieEntry(input);
  const message = formatMovieCommitMessage(entry.title, entry.year);
  return commitWatchedEntry(api, opts, entry, message);
}

/** Mark a single episode watched: exactly one commit. */
export async function markEpisodeWatched(
  api: GitHubApi,
  opts: WatchOptions,
  input: EpisodeWatchInput,
): Promise<WatchCommitResult> {
  const entry = buildEpisodeEntry(input);
  const message = formatEpisodeCommitMessage(entry.title, entry.season!, entry.episode!, entry.episode_title ?? '');
  return commitWatchedEntry(api, opts, entry, message);
}

/**
 * Mark a whole season watched: one commit per episode, in episode order.
 * Never squashes. Stops at the first failure so the log stays consistent,
 * and reports per-episode results so the UI can show partial progress.
 */
export async function markSeasonWatched(
  api: GitHubApi,
  opts: WatchOptions,
  season: { episodes: Array<EpisodeWatchInput> },
): Promise<SeasonFanoutResult> {
  const { author, target } = opts;
  const { owner, repo, branch } = target;
  const results: WatchCommitResult[] = [];

  // Order by episode number, ascending, no matter how the caller passed them.
  const episodes = [...season.episodes].sort((a, b) => a.episode - b.episode);

  // Chain commits in memory: each episode's commit builds on the previous
  // one's tree, so N episodes produce N sequential commits with N appended
  // lines - exactly as if the user had marked them one by one.
  let headSha: string;
  let treeSha: string;
  let content: string | null;
  try {
    headSha = await api.getRefHead(owner, repo, branch);
    treeSha = await api.getCommitTree(owner, repo, headSha);
    content = await api.getFileContent(owner, repo, WATCHED_FILE, headSha);
  } catch (err) {
    const error = errorMessage(err);
    return {
      results: episodes.map((ep) => ({
        ok: false,
        message: formatEpisodeCommitMessage(ep.title, ep.season, ep.episode, ep.episode_title),
        error,
      })),
      total: episodes.length,
      succeeded: 0,
      failed: episodes.length,
    };
  }

  for (const ep of episodes) {
    try {
      const entry = buildEpisodeEntry(ep);
      const message = formatEpisodeCommitMessage(entry.title, entry.season!, entry.episode!, entry.episode_title ?? '');
      const newContent = appendEntry(content, entry);
      const blobSha = await api.createBlob(owner, repo, newContent);
      const newTreeSha = await api.createTree(owner, repo, treeSha, WATCHED_FILE, blobSha);
      const commitSha = await api.createCommit(owner, repo, message, newTreeSha, [headSha], {
        name: author.name,
        email: author.email,
        date: entry.watched_at,
      });
      await api.updateRef(owner, repo, branch, commitSha);
      headSha = commitSha;
      treeSha = newTreeSha;
      content = newContent;
      results.push({ ok: true, commitSha, message });
    } catch (err) {
      results.push({
        ok: false,
        message: formatEpisodeCommitMessage(ep.title ?? '', ep.season, ep.episode, ep.episode_title ?? ''),
        error: errorMessage(err),
      });
      break; // stop on first failure; keep results so far
    }
  }

  return {
    results,
    total: episodes.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}

/** Read the watched log back from the repo - the source of truth. */
export async function readLibrary(api: GitHubApi, target: RepoTarget): Promise<WatchedEntry[]> {
  const headSha = await api.getRefHead(target.owner, target.repo, target.branch);
  const content = await api.getFileContent(target.owner, target.repo, WATCHED_FILE, headSha);
  return parseWatchedLog(content);
}
