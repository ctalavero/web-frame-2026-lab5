import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { HttpError } from './errors.js';
import { categoryKey, statuses } from './library-input.js';
import { advanceProgress, normalizeProgress } from './progress.js';

const missingEntry = () => new HttpError(404, 'ENTRY_NOT_FOUND', 'Цього запису вже немає в колекції.');
const staleEntry = () => new HttpError(409, 'STALE_ENTRY', 'Запис змінився в іншій вкладці. Закрий форму й відкрий запис знову.');
const entryView = ({ _id, title, category, year, status, tier, score, review, poster,
  watchedEpisodes, totalEpisodes, seasons = [], revision }) => ({
  id: String(_id), title, category, year, status, tier, score, review, poster, watchedEpisodes, totalEpisodes, seasons, revision,
});
const categoryView = ({ _id, name }) => ({ id: _id, name });

export function createLibraryService({ Entry, Category }) {
  async function findEntry(id) {
    const entry = await Entry.findById(id).lean();
    if (!entry) throw missingEntry();
    return entry;
  }

  async function requireCategory(id) {
    if (!await Category.exists({ _id: id })) {
      throw new HttpError(400, 'INVALID_INPUT', 'Обери наявну категорію.');
    }
  }

  async function updateEntry(id, revision, changes) {
    const result = await Entry.findOneAndUpdate({ _id: id, revision }, {
      $set: changes,
      $inc: { revision: 1 },
    }, { returnDocument: 'after', runValidators: true }).lean();
    if (!result) {
      await findEntry(id);
      throw staleEntry();
    }
    return entryView(result);
  }

  return {
    async list() {
      const [categories, entries] = await Promise.all([
        Category.find().sort({ createdAt: 1, _id: 1 }).lean(),
        Entry.find().sort({ createdAt: -1, _id: -1 }).lean(),
      ]);
      return { categories: categories.map(categoryView), entries: entries.map(entryView) };
    },
    async entry(id) {
      return entryView(await findEntry(id));
    },
    async addCategory({ name }) {
      try {
        return categoryView(await Category.create({ _id: randomUUID(), name, nameKey: categoryKey(name) }));
      } catch (error) {
        if (error.code === 11000) {
          throw new HttpError(409, 'CATEGORY_EXISTS', 'Категорія з такою назвою вже є.');
        }
        throw error;
      }
    },
    async addEntry(draft) {
      const entry = normalizeProgress(draft);
      await requireCategory(entry.category);
      return entryView(await Entry.create(entry));
    },
    async editEntry(id, { revision, ...draft }) {
      if (draft.seasons === undefined) draft.seasons = (await findEntry(id)).seasons;
      const entry = normalizeProgress(draft);
      await requireCategory(entry.category);
      return updateEntry(id, revision, entry);
    },
    async deleteEntry(id, revision) {
      const { deletedCount } = await Entry.deleteOne({ _id: id, revision });
      if (deletedCount === 0) {
        await findEntry(id);
        throw staleEntry();
      }
    },
    async advance(id, revision) {
      const entry = await findEntry(id);
      if (entry.revision !== revision) throw staleEntry();
      return updateEntry(id, revision, advanceProgress(entry));
    },
    async setTier(id, revision, tier) {
      return updateEntry(id, revision, { tier });
    },
    async stats() {
      const groups = await Entry.aggregate([{
        $group: {
          _id: '$status',
          total: { $sum: 1 },
          scoreSum: { $sum: '$score' },
          rated: { $sum: { $cond: [{ $isNumber: '$score' }, 1, 0] } },
          watchedEpisodes: { $sum: '$watchedEpisodes' },
        },
      }]);
      const result = { total: 0, planned: 0, watching: 0, watched: 0, rated: 0, averageScore: null, watchedEpisodes: 0 };
      let scoreSum = 0;
      for (const group of groups) {
        if (statuses.includes(group._id)) result[group._id] = group.total;
        result.total += group.total;
        result.rated += group.rated;
        result.watchedEpisodes += group.watchedEpisodes;
        scoreSum += group.scoreSum;
      }
      if (result.rated) result.averageScore = Math.round(scoreSum / result.rated * 100) / 100;
      return result;
    },
    async suggest(exclude) {
      const filter = { status: 'planned' };
      if (exclude) filter._id = { $ne: new Types.ObjectId(exclude) };
      const [entry] = await Entry.aggregate([{ $match: filter }, { $sample: { size: 1 } }]);
      if (!entry) throw new HttpError(404, 'NO_PLANS', 'У планах немає інших записів.');
      return entryView(entry);
    },
  };
}
