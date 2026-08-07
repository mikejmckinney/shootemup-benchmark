import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the production page keeps the stable black-box selectors', () => {
  const selectors = [
    'game-canvas',
    'start-button',
    'score',
    'lives',
    'mute-button',
    'leaderboard',
    'player-name',
    'submit-score',
    'touch-controls'
  ];

  for (const selector of selectors) {
    assert.match(indexHtml, new RegExp(`data-testid="${selector}"`, 'u'), selector);
  }
});

test('the module entrypoint wires the adapter methods and public Supabase config only', async () => {
  const mainJs = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(mainJs, /window\.__NEON_BARRAGE__\s*=\s*createNeonBarrageAdapter/u);
  assert.match(mainJs, /createLeaderboardClient\(/u);
  assert.match(mainJs, /__NEON_BARRAGE_CONFIG__|NEON_BARRAGE_CONFIG/u);
});
