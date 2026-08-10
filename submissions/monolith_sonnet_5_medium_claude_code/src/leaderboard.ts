import { supabase } from "./supabaseClient";
import type { LeaderboardEntry } from "./types";

export const NAME_PATTERN = /^[A-Za-z0-9 _-]{1,16}$/;

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    return "Name must be 1-16 characters.";
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return "Use letters, numbers, spaces, - or _ only.";
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0) {
    return "Score must be a non-negative integer.";
  }
  return null;
}

export interface FetchResult {
  ok: boolean;
  entries: LeaderboardEntry[];
  errorMessage?: string;
}

export async function fetchTopScores(limit = 10): Promise<FetchResult> {
  if (!supabase) {
    return { ok: false, entries: [], errorMessage: "Leaderboard is not configured." };
  }
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("id, player_name, score, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) {
      return { ok: false, entries: [], errorMessage: error.message };
    }
    return { ok: true, entries: (data ?? []) as LeaderboardEntry[] };
  } catch (err) {
    return { ok: false, entries: [], errorMessage: err instanceof Error ? err.message : "Network error." };
  }
}

export interface SubmitResult {
  ok: boolean;
  errorMessage?: string;
}

export async function submitScore(name: string, score: number): Promise<SubmitResult> {
  const nameError = validateName(name);
  if (nameError) return { ok: false, errorMessage: nameError };
  const scoreError = validateScore(score);
  if (scoreError) return { ok: false, errorMessage: scoreError };
  if (!supabase) {
    return { ok: false, errorMessage: "Leaderboard is not configured." };
  }
  try {
    const { error } = await supabase
      .from("leaderboard")
      .insert({ player_name: name.trim(), score });
    if (error) {
      return { ok: false, errorMessage: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : "Network error." };
  }
}

export function renderLeaderboard(container: HTMLElement, result: FetchResult): void {
  container.innerHTML = "";
  if (!result.ok) {
    const p = document.createElement("p");
    p.className = "lb-status";
    p.textContent = result.errorMessage ?? "Couldn't load leaderboard.";
    container.appendChild(p);
    return;
  }
  if (result.entries.length === 0) {
    const p = document.createElement("p");
    p.className = "lb-status";
    p.textContent = "No scores yet. Be the first!";
    container.appendChild(p);
    return;
  }
  result.entries.forEach((entry, i) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = `${i + 1}`;
    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = entry.player_name;
    const score = document.createElement("span");
    score.className = "lb-score";
    score.textContent = String(entry.score);
    row.append(rank, name, score);
    container.appendChild(row);
  });
}
