/** Typed fetch client for the local cinephile server. */

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error || `${res.status} ${res.statusText}`);
  }
  return body as T;
}

export const api = {
  health: () => fetch('/api/health').then((r) => json<{ ok: boolean; demo: boolean; configured: boolean }>(r)),

  config: () => fetch('/api/config').then((r) => json<import('./types.js').ConfigStatus>(r)),

  saveConfig: (body: unknown) =>
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) =>
      json<{
        ok: boolean;
        saved?: boolean;
        errors?: Record<string, string>;
        github?: { login: string; repoFullName: string; defaultBranch: string };
      }>(r),
    ),

  search: (q: string, page = 1) =>
    fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) =>
      json<{ results: import('./types.js').TmdbSearchResult[]; total_results: number }>(r),
    ),

  movieDetail: (id: number) => fetch(`/api/tmdb/movie/${id}`).then((r) => json<import('./types.js').TmdbDetail>(r)),

  tvDetail: (id: number) => fetch(`/api/tmdb/tv/${id}`).then((r) => json<import('./types.js').TmdbDetail>(r)),

  seasonDetail: (id: number, season: number) =>
    fetch(`/api/tmdb/tv/${id}/season/${season}`).then((r) => json<import('./types.js').TmdbSeason>(r)),

  library: (refresh = false) =>
    fetch(`/api/library${refresh ? '?refresh=1' : ''}`).then((r) =>
      json<{ entries: import('./types.js').WatchedEntry[]; fetchedAt: number }>(r),
    ),

  watchMovie: (body: {
    tmdb_id: number;
    title: string;
    year?: number | null;
    watched_at?: string;
    rating?: number | null;
    poster_path?: string | null;
  }) =>
    fetch('/api/watch/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<import('./types.js').WatchCommitResult>(r)),

  watchEpisode: (body: {
    tmdb_id: number;
    title: string;
    year?: number | null;
    watched_at?: string;
    rating?: number | null;
    poster_path?: string | null;
    season: number;
    episode: number;
    episode_title: string;
  }) =>
    fetch('/api/watch/episode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<import('./types.js').WatchCommitResult>(r)),

  watchSeason: (body: {
    tmdb_id: number;
    title: string;
    year?: number | null;
    watched_at?: string;
    rating?: number | null;
    poster_path?: string | null;
    season: number;
    episodes: Array<{ episode: number; episode_title: string }>;
  }) =>
    fetch('/api/watch/season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<import('./types.js').SeasonFanoutResult>(r)),
};
