import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizePlayerName, validatePlayerName, validateScore } from './validation';

export type LeaderboardEntry = {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
};

export type LeaderboardResult =
  | { ok: true; entries: LeaderboardEntry[] }
  | { ok: false; error: string };

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: string };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function fetchTopScores(limit = 10): Promise<LeaderboardResult> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, error: 'Leaderboard is not configured.' };
  }

  try {
    const { data, error } = await sb
      .from('leaderboard')
      .select('id, player_name, score, created_at')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, error: error.message || 'Failed to load leaderboard.' };
    }

    return { ok: true, entries: (data ?? []) as LeaderboardEntry[] };
  } catch {
    return { ok: false, error: 'Network error loading leaderboard.' };
  }
}

export async function submitScore(playerName: string, score: number): Promise<SubmitResult> {
  const nameError = validatePlayerName(playerName);
  if (nameError) return { ok: false, error: nameError };

  const scoreError = validateScore(score);
  if (scoreError) return { ok: false, error: scoreError };

  const sb = getSupabase();
  if (!sb) {
    return { ok: false, error: 'Leaderboard is not configured.' };
  }

  try {
    const { error } = await sb.from('leaderboard').insert({
      player_name: normalizePlayerName(playerName),
      score,
    });

    if (error) {
      return { ok: false, error: error.message || 'Failed to submit score.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error submitting score.' };
  }
}
