import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, stateView, endGame, WIDTH } from '../src/engine.js';

test('starts with the required public state', () => {
  const g = createGame(() => .5);
  assert.deepEqual(stateView(g), { phase: 'ready', score: 0, lives: 3, playerX: WIDTH / 2, playerY: 795, enemyCount: 0, projectileCount: 0 });
  startGame(g);
  assert.equal(g.phase, 'playing');
});

test('movement is bounded and firing creates twin projectiles', () => {
  const g = startGame(createGame(() => .5));
  updateGame(g, .016, { left: true, fire: true });
  assert.ok(g.playerX < WIDTH / 2);
  assert.equal(g.projectiles.length, 2);
  for (let i = 0; i < 1000; i++) updateGame(g, .05, { left: true });
  assert.equal(g.playerX, 28);
});

test('projectile collision removes enemy and awards score', () => {
  const g = startGame(createGame(() => .5));
  g.spawnTimer = 99; g.shotTimer = 99;
  g.enemies.push({ id: 1, x: 400, y: 400, vx: 0, vy: 0, radius: 21, hp: 1, elite: false, phase: 0 });
  g.projectiles.push({ x: 400, y: 400, vy: 0, radius: 4 });
  updateGame(g, .016, {});
  assert.equal(g.enemies.length, 0);
  assert.equal(g.score, 110);
});

test('test ending validates and uses the real gameover phase', () => {
  const g = startGame(createGame());
  endGame(g, 4242);
  assert.equal(g.phase, 'gameover');
  assert.equal(g.score, 4242);
  assert.throws(() => endGame(g, -1));
  assert.throws(() => endGame(g, 1.5));
});
