import { validateName, validateScore } from './game';

export interface ScoreRow {
  name: string;
  score: number;
  created_at: string;
}

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
/** Publishable (anon) key only. Never a service-role/secret key. */
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 9000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchTop(limit = 10): Promise<ScoreRow[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(
      `${URL_BASE}/rest/v1/scores?select=name,score,created_at&order=score.desc,created_at.asc&limit=${limit}`,
      { headers: headers(), signal },
    );
    if (!res.ok) throw new Error(`Leaderboard unavailable (HTTP ${res.status})`);
    return (await res.json()) as ScoreRow[];
  });
}

export async function submitScore(rawName: string, score: number): Promise<ScoreRow> {
  const v = validateName(rawName);
  if (!v.ok) throw new Error(v.error);
  if (!validateScore(score)) throw new Error('Score is not a valid integer.');
  return withTimeout(async (signal) => {
    const res = await fetch(`${URL_BASE}/rest/v1/scores`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ name: v.name, score }),
      signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) detail = body.message;
      } catch {
        /* ignore */
      }
      throw new Error(`Could not save score: ${detail}`);
    }
    const rows = (await res.json()) as ScoreRow[];
    return rows[0];
  });
}
