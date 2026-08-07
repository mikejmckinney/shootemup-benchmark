#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith("--")) return null;
  return [value.slice(2), all[index + 1]];
}).filter(Boolean));

for (const required of ["session", "output"]) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const events = fs.readFileSync(args.session, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid Cursor JSONL at line ${index + 1}: ${error.message}`); }
  });
const resultEvents = events.filter(event => event.type === "result" && event.usage);
if (resultEvents.length !== 1) {
  throw new Error(`Expected exactly one Cursor result usage event, found ${resultEvents.length}`);
}

const resultEvent = resultEvents[0];
const usage = resultEvent.usage;
const toolEvents = events.filter(event => String(event.type).includes("tool"));
const toolCounts = {};
for (const event of toolEvents) {
  const key = event.subtype ?? event.tool_name ?? event.name ?? event.type;
  toolCounts[key] = (toolCounts[key] ?? 0) + 1;
}
const subagentEvents = events.filter(event => /subagent|delegate|worker/i.test(JSON.stringify({
  type: event.type,
  subtype: event.subtype,
  tool_name: event.tool_name,
  name: event.name,
}))).length;

const result = {
  source: "Cursor Agent CLI terminal result event",
  session_id: resultEvent.session_id ?? null,
  request_id: resultEvent.request_id ?? null,
  model: events.find(event => event.type === "system" && event.subtype === "init")?.model ?? null,
  duration_ms: resultEvent.duration_ms ?? null,
  duration_api_ms: resultEvent.duration_api_ms ?? null,
  turns: events.filter(event => event.type === "assistant").length,
  tool_events: toolEvents.length,
  tool_counts: toolCounts,
  subagent_events: subagentEvents,
  usage: {
    input_tokens: Number(usage.inputTokens ?? 0) + Number(usage.cacheReadTokens ?? 0),
    cached_input_tokens: Number(usage.cacheReadTokens ?? 0),
    cache_write_input_tokens: Number(usage.cacheWriteTokens ?? 0),
    output_tokens: Number(usage.outputTokens ?? 0),
    reasoning_output_tokens: 0,
  },
  raw_usage: usage,
};

fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
