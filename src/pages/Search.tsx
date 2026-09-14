import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { PosterCard } from '../components/PosterCard.js';
import type { TmdbSearchResult } from '../types.js';

const HINTS = ['Inception', 'Breaking Bad', 'Parasite', 'The Matrix', 'Chernobyl'];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(Boolean(params.get('q')));
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      if (params.get('q')) setParams({}, { replace: true });
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { results } = await api.search(q);
        setResults(results);
        setSearched(true);
        setParams({ q }, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="page search-page">
      <section className="search-hero">
        <h1>
          Find something <span className="accent">great</span>
        </h1>
        <p className="hero-sub">Search movies and series, mark them watched, light up your graph.</p>
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            autoFocus
            type="search"
            placeholder="Search movies and series…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search movies and series"
          />
        </div>
        {!query ? (
          <div className="hero-hints">
            <span>Try:</span>
            {HINTS.map((h) => (
              <button key={h} className="chip" onClick={() => setQuery(h)}>
                {h}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <div className="poster-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : null}

      {!loading && query && !error && results.length === 0 ? (
        <div className="empty">No results for “{query}”.</div>
      ) : null}

      {!loading && results.length > 0 ? (
        <div className="poster-grid">
          {results.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              id={r.id}
              type={r.media_type}
              title={r.title}
              year={r.year}
              posterPath={r.poster_path}
              overview={r.overview}
            />
          ))}
        </div>
      ) : null}

      {!searched && !query ? (
        <div className="empty">Type to search TMDB’s catalog of movies and series.</div>
      ) : null}
    </div>
  );
}
