#!/usr/bin/env bash
# CI optimization Phase 1: decide whether a pull_request run of .github/workflows/ci.yml is
# documentation-only, so lint / Vitest / build can be skipped. Writes `docs_only=<true|false>` and
# `reason=<text>` to $GITHUB_OUTPUT (stdout when unset, for local runs) and ALWAYS exits 0 -- every
# error path resolves to docs_only=false ("fail-safe"), never to a skip.
#
# What counts as documentation-only is decided by ./classify-ci-docs-only.mjs (an allow-list; see its
# header). This script only works out WHICH files the pull request changes:
#
#   ci.yml checks out GitHub's PR merge ref, a two-parent commit [base tip, PR head] (fetch-depth 2 is
#   enough). The PR's changes are exactly `git diff HEAD^1 HEAD`: what merging adds on top of the base
#   tip. That is the diff whose result the heavy steps would be testing, so it is the one classified.
#   If HEAD is not that shape (not a merge of the PR head, shallow in an unexpected way, ...), fall back
#   to the merge-base diff when both SHAs are available, else give up -> full CI.
#
# Env: EVENT_NAME (anything but pull_request -> full CI), HEAD_SHA (PR head), BASE_SHA (PR base tip).
set -uo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
classifier="$(cd "$(dirname "$0")" && pwd)/classify-ci-docs-only.mjs"

emit() { # $1 = true|false, $2 = reason
  local docs_only="$1" reason="${2//$'\n'/ }"
  {
    echo "docs_only=$docs_only"
    echo "reason=$reason"
  } >> "$out"
  echo "::notice title=CI docs-only classifier::docs_only=$docs_only -- $reason"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "## CI docs-only classifier (CI optimization Phase 1)"
      echo ""
      echo "| docs_only | reason |"
      echo "|---|---|"
      echo "| \`$docs_only\` | $reason |"
      if [ "$docs_only" = true ]; then
        echo ""
        echo "Skipped: \`npm ci\`, WebKit CI scripts tests, lint, Vitest, build. Any change outside docs Markdown / images / root Markdown runs them all."
      fi
      if [ -n "${changed_files:-}" ]; then
        echo ""
        echo "<details><summary>Changed files</summary>"
        echo ""
        # shellcheck disable=SC2016 # literal backticks for Markdown code spans
        printf '%s\n' "$changed_files" | sed 's/^/- `/; s/$/`/'
        echo ""
        echo "</details>"
      fi
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
}
failsafe() { emit false "fail-safe (full CI): $1"; }

command -v node >/dev/null 2>&1 || failsafe "node not available"
node "$classifier" --self-test >/dev/null 2>&1 || failsafe "classifier self-test failed"

event="${EVENT_NAME:-pull_request}"
[ "$event" = "pull_request" ] || failsafe "event '$event' always runs full CI"

changed_files=""
read -r _ merge_p1 merge_p2 merge_extra <<<"$(git rev-list --parents -n 1 HEAD 2>/dev/null)"
if [ -n "${merge_p2:-}" ] && [ -z "${merge_extra:-}" ] && [ -n "${HEAD_SHA:-}" ] && [ "$merge_p2" = "$HEAD_SHA" ]; then
  changed_files="$(git -c core.quotePath=false diff --name-only --no-renames "$merge_p1" HEAD 2>/dev/null)" \
    || failsafe "git diff of the merge commit failed"
elif [ -n "${BASE_SHA:-}" ] && [ -n "${HEAD_SHA:-}" ]; then
  merge_base="$(git merge-base "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)" \
    || failsafe "HEAD is not the PR merge ref and the merge-base of $BASE_SHA and $HEAD_SHA is unavailable"
  changed_files="$(git -c core.quotePath=false diff --name-only --no-renames "$merge_base" "$HEAD_SHA" 2>/dev/null)" \
    || failsafe "git diff against the merge-base failed"
else
  failsafe "HEAD is not the PR merge ref and BASE_SHA/HEAD_SHA were not provided"
fi
[ -n "$changed_files" ] || failsafe "the pull request has no changed files to classify"

result="$(printf '%s\n' "$changed_files" | node "$classifier")" || failsafe "classifier failed"
docs_only="$(sed -n 's/^docs_only=//p' <<<"$result")"
reason="$(sed -n 's/^reason=//p' <<<"$result")"
{ [ "$docs_only" = true ] || [ "$docs_only" = false ]; } || failsafe "classifier returned no decision"

emit "$docs_only" "$reason"
