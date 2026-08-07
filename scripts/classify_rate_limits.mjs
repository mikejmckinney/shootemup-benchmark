#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) options[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!options.output) throw new Error("--output is required");
  return options;
}

async function text(file) {
  if (!file) return "";
  try { return await readFile(file, "utf8"); } catch { return ""; }
}

async function json(file) {
  const value = await text(file);
  try { return JSON.parse(value); } catch { return null; }
}

const options = parseArgs(process.argv.slice(2));
const enabled = !["false", "0", "no"].includes((options.enabled ?? "true").toLowerCase());
const runExit = Number(options["run-exit"] ?? 0);
const eventLines = (await text(options.events)).split(/\r?\n/).filter(Boolean);
const events = eventLines.flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
const sessionText = await text(options.session);
const structuredErrors = sessionText.split(/\r?\n/).filter(Boolean).flatMap((line) => {
  try {
    const event = JSON.parse(line);
    const isError = event?.is_error === true || /error|failed/i.test(`${event?.type ?? ""} ${event?.subtype ?? ""}`) || event?.error;
    return isError ? [JSON.stringify({ type: event.type, subtype: event.subtype, error: event.error, message: event.message, result: event.result })] : [];
  } catch { return []; }
});
const runtimeText = `${structuredErrors.join("\n")}\n${await text(options.stderr)}`.toLowerCase();
const before = await json(options.before);
const after = await json(options.after);

const quotaCodes = new Set([
  "credit_balance_exhausted", "organization_spend_limit_exceeded", "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded", "insufficient_quota", "billing_hard_limit_reached",
]);
const rateEvents = events.filter((event) => event.status === 429 || (
  event.status === 503 && /slow[_ -]?down|rate[_ -]?limit/.test(`${event.error?.code ?? ""} ${event.error?.type ?? ""}`)
));
const quotaEvents = rateEvents.filter((event) => quotaCodes.has(event.error?.code));
const temporaryEvents = rateEvents.filter((event) => !quotaCodes.has(event.error?.code));
const observerErrors = events.filter((event) => event.observer_error);
const logQuota = [...quotaCodes].some((code) => runtimeText.includes(code));
const logRateLimit = /rate[_ -]?limit[_ -]?exceeded|rate limit (?:has been )?reached|too many requests|slow down|http[^\n]{0,20}429/.test(runtimeText);

function reached(snapshot) {
  const result = snapshot?.result ?? snapshot;
  const limits = [result?.rateLimits, ...Object.values(result?.rateLimitsByLimitId ?? {})].filter(Boolean);
  return limits.flatMap((limit) => limit.rateLimitReachedType ? [{ limit_id: limit.limitId ?? null, reached_type: limit.rateLimitReachedType }] : []);
}
const oauthReachedBefore = reached(before);
const oauthReachedAfter = reached(after);
const hasOauthSnapshot = [before, after].some((snapshot) => {
  const result = snapshot?.result ?? snapshot;
  return Boolean(result?.rateLimits || result?.rateLimitsByLimitId);
});

let classification;
if (!enabled) classification = "not_observed";
else if (quotaEvents.length || logQuota) classification = "quota_or_billing_blocked";
else if (oauthReachedAfter.length) classification = "oauth_usage_limit_reached";
else if (temporaryEvents.length || logRateLimit) classification = runExit === 0 ? "rate_limited_recovered" : "rate_limited_terminal";
else if (options["auth-mode"] === "api_key" && options.events && !observerErrors.length) classification = "not_rate_limited";
else classification = "no_explicit_rate_limit_observed";

const retryAfterSeconds = rateEvents.map((event) => Number(event.headers?.["retry-after"])).filter(Number.isFinite);
const observedRetryDelaySeconds = rateEvents.flatMap((event) => {
  const completed = Date.parse(event.observed_at);
  const retry = events.find((candidate) => candidate !== event && candidate.method === event.method &&
    candidate.path === event.path && Date.parse(candidate.started_at) >= completed);
  if (!retry || !Number.isFinite(completed)) return [];
  return [Math.max(0, (Date.parse(retry.started_at) - completed) / 1000)];
});
const numericHeader = (name) => events.map((event) => Number(event.headers?.[name])).filter(Number.isFinite);
const summary = {
  schema_version: 1,
  telemetry_enabled: enabled,
  classification,
  runtime: options.runtime ?? null,
  auth_mode: options["auth-mode"] ?? null,
  evidence_level: !enabled ? "disabled" : options.events ? "api_transport_and_runtime_logs" : hasOauthSnapshot ? "oauth_snapshots_and_runtime_logs" : "runtime_logs_only",
  run_exit_code: runExit,
  observed_api_responses: events.length,
  temporary_rate_limit_events: temporaryEvents.length,
  quota_or_billing_events: quotaEvents.length + (logQuota ? 1 : 0),
  observer_errors: observerErrors.length,
  retry_after_seconds: retryAfterSeconds,
  observed_retry_delay_seconds: observedRetryDelaySeconds,
  minimum_remaining_requests: Math.min(...numericHeader("x-ratelimit-remaining-requests"), Infinity),
  minimum_remaining_tokens: Math.min(...numericHeader("x-ratelimit-remaining-tokens"), Infinity),
  oauth_limits_reached_before: oauthReachedBefore,
  oauth_limits_reached_after: oauthReachedAfter,
  sources: {
    transport_events: options.events ?? null,
    session_log: options.session ?? null,
    stderr_log: options.stderr ?? null,
    before_snapshot: options.before ?? null,
    after_snapshot: options.after ?? null,
  },
};
if (!Number.isFinite(summary.minimum_remaining_requests)) summary.minimum_remaining_requests = null;
if (!Number.isFinite(summary.minimum_remaining_tokens)) summary.minimum_remaining_tokens = null;
await writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`);
