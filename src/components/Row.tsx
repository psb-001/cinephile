import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { coverCss } from '../lib/covers.js';
import { tmdbImageUrl } from '../types.js';
import type { TmdbSearchResult } from '../types.js';

/**
 * Streaming-service content row: horizontally scrollable, snap-aligned,
 * arrow controls that appear on hover, poster-first cards with a refined
 * hover lift. Falls back to deterministic gradient art when a poster is
 * missing.
 */
export function Row({
  title,
  items,
  badge,
}: {
  title: string;
  items: TmdbSearchResult[];
  badge?: (item: TmdbSearchResult) => React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className="row">
      <div className="row-head">
        <h2>{title}</h2>
      </div>
      <div className="row-wrap">
        {!atStart ? (
          <button className="row-arrow row-arrow-left" onClick={() => scrollBy(-1)} aria-label="Scroll left">
            ‹
          </button>
        ) : null}
        <div className="row-scroller" ref={scroller} onScroll={onScroll}>
          {items.map((item) => (
            <RowCard key={`${item.media_type}-${item.id}`} item={item} badge={badge ? badge(item) : undefined} />
          ))}
          <div className="row-spacer" />
        </div>
        {!atEnd ? (
          <button className="row-arrow row-arrow-right" onClick={() => scrollBy(1)} aria-label="Scroll right">
            ›
          </button>
        ) : null}
      </div>
    </section>
  );
}

function RowCard({ item, badge }: { item: TmdbSearchResult; badge?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const posterUrl = tmdbImageUrl(item.poster_path, 'w342');
  const href = item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;

  return (
    <Link to={href} className="row-card" title={item.overview || item.title}>
      <div className="row-card-art">
        {posterUrl && !failed ? (
          <img src={posterUrl} alt={item.title} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="poster-fallback" style={{ background: coverCss(`${item.title}-${item.year ?? ''}`) }}>
            <span className="poster-fallback-title">{item.title}</span>
            {item.year ? <span className="poster-fallback-year">{item.year}</span> : null}
          </div>
        )}
        {badge ? <div className="row-card-badge">{badge}</div> : null}
        <div className="row-card-info">
          <span className="row-card-title">{item.title}</span>
          <span className="row-card-sub">
            {item.media_type === 'tv' ? 'Series' : 'Movie'}
            {item.year ? ` · ${item.year}` : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function RowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="row-scroller row-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}
