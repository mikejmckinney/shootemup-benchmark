import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LeaderboardError,
  createLeaderboardClient,
  normalizeConfig,
  normalizeScore,
  validateName
} from '../src/leaderboard.js';

test('name validation trims and enforces the one-to-sixteen character contract', () => {
  assert.deepEqual(validateName('  pilot  '), { valid: true, name: 'pilot', error: '' });
  assert.equal(validateName('').valid, false);
  assert.equal(validateName('12345678901234567').valid, false);
  assert.equal(validateName('pilot\n').valid, false);
  assert.equal(validateName('<script>').valid, false);
});

test('score normalization allows plausible non-negative safe integers only', () => {
  assert.equal(normalizeScore(0), 0);
  assert.equal(normalizeScore('1200'), 1200);
  assert.equal(normalizeScore(-1), null);
  assert.equal(normalizeScore(1.5), null);
  assert.equal(normalizeScore(Number.MAX_SAFE_INTEGER), null);
  assert.equal(normalizeScore(2_147_483_647), 2_147_483_647);
  assert.equal(normalizeScore(2_147_483_648), null);
});

test('client sends only anon-key authenticated REST requests and limits leaderboard reads', async () => {
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async json() { return [{ id: 1, player_name: 'ACE', score: 900, created_at: '2026-01-01' }]; } };
  };
  const client = createLeaderboardClient({ supabaseUrl: 'https://demo.supabase.co/', supabaseAnonKey: 'public-anon-key' }, fetchMock);
  const records = await client.list();
  assert.deepEqual(records[0], { name: 'ACE', score: 900, createdAt: '2026-01-01' });
  assert.match(calls[0].url, /\/rest\/v1\/leaderboard\?/u);
  assert.equal(calls[0].options.headers.apikey, 'public-anon-key');
  assert.match(calls[0].url, /limit=10/u);
});

test('client validates before any score write and exposes network failures', async () => {
  let calls = 0;
  const client = createLeaderboardClient({ supabaseUrl: 'https://demo.supabase.co', supabaseAnonKey: 'public-anon-key' }, async () => {
    calls += 1;
    throw new Error('offline');
  });
  await assert.rejects(() => client.submit('too-long-callsign-xx', 20), (error) => error instanceof LeaderboardError && error.code === 'validation');
  assert.equal(calls, 0);
  await assert.rejects(() => client.submit('ACE', 20), (error) => error instanceof LeaderboardError && error.code === 'network');
  assert.equal(calls, 1);
});

test('missing runtime configuration is explicit and does not attempt a request', async () => {
  assert.deepEqual(normalizeConfig({}), { url: '', anonKey: '', configured: false });
  const client = createLeaderboardClient({});
  await assert.rejects(() => client.list(), (error) => error instanceof LeaderboardError && error.code === 'unconfigured');
});
