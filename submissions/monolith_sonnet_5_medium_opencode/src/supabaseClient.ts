import { createClient } from '@supabase/supabase-js';

// Public, browser-safe values. Row Level Security on the `leaderboard`
// table restricts anon access to SELECT (read) and validated INSERT only.
// No service-role/secret key is ever referenced in client code.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      })
    : null;

export interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
}

export async function fetchTopScores(limit = 10): Promise<LeaderboardEntry[]> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('leaderboard')
    .select('id, player_name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function submitScore(playerName: string, score: number): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('leaderboard').insert({
    player_name: playerName,
    score,
  });
  if (error) throw error;
}
