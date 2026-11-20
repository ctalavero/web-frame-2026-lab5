import mongoose from 'mongoose';
import { categoryKey, statuses, tiers } from './library-input.js';

export const defaultCategories = [
  { _id: 'film', name: 'Фільми' },
  { _id: 'tv', name: 'Серіали' },
  { _id: 'animation', name: 'Анімація' },
  { _id: 'doc', name: 'Документальні' },
];

const options = { timestamps: true, versionKey: false, bufferCommands: false };
const categorySchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true, maxlength: 40 },
  nameKey: { type: String, required: true, unique: true },
}, options);

const seasonSchema = new mongoose.Schema({
  totalEpisodes: { type: Number, required: true, min: 1, max: 10000 },
  watchedEpisodes: { type: Number, required: true, min: 0, max: 10000 },
}, { _id: false });

const entrySchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 100 },
  category: { type: String, ref: 'Category', required: true },
  year: { type: String, default: '' },
  status: { type: String, enum: statuses, required: true },
  tier: { type: String, enum: tiers, default: '' },
  score: { type: Number, min: 1, max: 10, default: null },
  review: { type: String, maxlength: 2000, default: '' },
  poster: { type: String, maxlength: 2048, default: '' },
  watchedEpisodes: { type: Number, min: 0, max: 10000, default: 0 },
  totalEpisodes: { type: Number, min: 1, max: 10000, default: null },
  seasons: { type: [seasonSchema], default: undefined },
  revision: { type: Number, min: 0, default: 0 },
}, options);

export async function connectLibrary(uri, options = {}) {
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 10000, maxPoolSize: 10, ...options,
  });
  try {
    await connection.asPromise();
    const Entry = connection.model('Entry', entrySchema);
    const Category = connection.model('Category', categorySchema);
    await Promise.all([Entry.init(), Category.init()]);
    await Category.bulkWrite(defaultCategories.map(({ _id, name }, index) => ({
      updateOne: {
        filter: { _id },
        update: { $setOnInsert: { name, nameKey: categoryKey(name), createdAt: new Date(index) } },
        upsert: true,
        timestamps: false,
      },
    })));
    return { connection, Entry, Category };
  } catch (error) {
    await connection.close();
    throw error;
  }
}
