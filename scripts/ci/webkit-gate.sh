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
  if [ "$WEBKIT_RESULT" != "success" ]; then
    verdict="FAIL -- Full WebKit required but the shard matrix result is '$WEBKIT_RESULT'"; status=1
  elif evidence_report="$(node "$evidence_tool" verify --dir "${EVIDENCE_DIR:-}" --projects "$projects" 2>&1)"; then
    verdict="PASS -- Full WebKit required; all shards passed and coverage verified"; status=0
  else
    verdict="FAIL -- every shard job succeeded but shard evidence verification failed"; status=1
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

summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{
  echo "## WebKit Gate"
  echo ""
  echo "| classify | webkit_required | level | webkit shards | gate |"
  echo "|---|---|---|---|---|"
  echo "| $CLASSIFY_RESULT | $required | $level | $WEBKIT_RESULT | $verdict |"
  echo ""
  echo "Reason: $REASON"
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
  # (always full or none: Phase 2B added no affected/partial level, so reuse needs no level check).
  echo "::notice title=WebKit Gate::$verdict. tested_base=${TESTED_BASE:-unknown} level=$level. $REASON"
else
  echo "::error title=WebKit Gate::$verdict. $REASON"
fi
exit "$status"
