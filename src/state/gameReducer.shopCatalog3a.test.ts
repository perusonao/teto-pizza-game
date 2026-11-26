import { describe, expect, it, vi } from "vitest";

// B案 Phase 3a: this file runs under the shop model (what `?progression=shop` selects on Preview). The flag is a
// per-page-load constant, so the module is replaced before anything imports it.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { INGREDIENTS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { REPUTATION_TABLE } from "../logic/progression/reputationTable";
import type { ShopProgressState } from "../logic/progression/shopProgress";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { canStartGuidedRound, isRecipeCookable } from "./recipeDiscoveryState";

/**
 * B案 Phase 3a (Issue #901): the service orders (the FREE Mito orders) and Lunch Rush draw only from the curated 60, read
 * through the Phase 2a `menuRecipeIds` path. A recipe the catalog does not adopt stays in `RECIPES` and can still be
 * recorded in the Dex (its "original pizza" treatment is Phase 3e), but it is never on the menu, so never ordered.
 */

const ADOPTED = new Set(MENU_CATALOG.map((e) => e.recipeId as string));
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const TOP: ShopProgressState = { reputation: 10_000, grantedMenuRecipeIds: [] };

const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));

function stocked(dexIds: readonly string[], shop: ShopProgressState = TOP): GameState {
  return createInitialGameState(dexOf(dexIds), ALL_IDS, 0, FULL_STOCK, [], [], {}, {}, undefined, [], {}, shop);
}

/** Non-adopted recipes that are cookable with every ingredient in stock (the ones that could otherwise be ordered). */
const REJECTED_COOKABLE = RECIPES.filter(
  (r) => !ADOPTED.has(r.id) && isRecipeCookable(r, { ownedIngredientIds: ALL_IDS, inventory: FULL_STOCK }),
).map((r) => r.id as string);

describe("the menu and the service orders come from the curated 60", () => {
  it("there are non-adopted recipes that could be cooked (the case this file guards)", () => {
    expect(REJECTED_COOKABLE.length).toBeGreaterThan(0);
  });

  it("a discovered recipe the catalog does not adopt is not on the menu and cannot start a guided round", () => {
    const s = stocked(["margherita", ...REJECTED_COOKABLE]);
    const menu = activeProgressionModel().menuRecipeIds(s);
    expect(menu).toEqual(["margherita"]);
    for (const id of REJECTED_COOKABLE) {
      expect(activeProgressionModel().isOnMenu(id, s)).toBe(false);
      expect(canStartGuidedRound(id, s)).toBe(false);
    }
  });

  it("every discovered adopted recipe is on the menu, in RECIPES order", () => {
    const all = MENU_CATALOG.map((e) => e.recipeId as string);
    const s = stocked([...all, ...REJECTED_COOKABLE]);
    expect(activeProgressionModel().menuRecipeIds(s)).toEqual(RECIPES.map((r) => r.id).filter((id) => ADOPTED.has(id)));
  });

  it("the orders a session draws are always adopted recipes", () => {
    let s = stocked([...MENU_CATALOG.map((e) => e.recipeId as string), ...REJECTED_COOKABLE]);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      expect(s.phase).toBe("ORDER");
      expect(s.freeCook).toBe(false);
      seen.add(s.recipe.id);
      s = gameReducer({ ...s, phase: "RESULT", score: { total: 60, stars: 2, matchScore: 60, ingredientScore: 60, placementScore: 60, bakeScore: 60 }, completion: { status: "PASS" } } as GameState, { type: "REGISTER_TO_DEX" });
      s = gameReducer(s, { type: "PLAY_AGAIN" });
    }
    for (const id of seen) expect(ADOPTED.has(id)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("with only non-adopted recipes discovered, the first order is still margherita (Q2)", () => {
    const s = stocked(REJECTED_COOKABLE);
    expect(s.recipe.id).toBe("margherita");
    expect(s.freeCook).toBe(false);
  });
});

describe("Lunch Rush draws from the same menu (Q8)", () => {
  it("its candidates are adopted recipes only", () => {
    const s = stocked([...MENU_CATALOG.map((e) => e.recipeId as string), ...REJECTED_COOKABLE]);
    const pool = missionOrderRecipeIds(s);
    expect(pool.length).toBeGreaterThan(0);
    for (const id of pool) expect(ADOPTED.has(id)).toBe(true);
    for (const id of REJECTED_COOKABLE) expect(pool).not.toContain(id);
  });
});

describe("the stages are the catalog's", () => {
  it("chapterOf is each recipe's stage", () => {
    for (const e of MENU_CATALOG) expect(activeProgressionModel().chapterOf(getRecipe(e.recipeId as RecipeId)!)).toBe(e.chapter);
  });

  it("a stage is open from its reputation floor (0 / 40 / 110 / 210 / 340, unchanged)", () => {
    const floors = REPUTATION_TABLE.chapterFloors as readonly number[];
    expect([...floors]).toEqual([0, 40, 110, 210, 340]);
    const inputs = (reputation: number) => ({ ...stocked([]), shop: { reputation, grantedMenuRecipeIds: [] } });
    for (let stage = 1; stage <= 5; stage++) {
      expect(activeProgressionModel().isChapterOpen(stage, inputs(floors[stage - 1]))).toBe(true);
      if (floors[stage - 1] > 0) expect(activeProgressionModel().isChapterOpen(stage, inputs(floors[stage - 1] - 1))).toBe(false);
    }
  });
});

describe("reachability (the shop version of ladderReachability)", () => {
  it("at the last stage's floor every one of the 60 has every material on sale, so it can be developed and ordered", () => {
    const top = { ...stocked([]), shop: { reputation: (REPUTATION_TABLE.chapterFloors as readonly number[])[4], grantedMenuRecipeIds: [] } };
    const sold = new Set(activeProgressionModel().resolveEntitlement({ ...top, unlockedForShopIngredientIds: [] }).unlockedForShopIngredientIds);
    for (const e of MENU_CATALOG) {
      const recipe = getRecipe(e.recipeId as RecipeId)!;
      for (const { ingredientId } of recipe.requiredIngredients) {
        const finite = !!INGREDIENTS.find((i) => i.id === ingredientId)?.unlockCondition;
        if (finite) expect(sold.has(ingredientId), `${e.recipeId} needs ${ingredientId}`).toBe(true);
      }
    }
  });
});
