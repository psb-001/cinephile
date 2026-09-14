/**
 * Building and parsing `watched.jsonl` entries. The repo is the source of
 * truth: every watch appends exactly one JSON line, one commit at a time.
 */
import type { MediaType, WatchedEntry } from './types.js';

export const WATCHED_FILE = 'watched.jsonl';

export interface MovieWatchInput {
  tmdb_id: number;
  type: MediaType;
  title: string;
  year?: number | null;
  watched_at?: string;
  rating?: number | null;
  poster_path?: string | null;
}

export interface EpisodeWatchInput {
  tmdb_id: number;
  type: MediaType;
  title: string;
  year?: number | null;
  watched_at?: string;
  rating?: number | null;
  poster_path?: string | null;
  season: number;
  episode: number;
  episode_title: string;
}

function normalizeWatchedAt(watchedAt: string | undefined): string {
  if (!watchedAt) return new Date().toISOString();
  const d = new Date(watchedAt);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid watched_at date: ${watchedAt}`);
  }
  if (d.getTime() > Date.now()) {
    throw new Error(`watched_at cannot be in the future: ${watchedAt}`);
  }
  return d.toISOString();
}

function normalizeRating(rating: number | null | undefined): number | null | undefined {
  if (rating === null || rating === undefined || Number.isNaN(rating)) return null;
  if (rating < 1 || rating > 10) {
    throw new Error(`Rating must be between 1 and 10, got ${rating}`);
  }
  return Math.round(rating * 10) / 10;
}

export function buildMovieEntry(input: MovieWatchInput): WatchedEntry {
  if (!input.tmdb_id) throw new Error('tmdb_id is required');
  if (!input.title?.trim()) throw new Error('title is required');
  return {
    tmdb_id: input.tmdb_id,
    type: 'movie',
    title: input.title.trim(),
    year: input.year ?? null,
    watched_at: normalizeWatchedAt(input.watched_at),
    rating: normalizeRating(input.rating) ?? undefined,
    poster_path: input.poster_path ?? null,
  };
}

export function buildEpisodeEntry(input: EpisodeWatchInput): WatchedEntry {
  if (!input.tmdb_id) throw new Error('tmdb_id is required');
  if (!input.title?.trim()) throw new Error('series title is required');
  if (!Number.isInteger(input.season) || input.season < 0) {
    throw new Error(`season must be a non-negative integer, got ${input.season}`);
  }
  if (!Number.isInteger(input.episode) || input.episode < 1) {
    throw new Error(`episode must be a positive integer, got ${input.episode}`);
  }
  return {
    tmdb_id: input.tmdb_id,
    type: 'tv',
    title: input.title.trim(),
    year: input.year ?? null,
    watched_at: normalizeWatchedAt(input.watched_at),
    rating: normalizeRating(input.rating) ?? undefined,
    poster_path: input.poster_path ?? null,
    season: input.season,
    episode: input.episode,
    episode_title: (input.episode_title ?? '').trim(),
  };
}

/** Serialize a single entry to one JSONL line (no trailing newline). */
export function entryToLine(entry: WatchedEntry): string {
  return JSON.stringify(entry);
}

/**
 * Append one entry to the current file content. Content may be null (file
 * does not exist yet), empty, or end without a trailing newline - all cases
 * must produce a valid newline-terminated JSONL file.
 */
export function appendEntry(content: string | null, entry: WatchedEntry): string {
  const line = entryToLine(entry);
  if (content === null || content === '') return `${line}\n`;
  const trimmed = content.endsWith('\n') ? content : `${content}\n`;
  return `${trimmed}${line}\n`;
}

/**
 * Parse the watched log. Blank lines are skipped; malformed lines are skipped
 * (the log is append-only via commits, but be defensive when reading back).
 */
export function parseWatchedLog(content: string | null | undefined): WatchedEntry[] {
  if (!content) return [];
  const entries: WatchedEntry[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as WatchedEntry;
      if (parsed && typeof parsed === 'object' && typeof parsed.tmdb_id === 'number') {
        entries.push(parsed);
      }
    } catch {
      // skip malformed line
    }
  }
  return entries;
}

/** Unique key for an entry - used for de-dup checks in the UI. */
export function entryKey(entry: Pick<WatchedEntry, 'type' | 'tmdb_id' | 'season' | 'episode'>): string {
  if (entry.type === 'tv' && entry.season !== undefined && entry.episode !== undefined) {
    return `tv:${entry.tmdb_id}:${entry.season}:${entry.episode}`;
  }
  return `${entry.type}:${entry.tmdb_id}`;
}
