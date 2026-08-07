import { describe, expect, it } from 'vitest';
import { boxesOverlap, difficultyFor, normalizeTestScore, spawnDelayFor } from './gameModel';

describe('gameplay model', () => {
  it('detects projectile collision without counting touching edges', () => {
    expect(boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 3, width: 4, height: 4 })).toBe(true);
    expect(boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 3, width: 4, height: 4 })).toBe(false);
  });

  it('escalates and caps difficulty while reducing spawn delay', () => {
    expect(difficultyFor(0, 0)).toBe(1);
    expect(difficultyFor(36_000, 6_000)).toBe(5);
    expect(difficultyFor(999_999, 999_999)).toBe(12);
    expect(spawnDelayFor(1)).toBeGreaterThan(spawnDelayFor(8));
    expect(spawnDelayFor(100)).toBe(260);
  });

  it('accepts only plausible adapter scores', () => {
    expect(normalizeTestScore(123.9)).toBe(123);
    expect(normalizeTestScore(50_000_000)).toBe(10_000_000);
    expect(normalizeTestScore(-1)).toBeNull();
    expect(normalizeTestScore(Number.NaN)).toBeNull();
  });
});
