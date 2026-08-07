import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
}

export const NAME_PATTERN = /^[A-Za-z0-9 _.\-]{1,16}$/;

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    return "Name must be 1–16 characters.";
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return "Use letters, numbers, spaces, _ . - only.";
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 100_000_000) {
    return "Score must be a plausible non-negative integer.";
  }
  return null;
}

export function createLeaderboardClient(
  url = import.meta.env.VITE_SUPABASE_URL as string,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY as string,
): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchTopScores(
  client: SupabaseClient,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await client
    .from("leaderboard")
    .select("id, player_name, score, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}

export async function submitScore(
  client: SupabaseClient,
  playerName: string,
  score: number,
): Promise<LeaderboardEntry> {
  const nameErr = validatePlayerName(playerName);
  if (nameErr) throw new Error(nameErr);
  const scoreErr = validateScore(score);
  if (scoreErr) throw new Error(scoreErr);

  const { data, error } = await client
    .from("leaderboard")
    .insert({ player_name: playerName.trim(), score })
    .select("id, player_name, score, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as LeaderboardEntry;
}
