#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TREATMENT=${1:?usage: evaluate_candidate.sh <treatment> [evidence-dir] [candidate-dir]}
CANDIDATE_DIR=${3:-"$ROOT_DIR/candidates/$TREATMENT"}
EVIDENCE_DIR=${2:-"$ROOT_DIR/results/evidence/$TREATMENT"}
EVALUATOR_DIR="$ROOT_DIR/benchmark/evaluator"
mkdir -p "$EVIDENCE_DIR"

if [ ! -d "$EVALUATOR_DIR/node_modules/playwright" ]; then
  npm --prefix "$EVALUATOR_DIR" install --ignore-scripts
fi
(cd "$EVALUATOR_DIR" && npx playwright install chromium >/dev/null)

set +e
node "$EVALUATOR_DIR/evaluate.mjs" "$CANDIDATE_DIR" "$EVIDENCE_DIR" \
  > "$EVIDENCE_DIR/browser-evaluator.log" 2>&1
BROWSER_EXIT=$?
set -e

PACKAGE_JSON="$CANDIDATE_DIR/package.json"
for script_name in test build lint typecheck; do
  if [ -f "$PACKAGE_JSON" ] && jq -e --arg name "$script_name" '.scripts[$name] != null' "$PACKAGE_JSON" >/dev/null; then
    set +e
    (cd "$CANDIDATE_DIR" && timeout --signal=INT --kill-after=10s 180s env CI=true npm run "$script_name") \
      > "$EVIDENCE_DIR/$script_name.log" 2>&1
    script_exit=$?
    set -e
    printf '%s\n' "$script_exit" > "$EVIDENCE_DIR/$script_name.exit-code"
  fi
done

find "$CANDIDATE_DIR" -maxdepth 4 -type f \
  -not -path '*/node_modules/*' -not -path '*/.git/*' -printf '%P\n' | sort \
  > "$EVIDENCE_DIR/source-manifest.txt"

if [ -f "$EVIDENCE_DIR/automated.json" ]; then
  jq '{automated_points,automated_points_available,result_artifact_valid,checks,notes}' "$EVIDENCE_DIR/automated.json"
else
  echo "browser evaluator failed with exit $BROWSER_EXIT; see $EVIDENCE_DIR/browser-evaluator.log" >&2
fi
exit "$BROWSER_EXIT"
