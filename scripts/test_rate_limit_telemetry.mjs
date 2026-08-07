#!/usr/bin/env node

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "rate-limit-telemetry-test-"));
let requests = 0;
const mock = http.createServer((request, response) => {
  requests += 1;
  if (requests === 1) {
    response.writeHead(429, {
      "content-type": "application/json",
      "retry-after": "0.01",
      "x-ratelimit-remaining-requests": "0",
      "x-request-id": "req_test_rate_limit",
    });
    response.end(JSON.stringify({ error: { type: "requests", code: "rate_limit_exceeded" } }));
  } else {
    response.writeHead(200, { "content-type": "application/json", "x-ratelimit-remaining-requests": "9" });
    response.end(JSON.stringify({ ok: true }));
  }
});

try {
  await listen(mock);
  const port = mock.address().port;
  const events = path.join(temporary, "events.jsonl");
  const summary = path.join(temporary, "summary.json");
  const disabled = path.join(temporary, "disabled.json");
  const childProgram = [
    "const base=process.env.OPENAI_RATE_LIMIT_OBSERVER_BASE_URL;",
    "const first=await fetch(base+'/responses',{method:'POST',body:'{}'});",
    "if(first.status!==429)process.exit(2);",
    "const second=await fetch(base+'/responses',{method:'POST',body:'{}'});",
    "if(second.status!==200)process.exit(3);",
  ].join("");
  await run(process.execPath, [
    "scripts/run_with_openai_rate_limit_observer.mjs", "--events", events,
    "--upstream", `http://127.0.0.1:${port}`, "--", process.execPath, "--input-type=module", "-e", childProgram,
  ]);
  await run(process.execPath, [
    "scripts/classify_rate_limits.mjs", "--enabled", "true", "--runtime", "opencode",
    "--auth-mode", "api_key", "--events", events, "--run-exit", "0", "--output", summary,
  ]);
  await run(process.execPath, [
    "scripts/classify_rate_limits.mjs", "--enabled", "false", "--runtime", "opencode",
    "--auth-mode", "api_key", "--run-exit", "0", "--output", disabled,
  ]);
  const observed = JSON.parse(await readFile(summary, "utf8"));
  const skipped = JSON.parse(await readFile(disabled, "utf8"));
  if (observed.classification !== "rate_limited_recovered" || observed.temporary_rate_limit_events !== 1) {
    throw new Error(`unexpected enabled result: ${JSON.stringify(observed)}`);
  }
  if (skipped.classification !== "not_observed" || skipped.evidence_level !== "disabled") {
    throw new Error(`unexpected disabled result: ${JSON.stringify(skipped)}`);
  }
  process.stdout.write("rate-limit telemetry tests passed\n");
} finally {
  await new Promise((resolve) => mock.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
