import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { hint5SheetView } from "./discoveryHint";
import { shopHintBoardFor, shopHintsActive } from "./shopHintState";
import { EMPTY_SHOP_PROGRESS } from "../logic/progression/shopProgress";

/**
 * B案 Phase 3d (Issue #901): under the legacy model (Production's default) nothing changes -- Pitz still buys the Hint 5.0
 * ladder, PURCHASE_SHOP_HINT is a no-op and no shop hint view exists.
 */
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));

function sheet(pitz: number): GameState {
  const state = createInitialGameState(dexOf(["margherita"]), ALL_IDS, pitz, FULL_STOCK);
  return gameReducer(gameReducer(state, { type: "START_FREE_COOK" }), { type: "SHOW_HINT", pinnedRecipeId: "funghi" });
}

describe("legacy: hints are still bought with Pitz", () => {
  it("the shop hint layer is off", () => {
    expect(shopHintsActive()).toBe(false);
    expect(shopHintBoardFor({ dex: [], shop: { ...EMPTY_SHOP_PROGRESS, researchPointsEarned: 50 }, discoveryHintFacts: {}, discoveryHintPurchases: {} }, "margherita")).toBeNull();
  });

  it("PURCHASE_HINT5_RUNG charges Pitz as before", () => {
    const open = sheet(100);
    const view = hint5SheetView(open);
    expect(view?.next).not.toBeNull();
    const after = gameReducer(open, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view!.next!.rungIndex });
    expect(after.pitzBalance).toBe(100 - view!.next!.price);
    expect(after.shop).toBe(open.shop);
  });

  it("PURCHASE_SHOP_HINT does nothing", () => {
    const state = createInitialGameState(dexOf(["margherita"]), ALL_IDS, 100, FULL_STOCK, [], [], {}, {}, undefined, [], {}, {
      ...EMPTY_SHOP_PROGRESS,
      researchPointsEarned: 50,
    });
    expect(gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId: "margherita", kind: "SAUCE", expectedPrice: 1 })).toBe(state);
  });
});
