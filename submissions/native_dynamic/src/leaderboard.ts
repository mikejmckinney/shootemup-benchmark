/**
 * A deliberately small Supabase REST client. The browser only ever receives
 * the public anon key; the write policies and database checks belong on the
 * Supabase table itself.
 */

export const MAX_LEADERBOARD_SCORE = 999_999_999;
const MAX_NAME_LENGTH = 16;
const TABLE_NAME = 'leaderboard';
const CANDIDATE_ID = 'native_dynamic';
const LOCAL_STORAGE_KEY = 'neon-barrage-local-archive-v1';
const REQUEST_TIMEOUT_MS = 8_000;

export type LeaderboardMode = 'supabase' | 'local';
export type LeaderboardEntry = {
  id?: string | number;
  name: string;
  score: number;
  createdAt?: string;
};

export type LeaderboardLoadResult = {
  status: 'success' | 'empty' | 'error';
  entries: LeaderboardEntry[];
  mode: LeaderboardMode;
  message?: string;
};

export type LeaderboardSubmitResult = {
  status: 'success' | 'error';
  entry?: LeaderboardEntry;
  entries: LeaderboardEntry[];
  mode: LeaderboardMode;
  message?: string;
};

export type ValidationResult = { ok: true; value: string | number } | { ok: false; message: string };

type SupabaseRow = {
  id?: string | number;
  player_name?: unknown;
  score?: unknown;
  created_at?: unknown;
};

type SupabaseConfig = { url: string; anonKey: string } | null;

function getConfig(): SupabaseConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, anonKey };
}

export function validatePlayerName(input: string): ValidationResult {
  const value = input.trim();
  const length = Array.from(value).length;
  if (length < 1) return { ok: false, message: 'Enter a callsign before archiving the run.' };
  if (length > MAX_NAME_LENGTH) return { ok: false, message: 'Keep your callsign to 16 characters or fewer.' };
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9 _-]{0,14}[A-Za-z0-9_-])?$/.test(value)) {
    return { ok: false, message: 'Use letters, numbers, spaces, _ or - (no leading/trailing spaces).' };
  }
  return { ok: true, value };
}

export function validateScore(input: number): ValidationResult {
  if (!Number.isSafeInteger(input) || input < 0 || input > MAX_LEADERBOARD_SCORE) {
    return { ok: false, message: 'That score is outside the valid archive range.' };
  }
  return { ok: true, value: input };
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .filter((entry) => Number.isSafeInteger(entry.score) && entry.score >= 0)
    .sort((a, b) => b.score - a.score || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .slice(0, 10);
}

function seededEntries(): LeaderboardEntry[] {
  return [
    { id: 'seed-1', name: 'VANTA', score: 18420 },
    { id: 'seed-2', name: 'LUMEN', score: 14760 },
    { id: 'seed-3', name: 'KITE', score: 11240 },
    { id: 'seed-4', name: 'NOVA', score: 9040 },
    { id: 'seed-5', name: 'RUNE', score: 7280 },
  ];
}

function readLocalEntries(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return seededEntries();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seededEntries();
    const entries = parsed.filter((entry): entry is LeaderboardEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const value = entry as Partial<LeaderboardEntry>;
      return typeof value.name === 'string' && typeof value.score === 'number';
    });
    return entries.length > 0 ? sortEntries(entries) : seededEntries();
  } catch {
    return seededEntries();
  }
}

function writeLocalEntries(entries: LeaderboardEntry[]): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortEntries(entries)));
  } catch {
    // Private browsing or a blocked storage provider should not stop the game.
  }
}

function normalizeRows(rows: SupabaseRow[]): LeaderboardEntry[] {
  return sortEntries(rows.flatMap((row) => {
    if (typeof row.player_name !== 'string' || typeof row.score !== 'number') return [];
    return [{ id: row.id, name: row.player_name, score: row.score, createdAt: typeof row.created_at === 'string' ? row.created_at : undefined }];
  }));
}

async function request<T>(config: Exclude<SupabaseConfig, null>, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Archive request failed (${response.status}).`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class LeaderboardClient {
  private readonly config = getConfig();

  get mode(): LeaderboardMode {
    return this.config ? 'supabase' : 'local';
  }

  async loadTopScores(): Promise<LeaderboardLoadResult> {
    if (!this.config) {
      const entries = readLocalEntries();
      return { status: entries.length ? 'success' : 'empty', entries, mode: 'local' };
    }

    try {
      const rows = await request<SupabaseRow[]>(this.config, `${TABLE_NAME}?select=id,player_name,score,created_at&candidate_id=eq.${CANDIDATE_ID}&order=score.desc,created_at.asc&limit=10`);
      const entries = normalizeRows(rows);
      return { status: entries.length ? 'success' : 'empty', entries, mode: 'supabase' };
    } catch (error) {
      const entries = readLocalEntries();
      return {
        status: 'error',
        entries,
        mode: 'supabase',
        message: error instanceof Error ? error.message : 'The archive could not be reached.',
      };
    }
  }

  async submitScore(rawName: string, rawScore: number): Promise<LeaderboardSubmitResult> {
    const name = validatePlayerName(rawName);
    if (!name.ok) return { status: 'error', entries: [], mode: this.mode, message: name.message };
    const score = validateScore(rawScore);
    if (!score.ok) return { status: 'error', entries: [], mode: this.mode, message: score.message };
    const entry: LeaderboardEntry = { name: name.value as string, score: score.value as number, createdAt: new Date().toISOString() };

    if (!this.config) {
      const entries = sortEntries([...readLocalEntries(), entry]);
      writeLocalEntries(entries);
      return { status: 'success', entry, entries, mode: 'local' };
    }

    try {
      const rows = await request<SupabaseRow[]>(this.config, TABLE_NAME, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ candidate_id: CANDIDATE_ID, player_name: entry.name, score: entry.score }),
      });
      const submitted = normalizeRows(rows)[0] ?? entry;
      return { status: 'success', entry: submitted, entries: [], mode: 'supabase' };
    } catch (error) {
      return {
        status: 'error',
        entries: [],
        mode: 'supabase',
        message: error instanceof Error ? error.message : 'The archive rejected the score. Try again.',
      };
    }
  }
}
