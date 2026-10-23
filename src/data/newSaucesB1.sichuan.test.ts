import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { isInactiveLateRecipeId } from "./lateCatalog";
import { RECIPES } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { TOPPING_SIZE_CLASS_BY_ID } from "./toppingSizeClass";
import { materialOffer } from "../logic/materialShop";
import { buildRecipeChapters, chapterProgress, recipeChapter } from "../state/recipeChapters";
import { discoveredRecipeIds, isDiscovered, type DexEntry, type DexState } from "../state/dex";

/**
 * New Sauces Phase B-1 (Issue #578, Owner GO 2026-10-23): sichuan-eggplant-pizza + doubanjiang + green-onion. These tests pin what is specific to this slice; the catalog-wide tables (ledger,
 * goldens, validator manifest, ladder rule) are updated in their own tests. The original PIZZA DB page was NOT confirmed: the green onion before the bake, the doubanjiang as a painted sauce and
 * the eggplant not pre-cooked are PROVISIONAL assumptions (Owner OD-B9-17), as are the counts, the bake window, CUT and the colour. The tests pin the structure that must hold whichever values
 * the Owner finally chooses (docs/reports/TETO_NEW-SAUCES-B1_Result.md).
 */
const ID = "sichuan-eggplant-pizza";
const recipe = RECIPES.find((r) => r.id === ID)!;
const stepIndex = DISCOVERY_LADDER.steps.findIndex((s) => s.keyRecipeId === ID);

describe("doubanjiang (the new sauce)", () => {
  const ingredient = getIngredient("doubanjiang")!;

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
    expect(ingredientAttributeFamily("doubanjiang")).toBeNull();
  });

  it("is sold by the T4 tier rule: pack 10 uses (k = 1) for 120 Pitz, refill 60, at the same step as green-onion", () => {
    expect(materialOffer(ingredient)).toEqual({
      ingredientId: "doubanjiang",
      step: stepIndex + 1,
      tier: "T4",
      k: 1,
      packQuantity: 10,
      packPrice: 120,
      refillPrice: 60,
    });
  });

  it("is a dark red-brown (provisional) that stays clearly apart from tomato-sauce (the near-identical red is NOT used) and from the olive-oil swatch", () => {
    expect(ingredient.color).toBe("#8a2b1c");
    const tomato = getIngredient("tomato-sauce")!.color;
    expect(ingredient.color).not.toBe(tomato);
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
    expect(dist(ingredient.color, tomato)).toBeGreaterThan(60);
    expect(ingredient.color).not.toBe(getIngredient("olive-oil")!.color);
  });
});

describe("green-onion (the new topping)", () => {
  const ingredient = getIngredient("green-onion")!;

  it("is a scatter topping drawn by the dedicated green-onion-slices visual, unlocked by the Ladder alone", () => {
    expect(ingredient.category).toBe("topping");
    expect(ingredient.placement).toBe("scatter");
    expect(ingredient.pieceVisual).toBe("green-onion-slices");
    expect(ingredient.unlockCondition).toEqual({ minTotalStars: 0 });
    expect(ingredient.bakeRoastResistant).toBe(true);
  });

  it("is family herb (L1 only) and size class xs (Owner OD-B9-3)", () => {
    expect(ingredientAttributeFamily("green-onion")).toBe("herb");
    expect(TOPPING_SIZE_CLASS_BY_ID["green-onion"]).toBe("xs");
  });

  it("is sold by the T4 tier rule at the same step as doubanjiang: k = 2 -> a pack is 20 pieces for 120 Pitz, refill 60", () => {
    expect(materialOffer(ingredient)).toEqual({
      ingredientId: "green-onion",
      step: stepIndex + 1,
      tier: "T4",
      k: 2,
      packQuantity: 20,
      packPrice: 120,
      refillPrice: 60,
    });
  });
});

describe("sichuan-eggplant-pizza (the key recipe)", () => {
  it("is doubanjiang / eggplant / garlic / green-onion / mozzarella (the 172 matrix set), the sauce first", () => {
    expect(recipe.requiredIngredients.map((q) => q.ingredientId)).toEqual(["doubanjiang", "mozzarella", "eggplant", "garlic", "green-onion"]);
    expect(recipe.requiredIngredients[0].minCount).toBe(1);
  });

  it("is painted with the existing PAINT gesture and has a Reference whose sauce is the shared mechanical target", () => {
    expect(getRecipeSauceProfile(ID)).toEqual({ recipeId: ID, ingredientId: "doubanjiang", interaction: "PAINT" });
    const ref = getReferencePizza(ID)!;
    expect(ref.sauce?.ingredientId).toBe("doubanjiang");
    const pieces = ref.pieceGroups.reduce((n, g) => n + g.positions.length, 0);
    expect(pieces).toBe(recipe.requiredIngredients.filter((q) => q.ingredientId !== "doubanjiang").reduce((n, q) => n + q.minCount, 0));
    expect(pieces).toBeLessThanOrEqual(8);
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(recipe.requiredIngredients.find((q) => q.ingredientId === g.ingredientId)!.minCount);
  });

  it("fits the tray (5 ingredients <= the palette slots) and has every requirement placed BEFORE the bake (no late phase)", () => {
    expect(recipe.requiredIngredients.length).toBeLessThanOrEqual(6);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(isInactiveLateRecipeId(ID)).toBe(false);
  });

  it("has no CUT (provisional) and is not in the Lunch Rush pool", () => {
    expect(isCutEligible(ID)).toBe(false);
    expect(recipe.lunchRush).toBe(false);
  });

  it("keeps the generic bake window, so the median-derived Free Cooking target does not move", () => {
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
  });

  it("is the only recipe made from exactly this ingredient set, and no other recipe is a subset or superset of it", () => {
    const key = (ids: readonly string[]) => [...ids].sort().join("|");
    const mine = recipe.requiredIngredients.map((q) => q.ingredientId);
    expect(RECIPES.filter((r) => key(r.requiredIngredients.map((q) => q.ingredientId)) === key(mine)).map((r) => r.id)).toEqual([ID]);
    for (const r of RECIPES) {
      if (r.id === ID) continue;
      const theirs = r.requiredIngredients.map((q) => q.ingredientId);
      expect(theirs.every((i) => mine.includes(i)), `${r.id} is a subset`).toBe(false);
      expect(mine.every((i) => theirs.includes(i)), `${r.id} is a superset`).toBe(false);
    }
  });

  it("is unlocked by ONE ordinary appended ladder step carrying both new materials, with no star gate, and the step number is derived (append-only: the earlier steps are untouched)", () => {
    const step = DISCOVERY_LADDER.steps[stepIndex];
    expect(step).toEqual({ step: stepIndex + 1, kind: "MATERIAL", ingredientIds: ["doubanjiang", "green-onion"], keyRecipeId: ID });
    expect(step.starGates).toBeUndefined();
    expect(DISCOVERY_LADDER.steps.at(-1)).toBe(step);
    expect(DISCOVERY_LADDER.steps[stepIndex - 1].keyRecipeId).toBe("flammkuchen");
  });
});

/**
 * Chapter 4 and existing saves (the same contract as flammkuchen's test): a chapter has no persisted "cleared" flag or reward; its progress is `discovered / total`, derived on every read from the Dex
 * and the chapter table. Adding this recipe grows chapter 4 by one; the Dex entries of a player who had discovered every earlier chapter-4 recipe are untouched.
 */
describe("chapter 4 for a save that had discovered every earlier chapter-4 recipe", () => {
  const chapter4 = () => buildRecipeChapters().find((c) => c.chapter === 4)!;
  const entry = (recipeId: string): DexEntry => ({ recipeId, discovered: true, bestScore: 90, bestStars: 3, timesMade: 1 });
  const earlier = () => chapter4().recipes.filter((r) => r.id !== ID).map((r) => r.id);

  it("sichuan-eggplant-pizza joins chapter 4 (its key step is T4); the chapter grows by appending", () => {
    expect(recipeChapter(recipe)).toBe(4);
    expect(chapter4().recipes.at(-1)!.id).toBe(ID);
    expect(earlier().at(-1)).toBe("flammkuchen");
  });

  it("keeps every earlier discovery: the Dex is not rewritten, only the derived progress is one short", () => {
    const dex: DexState = earlier().map(entry);
    expect(discoveredRecipeIds(dex)).toEqual(earlier());
    expect(chapterProgress(chapter4(), dex)).toEqual({ discovered: earlier().length, total: earlier().length + 1 });
    expect(isDiscovered(dex, ID)).toBe(false);
  });

  it("is complete once the recipe is made, and the other chapters are untouched", () => {
    const dex: DexState = [...earlier(), ID].map(entry);
    expect(chapterProgress(chapter4(), dex)).toEqual({ discovered: earlier().length + 1, total: earlier().length + 1 });
    for (const c of buildRecipeChapters().filter((x) => x.chapter !== 4)) {
      expect(chapterProgress(c, dex).discovered).toBe(0);
    }
  });
});
