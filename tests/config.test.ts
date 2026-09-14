import { describe, expect, it } from 'vitest';
import { mergeConfigForSave, validateConfigShape } from '../server/config.js';
import type { CinephileConfig } from '../server/config.js';

/**
 * Regression tests for the "cannot add my TMDB API key" bug: the settings
 * form promises "leave blank to keep current" for secrets, so saving an
 * update with a blank token (or blank TMDB key) must merge with the stored
 * config instead of failing shape validation.
 */

const existing: CinephileConfig = {
  github: { token: 'ghp_stored_token_000000000000000000', repo: 'octocat/watched', branch: 'main' },
  commitAuthor: { name: 'Stored Name', email: 'stored@example.com' },
  tmdb: { apiKey: 'stored_tmdb_key_0000000000000000' },
};

describe('mergeConfigForSave', () => {
  it('keeps the stored token and TMDB key when both are submitted blank', () => {
    const merged = mergeConfigForSave(existing, {
      github: { token: '', repo: 'octocat/watched' },
      commitAuthor: { name: 'New Name', email: 'new@example.com' },
      tmdb: { apiKey: '' },
    });
    expect(merged.github.token).toBe('ghp_stored_token_000000000000000000');
    expect(merged.tmdb.apiKey).toBe('stored_tmdb_key_0000000000000000');
    expect(merged.commitAuthor.name).toBe('New Name');
    expect(merged.commitAuthor.email).toBe('new@example.com');
  });

  it('replaces the TMDB key when a new one is submitted (the reported user path)', () => {
    const merged = mergeConfigForSave(existing, {
      github: { token: '', repo: 'octocat/watched' },
      commitAuthor: { name: 'Stored Name', email: 'stored@example.com' },
      tmdb: { apiKey: 'brand_new_tmdb_key_1111111111111' },
    });
    expect(merged.tmdb.apiKey).toBe('brand_new_tmdb_key_1111111111111');
    expect(merged.github.token).toBe('ghp_stored_token_000000000000000000');
  });

  it('replaces the token when a new one is submitted', () => {
    const merged = mergeConfigForSave(existing, {
      github: { token: 'ghp_replacement_token_111111111111111', repo: 'octocat/watched' },
      tmdb: { apiKey: '' },
    });
    expect(merged.github.token).toBe('ghp_replacement_token_111111111111111');
  });

  it('passes shape validation after merging blanks with a stored config', () => {
    // This is the exact failing path before the fix: blank token + stored
    // config used to fail validation with "token is required".
    const merged = mergeConfigForSave(existing, {
      github: { token: '', repo: 'octocat/watched' },
      commitAuthor: { name: 'Stored Name', email: 'stored@example.com' },
      tmdb: { apiKey: 'new_tmdb_key_2222222222222222' },
    });
    expect(validateConfigShape(merged)).toEqual({});
  });

  it('updates the repo and keeps the branch when submitted blank', () => {
    const merged = mergeConfigForSave(existing, {
      github: { token: '', repo: 'octocat/watched-v2', branch: '' },
    });
    expect(merged.github.repo).toBe('octocat/watched-v2');
    expect(merged.github.branch).toBe('main');
  });

  it('with no stored config, blanks stay blank (shape validation then reports the field)', () => {
    const merged = mergeConfigForSave(null, {
      github: { token: '', repo: 'octocat/watched' },
      commitAuthor: { name: 'A', email: 'a@example.com' },
      tmdb: { apiKey: 'valid_length_tmdb_key_0000000000' },
    });
    expect(merged.github.token).toBe('');
    const errors = validateConfigShape(merged);
    expect(errors['github.token']).toMatch(/required/i);
    expect(errors['tmdb.apiKey']).toBeUndefined();
  });

  it('trims whitespace from submitted values', () => {
    const merged = mergeConfigForSave(existing, {
      github: { token: '  ghp_padded_token_3333333333333333  ', repo: ' octocat/watched ' },
      tmdb: { apiKey: '  padded_tmdb_key_4444444444444  ' },
    });
    expect(merged.github.token).toBe('ghp_padded_token_3333333333333333');
    expect(merged.github.repo).toBe('octocat/watched');
    expect(merged.tmdb.apiKey).toBe('padded_tmdb_key_4444444444444');
  });
});

describe('validateConfigShape error attribution', () => {
  it('attributes a bad TMDB key to tmdb.apiKey, not a generic error', () => {
    const errors = validateConfigShape({
      github: { token: 'ghp_valid_looking_token_000000000', repo: 'octocat/watched' },
      commitAuthor: { name: 'A', email: 'a@example.com' },
      tmdb: { apiKey: 'short' },
    });
    expect(Object.keys(errors)).toEqual(['tmdb.apiKey']);
  });

  it('accepts a v4-style read token', () => {
    const errors = validateConfigShape({
      github: { token: 'ghp_valid_looking_token_000000000', repo: 'octocat/watched' },
      commitAuthor: { name: 'A', email: 'a@example.com' },
      tmdb: { apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123' },
    });
    expect(errors).toEqual({});
  });
});
