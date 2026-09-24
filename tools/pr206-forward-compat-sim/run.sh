#!/usr/bin/env bash
# PR #206 Forward-Compat Deployment Readiness Fresh Audit -- reproduces the unit-level simulation.
#   A = main dff233c, B = main dff233c + PR #206 HEAD 4c1da87 (local merge, never pushed).
# Usage: tools/pr206-forward-compat-sim/run.sh [out.json]
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
MAIN=${MAIN_SHA:-dff233c042d2df6ee1c3a92f2d2419830aa05460}
PR206=${PR206_SHA:-4c1da8703bb22a2be7cad911f92ec33cb0f0485d}
WORK=${SIM_WORK:-$(mktemp -d)}
OUT=${1:-$WORK/TETO_PR206_FORWARD-COMPAT_SIMULATION.unit.json}

git -C "$ROOT" fetch -q origin "$MAIN" "pull/206/head" || true
TREE=$(git -C "$ROOT" merge-tree --write-tree "$MAIN" "$PR206")
MERGED=$(git -C "$ROOT" commit-tree "$TREE" -p "$MAIN" -p "$PR206" -m "sim: main+#206 (local only)")

[ -d "$WORK/wtA" ] || git -C "$ROOT" worktree add -q --detach "$WORK/wtA" "$MAIN"
[ -d "$WORK/wtB" ] || git -C "$ROOT" worktree add -q --detach "$WORK/wtB" "$MERGED"
for t in wtA wtB; do [ -e "$WORK/$t/node_modules" ] || ln -s "$ROOT/node_modules" "$WORK/$t/node_modules"; done

cd "$ROOT"
SIM_TREE_A="$WORK/wtA" SIM_TREE_B="$WORK/wtB" SIM_OUT="$OUT" \
  npx vitest run --config tools/pr206-forward-compat-sim/vitest.config.ts
echo "wrote $OUT"
