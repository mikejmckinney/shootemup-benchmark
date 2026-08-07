#!/usr/bin/env node

import http from "node:http";
import { spawn } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { constants as osConstants } from "node:os";

function parseArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator < 0 || separator === argv.length - 1) {
    throw new Error("usage: run_with_openai_rate_limit_observer.mjs --events FILE [--upstream URL] -- COMMAND [ARGS...]");
  }
  const options = { upstream: "https://api.openai.com", events: "" };
  for (let index = 0; index < separator; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--events") options.events = value;
    else if (key === "--upstream") options.upstream = value;
    else throw new Error(`unknown option: ${key}`);
  }
  if (!options.events) throw new Error("--events is required");
  return { ...options, command: argv.slice(separator + 1) };
}

function selectedHeaders(headers) {
  const names = [
    "retry-after", "x-request-id", "openai-request-id",
    "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens",
    "x-ratelimit-limit-project-tokens", "x-ratelimit-remaining-project-tokens",
    "x-ratelimit-reset-project-tokens",
  ];
  return Object.fromEntries(names.flatMap((name) => {
    const value = headers.get(name);
    return value == null ? [] : [[name, value]];
  }));
}

function extractError(text, contentType) {
  try {
    const payload = JSON.parse(text);
    const error = payload?.error ?? payload;
    return error && typeof error === "object"
      ? { code: error.code ?? null, type: error.type ?? null }
      : null;
  } catch {}

  if (contentType.includes("text/event-stream")) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const value = line.slice(5).trim();
      if (!value || value === "[DONE]") continue;
      try {
        const payload = JSON.parse(value);
        const error = payload?.error ?? (payload?.type === "error" ? payload : null);
        if (error) return { code: error.code ?? null, type: error.type ?? payload?.type ?? null };
      } catch {}
    }
  }
  return null;
}

const { events, upstream, command } = parseArgs(process.argv.slice(2));
await mkdir(path.dirname(events), { recursive: true });
const upstreamUrl = new URL(upstream);

const server = http.createServer(async (request, response) => {
  const startedAt = Date.now();
  const requestUrl = new URL(request.url ?? "/", upstreamUrl);
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value == null || ["host", "connection", "content-length"].includes(name.toLowerCase())) continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else headers.set(name, value);
  }

  try {
    const hasBody = !["GET", "HEAD"].includes(request.method ?? "GET");
    const upstreamResponse = await fetch(requestUrl, {
      method: request.method,
      headers,
      body: hasBody ? Readable.toWeb(request) : undefined,
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
    });

    response.statusCode = upstreamResponse.status;
    for (const [name, value] of upstreamResponse.headers.entries()) {
      if (["connection", "content-encoding", "content-length", "transfer-encoding"].includes(name.toLowerCase())) continue;
      response.setHeader(name, value);
    }

    const captured = [];
    let capturedBytes = 0;
    const captureLimit = 256 * 1024;
    if (upstreamResponse.body) {
      const reader = upstreamResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write(value);
        if (capturedBytes < captureLimit) {
          const slice = value.subarray(0, captureLimit - capturedBytes);
          captured.push(slice);
          capturedBytes += slice.byteLength;
        }
      }
    }
    response.end();

    const bodyText = Buffer.concat(captured.map((chunk) => Buffer.from(chunk))).toString("utf8");
    const event = {
      started_at: new Date(startedAt).toISOString(),
      observed_at: new Date().toISOString(),
      method: request.method,
      path: requestUrl.pathname,
      status: upstreamResponse.status,
      duration_ms: Date.now() - startedAt,
      headers: selectedHeaders(upstreamResponse.headers),
      error: extractError(bodyText, upstreamResponse.headers.get("content-type") ?? ""),
    };
    await appendFile(events, `${JSON.stringify(event)}\n`);
  } catch (error) {
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { type: "observer_upstream_error", code: "observer_upstream_error" } }));
    await appendFile(events, `${JSON.stringify({
      started_at: new Date(startedAt).toISOString(), observed_at: new Date().toISOString(),
      method: request.method, path: requestUrl.pathname,
      status: 0, duration_ms: Date.now() - startedAt, observer_error: error?.code ?? error?.name ?? "unknown",
    })}\n`);
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/v1`;
let config = {};
try { config = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT || "{}"); } catch {}
config.provider ??= {};
config.provider.openai ??= {};
config.provider.openai.options ??= {};
config.provider.openai.options.baseURL = baseUrl;

const child = spawn(command[0], command.slice(1), {
  stdio: ["inherit", "inherit", "inherit"],
  env: {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENAI_RATE_LIMIT_OBSERVER_BASE_URL: baseUrl,
  },
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
const outcome = await new Promise((resolve) => {
  child.once("error", (error) => resolve({ code: 127, error }));
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
await new Promise((resolve) => server.close(resolve));
if (outcome.error) process.stderr.write(`rate-limit observer could not launch command: ${outcome.error.message}\n`);
if (outcome.signal) process.exit(128 + (osConstants.signals[outcome.signal] ?? 1));
process.exit(outcome.code ?? 1);
