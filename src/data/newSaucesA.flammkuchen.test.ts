import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { isInactiveLateRecipeId } from "./lateCatalog";
import { RECIPES } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { materialOffer } from "../logic/materialShop";
import { buildRecipeChapters, chapterProgress, recipeChapter } from "../state/recipeChapters";
import { discoveredRecipeIds, isDiscovered, type DexEntry, type DexState } from "../state/dex";

/**
 * New Sauces Phase A (Issue #578, Owner approval 2026-10-23): flammkuchen + fromage-blanc-sauce, the first of the four new sauces. These tests pin what is specific to this slice;
 * the catalog-wide tables (ledger, goldens, validator manifest, ladder rule) are updated in their own tests. Everything about counts, bake window, CUT and the colour is PROVISIONAL
 * (docs/reports/TETO_NEW-SAUCES-A_Result.md); the tests pin the structure that must hold whichever values the Owner finally chooses.
 */
const recipe = RECIPES.find((r) => r.id === "flammkuchen")!;

describe("fromage-blanc-sauce (the new sauce)", () => {
  const ingredient = getIngredient("fromage-blanc-sauce")!;

  it("is a spread sauce unlocked by the Ladder alone, with no per-ingredient price", () => {
    expect(ingredient.category).toBe("sauce");
    expect(ingredient.placement).toBe("spread");
    expect(ingredient.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ingredient.pricePitz).toBeUndefined();
    expect(ingredient.restockQuantity).toBeUndefined();
    expect(ingredient.starterGrantOnly).toBeUndefined();
    expect(ingredient.pieceVisual).toBeUndefined();
  });

  it("carries no topping family (the taxonomy is topping-only)", () => {
    expect(ingredientAttributeFamily("fromage-blanc-sauce")).toBeNull();
  });

  it("is sold by the T4 tier rule: step 55, pack 10 uses (k = 1) for 120 Pitz, refill 60", () => {
    expect(materialOffer(ingredient)).toEqual({
      ingredientId: "fromage-blanc-sauce",
      step: 55,
      tier: "T4",
      k: 1,
      packQuantity: 10,
      packPrice: 120,
      refillPrice: 60,
    });
  });

  it("is a near-white (provisional) that stays clearly apart from the olive-oil swatch the oil filter exists for", () => {
    expect(ingredient.color).toBe("#fffdf8");
    expect(ingredient.color).not.toBe(getIngredient("olive-oil")!.color);
  });
});

describe("flammkuchen (the key recipe)", () => {
  it("is bacon / onion / fromage-blanc-sauce (the 172 matrix set), the sauce first", () => {
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toEqual(["fromage-blanc-sauce", "onion", "bacon"]);
    expect(recipe.requiredIngredients[0].minCount).toBe(1);
  });

  it("is painted with the existing PAINT gesture and has a Reference whose sauce is the shared mechanical target", () => {
    expect(getRecipeSauceProfile("flammkuchen")).toEqual({ recipeId: "flammkuchen", ingredientId: "fromage-blanc-sauce", interaction: "PAINT" });
    const ref = getReferencePizza("flammkuchen")!;
    expect(ref.sauce?.ingredientId).toBe("fromage-blanc-sauce");
    const pieces = ref.pieceGroups.reduce((n, g) => n + g.positions.length, 0);
    expect(pieces).toBe(recipe.requiredIngredients.filter((q) => q.ingredientId !== "fromage-blanc-sauce").reduce((n, q) => n + q.minCount, 0));
    expect(pieces).toBeLessThanOrEqual(8);
  });

  it("has no CUT (provisional), is not in the Lunch Rush pool and is not a late (post-bake) recipe", () => {
    expect(isCutEligible("flammkuchen")).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(isInactiveLateRecipeId("flammkuchen")).toBe(false);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
  });

  it("keeps the generic bake window, so the median-derived Free Cooking target does not move", () => {
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
  });

  it("is the only recipe made from exactly this ingredient set (discovery stays unambiguous)", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = key(recipe.requiredIngredients.map((q) => q.ingredientId));
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === mine).map((r) => r.id)).toEqual(["flammkuchen"]);
  });

  it("is unlocked by an ordinary appended ladder step 55 with no star gate (append-only: steps 1-54 untouched)", () => {
    const step = DISCOVERY_LADDER.steps[54];
    expect(step).toEqual({ step: 55, kind: "MATERIAL", ingredientIds: ["fromage-blanc-sauce"], keyRecipeId: "flammkuchen" });
    expect(step.starGates).toBeUndefined();
    expect(DISCOVERY_LADDER.steps.length).toBeGreaterThanOrEqual(55); // later batches only append (Phase B-1: step 56)
  });
});

/**
 * Chapter 4 and existing saves. A chapter has no persisted "cleared" flag or reward: its progress is `discovered / total`, derived on every read from the Dex and the chapter table
 * (state/recipeChapters.ts). Adding flammkuchen therefore grew chapter 4 from 26 to 27 recipes (Phase B-1 later appended a 28th), and the Dex entries of a player who had discovered all 26 are untouched; only the
 * derived progress reads 26/27 until flammkuchen is made. These tests pin that, so a later change that persisted a clear flag would have to face this case.
 */
describe("chapter 4 for a save that had discovered all 26 earlier chapter-4 recipes", () => {
  // Phase A's view of chapter 4: its first 27 recipes (flammkuchen the 27th). Later batches only append after them, so this pins the Phase A contract without depending on the tail.
  const fullChapter4 = () => buildRecipeChapters().find((c) => c.chapter === 4)!;
  const chapter4 = () => ({ ...fullChapter4(), recipes: fullChapter4().recipes.slice(0, 27) });
  const entry = (recipeId: string): DexEntry => ({ recipeId, discovered: true, bestScore: 90, bestStars: 3, timesMade: 1 });
  const earlier = () => chapter4().recipes.filter((r) => r.id !== "flammkuchen").map((r) => r.id);

  it("flammkuchen joins chapter 4 (key step 55 is T4); the chapter grows by appending", () => {
    expect(recipeChapter(recipe)).toBe(4);
    expect(chapter4().recipes[26]!.id).toBe("flammkuchen"); // the 27th chapter-4 recipe; later batches only append after it
    expect(chapter4().recipes.findIndex((r) => r.id === "flammkuchen")).toBe(26);
  });

  it("keeps every earlier discovery: the Dex is not rewritten, only the derived progress reads 26/27", () => {
    const dex: DexState = earlier().map(entry);
    expect(discoveredRecipeIds(dex)).toEqual(earlier());
    expect(chapterProgress(chapter4(), dex)).toEqual({ discovered: 26, total: 27 });
    expect(isDiscovered(dex, "flammkuchen")).toBe(false);
  });

  it("reads 27/27 once flammkuchen is made, and the other chapters are untouched", () => {
    const dex: DexState = [...earlier(), "flammkuchen"].map(entry);
    expect(chapterProgress(chapter4(), dex)).toEqual({ discovered: 27, total: 27 });
    for (const c of buildRecipeChapters().filter((x) => x.chapter !== 4)) {
      expect(chapterProgress(c, dex).discovered).toBe(0);
    }
  });
});
