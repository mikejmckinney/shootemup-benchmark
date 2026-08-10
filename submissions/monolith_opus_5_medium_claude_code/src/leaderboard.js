// Supabase leaderboard access via PostgREST.
// Only the publishable (anon) key ever reaches the browser; the database
// enforces the same rules with RLS policies and CHECK constraints.

export const NAME_PATTERN = /^[A-Za-z0-9 ._-]{1,16}$/;
export const MAX_SCORE = 10000000;

export function validateName(raw) {
  const name = String(raw ?? '').trim();
  if (name.length === 0) return { ok: false, error: 'Enter a name (1-16 characters).' };
  if (name.length > 16) return { ok: false, error: 'Name must be 16 characters or fewer.' };
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, error: 'Use letters, numbers, space, dot, dash or underscore.' };
  }
  return { ok: true, value: name };
}

export function validateScore(raw) {
  const score = Number(raw);
  if (!Number.isFinite(score) || !Number.isInteger(score)) {
    return { ok: false, error: 'Score must be a whole number.' };
  }
  if (score < 0 || score > MAX_SCORE) return { ok: false, error: 'Score is out of range.' };
  return { ok: true, value: score };
}

export function createLeaderboard({ url, anonKey, fetchImpl = globalThis.fetch, limit = 10 }) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/leaderboard`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };

  async function request(path, init) {
    let response;
    try {
      response = await fetchImpl(path, init);
    } catch (cause) {
      throw new Error('Network unavailable. Check your connection and retry.', { cause });
    }
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.message || body?.hint || '';
      } catch { /* body was not JSON */ }
      throw new Error(detail ? `Server rejected the request: ${detail}` : `Server error (${response.status}).`);
    }
    return response;
  }

  return {
    async top(count = limit) {
      const query = `${base}?select=name,score,created_at&order=score.desc,created_at.asc&limit=${count}`;
      const response = await request(query, { headers });
      return response.json();
    },

    async submit(name, score) {
      const validName = validateName(name);
      if (!validName.ok) throw new Error(validName.error);
      const validScore = validateScore(score);
      if (!validScore.ok) throw new Error(validScore.error);

      const response = await request(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ name: validName.value, score: validScore.value }),
      });
      const rows = await response.json();
      return Array.isArray(rows) ? rows[0] : rows;
    },
  };
}
