import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEADERBOARD_LIMIT,
  LEADERBOARD_TABLE,
  SCORE_MAX,
  createBrowserLeaderboardClient,
  createLeaderboardStore,
  validatePlayerName,
  validateScore,
} from '../src/leaderboard-client.js';

function fakeClient({ reads = [], insertResponse = { data: null, error: null } } = {}) {
  const calls = {
    from: [],
    select: [],
    order: [],
    limit: [],
    inserts: [],
  };
  let readIndex = 0;

  const client = {
    calls,
    from(table) {
      calls.from.push(table);
      return {
        select(columns) {
          calls.select.push(columns);
          const query = {
            order(column, options) {
              calls.order.push([column, options]);
              return query;
            },
            limit(value) {
              calls.limit.push(value);
              const response = reads[Math.min(readIndex++, reads.length - 1)] ?? {
                data: [],
                error: null,
              };
              return Promise.resolve(response);
            },
          };
          return query;
        },
        insert(payload) {
          calls.inserts.push(payload);
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(insertResponse);
                },
              };
            },
          };
        },
      };
    },
  };

  return client;
}

test('client-side validators normalize names and reject invalid values', () => {
  assert.equal(validatePlayerName('  Nova  '), 'Nova');
  assert.equal(validateScore(0), 0);
  assert.equal(validateScore(SCORE_MAX), SCORE_MAX);

  assert.throws(() => validatePlayerName(''), /player name/i);
  assert.throws(() => validatePlayerName('12345678901234567'), /16/);
  assert.throws(() => validatePlayerName('Pilot\n'), /control/i);
  assert.throws(() => validatePlayerName('Pilot<script>'), /letters/i);
  assert.throws(() => validateScore(-1), /whole number/i);
  assert.throws(() => validateScore(SCORE_MAX + 1), /whole number/i);
  assert.throws(() => validateScore(1.5), /whole number/i);
});

test('browser factory passes only the public key and disables auth persistence', () => {
  let received;
  const client = { from() {} };
  const result = createBrowserLeaderboardClient({
    supabaseUrl: 'https://example.supabase.co/',
    anonKey: 'anon-test-key',
    clientFactory(...args) {
      received = args;
      return client;
    },
  });

  assert.equal(result, client);
  assert.equal(received[0], 'https://example.supabase.co');
  assert.equal(received[1], 'anon-test-key');
  assert.deepEqual(received[2], {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  assert.throws(
    () => createBrowserLeaderboardClient({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'sb_secret_do_not_ship',
      clientFactory: () => client,
    }),
    /secret key/i,
  );
});

test('load exposes loading and empty states without throwing', async () => {
  const client = fakeClient({ reads: [{ data: [], error: null }] });
  const store = createLeaderboardStore({ client });
  const statuses = [];
  const unsubscribe = store.subscribe((state) => statuses.push(state.status));

  const finalState = await store.load();

  assert.deepEqual(statuses, ['idle', 'loading', 'empty']);
  assert.equal(finalState.status, 'empty');
  assert.deepEqual(finalState.entries, []);
  assert.deepEqual(client.calls.from, [LEADERBOARD_TABLE]);
  assert.equal(client.calls.limit[0], DEFAULT_LEADERBOARD_LIMIT);
  unsubscribe();
});

test('load exposes ordered data and preserves it on a network error', async () => {
  const entries = [
    { id: 1, name: 'Nova', score: 900, created_at: '2026-01-01T00:00:00Z' },
    { id: 2, name: 'Ion', score: 800, created_at: '2026-01-01T00:00:01Z' },
  ];
  const client = fakeClient({
    reads: [
      { data: entries, error: null },
      { data: null, error: { code: 'NETWORK', message: 'offline' } },
    ],
  });
  const store = createLeaderboardStore({ client });

  const ready = await store.load();
  assert.equal(ready.status, 'ready');
  assert.deepEqual(ready.entries, entries);
  assert.equal(client.calls.order[0][0], 'score');
  assert.deepEqual(client.calls.order[0][1], { ascending: false });

  const failed = await store.load();
  assert.equal(failed.status, 'error');
  assert.equal(failed.error.code, 'NETWORK');
  assert.deepEqual(failed.entries, entries);
});

test('invalid submissions become UI errors and never call the database', async () => {
  const client = fakeClient();
  const store = createLeaderboardStore({ client });

  const result = await store.submitScore('12345678901234567', 42);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'validation_error');
  assert.equal(store.getState().status, 'error');
  assert.equal(client.calls.inserts.length, 0);
});

test('successful submission writes validated fields and refreshes the top list', async () => {
  const inserted = {
    id: 7,
    name: 'Pilot',
    score: 420,
    created_at: '2026-01-01T00:00:00Z',
  };
  const refreshed = [inserted];
  const client = fakeClient({
    reads: [{ data: refreshed, error: null }],
    insertResponse: { data: inserted, error: null },
  });
  const store = createLeaderboardStore({ client });

  const result = await store.submitScore(' Pilot ', 420);

  assert.equal(result.ok, true);
  assert.deepEqual(client.calls.inserts, [{ name: 'Pilot', score: 420 }]);
  assert.equal(client.calls.from[0], LEADERBOARD_TABLE);
  assert.equal(store.getState().status, 'ready');
  assert.deepEqual(store.getState().entries, refreshed);
});

test('insert errors are recoverable and leave the game-owned UI data intact', async () => {
  const existing = { id: 3, name: 'Ion', score: 30 };
  const secondClient = fakeClient({
    reads: [{ data: [existing], error: null }],
    insertResponse: { data: null, error: { code: '42501', message: 'permission denied' } },
  });
  const secondStore = createLeaderboardStore({ client: secondClient });
  await secondStore.load();

  const result = await secondStore.submitScore('Nova', 50);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, '42501');
  assert.equal(secondStore.getState().status, 'error');
  assert.deepEqual(secondStore.getState().entries, [existing]);
  assert.deepEqual(secondClient.calls.inserts, [{ name: 'Nova', score: 50 }]);
});
