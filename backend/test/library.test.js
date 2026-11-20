import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { connectLibrary } from '../src/db.js';

const mongoUri = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27025';
const origin = 'http://127.0.0.1:4177';

test('library API against MongoDB', async (t) => {
  const dbName = 'lab5_test_' + randomUUID().replaceAll('-', '');
  let db = await connectLibrary(mongoUri, { dbName });
  let server;
  let url;

  async function startServer() {
    server = createApp({ ...db, clientOrigins: [origin] }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    url = 'http://127.0.0.1:' + server.address().port;
  }

  const stopServer = () => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });

  t.after(async () => {
    try {
      if (server?.listening) await stopServer();
      await db.connection.dropDatabase();
    } finally {
      await db.connection.close();
    }
  });

  await startServer();

  async function request(path, { method = 'GET', body, headers, expected = 200 } = {}) {
    const response = await fetch(url + '/api' + path, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, expected, method + ' ' + path);
    return expected === 204 ? response : response.json();
  }

  const draft = { title: 'Останній сеанс', year: '2026', category: 'tv', status: 'planned',
    tier: '', score: null, review: '', poster: '', watchedEpisodes: 0, totalEpisodes: 2 };
  const create = (body = draft) => request('/entries', { method: 'POST', body, expected: 201 });

  await t.test('empty library and health', async () => {
    assert.deepEqual(await request('/health'), { status: 'ok' });
    const { categories, entries } = await request('/library');
    assert.equal(categories.length, 4);
    assert.deepEqual(entries, []);
    assert.equal((await request('/stats')).averageScore, null);
    assert.equal((await request('/suggestion', { expected: 404 })).error.code, 'NO_PLANS');
  });

  await t.test('categories are unique regardless of case and concurrent creation', async () => {
    const responses = await Promise.all(['  Аніме ', 'АНІМЕ'].map((name) =>
      fetch(url + '/api/categories', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }) })));
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
    assert.equal((await request('/library')).categories.length, 5);
  });

  await t.test('invalid fields, JSON, and routes return structured errors', async () => {
    for (const invalid of [
      { title: ' ' }, { category: 'ghost' }, { score: '9' }, { totalEpisodes: 1, watchedEpisodes: 2 },
      { totalEpisodes: null, watchedEpisodes: 1 }, { poster: 'javascript:alert(1)' }, { title: { value: 'broken' } },
      { year: '1800' }, { revision: 99 },
    ]) {
      const result = await request('/entries', { method: 'POST', body: { ...draft, ...invalid }, expected: 400 });
      assert.equal(result.error.code, 'INVALID_INPUT');
    }
    const badJson = await fetch(url + '/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(badJson.status, 400);
    assert.equal((await badJson.json()).error.code, 'INVALID_JSON');
    await request('/entries/invalid', { expected: 400 });
    await request('/unknown', { expected: 404 });
  });

  await t.test('CORS allows configured origins and blocks other origins', async () => {
    const headers = { origin, 'access-control-request-method': 'PATCH' };
    const allowed = await request('/entries', { method: 'OPTIONS', headers, expected: 204 });
    assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
    const denied = await fetch(url + '/api/library', { headers: { origin: 'https://other.example' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });

  await t.test('CRUD persists across connection restart and rejects stale edits', async () => {
    const entry = await create({ ...draft, title: '  Останній сеанс  ' });
    assert.equal(entry.title, draft.title);
    assert.equal(entry.revision, 0);
    await stopServer();
    await db.connection.close();
    db = await connectLibrary(mongoUri, { dbName });
    await startServer();
    assert.deepEqual(await request('/entries/' + entry.id), entry);
    const updated = await request('/entries/' + entry.id, { method: 'PUT',
      body: { ...draft, title: 'Новий сеанс', revision: entry.revision } });
    assert.equal(updated.revision, 1);
    assert.equal(updated.title, 'Новий сеанс');
    const stale = await request('/entries/' + entry.id, { method: 'PUT',
      body: { ...draft, revision: 0 }, expected: 409 });
    assert.equal(stale.error.code, 'STALE_ENTRY');
    const staleDelete = await request('/entries/' + entry.id + '?revision=0', { method: 'DELETE', expected: 409 });
    assert.equal(staleDelete.error.code, 'STALE_ENTRY');
    await request('/entries/' + entry.id + '?revision=1', { method: 'DELETE', expected: 204 });
    const missing = await request('/entries/' + entry.id, { expected: 404 });
    assert.equal(missing.error.code, 'ENTRY_NOT_FOUND');
  });

  await t.test('progress advances once per revision and the final episode marks a title watched', async () => {
    const entry = await create({ ...draft, score: 8, tier: 'A' });
    const other = await create({ ...draft, score: 9, totalEpisodes: null });
    const untracked = await request('/entries/' + other.id + '/progress', {
      method: 'PATCH', body: { revision: 0 }, expected: 409,
    });
    assert.equal(untracked.error.code, 'NO_NEXT_EPISODE');
    const progressUrl = url + '/api/entries/' + entry.id + '/progress';
    const step = (revision) => fetch(progressUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision }) });
    const attempts = await Promise.all([step(0), step(0)]);
    assert.deepEqual(attempts.map(({ status }) => status).sort(), [200, 409]);
    const first = await attempts.find(({ ok }) => ok).json();
    assert.equal(first.status, 'watching');
    assert.equal(first.watchedEpisodes, 1);
    const last = await (await step(first.revision)).json();
    assert.equal(last.status, 'watched');
    assert.equal(last.watchedEpisodes, 2);
    assert.equal((await step(last.revision)).status, 409);
    assert.deepEqual(await request('/stats'), {
      total: 2, planned: 1, watching: 0, watched: 1, rated: 2, averageScore: 8.5, watchedEpisodes: 2,
    });
    assert.equal((await request('/suggestion')).id, other.id);
    assert.equal((await request('/suggestion?exclude=' + other.id, { expected: 404 })).error.code, 'NO_PLANS');
  });

  await t.test('seasons are persisted, validated, and advanced in order', async () => {
    const invalid = await request('/entries', { method: 'POST', expected: 400,
      body: { ...draft, seasons: [{ totalEpisodes: 1, watchedEpisodes: 2 }] } });
    assert.equal(invalid.error.code, 'INVALID_INPUT');
    const seasons = [{ totalEpisodes: 2, watchedEpisodes: 1 }, { totalEpisodes: 1, watchedEpisodes: 0 }];
    const created = await create({ ...draft, seasons });
    assert.equal(created.watchedEpisodes, 1);
    assert.equal(created.totalEpisodes, 3);
    assert.deepEqual(created.seasons, seasons);
    const path = '/entries/' + created.id;
    const edited = await request(path, { method: 'PUT', body: { ...draft, revision: 0 } });
    assert.deepEqual(edited.seasons, seasons);
    const advance = (revision) => request(path + '/progress', { method: 'PATCH', body: { revision } });
    const first = await advance(edited.revision);
    assert.deepEqual(first.seasons.map((season) => season.watchedEpisodes), [2, 0]);
    const last = await advance(first.revision);
    assert.deepEqual(last.seasons.map((season) => season.watchedEpisodes), [2, 1]);
    assert.equal(last.status, 'watched');
    assert.equal((await request(path)).watchedEpisodes, 3);
  });

  await t.test('tier export returns filter-aware raster files and explicit empty errors', async () => {
    await create({ ...draft, status: 'watched', category: 'animation', title: 'Тиха орбіта', tier: 'S', score: 10 });
    const response = await fetch(url + '/api/tier-list/export?category=animation&status=watched&q=ТИХА&format=png');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('content-disposition'), /attachment.*\.png/);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 571);

    const jpeg = await fetch(url + '/api/tier-list/export?category=animation&format=jpeg');
    assert.equal(jpeg.status, 200);
    assert.equal(jpeg.headers.get('content-type'), 'image/jpeg');
    assert.equal(Buffer.from(await jpeg.arrayBuffer()).subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.equal((await request('/tier-list/export?category=film&q=ТИХА', { expected: 404 })).error.code, 'EMPTY_EXPORT');
    assert.equal((await request('/tier-list/export?format=svg', { expected: 400 })).error.code, 'INVALID_INPUT');
    assert.equal((await request('/tier-list/export?category=unknown', { expected: 400 })).error.code, 'INVALID_INPUT');
  });

  await t.test('moving between tiers persists only the tier and rejects obsolete revisions', async () => {
    const entry = await create({ ...draft, title: 'Запис для тірліста', score: 8,
      seasons: [{ totalEpisodes: 4, watchedEpisodes: 2 }] });
    const recordPath = '/entries/' + entry.id;
    const move = (tier, revision, expected = 200) =>
      request(recordPath + '/tier', { method: 'PATCH', body: { tier, revision }, expected });
    const ranked = await move('S', entry.revision);
    assert.deepEqual(ranked, { ...entry, tier: 'S', revision: entry.revision + 1 });
    assert.equal((await move('A', entry.revision, 409)).error.code, 'STALE_ENTRY');
    assert.equal((await move('Z', ranked.revision, 400)).error.code, 'INVALID_INPUT');
    const unranked = await move('', ranked.revision);
    assert.equal(unranked.tier, '');
    assert.deepEqual(await request(recordPath), unranked);
  });
});
