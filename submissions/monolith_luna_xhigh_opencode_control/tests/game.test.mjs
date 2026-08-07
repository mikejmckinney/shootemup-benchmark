import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/001_leaderboard.sql', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(game, /window\.__NEON_BARRAGE__/);
assert.match(game, /endGameForTest/);
assert.match(game, /data-testid/);
assert.match(game, /requestAnimationFrame/);
assert.match(game, /fetch\(`\$\{config\.url\}\/rest\/v1\/leaderboard/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /leaderboard_name_valid/);
assert.match(migration, /leaderboard_score_valid/);
assert.match(migration, /create policy/);
assert.match(migration, /grant insert \(name, score\)/i);
for (const selector of ['game-canvas', 'start-button', 'score', 'lives', 'mute-button', 'leaderboard', 'player-name', 'submit-score', 'touch-controls']) assert.match(html, new RegExp(`data-testid="${selector}"`));
console.log('Neon Barrage static gameplay and security surface checks passed.');
