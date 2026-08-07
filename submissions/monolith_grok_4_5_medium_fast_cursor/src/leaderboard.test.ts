import { describe, expect, it } from 'vitest';
import { validatePlayerName, validateScore } from './leaderboard';

describe('validatePlayerName', () => {
  it('accepts valid 1-16 character names', () => {
    expect(validatePlayerName('A')).toBeNull();
    expect(validatePlayerName('Neon Ace')).toBeNull();
    expect(validatePlayerName('Pilot_01-X.')).toBeNull();
    expect(validatePlayerName('1234567890123456')).toBeNull();
  });

  it('rejects empty, too long, or illegal characters', () => {
    expect(validatePlayerName('')).not.toBeNull();
    expect(validatePlayerName('   ')).not.toBeNull();
    expect(validatePlayerName('12345678901234567')).not.toBeNull();
    expect(validatePlayerName('bad!')).not.toBeNull();
    expect(validatePlayerName('emoji🚀')).not.toBeNull();
  });
});

describe('validateScore', () => {
  it('accepts plausible non-negative integers', () => {
    expect(validateScore(0)).toBeNull();
    expect(validateScore(42)).toBeNull();
    expect(validateScore(10_000_000)).toBeNull();
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(validateScore(-1)).not.toBeNull();
    expect(validateScore(10_000_001)).not.toBeNull();
    expect(validateScore(3.5)).not.toBeNull();
    expect(validateScore(Number.NaN)).not.toBeNull();
  });
});
