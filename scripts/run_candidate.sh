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
  monolith|native_dynamic|native_isolated|monolith_warm|monolith_sol_medium|monolith_luna_max_codex_minimal|monolith_luna_xhigh_fast_codex|monolith_luna_max_fast_codex) ;;
  *) echo "usage: $0 {monolith|native_dynamic|native_isolated|monolith_warm|monolith_sol_medium|monolith_luna_max_codex_minimal|monolith_luna_xhigh_fast_codex|monolith_luna_max_fast_codex}" >&2; exit 64 ;;
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
FRESH_REQUIRED=false
SERVICE_TIER_REQUESTED=standard
SERVICE_TIER_EFFECTIVE=unknown
case "$TREATMENT" in
  monolith|monolith_warm|monolith_luna_max_codex_minimal|monolith_luna_xhigh_fast_codex|monolith_luna_max_fast_codex)
    FEATURE=false
    ARCHITECTURE=$(printf '%s' 'You are the sole implementation agent. Subagents are disabled. Plan, build, deploy, and verify the complete task yourself.')
    if [ "$TREATMENT" = monolith_luna_max_codex_minimal ]; then
      MINIMAL_CONTEXT=true
    fi
    if [ "$TREATMENT" = monolith_luna_xhigh_fast_codex ]; then
      EFFORT=xhigh
      FRESH_REQUIRED=true
      SERVICE_TIER_REQUESTED=priority
    fi
    if [ "$TREATMENT" = monolith_luna_max_fast_codex ]; then
      EFFORT=max
      FRESH_REQUIRED=true
      SERVICE_TIER_REQUESTED=priority
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

if [ "$FRESH_REQUIRED" = true ] && { [ -n "$(find "$CANDIDATE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ] || [ -n "$(find "$RAW_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; }; then
  echo "refusing to reuse a non-fresh Fast candidate; archive the candidate and raw evidence first" >&2
  exit 65
fi

PROMPT=$(printf '%s\n\n%s\n\n%s' \
  "You are candidate treatment '$TREATMENT' in a controlled benchmark." \
  "$ARCHITECTURE" \
  "Read BENCHMARK_TASK.md completely, then deliver it. Begin now and continue autonomously until the live system and required result artifact are verified or the time limit stops you.")

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
RATE_LIMIT_BEFORE="$RAW_DIR/rate-limits-before.json"
RATE_LIMIT_AFTER="$RAW_DIR/rate-limits-after.json"
RATE_LIMIT_SUMMARY="$RAW_DIR/rate-limit-summary.json"

if [ "$SERVICE_TIER_REQUESTED" = priority ]; then
  set +e
  node "$ROOT_DIR/scripts/check_codex_service_tier.mjs" \
    --model "$MODEL" --effort "$EFFORT" --tier priority --expect priority \
    --output "$RAW_DIR/codex-service-tier-preflight.json"
  PREFLIGHT_EXIT=$?
  set -e
  SERVICE_TIER_EFFECTIVE=$(jq -r '.response_completed_tier // "unknown"' "$RAW_DIR/codex-service-tier-preflight.json")
  if [ "$PREFLIGHT_EXIT" -ne 0 ]; then
    echo "warning: Codex requested Priority but the preflight reported '$SERVICE_TIER_EFFECTIVE'; continuing only because this diagnostic rerun was explicitly requested" >&2
  fi
fi

if [ "$RATE_LIMIT_TELEMETRY" = true ]; then
  node "$ROOT_DIR/scripts/read_codex_rate_limits.mjs" > "$RATE_LIMIT_BEFORE" || true
fi

START_EPOCH=$(date +%s)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"

set +e
CODEX_COMMAND=(
  codex exec --strict-config --json --dangerously-bypass-approvals-and-sandbox
  --cd "$CANDIDATE_DIR"
  --model "$MODEL"
  -c "model_reasoning_effort=\"$EFFORT\""
  -c "service_tier=\"$SERVICE_TIER_REQUESTED\""
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
if [ "$RATE_LIMIT_TELEMETRY" = true ]; then
  node "$ROOT_DIR/scripts/read_codex_rate_limits.mjs" > "$RATE_LIMIT_AFTER" || true
fi
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

RATE_LIMIT_ARGS=(
  --enabled "$RATE_LIMIT_TELEMETRY" --runtime codex --auth-mode oauth
  --session "$RAW_DIR/session.jsonl" --stderr "$RAW_DIR/session.stderr.log"
  --run-exit "$RUN_EXIT" --output "$RATE_LIMIT_SUMMARY"
)
if [ "$RATE_LIMIT_TELEMETRY" = true ]; then
  RATE_LIMIT_ARGS+=(--before "$RATE_LIMIT_BEFORE" --after "$RATE_LIMIT_AFTER")
fi
node "$ROOT_DIR/scripts/classify_rate_limits.mjs" "${RATE_LIMIT_ARGS[@]}"

jq -s --slurpfile rate_limit "$RATE_LIMIT_SUMMARY" \
  --arg treatment "$TREATMENT" \
  --arg started_at "$START_ISO" \
  --arg ended_at "$END_ISO" \
  --arg model "$MODEL" \
  --arg effort "$EFFORT" \
  --arg service_tier_requested "$SERVICE_TIER_REQUESTED" \
  --arg service_tier_effective "$SERVICE_TIER_EFFECTIVE" \
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
    runtime: "codex",
    service_tier_requested: $service_tier_requested,
    service_tier_effective_preflight: $service_tier_effective,
    rate_limit_telemetry: $rate_limit[0],
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
