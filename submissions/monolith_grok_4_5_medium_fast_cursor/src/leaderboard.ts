import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  NAME_PATTERN,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './config';

export type LeaderboardEntry = {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
};

export type LeaderboardResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters.`;
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return 'Name may only contain letters, numbers, spaces, _ . -';
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 10_000_000) {
    return 'Score must be a plausible non-negative integer.';
  }
  return null;
}

export class LeaderboardService {
  private client: SupabaseClient;

  constructor(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
    this.client = createClient(url, key);
  }

  async fetchTop(limit = 10): Promise<LeaderboardResult<LeaderboardEntry[]>> {
    const { data, error } = await this.client
      .from('leaderboard')
      .select('id, player_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message || 'Failed to load leaderboard.' };
    }
    return { ok: true, data: (data ?? []) as LeaderboardEntry[] };
  }

  async submitScore(
    playerName: string,
    score: number,
  ): Promise<LeaderboardResult<LeaderboardEntry>> {
    const nameError = validatePlayerName(playerName);
    if (nameError) return { ok: false, error: nameError };
    const scoreError = validateScore(score);
    if (scoreError) return { ok: false, error: scoreError };

    const { data, error } = await this.client
      .from('leaderboard')
      .insert({ player_name: playerName.trim(), score })
      .select('id, player_name, score, created_at')
      .single();

    if (error) {
      return { ok: false, error: error.message || 'Failed to submit score.' };
    }
    return { ok: true, data: data as LeaderboardEntry };
  }
}
