import test from "node:test";
import assert from "node:assert/strict";
import {
  circlesOverlap,
  difficultyForScore,
  isValidName,
  isValidScore,
  normalizeScore
} from "../src/game-logic.js";

test("collision detection identifies touching circles without false positives", () => {
  assert.equal(circlesOverlap({ x: 10, y: 10, radius: 5 }, { x: 19, y: 10, radius: 4 }), true);
  assert.equal(circlesOverlap({ x: 10, y: 10, radius: 5 }, { x: 20, y: 10, radius: 4 }), false);
});

test("difficulty escalates while staying within playable limits", () => {
  const opening = difficultyForScore(0);
  const later = difficultyForScore(2_500);

  assert.equal(opening.level, 1);
  assert.ok(later.level > opening.level);
  assert.ok(later.spawnInterval < opening.spawnInterval);
  assert.ok(later.enemySpeed > opening.enemySpeed);
  assert.ok(later.maxEnemies <= 16);
});

test("leaderboard names use trimmed 1-16 character validation", () => {
  assert.equal(isValidName(" pilot "), true);
  assert.equal(isValidName(""), false);
  assert.equal(isValidName("                   "), false);
  assert.equal(isValidName("12345678901234567"), false);
  assert.equal(isValidName("pilot\n"), false);
});

test("leaderboard scores accept only plausible non-negative integers", () => {
  assert.equal(isValidScore(0), true);
  assert.equal(isValidScore(999_999), true);
  assert.equal(isValidScore(2.5), false);
  assert.equal(isValidScore(-1), false);
  assert.equal(isValidScore(1_000_000_001), false);
  assert.equal(normalizeScore("725.9"), 725);
  assert.equal(normalizeScore("not a score"), 0);
});
