#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-}
ATTEMPT=${2:-1}
LIMIT_SECONDS=${CONTINUATION_LIMIT_SECONDS:-2700}
OPENCODE=/home/codespace/.opencode/bin/opencode
OPENCODE_DB=${OPENCODE_DB:-/home/codespace/.local/share/opencode/opencode.db}

case "$TREATMENT" in
  monolith_luna_max_opencode_speckit)
    ROOT_SESSION=ses_02762193effe5yp6vPjG8s7okm
    EXPECTED_ACTIVE_PROJECT_REFS="lyyyxbxacrxqflxmtlqq cjwdmtrkiyobtrxalaij"
    PROMPT="Resume the interrupted Spec Kit implementation from the exact current workspace and session state. Continue as the sole agent with no delegation. Use the existing specification, plan, tasks, tests, and partial implementation; do not restart or regenerate completed planning artifacts. Complete all remaining implementation and convergence tasks, create and verify the independent Supabase project and Cloudflare deployment required by BENCHMARK_TASK.md, write the required benchmark-result.json, and finish only after real production verification."
    ;;
  dynamic_luna_max_opencode_superpowers)
    ROOT_SESSION=ses_027316d9effevgeDyFTBFek7vm
    EXPECTED_ACTIVE_PROJECT_REFS="lyyyxbxacrxqflxmtlqq tqwypstoyzlougnlavwr"
    PROMPT="Resume the interrupted full Superpowers methodology from the exact current session, feature worktree, SDD ledger, implementation plan, commits, and review state. Do not restart brainstorming or planning. Continue the remaining task-specific subagent implementation, review, fix, re-review, verification, and branch-finishing workflow exactly as Superpowers prescribes. All child agents must use gpt-5.6-luna at max reasoning. Integrate the completed work into the candidate root, create and verify the independent Supabase project and Cloudflare deployment required by BENCHMARK_TASK.md, write benchmark-result.json in the candidate root, and finish only after real production verification."
    ;;
  monolith_luna_max_opencode_ai_repo_template)
    ROOT_SESSION=ses_0219389a9ffelAGKWc0KrGQ0L4
    EXPECTED_ACTIVE_PROJECT_REFS="lyyyxbxacrxqflxmtlqq kvhesvrqdcpmfiehkxqk"
    PROMPT="Resume the interrupted AI Repo Template implementation from the exact current workspace and session state. Continue as the sole monolithic agent with no delegation or child agents. Onboarding, design, implementation, migration, build, tests, and local browser inspection are already complete; do not restart or repeat completed methodology work. Restore and reuse the existing dedicated Supabase project kvhesvrqdcpmfiehkxqk rather than creating another project, finish the Cloudflare deployment, verify the live game and leaderboard end to end, write the required benchmark-result.json, update the handoff if needed, and finish only after real production verification. Do not create a remote GitHub repository or pull request."
    ;;
  *)
    echo "usage: $0 {monolith_luna_max_opencode_speckit|dynamic_luna_max_opencode_superpowers|monolith_luna_max_opencode_ai_repo_template} [attempt]" >&2
    exit 64
    ;;
esac

CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/continuations/$TREATMENT/attempt-$ATTEMPT"
if [ ! -d "$CANDIDATE_DIR" ]; then echo "missing candidate directory: $CANDIDATE_DIR" >&2; exit 66; fi
if [ -e "$RAW_DIR/run-metrics.json" ]; then echo "refusing to overwrite continuation attempt: $RAW_DIR" >&2; exit 65; fi
mkdir -p "$RAW_DIR"

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
active_refs=$(jq -r '.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING") | .id' "$RAW_DIR/projects-before.json")
unexpected_ref=""
while IFS= read -r project_ref; do
  [ -z "$project_ref" ] && continue
  case " $EXPECTED_ACTIVE_PROJECT_REFS " in
    *" $project_ref "*) ;;
    *) unexpected_ref="$project_ref"; break ;;
  esac
done <<< "$active_refs"
if [ -n "$unexpected_ref" ] || [ "$active_count" -gt 2 ]; then
  echo "Supabase has an unexpected active/transitioning project (count=$active_count ref=${unexpected_ref:-none})" >&2
  exit 69
fi

node "$ROOT_DIR/scripts/snapshot_opencode_session_tree.mjs" \
  --db "$OPENCODE_DB" --root-session "$ROOT_SESSION" --output "$RAW_DIR/ledger-before.json"

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
START_EPOCH=$(date +%s)
START_MS=$(date +%s%3N)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

set +e
timeout --signal=INT --kill-after=30s "${LIMIT_SECONDS}s" env \
  -u GITHUB_REPOSITORY -u GH_REPO -u GITHUB_ACTIONS \
  "$OPENCODE" run --format json --auto \
  --dir "$CANDIDATE_DIR" --session "$ROOT_SESSION" \
  --model openai/gpt-5.6-luna --variant max "$PROMPT" </dev/null \
  > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
RUN_EXIT=$?
set -e

END_EPOCH=$(date +%s)
END_MS=$(date +%s%3N)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))

node "$ROOT_DIR/scripts/snapshot_opencode_session_tree.mjs" \
  --db "$OPENCODE_DB" --root-session "$ROOT_SESSION" --output "$RAW_DIR/ledger-after.json"
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

jq -n --slurpfile before "$RAW_DIR/ledger-before.json" --slurpfile after "$RAW_DIR/ledger-after.json" '
  def delta($key): ($after[0].usage[$key] - $before[0].usage[$key]);
  {
    source:"OpenCode SQLite recursive session-tree delta",
    root_session:$after[0].root_session,
    resumed_root_agents:1,
    new_child_sessions:($after[0].child_sessions - $before[0].child_sessions),
    turns:($after[0].turns - $before[0].turns),
    tool_calls:($after[0].tool_calls - $before[0].tool_calls),
    coordination_tool_calls:($after[0].coordination_tool_calls - $before[0].coordination_tool_calls),
    usage:{
      input_tokens:delta("input_tokens"),
      cached_input_tokens:delta("cached_input_tokens"),
      cache_write_input_tokens:delta("cache_write_input_tokens"),
      output_tokens:delta("output_tokens"),
      reasoning_output_tokens:delta("reasoning_output_tokens")
    }
  }
' > "$RAW_DIR/opencode-usage-delta.json"

jq -n --arg treatment "$TREATMENT" --arg attempt "$ATTEMPT" \
  --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" \
  --argjson limit_seconds "$LIMIT_SECONDS" --slurpfile usage "$RAW_DIR/opencode-usage-delta.json" \
  '{
    treatment:$treatment,
    continuation_attempt:($attempt|tonumber),
    started_at:$started_at,
    ended_at:$ended_at,
    exit_code:$exit_code,
    timed_out:($exit_code == 124),
    limit_seconds:$limit_seconds,
    wall_seconds:$wall_seconds,
    model:"gpt-5.6-luna",
    reasoning_effort:"max",
    runtime:"opencode",
    usage:$usage[0].usage,
    turns:$usage[0].turns,
    tool_calls:$usage[0].tool_calls,
    resumed_root_agents:$usage[0].resumed_root_agents,
    new_child_sessions:$usage[0].new_child_sessions,
    coordination_tool_calls:$usage[0].coordination_tool_calls
  }' > "$RAW_DIR/run-metrics.json"

jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
