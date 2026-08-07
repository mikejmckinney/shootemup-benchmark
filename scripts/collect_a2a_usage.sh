#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-a2a}
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
METRICS_FILE="$RAW_DIR/run-metrics.json"
SESSION_STORE=/home/codespace/.codex/sessions
USAGE_LINES=$(mktemp /tmp/shootemup-a2a-usage.XXXXXX)
trap 'rm -f "$USAGE_LINES"' EXIT

for worker_json in "$RAW_DIR"/worker-*.jsonl; do
  [ -f "$worker_json" ] || continue
  thread_id=$(jq -r 'select(.type == "thread.started") | .thread_id' "$worker_json" | head -1)
  [ -n "$thread_id" ] || continue
  rollout=$(find "$SESSION_STORE" -type f -name "*-$thread_id.jsonl" -print -quit)
  [ -n "$rollout" ] || continue
  jq -sc --arg thread_id "$thread_id" --arg source "$(basename "$worker_json")" '
    [.[] | select(.type == "event_msg" and .payload.type == "token_count" and .payload.info.total_token_usage != null) |
      .payload.info.total_token_usage] |
    last | select(. != null) | . + {thread_id:$thread_id,source:$source}
  ' "$rollout" >> "$USAGE_LINES"
done

jq -s '.' "$USAGE_LINES" > "$RAW_DIR/worker-usage.json"
COORDINATOR_USAGE=$(jq -sc '
  [.[] | select(.type == "turn.completed") | .usage] |
  reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
    .input_tokens += ($u.input_tokens // 0) |
    .cached_input_tokens += ($u.cached_input_tokens // 0) |
    .cache_write_input_tokens += ($u.cache_write_input_tokens // 0) |
    .output_tokens += ($u.output_tokens // 0) |
    .reasoning_output_tokens += ($u.reasoning_output_tokens // 0))
' "$RAW_DIR/coordinator.jsonl")

jq --argjson coordinator "$COORDINATOR_USAGE" \
  --slurpfile workers "$RAW_DIR/worker-usage.json" \
  --slurpfile protocol "$RAW_DIR/a2a-protocol.jsonl" '
  .coordinator_usage = $coordinator |
  .worker_usage = $workers[0] |
  .agents_started = (1 + ($workers[0] | length)) |
  .a2a_messages = ([$protocol[] | select(.event == "message_received")] | length) |
  .a2a_messages_completed = ([$protocol[] | select(.event == "message_completed")] | length) |
  .a2a_messages_succeeded = ([$protocol[] | select(.event == "message_completed" and .exit_code == 0)] | length) |
  .a2a_messages_failed = ([$protocol[] | select(.event == "message_completed" and .exit_code != 0)] | length) |
  .usage = ([$coordinator] + $workers[0] |
    reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
      .input_tokens += ($u.input_tokens // 0) |
      .cached_input_tokens += ($u.cached_input_tokens // 0) |
      .cache_write_input_tokens += ($u.cache_write_input_tokens // 0) |
      .output_tokens += ($u.output_tokens // 0) |
      .reasoning_output_tokens += ($u.reasoning_output_tokens // 0)))
' "$METRICS_FILE" > "$METRICS_FILE.tmp"
mv "$METRICS_FILE.tmp" "$METRICS_FILE"
jq . "$METRICS_FILE"
