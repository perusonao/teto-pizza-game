import { describe, expect, it } from "vitest";
import { buildRecipeSections, recipeCardState } from "./pizzaSelect";
import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { QualityStars } from "../logic/scoring";

const margherita = getRecipe("margherita")!;
const funghi = getRecipe("funghi")!;
const bismarck = getRecipe("bismarck")!;
const quattroFormaggi = getRecipe("quattro-formaggi")!;
const fugazza = getRecipe("fugazza")!;

/** Builds a Dex where `recipeIds` are discovered at `stars` each -- a shorthand for
 *  simulating "played through the Chapter 1 chain up to here." */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

const CHAIN_TO_BISMARCK = ["margherita", "funghi", "marinara"];
const CHAIN_TO_FUGAZZA = [
  "margherita",
  "funghi",
  "marinara",
  "bismarck",
  "genovese",
  "quattro-formaggi",
];

describe("recipeCardState (Issue #39 Pizza Select, extended by Economy & Progression 1.0 EP1)", () => {
  it("margherita is NEW on a fresh save (always unlocked, empty Dex), but preDiscoveryLocked (Progression 2.0 Phase 3-3)", () => {
    const card = recipeCardState(margherita, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "NEW", recipe: margherita, preDiscoveryLocked: true });
  });

  it("is LOCKED (not mystery) when the recipe's own unlockCondition isn't yet satisfied (funghi, fresh save)", () => {
    const card = recipeCardState(funghi, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
    if (card.kind !== "LOCKED") return;
    expect(card.mystery).toBe(false);
  });

  it("is LOCKED when the recipe's required ingredients aren't all owned, even once its unlockCondition is satisfied (fugazza needs onion)", () => {
    const dex = dexDiscovering(CHAIN_TO_FUGAZZA, 5 as QualityStars);
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });

  it("is NEW when available but not yet discovered (bismarck, once its chain is discovered)", () => {
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    // EP4: `egg` (bismarck's own non-Starter ingredient) is no longer trivially owned -- own it
    // explicitly, as production's bismarck Starter Grant would have the instant this chain
    // unlocked.
    const card = recipeCardState(bismarck, dex, [...STARTER_INGREDIENT_IDS, "egg"]);
    expect(card).toEqual({ kind: "NEW", recipe: bismarck });
  });

  it("is COMPLETED with bestStars/bestScore once discovered", () => {
    const chained = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    const dex: DexState = registerScoreToDex(chained, "bismarck", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 91.5,
      stars: 5 as QualityStars,
    }).dex;
    const card = recipeCardState(bismarck, dex, [...STARTER_INGREDIENT_IDS, "egg"]);
    expect(card).toEqual({ kind: "COMPLETED", recipe: bismarck, bestStars: 5, bestScore: 91.5 });
  });

  it("becomes NEW instead of LOCKED once both the unlockCondition and onion ownership hold (fugazza)", () => {
    const dex = dexDiscovering(CHAIN_TO_FUGAZZA, 5 as QualityStars);
    // EP4: olive-oil/oregano are also no longer trivially owned -- own them explicitly (as
    // production's quattro-formaggi/marinara Starter Grant would have) so onion is the one
    // ingredient this test is isolating.
    const card = recipeCardState(fugazza, dex, [
      ...STARTER_INGREDIENT_IDS,
      "olive-oil",
      "oregano",
      "onion",
    ]);
    expect(card).toEqual({ kind: "NEW", recipe: fugazza });
  });

  it("a chain-locked card (#2-#6) carries an unlock hint naming the still-missing prerequisite recipe, never a mystery hint", () => {
    const card = recipeCardState(funghi, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected funghi to be LOCKED");
    expect(card.mystery).toBe(false);
    expect(card.unlockHint).toBe("マルゲリータを1枚完成させると解禁");
  });

  it("a stars-gated card whose chain is already satisfied (quattro-formaggi) shows a star-progress hint instead", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      1 as QualityStars,
    );
    const card = recipeCardState(quattroFormaggi, dex, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected quattro-formaggi to be LOCKED");
    expect(card.mystery).toBe(false);
    expect(card.unlockHint).toBe("あと★3で解禁");
  });

  it("fugazza stays mystery-locked (？？？) and its hint is only a star-progress line, never the recipe/ingredient name", () => {
    const card = recipeCardState(fugazza, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected fugazza to be LOCKED");
    expect(card.mystery).toBe(true);
    expect(card.unlockHint).toBe("あと★12で解禁");
    expect(card.unlockHint).not.toContain("たまねぎ");
    expect(card.unlockHint).not.toContain("フガッサ");
  });

  it("fugazza's hint counts down as totalStars grows toward its 12-star gate", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      2 as QualityStars,
    );
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected fugazza to be LOCKED");
    expect(card.unlockHint).toBe("あと★2で解禁");
  });

  it("LOCKED takes precedence over any stale Dex entry for an unavailable recipe", () => {
    // Defensive: a recipe should never render COMPLETED/NEW once it's unavailable (whichever
    // axis blocks it), even if a Dex entry exists from before (not a real save-shape today, but
    // the selector must not assume Dex and availability can never disagree).
    const dex: DexState = registerScoreToDex(EMPTY_DEX, "fugazza", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 80,
      stars: 4 as QualityStars,
    }).dex;
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });
});

function mockRecipes(count: number): Recipe[] {
  return Array.from({ length: count }, (_, i) => ({
    ...RECIPES[0],
    id: `mock-recipe-${i}` as unknown as RecipeId,
    nameJa: `モック${i}`,
    unlockCondition: undefined,
  }));
}

describe("buildRecipeSections (Recipe Select 2.0A position-based sections)", () => {
  it("splits today's 15 production recipes into 第1章 (7) / 第2章 (8), preserving RECIPES' own order", () => {
    const sections = buildRecipeSections(RECIPES);
    expect(RECIPES.length).toBe(15);
    expect(sections.map((s) => s.titleJa)).toEqual(["第1章", "第2章"]);
    expect(sections[0].recipes.map((r) => r.id)).toEqual(RECIPES.slice(0, 7).map((r) => r.id));
    expect(sections[1].recipes.map((r) => r.id)).toEqual(RECIPES.slice(7).map((r) => r.id));
  });

  it("returns an empty array for an empty collection", () => {
    expect(buildRecipeSections([])).toEqual([]);
  });

  it("returns exactly one section for a collection smaller than the first boundary gap", () => {
    const sections = buildRecipeSections(mockRecipes(3));
    expect(sections).toHaveLength(1);
    expect(sections[0].titleJa).toBe("第1章");
    expect(sections[0].recipes).toHaveLength(3);
  });

  it("auto-generates further sections past the last authored boundary for 30-50 recipe scale", () => {
    const sections = buildRecipeSections(mockRecipes(38));
    expect(sections.map((s) => s.titleJa)).toEqual(["第1章", "第2章", "第3章", "第4章", "第5章"]);
    // 0-6 (7), 7-14 (8), 15-22 (8), 23-30 (8), 31-37 (7) -- every recipe accounted for exactly once.
    expect(sections.reduce((sum, s) => sum + s.recipes.length, 0)).toBe(38);
    expect(sections.at(-1)!.recipes.at(-1)!.nameJa).toBe("モック37");
  });

  it("never drops or duplicates a recipe across sections at any scale", () => {
    for (const count of [1, 7, 8, 15, 16, 23, 50]) {
      const recipes = mockRecipes(count);
      const sections = buildRecipeSections(recipes);
      const seen = sections.flatMap((s) => s.recipes.map((r) => r.id));
      expect(seen).toEqual(recipes.map((r) => r.id));
    }
  });
});
