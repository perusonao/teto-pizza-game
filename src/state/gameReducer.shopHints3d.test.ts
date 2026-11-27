import { describe, expect, it, vi } from "vitest";

// B案 Phase 3d: this file runs the reducer under the shop model (what `?progression=shop` selects on Preview).
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { INGREDIENTS } from "../data/ingredients";
import { hintRevealsOf, researchPointBalanceOf, researchPointsSpentOf, type ShopProgressState } from "../logic/progression/shopProgress";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { SAVE_STORAGE_KEY, commitProgress } from "./persistence";
import { progressionSnapshotOf } from "./roundCommit";
import { buildStartup } from "./startup";
import { memoryStorage } from "./testSupport/memoryStorage";
import { shopHintBoardFor } from "./shopHintState";
import { hint5SheetView } from "./discoveryHint";

/**
 * B案 Phase 3d (Issue #901, Owner 2026-11-27): hints are bought with research points in the shop model, through
 * PURCHASE_SHOP_HINT only. Pitz buys none (the Hint 2.0 / 3.0 / 5.0 purchases are refused). What was bought survives a reload.
 */
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
const shopAt = (reputation: number, extra: Partial<ShopProgressState> = {}): ShopProgressState => ({ reputation, grantedMenuRecipeIds: [], ...extra });

function stateWith(shop: ShopProgressState, options: { dex?: readonly string[]; pitz?: number; facts?: Record<string, readonly string[]> } = {}): GameState {
  return createInitialGameState(dexOf(options.dex ?? ["margherita"]), ALL_IDS, options.pitz ?? 500, FULL_STOCK, [], [], {}, options.facts ?? {}, undefined, [], {}, shop);
}

const boardOf = (state: GameState, recipeId: string) => shopHintBoardFor(state, recipeId)!;
function buy(state: GameState, recipeId: string, kind: "INGREDIENT" | "SAUCE" | "SHAPE" | "METHOD" | "COUNT"): GameState {
  return gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId, kind, expectedPrice: boardOf(state, recipeId).price });
}

describe("PURCHASE_SHOP_HINT", () => {
  it("charges research points by the table, reveals the item, and leaves Pitz alone", () => {
    const state = stateWith(shopAt(250, { researchPointsEarned: 20 }));
    const after = buy(state, "flammkuchen", "SAUCE"); // stage 4: 3
    expect(researchPointsSpentOf(after.shop)).toBe(3);
    expect(researchPointBalanceOf(after.shop)).toBe(17);
    expect(hintRevealsOf(after.shop, "flammkuchen")).toEqual(["sauce"]);
    expect(after.pitzBalance).toBe(state.pitzBalance);
    expect(boardOf(after, "flammkuchen").sauceIds).toEqual(["fromage-blanc-sauce"]);
    const again = buy(after, "flammkuchen", "INGREDIENT"); // +1
    expect(researchPointsSpentOf(again.shop)).toBe(3 + 4);
  });

  it("not enough points: nothing changes (the same state)", () => {
    const state = stateWith(shopAt(250, { researchPointsEarned: 2 }));
    expect(gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId: "flammkuchen", kind: "SAUCE", expectedPrice: 3 })).toBe(state);
    expect(boardOf(state, "flammkuchen")).toMatchObject({ price: 3, balance: 2, affordable: false });
  });

  it("the same item twice, a stale price, or a recipe of a closed stage: nothing changes", () => {
    const state = buy(stateWith(shopAt(0, { researchPointsEarned: 20 })), "margherita", "SAUCE");
    expect(gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId: "margherita", kind: "SAUCE", expectedPrice: 2 })).toBe(state);
    expect(gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId: "margherita", kind: "SHAPE", expectedPrice: 1 })).toBe(state);
    expect(gameReducer(state, { type: "PURCHASE_SHOP_HINT", recipeId: "napoletana", kind: "SAUCE", expectedPrice: 1 })).toBe(state);
    expect(shopHintBoardFor(state, "napoletana")).toBeNull();
  });

  it("a developed recipe is a target too", () => {
    const state = stateWith(shopAt(0, { researchPointsEarned: 5 }), { dex: ["margherita", "funghi"] });
    expect(buy(state, "funghi", "SHAPE").shop.hintRevealsByRecipe).toEqual({ funghi: ["shape"] });
  });

  it("what was bought survives a reload, and cannot be bought again after it", () => {
    const storage = memoryStorage({});
    const state = buy(buy(stateWith(shopAt(0, { researchPointsEarned: 9 })), "funghi", "INGREDIENT"), "funghi", "COUNT");
    expect(commitProgress(progressionSnapshotOf(state, undefined), storage).status).toBe("ok");
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).shopProgress).toMatchObject({
      researchPointsEarned: 9,
      researchPointsSpent: 3,
      hintRevealsByRecipe: { funghi: ["ing:mozzarella", "count"] },
    });
    const reloaded = buildStartup(storage).state;
    expect(researchPointBalanceOf(reloaded.shop)).toBe(6);
    const board = boardOf(reloaded, "funghi");
    expect(board.slots.map((s) => s.ingredientId)).toEqual(["mozzarella", null]);
    expect(board.countRevealed).toBe(true);
    expect(board.forSale).not.toContain("COUNT");
    expect(gameReducer(reloaded, { type: "PURCHASE_SHOP_HINT", recipeId: "funghi", kind: "COUNT", expectedPrice: board.price })).toBe(reloaded);
  });
});

describe("Pitz never buys a hint in the shop model", () => {
  function openSheet(state: GameState): GameState {
    const cooking = gameReducer(state, { type: "START_FREE_COOK" });
    return gameReducer(cooking, { type: "SHOW_HINT", pinnedRecipeId: "funghi" });
  }

  it("the Hint 2.0 / 3.0 / 5.0 purchases are refused (the same state, Pitz unchanged)", () => {
    const sheet = openSheet(stateWith(shopAt(400), { pitz: 999 }));
    expect(sheet.hintSheetOpen).toBe(true);
    // The ladder would sell a rung here (the same sheet the legacy model charges Pitz for).
    expect(hint5SheetView(sheet)?.next).not.toBeNull();
    for (const action of [
      { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 },
      { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 },
      { type: "PURCHASE_DISCOVERY_HINT", level: 1 },
    ] as const) {
      expect(gameReducer(sheet, action as never), action.type).toBe(sheet);
    }
  });

  it("the free Margherita onboarding (nothing developed yet) is a research point hint at 0 points, not the Pitz reveal", () => {
    const fresh = openSheet(stateWith(shopAt(0), { dex: [], pitz: 0 }));
    expect(gameReducer(fresh, { type: "PURCHASE_DISCOVERY_HINT", level: 1 })).toBe(fresh);
    const board = boardOf(fresh, "margherita");
    expect(board).toMatchObject({ free: true, price: 0, affordable: true });
    const after = buy(fresh, "margherita", "INGREDIENT");
    expect(hintRevealsOf(after.shop, "margherita")).toEqual(["ing:mozzarella"]);
    expect(researchPointsSpentOf(after.shop)).toBe(0);
    // Once something is developed, Margherita costs points like any recipe.
    expect(boardOf(stateWith(shopAt(0)), "margherita").free).toBe(false);
  });

  it("hints already bought with Pitz carry over as revealed, at no charge", () => {
    const state = stateWith(shopAt(0, { researchPointsEarned: 3 }), { facts: { margherita: ["ing:basil", "h5:key"] } });
    const board = boardOf(state, "margherita");
    expect(board.slots).toEqual([
      { ingredientId: null, count: null, late: false, carriedOver: false },
      { ingredientId: "basil", count: null, late: false, carriedOver: true },
    ]);
    expect(board.price).toBe(1);
    const after = buy(state, "margherita", "INGREDIENT");
    expect(boardOf(after, "margherita").forSale).not.toContain("INGREDIENT");
    expect(after.discoveryHintFacts).toBe(state.discoveryHintFacts);
    expect(researchPointsSpentOf(after.shop)).toBe(1);
  });
});
