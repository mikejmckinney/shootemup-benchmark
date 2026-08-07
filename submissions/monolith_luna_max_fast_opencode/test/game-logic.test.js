import test from "node:test";
import assert from "node:assert/strict";
import {
  circlesOverlap,
  difficultyFor,
  sortLeaderboard,
  spawnIntervalFor,
  validateName,
  validateScore
} from "../game-logic.js";

test("pilot tags trim whitespace and enforce the 1-16 character contract", () => {
  assert.deepEqual(validateName("  nova  "), { valid: true, value: "nova", error: "" });
  assert.equal(validateName("").valid, false);
  assert.equal(validateName("12345678901234567").valid, false);
});

test("scores accept only plausible non-negative safe integers", () => {
  assert.equal(validateScore(0), true);
  assert.equal(validateScore(250), true);
  assert.equal(validateScore(-1), false);
  assert.equal(validateScore(12.5), false);
  assert.equal(validateScore(1_000_000_001), false);
});

test("collision detection uses the sum of both radii", () => {
  assert.equal(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 9, y: 0, radius: 5 }), true);
  assert.equal(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 11, y: 0, radius: 5 }), false);
});

test("difficulty escalates and spawn interval contracts", () => {
  assert.equal(difficultyFor(0, 0), 1);
  assert.ok(difficultyFor(900, 30) > difficultyFor(0, 0));
  assert.ok(spawnIntervalFor(900, 30) < spawnIntervalFor(0, 0));
  assert.ok(spawnIntervalFor(100000, 10000) >= 0.3);
});

test("leaderboard ranks valid entries by score and caps at ten", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ name: `Pilot ${index}`, score: index * 10, created_at: `2026-01-${String(index + 1).padStart(2, "0")}` }));
  entries.push({ name: "invalid", score: -8 });
  const ranked = sortLeaderboard(entries);
  assert.equal(ranked.length, 10);
  assert.equal(ranked[0].score, 110);
  assert.equal(ranked.at(-1).score, 20);
});
