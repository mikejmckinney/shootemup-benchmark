#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:-monolith_opencode}
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
METHODOLOGY=plain
METHODOLOGY_VERSION=none
METHODOLOGY_REPOSITORY=none
FRESH_REQUIRED=false
SERVICE_TIER=standard
AUTH_MODE=oauth
case "$TREATMENT" in
  monolith_opencode)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    ;;
  monolith_sol_medium_opencode)
    MODEL=openai/gpt-5.6-sol
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=medium
    ;;
  monolith_sol_medium_opencode_api)
    MODEL=openai/gpt-5.6-sol
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=medium
    AUTH_MODE=api_key
    FRESH_REQUIRED=true
    ;;
  monolith_opus_5_medium_opencode)
    MODEL=anthropic/claude-opus-5
    METRICS_MODEL=claude-opus-5
    EFFORT=medium
    AUTH_MODE=anthropic_api_key
    FRESH_REQUIRED=true
    ;;
  monolith_sonnet_5_medium_opencode)
    MODEL=anthropic/claude-sonnet-5
    METRICS_MODEL=claude-sonnet-5
    EFFORT=medium
    AUTH_MODE=anthropic_api_key
    FRESH_REQUIRED=true
    ;;
  monolith_sol_low_opencode)
    MODEL=openai/gpt-5.6-sol
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=low
    ;;
  monolith_sol_high_opencode)
    MODEL=openai/gpt-5.6-sol
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=high
    ;;
  monolith_luna_xhigh_opencode)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=xhigh
    ;;
  monolith_luna_xhigh_opencode_control)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=xhigh
    FRESH_REQUIRED=true
    ;;
  monolith_luna_high_opencode)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=high
    ;;
  monolith_luna_xhigh_fast_opencode)
    MODEL=openai/gpt-5.6-luna-fast
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=xhigh
    SERVICE_TIER=priority
    AUTH_MODE=api_key
    FRESH_REQUIRED=true
    ;;
  monolith_luna_max_fast_opencode)
    MODEL=openai/gpt-5.6-luna-fast
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    SERVICE_TIER=priority
    AUTH_MODE=api_key
    FRESH_REQUIRED=true
    ;;
  monolith_sol_low_fast_opencode)
    MODEL=openai/gpt-5.6-sol-fast
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=low
    SERVICE_TIER=priority
    AUTH_MODE=api_key
    FRESH_REQUIRED=true
    ;;
  monolith_sol_medium_fast_opencode)
    MODEL=openai/gpt-5.6-sol-fast
    METRICS_MODEL=gpt-5.6-sol
    EFFORT=medium
    SERVICE_TIER=priority
    AUTH_MODE=api_key
    FRESH_REQUIRED=true
    ;;
  monolith_luna_max_opencode_retest)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    FRESH_REQUIRED=true
    ;;
  monolith_luna_max_opencode_speckit)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    METHODOLOGY=speckit
    METHODOLOGY_VERSION=v0.16.0
    METHODOLOGY_REPOSITORY=https://github.com/github/spec-kit
    FRESH_REQUIRED=true
    ;;
  dynamic_luna_max_opencode_superpowers)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    METHODOLOGY=superpowers
    METHODOLOGY_VERSION=v6.2.0
    METHODOLOGY_REPOSITORY=https://github.com/obra/superpowers
    FRESH_REQUIRED=true
    ;;
  monolith_luna_max_opencode_ai_repo_template)
    MODEL=openai/gpt-5.6-luna
    METRICS_MODEL=gpt-5.6-luna
    EFFORT=max
    METHODOLOGY=ai-repo-template
    METHODOLOGY_VERSION=9fa3f87d4ea2c800829fa1fe1c215790199f838c
    METHODOLOGY_REPOSITORY=https://github.com/mikejmckinney/ai-repo-template
    FRESH_REQUIRED=true
    ;;
  *)
    echo "unknown OpenCode treatment: $TREATMENT" >&2
    exit 64
    ;;
esac
CANDIDATE_DIR="$ROOT_DIR/candidates/$TREATMENT"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"
OPENCODE=/home/codespace/.opencode/bin/opencode
OPENCODE_DB=${OPENCODE_DB:-/home/codespace/.local/share/opencode/opencode.db}
FAST_TIER_PREFLIGHT=${FAST_TIER_PREFLIGHT:-true}
if [ "$FRESH_REQUIRED" = true ] && { [ -n "$(find "$CANDIDATE_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ] || [ -n "$(find "$RAW_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; }; then
  echo "refusing to reuse a non-fresh methodology-block candidate; archive the candidate and raw evidence first" >&2
  exit 65
fi

if [ -e "$CANDIDATE_DIR/benchmark-result.json" ]; then
  echo "refusing to overwrite completed candidate: $CANDIDATE_DIR" >&2
  exit 65
fi
if [ ! -x "$OPENCODE" ]; then echo "OpenCode executable not found" >&2; exit 69; fi
if [ "$AUTH_MODE" = oauth ] && [ ! -r "$OPENCODE_DB" ]; then
  echo "OpenCode session database not found" >&2
  exit 69
fi
if [ "$AUTH_MODE" = api_key ] && [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is required for API-key candidates" >&2
  exit 69
fi
if [ "$AUTH_MODE" = anthropic_api_key ]; then
  if [ ! -r "$OPENCODE_DB" ] || ! "$OPENCODE" auth list 2>/dev/null | rg -q 'Anthropic.*api'; then
    echo "OpenCode Anthropic API credential is not configured" >&2
    exit 69
  fi
fi
if [ "$AUTH_MODE" = api_key ] && [ "$FAST_TIER_PREFLIGHT" = true ]; then
  PREFLIGHT_TIER=$SERVICE_TIER
  PREFLIGHT_EXPECT=$SERVICE_TIER
  if [ "$SERVICE_TIER" = standard ]; then
    # OpenCode omits service_tier for its ordinary model slug. The Responses
    # API reports the completed request as the default tier.
    PREFLIGHT_TIER=default
    PREFLIGHT_EXPECT=default
  fi
  PREFLIGHT_OUTPUT="$ROOT_DIR/results/diagnostics/api-tier-preflight-$TREATMENT.json"
  if ! node "$ROOT_DIR/scripts/check_opencode_service_tier.mjs" \
    --auth-mode "$AUTH_MODE" --opencode "$OPENCODE" --opencode-model "$MODEL" \
    --model "$METRICS_MODEL" --effort "$EFFORT" --tier "$PREFLIGHT_TIER" --expect "$PREFLIGHT_EXPECT" \
    --output "$PREFLIGHT_OUTPUT"; then
    echo "refusing to start API-key candidate: model, effort, auth, or service tier was not confirmed" >&2
    echo "preflight evidence: $PREFLIGHT_OUTPUT" >&2
    exit 78
  fi
fi

if [ "$METHODOLOGY" = speckit ] && ! command -v pipx >/dev/null 2>&1; then
  echo "pipx is required for the pinned Spec Kit bootstrap" >&2
  exit 69
fi
if [ "$METHODOLOGY" = ai-repo-template ] && [ -z "${GH_PAT:-}" ]; then
  echo "GH_PAT is required to fetch the pinned private AI Repo Template" >&2
  exit 69
fi
mkdir -p "$CANDIDATE_DIR" "$RAW_DIR"
RATE_LIMIT_EVENTS="$RAW_DIR/rate-limit-events.jsonl"
RATE_LIMIT_SUMMARY="$RAW_DIR/rate-limit-summary.json"
if [ "$RATE_LIMIT_TELEMETRY" = true ] && [ "$AUTH_MODE" = api_key ]; then
  : > "$RATE_LIMIT_EVENTS"
fi
if [ "$AUTH_MODE" = api_key ]; then
  # The shared OpenCode data directory contains a ChatGPT OAuth credential.
  # Isolate API-key runs so that stored OAuth cannot silently take precedence.
  export XDG_DATA_HOME="$RAW_DIR/opencode-data"
  OPENCODE_DB="$XDG_DATA_HOME/opencode/opencode.db"
  export OPENCODE_CONFIG_CONTENT
  OPENCODE_CONFIG_CONTENT=$(jq -cn '{provider:{openai:{options:{apiKey:"{env:OPENAI_API_KEY}"}}}}')
fi
if [ "$METHODOLOGY" != ai-repo-template ]; then
  cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
  if [ ! -d "$CANDIDATE_DIR/.git" ]; then git -C "$CANDIDATE_DIR" init -q; fi
fi

# Superpowers is project-local and pinned. Its download and activation happen
# when OpenCode starts, inside the measured interval.
if [ "$METHODOLOGY" = superpowers ]; then
  jq -n --arg plugin "superpowers@git+https://github.com/obra/superpowers.git#$METHODOLOGY_VERSION" \
    '{plugin:[$plugin]}' > "$CANDIDATE_DIR/opencode.json"
fi

# Give every methodology-block treatment an equivalent usable Git baseline.
if [ "$METHODOLOGY" != ai-repo-template ] && ! git -C "$CANDIDATE_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  git -C "$CANDIDATE_DIR" add BENCHMARK_TASK.md
  if [ -f "$CANDIDATE_DIR/opencode.json" ]; then git -C "$CANDIDATE_DIR" add opencode.json; fi
  git -C "$CANDIDATE_DIR" -c user.name="Benchmark Controller" -c user.email="benchmark@localhost" \
    commit -q -m "Initialize benchmark candidate"
fi

curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  https://api.supabase.com/v1/projects > "$RAW_DIR/projects-before.json"
active_count=$(jq '[.[] | select(.status == "ACTIVE_HEALTHY" or .status == "COMING_UP" or .status == "GOING_DOWN" or .status == "RESTORING")] | length' "$RAW_DIR/projects-before.json")
if [ "$active_count" -ge 2 ]; then echo "Supabase already has $active_count active/transitioning projects" >&2; exit 69; fi

export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
START_EPOCH=$(date +%s)
START_EPOCH_MS=$(date +%s%3N)
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$START_ISO" > "$RAW_DIR/started_at.txt"

BOOTSTRAP_EXIT=0
BOOTSTRAP_STARTED_MS=$(date +%s%3N)
case "$METHODOLOGY" in
  plain)
    PROMPT="You are candidate treatment '$TREATMENT' in a controlled benchmark. You are the sole implementation agent; do not delegate or launch other agents. Read BENCHMARK_TASK.md completely, then plan, build, deploy, and verify the full task autonomously until complete or the time limit stops you."
    ;;
  speckit)
    TOOL_TEMP=$(mktemp -d /tmp/shootemup-speckit-XXXXXX)
    PIPX_HOME="$TOOL_TEMP/pipx" PIPX_BIN_DIR="$TOOL_TEMP/bin" \
      pipx install --pip-args="--no-cache-dir" \
      "git+https://github.com/github/spec-kit.git@$METHODOLOGY_VERSION" \
      > "$RAW_DIR/bootstrap.stdout.log" 2> "$RAW_DIR/bootstrap.stderr.log"
    BOOTSTRAP_EXIT=$?
    if [ "$BOOTSTRAP_EXIT" -eq 0 ]; then
      PATH="$TOOL_TEMP/bin:$PATH" specify version \
        >> "$RAW_DIR/bootstrap.stdout.log" 2>> "$RAW_DIR/bootstrap.stderr.log"
      BOOTSTRAP_EXIT=$?
    fi
    if [ "$BOOTSTRAP_EXIT" -eq 0 ]; then
      (cd "$CANDIDATE_DIR" && PATH="$TOOL_TEMP/bin:$PATH" \
        specify init --here --force --integration opencode --script sh --ignore-agent-tools) \
        >> "$RAW_DIR/bootstrap.stdout.log" 2>> "$RAW_DIR/bootstrap.stderr.log"
      BOOTSTRAP_EXIT=$?
    fi
    rm -rf -- "$TOOL_TEMP"
    PROMPT="Continue the controlled benchmark autonomously as the sole implementation agent. Do not delegate or launch other agents. Resolve every remaining task, integrate in the candidate root, deploy, and verify BENCHMARK_TASK.md."
    ;;
  superpowers)
    PROMPT="You are candidate treatment '$TREATMENT' in a controlled benchmark. Use the installed Superpowers $METHODOLOGY_VERSION plugin and follow its complete methodology as designed, including brainstorming, planning, worktrees, test-driven development, task-specific subagents, review, verification, and branch finishing whenever its skills call for them. Every subagent must inherit the same gpt-5.6-luna model and max reasoning treatment. BENCHMARK_TASK.md is the approved product objective and no human will answer during the timed run, so proceed autonomously with reasonable decisions. All child-agent work, review, and coordination are part of this treatment. Integrate the final working implementation into the candidate root, then deploy and verify the complete task until complete or the time limit stops you."
    ;;
  ai-repo-template)
    : > "$RAW_DIR/bootstrap.stdout.log"
    : > "$RAW_DIR/bootstrap.stderr.log"
    TEMPLATE_ARCHIVE=$(mktemp /tmp/shootemup-ai-repo-template-XXXXXX.tar.gz)
    printf 'Fetching AI Repo Template at pinned commit %s\n' "$METHODOLOGY_VERSION" \
      >> "$RAW_DIR/bootstrap.stdout.log"
    curl -fsSL --retry 2 \
      -H "Authorization: Bearer $GH_PAT" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/mikejmckinney/ai-repo-template/tarball/$METHODOLOGY_VERSION" \
      -o "$TEMPLATE_ARCHIVE" 2>> "$RAW_DIR/bootstrap.stderr.log"
    BOOTSTRAP_EXIT=$?
    if [ "$BOOTSTRAP_EXIT" -eq 0 ]; then
      tar -xzf "$TEMPLATE_ARCHIVE" --strip-components=1 -C "$CANDIDATE_DIR" \
        >> "$RAW_DIR/bootstrap.stdout.log" 2>> "$RAW_DIR/bootstrap.stderr.log"
      BOOTSTRAP_EXIT=$?
    fi
    rm -f -- "$TEMPLATE_ARCHIVE"
    if [ "$BOOTSTRAP_EXIT" -eq 0 ]; then
      cp "$ROOT_DIR/benchmark/task.md" "$CANDIDATE_DIR/BENCHMARK_TASK.md"
      git -C "$CANDIDATE_DIR" init -q
      git -C "$CANDIDATE_DIR" add -A
      git -C "$CANDIDATE_DIR" -c user.name="Benchmark Controller" -c user.email="benchmark@localhost" \
        commit -q -m "Initialize AI Repo Template benchmark candidate"
      BOOTSTRAP_EXIT=$?
    fi
    PROMPT="Onboarding is complete. Continue the controlled benchmark autonomously as the sole implementation agent, consistent with the repository's current monolithic execution model. Do not delegate or launch other agents. BENCHMARK_TASK.md is the approved product objective. Plan, build, deploy, and verify every requirement. No human will answer during the timed run, so resolve reasonable ambiguities autonomously. Do not create a remote GitHub repository or pull request; the local candidate directory is the project. Continue until the live system and required evidence are verified or the time limit stops you."
    ;;
esac
BOOTSTRAP_ENDED_MS=$(date +%s%3N)
jq -n --arg methodology "$METHODOLOGY" --arg version "$METHODOLOGY_VERSION" \
  --arg repository "$METHODOLOGY_REPOSITORY" \
  --arg opencode_version "$($OPENCODE --version)" \
  --argjson exit_code "$BOOTSTRAP_EXIT" --argjson started_ms "$BOOTSTRAP_STARTED_MS" \
  --argjson ended_ms "$BOOTSTRAP_ENDED_MS" \
  '{methodology:$methodology,version:$version,repository:$repository,opencode_version:$opencode_version,exit_code:$exit_code,started_ms:$started_ms,ended_ms:$ended_ms,duration_ms:($ended_ms-$started_ms)}' \
  > "$RAW_DIR/bootstrap.json"

set +e
if [ "$BOOTSTRAP_EXIT" -ne 0 ]; then
  RUN_EXIT=$BOOTSTRAP_EXIT
  : > "$RAW_DIR/session.jsonl"
  printf 'Methodology bootstrap failed; OpenCode was not started.\n' > "$RAW_DIR/session.stderr.log"
else
  if [ "$METHODOLOGY" = speckit ]; then
    : > "$RAW_DIR/session.jsonl"
    : > "$RAW_DIR/session.stderr.log"
    SESSION_ID=
    RUN_EXIT=0
    PHASES=(constitution specify plan tasks analyze implement-initial converge implement-convergence finalize)
    PHASE_PROMPTS=(
      "Create governing principles for BENCHMARK_TASK.md emphasizing correctness, test-first engineering, security, accessibility, deployment verification, and evidence. Make reasonable decisions without asking a human. You are the sole agent and must not delegate."
      "Read BENCHMARK_TASK.md and produce the complete feature specification for this approved objective. Resolve ambiguities reasonably without asking a human. You are the sole agent and must not delegate."
      "Produce the technical implementation plan for the approved specification, including Cloudflare deployment, Supabase schema/RLS, gameplay architecture, testing, and verification. You are the sole agent and must not delegate."
      "Generate a complete ordered task list from the plan. You are the sole agent and must not delegate."
      "Analyze the constitution, specification, plan, and tasks for gaps or inconsistencies, then correct the artifacts as needed. You are the sole agent and must not delegate."
      "Implement every task autonomously, including tests, deployment, and live verification. You are the sole agent and must not delegate."
      "Assess the implementation against the specification, plan, and tasks; append every remaining correction required for convergence. You are the sole agent and must not delegate."
      "Implement every remaining convergence task and verify the complete result. You are the sole agent and must not delegate."
      "$PROMPT"
    )
    PHASE_COMMANDS=(speckit.constitution speckit.specify speckit.plan speckit.tasks speckit.analyze speckit.implement speckit.converge speckit.implement "")
    for phase_index in "${!PHASES[@]}"; do
      ELAPSED_BEFORE_AGENT=$(( $(date +%s) - START_EPOCH ))
      REMAINING_SECONDS=$((2700 - ELAPSED_BEFORE_AGENT))
      if [ "$REMAINING_SECONDS" -le 0 ]; then RUN_EXIT=124; break; fi
      phase=${PHASES[$phase_index]}
      phase_file="$RAW_DIR/phase-$phase.jsonl"
      phase_stderr="$RAW_DIR/phase-$phase.stderr.log"
      session_args=()
      command_args=()
      if [ -n "$SESSION_ID" ]; then session_args=(--session "$SESSION_ID"); fi
      if [ -n "${PHASE_COMMANDS[$phase_index]}" ]; then command_args=(--command "${PHASE_COMMANDS[$phase_index]}"); fi
      OPENCODE_COMMAND=("$OPENCODE" run --format json --auto --dir "$CANDIDATE_DIR" \
        --model "$MODEL" --variant "$EFFORT" "${session_args[@]}" "${command_args[@]}" \
        "${PHASE_PROMPTS[$phase_index]}")
      if [ "$RATE_LIMIT_TELEMETRY" = true ] && [ "$AUTH_MODE" = api_key ]; then
        timeout --signal=INT --kill-after=30s "${REMAINING_SECONDS}s" \
          node "$ROOT_DIR/scripts/run_with_openai_rate_limit_observer.mjs" \
          --events "$RATE_LIMIT_EVENTS" -- "${OPENCODE_COMMAND[@]}" </dev/null \
          > "$phase_file" 2> "$phase_stderr"
      else
        timeout --signal=INT --kill-after=30s "${REMAINING_SECONDS}s" \
          "${OPENCODE_COMMAND[@]}" </dev/null > "$phase_file" 2> "$phase_stderr"
      fi
      RUN_EXIT=$?
      sed -n '1,$p' "$phase_file" >> "$RAW_DIR/session.jsonl"
      sed -n '1,$p' "$phase_stderr" >> "$RAW_DIR/session.stderr.log"
      if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(jq -r 'select(.sessionID != null) | .sessionID' "$phase_file" | sed -n '1p')
        if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = null ]; then RUN_EXIT=70; break; fi
      fi
      if [ "$RUN_EXIT" -ne 0 ]; then break; fi
    done
  elif [ "$METHODOLOGY" = ai-repo-template ]; then
    : > "$RAW_DIR/session.jsonl"
    : > "$RAW_DIR/session.stderr.log"
    SESSION_ID=
    RUN_EXIT=0
    PHASES=(onboarding delivery)
    PHASE_PROMPTS=(
      "This is a fresh derived repository and you have explicit authorization to perform all non-destructive template-seed onboarding changes required for BENCHMARK_TASK.md. Run the repo-onboarding command and skill exactly as documented: classify first, inspect and adapt the template to this project, create any required design contract, run setup and validation, and mark onboarding complete only if its gates pass. You are the sole agent and must not delegate. Do not create a remote GitHub repository or pull request. Stop this phase after returning the required onboarding receipt; application delivery follows in the next phase."
      "$PROMPT"
    )
    PHASE_COMMANDS=(repo-onboarding "")
    for phase_index in "${!PHASES[@]}"; do
      ELAPSED_BEFORE_AGENT=$(( $(date +%s) - START_EPOCH ))
      REMAINING_SECONDS=$((2700 - ELAPSED_BEFORE_AGENT))
      if [ "$REMAINING_SECONDS" -le 0 ]; then RUN_EXIT=124; break; fi
      phase=${PHASES[$phase_index]}
      phase_file="$RAW_DIR/phase-$phase.jsonl"
      phase_stderr="$RAW_DIR/phase-$phase.stderr.log"
      session_args=()
      command_args=()
      if [ -n "$SESSION_ID" ]; then session_args=(--session "$SESSION_ID"); fi
      if [ -n "${PHASE_COMMANDS[$phase_index]}" ]; then command_args=(--command "${PHASE_COMMANDS[$phase_index]}"); fi
      OPENCODE_COMMAND=(env -u GITHUB_REPOSITORY -u GH_REPO -u GITHUB_ACTIONS \
        "$OPENCODE" run --format json --auto --dir "$CANDIDATE_DIR" \
        --model "$MODEL" --variant "$EFFORT" "${session_args[@]}" "${command_args[@]}" \
        "${PHASE_PROMPTS[$phase_index]}")
      timeout --signal=INT --kill-after=30s "${REMAINING_SECONDS}s" \
        "${OPENCODE_COMMAND[@]}" </dev/null > "$phase_file" 2> "$phase_stderr"
      RUN_EXIT=$?
      sed -n '1,$p' "$phase_file" >> "$RAW_DIR/session.jsonl"
      sed -n '1,$p' "$phase_stderr" >> "$RAW_DIR/session.stderr.log"
      if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(jq -r 'select(.sessionID != null) | .sessionID' "$phase_file" | sed -n '1p')
        if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = null ]; then RUN_EXIT=70; break; fi
      fi
      if [ "$RUN_EXIT" -ne 0 ]; then break; fi
    done
  else
    ELAPSED_BEFORE_AGENT=$(( $(date +%s) - START_EPOCH ))
    REMAINING_SECONDS=$((2700 - ELAPSED_BEFORE_AGENT))
    if [ "$REMAINING_SECONDS" -le 0 ]; then
      RUN_EXIT=124
      : > "$RAW_DIR/session.jsonl"
      printf 'Methodology bootstrap exhausted the 45-minute treatment ceiling.\n' > "$RAW_DIR/session.stderr.log"
    else
      OPENCODE_COMMAND=("$OPENCODE" run --format json --auto --dir "$CANDIDATE_DIR" \
        --model "$MODEL" --variant "$EFFORT" "$PROMPT")
      if [ "$RATE_LIMIT_TELEMETRY" = true ] && [ "$AUTH_MODE" = api_key ]; then
        timeout --signal=INT --kill-after=30s "${REMAINING_SECONDS}s" \
          node "$ROOT_DIR/scripts/run_with_openai_rate_limit_observer.mjs" \
          --events "$RATE_LIMIT_EVENTS" -- "${OPENCODE_COMMAND[@]}" </dev/null \
          > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
      else
        timeout --signal=INT --kill-after=30s "${REMAINING_SECONDS}s" \
          "${OPENCODE_COMMAND[@]}" </dev/null > "$RAW_DIR/session.jsonl" 2> "$RAW_DIR/session.stderr.log"
      fi
      RUN_EXIT=$?
    fi
  fi
fi
set -e
END_EPOCH=$(date +%s)
END_EPOCH_MS=$(date +%s%3N)
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WALL_SECONDS=$((END_EPOCH - START_EPOCH))
curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" https://api.supabase.com/v1/projects > "$RAW_DIR/projects-after.json" || true

NODE_NO_WARNINGS=1 node "$ROOT_DIR/scripts/collect_opencode_usage.mjs" \
  --db "$OPENCODE_DB" --candidate-dir "$CANDIDATE_DIR" \
  --started-ms "$START_EPOCH_MS" --ended-ms "$END_EPOCH_MS" \
  --output "$RAW_DIR/opencode-usage.json"

PROVIDER_COST=$(jq -r '.provider_reported_cost_usd // 0' "$RAW_DIR/opencode-usage.json")
if { [ "$AUTH_MODE" = api_key ] || [ "$AUTH_MODE" = anthropic_api_key ]; } && ! awk -v cost="$PROVIDER_COST" 'BEGIN { exit !(cost > 0) }'; then
  echo "invalid API-key candidate: OpenCode reported zero provider cost; refusing OAuth fallback" >&2
  if [ "$RUN_EXIT" -eq 0 ]; then RUN_EXIT=78; fi
fi

RATE_LIMIT_ARGS=(
  --enabled "$RATE_LIMIT_TELEMETRY" --runtime opencode --auth-mode "$AUTH_MODE"
  --session "$RAW_DIR/session.jsonl" --stderr "$RAW_DIR/session.stderr.log"
  --run-exit "$RUN_EXIT" --output "$RATE_LIMIT_SUMMARY"
)
if [ "$RATE_LIMIT_TELEMETRY" = true ] && [ "$AUTH_MODE" = api_key ]; then
  RATE_LIMIT_ARGS+=(--events "$RATE_LIMIT_EVENTS")
fi
node "$ROOT_DIR/scripts/classify_rate_limits.mjs" "${RATE_LIMIT_ARGS[@]}"

jq -n --slurpfile ledger "$RAW_DIR/opencode-usage.json" --slurpfile rate_limit "$RATE_LIMIT_SUMMARY" \
  --arg treatment "$TREATMENT" --arg started_at "$START_ISO" --arg ended_at "$END_ISO" \
  --arg model "$METRICS_MODEL" --arg effort "$EFFORT" \
  --arg service_tier "$SERVICE_TIER" \
  --arg auth_mode "$AUTH_MODE" \
  --arg methodology "$METHODOLOGY" --arg methodology_version "$METHODOLOGY_VERSION" \
  --argjson exit_code "$RUN_EXIT" --argjson wall_seconds "$WALL_SECONDS" '
  {
    treatment:$treatment, started_at:$started_at, ended_at:$ended_at, exit_code:$exit_code,
    timed_out:($exit_code == 124), wall_seconds:$wall_seconds, model:$model,
    reasoning_effort:$effort, runtime:"opencode", service_tier:$service_tier, auth_mode:$auth_mode, methodology:$methodology,
    methodology_version:$methodology_version,
    usage_source:"OpenCode SQLite session ledger",
    provider_reported_cost_usd:(if ($auth_mode == "api_key" or $auth_mode == "anthropic_api_key") then $ledger[0].provider_reported_cost_usd else null end),
    agents_started:$ledger[0].agents_started,
    peak_concurrent_agents:$ledger[0].peak_concurrent_agents,
    child_sessions:$ledger[0].child_sessions,
    turns:$ledger[0].turns,
    tool_calls:$ledger[0].tool_calls,
    native_coordination_calls:$ledger[0].coordination_events,
    usage:$ledger[0].usage,
    rate_limit_telemetry:$rate_limit[0]
  }' > "$RAW_DIR/run-metrics.json"

echo "candidate=$TREATMENT exit=$RUN_EXIT wall_seconds=$WALL_SECONDS"
jq . "$RAW_DIR/run-metrics.json"
exit "$RUN_EXIT"
