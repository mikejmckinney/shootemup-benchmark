import { describe, expect, it } from 'vitest';
import { sortLeaderboardEntries } from '../../src/leaderboard/client';
import type { LeaderboardEntry } from '../../src/leaderboard/types';

const entry = (id: number, name: string, score: number, created_at: string): LeaderboardEntry => ({
  id,
  name,
  score,
  created_at,
});

describe('leaderboard client behavior', () => {
  it('orders top scores and deterministic ties', () => {
    const result = sortLeaderboardEntries([
      entry(2, 'LATER', 500, '2026-01-02T00:00:00.000Z'),
      entry(1, 'EARLIER', 500, '2026-01-01T00:00:00.000Z'),
      entry(3, 'LOW', 20, '2026-01-01T00:00:00.000Z'),
    ]);

    expect(result.map(({ name }) => name)).toEqual(['EARLIER', 'LATER', 'LOW']);
  });

  it('limits reads to the visible top ten', () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry(index, `P${index}`, index, `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`));
    expect(sortLeaderboardEntries(entries)).toHaveLength(10);
    expect(sortLeaderboardEntries(entries)[0].score).toBe(11);
  });
});
