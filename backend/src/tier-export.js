import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { entryMatcher, sortEntries, statuses, tiers } from '../../frontend/src/libraryFilters.mjs';
import { HttpError } from './errors.js';

const FONT = 'Tier Export';
const font = fileURLToPath(new URL('../assets/Manrope.ttf', import.meta.url));
const art = new URL('../../frontend/public/art/', import.meta.url);
const maxWidth = 1200;
const margin = 48;
const tierWidth = 160;
const gap = 12;
const maxColumns = 3;
const cardHeight = 108;
const cardWidth = (maxWidth - 2 * margin - tierWidth - maxColumns * gap) / maxColumns;
const palette = { S: '#ffc170', A: '#f9a088', B: '#f1d78c', C: '#adda93', D: '#97c0e7', E: '#c9a6ee', '': '#bfb2c0' };
const graphemes = new Intl.Segmenter('uk', { granularity: 'grapheme' });
const limit = 96;
let registeredFont;

function box(ctx, x, y, w, h, color, radius = 12) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function type(ctx, size, weight, color) {
  ctx.font = `${weight} ${size}px "${FONT}"`;
  ctx.fillStyle = color;
}

function fit(ctx, value, maxWidth, lineLimit = 1) {
  const lines = [];
  let rest = value.trim().replace(/\s+/gu, ' ');
  while (rest && lines.length < lineLimit) {
    if (ctx.measureText(rest).width <= maxWidth) {
      lines.push(rest);
      break;
    }
    const last = lines.length === lineLimit - 1;
    let end = 0;
    for (const { segment, index } of graphemes.segment(rest)) {
      const next = index + segment.length;
      if (ctx.measureText(rest.slice(0, next) + (last ? '…' : '')).width > maxWidth) break;
      end = next;
    }
    if (!last) {
      const space = rest.lastIndexOf(' ', end);
      if (space > 0) end = space;
    }
    lines.push(rest.slice(0, end).trimEnd() + (last ? '…' : ''));
    if (end === 0) break;
    rest = rest.slice(end).trimStart();
  }
  return lines;
}

async function poster(source) {
  const match = /^\/art\/([a-z-]+\.webp)$/.exec(source ?? '');
  if (!match) return null;
  try {
    return await loadImage(await readFile(new URL(match[1], art)));
  } catch {
    return null;
  }
}

function drawEntry(ctx, entry, image, category, x, y) {
  box(ctx, x, y, cardWidth, cardHeight, '#26202a');
  let textX = x + 15;
  if (image?.width && image.height) {
    const ratio = Math.max(52 / image.width, 78 / image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 15, 52, 78, 6);
    ctx.clip();
    ctx.drawImage(image, x + 12 + (52 - w) / 2, y + 15 + (78 - h) / 2, w, h);
    ctx.restore();
    textX = x + 78;
  }
  const max = x + cardWidth - textX - 14;
  type(ctx, 22, 700, '#f8f1ef');
  fit(ctx, entry.title, max, 3).forEach((line, index) => ctx.fillText(line, textX, y + 27 + index * 23));
  type(ctx, 16, 600, '#d4c5d5');
  const meta = [category, entry.year, entry.score == null ? '' : `${entry.score}/10`].filter(Boolean).join(' · ');
  ctx.fillText(fit(ctx, meta, max)[0] ?? '', textX, y + 91);
}

async function render(entries, { categories, label, format }) {
  registeredFont ??= GlobalFonts.registerFromPath(font, FONT);
  if (!registeredFont) throw new Error('The export font cannot be loaded.');

  const levels = [...tiers, ['', 'Без рівня']]
    .map(([tier, label]) => ({ tier, label, entries: entries.filter((entry) => entry.tier === tier) }))
    .filter((level) => level.entries.length);
  const columns = Math.min(maxColumns, Math.max(...levels.map((level) => level.entries.length)));
  const width = Math.round(2 * margin + tierWidth + columns * (gap + cardWidth));
  const rowHeight = (level) => Math.ceil(level.entries.length / columns) * (cardHeight + gap);
  const firstRow = 132;
  const height = firstRow + levels.reduce((sum, level) => sum + rowHeight(level), 0) + margin - gap;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121015';
  ctx.fillRect(0, 0, width, height);
  type(ctx, 49, 800, '#f8f1ef');
  ctx.fillText('Тірліст', margin, 72);
  type(ctx, 20, 750, '#f3bb68');
  ctx.textAlign = 'right';
  ctx.fillText('Після титрів', width - margin, 69);
  ctx.textAlign = 'left';
  type(ctx, 20, 600, '#d4c5d5');
  ctx.fillText(fit(ctx, label, width - margin * 2)[0], margin, 103);

  const paths = [...new Set(entries.map((entry) => entry.poster))];
  const images = new Map(await Promise.all(paths.map(async (path) => [path, await poster(path)])));
  let y = firstRow;
  for (const level of levels) {
    box(ctx, margin, y, tierWidth, rowHeight(level) - gap, palette[level.tier]);
    type(ctx, 34, 800, '#241820');
    ctx.fillText(level.tier || '—', margin + 15, y + 41);
    type(ctx, 17, 750, '#241820');
    fit(ctx, level.label, tierWidth - 30, 2).forEach((line, index) => ctx.fillText(line, margin + 15, y + 68 + index * 19));
    level.entries.forEach((entry, index) => {
      const x = margin + tierWidth + gap + index % columns * (cardWidth + gap);
      const cardY = y + Math.floor(index / columns) * (cardHeight + gap);
      drawEntry(ctx, entry, images.get(entry.poster), categories.get(entry.category), x, cardY);
    });
    y += rowHeight(level);
  }
  return format === 'jpeg' ? canvas.encode('jpeg', 90) : canvas.encode('png');
}

export function createTierExporter({ Entry, Category }) {
  let active = 0;
  return async ({ category, status, q, sort, format }) => {
    if (active >= 2) throw new HttpError(503, 'EXPORT_BUSY', 'Готуємо інші зображення. Спробуй за мить.');
    active += 1;
    try {
      const categories = new Map((await Category.find().select('name').lean()).map(({ _id, name }) => [_id, name]));
      if (category && !categories.has(category)) throw new HttpError(400, 'INVALID_INPUT', 'Обери наявну категорію.');
      const match = entryMatcher({ category, status, query: q });
      const entries = [];
      const query = { ...(category && { category }), ...(status && { status }) };
      const cursor = Entry.find(query).select('title category year status tier score poster')
        .sort({ createdAt: -1, _id: -1 }).lean().cursor();
      for await (const entry of cursor) {
        if (!match(entry)) continue;
        if (entries.length === limit) {
          throw new HttpError(413, 'EXPORT_TOO_LARGE', 'В одному зображенні можна зберегти до 96 записів. Звузь фільтр.');
        }
        entries.push(entry);
      }
      if (!entries.length) throw new HttpError(404, 'EMPTY_EXPORT', 'За цими фільтрами немає записів для збереження.');
      const label = [
        categories.get(category) ?? 'Усі категорії',
        statuses.find(([id]) => id === status)?.[1],
        q && `«${q}»`,
      ].filter(Boolean).join(' · ');
      return await render(sortEntries(entries, sort), { categories, label, format });
    } finally {
      active -= 1;
    }
  };
}
