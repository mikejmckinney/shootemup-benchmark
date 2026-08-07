import { createClient } from '@supabase/supabase-js';

export type LeaderboardEntry = {
  player_name: string;
  score: number;
  created_at: string;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type LeaderboardService = {
  loadTop: () => Promise<Result<LeaderboardEntry[]>>;
  submit: (name: string, score: number) => Promise<Result<LeaderboardEntry>>;
};

export type LeaderboardRequestGuard = {
  begin: () => number;
  isCurrent: (requestId: number) => boolean;
};

const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 2_000_000_000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

const messages = {
  configuration: 'Leaderboard is not configured.',
  load: 'Leaderboard could not be loaded right now.',
  submit: 'Score could not be submitted right now.',
  blankName: 'Enter a callsign.',
  longName: 'Callsign must be 16 characters or fewer.',
  controlName: 'Callsign cannot contain control characters.',
  score: 'Score must be a non-negative integer no greater than 2,000,000,000.',
} as const;

export function validatePlayerName(name: string): Result<string> {
  const value = name.trim();
  const characterCount = [...value].length;

  if (characterCount === 0) {
    return { ok: false, message: messages.blankName };
  }
  if (characterCount > MAX_NAME_LENGTH) {
    return { ok: false, message: messages.longName };
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return { ok: false, message: messages.controlName };
  }

  return { ok: true, value };
}

export function validateScore(score: number): Result<number> {
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, message: messages.score };
  }

  return { ok: true, value: score };
}

export function createLeaderboardRequestGuard(): LeaderboardRequestGuard {
  let latestRequestId = 0;

  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    isCurrent: (requestId) => requestId === latestRequestId,
  };
}

export function leaderboardLoadSucceeded(
  renderedCurrent: boolean,
  requestSucceeded: boolean,
): boolean {
  return !renderedCurrent || requestSucceeded;
}

function createConfiguredClient(
  url: string | undefined,
  anonKey: string | undefined,
): ReturnType<typeof createClient> | undefined {
  if (!url?.trim() || !anonKey?.trim()) {
    return undefined;
  }

  try {
    return createClient(url.trim(), anonKey.trim());
  } catch {
    return undefined;
  }
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return typeof row.player_name === 'string'
    && Number.isInteger(row.score)
    && typeof row.created_at === 'string';
}

function parseEntries(data: unknown): LeaderboardEntry[] | undefined {
  if (!Array.isArray(data) || !data.every(isLeaderboardEntry)) {
    return undefined;
  }

  return data.map((entry) => ({
    player_name: entry.player_name,
    score: entry.score,
    created_at: entry.created_at,
  }));
}

export function createLeaderboardService(
  url: string | undefined,
  anonKey: string | undefined,
): LeaderboardService {
  const client = createConfiguredClient(url, anonKey);

  return {
    async loadTop(): Promise<Result<LeaderboardEntry[]>> {
      if (!client) {
        return { ok: false, message: messages.configuration };
      }

      try {
        const { data, error } = await client
          .from('leaderboard_entries')
          .select('player_name,score,created_at')
          .order('score', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(10);

        if (error) {
          return { ok: false, message: messages.load };
        }

        const entries = parseEntries(data);
        return entries ? { ok: true, value: entries } : { ok: false, message: messages.load };
      } catch {
        return { ok: false, message: messages.load };
      }
    },

    async submit(name: string, score: number): Promise<Result<LeaderboardEntry>> {
      const nameResult = validatePlayerName(name);
      if (!nameResult.ok) {
        return nameResult;
      }

      const scoreResult = validateScore(score);
      if (!scoreResult.ok) {
        return scoreResult;
      }

      if (!client) {
        return { ok: false, message: messages.configuration };
      }

      const trimmedName = nameResult.value;
      const validatedScore = scoreResult.value;

      try {
        const { data, error } = await client
          .from('leaderboard_entries')
          .insert({ player_name: trimmedName, score: validatedScore })
          .select('player_name,score,created_at')
          .single();

        if (error || !isLeaderboardEntry(data)) {
          return { ok: false, message: messages.submit };
        }

        return {
          ok: true,
          value: {
            player_name: data.player_name,
            score: data.score,
            created_at: data.created_at,
          },
        };
      } catch {
        return { ok: false, message: messages.submit };
      }
    },
  };
}
