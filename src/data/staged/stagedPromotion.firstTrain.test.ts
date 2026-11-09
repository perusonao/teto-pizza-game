import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../ingredients";
import { LATE_DISCOVERY_TARGET_IDS, LATE_INGREDIENTS, LATE_LADDER_STEPS, LATE_RECIPES } from "../lateCatalog";
import { RECIPE_HINT_ROLES } from "../recipeHintRoles";
import { RECIPES } from "../recipes";
import { toppingSizeClass } from "../toppingSizeClass";
import { ingredientAttributeFamily } from "../ingredientTaxonomy";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import {
  CANDIDATE_DISCOVERY_TARGET_IDS,
  CANDIDATE_HINT_ROLES,
  CANDIDATE_INGREDIENTS,
  CANDIDATE_LADDER_STEPS,
  CANDIDATE_RECIPES,
  CANDIDATE_TAXONOMY_ROWS,
  CANDIDATE_TOPPING_SIZE_CLASS,
} from "./stagedPromotionCandidates";

/**
 * First-train promotion fidelity (Issue #780; Owner D-7 2026-11-08 -> promoted by Expansion Batch 21, Owner approval 2026-11-09). Before Batch 21 this file measured the dossier
 * (stagedPromotionCandidates.ts) against "shipped + these two" with module mocks. The two recipes and their six ingredients are now SHIPPED, so the same dossier is pinned to the
 * shipped data instead: the promotion must equal what the Owner approved (Q-3), except the documented text-fallback deviation. The Research letter audit (Q-2) lives in
 * lateCatalog.b21.test.ts; the canonical-order 0-change invariant and the Hint / save checks run on the real catalog there and in the batch tests.
 */
describe("First train promotion fidelity: taco-pizza + okonomiyaki-style-pizza", () => {
  it("both recipes are shipped (in the late catalog) and no longer staged; their six ingredients likewise", () => {
    for (const r of CANDIDATE_RECIPES) {
      expect(LATE_RECIPES.some((x) => x.id === r.id)).toBe(true);
      expect(STAGED_RECIPES.some((x) => x.id === r.id)).toBe(false);
    }
    for (const i of CANDIDATE_INGREDIENTS) {
      expect(LATE_INGREDIENTS.some((x) => x.id === i.id)).toBe(true);
      expect(STAGED_INGREDIENTS.some((x) => x.id === i.id)).toBe(false);
    }
  });

  it("the shipped recipes equal the approved dossier (name, description, requirements, bake, reward, Lunch Rush)", () => {
    for (const c of CANDIDATE_RECIPES) expect(RECIPES.find((r) => r.id === c.id)).toMatchObject(c as never);
  });

  it("the shipped ingredients equal the approved dossier (category, name, colour, placement, unlock); the text fallback differs only for lettuce and cabbage", () => {
    const deviation: Record<string, string> = { lettuce: "\u{1F959}", cabbage: "\u{1F958}" };
    for (const c of CANDIDATE_INGREDIENTS) {
      const shipped = INGREDIENTS.find((i) => i.id === c.id)!;
      expect(shipped).toMatchObject({ id: c.id, category: c.category, nameJa: c.nameJa, color: c.color, placement: c.placement, unlockCondition: c.unlockCondition });
      expect(shipped.emoji).toBe(deviation[c.id] ?? c.emoji);
      if (c.id in deviation) expect(c.emoji).toBe(deviation[c.id]); // the dossier records the deviation
    }
  });

  it("taxonomy rows, size classes, ladder steps, hint roles and discovery targets equal the dossier", () => {
    for (const [id, family] of CANDIDATE_TAXONOMY_ROWS) expect(ingredientAttributeFamily(id)).toBe(family);
    for (const [id, size] of Object.entries(CANDIDATE_TOPPING_SIZE_CLASS)) expect(toppingSizeClass(id)).toBe(size);
    expect(LATE_LADDER_STEPS.slice(-CANDIDATE_LADDER_STEPS.length)).toEqual(CANDIDATE_LADDER_STEPS.map((s) => ({ ingredientIds: [...s.ingredientIds], keyRecipeId: s.keyRecipeId })));
    for (const [id, roles] of Object.entries(CANDIDATE_HINT_ROLES)) expect(RECIPE_HINT_ROLES[id as keyof typeof RECIPE_HINT_ROLES]).toEqual(roles);
    for (const [id, target] of Object.entries(CANDIDATE_DISCOVERY_TARGET_IDS)) expect(LATE_DISCOVERY_TARGET_IDS[id]).toBe(target);
  });
});
