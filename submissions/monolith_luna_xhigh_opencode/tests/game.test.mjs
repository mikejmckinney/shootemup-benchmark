import test from 'node:test';
import assert from 'node:assert/strict';
import { circleHit, damageForEnemy, isValidName, isValidScore, nextSpawnDelay } from '../game-logic.mjs';

test('leaderboard validation accepts bounded callsigns and scores', () => {
  assert.equal(isValidName('NOVA-01'), true);
  assert.equal(isValidName(''), false);
  assert.equal(isValidName('12345678901234567'), false);
  assert.equal(isValidName('                '), false);
  assert.equal(isValidName('<script>'), false);
  assert.equal(isValidScore(0), true);
  assert.equal(isValidScore(2147483647), true);
  assert.equal(isValidScore(-1), false);
  assert.equal(isValidScore(2.5), false);
});

test('spawn cadence escalates but stays playable', () => {
  assert.equal(nextSpawnDelay(0), 930);
  assert.ok(nextSpawnDelay(70) < nextSpawnDelay(2));
  assert.equal(nextSpawnDelay(1000), 310);
});

test('circle collision and enemy damage are deterministic', () => {
  assert.equal(circleHit({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 4 }), true);
  assert.equal(circleHit({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 4 }), false);
  assert.equal(damageForEnemy({ type: 'scout' }), 1);
  assert.equal(damageForEnemy({ type: 'brute' }), 2);
});
