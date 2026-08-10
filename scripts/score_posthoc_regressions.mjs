import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const plannedTreatments = [
  "monolith",
  "native_dynamic",
  "native_isolated",
  "a2a",
  "monolith_warm",
  "a2a_async",
  "a2a_async_streaming_opencode",
  "monolith_sol_medium",
  "monolith_opencode",
  "monolith_sol_medium_opencode",
  "monolith_sol_medium_opencode_api",
  "monolith_sol_low_opencode",
  "monolith_sol_high_opencode",
  "monolith_luna_xhigh_opencode",
  "monolith_luna_high_opencode",
  "monolith_luna_max_codex_minimal",
  "monolith_luna_max_opencode_retest",
  "monolith_luna_max_opencode_speckit",
  "dynamic_luna_max_opencode_superpowers",
  "monolith_luna_xhigh_fast_opencode",
  "monolith_luna_max_fast_opencode",
  "monolith_sol_low_fast_opencode",
  "monolith_sol_medium_fast_opencode",
  "monolith_grok_4_5_medium_cursor",
  "monolith_grok_4_5_high_cursor",
  "monolith_grok_4_5_medium_fast_cursor",
  "monolith_grok_4_5_high_fast_cursor",
  "monolith_auto_cursor",
  "monolith_luna_xhigh_opencode_control",
  "monolith_luna_max_opencode_ai_repo_template",
  "monolith_opus_5_medium_claude_code",
  "monolith_sonnet_5_medium_claude_code",
  "monolith_opus_5_medium_opencode",
  "monolith_sonnet_5_medium_opencode",
  "monolith_opus_5_medium_opencode_oauth",
];
const requestedTreatments = process.argv.slice(2);
const treatments = requestedTreatments.length
  ? requestedTreatments
  : plannedTreatments.filter(treatment => fs.existsSync(path.join(root, "results", "evidence", treatment, "posthoc-regressions.json")));
for (const treatment of treatments) {
  if (!plannedTreatments.includes(treatment)) throw new Error(`Unknown treatment: ${treatment}`);
}
const weights = {
  physical_name_entry: 2,
  progression_start_consistency: 1,
  advertised_keyboard_restart: 1,
  immediate_click_restart: 2,
};

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const deductionsFor = report => Object.entries(weights).reduce((total, [check, weight]) => {
  const result = report.checks[check];
  if (!result) throw new Error(`${report.treatment} is missing ${check}`);
  if (result.applicable === false) return total;
  return total + (result.passed ? 0 : weight);
}, 0);

const reports = Object.fromEntries(treatments.map(treatment => [
  treatment,
  read(path.join(root, "results", "evidence", treatment, "posthoc-regressions.json")),
]));
const baselineOriginal = read(path.join(root, "results", "evidence", "monolith", "automated.json")).automated_points
  + read(path.join(root, "results", "evidence", "monolith", "manual-score.json")).manual_points;
const baselineReport = reports.monolith
  ?? read(path.join(root, "results", "evidence", "monolith", "posthoc-regressions.json"));
const correctedBaselineScore = baselineOriginal - deductionsFor(baselineReport);

const rows = treatments.map(treatment => {
  const report = reports[treatment];
  const automated = read(path.join(root, "results", "evidence", treatment, "automated.json"));
  const manual = read(path.join(root, "results", "evidence", treatment, "manual-score.json"));
  const originalScore = automated.automated_points + manual.manual_points;
  const absoluteDeductions = deductionsFor(report);
  const posthocAdjustment = -absoluteDeductions;
  const correctedScore = originalScore + posthocAdjustment;
  const scorePath = path.join(root, "results", "evidence", treatment, "posthoc-score.json");
  const previousScoredAt = fs.existsSync(scorePath) ? read(scorePath).scored_at : null;
  const artifact = {
    treatment,
    scored_at: previousScoredAt ?? new Date().toISOString(),
    original_quality_score: originalScore,
    absolute_supplemental_deductions: absoluteDeductions,
    posthoc_adjustment: posthocAdjustment,
    corrected_quality_score: correctedScore,
    corrected_score_relative_to_baseline: correctedScore - correctedBaselineScore,
    weights,
    checks: report.checks,
    rationale: "The corrected quality score applies the candidate's absolute supplemental deductions directly. The monolith remains the comparison baseline, but its score is not normalized back to 100 and 100 is not a ceiling.",
  };
  fs.writeFileSync(scorePath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
});

const table = rows.map(row =>
  `| ${row.treatment} | ${row.original_quality_score} | ${row.absolute_supplemental_deductions} | ${row.posthoc_adjustment} | ${row.corrected_quality_score} | ${row.corrected_score_relative_to_baseline > 0 ? "+" : ""}${row.corrected_score_relative_to_baseline} |`
).join("\n");
const review = `# Post-hoc regression review

This supplemental review covers all ${treatments.length} preserved candidates. Browser checks ran against every timed-run deployment; non-deploying timed candidates received explicit not-applicable records because the affected categories had already scored zero. Supabase REST calls were fulfilled inside the browser, so the audit wrote no leaderboard rows and did not modify candidate source or deployments.

## Checks and weights

The checks refine already-scored categories rather than add new categories:

| Check | Existing rubric allocation | Failure treatment |
|---|---:|---|
| Physical entry of \`WASD wasd\` in the callsign field | 2 of 6 leaderboard UI-submission points | Partial failure: submission remains possible with a restricted callsign |
| Progression indicator changes by no more than one immediately after launch | 1 of 2 HUD-state points | Partial failure: HUD exists but its initial state is inconsistent |
| An advertised \`R\` restart shortcut works immediately after submission | 1 of 2 restart points | Partial failure: primary click/touch restart is tested separately |
| A visible click/touch restart works immediately after submission | 2 restart points | Complete restart-path failure |

The original monolith remains the comparison baseline, but its discovered defects reduce its corrected score from 100 to 98. Scores are not normalized back to 100, and 100 is not a ceiling:

\`corrected score = original score - candidate deductions\`

## Corrected scores

| Candidate | Original score | Absolute deductions | Post-hoc adjustment | Corrected score | Δ corrected baseline |
|---|---:|---:|---:|---:|---:|
${table}

Original automated and manual evidence is retained unchanged. Per-candidate browser evidence is in \`results/evidence/<candidate>/posthoc-regressions.json\`; the derived adjustment is in \`posthoc-score.json\`.
`;
fs.writeFileSync(path.join(root, "results", "posthoc-review.md"), review);
console.log(review);
