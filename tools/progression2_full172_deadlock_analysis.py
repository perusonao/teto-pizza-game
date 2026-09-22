#!/usr/bin/env python3
"""
Progression 2.0 full-172-population deadlock analysis (Issue #182 / PR #183,
Phase 0B.18). Docs/data-only tooling -- NOT part of src/**, NOT wired into
CI, not referenced by production code, NOT a merge/threshold/price decision.

Explicitly requested by the Phase 0B.18 trigger comment
(https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781435283):
"If coverage reaches 172/172, run full-population deadlock analysis and
report actual result." Coverage reached 172/172 in this same Phase (see
docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json's
counters), so this script runs the same greedy marginal-unlock/deadlock
simulation tools/progression2_phase0b_analysis.py already runs over a
64-recipe partial pool, but over the now-complete 172-row ja-172 evidence
population.

Building the pool requires a canonical ingredient SET per row. The 25
original comparison_table_sample rows already carry one
(ingredientsCanonical, from Phase 0B). The other 147 individualProfilePageRows
only carry raw ingredientsJa strings -- each name is resolved deterministically
via tools/progression2_ingredient_canonicalizer.py's classify() (the same
tables used throughout Phase 0B.2-0B.18, re-used here rather than
reimplemented). A name resolving to excluded_non_ingredient (e.g. the known
"toppings of your choice" placeholder) is dropped from that row's set. A name
resolving to ambiguous or needs_review CANNOT be deterministically mapped to
one canonical id -- per this task's standing never-guess-fill discipline,
such a row is EXCLUDED from the reachability pool entirely (not given a
guessed ingredient), and recorded in full in excludedRowsWithAmbiguousIngredients
below. This means the pool size is <= 172; the exact count and every excluded
row's reason are reported, never silently dropped.

This is a reachability/deadlock analysis only -- it does NOT resolve any of
the 14 composition conflicts, 7 naming-ambiguity clusters, or 41
mechanic-identity rows catalogued in docs/reports/TETO_PIZZADB_172_MASTER-REPORT.md;
consistent with tools/progression2_phase0b_analysis.py's own combined-pool
model, mechanic-gating is NOT modeled here (every row is treated as
ingredient-completeness-only reachable) -- this is a known simplification,
not a claim that all 41 mechanic-identity rows are actually craftable with
the game's current baseline mechanics.

Usage: python3 tools/progression2_full172_deadlock_analysis.py
Writes: docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import progression2_ingredient_canonicalizer as canon

LEDGER_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json"
SAMPLES_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json"
OUT_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json"

INITIAL_OWNED = ["tomato-sauce", "mozzarella", "basil"]
CLAIMED_TOTAL_POPULATION = 172


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve_row_ingredients(name_list, exact_names):
    """Returns (canonical_ids_or_None, unresolved_detail_list). If any name
    is ambiguous/needs_review, canonical_ids is None (row excluded)."""
    ids = set()
    unresolved = []
    for name in name_list:
        r = canon.classify(name, exact_names)
        disp = r["disposition"]
        if disp == "excluded_non_ingredient":
            continue
        if disp in ("exact_alias", "likely_alias", "genuinely_new"):
            ids.add(r["canonicalId"])
        else:
            unresolved.append({"nameJa": name, "disposition": disp, "relatedIds": r.get("relatedIds")})
    if unresolved:
        return None, unresolved
    return ids, []


def main():
    ledger = load(LEDGER_PATH)
    samples_doc = load(SAMPLES_PATH)
    samples = samples_doc["samples"]
    exact_names = canon.load_canonical_names()

    pool = []
    excluded = []

    # --- 25 original comparison-table samples: already have a canonical set ---
    for s in samples:
        pool.append({
            "id": s["id"], "ingredients": sorted(set(s["ingredientsCanonical"])),
            "origin": "phase0_original_25_sample",
        })

    # --- 147 individualProfilePageRows: resolve via the canonicalizer ---
    for r in ledger["individualProfilePageRows"]:
        ids, unresolved = resolve_row_ingredients(r.get("ingredientsJa", []), exact_names)
        if ids is None:
            excluded.append({
                "id": r["id"], "nameJa": r.get("nameJa"),
                "reason": "one or more ingredient names classify as ambiguous/needs_review -- "
                          "per the standing never-guess-fill discipline, this row's full "
                          "canonical ingredient set cannot be determined without a product "
                          "decision, so it is excluded from the reachability pool (still "
                          "counted in the 172/172 ja-172 evidence total; see the raw ledger).",
                "unresolvedIngredients": unresolved,
            })
            continue
        pool.append({"id": r["id"], "ingredients": sorted(ids), "origin": "individual_profile_page"})

    assert len(pool) + len(excluded) == 172, f"expected 172 total, got {len(pool)} pool + {len(excluded)} excluded"

    canonical_ingredients = set()
    for r in pool:
        canonical_ingredients.update(r["ingredients"])

    # --- Exact-ingredient-set collision detection over the resolvable pool ---
    def collisions(recipe_list):
        groups = defaultdict(list)
        for r in recipe_list:
            groups[frozenset(r["ingredients"])].append(r["id"])
        return [
            {"ingredientSet": sorted(k), "recipeIds": sorted(v)}
            for k, v in groups.items() if len(v) > 1
        ]

    collisions_full = collisions(pool)

    # --- recipeReach over the full resolvable pool ---
    reach = {i: 0 for i in canonical_ingredients}
    for r in pool:
        for ing in r["ingredients"]:
            reach[ing] += 1

    # --- Greedy marginal-unlock / deadlock simulation (ingredient-completeness
    # only -- mechanic-gating not modeled, see module docstring) ---
    def complete(r, owned):
        return set(r["ingredients"]).issubset(owned)

    owned = set(INITIAL_OWNED)
    discovered = set()
    steps = []
    deadlocks = []
    full_set = set(canonical_ingredients)
    guard = 0
    step_no = 0
    while True:
        guard += 1
        if guard > 1000:
            deadlocks.append({"type": "guard_tripped", "note": "simulation exceeded 1000 steps"})
            break
        newly = [r["id"] for r in pool if r["id"] not in discovered and complete(r, owned)]
        discovered |= set(newly)
        still_blocked = [r["id"] for r in pool if r["id"] not in discovered]

        if owned == full_set:
            steps.append({"step": step_no, "newlyDiscoveredThisStep": newly, "stillBlockedRecipeCount": len(still_blocked), "nextIngredientPurchased": None})
            break

        not_yet_craftable = [r for r in pool if r["id"] not in discovered]
        marginal = {}
        for ing in sorted(full_set - owned):
            hyp = owned | {ing}
            marginal[ing] = [r["id"] for r in not_yet_craftable if complete(r, hyp)]
        best_ing = max(marginal, key=lambda k: (len(marginal[k]), k), default=None)
        best_count = len(marginal[best_ing]) if best_ing else 0

        steps.append({
            "step": step_no, "newlyDiscoveredThisStep": newly,
            "stillBlockedRecipeCount": len(still_blocked),
            "nextIngredientPurchased": best_ing, "marginalUnlockCount": best_count,
        })
        if best_ing is None:
            deadlocks.append({"type": "no_ingredient_left_but_not_full", "step": step_no})
            break
        owned.add(best_ing)
        step_no += 1

    unreachable = sorted(r["id"] for r in pool if r["id"] not in discovered)

    result = {
        "generatedBy": "tools/progression2_full172_deadlock_analysis.py",
        "generatedInPhase": "Phase 0B.18",
        "triggerComment": "https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5781435283",
        "scopeNote": (
            f"ja-172 evidence coverage is 172/172 (100%). The reachability/deadlock POOL built "
            f"here is {len(pool)}/172 ({round(100 * len(pool) / CLAIMED_TOTAL_POPULATION, 1)}%) "
            f"because {len(excluded)} rows contain at least one ingredient name that classifies "
            "as ambiguous or needs_review and per the standing never-guess-fill discipline "
            "cannot be deterministically assigned a canonical ingredient set -- these rows are "
            "NOT missing evidence (all 172 rows have full raw evidence, see "
            "TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json), they are excluded from THIS "
            "ingredient-set-based simulation specifically. Every excluded row and its exact "
            "unresolved ingredient(s) is listed in excludedRowsWithAmbiguousIngredients below -- "
            "nothing is silently dropped. Mechanic-gating is also NOT modeled (all pool recipes "
            "are treated as reachable once ingredient-complete, matching "
            "tools/progression2_phase0b_analysis.py's own combined-pool simplification) -- 41 of "
            "these rows are independently known to require a mechanic/dough/cooking-method "
            "distinction beyond their ingredient list (see the master report), so "
            "'discovered' here means 'ingredient-complete', not 'actually craftable with the "
            "game's current baseline mechanics'."
        ),
        "pool": {
            "totalJa172Evidenced": CLAIMED_TOTAL_POPULATION,
            "resolvableIntoReachabilityPool": len(pool),
            "excludedAmbiguousIngredientRows": len(excluded),
            "coveragePercentOfPool": round(100 * len(pool) / CLAIMED_TOTAL_POPULATION, 1),
            "canonicalIngredientCountInPool": len(canonical_ingredients),
        },
        "excludedRowsWithAmbiguousIngredients": excluded,
        "exactIngredientSetCollisions": {
            "groups": collisions_full,
            "note": (
                "Each group lists recipe ids whose FULL resolved canonical-ingredient set is "
                "byte-identical. These recipes cannot be distinguished by ingredient-set "
                "matching alone; see the master report's naming-ambiguity-cluster and "
                "composition-conflict sections for the ones already known."
            ),
        },
        "recipeReach": sorted(
            ({"ingredient": k, "recipeReach": v} for k, v in reach.items()),
            key=lambda x: (-x["recipeReach"], x["ingredient"]),
        ),
        "deadlockSimulation": {
            "initialOwnedIngredients": sorted(INITIAL_OWNED),
            "steps": steps,
            "deadlockStateCount": len(deadlocks),
            "deadlocks": deadlocks,
            "finalOwnedIngredientCount": len(owned),
            "finalDiscoveredCount": len(discovered),
            "poolSize": len(pool),
            "unreachableRecipeCount": len(unreachable),
            "unreachableRecipeIds": unreachable,
            "unreachableIngredientCount": len(full_set - owned),
            "unreachableIngredientIds": sorted(full_set - owned),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(result["scopeNote"])
    print(f"Pool: {len(pool)}/172 resolvable, {len(excluded)} excluded (ambiguous ingredient)")
    print(f"Exact-ingredient-set collision groups: {len(collisions_full)}")
    print(f"Deadlock state count: {len(deadlocks)}")
    print(f"Unreachable recipe count (ingredient-completeness only): {len(unreachable)} / {len(pool)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
