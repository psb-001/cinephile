import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../AppContext.js';

/**
 * Shared watch controls: date picker (defaults to today) + optional rating.
 * The date backdates the commit's author date, lighting up that day's
 * contribution square.
 */
export function WatchControls({
  watchedAt,
  rating,
  onWatchedAtChange,
  onRatingChange,
}: {
  watchedAt: string;
  rating: number | null;
  onWatchedAtChange: (v: string) => void;
  onRatingChange: (v: number | null) => void;
}) {
  return (
    <div className="watch-controls">
      <label className="watch-field">
        <span>Watched on</span>
        <input
          type="date"
          value={watchedAt}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onWatchedAtChange(e.target.value)}
        />
      </label>
      <label className="watch-field">
        <span>Rating (optional)</span>
        <select value={rating ?? ''} onChange={(e) => onRatingChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">—</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n} / 10
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function useWatchState() {
  const [watchedAt, setWatchedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  return { watchedAt, setWatchedAt, rating, setRating, busy, setBusy };
}

/** iso datetime at 20:00 local of the chosen day (sensible default hour). */
export function toIsoWatchedAt(dateStr: string): string {
  const d = new Date(`${dateStr}T20:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export async function reportWatchResult(
  pushToast: (t: { kind: 'success' | 'error'; message: string; linkUrl?: string; linkLabel?: string }) => void,
  repoSlug: string | null,
  result: { ok: boolean; commitSha?: string; message: string; error?: string },
) {
  if (result.ok) {
    const url =
      repoSlug && result.commitSha
        ? `https://github.com/${repoSlug}/commit/${result.commitSha}`
        : repoSlug
          ? `https://github.com/${repoSlug}/commits`
          : undefined;
    pushToast({
      kind: 'success',
      message: `Commit created — ${result.message}`,
      linkUrl: url,
      linkLabel: url ? 'View commit' : undefined,
    });
  } else {
    pushToast({ kind: 'error', message: `Commit failed: ${result.error ?? 'unknown error'}` });
  }
}
