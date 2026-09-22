#!/usr/bin/env python3
"""
Progression 2.0 Phase 0 analysis (Issue #182). Docs/data-only tooling -- NOT
part of src/**, NOT wired into CI/build. Not referenced by production code.

Computes, over the existing 51-viable-recipe Fresh Recipe Master Catalog
(data/recipes/pizza_master_catalog.json / ingredient_master_catalog.json):

  1. Existing-53-catalog cross-reference vs. currently shipped production
     (src/data/recipes.ts / src/data/ingredients.ts).
  2. Canonical ingredient recipeReach (within the 51-viable population).
  3. Per-progression-state marginal unlock: for a given owned-ingredient set,
     which single not-yet-owned ingredient would newly make the most
     currently-uncraftable recipes craftable (ingredient-completeness only;
     mechanic-gated recipes are tracked separately, never silently ignored).
  4. A greedy "always buy the highest-marginal ingredient next" walk from the
     Progression 2.0 initial state (0 discovered recipes, owned =
     {tomato-sauce, mozzarella, basil}) to the full 51-viable population,
     recording per-step newlyCraftableRecipes / marginalUnlockCount /
     stillBlockedRecipes, and flagging any deadlock state (owned != full set,
     zero currently-craftable-undiscovered recipe, AND best next-ingredient
     purchase yields marginalUnlockCount == 0).

Usage: python3 tools/progression2_phase0_analysis.py
Writes: docs/reports/data/TETO_PROGRESS2_PHASE0_analysis-output.json

See docs/reports/TETO_PROGRESS2_PHASE0_FULL-CATALOG_FRESH-AUDIT.md for the
narrative writeup of this script's output.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_PATH = ROOT / "data/recipes/pizza_master_catalog.json"
INGREDIENTS_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
MECHANICS_PATH = ROOT / "data/recipes/gameplay_mechanic_master.json"
PROD_RECIPES_PATH = ROOT / "src/data/recipes.ts"
PROD_INGREDIENTS_PATH = ROOT / "src/data/ingredients.ts"
OUT_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0_analysis-output.json"

INITIAL_OWNED = ["tomato-sauce", "mozzarella", "basil"]
BASELINE_MECHANICS = {"spread", "scatter"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def extract_prod_recipe_ids(text):
    # Matches:   id: "kebab-case",
    return sorted(set(re.findall(r'id:\s*"([a-z0-9-]+)"', text)))


def extract_prod_ingredient_ids(text):
    return sorted(set(re.findall(r'id:\s*"([a-z0-9-]+)"', text)))


def main():
    catalog = load(RECIPES_PATH)
    ingredient_catalog = load(INGREDIENTS_PATH)
    mechanics = load(MECHANICS_PATH)

    prod_recipe_ids = extract_prod_recipe_ids(PROD_RECIPES_PATH.read_text(encoding="utf-8"))
    prod_ingredient_ids = extract_prod_ingredient_ids(PROD_INGREDIENTS_PATH.read_text(encoding="utf-8"))

    all_recipes = catalog["recipes"]
    viable_recipes = [r for r in all_recipes if r["verificationStatus"] != "rejected_duplicate"]
    rejected_recipes = [r for r in all_recipes if r["verificationStatus"] == "rejected_duplicate"]

    canonical_ingredient_ids = {i["id"] for i in ingredient_catalog["ingredients"]}

    # --- Sanity: orphan ingredient references (recipe uses an ingredient id
    # not present in the canonical ingredient catalog) ---
    orphan_refs = []
    for r in viable_recipes:
        for ing in r["ingredients"]:
            if ing not in canonical_ingredient_ids:
                orphan_refs.append({"recipe": r["id"], "missingIngredient": ing})

    # --- existing-53 vs production cross-reference ---
    catalog_ids = {r["id"] for r in all_recipes}
    cross_ref = []
    for r in all_recipes:
        in_prod = r["id"] in prod_recipe_ids
        status = r["verificationStatus"]
        if status == "rejected_duplicate":
            disposition = "rejected_duplicate"
        elif in_prod:
            disposition = "existing_in_production"
        elif status == "deferred":
            disposition = "deferred_candidate"
        else:
            disposition = "new_candidate_not_yet_shipped"
        cross_ref.append({
            "id": r["id"],
            "verificationStatus": status,
            "currentGameRecipe": r.get("currentGameRecipe", False),
            "inProductionRecipesTs": in_prod,
            "disposition": disposition,
        })
    prod_ids_not_in_catalog = sorted(set(prod_recipe_ids) - catalog_ids)

    prod_ingredients_not_in_catalog = sorted(set(prod_ingredient_ids) - canonical_ingredient_ids)
    catalog_ingredients_not_in_prod = sorted(
        i["id"] for i in ingredient_catalog["ingredients"] if not i["existingInGame"]
    )

    # --- recipeReach within the 51-viable population (mechanic-agnostic) ---
    reach = {i: 0 for i in canonical_ingredient_ids}
    recipe_by_id = {r["id"]: r for r in viable_recipes}
    for r in viable_recipes:
        for ing in r["ingredients"]:
            if ing in reach:
                reach[ing] += 1

    ingredient_meta = {i["id"]: i for i in ingredient_catalog["ingredients"]}

    def recipe_mechanic_gate(r):
        """Non-baseline mechanics this recipe needs beyond spread/scatter."""
        return sorted(set(r.get("mechanics", [])) - BASELINE_MECHANICS)

    def recipe_ingredient_complete(r, owned):
        return set(r["ingredients"]).issubset(owned)

    mechanic_gated_recipe_ids = {r["id"] for r in viable_recipes if recipe_mechanic_gate(r)}
    baseline_recipe_ids = {r["id"] for r in viable_recipes if not recipe_mechanic_gate(r)}

    def marginal_unlock_for_state(owned, discovered, restrict_baseline_only):
        """For every not-yet-owned canonical ingredient, count how many
        currently-not-craftable recipes would become ingredient-complete if
        that single ingredient were added to `owned`. Recipes already
        discovered are excluded from the count (already unlocked)."""
        pool = viable_recipes
        if restrict_baseline_only:
            pool = [r for r in pool if r["id"] in baseline_recipe_ids]
        not_yet_craftable = [
            r for r in pool
            if r["id"] not in discovered and not recipe_ingredient_complete(r, owned)
        ]
        results = {}
        for ing in sorted(canonical_ingredient_ids - owned):
            hypothetical = owned | {ing}
            unlocked = [r["id"] for r in not_yet_craftable if recipe_ingredient_complete(r, hypothetical)]
            results[ing] = unlocked
        return results

    # --- Snapshot: marginal unlock table at the Progression 2.0 initial state ---
    initial_owned = set(INITIAL_OWNED)
    initial_craftable = [
        r["id"] for r in viable_recipes if recipe_ingredient_complete(r, initial_owned)
    ]
    initial_marginal_all = marginal_unlock_for_state(initial_owned, set(), restrict_baseline_only=False)
    initial_marginal_baseline = marginal_unlock_for_state(initial_owned, set(), restrict_baseline_only=True)

    initial_marginal_table = sorted(
        (
            {
                "ingredient": ing,
                "marginalUnlockCount": len(unlocked),
                "marginalUnlockCountBaselineMechanicOnly": len(initial_marginal_baseline.get(ing, [])),
                "unlockedRecipes": unlocked,
                "recipeReach": reach.get(ing, 0),
                "existingInGame": ingredient_meta.get(ing, {}).get("existingInGame", False),
            }
            for ing, unlocked in initial_marginal_all.items()
        ),
        key=lambda row: (-row["marginalUnlockCount"], row["ingredient"]),
    )

    # --- Greedy deadlock simulation ---
    owned = set(INITIAL_OWNED)
    discovered = set()
    steps = []
    deadlocks = []
    full_ingredient_set = set(canonical_ingredient_ids)
    step_no = 0
    guard = 0
    while True:
        guard += 1
        if guard > 500:
            deadlocks.append({"type": "guard_tripped", "note": "simulation exceeded 500 steps"})
            break

        # Discovery pass: everything currently ingredient-complete AND
        # mechanic-available (baseline only, since Phase 0 ships no new
        # mechanic) gets discovered now.
        newly_discovered = [
            r["id"] for r in viable_recipes
            if r["id"] not in discovered
            and r["id"] in baseline_recipe_ids
            and recipe_ingredient_complete(r, owned)
        ]
        discovered |= set(newly_discovered)

        mechanic_gated_but_ingredient_ready = [
            r["id"] for r in viable_recipes
            if r["id"] in mechanic_gated_recipe_ids
            and r["id"] not in discovered
            and recipe_ingredient_complete(r, owned)
        ]

        still_blocked = [
            r["id"] for r in viable_recipes
            if r["id"] not in discovered and r["id"] not in mechanic_gated_but_ingredient_ready
        ]

        if owned == full_ingredient_set:
            steps.append({
                "step": step_no,
                "ownedCount": len(owned),
                "newlyDiscoveredThisStep": newly_discovered,
                "mechanicGatedIngredientReady": mechanic_gated_but_ingredient_ready,
                "stillBlockedRecipeCount": len(still_blocked),
                "nextIngredientPurchased": None,
                "note": "full canonical ingredient set owned; simulation complete",
            })
            break

        marginal = marginal_unlock_for_state(owned, discovered, restrict_baseline_only=True)
        marginal_full = marginal_unlock_for_state(owned, discovered, restrict_baseline_only=False)
        best_ing = max(marginal, key=lambda k: (len(marginal[k]), -reach.get(k, 0) * 0), default=None)
        best_count = len(marginal[best_ing]) if best_ing else 0

        if best_count == 0 and not newly_discovered and not mechanic_gated_but_ingredient_ready:
            # Nothing craftable now, and the single best next ingredient
            # purchase unlocks nothing either -> true deadlock state.
            # Tie-break the ingredient choice by full-population marginal
            # unlock (including mechanic-gated recipes) so we don't stall on
            # a baseline-only tie when a mechanic-gated recipe would still
            # register forward progress once its mechanic ships.
            fallback_ing = max(marginal_full, key=lambda k: len(marginal_full[k]), default=None)
            fallback_count = len(marginal_full[fallback_ing]) if fallback_ing else 0
            if fallback_count == 0:
                deadlocks.append({
                    "type": "deadlock",
                    "step": step_no,
                    "ownedIngredients": sorted(owned),
                    "discoveredRecipes": sorted(discovered),
                    "remainingIngredients": sorted(full_ingredient_set - owned),
                    "remainingRecipes": sorted(still_blocked),
                })
                break
            best_ing = fallback_ing
            best_count = fallback_count

        steps.append({
            "step": step_no,
            "ownedCountBeforePurchase": len(owned),
            "newlyDiscoveredThisStep": newly_discovered,
            "mechanicGatedIngredientReady": mechanic_gated_but_ingredient_ready,
            "stillBlockedRecipeCount": len(still_blocked),
            "nextIngredientPurchased": best_ing,
            "marginalUnlockCount": best_count,
            "marginalUnlockedRecipes": marginal[best_ing] if best_ing else [],
        })

        if best_ing is None:
            deadlocks.append({
                "type": "no_ingredient_left_but_not_full",
                "step": step_no,
                "ownedIngredients": sorted(owned),
            })
            break

        owned.add(best_ing)
        step_no += 1

    unreachable_recipes = sorted(
        r["id"] for r in viable_recipes if r["id"] not in discovered
    )
    unreachable_baseline_recipes = sorted(
        rid for rid in unreachable_recipes if rid in baseline_recipe_ids
    )
    unreachable_mechanic_gated_recipes = sorted(
        rid for rid in unreachable_recipes if rid in mechanic_gated_recipe_ids
    )
    unreachable_ingredients = sorted(full_ingredient_set - owned)

    result = {
        "generatedBy": "tools/progression2_phase0_analysis.py",
        "population": {
            "totalCatalogEntries": len(all_recipes),
            "viableEntries": len(viable_recipes),
            "rejectedDuplicateEntries": len(rejected_recipes),
            "canonicalIngredientCount": len(canonical_ingredient_ids),
        },
        "orphanIngredientReferences": orphan_refs,
        "crossReferenceExisting53VsProduction": {
            "productionRecipeCount": len(prod_recipe_ids),
            "productionRecipeIds": prod_recipe_ids,
            "productionRecipeIdsNotInCatalog": prod_ids_not_in_catalog,
            "productionIngredientCount": len(prod_ingredient_ids),
            "productionIngredientIdsNotInCatalog": prod_ingredients_not_in_catalog,
            "catalogIngredientsNotYetInProduction": catalog_ingredients_not_in_prod,
            "perRecipeDisposition": cross_ref,
        },
        "ingredientRecipeReach": sorted(
            (
                {"ingredient": ing, "recipeReach": count, "existingInGame": ingredient_meta.get(ing, {}).get("existingInGame", False)}
                for ing, count in reach.items()
            ),
            key=lambda row: (-row["recipeReach"], row["ingredient"]),
        ),
        "initialState": {
            "ownedIngredients": sorted(initial_owned),
            "discoveredRecipeCount": 0,
            "immediatelyCraftableRecipes": initial_craftable,
            "marginalUnlockTable": initial_marginal_table,
        },
        "deadlockSimulation": {
            "mechanicGatedRecipeIds": sorted(mechanic_gated_recipe_ids),
            "baselineOnlyRecipeIds": sorted(baseline_recipe_ids),
            "steps": steps,
            "deadlockStateCount": len(deadlocks),
            "deadlocks": deadlocks,
            "finalOwnedIngredientCount": len(owned),
            "finalDiscoveredRecipeCount": len(discovered),
            "unreachableRecipeCount": len(unreachable_recipes),
            "unreachableRecipeIds": unreachable_recipes,
            "unreachableBaselineRecipeIds": unreachable_baseline_recipes,
            "unreachableMechanicGatedRecipeIds": unreachable_mechanic_gated_recipes,
            "unreachableIngredientCount": len(unreachable_ingredients),
            "unreachableIngredientIds": unreachable_ingredients,
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(f"Viable population: {len(viable_recipes)} recipes, {len(canonical_ingredient_ids)} canonical ingredients")
    print(f"Orphan ingredient references: {len(orphan_refs)}")
    print(f"Initial (3-ingredient) immediately-craftable recipes: {initial_craftable}")
    print(f"Deadlock state count: {len(deadlocks)}")
    print(f"Final discovered (baseline-mechanic-reachable): {len(discovered)} / {len(viable_recipes)} viable recipes")
    print(f"Unreachable (baseline-mechanic) recipe count: {len(unreachable_baseline_recipes)}")
    print(f"Mechanic-gated (deferred to a future mechanic build) recipe count: {len(mechanic_gated_recipe_ids)}")
    print(f"Unreachable ingredient count: {len(unreachable_ingredients)}")
    if orphan_refs or unreachable_baseline_recipes or deadlocks:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
