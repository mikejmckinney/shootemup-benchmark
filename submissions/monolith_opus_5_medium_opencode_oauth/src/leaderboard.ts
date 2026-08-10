import { validateName, validateScore } from './engine';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  created_at: string;
}

export interface SupabaseConfig {
  url: string;
  key: string; // publishable/anon key only — never a service-role secret
}

export class LeaderboardError extends Error {
  constructor(message: string, readonly kind: 'config' | 'network' | 'validation' | 'server') {
    super(message);
    this.name = 'LeaderboardError';
  }
}

const TIMEOUT_MS = 9000;

async function request(
  cfg: SupabaseConfig,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(`${cfg.url}/rest/v1/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new LeaderboardError(
      (err as Error)?.name === 'AbortError' ? 'Request timed out.' : 'Network unavailable.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }
}

export class LeaderboardClient {
  constructor(private cfg: SupabaseConfig, private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  get configured(): boolean {
    return Boolean(this.cfg.url && this.cfg.key);
  }

  async top(limit = 10): Promise<LeaderboardEntry[]> {
    if (!this.configured) throw new LeaderboardError('Leaderboard is not configured.', 'config');
    const res = await request(
      this.cfg,
      `leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=${limit}`,
      { method: 'GET' },
      this.fetchImpl,
    );
    if (!res.ok) throw new LeaderboardError(`Leaderboard unavailable (${res.status}).`, 'server');
    return (await res.json()) as LeaderboardEntry[];
  }

  async submit(rawName: string, score: number): Promise<LeaderboardEntry> {
    if (!this.configured) throw new LeaderboardError('Leaderboard is not configured.', 'config');
    const nameCheck = validateName(rawName);
    if (!nameCheck.ok) throw new LeaderboardError(nameCheck.error, 'validation');
    if (!validateScore(score)) throw new LeaderboardError('Score is not a valid value.', 'validation');

    const res = await request(
      this.cfg,
      'leaderboard',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ name: nameCheck.name, score }),
      },
      this.fetchImpl,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 409) {
        throw new LeaderboardError('Score rejected by the leaderboard rules.', 'validation');
      }
      throw new LeaderboardError(`Could not save score (${res.status}). ${body.slice(0, 90)}`, 'server');
    }
    const rows = (await res.json()) as LeaderboardEntry[];
    if (!rows.length) throw new LeaderboardError('Score was not stored.', 'server');
    return rows[0];
  }
}
