import test from "node:test";
import assert from "node:assert/strict";
import {
  LeaderboardError,
  createLeaderboardClient,
  validatePlayerName,
  validateScore,
} from "../src/leaderboard.js";

test("player name validation mirrors the public leaderboard constraints", () => {
  assert.equal(validatePlayerName("  Nova-09  ").value, "Nova-09");
  assert.equal(validatePlayerName("Pilot 7").valid, true);
  assert.equal(validatePlayerName("").valid, false);
  assert.equal(validatePlayerName("12345678901234567").valid, false);
  assert.equal(validatePlayerName("<script>").valid, false);
  assert.equal(validateScore(0).valid, true);
  assert.equal(validateScore(2000000001).valid, false);
  assert.equal(validateScore(9.2).valid, false);
});

test("unconfigured client fails safely without pretending the board is live", async () => {
  const client = createLeaderboardClient({});
  assert.equal(client.enabled, false);
  await assert.rejects(client.list(), (error) => {
    assert.ok(error instanceof LeaderboardError);
    assert.equal(error.kind, "configuration");
    return true;
  });
});

test("REST client sends only the public key and returns sorted rows", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") return { ok: true, json: async () => ({}) };
    return {
      ok: true,
      json: async () => [
        { id: "2", name: "Nova", score: 80, created_at: "2026-01-02" },
        { id: "1", name: "Ace", score: 120, created_at: "2026-01-01" },
      ],
    };
  };
  const client = createLeaderboardClient({
    supabaseUrl: "https://demo.supabase.co/",
    supabaseAnonKey: "public-anon-key",
    fetchImpl,
  });

  const rows = await client.list();
  await client.submit("Ace", 120);
  assert.equal(rows[0].name, "Nova");
  assert.equal(calls[0].url, "https://demo.supabase.co/rest/v1/leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10");
  assert.equal(calls[0].options.headers.apikey, "public-anon-key");
  assert.equal(calls[0].options.headers.Authorization, "Bearer public-anon-key");
  assert.equal(calls[1].options.headers.Prefer, "return=minimal");
  assert.match(calls[1].options.body, /"name":"Ace"/);
  assert.doesNotMatch(JSON.stringify(calls), /service_role|secret/);
});

test("client can adapt to the coordinator's player_name column", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => [{ id: 1, player_name: "Relay", score: 40 }] };
  };
  const client = createLeaderboardClient({
    supabaseUrl: "https://demo.supabase.co",
    supabaseAnonKey: "public-anon-key",
    leaderboardNameColumn: "player_name",
    fetchImpl,
  });
  const rows = await client.list();
  await client.submit("Relay", 40);
  assert.equal(rows[0].name, "Relay");
  assert.match(calls[0].url, /select=id,player_name,score,created_at/);
  assert.match(calls[1].options.body, /"player_name":"Relay"/);
});
