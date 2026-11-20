import { HttpError } from './errors.js';

export function normalizeProgress(entry) {
  let { totalEpisodes, watchedEpisodes, seasons = [], status } = entry;
  if (seasons.length) {
    if (seasons.some((season) => season.watchedEpisodes > season.totalEpisodes)) {
      throw new HttpError(400, 'INVALID_INPUT', 'Перевір кількість переглянутих епізодів у сезонах.');
    }
    if (status === 'watched') {
      seasons = seasons.map((season) => ({ ...season, watchedEpisodes: season.totalEpisodes }));
    }
    totalEpisodes = seasons.reduce((sum, season) => sum + season.totalEpisodes, 0);
    watchedEpisodes = seasons.reduce((sum, season) => sum + season.watchedEpisodes, 0);
    if (totalEpisodes > 10000) throw new HttpError(400, 'INVALID_INPUT', 'Загалом можна додати до 10 000 епізодів.');
  } else if (watchedEpisodes > (totalEpisodes ?? 0)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Переглянутих епізодів має бути не більше за загальну кількість.');
  }
  if (totalEpisodes !== null) {
    if (status === 'watched' || watchedEpisodes === totalEpisodes) {
      status = 'watched';
      watchedEpisodes = totalEpisodes;
    } else if (watchedEpisodes > 0) status = 'watching';
  }
  return { ...entry, seasons, totalEpisodes, watchedEpisodes, status };
}

export function advanceProgress(entry) {
  const { totalEpisodes, watchedEpisodes, seasons = [] } = entry;
  if (!totalEpisodes || watchedEpisodes >= totalEpisodes) {
    throw new HttpError(409, 'NO_NEXT_EPISODE', 'Для цього запису немає наступного епізоду.');
  }
  const nextSeason = seasons.findIndex((season) => season.watchedEpisodes < season.totalEpisodes);
  const next = normalizeProgress({
    totalEpisodes,
    watchedEpisodes: watchedEpisodes + 1,
    status: 'watching',
    seasons: seasons.map((season, index) => index === nextSeason
      ? { ...season, watchedEpisodes: season.watchedEpisodes + 1 } : season),
  });
  return next;
}
