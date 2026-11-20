import { readFile } from 'node:fs/promises';
import 'dotenv/config';
import { Types } from 'mongoose';
import { connectLibrary } from './db.js';

if (!process.env.MONGO_URI) {
  console.error('Задай MONGO_URI у середовищі або у backend/.env.');
  process.exitCode = 1;
} else {
  const { connection, Entry } = await connectLibrary(process.env.MONGO_URI);
  try {
    const demo = JSON.parse(await readFile(new URL('../demo-library.json', import.meta.url), 'utf8'));
    const result = await Entry.bulkWrite(demo.entries.map(({ id, ...entry }, index) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id.split('-')[1].padStart(24, '0')) },
        update: { $setOnInsert: { watchedEpisodes: 0, totalEpisodes: null, revision: 0, ...entry,
          createdAt: new Date(demo.entries.length - index) } },
        upsert: true,
        timestamps: false,
      },
    })));
    console.log('Додано демозаписів: ' + result.upsertedCount + '.');
  } finally {
    await connection.close();
  }
}
