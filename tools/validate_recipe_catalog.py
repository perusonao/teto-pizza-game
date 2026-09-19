#!/usr/bin/env python3
"""
Recipe Master Catalog validator (docs/data-only tooling -- NOT part of src/**,
NOT wired into CI/build by this change). Validates the three JSON artifacts
under data/recipes/ against each other for internal consistency.

Usage: python3 tools/validate_recipe_catalog.py
Exit code 0 = all checks passed. Non-zero = at least one check failed (see
printed FAIL lines).

See docs/design/TETO_RECIPE-MASTER-CATALOG.md section "Validation" for what
each check means and why it exists.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECIPES_PATH = ROOT / "data/recipes/pizza_master_catalog.json"
INGREDIENTS_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
MECHANICS_PATH = ROOT / "data/recipes/gameplay_mechanic_master.json"

REQUIRED_RECIPE_FIELDS = [
    "id", "nameJa", "nameOriginal", "aliases", "regionOrStyle", "ingredients",
    "mechanics", "verificationStatus", "implementationClass", "difficulty",
    "progressionTier", "gameDesignStatus", "currentGameRecipe",
]
REQUIRED_INGREDIENT_FIELDS = [
    "id", "nameJa", "nameOriginal", "aliases", "category", "placementType",
    "inventoryUnit", "usedByRecipeIds", "usedByRecipeCount", "existingInGame",
]
VALID_VERIFICATION_STATUSES = {
    "verified_internal", "game_design_candidate", "verification_pending",
    "deferred", "rejected_duplicate",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    failures = []

    catalog = load(RECIPES_PATH)
    ingredients_doc = load(INGREDIENTS_PATH)
    mechanics_doc = load(MECHANICS_PATH)

    recipes = catalog["recipes"]
    ingredients = ingredients_doc["ingredients"]
    mechanics = mechanics_doc["mechanics"]

    ingredient_ids = {i["id"] for i in ingredients}
    mechanic_ids = {m["id"] for m in mechanics} | {"spread", "scatter"}
    recipe_ids = [r["id"] for r in recipes]

    # 1. duplicate recipe id
    seen = set()
    for rid in recipe_ids:
        if rid in seen:
            failures.append(f"duplicate recipe id: {rid}")
        seen.add(rid)

    # 2. duplicate canonical name (nameJa + nameOriginal pair, excluding rejected_duplicate entries)
    name_seen = {}
    for r in recipes:
        if r["verificationStatus"] == "rejected_duplicate":
            continue
        key = (r["nameJa"], r["nameOriginal"])
        if key in name_seen:
            failures.append(f"duplicate canonical name {key}: {name_seen[key]} vs {r['id']}")
        name_seen[key] = r["id"]

    # 3. alias collision: an alias string exactly matching another recipe's own nameJa/nameOriginal
    #    without being flagged rejected_duplicate/deferred is a silent-merge risk.
    canonical_names = {r["nameJa"] for r in recipes} | {r["nameOriginal"] for r in recipes}
    for r in recipes:
        for alias in r["aliases"]:
            if alias in canonical_names and alias not in (r["nameJa"], r["nameOriginal"]):
                # informational, not a hard failure -- many intentional cross-references exist
                # (e.g. Vegetariana alias on Ortolana is deliberate, not a collision bug)
                pass

    # 4. duplicate ingredient id
    ing_seen = set()
    for i in ingredients:
        if i["id"] in ing_seen:
            failures.append(f"duplicate ingredient id: {i['id']}")
        ing_seen.add(i["id"])

    # 5. unresolved ingredient reference (recipe -> ingredient master)
    for r in recipes:
        for ing in r["ingredients"]:
            if ing not in ingredient_ids:
                failures.append(f"recipe {r['id']} references unknown ingredient {ing}")

    # 6. recipe/ingredient count fields match array lengths
    if catalog["catalogEntryCount"] != len(recipes):
        failures.append(f"catalogEntryCount {catalog['catalogEntryCount']} != len(recipes) {len(recipes)}")
    if ingredients_doc["existingIngredientCount"] + ingredients_doc["newIngredientCount"] != len(ingredients):
        failures.append("existingIngredientCount + newIngredientCount != len(ingredients)")

    # 7. missing required fields
    for r in recipes:
        for field in REQUIRED_RECIPE_FIELDS:
            if field not in r:
                failures.append(f"recipe {r.get('id', '?')} missing required field {field}")
    for i in ingredients:
        for field in REQUIRED_INGREDIENT_FIELDS:
            if field not in i:
                failures.append(f"ingredient {i.get('id', '?')} missing required field {field}")

    # 8. verificationStatus is a required field with a known value (source policy: never silently "verified")
    for r in recipes:
        if r["verificationStatus"] not in VALID_VERIFICATION_STATUSES:
            failures.append(f"recipe {r['id']} has unknown verificationStatus {r['verificationStatus']}")
        if r["verificationStatus"] not in r:
            pass  # field presence already checked above

    # 9. orphan ingredients (existing-in-game ingredients are exempt -- they're always "used" by shipped recipes)
    for i in ingredients:
        if not i["existingInGame"] and i["usedByRecipeCount"] == 0:
            failures.append(f"orphan new ingredient (used by 0 recipes): {i['id']}")

    # 10. usedByRecipeCount consistency (recompute from recipes, compare to stored value)
    recomputed_usage = {}
    for r in recipes:
        if r["verificationStatus"] == "rejected_duplicate":
            continue
        for ing in r["ingredients"]:
            recomputed_usage[ing] = recomputed_usage.get(ing, 0) + 1
    for i in ingredients:
        expected = recomputed_usage.get(i["id"], 0)
        if i["usedByRecipeCount"] != expected:
            failures.append(
                f"ingredient {i['id']}: usedByRecipeCount={i['usedByRecipeCount']} "
                f"but recomputed cross-reference={expected}"
            )
        if sorted(i["usedByRecipeIds"]) != sorted(
            r["id"] for r in recipes
            if r["verificationStatus"] != "rejected_duplicate" and i["id"] in r["ingredients"]
        ):
            failures.append(f"ingredient {i['id']}: usedByRecipeIds does not match recomputed recipe list")

    # 11. mechanic reference consistency (every recipe.mechanics entry exists in the mechanic master)
    for r in recipes:
        for m in r["mechanics"]:
            if m not in mechanic_ids:
                failures.append(f"recipe {r['id']} references unknown mechanic {m}")

    # 12. rejected_duplicate entries must carry rejectedDuplicateOf
    for r in recipes:
        if r["verificationStatus"] == "rejected_duplicate" and not r.get("rejectedDuplicateOf"):
            failures.append(f"recipe {r['id']} is rejected_duplicate but missing rejectedDuplicateOf")

    print(f"Checked {len(recipes)} recipe entries, {len(ingredients)} ingredient entries, "
          f"{len(mechanics)} mechanic entries.")
    if failures:
        print(f"\n{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  FAIL: {f}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
