import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circleHit,
  createInitialState,
  getDifficulty,
  getWaveForScore,
  isPlausibleScore,
  isValidName,
} from '../src/game-logic.js';

test('initial game state is ready with a full hull', () => {
  assert.deepEqual(createInitialState(), {
    phase: 'ready',
    score: 0,
    lives: 3,
    playerX: 480,
    playerY: 526,
    enemyCount: 0,
    projectileCount: 0,
  });
});

test('circle collision detects overlap but not separated objects', () => {
  assert.equal(circleHit({ x: 10, y: 10, radius: 5 }, { x: 18, y: 10, radius: 4 }), true);
  assert.equal(circleHit({ x: 10, y: 10, radius: 5 }, { x: 25, y: 10, radius: 4 }), false);
});

test('score and callsign validation rejects unsafe or impossible values', () => {
  assert.equal(isValidName('NOVA-7'), true);
  assert.equal(isValidName(''), false);
  assert.equal(isValidName('12345678901234567'), false);
  assert.equal(isValidName('<pilot>'), false);
  assert.equal(isPlausibleScore(0), true);
  assert.equal(isPlausibleScore(2147483647), true);
  assert.equal(isPlausibleScore(-1), false);
  assert.equal(isPlausibleScore(2.5), false);
  assert.equal(isPlausibleScore(Number.MAX_SAFE_INTEGER), false);
});

test('difficulty escalates as score crosses wave thresholds', () => {
  assert.equal(getWaveForScore(0), 1);
  assert.equal(getWaveForScore(750), 2);
  assert.ok(getDifficulty(5).spawnDelay < getDifficulty(1).spawnDelay);
  assert.ok(getDifficulty(5).enemySpeed > getDifficulty(1).enemySpeed);
});
