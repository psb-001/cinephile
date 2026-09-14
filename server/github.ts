/**
 * Minimal GitHub REST client built on native fetch. The server keeps the
 * token; the browser never sees it.
 */
import type { CommitAuthor, GitHubApi, RepoTarget } from './types.js';

const GITHUB_API = 'https://api.github.com';

export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

interface RepoInfo {
  full_name: string;
  default_branch: string;
  private: boolean;
  permissions?: { push?: boolean };
}

export class GitHubClient implements GitHubApi {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'cinephile-watch-tracker',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body?.message) detail = body.message;
      } catch {
        // keep status detail
      }
      throw new GitHubApiError(res.status, `GitHub API error: ${detail}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** GET /user - validates the token and returns the login name. */
  async whoami(): Promise<{ login: string }> {
    return this.request<{ login: string }>('/user');
  }

  /** GET /repos/{owner}/{repo} - validates repo access. */
  async getRepo(owner: string, repo: string): Promise<RepoInfo> {
    return this.request<RepoInfo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async getRefHead(owner: string, repo: string, branch: string): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return ref.object.sha;
  }

  async getCommitTree(owner: string, repo: string, sha: string): Promise<string> {
    const commit = await this.request<{ tree: { sha: string } }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${sha}`,
    );
    return commit.tree.sha;
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          Accept: 'application/vnd.github.raw',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'cinephile-watch-tracker',
        },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new GitHubApiError(res.status, `GitHub API error reading ${path}: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }

  async createBlob(owner: string, repo: string, content: string): Promise<string> {
    const blob = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
      { method: 'POST', body: JSON.stringify({ content, encoding: 'utf-8' }) },
    );
    return blob.sha;
  }

  async createTree(owner: string, repo: string, baseTree: string, path: string, blobSha: string): Promise<string> {
    const tree = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTree,
          tree: [{ path, mode: '100644', type: 'blob', sha: blobSha }],
        }),
      },
    );
    return tree.sha;
  }

  async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[],
    author: CommitAuthor & { date: string },
  ): Promise<string> {
    const commit = await this.request<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({ message, tree, parents, author }),
      },
    );
    return commit.sha;
  }

  async updateRef(owner: string, repo: string, branch: string, sha: string): Promise<void> {
    await this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
      { method: 'PATCH', body: JSON.stringify({ sha, force: false }) },
    );
  }
}

export interface GithubValidation {
  ok: boolean;
  login?: string;
  repoFullName?: string;
  defaultBranch?: string;
  error?: string;
}

/**
 * Validate a token + repo pair: token authenticates (whoami), the repo
 * exists, and the token can push to it. Returns the default branch.
 */
export async function validateGithubCredentials(
  token: string,
  owner: string,
  repo: string,
): Promise<GithubValidation> {
  let login: string;
  try {
    const user = await new GitHubClient(token).whoami();
    login = user.login;
  } catch (err) {
    return { ok: false, error: `GitHub token check failed: ${errorMessage(err)}` };
  }
  try {
    const info = await new GitHubClient(token).getRepo(owner, repo);
    if (info.permissions && !info.permissions.push) {
      return { ok: false, error: `Token cannot push to ${owner}/${repo} (needs repo write access).` };
    }
    return {
      ok: true,
      login,
      repoFullName: info.full_name,
      defaultBranch: info.default_branch,
    };
  } catch (err) {
    return { ok: false, login, error: `Repo check failed: ${errorMessage(err)}` };
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Parse "owner/name" repo input; throws on malformed input. */
export function parseRepoSlug(repo: string): { owner: string; repo: string } {
  const trimmed = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '');
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Repo must look like "owner/name" (got "${repo}")`);
  }
  return { owner: match[1], repo: match[2] };
}

export type { RepoTarget };
