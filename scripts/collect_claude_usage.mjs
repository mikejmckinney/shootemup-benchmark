#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith("--")) return null;
  return [value.slice(2), all[index + 1]];
}).filter(Boolean));

for (const required of ["session", "output", "expected-model"]) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const events = fs.readFileSync(args.session, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid Claude stream JSON at line ${index + 1}: ${error.message}`); }
  });

const initEvents = events.filter(event => event.type === "system" && event.subtype === "init");
const resultEvents = events.filter(event => event.type === "result" && event.usage);
if (initEvents.length !== 1) throw new Error(`Expected exactly one Claude init event, found ${initEvents.length}`);
if (resultEvents.length !== 1) throw new Error(`Expected exactly one Claude result usage event, found ${resultEvents.length}`);

const init = initEvents[0];
const resultEvent = resultEvents[0];
if (init.model !== args["expected-model"]) {
  throw new Error(`Claude model mismatch: expected ${args["expected-model"]}, observed ${init.model}`);
}

const usage = resultEvent.usage;
const cacheCreation = usage.cache_creation ?? {};
const cacheWrite5m = Number(cacheCreation.ephemeral_5m_input_tokens ?? 0);
const cacheWrite1h = Number(cacheCreation.ephemeral_1h_input_tokens ?? 0);
const cacheWrite = Number(usage.cache_creation_input_tokens ?? cacheWrite5m + cacheWrite1h);
if (cacheWrite !== cacheWrite5m + cacheWrite1h) {
  throw new Error(`Claude cache-write breakdown mismatch: ${cacheWrite} != ${cacheWrite5m} + ${cacheWrite1h}`);
}

const assistantEvents = events.filter(event => event.type === "assistant");
const contentBlocks = assistantEvents.flatMap(event => event.message?.content ?? []);
const toolUseBlocks = contentBlocks.filter(block => block.type === "tool_use");
const toolCounts = {};
for (const block of toolUseBlocks) {
  const key = block.name ?? "unknown";
  toolCounts[key] = (toolCounts[key] ?? 0) + 1;
}
const prohibitedAgentTools = new Set(["Agent", "ListAgents", "SendMessage", "RemoteTrigger", "EnterWorktree", "ExitWorktree"]);
const prohibitedAgentToolCalls = toolUseBlocks.filter(block => prohibitedAgentTools.has(block.name)).length;

const artifact = {
  source: "Claude Code terminal result usage event",
  session_id: init.session_id ?? resultEvent.session_id ?? null,
  model: init.model,
  service_tier: usage.service_tier ?? null,
  speed: usage.speed ?? null,
  duration_ms: resultEvent.duration_ms ?? null,
  duration_api_ms: resultEvent.duration_api_ms ?? null,
  turns: Number(resultEvent.num_turns ?? assistantEvents.length),
  tool_events: toolUseBlocks.length,
  tool_counts: toolCounts,
  prohibited_agent_tool_calls: prohibitedAgentToolCalls,
  usage: {
    // Repository convention: input_tokens contains ordinary input plus cache
    // reads; cache writes are retained as a separate, disjoint category.
    input_tokens: Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0),
    cached_input_tokens: Number(usage.cache_read_input_tokens ?? 0),
    cache_write_input_tokens: cacheWrite,
    cache_write_5m_input_tokens: cacheWrite5m,
    cache_write_1h_input_tokens: cacheWrite1h,
    output_tokens: Number(usage.output_tokens ?? 0),
    reasoning_output_tokens: 0,
  },
  provider_reported_cost_usd: resultEvent.total_cost_usd ?? null,
  raw_usage: usage,
};

fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(artifact, null, 2)}\n`);
