import type { LeaderboardClient, LeaderboardEntry, ScoreSubmission } from '../../src/leaderboard/types';

export function createMemoryLeaderboard(initial: LeaderboardEntry[] = []): LeaderboardClient {
  let entries = [...initial];
  let nextId = Math.max(0, ...entries.map((entry) => entry.id)) + 1;

  const ordered = () =>
    [...entries]
      .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id)
      .slice(0, 10);

  return {
    async listTopEntries() {
      return ordered();
    },
    async createEntry(input: ScoreSubmission) {
      const entry: LeaderboardEntry = {
        id: nextId++,
        name: input.name,
        score: input.score,
        created_at: new Date(Date.now() + nextId).toISOString(),
      };
      entries = [...entries, entry];
      return entry;
    },
  };
}
