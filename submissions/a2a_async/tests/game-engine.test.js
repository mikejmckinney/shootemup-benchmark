import test from "node:test";
import assert from "node:assert/strict";
import {
  beginGame,
  createGameState,
  endGame,
  getDifficulty,
  getStateSnapshot,
  stepGame,
} from "../src/game-engine.js";

const quietRandom = () => 0.1;

function makePlayingState() {
  const state = createGameState(600, 400);
  beginGame(state);
  state.spawnTimer = 999;
  return state;
}

test("beginGame resets a run and movement stays inside the playfield", () => {
  const state = createGameState(600, 400);
  state.score = 900;
  state.lives = 1;
  beginGame(state);

  assert.equal(state.phase, "playing");
  assert.equal(state.score, 0);
  assert.equal(state.lives, 3);
  const startX = state.playerX;
  stepGame(state, { right: true, down: true }, 0.05, quietRandom);
  assert.ok(state.playerX > startX);
  assert.ok(state.playerY > 0 && state.playerY < state.height);

  state.playerX = -500;
  state.playerY = 5000;
  stepGame(state, {}, 0.01, quietRandom);
  assert.equal(state.playerX, state.playerRadius + 12);
  assert.equal(state.playerY, state.height - state.playerRadius - 18);
});

test("a player projectile destroys an enemy and awards its points", () => {
  const state = makePlayingState();
  state.playerX = 300;
  state.playerY = 330;
  state.enemies.push({
    id: "enemy-test",
    type: "scout",
    x: 300,
    y: 276,
    radius: 15,
    hp: 1,
    maxHp: 1,
    speed: 0,
    points: 25,
    color: "#ff4f9a",
    drift: 0,
    wobble: 0,
    age: 0,
    fireDelay: 999,
  });

  stepGame(state, { fire: true }, 0.05, quietRandom);

  assert.equal(state.enemies.length, 0);
  assert.equal(state.score, 25);
  assert.equal(state.projectiles.length, 0);
});

test("enemy contact costs one life and repeated contact can end the run", () => {
  const state = makePlayingState();
  state.playerX = 300;
  state.playerY = 330;
  state.lives = 2;
  state.enemies.push({
    id: "enemy-contact",
    type: "scout",
    x: 300,
    y: 330,
    radius: 15,
    hp: 1,
    maxHp: 1,
    speed: 0,
    points: 25,
    color: "#ff4f9a",
    drift: 0,
    wobble: 0,
    age: 0,
    fireDelay: 999,
  });

  stepGame(state, {}, 0.016, quietRandom);
  assert.equal(state.lives, 1);
  assert.equal(state.phase, "playing");

  state.invulnerability = 0;
  state.enemies.push({
    id: "enemy-contact-2",
    type: "scout",
    x: 300,
    y: 330,
    radius: 15,
    hp: 1,
    maxHp: 1,
    speed: 0,
    points: 25,
    color: "#ff4f9a",
    drift: 0,
    wobble: 0,
    age: 0,
    fireDelay: 999,
  });
  stepGame(state, {}, 0.016, quietRandom);
  assert.equal(state.lives, 0);
  assert.equal(state.phase, "gameover");
});

test("difficulty escalates with elapsed time", () => {
  const state = makePlayingState();
  const first = getDifficulty(state);
  state.elapsed = 66;
  const later = getDifficulty(state);
  assert.equal(first.level, 1);
  assert.equal(later.level, 4);
  assert.ok(later.spawnInterval < first.spawnInterval);
  assert.ok(later.enemySpeedMultiplier > first.enemySpeedMultiplier);
});

test("game-over adapter rules accept only non-negative safe integers", () => {
  const state = makePlayingState();
  endGame(state, 1234);
  assert.deepEqual(getStateSnapshot(state), {
    phase: "gameover",
    score: 1234,
    lives: 0,
    playerX: 300,
    playerY: 324,
    enemyCount: 0,
    projectileCount: 0,
  });
  assert.throws(() => endGame(state, -1), /non-negative/);
  assert.throws(() => endGame(state, 1.5), /non-negative/);
});

