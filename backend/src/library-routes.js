import { Router } from 'express';
import { advanceInput, categoryInput, editedEntry, newEntry, objectId, revisionQuery, tierUpdateInput } from './library-input.js';

export function libraryRoutes(library) {
  const router = Router();
  router.param('id', (req, _res, next, id) => {
    req.entryId = objectId.parse(id);
    next();
  });

  router.get('/library', async (_req, res) => res.json(await library.list()));
  router.get('/stats', async (_req, res) => res.json(await library.stats()));
  router.get('/suggestion', async (req, res) => {
    res.json(await library.suggest(objectId.optional().parse(req.query.exclude)));
  });
  router.post('/categories', async (req, res) => {
    res.status(201).json(await library.addCategory(categoryInput.parse(req.body)));
  });
  router.post('/entries', async (req, res) => {
    const entry = await library.addEntry(newEntry.parse(req.body));
    res.location('/api/entries/' + entry.id).status(201).json(entry);
  });
  router.get('/entries/:id', async (req, res) => res.json(await library.entry(req.entryId)));
  router.put('/entries/:id', async (req, res) => {
    res.json(await library.editEntry(req.entryId, editedEntry.parse(req.body)));
  });
  router.delete('/entries/:id', async (req, res) => {
    await library.deleteEntry(req.entryId, revisionQuery.parse(req.query.revision));
    res.sendStatus(204);
  });
  router.patch('/entries/:id/progress', async (req, res) => {
    const { revision } = advanceInput.parse(req.body);
    res.json(await library.advance(req.entryId, revision));
  });
  router.patch('/entries/:id/tier', async (req, res) => {
    const { tier, revision } = tierUpdateInput.parse(req.body);
    res.json(await library.setTier(req.entryId, revision, tier));
  });
  return router;
}
