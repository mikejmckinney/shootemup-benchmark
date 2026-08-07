import test from "node:test";
import assert from "node:assert/strict";

import {
  GAME_PHASES,
  createGame,
  fire,
  forceGameOver,
  resetGame,
  setInput,
  spawnEnemy,
  stepGame,
} from "../src/game-engine.js";

const QUIET_SPAWNS = {
  enemySpawnInterval: 1000,
  levelDuration: 1000,
};

test("player movement is bounded by all four arena edges", () => {
  const state = createGame({
    ...QUIET_SPAWNS,
    arenaWidth: 100,
    arenaHeight: 100,
    playerWidth: 20,
    playerHeight: 20,
    playerSpeed: 100,
  });

  stepGame(state, { left: true, up: true }, 10);
  assert.equal(state.playerX, 10);
  assert.equal(state.playerY, 10);

  stepGame(state, { left: false, up: false, right: true, down: true }, 10);
  assert.equal(state.playerX, 90);
  assert.equal(state.playerY, 90);
  assert.equal(state.phase, GAME_PHASES.PLAYING);
});

test("firing creates upward projectiles and respects the cooldown", () => {
  const state = createGame({ ...QUIET_SPAWNS, projectileSpeed: 100 });
  const initialY = state.playerY;

  stepGame(state, { fire: true }, 0);
  assert.equal(state.projectileCount, 1);
  const firstProjectileY = state.projectiles[0].y;
  assert.ok(firstProjectileY < initialY);

  stepGame(state, { fire: true }, 0.05);
  assert.equal(state.projectileCount, 1);
  assert.ok(state.projectiles[0].y < firstProjectileY);

  stepGame(state, { fire: false }, 0.2);
  assert.equal(state.projectileCount, 1);
  stepGame(state, { fire: true }, 0);
  assert.equal(state.projectileCount, 2);

  stepGame(state, { fire: false }, 10);
  assert.equal(state.projectileCount, 0);
});

test("a projectile collision removes an enemy and awards its points", () => {
  const state = createGame({ ...QUIET_SPAWNS, enemyPoints: 125 });
  const enemy = spawnEnemy(state, {
    x: state.playerX,
    y: state.playerY - 28,
  });
  assert.ok(enemy);

  assert.ok(fire(state));
  stepGame(state, { fire: false }, 0);

  assert.equal(state.score, 125);
  assert.equal(state.enemyCount, 0);
  assert.equal(state.projectileCount, 0);
  assert.equal(state.enemies.length, state.enemyCount);
  assert.equal(state.projectiles.length, state.projectileCount);
});

test("enemy contact consumes lives and the last life enters game over", () => {
  const state = createGame({ ...QUIET_SPAWNS, initialLives: 2 });

  spawnEnemy(state, { x: state.playerX, y: state.playerY, speed: 0 });
  stepGame(state, {}, 0);
  assert.equal(state.lives, 1);
  assert.equal(state.phase, GAME_PHASES.PLAYING);

  spawnEnemy(state, { x: state.playerX, y: state.playerY, speed: 0 });
  stepGame(state, {}, 0);
  assert.equal(state.lives, 0);
  assert.equal(state.phase, GAME_PHASES.GAME_OVER);
  assert.equal(state.enemyCount, 0);
  assert.equal(state.projectileCount, 0);
});

test("difficulty escalates with time and seeded spawns are reproducible", () => {
  const options = {
    arenaWidth: 320,
    arenaHeight: 240,
    enemySpawnInterval: 0.25,
    minEnemySpawnInterval: 0.05,
    levelDuration: 1,
    enemySpeed: 80,
    seed: 42,
  };
  const first = createGame(options);
  const second = createGame(options);
  const initialSpeed = first.difficulty.enemySpeed;
  const initialInterval = first.difficulty.spawnInterval;

  stepGame(first, {}, 1.1);
  stepGame(second, {}, 1.1);

  assert.ok(first.wave >= 2);
  assert.ok(first.difficulty.enemySpeed > initialSpeed);
  assert.ok(first.difficulty.spawnInterval < initialInterval);
  assert.deepEqual(first.enemies, second.enemies);

  const laterSpeed = first.difficulty.enemySpeed;
  stepGame(first, {}, 1.1);
  assert.ok(first.difficulty.enemySpeed >= laterSpeed);
  assert.ok(first.wave >= 3);
});

test("reset restores a playing state and forceGameOver validates score input", () => {
  const state = createGame({ ...QUIET_SPAWNS, seed: 9 });
  stepGame(state, { right: true, fire: true }, 0.5);
  assert.notEqual(state.playerX, state.arenaWidth / 2);
  assert.ok(state.projectileCount > 0);

  forceGameOver(state, 37);
  assert.equal(state.phase, GAME_PHASES.GAME_OVER);
  assert.equal(state.score, 37);
  assert.equal(state.lives, 0);
  assert.throws(() => forceGameOver(state, -1), /non-negative integer/);
  assert.throws(() => forceGameOver(state, 1.5), /non-negative integer/);

  resetGame(state);
  assert.equal(state.phase, GAME_PHASES.PLAYING);
  assert.equal(state.score, 0);
  assert.equal(state.lives, 3);
  assert.equal(state.enemyCount, 0);
  assert.equal(state.projectileCount, 0);
});

test("input aliases and renderer-compatible count fields stay in sync", () => {
  const state = createGame({ ...QUIET_SPAWNS, arenaWidth: 160, arenaHeight: 160 });
  setInput(state, { keys: { ArrowLeft: true, Space: true } });
  stepGame(state, undefined, 0);

  assert.equal(state.input.left, true);
  assert.equal(state.input.fire, true);
  assert.equal(state.enemyCount, state.enemies.length);
  assert.equal(state.projectileCount, state.projectiles.length);
  assert.equal(typeof state.playerX, "number");
  assert.equal(typeof state.playerY, "number");
  assert.equal(typeof state.wave, "number");
});

