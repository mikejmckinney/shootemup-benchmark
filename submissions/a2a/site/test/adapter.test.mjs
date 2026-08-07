import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonBarrageAdapter } from '../src/adapter.js';

test('production adapter exposes the narrow state and delegates test game-over transitions', () => {
  const calls = [];
  const game = {
    getPublicState: () => ({ phase: 'running', score: 90, lives: 3, playerX: 10, playerY: 20, enemyCount: 1, projectileCount: 2 }),
    endGameForTest: (score) => { calls.push(score); return true; }
  };
  const adapter = createNeonBarrageAdapter(game);
  assert.deepEqual(adapter.getState(), { phase: 'running', score: 90, lives: 3, playerX: 10, playerY: 20, enemyCount: 1, projectileCount: 2 });
  assert.equal(adapter.endGameForTest(900), true);
  assert.deepEqual(calls, [900]);
  assert.deepEqual(Object.keys(adapter), ['getState', 'endGameForTest']);
});

test('adapter rejects an object that cannot drive the real game transition', () => {
  assert.throws(() => createNeonBarrageAdapter({ getPublicState() { return {}; } }), TypeError);
});
