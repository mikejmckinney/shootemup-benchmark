import { createClient } from '@supabase/supabase-js';
import { readPublicConfig, type PublicConfig } from '../config/env';
import { validateScoreSubmission } from './validation';
import type { LeaderboardClient, LeaderboardEntry, ScoreSubmission } from './types';

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id)
    .slice(0, 10);
}

export function mapLeaderboardError(error: unknown): Error {
  if (error instanceof Error && error.message) return error;
  return new Error('Leaderboard service is unavailable. Try again.');
}

export function createSupabaseLeaderboardClient(config: PublicConfig = readPublicConfig()): LeaderboardClient {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  return {
    async listTopEntries() {
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select('id, name, score, created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(10);
      if (error) throw mapLeaderboardError(error);
      return sortLeaderboardEntries((data ?? []) as LeaderboardEntry[]);
    },
    async createEntry(input: ScoreSubmission) {
      const validation = validateScoreSubmission(input);
      if (!validation.ok) throw new Error(validation.message);
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .insert(validation.value)
        .select('id, name, score, created_at')
        .single();
      if (error) throw mapLeaderboardError(error);
      return data as LeaderboardEntry;
    },
  };
}
