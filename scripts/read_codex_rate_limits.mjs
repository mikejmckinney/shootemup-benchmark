#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
const lines = createInterface({ input: child.stdout });
const timeout = setTimeout(() => finish({ error: "account/rateLimits/read timed out" }, 1), 15000);
let finished = false;

function send(message) { child.stdin.write(`${JSON.stringify(message)}\n`); }
function finish(value, code = 0) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  child.kill("SIGTERM");
  process.exitCode = code;
}

lines.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id === 0 && message.result) {
    send({ method: "initialized", params: {} });
    send({ method: "account/rateLimits/read", id: 1 });
  } else if (message.id === 0 && message.error) finish({ error: message.error }, 1);
  else if (message.id === 1) finish(message.error ? { error: message.error } : message.result);
});
child.once("error", (error) => finish({ error: error.message }, 1));
send({
  method: "initialize", id: 0,
  params: { clientInfo: { name: "shootemup_benchmark", title: "Shoot-em-up benchmark telemetry", version: "1.0.0" } },
});
