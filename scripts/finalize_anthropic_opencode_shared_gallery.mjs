#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const token = process.env.SUPABASE_API_KEY;
const projectRef = "lyyyxbxacrxqflxmtlqq";
const sharedUrl = `https://${projectRef}.supabase.co`;
const migrations = {
  monolith_opus_5_medium_opencode: "supabase/migrations/20260810175132_allow_anthropic_opencode_candidates.sql",
  monolith_sonnet_5_medium_opencode: "supabase/migrations/20260810175132_allow_anthropic_opencode_candidates.sql",
  monolith_opus_5_medium_opencode_oauth: "supabase/migrations/20260810193000_allow_opus_opencode_oauth.sql",
};
const allTreatments = [
  "monolith_opus_5_medium_opencode",
  "monolith_sonnet_5_medium_opencode",
  "monolith_opus_5_medium_opencode_oauth",
];
const requestedTreatments = process.argv.slice(2);
const treatments = requestedTreatments.length ? requestedTreatments : allTreatments;
for (const treatment of treatments) {
  if (!allTreatments.includes(treatment)) throw new Error(`unsupported treatment: ${treatment}`);
}

if (!token) throw new Error("SUPABASE_API_KEY is required");

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Supabase query failed (${response.status})`);
  return response.json();
}

const keyResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!keyResponse.ok) throw new Error(`Supabase key lookup failed (${keyResponse.status})`);
const publishableKey = (await keyResponse.json()).find(key => key.type === "publishable")?.api_key;
if (!publishableKey) throw new Error("shared publishable key was not found");

const restHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  "Content-Type": "application/json",
};
const invalidResponse = await fetch(`${sharedUrl}/rest/v1/leaderboard`, {
  method: "POST",
  headers: { ...restHeaders, Prefer: "return=minimal" },
  body: JSON.stringify({ candidate_id: "__invalid_benchmark_candidate__", player_name: "VERIFY", score: 1 }),
});
if (invalidResponse.ok) throw new Error("shared leaderboard accepted an invalid candidate id");

for (const treatment of treatments) {
  const evidenceDir = path.join(root, "results/evidence", treatment);
  const automated = JSON.parse(await fs.readFile(path.join(evidenceDir, "shared-gallery/automated.json"), "utf8"));
  const result = JSON.parse(await fs.readFile(path.join(root, "submissions", treatment, "benchmark-result.json"), "utf8"));
  const testName = automated.checks.leaderboard_ui_submission.evidence.testName;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(testName)) throw new Error(`unsafe evaluator test name for ${treatment}`);

  const escapedTreatment = treatment.replaceAll("'", "''");
  const escapedName = testName.replaceAll("'", "''");
  const persisted = await query(
    `select count(*)::int as count from public.leaderboard where candidate_id = '${escapedTreatment}' and player_name = '${escapedName}'`,
  );
  const getResponse = await fetch(
    `${sharedUrl}/rest/v1/leaderboard?select=player_name,score&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    { headers: restHeaders },
  );
  if (!getResponse.ok) throw new Error(`shared GET failed for ${treatment}: ${getResponse.status}`);

  const removed = await query(
    `delete from public.leaderboard where candidate_id = '${escapedTreatment}' and player_name = '${escapedName}' returning candidate_id`,
  );
  const remaining = await query(
    `select count(*)::int as count from public.leaderboard where candidate_id = '${escapedTreatment}' and player_name = '${escapedName}'`,
  );
  if (persisted[0]?.count !== 1 || removed.length !== 1 || remaining[0]?.count !== 0) {
    throw new Error(`shared verification-row lifecycle failed for ${treatment}`);
  }

  const artifact = {
    classification: "post-benchmark shared-gallery infrastructure retrofit",
    verified_at: new Date().toISOString(),
    timed_score_affected: false,
    migration: migrations[treatment],
    shared_project_ref: projectRef,
    candidate_id: treatment,
    gallery_url: result.cloudflare_url,
    verification: {
      production_http_status: automated.checks.live_cloudflare_app.evidence.http_status,
      shared_row_persisted: true,
      shared_partition_get_http_status: getResponse.status,
      invalid_candidate_post_rejected_http_status: invalidResponse.status,
      browser_console_errors: automated.checks.browser_error_free.evidence.console_errors,
      browser_page_errors: automated.checks.browser_error_free.evidence.page_errors,
      verification_rows_removed: removed.length,
      verification_row_remaining: false,
    },
  };
  await fs.writeFile(path.join(evidenceDir, "shared-gallery-retrofit.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${treatment}: persisted=1 removed=1 GET=${getResponse.status}`);
}
