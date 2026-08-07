import { describe, expect, it } from "vitest";
import {
  circlesOverlap,
  difficultyFor,
  isPlausibleScore,
  sanitizeName,
  scoreForEnemy,
  spawnDelayFor,
} from "../src/gameLogic.js";

describe("leaderboard input rules", () => {
  it("trims valid callsigns while preserving the database-safe length", () => {
    expect(sanitizeName("  NOVA  ")).toBe("NOVA");
    expect(sanitizeName("1234567890123456")).toBe("1234567890123456");
    expect(sanitizeName("12345678901234567")).toBeNull();
    expect(sanitizeName("   ")).toBeNull();
    expect(sanitizeName("BAD\nNAME")).toBeNull();
  });

  it("accepts only non-negative, bounded integer scores", () => {
    expect(isPlausibleScore(0)).toBe(true);
    expect(isPlausibleScore(2147483647)).toBe(true);
    expect(isPlausibleScore(-1)).toBe(false);
    expect(isPlausibleScore(12.5)).toBe(false);
    expect(isPlausibleScore(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("arcade difficulty and collisions", () => {
  it("raises the wave and tightens the spawn interval", () => {
    expect(difficultyFor(0, 0)).toBe(1);
    expect(difficultyFor(1300, 0)).toBe(3);
    expect(difficultyFor(0, 56)).toBe(3);
    expect(spawnDelayFor(6)).toBeLessThan(spawnDelayFor(1));
  });

  it("detects circle hits and awards stronger enemies more points", () => {
    expect(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 4 })).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 20, y: 0, radius: 4 })).toBe(false);
    expect(scoreForEnemy("drone")).toBeLessThan(scoreForEnemy("hunter"));
  });
});
