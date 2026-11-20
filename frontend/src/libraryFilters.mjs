const statuses = [
  ['planned', 'У планах'],
  ['watching', 'Дивлюсь'],
  ['watched', 'Переглянуто'],
];

const tiers = [
  ['S', 'Топ'],
  ['A', 'Супер'],
  ['B', 'Середнє'],
  ['C', 'На любителя'],
  ['D', 'Можна пропустити'],
  ['E', 'Дуже погано'],
];

function entryMatcher({ category, status, query = '' }) {
  const text = query.trim().normalize('NFC').toLocaleLowerCase('uk');
  return (entry) => (!category || category === entry.category) && (!status || status === entry.status) &&
    entry.title.normalize('NFC').toLocaleLowerCase('uk').includes(text);
}

function sortEntries(entries, sort) {
  if (sort === 'score') entries.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (sort === 'title') entries.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
  return entries;
}

function pickEntries(entries, filters) {
  return sortEntries(entries.filter(entryMatcher(filters)), filters.sort);
}

export { statuses, tiers, entryMatcher, sortEntries, pickEntries };
