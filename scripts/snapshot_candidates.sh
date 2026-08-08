#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$ROOT_DIR/submissions"

ALL_TREATMENTS=(monolith native_dynamic native_isolated a2a monolith_warm a2a_async a2a_async_streaming_opencode monolith_sol_medium monolith_opencode monolith_sol_medium_opencode monolith_sol_medium_opencode_api monolith_sol_low_opencode monolith_sol_high_opencode monolith_luna_xhigh_opencode monolith_luna_high_opencode monolith_luna_max_codex_minimal monolith_luna_max_opencode_retest monolith_luna_max_opencode_speckit dynamic_luna_max_opencode_superpowers monolith_luna_max_opencode_ai_repo_template monolith_luna_xhigh_fast_opencode monolith_luna_max_fast_opencode monolith_sol_low_fast_opencode monolith_sol_medium_fast_opencode monolith_grok_4_5_medium_cursor monolith_grok_4_5_high_cursor monolith_grok_4_5_medium_fast_cursor monolith_grok_4_5_high_fast_cursor monolith_auto_cursor monolith_luna_xhigh_opencode_control)
if [ "$#" -gt 0 ]; then
  TREATMENTS=("$@")
else
  TREATMENTS=()
  for treatment in "${ALL_TREATMENTS[@]}"; do
    if [ -f "$ROOT_DIR/candidates/$treatment/benchmark-result.json" ]; then TREATMENTS+=("$treatment"); fi
  done
fi

for treatment in "${TREATMENTS[@]}"; do
  mkdir -p "$ROOT_DIR/submissions/$treatment"
  rsync -a --delete --delete-excluded \
    --exclude='.git/' \
    --exclude='.git' \
    --exclude='node_modules/' \
    --exclude='.wrangler/' \
    --exclude='.playwright-cli/' \
    --exclude='.opencode/auth.json' \
    --exclude='dist/' \
    --exclude='*.png' \
    --exclude='.env' \
    --exclude='.env.*' \
    "$ROOT_DIR/candidates/$treatment/" "$ROOT_DIR/submissions/$treatment/"
done

du -sh "$ROOT_DIR"/submissions/*
