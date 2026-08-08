#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FRAME_DIR=$(mktemp -d /tmp/shootemup-gallery-frames.XXXXXX)
trap 'rm -rf "$FRAME_DIR"' EXIT

ALL_TREATMENTS=(monolith native_dynamic native_isolated a2a monolith_warm a2a_async a2a_async_streaming_opencode monolith_sol_medium monolith_opencode monolith_sol_medium_opencode monolith_sol_medium_opencode_api monolith_sol_low_opencode monolith_sol_high_opencode monolith_luna_xhigh_opencode monolith_luna_high_opencode monolith_luna_max_codex_minimal monolith_luna_max_opencode_retest monolith_luna_max_opencode_speckit dynamic_luna_max_opencode_superpowers monolith_luna_max_opencode_ai_repo_template monolith_luna_xhigh_fast_opencode monolith_luna_max_fast_opencode monolith_sol_low_fast_opencode monolith_sol_medium_fast_opencode monolith_grok_4_5_medium_cursor monolith_grok_4_5_high_cursor monolith_grok_4_5_medium_fast_cursor monolith_grok_4_5_high_fast_cursor monolith_auto_cursor monolith_luna_xhigh_opencode_control)
if [ "$#" -gt 0 ]; then
  TREATMENTS=("$@")
else
  TREATMENTS=()
  for treatment in "${ALL_TREATMENTS[@]}"; do
    if [ -f "$ROOT_DIR/candidates/$treatment/benchmark-result.json" ]; then TREATMENTS+=("$treatment"); fi
  done
fi

mkdir -p "$ROOT_DIR/assets/gallery"
node "$ROOT_DIR/benchmark/evaluator/capture-gallery.mjs" "$ROOT_DIR" "$FRAME_DIR" "${TREATMENTS[@]}"

for treatment in "${TREATMENTS[@]}"; do
  ffmpeg -hide_banner -loglevel error -y \
    -framerate 6 \
    -i "$FRAME_DIR/$treatment/frame-%03d.png" \
    -vf "fps=6,scale=800:-2:flags=lanczos" \
    -an -loop 0 -c:v libwebp -lossless 0 -compression_level 6 -q:v 58 \
    "$ROOT_DIR/assets/gallery/$treatment.webp"
done

for treatment in "${TREATMENTS[@]}"; do
  du -h "$ROOT_DIR/assets/gallery/$treatment.webp"
done
