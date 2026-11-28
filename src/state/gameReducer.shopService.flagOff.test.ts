import "../test/legacyProgression";
import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, getRecipe, participatesInLunchRush, type RecipeId } from "../data/recipes";
import { TECHNIQUES } from "../data/techniques";
import { LEGACY_PROGRESSION, activeProgressionModel } from "../logic/progression/progressionModel";
import { SHOP_MODEL_ACTIVE, shopReputationStatus } from "../logic/progression/shopStatus";
import { applyPitzCredit } from "../logic/pitzReward";
import { isTechniqueAffordanceOpenFor, productionTechniqueContext } from "../logic/techniques/runtime";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { discoveredRecipeIds, type DexEntry, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { buildPizzaSelectView } from "./pizzaSelect";
import { availableRecipeIds } from "./progression";
import { canStartGuidedRound, isRecipeCookable } from "./recipeDiscoveryState";

/**
 * B案 Phase 2a (Issue #901): with legacy selected, every path Phase 2a re-pointed at the
 * progression port behaves exactly as before. The shop model's own behaviour is ./gameReducer.shopService.test.ts.
 *
 * "As before" is written out literally here (the discovered-list expressions the call sites used before Phase 2a), and a
 * shop state that is not the default is passed everywhere, so a legacy path that started reading it would show up.
 */

const SHOP_STATE = { reputation: 999, grantedMenuRecipeIds: ["pepperoni"] };

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 10, bestStars: 1, timesMade: 1 }));
}

function fresh(dex: DexState = []): GameState {
  return createInitialGameState(dex, STARTER_INGREDIENT_IDS, 0, {}, [], [], {}, {}, undefined, [], {}, SHOP_STATE);
}

describe("Production default: the legacy model, no shop UI", () => {
  it("the model is legacy and the shop status is off", () => {
    expect(activeProgressionModel()).toBe(LEGACY_PROGRESSION);
    expect(SHOP_MODEL_ACTIVE).toBe(false);
    expect(shopReputationStatus(SHOP_STATE)).toBeNull();
  });
});

describe("legacy: the menu is the discovered recipes, the shop state is never read", () => {
  it("a new save still opens on a Free Cooking ORDER (Dex 0: no guided order)", () => {
    const s = fresh();
    expect(s.freeCook).toBe(true);
    expect(canStartGuidedRound("margherita", s)).toBe(false);
    expect(canStartGuidedRound("pepperoni", s)).toBe(false);
  });

  it("menuRecipeIds / isOnMenu equal the discovered list", () => {
    const dex = dexOf(["pepperoni", "margherita"]);
    expect(LEGACY_PROGRESSION.menuRecipeIds({ dex, shop: SHOP_STATE })).toEqual(discoveredRecipeIds(dex));
    for (const r of RECIPES) {
      expect(LEGACY_PROGRESSION.isOnMenu(r.id, { dex, shop: SHOP_STATE })).toBe(discoveredRecipeIds(dex).includes(r.id));
    }
  });

  it("the FREE order pool is discovered ∩ cookable, as before", () => {
    let s = fresh(dexOf(["margherita", "pepperoni"]));
    for (let i = 0; i < 20; i++) {
      s = gameReducer(s, { type: "PLAY_AGAIN" });
      expect(s.recipe.id).toBe("margherita");
    }
  });

  it("the Lunch Rush pool is the pre-2a expression", () => {
    const s = fresh(dexOf(["margherita", "pepperoni", "marinara"]));
    const discovered = new Set(discoveredRecipeIds(s.dex));
    const before = availableRecipeIds(s.dex, s.ownedIngredientIds).filter(
      (id) => discovered.has(id) && participatesInLunchRush(id, RECIPES),
    );
    expect(missionOrderRecipeIds(s)).toEqual(before);
  });

  it("Pizza Select's cards are the discovered recipes", () => {
    const dex = dexOf(["margherita", "pepperoni"]);
    const view = buildPizzaSelectView({ dex, ownedIngredientIds: STARTER_INGREDIENT_IDS, unlockedForShopIngredientIds: [], inventory: {}, shop: SHOP_STATE });
    expect(view.chapters.flatMap((c) => c.cards.map((card) => card.recipe.id)).sort()).toEqual(["margherita", "pepperoni"]);
  });

  it("the technique affordance ignores the shop state", () => {
    const context = productionTechniqueContext();
    for (const dex of [[], dexOf(RECIPES.slice(0, 30).map((r) => r.id))]) {
      for (const t of TECHNIQUES) {
        expect(isTechniqueAffordanceOpenFor(t.id, dex, context, SHOP_STATE)).toBe(isTechniqueAffordanceOpenFor(t.id, dex, context));
      }
    }
  });
});

describe("legacy: REGISTER_TO_DEX adds no reputation and pays the same Pitz", () => {
  it("a guided RESULT", () => {
    const base = fresh(dexOf(["margherita"]));
    const before = { ...base, phase: "RESULT", score: { total: 88, stars: 4, matchScore: 88, ingredientScore: 88, placementScore: 88, bakeScore: 88 } } as GameState;
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.shop).toBe(before.shop);
    expect(after.lastReputationGain).toBeNull();
    expect(after.lastPitzCredit).toEqual(applyPitzCredit(getRecipe("margherita")!.baseRewardPitz, 88, 0, false));
  });

  it("a Free Cooking first discovery keeps its +50 and gains no reputation", () => {
    const s = gameReducer(fresh(), { type: "START_FREE_COOK" });
    const before = {
      ...s,
      phase: "RESULT",
      recipe: getRecipe("margherita")!,
      score: { total: 90, stars: 5, matchScore: 90, ingredientScore: 90, placementScore: 90, bakeScore: 90 },
      completion: { status: "PASS" },
    } as GameState;
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.justDiscovered).toBe(true);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(50);
    expect(after.shop).toBe(before.shop);
    expect(after.lastReputationGain).toBeNull();
  });

  it("a Lunch Rush order for a recipe that is only granted (not discovered) is not drawn", () => {
    const s = gameReducer(fresh(dexOf(["margherita"])), { type: "MISSION_RESET_ORDER" });
    expect(s.isMissionRound).toBe(true);
    expect(s.recipe.id).toBe("margherita" as RecipeId);
    expect(isRecipeCookable(s.recipe, s)).toBe(true);
  });
});
