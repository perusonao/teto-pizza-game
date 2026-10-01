#!/usr/bin/env bash
# Issue #207 Phase 2A: hermetic tests for the WebKit CI scripts (no network, no browser, no repo
# history needed -- runs in ci.yml's shallow checkout and locally).
#
#   1. classify-webkit.mjs --self-test          (path classifier, #201)
#   2. webkit-shard-evidence.mjs --self-test    (shard coverage verifier, #207)
#   3. webkit-shard-evidence.mjs collect/verify CLI round trip on Playwright-shaped JSON, including
#      "Re-run failed jobs" (stale earlier-attempt evidence present next to the re-run's)
#   4. webkit-gate.sh truth table               (every classify x webkit x evidence combination)
#   5. classify-webkit-pr.sh decisions in a throwaway git repo (docs-only, runtime, push /
#      workflow_dispatch events, `webkit-full` label, fail-safe, no-reuse-without-evidence)
#   6. I5b-5 Layout Contract: layout-summary.mjs --self-test and the layout-gate.sh truth table
#   7. CI/WebKit Efficiency S1: install-with-retry.sh (timeout + limited retry, install only)
#   8. CI/WebKit Efficiency S2: install_status -> evidence -> WebKit Gate FAIL-INFRA / FAIL-TEST /
#      PASS (all FAIL labels stay non-zero = fail-closed)
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
  : > "$work/summary.md"
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
mkdir -p "$repo/src" "$repo/docs"
echo "x" > "$repo/src/a.ts"; echo "r" > "$repo/README.md"
g add -A; g commit -q -m base; base="$(g rev-parse HEAD)"
echo "d" > "$repo/docs/x.md"; g add -A; g commit -q -m docs; docs_head="$(g rev-parse HEAD)"
echo "y" > "$repo/src/a.ts"; g add -A; g commit -q -m src; src_head="$(g rev-parse HEAD)"
echo "e" >> "$repo/docs/x.md"; g add -A; g commit -q -m docs2; docs_on_src="$(g rev-parse HEAD)"

classify() { # KEY=VALUE... ; prints webkit_required
  local out="$work/gh_output"
  : > "$out"
  (cd "$repo" && env -u GH_TOKEN -u REPO -u GITHUB_STEP_SUMMARY GITHUB_OUTPUT="$out" "$@" \
    bash "$here/classify-webkit-pr.sh" > /dev/null 2>&1)
  sed -n 's/^webkit_required=//p' "$out"
}
check "pr: docs-only PR -> skip" false "$(classify BASE_SHA="$base" HEAD_SHA="$docs_head")"
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

echo "== 6. Layout Contract summary + gate (I5b-5)"
node "$here/layout-summary.mjs" --self-test > "$work/ls.txt" 2>&1
check "layout-summary.mjs --self-test" 0 $?
# layout-chromium is one project, one shard (1/1): build its evidence the same way.
cat > "$work/mkl.mjs" <<'EOF2'
import { mkdirSync, writeFileSync } from "node:fs";
const [dir, mode] = process.argv.slice(2);
const project = "layout-chromium";
const report = (entries) => ({ suites: [{ title: "layout-contract.spec.ts", file: "layout-contract.spec.ts", specs: [], suites: [{
  title: "I5b-5 Layout Contract", file: "layout-contract.spec.ts",
  specs: entries.map(([id, status]) => ({ id: `${project}-${id}`, title: `LC-${id}`, file: "layout-contract.spec.ts", line: 1,
    tests: [{ projectName: project, status, expectedStatus: "passed" }] })) }] }] });
const ids = ["0", "1", "2", "3", "4", "5"];
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/list.json`, JSON.stringify(report(ids.map((id) => [id, "skipped"]))));
writeFileSync(`${dir}/res.json`, JSON.stringify(report(ids.map((id) => [id, mode === "fail" && id === "3" ? "unexpected" : "expected"]))));
EOF2
make_layout() { # dir mode
  node "$work/mkl.mjs" "$1/raw" "$2"
  node "$here/webkit-shard-evidence.mjs" collect --project layout-chromium --shard 1 --total 1 --attempt 1 \
    --list "$1/raw/list.json" --results "$1/raw/res.json" \
    --out "$1/ev/layout-evidence-layout-chromium-shard1-attempt1/evidence.json" > /dev/null
}
make_layout "$work/lgood" pass
make_layout "$work/lfail" fail
mkdir -p "$work/lempty/ev"
lgate() { # classify_result webkit_required layout_result evidence_dir
  CLASSIFY_RESULT="$1" WEBKIT_REQUIRED="$2" LAYOUT_RESULT="$3" EVIDENCE_DIR="$4" REASON="test" \
    GITHUB_STEP_SUMMARY="$work/lsummary.md" bash "$here/layout-gate.sh" > "$work/lgate.out" 2>&1
  echo $?
}
check "layout gate: docs-only, skipped -> PASS" 0 "$(lgate success false skipped "")"
check "layout gate: not required, ran and passed -> PASS" 0 "$(lgate success false success "")"
check "layout gate: not required, ran and failed -> FAIL" 1 "$(lgate success false failure "")"
check "layout gate: required, passed + evidence OK -> PASS" 0 "$(lgate success true success "$work/lgood/ev")"
check "layout gate: required, success but no evidence -> FAIL" 1 "$(lgate success true success "$work/lempty/ev")"
check "layout gate: required, evidence shows a failed LC test -> FAIL" 1 "$(lgate success true success "$work/lfail/ev")"
check "layout gate: required, job failed -> FAIL" 1 "$(lgate success true failure "$work/lgood/ev")"
check "layout gate: required, job cancelled -> FAIL" 1 "$(lgate success true cancelled "$work/lgood/ev")"
check "layout gate: required, job skipped -> FAIL" 1 "$(lgate success true skipped "$work/lgood/ev")"
check "layout gate: classify failed -> fail-safe, ran and verified -> PASS" 0 "$(lgate failure "" success "$work/lgood/ev")"
check "layout gate: classify failed, layout skipped -> FAIL" 1 "$(lgate failure "" skipped "")"
check "layout gate: empty layout result -> FAIL" 1 "$(lgate success true "" "$work/lgood/ev")"

echo "== 7. install-with-retry.sh (S1: install timeout + limited retry)"
retry() { # status_file [helper args...] -- cmd ; prints exit code
  local sf="$1"; shift
  INSTALL_RETRY_DELAY_SECS=0 bash "$here/install-with-retry.sh" --status-file "$sf" "$@" > "$work/retry.out" 2>&1
  echo $?
}
status_of() { sed -n "s/^$2=//p" "$1"; }
# a command that fails on its first N runs, then succeeds (counter in a file)
flaky_cmd() { echo "n=\$(cat $1 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $1; [ \$n -gt $2 ]"; }
rm -f "$work/c1"; check "retry: first attempt ok -> exit 0" 0 "$(retry "$work/s1" --timeout 5 --attempts 2 -- sh -c "$(flaky_cmd "$work/c1" 0)")"
check "retry: first attempt ok -> install_status=ok attempts=1" "ok 1" "$(status_of "$work/s1" install_status) $(status_of "$work/s1" install_attempts)"
rm -f "$work/c2"; check "retry: fails once then ok -> exit 0 (install retried)" 0 "$(retry "$work/s2" --timeout 5 --attempts 2 -- sh -c "$(flaky_cmd "$work/c2" 1)")"
check "retry: fails once then ok -> install_status=ok attempts=2" "ok 2" "$(status_of "$work/s2" install_status) $(status_of "$work/s2" install_attempts)"
rm -f "$work/c3"; check "retry: always fails -> exit non-zero" 7 "$(retry "$work/s3" --timeout 5 --attempts 2 -- sh -c "echo x >> $work/c3; exit 7")"
check "retry: always fails -> install_status=failed attempts=2 (exactly one retry)" "failed 2 2" "$(status_of "$work/s3" install_status) $(status_of "$work/s3" install_attempts) $(wc -l < "$work/c3" | tr -d ' ')"
rm -f "$work/c4"; check "retry: stall -> killed by timeout, exit 124" 124 "$(retry "$work/s4" --timeout 1 --attempts 2 -- sh -c "echo x >> $work/c4; sleep 30")"
check "retry: stall -> install_status=timeout attempts=2" "timeout 2 2" "$(status_of "$work/s4" install_status) $(status_of "$work/s4" install_attempts) $(wc -l < "$work/c4" | tr -d ' ')"
rm -f "$work/c5"; check "retry: stall then ok on retry -> exit 0" 0 "$(retry "$work/s5" --timeout 1 --attempts 2 -- sh -c "n=\$(cat $work/c5 2>/dev/null || echo 0); echo \$((n+1)) > $work/c5; [ \$n -ge 1 ] || sleep 30")"
check "retry: stall then ok -> install_status=ok attempts=2" "ok 2" "$(status_of "$work/s5" install_status) $(status_of "$work/s5" install_attempts)"
rm -f "$work/c6"; check "retry: --attempts 1 never retries" 3 "$(retry "$work/s6" --timeout 5 --attempts 1 -- sh -c "echo x >> $work/c6; exit 3")"
check "retry: --attempts 1 ran once" 1 "$(wc -l < "$work/c6" | tr -d ' ')"
check "retry: missing --status-file / command -> usage error" 2 "$(bash "$here/install-with-retry.sh" -- true > /dev/null 2>&1; echo $?)"
# Workflow contract: only the install is wrapped; Playwright test steps are never retried.
wf="$here/../../.github/workflows/e2e-webkit.yml"
grep -q 'install-with-retry.sh' "$wf" && grep -q -- '-- npx playwright install --with-deps webkit' "$wf"
check "workflow: WebKit install step uses the retry helper" 0 $?
grep -n 'install-with-retry' "$wf" | grep -q 'playwright test'
check "workflow: no Playwright test command is wrapped by the retry helper" 1 $?
grep -Eq '^\s*retries:\s*[1-9]|--retries' "$wf" "$here/../../playwright.config.ts"
check "workflow/config: Playwright test retries are not enabled" 1 $?

echo "== 8. S2 FAIL-INFRA / FAIL-TEST classification (install_status -> evidence -> WebKit Gate)"
# Real chain: helper writes the status file -> collect records it -> gate labels the verdict.
chain() { # dir install_cmd results_mode(good|fail|none) -> evidence dir $dir/ev (4 shards; 390x844 shard 1 is the subject)
  local dir="$1" install_cmd="$2" mode="$3"
  make_evidence "$dir"
  rm -rf "$dir/ev/webkit-evidence-webkit-390x844-shard1-attempt1"
  INSTALL_RETRY_DELAY_SECS=0 bash "$here/install-with-retry.sh" --status-file "$dir/install.status" --timeout 1 --attempts 2 -- sh -c "$install_cmd" > /dev/null 2>&1
  local results="$dir/raw/res-webkit-390x844-1.json"
  [ "$mode" = "none" ] && results="$dir/raw/missing.json"
  if [ "$mode" = "fail" ]; then
    node "$work/mk.mjs" "$dir/rawfail" fail=webkit-390x844-1
    results="$dir/rawfail/res-webkit-390x844-1.json"
  fi
  node "$here/webkit-shard-evidence.mjs" collect --project webkit-390x844 --shard 1 --total 2 --attempt 1 \
    --list "$dir/raw/list-webkit-390x844.json" --results "$results" --install-status "$dir/install.status" \
    --out "$dir/ev/webkit-evidence-webkit-390x844-shard1-attempt1/evidence.json" > /dev/null
}
gate_out() { cat "$work/gate.out"; }
chain "$work/c_pass" "true" good
chain "$work/c_instfail" "exit 1" none
chain "$work/c_insttimeout" "sleep 30" none
chain "$work/c_testfail" "true" fail
chain "$work/c_retryok" "n=\$(cat $work/c_retryok.n 2>/dev/null || echo 0); echo \$((n+1)) > $work/c_retryok.n; [ \$n -ge 1 ]" good

check "S2: install ok + tests pass -> PASS" 0 "$(gate success true success "$work/c_pass/ev")"
grep -q 'gate_class=PASS' "$work/summary.md"; check "S2: PASS -> gate_class=PASS" 0 $?
check "S2: install ok after one retry + tests pass -> PASS" 0 "$(gate success true success "$work/c_retryok/ev")"
check "S2: install failure -> gate FAIL (exit 1)" 1 "$(gate success true failure "$work/c_instfail/ev")"
grep -q '^FAIL (FAIL-INFRA) ' <(echo "$(sed -n 's/.*| \(FAIL[^|]*\) |$/\1/p' "$work/summary.md" | tail -n 1)")
check "S2: install failure -> verdict FAIL-INFRA" 0 $?
grep -q 'install_status=failed' "$work/gate.out" "$work/summary.md"; check "S2: install failure is named in the gate report" 0 $?
check "S2: install timeout -> gate FAIL (exit 1)" 1 "$(gate success true failure "$work/c_insttimeout/ev")"
grep -q 'FAIL-INFRA' "$work/summary.md" && ! grep -q 'FAIL-TEST' "$work/summary.md"
check "S2: install timeout -> FAIL-INFRA only" 0 $?
check "S2: install ok + Playwright failure -> gate FAIL (exit 1)" 1 "$(gate success true failure "$work/c_testfail/ev")"
grep -q 'FAIL-TEST' "$work/summary.md" && ! grep -q 'FAIL-INFRA' "$work/summary.md"
check "S2: install ok + Playwright failure -> FAIL-TEST only" 0 $?
check "S2: FAIL-INFRA evidence + matrix 'success' is still FAIL (never infra => green)" 1 "$(gate success true success "$work/c_instfail/ev")"
check "S2: FAIL-TEST evidence + matrix 'success' is still FAIL" 1 "$(gate success true success "$work/c_testfail/ev")"
check "S2: no evidence, matrix cancelled -> FAIL (exit 1)" 1 "$(gate success true cancelled "$work/empty/ev")"
grep -q 'FAIL-INFRA' "$work/summary.md"; check "S2: no evidence + cancelled -> FAIL-INFRA" 0 $?
check "S2: perfect evidence but matrix cancelled -> FAIL (unlabeled)" 1 "$(gate success true cancelled "$work/good/ev")"
check "S2: matrix 'failure' but evidence all green -> FAIL (never PASS)" 1 "$(gate success true failure "$work/good/ev")"
# evidence machine-readable fields
check "S2: evidence carries install_status=failed / test_status=not_run" "failed not_run" \
  "$(node -e 'const e=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(e.install_status,e.test_status)' "$work/c_instfail/ev/webkit-evidence-webkit-390x844-shard1-attempt1/evidence.json")"
check "S2: evidence carries install_status=ok / test_status=failed" "ok failed" \
  "$(node -e 'const e=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(e.install_status,e.test_status)' "$work/c_testfail/ev/webkit-evidence-webkit-390x844-shard1-attempt1/evidence.json")"
check "S2: evidence carries install_status=ok attempts=2 after a retry" "ok 2" \
  "$(node -e 'const e=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(e.install_status,e.install_attempts)' "$work/c_retryok/ev/webkit-evidence-webkit-390x844-shard1-attempt1/evidence.json")"
# layout-gate shares the verifier: the label shows up there too and it stays FAIL.
check "S2: layout gate unchanged for evidence without install_status (PASS)" 0 "$(lgate success true success "$work/lgood/ev")"

echo ""
echo "$((cases - failures))/$cases WebKit CI script cases passed"
[ "$failures" -eq 0 ]
