import { describe, expect, it, vi } from "vitest";

// B案 Phase 3b: this file runs the reducer under the shop model (what `?progression=shop` selects on Preview). The flag is a
// per-page-load constant, so the module is replaced before anything imports it.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { INGREDIENTS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { REPUTATION_TABLE, type CompleteReputationTable } from "../logic/progression/reputationTable";
import {
  mergeShopProgress,
  sanitizeShopProgress,
  shopProgressForWrite,
  type ShopProgressState,
} from "../logic/progression/shopProgress";
import { activeShopCatalog, settleAwaitingMenu } from "../logic/progression/shopProgression";
import type { QualityStars } from "../logic/scoring";
import { getDexEntry, isDiscovered, type DexEntry, type DexState } from "./dex";
import { isValidResearchTarget } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { canStartGuidedRound } from "./recipeDiscoveryState";

/**
 * B案 Phase 3b (Issue #901, Owner 2026-11-27): a recipe cannot be developed onto the menu before its stage opens, even with
 * every material at hand. An exact match before that is identified (判明): recorded in the Dex, kept off the menu, and it joins
 * the menu -- paying the menu-development bonus (Pitz +50, reputation +3) exactly once -- the moment its stage opens.
 */

const TABLE = REPUTATION_TABLE as unknown as CompleteReputationTable;
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
/** Stage 2, every material a stage-1 one: the case the stage rule exists for. */
const EARLY = "meat-lovers" as RecipeId;

function score(stars: QualityStars, total = 80) {
  return { total, stars, matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total };
}
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));

function stocked(shop: ShopProgressState, dexIds: readonly string[] = ["margherita"], pitz = 0): GameState {
  return createInitialGameState(dexOf(dexIds), ALL_IDS, pitz, FULL_STOCK, [], [], {}, {}, undefined, [], {}, shop);
}
const shopAt = (reputation: number, extra: Partial<ShopProgressState> = {}): ShopProgressState => ({
  reputation,
  grantedMenuRecipeIds: [],
  ...extra,
});

/** A Free Cooking round whose pizza is an exact match for `recipeId`, at RESULT. */
function freeCookMatch(state: GameState, recipeId: RecipeId, stars: QualityStars = 3): GameState {
  const s = gameReducer(state, { type: "START_FREE_COOK" });
  expect(s.freeCook).toBe(true);
  return { ...s, recipe: getRecipe(recipeId)!, phase: "RESULT", score: score(stars), completion: { status: "PASS" } } as GameState;
}

/** The service order the state is on (a guided margherita order), served at RESULT with these stars. */
function serveOrder(state: GameState, stars: QualityStars): GameState {
  const order = { ...state, recipe: getRecipe("margherita")!, phase: "RESULT", score: score(stars), completion: { status: "PASS" } } as GameState;
  expect(order.freeCook).toBe(false);
  return gameReducer(order, { type: "REGISTER_TO_DEX" });
}

/** A save round trip of the shop state (what `persistence.ts` writes and reads for `shopProgress`). */
function reloaded(state: GameState): GameState {
  const stored = JSON.parse(JSON.stringify(shopProgressForWrite(state.shop, undefined)));
  const shop = sanitizeShopProgress(stored, (id) => RECIPES.some((r) => r.id === id))!;
  return createInitialGameState(state.dex, state.ownedIngredientIds, state.pitzBalance, state.inventory, [], state.unlockedForShopIngredientIds, {}, {}, undefined, [], {}, shop);
}

describe("the stage rule (menu development waits for the recipe's stage)", () => {
  it("the case exists: a stage-2 recipe whose materials are all stage-1 ones", () => {
    expect(MENU_CATALOG.find((e) => e.recipeId === EARLY)?.chapter).toBe(2);
    for (const { ingredientId } of getRecipe(EARLY)!.requiredIngredients) {
      expect(activeProgressionModel().isMaterialReached(ingredientId, { dex: [], shop: shopAt(0) }), ingredientId).toBe(true);
    }
  });

  it("a discovered recipe is on the menu only once its stage is open (39: no, 40: yes)", () => {
    const model = activeProgressionModel();
    expect(model.isOnMenu(EARLY, stocked(shopAt(39), ["margherita", EARLY]))).toBe(false);
    expect(model.menuRecipeIds(stocked(shopAt(39), ["margherita", EARLY]))).toEqual(["margherita"]);
    expect(canStartGuidedRound(EARLY, stocked(shopAt(39), ["margherita", EARLY]))).toBe(false);
    expect(model.isOnMenu(EARLY, stocked(shopAt(40), ["margherita", EARLY]))).toBe(true);
    expect(canStartGuidedRound(EARLY, stocked(shopAt(40), ["margherita", EARLY]))).toBe(true);
  });

  it("isRecipeStageOpen follows each stage's floor for all 60", () => {
    const model = activeProgressionModel();
    const floors = TABLE.chapterFloors;
    for (const e of MENU_CATALOG) {
      const floor = floors[e.chapter - 1];
      expect(model.isRecipeStageOpen(e.recipeId, { dex: [], shop: shopAt(floor) }), e.recipeId).toBe(true);
      if (floor > 0) expect(model.isRecipeStageOpen(e.recipeId, { dex: [], shop: shopAt(floor - 1) }), e.recipeId).toBe(false);
    }
  });

  it("the orders never draw a recipe whose stage is closed", () => {
    let s = stocked(shopAt(39), ["margherita", EARLY]);
    for (let i = 0; i < 30; i++) {
      expect(s.recipe.id).not.toBe(EARLY);
      s = gameReducer(s, { type: "PLAY_AGAIN" });
    }
  });
});

describe("an exact match before the stage opens: identified (判明), held off the menu", () => {
  it("is recorded in the Dex, joins the awaiting ledger, and pays no development bonus yet", () => {
    const before = stocked(shopAt(10), ["margherita"], 100);
    const after = gameReducer(freeCookMatch(before, EARLY), { type: "REGISTER_TO_DEX" });
    expect(isDiscovered(after.dex, EARLY)).toBe(true);
    expect(getDexEntry(after.dex, EARLY)?.bestStars).toBe(3);
    expect(after.justDiscovered).toBe(false);
    expect(after.justGotNewBest).toBe(false);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(0);
    expect(after.shop.reputation).toBe(10);
    expect(after.shop.awaitingMenuRecipeIds).toEqual([EARLY]);
    expect(after.shop.menuEntryPaidRecipeIds).toBeUndefined();
    expect(after.lastIdentifiedAwaiting).toEqual({ recipeId: EARLY, chapter: 2, firstTime: true });
    expect(after.lastMenuEntries).toBeNull();
    expect(activeProgressionModel().isOnMenu(EARLY, after)).toBe(false);
  });

  it("making it again while it waits: still identified, nothing paid, the ledger unchanged", () => {
    const first = gameReducer(freeCookMatch(stocked(shopAt(10)), EARLY), { type: "REGISTER_TO_DEX" });
    const again = gameReducer(freeCookMatch(gameReducer(first, { type: "PLAY_AGAIN" }), EARLY), { type: "REGISTER_TO_DEX" });
    expect(again.lastIdentifiedAwaiting).toEqual({ recipeId: EARLY, chapter: 2, firstTime: false });
    expect(again.lastPitzCredit?.discoveryBonusPitz).toBe(0);
    expect(again.shop.reputation).toBe(10);
    expect(again.shop.awaitingMenuRecipeIds).toEqual([EARLY]);
    expect(getDexEntry(again.dex, EARLY)?.timesMade).toBe(2);
  });

  it("an open-stage recipe is developed as before (+50 Pitz, +3)", () => {
    const after = gameReducer(freeCookMatch(stocked(shopAt(40)), EARLY), { type: "REGISTER_TO_DEX" });
    expect(after.justDiscovered).toBe(true);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(50);
    expect(after.shop.reputation).toBe(43);
    expect(after.lastIdentifiedAwaiting).toBeNull();
    expect(after.shop.awaitingMenuRecipeIds).toBeUndefined();
  });

  it("a recipe the catalog does not adopt is not held by the stage rule (its own treatment is Phase 3e)", () => {
    const rejected = RECIPES.find((r) => !MENU_CATALOG.some((e) => e.recipeId === r.id))!;
    const after = gameReducer(freeCookMatch(stocked(shopAt(0)), rejected.id), { type: "REGISTER_TO_DEX" });
    expect(after.lastIdentifiedAwaiting).toBeNull();
    expect(after.shop.awaitingMenuRecipeIds).toBeUndefined();
  });
});

describe("the stage opens: the identified recipe joins the menu, and the bonus is paid exactly once", () => {
  const identifiedAt38 = () => {
    const s = gameReducer(freeCookMatch(stocked(shopAt(38), ["margherita"], 0), EARLY), { type: "REGISTER_TO_DEX" });
    return gameReducer(s, { type: "PLAY_AGAIN" });
  };

  it("a served order that crosses 40 brings it onto the menu with Pitz +50 and reputation +3", () => {
    const waiting = identifiedAt38();
    expect(waiting.shop.reputation).toBe(38);
    const pitzBefore = waiting.pitzBalance;
    const served = serveOrder(waiting, 2); // ★2 +2 -> 40
    expect(served.shop.reputation).toBe(43);
    expect(served.lastMenuEntries).toEqual({ recipeIds: [EARLY], bonusPitz: 50, reputation: 3 });
    expect(served.shop.menuEntryPaidRecipeIds).toEqual([EARLY]);
    expect(served.lastReputationGain).toMatchObject({ gained: 5, before: 38, after: 43, chapterBefore: 1, chapterAfter: 2 });
    const orderPitz = served.lastPitzCredit!.earnedPitz + (served.lastEfficiencyCredit?.bonusPitz ?? 0);
    expect(served.pitzBalance).toBe(pitzBefore + orderPitz + 50);
    expect(activeProgressionModel().isOnMenu(EARLY, served)).toBe(true);
  });

  it("no second payment: the next order, a reload, a re-trial and a merge with an older save all pay nothing", () => {
    const served = serveOrder(identifiedAt38(), 2);
    const next = serveOrder(gameReducer(served, { type: "PLAY_AGAIN" }), 1);
    expect(next.lastMenuEntries).toBeNull();
    expect(next.shop.reputation).toBe(44);

    const afterReload = reloaded(served);
    expect(afterReload.shop.menuEntryPaidRecipeIds).toEqual([EARLY]);
    const reloadedServed = serveOrder(afterReload, 1);
    expect(reloadedServed.lastMenuEntries).toBeNull();
    expect(reloadedServed.shop.reputation).toBe(44);

    const retried = gameReducer(freeCookMatch(gameReducer(served, { type: "PLAY_AGAIN" }), EARLY), { type: "REGISTER_TO_DEX" });
    expect(retried.justDiscovered).toBe(false);
    expect(retried.lastPitzCredit?.discoveryBonusPitz).toBe(0);
    expect(retried.lastIdentifiedAwaiting).toBeNull();
    expect(retried.lastMenuEntries).toBeNull();

    // An older tab / save still holding the waiting state merges into the paid one: still paid, nothing due.
    const older = identifiedAt38().shop;
    const merged = mergeShopProgress(older, served.shop);
    expect(settleAwaitingMenu(merged, TABLE, activeShopCatalog()).enteredRecipeIds).toEqual([]);
    expect(settleAwaitingMenu(mergeShopProgress(served.shop, older), TABLE, activeShopCatalog()).enteredRecipeIds).toEqual([]);
  });

  it("an order that does not reach the floor keeps it waiting", () => {
    const served = serveOrder(identifiedAt38(), 1); // +1 -> 39
    expect(served.lastMenuEntries).toBeNull();
    expect(served.shop.menuEntryPaidRecipeIds).toBeUndefined();
    expect(activeProgressionModel().isOnMenu(EARLY, served)).toBe(false);
  });

  it("a practice round never settles (it earns no reputation)", () => {
    const waiting = identifiedAt38();
    const practice = gameReducer(waiting, { type: "RETRY_SAME_RECIPE" });
    expect(practice.roundKind).toBe("PRACTICE");
    const atResult = { ...practice, phase: "RESULT", score: score(5), completion: { status: "PASS" } } as GameState;
    const after = gameReducer(atResult, { type: "REGISTER_TO_DEX" });
    expect(after.lastMenuEntries).toBeNull();
    expect(after.shop.reputation).toBe(38);
  });

  it("the bonus reputation can open the next stage, whose identified recipes join too (one settlement)", () => {
    const stage3 = MENU_CATALOG.find((e) => e.chapter === 3)!.recipeId;
    const table: CompleteReputationTable = { ...TABLE, menuDevelopmentBonus: 70 };
    const r = settleAwaitingMenu(shopAt(40, { awaitingMenuRecipeIds: [stage3, EARLY] }), table, activeShopCatalog());
    expect(r.enteredRecipeIds).toEqual([EARLY, stage3]);
    expect(r.shop.reputation).toBe(180);
    expect(r.reputationGained).toBe(140);
    expect(settleAwaitingMenu(r.shop, table, activeShopCatalog()).enteredRecipeIds).toEqual([]);
  });
});

describe("research / hint candidates are the open stages' recipes only", () => {
  it("a cookable, undiscovered recipe of a closed stage is no candidate; it becomes one when the stage opens", () => {
    const closed = stocked(shopAt(39));
    expect(discoverableHintCandidates(closed).map((r) => r.id)).not.toContain(EARLY);
    expect(isValidResearchTarget(closed, EARLY)).toBe(false);
    const open = stocked(shopAt(40));
    expect(discoverableHintCandidates(open).map((r) => r.id)).toContain(EARLY);
    for (const r of discoverableHintCandidates(closed)) {
      expect(activeProgressionModel().isRecipeStageOpen(r.id, closed), r.id).toBe(true);
    }
  });
});
