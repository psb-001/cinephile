import { useState } from 'react';
import { Link } from 'react-router-dom';
import { coverCss } from '../lib/covers.js';
import { tmdbImageUrl } from '../types.js';

interface PosterCardProps {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  year: number | null;
  posterPath: string | null;
  overview?: string;
  badge?: React.ReactNode;
}

/** Poster tile with a deterministic gradient fallback when no art exists. */
export function PosterCard({ id, type, title, year, posterPath, overview, badge }: PosterCardProps) {
  const [failed, setFailed] = useState(false);
  const posterUrl = tmdbImageUrl(posterPath, 'w342');
  const showImage = posterUrl && !failed;

  return (
    <Link to={`/${type}/${id}`} className="poster-card" title={overview}>
      <div className="poster-card-art">
        {showImage ? (
          <img src={posterUrl} alt={title} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="poster-fallback" style={{ background: coverCss(`${title}-${year ?? ''}`) }}>
            <span className="poster-fallback-title">{title}</span>
            {year ? <span className="poster-fallback-year">{year}</span> : null}
          </div>
        )}
        {badge ? <div className="poster-card-badge">{badge}</div> : null}
      </div>
      <div className="poster-card-meta">
        <span className="poster-card-title">{title}</span>
        <span className="poster-card-sub">
          {type === 'tv' ? 'Series' : 'Movie'}
          {year ? ` · ${year}` : ''}
        </span>
      </div>
    </Link>
  );
}
