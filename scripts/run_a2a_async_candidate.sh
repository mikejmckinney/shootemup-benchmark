#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=a2a_async
CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
A2A_DIR="$ROOT_DIR/benchmark/a2a"
VENV_DIR="$A2A_DIR/.venv"
STATE_FILE="$RAW_DIR/a2a-client-state.json"
mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"
if [ -e "$CANDIDATE_DIR/benchmark-result.json" ]; then echo "refusing to overwrite completed candidate" >&2; exit 65; fi
cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
if [ ! -d "$CANDIDATE_DIR/.git" ]; then git -C "$CANDIDATE_DIR" init -q; fi
curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then echo "Supabase already has $active_count active/transitioning projects" >&2; exit 69; fi
if [ ! -x "$VENV_DIR/bin/python" ]; then python3 -m venv "$VENV_DIR"; fi
"$VENV_DIR/bin/pip" install --disable-pip-version-check -q -r "$A2A_DIR/requirements.txt"
export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"

setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role gameplay --port 9201 --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" > "$RAW_DIR/gameplay-server.log" 2>&1 &
GAMEPLAY_PID=$!
setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role platform --port 9202 --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" > "$RAW_DIR/platform-server.log" 2>&1 &
PLATFORM_PID=$!
cleanup_servers() { kill -- -"$GAMEPLAY_PID" -"$PLATFORM_PID" 2>/dev/null || true; wait "$GAMEPLAY_PID" "$PLATFORM_PID" 2>/dev/null || true; }
trap cleanup_servers EXIT INT TERM
for port in 9201 9202; do
  ready=false
  for _attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/.well-known/agent-card.json" > "$RAW_DIR/agent-card-$port.json"; then ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then echo "A2A server on port $port did not become ready" >&2; exit 70; fi
done

CLIENT="$VENV_DIR/bin/python $A2A_DIR/async_client.py --state $STATE_FILE"
PROMPT=$(printf '%s\n\n%s\n\n%s\n\n%s' \
  "You are the coordinator for candidate treatment '$TREATMENT' in a controlled benchmark. Native subagents are disabled." \
  "Read BENCHMARK_TASK.md completely. Delegate substantive implementation to BOTH opaque Luna Max A2A workers. Submit independent tasks first, without waiting: $CLIENT submit http://127.0.0.1:9201 <unique-idempotency-key> '<message>'; $CLIENT submit http://127.0.0.1:9202 <unique-idempotency-key> '<message>'. Then continue useful coordinator work and inspect progress with poll or wait using the same URL and key. This is asynchronous A2A task submission plus tasks/get polling." \
  "You alone own retry decisions. Every logical task needs a stable unique idempotency key. Repeating submit with the same key safely resolves the existing task; never invent a new key merely because a poll times out. The client retries only transient polls, never accepted work. Give workers exclusive bounded paths to avoid concurrent file conflicts. Workers share files but not context. Do not use native subagents." \
  "Integrate and verify all artifacts yourself, deploy the live system, write benchmark-result.json, and continue autonomously until complete or the 45-minute limit stops you.")
START_EPOCH=$(date +%s); START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ); printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"
set +e
timeout --signal=INT --kill-after=30s 2700s codex exec --json --dangerously-bypass-approvals-and-sandbox \
  --cd "$CANDIDATE_DIR" --model gpt-5.6-luna -c model_reasoning_effort='"max"' -c features.multi_agent=false \
  --output-last-message "$RAW_DIR/coordinator.final.txt" "$PROMPT" </dev/null > "$RAW_DIR/coordinator.jsonl" 2> "$RAW_DIR/coordinator.stderr.log"
RUN_EXIT=$?
set -e
END_EPOCH=$(date +%s); END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ); WALL_SECONDS=$((END_EPOCH - START_EPOCH))
cleanup_servers; trap - EXIT INT TERM
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

find "$RAW_DIR" -maxdepth 1 -type f -name '*.jsonl' ! -name 'a2a-protocol.jsonl' ! -name '*.events.jsonl' -print0 | sort -z | xargs -0 jq -s \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {treatment:$treatment,started_at:$started_at,ended_at:$ended_at,exit_code:$exit_code,timed_out:($exit_code==124),wall_seconds:$wall_seconds,
   model:"gpt-5.6-luna",reasoning_effort:"max",runtime:"codex-a2a-async",agents_started:3,
   turns:([.[]|select(.type=="turn.completed")]|length),
   usage:([.[]|select(.type=="turn.completed")|.usage]|reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
     .input_tokens+=($u.input_tokens//0)|.cached_input_tokens+=($u.cached_input_tokens//0)|.cache_write_input_tokens+=($u.cache_write_input_tokens//0)|.output_tokens+=($u.output_tokens//0)|.reasoning_output_tokens+=($u.reasoning_output_tokens//0)))}' > "$RAW_DIR/run-metrics.json"
"$ROOT_DIR/scripts/collect_a2a_usage.sh" "$TREATMENT" >/dev/null
echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"; jq . "$RAW_DIR/run-metrics.json"; exit "$RUN_EXIT"
