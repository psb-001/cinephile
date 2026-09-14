import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.js';
import { toIsoWatchedAt, reportWatchResult, useWatchState, WatchControls } from '../components/WatchForm.js';
import { coverCss } from '../lib/covers.js';
import { tmdbImageUrl } from '../types.js';
import type { TmdbDetail, TmdbEpisode, TmdbSeason } from '../types.js';

export function DetailPage({ type }: { type: 'movie' | 'tv' }) {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const { config, watchedKeys, refreshLibrary, pushToast } = useApp();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterFailed, setPosterFailed] = useState(false);
  const watch = useWatchState();

  const repoSlug = config?.github?.repo ?? null;
  const movieWatched = watchedKeys.has(`movie:${numericId}`);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setPosterFailed(false);
    const fetcher = type === 'movie' ? api.movieDetail(numericId) : api.tvDetail(numericId);
    fetcher
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, numericId]);

  if (loading)
    return (
      <div className="page">
        <div className="skeleton skeleton-hero" />
      </div>
    );
  if (error)
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  if (!detail) return null;

  const backdropUrl = tmdbImageUrl(detail.backdrop_path, 'original');
  const posterUrl = tmdbImageUrl(detail.poster_path, 'w500');

  return (
    <div className="page detail-page">
      <div
        className="detail-backdrop"
        style={
          backdropUrl
            ? { backgroundImage: `url(${backdropUrl})` }
            : { background: coverCss(detail.title) }
        }
      />
      <div className="detail-scrim" />

      <div className="detail-head">
        <div className="detail-poster">
          {posterUrl && !posterFailed ? (
            <img src={posterUrl} alt={detail.title} onError={() => setPosterFailed(true)} />
          ) : (
            <div className="poster-fallback" style={{ background: coverCss(detail.title) }}>
              <span className="poster-fallback-title">{detail.title}</span>
              {detail.year ? <span className="poster-fallback-year">{detail.year}</span> : null}
            </div>
          )}
        </div>
        <div className="detail-info">
          <h1>{detail.title}</h1>
          <div className="detail-meta">
            <span className="chip chip-type">{type === 'tv' ? 'Series' : 'Movie'}</span>
            {detail.year ? <span>{detail.year}</span> : null}
            {detail.runtime_minutes ? <span>{detail.runtime_minutes} min</span> : null}
            {detail.status && type === 'tv' ? <span>{detail.status}</span> : null}
          </div>
          {detail.genres.length > 0 ? (
            <div className="detail-genres">
              {detail.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          ) : null}
          <p className="detail-overview">{detail.overview}</p>

          {type === 'movie' ? (
            <MarkMovieWatched
              detail={detail}
              watched={movieWatched}
              watch={watch}
              repoSlug={repoSlug}
              onDone={refreshLibrary}
              pushToast={pushToast}
            />
          ) : (
            <SeriesWatchPanel
              detail={detail}
              watch={watch}
              repoSlug={repoSlug}
              onDone={refreshLibrary}
              pushToast={pushToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type Watch = ReturnType<typeof useWatchState>;
type PushToast = ReturnType<typeof useApp>['pushToast'];

function MarkMovieWatched({
  detail,
  watched,
  watch,
  repoSlug,
  onDone,
  pushToast,
}: {
  detail: TmdbDetail;
  watched: boolean;
  watch: Watch;
  repoSlug: string | null;
  onDone: () => Promise<void>;
  pushToast: PushToast;
}) {
  const markWatched = async () => {
    watch.setBusy(true);
    try {
      const result = await api.watchMovie({
        tmdb_id: detail.id,
        title: detail.title,
        year: detail.year,
        watched_at: toIsoWatchedAt(watch.watchedAt),
        rating: watch.rating,
        poster_path: detail.poster_path,
      });
      await reportWatchResult(pushToast, repoSlug, result);
      if (result.ok) await onDone();
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      watch.setBusy(false);
    }
  };

  return (
    <div className="mark-watched">
      <WatchControls
        watchedAt={watch.watchedAt}
        rating={watch.rating}
        onWatchedAtChange={watch.setWatchedAt}
        onRatingChange={watch.setRating}
      />
      <div className="watch-actions">
        <button className="btn btn-primary btn-lg" onClick={markWatched} disabled={watch.busy}>
          {watch.busy ? 'Committing…' : 'Mark watched — 1 commit'}
        </button>
        {watched ? (
          <span className="badge badge-watched">In your library — marking again records a rewatch</span>
        ) : null}
      </div>
      <p className="commit-preview">
        Commit: <code>Watched: {detail.title}{detail.year ? ` (${detail.year})` : ''}</code>
      </p>
    </div>
  );
}

function SeriesWatchPanel({
  detail,
  watch,
  repoSlug,
  onDone,
  pushToast,
}: {
  detail: TmdbDetail;
  watch: Watch;
  repoSlug: string | null;
  onDone: () => Promise<void>;
  pushToast: PushToast;
}) {
  const { watchedKeys } = useApp();
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [season, setSeason] = useState<TmdbSeason | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const seasons = useMemo(
    () => detail.seasons.filter((s) => s.season_number > 0 || (s.season_number === 0 && s.episode_count > 0)),
    [detail.seasons],
  );

  // Reset the season panel when navigating between series (routes reuse
  // DetailPage, so component state would otherwise persist).
  useEffect(() => {
    setSeasonNumber(null);
    setSeason(null);
    setSeasonError(null);
  }, [detail.id]);

  useEffect(() => {
    if (seasons.length > 0 && seasonNumber === null) {
      setSeasonNumber(seasons[0].season_number);
    }
  }, [seasons, seasonNumber]);

  useEffect(() => {
    if (seasonNumber === null) return;
    let cancelled = false;
    setSeasonLoading(true);
    setSeasonError(null);
    api
      .seasonDetail(detail.id, seasonNumber)
      .then((s) => {
        if (!cancelled) setSeason(s);
      })
      .catch((err) => {
        if (!cancelled) setSeasonError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setSeasonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail.id, seasonNumber]);

  const episodeWatched = (ep: TmdbEpisode) =>
    watchedKeys.has(`tv:${detail.id}:${ep.season_number}:${ep.episode_number}`);
  const watchedCount = season ? season.episodes.filter(episodeWatched).length : 0;
  const allWatched = season ? season.episodes.length > 0 && watchedCount === season.episodes.length : false;
  const unwatchedEpisodes = season ? season.episodes.filter((e) => !episodeWatched(e)) : [];

  const markEpisode = async (ep: TmdbEpisode) => {
    watch.setBusy(true);
    try {
      const result = await api.watchEpisode({
        tmdb_id: detail.id,
        title: detail.title,
        year: detail.year,
        watched_at: toIsoWatchedAt(watch.watchedAt),
        rating: watch.rating,
        poster_path: detail.poster_path,
        season: ep.season_number,
        episode: ep.episode_number,
        episode_title: ep.name,
      });
      await reportWatchResult(pushToast, repoSlug, result);
      if (result.ok) await onDone();
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      watch.setBusy(false);
    }
  };

  const markSeason = async () => {
    if (!season || unwatchedEpisodes.length === 0) return;
    watch.setBusy(true);
    try {
      const result = await api.watchSeason({
        tmdb_id: detail.id,
        title: detail.title,
        year: detail.year,
        watched_at: toIsoWatchedAt(watch.watchedAt),
        rating: watch.rating,
        poster_path: detail.poster_path,
        season: season.season_number,
        episodes: unwatchedEpisodes.map((e) => ({ episode: e.episode_number, episode_title: e.name })),
      });
      if (result.failed === 0) {
        pushToast({
          kind: 'success',
          message: `${result.succeeded} commits created — one per episode 🎉`,
          linkUrl: repoSlug ? `https://github.com/${repoSlug}/commits` : undefined,
          linkLabel: repoSlug ? 'View commits' : undefined,
        });
      } else if (result.succeeded > 0) {
        pushToast({
          kind: 'error',
          message: `Partial: ${result.succeeded}/${result.total} commits created. ${
            result.results.find((r) => !r.ok)?.error ?? ''
          }`,
        });
      } else {
        pushToast({
          kind: 'error',
          message: `Season commit failed: ${result.results[0]?.error ?? 'unknown error'}`,
        });
      }
      if (result.succeeded > 0) await onDone();
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      watch.setBusy(false);
    }
  };

  return (
    <div className="series-panel">
      {seasons.length > 0 ? (
        <>
          <div className="season-bar">
            {seasons.map((s) => (
              <button
                key={s.season_number}
                className={`chip chip-button ${seasonNumber === s.season_number ? 'chip-active' : ''}`}
                onClick={() => setSeasonNumber(s.season_number)}
              >
                {s.name} <span className="chip-count">{s.episode_count}</span>
              </button>
            ))}
          </div>

          {seasonLoading ? <div className="loading">Loading season…</div> : null}
          {seasonError ? <div className="alert alert-error">{seasonError}</div> : null}

          {season && !seasonLoading ? (
            <>
              <div className="season-toolbar">
                <span className="season-progress">
                  {watchedCount}/{season.episodes.length} watched
                </span>
                <WatchControls
                  watchedAt={watch.watchedAt}
                  rating={watch.rating}
                  onWatchedAtChange={watch.setWatchedAt}
                  onRatingChange={watch.setRating}
                />
                <button
                  className="btn btn-primary"
                  onClick={markSeason}
                  disabled={watch.busy || allWatched || unwatchedEpisodes.length === 0}
                  title={
                    allWatched
                      ? 'Every episode is already watched'
                      : `Creates ${unwatchedEpisodes.length} commits, one per episode, in order`
                  }
                >
                  {watch.busy
                    ? 'Committing…'
                    : allWatched
                      ? 'Season watched ✓'
                      : `Mark season — ${unwatchedEpisodes.length} commits`}
                </button>
              </div>
              <p className="commit-preview">
                Each episode is its own commit:{' '}
                <code>
                  Watched: {detail.title} S{String(season.season_number).padStart(2, '0')}E01 - …
                </code>
              </p>

              <ul className="episode-list">
                {season.episodes.map((ep) => {
                  const done = episodeWatched(ep);
                  return (
                    <li key={ep.episode_number} className={`episode-row ${done ? 'episode-watched' : ''}`}>
                      <span className="episode-num">E{String(ep.episode_number).padStart(2, '0')}</span>
                      <span className="episode-title">
                        {ep.name || `Episode ${ep.episode_number}`}
                        {ep.air_date ? <span className="episode-air">{ep.air_date}</span> : null}
                      </span>
                      {done ? (
                        <span className="badge badge-watched">Watched ✓</span>
                      ) : (
                        <button className="btn btn-small" onClick={() => markEpisode(ep)} disabled={watch.busy}>
                          Mark — 1 commit
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p className="empty">No season information available.</p>
      )}
    </div>
  );
}
