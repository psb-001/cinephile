import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api.js';

/**
 * Regression tests for the error-swallowing bug that made the captain's
 * TMDB-key failure show as a bare "400 Bad Request": the client used to
 * throw away structured {ok:false, errors:{field: message}} bodies, so
 * Settings could never attribute a failure to a specific credential.
 *
 * fetch is stubbed with Response objects — no network is touched.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function stubFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('api.saveConfig surfaces structured validation errors', () => {
  it('returns the 400 body with per-field errors instead of throwing (the reported bug)', async () => {
    stubFetch(400, {
      ok: false,
      errors: { 'tmdb.apiKey': 'TMDB key check failed: TMDB API error: Invalid API key' },
    });
    const result = await api.saveConfig({
      github: { token: 'x', repo: 'a/b' },
      commitAuthor: { name: 'n', email: 'e@x.com' },
      tmdb: { apiKey: 'bad' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors?.['tmdb.apiKey']).toMatch(/Invalid API key/);
  });

  it('returns the saved config summary on success', async () => {
    stubFetch(200, { ok: true, saved: true, github: { login: 'octocat', repoFullName: 'octocat/watched', defaultBranch: 'main' } });
    const result = await api.saveConfig({
      github: { token: 'x', repo: 'a/b' },
      commitAuthor: { name: 'n', email: 'e@x.com' },
      tmdb: { apiKey: 'goodkey' },
    });
    expect(result.ok).toBe(true);
    expect(result.github?.login).toBe('octocat');
  });

  it('still throws for unexpected statuses so network failures are not silenced', async () => {
    stubFetch(500, { error: 'boom' });
    await expect(
      api.saveConfig({
        github: { token: 'x', repo: 'a/b' },
        commitAuthor: { name: 'n', email: 'e@x.com' },
        tmdb: { apiKey: 'k' },
      }),
    ).rejects.toThrow('boom');
  });
});

describe('api.watch* surfaces structured failure bodies', () => {
  it('returns a failed movie-watch result from a 502 body', async () => {
    stubFetch(502, { ok: false, message: 'Watched: X (2020)', error: 'GitHub API error: Bad credentials' });
    const result = await api.watchMovie({ tmdb_id: 1, title: 'X', year: 2020 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Bad credentials/);
  });

  it('returns the season fan-out result from a 502 body so partial failures are attributable', async () => {
    stubFetch(502, {
      results: [
        { ok: true, commitSha: 'a', message: 'Watched: S S01E01 - One' },
        { ok: false, message: 'Watched: S S01E02 - Two', error: 'GitHub API error: rate limited' },
      ],
      total: 2,
      succeeded: 1,
      failed: 1,
    });
    const result = await api.watchSeason({
      tmdb_id: 1,
      title: 'S',
      season: 1,
      episodes: [
        { episode: 1, episode_title: 'One' },
        { episode: 2, episode_title: 'Two' },
      ],
    });
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.results[1].error).toMatch(/rate limited/);
  });
});
