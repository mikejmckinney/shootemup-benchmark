import { describe, expect, it } from 'vitest';
import { validatePlayerName, validateScore } from '../src/game/validation';

describe('validatePlayerName', () => {
  it('accepts valid callsigns', () => {
    expect(validatePlayerName('Ace')).toBeNull();
    expect(validatePlayerName('Neon_Pilot-1')).toBeNull();
    expect(validatePlayerName('A'.repeat(16))).toBeNull();
  });

  it('rejects empty, oversized, or illegal characters', () => {
    expect(validatePlayerName('')).not.toBeNull();
    expect(validatePlayerName('   ')).not.toBeNull();
    expect(validatePlayerName('A'.repeat(17))).not.toBeNull();
    expect(validatePlayerName('bad!name')).not.toBeNull();
  });
});

describe('validateScore', () => {
  it('accepts plausible non-negative integers', () => {
    expect(validateScore(0)).toBeNull();
    expect(validateScore(1234)).toBeNull();
    expect(validateScore(100_000_000)).toBeNull();
  });

  it('rejects negatives, floats, and huge values', () => {
    expect(validateScore(-1)).not.toBeNull();
    expect(validateScore(1.5)).not.toBeNull();
    expect(validateScore(100_000_001)).not.toBeNull();
  });
});
