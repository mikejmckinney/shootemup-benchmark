#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:?usage: judge_candidate.sh <treatment> [evidence-dir] [candidate-dir]}
CANDIDATE_DIR=${3:-"$ROOT_DIR/candidates/$TREATMENT"}
EVIDENCE_DIR=${2:-"$ROOT_DIR/results/evidence/$TREATMENT"}
SCHEMA="$ROOT_DIR/benchmark/evaluator/manual-score.schema.json"

if [ ! -f "$EVIDENCE_DIR/automated.json" ]; then
  echo "run evaluate_candidate.sh first" >&2
  exit 66
fi

IMAGES=()
for image_path in "$EVIDENCE_DIR/desktop-before.png" "$EVIDENCE_DIR/desktop-after.png" "$EVIDENCE_DIR/mobile.png"; do
  if [ -f "$image_path" ]; then IMAGES+=(--image "$image_path"); fi
done

PROMPT=$(printf '%s\n\n%s\n\n%s' \
  "Act as an architecture-blind evidence judge for a controlled software benchmark. Inspect the candidate source tree and all evidence in $EVIDENCE_DIR. Read $ROOT_DIR/benchmark/protocol.md, especially the 100-point rubric. Do not modify anything." \
  "The deterministic evaluator has already allocated up to 54 points. Award only the remaining 46: combat/progression depth 0-5; visual design and feedback 0-12; remaining resilience/accessibility 0-2; Supabase/data security 0-10; engineering quality 0-10; reproducibility/handoff beyond the result artifact 0-7. Use screenshots when present. Check migration SQL, source, README, lockfile, and evaluator test/build logs. Give zero where evidence is missing; do not infer deployed behavior from claims. manual_points must exactly equal the six awarded values." \
  "Return only the JSON required by the supplied schema. Cite concrete files, logs, or visible screenshot facts in each evidence array. Ignore the treatment name and coordination architecture.")

codex exec --ephemeral --json --sandbox read-only --cd "$CANDIDATE_DIR" \
  --add-dir "$EVIDENCE_DIR" --add-dir "$ROOT_DIR/benchmark" \
  --model gpt-5.6-luna -c model_reasoning_effort='"max"' -c features.multi_agent=false \
  --output-schema "$SCHEMA" --output-last-message "$EVIDENCE_DIR/manual-score.json" \
  "$PROMPT" "${IMAGES[@]}" </dev/null > "$EVIDENCE_DIR/judge-session.jsonl" \
  2> "$EVIDENCE_DIR/judge-session.stderr.log"

jq -e '
  .combat_progression.awarded <= 5 and .visual_design.awarded <= 12 and
  .resilience_accessibility.awarded <= 2 and .data_security.awarded <= 10 and
  .engineering_quality.awarded <= 10 and .reproducibility.awarded <= 7 and
  .manual_points == (.combat_progression.awarded + .visual_design.awarded +
    .resilience_accessibility.awarded + .data_security.awarded +
    .engineering_quality.awarded + .reproducibility.awarded)
' "$EVIDENCE_DIR/manual-score.json" >/dev/null
jq . "$EVIDENCE_DIR/manual-score.json"
