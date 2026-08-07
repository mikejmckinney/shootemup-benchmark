#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) =>
  value.startsWith("--") ? [value.slice(2), all[index + 1]] : null).filter(Boolean));
const cursor = args.cursor ?? process.env.CURSOR_AGENT ?? "cursor-agent";
const model = args.model;
const expectedLabel = args["expected-label"];
const output = args.output ? path.resolve(args.output) : null;
if (!model || !expectedLabel) throw new Error("--model and --expected-label are required");

function write(result) {
  const value = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, value);
  }
  process.stdout.write(value);
}

const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-model-preflight-"));
try {
  const git = spawnSync("git", ["-C", probeDir, "init", "-q"], { encoding: "utf8" });
  if (git.status !== 0) throw new Error(`git init failed: ${git.stderr.trim()}`);

  const listed = spawnSync(cursor, ["--list-models"], { encoding: "utf8", timeout: 60_000 });
  const available = listed.status === 0 && listed.stdout.split(/\r?\n/)
    .some((line) => line.trim().startsWith(`${model} -`));

  const started = performance.now();
  const run = spawnSync(cursor, [
    "-p", "--output-format", "stream-json", "--model", model,
    "--workspace", probeDir, "--trust", "--sandbox", "disabled", "--force",
    "Reply with exactly the word OK.",
  ], { encoding: "utf8", timeout: 180_000, killSignal: "SIGINT", maxBuffer: 32 * 1024 * 1024 });
  const durationMs = Math.round(performance.now() - started);
  const events = run.stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const result = events.find((event) => event.type === "result");
  const observedLabel = init?.model ?? null;
  const valid = available && run.status === 0 && result?.subtype === "success" &&
    result?.is_error === false && observedLabel === expectedLabel;

  write({
    checked_at: new Date().toISOString(),
    valid,
    runtime: "cursor",
    cursor_version: spawnSync(cursor, ["--version"], { encoding: "utf8" }).stdout.trim() || null,
    requested_model_id: model,
    requested_model_available: available,
    expected_initialization_label: expectedLabel,
    observed_initialization_label: observedLabel,
    authentication_source: init?.apiKeySource ?? null,
    cursor_exit_code: run.status,
    result_subtype: result?.subtype ?? null,
    duration_ms: durationMs,
    duration_api_ms: result?.duration_api_ms ?? null,
    session_id: result?.session_id ?? init?.session_id ?? null,
    request_id: result?.request_id ?? null,
    usage: result?.usage ?? null,
    verification_scope: model === "auto"
      ? "Cursor confirmed the Auto router selection; the downstream model and tier are not exposed in CLI telemetry."
      : "Cursor confirmed the exact requested model variant through its server initialization event.",
    error: run.error?.message ?? (valid ? null : run.stderr.trim() || "Cursor model preflight did not match"),
  });
  process.exitCode = valid ? 0 : 2;
} catch (error) {
  write({
    checked_at: new Date().toISOString(), valid: false, runtime: "cursor",
    requested_model_id: model, expected_initialization_label: expectedLabel,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  fs.rmSync(probeDir, { recursive: true, force: true });
}
