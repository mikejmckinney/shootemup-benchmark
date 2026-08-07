import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const plannedTreatments = ["monolith", "native_dynamic", "native_isolated", "a2a", "monolith_warm", "a2a_async", "a2a_async_streaming_opencode", "monolith_sol_medium", "monolith_opencode", "monolith_sol_medium_opencode", "monolith_sol_low_opencode", "monolith_sol_high_opencode", "monolith_luna_xhigh_opencode", "monolith_luna_high_opencode", "monolith_luna_max_codex_minimal", "monolith_luna_max_opencode_retest", "monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers"];
const treatmentArtifactsExist = treatment => [
  path.join(root, "results/raw", treatment, "run-metrics.json"),
  path.join(root, "results/raw", treatment, "cleanup.json"),
  path.join(root, "results/evidence", treatment, "automated.json"),
  path.join(root, "results/evidence", treatment, "manual-score.json"),
  path.join(root, "results/evidence", treatment, "posthoc-score.json"),
].every(file => fs.existsSync(file));
const treatments = plannedTreatments.filter(treatmentArtifactsExist);
const labels = {
  monolith: "Monolith (cold)", native_dynamic: "Native dynamic", native_isolated: "Native isolated",
  a2a: "A2A synchronous", monolith_warm: "Monolith warm-cache", a2a_async: "A2A asynchronous",
  a2a_async_streaming_opencode: "A2A async streaming OpenCode",
  monolith_sol_medium: "Monolith Sol Medium", monolith_opencode: "Monolith OpenCode",
  monolith_sol_medium_opencode: "Monolith Sol Medium OpenCode",
  monolith_sol_low_opencode: "Monolith Sol Low OpenCode",
  monolith_sol_high_opencode: "Monolith Sol High OpenCode",
  monolith_luna_xhigh_opencode: "Monolith Luna Xhigh OpenCode",
  monolith_luna_high_opencode: "Monolith Luna High OpenCode",
  monolith_luna_max_codex_minimal: "Monolith Luna Max Codex Minimal Context",
  monolith_luna_max_opencode_retest: "Monolith Luna Max OpenCode Fresh Control",
  monolith_luna_max_opencode_speckit: "Monolith Luna Max OpenCode + Spec Kit",
  dynamic_luna_max_opencode_superpowers: "Dynamic Luna Max OpenCode + Superpowers",
};
const pricing = {
  as_of: "2026-08-06",
  source: "https://developers.openai.com/api/docs/pricing",
  service_tier: "standard",
  models: {
    "gpt-5.6-luna": { uncached_input: 0.2, cached_input: 0.02, cache_write: 0.25, output: 1.2 },
    "gpt-5.6-sol": { uncached_input: 5, cached_input: 0.5, cache_write: 6.25, output: 30 },
  },
  web_search_usd_per_call: 0.01,
  long_context_threshold_input_tokens: 272000,
  captured_web_search_calls: {
    monolith: 3, native_dynamic: 1, native_isolated: 4, a2a: 5,
    monolith_warm: 0, a2a_async: 2, a2a_async_streaming_opencode: 0, monolith_sol_medium: 3, monolith_opencode: 0,
    monolith_sol_medium_opencode: 0,
    monolith_sol_low_opencode: 0, monolith_luna_xhigh_opencode: 0,
    monolith_sol_high_opencode: 0,
    monolith_luna_high_opencode: 0,
    monolith_luna_max_codex_minimal: 0,
    monolith_luna_max_opencode_retest: 0,
    monolith_luna_max_opencode_speckit: 0,
    dynamic_luna_max_opencode_superpowers: 0,
  },
};
const qualityGateCenter = 90;
const primaryQualityTolerance = 2;
const qualityToleranceScenarios = [0, primaryQualityTolerance, 3];
const qualityGatePassMinimum = qualityGateCenter + primaryQualityTolerance;
const qualityGateBorderlineMinimum = qualityGateCenter - primaryQualityTolerance;
const qualityGateFloor = qualityGateBorderlineMinimum - 1;
const qualityGateRampWidth = qualityGatePassMinimum - qualityGateFloor;
const qualityGateStatus = score => score >= qualityGatePassMinimum
  ? "PASS"
  : score >= qualityGateBorderlineMinimum
    ? "BORDERLINE"
    : "FAIL";
const gateQualityFactor = score => Math.max(0, Math.min(1, (score - qualityGateFloor) / qualityGateRampWidth));
const fixedTimeValueScenariosUsdPerHour = [0, 3, 10, 25, 60];

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const rows = treatments.map(treatment => {
  const metrics = read(path.join(root, "results/raw", treatment, "run-metrics.json"));
  const automated = read(path.join(root, "results/evidence", treatment, "automated.json"));
  const manual = read(path.join(root, "results/evidence", treatment, "manual-score.json"));
  const posthoc = read(path.join(root, "results/evidence", treatment, "posthoc-score.json"));
  const cleanup = read(path.join(root, "results/raw", treatment, "cleanup.json"));
  const rates = pricing.models[metrics.model];
  if (!rates) throw new Error(`No pricing configured for ${metrics.model}`);
  const totalTokens = metrics.usage.input_tokens + metrics.usage.output_tokens;
  const uncachedInputTokens = metrics.usage.input_tokens - metrics.usage.cached_input_tokens;
  const nonCachedTokens = uncachedInputTokens + metrics.usage.output_tokens;
  const originalQuality = automated.automated_points + manual.manual_points;
  if (posthoc.original_quality_score !== originalQuality) throw new Error(`Post-hoc original score mismatch for ${treatment}`);
  const quality = posthoc.corrected_quality_score;
  const tokenCost = (
    uncachedInputTokens * rates.uncached_input +
    metrics.usage.cached_input_tokens * rates.cached_input +
    (metrics.usage.cache_write_input_tokens ?? 0) * rates.cache_write +
    metrics.usage.output_tokens * rates.output
  ) / 1_000_000;
  const webSearchCalls = pricing.captured_web_search_calls[treatment] ?? 0;
  const apiCost = tokenCost + webSearchCalls * pricing.web_search_usd_per_call;
  const wallMinutes = metrics.wall_seconds / 60;
  const squareRootRoi = quality / Math.sqrt(apiCost * wallMinutes);
  const qualityFactor = gateQualityFactor(quality);
  return {
    treatment, label: labels[treatment], model: metrics.model,
    reasoning_effort: metrics.reasoning_effort, runtime: metrics.runtime ?? "codex",
    quality_score: quality, original_quality_score: originalQuality,
    posthoc_adjustment: posthoc.posthoc_adjustment,
    automated_points: automated.automated_points, manual_points: manual.manual_points,
    wall_seconds: metrics.wall_seconds, wall_minutes: wallMinutes,
    total_tokens: totalTokens, uncached_input_tokens: uncachedInputTokens,
    non_cached_tokens: nonCachedTokens, cached_input_tokens: metrics.usage.cached_input_tokens,
    output_tokens: metrics.usage.output_tokens, reasoning_output_tokens: metrics.usage.reasoning_output_tokens,
    agents_started: metrics.agents_started ?? 1,
    coordination_events: metrics.a2a_messages ?? metrics.native_coordination_calls ?? 0,
    successful_a2a_messages: metrics.a2a_messages_succeeded ?? null,
    failed_a2a_messages: metrics.a2a_messages_failed ?? null,
    captured_web_search_calls: webSearchCalls,
    estimated_api_cost_usd: apiCost,
    api_cost_breakdown_usd: { model_tokens: tokenCost, web_search: webSearchCalls * pricing.web_search_usd_per_call },
    token_efficiency: quality / (totalTokens / 1_000_000),
    non_cached_token_efficiency: quality / (nonCachedTokens / 1_000_000),
    time_efficiency: quality / (metrics.wall_seconds / 3600),
    cost_efficiency: quality / apiCost,
    cost_per_quality_point_usd: apiCost / quality,
    square_root_roi: squareRootRoi,
    gate_quality_factor: qualityFactor,
    gate_adjusted_roi: squareRootRoi * qualityFactor,
    quality_gate: qualityGateStatus(quality),
    quality_gate_passed: qualityGateStatus(quality) === "PASS",
    cleanup_confirmed: cleanup.confirmed_inactive === true,
  };
});

const baseline = rows.find(row => row.treatment === "monolith");
const warmCacheBaseline = rows.find(row => row.treatment === "monolith_warm");
const methodologyControl = rows.find(row => row.treatment === "monolith_luna_max_opencode_retest");
const asyncA2aComparator = rows.find(row => row.treatment === "a2a_async");
const solMediumOpenCodeComparator = rows.find(row => row.treatment === "monolith_sol_medium_opencode");
const continuationDefinitions = [
  {
    treatment: "monolith_luna_max_opencode_speckit",
    label: "Monolith Luna Max OpenCode + Spec Kit",
    score_file: path.join(root, "results/continuations/monolith_luna_max_opencode_speckit/attempt-1/score.json"),
    cleanup_file: path.join(root, "results/continuations/monolith_luna_max_opencode_speckit/attempt-1/cleanup.json"),
    live_url: "https://shootemup-bench-monolith-luna-max-opencode-speckit-pages.pages.dev",
    source_path: "submissions/monolith_luna_max_opencode_speckit_continued/",
    evidence_path: "results/continuations/monolith_luna_max_opencode_speckit/attempt-1/evidence/",
    outcome: "Completed after one additional 42:57 continuation.",
  },
  {
    treatment: "dynamic_luna_max_opencode_superpowers",
    label: "Dynamic Luna Max OpenCode + Superpowers",
    score_file: path.join(root, "results/continuations/dynamic_luna_max_opencode_superpowers/completed/score.json"),
    cleanup_file: path.join(root, "results/continuations/dynamic_luna_max_opencode_superpowers/completed/cleanup.json"),
    live_url: "https://shootemup-bench-dynamic-luna-max-opencode-superpowers-avwr.pages.dev/",
    source_path: "submissions/dynamic_luna_max_opencode_superpowers_continued/",
    evidence_path: "results/continuations/dynamic_luna_max_opencode_superpowers/completed/evidence/",
    outcome: "Stopped by the user; the last clean deployed commit was graded and the parent integration remained unfinished.",
  },
];
const continuationRows = continuationDefinitions
  .filter(definition => fs.existsSync(definition.score_file))
  .map(definition => {
    const { score_file: scoreFile, cleanup_file: cleanupFile, ...retainedDefinition } = definition;
    const score = read(scoreFile);
    const cleanup = read(cleanupFile);
    const cumulative = score.cumulative;
    const quality = score.corrected_score;
    const control = methodologyControl;
    const qualityFactor = gateQualityFactor(quality);
    const calculatedRoi = quality * qualityFactor / Math.sqrt(cumulative.estimated_api_cost_usd * cumulative.elapsed_minutes);
    if (quality !== score.automated_points + score.manual_points - score.posthoc_deductions.total) {
      throw new Error(`Continuation score mismatch for ${definition.treatment}`);
    }
    if (Math.abs(calculatedRoi - cumulative.gate_adjusted_roi) > 1e-9) {
      throw new Error(`Continuation ROI mismatch for ${definition.treatment}`);
    }
    return {
      ...retainedDefinition,
      quality_score: quality,
      automated_points: score.automated_points,
      manual_points: score.manual_points,
      pre_regression_score: score.pre_regression_score,
      posthoc_adjustment: -score.posthoc_deductions.total,
      quality_gate: qualityGateStatus(quality),
      gate_quality_factor: qualityFactor,
      estimated_api_cost_usd: cumulative.estimated_api_cost_usd,
      wall_seconds: cumulative.elapsed_seconds,
      wall_minutes: cumulative.elapsed_minutes,
      total_tokens: cumulative.total_tokens,
      gate_adjusted_roi: calculatedRoi,
      cleanup_confirmed: cleanup.confirmed_inactive === true,
      score_path: path.relative(root, scoreFile),
      cleanup_path: path.relative(root, cleanupFile),
      marginal_vs_control: {
        quality_score: quality - control.quality_score,
        estimated_api_cost_usd: cumulative.estimated_api_cost_usd - control.estimated_api_cost_usd,
        wall_seconds: cumulative.elapsed_seconds - control.wall_seconds,
        total_tokens: cumulative.total_tokens - control.total_tokens,
        gate_adjusted_roi: cumulative.gate_adjusted_roi - control.gate_adjusted_roi,
      },
    };
  });
const qualityEligibleRows = rows.filter(row => row.quality_gate_passed);
const toleranceKey = epsilon => `epsilon_${epsilon}`;
const dominatesAtTolerance = (other, row, epsilon) => (
  other !== row
  && other.quality_score >= row.quality_score - epsilon
  && other.estimated_api_cost_usd <= row.estimated_api_cost_usd
  && other.wall_seconds <= row.wall_seconds
  && (
    other.quality_score > row.quality_score + epsilon
    || other.estimated_api_cost_usd < row.estimated_api_cost_usd
    || other.wall_seconds < row.wall_seconds
  )
);
for (const row of rows) {
  const comparisonBaseline = row.treatment === "a2a_async_streaming_opencode" && asyncA2aComparator
    ? asyncA2aComparator
    : row.treatment === "monolith_sol_high_opencode" && solMediumOpenCodeComparator
      ? solMediumOpenCodeComparator
      : row.treatment === "monolith_luna_max_codex_minimal"
    ? warmCacheBaseline
    : ["monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers"].includes(row.treatment) && methodologyControl
      ? methodologyControl
      : baseline;
  row.marginal_vs_monolith = {
    quality_score: row.quality_score - baseline.quality_score,
    total_tokens: row.total_tokens - baseline.total_tokens,
    non_cached_tokens: row.non_cached_tokens - baseline.non_cached_tokens,
    wall_seconds: row.wall_seconds - baseline.wall_seconds,
    estimated_api_cost_usd: row.estimated_api_cost_usd - baseline.estimated_api_cost_usd,
  };
  row.marginal_vs_comparator = {
    comparator_treatment: comparisonBaseline.treatment,
    quality_score: row.quality_score - comparisonBaseline.quality_score,
    total_tokens: row.total_tokens - comparisonBaseline.total_tokens,
    non_cached_tokens: row.non_cached_tokens - comparisonBaseline.non_cached_tokens,
    wall_seconds: row.wall_seconds - comparisonBaseline.wall_seconds,
    estimated_api_cost_usd: row.estimated_api_cost_usd - comparisonBaseline.estimated_api_cost_usd,
    gate_adjusted_roi: row.gate_adjusted_roi - comparisonBaseline.gate_adjusted_roi,
  };
  row.dominated_by = row.quality_gate_passed ? qualityEligibleRows.filter(other => other !== row &&
    other.quality_score >= row.quality_score && other.estimated_api_cost_usd <= row.estimated_api_cost_usd && other.wall_seconds <= row.wall_seconds &&
    (other.quality_score > row.quality_score || other.estimated_api_cost_usd < row.estimated_api_cost_usd || other.wall_seconds < row.wall_seconds)
  ).map(other => other.treatment) : [];
  row.pareto_frontier = row.quality_gate_passed && row.dominated_by.length === 0;
  row.quality_tolerance = Object.fromEntries(qualityToleranceScenarios.map(epsilon => {
    const dominatedBy = row.quality_gate_passed
      ? qualityEligibleRows.filter(other => dominatesAtTolerance(other, row, epsilon)).map(other => other.treatment)
      : [];
    return [toleranceKey(epsilon), {
      epsilon,
      dominated_by: dominatedBy,
      pareto_frontier: row.quality_gate_passed && dominatedBy.length === 0,
    }];
  }));
}

const toleranceFrontiers = Object.fromEntries(qualityToleranceScenarios.map(epsilon => [
  toleranceKey(epsilon),
  rows.filter(row => row.quality_tolerance[toleranceKey(epsilon)].pareto_frontier).map(row => row.treatment),
]));
for (const row of rows) {
  row.strict_dominated_by = row.dominated_by;
  row.strict_pareto_frontier = row.pareto_frontier;
  const primaryToleranceResult = row.quality_tolerance[toleranceKey(primaryQualityTolerance)];
  row.dominated_by = primaryToleranceResult.dominated_by;
  row.pareto_frontier = primaryToleranceResult.pareto_frontier;
}

const lunaOpenCode = rows.find(row => row.treatment === "monolith_opencode");
const lunaXhighOpenCode = rows.find(row => row.treatment === "monolith_luna_xhigh_opencode");
const solOpenCode = rows.find(row => row.treatment === "monolith_sol_medium_opencode");
const solHighOpenCode = rows.find(row => row.treatment === "monolith_sol_high_opencode");
const asyncA2a = rows.find(row => row.treatment === "a2a_async");
const asyncStreamingOpenCode = rows.find(row => row.treatment === "a2a_async_streaming_opencode");
const minimalCodex = rows.find(row => row.treatment === "monolith_luna_max_codex_minimal");
const breakEvenUsdPerMinute = (first, second) => (
  first.quality_score * second.estimated_api_cost_usd
  - second.quality_score * first.estimated_api_cost_usd
) / (
  second.quality_score * first.wall_minutes
  - first.quality_score * second.wall_minutes
);
const lunaSolBreakEvenUsdPerMinute = breakEvenUsdPerMinute(lunaOpenCode, solOpenCode);
const lunaSolBreakEvenUsdPerHour = lunaSolBreakEvenUsdPerMinute * 60;
const lunaXhighSolBreakEvenUsdPerMinute = breakEvenUsdPerMinute(lunaXhighOpenCode, solOpenCode);
const lunaXhighSolBreakEvenUsdPerHour = lunaXhighSolBreakEvenUsdPerMinute * 60;
const timeValueScenarios = [
  ...fixedTimeValueScenariosUsdPerHour.slice(0, 3).map(usdPerHour => ({ key: `usd_per_hour_${String(usdPerHour).replace(".", "_")}`, usd_per_hour: usdPerHour })),
  { key: "luna_max_sol_medium_break_even", usd_per_hour: lunaSolBreakEvenUsdPerHour },
  { key: "luna_xhigh_sol_medium_break_even", usd_per_hour: lunaXhighSolBreakEvenUsdPerHour },
  ...fixedTimeValueScenariosUsdPerHour.slice(3).map(usdPerHour => ({ key: `usd_per_hour_${String(usdPerHour).replace(".", "_")}`, usd_per_hour: usdPerHour })),
].map(scenario => ({ ...scenario, usd_per_minute: scenario.usd_per_hour / 60 }));
for (const row of rows) {
  row.quality_adjusted_efficiency = Object.fromEntries(timeValueScenarios.map(scenario => [
    scenario.key,
    row.quality_score / (row.estimated_api_cost_usd + row.wall_minutes * scenario.usd_per_minute),
  ]));
}

const decisionRows = [...rows].sort((a, b) =>
  b.gate_adjusted_roi - a.gate_adjusted_roi
  || b.quality_score - a.quality_score
  || a.estimated_api_cost_usd - b.estimated_api_cost_usd
);
const best = key => rows.reduce((winner, row) => row[key] > winner[key] ? row : winner).treatment;
const scenarioWinners = Object.fromEntries(timeValueScenarios.map(scenario => {
  const eligible = rows.filter(row => row.quality_gate_passed);
  const maximum = Math.max(...eligible.map(row => row.quality_adjusted_efficiency[scenario.key]));
  const winners = eligible
    .filter(row => Math.abs(row.quality_adjusted_efficiency[scenario.key] - maximum) <= 1e-9)
    .map(row => row.treatment);
  return [scenario.key, { maximum, treatments: winners }];
}));
const summary = {
  generated_at: new Date().toISOString(), replicate_count_per_treatment: 1,
  models: [...new Set(rows.map(row => row.model))], pricing,
  decision_model: {
    quality_gate: {
      status_values: ["PASS", "BORDERLINE", "FAIL"],
      epsilon: primaryQualityTolerance,
      pass_minimum: qualityGatePassMinimum,
      borderline_minimum: qualityGateBorderlineMinimum,
      borderline_maximum: qualityGatePassMinimum - 1,
      fail_maximum: qualityGateBorderlineMinimum - 1,
      frontier_eligible_status: "PASS",
    },
    headline_roi: {
      name: "gate_adjusted_roi",
      formula: "quality_score * gate_quality_factor / sqrt(estimated_api_cost_usd * wall_minutes)",
      gate_quality_factor: `clamp((quality_score - ${qualityGateFloor}) / ${qualityGateRampWidth}, 0, 1)`,
      interpretation: "comparative index; higher is better; not conventional financial ROI",
    },
    pareto_dimensions: {
      quality_tolerance_epsilon: primaryQualityTolerance,
      maximize: ["quality_score"],
      minimize: ["estimated_api_cost_usd", "wall_minutes"],
    },
    quality_tolerance_frontiers: toleranceFrontiers,
    quality_tolerance_scenarios: qualityToleranceScenarios,
    time_value_scenarios: timeValueScenarios,
    luna_sol_break_even_usd_per_minute: lunaSolBreakEvenUsdPerMinute,
    luna_sol_break_even_usd_per_hour: lunaSolBreakEvenUsdPerHour,
    luna_xhigh_sol_break_even_usd_per_minute: lunaXhighSolBreakEvenUsdPerMinute,
    luna_xhigh_sol_break_even_usd_per_hour: lunaXhighSolBreakEvenUsdPerHour,
    primary_scenario_usd_per_hour: null,
    displayed_scenario_usd_per_hour: 3,
    ordering: "gate_adjusted_roi_desc_then_quality_desc_then_cost_asc",
  },
  comparisons: {
    minimal_context_vs_warm_cache: {
      candidate: "monolith_luna_max_codex_minimal",
      comparator: "monolith_warm",
      delta: rows.find(row => row.treatment === "monolith_luna_max_codex_minimal").marginal_vs_comparator,
    },
    methodology_vs_fresh_control: methodologyControl ? Object.fromEntries(
      ["monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers"]
        .map(treatment => rows.find(row => row.treatment === treatment))
        .filter(Boolean)
        .map(row => [row.treatment, row.marginal_vs_comparator])
    ) : {},
  },
  exploratory_continuations: {
    classification: "Post-timeout exploratory outcomes; excluded from primary ranking",
    comparator_treatment: methodologyControl?.treatment ?? null,
    rows: continuationRows,
  },
  rows: decisionRows,
  winners: {
    gate_adjusted_roi: best("gate_adjusted_roi"),
    quality: best("quality_score"), total_token_efficiency: best("token_efficiency"),
    non_cached_token_efficiency: best("non_cached_token_efficiency"),
    time_efficiency: best("time_efficiency"), cost_efficiency: best("cost_efficiency"),
    quality_adjusted_efficiency_by_scenario: scenarioWinners,
  },
};
fs.mkdirSync(path.join(root, "results"), { recursive: true });
fs.writeFileSync(path.join(root, "results/summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

const f = (value, digits = 2) => Number(value).toFixed(digits);
const mmss = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const duration = seconds => seconds >= 3600
  ? `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  : mmss(seconds);
const signedMmss = seconds => `${seconds > 0 ? "+" : seconds < 0 ? "-" : ""}${mmss(Math.abs(seconds))}`;
const signed = (value, digits = 0) => `${value > 0 ? "+" : ""}${f(value, digits)}`;
const displayedTimeValueScenario = timeValueScenarios.find(scenario => scenario.usd_per_hour === 3);
if (!displayedTimeValueScenario) throw new Error("Missing $3/hour displayed sensitivity scenario");
const table = decisionRows.map(row =>
  `| ${row.label} | ${row.quality_score} | ${row.quality_gate} | $${f(row.estimated_api_cost_usd, 4)} | ${mmss(row.wall_seconds)} | ${f(row.total_tokens / 1e6, 3)}M | ${f(row.cached_input_tokens / 1e6, 3)}M | ${f(row.uncached_input_tokens / 1e6, 3)}M | ${f(row.output_tokens / 1e6, 3)}M | ${f(row.gate_adjusted_roi, 4)} |`
).join("\n");
const scenarioLabel = scenario => scenario.key === "luna_max_sol_medium_break_even"
  ? `$${f(scenario.usd_per_hour, 2)}/h Max/Medium tie`
  : scenario.key === "luna_xhigh_sol_medium_break_even"
    ? `$${f(scenario.usd_per_hour, 2)}/h Xhigh/Medium tie`
    : `$${f(scenario.usd_per_hour, 0)}/h`;
const sensitivityRows = decisionRows;
const sensitivity = sensitivityRows.map(row =>
  `| ${row.label}${row.quality_gate_passed ? "" : " †"} | ${timeValueScenarios.map(scenario => f(row.quality_adjusted_efficiency[scenario.key], 2)).join(" | ")} |`
).join("\n");
const sensitivityHeader = `| Candidate | ${timeValueScenarios.map(scenarioLabel).join(" | ")} |\n|---|${timeValueScenarios.map(() => "---:").join("|")}|`;
const marginal = rows.filter(row => row !== baseline).map(row => {
  const d = row.marginal_vs_comparator;
  return `| ${row.label} | ${labels[d.comparator_treatment]} | ${signed(d.quality_score)} | ${signed(d.estimated_api_cost_usd, 4)} | ${signed(d.total_tokens / 1e6, 3)}M | ${signedMmss(d.wall_seconds)} |`;
}).join("\n");
const frontierLabels = decisionRows.filter(row => row.pareto_frontier).map(row => row.label);
const toleranceFrontierRows = qualityToleranceScenarios.map(epsilon => {
  const key = toleranceKey(epsilon);
  const frontier = toleranceFrontiers[key].map(treatment => labels[treatment]);
  const removed = toleranceFrontiers.epsilon_0
    .filter(treatment => !toleranceFrontiers[key].includes(treatment))
    .map(treatment => labels[treatment]);
  return `| ${epsilon} | ${frontier.join(", ")} | ${removed.length ? removed.join(", ") : "—"} |`;
}).join("\n");
const toleranceTable = `| Quality tolerance ε | Frontier among gate survivors | Drops from strict frontier |
|---:|---|---|
${toleranceFrontierRows}`;
const continuationTableRows = continuationRows.map(row =>
  `| ${row.label} | ${row.automated_points} + ${row.manual_points} ${row.posthoc_adjustment ? `− ${Math.abs(row.posthoc_adjustment)}` : ""} | **${row.quality_score}** | ${row.quality_gate} | $${f(row.estimated_api_cost_usd, 4)} | ${duration(row.wall_seconds)} | ${f(row.total_tokens / 1e6, 3)}M | ${f(row.gate_adjusted_roi, 4)} |`
).join("\n");
const continuationTable = `| Candidate | Score calculation | Score | Gate | Cumulative cost | Cumulative time | Cumulative tokens | Gate-adjusted ROI |
|---|---:|---:|---|---:|---:|---:|---:|
${continuationTableRows}`;
const specContinuation = continuationRows.find(row => row.treatment === "monolith_luna_max_opencode_speckit");
const superpowersContinuation = continuationRows.find(row => row.treatment === "dynamic_luna_max_opencode_superpowers");
const continuationComparison = row => `${f(row.wall_seconds / methodologyControl.wall_seconds, 1)}× the control's wall time, ${f(row.estimated_api_cost_usd / methodologyControl.estimated_api_cost_usd, 1)}× its estimated cost, and ${f(row.total_tokens / methodologyControl.total_tokens, 1)}× its tokens`;
const continuationSection = `## Exploratory completion after timeout

These rows answer **“what did the methodologies eventually produce?”** They are not replacements for the primary 45-minute rows and are excluded from the main ranking. They reused warm state over multiple continuation windows, and Superpowers was stopped by the user before its own workflow declared completion.

${continuationTable}

- **Spec Kit eventually delivered 91:** 52/54 automated + 41/46 manual − 2 post-hoc. It required ${continuationComparison(specContinuation)} and still scored three points below the fresh plain OpenCode control.
- **Superpowers stopped at 89:** 48/54 automated + 43/46 manual − 2 post-hoc. It required ${continuationComparison(superpowersContinuation)}, equivalent to **${f(superpowersContinuation.wall_seconds / 2700, 1)} full 45-minute candidate budgets**. The standardized evaluator could not move or fire with the keyboard, the immediate visible restart path failed, its handoff remained stale, and its parent branch never integrated the feature worktree. A later uncommitted fix wave is preserved but excluded from grading.
- The Superpowers deliverable therefore scored no better than Sol Low OpenCode's 89, which finished in 5:29, and scored below Sol Medium OpenCode's 94 at 8:30 and Luna Xhigh OpenCode's 95 at 12:02. Its partial quality-gate factor of ${f(superpowersContinuation.gate_quality_factor, 1)} drives exploratory gate-adjusted ROI down to ${f(superpowersContinuation.gate_adjusted_roi, 4)}.

[Play Spec Kit](${specContinuation.live_url}) · [Spec Kit continued source](../${specContinuation.source_path}) · [Spec Kit continuation evidence](../${specContinuation.evidence_path}) · [Spec Kit score](../${specContinuation.score_path})

[Play Superpowers](${superpowersContinuation.live_url}) · [Superpowers continued source](../${superpowersContinuation.source_path}) · [Superpowers continuation evidence](../${superpowersContinuation.evidence_path}) · [Superpowers score](../${superpowersContinuation.score_path})

Both dedicated continuation Supabase projects are confirmed inactive. Their frontends remain available, but their leaderboards require an owner-authorized database resume. This does not affect the retained evaluation evidence.
`;

const report = `# Shoot-'Em-Up agent architecture benchmark results

Generated from retained run, evaluator, judge, and cleanup JSON. There is one replicate per treatment, so these are controlled case-study results rather than population estimates.

## Result

Quality is an open-ended score using the original monolith as the comparison baseline. Its original score was 100; the uniform post-hoc review corrects it to **${baseline.quality_score}**. It is not a percentage and 100 is not a ceiling.

Scores include the uniform [post-hoc regression review](posthoc-review.md). Original automated and manual evidence remains unchanged; absolute post-hoc deductions are applied directly.

| Candidate | Score | Gate | Cost | Time | Total tokens | Cached input | Uncached input | Output | Gate-adjusted ROI |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
${table}

Gate-adjusted ROI uses \`score × clamp((score - 87) / 5, 0, 1) / sqrt(API cost × elapsed minutes)\`. The gate factor is 1 for PASS, 0.2–0.8 for BORDERLINE, and 0 for FAIL. It is a comparative index, not conventional financial ROI. Total tokens are cached input + uncached input + output. Reasoning tokens are included in output and are not counted twice. Rows are ranked by gate-adjusted ROI descending; Pareto analysis remains separate below.

- Highest observed quality: **${rows.reduce((a, b) => b.quality_score > a.quality_score ? b : a).label}**.
- Quality-gate borderline: **${rows.filter(row => row.quality_gate === "BORDERLINE").map(row => row.label).join(", ") || "none"}**.
- Quality-gate failures: **${rows.filter(row => row.quality_gate === "FAIL").map(row => row.label).join(", ") || "none"}**.
- Pareto frontier at ε=${primaryQualityTolerance}: **${frontierLabels.join(", ")}**.
- Highest gate-adjusted ROI: **${decisionRows[0].label} (${f(decisionRows[0].gate_adjusted_roi, 4)})**.

## Quality-tolerance frontier sensitivity

Strict Pareto dominance uses the observed scores exactly. The ε analysis treats a candidate up to ε points lower as no worse on quality, then applies cost/time dominance. It is a practical-equivalence sensitivity—not a confidence interval or proof that score differences are noise—and the relation need not be transitive.

${toleranceTable}

At ε=${primaryQualityTolerance}, A2A asynchronous is dominated because Luna Xhigh OpenCode is within one quality point while being ${f(rows.find(row => row.treatment === "a2a_async").estimated_api_cost_usd / lunaXhighOpenCode.estimated_api_cost_usd, 1)}× cheaper and exactly ${mmss(rows.find(row => row.treatment === "a2a_async").wall_seconds - lunaXhighOpenCode.wall_seconds)} faster. ε=${primaryQualityTolerance} is the headline frontier and ε=0 and ε=3 are reported as sensitivities; none was preregistered for these runs.

## Quality-adjusted efficiency sensitivity

PAYG-equivalent costs use [official Standard API rates](${pricing.source}) current on ${pricing.as_of}: Luna costs **$0.20/M uncached input, $0.02/M cached input, $0.25/M cache writes, and $1.20/M output**; Sol costs **$5.00/M, $0.50/M, $6.25/M, and $30.00/M**, respectively. Captured web searches add $0.01 each. Supabase and Cloudflare free-tier usage adds $0 marginal infrastructure cost.

For a stated value of unattended agent time \`r\` in USD per minute:

\`quality-adjusted efficiency(r) = quality score / (API cost + elapsed minutes × r)\`

${sensitivityHeader}
${sensitivity}

Rows retain the main table's gate-adjusted-ROI order; compare columns to see how the stated time value changes the result.

† Is BORDERLINE or FAIL and is not eligible to win a scenario. Values remain visible for diagnostic transparency.

Across the current quality-eligible frontier, Luna Xhigh OpenCode and Sol Medium OpenCode tie at **$${f(lunaXhighSolBreakEvenUsdPerMinute, 6)}/minute ($${f(lunaXhighSolBreakEvenUsdPerHour, 2)}/hour)**. Below that time value Luna Xhigh is preferred; above it Sol Medium is preferred. The earlier Luna Max/Sol Medium crossover remains **$${f(lunaSolBreakEvenUsdPerHour, 2)}/hour**.

This is a sensitivity analysis, not conventional financial ROI. API cost is a list-price estimate rather than an invoice; subscription, OAuth, contract, regional, service-tier, and tool billing can differ.

## Marginal utility versus designated comparator

The original cold monolith remains the architectural comparator for the original treatments. Minimal-context Codex instead uses warm-cache Codex to reduce dependency/tool-installation confounding. Spec Kit and Superpowers use the fresh contemporaneous Luna Max OpenCode control.

| Candidate | Comparator | Δ score | Δ cost | Δ total tokens | Δ wall time |
|---|---|---:|---:|---:|---:|
${marginal}

Negative cost/time values are savings; a negative score is a quality regression.

${continuationSection}

## Key observations

- The warm-cache monolith cut the cold monolith from 28:47 to 17:37; their corrected scores are 92 and 98, respectively.
- Asynchronous A2A has a corrected score of 96 with exactly two accepted tasks, polling to terminal success, stable idempotency keys, and no resubmissions. It improved over synchronous A2A's retry-heavy protocol, but is dominated on the headline ε=${primaryQualityTolerance} frontier.
- Asynchronous-streaming A2A in OpenCode also scored ${asyncStreamingOpenCode.quality_score}. It finished ${mmss(asyncA2a.wall_seconds - asyncStreamingOpenCode.wall_seconds)} faster, cost ${f((1 - asyncStreamingOpenCode.estimated_api_cost_usd / asyncA2a.estimated_api_cost_usd) * 100, 0)}% less, and used ${f((1 - asyncStreamingOpenCode.total_tokens / asyncA2a.total_tokens) * 100, 0)}% fewer tokens than asynchronous-polling A2A. Runtime changed from Codex to OpenCode, and retained resubscriptions yielded task snapshots rather than incremental status/artifact events, so this does not isolate or validate streaming's causal contribution.
- Sol Medium in Codex was the fastest Codex treatment at 12:17 and has a corrected score of 91; its higher per-token price partly offsets that speed.
- The original Luna Max and Sol Medium OpenCode runs have effectively tied observed quality. Luna is about 11× cheaper; Sol is 4:47 faster. Luna is preferred whenever unattended agent time is valued below $${f(lunaSolBreakEvenUsdPerHour, 2)}/hour.
- The requested reasoning-effort extension produced corrected scores of ${rows.find(row => row.treatment === "monolith_sol_low_opencode").quality_score} for Sol Low, ${rows.find(row => row.treatment === "monolith_luna_xhigh_opencode").quality_score} for Luna Xhigh, and ${rows.find(row => row.treatment === "monolith_luna_high_opencode").quality_score} for Luna High.
- Sol High OpenCode tied Sol Medium OpenCode at ${solHighOpenCode.quality_score}, but took ${mmss(solHighOpenCode.wall_seconds - solOpenCode.wall_seconds)} longer, cost ${f((solHighOpenCode.estimated_api_cost_usd / solOpenCode.estimated_api_cost_usd - 1) * 100, 0)}% more, used ${f((solHighOpenCode.total_tokens / solOpenCode.total_tokens - 1) * 100, 0)}% more tokens, and achieved lower gate-adjusted ROI (${f(solHighOpenCode.gate_adjusted_roi, 4)} vs ${f(solOpenCode.gate_adjusted_roi, 4)}).
- Sol OpenCode used about ${f(lunaOpenCode.total_tokens / solOpenCode.total_tokens, 1)}× fewer total tokens, but Sol's per-token Standard price is 25× Luna's, so its estimated run cost remained much higher.
- Sol Medium Codex reported ${f(rows.find(row => row.treatment === "monolith_sol_medium").total_tokens / solOpenCode.total_tokens, 1)}× as many total tokens as Sol Medium OpenCode. The local compiler is internally consistent, but provider-side reconciliation is required before treating this as a causal runtime-efficiency result.
- Against warm-cache Codex, Luna Max Codex Minimal Context scored ${signed(minimalCodex.quality_score - warmCacheBaseline.quality_score)}, cost ${f((1 - minimalCodex.estimated_api_cost_usd / warmCacheBaseline.estimated_api_cost_usd) * 100, 0)}% less, finished ${mmss(warmCacheBaseline.wall_seconds - minimalCodex.wall_seconds)} faster, used ${f((1 - minimalCodex.total_tokens / warmCacheBaseline.total_tokens) * 100, 0)}% fewer total tokens, and improved gate-adjusted ROI by ${f((minimalCodex.gate_adjusted_roi / warmCacheBaseline.gate_adjusted_roi - 1) * 100, 0)}%. This is the primary Codex comparison because both runs could reuse installed dependencies and tools.
- Luna Max OpenCode still leads Minimal Context: OpenCode cost ${f((1 - lunaOpenCode.estimated_api_cost_usd / minimalCodex.estimated_api_cost_usd) * 100, 0)}% less, finished ${mmss(minimalCodex.wall_seconds - lunaOpenCode.wall_seconds)} faster, used ${f((1 - lunaOpenCode.total_tokens / minimalCodex.total_tokens) * 100, 0)}% fewer total tokens, and achieved ${f((lunaOpenCode.gate_adjusted_roi / minimalCodex.gate_adjusted_roi - 1) * 100, 0)}% higher gate-adjusted ROI, while Minimal Context scored two points higher.
- A2A asynchronous used ${f(rows.find(row => row.treatment === "a2a_async").total_tokens / lunaXhighOpenCode.total_tokens, 1)}× the tokens of Luna Xhigh OpenCode, but that comparison changes architecture, runtime, reasoning effort, and cache/order conditions simultaneously; it does not isolate coordination overhead.
- Native isolated coordination remained much stronger than unrestricted dynamic delegation in the original architecture set.
- The fresh Luna Max OpenCode control delivered a corrected score of ${methodologyControl.quality_score} in ${mmss(methodologyControl.wall_seconds)} for $${f(methodologyControl.estimated_api_cost_usd, 4)}. Spec Kit and full-methodology Superpowers both exhausted 45:00 before deployment, scoring ${rows.find(row => row.treatment === "monolith_luna_max_opencode_speckit").quality_score} and ${rows.find(row => row.treatment === "dynamic_luna_max_opencode_superpowers").quality_score}, respectively. Their gate-adjusted ROI is zero because both fail the quality gate.
- Spec Kit used ${f(rows.find(row => row.treatment === "monolith_luna_max_opencode_speckit").total_tokens / methodologyControl.total_tokens, 1)}× the control's tokens while spending most of the run on specification artifacts. Superpowers used ${f(rows.find(row => row.treatment === "dynamic_luna_max_opencode_superpowers").total_tokens / methodologyControl.total_tokens, 1)}× the control's tokens; its six-agent implement-review-fix loop caught real engine defects but completed only two of seven planned tasks.

## Interpretation limits

- One replicate per treatment; no confidence intervals or significance tests.
- Runs were sequential and shared tool/provider caches. Candidate 6 intentionally measures warm-cache behavior.
- Provider/network/provisioning variance was not controlled, and the extension order was not randomized.
- The score is evidence-based but uses one automated evaluator and one blinded model judge.
- The original audio check verified only that the mute control changed state; it did not verify audio-node creation, audible output, or combat-event sound coverage. A direct recheck confirmed candidate 15's sparse launch/game-over/submission tones, but equivalent instrumentation should be applied uniformly in replication.
- The supplemental regression weights refine existing categories post hoc; they were applied uniformly, but were defined after user-reported defects and should be preregistered in future runs.
- Quality-adjusted efficiency is reported as a sensitivity across explicit time values, not as one universal ROI. The appropriate scenario depends on the economic value of delivery latency.
- The rubric score is interval-like rather than proven ratio-scale. The quality gate reduces the risk of rewarding cheap failures, but efficiency ratios should be treated as scenario comparisons rather than literal ratios of value.
- The ε=${primaryQualityTolerance} quality gate and its PASS/BORDERLINE/FAIL thresholds were chosen after these runs and should be preregistered for a replication. BORDERLINE means the decision is unresolved, not that candidates are proven statistically equivalent.
- OpenCode and Codex token telemetry come from different runtime event formats. The compiler converts both to cached input, uncached input, and output, but provider billing-dashboard reconciliation has not verified that the counters are semantically identical.
- The minimal-context treatment disables several optional Codex surfaces together and has one replicate. It shows that the default integration surface was not necessary for this successful run, but cannot estimate the marginal token contribution of skills, MCP, apps, project instructions, or workflow variation individually.
- The asynchronous-streaming A2A extension changes transport and runtime together. Its improvement over asynchronous-polling A2A cannot be attributed specifically to streaming, OpenCode, cache/order conditions, or their interaction.
- The streaming harness retained task snapshots but no incremental status or artifact updates; terminal completion was recovered from final task snapshots. Sustained end-to-end stream behavior therefore remains unverified.
- The methodology extension intentionally measures each complete package, not isolated features. The failed deliveries do not establish that specifications, TDD, reviews, worktrees, or subagents are individually harmful; they show that these default full workflows did not fit this task's 45-minute budget in these single runs.
- The post-timeout continuation rows are exploratory, reused warm state, exceeded the preregistered time ceiling, and are excluded from the primary ranking. Superpowers was stopped by the user and graded at its last clean deployed commit, so its continuation row is an observed stopping point rather than a completed-methodology treatment.
- The first Spec Kit controller launch was excluded as a harness failure because initialization ran from the wrong working directory. It stopped after 26 seconds with zero model tokens and no external resources; all artifacts are retained under \`results/harness-failures/\`. The corrected run used a fresh repository and a new ephemeral no-cache installation, though transient OS/network caches cannot be perfectly reset.
- The results cover one full-stack game task and may not transfer to other work.

Every temporary candidate Supabase project that was actually created was confirmed **INACTIVE** after evaluation. All sixteen timed-run gallery games now use one active shared project with an allowlisted \`candidate_id\` partition; candidates 15, 18, and 19 were added in documented post-benchmark retrofits while their benchmark-specific databases remain paused. Spec Kit and Superpowers created dedicated projects only during exploratory post-timeout continuations, and both are paused. These post-benchmark infrastructure states do not alter retained scores or timed metrics.
`;
fs.writeFileSync(path.join(root, "results/report.md"), report);

const galleryLabels = {
  monolith: "Monolith · Luna Max · cold cache",
  native_dynamic: "Native dynamic subagents",
  native_isolated: "Native isolated subagents",
  a2a: "A2A · synchronous",
  monolith_warm: "Monolith · Luna Max · warm cache",
  a2a_async: "A2A · asynchronous",
  a2a_async_streaming_opencode: "A2A · async streaming · Luna Max · OpenCode",
  monolith_sol_medium: "Monolith · Sol Medium · Codex",
  monolith_opencode: "Monolith · Luna Max · OpenCode",
  monolith_sol_medium_opencode: "Monolith · Sol Medium · OpenCode",
  monolith_sol_low_opencode: "Monolith · Sol Low · OpenCode",
  monolith_sol_high_opencode: "Monolith · Sol High · OpenCode",
  monolith_luna_xhigh_opencode: "Monolith · Luna Xhigh · OpenCode",
  monolith_luna_high_opencode: "Monolith · Luna High · OpenCode",
  monolith_luna_max_codex_minimal: "Monolith · Luna Max · Codex Minimal Context",
  monolith_luna_max_opencode_retest: "Monolith · Luna Max · OpenCode fresh control",
  monolith_luna_max_opencode_speckit: "Monolith · Luna Max · OpenCode + Spec Kit",
  dynamic_luna_max_opencode_superpowers: "Dynamic · Luna Max · OpenCode + Superpowers",
};
const galleryRows = decisionRows.map(row =>
  `| **${galleryLabels[row.treatment]}** | ${row.quality_score} | ${row.quality_gate} | $${f(row.estimated_api_cost_usd, 4)} | ${mmss(row.wall_seconds)} | ${f(row.total_tokens / 1e6, 3)}M | ${f(row.cached_input_tokens / 1e6, 3)}M | ${f(row.uncached_input_tokens / 1e6, 3)}M | ${f(row.output_tokens / 1e6, 3)}M | ${f(row.gate_adjusted_roi, 4)} |`
).join("\n");
const galleryTable = `| Candidate | Score | Gate | Cost | Time | Total tokens | Cached input | Uncached input | Output | Gate-adjusted ROI |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
${galleryRows}

### Quality-tolerance frontier sensitivity

Strict Pareto uses observed scores exactly. The ε analysis treats a candidate up to ε points lower as no worse on quality before applying cost/time dominance. This is practical-equivalence sensitivity, not a confidence interval or proof of noise; the relation need not be transitive.

${toleranceTable}

At ε=${primaryQualityTolerance}, A2A asynchronous is dominated because Luna Xhigh OpenCode is within one quality point, ${f(rows.find(row => row.treatment === "a2a_async").estimated_api_cost_usd / lunaXhighOpenCode.estimated_api_cost_usd, 1)}× cheaper, and exactly ${mmss(rows.find(row => row.treatment === "a2a_async").wall_seconds - lunaXhighOpenCode.wall_seconds)} faster. ε=${primaryQualityTolerance} is the headline frontier; ε=0 and ε=3 are sensitivities. None was preregistered.`;
const readmePath = path.join(root, "readme.md");
let readme = fs.readFileSync(readmePath, "utf8");
for (const marker of [
  "<!-- GENERATED_RESULTS_TABLE_START -->",
  "<!-- GENERATED_RESULTS_TABLE_END -->",
  "<!-- GENERATED_SENSITIVITY_TABLE_START -->",
  "<!-- GENERATED_SENSITIVITY_TABLE_END -->",
  "<!-- GENERATED_SENSITIVITY_CONCLUSION_START -->",
  "<!-- GENERATED_SENSITIVITY_CONCLUSION_END -->",
  "<!-- GENERATED_CONTINUATION_RESULTS_START -->",
  "<!-- GENERATED_CONTINUATION_RESULTS_END -->",
]) {
  if (!readme.includes(marker)) throw new Error(`README generated-section marker missing: ${marker}`);
}
readme = readme.replace(
  /<!-- GENERATED_RESULTS_TABLE_START -->[\s\S]*?<!-- GENERATED_RESULTS_TABLE_END -->/,
  `<!-- GENERATED_RESULTS_TABLE_START -->\n${galleryTable}\n\n<!-- GENERATED_RESULTS_TABLE_END -->`,
);
const readmeContinuationSection = continuationSection.replaceAll("](../", "]("
);
readme = readme.replace(
  /<!-- GENERATED_CONTINUATION_RESULTS_START -->[\s\S]*?<!-- GENERATED_CONTINUATION_RESULTS_END -->/,
  `<!-- GENERATED_CONTINUATION_RESULTS_START -->\n${readmeContinuationSection}\n<!-- GENERATED_CONTINUATION_RESULTS_END -->`,
);
const readmeSensitivityTable = `${sensitivityHeader}\n${sensitivity}`;
readme = readme.replace(
  /<!-- GENERATED_SENSITIVITY_TABLE_START -->[\s\S]*?<!-- GENERATED_SENSITIVITY_TABLE_END -->/,
  `<!-- GENERATED_SENSITIVITY_TABLE_START -->\n${readmeSensitivityTable}\n\n<!-- GENERATED_SENSITIVITY_TABLE_END -->`,
);
const readmeSensitivityConclusion = `Across the current quality-eligible frontier, Luna Xhigh OpenCode and Sol Medium OpenCode tie at **$${f(lunaXhighSolBreakEvenUsdPerHour, 2)}/hour**. Below that value, Luna Xhigh is preferred; above it, Sol Medium is preferred. The earlier Luna Max/Sol Medium crossover remains **$${f(lunaSolBreakEvenUsdPerHour, 2)}/hour**.`;
readme = readme.replace(
  /<!-- GENERATED_SENSITIVITY_CONCLUSION_START -->[\s\S]*?<!-- GENERATED_SENSITIVITY_CONCLUSION_END -->/,
  `<!-- GENERATED_SENSITIVITY_CONCLUSION_START -->\n${readmeSensitivityConclusion}\n<!-- GENERATED_SENSITIVITY_CONCLUSION_END -->`,
);
for (const row of rows) {
  const marker = `<!-- GENERATED_METRICS:${row.treatment} -->`;
  const baselineSuffix = row.treatment === "monolith" ? " baseline" : "";
  const paretoStatus = !row.quality_gate_passed ? "INELIGIBLE" : row.pareto_frontier ? "FRONTIER" : "DOMINATED";
  const metrics = `${marker}\n**Score ${row.quality_score}${baselineSuffix} · Cost $${f(row.estimated_api_cost_usd, 4)} · Time ${mmss(row.wall_seconds)} · Gate ${row.quality_gate} · Gate-adjusted ROI ${f(row.gate_adjusted_roi, 4)} · Pareto ε=${primaryQualityTolerance} ${paretoStatus}**<br>\nTokens: ${f(row.total_tokens / 1e6, 3)}M total · ${f(row.cached_input_tokens / 1e6, 3)}M cached input · ${f(row.uncached_input_tokens / 1e6, 3)}M uncached input · ${f(row.output_tokens / 1e6, 3)}M output`;
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedMarker}\\n\\*\\*Score[^\\n]*\\nTokens:[^\\n]*`);
  if (!pattern.test(readme)) throw new Error(`README metrics marker missing or malformed: ${row.treatment}`);
  readme = readme.replace(pattern, metrics);
}
fs.writeFileSync(readmePath, readme);
console.log(report);
