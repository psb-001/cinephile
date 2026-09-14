import { describe, expect, it } from 'vitest';
import {
  formatEpisodeCommitMessage,
  formatMovieCommitMessage,
  padSeasonEpisode,
} from '../server/commitMessages.js';

describe('padSeasonEpisode', () => {
  it('zero-pads single digits', () => {
    expect(padSeasonEpisode(1)).toBe('01');
    expect(padSeasonEpisode(4)).toBe('04');
    expect(padSeasonEpisode(9)).toBe('09');
  });

  it('keeps double digits as-is', () => {
    expect(padSeasonEpisode(10)).toBe('10');
    expect(padSeasonEpisode(42)).toBe('42');
  });
});

describe('formatMovieCommitMessage', () => {
  it('formats with year', () => {
    expect(formatMovieCommitMessage('Inception', 2010)).toBe('Watched: Inception (2010)');
  });

  it('omits parens when year is unknown', () => {
    expect(formatMovieCommitMessage('Untitled', null)).toBe('Watched: Untitled');
    expect(formatMovieCommitMessage('Untitled', undefined)).toBe('Watched: Untitled');
  });

  it('trims surrounding whitespace from the title', () => {
    expect(formatMovieCommitMessage('  Parasite ', 2019)).toBe('Watched: Parasite (2019)');
  });
});

describe('formatEpisodeCommitMessage', () => {
  it('formats S01E04 style codes with zero padding', () => {
    expect(formatEpisodeCommitMessage('Breaking Bad', 1, 4, 'Cancer Man')).toBe(
      'Watched: Breaking Bad S01E04 - Cancer Man',
    );
  });

  it('handles double-digit seasons and episodes', () => {
    expect(formatEpisodeCommitMessage('Friends', 10, 12, 'The One with Phoebe')).toBe(
      'Watched: Friends S10E12 - The One with Phoebe',
    );
  });

  it('omits the dash when the episode title is empty', () => {
    expect(formatEpisodeCommitMessage('Severance', 2, 3, '')).toBe('Watched: Severance S02E03');
    expect(formatEpisodeCommitMessage('Severance', 2, 3, '   ')).toBe('Watched: Severance S02E03');
  });

  it('keeps punctuation and special characters in titles', () => {
    expect(formatEpisodeCommitMessage('Arcane', 1, 7, 'The Boy Savior')).toBe(
      'Watched: Arcane S01E07 - The Boy Savior',
    );
    expect(formatMovieCommitMessage('Everything Everywhere All at Once', 2022)).toBe(
      'Watched: Everything Everywhere All at Once (2022)',
    );
  });
});
