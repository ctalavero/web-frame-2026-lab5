import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { createApp } from './app.js';
import { connectLibrary } from './db.js';

const { MONGO_URI, PORT = '4176', CLIENT_ORIGINS = '', RENDER_EXTERNAL_URL, HOST = '0.0.0.0' } = process.env;
const frontend = fileURLToPath(new URL('../../frontend/build/', import.meta.url));
const port = Number(PORT);
let db;
try {
  if (!MONGO_URI) throw new Error('Задай MONGO_URI у середовищі або у backend/.env.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT має бути від 1 до 65535.');
  const clientOrigins = [
    'http://127.0.0.1:' + port, 'http://localhost:' + port,
    RENDER_EXTERNAL_URL, ...CLIENT_ORIGINS.split(','),
  ].map((value) => value?.trim()).filter(Boolean).map((value) => new URL(value).origin);
  db = await connectLibrary(MONGO_URI);
  const server = createApp({ ...db, clientOrigins, frontendDir: existsSync(frontend) ? frontend : undefined })
    .listen(port, HOST);
  await once(server, 'listening');
  console.log('MongoDB підключено. HTTP-порт ' + port + '.');
  const shutdown = () => server.close(async (error) => {
    await db.connection.close();
    if (error) process.exitCode = 1;
  });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  await db?.connection.close();
  console.error('Сервер не запустився.', error.name === 'Error' &&
    /^(Задай MONGO_URI|PORT має бути)/.test(error.message) ? error.message : (error.code ?? error.name));
  process.exitCode = 1;
}
