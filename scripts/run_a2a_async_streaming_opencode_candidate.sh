#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=a2a_async_streaming_opencode
CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
A2A_DIR="$ROOT_DIR/benchmark/a2a"
VENV_DIR="$A2A_DIR/.venv"
STATE_FILE="$RAW_DIR/a2a-stream-client-state.json"
OPENCODE=/home/codespace/.opencode/bin/opencode
OPENCODE_DB=${OPENCODE_DB:-/home/codespace/.local/share/opencode/opencode.db}
MODEL=openai/gpt-5.6-luna
METRICS_MODEL=gpt-5.6-luna
EFFORT=max

if [ -n "$(find "$CANDIDATE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ] || [ -n "$(find "$RAW_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  echo "refusing to reuse a non-fresh A2A streaming candidate" >&2
  exit 65
fi
mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"
: > "$RAW_DIR/a2a-protocol.jsonl"
: > "$RAW_DIR/a2a-stream-client-state.events.jsonl"
if [ ! -x "$OPENCODE" ]; then echo "OpenCode executable not found" >&2; exit 69; fi
if [ ! -r "$OPENCODE_DB" ]; then echo "OpenCode session database not found" >&2; exit 69; fi
cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
git -C "$CANDIDATE_DIR" init -q
git -C "$CANDIDATE_DIR" add BENCHMARK_TASK.md
git -C "$CANDIDATE_DIR" -c user.name="Benchmark Controller" -c user.email="benchmark@localhost" \
  commit -q -m "Initialize benchmark candidate"

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then echo "Supabase already has $active_count active/transitioning projects" >&2; exit 69; fi
if [ ! -x "$VENV_DIR/bin/python" ]; then python3 -m venv "$VENV_DIR"; fi
"$VENV_DIR/bin/pip" install --disable-pip-version-check -q -r "$A2A_DIR/requirements.txt"
export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"

setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role gameplay --port 9301 \
  --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" --runtime opencode --model "$MODEL" --effort "$EFFORT" \
  > "$RAW_DIR/gameplay-server.log" 2>&1 &
GAMEPLAY_PID=$!
setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role platform --port 9302 \
  --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" --runtime opencode --model "$MODEL" --effort "$EFFORT" \
  > "$RAW_DIR/platform-server.log" 2>&1 &
PLATFORM_PID=$!
cleanup_servers() { kill -- -"$GAMEPLAY_PID" -"$PLATFORM_PID" 2>/dev/null || true; wait "$GAMEPLAY_PID" "$PLATFORM_PID" 2>/dev/null || true; }
trap cleanup_servers EXIT INT TERM
for port in 9301 9302; do
  ready=false
  for _attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/.well-known/agent-card.json" > "$RAW_DIR/agent-card-$port.json"; then ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then echo "A2A server on port $port did not become ready" >&2; exit 70; fi
done

CLIENT="$VENV_DIR/bin/python $A2A_DIR/streaming_client.py --state $STATE_FILE"
PROMPT=$(printf '%s\n\n%s\n\n%s\n\n%s' \
  "You are the OpenCode coordinator for candidate treatment '$TREATMENT' in a controlled benchmark. You are Luna Max at max reasoning and must not launch native subagents." \
  "Read BENCHMARK_TASK.md completely. Delegate substantive implementation to BOTH opaque Luna Max OpenCode A2A workers. Submit independent tasks first, without waiting: $CLIENT submit http://127.0.0.1:9301 <stable-key> '<bounded gameplay/frontend task>'; $CLIENT submit http://127.0.0.1:9302 <stable-key> '<bounded platform/data/quality task>'. Both submissions use A2A message/stream and return after the initial task event while work continues asynchronously. Continue useful coordinator work, then receive server-sent status and artifact events with: $CLIENT watch <same-url> <same-key>." \
  "You alone own retry decisions. Every logical task needs a stable unique idempotency key. Repeating submit with the same key resolves the existing task; never invent a replacement key after a disconnect. Streaming watch replaces repeated tasks/get polling. Give workers exclusive bounded paths to avoid concurrent file conflicts. Workers share files but not context. Do not use native subagents." \
  "Integrate and verify all artifacts yourself, deploy the live system, write benchmark-result.json, and continue autonomously until complete or the 45-minute limit stops you.")

START_EPOCH=$(date +%s)
START_EPOCH_MS=$(date +%s%3N)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"
set +e
timeout --signal=INT --kill-after=30s 2700s "$OPENCODE" run --format json --auto \
  --dir "$CANDIDATE_DIR" --model "$MODEL" --variant "$EFFORT" "$PROMPT" </dev/null \
  > "$RAW_DIR/coordinator.jsonl" 2> "$RAW_DIR/coordinator.stderr.log"
RUN_EXIT=$?
set -e
END_EPOCH=$(date +%s)
END_EPOCH_MS=$(date +%s%3N)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))
cleanup_servers
trap - EXIT INT TERM
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

NODE_NO_WARNINGS=1 node "$ROOT_DIR/scripts/collect_opencode_usage.mjs" \
  --db "$OPENCODE_DB" --candidate-dir "$CANDIDATE_DIR" \
  --started-ms "$START_EPOCH_MS" --ended-ms "$END_EPOCH_MS" \
  --output "$RAW_DIR/opencode-usage.json"

jq -n --slurpfile ledger "$RAW_DIR/opencode-usage.json" \
  --slurpfile protocol "$RAW_DIR/a2a-protocol.jsonl" \
  --slurpfile stream "$RAW_DIR/a2a-stream-client-state.events.jsonl" \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --arg model "$METRICS_MODEL" --arg effort "$EFFORT" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment:$treatment, started_at:$started_at, ended_at:$ended_at, exit_code:$exit_code,
    timed_out:($exit_code == 124), wall_seconds:$wall_seconds, model:$model,
    reasoning_effort:$effort, runtime:"opencode-a2a-async-streaming",
    transport:"A2A 1.0 JSON-RPC message/stream plus tasks/resubscribe SSE",
    usage_source:"OpenCode SQLite session ledger",
    agents_started:$ledger[0].agents_started,
    peak_concurrent_agents:$ledger[0].peak_concurrent_agents,
    child_sessions:$ledger[0].child_sessions,
    turns:$ledger[0].turns,
    tool_calls:$ledger[0].tool_calls,
    native_coordination_calls:$ledger[0].coordination_events,
    a2a_messages:([$protocol[] | select(.event == "message_received")] | length),
    a2a_messages_completed:([$protocol[] | select(.event == "message_completed")] | length),
    a2a_messages_succeeded:([$protocol[] | select(.event == "message_completed" and .exit_code == 0)] | length),
    a2a_messages_failed:([$protocol[] | select(.event == "message_completed" and .exit_code != 0)] | length),
    a2a_stream_events:($stream | length),
    a2a_task_snapshots:([$stream[] | select(.event == "task" or .stream_event == "task")] | length),
    a2a_status_updates:([$stream[] | select(.event == "status_update" or .stream_event == "status_update")] | length),
    a2a_artifact_updates:([$stream[] | select(.event == "artifact_update" or .stream_event == "artifact_update")] | length),
    a2a_terminal_snapshots:([$stream[] | select(.event == "stream_terminal_snapshot")] | length),
    usage:$ledger[0].usage
  }' > "$RAW_DIR/run-metrics.json"

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
