import { describe, expect, it } from 'vitest';
import type { GitHubApi } from '../server/types.js';
import {
  markEpisodeWatched,
  markMovieWatched,
  markSeasonWatched,
  readLibrary,
} from '../server/watchedService.js';
import { parseWatchedLog } from '../server/watched.js';

/**
 * In-memory fake of the GitHub API surface the watch service uses.
 * No network is touched; commits, trees and file contents are simulated
 * exactly like the real Git data API would behave.
 */
class MockGitHubApi implements GitHubApi {
  head: string;
  tree: string;
  file: string | null;
  commits: Array<{
    sha: string;
    message: string;
    tree: string;
    parents: string[];
    author: { name: string; email: string; date: string };
    fileContent: string;
  }> = [];
  refUpdates: string[] = [];
  /** 1-based ordinal of the commit that should fail (e.g. 5 = 5th commit). */
  failOnCommitN: number | null = null;

  private nextSha = 0;

  constructor(initialFile: string | null = null) {
    this.head = 'aaaa000000000000000000000000000000000000';
    this.tree = 'tttt000000000000000000000000000000000000';
    this.file = initialFile;
  }

  private sha(): string {
    this.nextSha += 1;
    return String(this.nextSha).padStart(40, '0');
  }

  async getRefHead(): Promise<string> {
    return this.head;
  }

  async getCommitTree(): Promise<string> {
    return this.tree;
  }

  async getFileContent(): Promise<string | null> {
    return this.file;
  }

  async createBlob(_owner: string, _repo: string, content: string): Promise<string> {
    // stash the content on the blob sha so the commit can reference it
    const sha = this.sha();
    (this as unknown as Record<string, string>)[`blob:${sha}`] = content;
    return sha;
  }

  async createTree(_owner: string, _repo: string, baseTree: string, _path: string, blobSha: string): Promise<string> {
    const tree = this.sha();
    (this as unknown as Record<string, string>)[`tree:${tree}`] =
      (this as unknown as Record<string, string>)[`blob:${blobSha}`];
    void baseTree;
    return tree;
  }

  async createCommit(
    _owner: string,
    _repo: string,
    message: string,
    tree: string,
    parents: string[],
    author: { name: string; email: string; date: string },
  ): Promise<string> {
    if (this.failOnCommitN === this.commits.length + 1) {
      throw new Error('simulated commit failure');
    }
    const sha = this.sha();
    const fileContent =
      (this as unknown as Record<string, string>)[`tree:${tree}`] ?? this.file ?? '';
    this.commits.push({ sha, message, tree, parents, author, fileContent });
    return sha;
  }

  async updateRef(_owner: string, _repo: string, _branch: string, sha: string): Promise<void> {
    this.refUpdates.push(sha);
    const commit = this.commits.find((c) => c.sha === sha);
    if (commit) {
      this.head = sha;
      this.tree = commit.tree;
      this.file = commit.fileContent;
    }
  }
}

const opts = {
  author: { name: 'Cinephile', email: 'cinephile@example.com' },
  target: { owner: 'octocat', repo: 'watched', branch: 'main' },
};

const series = {
  tmdb_id: 1396,
  type: 'tv' as const,
  title: 'Breaking Bad',
  year: 2008,
  watched_at: '2026-09-10T20:00:00.000Z',
  rating: 10,
  poster_path: null,
};

function episodes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    ...series,
    season: 1,
    episode: i + 1,
    episode_title: `Episode ${i + 1}`,
  }));
}

describe('markMovieWatched', () => {
  it('creates exactly one commit with the movie message', async () => {
    const api = new MockGitHubApi();
    const result = await markMovieWatched(api, opts, {
      tmdb_id: 27205,
      type: 'movie',
      title: 'Inception',
      year: 2010,
      watched_at: '2026-09-10T20:00:00.000Z',
      rating: 9,
      poster_path: null,
    });
    expect(result.ok).toBe(true);
    expect(api.commits).toHaveLength(1);
    expect(api.commits[0].message).toBe('Watched: Inception (2010)');
  });

  it('authors the commit with the configured name/email and the watch date', async () => {
    const api = new MockGitHubApi();
    await markMovieWatched(api, opts, {
      tmdb_id: 27205,
      type: 'movie',
      title: 'Inception',
      year: 2010,
      watched_at: '2026-09-10T20:00:00.000Z',
      poster_path: null,
    });
    expect(api.commits[0].author).toEqual({
      name: 'Cinephile',
      email: 'cinephile@example.com',
      date: '2026-09-10T20:00:00.000Z',
    });
  });

  it('backdates the commit author date to the chosen watch date', async () => {
    const api = new MockGitHubApi();
    await markMovieWatched(api, opts, {
      tmdb_id: 27205,
      type: 'movie',
      title: 'Inception',
      year: 2010,
      watched_at: '2024-01-15T20:00:00.000Z',
      poster_path: null,
    });
    expect(api.commits[0].author.date).toBe('2024-01-15T20:00:00.000Z');
  });

  it('reports failure without partial writes', async () => {
    const api = new MockGitHubApi();
    api.failOnCommitN = 1;
    const result = await markMovieWatched(api, opts, {
      tmdb_id: 27205,
      type: 'movie',
      title: 'Inception',
      year: 2010,
      watched_at: '2026-09-10T20:00:00.000Z',
      poster_path: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/simulated commit failure/);
    expect(api.commits).toHaveLength(0);
    expect(api.refUpdates).toHaveLength(0);
  });
});

describe('markEpisodeWatched', () => {
  it('creates exactly one commit with the episode message', async () => {
    const api = new MockGitHubApi();
    const result = await markEpisodeWatched(api, opts, {
      ...series,
      season: 1,
      episode: 4,
      episode_title: 'Cancer Man',
    });
    expect(result.ok).toBe(true);
    expect(api.commits).toHaveLength(1);
    expect(api.commits[0].message).toBe('Watched: Breaking Bad S01E04 - Cancer Man');
  });
});

describe('markSeasonWatched (the core mechanic)', () => {
  it('a 10-episode season is exactly 10 commits in episode order - never squashed', async () => {
    const api = new MockGitHubApi();
    const result = await markSeasonWatched(api, opts, { episodes: episodes(10) });
    expect(result.total).toBe(10);
    expect(result.succeeded).toBe(10);
    expect(result.failed).toBe(0);
    expect(api.commits).toHaveLength(10);

    const messages = api.commits.map((c) => c.message);
    expect(messages).toEqual([
      'Watched: Breaking Bad S01E01 - Episode 1',
      'Watched: Breaking Bad S01E02 - Episode 2',
      'Watched: Breaking Bad S01E03 - Episode 3',
      'Watched: Breaking Bad S01E04 - Episode 4',
      'Watched: Breaking Bad S01E05 - Episode 5',
      'Watched: Breaking Bad S01E06 - Episode 6',
      'Watched: Breaking Bad S01E07 - Episode 7',
      'Watched: Breaking Bad S01E08 - Episode 8',
      'Watched: Breaking Bad S01E09 - Episode 9',
      'Watched: Breaking Bad S01E10 - Episode 10',
    ]);
  });

  it('commits episodes in episode order even when passed shuffled', async () => {
    const api = new MockGitHubApi();
    const shuffled = [...episodes(5)].reverse();
    await markSeasonWatched(api, opts, { episodes: shuffled });
    const eps = api.commits.map((c) => c.message.match(/S01E(\d+)/)?.[1]);
    expect(eps).toEqual(['01', '02', '03', '04', '05']);
  });

  it('each commit appends exactly one line, building on the previous commit', async () => {
    const api = new MockGitHubApi();
    await markSeasonWatched(api, opts, { episodes: episodes(4) });

    for (let i = 0; i < api.commits.length; i++) {
      const lines = api.commits[i].fileContent.trim().split('\n');
      expect(lines).toHaveLength(i + 1);
    }
    // final file has all four entries in episode order
    const entries = parseWatchedLog(api.file);
    expect(entries.map((e) => e.episode)).toEqual([1, 2, 3, 4]);
  });

  it('commits chain: each parent is the previous commit, first parent is the branch head', async () => {
    const api = new MockGitHubApi();
    const originalHead = api.head;
    await markSeasonWatched(api, opts, { episodes: episodes(3) });

    expect(api.commits[0].parents).toEqual([originalHead]);
    expect(api.commits[1].parents).toEqual([api.commits[0].sha]);
    expect(api.commits[2].parents).toEqual([api.commits[1].sha]);
  });

  it('updates the branch ref after every commit', async () => {
    const api = new MockGitHubApi();
    await markSeasonWatched(api, opts, { episodes: episodes(6) });
    expect(api.refUpdates).toEqual(api.commits.map((c) => c.sha));
    expect(api.head).toBe(api.commits[5].sha);
  });

  it('respects the watch date (backdating) on every episode commit', async () => {
    const api = new MockGitHubApi();
    await markSeasonWatched(api, opts, { episodes: episodes(3) });
    for (const commit of api.commits) {
      expect(commit.author).toEqual({
        name: 'Cinephile',
        email: 'cinephile@example.com',
        date: '2026-09-10T20:00:00.000Z',
      });
    }
  });

  it('appends to an existing watched.jsonl without touching prior lines', async () => {
    const api = new MockGitHubApi('{"tmdb_id":27205,"type":"movie","title":"Inception","year":2010,"watched_at":"2026-09-01T20:00:00.000Z"}\n');
    await markSeasonWatched(api, opts, { episodes: episodes(2) });
    const entries = parseWatchedLog(api.file);
    expect(entries).toHaveLength(3);
    expect(entries[0].title).toBe('Inception');
    expect(entries[1].episode).toBe(1);
    expect(entries[2].episode).toBe(2);
  });

  it('stops at the first failure and reports partial progress', async () => {
    const api = new MockGitHubApi();
    api.failOnCommitN = 5;
    const result = await markSeasonWatched(api, opts, { episodes: episodes(10) });
    expect(result.total).toBe(10);
    expect(result.succeeded).toBe(4);
    expect(result.failed).toBe(1);
    expect(api.commits).toHaveLength(4);
    // only the 4 successful commits moved the ref
    expect(api.refUpdates).toHaveLength(4);
    expect(result.results[4].ok).toBe(false);
    expect(result.results[4].error).toMatch(/simulated commit failure/);
  });

  it('a single-episode season is a single commit', async () => {
    const api = new MockGitHubApi();
    const result = await markSeasonWatched(api, opts, {
      episodes: [{ ...series, season: 1, episode: 1, episode_title: 'Pilot' }],
    });
    expect(result.total).toBe(1);
    expect(api.commits).toHaveLength(1);
    expect(api.commits[0].message).toBe('Watched: Breaking Bad S01E01 - Pilot');
  });
});

describe('readLibrary', () => {
  it('reads and parses the log from the repo', async () => {
    const api = new MockGitHubApi('{"tmdb_id":27205,"type":"movie","title":"Inception","year":2010,"watched_at":"2026-09-01T20:00:00.000Z"}\n');
    const entries = await readLibrary(api, opts.target);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Inception');
  });

  it('returns an empty library when the file does not exist', async () => {
    const api = new MockGitHubApi(null);
    const entries = await readLibrary(api, opts.target);
    expect(entries).toEqual([]);
  });
});
