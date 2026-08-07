import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validatePlayerName, validateScore } from './game';

export interface LeaderboardEntry {
  id?: number;
  player_name: string;
  score: number;
  created_at?: string;
}

export interface LeaderboardResult<T> {
  data: T | null;
  error: string | null;
}

const NAME_RE = /^[A-Za-z0-9 _.-]+$/;

export function createLeaderboardClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchTopScores(
  client: SupabaseClient,
  limit = 10,
): Promise<LeaderboardResult<LeaderboardEntry[]>> {
  const { data, error } = await client
    .from('leaderboard')
    .select('id, player_name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return { data: null, error: error.message || 'Failed to load leaderboard.' };
  }
  return { data: data ?? [], error: null };
}

export async function submitScore(
  client: SupabaseClient,
  playerName: string,
  score: number,
): Promise<LeaderboardResult<LeaderboardEntry>> {
  const nameError = validatePlayerName(playerName);
  if (nameError) return { data: null, error: nameError };
  const scoreError = validateScore(score);
  if (scoreError) return { data: null, error: scoreError };

  const trimmed = playerName.trim();
  if (!NAME_RE.test(trimmed)) {
    return { data: null, error: 'Invalid player name.' };
  }

  const { data, error } = await client
    .from('leaderboard')
    .insert({ player_name: trimmed, score })
    .select('id, player_name, score, created_at')
    .single();

  if (error) {
    return { data: null, error: error.message || 'Failed to submit score.' };
  }
  return { data, error: null };
}
