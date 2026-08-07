import assert from "node:assert/strict";
import test from "node:test";
import {
  beginGame,
  createGameState,
  difficultyFor,
  endGame,
  stepGame,
  validatePlayerName,
  validateScore
} from "../src/game-core.mjs";

test("leaderboard validation matches the database contract", () => {
  assert.deepEqual(validatePlayerName("  Nova  Pilot "), { valid: true, value: "Nova Pilot", message: "" });
  assert.equal(validatePlayerName("" ).valid, false);
  assert.equal(validatePlayerName("12345678901234567").valid, false);
  assert.equal(validatePlayerName("bad<script>").valid, false);
  assert.equal(validateScore(0), true);
  assert.equal(validateScore(999_999_999), true);
  assert.equal(validateScore(-1), false);
  assert.equal(validateScore(1.5), false);
  assert.equal(validateScore(1_000_000_000), false);
});

test("the simulation fires, collides, and awards points", () => {
  const state = createGameState(640, 420);
  beginGame(state, 640, 420);
  state.spawnTimer = 999;
  state.enemies = [{ kind: "drone", x: state.player.x, baseX: state.player.x, y: 100, radius: 18, speed: 0, wave: 0, drift: 0, color: "#b883ff" }];
  state.projectiles = [{ x: state.player.x, y: 100, vy: -570 }];
  stepGame(state, {}, 0.01, () => 0.5);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.score, 15);
  assert.ok(state.events.some((event) => event.type === "hit"));
});

test("an unblocked enemy costs one life and difficulty escalates", () => {
  const state = createGameState(640, 420);
  beginGame(state, 640, 420);
  state.spawnTimer = 999;
  state.enemies = [{ kind: "scout", x: state.player.x, baseX: state.player.x, y: state.player.y, radius: 13, speed: 0, wave: 0, drift: 0, color: "#ffc857" }];
  stepGame(state, {}, 0.01, () => 0.5);
  assert.equal(state.lives, 2);
  assert.equal(state.phase, "playing");
  assert.ok(difficultyFor(40, 1000) > difficultyFor(1, 0));
});

test("the test adapter's game-over path can safely set a plausible score", () => {
  const state = createGameState();
  beginGame(state);
  endGame(state, 4321);
  assert.equal(state.phase, "gameover");
  assert.equal(state.score, 4321);
  assert.equal(state.lives, 0);
});
