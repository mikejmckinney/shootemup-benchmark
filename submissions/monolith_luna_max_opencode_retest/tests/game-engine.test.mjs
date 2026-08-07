import test from "node:test";
import assert from "node:assert/strict";
import { WORLD, createGame, forceGameOver, getPublicState, startGame, stepGame } from "../engine.js";

test("player movement is bounded and firing creates projectiles", () => {
  const game = startGame(createGame(() => 0.5));
  stepGame(game, { right: true, up: true, fire: true }, 0.1);
  assert.equal(game.phase, "playing");
  assert.ok(game.player.x > WORLD.width / 2);
  assert.ok(game.player.y < WORLD.height - 72);
  assert.equal(game.projectiles.length, 1);
  stepGame(game, { left: true, down: true }, 20);
  assert.ok(game.player.x >= 28 && game.player.x <= WORLD.width - 28);
  assert.ok(game.player.y >= 35 && game.player.y <= WORLD.height - 34);
});

test("a projectile destroys an enemy and awards the correct score", () => {
  const game = startGame(createGame(() => 0.1));
  game.spawnTimer = 99;
  game.enemies.push({ x: 480, y: 400, radius: 15, hp: 1, maxHp: 1, speed: 0, drift: 0, phase: 0, heavy: false });
  game.projectiles.push({ x: 480, y: 400, vx: 0, vy: 0, radius: 4 });
  stepGame(game, {}, 0.016);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.score, 100);
});

test("difficulty escalates by wave and game-over state is exposed safely", () => {
  const game = startGame(createGame(() => 0.9));
  game.spawnTimer = 99;
  game.elapsed = 14.99;
  stepGame(game, {}, 0.05);
  assert.equal(game.wave, 2);
  assert.equal(forceGameOver(game, 12345), true);
  assert.deepEqual(getPublicState(game), { phase: "gameover", score: 12345, lives: 0, playerX: 480, playerY: 528, enemyCount: 0, projectileCount: 0 });
  assert.equal(forceGameOver(game, -1), false);
  assert.equal(forceGameOver(game, 1.5), false);
});
