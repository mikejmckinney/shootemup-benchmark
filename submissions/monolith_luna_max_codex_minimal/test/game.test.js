import test from "node:test";
import assert from "node:assert/strict";
import { circleIntersects, formatScore, isPlausibleScore, isValidName, sanitizeName } from "../public/game-logic.js";

test("leaderboard names are bounded and use the public tag character set", () => {
  assert.equal(sanitizeName("  Nova-7  "), "Nova-7");
  assert.equal(isValidName("NOVA_7"), true);
  assert.equal(isValidName(""), false);
  assert.equal(isValidName("x".repeat(17)), false);
  assert.equal(isValidName("bad<script>"), false);
});

test("scores are non-negative, integral, and bounded to the database range", () => {
  assert.equal(isPlausibleScore(0), true);
  assert.equal(isPlausibleScore(2147483647), true);
  assert.equal(isPlausibleScore(-1), false);
  assert.equal(isPlausibleScore(1.5), false);
  assert.equal(isPlausibleScore(2147483648), false);
});

test("collision helper detects touching circles without false positives", () => {
  assert.equal(circleIntersects({ x: 0, y: 0, radius: 5 }, { x: 9, y: 0, radius: 4 }), true);
  assert.equal(circleIntersects({ x: 0, y: 0, radius: 5 }, { x: 10.1, y: 0, radius: 4 }), false);
});

test("scores render as readable fixed-width HUD values", () => {
  assert.equal(formatScore(42), "000042");
  assert.equal(formatScore(1234567), "1234567");
  assert.equal(formatScore(Number.NaN), "000000");
});
