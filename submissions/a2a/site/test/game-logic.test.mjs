import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemy,
  createInitialState,
  getThreatLevel,
  rectanglesOverlap,
  stepGameState
} from '../src/game-logic.js';

test('rectangle collision detects overlap and separation', () => {
  assert.equal(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 5, height: 5 }), true);
  assert.equal(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 0, width: 5, height: 5 }), false);
});

test('threat level escalates predictably over a run', () => {
  assert.equal(getThreatLevel(0), 1);
  assert.equal(getThreatLevel(19.99), 1);
  assert.equal(getThreatLevel(20), 2);
  assert.equal(getThreatLevel(61), 4);
});

test('a fired projectile destroys a target and awards its points', () => {
  const state = createInitialState();
  state.phase = 'running';
  state.spawnTimer = 10;
  state.player.x = 200;
  state.player.y = 450;
  const enemy = createEnemy({ x: 200, y: 425, type: 'drone', level: 1 });
  state.enemies = [enemy];
  state.projectiles = [{ x: 215, y: 430, width: 6, height: 26, speed: 0 }];
  const events = stepGameState(state, {}, 0.016, () => 0.1);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.score, 100);
  assert.ok(events.some((event) => event.type === 'enemy-destroyed'));
});

test('movement is bounded and holding fire emits a projectile on its cooldown', () => {
  const state = createInitialState();
  state.phase = 'running';
  state.spawnTimer = 10;
  state.player.x = 20;
  state.player.y = 26;

  const firstEvents = stepGameState(state, { left: true, up: true, fire: true }, 0.05, () => 0.1);
  assert.equal(state.player.x, 16);
  assert.equal(state.player.y, 24);
  assert.equal(state.projectiles.length, 1);
  assert.ok(firstEvents.some((event) => event.type === 'fire'));

  stepGameState(state, { right: true, down: true, fire: true }, 0.01, () => 0.1);
  assert.equal(state.projectiles.length, 1, 'the weapon respects its fire cooldown');
  assert.equal(state.player.x > 16, true);
  assert.equal(state.player.y > 24, true);
});

test('enemy plasma damages the player and removes the projectile', () => {
  const state = createInitialState();
  state.phase = 'running';
  state.spawnTimer = 10;
  state.enemyProjectiles = [{
    x: state.player.x + 12,
    y: state.player.y + 10,
    width: 6,
    height: 15,
    speed: 0
  }];

  const events = stepGameState(state, {}, 0.016, () => 0.1);
  assert.equal(state.lives, 2);
  assert.equal(state.enemyProjectiles.length, 0);
  assert.ok(events.some((event) => event.type === 'player-hit' && event.reason === 'plasma'));
});

test('a breached enemy costs one life and gives a brief invulnerability window', () => {
  const state = createInitialState();
  state.phase = 'running';
  state.spawnTimer = 10;
  state.enemies = [createEnemy({ x: 200, y: 650, type: 'drone', level: 1 })];
  const events = stepGameState(state, {}, 0.016, () => 0.1);
  assert.equal(state.lives, 2);
  assert.equal(state.invulnerable > 0, true);
  assert.ok(events.some((event) => event.type === 'player-hit' && event.reason === 'breach'));
});

test('game-over is emitted when the final life is lost', () => {
  const state = createInitialState();
  state.phase = 'running';
  state.lives = 1;
  state.spawnTimer = 10;
  state.enemies = [createEnemy({ x: 200, y: 650, type: 'drone', level: 1 })];
  const events = stepGameState(state, {}, 0.016, () => 0.1);
  assert.equal(state.phase, 'game-over');
  assert.equal(state.lives, 0);
  assert.ok(events.some((event) => event.type === 'game-over'));
});
