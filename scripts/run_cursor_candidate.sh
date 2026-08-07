#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-}
RATE_LIMIT_TELEMETRY=${RATE_LIMIT_TELEMETRY:-true}
for option in "${@:2}"; do
  case "$option" in
    --rate-limit-telemetry) RATE_LIMIT_TELEMETRY=true ;;
    --no-rate-limit-telemetry) RATE_LIMIT_TELEMETRY=false ;;
    *) echo "unknown option: $option" >&2; exit 64 ;;
  esac
done
case "${RATE_LIMIT_TELEMETRY,,}" in
  1|true|yes|on) RATE_LIMIT_TELEMETRY=true ;;
  0|false|no|off) RATE_LIMIT_TELEMETRY=false ;;
  *) echo "RATE_LIMIT_TELEMETRY must be true or false" >&2; exit 64 ;;
esac
case "$TREATMENT" in
  monolith_grok_4_5_medium_cursor)
    MODEL=cursor-grok-4.5-medium
    METRICS_MODEL=grok-4.5
    EFFORT=medium
    SERVICE_TIER=standard
    EXPECTED_MODEL_LABEL="Cursor Grok 4.5 Medium"
    ;;
  monolith_grok_4_5_high_cursor)
    MODEL=cursor-grok-4.5-high
    METRICS_MODEL=grok-4.5
    EFFORT=high
    SERVICE_TIER=standard
    EXPECTED_MODEL_LABEL="Cursor Grok 4.5 High"
    ;;
  monolith_grok_4_5_medium_fast_cursor)
    MODEL=cursor-grok-4.5-medium-fast
    METRICS_MODEL=grok-4.5-fast
    EFFORT=medium
    SERVICE_TIER=fast
    EXPECTED_MODEL_LABEL="Cursor Grok 4.5 Medium Fast"
    ;;
  monolith_grok_4_5_high_fast_cursor)
    MODEL=cursor-grok-4.5-high-fast
    METRICS_MODEL=grok-4.5-fast
    EFFORT=high
    SERVICE_TIER=fast
    EXPECTED_MODEL_LABEL="Cursor Grok 4.5 High Fast"
    ;;
  monolith_auto_cursor)
    MODEL=auto
    METRICS_MODEL=cursor-auto-cost
    EFFORT=auto-cost
    SERVICE_TIER=auto-cost
    EXPECTED_MODEL_LABEL="Auto"
    ;;
  *)
    echo "usage: $0 {monolith_grok_4_5_medium_cursor|monolith_grok_4_5_high_cursor|monolith_grok_4_5_medium_fast_cursor|monolith_grok_4_5_high_fast_cursor|monolith_auto_cursor}" >&2
    exit 64
    ;;
esac

CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
CURSOR_AGENT=${CURSOR_AGENT:-"$(command -v cursor-agent || command -v agent || true)"}
if [ -z "$CURSOR_AGENT" ] || [ ! -x "$CURSOR_AGENT" ]; then
  echo "Cursor Agent CLI not found" >&2
  exit 69
fi
if ! "$CURSOR_AGENT" status >/dev/null 2>&1; then
  echo "Cursor Agent CLI is not authenticated" >&2
  exit 69
fi
CURSOR_MODEL_PREFLIGHT=${CURSOR_MODEL_PREFLIGHT:-true}
case "${CURSOR_MODEL_PREFLIGHT,,}" in
  1|true|yes|on) CURSOR_MODEL_PREFLIGHT=true ;;
  0|false|no|off) CURSOR_MODEL_PREFLIGHT=false ;;
  *) echo "CURSOR_MODEL_PREFLIGHT must be true or false" >&2; exit 64 ;;
esac
if [ "$CURSOR_MODEL_PREFLIGHT" = true ]; then
  PREFLIGHT_OUTPUT="$ROOT_DIR/results/diagnostics/cursor-model-preflight-$TREATMENT.json"
  if ! node "$ROOT_DIR/scripts/check_cursor_model.mjs" --cursor "$CURSOR_AGENT" \
    --model "$MODEL" --expected-label "$EXPECTED_MODEL_LABEL" --output "$PREFLIGHT_OUTPUT"; then
    echo "refusing to start Cursor candidate: requested model variant was not confirmed" >&2
    echo "preflight evidence: $PREFLIGHT_OUTPUT" >&2
    exit 78
  fi
fi
if [ -n "$(find "$CANDIDATE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ] ||
   [ -n "$(find "$RAW_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  echo "refusing to reuse a non-fresh Cursor candidate" >&2
  exit 65
fi

mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"
cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
git -C "$CANDIDATE_DIR" init -q
git -C "$CANDIDATE_DIR" add BENCHMARK_TASK.md
git -C "$CANDIDATE_DIR" -c user.name="Benchmark Controller" -c user.email="benchmark@localhost" \
  commit -q -m "Initialize benchmark candidate"

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then
  echo "Supabase already has $active_count active/transitioning projects; pause one before running a candidate" >&2
  exit 69
fi

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
PROMPT="You are candidate treatment '$TREATMENT' in a controlled benchmark. You are the sole implementation agent; do not delegate, launch subagents, or use background/cloud agents. Read BENCHMARK_TASK.md completely, then plan, build, deploy, and verify the full task autonomously until complete or the 45-minute limit stops you."
START_EPOCH=$(date +%s)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"

set +e
timeout --signal=INT --kill-after=30s 2700s "$CURSOR_AGENT" -p --output-format stream-json \
  --model "$MODEL" --workspace "$CANDIDATE_DIR" --trust --sandbox disabled --force \
  "$PROMPT" </dev/null > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
RUN_EXIT=$?
set -e

END_EPOCH=$(date +%s)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

NODE_NO_WARNINGS=1 node "$ROOT_DIR/scripts/collect_cursor_usage.mjs" \
  --session "$RAW_DIR/session.jsonl" --output "$RAW_DIR/cursor-usage.json"

RATE_LIMIT_SUMMARY="$RAW_DIR/rate-limit-summary.json"
node "$ROOT_DIR/scripts/classify_rate_limits.mjs" \
  --enabled "$RATE_LIMIT_TELEMETRY" --runtime cursor --auth-mode cursor_login \
  --session "$RAW_DIR/session.jsonl" --stderr "$RAW_DIR/session.stderr.log" \
  --run-exit "$RUN_EXIT" --output "$RATE_LIMIT_SUMMARY"

jq -n --slurpfile ledger "$RAW_DIR/cursor-usage.json" --slurpfile rate_limit "$RATE_LIMIT_SUMMARY" \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --arg effort "$EFFORT" --arg cursor_model "$MODEL" \
  --arg metrics_model "$METRICS_MODEL" \
  --arg service_tier "$SERVICE_TIER" \
  --arg cursor_version "$($CURSOR_AGENT --version)" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment:$treatment, started_at:$started_at, ended_at:$ended_at,
    exit_code:$exit_code, timed_out:($exit_code == 124), wall_seconds:$wall_seconds,
    model:$metrics_model, reasoning_effort:$effort, runtime:"cursor",
    runtime_model:$cursor_model, runtime_version:$cursor_version, service_tier:$service_tier,
    usage_source:$ledger[0].source, agents_started:1, peak_concurrent_agents:1,
    child_sessions:0, turns:$ledger[0].turns, tool_calls:$ledger[0].tool_events,
    native_coordination_calls:$ledger[0].subagent_events, usage:$ledger[0].usage,
    rate_limit_telemetry:$rate_limit[0]
  }' > "$RAW_DIR/run-metrics.json"

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
