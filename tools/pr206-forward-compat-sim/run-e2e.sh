#!/usr/bin/env bash
# Real-browser (Chromium 390x844) session for A and B. Run ./run.sh first (it creates the trees).
# Usage: SIM_WORK=<dir used by run.sh> tools/pr206-forward-compat-sim/run-e2e.sh
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
: "${SIM_WORK:?set SIM_WORK to the directory run.sh used}"
OUTDIR=${OUTDIR:-$SIM_WORK}
cd "$ROOT"
for pair in "A:wtA:5191" "B:wtB:5192"; do
  IFS=: read -r label dir port <<<"$pair"
  SIM_TREE="$SIM_WORK/$dir" SIM_PORT=$port SIM_BUILD_LABEL=$label \
    SIM_E2E_OUT="$OUTDIR/TETO_PR206_FORWARD-COMPAT_SIMULATION.e2e-$label.json" \
    npx playwright test --config tools/pr206-forward-compat-sim/playwright.config.ts
done
