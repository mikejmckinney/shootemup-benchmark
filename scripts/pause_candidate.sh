#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:?usage: pause_candidate.sh <treatment>}
RESULT_FILE="$ROOT_DIR/candidates/$TREATMENT/benchmark-result.json"
RAW_DIR="$ROOT_DIR/results/raw/$TREATMENT"

mkdir -p "$RAW_DIR"

if [ -f "$RESULT_FILE" ]; then
  PROJECT_REF=$(jq -er '.supabase_project_ref | select(test("^[a-z]{20}$"))' "$RESULT_FILE")
elif [ -f "$RAW_DIR/projects-before.json" ] && [ -f "$RAW_DIR/projects-after.json" ]; then
  PROJECT_REF=$(jq -nr \
    --slurpfile before "$RAW_DIR/projects-before.json" \
    --slurpfile after "$RAW_DIR/projects-after.json" \
    --arg prefix "shootemup-bench-$TREATMENT-" '
      ($before[0] | map(.ref)) as $old |
      [$after[0][] | select((.ref as $ref | $old | index($ref) | not) and (.name | startswith($prefix)))] |
      if length == 1 then .[0].ref else empty end' | jq -er 'select(test("^[a-z]{20}$"))')
else
  echo "cannot identify the candidate Supabase project from result or before/after snapshots" >&2
  exit 66
fi

PAUSED=false
FINAL_STATUS=unknown
INITIAL_JSON=$(curl -fsS -H "Authorization: Bearer ${SUPABASE_API_KEY:?SUPABASE_API_KEY is required}" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF" 2>/dev/null || true)
INITIAL_STATUS=$(printf '%s' "$INITIAL_JSON" | jq -r '.status // "unknown"' 2>/dev/null || printf '%s' unknown)

if [ "$INITIAL_STATUS" = "INACTIVE" ]; then
  HTTP_STATUS=200
  FINAL_STATUS=INACTIVE
  PAUSED=true
  : > "$RAW_DIR/pause-response.json"
else
  HTTP_STATUS=$(curl -sS -o "$RAW_DIR/pause-response.json" -w '%{http_code}' \
    -X POST -H "Authorization: Bearer $SUPABASE_API_KEY" \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/pause")

  for _attempt in $(seq 1 30); do
    if PROJECT_JSON=$(curl -fsS -H "Authorization: Bearer $SUPABASE_API_KEY" \
      "https://api.supabase.com/v1/projects/$PROJECT_REF" 2>/dev/null); then
      FINAL_STATUS=$(printf '%s' "$PROJECT_JSON" | jq -r '.status // "unknown"')
      if [ "$FINAL_STATUS" = "INACTIVE" ]; then
        PAUSED=true
        break
      fi
    fi
    sleep 10
  done
fi

jq -n \
  --arg treatment "$TREATMENT" \
  --arg project_ref "$PROJECT_REF" \
  --arg requested_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg http_status "$HTTP_STATUS" \
  --arg final_status "$FINAL_STATUS" \
  --argjson paused "$PAUSED" \
  '{treatment:$treatment,project_ref:$project_ref,requested_at:$requested_at,pause_http_status:($http_status|tonumber),final_status:$final_status,confirmed_inactive:$paused}' \
  > "$RAW_DIR/cleanup.json"

jq . "$RAW_DIR/cleanup.json"
[ "$PAUSED" = true ]
