#!/usr/bin/env python3
"""
Progression 2.0 Phase 0B analysis (Issue #182 follow-up). Docs/data-only
tooling -- NOT part of src/**, NOT wired into CI, not referenced by
production code.

Extends tools/progression2_phase0_analysis.py's Phase 0A output (the
51-viable-recipe / 62-ingredient existing Fresh Recipe Master Catalog) with
docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json (25
externally-relayed PIZZA DB samples, see that file's own sourceMeta for the
full provenance/epistemic-status caveat).

**This combined pool is 64 of the owner-reported 172 total (37%). It is
explicitly NOT a full-172-population analysis** -- every output value in
this script is labeled accordingly, and no deadlock/reachability claim here
is represented as covering the full PIZZA DB population.

What this script adds beyond Phase 0A:
  1. Classifies each of the 25 Phase 0B samples into confirmation / variant /
     new-candidate (see docs comment above), so the combined pool never
     double-counts a recipe already in Phase 0A under a different id.
  2. Recomputes recipeReach / marginal-unlock / deadlock-simulation over the
     combined 64-recipe pool.
  3. Exact-ingredient-set collision detection across the WHOLE combined pool
     (recipe groups whose full required-ingredient set is byte-identical) --
     this is the "recipe identity cannot be determined by ingredient set
     alone" check Issue #182's follow-up explicitly asks for, run over both
     Phase 0A alone and the combined pool.

Usage: python3 tools/progression2_phase0b_analysis.py
Writes: docs/reports/data/TETO_PROGRESS2_PHASE0B_analysis-output.json
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_PATH = ROOT / "data/recipes/pizza_master_catalog.json"
SAMPLES_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json"
OUT_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_analysis-output.json"

INITIAL_OWNED = ["tomato-sauce", "mozzarella", "basil"]
CLAIMED_TOTAL_POPULATION = 172

# Every Phase 0B sample id whose ingredient set is an EXACT match to an
# already-catalogued Phase 0A recipe -- these are corroborations, not new
# pool members (adding them would double-count the same recipe under two ids).
CONFIRMATIONS = {
    "bbq-chicken-pizzadb": "bbq-chicken",
    "quattro-stagioni-pizzadb": "quattro-stagioni",
    "quattro-formaggi-pizzadb": "quattro-formaggi",
    "supreme-pizzadb": "supreme",
    "tonno-e-cipolla-pizzadb": "tonno-e-cipolla",
    "ny-style-pizzadb": "ny-style",
}

# Every Phase 0B sample id that shares a name/identity with an existing
# catalogued recipe but has a DIFFERENT ingredient composition -- these are
# recorded as variant evidence, not added as new pool entries (matching the
# existing catalog's own anti-near-duplicate-padding discipline, e.g. how
# bufalina/contadina were rejected rather than added).
VARIANTS_NOT_ADDED = {
    "capricciosa-pizzadb": "capricciosa",
    "calzone-pizzadb": "calzone",
    "chicago-deep-dish-pizzadb": "chicago-deep-dish",
    "siciliana-pizzadb": "siciliana",
    "greek-style-pizzadb": "greek-style",
    "buffalo-chicken-pizzadb": "buffalo-chicken",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    catalog = load(RECIPES_PATH)
    samples_doc = load(SAMPLES_PATH)
    samples = samples_doc["samples"]

    viable_a = [r for r in catalog["recipes"] if r["verificationStatus"] != "rejected_duplicate"]

    new_candidates = [
        s for s in samples
        if s["id"] not in CONFIRMATIONS and s["id"] not in VARIANTS_NOT_ADDED
    ]
    confirmations_found = [s for s in samples if s["id"] in CONFIRMATIONS]
    variants_found = [s for s in samples if s["id"] in VARIANTS_NOT_ADDED]

    assert len(new_candidates) + len(confirmations_found) + len(variants_found) == len(samples)

    # Build the combined pool: Phase 0A viable recipes (unchanged) + Phase 0B
    # genuinely-new candidates only, each normalized to {"id", "ingredients"}.
    pool = []
    for r in viable_a:
        pool.append({"id": r["id"], "ingredients": list(r["ingredients"]), "origin": "phase0a"})
    for s in new_candidates:
        pool.append({"id": s["id"], "ingredients": list(s["ingredientsCanonical"]), "origin": "phase0b_new"})

    canonical_ingredients = set()
    for r in pool:
        canonical_ingredients.update(r["ingredients"])

    # --- Exact-ingredient-set collision detection (Phase 0A alone, and combined) ---
    def collisions(recipe_list):
        groups = defaultdict(list)
        for r in recipe_list:
            groups[frozenset(r["ingredients"])].append(r["id"])
        return [
            {"ingredientSet": sorted(k), "recipeIds": sorted(v)}
            for k, v in groups.items() if len(v) > 1
        ]

    collisions_phase0a_only = collisions([{"id": r["id"], "ingredients": r["ingredients"]} for r in pool if True] if False else [{"id": r["id"], "ingredients": r["ingredients"]} for r in viable_a])
    collisions_combined = collisions(pool)

    # --- recipeReach over the combined pool ---
    reach = {i: 0 for i in canonical_ingredients}
    for r in pool:
        for ing in r["ingredients"]:
            reach[ing] += 1

    # --- Marginal unlock + deadlock simulation over the combined pool
    # (ingredient-completeness only; this script does not re-derive the
    # mechanic-gate classification per new Phase 0B recipe -- that judgment
    # call is recorded qualitatively in each sample's mechanicNote instead,
    # since Phase 0B's own new recipes were not run through the same
    # gameplay_mechanic_master.json tagging pipeline as Phase 0A). ---
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
        if guard > 500:
            deadlocks.append({"type": "guard_tripped"})
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
        # NOTE: a marginalUnlockCount of 0 for every remaining ingredient is
        # NOT itself a deadlock -- it only means no SINGLE next purchase
        # completes a recipe alone (e.g. quattro-formaggi needs 3 still-
        # missing cheeses at once; the 1st and 2nd purchases each show 0
        # marginal, the 3rd shows 1). The walk must keep buying (tie-broken
        # alphabetically among 0-marginal ingredients) rather than stopping
        # the instant one single-ingredient step shows no immediate payoff --
        # a true deadlock is only "no ingredient left to buy while the pool
        # isn't fully discovered", which the guard/best_ing-is-None branch
        # below already catches.
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
        "generatedBy": "tools/progression2_phase0b_analysis.py",
        "scopeWarning": (
            f"This is a PARTIAL-POOL analysis: {len(pool)} recipes "
            f"({len(viable_a)} Phase 0A + {len(new_candidates)} Phase 0B new candidates) "
            f"out of the owner-reported {CLAIMED_TOTAL_POPULATION}-entry PIZZA DB total "
            f"({round(100 * len(pool) / CLAIMED_TOTAL_POPULATION)}% coverage). "
            "NOT a full-172-population deadlock/reachability result. "
            f"{CLAIMED_TOTAL_POPULATION - len(pool)} entries remain entirely unaccounted for "
            "(pages 7-15 of the claimed pagination were not sampled in the relayed PR comment)."
        ),
        "sampleClassification": {
            "totalSamplesInRelayedComment": len(samples),
            "confirmationsOfExistingPhase0aEntries": [{"sampleId": s["id"], "existingCatalogId": CONFIRMATIONS[s["id"]]} for s in confirmations_found],
            "variantsOfExistingPhase0aEntriesNotAdded": [{"sampleId": s["id"], "existingCatalogId": VARIANTS_NOT_ADDED[s["id"]]} for s in variants_found],
            "genuinelyNewCandidatesAddedToPool": [s["id"] for s in new_candidates],
        },
        "combinedPool": {
            "totalRecipes": len(pool),
            "phase0aRecipes": len(viable_a),
            "phase0bNewRecipes": len(new_candidates),
            "claimedFullPopulation": CLAIMED_TOTAL_POPULATION,
            "coveragePercent": round(100 * len(pool) / CLAIMED_TOTAL_POPULATION, 1),
            "canonicalIngredientCount": len(canonical_ingredients),
        },
        "exactIngredientSetCollisions": {
            "phase0aOnly": collisions_phase0a_only,
            "combinedPool": collisions_combined,
            "note": (
                "Each group lists recipe ids whose FULL required-ingredient set is byte-identical. "
                "These recipes cannot be distinguished by ingredient-set matching alone -- recipe "
                "identity would need to also encode mechanic/shape/dough/bake-profile/finishing-order "
                "for discovery to disambiguate them (see the Phase 0B report's own discussion)."
            ),
        },
        "combinedPoolRecipeReach": sorted(
            ({"ingredient": k, "recipeReach": v} for k, v in reach.items()),
            key=lambda x: (-x["recipeReach"], x["ingredient"]),
        ),
        "combinedPoolDeadlockSimulation": {
            "steps": steps,
            "deadlockStateCount": len(deadlocks),
            "deadlocks": deadlocks,
            "finalDiscoveredCount": len(discovered),
            "totalPoolSize": len(pool),
            "unreachableRecipeCount": len(unreachable),
            "unreachableRecipeIds": unreachable,
            "unreachableIngredientCount": len(full_set - owned),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(result["scopeWarning"])
    print(f"Phase 0A-only exact-set collisions: {len(collisions_phase0a_only)} groups")
    print(f"Combined-pool exact-set collisions: {len(collisions_combined)} groups")
    print(f"Combined-pool deadlock state count: {len(deadlocks)}")
    print(f"Combined-pool unreachable recipe count: {len(unreachable)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
