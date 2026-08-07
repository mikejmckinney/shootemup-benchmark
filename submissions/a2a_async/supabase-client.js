import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./supabase-config.js";
import { validateSubmission } from "./src/game-logic.mjs";

const tableUrl = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/leaderboard`;
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f-\u009f]/u;

function apiHeaders(extra = {}) {
  return {
    apikey: SUPABASE_PUBLIC_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
    Accept: "application/json",
    ...extra
  };
}

function assertConfigured() {
  if (!SUPABASE_URL.startsWith("https://") || SUPABASE_PUBLIC_KEY.startsWith("__")) {
    throw new Error("Leaderboard is not configured yet.");
  }
}

export async function fetchLeaderboard(fetchImpl = globalThis.fetch) {
  assertConfigured();
  const response = await fetchImpl(
    `${tableUrl}?select=id,player_name,score,created_at&candidate_id=eq.a2a_async&order=score.desc,created_at.asc,id.asc&limit=10`,
    { headers: apiHeaders() }
  );
  if (!response.ok) {
    throw new Error(`Leaderboard read failed (${response.status}).`);
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows.map((row) => ({ ...row, name: row.player_name })) : [];
}

export async function submitLeaderboardScore(name, score, fetchImpl = globalThis.fetch) {
  if (CONTROL_CHARACTER_RE.test(String(name ?? ""))) {
    throw new Error("Player names cannot contain control characters.");
  }
  const validation = validateSubmission(name, score);
  if (!validation.valid) {
    throw new Error(validation.nameError || validation.scoreError);
  }
  assertConfigured();
  const response = await fetchImpl(tableUrl, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ candidate_id: "a2a_async", player_name: validation.name, score: validation.score })
  });
  if (!response.ok) {
    let detail = "Leaderboard submission failed.";
    try {
      const body = await response.json();
      if (body?.message) detail = body.message;
      if (body?.hint) detail = `${detail} ${body.hint}`;
    } catch {
      // Keep the friendly fallback when the Data API did not return JSON.
    }
    throw new Error(detail);
  }
  return response.json();
}
