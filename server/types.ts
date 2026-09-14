/** Shared types for the cinephile server. */

export type MediaType = 'movie' | 'tv';

/** One line of `watched.jsonl` in the target repo. */
export interface WatchedEntry {
  tmdb_id: number;
  type: MediaType;
  title: string;
  year: number | null;
  /** ISO timestamp of when it was watched; also used as the commit author date. */
  watched_at: string;
  /** Optional rating, 1-10. */
  rating?: number | null;
  /** TMDB poster path, cached at watch time so the cupboard never needs a TMDB round trip. */
  poster_path?: string | null;
  /** Present only on episode entries. */
  season?: number;
  episode?: number;
  episode_title?: string;
}

/** Minimal GitHub API surface the watch service depends on (mockable in tests). */
export interface GitHubApi {
  /** SHA of the branch head commit. */
  getRefHead(owner: string, repo: string, branch: string): Promise<string>;
  /** Tree SHA of a commit. */
  getCommitTree(owner: string, repo: string, sha: string): Promise<string>;
  /** Decoded file content at a ref, or null when the file does not exist yet. */
  getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null>;
  createBlob(owner: string, repo: string, content: string): Promise<string>;
  createTree(owner: string, repo: string, baseTree: string, path: string, blobSha: string): Promise<string>;
  createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[],
    author: { name: string; email: string; date: string },
  ): Promise<string>;
  updateRef(owner: string, repo: string, branch: string, sha: string): Promise<void>;
}

export interface CommitAuthor {
  name: string;
  email: string;
}

export interface RepoTarget {
  owner: string;
  repo: string;
  branch: string;
}

/** Result of a single watch commit. */
export interface WatchCommitResult {
  ok: boolean;
  commitSha?: string;
  message: string;
  error?: string;
}

/** Result of a season fan-out: one result per episode, in episode order. */
export interface SeasonFanoutResult {
  results: WatchCommitResult[];
  total: number;
  succeeded: number;
  failed: number;
}
