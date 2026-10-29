#!/usr/bin/env bash
# Hermetic tests for scripts/ops. Usage: bash scripts/ops/test-ops.sh
# 1) node:test suites (logic, claims, overlap, collector with a fake API, static safety)
# 2) mutation check: deliberately broken copies of the logic MUST make the suite fail, otherwise the
#    tests would not notice a Gate that hides failures or trusts the wrong head / author.
# shellcheck disable=SC2016  # the sed programs below are literal text, not shell expansions
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0

echo "== 1. suites"
if node --test "$here/ops.test.mjs" "$here/regress.test.mjs" "$here/safety.test.mjs" "$here/claims-pagination.test.mjs"; then echo "suites pass"; else echo "suites FAILED"; exit 1; fi

echo "== 2. mutation check (each broken copy must be caught)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mutate() { # name file sed-expression
  local name="$1" file="$2" expr="$3"
  rm -rf "$work/m" && mkdir -p "$work/m/scripts" "$work/m/.github" && cp -r "$here" "$work/m/scripts/ops" && cp -r "$here/../../.github/workflows" "$work/m/.github/workflows"
  sed -i -E "$expr" "$work/m/scripts/ops/$file"
  if cmp -s "$here/$file" "$work/m/scripts/ops/$file"; then echo "FAIL  $name: mutation did not change the file"; fail=1; return; fi
  if node --test "$work/m/scripts/ops/ops.test.mjs" "$work/m/scripts/ops/regress.test.mjs" "$work/m/scripts/ops/safety.test.mjs" "$work/m/scripts/ops/claims-pagination.test.mjs" > "$work/out.txt" 2>&1; then
    echo "FAIL  $name: mutant survived"; fail=1
  else
    echo "ok    $name"
  fi
}

mutate "counts CI of other heads"        lib/gate-state.mjs 's/if \(c\.headSha !== head\) \{/if (false) {/'
mutate "drops rerun history"             lib/gate-state.mjs 's/if \(failedBefore\.length === 0\) continue;/continue;/'
mutate "reviewed sha matches any prefix" lib/gate-state.mjs 's/reviewed\.length >= 7 && //'
mutate "claims merge approval"           lib/gate-state.mjs 's/mergeApproval: "NOT_ASSESSED"/mergeApproval: "APPROVED"/'
mutate "ready despite open threads"      lib/gate-state.mjs 's/facts\.threads && facts\.threads\.unresolved > 0/false/'
mutate "ignores unmerged dependency"     lib/gate-state.mjs 's/unresolvedDeps = facts\.dependencies\.filter\(.*$/unresolvedDeps = [];/'
mutate "trusts any Codex author"         lib/trust.mjs 's/return comment\?\.user\?\.login === CODEX_LOGIN && comment\?\.user\?\.type === "Bot";/return true;/'
mutate "trusts any claim author"         lib/trust.mjs 's/return TRUSTED_ASSOCIATIONS\.has\(comment\?\.author_association\);/return true;/'
mutate "accepts non-repo REST paths"     collect-facts.mjs 's/if \(!path\.startsWith\("\/repos\/"\)\) throw/if (false) throw/'
mutate "treats cancelled CI as green"    lib/gate-state.mjs 's/"timed_out", "action_required", "startup_failure", "cancelled", "stale"/"timed_out", "action_required", "startup_failure", "stale"/'

# Reverting each fix of the PR #572 independent review (F1-F10, P3) must be caught by regress.test.mjs.
mutate "F1 ignores workflow runs of the head"      lib/gate-state.mjs 's/for \(const r of facts\.runs\) \{/for (const r of []) {/'
mutate "F2 drafts can be ready"                    lib/gate-state.mjs 's/if \(pr\.draft \|\| mergeable === "draft"\) blockers\.push/if (false) blockers.push/'
mutate "F2 behind is ignored"                      lib/gate-state.mjs 's/if \(mergeable === "behind"\) blockers/if (false) blockers/'
mutate "F2 unknown mergeable_state accepted"       lib/gate-state.mjs 's/else if \(!MERGEABLE_KNOWN\.has\(mergeable\)\)/else if (false)/'
mutate "F3 HOLD matches any prose"                 lib/hold.mjs 's/return BODY_HOLD\.test\(stripFences\(body\)\);/return \/\\bhold\\b\/i.test(body);/'
mutate "F3 HOLD outranks other blockers"           lib/gate-state.mjs 's/^  "CLOSED",$/  "CLOSED",\n  "HOLD",/'
mutate "F4 any receipt counts as clean"            collect-facts.mjs 's/clean: CLEAN_RECEIPT\.test\(body\)/clean: true/'
mutate "F4 null findings count as clean"           collect-facts.mjs 's/hasUnresolved: typeof st\.has_unresolved_findings === "boolean" \? st\.has_unresolved_findings : null/hasUnresolved: st.has_unresolved_findings === true/'
mutate "F5 Codex error comments are ignored"       lib/gate-state.mjs 's/else if \(hasError\(headAt\)\) \{/else if (false) {/'
mutate "F6 truncated lists look complete"          collect-facts.mjs 's/throw new TruncatedError\(`\$\{path\.split\("\?"\)\[0\]\} has more than \$\{maxPages \* 100\} items`\);/return all;/'
mutate "F6 failed reads are not recorded"          collect-facts.mjs 's/gaps\.push\(`\$\{label\}: \$\{e\.message\}`\);/void 0;/'
mutate "F8 HTML is not stripped"                   lib/sanitize.mjs 's/\.replace\(\/\[<>\]\/g, ""\)/.replace(\/x^\/g, "")/'
mutate "F8 control characters are kept"            lib/sanitize.mjs 's/\.replace\(CONTROL, " "\)/.replace(\/x^\/g, " ")/'
mutate "F9 directory claims match nothing"         lib/overlap.mjs 's/return file === dir \|\| file\.startsWith\(`\$\{dir\}\/`\);/return file === dir;/'
mutate "F10 foreign refs read as local"            lib/claims.mjs 's/\(\?<!\[\\w\/\.-\]\)#/#/'
mutate "P3 fenced claim examples are live"         lib/claims.mjs 's/stripFences\(c\.body\)\.matchAll/c.body.matchAll/'
mutate "P3 null Codex body throws"                 collect-facts.mjs 's/const body = typeof c\?\.body === "string" \? c\.body : "";/const body = c.body;/'

mutate "N1 only the first 30 legacy statuses are read" collect-facts.mjs 's|api\.restAll\(`/repos/\$\{repo\}/commits/\$\{head\}/statuses`, null\)|api.rest(`/repos/${repo}/commits/${head}/statuses`)|'
mutate "N1 older superseded statuses all count"    collect-facts.mjs 's/if \(!latest\.has\(s\.context\)\) latest\.set\(s\.context, s\);/latest.set(`${s.context}${Math.random()}`, s);/'
mutate "N2 summary errors measured from commit date" lib/gate-state.mjs 's/hasError\(Number\.isNaN\(summaryAt\) \? headAt : summaryAt\)/hasError(headAt)/'
mutate "N5 same-instant errors are ignored"         lib/gate-state.mjs 's/ms\(o\.at\) >= cutoff/ms(o.at) > cutoff/'
mutate "N4 unclosed fences stay live"               lib/hold.mjs 's/return closed\.replace\(.*$/return closed;/'

# Claim-comment pagination (the 500-comment cap that made every claim read as "none"): each fix must be caught by claims-pagination.test.mjs.
mutate "C1 claim comments capped at 5 pages again"   collect-facts.mjs 's/CLAIM_COMMENT_MAX_PAGES = 50;/CLAIM_COMMENT_MAX_PAGES = 5;/'
mutate "C2 comments read before a failure are dropped" collect-facts.mjs 's/repoComments = Array\.isArray\(e\?\.partial\) \? e\.partial : \[\];/repoComments = [];/'
mutate "C3 claims gap does not reach the PR rows"     collect-facts.mjs 's/if \(claimsGap\) for \(const f of prFacts\) f\.gaps = \[\.\.\.\(f\.gaps \?\? \[\]\), claimsGap\];/void 0;/'
mutate "C4 restAll does not hand back the partial read" collect-facts.mjs 's/if \(e && typeof e === "object"\) e\.partial = all;/void 0;/'
mutate "C5 a failed claims read is not a gap"          collect-facts.mjs 's/    repoGaps\.push\(claimsGap\);/    void 0;/'
if [ "$fail" -ne 0 ]; then echo "mutation check FAILED"; exit 1; fi
echo "mutation check passed"
