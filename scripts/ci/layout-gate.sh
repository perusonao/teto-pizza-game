#!/usr/bin/env bash
# Progression 2.0 W1 I5b-5 (OD-V-1, Preflight §9.1): "Layout Contract Gate" decision for the
# `layout-chromium` job in .github/workflows/e2e-webkit.yml. Same shape as webkit-gate.sh and the
# same evidence verifier (webkit-shard-evidence.mjs): exit status IS the gate (0 = PASS).
#
#   classify ok & webkit_required=false:  layout skipped -> PASS; ran & succeeded -> PASS;
#                                          anything else -> FAIL
#   otherwise (required, or classify failed / output not true|false -> fail-safe required):
#       the layout job must be `success` AND its evidence must verify (every listed Layout
#       Contract test ran exactly once and passed). failure / cancelled / skipped / missing
#       evidence -> FAIL.
#
# The Layout Contract tests themselves fail on any P0 invariant (and any P1 outside the
# Owner-pending register, e2e/support/layoutContract.ts), so "every test passed" is the verdict.
#
# Env: CLASSIFY_RESULT, WEBKIT_REQUIRED, REASON, LAYOUT_RESULT,
#      EVIDENCE_DIR (downloaded layout-evidence-* artifacts),
#      REQUIRED_PROJECTS (default: "layout-chromium").
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
evidence_tool="$here/webkit-shard-evidence.mjs"
projects="${REQUIRED_PROJECTS:-layout-chromium}"
CLASSIFY_RESULT="${CLASSIFY_RESULT:-}"
WEBKIT_REQUIRED="${WEBKIT_REQUIRED:-}"
LAYOUT_RESULT="${LAYOUT_RESULT:-}"
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
  verdict="FAIL -- evidence verifier failed its own self-test"; status=1
  evidence_report="$self_test"
elif [ "$required" = "true" ]; then
  if [ "$LAYOUT_RESULT" != "success" ]; then
    verdict="FAIL -- Layout Contract required but the layout-chromium job result is '$LAYOUT_RESULT'"; status=1
  elif evidence_report="$(node "$evidence_tool" verify --dir "${EVIDENCE_DIR:-}" --projects "$projects" 2>&1)"; then
    verdict="PASS -- Layout Contract ran on every profile and every test passed"; status=0
  else
    verdict="FAIL -- layout-chromium succeeded but its evidence verification failed"; status=1
  fi
else
  case "$LAYOUT_RESULT" in
    skipped) verdict="PASS -- Layout Contract safely skipped (not required)"; status=0 ;;
    success) verdict="PASS -- Layout Contract not required, ran and passed anyway"; status=0 ;;
    *) verdict="FAIL -- Layout Contract not required but ran with result '$LAYOUT_RESULT'"; status=1 ;;
  esac
fi

summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
{
  echo "## Layout Contract Gate"
  echo ""
  echo "| classify | required | layout-chromium | gate |"
  echo "|---|---|---|---|"
  echo "| $CLASSIFY_RESULT | $required | $LAYOUT_RESULT | $verdict |"
  echo ""
  echo "Reason: $REASON"
  if [ -n "$evidence_report" ]; then
    echo ""
    echo "### Evidence"
    echo ""
    echo "$evidence_report"
  fi
} >> "$summary"

if [ "$status" -eq 0 ]; then
  echo "::notice title=Layout Contract Gate::$verdict. $REASON"
else
  echo "::error title=Layout Contract Gate::$verdict. $REASON"
fi
exit "$status"
