/**
 * Cinephile local server.
 *
 * Keeps credentials server-side (config.json, gitignored) and performs all
 * GitHub commits and TMDB lookups. The browser only ever talks to this
 * server - tokens never reach the client.
 *
 * Dev:  `npm run dev` (Express on 8787 + Vite on 5173 with /api proxy)
 * Prod: `npm run build && npm start` (serves the built client statically)
 * Demo: `CINEPHILE_DEMO=1 npm run dev` (fixtures, no credentials needed)
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configPath, loadConfig, mergeConfigForSave, redactConfig, saveConfig, validateConfigShape, type CinephileConfig } from './config.js';
import {
  errorMessage,
  GitHubClient,
  parseRepoSlug,
  validateGithubCredentials,
} from './github.js';
import { TmdbClient } from './tmdb.js';
import {
  demoAppendEntry,
  demoFakeSha,
  demoHome,
  demoLibraryEntries,
  demoMovieDetail,
  demoSearch,
  demoSeasonDetail,
  demoTvDetail,
} from './demo.js';
import { formatEpisodeCommitMessage, formatMovieCommitMessage } from './commitMessages.js';
import {
  buildEpisodeEntry,
  buildMovieEntry,
  entryKey,
  parseWatchedLog,
} from './watched.js';
import {
  markEpisodeWatched,
  markMovieWatched,
  markSeasonWatched,
  readLibrary,
} from './watchedService.js';
import type { WatchedEntry } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.CINEPHILE_API_PORT || 8787);
const DEMO = process.env.CINEPHILE_DEMO === '1';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Helpers

interface ResolvedSetup {
  config: CinephileConfig;
  github: GitHubClient;
  owner: string;
  repo: string;
  branch: string;
}

function resolveSetup(): ResolvedSetup | { error: string; status: number } {
  const config = loadConfig();
  if (!config) {
    return {
      error: 'Not configured. Open Settings and save your GitHub + TMDB credentials first.',
      status: 400,
    };
  }
  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseRepoSlug(config.github.repo));
  } catch (err) {
    return { error: errorMessage(err), status: 400 };
  }
  const branch = config.github.branch || 'main';
  return { config, github: new GitHubClient(config.github.token), owner, repo, branch };
}

function requireSetup(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (DEMO) {
    (req as unknown as { demo: boolean }).demo = true;
    next();
    return;
  }
  const setup = resolveSetup();
  if ('error' in setup) {
    res.status(setup.status).json({ error: setup.error });
    return;
  }
  res.locals.setup = setup;
  next();
}

// Library cache: the repo is the source of truth; this avoids a GitHub
// round trip on every page view. Refreshed on demand or after a watch.
let libraryCache: { entries: WatchedEntry[]; fetchedAt: number } | null = null;

async function fetchLibrary(setup: ResolvedSetup): Promise<WatchedEntry[]> {
  const entries = await readLibrary(setup.github, {
    owner: setup.owner,
    repo: setup.repo,
    branch: setup.branch,
  });
  libraryCache = { entries, fetchedAt: Date.now() };
  return entries;
}

// ---------------------------------------------------------------------------
// Health / config

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, demo: DEMO, configured: DEMO || loadConfig() !== null });
});

app.get('/api/config', (_req, res) => {
  if (DEMO) {
    res.json({
      configured: true,
      demo: true,
      github: { repo: 'demo/demo', branch: 'main', tokenMasked: 'demo' },
      commitAuthor: { name: 'Demo User', email: 'demo@example.com' },
      tmdb: { apiKeyMasked: 'demo' },
    });
    return;
  }
  res.json(redactConfig(loadConfig()));
});

app.post('/api/config/validate', async (req, res) => {
  if (DEMO) {
    res.json({ ok: true, errors: {}, github: { login: 'demo', repoFullName: 'demo/demo', defaultBranch: 'main' } });
    return;
  }
  // Merge with the stored config first: blank secrets mean "keep current",
  // so the user can validate an update without re-entering credentials.
  const merged = mergeConfigForSave(loadConfig(), req.body as Partial<CinephileConfig>);
  const shapeErrors = validateConfigShape(merged);
  if (Object.keys(shapeErrors).length > 0) {
    res.status(400).json({ ok: false, errors: shapeErrors });
    return;
  }
  try {
    const { owner, repo } = parseRepoSlug(merged.github.repo!);
    const gh = await validateGithubCredentials(merged.github.token!, owner, repo, merged.github.branch);
    if (!gh.ok) {
      res.status(400).json({ ok: false, errors: { 'github.repo': gh.error ?? 'GitHub validation failed.' } });
      return;
    }
    const tmdb = await new TmdbClient(merged.tmdb.apiKey!).validate();
    if (!tmdb.ok) {
      res.status(400).json({ ok: false, errors: { 'tmdb.apiKey': tmdb.error ?? 'TMDB validation failed.' } });
      return;
    }
    res.json({
      ok: true,
      errors: {},
      github: { login: gh.login, repoFullName: gh.repoFullName, defaultBranch: gh.defaultBranch },
    });
  } catch (err) {
    res.status(500).json({ ok: false, errors: { _: errorMessage(err) } });
  }
});

app.post('/api/config', async (req, res) => {
  if (DEMO) {
    res.json({ ok: true, saved: true, github: { login: 'demo', repoFullName: 'demo/demo', defaultBranch: 'main' } });
    return;
  }
  // Merge with the stored config first: blank secrets mean "keep current",
  // so the user can add just their TMDB key (or change the repo/author)
  // without re-entering credentials they already saved.
  const existing = loadConfig();
  const merged = mergeConfigForSave(existing, req.body as Partial<CinephileConfig>);
  const shapeErrors = validateConfigShape(merged);
  if (Object.keys(shapeErrors).length > 0) {
    res.status(400).json({ ok: false, errors: shapeErrors });
    return;
  }
  try {
    const { owner, repo } = parseRepoSlug(merged.github.repo!);
    const gh = await validateGithubCredentials(merged.github.token!, owner, repo, merged.github.branch);
    if (!gh.ok) {
      res.status(400).json({ ok: false, errors: { 'github.repo': gh.error ?? 'GitHub validation failed.' } });
      return;
    }
    const tmdb = await new TmdbClient(merged.tmdb.apiKey!).validate();
    if (!tmdb.ok) {
      res.status(400).json({ ok: false, errors: { 'tmdb.apiKey': tmdb.error ?? 'TMDB validation failed.' } });
      return;
    }
    // Resolve and pin the branch: use the explicit branch if provided,
    // otherwise pin the repo's default branch so later commits are
    // deterministic. A repo change with no explicit branch resets to the
    // new repo's default.
    const repoChanged = existing !== null && existing.github.repo !== `${owner}/${repo}`;
    const branch =
      !repoChanged && merged.github?.branch?.trim()
        ? merged.github.branch.trim()
        : gh.defaultBranch || 'main';
    const full: CinephileConfig = {
      github: { token: merged.github.token!, repo: `${owner}/${repo}`, branch },
      commitAuthor: {
        name: merged.commitAuthor!.name!,
        email: merged.commitAuthor!.email!,
      },
      tmdb: { apiKey: merged.tmdb.apiKey! },
    };
    saveConfig(full);
    libraryCache = null;
    res.json({ ok: true, saved: true, github: { login: gh.login, repoFullName: gh.repoFullName, defaultBranch: branch } });
  } catch (err) {
    res.status(500).json({ ok: false, errors: { _: errorMessage(err) } });
  }
});

// ---------------------------------------------------------------------------
// TMDB proxy (keeps the API key server-side)

app.get('/api/tmdb/home', requireSetup, async (_req, res) => {
  try {
    if (DEMO) {
      res.json(demoHome());
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const tmdb = new TmdbClient(setup.config.tmdb.apiKey);
    res.json(await tmdb.home());
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

app.get('/api/tmdb/search', requireSetup, async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  if (!q) {
    res.json({ results: [], total_results: 0 });
    return;
  }
  try {
    if (DEMO) {
      res.json({ results: demoSearch(q), total_results: demoSearch(q).length });
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const tmdb = new TmdbClient(setup.config.tmdb.apiKey);
    res.json(await tmdb.search(q, page));
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

app.get('/api/tmdb/movie/:id', requireSetup, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (DEMO) {
      const detail = demoMovieDetail(id);
      if (!detail) res.status(404).json({ error: 'Not found in demo data.' });
      else res.json(detail);
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const tmdb = new TmdbClient(setup.config.tmdb.apiKey);
    res.json(await tmdb.movieDetail(id));
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

app.get('/api/tmdb/tv/:id', requireSetup, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (DEMO) {
      const detail = demoTvDetail(id);
      if (!detail) res.status(404).json({ error: 'Not found in demo data.' });
      else res.json(detail);
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const tmdb = new TmdbClient(setup.config.tmdb.apiKey);
    res.json(await tmdb.tvDetail(id));
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

app.get('/api/tmdb/tv/:id/season/:season', requireSetup, async (req, res) => {
  const id = Number(req.params.id);
  const season = Number(req.params.season);
  try {
    if (DEMO) {
      const detail = demoSeasonDetail(id, season);
      if (!detail) res.status(404).json({ error: 'Not found in demo data.' });
      else res.json(detail);
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const tmdb = new TmdbClient(setup.config.tmdb.apiKey);
    res.json(await tmdb.seasonDetail(id, season));
  } catch (err) {
    res.status(502).json({ error: errorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// Library (repo is the source of truth)

app.get('/api/library', requireSetup, async (req, res) => {
  try {
    if (DEMO) {
      res.json({ entries: demoLibraryEntries(), fetchedAt: Date.now() });
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const refresh = req.query.refresh === '1';
    if (!refresh && libraryCache) {
      res.json({ entries: libraryCache.entries, fetchedAt: libraryCache.fetchedAt });
      return;
    }
    const entries = await fetchLibrary(setup);
    res.json({ entries, fetchedAt: Date.now() });
  } catch (err) {
    res.status(502).json({ error: `Could not read watched.jsonl from the repo: ${errorMessage(err)}` });
  }
});

// ---------------------------------------------------------------------------
// Watch endpoints: one commit per movie, per episode, per season fan-out

interface MovieWatchBody {
  tmdb_id: number;
  title: string;
  year?: number | null;
  watched_at?: string;
  rating?: number | null;
  poster_path?: string | null;
}

interface EpisodeWatchBody extends MovieWatchBody {
  season: number;
  episode: number;
  episode_title: string;
}

interface SeasonWatchBody {
  tmdb_id: number;
  title: string;
  year?: number | null;
  watched_at?: string;
  rating?: number | null;
  poster_path?: string | null;
  season: number;
  episodes: Array<{ episode: number; episode_title: string }>;
}

app.post('/api/watch/movie', requireSetup, async (req, res) => {
  const body = req.body as MovieWatchBody;
  try {
    if (DEMO) {
      const entry = buildMovieEntry({ ...body, type: 'movie' });
      demoAppendEntry(entry);
      res.json({ ok: true, commitSha: demoFakeSha(), message: formatMovieCommitMessage(entry.title, entry.year) });
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const result = await markMovieWatched(
      setup.github,
      { author: setup.config.commitAuthor, target: { owner: setup.owner, repo: setup.repo, branch: setup.branch } },
      { ...body, type: 'movie' },
    );
    if (result.ok) libraryCache = null;
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: errorMessage(err) });
  }
});

app.post('/api/watch/episode', requireSetup, async (req, res) => {
  const body = req.body as EpisodeWatchBody;
  try {
    if (DEMO) {
      const entry = buildEpisodeEntry({ ...body, type: 'tv' });
      demoAppendEntry(entry);
      res.json({
        ok: true,
        commitSha: demoFakeSha(),
        message: formatEpisodeCommitMessage(entry.title, entry.season!, entry.episode!, entry.episode_title ?? ''),
      });
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const result = await markEpisodeWatched(
      setup.github,
      { author: setup.config.commitAuthor, target: { owner: setup.owner, repo: setup.repo, branch: setup.branch } },
      { ...body, type: 'tv' },
    );
    if (result.ok) libraryCache = null;
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: errorMessage(err) });
  }
});

app.post('/api/watch/season', requireSetup, async (req, res) => {
  const body = req.body as SeasonWatchBody;
  if (!Array.isArray(body.episodes) || body.episodes.length === 0) {
    res.status(400).json({ error: 'episodes must be a non-empty array.' });
    return;
  }
  try {
    if (DEMO) {
      const ordered = [...body.episodes].sort((a, b) => a.episode - b.episode);
      for (const ep of ordered) {
        demoAppendEntry(
          buildEpisodeEntry({
            ...body,
            type: 'tv',
            season: body.season,
            episode: ep.episode,
            episode_title: ep.episode_title,
          }),
        );
      }
      res.json({
        results: ordered.map((ep) => ({
          ok: true,
          commitSha: demoFakeSha(),
          message: formatEpisodeCommitMessage(body.title, body.season, ep.episode, ep.episode_title),
        })),
        total: body.episodes.length,
        succeeded: body.episodes.length,
        failed: 0,
      });
      return;
    }
    const setup = res.locals.setup as ResolvedSetup;
    const result = await markSeasonWatched(
      setup.github,
      { author: setup.config.commitAuthor, target: { owner: setup.owner, repo: setup.repo, branch: setup.branch } },
      {
        episodes: body.episodes.map((ep) => ({
          tmdb_id: body.tmdb_id,
          type: 'tv' as const,
          title: body.title,
          year: body.year ?? null,
          watched_at: body.watched_at,
          rating: body.rating ?? null,
          poster_path: body.poster_path ?? null,
          season: body.season,
          episode: ep.episode,
          episode_title: ep.episode_title,
        })),
      },
    );
    if (result.succeeded > 0) libraryCache = null;
    res.status(result.failed > 0 && result.succeeded === 0 ? 502 : 200).json(result);
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

// ---------------------------------------------------------------------------
// Static client (production build)

const clientDist = path.resolve(__dirname, '../client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  if (DEMO) {
    console.log(`[cinephile] demo mode - fixtures only, no real commits`);
  }
  console.log(`[cinephile] API server listening on http://127.0.0.1:${PORT}`);
  console.log(`[cinephile] config: ${configPath()}`);
});
