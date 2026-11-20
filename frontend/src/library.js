import { statuses, tiers } from './libraryFilters.mjs';
export { statuses, tiers, pickEntries } from './libraryFilters.mjs';

export const initialCategories = [
  { id: 'film', name: 'Фільми' },
  { id: 'tv', name: 'Серіали' },
  { id: 'animation', name: 'Анімація' },
  { id: 'doc', name: 'Документальні' },
];

export function isLibrary(value) {
  if (!Array.isArray(value?.entries) || !Array.isArray(value?.categories)) return false;
  const { entries, categories } = value;
  return categories.length > 0 &&
    categories.every((item) => typeof item?.id === 'string' && typeof item?.name === 'string') &&
    entries.every((entry) => entry && ['id', 'title', 'year', 'review', 'poster', 'tier'].every(
      (key) => typeof entry[key] === 'string',
    ) && categories.some(({ id }) => id === entry.category) &&
      statuses.some(([id]) => id === entry.status) &&
      (entry.tier === '' || tiers.some(([id]) => id === entry.tier)) &&
      (entry.score === null || (Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 10)));
}

export function isPosterAddress(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
