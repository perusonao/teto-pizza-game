import "../test/legacyProgression";
import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { PROGRESSION_MODEL_ID } from "../logic/progression/progressionModelFlag";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { SAVE_STORAGE_KEY } from "./persistence";
import { progressionSnapshotOf } from "./roundCommit";
import { buildStartup } from "./startup";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * B案 Phase 1b (Issue #901), design §3.4: with the flag explicitly set to legacy (legacy), the new `GameState.shop`
 * changes nothing. It starts as the default (or as stored), no transition touches it (the same object is carried
 * through every round path), and the state minus `shop` is exactly what it was before 1b.
 */
const SHOP: ShopProgressState = { reputation: 250, grantedMenuRecipeIds: ["margherita"] };

function withoutShop(state: GameState): Omit<GameState, "shop"> {
  const { shop: _shop, ...rest } = state;
  return rest;
}

function freeResult(base: GameState, recipeId: RecipeId): GameState {
  return {
    ...base,
    phase: "RESULT",
    recipe: getRecipe(recipeId)!,
    score: { total: 90, stars: 3, matchScore: 90, ingredientScore: 90, placementScore: 90, bakeScore: 90 },
  } as GameState;
}

describe("shop state with legacy selected", () => {
  it("the build runs the legacy model", () => {
    expect(PROGRESSION_MODEL_ID).toBe("legacy");
  });

  it("a fresh state carries the default shop state", () => {
    expect(createInitialGameState().shop).toBe(EMPTY_SHOP_PROGRESS);
  });

  it("the shop argument changes nothing else in the initial state", () => {
    const plain = createInitialGameState([], STARTER_INGREDIENT_IDS);
    const withShop = createInitialGameState([], STARTER_INGREDIENT_IDS, 0, {}, [], [], {}, {}, undefined, [], {}, SHOP);
    expect(withShop.shop).toBe(SHOP);
    expect(withoutShop(withShop)).toEqual(withoutShop(plain));
  });

  it("every round path carries the shop state through unchanged (same object)", () => {
    const start = createInitialGameState([], STARTER_INGREDIENT_IDS, 0, {}, [], [], {}, {}, undefined, [], {}, SHOP);
    const actions: GameAction[] = [
      { type: "REGISTER_TO_DEX" },
      { type: "PLAY_AGAIN" },
      { type: "START_FREE_COOK" },
      { type: "MISSION_RESET_ORDER" },
      { type: "MISSION_NEXT_ORDER" },
    ];
    let state: GameState = freeResult(start, "margherita");
    for (const action of actions) {
      state = gameReducer(state, action);
      expect(state.shop).toBe(SHOP);
    }
  });

  it("REGISTER_TO_DEX: the same state, apart from `shop`, as with the default shop state", () => {
    const a = gameReducer(freeResult(createInitialGameState([], STARTER_INGREDIENT_IDS), "margherita"), { type: "REGISTER_TO_DEX" });
    const b = gameReducer(
      freeResult(createInitialGameState([], STARTER_INGREDIENT_IDS, 0, {}, [], [], {}, {}, undefined, [], {}, SHOP), "margherita"),
      { type: "REGISTER_TO_DEX" },
    );
    expect(withoutShop(b)).toEqual(withoutShop(a));
    expect(b.shop).toBe(SHOP);
  });

  it("startup: a save with shopProgress starts with it as stored and the rest equals the save without it", () => {
    const save = {
      schemaVersion: 2,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
      pitzBalance: 120,
      ownedIngredientIds: ["onion"],
      missionBest: {},
      inventory: { onion: 7 },
    };
    const plain = buildStartup(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) }));
    const seeded = buildStartup(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ ...save, shopProgress: SHOP }) }));
    expect(plain.state.shop).toEqual(EMPTY_SHOP_PROGRESS);
    expect(seeded.state.shop).toEqual(SHOP);
    expect(withoutShop(seeded.state)).toEqual(withoutShop(plain.state));
  });

  it("the save snapshot carries the shop state", () => {
    const state = createInitialGameState([], STARTER_INGREDIENT_IDS, 0, {}, [], [], {}, {}, undefined, [], {}, SHOP);
    expect(progressionSnapshotOf(state, undefined).shopProgress).toBe(SHOP);
  });
});
