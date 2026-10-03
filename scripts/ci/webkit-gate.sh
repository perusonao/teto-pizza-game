#!/usr/bin/env bash
# Issue #201 / #207 Phase 2A: "WebKit Gate" decision for .github/workflows/e2e-webkit.yml.
#
# Moved out of the workflow's inline `run:` so the truth table is testable
# (scripts/ci/test-webkit-ci.sh). Exit status IS the gate: 0 = PASS, non-zero = FAIL.
#
#   classify ok & webkit_required=false:  webkit skipped -> PASS; ran & succeeded -> PASS;
#                                          anything else -> FAIL
#   otherwise (required, or classify failed / output not true|false -> fail-safe required):
#       webkit (aggregate of ALL matrix shards) must be `success` AND the shard evidence must
#       verify (scripts/ci/webkit-shard-evidence.mjs verify): every required project present,
#       shards 1..N each exactly once, every listed test ran exactly once and passed, both
#       viewports listed the same tests. failure / cancelled / skipped / missing evidence -> FAIL.
#       S2: every FAIL is labelled where the evidence allows -- FAIL-INFRA (install/setup failure or
#       timeout, missing/cancelled shard) vs FAIL-TEST (Playwright test failure). The label never
#       changes the exit status: both are FAIL (fail-closed).
#
# Env: CLASSIFY_RESULT, WEBKIT_REQUIRED, REASON, WEBKIT_RESULT, TESTED_BASE,
#      EVIDENCE_DIR (downloaded webkit-evidence-* artifacts),
#      REQUIRED_PROJECTS (default: "webkit-390x844 webkit-360x800").
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
evidence_tool="$here/webkit-shard-evidence.mjs"
projects="${REQUIRED_PROJECTS:-webkit-390x844 webkit-360x800}"
CLASSIFY_RESULT="${CLASSIFY_RESULT:-}"
WEBKIT_REQUIRED="${WEBKIT_REQUIRED:-}"
WEBKIT_RESULT="${WEBKIT_RESULT:-}"
REASON="${REASON:-}"
evidence_report=""
gate_class=""

if [ "$CLASSIFY_RESULT" = "success" ] && [ "$WEBKIT_REQUIRED" = "false" ]; then
  required=false
else
  required=true
  if [ "$CLASSIFY_RESULT" != "success" ] || [ "$WEBKIT_REQUIRED" != "true" ]; then
    REASON="fail-safe: classify result=$CLASSIFY_RESULT, webkit_required='$WEBKIT_REQUIRED'"
  fi
fi

if ! self_test="$(node "$evidence_tool" --self-test 2>&1)"; then
  verdict="FAIL -- shard evidence verifier failed its own self-test"; status=1
  evidence_report="$self_test"
elif [ "$required" = "true" ]; then
  # S2: the evidence is verified even when the matrix did not succeed, only to LABEL the failure.
  # Every FAIL-* verdict exits non-zero: FAIL-INFRA (install/setup/cancelled-or-missing shard) and
  # FAIL-TEST (Playwright test failure) are equally red. Never "infra => green".
  evidence_report="$(node "$evidence_tool" verify --dir "${EVIDENCE_DIR:-}" --projects "$projects" 2>&1)"; verify_rc=$?
  classification="$(printf '%s\n' "$evidence_report" | sed -n 's/^Classification: //p' | tail -n 1)"
  if [ "$WEBKIT_RESULT" = "success" ] && [ "$verify_rc" -eq 0 ]; then
    verdict="PASS -- Full WebKit required; all shards passed and coverage verified"; status=0
  elif [ "$WEBKIT_RESULT" = "success" ]; then
    gate_class="${classification:-FAIL}"
    verdict="FAIL -- every shard job succeeded but shard evidence verification failed (${classification:-unclassified})"; status=1
  elif [ "$WEBKIT_RESULT" = "failure" ] || [ "$WEBKIT_RESULT" = "cancelled" ]; then
    # A failed/cancelled matrix can never be PASS, whatever the evidence says.
    case "$classification" in
      PASS|"") label="FAIL"; gate_class=FAIL ;; # evidence looks fine but the job did not succeed (e.g. cancelled): unlabeled FAIL
      *) label="FAIL ($classification)"; gate_class="$classification" ;;
    esac
    case "$classification" in
      *FAIL-INFRA*) detail="install/setup problem or missing shard; not a test assertion failure by itself" ;;
      *FAIL-TEST*) detail="Playwright test failure" ;;
      *) detail="see shard evidence" ;;
    esac
    verdict="$label -- Full WebKit required but the shard matrix result is '$WEBKIT_RESULT' ($detail)"; status=1
  else
    verdict="FAIL -- Full WebKit required but the shard matrix result is '$WEBKIT_RESULT'"; status=1
  fi
else
  case "$WEBKIT_RESULT" in
    skipped) verdict="PASS -- WebKit safely skipped (not required)"; status=0 ;;
    success) verdict="PASS -- WebKit not required, ran and passed anyway"; status=0 ;;
    *) verdict="FAIL -- WebKit not required but ran with result '$WEBKIT_RESULT'"; status=1 ;;
  esac
fi

level=none
[ "$required" = "true" ] && level=full
# S2: machine-readable class of the verdict: PASS | FAIL-INFRA | FAIL-TEST | FAIL-INFRA+FAIL-TEST | FAIL | ...
if [ -z "$gate_class" ]; then
  if [ "$status" -eq 0 ]; then gate_class=PASS; else gate_class=FAIL; fi
fi
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{
  echo "## WebKit Gate"
  echo ""
  echo "| classify | webkit_required | level | webkit shards | gate |"
  echo "|---|---|---|---|---|"
  echo "| $CLASSIFY_RESULT | $required | $level | $WEBKIT_RESULT | $verdict |"
  echo ""
  echo "Reason: $REASON"
  echo ""
  echo "gate_class=$gate_class"
  if [ -n "$evidence_report" ]; then
    echo ""
    echo "### Shard evidence"
    echo ""
    echo "$evidence_report"
  fi
} >> "$summary"

if [ "$status" -eq 0 ]; then
  # tested_base is read back by the next push's classify job (evidence reuse is only allowed when
  # the base is unchanged) -- keep the `tested_base=<sha>` token intact. `level` is informational
  # in Phase 2A (it is always full or none) and becomes part of the reuse check in Phase 2B.
  echo "::notice title=WebKit Gate::$verdict. tested_base=${TESTED_BASE:-unknown} level=$level. $REASON"
else
  echo "::error title=WebKit Gate::[$gate_class] $verdict. $REASON"
fi
exit "$status"
