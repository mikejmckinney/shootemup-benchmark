#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=a2a
CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
A2A_DIR="$ROOT_DIR/benchmark/a2a"
VENV_DIR="$A2A_DIR/.venv"
mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"

if [ -e "$CANDIDATE_DIR/benchmark-result.json" ]; then
  echo "refusing to overwrite completed candidate: $CANDIDATE_DIR" >&2
  exit 65
fi
cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
if [ ! -d "$CANDIDATE_DIR/.git" ]; then git -C "$CANDIDATE_DIR" init -q; fi

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then
  echo "Supabase already has $active_count active/transitioning projects; pause one before running A2A" >&2
  exit 69
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/pip" install --disable-pip-version-check -q -r "$A2A_DIR/requirements.txt"

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"

setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role gameplay --port 9101 \
  --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" > "$RAW_DIR/gameplay-server.log" 2>&1 &
GAMEPLAY_PID=$!
setsid "$VENV_DIR/bin/python" "$A2A_DIR/server.py" --role platform --port 9102 \
  --candidate-dir "$CANDIDATE_DIR" --raw-dir "$RAW_DIR" > "$RAW_DIR/platform-server.log" 2>&1 &
PLATFORM_PID=$!

cleanup_servers() {
  kill -- -"$GAMEPLAY_PID" -"$PLATFORM_PID" 2>/dev/null || true
  wait "$GAMEPLAY_PID" "$PLATFORM_PID" 2>/dev/null || true
}
trap cleanup_servers EXIT INT TERM

for port in 9101 9102; do
  ready=false
  for _attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/.well-known/agent-card.json" > "$RAW_DIR/agent-card-$port.json"; then ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then echo "A2A server on port $port did not become ready" >&2; exit 70; fi
done

A2A_CLIENT="$VENV_DIR/bin/python $A2A_DIR/client.py"
PROMPT=$(printf '%s\n\n%s\n\n%s\n\n%s' \
  "You are the coordinator for candidate treatment 'a2a' in a controlled benchmark. Native subagents are disabled." \
  "Read BENCHMARK_TASK.md completely. You lead delivery and integrate the shared repository, but must delegate at least one substantive implementation task to EACH of two opaque Luna Max agents through A2A. Discover and call them only with: $A2A_CLIENT http://127.0.0.1:9101 '<message>' and $A2A_CLIENT http://127.0.0.1:9102 '<message>'. These commands perform A2A 1.0 Agent Card discovery and JSON-RPC message/send over HTTP. You may send follow-up A2A messages for fixes. Do not simulate their work or use native subagents." \
  "Choose bounded requests that minimize concurrent file conflicts. The workers share the product repository but not your context/internal state, so put all necessary acceptance criteria in each A2A message and inspect their returned artifacts and files. You remain responsible for integration, deployment, live verification, and benchmark-result.json." \
  "Begin now and continue autonomously until the live system and required result artifact are verified or the 45-minute treatment limit stops you.")

START_EPOCH=$(date +%s)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"
set +e
timeout --signal=INT --kill-after=30s 2700s \
  codex exec --json --dangerously-bypass-approvals-and-sandbox \
  --cd "$CANDIDATE_DIR" --model gpt-5.6-luna \
  -c model_reasoning_effort='"max"' -c features.multi_agent=false \
  --output-last-message "$RAW_DIR/coordinator.final.txt" "$PROMPT" </dev/null \
  > "$RAW_DIR/coordinator.jsonl" 2> "$RAW_DIR/coordinator.stderr.log"
RUN_EXIT=$?
set -e
END_EPOCH=$(date +%s)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))

cleanup_servers
trap - EXIT INT TERM
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

find "$RAW_DIR" -maxdepth 1 -type f -name '*.jsonl' -print0 | sort -z | xargs -0 jq -s \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment:$treatment, started_at:$started_at, ended_at:$ended_at, exit_code:$exit_code,
    timed_out:($exit_code == 124), wall_seconds:$wall_seconds, model:"gpt-5.6-luna",
    reasoning_effort:"max", agents_started:3,
    a2a_messages:([.[] | select(.event == "message_received")] | length),
    turns:([.[] | select(.type == "turn.completed")] | length),
    usage:([.[] | select(.type == "turn.completed") | .usage] |
      reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
        .input_tokens += ($u.input_tokens // 0) |
        .cached_input_tokens += ($u.cached_input_tokens // 0) |
        .cache_write_input_tokens += ($u.cache_write_input_tokens // 0) |
        .output_tokens += ($u.output_tokens // 0) |
        .reasoning_output_tokens += ($u.reasoning_output_tokens // 0)))
  }' > "$RAW_DIR/run-metrics.json"

"$ROOT_DIR/scripts/collect_a2a_usage.sh" >/dev/null

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
