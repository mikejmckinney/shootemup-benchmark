#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith("--")) return null;
  return [value.slice(2), all[index + 1]];
}).filter(Boolean));

for (const required of ["db", "candidate-dir", "started-ms", "ended-ms", "output"]) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const candidateDir = path.resolve(args["candidate-dir"]);
const startedMs = Number(args["started-ms"]);
const endedMs = Number(args["ended-ms"]);
const db = new DatabaseSync(args.db, { readOnly: true });

// Select roots created in this candidate directory during the run, then follow
// parent_id so worktree-based child sessions remain attributable to the run.
const sessions = db.prepare(`
  WITH RECURSIVE selected AS (
    SELECT * FROM session
    WHERE time_created >= ? AND time_created <= ?
      AND (directory = ? OR directory LIKE ?)
    UNION
    SELECT child.* FROM session child
    JOIN selected parent ON child.parent_id = parent.id
    WHERE child.time_created >= ? AND child.time_created <= ?
  )
  SELECT DISTINCT id, project_id, workspace_id, parent_id, slug, directory,
    title, version, cost, tokens_input, tokens_output, tokens_reasoning,
    tokens_cache_read, tokens_cache_write, agent, model, time_created, time_updated
  FROM selected ORDER BY time_created, id
`).all(startedMs - 5000, endedMs + 60000, candidateDir, `${candidateDir}/%`, startedMs - 5000, endedMs + 60000);

const sessionIds = new Set(sessions.map(session => session.id));
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
      const tool = part.tool ?? "unknown";
      toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
      if (["task", "delegate", "subagent"].includes(String(tool).toLowerCase())) coordinationToolCalls += 1;
    }
  }
}

const childSessions = sessions.filter(session => session.parent_id && sessionIds.has(session.parent_id));
const events = sessions.flatMap(session => [
  { time: session.time_created, delta: 1 },
  { time: Math.max(session.time_created, session.time_updated) + 1, delta: -1 },
]).sort((a, b) => a.time - b.time || a.delta - b.delta);
let active = 0;
let peakConcurrentAgents = 0;
for (const event of events) {
  active += event.delta;
  peakConcurrentAgents = Math.max(peakConcurrentAgents, active);
}

const sum = field => sessions.reduce((total, session) => total + Number(session[field] ?? 0), 0);
const result = {
  source: "OpenCode SQLite session ledger",
  database: args.db,
  selection: {
    candidate_directory: candidateDir,
    started_ms: startedMs,
    ended_ms: endedMs,
    rule: "sessions rooted in candidate directory during run, plus recursive parent_id descendants",
  },
  agents_started: sessions.length,
  root_sessions: sessions.filter(session => !session.parent_id || !sessionIds.has(session.parent_id)).length,
  child_sessions: childSessions.length,
  peak_concurrent_agents: peakConcurrentAgents,
  turns,
  tool_calls: toolCalls,
  coordination_events: Math.max(childSessions.length, coordinationToolCalls),
  coordination_tool_calls: coordinationToolCalls,
  tool_counts: toolCounts,
  usage: {
    input_tokens: sum("tokens_input") + sum("tokens_cache_read"),
    cached_input_tokens: sum("tokens_cache_read"),
    cache_write_input_tokens: sum("tokens_cache_write"),
    output_tokens: sum("tokens_output") + sum("tokens_reasoning"),
    reasoning_output_tokens: sum("tokens_reasoning"),
  },
  provider_reported_cost_usd: sum("cost"),
  sessions: sessions.map(session => ({
    ...session,
    model: (() => { try { return JSON.parse(session.model); } catch { return session.model; } })(),
  })),
};

db.close();
fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
