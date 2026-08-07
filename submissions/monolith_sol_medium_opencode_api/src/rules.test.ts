import { describe, expect, it } from 'vitest';
import { circlesCollide, difficultyFor, isPlausibleScore, isValidName } from './rules';

describe('game and score rules', () => {
  it('validates public leaderboard values', () => {
    expect(isValidName('ACE-01')).toBe(true);
    expect(isValidName('')).toBe(false);
    expect(isValidName('x'.repeat(17))).toBe(false);
    expect(isValidName('<script>')).toBe(false);
    expect(isPlausibleScore(0)).toBe(true);
    expect(isPlausibleScore(10_000_001)).toBe(false);
    expect(isPlausibleScore(2.5)).toBe(false);
  });

  it('detects collisions and escalates difficulty', () => {
    expect(circlesCollide({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
    expect(circlesCollide({ x: 0, y: 0, r: 5 }, { x: 20, y: 0, r: 5 })).toBe(false);
    expect(difficultyFor(2400, 61)).toBeGreaterThan(difficultyFor(0, 0));
    expect(difficultyFor(99_999, 999)).toBe(10);
  });
});
