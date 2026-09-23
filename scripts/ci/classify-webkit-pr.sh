#!/usr/bin/env bash
# Issue #201 A1: decide whether a pull_request run of .github/workflows/e2e-webkit.yml needs the
# heavy WebKit E2E job. Writes `webkit_required=<true|false>` and `reason=<text>` to
# $GITHUB_OUTPUT (stdout when unset, for local runs) and always exits 0 -- every error path
# resolves to webkit_required=true ("fail-safe"), never to a skip.
#
# Decision order:
#   1. Whole PR diff (merge-base(base, head) -> head) is documentation-only
#        -> skip (Case A: docs-only PR).
#   2. Push to an existing PR (synchronize) whose diff since the previous head is
#      documentation-only, AND the previous head already has a successful "WebKit Gate"
#      check run -> skip, reusing that WebKit evidence (e.g. a Result Report commit on top of a
#      runtime commit that already passed WebKit).
#   3. Anything else -> run WebKit.
#
# Required env: BASE_SHA, HEAD_SHA. Optional: BEFORE_SHA (synchronize only), GH_TOKEN + REPO
# (needed for step 2's check-run lookup; without them step 2 falls through to "run").
set -uo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
classifier="$(cd "$(dirname "$0")" && pwd)/classify-webkit.mjs"
zero_sha="0000000000000000000000000000000000000000"

emit() {
  local required="$1" reason="${2//$'\n'/ }"
  {
    echo "webkit_required=$required"
    echo "reason=$reason"
  } >> "$out"
  echo "::notice title=WebKit classifier::webkit_required=$required -- $reason"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "## WebKit change classifier (Issue #201)"
      echo ""
      echo "| webkit_required | reason |"
      echo "|---|---|"
      echo "| \`$required\` | $reason |"
      if [ -n "${pr_files:-}" ]; then
        echo ""
        echo "<details><summary>Changed files vs base</summary>"
        echo ""
        # shellcheck disable=SC2016 # literal backticks for Markdown code spans
        printf '%s\n' "$pr_files" | sed 's/^/- `/; s/$/`/'
        echo ""
        echo "</details>"
      fi
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
}
failsafe() { emit true "fail-safe: $1"; }

# $1 = newline-separated file list; sets cls_required / cls_reason.
run_classifier() {
  local result
  result="$(printf '%s\n' "$1" | node "$classifier")" || return 1
  cls_required="$(sed -n 's/^webkit_required=//p' <<<"$result")"
  cls_reason="$(sed -n 's/^reason=//p' <<<"$result")"
  [ "$cls_required" = true ] || [ "$cls_required" = false ]
}

if ! node "$classifier" --self-test; then
  failsafe "classifier self-test failed"
fi

[ -n "${BASE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ] || failsafe "BASE_SHA/HEAD_SHA not provided"

merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)" \
  || failsafe "could not compute merge-base of $BASE_SHA and $HEAD_SHA"
pr_files="$(git -c core.quotePath=false diff --name-only --no-renames "$merge_base" "$HEAD_SHA")" \
  || failsafe "git diff against base failed"
run_classifier "$pr_files" || failsafe "classifier returned no decision for the PR diff"

if [ "$cls_required" = false ]; then
  emit false "PR diff vs base is documentation-only: $cls_reason"
fi
pr_reason="$cls_reason"

if [ -n "${BEFORE_SHA:-}" ] && [ "$BEFORE_SHA" != "$zero_sha" ] && [ "$BEFORE_SHA" != "$HEAD_SHA" ]; then
  if ! git cat-file -e "$BEFORE_SHA^{commit}" 2>/dev/null; then
    git fetch --no-tags --filter=blob:none origin "$BEFORE_SHA" >/dev/null 2>&1 \
      || emit true "$pr_reason (previous head ${BEFORE_SHA:0:7} not fetchable, so its WebKit result cannot be reused)"
  fi
  inc_files="$(git -c core.quotePath=false diff --name-only --no-renames "$BEFORE_SHA" "$HEAD_SHA")" \
    || emit true "$pr_reason (diff since previous head ${BEFORE_SHA:0:7} failed)"
  run_classifier "$inc_files" \
    || emit true "$pr_reason (no classifier decision for the diff since ${BEFORE_SHA:0:7})"

  if [ "$cls_required" = false ]; then
    inc_reason="$cls_reason"
    conclusions=""
    if [ -n "${GH_TOKEN:-}" ] && [ -n "${REPO:-}" ]; then
      conclusions="$(gh api "repos/$REPO/commits/$BEFORE_SHA/check-runs?check_name=WebKit%20Gate&filter=latest" \
        --jq '[.check_runs[] | select(.app.slug == "github-actions") | .conclusion // .status] | join(",")' 2>/dev/null)" \
        || conclusions=""
    fi
    if [[ ",$conclusions," == *",success,"* ]]; then
      emit false "only documentation changed since ${BEFORE_SHA:0:7} ($inc_reason), whose WebKit Gate already succeeded -- reusing that WebKit evidence"
    fi
    emit true "$pr_reason; docs-only since ${BEFORE_SHA:0:7} but it has no successful WebKit Gate to reuse (found: ${conclusions:-none})"
  fi
fi

emit true "$pr_reason"
