/**
 * Commit message formatting. One commit per watch is the product's core
 * mechanic, so message shape is specified exactly:
 *
 *   movie:   `Watched: <Title> (<Year>)`
 *   episode: `Watched: <Series> S01E04 - <EpisodeTitle>`
 */

/** Zero-pad a season/episode number to at least two digits. */
export function padSeasonEpisode(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatMovieCommitMessage(title: string, year: number | null | undefined): string {
  const cleanTitle = title.trim();
  if (year === null || year === undefined) {
    return `Watched: ${cleanTitle}`;
  }
  return `Watched: ${cleanTitle} (${year})`;
}

export function formatEpisodeCommitMessage(
  seriesTitle: string,
  season: number,
  episode: number,
  episodeTitle: string,
): string {
  const cleanSeries = seriesTitle.trim();
  const cleanEpisode = episodeTitle.trim();
  const code = `S${padSeasonEpisode(season)}E${padSeasonEpisode(episode)}`;
  if (!cleanEpisode) {
    return `Watched: ${cleanSeries} ${code}`;
  }
  return `Watched: ${cleanSeries} ${code} - ${cleanEpisode}`;
}
