import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.js';
import { Row, RowSkeleton } from '../components/Row.js';
import { coverCss } from '../lib/covers.js';
import { tmdbImageUrl, toCollection } from '../types.js';
import type { HomeFeed, TmdbSearchResult } from '../types.js';

const HERO_ROTATE_MS = 9000;

/**
 * Home: the streaming-service landing page. A cinematic hero over live TMDB
 * trending art, content rows below, and — when the library has history — a
 * personal "Recently watched" row.
 */
export function HomePage() {
  const { library, watchedKeys } = useApp();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .home()
      .then((f) => {
        if (!cancelled) setFeed(f);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hero = feed?.hero ?? [];
  useEffect(() => {
    if (hero.length <= 1) return;
    const t = window.setInterval(() => setHeroIndex((i) => (i + 1) % hero.length), HERO_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [hero.length]);

  const heroItem: TmdbSearchResult | null = hero[heroIndex] ?? hero[0] ?? null;

  const recentlyWatched = useMemo(() => {
    const items = toCollection(library)
      .sort((a, b) => (a.lastWatchedAt < b.lastWatchedAt ? 1 : -1))
      .slice(0, 20)
      .map<TmdbSearchResult>((c) => ({
        id: c.tmdb_id,
        media_type: c.type,
        title: c.title,
        year: c.year,
        poster_path: c.poster_path,
        backdrop_path: null,
        overview: '',
      }));
    return items;
  }, [library]);

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <Hero item={heroItem} loading={feed === null} watchedKeys={watchedKeys} count={hero.length} index={heroIndex} onSelect={setHeroIndex} />

      <div className="home-rows">
        {recentlyWatched.length > 0 ? (
          <Row title="Recently watched" items={recentlyWatched} />
        ) : null}

        {feed === null ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : (
          feed.rows.map((row) => <Row key={row.id} title={row.title} items={row.items} />)
        )}
      </div>
    </div>
  );
}

function Hero({
  item,
  loading,
  watchedKeys,
  count,
  index,
  onSelect,
}: {
  item: TmdbSearchResult | null;
  loading: boolean;
  watchedKeys: Set<string>;
  count: number;
  index: number;
  onSelect: (i: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const backdropUrl = tmdbImageUrl(item?.backdrop_path, 'original');
  const posterUrl = tmdbImageUrl(item?.poster_path, 'w500');
  const href = item ? (item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`) : '#';
  const watched = item ? watchedKeys.has(`${item.media_type}:${item.id}`) : false;

  useEffect(() => setFailed(false), [item?.id]);

  if (loading && !item) {
    return <div className="hero-cinema skeleton skeleton-hero" aria-hidden="true" />;
  }
  if (!item) return null;

  return (
    <section className="hero-cinema" key={item.id}>
      <div
        className="hero-backdrop"
        style={
          backdropUrl && !failed
            ? { backgroundImage: `url(${backdropUrl})` }
            : { background: coverCss(item.title) }
        }
      />
      <div className="hero-scrim" />
      <div className="hero-content">
        <div className="hero-poster">
          {posterUrl && !failed ? (
            <img src={posterUrl} alt={item.title} onError={() => setFailed(true)} />
          ) : (
            <div className="poster-fallback" style={{ background: coverCss(item.title) }}>
              <span className="poster-fallback-title">{item.title}</span>
            </div>
          )}
        </div>
        <div className="hero-info">
          <span className="hero-eyebrow">
            {item.media_type === 'tv' ? 'Series' : 'Movie'} · Trending this week
          </span>
          <h1>{item.title}</h1>
          <div className="hero-meta">
            {item.year ? <span>{item.year}</span> : null}
          </div>
          <p className="hero-overview">{item.overview}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to={href}>
              {watched ? 'Watched ✓ — open' : 'Mark watched — 1 commit'}
            </Link>
          </div>
        </div>
      </div>
      {count > 1 ? (
        <div className="hero-dots" role="tablist" aria-label="Featured titles">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              className={i === index ? 'hero-dot hero-dot-active' : 'hero-dot'}
              onClick={() => onSelect(i)}
              aria-label={`Show featured title ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
