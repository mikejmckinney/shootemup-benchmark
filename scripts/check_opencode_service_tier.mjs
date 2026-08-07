#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, index, all) => (value.startsWith("--") ? [value.slice(2), all[index + 1]] : null))
    .filter(Boolean),
);

const authMode = args["auth-mode"] ?? "oauth";
const authPath = args.auth ?? "/home/codespace/.local/share/opencode/auth.json";
const oauthEndpoint = args.endpoint ?? "https://chatgpt.com/backend-api/codex/responses";
const opencode = args.opencode ?? "/home/codespace/.opencode/bin/opencode";
const model = args.model ?? "gpt-5.6-luna";
const opencodeModel = args["opencode-model"] ?? `openai/${model}-fast`;
const effort = args.effort ?? "xhigh";
const requestedTier = args.tier ?? "priority";
const expectedTier = args.expect ?? requestedTier;
const output = args.output ? path.resolve(args.output) : undefined;

const writeResult = (result) => {
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, serialized);
  }
  process.stdout.write(serialized);
};

const finish = (result, exitCode = result.valid ? 0 : 2) => {
  writeResult(result);
  process.exit(exitCode);
};

const safeError = (error) => (error instanceof Error ? error.message : String(error));

async function runOAuthProbe() {
  const fail = (message, details = {}) => finish({
    checked_at: new Date().toISOString(),
    valid: false,
    runtime: "opencode",
    auth_mode: "oauth",
    model,
    requested_tier: requestedTier,
    expected_tier: expectedTier,
    error: message,
    ...details,
  }, 1);

  if (!fs.existsSync(authPath)) fail("OpenCode auth file not found");

  let auth;
  try {
    auth = JSON.parse(fs.readFileSync(authPath, "utf8")).openai;
  } catch {
    fail("OpenCode auth file is not valid JSON");
  }

  if (auth?.type !== "oauth" || !auth.access || !auth.accountId) {
    fail("OpenCode OAuth access token and account ID are required");
  }
  if (Number(auth.expires) <= Date.now()) {
    fail("OpenCode OAuth access token is expired; refresh it through OpenCode before retrying");
  }

  const body = {
    model,
    instructions: "You are a concise transport diagnostic. Follow the user instruction exactly.",
    input: [{ role: "user", content: [{ type: "input_text", text: "Reply with exactly the word OK." }] }],
    stream: true,
    store: false,
    reasoning: { effort, summary: "auto" },
    include: ["reasoning.encrypted_content"],
    service_tier: requestedTier,
  };

  const started = performance.now();
  let response;
  let raw;
  try {
    response = await fetch(oauthEndpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.access}`,
        "chatgpt-account-id": auth.accountId,
        "content-type": "application/json",
        accept: "text/event-stream",
        "user-agent": "shootemup-benchmark-tier-preflight/1.0",
      },
      body: JSON.stringify(body),
    });
    raw = await response.text();
  } catch (error) {
    fail("Service-tier preflight transport failed", {
      duration_ms: Math.round(performance.now() - started),
      detail: safeError(error),
    });
  }

  const durationMs = Math.round(performance.now() - started);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.detail ?? parsed.error?.message ?? detail;
    } catch {}
    fail("Service-tier preflight request was rejected", {
      http_status: response.status,
      duration_ms: durationMs,
      detail,
    });
  }

  let createdTier;
  let completedTier;
  let usage;
  let responseError;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const event = JSON.parse(data);
      if (event.type === "response.created") createdTier = event.response?.service_tier;
      if (event.type === "response.completed") {
        completedTier = event.response?.service_tier;
        usage = event.response?.usage;
      }
      if (event.type === "error") {
        responseError = {
          status: event.status,
          type: event.error?.type,
          message: event.error?.message,
        };
      }
    } catch {}
  }

  finish({
    checked_at: new Date().toISOString(),
    valid: completedTier === expectedTier,
    runtime: "opencode",
    auth_mode: "oauth",
    model,
    reasoning_effort: effort,
    requested_tier: requestedTier,
    expected_tier: expectedTier,
    response_created_tier: createdTier ?? null,
    response_completed_tier: completedTier ?? null,
    http_status: response.status,
    duration_ms: durationMs,
    usage: usage ?? null,
    response_error: responseError ?? null,
  });
}

async function runApiKeyOpenCodeProbe() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    finish({
      checked_at: new Date().toISOString(),
      valid: false,
      runtime: "opencode",
      auth_mode: "api_key",
      model,
      opencode_model: opencodeModel,
      requested_tier: requestedTier,
      expected_tier: expectedTier,
      error: "OPENAI_API_KEY is not set",
    }, 1);
  }
  if (!fs.existsSync(opencode)) {
    finish({
      checked_at: new Date().toISOString(),
      valid: false,
      runtime: "opencode",
      auth_mode: "api_key",
      model,
      opencode_model: opencodeModel,
      requested_tier: requestedTier,
      expected_tier: expectedTier,
      error: "OpenCode executable not found",
    }, 1);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-fast-preflight-"));
  const started = performance.now();
  let observedRequest;
  let observedResponse;

  const server = http.createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const rawRequest = Buffer.concat(chunks).toString("utf8");
      let requestBody = {};
      try { requestBody = JSON.parse(rawRequest); } catch {}
      observedRequest = {
        method: request.method,
        path: request.url,
        model: requestBody.model ?? null,
        service_tier: requestBody.service_tier ?? null,
        stream: requestBody.stream ?? null,
        reasoning_effort: requestBody.reasoning?.effort ?? null,
      };

      const upstream = await fetch(`https://api.openai.com${request.url}`, {
        method: request.method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": request.headers["content-type"] ?? "application/json",
          accept: request.headers.accept ?? "text/event-stream",
        },
        body: rawRequest,
      });
      const rawResponse = Buffer.from(await upstream.arrayBuffer());
      const responseText = rawResponse.toString("utf8");
      let createdTier;
      let completedTier;
      let responseModel;
      let usage;
      let responseError;
      for (const line of responseText.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "response.created") createdTier = event.response?.service_tier;
          if (event.type === "response.completed") {
            completedTier = event.response?.service_tier;
            responseModel = event.response?.model;
            usage = event.response?.usage;
          }
          if (event.type === "error") responseError = event.error ?? event;
        } catch {}
      }
      observedResponse = {
        http_status: upstream.status,
        response_created_tier: createdTier ?? null,
        response_completed_tier: completedTier ?? null,
        response_model: responseModel ?? null,
        usage: usage ?? null,
        error: responseError ? {
          type: responseError.type ?? null,
          code: responseError.code ?? null,
          message: responseError.message ?? null,
        } : null,
      };
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      });
      response.end(rawResponse);
    } catch (error) {
      observedResponse = { error: { message: safeError(error) } };
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Local preflight observer failed" } }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}/v1`;
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: { openai: { options: { apiKey: "{env:OPENAI_API_KEY}", baseURL } } },
  };
  const childEnv = {
    ...process.env,
    HOME: path.join(tempRoot, "home"),
    XDG_DATA_HOME: path.join(tempRoot, "data"),
    XDG_CONFIG_HOME: path.join(tempRoot, "config"),
    XDG_CACHE_HOME: path.join(tempRoot, "cache"),
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
  };

  const child = spawn(opencode, [
    "run", "--pure", "--format", "json", "--model", opencodeModel,
    "--variant", effort, "Reply with exactly: OK",
  ], { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve) => child.once("close", resolve));
  await new Promise((resolve) => server.close(resolve));

  let opencodeUsage;
  let opencodeCost;
  for (const line of stdout.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event.type === "step_finish") {
        opencodeUsage = event.part?.tokens;
        opencodeCost = event.part?.cost;
      }
    } catch {}
  }

  const requestTierMatches = requestedTier === "default"
    ? observedRequest?.service_tier == null
    : observedRequest?.service_tier === requestedTier;
  const valid = exitCode === 0
    && observedRequest?.model === model
    && requestTierMatches
    && observedRequest?.reasoning_effort === effort
    && observedResponse?.response_model === model
    && observedResponse?.response_completed_tier === expectedTier;
  const result = {
    checked_at: new Date().toISOString(),
    valid,
    runtime: "opencode",
    auth_mode: "api_key",
    model,
    opencode_model: opencodeModel,
    reasoning_effort: effort,
    requested_tier: requestedTier,
    expected_tier: expectedTier,
    opencode_exit_code: exitCode,
    duration_ms: Math.round(performance.now() - started),
    request: observedRequest ?? null,
    response: observedResponse ?? null,
    opencode_usage: opencodeUsage ?? null,
    opencode_reported_cost_usd: opencodeCost ?? null,
    stderr_present: stderr.trim().length > 0,
  };

  // The directory was created by this process solely for the isolated probe.
  fs.rmSync(tempRoot, { recursive: true, force: true });
  finish(result);
}

if (authMode === "api-key" || authMode === "api_key") {
  await runApiKeyOpenCodeProbe();
} else if (authMode === "oauth") {
  await runOAuthProbe();
} else {
  finish({
    checked_at: new Date().toISOString(),
    valid: false,
    runtime: "opencode",
    auth_mode: authMode,
    error: `Unsupported --auth-mode: ${authMode}`,
  }, 1);
}
