import { describe, expect, it } from "vitest";
import { NeonBarrageGame, rectsOverlap } from "./game";
import { validatePlayerName, validateScore } from "./leaderboard";

describe("collision", () => {
  it("detects overlapping rectangles", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false);
  });
});

describe("NeonBarrageGame", () => {
  it("starts in ready and transitions to playing", () => {
    const g = new NeonBarrageGame();
    expect(g.getState().phase).toBe("ready");
    g.start();
    expect(g.getState().phase).toBe("playing");
    expect(g.getState().lives).toBe(3);
    expect(g.getState().score).toBe(0);
  });

  it("endGameForTest path sets gameover with score", () => {
    const g = new NeonBarrageGame();
    g.start();
    g.endGame(1234);
    const state = g.getState();
    expect(state.phase).toBe("gameover");
    expect(state.score).toBe(1234);
  });

  it("moves player with input and fires projectiles", () => {
    const g = new NeonBarrageGame();
    g.start();
    const before = g.getState();
    g.update(0.1, { up: false, down: false, left: false, right: true, fire: true });
    const after = g.getState();
    expect(after.playerX).toBeGreaterThan(before.playerX);
    expect(after.projectileCount).toBeGreaterThan(0);
  });

  it("escalates enemy spawns over time", () => {
    const g = new NeonBarrageGame();
    g.start();
    const idle = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
    };
    for (let i = 0; i < 40; i++) g.update(0.1, idle);
    expect(g.getState().enemyCount).toBeGreaterThan(0);
  });
});

describe("leaderboard validation", () => {
  it("accepts valid names and scores", () => {
    expect(validatePlayerName("Ace")).toBeNull();
    expect(validatePlayerName("Neon_Pilot-1")).toBeNull();
    expect(validateScore(0)).toBeNull();
    expect(validateScore(99999)).toBeNull();
  });

  it("rejects invalid names and scores", () => {
    expect(validatePlayerName("")).not.toBeNull();
    expect(validatePlayerName("this-name-is-way-too-long")).not.toBeNull();
    expect(validatePlayerName("bad@name")).not.toBeNull();
    expect(validateScore(-1)).not.toBeNull();
    expect(validateScore(1.5)).not.toBeNull();
    expect(validateScore(100_000_001)).not.toBeNull();
  });
});
