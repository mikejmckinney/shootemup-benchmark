import test from "node:test";
import assert from "node:assert/strict";
import { fetchLeaderboard, submitLeaderboardScore } from "../supabase-client.js";

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test("leaderboard client maps the worker schema and sends only public fields", async () => {
  let request;
  const rows = await fetchLeaderboard(async (url, options) => {
    request = { url, options };
    return response([{ id: 1, player_name: "NOVA", score: 900, created_at: "2026-08-05T00:00:00Z" }]);
  });
  assert.equal(rows[0].name, "NOVA");
  assert.match(request.url, /player_name/);
  assert.match(request.url, /candidate_id=eq\.a2a_async/);
  assert.equal(request.options.headers.Authorization.startsWith("Bearer "), true);

  let posted;
  await submitLeaderboardScore(" Pilot-7 ", 120, async (_url, options) => {
    posted = JSON.parse(options.body);
    return response([{ id: 2 }]);
  });
  assert.deepEqual(posted, { candidate_id: "a2a_async", player_name: "Pilot-7", score: 120 });
});

test("invalid names and scores fail before network access", async () => {
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return response([]); };
  await assert.rejects(() => submitLeaderboardScore("Pilot\n", 10, fakeFetch), /control/i);
  await assert.rejects(() => submitLeaderboardScore("Pilot", 100000001, fakeFetch), /valid|score/i);
  assert.equal(calls, 0);
});
