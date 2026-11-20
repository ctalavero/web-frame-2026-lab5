import { join } from 'node:path';
import cors from 'cors';
import express from 'express';
import { errorHandler, HttpError } from './errors.js';
import { libraryRoutes } from './library-routes.js';
import { createLibraryService } from './library-service.js';
import { tierExportQuery } from './library-input.js';
import { createTierExporter } from './tier-export.js';

export function createApp({ connection, Entry, Category, clientOrigins = [], frontendDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  const api = express.Router();
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) return callback(null, Boolean(origin));
      callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Запити з цієї адреси заборонено.'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  }));
  api.use((_req, _res, next) => {
    if (connection.readyState !== 1) throw new HttpError(503, 'DB_UNAVAILABLE', 'База даних тимчасово недоступна. Спробуй ще раз.');
    next();
  });
  api.get('/health', async (_req, res) => {
    await connection.db.command({ ping: 1 });
    res.json({ status: 'ok' });
  });
  const exportTiers = createTierExporter({ Entry, Category });
  api.get('/tier-list/export', async (req, res) => {
    const options = tierExportQuery.parse(req.query);
    const bytes = await exportTiers(options);
    const extension = options.format === 'jpeg' ? 'jpg' : 'png';
    res.attachment('pislia-tytriv-tier-list.' + extension).type('image/' + options.format).send(bytes);
  });
  api.use(express.json({ limit: '16kb' }));
  api.use(libraryRoutes(createLibraryService({ Entry, Category })));
  api.use((_req, _res) => { throw new HttpError(404, 'ROUTE_NOT_FOUND', 'Такого маршруту API немає.'); });
  app.use('/api', api);
  if (frontendDir) {
    app.use(express.static(frontendDir));
    app.get('/', (_req, res) => res.sendFile(join(frontendDir, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
