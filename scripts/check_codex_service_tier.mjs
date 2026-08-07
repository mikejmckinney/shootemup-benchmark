#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, index, all) => (value.startsWith("--") ? [value.slice(2), all[index + 1]] : null))
    .filter(Boolean),
);

const model = args.model ?? "gpt-5.6-luna";
const effort = args.effort ?? "xhigh";
const requestedTier = args.tier ?? "priority";
const expectedTier = args.expect ?? requestedTier;
const output = args.output ? path.resolve(args.output) : undefined;
const codex = args.codex ?? "codex";
const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-tier-preflight."));

const write = (result) => {
  const value = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, value);
  }
  process.stdout.write(value);
};

try {
  const git = spawnSync("git", ["-C", probeDir, "init", "-q"], { encoding: "utf8" });
  if (git.status !== 0) throw new Error(`git init failed: ${git.stderr.trim()}`);

  const started = performance.now();
  const run = spawnSync(
    codex,
    [
      "exec",
      "--strict-config",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "--cd",
      probeDir,
      "--model",
      model,
      "-c",
      'model_provider="openai-http-diagnostic"',
      "-c",
      `model_reasoning_effort=${JSON.stringify(effort)}`,
      "-c",
      `service_tier=${JSON.stringify(requestedTier)}`,
      "-c",
      "features.multi_agent=false",
      "-c",
      'model_providers.openai-http-diagnostic={name="OpenAI HTTP diagnostic",wire_api="responses",requires_openai_auth=true,supports_websockets=false}',
      "Reply with exactly the word OK.",
    ],
    {
      encoding: "utf8",
      timeout: 180_000,
      killSignal: "SIGINT",
      env: { ...process.env, RUST_LOG: "codex_api::sse::responses=trace" },
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const durationMs = Math.round(performance.now() - started);

  let threadID;
  let usage;
  for (const line of run.stdout.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") threadID = event.thread_id;
      if (event.type === "turn.completed") usage = event.usage;
    } catch {
      // Ignore non-JSON CLI lines.
    }
  }

  let createdTier;
  let completedTier;
  let responseModel;
  let responseUsage;
  for (const line of run.stderr.split(/\r?\n/)) {
    const marker = "SSE event: ";
    const index = line.indexOf(marker);
    if (index < 0) continue;
    try {
      const event = JSON.parse(line.slice(index + marker.length));
      if (event.type === "response.created") createdTier = event.response?.service_tier;
      if (event.type === "response.completed") {
        completedTier = event.response?.service_tier;
        responseModel = event.response?.model;
        responseUsage = event.response?.usage;
      }
    } catch {
      // The trace also contains non-JSON diagnostic lines.
    }
  }

  const valid = run.status === 0 && completedTier === expectedTier;
  write({
    checked_at: new Date().toISOString(),
    valid,
    runtime: "codex",
    codex_exit_code: run.status,
    thread_id: threadID ?? null,
    model,
    response_model: responseModel ?? null,
    reasoning_effort: effort,
    requested_tier: requestedTier,
    expected_tier: expectedTier,
    response_created_tier: createdTier ?? null,
    response_completed_tier: completedTier ?? null,
    duration_ms: durationMs,
    usage: responseUsage ?? usage ?? null,
    error:
      run.error?.message ??
      (run.status === 0 ? null : `Codex preflight exited ${run.status ?? "without a status"}`),
  });
  process.exitCode = valid ? 0 : 2;
} catch (error) {
  write({
    checked_at: new Date().toISOString(),
    valid: false,
    runtime: "codex",
    model,
    reasoning_effort: effort,
    requested_tier: requestedTier,
    expected_tier: expectedTier,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  fs.rmSync(probeDir, { recursive: true, force: true });
}
