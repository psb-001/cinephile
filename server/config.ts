/**
 * Local configuration: GitHub token, target repo, commit author, TMDB key.
 * Stored in `config.json` at the project root (gitignored) - resolved from
 * the working directory the server is started from (`npm run dev` and
 * `npm start` both run at the root). Never commit real credentials;
 * `config.example.json` documents the shape.
 */
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

export interface CinephileConfig {
  github: {
    token: string;
    repo: string; // "owner/name"
    branch?: string; // defaults to the repo's default branch
  };
  commitAuthor: {
    name: string;
    email: string;
  };
  tmdb: {
    apiKey: string;
  };
}

export function configPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): CinephileConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as CinephileConfig;
    if (!parsed?.github?.token || !parsed?.github?.repo) return null;
    if (!parsed?.commitAuthor?.name || !parsed?.commitAuthor?.email) return null;
    if (!parsed?.tmdb?.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConfig(config: CinephileConfig): void {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Config as safe to expose to the browser: secrets masked, presence kept. */
export function redactConfig(config: CinephileConfig | null) {
  if (!config) {
    return { configured: false };
  }
  return {
    configured: true,
    github: {
      repo: config.github.repo,
      branch: config.github.branch ?? null,
      tokenMasked: maskSecret(config.github.token),
    },
    commitAuthor: {
      name: config.commitAuthor.name,
      email: config.commitAuthor.email,
    },
    tmdb: {
      apiKeyMasked: maskSecret(config.tmdb.apiKey),
    },
  };
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export interface ConfigValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  github?: { login: string; repoFullName: string; defaultBranch: string };
}

/**
 * Field-level shape validation (no network). Returns errors keyed by field
 * path: github.token, github.repo, commitAuthor.name, commitAuthor.email,
 * tmdb.apiKey.
 */
export function validateConfigShape(config: Partial<CinephileConfig>): Record<string, string> {
  const errors: Record<string, string> = {};
  const token = config?.github?.token?.trim() ?? '';
  if (!token) errors['github.token'] = 'GitHub personal access token is required.';
  else if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/.test(token) && token.length < 20) {
    errors['github.token'] = 'That does not look like a GitHub token (expected ghp_… or github_pat_…).';
  }

  const repo = config?.github?.repo?.trim() ?? '';
  if (!repo) errors['github.repo'] = 'Target repo is required (owner/name).';
  else if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/i.test(repo) && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    errors['github.repo'] = 'Repo must look like "owner/name" or a github.com URL.';
  }

  const name = config?.commitAuthor?.name?.trim() ?? '';
  if (!name) errors['commitAuthor.name'] = 'Commit author name is required.';

  const email = config?.commitAuthor?.email?.trim() ?? '';
  if (!email) errors['commitAuthor.email'] = 'Commit author email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors['commitAuthor.email'] = 'Commit author email must be a valid email.';
  }

  const apiKey = config?.tmdb?.apiKey?.trim() ?? '';
  if (!apiKey) errors['tmdb.apiKey'] = 'TMDB API key is required.';
  else if (apiKey.length < 16) {
    errors['tmdb.apiKey'] = 'That does not look like a TMDB key (v3 keys are 32 chars, v4 tokens start with eyJ…).';
  }

  return errors;
}
