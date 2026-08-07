import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyFor, overlaps, plausibleScore, validName } from '../game-core.js';

test('collision uses rectangular bounds', () => {
  assert.equal(overlaps({ x: 5, y: 5, w: 10, h: 10 }, { x: 12, y: 8, w: 5, h: 5 }), true);
  assert.equal(overlaps({ x: 5, y: 5, w: 5, h: 5 }, { x: 10, y: 5, w: 5, h: 5 }), false);
});

test('difficulty escalates while respecting playability caps', () => {
  const start = difficultyFor(0, 0);
  const late = difficultyFor(6000, 180);
  assert.ok(late.level > start.level);
  assert.ok(late.spawnMs < start.spawnMs);
  assert.ok(late.spawnMs >= 260);
  assert.ok(late.enemySpeed <= 330);
});

test('leaderboard values are bounded', () => {
  assert.equal(validName('  NOVA  '), true);
  assert.equal(validName(''), false);
  assert.equal(validName('ABCDEFGHIJKLMNOPQ'), false);
  assert.equal(plausibleScore(9900), true);
  assert.equal(plausibleScore(-1), false);
  assert.equal(plausibleScore(1.5), false);
});
