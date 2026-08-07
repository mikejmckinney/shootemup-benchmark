export const MAX_NAME_LENGTH = 16;
export const MAX_SCORE = 2_147_483_647;
const CANDIDATE_ID = 'a2a';

export class LeaderboardError extends Error {
  constructor(message, code = 'network') {
    super(message);
    this.name = 'LeaderboardError';
    this.code = code;
  }
}

export function validateName(value) {
  const rawName = String(value ?? '');
  if (/[\u0000-\u001f\u007f]/u.test(rawName)) {
    return { valid: false, name: rawName.trim(), error: 'Use visible characters only.' };
  }
  const name = rawName.trim();
  const length = Array.from(name).length;
  if (length === 0) return { valid: false, name, error: 'Enter a callsign before transmitting.' };
  if (length > MAX_NAME_LENGTH) return { valid: false, name, error: `Keep your callsign to ${MAX_NAME_LENGTH} characters or fewer.` };
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$/u.test(name)) {
    return { valid: false, name, error: 'Use letters, numbers, spaces, dots, dashes, or underscores.' };
  }
  return { valid: true, name, error: '' };
}

export function normalizeScore(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE) return null;
  return score;
}

export function normalizeConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const url = String(source.supabaseUrl || source.url || '').trim().replace(/\/$/u, '');
  const anonKey = String(source.supabaseAnonKey || source.anonKey || source.publicKey || '').trim();
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function createLeaderboardClient(config = {}, fetchImpl = globalThis.fetch) {
  const normalized = normalizeConfig(config);
  const endpoint = `${normalized.url}/rest/v1/leaderboard`;
  const request = async (path = '', options = {}) => {
    if (!normalized.configured) throw new LeaderboardError('Leaderboard connection is not configured yet.', 'unconfigured');
    if (typeof fetchImpl !== 'function') throw new LeaderboardError('Network access is unavailable.', 'network');
    let response;
    try {
      response = await fetchImpl(`${endpoint}${path}`, {
        ...options,
        headers: {
          apikey: normalized.anonKey,
          Authorization: `Bearer ${normalized.anonKey}`,
          ...(options.headers || {})
        }
      });
    } catch {
      throw new LeaderboardError('The signal feed could not be reached.', 'network');
    }
    if (!response.ok) {
      throw new LeaderboardError(`The signal feed returned ${response.status}.`, 'network');
    }
    return response;
  };

  return {
    configured: normalized.configured,
    async list() {
      const response = await request(`?select=id,player_name,score,created_at&candidate_id=eq.${CANDIDATE_ID}&order=score.desc,created_at.asc,id.asc&limit=10`);
      const records = await response.json();
      if (!Array.isArray(records)) throw new LeaderboardError('The signal feed sent an invalid response.', 'network');
      return records
        .filter((record) => validateName(record?.player_name).valid && normalizeScore(record?.score) !== null)
        .map((record) => ({ name: validateName(record.player_name).name, score: normalizeScore(record.score), createdAt: record.created_at || '' }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    },
    async submit(nameValue, scoreValue) {
      const checkedName = validateName(nameValue);
      if (!checkedName.valid) throw new LeaderboardError(checkedName.error, 'validation');
      const score = normalizeScore(scoreValue);
      if (score === null) throw new LeaderboardError('That score is not a valid transmission.', 'validation');
      const response = await request('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ candidate_id: CANDIDATE_ID, player_name: checkedName.name, score })
      });
      const records = await response.json();
      const record = Array.isArray(records) ? records[0] : records;
      return {
        name: validateName(record?.player_name || checkedName.name).name,
        score: normalizeScore(record?.score) ?? score,
        createdAt: record?.created_at || ''
      };
    }
  };
}
