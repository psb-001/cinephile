/**
 * Minimal TMDB v3 client. Supports both v3 API keys and v4 read access
 * tokens (JWT-style, detected by their "eyJ" prefix).
 */
import { errorMessage } from './github.js';

const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TmdbSearchResult {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string;
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
  episode_count: number;
  air_date: string | null;
  overview: string;
  episodes: TmdbEpisode[];
}

export interface TmdbDetail {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  year: number | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime_minutes: number | null;
  genres: string[];
  seasons: TmdbSeasonSummary[];
  /** Present for tv. */
  status?: string;
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export class TmdbClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  private isBearer(): boolean {
    return this.apiKey.startsWith('eyJ');
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TMDB_API}${path}`);
    if (this.isBearer()) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    } else {
      url.searchParams.set('api_key', this.apiKey);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.isBearer()) headers.Authorization = `Bearer ${this.apiKey}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { status_message?: string };
        if (body?.status_message) detail = body.status_message;
      } catch {
        // keep status detail
      }
      throw new Error(`TMDB API error: ${detail}`);
    }
    return (await res.json()) as T;
  }

  /** Cheap authenticated ping - used by settings validation. */
  async validate(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.request<{ images: unknown }>('/configuration');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `TMDB key check failed: ${errorMessage(err)}` };
    }
  }

  async search(query: string, page = 1): Promise<{ results: TmdbSearchResult[]; total_results: number }> {
    const data = await this.request<{
      results: Array<{
        id: number;
        media_type: string;
        title?: string;
        name?: string;
        release_date?: string;
        first_air_date?: string;
        poster_path: string | null;
        overview: string;
      }>;
      total_results: number;
    }>('/search/multi', { query, page: String(page), include_adult: 'false' });
    const results = (data.results ?? [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => ({
        id: r.id,
        media_type: r.media_type as 'movie' | 'tv',
        title: (r.title ?? r.name ?? '').trim(),
        year: parseYear(r.release_date ?? r.first_air_date),
        poster_path: r.poster_path,
        overview: r.overview ?? '',
      }));
    return { results, total_results: data.total_results ?? results.length };
  }

  async movieDetail(id: number): Promise<TmdbDetail> {
    const m = await this.request<{
      id: number;
      title: string;
      release_date: string | null;
      overview: string;
      poster_path: string | null;
      backdrop_path: string | null;
      runtime: number | null;
      genres: Array<{ name: string }>;
    }>(`/movie/${id}`);
    return {
      id: m.id,
      type: 'movie',
      title: m.title,
      year: parseYear(m.release_date),
      overview: m.overview ?? '',
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path,
      runtime_minutes: m.runtime ?? null,
      genres: (m.genres ?? []).map((g) => g.name),
      seasons: [],
    };
  }

  async tvDetail(id: number): Promise<TmdbDetail> {
    const t = await this.request<{
      id: number;
      name: string;
      first_air_date: string | null;
      overview: string;
      poster_path: string | null;
      backdrop_path: string | null;
      episode_run_time: number[];
      status: string;
      genres: Array<{ name: string }>;
      seasons: Array<{
        season_number: number;
        name: string;
        episode_count: number;
        air_date: string | null;
        poster_path: string | null;
      }>;
    }>(`/tv/${id}`);
    return {
      id: t.id,
      type: 'tv',
      title: t.name,
      year: parseYear(t.first_air_date),
      overview: t.overview ?? '',
      poster_path: t.poster_path,
      backdrop_path: t.backdrop_path,
      runtime_minutes: t.episode_run_time?.[0] ?? null,
      genres: (t.genres ?? []).map((g) => g.name),
      seasons: (t.seasons ?? []).map((s) => ({
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        air_date: s.air_date,
        poster_path: s.poster_path,
      })),
      status: t.status,
    };
  }

  async seasonDetail(id: number, seasonNumber: number): Promise<TmdbSeason> {
    const s = await this.request<{
      season_number: number;
      name: string;
      air_date: string | null;
      overview: string;
      episodes: Array<{
        episode_number: number;
        season_number: number;
        name: string;
        air_date: string | null;
        overview: string;
        still_path: string | null;
      }>;
    }>(`/tv/${id}/season/${seasonNumber}`);
    return {
      season_number: s.season_number,
      name: s.name,
      air_date: s.air_date,
      overview: s.overview ?? '',
      episode_count: (s.episodes ?? []).length,
      episodes: (s.episodes ?? []).map((e) => ({
        episode_number: e.episode_number,
        season_number: e.season_number,
        name: e.name,
        air_date: e.air_date,
        overview: e.overview ?? '',
        still_path: e.still_path,
      })),
    };
  }
}

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

/** Public TMDB image URL (image CDN needs no auth and allows CORS). */
export function tmdbImageUrl(path: string | null | undefined, size: 'w342' | 'w500' | 'original' = 'w342'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
