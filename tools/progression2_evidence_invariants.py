#!/usr/bin/env python3
"""
Progression 2.0 evidence invariants (Issue #182 / PR #183, Phase 0B.2).
Docs/data-only tooling -- NOT part of src/**, NOT wired into CI.

Guards against exactly the 4 failure modes PR #183 comment #5774835400 asked
this Phase to prevent a partial dataset from accidentally becoming the
Progression 2.0 SSOT:

  1. Japanese (ja-172) sauce-family counts must sum to 172.
  2. Ingredient OCCURRENCE counts must never be conflated with RECIPE ROW
     counts (two different things measured over the same 172 population).
  3. English-160-subset evidence must never be used to mark a ja-172 gap as
     "filled" -- every evidenced item must be tagged population="ja-172".
  4. A "full population deadlock simulation" must be BLOCKED (refused, not
     silently run on a partial pool) unless all 172 recipe rows have
     evidence/canonicalization status recorded.

Run this after any change to the Phase 0B/0B.1/0B.2 evidence files. Exit 0 =
all invariants hold. Non-zero = at least one violated (see printed FAIL
lines) -- this is meant to fail loudly, the same way
tools/validate_recipe_catalog.py already does for the recipe/ingredient
master catalog.

Usage: python3 tools/progression2_evidence_invariants.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE_LEDGER_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_sauce_family_sum_172(ledger):
    """Invariant 1: ja-172 sauce-family counts sum to exactly 172."""
    sf = ledger["sauceFamilyEvidence"]
    if sf["population"] != "ja-172":
        return False, f"sauceFamilyEvidence.population is {sf['population']!r}, expected 'ja-172'"
    total = sum(c["count"] for c in sf["categories"])
    if total != sf["claimedTotal"]:
        return False, f"sauce-family categories sum to {total}, expected claimedTotal {sf['claimedTotal']}"
    if total != 172:
        return False, f"sauce-family categories sum to {total}, expected 172"
    return True, f"sauce-family categories sum to {total} == 172"


def check_occurrence_not_recipe_rows(ledger):
    """Invariant 2: ingredient occurrence counts and recipe row counts are
    tracked as separate, non-conflatable fields -- neither is silently
    substituted for the other anywhere in the ledger."""
    occ = ledger["ingredientOccurrenceEvidence"]
    rows = ledger["recipeRowEvidence"]
    problems = []
    if "evidencedCount" in occ:
        problems.append("ingredientOccurrenceEvidence must not carry an 'evidencedCount' key (that belongs to recipeRowEvidence only)")
    if "totalNamedIngredientCount" not in occ:
        problems.append("ingredientOccurrenceEvidence.totalNamedIngredientCount missing")
    if "evidencedCount" not in rows:
        problems.append("recipeRowEvidence.evidencedCount missing")
    if problems:
        return False, "; ".join(problems)
    if occ["totalNamedIngredientCount"] == rows["evidencedCount"]:
        # Not inherently a violation, but coincidental equality between the
        # two different metrics is exactly the kind of thing that invites
        # accidental conflation downstream -- flag it loudly if it ever
        # happens so a human re-checks which metric a consuming script
        # actually used.
        return False, (
            f"ingredient-occurrence-named-count ({occ['totalNamedIngredientCount']}) == "
            f"recipe-row-evidenced-count ({rows['evidencedCount']}) -- coincidental equality, "
            "re-verify no downstream script conflates the two before trusting this"
        )
    return True, (
        f"ingredient occurrence ({occ['totalNamedIngredientCount']} named) and recipe rows "
        f"({rows['evidencedCount']} evidenced) are tracked as distinct, non-equal metrics"
    )


def check_population_tag_no_en160_leak(ledger):
    """Invariant 3: en-160 is explicitly marked unusable for ja-172
    completeness, and nothing in the ledger's evidenced counts is sourced
    from en-160."""
    pops = ledger["populations"]
    if "en-160" not in pops or "ja-172" not in pops:
        return False, "ledger must declare both 'ja-172' and 'en-160' populations explicitly"
    en160 = pops["en-160"]
    if en160.get("usableForJa172Completeness") is not False:
        return False, "populations.en-160.usableForJa172Completeness must be explicitly false"
    if pops["ja-172"].get("isCanonicalPopulationForIssue182") is not True:
        return False, "populations.ja-172.isCanonicalPopulationForIssue182 must be explicitly true"
    if pops["en-160"].get("isCanonicalPopulationForIssue182") is not False:
        return False, "populations.en-160.isCanonicalPopulationForIssue182 must be explicitly false"
    for section_name in ("recipeRowEvidence", "ingredientOccurrenceEvidence", "sauceFamilyEvidence"):
        section = ledger[section_name]
        if section.get("population") != "ja-172":
            return False, f"{section_name}.population is {section.get('population')!r}, expected 'ja-172' -- en-160 data must never populate these sections"
    return True, "en-160 is explicitly marked non-usable for ja-172 completeness; all evidenced sections are tagged ja-172"


def check_full_deadlock_blocked_unless_172_covered(ledger, total_claimed=172):
    """Invariant 4: a 'full population deadlock simulation' claim is only
    permitted once recipeRowEvidence.evidencedCount == total_claimed. Below
    that, any deadlock/reachability result must carry an explicit partial-
    pool scope warning (as Phase 0A/0B's own outputs already do) -- this
    function is the reusable guard a future full-population script must call
    before it is allowed to claim completeness."""
    rows = ledger["recipeRowEvidence"]
    covered = rows["evidencedCount"]
    if covered < total_claimed:
        if rows.get("status") != "incomplete":
            return False, f"recipeRowEvidence.status should be 'incomplete' while evidencedCount ({covered}) < totalClaimed ({total_claimed})"
        return True, (
            f"full-population deadlock simulation correctly BLOCKED: only {covered}/{total_claimed} "
            "recipe rows have evidence -- any deadlock result must stay scoped to a partial pool"
        )
    return True, f"all {total_claimed} recipe rows have evidence -- a full-population deadlock simulation may now be run"


INVARIANTS = [
    ("sauce_family_sum_172", check_sauce_family_sum_172),
    ("occurrence_not_recipe_rows", check_occurrence_not_recipe_rows),
    ("population_tag_no_en160_leak", check_population_tag_no_en160_leak),
    ("full_deadlock_blocked_unless_172_covered", check_full_deadlock_blocked_unless_172_covered),
]


def main():
    ledger = load(EVIDENCE_LEDGER_PATH)
    failures = 0
    for name, check in INVARIANTS:
        ok, message = check(ledger)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {message}")
        if not ok:
            failures += 1
    print()
    if failures:
        print(f"{failures} invariant(s) FAILED.")
        return 1
    print(f"All {len(INVARIANTS)} invariants passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
