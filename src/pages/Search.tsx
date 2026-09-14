import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { PosterCard } from '../components/PosterCard.js';
import type { TmdbSearchResult } from '../types.js';

const TRENDING_HINTS = ['Inception', 'Breaking Bad', 'Parasite', 'The Matrix', 'Chernobyl'];

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { results } = await api.search(q);
        setResults(results);
        setSearched(true);
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
  }, [query]);

  const hintButtons = useMemo(() => TRENDING_HINTS, []);

  return (
    <div className="page search-page">
      <section className="hero">
        <h1>
          Watch something? <span className="accent">Commit it.</span>
        </h1>
        <p className="hero-sub">
          Every movie or episode you mark watched makes exactly one commit to your GitHub repo —
          and lights up a green square on your profile.
        </p>
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
        {!query && (
          <div className="hero-hints">
            <span>Try:</span>
            {hintButtons.map((h) => (
              <button key={h} className="chip" onClick={() => setQuery(h)}>
                {h}
              </button>
            ))}
          </div>
        )}
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="loading">Searching…</div> : null}

      {!loading && query && !error && results.length === 0 ? (
        <div className="empty">No results for “{query}”.</div>
      ) : null}

      {results.length > 0 ? (
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
        <div className="search-landing">
          <div className="landing-cards">
            <div className="landing-card">
              <span className="landing-num">1</span>
              <h3>Find it</h3>
              <p>Search millions of movies and series via TMDB.</p>
            </div>
            <div className="landing-card">
              <span className="landing-num">2</span>
              <h3>Mark it watched</h3>
              <p>
                One commit per movie. One commit <em>per episode</em> — a 10-episode binge is 10
                commits.
              </p>
            </div>
            <div className="landing-card">
              <span className="landing-num">3</span>
              <h3>Shelf it</h3>
              <p>Your watches become blu-ray cases on the 3D cupboard shelf.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
