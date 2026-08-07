import test from "node:test";
import assert from "node:assert/strict";
import { clampName, createGameState, difficultyForScore, hitTest, isPlausibleScore, isValidName, movePlayer } from "../src/game-state.js";

test("new game has a ready state with three lives", () => {
  assert.deepEqual(createGameState(600, 400), { phase: "ready", score: 0, lives: 3, playerX: 300, playerY: 326, enemyCount: 0, projectileCount: 0 });
});

test("player movement is bounded by the playfield", () => {
  assert.deepEqual(movePlayer({ x: 30, y: 30 }, { x: -1, y: -1 }, 1, { width: 300, height: 200 }), { x: 26, y: 30 });
  assert.deepEqual(movePlayer({ x: 290, y: 190 }, { x: 1, y: 1 }, 1, { width: 300, height: 200 }), { x: 274, y: 170 });
});

test("difficulty escalates and caps", () => {
  assert.equal(difficultyForScore(0), 1);
  assert.equal(difficultyForScore(450), 2);
  assert.equal(difficultyForScore(999999), 12);
});

test("leaderboard input rules reject unsafe values", () => {
  assert.equal(isValidName("  Nova-7  "), true);
  assert.equal(clampName("  Nova-7  "), "Nova-7");
  assert.equal(isValidName("<script>"), false);
  assert.equal(isValidName(""), false);
  assert.equal(isValidName("12345678901234567"), false);
  assert.equal(isPlausibleScore(2147483647), true);
  assert.equal(isPlausibleScore(-1), false);
  assert.equal(isPlausibleScore(1.5), false);
});

test("collision helper detects overlapping circles", () => {
  assert.equal(hitTest({ x: 10, y: 10 }, { x: 14, y: 12 }, 5), true);
  assert.equal(hitTest({ x: 10, y: 10 }, { x: 30, y: 30 }, 5), false);
});
