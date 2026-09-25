#!/usr/bin/env bash
# Issue #207 Phase 2A/2B: hermetic tests for the WebKit CI scripts (no network, no browser, no
# repo history needed -- runs in ci.yml's shallow checkout and locally).
#
#   1. classify-webkit.mjs --self-test          (path classifier + repository scan, #201/#207)
#   2. webkit-shard-evidence.mjs --self-test    (shard coverage verifier, #207)
#   3. webkit-shard-evidence.mjs collect/verify CLI round trip on Playwright-shaped JSON, including
#      "Re-run failed jobs" (stale earlier-attempt evidence present next to the re-run's)
#   4. webkit-gate.sh truth table               (every classify x webkit x evidence combination)
#   5. classify-webkit-pr.sh decisions in a throwaway git repo (docs-only, tools-only, unit-test-
#      only, guard violation, runtime, push / workflow_dispatch events, `webkit-full` label,
#      fail-safe, no-reuse-without-evidence)
#
# Usage: bash scripts/ci/test-webkit-ci.sh   (exit 0 = all passed)
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
cases=0

check() { # name, expected, actual
  cases=$((cases + 1))
  if [ "$2" = "$3" ]; then
    echo "PASS $1"
  else
    echo "FAIL $1 (expected '$2', got '$3')"
    failures=$((failures + 1))
  fi
}

echo "== 1. path classifier self-test"
node "$here/classify-webkit.mjs" --self-test > "$work/cls.txt" 2>&1
check "classify-webkit.mjs --self-test" 0 $?

echo "== 2. shard evidence self-test"
node "$here/webkit-shard-evidence.mjs" --self-test > "$work/ev.txt" 2>&1
check "webkit-shard-evidence.mjs --self-test" 0 $?

echo "== 3. evidence CLI round trip"
# Playwright-shaped JSON: a --list report (status skipped, no results) and per-shard run reports.
cat > "$work/mk.mjs" <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
const [dir, ...args] = process.argv.slice(2);
const opts = Object.fromEntries(args.map((a) => a.split("=")));
const ids = ["a", "b", "c", "d", "e"];
const report = (project, entries) => ({
  suites: [{ title: "x.spec.ts", file: "x.spec.ts", specs: [], suites: [{ title: "grp", file: "x.spec.ts",
    specs: entries.map(([id, status]) => ({ id: `${project}-${id}`, title: `t ${id}`, file: "x.spec.ts", line: 1,
      tests: [{ projectName: project, status, expectedStatus: "passed" }] })) }] }],
});
mkdirSync(dir, { recursive: true });
for (const project of ["webkit-390x844", "webkit-360x800"]) {
  writeFileSync(`${dir}/list-${project}.json`, JSON.stringify(report(project, ids.map((id) => [id, "skipped"]))));
  for (const shard of [1, 2]) {
    let mine = ids.filter((_, i) => i % 2 === shard - 1).map((id) => [id, "expected"]);
    if (opts.fail === `${project}-${shard}`) mine = mine.map(([id], i) => [id, i === 0 ? "unexpected" : "expected"]);
    if (opts.drop === `${project}-${shard}`) mine = mine.slice(1);
    writeFileSync(`${dir}/res-${project}-${shard}.json`, JSON.stringify(report(project, mine)));
  }
}
EOF
make_evidence() { # dir [fail=P-S] [drop=P-S] [omit=P-S] [only=P-S] [attempt=N]
  local dir="$1" omit="" only="" attempt=1
  shift
  for a in "$@"; do
    case "$a" in omit=*) omit="${a#omit=}" ;; only=*) only="${a#only=}" ;; attempt=*) attempt="${a#attempt=}" ;; esac
  done
  node "$work/mk.mjs" "$dir/raw" "$@"
  for p in webkit-390x844 webkit-360x800; do
    for s in 1 2; do
      [ "$omit" = "$p-$s" ] && continue
      [ -n "$only" ] && [ "$only" != "$p-$s" ] && continue
      # Same layout as the gate's download-artifact (one directory per artifact name).
      node "$here/webkit-shard-evidence.mjs" collect --project "$p" --shard "$s" --total 2 --attempt "$attempt" \
        --list "$dir/raw/list-$p.json" --results "$dir/raw/res-$p-$s.json" \
        --out "$dir/ev/webkit-evidence-$p-shard$s-attempt$attempt/evidence.json" > /dev/null
    done
  done
}
make_evidence "$work/good"
make_evidence "$work/failed" fail=webkit-360x800-2
make_evidence "$work/dropped" drop=webkit-390x844-1
make_evidence "$work/missing" omit=webkit-360x800-1
mkdir -p "$work/empty/ev"
# a shard whose results file never got written (e.g. the run step crashed before the reporter)
make_evidence "$work/nores"
node "$here/webkit-shard-evidence.mjs" collect --project webkit-390x844 --shard 2 --total 2 --attempt 1 \
  --list "$work/nores/raw/list-webkit-390x844.json" --results "$work/nores/raw/does-not-exist.json" \
  --out "$work/nores/ev/webkit-evidence-webkit-390x844-shard2-attempt1/evidence.json" > /dev/null
# "Re-run failed jobs" (PR #221 run 36019302842): attempt 1 fails 390x844 shard 1/2, only that shard
# re-runs as attempt 2. Both attempts' artifacts are downloaded; the stale failure must be ignored.
make_evidence "$work/rerun" fail=webkit-390x844-1
make_evidence "$work/rerun2" only=webkit-390x844-1 attempt=2
cp -r "$work/rerun2/ev/." "$work/rerun/ev/"
# ... and the same, but the re-run fails again (360x800 shard 2/2 this time).
make_evidence "$work/rerunfail" fail=webkit-360x800-2
make_evidence "$work/rerunfail2" fail=webkit-360x800-2 only=webkit-360x800-2 attempt=2
cp -r "$work/rerunfail2/ev/." "$work/rerunfail/ev/"
# ... and an older passing attempt must never rescue a newer failing one.
make_evidence "$work/regress"
make_evidence "$work/regress2" fail=webkit-390x844-2 only=webkit-390x844-2 attempt=2
cp -r "$work/regress2/ev/." "$work/regress/ev/"
# collect without --attempt records an error (-> the gate fails)
make_evidence "$work/noattempt"
node "$here/webkit-shard-evidence.mjs" collect --project webkit-360x800 --shard 1 --total 2 \
  --list "$work/noattempt/raw/list-webkit-360x800.json" --results "$work/noattempt/raw/res-webkit-360x800-1.json" \
  --out "$work/noattempt/ev/webkit-evidence-webkit-360x800-shard1-attempt1/evidence.json" > /dev/null

verify() { node "$here/webkit-shard-evidence.mjs" verify --dir "$1" --projects "webkit-390x844 webkit-360x800" > /dev/null 2>&1; echo $?; }
check "verify: 2 projects x 2 shards, all passed" 0 "$(verify "$work/good/ev")"
check "verify: one failed test" 1 "$(verify "$work/failed/ev")"
check "verify: a listed test never ran" 1 "$(verify "$work/dropped/ev")"
check "verify: shard evidence missing" 1 "$(verify "$work/missing/ev")"
check "verify: no evidence" 1 "$(verify "$work/empty/ev")"
check "verify: results file missing" 1 "$(verify "$work/nores/ev")"
check "verify: nonexistent dir" 1 "$(verify "$work/nope")"
check "verify: rerun -- stale failed attempt 1 superseded by passing attempt 2" 0 "$(verify "$work/rerun/ev")"
node "$here/webkit-shard-evidence.mjs" verify --dir "$work/rerun/ev" --projects "webkit-390x844 webkit-360x800" \
  | grep -q 'Superseded by a later re-run attempt (ignored): webkit-390x844 shard 1/2 attempt 1'
check "verify: rerun summary names the superseded attempt" 0 $?
check "verify: rerun that failed again" 1 "$(verify "$work/rerunfail/ev")"
check "verify: newer failed attempt is not rescued by an older pass" 1 "$(verify "$work/regress/ev")"
check "verify: collect without --attempt" 1 "$(verify "$work/noattempt/ev")"
check "verify: only one project required but two present" 1 \
  "$(node "$here/webkit-shard-evidence.mjs" verify --dir "$work/good/ev" --projects "webkit-390x844" > /dev/null 2>&1; echo $?)"

echo "== 4. WebKit Gate truth table"
gate() { # classify_result webkit_required webkit_result evidence_dir
  CLASSIFY_RESULT="$1" WEBKIT_REQUIRED="$2" WEBKIT_RESULT="$3" EVIDENCE_DIR="$4" \
    REASON="test" TESTED_BASE="0123456789012345678901234567890123456789" GITHUB_STEP_SUMMARY="$work/summary.md" \
    bash "$here/webkit-gate.sh" > "$work/gate.out" 2>&1
  echo $?
}
G="$work/good/ev"
check "gate: docs-only, webkit skipped -> PASS" 0 "$(gate success false skipped "")"
check "gate: not required, ran and passed -> PASS" 0 "$(gate success false success "")"
check "gate: not required, ran and failed -> FAIL" 1 "$(gate success false failure "")"
check "gate: not required, cancelled -> FAIL" 1 "$(gate success false cancelled "")"
check "gate: required, all shards passed + evidence OK -> PASS" 0 "$(gate success true success "$G")"
grep -q 'tested_base=0123456789012345678901234567890123456789 level=full' "$work/gate.out"
check "gate: PASS notice keeps tested_base token for reuse" 0 $?
check "gate: required, success but no evidence -> FAIL" 1 "$(gate success true success "$work/empty/ev")"
check "gate: required, success but a shard's evidence missing -> FAIL" 1 "$(gate success true success "$work/missing/ev")"
check "gate: required, success but a test never ran -> FAIL" 1 "$(gate success true success "$work/dropped/ev")"
check "gate: required, success but evidence shows a failure -> FAIL" 1 "$(gate success true success "$work/failed/ev")"
check "gate: rerun failed jobs, shard now passes -> PASS (stale evidence ignored)" 0 "$(gate success true success "$work/rerun/ev")"
check "gate: rerun failed jobs, shard failed again -> FAIL" 1 "$(gate success true failure "$work/rerunfail/ev")"
check "gate: rerun evidence failed even though matrix says success -> FAIL" 1 "$(gate success true success "$work/rerunfail/ev")"
check "gate: required, shard failure -> FAIL" 1 "$(gate success true failure "$G")"
check "gate: required, shard cancelled -> FAIL" 1 "$(gate success true cancelled "$G")"
check "gate: required, shards skipped -> FAIL" 1 "$(gate success true skipped "$G")"
check "gate: classify failed -> fail-safe Full ran and verified -> PASS" 0 "$(gate failure "" success "$G")"
check "gate: classify failed, webkit skipped -> FAIL" 1 "$(gate failure "" skipped "")"
check "gate: classify cancelled, webkit cancelled -> FAIL" 1 "$(gate cancelled "" cancelled "")"
check "gate: garbage webkit_required, webkit skipped -> FAIL" 1 "$(gate success maybe skipped "")"
check "gate: garbage webkit_required, verified Full ran -> PASS" 0 "$(gate success maybe success "$G")"
check "gate: empty webkit result -> FAIL" 1 "$(gate success true "" "$G")"

echo "== 5. classify-webkit-pr.sh decisions (throwaway repo)"
repo="$work/repo"
git init -q "$repo"
g() { git -C "$repo" -c user.name=t -c user.email=t@example.invalid "$@"; }
mkdir -p "$repo/src" "$repo/docs" "$repo/e2e" "$repo/tools"
echo "x" > "$repo/src/a.ts"; echo "r" > "$repo/README.md"
echo 'import { x } from "./a";' > "$repo/src/a.test.ts"
echo 'import { test } from "@playwright/test";' > "$repo/e2e/a.spec.ts"
echo '<script type="module" src="/src/a.ts"></script>' > "$repo/index.html"
echo '{"scripts":{"test":"vitest run"}}' > "$repo/package.json"
echo 'export default { testDir: "./e2e" };' > "$repo/playwright.config.ts"
echo "print(1)" > "$repo/tools/fresh_design_model.py"
g add -A; g commit -q -m base; base="$(g rev-parse HEAD)"
echo "d" > "$repo/docs/x.md"; g add -A; g commit -q -m docs; docs_head="$(g rev-parse HEAD)"
echo "y" > "$repo/src/a.ts"; g add -A; g commit -q -m src; src_head="$(g rev-parse HEAD)"
echo "e" >> "$repo/docs/x.md"; g add -A; g commit -q -m docs2; docs_on_src="$(g rev-parse HEAD)"
g checkout -q -b tools "$base"
echo "print(2)" > "$repo/tools/fresh_design_model.py"; mkdir -p "$repo/docs"; echo "n" > "$repo/docs/t.md"; g add -A; g commit -q -m tools; tools_head="$(g rev-parse HEAD)"
g checkout -q -b unit "$base"
echo 'import { x } from "./a"; // more' > "$repo/src/a.test.ts"; g add -A; g commit -q -m unit; unit_head="$(g rev-parse HEAD)"
echo 'export const y = 1;' > "$repo/src/b.ts"; g add -A; g commit -q -m unit-plus-runtime; unit_runtime_head="$(g rev-parse HEAD)"
g checkout -q -b guard "$base"
echo 'import "./a.test";' > "$repo/src/a.ts"; g add -A; g commit -q -m wire-test; guard_base="$(g rev-parse HEAD)"
echo 'import { x } from "./a"; // changed' > "$repo/src/a.test.ts"; g add -A; g commit -q -m unit2; guard_head="$(g rev-parse HEAD)"

classify() { # KEY=VALUE... ; prints webkit_required
  local out="$work/gh_output"
  : > "$out"
  (cd "$repo" && env -u GH_TOKEN -u REPO -u GITHUB_STEP_SUMMARY GITHUB_OUTPUT="$out" "$@" \
    bash "$here/classify-webkit-pr.sh" > /dev/null 2>&1)
  sed -n 's/^webkit_required=//p' "$out"
}
check "pr: docs-only PR -> skip" false "$(classify BASE_SHA="$base" HEAD_SHA="$docs_head")"
# classify-webkit-pr.sh scans the CHECKED-OUT tree (in CI: the merge ref), so check out each head.
co() { g checkout -q "$1"; }
co "$tools_head"
check "pr: tools/**/*.py + docs PR -> skip" false "$(classify BASE_SHA="$base" HEAD_SHA="$tools_head")"
co "$unit_head"
check "pr: src/**/*.test.ts-only PR -> skip" false "$(classify BASE_SHA="$base" HEAD_SHA="$unit_head")"
co "$unit_runtime_head"
check "pr: unit test + runtime file -> run" true "$(classify BASE_SHA="$base" HEAD_SHA="$unit_runtime_head")"
co "$guard_head"
check "pr: test-only change, but runtime imports a test module -> run" true \
  "$(classify BASE_SHA="$guard_base" HEAD_SHA="$guard_head")"
co "$src_head"
check "pr: unit-test-only increment on a runtime PR without gate evidence -> run" true \
  "$(classify BASE_SHA="$base" HEAD_SHA="$docs_on_src" BEFORE_SHA="$src_head")"
co "$docs_on_src"
check "pr: runtime PR -> run" true "$(classify BASE_SHA="$base" HEAD_SHA="$src_head")"
check "pr: explicit pull_request event, docs-only -> skip" false "$(classify EVENT_NAME=pull_request BASE_SHA="$base" HEAD_SHA="$docs_head")"
check "push to main -> Full" true "$(classify EVENT_NAME=push)"
check "workflow_dispatch -> Full" true "$(classify EVENT_NAME=workflow_dispatch)"
check "pr: webkit-full label forces Full on a docs-only PR" true \
  "$(classify BASE_SHA="$base" HEAD_SHA="$docs_head" PR_LABELS="enhancement,webkit-full")"
check "pr: other labels do not force" false "$(classify BASE_SHA="$base" HEAD_SHA="$docs_head" PR_LABELS="enhancement,webkit-fullish")"
check "pr: docs-only push on a runtime PR without gate evidence -> run" true \
  "$(classify BASE_SHA="$base" HEAD_SHA="$docs_on_src" BEFORE_SHA="$src_head")"
check "pr: missing BASE/HEAD -> fail-safe run" true "$(classify BASE_SHA="" HEAD_SHA="")"
check "pr: unknown base sha -> fail-safe run" true "$(classify BASE_SHA=deadbeef HEAD_SHA="$docs_head")"
out="$work/gh_output"; : > "$out"
(cd "$repo" && env -u GH_TOKEN GITHUB_OUTPUT="$out" EVENT_NAME=push bash "$here/classify-webkit-pr.sh" > /dev/null 2>&1)
grep -q '^reason=event .push. always runs Full WebKit' "$out"
check "push reason is explicit (not a fail-safe message)" 0 $?

# THIS repository's own tree must keep both guarded categories enabled -- otherwise the skip
# silently never fires (e.g. a comment mentioning tools/** in e2e-webkit.yml disabled it once).
repo_root="$(cd "$here/../.." && pwd)"
check "this repo: tools/**/*.py-only change -> skip" false \
  "$(printf 'tools/progression2_phase34_unlocks.py\n' | node "$here/classify-webkit.mjs" --repo "$repo_root" 2>/dev/null | sed -n 's/^webkit_required=//p')"
check "this repo: unit-test-only change -> skip" false \
  "$(printf 'src/logic/scoring.test.ts\n' | node "$here/classify-webkit.mjs" --repo "$repo_root" 2>/dev/null | sed -n 's/^webkit_required=//p')"
check "this repo: persistence change -> run" true \
  "$(printf 'src/state/persistence.ts\n' | node "$here/classify-webkit.mjs" --repo "$repo_root" 2>/dev/null | sed -n 's/^webkit_required=//p')"

echo ""
echo "$((cases - failures))/$cases WebKit CI script cases passed"
[ "$failures" -eq 0 ]
