import { describe, expect, it } from 'vitest';
import {
  appendEntry,
  buildEpisodeEntry,
  buildMovieEntry,
  entryKey,
  entryToLine,
  parseWatchedLog,
} from '../server/watched.js';

const baseMovie = {
  tmdb_id: 27205,
  type: 'movie' as const,
  title: 'Inception',
  year: 2010,
  poster_path: '/9gk7aZ0H4bP3tR2x1Z9bQw.jpg',
};

describe('buildMovieEntry', () => {
  it('builds a complete movie entry', () => {
    const entry = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z', rating: 9 });
    expect(entry).toEqual({
      tmdb_id: 27205,
      type: 'movie',
      title: 'Inception',
      year: 2010,
      watched_at: '2026-09-01T20:00:00.000Z',
      rating: 9,
      poster_path: '/9gk7aZ0H4bP3tR2x1Z9bQw.jpg',
    });
  });

  it('defaults watched_at to now and omits rating when absent', () => {
    const before = Date.now();
    const entry = buildMovieEntry(baseMovie);
    expect(new Date(entry.watched_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(entry.rating).toBeUndefined();
  });

  it('normalizes a date-only watched_at into an ISO timestamp', () => {
    const entry = buildMovieEntry({ ...baseMovie, watched_at: '2026-08-15' });
    expect(entry.watched_at).toBe(new Date('2026-08-15').toISOString());
  });

  it('rejects invalid dates, ratings, and missing fields', () => {
    expect(() => buildMovieEntry({ ...baseMovie, watched_at: 'not-a-date' })).toThrow(/watched_at/);
    expect(() => buildMovieEntry({ ...baseMovie, rating: 11 })).toThrow(/Rating/);
    expect(() => buildMovieEntry({ ...baseMovie, rating: 0 })).toThrow(/Rating/);
    expect(() => buildMovieEntry({ ...baseMovie, tmdb_id: 0 })).toThrow(/tmdb_id/);
    expect(() => buildMovieEntry({ ...baseMovie, title: '  ' })).toThrow(/title/);
  });
});

describe('buildEpisodeEntry', () => {
  it('builds a complete episode entry', () => {
    const entry = buildEpisodeEntry({
      tmdb_id: 1396,
      type: 'tv',
      title: 'Breaking Bad',
      year: 2008,
      watched_at: '2026-09-01T21:00:00.000Z',
      rating: 10,
      poster_path: null,
      season: 1,
      episode: 4,
      episode_title: 'Cancer Man',
    });
    expect(entry).toEqual({
      tmdb_id: 1396,
      type: 'tv',
      title: 'Breaking Bad',
      year: 2008,
      watched_at: '2026-09-01T21:00:00.000Z',
      rating: 10,
      poster_path: null,
      season: 1,
      episode: 4,
      episode_title: 'Cancer Man',
    });
  });

  it('rejects season 0/negative and episode 0/negative', () => {
    const base = {
      tmdb_id: 1396,
      type: 'tv' as const,
      title: 'Breaking Bad',
      season: 1,
      episode: 1,
      episode_title: 'Pilot',
    };
    expect(() => buildEpisodeEntry({ ...base, season: -1 })).toThrow(/season/);
    expect(() => buildEpisodeEntry({ ...base, episode: 0 })).toThrow(/episode/);
    expect(() => buildEpisodeEntry({ ...base, episode: 1.5 })).toThrow(/episode/);
  });
});

describe('appendEntry / parseWatchedLog', () => {
  it('creates the first line when the file does not exist', () => {
    const entry = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z' });
    const content = appendEntry(null, entry);
    expect(content).toBe(`${entryToLine(entry)}\n`);
  });

  it('creates the first line when the file is empty', () => {
    const entry = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z' });
    expect(appendEntry('', entry)).toBe(`${entryToLine(entry)}\n`);
  });

  it('appends with a newline even if the existing content lacks a trailing one', () => {
    const first = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z' });
    const second = buildMovieEntry({ ...baseMovie, tmdb_id: 603, title: 'The Matrix', year: 1999, watched_at: '2026-09-02T20:00:00.000Z' });
    const content = appendEntry(`${entryToLine(first)}`, second);
    expect(content).toBe(`${entryToLine(first)}\n${entryToLine(second)}\n`);
  });

  it('round-trips entries through parseWatchedLog', () => {
    const e1 = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z', rating: 8 });
    const e2 = buildEpisodeEntry({
      tmdb_id: 1396,
      type: 'tv',
      title: 'Breaking Bad',
      year: 2008,
      watched_at: '2026-09-02T21:00:00.000Z',
      season: 2,
      episode: 7,
      episode_title: 'Negro y Azul',
    });
    const parsed = parseWatchedLog(appendEntry(appendEntry(null, e1), e2));
    expect(parsed).toEqual([e1, e2]);
  });

  it('skips blank and malformed lines when parsing', () => {
    const entry = buildMovieEntry({ ...baseMovie, watched_at: '2026-09-01T20:00:00.000Z' });
    const content = `\n${entryToLine(entry)}\n{"broken json\n\nnot json at all\n`;
    expect(parseWatchedLog(content)).toEqual([entry]);
  });

  it('parses null/undefined content as an empty log', () => {
    expect(parseWatchedLog(null)).toEqual([]);
    expect(parseWatchedLog(undefined)).toEqual([]);
  });
});

describe('entryKey', () => {
  it('keys movies by type and id', () => {
    expect(entryKey({ type: 'movie', tmdb_id: 27205 })).toBe('movie:27205');
  });

  it('keys episodes by season and episode', () => {
    expect(entryKey({ type: 'tv', tmdb_id: 1396, season: 1, episode: 4 })).toBe('tv:1396:1:4');
  });
});
