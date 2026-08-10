#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OPENCODE=${OPENCODE:-/home/codespace/.opencode/bin/opencode}
MODEL=${1:-anthropic/claude-opus-5}
EFFORT=${2:-medium}
OUTPUT=${3:-"$ROOT_DIR/results/diagnostics/anthropic-oauth-preflight.json"}
DB=${OPENCODE_DB:-/home/codespace/.local/share/opencode/opencode.db}
CONFIG=${OPENCODE_CLAUDE_OAUTH_CONFIG:-"$ROOT_DIR/benchmark/opencode-claude-oauth.json"}
PROBE_DIR=$(mktemp -d /tmp/opencode-anthropic-oauth-preflight.XXXXXX)
trap 'find "$PROBE_DIR" -depth -delete 2>/dev/null || true' EXIT
mkdir -p "$(dirname "$OUTPUT")" "$PROBE_DIR/work"

if [ ! -x "$OPENCODE" ] || [ ! -r "$DB" ] || [ ! -r "$CONFIG" ]; then
  echo "OpenCode, its session database, or OAuth config is unavailable" >&2
  exit 69
fi

AUTH_LIST=$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL \
  OPENCODE_CONFIG="$CONFIG" "$OPENCODE" auth list 2>/dev/null)
if ! printf '%s\n' "$AUTH_LIST" | rg -q 'Anthropic.*oauth'; then
  echo "Anthropic OAuth is not active in OpenCode" >&2
  exit 78
fi

set +e
env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL \
  OPENCODE_CONFIG="$CONFIG" CLAUDE_AUTH_DEBUG="$PROBE_DIR/plugin-debug.jsonl" \
  timeout 120 "$OPENCODE" run --format json --title anthropic-oauth-preflight \
    --dir "$PROBE_DIR/work" --model "$MODEL" --variant "$EFFORT" \
    'Authentication preflight only. Do not use tools. Reply with exactly: ANTHROPIC_OAUTH_PREFLIGHT_OK' \
    > "$PROBE_DIR/session.jsonl" 2> "$PROBE_DIR/session.stderr.log"
RUN_EXIT=$?
set -e

SESSION_ID=$(jq -r 'select(.sessionID != null) | .sessionID' "$PROBE_DIR/session.jsonl" | sed -n '1p')
RESPONSE=$(jq -rs '[.[] | select(.type == "text") | .part.text] | join("")' "$PROBE_DIR/session.jsonl")
PLUGIN_OAUTH=$(jq -s 'any(.[]; .event == "auth_loader_called" and .authType == "oauth")' "$PROBE_DIR/plugin-debug.jsonl" 2>/dev/null || printf false)
PLUGIN_READY=$(jq -s 'any(.[]; .event == "auth_loader_ready")' "$PROBE_DIR/plugin-debug.jsonl" 2>/dev/null || printf false)
MODEL_SEEN=false
VARIANT_SEEN=false
if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != null ]; then
  MODEL_SEEN=$(sqlite3 "$DB" "select count(*) > 0 from message where session_id = '$SESSION_ID' and json_extract(data,'$.model.providerID') = 'anthropic' and json_extract(data,'$.model.modelID') = '${MODEL#anthropic/}';")
  VARIANT_SEEN=$(sqlite3 "$DB" "select count(*) > 0 from message where session_id = '$SESSION_ID' and json_extract(data,'$.variant') = '$EFFORT';")
fi

PASS=false
if [ "$RUN_EXIT" -eq 0 ] && [ "$RESPONSE" = ANTHROPIC_OAUTH_PREFLIGHT_OK ] && \
   [ "$PLUGIN_OAUTH" = true ] && [ "$PLUGIN_READY" = true ] && \
   [ "$MODEL_SEEN" = 1 ] && [ "$VARIANT_SEEN" = 1 ]; then
  PASS=true
fi

jq -n --arg checked_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg model "$MODEL" --arg effort "$EFFORT" --arg response "$RESPONSE" \
  --arg session_id "$SESSION_ID" --argjson run_exit "$RUN_EXIT" \
  --argjson plugin_oauth "$PLUGIN_OAUTH" --argjson plugin_ready "$PLUGIN_READY" \
  --argjson model_seen "$MODEL_SEEN" --argjson variant_seen "$VARIANT_SEEN" \
  --argjson passed "$PASS" '
  {
    checked_at:$checked_at, passed:$passed, requested_model:$model,
    requested_effort:$effort, auth_mode:"anthropic_oauth_subscription",
    api_key_environment_removed:true, plugin:"opencode-claude-auth@2.1.6",
    run_exit:$run_exit, response:$response, session_id:$session_id,
    evidence:{plugin_observed_oauth:$plugin_oauth,plugin_ready:$plugin_ready,
      requested_model_observed:$model_seen,requested_variant_observed:$variant_seen}
  }' > "$OUTPUT"

jq . "$OUTPUT"
[ "$PASS" = true ]
