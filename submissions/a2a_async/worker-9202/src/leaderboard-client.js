import { createClient } from '@supabase/supabase-js';

export const LEADERBOARD_TABLE = 'leaderboard';
export const DEFAULT_LEADERBOARD_LIMIT = 10;
export const PLAYER_NAME_MAX_LENGTH = 16;
export const SCORE_MAX = 100_000_000;

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$/u;
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f-\u009f]/u;
const SELECT_COLUMNS = 'id, name, score, created_at';

/**
 * Error raised before a request is sent to Supabase.
 */
export class LeaderboardValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'LeaderboardValidationError';
    this.code = 'validation_error';
    this.field = field;
  }
}

/**
 * Validate and normalize the display name used by the database layer.
 * The database repeats these rules, so this is a UX check rather than a
 * security boundary. Leading/trailing whitespace is trimmed before insert.
 */
export function validatePlayerName(value) {
  if (typeof value !== 'string') {
    throw new LeaderboardValidationError('Enter a player name.', 'name');
  }
  if (CONTROL_CHARACTER_RE.test(value)) {
    throw new LeaderboardValidationError(
      'Player names cannot contain control characters.',
      'name',
    );
  }
  const name = value.trim();
  const length = Array.from(name).length;

  if (length < 1) {
    throw new LeaderboardValidationError('Enter a player name.', 'name');
  }
  if (length > PLAYER_NAME_MAX_LENGTH) {
    throw new LeaderboardValidationError(
      `Player names must be ${PLAYER_NAME_MAX_LENGTH} characters or fewer.`,
      'name',
    );
  }
  if (!NAME_PATTERN.test(name)) {
    throw new LeaderboardValidationError(
      'Use letters, numbers, spaces, hyphens, or underscores; start with a letter or number.',
      'name',
    );
  }

  return name;
}

/**
 * Validate the integer score accepted by the leaderboard constraint.
 */
export function validateScore(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > SCORE_MAX) {
    throw new LeaderboardValidationError(
      `Score must be a whole number from 0 to ${SCORE_MAX.toLocaleString()}.`,
      'score',
    );
  }

  return value;
}

function errorDetails(error, fallbackMessage) {
  const message =
    error && typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : fallbackMessage;

  return {
    message,
    code: error && typeof error.code === 'string' ? error.code : null,
    field: error && typeof error.field === 'string' ? error.field : null,
  };
}

function snapshot(status, entries, error = null) {
  return Object.freeze({
    status,
    entries: Object.freeze(Array.isArray(entries) ? [...entries] : []),
    error,
  });
}

function validateLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('Leaderboard limit must be an integer from 1 to 100.');
  }
  return limit;
}

async function fetchEntries(client, limit) {
  const { data, error } = await client
    .from(LEADERBOARD_TABLE)
    .select(SELECT_COLUMNS)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Create the browser-safe Supabase client used by the leaderboard.
 *
 * Only an anon/publishable key belongs here. There is deliberately no
 * process.env or server-only credential fallback in this module.
 */
export function createBrowserLeaderboardClient({
  supabaseUrl,
  anonKey,
  clientFactory = createClient,
} = {}) {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    throw new TypeError('A Supabase project URL is required.');
  }
  if (typeof anonKey !== 'string' || !anonKey.trim()) {
    throw new TypeError('A Supabase anon/publishable key is required.');
  }

  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new TypeError('Supabase project URL must be a valid http(s) URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('Supabase project URL must be a valid http(s) URL.');
  }

  const publicKey = anonKey.trim();
  if (/^sb_secret_/i.test(publicKey) || /service_role/i.test(publicKey)) {
    throw new TypeError('A service-role or secret key cannot be used in a browser.');
  }

  return clientFactory(url.toString().replace(/\/$/u, ''), publicKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create the stateful data layer consumed by the game UI.
 *
 * State statuses are: idle, loading, submitting, ready, empty, and error.
 * Read failures are represented in state instead of thrown, so a game can
 * continue when the leaderboard is unavailable. submitScore returns an
 * explicit { ok } result for the same reason.
 */
export function createLeaderboardStore({
  client,
  limit = DEFAULT_LEADERBOARD_LIMIT,
} = {}) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('A Supabase client with from() is required.');
  }

  const pageSize = validateLimit(limit);
  const listeners = new Set();
  let state = snapshot('idle', []);
  let operationId = 0;

  function getState() {
    return state;
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // A rendering callback must not break the data layer's network flow.
      }
    }
  }

  function setState(status, entries = state.entries, error = null) {
    state = snapshot(status, entries, error);
    notify();
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Leaderboard subscriber must be a function.');
    }
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  async function load() {
    const requestId = ++operationId;
    setState('loading', state.entries, null);

    try {
      const entries = await fetchEntries(client, pageSize);
      if (requestId !== operationId) {
        return state;
      }
      return setState(entries.length > 0 ? 'ready' : 'empty', entries, null);
    } catch (error) {
      if (requestId !== operationId) {
        return state;
      }
      return setState(
        'error',
        state.entries,
        errorDetails(error, 'Leaderboard is unavailable right now.'),
      );
    }
  }

  async function submitScore(playerName, score) {
    let name;
    let validScore;
    try {
      name = validatePlayerName(playerName);
      validScore = validateScore(score);
    } catch (error) {
      const details = errorDetails(error, 'Check the score details and try again.');
      setState('error', state.entries, details);
      return { ok: false, error: details, state };
    }

    const requestId = ++operationId;
    const previousEntries = state.entries;
    setState('submitting', previousEntries, null);

    let insertedEntry = null;
    try {
      const response = await client
        .from(LEADERBOARD_TABLE)
        .insert({ name, score: validScore })
        .select(SELECT_COLUMNS)
        .single();

      if (response.error) {
        throw response.error;
      }
      insertedEntry = response.data ?? null;
    } catch (error) {
      if (requestId === operationId) {
        const details = errorDetails(error, 'Score could not be submitted.');
        setState('error', previousEntries, details);
        return { ok: false, error: details, state };
      }
      return { ok: false, error: errorDetails(error, 'Score could not be submitted.'), state };
    }

    // Re-read the ordered top-N list so a low score does not get presented as
    // a top score and a high score appears in the same order as a later load.
    try {
      const entries = await fetchEntries(client, pageSize);
      if (requestId !== operationId) {
        return { ok: true, entry: insertedEntry, state };
      }
      setState(entries.length > 0 ? 'ready' : 'empty', entries, null);
      return { ok: true, entry: insertedEntry, state };
    } catch (error) {
      if (requestId === operationId) {
        const details = errorDetails(
          error,
          'Score submitted, but the leaderboard could not be refreshed.',
        );
        setState('error', previousEntries, details);
        return { ok: true, entry: insertedEntry, warning: details, state };
      }
      return { ok: true, entry: insertedEntry, state };
    }
  }

  function clearError() {
    if (state.status !== 'error') {
      return state;
    }
    return setState(state.entries.length > 0 ? 'ready' : 'empty', state.entries, null);
  }

  return Object.freeze({
    getState,
    subscribe,
    load,
    submitScore,
    clearError,
  });
}

/**
 * Convenience factory for the coordinator's frontend integration.
 */
export function createLeaderboardDataLayer({
  supabaseUrl,
  anonKey,
  clientFactory,
  limit = DEFAULT_LEADERBOARD_LIMIT,
} = {}) {
  const client = createBrowserLeaderboardClient({
    supabaseUrl,
    anonKey,
    clientFactory,
  });

  return createLeaderboardStore({ client, limit });
}
