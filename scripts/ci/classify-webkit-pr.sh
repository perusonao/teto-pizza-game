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
#      check run, AND that gate recorded the same tested base as this run's merge ref
#      -> skip, reusing that WebKit evidence (e.g. a Result Report commit on top of a runtime
#      commit that already passed WebKit). If `main` moved in between, the new merge result was
#      never tested, so WebKit runs.
#   3. Anything else -> run WebKit.
#
# Also outputs `tested_base`: the base-branch commit this run's merge ref (MERGE_SHA, i.e.
# github.sha) was built on. WebKit Gate records it in its annotation so a later run can compare.
#
# Required env: BASE_SHA, HEAD_SHA. Optional: MERGE_SHA, BEFORE_SHA (synchronize only),
# GH_TOKEN + REPO (needed for step 2's check-run lookup; without them step 2 falls through to
# "run").
set -uo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
classifier="$(cd "$(dirname "$0")" && pwd)/classify-webkit.mjs"
zero_sha="0000000000000000000000000000000000000000"

emit() {
  local required="$1" reason="${2//$'\n'/ }"
  {
    echo "webkit_required=$required"
    echo "reason=$reason"
    echo "tested_base=${tested_base:-}"
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

# GitHub's PR merge ref is a two-parent commit [base tip, PR head]. Anything else -> unknown,
# which disables evidence reuse (never enables it).
tested_base=""
if [ -n "${MERGE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ]; then
  read -r _ merge_p1 merge_p2 merge_extra <<<"$(git rev-list --parents -n 1 "$MERGE_SHA" 2>/dev/null)"
  if [ -n "${merge_p2:-}" ] && [ -z "${merge_extra:-}" ] && [ "$merge_p2" = "$HEAD_SHA" ]; then
    tested_base="$merge_p1"
  fi
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
    gates=""
    if [ -n "${GH_TOKEN:-}" ] && [ -n "${REPO:-}" ]; then
      gates="$(gh api "repos/$REPO/commits/$BEFORE_SHA/check-runs?check_name=WebKit%20Gate&filter=latest" \
        --jq '.check_runs[] | select(.app.slug == "github-actions") | "\(.id) \(.conclusion // .status)"' 2>/dev/null)" \
        || gates=""
    fi
    found=""
    while read -r gate_id gate_conclusion; do
      [ -n "${gate_id:-}" ] || continue
      found="${found:+$found, }$gate_conclusion"
      [ "$gate_conclusion" = success ] || continue
      prev_base="$(gh api "repos/$REPO/check-runs/$gate_id/annotations" --jq '.[].message' 2>/dev/null \
        | grep -o 'tested_base=[0-9a-f]\{40\}' | head -n 1 | cut -d= -f2)"
      if [ -z "$tested_base" ] || [ -z "$prev_base" ]; then
        emit true "$pr_reason; docs-only since ${BEFORE_SHA:0:7}, but its tested base is unknown (previous: ${prev_base:-none}, now: ${tested_base:-none}), so its WebKit result cannot be reused"
      fi
      if [ "$prev_base" != "$tested_base" ]; then
        emit true "$pr_reason; docs-only since ${BEFORE_SHA:0:7}, but the base branch moved (${prev_base:0:7} -> ${tested_base:0:7}), so the new merge result has not been WebKit-tested"
      fi
      emit false "only documentation changed since ${BEFORE_SHA:0:7} ($inc_reason), whose WebKit Gate already succeeded on the same base ${tested_base:0:7} -- reusing that WebKit evidence"
    done <<<"$gates"
    emit true "$pr_reason; docs-only since ${BEFORE_SHA:0:7} but it has no successful WebKit Gate to reuse (found: ${found:-none})"
  fi
fi

emit true "$pr_reason"
