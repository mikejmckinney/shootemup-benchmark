#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-}

case "$TREATMENT" in
  monolith|native_dynamic|native_isolated|monolith_warm|monolith_sol_medium|monolith_luna_max_codex_minimal) ;;
  *) echo "usage: $0 {monolith|native_dynamic|native_isolated|monolith_warm|monolith_sol_medium|monolith_luna_max_codex_minimal}" >&2; exit 64 ;;
esac

CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"

if [ -e "$CANDIDATE_DIR/benchmark-result.json" ]; then
  echo "refusing to overwrite completed candidate: $CANDIDATE_DIR" >&2
  exit 65
fi

cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
if [ ! -d "$CANDIDATE_DIR/.git" ]; then
  git -C "$CANDIDATE_DIR" init -q
fi

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then
  echo "Supabase already has $active_count active/transitioning projects; pause one before running a candidate" >&2
  exit 69
fi

MODEL=gpt-5.6-luna
EFFORT=max
MINIMAL_CONTEXT=false
case "$TREATMENT" in
  monolith|monolith_warm|monolith_luna_max_codex_minimal)
    FEATURE=false
    ARCHITECTURE=$(printf '%s' 'You are the sole implementation agent. Subagents are disabled. Plan, build, deploy, and verify the complete task yourself.')
    if [ "$TREATMENT" = monolith_luna_max_codex_minimal ]; then
      MINIMAL_CONTEXT=true
    fi
    ;;
  monolith_sol_medium)
    FEATURE=false
    MODEL=gpt-5.6-sol
    EFFORT=medium
    ARCHITECTURE=$(printf '%s' 'You are the sole implementation agent. Subagents are disabled. Plan, build, deploy, and verify the complete task yourself.')
    ;;
  native_dynamic)
    FEATURE=true
    ARCHITECTURE=$(printf '%s' 'Use native subagents as aggressively as you judge useful. You choose how many, their scopes, whether work overlaps, and how they communicate. Remain responsible for integration, deployment, and proof. Do not merely discuss delegation: actually delegate substantive work.')
    ;;
  native_isolated)
    FEATURE=true
    ARCHITECTURE=$(printf '%s' 'Use native subagents, but assign every subagent exactly one bounded, independently verifiable issue. Give it exclusive file ownership or a separate git worktree; no two active subagents may edit the same files. Subagents must not co-own the whole task or receive vague review-everything assignments. The parent owns integration, cross-cutting fixes, deployment, and final verification. Record issue assignments and owned paths in coordination-log.md.')
    ;;
esac

PROMPT=$(printf '%s\n\n%s\n\n%s' \
  "You are candidate treatment '$TREATMENT' in a controlled benchmark." \
  "$ARCHITECTURE" \
  "Read BENCHMARK_TASK.md completely, then deliver it. Begin now and continue autonomously until the live system and required result artifact are verified or the time limit stops you.")

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"

START_EPOCH=$(date +%s)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"

set +e
CODEX_COMMAND=(
  codex exec --strict-config --json --dangerously-bypass-approvals-and-sandbox
  --cd "$CANDIDATE_DIR"
  --model "$MODEL"
  -c "model_reasoning_effort=\"$EFFORT\""
  -c "features.multi_agent=$FEATURE"
  --output-last-message "$RAW_DIR/final-message.txt"
  "$PROMPT"
)
if [ "$MINIMAL_CONTEXT" = true ]; then
  "$ROOT_DIR/scripts/with_clean_codex_home.sh" --audit-dir "$RAW_DIR" -- \
    timeout --signal=INT --kill-after=30s 2700s "${CODEX_COMMAND[@]}" \
    </dev/null > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
else
  timeout --signal=INT --kill-after=30s 2700s "${CODEX_COMMAND[@]}" \
    </dev/null > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
fi
RUN_EXIT=$?
set -e

END_EPOCH=$(date +%s)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

jq -s \
  --arg treatment "$TREATMENT" \
  --arg started_at "$START_ISO" \
  --arg ended_at "$END_ISO" \
  --arg model "$MODEL" \
  --arg effort "$EFFORT" \
  --argjson exit_code "$RUN_EXIT" \
  --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment: $treatment,
    started_at: $started_at,
    ended_at: $ended_at,
    exit_code: $exit_code,
    timed_out: ($exit_code == 124),
    wall_seconds: $wall_seconds,
    model: $model,
    reasoning_effort: $effort,
    turns: ([.[] | select(.type == "turn.completed")] | length),
    usage: ([.[] | select(.type == "turn.completed") | .usage] |
      reduce .[] as $u ({input_tokens:0,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:0,reasoning_output_tokens:0};
        .input_tokens += ($u.input_tokens // 0) |
        .cached_input_tokens += ($u.cached_input_tokens // 0) |
        .cache_write_input_tokens += ($u.cache_write_input_tokens // 0) |
        .output_tokens += ($u.output_tokens // 0) |
        .reasoning_output_tokens += ($u.reasoning_output_tokens // 0)))
  }' "$RAW_DIR/session.jsonl" > "$RAW_DIR/run-metrics.json"

if [ "$FEATURE" = true ]; then
  "$ROOT_DIR/scripts/collect_native_usage.sh" "$TREATMENT" >/dev/null
fi

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
