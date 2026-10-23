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
const total = Number(opts.total ?? 2);
const ids = ["a", "b", "c", "d", "e", "f", "g"];
const report = (project, entries) => ({
  suites: [{ title: "x.spec.ts", file: "x.spec.ts", specs: [], suites: [{ title: "grp", file: "x.spec.ts",
    specs: entries.map(([id, status]) => ({ id: `${project}-${id}`, title: `t ${id}`, file: "x.spec.ts", line: 1,
      tests: [{ projectName: project, status, expectedStatus: "passed" }] })) }] }],
});
mkdirSync(dir, { recursive: true });
for (const project of ["webkit-390x844", "webkit-360x800"]) {
  writeFileSync(`${dir}/list-${project}.json`, JSON.stringify(report(project, ids.map((id) => [id, "skipped"]))));
  for (const shard of Array.from({ length: total }, (_, i) => i + 1)) {
    let mine = ids.filter((_, i) => i % total === shard - 1).map((id) => [id, "expected"]);
    if (opts.fail === `${project}-${shard}`) mine = mine.map(([id], i) => [id, i === 0 ? "unexpected" : "expected"]);
    if (opts.drop === `${project}-${shard}`) mine = mine.slice(1);
    writeFileSync(`${dir}/res-${project}-${shard}.json`, JSON.stringify(report(project, mine)));
  }
}
EOF
make_evidence() { # dir [fail=P-S] [drop=P-S] [omit=P-S] [only=P-S] [attempt=N] [total=N, default 2]
  local dir="$1" omit="" only="" attempt=1 total=2
  shift
  for a in "$@"; do
    case "$a" in omit=*) omit="${a#omit=}" ;; only=*) only="${a#only=}" ;; attempt=*) attempt="${a#attempt=}" ;; total=*) total="${a#total=}" ;; esac
  done
  node "$work/mk.mjs" "$dir/raw" "$@"
  for p in webkit-390x844 webkit-360x800; do
    for s in $(seq 1 "$total"); do
      [ "$omit" = "$p-$s" ] && continue
      [ -n "$only" ] && [ "$only" != "$p-$s" ] && continue
      # Same layout as the gate's download-artifact (one directory per artifact name).
      node "$here/webkit-shard-evidence.mjs" collect --project "$p" --shard "$s" --total "$total" --attempt "$attempt" \
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

# Issue #512: the real matrix is 3 shards per project; the total=2 fixtures above stay as they are.
make_evidence "$work/good3" total=3
make_evidence "$work/failed3" total=3 fail=webkit-360x800-3
make_evidence "$work/dropped3" total=3 drop=webkit-390x844-3
make_evidence "$work/missing3" total=3 omit=webkit-390x844-3
make_evidence "$work/rerun3" total=3 fail=webkit-390x844-3
make_evidence "$work/rerun3b" total=3 only=webkit-390x844-3 attempt=2
cp -r "$work/rerun3b/ev/." "$work/rerun3/ev/"
make_evidence "$work/mixed3" total=3 omit=webkit-360x800-3
# 360x800 shard 3 reports total=2 (make_evidence only loops 1..total, so build this one directly from the same raw run)
node "$here/webkit-shard-evidence.mjs" collect --project webkit-360x800 --shard 3 --total 2 --attempt 1 \
  --list "$work/mixed3/raw/list-webkit-360x800.json" --results "$work/mixed3/raw/res-webkit-360x800-3.json" \
  --out "$work/mixed3/ev/webkit-evidence-webkit-360x800-shard3-attempt1/evidence.json" > /dev/null
check "mixed-total fixture really records total=2 on shard 3" 2 "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).total)' "$work/mixed3/ev/webkit-evidence-webkit-360x800-shard3-attempt1/evidence.json")"

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
check "verify: 3 shards x 2 projects, all passed" 0 "$(verify "$work/good3/ev")"
check "verify: 3 shards, one failed test (360x800 shard 3/3)" 1 "$(verify "$work/failed3/ev")"
check "verify: 3 shards, a listed test never ran (390x844 shard 3/3)" 1 "$(verify "$work/dropped3/ev")"
check "verify: 3 shards, shard 3/3 evidence missing" 1 "$(verify "$work/missing3/ev")"
check "verify: 3 shards, failed shard 3/3 superseded by passing re-run" 0 "$(verify "$work/rerun3/ev")"
check "verify: 3 shards, mixed totals (2 vs 3) within a project" 1 "$(verify "$work/mixed3/ev")"
mixed3_out="$(node "$here/webkit-shard-evidence.mjs" verify --dir "$work/mixed3/ev" --projects "webkit-390x844 webkit-360x800" 2>&1)"
check "verify: 3 shards, mixed-total failure names the inconsistent totals" "inconsistent shard totals [3,2]" "$(printf '%s\n' "$mixed3_out" | grep -o 'inconsistent shard totals \[3,2\]')"
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
# The helper waits for apt/dpkg to go idle before each attempt; keep these hermetic (a real apt on the machine must not slow the tests).
export INSTALL_LOCK_PROCS="__none__"
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
# apt lock: a killed attempt's apt-get survives `timeout` (it runs as root via sudo) and holds the dpkg lock; the retry must wait for it.
# (The fixture's own "is apt alive" probe skips zombies too: an orphan may stay a zombie under a PID 1 that never reaps -- Codex P2.)
mkdir -p "$work/bin"; cp "$(command -v sleep)" "$work/bin/fake-apt"   # a process whose name `pgrep -x fake-apt` matches
# Never a global kill: only processes started from THIS run's private fixture binary ($work is a fresh mktemp dir) are signalled.
kill_fixtures() { pkill -f -- "$work/bin/fake-apt" 2> /dev/null || true; }
# A bystander the suite must never touch (Codex P2 on #628): an unrelated `sleep` owned by the same user, checked at the end of this section.
bystander_sleep=$(sh -c 'sleep 300 > /dev/null 2>&1 & echo $!')
rm -f "$work/c7" "$work/c7.log"
cat > "$work/orphan_cmd.sh" <<ORPHAN_END
n=\$(cat $work/c7 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $work/c7
if [ \$n -eq 1 ]; then setsid $work/bin/fake-apt 3 > /dev/null 2>&1 & sleep 30; fi
if ps -o stat= -C fake-apt | tr -d " " | grep -q "^[^Z]"; then echo LOCKED >> $work/c7.log; exit 100; fi
echo ok >> $work/c7.log
ORPHAN_END
check "retry: orphaned apt after a timeout -> the retry waits for it, then succeeds (exit 0)" 0 \
  "$(INSTALL_LOCK_PROCS=fake-apt retry "$work/s7" --timeout 1 --attempts 2 -- sh "$work/orphan_cmd.sh")"
grep -q 'waiting for apt/dpkg to go idle' "$work/retry.out"; check "retry: the wait is logged" 0 $?
check "retry: orphaned apt -> the retry never ran while apt was still alive" "ok" "$(tr -d '\n' < "$work/c7.log")"
check "retry: orphaned apt -> install_status=ok attempts=2" "ok 2" "$(status_of "$work/s7" install_status) $(status_of "$work/s7" install_attempts)"
# Without the wait the same scenario fails on the lock (the pre-fix behaviour), so the test above really bites.
rm -f "$work/c7" "$work/c7.log"
check "retry: orphaned apt, wait disabled (0s) -> the retry hits the lock and fails (100)" 100 \
  "$(INSTALL_LOCK_PROCS=fake-apt INSTALL_LOCK_WAIT_SECS=0 retry "$work/s8" --timeout 1 --attempts 2 -- sh "$work/orphan_cmd.sh")"
sleep 3  # let the orphan from the line above exit
# The first attempt never waits (no orphan can exist yet), so the install budget has no leading wait.
setsid "$work/bin/fake-apt" 8 > /dev/null 2>&1 &
t0=$SECONDS
rm -f "$work/c10"
check "retry: apt busy at the start -> the first attempt runs at once (exit 0)" 0 \
  "$(INSTALL_LOCK_PROCS=fake-apt retry "$work/s10" --timeout 5 --attempts 1 -- sh -c "echo x >> $work/c10")"
check "retry: the first attempt did not wait for apt" "1 yes" "$(wc -l < "$work/c10" | tr -d ' ') $([ $((SECONDS - t0)) -lt 3 ] && echo yes || echo no)"
# The wait before a retry is bounded: a busy apt that outlives it is not waited for forever.
t0=$SECONDS
rm -f "$work/c9"
check "retry: apt busy longer than the wait bound -> the retry stops waiting and runs (exit 3)" 3 \
  "$(INSTALL_LOCK_PROCS=fake-apt INSTALL_LOCK_WAIT_SECS=1 retry "$work/s9" --timeout 5 --attempts 2 -- sh -c "echo x >> $work/c9; exit 3")"
check "retry: bounded wait -> both attempts ran, the retry after ~1s and before the 8s orphan ended" "2 yes" "$(wc -l < "$work/c9" | tr -d ' ') $([ $((SECONDS - t0)) -lt 6 ] && echo yes || echo no)"
grep -q 'apt/dpkg still running after 1s' "$work/retry.out"; check "retry: bounded wait -> warning logged" 0 $?
kill_fixtures
# A zombie (an exited process nobody reaped, e.g. an orphan under a PID 1 that does not reap) holds no lock and must not be waited for.
# Real zombie fixture: a python parent forks fake-apt (exits after 1s) and then sleeps without wait()ing for it.
# The parent prints the child's pid, so the check below looks at THIS child only (other zombies may be left over from earlier cases).
python3 -c "
import os, time
pid = os.fork()
if pid == 0:
    os.execv('$work/bin/fake-apt', ['$work/bin/fake-apt', '1'])
print(pid, flush=True)
time.sleep(9)
" > "$work/zpid" 2> /dev/null &
zparent=$!
sleep 2.5
check "retry: fixture -- this fake-apt child is a real zombie (state Z)" "Z" "$(ps -o stat= -p "$(cat "$work/zpid")" | tr -d ' ' | cut -c1)"
t0=$SECONDS
rm -f "$work/c11"
check "retry: a zombie apt is not waited for (exit 3 after both attempts)" 3 \
  "$(INSTALL_LOCK_PROCS=fake-apt INSTALL_LOCK_WAIT_SECS=5 retry "$work/s11" --timeout 5 --attempts 2 -- sh -c "echo x >> $work/c11; exit 3")"
check "retry: a zombie apt -> no wait (both attempts ran, in well under the 5s bound)" "2 yes" "$(wc -l < "$work/c11" | tr -d ' ') $([ $((SECONDS - t0)) -lt 3 ] && echo yes || echo no)"
kill "$zparent" 2> /dev/null; wait "$zparent" 2> /dev/null || true

# --- #627 follow-up: stop the orphan a timed-out attempt leaves (run 39801547144: a stalled apt-get outlived the 180 s wait) ---
# An orphan's parent is the reaper (pid 1; in a container possibly a subreaper) -- measure it instead of assuming.
setsid sh -c "sleep 2 & echo \$! > $work/rp.pid" > /dev/null 2>&1; sleep 0.5
reaper="$(ps -o ppid= -p "$(cat "$work/rp.pid")" 2> /dev/null | tr -d ' ')"; reaper="${reaper:-1}"
if [[ -s "$work/rp.pid" ]]; then kill "$(cat "$work/rp.pid")" 2> /dev/null || true; fi
reap_retry() { # VAR=val... retry args... (the leading VAR=val are exported for the helper only)
  ( export INSTALL_REAPER_PID="$reaper" INSTALL_LOCK_PROCS=fake-apt INSTALL_REAP_PROCS=fake-apt
    while [[ "$1" == INSTALL_*=* ]]; do export "$1"; shift; done
    shift  # the literal word "retry"
    retry "$@" )
}
alive_fake() { ps -o stat= -C fake-apt | tr -d ' ' | grep -c '^[^Z]'; }
# (a) the attempt's own orphaned apt is stopped, and the retry does not wait for it (lock wait would be 20 s here)
rm -f "$work/c12" "$work/c12.log"
cat > "$work/orphan30.sh" <<ORPHAN_END
n=\$(cat $work/c12 2>/dev/null || echo 0); n=\$((n+1)); echo \$n > $work/c12
if [ \$n -eq 1 ]; then setsid $work/bin/fake-apt 30 > /dev/null 2>&1 & sleep 30; fi
if ps -o stat= -C fake-apt | tr -d " " | grep -q "^[^Z]"; then echo LOCKED >> $work/c12.log; exit 100; fi
echo ok >> $work/c12.log
ORPHAN_END
t0=$SECONDS
check "reap: timed-out attempt's orphaned apt is stopped -> the retry succeeds (exit 0)" 0 \
  "$(reap_retry INSTALL_LOCK_WAIT_SECS=20 INSTALL_REAP_GRACE_SECS=3 retry "$work/s12" --timeout 1 --attempts 2 -- sh "$work/orphan30.sh")"
check "reap: the retry never saw a live apt" "ok" "$(tr -d '\n' < "$work/c12.log")"
check "reap: no 20 s lock wait was needed (done in < 12 s)" yes "$([ $((SECONDS - t0)) -lt 12 ] && echo yes || echo no)"
grep -q 'stopping apt left behind' "$work/retry.out"; check "reap: the stop is logged" 0 $?
check "reap: orphan really gone" 0 "$(alive_fake)"
# (b) negative control: reaping off (no apt names) -> the same orphan still holds the lock (wait disabled) -> 100
rm -f "$work/c12" "$work/c12.log"
check "reap: negative control (reaping off, wait 0) -> the retry hits the lock (100)" 100 \
  "$(INSTALL_REAPER_PID="$reaper" INSTALL_REAP_PROCS=__none__ INSTALL_LOCK_PROCS=fake-apt INSTALL_LOCK_WAIT_SECS=0 retry "$work/s13" --timeout 1 --attempts 2 -- sh "$work/orphan30.sh")"
kill_fixtures; sleep 0.5
# (c) safety: an apt that was already running before the attempt (another job / the OS) is never stopped
setsid "$work/bin/fake-apt" 12 > /dev/null 2>&1 &
sleep 0.3
rm -f "$work/c14"
check "reap: foreign apt present before the attempt -> not stopped (attempts time out, exit 124)" 124 \
  "$(reap_retry INSTALL_LOCK_WAIT_SECS=0 retry "$work/s14" --timeout 1 --attempts 2 -- sh -c "echo x >> $work/c14; sleep 30; exit 3")"
check "reap: foreign apt (pre-existing) is still alive" 1 "$(alive_fake)"
kill_fixtures; sleep 0.5
# (d) safety: an apt that started DURING the attempt but still has a live parent (someone else's child) is never stopped
rm -f "$work/c15"
cat > "$work/foreign_child.sh" <<FOREIGN_END
echo x >> $work/c15
setsid sh -c "$work/bin/fake-apt 12 & wait" > /dev/null 2>&1 &
sleep 30
FOREIGN_END
check "reap: apt with a live parent started mid-attempt -> not stopped (exit 124)" 124 \
  "$(reap_retry INSTALL_LOCK_WAIT_SECS=0 retry "$work/s15" --timeout 1 --attempts 2 -- sh "$work/foreign_child.sh")"
check "reap: foreign apts (live parents, one per attempt) are both still alive" 2 "$(alive_fake)"
kill_fixtures; sleep 0.5
# (e) only the configured names are ever signalled (dpkg-like names are not in the default reap set)
check "reap: default reap set is apt-get/apt only (never dpkg)" "apt-get apt" "$(sed -n 's/.*INSTALL_REAP_PROCS:-\([^}]*\)}.*/\1/p' "$here/install-with-retry.sh" | head -1)"
# (f) --apt-tuning writes the drop-in (retries, timeouts, lock timeout) and a failure to write it is not fatal
INSTALL_APT_CONF="$work/apt.d/99-test" retry "$work/s16" --apt-tuning --timeout 5 --attempts 1 -- true > /dev/null
check "apt-tuning: drop-in has Acquire::Retries, http/https Timeout, DPkg::Lock::Timeout" 4 \
  "$(grep -cE '^(Acquire::Retries "3"|Acquire::http::Timeout "30"|Acquire::https::Timeout "30"|DPkg::Lock::Timeout "60");$' "$work/apt.d/99-test")"
check "apt-tuning: unwritable target -> install still runs (exit 0)" 0 \
  "$(INSTALL_APT_CONF=/proc/nope/99-test retry "$work/s17" --apt-tuning --timeout 5 --attempts 1 -- true)"
check "cleanup: an unrelated sleep (same user) survived the whole section -- no global kill" yes \
  "$([ "$(ps -o comm=,stat= -p "$bystander_sleep" 2> /dev/null | tr -s ' ' | cut -c1-7)" = "sleep S" ] && echo yes || echo no)" # a killed one lingers as a zombie (Z) under a PID 1 that does not reap
kill "$bystander_sleep" 2> /dev/null || true; wait "$bystander_sleep" 2> /dev/null || true
# Workflow contract: only the install is wrapped; Playwright test steps are never retried.
wf="$here/../../.github/workflows/e2e-webkit.yml"
grep -q 'install-with-retry.sh' "$wf" && grep -q -- '-- npx playwright install --with-deps webkit' "$wf"
check "workflow: WebKit install step uses the retry helper" 0 $?
grep -q -- '--apt-tuning' "$wf"; check "workflow: the install step enables --apt-tuning" 0 $?
grep -q -- '--apt-cache-dir "\$HOME/apt-archives"' "$wf"; check "workflow: the install step passes --apt-cache-dir (#643)" 0 $?
grep -q 'actions/cache/restore@v4' "$wf" && grep -q 'actions/cache/save@v4' "$wf"; check "workflow: apt .deb cache uses restore + save (#643)" 0 $?
grep -A2 'Save apt .deb cache' "$wf" | grep -q "github.event_name == 'push'"; check "workflow: the apt cache is saved only by push (main) runs (#643)" 0 $?
# #643 cache dir + integrity guard (hermetic: real dpkg-deb on tiny debs built here)
if command -v dpkg-deb > /dev/null 2>&1; then
  g="$work/aptcache"; mkdir -p "$g" "$work/pkg/DEBIAN"
  for n in a b c; do
    printf 'Package: t%s\nVersion: 1\nArchitecture: all\nMaintainer: t <t@t>\nDescription: t\n' "$n" > "$work/pkg/DEBIAN/control"
    mkdir -p "$work/pkg/usr/share/t$n"; head -c 20000 /dev/urandom > "$work/pkg/usr/share/t$n/f"
    dpkg-deb -b "$work/pkg" "$g/t${n}_1_all.deb" > /dev/null 2>&1
  done
  sz=$(stat -c %s "$g/tb_1_all.deb"); head -c 4096 /dev/zero | dd of="$g/tb_1_all.deb" bs=1 seek=100 conv=notrunc 2> /dev/null # same size, zeroed block
  check "cache guard: corrupt fixture keeps its size" "$sz" "$(stat -c %s "$g/tb_1_all.deb")"
  INSTALL_APT_CONF="$work/apt.d/99-cache" retry "$work/s18" --apt-cache-dir "$g" --timeout 5 --attempts 1 -- true > /dev/null; cp "$work/retry.out" "$work/guard.out"
  check "cache guard: the unreadable .deb is removed, the others are kept" "ta_1_all.deb tc_1_all.deb" "$(cd "$g" && ls *.deb | tr '\n' ' ' | sed 's/ $//')"
  check "cache guard: drop-in sets Dir::Cache::Archives" 1 "$(grep -c "^Dir::Cache::Archives \"$g\";\$" "$work/apt.d/99-cache")"
  check "cache guard: reported checked=3 removed=1" 1 "$(grep -c 'checked=3 removed=1' "$work/guard.out")"
  INSTALL_APT_CONF="$work/apt.d/99-cache2" retry "$work/s19" --apt-cache-dir "$work/empty-cache" --timeout 5 --attempts 1 -- true > /dev/null; cp "$work/retry.out" "$work/guard2.out"
  check "cache guard: an empty/missing cache dir is a normal install (exit 0, checked=0)" 1 "$(grep -c 'checked=0 removed=0' "$work/guard2.out")"
fi
grep -n 'install-with-retry' "$wf" | grep -q 'playwright test'
check "workflow: no Playwright test command is wrapped by the retry helper" 1 $?
grep -Eq '^\s*retries:\s*[1-9]|--retries' "$wf" "$here/../../playwright.config.ts"
check "workflow/config: Playwright test retries are not enabled" 1 $?
# Time budget (Codex P2 on #624). The install step's cap must cover the helper's WORST case, waits included:
#   attempts x (timeout + kill-after) + (attempts - 1) x (retry delay + lock wait)
# and the webkit job's cap must cover setup + that step cap + the slowest shard's tests (15.1 min observed, 2026-10-22).
helper="$here/install-with-retry.sh"
job_cap=$(awk '/^  webkit:$/{j=1} j&&/timeout-minutes:/{print $2; exit}' "$wf")
install_cap=$(awk '/Install WebKit \(with system deps/{f=1} f&&/timeout-minutes:/{print $2; exit}' "$wf")
b_attempts=$(awk '/Install WebKit \(with system deps/{f=1} f&&/--attempts/{for(i=1;i<=NF;i++) if($i=="--attempts") print $(i+1); exit}' "$wf")
b_timeout=$(awk '/Install WebKit \(with system deps/{f=1} f&&/--timeout/{for(i=1;i<=NF;i++) if($i=="--timeout") print $(i+1); exit}' "$wf")
b_kill=$(sed -n 's/.*--kill-after=\([0-9]*\).*/\1/p' "$helper" | head -1)
b_delay=$(sed -n 's/.*INSTALL_RETRY_DELAY_SECS:-\([0-9]*\)}.*/\1/p' "$helper" | head -1)
b_wait=$(sed -n 's/.*INSTALL_LOCK_WAIT_SECS:-\([0-9]*\)}.*/\1/p' "$helper" | head -1)
b_reap=$(( $(sed -n 's/.*INSTALL_REAP_GRACE_SECS:-\([0-9]*\)}.*/\1/p' "$helper" | head -1) + 2 )) # SIGTERM grace + 2 s after SIGKILL
worst_case() { echo $(( $1 * ($2 + $3) + ($1 - 1) * ($4 + $5 + $6) )); } # attempts timeout kill delay wait reap
check "budget: parsed attempts/timeout/kill/delay/wait/step cap/job cap" "2 360 15 5 180 12 17 35" "$b_attempts $b_timeout $b_kill $b_delay $b_wait $b_reap $install_cap $job_cap"
worst=$(worst_case "$b_attempts" "$b_timeout" "$b_kill" "$b_delay" "$b_wait" "$b_reap")
check "budget: helper worst case (947 s) fits the install step cap" yes "$([ $((install_cap * 60)) -ge "$worst" ] && echo yes || echo "no (worst ${worst}s, cap $((install_cap * 60))s)")"
check "budget: negative control -- the pre-fix numbers (13 min step cap, 300 s wait, wait before every attempt) do not fit" no \
  "$([ $((13 * 60)) -ge "$(worst_case 2 360 15 5 300 0)" ] && echo yes || echo no)"
check "budget: negative control -- a wait before the first attempt too (180 + 947 = 1127 s) would not fit the 17 min cap" no \
  "$([ $((install_cap * 60)) -ge $((b_wait + worst)) ] && echo yes || echo no)"
check "workflow: webkit job cap fits setup (1) + install step cap + longest shard (16 incl. list/margin)" yes "$([ "$job_cap" -ge $((install_cap + 17)) ] && echo yes || echo "no (job $job_cap, install $install_cap)")"

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

# setup failed before the install helper ran: no status file, no list, no results (Codex P2 on #336)
make_evidence "$work/c_presetup"
rm -rf "$work/c_presetup/ev/webkit-evidence-webkit-390x844-shard1-attempt1"
node "$here/webkit-shard-evidence.mjs" collect --project webkit-390x844 --shard 1 --total 2 --attempt 1 \
  --list "$work/none.json" --results "$work/none.json" --install-status "$work/none.status" \
  --out "$work/c_presetup/ev/webkit-evidence-webkit-390x844-shard1-attempt1/evidence.json" > /dev/null
check "S2: pre-install setup failure (npm ci etc.) -> gate FAIL (exit 1)" 1 "$(gate success true failure "$work/c_presetup/ev")"
grep -q 'FAIL-INFRA' "$work/summary.md" && ! grep -q 'FAIL-TEST' "$work/summary.md"
check "S2: pre-install setup failure -> FAIL-INFRA only" 0 $?

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
