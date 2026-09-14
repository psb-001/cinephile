/** Typed fetch client for the local cinephile server. */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Parse a JSON response. Returns the parsed body when the status is in
 * `okStatuses`; otherwise throws an ApiError carrying the parsed body so
 * callers that expect structured error payloads (e.g. Settings field
 * errors, season fan-out results) can read them off `.body`.
 */
async function json<T>(res: Response, okStatuses: number[] = [200]): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
  if (!okStatuses.includes(res.status)) {
    throw new ApiError(res.status, body?.error || `${res.status} ${res.statusText}`, body);
  }
  return body as T;
}

async function post<T>(url: string, body: unknown, okStatuses: number[] = [200]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return json<T>(res, okStatuses);
}

export const api = {
  health: () => fetch('/api/health').then((r) => json<{ ok: boolean; demo: boolean; configured: boolean }>(r)),

  config: () => fetch('/api/config').then((r) => json<import('./types.js').ConfigStatus>(r)),

  // 400 bodies carry {ok:false, errors:{field:message}} — the body IS the
  // validation result, so it is returned, not thrown.
  saveConfig: (body: unknown) =>
    post<{
      ok: boolean;
      saved?: boolean;
      errors?: Record<string, string>;
      github?: { login: string; repoFullName: string; defaultBranch: string };
    }>('/api/config', body, [200, 400]),

  search: (q: string, page = 1) =>
    fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) =>
      json<{ results: import('./types.js').TmdbSearchResult[]; total_results: number }>(r),
    ),

  home: () =>
    fetch('/api/tmdb/home').then((r) =>
      json<import('./types.js').HomeFeed>(r),
    ),

  movieDetail: (id: number) => fetch(`/api/tmdb/movie/${id}`).then((r) => json<import('./types.js').TmdbDetail>(r)),

  tvDetail: (id: number) => fetch(`/api/tmdb/tv/${id}`).then((r) => json<import('./types.js').TmdbDetail>(r)),

  seasonDetail: (id: number, season: number) =>
    fetch(`/api/tmdb/tv/${id}/season/${season}`).then((r) => json<import('./types.js').TmdbSeason>(r)),

  library: (refresh = false) =>
    fetch(`/api/library${refresh ? '?refresh=1' : ''}`).then((r) =>
      json<{ entries: import('./types.js').WatchedEntry[]; fetchedAt: number }>(r),
    ),

  // 502 bodies carry the structured failure ({ok:false,error} or the season
  // fan-out result) — returned so the UI can attribute the failure.
  watchMovie: (body: {
    tmdb_id: number;
    title: string;
    year?: number | null;
    watched_at?: string;
    rating?: number | null;
    poster_path?: string | null;
  }) =>
    post<import('./types.js').WatchCommitResult>('/api/watch/movie', body, [200, 502]),

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
    post<import('./types.js').WatchCommitResult>('/api/watch/episode', body, [200, 502]),

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
    post<import('./types.js').SeasonFanoutResult>('/api/watch/season', body, [200, 502]),
};
