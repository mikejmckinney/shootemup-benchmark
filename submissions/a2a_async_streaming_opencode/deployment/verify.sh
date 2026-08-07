#!/usr/bin/env sh
set -eu

: "${PRODUCTION_URL:?Set PRODUCTION_URL to the deployed Neon Barrage URL}"
: "${SUPABASE_URL:?Set SUPABASE_URL to the project URL}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY to the browser-safe publishable/anon key}"

production_status="$(curl -sS -o /dev/null -w '%{http_code}' "$PRODUCTION_URL")"
if [ "$production_status" != "200" ]; then
  printf 'Production check failed: HTTP %s\n' "$production_status" >&2
  exit 1
fi
printf 'Production check passed: HTTP %s\n' "$production_status"

leaderboard_url="${SUPABASE_URL%/}/rest/v1/leaderboard?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10"
leaderboard_body="$(curl -sS --fail-with-body \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$leaderboard_url")"

case "$leaderboard_body" in
  \[*\])
    printf 'Leaderboard read passed: returned a JSON array.\n'
    ;;
  *)
    printf 'Leaderboard read failed: expected a JSON array.\n' >&2
    exit 1
    ;;
esac

if [ "${VERIFY_ROUND_TRIP:-0}" = "1" ]; then
  : "${VERIFY_PLAYER_NAME:?Set VERIFY_PLAYER_NAME when VERIFY_ROUND_TRIP=1}"
  : "${VERIFY_SCORE:?Set VERIFY_SCORE when VERIFY_ROUND_TRIP=1}"
  command -v jq >/dev/null 2>&1 || {
    printf 'Round-trip verification requires jq for safe JSON encoding.\n' >&2
    exit 1
  }

  case "$VERIFY_PLAYER_NAME" in
    ''|*[![:print:]]*)
      printf 'VERIFY_PLAYER_NAME must be printable and non-empty.\n' >&2
      exit 1
      ;;
  esac
  case "$VERIFY_SCORE" in
    ''|*[!0-9]*)
      printf 'VERIFY_SCORE must contain only non-negative integer digits.\n' >&2
      exit 1
      ;;
  esac

  payload="$(jq -cn \
    --arg name "$VERIFY_PLAYER_NAME" \
    --arg score "$VERIFY_SCORE" \
    '{player_name: $name, score: ($score | tonumber)}')"
  inserted="$(curl -sS --fail-with-body \
    -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H 'Content-Type: application/json' \
    -H 'Prefer: return=representation' \
    --data "$payload" \
    "${SUPABASE_URL%/}/rest/v1/leaderboard")"

  case "$inserted" in
    *"$VERIFY_PLAYER_NAME"*)
      printf 'Leaderboard insert/read round trip passed.\n'
      ;;
    *)
      printf 'Leaderboard insert failed: inserted response did not contain the submitted name.\n' >&2
      exit 1
      ;;
  esac

  roundtrip_body="$(curl -sS --fail-with-body --get \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --data-urlencode 'select=player_name,score,created_at' \
    --data-urlencode "player_name=eq.$VERIFY_PLAYER_NAME" \
    --data-urlencode "score=eq.$VERIFY_SCORE" \
    --data-urlencode 'limit=1' \
    "${SUPABASE_URL%/}/rest/v1/leaderboard")"
  case "$roundtrip_body" in
    *"$VERIFY_PLAYER_NAME"*)
      printf 'Leaderboard persisted read passed.\n'
      ;;
    *)
      printf 'Leaderboard persisted read failed: submitted row was not returned.\n' >&2
      exit 1
      ;;
  esac
  printf 'Note: public delete is intentionally unavailable, so the verification row remains.\n'
fi
