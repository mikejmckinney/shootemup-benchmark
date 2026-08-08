import test from "node:test";
import assert from "node:assert/strict";
import {
  difficultyForElapsed,
  entityRect,
  formatScore,
  isPlausibleScore,
  isValidPlayerName,
  rectanglesOverlap
} from "../src/game-core.mjs";

test("validates leaderboard names at the product boundary", () => {
  assert.equal(isValidPlayerName("ACE"), true);
  assert.equal(isValidPlayerName("  ACE"), false);
  assert.equal(isValidPlayerName(""), false);
  assert.equal(isValidPlayerName("12345678901234567"), false);
  assert.equal(isValidPlayerName("pilot\n"), false);
});

test("accepts only plausible integer scores", () => {
  assert.equal(isPlausibleScore(0), true);
  assert.equal(isPlausibleScore(2147483647), true);
  assert.equal(isPlausibleScore(-1), false);
  assert.equal(isPlausibleScore(10.5), false);
  assert.equal(isPlausibleScore(Number.POSITIVE_INFINITY), false);
});

test("detects entity collisions using centered game coordinates", () => {
  assert.equal(
    rectanglesOverlap(
      entityRect({ x: 20, y: 20, width: 10, height: 10 }),
      entityRect({ x: 24, y: 24, width: 10, height: 10 })
    ),
    true
  );
  assert.equal(
    rectanglesOverlap(
      entityRect({ x: 20, y: 20, width: 10, height: 10 }),
      entityRect({ x: 40, y: 40, width: 10, height: 10 })
    ),
    false
  );
});

test("difficulty escalates on a predictable eighteen-second cadence", () => {
  assert.equal(difficultyForElapsed(0), 1);
  assert.equal(difficultyForElapsed(17.99), 1);
  assert.equal(difficultyForElapsed(18), 2);
  assert.equal(difficultyForElapsed(54), 4);
});

test("formats scores with a readable arcade counter", () => {
  assert.equal(formatScore(42), "000042");
  assert.equal(formatScore(1200), "001,200");
  assert.equal(formatScore(-10), "000000");
});
