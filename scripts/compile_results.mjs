import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const plannedTreatments = ["monolith", "native_dynamic", "native_isolated", "a2a", "monolith_warm", "a2a_async", "a2a_async_streaming_opencode", "monolith_sol_medium", "monolith_opencode", "monolith_sol_medium_opencode", "monolith_sol_medium_opencode_api", "monolith_sol_low_opencode", "monolith_sol_high_opencode", "monolith_luna_xhigh_opencode", "monolith_luna_high_opencode", "monolith_luna_max_codex_minimal", "monolith_luna_max_opencode_retest", "monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers", "monolith_luna_max_opencode_ai_repo_template", "monolith_luna_xhigh_fast_opencode", "monolith_luna_max_fast_opencode", "monolith_sol_low_fast_opencode", "monolith_sol_medium_fast_opencode", "monolith_grok_4_5_medium_cursor", "monolith_grok_4_5_high_cursor", "monolith_grok_4_5_medium_fast_cursor", "monolith_grok_4_5_high_fast_cursor", "monolith_auto_cursor", "monolith_luna_xhigh_opencode_control", "monolith_opus_5_medium_claude_code", "monolith_sonnet_5_medium_claude_code", "monolith_opus_5_medium_opencode", "monolith_sonnet_5_medium_opencode", "monolith_opus_5_medium_opencode_oauth"];
const treatmentArtifactsExist = treatment => [
  path.join(root, "results/raw", treatment, "run-metrics.json"),
  path.join(root, "results/raw", treatment, "cleanup.json"),
  path.join(root, "results/evidence", treatment, "automated.json"),
  path.join(root, "results/evidence", treatment, "manual-score.json"),
  path.join(root, "results/evidence", treatment, "posthoc-score.json"),
].every(file => fs.existsSync(file));
const treatments = plannedTreatments.filter(treatmentArtifactsExist);
const labels = {
  monolith: "Monolith · Luna Max · cold cache", native_dynamic: "Native dynamic subagents", native_isolated: "Native isolated subagents",
  a2a: "A2A · synchronous", monolith_warm: "Monolith · Luna Max · warm cache", a2a_async: "A2A · asynchronous",
  a2a_async_streaming_opencode: "A2A · async streaming · Luna Max · OpenCode",
  monolith_sol_medium: "Monolith · Sol Medium · Codex", monolith_opencode: "Monolith · Luna Max · OpenCode",
  monolith_sol_medium_opencode: "Monolith · Sol Medium · OpenCode",
  monolith_sol_medium_opencode_api: "Monolith · Sol Medium · OpenCode API",
  monolith_sol_low_opencode: "Monolith · Sol Low · OpenCode",
  monolith_sol_high_opencode: "Monolith · Sol High · OpenCode",
  monolith_luna_xhigh_opencode: "Monolith · Luna Xhigh · OpenCode",
  monolith_luna_high_opencode: "Monolith · Luna High · OpenCode",
  monolith_luna_max_codex_minimal: "Monolith · Luna Max · Codex Minimal Context",
  monolith_luna_max_opencode_retest: "Monolith · Luna Max · OpenCode fresh control",
  monolith_luna_max_opencode_speckit: "Monolith · Luna Max · OpenCode + Spec Kit",
  dynamic_luna_max_opencode_superpowers: "Dynamic · Luna Max · OpenCode + Superpowers",
  monolith_luna_max_opencode_ai_repo_template: "Monolith · Luna Max · OpenCode + AI Repo Template",
  monolith_luna_xhigh_fast_opencode: "Monolith · Luna Xhigh Fast · OpenCode",
  monolith_luna_max_fast_opencode: "Monolith · Luna Max Fast · OpenCode",
  monolith_sol_low_fast_opencode: "Monolith · Sol Low Fast · OpenCode",
  monolith_sol_medium_fast_opencode: "Monolith · Sol Medium Fast · OpenCode",
  monolith_grok_4_5_medium_cursor: "Monolith · Grok 4.5 Medium · Cursor",
  monolith_grok_4_5_high_cursor: "Monolith · Grok 4.5 High · Cursor",
  monolith_grok_4_5_medium_fast_cursor: "Monolith · Grok 4.5 Medium Fast · Cursor",
  monolith_grok_4_5_high_fast_cursor: "Monolith · Grok 4.5 High Fast · Cursor",
  monolith_auto_cursor: "Monolith · Auto Cost · Cursor",
  monolith_luna_xhigh_opencode_control: "Monolith · Luna Xhigh · OpenCode control",
  monolith_opus_5_medium_claude_code: "Monolith · Opus 5 Medium · Claude Code",
  monolith_sonnet_5_medium_claude_code: "Monolith · Sonnet 5 Medium · Claude Code",
  monolith_opus_5_medium_opencode: "Monolith · Opus 5 Medium · OpenCode",
  monolith_sonnet_5_medium_opencode: "Monolith · Sonnet 5 Medium · OpenCode",
  monolith_opus_5_medium_opencode_oauth: "Monolith · Opus 5 Medium · OpenCode OAuth",
};
const pricing = {
  as_of: "2026-08-10",
  source: "https://developers.openai.com/api/docs/pricing",
  priority_source: "https://openai.com/api-priority-processing/",
  grok_source: "https://cursor.com/docs/models-and-pricing",
  cursor_auto_source: "https://cursor.com/docs/models-and-pricing#auto-modes",
  anthropic_source: "https://platform.claude.com/docs/en/about-claude/pricing",
  anthropic_sonnet_5_introductory_pricing_ends: "2026-08-31",
  cursor_grok_cache_accounting: "Cursor publishes separate cache-read rates for Grok 4.5 ($0.50/M Standard and $1/M Fast) and no cache-write rate; cache writes are therefore costed at zero.",
  service_tiers: ["standard", "priority"],
  models: {
    "gpt-5.6-luna": { uncached_input: 0.2, cached_input: 0.02, cache_write: 0.25, output: 1.2 },
    "gpt-5.6-sol": { uncached_input: 5, cached_input: 0.5, cache_write: 6.25, output: 30 },
    "grok-4.5": { uncached_input: 2, cached_input: 0.5, cache_write: 0, output: 6 },
    "grok-4.5-fast": { uncached_input: 4, cached_input: 1, cache_write: 0, output: 18 },
    "cursor-auto-cost": { uncached_input: 1.25, cached_input: 0.25, cache_write: 1.25, output: 6 },
    "claude-opus-5": { uncached_input: 5, cached_input: 0.5, cache_write: 6.25, cache_write_5m: 6.25, cache_write_1h: 10, output: 25 },
    "claude-sonnet-5": { uncached_input: 2, cached_input: 0.2, cache_write: 2.5, cache_write_5m: 2.5, cache_write_1h: 4, output: 10 },
  },
  priority_models: {
    "gpt-5.6-luna": { uncached_input: 0.4, cached_input: 0.04, cache_write: 0.5, output: 2.4 },
    "gpt-5.6-sol": { uncached_input: 10, cached_input: 1, cache_write: 12.5, output: 60 },
  },
  web_search_usd_per_call: 0.01,
  long_context_threshold_input_tokens: 272000,
  captured_web_search_calls: {
    monolith: 3, native_dynamic: 1, native_isolated: 4, a2a: 5,
    monolith_warm: 0, a2a_async: 2, a2a_async_streaming_opencode: 0, monolith_sol_medium: 3, monolith_opencode: 0,
    monolith_sol_medium_opencode: 0,
    monolith_sol_medium_opencode_api: 0,
    monolith_sol_low_opencode: 0, monolith_luna_xhigh_opencode: 0,
    monolith_sol_high_opencode: 0,
    monolith_luna_high_opencode: 0,
    monolith_luna_max_codex_minimal: 0,
    monolith_luna_max_opencode_retest: 0,
    monolith_luna_max_opencode_speckit: 0,
    dynamic_luna_max_opencode_superpowers: 0,
    monolith_luna_max_opencode_ai_repo_template: 0,
    monolith_luna_xhigh_fast_opencode: 0,
    monolith_luna_max_fast_opencode: 0,
    monolith_sol_low_fast_opencode: 0,
    monolith_sol_medium_fast_opencode: 0,
    monolith_grok_4_5_medium_cursor: 0,
    monolith_grok_4_5_high_cursor: 0,
    monolith_grok_4_5_medium_fast_cursor: 0,
    monolith_grok_4_5_high_fast_cursor: 0,
    monolith_auto_cursor: 0,
    monolith_luna_xhigh_opencode_control: 0,
    monolith_opus_5_medium_claude_code: 0,
    monolith_sonnet_5_medium_claude_code: 0,
    monolith_opus_5_medium_opencode: 0,
    monolith_sonnet_5_medium_opencode: 0,
    monolith_opus_5_medium_opencode_oauth: 0,
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
  const serviceTier = metrics.service_tier ?? "standard";
  const rateTable = serviceTier === "priority" ? pricing.priority_models : pricing.models;
  const rates = rateTable[metrics.model];
  if (!rates) throw new Error(`No ${serviceTier} pricing configured for ${metrics.model}`);
  const cacheWriteTokens = metrics.usage.cache_write_input_tokens ?? 0;
  const totalTokens = metrics.usage.input_tokens + cacheWriteTokens + metrics.usage.output_tokens;
  const uncachedInputTokens = metrics.usage.input_tokens - metrics.usage.cached_input_tokens;
  const nonCachedTokens = uncachedInputTokens + cacheWriteTokens + metrics.usage.output_tokens;
  const originalQuality = automated.automated_points + manual.manual_points;
  if (posthoc.original_quality_score !== originalQuality) throw new Error(`Post-hoc original score mismatch for ${treatment}`);
  const quality = posthoc.corrected_quality_score;
  const cacheWriteCost = metrics.usage.cache_write_5m_input_tokens != null || metrics.usage.cache_write_1h_input_tokens != null
    ? (
      Number(metrics.usage.cache_write_5m_input_tokens ?? 0) * (rates.cache_write_5m ?? rates.cache_write) +
      Number(metrics.usage.cache_write_1h_input_tokens ?? 0) * (rates.cache_write_1h ?? rates.cache_write)
    )
    : cacheWriteTokens * rates.cache_write;
  const tokenCost = (
    uncachedInputTokens * rates.uncached_input +
    metrics.usage.cached_input_tokens * rates.cached_input +
    cacheWriteCost +
    metrics.usage.output_tokens * rates.output
  ) / 1_000_000;
  const webSearchCalls = pricing.captured_web_search_calls[treatment] ?? 0;
  const apiCost = tokenCost + webSearchCalls * pricing.web_search_usd_per_call;
  const providerReportedCost = metrics.provider_reported_cost_usd;
  const providerCostDifference = providerReportedCost == null ? null : tokenCost - providerReportedCost;
  const providerCostDifferencePercent = providerReportedCost == null || providerReportedCost === 0
    ? null
    : providerCostDifference / providerReportedCost * 100;
  const providerCostDifferenceFlagged = providerReportedCost == null
    ? false
    : Math.abs(providerCostDifference) > Math.max(0.01, providerReportedCost * 0.05);
  const wallMinutes = metrics.wall_seconds / 60;
  const squareRootRoi = quality / Math.sqrt(apiCost * wallMinutes);
  const qualityFactor = gateQualityFactor(quality);
  return {
    treatment, label: labels[treatment], model: metrics.model,
    reasoning_effort: metrics.reasoning_effort, runtime: metrics.runtime ?? "codex", service_tier: serviceTier,
    quality_score: quality, original_quality_score: originalQuality,
    posthoc_adjustment: posthoc.posthoc_adjustment,
    automated_points: automated.automated_points, manual_points: manual.manual_points,
    wall_seconds: metrics.wall_seconds, wall_minutes: wallMinutes,
    total_tokens: totalTokens, uncached_input_tokens: uncachedInputTokens,
    cache_write_input_tokens: cacheWriteTokens,
    non_cached_tokens: nonCachedTokens, cached_input_tokens: metrics.usage.cached_input_tokens,
    output_tokens: metrics.usage.output_tokens, reasoning_output_tokens: metrics.usage.reasoning_output_tokens,
    agents_started: metrics.agents_started ?? 1,
    coordination_events: metrics.a2a_messages ?? metrics.native_coordination_calls ?? 0,
    successful_a2a_messages: metrics.a2a_messages_succeeded ?? null,
    failed_a2a_messages: metrics.a2a_messages_failed ?? null,
    captured_web_search_calls: webSearchCalls,
    provider_reported_cost_usd: providerReportedCost ?? null,
    provider_cost_difference_usd: providerCostDifference,
    provider_cost_difference_percent: providerCostDifferencePercent,
    provider_cost_difference_flagged: providerCostDifferenceFlagged,
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
const requestedComparators = {
  monolith_luna_xhigh_fast_opencode: rows.find(row => row.treatment === "monolith_luna_xhigh_opencode"),
  monolith_luna_max_fast_opencode: rows.find(row => row.treatment === "monolith_opencode"),
  monolith_sol_low_fast_opencode: rows.find(row => row.treatment === "monolith_sol_low_opencode"),
  monolith_sol_medium_fast_opencode: rows.find(row => row.treatment === "monolith_sol_medium_opencode"),
  monolith_sol_medium_opencode_api: rows.find(row => row.treatment === "monolith_sol_medium_opencode"),
  monolith_grok_4_5_high_cursor: rows.find(row => row.treatment === "monolith_grok_4_5_medium_cursor"),
  monolith_grok_4_5_medium_fast_cursor: rows.find(row => row.treatment === "monolith_grok_4_5_medium_cursor"),
  monolith_grok_4_5_high_fast_cursor: rows.find(row => row.treatment === "monolith_grok_4_5_high_cursor"),
  monolith_luna_xhigh_opencode_control: rows.find(row => row.treatment === "monolith_luna_xhigh_opencode"),
  monolith_sonnet_5_medium_claude_code: rows.find(row => row.treatment === "monolith_opus_5_medium_claude_code"),
  monolith_opus_5_medium_opencode: rows.find(row => row.treatment === "monolith_opus_5_medium_claude_code"),
  monolith_sonnet_5_medium_opencode: rows.find(row => row.treatment === "monolith_sonnet_5_medium_claude_code"),
  monolith_opus_5_medium_opencode_oauth: rows.find(row => row.treatment === "monolith_opus_5_medium_opencode"),
};
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
  {
    treatment: "monolith_luna_max_opencode_ai_repo_template",
    label: "Monolith Luna Max OpenCode + AI Repo Template",
    score_file: path.join(root, "results/continuations/monolith_luna_max_opencode_ai_repo_template/attempt-1/score.json"),
    cleanup_file: path.join(root, "results/continuations/monolith_luna_max_opencode_ai_repo_template/attempt-1/cleanup.json"),
    live_url: "https://shootemup-bench-luna-max-opencode-ai-neon-barrage.mikejmckinney.workers.dev",
    source_path: "submissions/monolith_luna_max_opencode_ai_repo_template_continued/",
    evidence_path: "results/continuations/monolith_luna_max_opencode_ai_repo_template/attempt-1/evidence/",
    outcome: "Completed after one additional 20:31 continuation.",
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
  const comparisonBaseline = requestedComparators[row.treatment]
    ?? (row.treatment === "a2a_async_streaming_opencode" && asyncA2aComparator
    ? asyncA2aComparator
    : row.treatment === "monolith_sol_high_opencode" && solMediumOpenCodeComparator
      ? solMediumOpenCodeComparator
      : row.treatment === "monolith_luna_max_codex_minimal"
    ? warmCacheBaseline
    : ["monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers", "monolith_luna_max_opencode_ai_repo_template"].includes(row.treatment) && methodologyControl
      ? methodologyControl
      : baseline);
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
const lunaXhighFastOpenCode = rows.find(row => row.treatment === "monolith_luna_xhigh_fast_opencode");
const lunaMaxFastOpenCode = rows.find(row => row.treatment === "monolith_luna_max_fast_opencode");
const lunaXhighOpenCodeControl = rows.find(row => row.treatment === "monolith_luna_xhigh_opencode_control");
const solOpenCode = rows.find(row => row.treatment === "monolith_sol_medium_opencode");
const solOpenCodeApi = rows.find(row => row.treatment === "monolith_sol_medium_opencode_api");
const solHighOpenCode = rows.find(row => row.treatment === "monolith_sol_high_opencode");
const solLowOpenCode = rows.find(row => row.treatment === "monolith_sol_low_opencode");
const solLowFastOpenCode = rows.find(row => row.treatment === "monolith_sol_low_fast_opencode");
const solMediumFastOpenCode = rows.find(row => row.treatment === "monolith_sol_medium_fast_opencode");
const grokMediumCursor = rows.find(row => row.treatment === "monolith_grok_4_5_medium_cursor");
const grokHighCursor = rows.find(row => row.treatment === "monolith_grok_4_5_high_cursor");
const grokMediumFastCursor = rows.find(row => row.treatment === "monolith_grok_4_5_medium_fast_cursor");
const grokHighFastCursor = rows.find(row => row.treatment === "monolith_grok_4_5_high_fast_cursor");
const autoCostCursor = rows.find(row => row.treatment === "monolith_auto_cursor");
const asyncA2a = rows.find(row => row.treatment === "a2a_async");
const asyncStreamingOpenCode = rows.find(row => row.treatment === "a2a_async_streaming_opencode");
const minimalCodex = rows.find(row => row.treatment === "monolith_luna_max_codex_minimal");
const aiRepoTemplate = rows.find(row => row.treatment === "monolith_luna_max_opencode_ai_repo_template");
const opusClaudeCode = rows.find(row => row.treatment === "monolith_opus_5_medium_claude_code");
const sonnetClaudeCode = rows.find(row => row.treatment === "monolith_sonnet_5_medium_claude_code");
const opusOpenCode = rows.find(row => row.treatment === "monolith_opus_5_medium_opencode");
const sonnetOpenCode = rows.find(row => row.treatment === "monolith_sonnet_5_medium_opencode");
const opusOpenCodeOauth = rows.find(row => row.treatment === "monolith_opus_5_medium_opencode_oauth");
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
    sol_medium_opencode_api_vs_oauth: {
      candidate: "monolith_sol_medium_opencode_api",
      comparator: "monolith_sol_medium_opencode",
      delta: solOpenCodeApi.marginal_vs_comparator,
    },
    opus_5_opencode_oauth_vs_api: {
      candidate: "monolith_opus_5_medium_opencode_oauth",
      comparator: "monolith_opus_5_medium_opencode",
      delta: opusOpenCodeOauth.marginal_vs_comparator,
    },
    minimal_context_vs_warm_cache: {
      candidate: "monolith_luna_max_codex_minimal",
      comparator: "monolith_warm",
      delta: rows.find(row => row.treatment === "monolith_luna_max_codex_minimal").marginal_vs_comparator,
    },
    methodology_vs_fresh_control: methodologyControl ? Object.fromEntries(
      ["monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers", "monolith_luna_max_opencode_ai_repo_template"]
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
  `| ${row.label} | ${row.quality_score} | ${row.quality_gate} | $${f(row.estimated_api_cost_usd, 4)} | ${mmss(row.wall_seconds)} | ${f(row.total_tokens / 1e6, 3)}M | ${f(row.cached_input_tokens / 1e6, 3)}M | ${f(row.uncached_input_tokens / 1e6, 3)}M | ${f(row.cache_write_input_tokens / 1e6, 3)}M | ${f(row.output_tokens / 1e6, 3)}M | ${f(row.gate_adjusted_roi, 4)} |`
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
const aiRepoContinuation = continuationRows.find(row => row.treatment === "monolith_luna_max_opencode_ai_repo_template");
const continuationComparison = row => `${f(row.wall_seconds / methodologyControl.wall_seconds, 1)}× the control's wall time, ${f(row.estimated_api_cost_usd / methodologyControl.estimated_api_cost_usd, 1)}× its estimated cost, and ${f(row.total_tokens / methodologyControl.total_tokens, 1)}× its tokens`;
const continuationSection = `## Exploratory completion after timeout

These rows answer **“what did the methodologies eventually produce?”** They are not replacements for the primary 45-minute rows and are excluded from the main ranking. They reused warm state over multiple continuation windows, and Superpowers was stopped by the user before its own workflow declared completion.

${continuationTable}

- **Spec Kit eventually delivered 91:** 52/54 automated + 41/46 manual − 2 post-hoc. It required ${continuationComparison(specContinuation)} and still scored three points below the fresh plain OpenCode control.
- **Superpowers stopped at 89:** 48/54 automated + 43/46 manual − 2 post-hoc. It required ${continuationComparison(superpowersContinuation)}, equivalent to **${f(superpowersContinuation.wall_seconds / 2700, 1)} full 45-minute candidate budgets**. The standardized evaluator could not move or fire with the keyboard, the immediate visible restart path failed, its handoff remained stale, and its parent branch never integrated the feature worktree. A later uncommitted fix wave is preserved but excluded from grading.
- **AI Repo Template eventually delivered 94:** 54/54 automated + 42/46 manual − 2 post-hoc. One additional 20:31 continuation brought its cumulative totals to 65:31, $${f(aiRepoContinuation.estimated_api_cost_usd, 4)}, and ${f(aiRepoContinuation.total_tokens / 1e6, 3)}M tokens. It matched the fresh control's corrected quality but required ${continuationComparison(aiRepoContinuation)}; the physical callsign-entry regression remains.
- The Superpowers deliverable therefore scored no better than Sol Low OpenCode's 89, which finished in 5:29, and scored below Sol Medium OpenCode's 94 at 8:30 and Luna Xhigh OpenCode's 95 at 12:02. Its partial quality-gate factor of ${f(superpowersContinuation.gate_quality_factor, 1)} drives exploratory gate-adjusted ROI down to ${f(superpowersContinuation.gate_adjusted_roi, 4)}.

[Play Spec Kit](${specContinuation.live_url}) · [Spec Kit continued source](../${specContinuation.source_path}) · [Spec Kit continuation evidence](../${specContinuation.evidence_path}) · [Spec Kit score](../${specContinuation.score_path})

[Play Superpowers](${superpowersContinuation.live_url}) · [Superpowers continued source](../${superpowersContinuation.source_path}) · [Superpowers continuation evidence](../${superpowersContinuation.evidence_path}) · [Superpowers score](../${superpowersContinuation.score_path})

[Play AI Repo Template](${aiRepoContinuation.live_url}) · [AI Repo Template continued source](../${aiRepoContinuation.source_path}) · [AI Repo Template continuation evidence](../${aiRepoContinuation.evidence_path}) · [AI Repo Template score](../${aiRepoContinuation.score_path})

All three methodology continuation databases are confirmed inactive. Their frontends remain available, but their leaderboards require an owner-authorized database resume. This does not affect the retained evaluation evidence.
`;

const report = `# Shoot-'Em-Up agent architecture benchmark results

Generated from retained run, evaluator, judge, and cleanup JSON. There is one replicate per treatment, so these are controlled case-study results rather than population estimates.

## Result

Quality is an open-ended score using the original monolith as the comparison baseline. Its original score was 100; the uniform post-hoc review corrects it to **${baseline.quality_score}**. It is not a percentage and 100 is not a ceiling.

Scores include the uniform [post-hoc regression review](posthoc-review.md). Original automated and manual evidence remains unchanged; absolute post-hoc deductions are applied directly.

| Candidate | Score | Gate | Cost | Time | Total tokens | Cached input | Uncached input | Cache writes | Output | Gate-adjusted ROI |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
${table}

Gate-adjusted ROI uses \`score × clamp((score - 87) / 5, 0, 1) / sqrt(API cost × elapsed minutes)\`. The gate factor is 1 for PASS, 0.2–0.8 for BORDERLINE, and 0 for FAIL. It is a comparative index, not conventional financial ROI. Total tokens are cached input + uncached input + cache writes + output. Reasoning tokens are included in output and are not counted twice. Rows are ranked by gate-adjusted ROI descending; Pareto analysis remains separate below.

- Highest observed quality (${Math.max(...rows.map(row => row.quality_score))}): **${rows.filter(row => row.quality_score === Math.max(...rows.map(item => item.quality_score))).map(row => row.label).join(", ")}**.
- Quality-gate borderline: **${rows.filter(row => row.quality_gate === "BORDERLINE").map(row => row.label).join(", ") || "none"}**.
- Quality-gate failures: **${rows.filter(row => row.quality_gate === "FAIL").map(row => row.label).join(", ") || "none"}**.
- Pareto frontier at ε=${primaryQualityTolerance}: **${frontierLabels.join(", ")}**.
- Highest gate-adjusted ROI: **${decisionRows[0].label} (${f(decisionRows[0].gate_adjusted_roi, 4)})**.

## Quality-tolerance frontier sensitivity

Strict Pareto dominance uses the observed scores exactly. The ε analysis treats a candidate up to ε points lower as no worse on quality, then applies cost/time dominance. It is a practical-equivalence sensitivity—not a confidence interval or proof that score differences are noise—and the relation need not be transitive.

${toleranceTable}

At ε=${primaryQualityTolerance}, A2A asynchronous is dominated because Luna Xhigh OpenCode is within one quality point while being ${f(rows.find(row => row.treatment === "a2a_async").estimated_api_cost_usd / lunaXhighOpenCode.estimated_api_cost_usd, 1)}× cheaper and exactly ${mmss(rows.find(row => row.treatment === "a2a_async").wall_seconds - lunaXhighOpenCode.wall_seconds)} faster. ε=${primaryQualityTolerance} is the headline frontier and ε=0 and ε=3 are reported as sensitivities; none was preregistered for these runs.

## Quality-adjusted efficiency sensitivity

PAYG-equivalent costs use [official OpenAI API rates](${pricing.source}), [Cursor model rates](${pricing.grok_source}), and [official Anthropic API rates](${pricing.anthropic_source}) current on ${pricing.as_of}. Standard Luna costs **$0.20/M uncached input, $0.02/M cached input, $0.25/M cache writes, and $1.20/M output**; Fast Luna doubles those rates. Standard Sol costs **$5.00/M, $0.50/M, $6.25/M, and $30.00/M**; Priority Sol doubles them. Cursor Grok 4.5 Standard costs **$2.00/M uncached input, $0.50/M cache reads, $0 cache writes, and $6.00/M output**; Fast costs **$4.00/M, $1.00/M, $0, and $18.00/M**. Cursor Auto Cost uses **$1.25/M uncached/cache-write input, $0.25/M cache reads, and $6.00/M output**. Opus 5 uses **$5.00/M input, $0.50/M cache reads, $6.25/M 5-minute cache writes, $10.00/M 1-hour cache writes, and $25.00/M output**. Sonnet 5 uses its introductory through-August-31 rates of **$2.00/M, $0.20/M, $2.50/M, $4.00/M, and $10.00/M**, respectively. Captured web searches add $0.01 each. Supabase and Cloudflare free-tier usage adds $0 marginal infrastructure cost.

For a stated value of unattended agent time \`r\` in USD per minute:

\`quality-adjusted efficiency(r) = quality score / (API cost + elapsed minutes × r)\`

${sensitivityHeader}
${sensitivity}

Rows retain the main table's gate-adjusted-ROI order; compare columns to see how the stated time value changes the result.

† Is BORDERLINE or FAIL and is not eligible to win a scenario. Values remain visible for diagnostic transparency.

Across the current quality-eligible frontier, Luna Xhigh OpenCode and Sol Medium OpenCode tie at **$${f(lunaXhighSolBreakEvenUsdPerMinute, 6)}/minute ($${f(lunaXhighSolBreakEvenUsdPerHour, 2)}/hour)**. Below that time value Luna Xhigh is preferred; above it Sol Medium is preferred. The earlier Luna Max/Sol Medium crossover remains **$${f(lunaSolBreakEvenUsdPerHour, 2)}/hour**.

This is a sensitivity analysis, not conventional financial ROI. API cost is a list-price estimate rather than an invoice; subscription, OAuth, contract, regional, service-tier, and tool billing can differ.

## Marginal utility versus designated comparator

The original cold monolith remains the architectural comparator for the original treatments. Minimal-context Codex instead uses warm-cache Codex to reduce dependency/tool-installation confounding. Spec Kit, Superpowers, and AI Repo Template use the fresh Luna Max OpenCode control; AI Repo Template ran later, so its comparison has additional sequential-run drift.

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
- The API-authenticated Sol Medium OpenCode run finished ${mmss(solOpenCode.wall_seconds - solOpenCodeApi.wall_seconds)} faster than its OAuth comparator (${f((1 - solOpenCodeApi.wall_seconds / solOpenCode.wall_seconds) * 100, 1)}%), but scored ${signed(solOpenCodeApi.quality_score - solOpenCode.quality_score)}, cost ${f((solOpenCodeApi.estimated_api_cost_usd / solOpenCode.estimated_api_cost_usd - 1) * 100, 1)}% more, and used ${f((solOpenCodeApi.total_tokens / solOpenCode.total_tokens - 1) * 100, 1)}% more tokens. Its gate-adjusted ROI was ${f(solOpenCodeApi.gate_adjusted_roi, 4)} versus ${f(solOpenCode.gate_adjusted_roi, 4)}. With one run per authentication mode, this is evidence of no substantial overall API-key improvement—not proof that authentication caused the quality difference.
- The requested reasoning-effort extension produced corrected scores of ${rows.find(row => row.treatment === "monolith_sol_low_opencode").quality_score} for Sol Low, ${rows.find(row => row.treatment === "monolith_luna_xhigh_opencode").quality_score} for Luna Xhigh, and ${rows.find(row => row.treatment === "monolith_luna_high_opencode").quality_score} for Luna High.
- Luna Xhigh Fast finished ${f((1 - lunaXhighFastOpenCode.wall_seconds / lunaXhighOpenCodeControl.wall_seconds) * 100, 1)}% faster than its contemporaneous standard-tier control, scored ${signed(lunaXhighFastOpenCode.quality_score - lunaXhighOpenCodeControl.quality_score)}, and cost ${f(lunaXhighFastOpenCode.estimated_api_cost_usd / lunaXhighOpenCodeControl.estimated_api_cost_usd, 1)}× as much. Its gate-adjusted ROI was ${f((1 - lunaXhighFastOpenCode.gate_adjusted_roi / lunaXhighOpenCodeControl.gate_adjusted_roi) * 100, 1)}% lower.
- Luna Max Fast finished ${f((1 - lunaMaxFastOpenCode.wall_seconds / lunaOpenCode.wall_seconds) * 100, 1)}% faster than the original standard-tier Luna Max OpenCode run, scored ${signed(lunaMaxFastOpenCode.quality_score - lunaOpenCode.quality_score)}, and cost ${f(lunaMaxFastOpenCode.estimated_api_cost_usd / lunaOpenCode.estimated_api_cost_usd, 1)}× as much. Its gate-adjusted ROI was ${f((1 - lunaMaxFastOpenCode.gate_adjusted_roi / lunaOpenCode.gate_adjusted_roi) * 100, 1)}% lower.
- The corrected Fast harness isolated OpenCode's credential store, confirmed Priority service in both request and response events, and rejects API-key runs with zero provider-reported cost. The two valid Fast ledgers reported $${f(lunaXhighFastOpenCode.provider_reported_cost_usd, 6)} and $${f(lunaMaxFastOpenCode.provider_reported_cost_usd, 6)}; both match the compiler's token calculation within 1%.
- Sol Low Fast completed ${f((1 - solLowFastOpenCode.wall_seconds / solLowOpenCode.wall_seconds) * 100, 1)}% faster than standard Sol Low, scored ${signed(solLowFastOpenCode.quality_score - solLowOpenCode.quality_score)}, and cost ${f(solLowFastOpenCode.estimated_api_cost_usd / solLowOpenCode.estimated_api_cost_usd, 1)}× as much. Its gate-adjusted ROI increased from ${f(solLowOpenCode.gate_adjusted_roi, 4)} to ${f(solLowFastOpenCode.gate_adjusted_roi, 4)} because the quality improvement moved it from BORDERLINE to PASS.
- Sol Medium Fast completed ${f((1 - solMediumFastOpenCode.wall_seconds / solOpenCode.wall_seconds) * 100, 1)}% faster than standard Sol Medium, but scored ${signed(solMediumFastOpenCode.quality_score - solOpenCode.quality_score)} and cost ${f(solMediumFastOpenCode.estimated_api_cost_usd / solOpenCode.estimated_api_cost_usd, 1)}× as much; its gate-adjusted ROI fell from ${f(solOpenCode.gate_adjusted_roi, 4)} to ${f(solMediumFastOpenCode.gate_adjusted_roi, 4)}.
- Cursor Grok Medium Fast completed ${f((1 - grokMediumFastCursor.wall_seconds / grokMediumCursor.wall_seconds) * 100, 1)}% faster than standard Medium and scored ${signed(grokMediumFastCursor.quality_score - grokMediumCursor.quality_score)}, but cost ${f(grokMediumFastCursor.estimated_api_cost_usd / grokMediumCursor.estimated_api_cost_usd, 1)}× as much. Its gate-adjusted ROI was ${f((1 - grokMediumFastCursor.gate_adjusted_roi / grokMediumCursor.gate_adjusted_roi) * 100, 1)}% lower.
- Cursor Grok High Fast completed ${f((1 - grokHighFastCursor.wall_seconds / grokHighCursor.wall_seconds) * 100, 1)}% faster than standard High and scored ${signed(grokHighFastCursor.quality_score - grokHighCursor.quality_score)}, but cost ${f(grokHighFastCursor.estimated_api_cost_usd / grokHighCursor.estimated_api_cost_usd, 1)}× as much. Its gate-adjusted ROI was ${f((1 - grokHighFastCursor.gate_adjusted_roi / grokHighCursor.gate_adjusted_roi) * 100, 1)}% lower.
- Standard Cursor Grok High beat Medium by ${signed(grokHighCursor.quality_score - grokMediumCursor.quality_score)} quality points and ${mmss(grokMediumCursor.wall_seconds - grokHighCursor.wall_seconds)} while costing ${f((grokHighCursor.estimated_api_cost_usd / grokMediumCursor.estimated_api_cost_usd - 1) * 100, 0)}% more; its gate-adjusted ROI was ${f((grokHighCursor.gate_adjusted_roi / grokMediumCursor.gate_adjusted_roi - 1) * 100, 1)}% higher.
- Cursor Auto Cost delivered the best ROI in the seven-candidate extension: score ${autoCostCursor.quality_score}, time ${mmss(autoCostCursor.wall_seconds)}, cost $${f(autoCostCursor.estimated_api_cost_usd, 4)}, and gate-adjusted ROI ${f(autoCostCursor.gate_adjusted_roi, 4)}. Cursor confirmed the Auto router selection but did not expose its downstream model or tier, so the result is attributed only to Auto Cost.
- Sol High OpenCode tied Sol Medium OpenCode at ${solHighOpenCode.quality_score}, but took ${mmss(solHighOpenCode.wall_seconds - solOpenCode.wall_seconds)} longer, cost ${f((solHighOpenCode.estimated_api_cost_usd / solOpenCode.estimated_api_cost_usd - 1) * 100, 0)}% more, used ${f((solHighOpenCode.total_tokens / solOpenCode.total_tokens - 1) * 100, 0)}% more tokens, and achieved lower gate-adjusted ROI (${f(solHighOpenCode.gate_adjusted_roi, 4)} vs ${f(solOpenCode.gate_adjusted_roi, 4)}).
- Sol OpenCode used about ${f(lunaOpenCode.total_tokens / solOpenCode.total_tokens, 1)}× fewer total tokens, but Sol's per-token Standard price is 25× Luna's, so its estimated run cost remained much higher.
- Sol Medium Codex reported ${f(rows.find(row => row.treatment === "monolith_sol_medium").total_tokens / solOpenCode.total_tokens, 1)}× as many total tokens as Sol Medium OpenCode. The local compiler is internally consistent, but provider-side reconciliation is required before treating this as a causal runtime-efficiency result.
- Against warm-cache Codex, Luna Max Codex Minimal Context scored ${signed(minimalCodex.quality_score - warmCacheBaseline.quality_score)}, cost ${f((1 - minimalCodex.estimated_api_cost_usd / warmCacheBaseline.estimated_api_cost_usd) * 100, 0)}% less, finished ${mmss(warmCacheBaseline.wall_seconds - minimalCodex.wall_seconds)} faster, used ${f((1 - minimalCodex.total_tokens / warmCacheBaseline.total_tokens) * 100, 0)}% fewer total tokens, and improved gate-adjusted ROI by ${f((minimalCodex.gate_adjusted_roi / warmCacheBaseline.gate_adjusted_roi - 1) * 100, 0)}%. This is the primary Codex comparison because both runs could reuse installed dependencies and tools.
- Luna Max OpenCode still leads Minimal Context: OpenCode cost ${f((1 - lunaOpenCode.estimated_api_cost_usd / minimalCodex.estimated_api_cost_usd) * 100, 0)}% less, finished ${mmss(minimalCodex.wall_seconds - lunaOpenCode.wall_seconds)} faster, used ${f((1 - lunaOpenCode.total_tokens / minimalCodex.total_tokens) * 100, 0)}% fewer total tokens, and achieved ${f((lunaOpenCode.gate_adjusted_roi / minimalCodex.gate_adjusted_roi - 1) * 100, 0)}% higher gate-adjusted ROI, while Minimal Context scored two points higher.
- A2A asynchronous used ${f(rows.find(row => row.treatment === "a2a_async").total_tokens / lunaXhighOpenCode.total_tokens, 1)}× the tokens of Luna Xhigh OpenCode, but that comparison changes architecture, runtime, reasoning effort, and cache/order conditions simultaneously; it does not isolate coordination overhead.
- Native isolated coordination remained much stronger than unrestricted dynamic delegation in the original architecture set.
- Opus 5 Medium in Claude Code scored ${opusClaudeCode.quality_score} in ${mmss(opusClaudeCode.wall_seconds)} for $${f(opusClaudeCode.estimated_api_cost_usd, 4)}, passing all automated production checks. Sonnet 5 Medium finished ${mmss(opusClaudeCode.wall_seconds - sonnetClaudeCode.wall_seconds)} faster and cost ${f((1 - sonnetClaudeCode.estimated_api_cost_usd / opusClaudeCode.estimated_api_cost_usd) * 100, 0)}% less, but its hidden leaderboard result and broken primary restart flow reduced quality to ${sonnetClaudeCode.quality_score}, below the gate, and therefore zero gate-adjusted ROI.
- Opus 5 Medium in OpenCode scored ${opusOpenCode.quality_score} in ${mmss(opusOpenCode.wall_seconds)} for $${f(opusOpenCode.estimated_api_cost_usd, 4)}. Against Opus in Claude Code, it scored ${signed(opusOpenCode.quality_score - opusClaudeCode.quality_score)}, finished ${mmss(opusClaudeCode.wall_seconds - opusOpenCode.wall_seconds)} faster, and cost ${f((1 - opusOpenCode.estimated_api_cost_usd / opusClaudeCode.estimated_api_cost_usd) * 100, 0)}% less. Sonnet in OpenCode also finished with a lower cost than Sonnet in Claude Code, but its corrected score of ${sonnetOpenCode.quality_score} failed the quality gate; neither single run establishes a causal runtime effect.
- Opus 5 Medium through OpenCode OAuth also scored ${opusOpenCodeOauth.quality_score}, but took ${mmss(opusOpenCodeOauth.wall_seconds - opusOpenCode.wall_seconds)} longer, used ${f(opusOpenCodeOauth.total_tokens / opusOpenCode.total_tokens, 1)}× the tokens, and had a $${f(opusOpenCodeOauth.estimated_api_cost_usd - opusOpenCode.estimated_api_cost_usd, 4)} higher API-equivalent cost than the API-key run. Its gate-adjusted ROI was ${f(opusOpenCodeOauth.gate_adjusted_roi, 4)} versus ${f(opusOpenCode.gate_adjusted_roi, 4)}. This is a one-run comparison through an unsupported OAuth plugin, not evidence that OAuth caused the difference.
- The fresh Luna Max OpenCode control delivered a corrected score of ${methodologyControl.quality_score} in ${mmss(methodologyControl.wall_seconds)} for $${f(methodologyControl.estimated_api_cost_usd, 4)}. Spec Kit, full-methodology Superpowers, and AI Repo Template all exhausted 45:00 without a timed deployment, scoring ${rows.find(row => row.treatment === "monolith_luna_max_opencode_speckit").quality_score}, ${rows.find(row => row.treatment === "dynamic_luna_max_opencode_superpowers").quality_score}, and ${aiRepoTemplate.quality_score}, respectively. All three receive zero gate-adjusted ROI because they fail the quality gate.
- Spec Kit used ${f(rows.find(row => row.treatment === "monolith_luna_max_opencode_speckit").total_tokens / methodologyControl.total_tokens, 1)}× the control's tokens while spending most of the run on specification artifacts. Superpowers used ${f(rows.find(row => row.treatment === "dynamic_luna_max_opencode_superpowers").total_tokens / methodologyControl.total_tokens, 1)}× the control's tokens; its six-agent implement-review-fix loop caught real engine defects but completed only two of seven planned tasks. AI Repo Template used ${f(aiRepoTemplate.total_tokens / methodologyControl.total_tokens, 1)}× the control's tokens: template-seed onboarding and its inherited 398-check verification suite consumed about 20 minutes, and repeated local browser-tool recovery consumed the final deployment window despite a locally built and tested game.

## Interpretation limits

- One replicate per treatment; no confidence intervals or significance tests.
- Runs were sequential and shared tool/provider caches. Candidate 6 intentionally measures warm-cache behavior.
- Provider/network/provisioning variance was not controlled, and the extension order was not randomized.
- The score is evidence-based but uses one automated evaluator and one blinded model judge.
- The original audio check verified only that the mute control changed state; it did not verify audio-node creation, audible output, or combat-event sound coverage. A direct recheck confirmed candidate 15's sparse launch/game-over/submission tones, but equivalent instrumentation should be applied uniformly in replication.
- The supplemental regression weights refine existing categories post hoc; they were applied uniformly, but were defined after user-reported defects and should be preregistered in future runs.
- Quality-adjusted efficiency is reported as a sensitivity across explicit time values, not as one universal ROI. The appropriate scenario depends on the economic value of delivery latency.
- The rubric score is interval-like rather than proven ratio-scale. The quality gate reduces the risk of rewarding cheap failures, but efficiency ratios should be treated as scenario comparisons rather than literal ratios of value.
- The PASS/BORDERLINE/FAIL thresholds and the ε=${primaryQualityTolerance} headline Pareto frontier were chosen after these runs and should be preregistered for a replication; ε=3 is reported as a sensitivity. BORDERLINE means the decision is unresolved, not that candidates are proven statistically equivalent.
- OpenCode and Codex token telemetry come from different runtime event formats. The compiler converts both to cached input, uncached input, and output. The two API-key Fast runs now reconcile locally against provider-reported per-turn cost, but this does not reconcile the older OAuth OpenCode runs or Codex runs against provider billing records.
- Claude Code exposes cache creation separately from cache reads, so total-token accounting includes those disjoint cache-write tokens. Opus's official-rate estimate reconciles within 0.1% of Claude Code's terminal cost. Sonnet's $${f(sonnetClaudeCode.estimated_api_cost_usd, 4)} estimate uses Anthropic's time-limited introductory list price, while Claude Code reported $${f(sonnetClaudeCode.provider_reported_cost_usd, 4)}; the 33% discrepancy is retained and flagged rather than silently substituting one source.
- OpenCode's Anthropic ledger exposes aggregate cache writes rather than separate 5-minute and 1-hour cache-creation buckets. The compiler prices those writes at the 5-minute rate, matching OpenCode's provider-reported costs for both runs. Runtime, system context, tool surface, API-versus-OAuth authentication, run order, and stochastic generation all differ from the Claude Code treatments.
- The Opus 5 OpenCode OAuth treatment authenticated through the unsupported community \`opencode-claude-auth\` plugin and a Claude Pro subscription. Its $${f(opusOpenCodeOauth.estimated_api_cost_usd, 4)} cost is an API-equivalent estimate from OpenCode's token ledger, not an incremental subscription charge or provider invoice. The single sequential OAuth/API pair cannot isolate authentication effects from stochastic output, cache state, plugin behavior, or provider load.
- The Sol Medium OpenCode API-versus-OAuth comparison has one run per authentication mode. The API run has request-level transport and provider-cost telemetry, while the older OAuth run does not; stochastic generation, provider load, and sequential execution remain confounders, so the comparison cannot establish an authentication-mode effect.
- The minimal-context treatment disables several optional Codex surfaces together and has one replicate. It shows that the default integration surface was not necessary for this successful run, but cannot estimate the marginal token contribution of skills, MCP, apps, project instructions, or workflow variation individually.
- The asynchronous-streaming A2A extension changes transport and runtime together. Its improvement over asynchronous-polling A2A cannot be attributed specifically to streaming, OpenCode, cache/order conditions, or their interaction.
- The streaming harness retained task snapshots but no incremental status or artifact updates; terminal completion was recovered from final task snapshots. Sustained end-to-end stream behavior therefore remains unverified.
- The methodology extension intentionally measures each complete package, not isolated features. The failed deliveries do not establish that specifications, TDD, reviews, worktrees, repository onboarding, or subagents are individually harmful; they show that these three default full workflows did not fit this task's 45-minute budget in these single runs.
- The post-timeout continuation rows are exploratory, reused warm state, exceeded the preregistered time ceiling, and are excluded from the primary ranking. Superpowers was stopped by the user and graded at its last clean deployed commit, so its continuation row is an observed stopping point rather than a completed-methodology treatment.
- The first Spec Kit controller launch was excluded as a harness failure because initialization ran from the wrong working directory. It stopped after 26 seconds with zero model tokens and no external resources; all artifacts are retained under \`results/harness-failures/\`. The corrected run used a fresh repository and a new ephemeral no-cache installation, though transient OS/network caches cannot be perfectly reset.
- The results cover one full-stack game task and may not transfer to other work.

Every candidate Supabase project that was actually created was confirmed **INACTIVE** after evaluation. The former baseline project was later resumed as the shared gallery service; all ${rows.filter(row => row.automated_points > 0).length} timed-run gallery games now use it with an allowlisted \`candidate_id\` partition, while the other benchmark-specific databases remain paused. Spec Kit and Superpowers created dedicated projects only during exploratory post-timeout continuations; AI Repo Template restored and reused its timed-run project. All three continuation databases are paused. These post-benchmark infrastructure states do not alter retained scores or timed metrics.
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
  monolith_sol_medium_opencode_api: "Monolith · Sol Medium · OpenCode API",
  monolith_sol_low_opencode: "Monolith · Sol Low · OpenCode",
  monolith_sol_high_opencode: "Monolith · Sol High · OpenCode",
  monolith_luna_xhigh_opencode: "Monolith · Luna Xhigh · OpenCode",
  monolith_luna_high_opencode: "Monolith · Luna High · OpenCode",
  monolith_luna_max_codex_minimal: "Monolith · Luna Max · Codex Minimal Context",
  monolith_luna_max_opencode_retest: "Monolith · Luna Max · OpenCode fresh control",
  monolith_luna_max_opencode_speckit: "Monolith · Luna Max · OpenCode + Spec Kit",
  dynamic_luna_max_opencode_superpowers: "Dynamic · Luna Max · OpenCode + Superpowers",
  monolith_luna_max_opencode_ai_repo_template: "Monolith · Luna Max · OpenCode + AI Repo Template",
  monolith_luna_xhigh_fast_opencode: "Monolith · Luna Xhigh Fast · OpenCode",
  monolith_luna_max_fast_opencode: "Monolith · Luna Max Fast · OpenCode",
  monolith_sol_low_fast_opencode: "Monolith · Sol Low Fast · OpenCode",
  monolith_sol_medium_fast_opencode: "Monolith · Sol Medium Fast · OpenCode",
  monolith_grok_4_5_medium_cursor: "Monolith · Grok 4.5 Medium · Cursor",
  monolith_grok_4_5_high_cursor: "Monolith · Grok 4.5 High · Cursor",
  monolith_grok_4_5_medium_fast_cursor: "Monolith · Grok 4.5 Medium Fast · Cursor",
  monolith_grok_4_5_high_fast_cursor: "Monolith · Grok 4.5 High Fast · Cursor",
  monolith_auto_cursor: "Monolith · Auto Cost · Cursor",
  monolith_luna_xhigh_opencode_control: "Monolith · Luna Xhigh · OpenCode control",
  monolith_opus_5_medium_claude_code: "Monolith · Opus 5 Medium · Claude Code",
  monolith_sonnet_5_medium_claude_code: "Monolith · Sonnet 5 Medium · Claude Code",
  monolith_opus_5_medium_opencode: "Monolith · Opus 5 Medium · OpenCode",
  monolith_sonnet_5_medium_opencode: "Monolith · Sonnet 5 Medium · OpenCode",
  monolith_opus_5_medium_opencode_oauth: "Monolith · Opus 5 Medium · OpenCode OAuth",
};
const galleryAnchors = {
  monolith: "cold-cache-luna-max-monolith",
  native_dynamic: "native-dynamic-subagents",
  native_isolated: "native-subagents-with-isolated-issues",
  a2a: "synchronous-a2a",
  monolith_warm: "warm-cache-luna-max-monolith",
  a2a_async: "asynchronous-a2a",
  a2a_async_streaming_opencode: "asynchronous-streaming-a2a-with-luna-max-in-opencode",
  monolith_sol_medium: "monolith-with-sol-medium-in-codex",
  monolith_opencode: "monolith-with-luna-max-in-opencode",
  monolith_sol_medium_opencode: "monolith-with-sol-medium-in-opencode",
  monolith_sol_medium_opencode_api: "monolith-with-sol-medium-in-opencode-api",
  monolith_sol_low_opencode: "monolith-with-sol-low-in-opencode",
  monolith_sol_high_opencode: "monolith-with-sol-high-in-opencode",
  monolith_luna_xhigh_opencode: "monolith-with-luna-xhigh-in-opencode",
  monolith_luna_high_opencode: "monolith-with-luna-high-in-opencode",
  monolith_luna_max_codex_minimal: "monolith-with-luna-max-in-codex-minimal-context",
  monolith_luna_max_opencode_retest: "fresh-luna-max-opencode-control",
  monolith_luna_max_opencode_speckit: "monolithic-luna-max-opencode-with-spec-kit",
  dynamic_luna_max_opencode_superpowers: "luna-max-opencode-with-full-superpowers-methodology",
  monolith_luna_max_opencode_ai_repo_template: "monolithic-luna-max-opencode-with-ai-repo-template",
  monolith_luna_xhigh_fast_opencode: "monolith-with-luna-xhigh-fast-in-opencode",
  monolith_luna_max_fast_opencode: "monolith-with-luna-max-fast-in-opencode",
  monolith_sol_low_fast_opencode: "monolith-with-sol-low-fast-in-opencode",
  monolith_sol_medium_fast_opencode: "monolith-with-sol-medium-fast-in-opencode",
  monolith_grok_4_5_medium_cursor: "monolith-with-grok-45-medium-in-cursor",
  monolith_grok_4_5_high_cursor: "monolith-with-grok-45-high-in-cursor",
  monolith_grok_4_5_medium_fast_cursor: "monolith-with-grok-45-medium-fast-in-cursor",
  monolith_grok_4_5_high_fast_cursor: "monolith-with-grok-45-high-fast-in-cursor",
  monolith_auto_cursor: "monolith-with-auto-cost-in-cursor",
  monolith_luna_xhigh_opencode_control: "monolith-with-luna-xhigh-in-opencode-control",
  monolith_opus_5_medium_claude_code: "monolith-with-opus-5-medium-in-claude-code",
  monolith_sonnet_5_medium_claude_code: "monolith-with-sonnet-5-medium-in-claude-code",
  monolith_opus_5_medium_opencode: "monolith-with-opus-5-medium-in-opencode",
  monolith_sonnet_5_medium_opencode: "monolith-with-sonnet-5-medium-in-opencode",
  monolith_opus_5_medium_opencode_oauth: "monolith-with-opus-5-medium-in-opencode-via-oauth",
};
const galleryLink = row => `[${galleryLabels[row.treatment]}](#${galleryAnchors[row.treatment]})`;
const galleryRows = decisionRows.map(row =>
  `| **${galleryLink(row)}** | ${row.quality_score} | ${row.quality_gate} | $${f(row.estimated_api_cost_usd, 4)} | ${mmss(row.wall_seconds)} | ${f(row.total_tokens / 1e6, 3)}M | ${f(row.cached_input_tokens / 1e6, 3)}M | ${f(row.uncached_input_tokens / 1e6, 3)}M | ${f(row.cache_write_input_tokens / 1e6, 3)}M | ${f(row.output_tokens / 1e6, 3)}M | ${f(row.gate_adjusted_roi, 4)} |`
).join("\n");
const galleryTable = `| Candidate | Score | Gate | Cost | Time | Total tokens | Cached input | Uncached input | Cache writes | Output | Gate-adjusted ROI |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
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
const readmeSensitivity = sensitivityRows.map(row =>
  `| ${galleryLink(row)}${row.quality_gate_passed ? "" : " †"} | ${timeValueScenarios.map(scenario => f(row.quality_adjusted_efficiency[scenario.key], 2)).join(" | ")} |`
).join("\n");
const readmeSensitivityTable = `${sensitivityHeader}\n${readmeSensitivity}`;
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
  const metrics = `${marker}\n**Score ${row.quality_score}${baselineSuffix} · Cost $${f(row.estimated_api_cost_usd, 4)} · Time ${mmss(row.wall_seconds)} · Gate ${row.quality_gate} · Gate-adjusted ROI ${f(row.gate_adjusted_roi, 4)} · Pareto ε=${primaryQualityTolerance} ${paretoStatus}**<br>\nTokens: ${f(row.total_tokens / 1e6, 3)}M total · ${f(row.cached_input_tokens / 1e6, 3)}M cached input · ${f(row.uncached_input_tokens / 1e6, 3)}M uncached input · ${f(row.cache_write_input_tokens / 1e6, 3)}M cache writes · ${f(row.output_tokens / 1e6, 3)}M output`;
  const markerIndex = readme.indexOf(marker);
  const scoreLineStart = markerIndex + marker.length + 1;
  const tokensLineStart = readme.indexOf("Tokens:", scoreLineStart);
  const metricsEnd = readme.indexOf("\n", tokensLineStart);
  const existingMetrics = readme.slice(scoreLineStart, metricsEnd < 0 ? readme.length : metricsEnd);
  if (
    markerIndex < 0
    || tokensLineStart < 0
    || !existingMetrics.startsWith("**Score ")
    || !existingMetrics.includes("\nTokens:")
  ) {
    throw new Error(`README metrics marker missing or malformed: ${row.treatment}`);
  }
  readme = `${readme.slice(0, markerIndex)}${metrics}${readme.slice(metricsEnd < 0 ? readme.length : metricsEnd)}`;
}

// Keep the candidate gallery in the same descending gate-adjusted-ROI order as
// the generated results table. Non-candidate sections (such as exploratory
// continuations) retain their relative order after the ranked gallery.
const headingStarts = [...readme.matchAll(/^#{2,3} /gm)].map(match => match.index);
const candidateSections = [];
for (let index = 0; index < headingStarts.length; index += 1) {
  const start = headingStarts[index];
  const headingEnd = headingStarts[index + 1] ?? readme.length;
  const headingSection = readme.slice(start, headingEnd);
  const generatedSectionOffset = headingSection.indexOf("<!-- GENERATED_CONTINUATION_RESULTS_START -->");
  const end = generatedSectionOffset >= 0 ? start + generatedSectionOffset : headingEnd;
  const section = readme.slice(start, end);
  const marker = section.match(/<!-- GENERATED_METRICS:([a-z0-9_]+) -->/);
  if (marker) candidateSections.push({ treatment: marker[1], start, end, section });
}

const sectionsByTreatment = new Map(candidateSections.map(section => [section.treatment, section]));
for (const row of decisionRows) {
  if (!sectionsByTreatment.has(row.treatment)) {
    throw new Error(`README gallery section missing: ${row.treatment}`);
  }
}
if (candidateSections.length !== decisionRows.length) {
  throw new Error(`README gallery has ${candidateSections.length} candidate sections; expected ${decisionRows.length}`);
}

const galleryStart = Math.min(...candidateSections.map(section => section.start));
for (const section of [...candidateSections].sort((left, right) => right.start - left.start)) {
  readme = `${readme.slice(0, section.start)}${readme.slice(section.end)}`;
}
const orderedGallery = decisionRows.map(row => sectionsByTreatment.get(row.treatment).section).join("");
readme = `${readme.slice(0, galleryStart)}${orderedGallery}${readme.slice(galleryStart)}`;

fs.writeFileSync(readmePath, readme);
console.log(report);
