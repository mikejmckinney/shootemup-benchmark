#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const token = process.env.SUPABASE_API_KEY;
const projectRef = "lyyyxbxacrxqflxmtlqq";
const migration = "supabase/migrations/20260807210458_allow_benchmark_batch_20260807.sql";
const treatments = [
  "monolith_sol_low_fast_opencode",
  "monolith_sol_medium_fast_opencode",
  "monolith_grok_4_5_medium_cursor",
  "monolith_grok_4_5_high_cursor",
  "monolith_grok_4_5_medium_fast_cursor",
  "monolith_grok_4_5_high_fast_cursor",
  "monolith_auto_cursor",
];

if (!token) throw new Error("SUPABASE_API_KEY is required");

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Supabase query failed (${response.status}): ${await response.text()}`);
  return response.json();
}

for (const treatment of treatments) {
  const evidenceDir = path.join(root, "results/evidence", treatment);
  const sharedEvidenceDir = path.join(evidenceDir, "shared-gallery");
  const automated = JSON.parse(await fs.readFile(path.join(sharedEvidenceDir, "automated.json"), "utf8"));
  const result = JSON.parse(await fs.readFile(path.join(root, "submissions", treatment, "benchmark-result.json"), "utf8"));
  const testName = automated.checks.leaderboard_ui_submission.evidence.testName;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(testName)) throw new Error(`unsafe evaluator test name for ${treatment}`);

  const escapedTreatment = treatment.replaceAll("'", "''");
  const escapedName = testName.replaceAll("'", "''");
  const removed = await query(
    `delete from public.leaderboard where candidate_id = '${escapedTreatment}' and player_name = '${escapedName}' returning candidate_id`,
  );
  const remaining = await query(
    `select count(*)::int as count from public.leaderboard where candidate_id = '${escapedTreatment}' and player_name = '${escapedName}'`,
  );
  if (remaining[0]?.count !== 0) throw new Error(`verification row remains for ${treatment}`);

  const requests = automated.checks.leaderboard_ui_submission.evidence.requests;
  const artifact = {
    classification: "post-benchmark shared-gallery infrastructure retrofit",
    verified_at: new Date().toISOString(),
    timed_score_affected: false,
    migration,
    shared_project_ref: projectRef,
    candidate_id: treatment,
    gallery_url: result.cloudflare_url,
    verification: {
      automated_points: automated.automated_points,
      automated_points_available: automated.automated_points_available,
      production_http_status: automated.checks.live_cloudflare_app.evidence.http_status,
      ui_submission_persisted_after_reload: automated.checks.leaderboard_reload_persistence.evidence.persisted,
      get_partition_filter_observed: requests.some(request => request.method === "GET" && request.url.includes(`candidate_id=eq.${treatment}`)),
      post_candidate_id_observed: requests.some(request => request.method === "POST" && request.status === 201),
      browser_console_errors: automated.checks.browser_error_free.evidence.console_errors,
      browser_page_errors: automated.checks.browser_error_free.evidence.page_errors,
      shared_get_http_status: requests.find(request => request.method === "GET")?.status ?? null,
      shared_post_http_status: requests.find(request => request.method === "POST")?.status ?? null,
      verification_rows_removed: removed.length,
      verification_row_remaining: false,
    },
  };
  await fs.writeFile(path.join(evidenceDir, "shared-gallery-retrofit.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${treatment}: removed=${removed.length} automated=${automated.automated_points}`);
}
