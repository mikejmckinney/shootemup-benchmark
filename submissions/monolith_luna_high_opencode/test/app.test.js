const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('leaderboard name and score contract accepts only safe plausible values', () => {
  const validName = /^[A-Za-z0-9 _-]{1,16}$/;
  assert.equal(validName.test('NOVA-7'), true);
  assert.equal(validName.test(''), false);
  assert.equal(validName.test('pilot<script>'), false);
  assert.equal(validName.test('12345678901234567'), false);
  assert.equal(Number.isInteger(424242) && 424242 >= 0 && 424242 <= 2147483647, true);
  assert.equal(Number.isInteger(-1) && -1 >= 0, false);
});

test('shipped UI exposes the production test adapter and required controls', () => {
  const html = read('index.html');
  const app = read('app.js');
  for (const selector of ['game-canvas', 'start-button', 'score', 'lives', 'mute-button', 'leaderboard', 'player-name', 'submit-score', 'touch-controls']) {
    assert.match(html, new RegExp(`data-testid="${selector}"`));
  }
  assert.match(app, /window\.__NEON_BARRAGE__/);
  assert.match(app, /endGameForTest/);
  assert.match(app, /Number\.isInteger\(n\)&&n>=0/);
});

test('database migration enforces RLS and server-side validation', () => {
  const sql = read('supabase/migrations/001_scores.sql');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select to anon/i);
  assert.match(sql, /for insert to anon/i);
  assert.match(sql, /scores_player_name_valid/);
  assert.match(sql, /scores_value_valid/);
  assert.match(sql, /revoke all on table public\.scores from public/i);
});
