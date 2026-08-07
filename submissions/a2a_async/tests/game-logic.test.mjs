import test from "node:test";
import assert from "node:assert/strict";
import {
  difficultyForScore,
  formatScore,
  isPlausibleScore,
  isValidPlayerName,
  rectanglesOverlap,
  validateSubmission
} from "../src/game-logic.mjs";

test("leaderboard names follow the public input contract", () => {
  assert.equal(isValidPlayerName("NOVA-7"), true);
  assert.equal(isValidPlayerName(""), false);
  assert.equal(isValidPlayerName("01234567890123456"), false);
  assert.equal(isValidPlayerName("<script>"), false);
});

test("scores are bounded integers and submissions are normalized", () => {
  assert.equal(isPlausibleScore(0), true);
  assert.equal(isPlausibleScore(100000001), false);
  assert.equal(isPlausibleScore(1.5), false);
  assert.deepEqual(validateSubmission("  Ace  ", 120), {
    name: "Ace",
    score: 120,
    valid: true,
    nameError: "",
    scoreError: ""
  });
});

test("difficulty escalates and collision geometry is deterministic", () => {
  assert.ok(difficultyForScore(2200).level > difficultyForScore(0).level);
  assert.equal(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 3, height: 3 }), true);
  assert.equal(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 0, width: 3, height: 3 }), false);
  assert.equal(formatScore(42), "000042");
});
