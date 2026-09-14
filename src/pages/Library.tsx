import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.js';
import { coverCss } from '../lib/covers.js';
import { formatWatchedDate, tmdbImageUrl } from '../types.js';
import type { WatchedEntry } from '../types.js';

type Filter = 'all' | 'movie' | 'tv';
type SortKey = 'recent' | 'title' | 'rating';

export function LibraryPage() {
  const { library, libraryLoading, libraryError, refreshLibrary } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const entries = useMemo(() => {
    let list = [...library];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.episode_title ?? '').toLowerCase().includes(q),
      );
    }
    if (filter === 'movie') list = list.filter((e) => e.type === 'movie');
    if (filter === 'tv') list = list.filter((e) => e.type === 'tv');
    switch (sort) {
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'rating':
        list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      default:
        list.sort((a, b) => (a.watched_at < b.watched_at ? 1 : -1));
    }
    return list;
  }, [library, query, filter, sort]);

  const stats = useMemo(() => {
    const movies = library.filter((e) => e.type === 'movie').length;
    const episodes = library.filter((e) => e.type === 'tv').length;
    return { movies, episodes, total: library.length };
  }, [library]);

  return (
    <div className="page library-page">
      <div className="page-head">
        <h1>Library</h1>
        <p className="page-sub">
          {stats.total} watch{stats.total === 1 ? '' : 'es'} · {stats.movies} movie{stats.movies === 1 ? '' : 's'} ·{' '}
          {stats.episodes} episode{stats.episodes === 1 ? '' : 's'} — read straight from your repo’s
          <code> watched.jsonl</code>
        </p>
      </div>

      {libraryError ? (
        <div className="alert alert-error">
          {libraryError}{' '}
          <button className="btn btn-small" onClick={() => refreshLibrary()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="library-toolbar">
        <input
          type="search"
          placeholder="Filter by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter library"
        />
        <div className="segmented">
          {(['all', 'movie', 'tv'] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? 'segmented-active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : 'Episodes'}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="recent">Recently watched</option>
          <option value="title">Title A–Z</option>
          <option value="rating">Rating</option>
        </select>
      </div>

      {libraryLoading && library.length === 0 ? <div className="loading">Loading library…</div> : null}

      {!libraryLoading && entries.length === 0 && !libraryError ? (
        <div className="empty">
          Nothing here yet. <Link to="/">Search for something to watch</Link> and mark it watched.
        </div>
      ) : null}

      <ul className="library-list">
        {entries.map((e, i) => (
          <LibraryRow key={`${e.type}-${e.tmdb_id}-${e.season ?? ''}-${e.episode ?? ''}-${e.watched_at}-${i}`} entry={e} />
        ))}
      </ul>
    </div>
  );
}

function LibraryRow({ entry }: { entry: WatchedEntry }) {
  const [failed, setFailed] = useState(false);
  const posterUrl = tmdbImageUrl(entry.poster_path, 'w185');
  const detailHref = entry.type === 'movie' ? `/movie/${entry.tmdb_id}` : `/tv/${entry.tmdb_id}`;

  return (
    <li className="library-row">
      <Link to={detailHref} className="library-poster">
        {posterUrl && !failed ? (
          <img src={posterUrl} alt={entry.title} loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="poster-fallback poster-fallback-small" style={{ background: coverCss(entry.title) }}>
            <span>{entry.title}</span>
          </div>
        )}
      </Link>
      <div className="library-info">
        <Link to={detailHref} className="library-title">
          {entry.title}
          {entry.year ? <span className="library-year"> ({entry.year})</span> : null}
        </Link>
        {entry.type === 'tv' && entry.season !== undefined ? (
          <span className="library-episode">
            S{String(entry.season).padStart(2, '0')}E{String(entry.episode).padStart(2, '0')}
            {entry.episode_title ? ` — ${entry.episode_title}` : ''}
          </span>
        ) : null}
      </div>
      <div className="library-meta">
        {entry.rating ? <span className="rating-badge">★ {entry.rating}</span> : <span className="rating-muted">unrated</span>}
        <span className="watched-date">{formatWatchedDate(entry.watched_at)}</span>
      </div>
    </li>
  );
}
