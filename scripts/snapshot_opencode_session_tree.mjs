#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith("--")) return null;
  return [value.slice(2), all[index + 1]];
}).filter(Boolean));

for (const required of ["db", "root-session", "output"]) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const db = new DatabaseSync(args.db, { readOnly: true });
const sessions = db.prepare(`
  WITH RECURSIVE selected AS (
    SELECT * FROM session WHERE id = ?
    UNION ALL
    SELECT child.* FROM session child
    JOIN selected parent ON child.parent_id = parent.id
  )
  SELECT DISTINCT id, parent_id, directory, title, cost, tokens_input,
    tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write,
    agent, model, time_created, time_updated
  FROM selected ORDER BY time_created, id
`).all(args["root-session"]);

if (!sessions.length) throw new Error(`Session not found: ${args["root-session"]}`);

const partStatement = db.prepare("SELECT data FROM part WHERE session_id = ? ORDER BY time_created, id");
let turns = 0;
let toolCalls = 0;
let coordinationToolCalls = 0;
const toolCounts = {};

for (const session of sessions) {
  for (const row of partStatement.all(session.id)) {
    let part;
    try { part = JSON.parse(row.data); } catch { continue; }
    if (part.type === "step-finish") turns += 1;
    if (part.type === "tool") {
      toolCalls += 1;
      const tool = String(part.tool ?? "unknown");
      toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
      if (["task", "delegate", "subagent"].includes(tool.toLowerCase())) coordinationToolCalls += 1;
    }
  }
}

const sum = field => sessions.reduce((total, session) => total + Number(session[field] ?? 0), 0);
const result = {
  source: "OpenCode SQLite recursive session tree",
  database: args.db,
  root_session: args["root-session"],
  captured_at: new Date().toISOString(),
  sessions_count: sessions.length,
  child_sessions: Math.max(0, sessions.length - 1),
  turns,
  tool_calls: toolCalls,
  coordination_tool_calls: coordinationToolCalls,
  tool_counts: toolCounts,
  usage: {
    input_tokens: sum("tokens_input") + sum("tokens_cache_read"),
    cached_input_tokens: sum("tokens_cache_read"),
    cache_write_input_tokens: sum("tokens_cache_write"),
    output_tokens: sum("tokens_output") + sum("tokens_reasoning"),
    reasoning_output_tokens: sum("tokens_reasoning")
  },
  provider_reported_cost_usd: sum("cost"),
  sessions: sessions.map(session => ({
    ...session,
    model: (() => { try { return JSON.parse(session.model); } catch { return session.model; } })()
  }))
};

db.close();
fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
