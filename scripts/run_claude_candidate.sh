#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-}
case "$TREATMENT" in
  monolith_opus_5_medium_claude_code)
    MODEL_ALIAS=opus
    EXPECTED_MODEL=claude-opus-5
    METRICS_MODEL=claude-opus-5
    ;;
  monolith_sonnet_5_medium_claude_code)
    MODEL_ALIAS=sonnet
    EXPECTED_MODEL=claude-sonnet-5
    METRICS_MODEL=claude-sonnet-5
    ;;
  *)
    echo "usage: $0 {monolith_opus_5_medium_claude_code|monolith_sonnet_5_medium_claude_code}" >&2
    exit 64
    ;;
esac

CLAUDE=${CLAUDE:-"$(command -v claude || true)"}
if [ -z "$CLAUDE" ] || [ ! -x "$CLAUDE" ]; then echo "Claude Code CLI not found" >&2; exit 69; fi
if ! "$CLAUDE" auth status | jq -e '.loggedIn == true and .apiProvider == "firstParty"' >/dev/null; then
  echo "Claude Code is not authenticated to the first-party provider" >&2
  exit 69
fi

CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
DIAGNOSTIC_DIR="$ROOT_DIR/results/diagnostics"
if [ -n "$(find "$CANDIDATE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ] ||
   [ -n "$(find "$RAW_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  echo "refusing to reuse a non-fresh Claude Code candidate" >&2
  exit 65
fi

mkdir -p "$DIAGNOSTIC_DIR"
PREFLIGHT="$DIAGNOSTIC_DIR/claude-model-preflight-$TREATMENT.jsonl"
PREFLIGHT_STDERR="$DIAGNOSTIC_DIR/claude-model-preflight-$TREATMENT.stderr.log"
"$CLAUDE" -p --safe-mode --model "$MODEL_ALIAS" --effort medium --tools "" \
  --output-format stream-json --verbose --no-session-persistence \
  "Reply with exactly PREFLIGHT_OK." > "$PREFLIGHT" 2> "$PREFLIGHT_STDERR"
if ! jq -s -e --arg model "$EXPECTED_MODEL" '
  any(.[]; .type == "system" and .subtype == "init" and .model == $model) and
  any(.[]; .type == "result" and .subtype == "success" and .is_error == false and
      .usage.service_tier == "standard" and .result == "PREFLIGHT_OK")
' "$PREFLIGHT" >/dev/null; then
  echo "refusing to start Claude candidate: model or standard tier was not confirmed" >&2
  exit 78
fi

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$DIAGNOSTIC_DIR/claude-projects-preflight-$TREATMENT.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$DIAGNOSTIC_DIR/claude-projects-preflight-$TREATMENT.json")
if [ "$active_count" -ge 2 ]; then
  echo "Supabase already has $active_count active/transitioning projects" >&2
  exit 69
fi

mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"
cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
git -C "$CANDIDATE_DIR" init -q
git -C "$CANDIDATE_DIR" add BENCHMARK_TASK.md
git -C "$CANDIDATE_DIR" -c user.name="Benchmark Controller" -c user.email="benchmark@localhost" \
  commit -q -m "Initialize benchmark candidate"
cp "$DIAGNOSTIC_DIR/claude-projects-preflight-$TREATMENT.json" "$RAW_DIR/projects-before.json"

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
PROMPT="You are candidate treatment '$TREATMENT' in a controlled benchmark. You are the sole implementation agent; do not delegate, launch subagents, use background/cloud agents, or invoke any agent-coordination tool. Read BENCHMARK_TASK.md completely, then plan, build, deploy, and verify the full task autonomously until complete or the 45-minute limit stops you."
START_EPOCH=$(date +%s)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"

set +e
timeout --signal=INT --kill-after=30s 2700s "$CLAUDE" -p \
  --model "$MODEL_ALIAS" --effort medium --output-format stream-json --verbose \
  --permission-mode bypassPermissions --no-session-persistence \
  --disallowedTools 'Agent,ListAgents,SendMessage,RemoteTrigger,EnterWorktree,ExitWorktree' \
  "$PROMPT" </dev/null > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
RUN_EXIT=$?
set -e

END_EPOCH=$(date +%s)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

node "$ROOT_DIR/scripts/collect_claude_usage.mjs" \
  --session "$RAW_DIR/session.jsonl" --expected-model "$EXPECTED_MODEL" \
  --output "$RAW_DIR/claude-usage.json"
node "$ROOT_DIR/scripts/classify_rate_limits.mjs" \
  --enabled true --runtime claude-code --auth-mode claude_ai_oauth \
  --session "$RAW_DIR/session.jsonl" --stderr "$RAW_DIR/session.stderr.log" \
  --run-exit "$RUN_EXIT" --output "$RAW_DIR/rate-limit-summary.json"

jq -n --slurpfile ledger "$RAW_DIR/claude-usage.json" \
  --slurpfile rate_limit "$RAW_DIR/rate-limit-summary.json" \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --arg model "$METRICS_MODEL" --arg runtime_model "$MODEL_ALIAS" \
  --arg claude_version "$($CLAUDE --version)" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment:$treatment, started_at:$started_at, ended_at:$ended_at,
    exit_code:$exit_code, timed_out:($exit_code == 124), wall_seconds:$wall_seconds,
    model:$model, reasoning_effort:"medium", runtime:"claude-code",
    runtime_model:$runtime_model, runtime_version:$claude_version,
    service_tier:($ledger[0].service_tier // "standard"), speed:($ledger[0].speed // "standard"),
    auth_mode:"claude.ai_oauth", usage_source:$ledger[0].source,
    agents_started:1, peak_concurrent_agents:1, child_sessions:0,
    turns:$ledger[0].turns, tool_calls:$ledger[0].tool_events,
    native_coordination_calls:$ledger[0].prohibited_agent_tool_calls,
    provider_reported_cost_usd:$ledger[0].provider_reported_cost_usd,
    usage:$ledger[0].usage, rate_limit_telemetry:$rate_limit[0]
  }' > "$RAW_DIR/run-metrics.json"

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
