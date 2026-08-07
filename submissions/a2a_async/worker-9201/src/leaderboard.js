const MAX_SCORE = 2_000_000_000;

export class LeaderboardError extends Error {
  constructor(message, kind = "network") {
    super(message);
    this.name = "LeaderboardError";
    this.kind = kind;
  }
}

export function validatePlayerName(value) {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > 16) {
    return { valid: false, value: name, message: "Enter a name from 1 to 16 characters." };
  }
  // Keep names readable in a public board and make the database check agree.
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) {
    return { valid: false, value: name, message: "Use letters, numbers, spaces, or . _ - '." };
  }
  return { valid: true, value: name, message: "" };
}

export function validateScore(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SCORE) {
    return {
      valid: false,
      message: "Score must be a plausible non-negative integer.",
    };
  }
  return { valid: true, message: "" };
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return "";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeRow(row) {
  return {
    id: row?.id ?? null,
    name: String(row?.name ?? row?.player_name ?? "PLAYER").slice(0, 16),
    score: Number.isSafeInteger(Number(row?.score)) ? Number(row.score) : 0,
    created_at: row?.created_at ?? null,
  };
}

function makeHeaders(key, json = false) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export function createLeaderboardClient({
  supabaseUrl = "",
  supabaseAnonKey = "",
  leaderboardNameColumn = "name",
  fetchImpl = globalThis.fetch,
} = {}) {
  const baseUrl = normalizeBaseUrl(supabaseUrl);
  const key = String(supabaseAnonKey || "").trim();
  const nameColumn = leaderboardNameColumn === "player_name" ? "player_name" : "name";
  const enabled = Boolean(baseUrl && key && typeof fetchImpl === "function");

  async function request(path, options = {}) {
    if (!enabled) {
      throw new LeaderboardError("Leaderboard is not connected in this build.", "configuration");
    }

    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
          ...makeHeaders(key, Boolean(options.body)),
          ...(options.headers || {}),
        },
      });
    } catch {
      throw new LeaderboardError("Could not reach the leaderboard. You can keep playing offline.", "network");
    }

    if (!response.ok) {
      let detail = "The leaderboard is temporarily unavailable.";
      try {
        const payload = await response.json();
        if (payload?.message && typeof payload.message === "string") detail = payload.message;
      } catch {
        // A non-JSON proxy error is still safe to present as a generic network error.
      }
      throw new LeaderboardError(detail, response.status >= 400 && response.status < 500 ? "request" : "network");
    }
    return response;
  }

  return {
    enabled,
    async list() {
      const response = await request(
        `leaderboard?select=id,${nameColumn},score,created_at&order=score.desc,created_at.asc&limit=10`,
      );
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new LeaderboardError("The leaderboard returned an unreadable response.", "network");
      }
      if (!Array.isArray(payload)) {
        throw new LeaderboardError("The leaderboard returned an invalid response.", "network");
      }
      return payload.map(normalizeRow).slice(0, 10);
    },
    async submit(nameValue, scoreValue) {
      const nameResult = validatePlayerName(nameValue);
      if (!nameResult.valid) throw new LeaderboardError(nameResult.message, "validation");
      const scoreResult = validateScore(scoreValue);
      if (!scoreResult.valid) throw new LeaderboardError(scoreResult.message, "validation");

      await request("leaderboard", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ [nameColumn]: nameResult.value, score: scoreValue }),
      });
      return { name: nameResult.value, score: scoreValue };
    },
  };
}
