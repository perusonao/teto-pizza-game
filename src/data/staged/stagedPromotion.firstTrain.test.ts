import { describe, expect, it } from "vitest";
import { INGREDIENTS, getIngredient } from "../ingredients";
import { ingredientAttributeFamily } from "../ingredientTaxonomy";
import { LATE_DISCOVERY_TARGET_IDS, LATE_LADDER_STEPS, LATE_RECIPES } from "../lateCatalog";
import { RECIPE_HINT_ROLES } from "../recipeHintRoles";
import { RECIPES } from "../recipes";
import { toppingSizeClass } from "../toppingSizeClass";
import {
  CANDIDATE_DISCOVERY_TARGET_IDS,
  CANDIDATE_HINT_ROLES,
  CANDIDATE_INGREDIENTS,
  CANDIDATE_LADDER_STEPS,
  CANDIDATE_RECIPES,
  CANDIDATE_TAXONOMY_ROWS,
  CANDIDATE_TOPPING_SIZE_CLASS,
} from "./stagedPromotionCandidates";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

/**
 * First-train dossier, AFTER the promotion (Issue #780, Owner D-7 2026-11-08; shipped by Expansion Batch 21 with the Owner approvals Q-1 / Q-2 / Q-3):
 * `stagedPromotionCandidates.ts` stays as the approved source values, and this file is the FIDELITY test: the production late catalog carries the
 * two recipes and six materials exactly as the candidates declare them, except the explicitly pinned deviations awaiting Owner confirmation
 * (see `lateCatalog.ts`), and they are no longer staged (no double registration). The old mock-based dossier (validateLateCatalog, duplicate gate,
 * Research, Hint 5.0, save safety on "shipped + these two") moved to the real checks of `expansionBatch21.test.ts` and the late-catalog tests.
 */
const NEW_IDS = CANDIDATE_RECIPES.map((r) => r.id);
const NEW_ING = CANDIDATE_INGREDIENTS.map((i) => i.id);

describe("First train after promotion: the production late catalog equals stagedPromotionCandidates.ts", () => {
  it("the two recipes are shipped in the late catalog exactly as the candidates declare them", () => {
    expect(NEW_IDS).toEqual(["taco-pizza", "okonomiyaki-style-pizza"]);
    for (const c of CANDIDATE_RECIPES) {
      const shipped = LATE_RECIPES.find((r) => r.id === c.id);
      expect(shipped, c.id).toBeDefined();
      expect(JSON.parse(JSON.stringify(shipped)), c.id).toEqual(JSON.parse(JSON.stringify(c)));
      expect(RECIPES.some((r) => r.id === c.id), c.id).toBe(true);
    }
  });

  it("the six materials are shipped with the candidates' id / category / nameJa / color / placement / unlock, except the two PINNED emoji deviations (lettuce, cabbage: Owner confirmation pending; G18 / H5-INV-2)", () => {
    expect(NEW_ING).toEqual(["cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes"]);
    const deviations: Record<string, { candidate: string; shipped: string }> = {
      lettuce: { candidate: "\u{1FAB4}", shipped: "\u{1F34F}" },
      cabbage: { candidate: "\u{1F96C}", shipped: "\u{1FAB7}" },
    };
    for (const c of CANDIDATE_INGREDIENTS) {
      const shipped = getIngredient(c.id)!;
      expect(shipped, c.id).toBeDefined();
      const { emoji, ...rest } = c;
      expect(shipped, c.id).toMatchObject(rest);
      const deviation = deviations[c.id];
      if (deviation) {
        expect(emoji, c.id).toBe(deviation.candidate);
        expect(shipped.emoji, c.id).toBe(deviation.shipped);
      } else {
        expect(shipped.emoji, c.id).toBe(emoji);
      }
      expect(INGREDIENTS.filter((i) => i.emoji === shipped.emoji).map((i) => i.id), `${c.id} text fallback unique (G18)`).toEqual([c.id]);
    }
  });

  it("the late ladder steps, key-free Hint roles, discovery target ids, families and size classes are shipped as declared, except the PINNED tortilla-chips family deviation (`vegetable`, not `other`: OD-DH4-2-9; Owner confirmation pending)", () => {
    expect(LATE_LADDER_STEPS.slice(-CANDIDATE_LADDER_STEPS.length - 6, -6)).toEqual(CANDIDATE_LADDER_STEPS); // Expansion Batch 22 (#780) appended four late steps after these two; Expansion Batch 23-b (#780) two more
    for (const id of NEW_IDS) {
      expect(RECIPE_HINT_ROLES[id as never], id).toEqual(CANDIDATE_HINT_ROLES[id as keyof typeof CANDIDATE_HINT_ROLES]);
      expect(LATE_DISCOVERY_TARGET_IDS[id], id).toBe(CANDIDATE_DISCOVERY_TARGET_IDS[id as keyof typeof CANDIDATE_DISCOVERY_TARGET_IDS]);
    }
    for (const [id, family] of CANDIDATE_TAXONOMY_ROWS) {
      if (id === "tortilla-chips") {
        expect(family).toBe("other");
        expect(ingredientAttributeFamily(id)).toBe("vegetable");
      } else {
        expect(ingredientAttributeFamily(id), id).toBe(family);
      }
    }
    for (const [id, size] of Object.entries(CANDIDATE_TOPPING_SIZE_CLASS)) expect(toppingSizeClass(id as never), id).toBe(size);
  });

  it("promoted means no longer staged: neither recipe nor material is registered in the Staged Catalog any more (no double registration)", () => {
    expect(STAGED_RECIPES.filter((r) => NEW_IDS.includes(r.id)).map((r) => r.id)).toEqual([]);
    expect(STAGED_INGREDIENTS.filter((i) => NEW_ING.includes(i.id)).map((i) => i.id)).toEqual([]);
  });
});
