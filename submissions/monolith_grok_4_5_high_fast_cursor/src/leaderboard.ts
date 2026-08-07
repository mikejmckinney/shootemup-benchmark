import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validatePlayerName, validateScore } from './game/validation';

export interface LeaderboardEntry {
  player_name: string;
  score: number;
  created_at?: string;
}

export type LeaderboardStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

function getConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  return { url, key };
}

export class LeaderboardService {
  private client: SupabaseClient | null = null;
  status: LeaderboardStatus = 'idle';
  errorMessage = '';
  entries: LeaderboardEntry[] = [];

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const cfg = getConfig();
    if (!cfg) {
      throw new Error('Missing Supabase configuration.');
    }
    this.client = createClient(cfg.url, cfg.key);
    return this.client;
  }

  async fetchTop(limit = 10): Promise<LeaderboardEntry[]> {
    this.status = 'loading';
    this.errorMessage = '';
    try {
      const { data, error } = await this.getClient()
        .from('leaderboard')
        .select('player_name,score,created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      this.entries = data ?? [];
      this.status = this.entries.length === 0 ? 'empty' : 'ready';
      return this.entries;
    } catch (err) {
      this.status = 'error';
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard.';
      this.entries = [];
      return [];
    }
  }

  async submitScore(playerName: string, score: number): Promise<{ ok: boolean; message: string }> {
    const nameErr = validatePlayerName(playerName);
    if (nameErr) return { ok: false, message: nameErr };
    const scoreErr = validateScore(score);
    if (scoreErr) return { ok: false, message: scoreErr };

    try {
      const { error } = await this.getClient().from('leaderboard').insert({
        player_name: playerName.trim(),
        score,
      });
      if (error) throw error;
      await this.fetchTop(10);
      return { ok: true, message: 'Score submitted!' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error submitting score.';
      return { ok: false, message };
    }
  }
}
