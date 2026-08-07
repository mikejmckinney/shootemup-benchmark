import { describe, expect, it } from 'vitest';
import { MAX_SCORE } from '../../src/game/config';
import { validateScoreSubmission } from '../../src/leaderboard/validation';

describe('score submission validation', () => {
  it('trims and accepts a normal name and score', () => {
    expect(validateScoreSubmission({ name: '  PILOT  ', score: 120 })).toEqual({
      ok: true,
      value: { name: 'PILOT', score: 120 },
    });
  });

  it.each([
    ['', 1],
    ['                 ', 1],
    ['12345678901234567', 1],
    ['PILOT\nNOW', 1],
  ])('rejects invalid name %j', (name, score) => {
    expect(validateScoreSubmission({ name, score }).ok).toBe(false);
  });

  it.each([-1, 1.2, Number.NaN, MAX_SCORE + 1])('rejects invalid score %j', (score) => {
    expect(validateScoreSubmission({ name: 'PILOT', score }).ok).toBe(false);
  });
});
