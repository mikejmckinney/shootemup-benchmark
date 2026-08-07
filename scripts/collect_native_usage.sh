#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:?usage: collect_native_usage.sh <treatment>}
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
SESSION_FILE="$RAW_DIR/session.jsonl"
METRICS_FILE="$RAW_DIR/run-metrics.json"
SESSION_STORE=/home/codespace/.codex/sessions

if [ ! -f "$SESSION_FILE" ] || [ ! -f "$METRICS_FILE" ]; then
  echo "missing native session or metrics for $TREATMENT" >&2
  exit 66
fi

THREAD_IDS=$(jq -r '
  select(.item.type == "collab_tool_call") |
  .item.receiver_thread_ids[]? |
  select(test("^[0-9a-f-]{36}$"))
' "$SESSION_FILE" | sort -u)

USAGE_LINES=$(mktemp /tmp/shootemup-native-usage.XXXXXX)
trap 'rm -f "$USAGE_LINES"' EXIT
for thread_id in $THREAD_IDS; do
  rollout=$(find "$SESSION_STORE" -type f -name "*-$thread_id.jsonl" -print -quit)
  if [ -z "$rollout" ]; then
    echo "warning: no rollout found for native subagent $thread_id" >&2
    continue
  fi
  jq -sc --arg thread_id "$thread_id" '
    [.[] | select(.type == "event_msg" and .payload.type == "token_count" and .payload.info.total_token_usage != null) |
      .payload.info.total_token_usage] |
    last | select(. != null) | . + {thread_id:$thread_id}
  ' "$rollout" >> "$USAGE_LINES"
done

jq -s '.' "$USAGE_LINES" > "$RAW_DIR/subagent-usage.json"
jq --slurpfile subs "$RAW_DIR/subagent-usage.json" '
  .parent_usage = (.parent_usage // .usage) |
  .subagent_usage = $subs[0] |
  .agents_started = (1 + ($subs[0] | length)) |
  .native_coordination_calls = ([inputs | select(.item.type == "collab_tool_call" and .item.status == "completed")] | length) |
  .usage = ([.parent_usage] + $subs[0] |
    reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
      .input_tokens += ($u.input_tokens // 0) |
      .cached_input_tokens += ($u.cached_input_tokens // 0) |
      .cache_write_input_tokens += ($u.cache_write_input_tokens // 0) |
      .output_tokens += ($u.output_tokens // 0) |
      .reasoning_output_tokens += ($u.reasoning_output_tokens // 0)))
' "$METRICS_FILE" "$SESSION_FILE" > "$METRICS_FILE.tmp"
mv "$METRICS_FILE.tmp" "$METRICS_FILE"
jq . "$METRICS_FILE"
