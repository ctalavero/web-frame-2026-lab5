import { z } from 'zod';
import { statuses as statusLabels, tiers as tierLabels } from '../../frontend/src/libraryFilters.mjs';

export const statuses = statusLabels.map(([id]) => id);
export const tiers = ['', ...tierLabels.map(([id]) => id)];
const tierValue = z.enum(tiers, { error: 'Обери рівень від S до E або «Без рівня».' });
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Некоректний ідентифікатор запису.');
export const revision = z.number().int().nonnegative({ error: 'Онови запис, щоб отримати його поточну версію.' });
export const categoryKey = (name) => name.normalize('NFC').toLocaleLowerCase('uk');
export const categoryInput = z.strictObject({
  name: z.string({ error: 'Введи назву категорії.' }).trim()
    .min(1, 'Введи назву категорії.').max(40, 'Назва категорії має містити до 40 символів.'),
});

function validPoster(value) {
  if (!value || /^\/art\/[a-z-]+\.webp$/.test(value)) return true;
  return /^https?:\/\//i.test(value) && URL.canParse(value);
}

const entryFields = {
  title: z.string({ error: 'Введи назву запису.' }).trim()
    .min(1, 'Введи назву запису.').max(100, 'Назва запису має містити до 100 символів.'),
  category: z.string().regex(/^[a-z\d-]{1,40}$/, 'Обери категорію.'),
  year: z.string().refine((value) => value === '' || (/^\d{4}$/.test(value) && +value >= 1888 && +value <= 2100),
    'Вкажи рік від 1888 до 2100.').default(''),
  status: z.enum(statuses, { error: 'Обери статус перегляду.' }),
  tier: tierValue.default(''),
  score: z.number({ error: 'Бал має бути цілим числом від 1 до 10.' }).int({ error: 'Бал має бути цілим числом.' })
    .min(1, 'Найменший бал — 1.').max(10, 'Найбільший бал — 10.').nullable().default(null),
  review: z.string().trim().max(2000, 'Відгук має містити до 2000 символів.').default(''),
  poster: z.string().trim().max(2048).refine(validPoster, 'Вкажи посилання на постер через https:// або http://.').default(''),
  watchedEpisodes: z.number().int().min(0).max(10000).default(0),
  totalEpisodes: z.number().int().min(1).max(10000).nullable().default(null),
  seasons: z.array(z.strictObject({
    totalEpisodes: z.number().int().min(1).max(10000),
    watchedEpisodes: z.number().int().min(0).max(10000),
  })).max(50, 'Можна додати до 50 сезонів.').optional(),
};

export const newEntry = z.strictObject(entryFields);
export const editedEntry = z.strictObject({ ...entryFields, revision });
export const advanceInput = z.strictObject({ revision });
export const tierUpdateInput = z.strictObject({ tier: tierValue, revision });
export const revisionQuery = z.string().regex(/^\d+$/, 'Вкажи версію запису.').transform(Number).pipe(revision);
export const tierExportQuery = z.strictObject({
  format: z.enum(['png', 'jpeg'], { error: 'Обери PNG або JPEG.' }).default('png'),
  category: z.string().regex(/^[a-z\d-]{1,40}$/, 'Обери наявну категорію.').optional(),
  status: z.enum(statuses, { error: 'Обери статус перегляду.' }).optional(),
  q: z.string().trim().max(100, 'Пошук підтримує до 100 символів.').default(''),
  sort: z.enum(['recent', 'score', 'title']).default('recent'),
});
