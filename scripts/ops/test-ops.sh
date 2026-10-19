#!/usr/bin/env bash
# Hermetic tests for scripts/ops. Usage: bash scripts/ops/test-ops.sh
# 1) node:test suites (logic, claims, overlap, collector with a fake API, static safety)
# 2) mutation check: deliberately broken copies of the logic MUST make the suite fail, otherwise the
#    tests would not notice a Gate that hides failures or trusts the wrong head / author.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0

echo "== 1. suites"
if node --test "$here/ops.test.mjs" "$here/safety.test.mjs"; then echo "suites pass"; else echo "suites FAILED"; exit 1; fi

echo "== 2. mutation check (each broken copy must be caught)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mutate() { # name file sed-expression
  local name="$1" file="$2" expr="$3"
  rm -rf "$work/m" && mkdir -p "$work/m/scripts" "$work/m/.github" && cp -r "$here" "$work/m/scripts/ops" && cp -r "$here/../../.github/workflows" "$work/m/.github/workflows"
  sed -i -E "$expr" "$work/m/scripts/ops/$file"
  if cmp -s "$here/$file" "$work/m/scripts/ops/$file"; then echo "FAIL  $name: mutation did not change the file"; fail=1; return; fi
  if node --test "$work/m/scripts/ops/ops.test.mjs" "$work/m/scripts/ops/safety.test.mjs" > "$work/out.txt" 2>&1; then
    echo "FAIL  $name: mutant survived"; fail=1
  else
    echo "ok    $name"
  fi
}

mutate "counts CI of other heads"        lib/gate-state.mjs 's/facts\.checks\.filter\(\(c\) => c\.headSha === head\)/facts.checks/'
mutate "drops rerun history"             lib/gate-state.mjs 's/if \(failedBefore\.length === 0\) continue;/continue;/'
mutate "reviewed sha matches any prefix" lib/gate-state.mjs 's/reviewed\.length >= 7 && //'
mutate "claims merge approval"           lib/gate-state.mjs 's/mergeApproval: "NOT_ASSESSED"/mergeApproval: "APPROVED"/'
mutate "ready despite open threads"      lib/gate-state.mjs 's/facts\.threads && facts\.threads\.unresolved > 0/false/'
mutate "ignores unmerged dependency"     lib/gate-state.mjs 's/unresolvedDeps = facts\.dependencies\.filter\(.*$/unresolvedDeps = [];/'
mutate "trusts any Codex author"         lib/trust.mjs 's/return comment\?\.user\?\.login === CODEX_LOGIN && comment\?\.user\?\.type === "Bot";/return true;/'
mutate "trusts any claim author"         lib/trust.mjs 's/return TRUSTED_ASSOCIATIONS\.has\(comment\?\.author_association\);/return true;/'
mutate "accepts non-repo REST paths"     collect-facts.mjs 's/if \(!path\.startsWith\("\/repos\/"\)\) throw/if (false) throw/'
mutate "treats cancelled CI as green"    lib/gate-state.mjs 's/"timed_out", "action_required", "startup_failure", "cancelled", "stale"/"timed_out", "action_required", "startup_failure", "stale"/'

if [ "$fail" -ne 0 ]; then echo "mutation check FAILED"; exit 1; fi
echo "mutation check passed"
