/** Client-side types mirroring the server API. */

export type MediaType = 'movie' | 'tv';

export interface WatchedEntry {
  tmdb_id: number;
  type: MediaType;
  title: string;
  year: number | null;
  watched_at: string;
  rating?: number | null;
  poster_path?: string | null;
  season?: number;
  episode?: number;
  episode_title?: string;
}

export interface TmdbSearchResult {
  id: number;
  media_type: MediaType;
  title: string;
  year: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TmdbDetail {
  id: number;
  type: MediaType;
  title: string;
  year: number | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime_minutes: number | null;
  genres: string[];
  seasons: TmdbSeasonSummary[];
  status?: string;
}

export interface TmdbEpisode {
  episode_number: number;
  season_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
}

export interface TmdbSeason {
  season_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  episode_count: number;
  episodes: TmdbEpisode[];
}

export interface HomeRow {
  id: string;
  title: string;
  items: TmdbSearchResult[];
}

export interface HomeFeed {
  /** Hero candidates (backdrops + overviews), richest first. */
  hero: TmdbSearchResult[];
  rows: HomeRow[];
}

export interface ConfigStatus {
  configured: boolean;
  demo?: boolean;
  github?: { repo: string | null; branch: string | null; tokenMasked?: string };
  commitAuthor?: { name: string; email: string };
  tmdb?: { apiKeyMasked?: string };
}

export interface WatchCommitResult {
  ok: boolean;
  commitSha?: string;
  message: string;
  error?: string;
}

export interface SeasonFanoutResult {
  results: WatchCommitResult[];
  total: number;
  succeeded: number;
  failed: number;
}

/** One blu-ray case in the cupboard: a unique movie or series. */
export interface CollectionItem {
  key: string;
  tmdb_id: number;
  type: MediaType;
  title: string;
  year: number | null;
  poster_path: string | null;
  firstWatchedAt: string;
  lastWatchedAt: string;
  rating: number | null;
  episodeCount: number; // >0 for series: number of episodes watched
}

export function tmdbImageUrl(
  path: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342',
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatWatchedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Collapse watched entries into unique collection items (one case each). */
export function toCollection(entries: WatchedEntry[]): CollectionItem[] {
  const map = new Map<string, CollectionItem>();
  for (const e of entries) {
    const key = `${e.type}:${e.tmdb_id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        tmdb_id: e.tmdb_id,
        type: e.type,
        title: e.title,
        year: e.year,
        poster_path: e.poster_path ?? null,
        firstWatchedAt: e.watched_at,
        lastWatchedAt: e.watched_at,
        rating: e.rating ?? null,
        episodeCount: e.type === 'tv' ? 1 : 0,
      });
    } else {
      if (e.watched_at < existing.firstWatchedAt) existing.firstWatchedAt = e.watched_at;
      if (e.watched_at > existing.lastWatchedAt) existing.lastWatchedAt = e.watched_at;
      if (e.rating != null) existing.rating = e.rating;
      if (e.type === 'tv') existing.episodeCount += 1;
    }
  }
  return [...map.values()].sort((a, b) => (a.firstWatchedAt < b.firstWatchedAt ? 1 : -1));
}

export function entryWatchKey(type: MediaType, tmdbId: number, season?: number, episode?: number): string {
  if (type === 'tv' && season !== undefined && episode !== undefined) {
    return `tv:${tmdbId}:${season}:${episode}`;
  }
  return `${type}:${tmdbId}`;
}
