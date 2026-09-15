/**
 * Local configuration: GitHub token, target repo, commit author, TMDB key.
 * Stored in `config.json` at the project root (gitignored) - resolved from
 * the working directory the server is started from (`npm run dev` and
 * `npm start` both run at the root). Never commit real credentials;
 * `config.example.json` documents the shape.
 *
 * Configuration is PARTIAL by design: the app works with just a TMDB key
 * (browse everything live); GitHub is only needed once you start marking
 * watches (each watch is a commit). Sections are stored and validated
 * independently, and blank secrets on save mean "keep current".
 */
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

export interface GithubSection {
  token: string;
  repo: string; // "owner/name"
  branch?: string; // defaults to the repo's default branch
}

export interface AuthorSection {
  name: string;
  email: string;
}

export interface TmdbSection {
  apiKey: string;
}

/** Full configuration: all three sections present. */
export interface CinephileConfig {
  github: GithubSection;
  commitAuthor: AuthorSection;
  tmdb: TmdbSection;
}

/** Stored configuration: any subset of complete sections. */
export interface StoredConfig {
  github?: GithubSection;
  commitAuthor?: AuthorSection;
  tmdb?: TmdbSection;
}

export function configPath(): string {
  return CONFIG_PATH;
}

export function hasGithub(config: StoredConfig | null): boolean {
  return Boolean(config?.github?.token && config?.github?.repo);
}

export function hasTmdb(config: StoredConfig | null): boolean {
  return Boolean(config?.tmdb?.apiKey);
}

/**
 * Parse raw stored config, keeping only complete sections. A TMDB-only
 * config is valid (browse live data); a GitHub-only config is valid
 * (commits, no art). Incomplete or malformed sections are dropped.
 */
export function parseStoredConfig(raw: string): StoredConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as StoredConfig;
  const out: StoredConfig = {};
  const github = candidate.github;
  if (
    github &&
    typeof github === 'object' &&
    typeof github.token === 'string' &&
    github.token.trim() &&
    typeof github.repo === 'string' &&
    github.repo.trim()
  ) {
    out.github = {
      token: github.token.trim(),
      repo: github.repo.trim(),
      branch: typeof github.branch === 'string' && github.branch.trim() ? github.branch.trim() : undefined,
    };
  }
  const author = candidate.commitAuthor;
  if (
    author &&
    typeof author === 'object' &&
    typeof author.name === 'string' &&
    author.name.trim() &&
    typeof author.email === 'string' &&
    author.email.trim()
  ) {
    out.commitAuthor = { name: author.name.trim(), email: author.email.trim() };
  }
  const tmdb = candidate.tmdb;
  if (tmdb && typeof tmdb === 'object' && typeof tmdb.apiKey === 'string' && tmdb.apiKey.trim()) {
    out.tmdb = { apiKey: tmdb.apiKey.trim() };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function loadConfig(): StoredConfig | null {
  try {
    return parseStoredConfig(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveConfig(config: StoredConfig): void {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Config as safe to expose to the browser: secrets masked, per-section state. */
export function redactConfig(config: StoredConfig | null, demoActive = false) {
  const githubConfigured = hasGithub(config);
  const tmdbConfigured = hasTmdb(config);
  return {
    configured: githubConfigured || tmdbConfigured,
    demo: demoActive,
    github: {
      configured: githubConfigured,
      repo: config?.github?.repo ?? null,
      branch: config?.github?.branch ?? null,
      tokenMasked: config?.github?.token ? maskSecret(config.github.token) : '',
    },
    commitAuthor: config?.commitAuthor
      ? { name: config.commitAuthor.name, email: config.commitAuthor.email }
      : null,
    tmdb: {
      configured: tmdbConfigured,
      apiKeyMasked: config?.tmdb?.apiKey ? maskSecret(config.tmdb.apiKey) : '',
    },
  };
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

/**
 * Merge a submitted settings form with the stored config.
 *
 * Secrets (GitHub token, TMDB key) are "leave blank to keep current": a
 * blank value keeps the stored one so the user can update just their TMDB
 * key (or just the repo/author) without re-entering credentials they
 * already saved. Non-secret fields always take the submitted value.
 * Sections the user has not started configuring (nothing submitted, nothing
 * stored) stay absent so a TMDB-only setup is valid.
 */
export function mergeConfigForSave(
  existing: StoredConfig | null,
  submitted: Partial<CinephileConfig>,
): StoredConfig {
  const githubTouched =
    Boolean(submitted?.github?.token?.trim()) ||
    Boolean(submitted?.github?.repo?.trim()) ||
    Boolean(existing?.github);
  const token = submitted?.github?.token?.trim() || existing?.github?.token || '';
  const repo = submitted?.github?.repo?.trim() || existing?.github?.repo || '';
  const branch = submitted?.github?.branch?.trim() || existing?.github?.branch || '';

  const authorTouched =
    Boolean(submitted?.commitAuthor?.name?.trim()) ||
    Boolean(submitted?.commitAuthor?.email?.trim()) ||
    Boolean(existing?.commitAuthor);
  const name = submitted?.commitAuthor?.name?.trim() || existing?.commitAuthor?.name || '';
  const email = submitted?.commitAuthor?.email?.trim() || existing?.commitAuthor?.email || '';

  const tmdbTouched = Boolean(submitted?.tmdb?.apiKey?.trim()) || Boolean(existing?.tmdb);
  const apiKey = submitted?.tmdb?.apiKey?.trim() || existing?.tmdb?.apiKey || '';

  const out: StoredConfig = {};
  if (githubTouched) out.github = { token, repo, branch: branch || undefined };
  if (authorTouched) out.commitAuthor = { name, email };
  if (tmdbTouched) out.tmdb = { apiKey };
  return out;
}

/**
 * Field-level shape validation (no network) for the sections being saved.
 * A section is only validated when it is being configured: a TMDB-only
 * submission produces no GitHub errors, and vice versa. The commit author
 * is validated alongside GitHub (it is only needed for commits).
 * Returns errors keyed by field path.
 */
export function validateConfigShape(config: StoredConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  const validateGithub = Boolean(config.github);

  if (validateGithub) {
    const token = config.github?.token?.trim() ?? '';
    if (!token) errors['github.token'] = 'GitHub personal access token is required.';
    else if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/.test(token) && token.length < 20) {
      errors['github.token'] = 'That does not look like a GitHub token (expected ghp_… or github_pat_…).';
    }

    const repo = config.github?.repo?.trim() ?? '';
    if (!repo) errors['github.repo'] = 'Target repo is required (owner/name).';
    else if (
      !/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/i.test(repo) &&
      !/^[\w.-]+\/[\w.-]+$/.test(repo)
    ) {
      errors['github.repo'] = 'Repo must look like "owner/name" or a github.com URL.';
    }

    const name = config.commitAuthor?.name?.trim() ?? '';
    if (!name) errors['commitAuthor.name'] = 'Commit author name is required (it signs your watch commits).';
    const email = config.commitAuthor?.email?.trim() ?? '';
    if (!email) errors['commitAuthor.email'] = 'Commit author email is required (it signs your watch commits).';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors['commitAuthor.email'] = 'Commit author email must be a valid email.';
    }
  }

  if (config.tmdb) {
    const apiKey = config.tmdb?.apiKey?.trim() ?? '';
    if (!apiKey) errors['tmdb.apiKey'] = 'TMDB API key is required.';
    else if (apiKey.length < 16) {
      errors['tmdb.apiKey'] =
        'That does not look like a TMDB key (v3 keys are 32 chars, v4 tokens start with eyJ…).';
    }
  }

  return errors;
}
