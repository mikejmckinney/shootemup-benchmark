import test from "node:test";
import assert from "node:assert/strict";
import { clamp, isPlausibleScore, isValidPlayerName, sanitizeName, waveForScore } from "../src/game-logic.js";

test("sanitizes and validates leaderboard call signs", () => {
  assert.equal(sanitizeName("  NIGHT<script>HAWK!!  "), "NIGHTscriptHAWK");
  assert.equal(isValidPlayerName("NIGHT-07"), true);
  assert.equal(isValidPlayerName(""), false);
  assert.equal(isValidPlayerName("bad.name"), false);
  assert.equal(isValidPlayerName("x".repeat(17)), false);
});

test("accepts only plausible integer scores", () => {
  assert.equal(isPlausibleScore(0), true);
  assert.equal(isPlausibleScore(2147483647), true);
  assert.equal(isPlausibleScore(-1), false);
  assert.equal(isPlausibleScore(12.5), false);
  assert.equal(isPlausibleScore(2147483648), false);
});

test("clamps movement and increases waves as score grows", () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(waveForScore(0), 1);
  assert.ok(waveForScore(5000) > waveForScore(100));
});
