/**
 * Issue #687 (DH4 attacker speed-up): the guard's hot helpers were rewritten as pure-function optimisations. These tests pin what the gates do not:
 * the ORDER of H (catalog order, the gates are order-insensitive), the key-step table against the original computation, and the validated-owned
 * entry point against the public one. No guard result is stored anywhere; the tests only compare two ways of computing the same thing.
 */
import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { recipeKeyStep } from "../../state/recipeChapters";
import { attributeAnswerForCleanOwned, attributeAnswerForReserve, ownedCatalogIds } from "./deductionHint";
import { hypotheticalReserves, type ReserveParts } from "./deductionGuard";

const CATALOG = INGREDIENTS.map((i) => i.id);
const starters = [...STARTER_INGREDIENT_IDS];
const orderIndex = new Map(CATALOG.map((id, i) => [id, i]));

function partsOf(recipe: Recipe, owned: string[], reserveIndex = 0): ReserveParts {
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  return { recipeIngredientIds: ids, reserveId: ids[reserveIndex % ids.length], keyId: ids[ids.length - 1], owned };
}

describe("H keeps catalog order and ignores ids the catalog does not know", () => {
  it("is in INGREDIENTS order for every recipe, whatever the acquisition order", () => {
    const shuffled = [...starters, ...CATALOG.filter((id) => !starters.includes(id)).reverse()];
    for (const recipe of RECIPES) {
      const h = hypotheticalReserves(partsOf(recipe, shuffled));
      const indices = h.map((id) => orderIndex.get(id)!);
      expect(indices, recipe.id).toEqual([...indices].sort((a, b) => a - b));
      expect(new Set(h).size, recipe.id).toBe(h.length);
    }
  });

  it("an owned list with unknown ids, empty strings and duplicates gives the same H as the clean list", () => {
    const clean = [...starters, ...CATALOG.filter((id) => !starters.includes(id))];
    const dirty = [...starters, "zz-unknown", ...CATALOG.filter((id) => !starters.includes(id)), CATALOG[3], "", "zz-unknown"];
    for (const recipe of RECIPES) {
      expect(hypotheticalReserves(partsOf(recipe, dirty)), recipe.id).toEqual(hypotheticalReserves(partsOf(recipe, clean)));
    }
  });
});

describe("key step of one ingredient", () => {
  it("H's key-step filter equals the original per-ingredient computation (a recipe holding only that ingredient)", () => {
    // H filters on `ingredientKeyStep(id) <= keyStep`; recompute that filter with recipeKeyStep and compare the sets.
    const owned = [...starters, ...CATALOG.filter((id) => !starters.includes(id))];
    for (const recipe of RECIPES) {
      const parts = partsOf(recipe, owned);
      const known = new Set(parts.recipeIngredientIds.filter((id) => id !== parts.reserveId));
      const keyStep = recipeKeyStep({ requiredIngredients: [{ ingredientId: parts.keyId! }] } as unknown as Recipe);
      for (const id of hypotheticalReserves(parts)) {
        expect(known.has(id), recipe.id).toBe(false);
        expect(recipeKeyStep({ requiredIngredients: [{ ingredientId: id }] } as unknown as Recipe), `${recipe.id}/${id}`).toBeLessThanOrEqual(keyStep);
      }
    }
  });
});

describe("attributeAnswerForCleanOwned", () => {
  it("equals attributeAnswerForReserve on the same (already validated) owned list", () => {
    const owned = ownedCatalogIds([...starters, "zz-unknown", ...CATALOG, CATALOG[2]]);
    for (const recipe of RECIPES) {
      const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
      for (const reserveId of ids) {
        const input = { recipeIngredientIds: ids, reserveId, ownedIngredientIds: owned };
        expect(attributeAnswerForCleanOwned(input), `${recipe.id}/${reserveId}`).toEqual(attributeAnswerForReserve(input));
      }
    }
  });
});
