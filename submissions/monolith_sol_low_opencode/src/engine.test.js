import { describe, expect, it } from 'vitest';
import { clamp, circlesCollide, difficultyFor, validName, validScore } from './engine.js';

describe('gameplay helpers', () => {
  it('detects circular hits and clamps movement', () => {
    expect(circlesCollide({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 4 })).toBe(true);
    expect(circlesCollide({ x: 0, y: 0, r: 5 }, { x: 20, y: 0, r: 4 })).toBe(false);
    expect(clamp(12, 0, 10)).toBe(10);
  });
  it('escalates pressure and validates leaderboard payloads', () => {
    expect(difficultyFor(2000, 60).level).toBeGreaterThan(difficultyFor(0, 0).level);
    expect(difficultyFor(2000, 60).spawnEvery).toBeLessThan(difficultyFor(0, 0).spawnEvery);
    expect(validName('NOVA-7')).toBe(true);
    expect(validName('<script>')).toBe(false);
    expect(validScore(4200)).toBe(true);
    expect(validScore(-1)).toBe(false);
  });
});
