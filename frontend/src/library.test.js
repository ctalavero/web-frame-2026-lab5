import { initialCategories, isLibrary, isPosterAddress, pickEntries } from './library';

const archive = [
  { id: 'one', title: 'Нічний міст', category: 'film', year: '2023', status: 'watched', tier: 'A', score: 9, review: '', poster: '' },
  { id: 'two', title: 'Тиша', category: 'film', year: '', status: 'planned', tier: '', score: null, review: '', poster: '' },
  { id: 'three', title: 'Пізній рейс', category: 'tv', year: '', status: 'watched', tier: 'B', score: 7, review: '', poster: '' },
];

test('combines category, watch status and a case-insensitive title search', () => {
  const filters = { category: 'film', status: 'watched', query: '  НІЧНИЙ ', sort: 'recent' };
  expect(pickEntries(archive, filters).map(({ id }) => id)).toEqual(['one']);
});

test('sorts by personal score with unrated titles last and preserves input order', () => {
  expect(pickEntries(archive, { query: '', sort: 'score' }).map(({ id }) => id)).toEqual(['one', 'three', 'two']);
  expect(archive.map(({ id }) => id)).toEqual(['one', 'two', 'three']);
});

test('recognizes valid library data and rejects malformed records', () => {
  expect(isLibrary({ entries: archive, categories: initialCategories })).toBe(true);
  expect(isLibrary({ entries: [], categories: initialCategories })).toBe(true);
  expect(isLibrary({ entries: [{ ...archive[0], score: 11 }], categories: initialCategories })).toBe(false);
  expect(isLibrary({ entries: [null], categories: initialCategories })).toBe(false);
});

test('accepts only HTTP(S) addresses for custom posters', () => {
  expect(isPosterAddress('')).toBe(true);
  expect(isPosterAddress('https://example.com/cover.webp')).toBe(true);
  expect(isPosterAddress('javascript:alert(1)')).toBe(false);
  expect(isPosterAddress('/local-path')).toBe(false);
});
