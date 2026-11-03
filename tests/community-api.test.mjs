import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCommunityRoute } from '../backend/community.mjs';

function makeRequest(method, path, body) {
  const request = { method, socket: { remoteAddress: '127.0.0.1' } };
  if (body !== undefined) {
    const buffer = Buffer.from(JSON.stringify(body));
    request[Symbol.asyncIterator] = async function* () { yield buffer; };
  }
  return request;
}

function makeResponse() {
  return {
    status: 0,
    payload: null,
    headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.payload = body ? JSON.parse(String(body)) : null; },
  };
}

function makeContext(database, uid = '1') {
  return {
    database,
    requireAccount: () => ({ uid, name: 'Student' }),
    enforceQuota() {},
    sendJson(res, status, payload) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); return true; },
    inferredBaseUrl: () => 'http://localhost:8787',
  };
}

test('feed pagination binds all active filter, search, and viewer parameters', async () => {
  const calls = [];
  const database = {
    async query() {},
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM community_questions q') && sql.includes('ORDER BY')) return [[], []];
      return [{ affectedRows: 1 }, []];
    },
  };
  const res = makeResponse();
  const handled = await handleCommunityRoute(makeRequest('GET', '/api/community/feed?filter=for_you&q=algebra&subject=Mathematics&academicLevel=Undergraduate&offset=15'), res, new URL('http://localhost/api/community/feed?filter=for_you&q=algebra&subject=Mathematics&academicLevel=Undergraduate&offset=15'), makeContext(database));
  assert.equal(handled, true);
  assert.equal(res.status, 200);
  const feedQuery = calls.find((call) => call.sql.includes('FROM community_questions q') && call.sql.includes('ORDER BY'));
  assert.ok(feedQuery);
  assert.equal((feedQuery.sql.match(/\?/g) ?? []).length, feedQuery.values.length);
  assert.deepEqual(res.payload, { questions: [], nextOffset: null });
});

test('repeated desired-state upvotes do not award duplicate reputation', async () => {
  const accountCalls = [];
  const transactionCalls = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, values = []) {
      transactionCalls.push({ sql, values });
      if (sql.startsWith('INSERT IGNORE INTO community_votes')) return [{ affectedRows: 0 }, []];
      if (sql.startsWith('SELECT COUNT(*) AS count')) return [[{ count: 1 }], []];
      return [{ affectedRows: 0 }, []];
    },
  };
  const database = {
    async query() {},
    async getConnection() { return connection; },
    async execute(sql, values = []) {
      accountCalls.push({ sql, values });
      if (sql.includes('FROM community_answers WHERE id=? LIMIT 1')) return [[{ id: '25', author_id: '2', question_id: '7' }], []];
      return [{ affectedRows: 1 }, []];
    },
  };
  const res = makeResponse();
  const path = '/api/community/vote';
  await handleCommunityRoute(makeRequest('POST', path, { targetType: 'answer', targetId: '25', voted: true }), res, new URL(`http://localhost${path}`), makeContext(database));
  assert.equal(res.status, 200);
  assert.deepEqual(res.payload, { voted: true, voteCount: 1 });
  assert.ok(!transactionCalls.some((call) => call.sql.includes('UPDATE community_profiles SET reputation')));
  assert.ok(!transactionCalls.some((call) => call.sql.includes('INSERT IGNORE INTO community_notifications')));
});

test('image upload checks content signatures before storing media', async () => {
  const inserts = [];
  const database = {
    async query() {},
    async execute(sql, values = []) { inserts.push({ sql, values }); return [{ affectedRows: 1 }, []]; },
  };
  const validBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const path = '/api/community/media';
  const validResponse = makeResponse();
  await handleCommunityRoute(makeRequest('POST', path, { mimeType: 'image/jpeg', base64: validBytes.toString('base64') }), validResponse, new URL(`http://localhost${path}`), makeContext(database));
  assert.equal(validResponse.status, 201);
  assert.match(validResponse.payload.image.url, /\/api\/community\/media\/[0-9a-f-]{36}$/i);
  assert.equal(inserts.filter((call) => call.sql.startsWith('INSERT INTO community_media')).length, 1);

  const invalidResponse = makeResponse();
  await handleCommunityRoute(makeRequest('POST', path, { mimeType: 'image/jpeg', base64: Buffer.from('<script>').toString('base64') }), invalidResponse, new URL(`http://localhost${path}`), makeContext(database));
  assert.equal(invalidResponse.status, 400);
  assert.equal(inserts.filter((call) => call.sql.startsWith('INSERT INTO community_media')).length, 1);
});
