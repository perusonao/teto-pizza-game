import { describe, expect, it, vi } from "vitest";

// B案 Phase 2a: this file runs the reducer under the shop model (what `?progression=shop` selects on Preview). The flag is a
// per-page-load constant, so the module is replaced before anything imports it.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { REPUTATION_TABLE } from "../logic/progression/reputationTable";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import { activeShopCatalog, materialChapterOf } from "../logic/progression/shopProgression";
import { SHOP_RANKS } from "../logic/progression/shopRank";
import { SHOP_MODEL_ACTIVE, shopReputationStatus } from "../logic/progression/shopStatus";
import { applyPitzCredit } from "../logic/pitzReward";
import type { QualityStars } from "../logic/scoring";
import { getDexEntry, type DexEntry, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { canStartGuidedRound } from "./recipeDiscoveryState";

/**
 * B案 Phase 2a (Issue #901), design §4 Phase 2a: the service-order loop under the shop model --
 * order (from the menu) -> cook -> evaluation -> Pitz + reputation -> chapter -> the materials the Shop sells.
 * The legacy side of every touched path is pinned by ./gameReducer.shopService.flagOff.test.ts.
 */

function score(stars: QualityStars, total = 80) {
  return { total, stars, matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total };
}

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 10, bestStars: 1, timesMade: 1 }));
}

function fresh(shop: ShopProgressState = EMPTY_SHOP_PROGRESS, dex: DexState = [], pitz = 0): GameState {
  return createInitialGameState(dex, STARTER_INGREDIENT_IDS, pitz, {}, [], [], {}, {}, undefined, [], {}, shop);
}

/** What startup does before the first round (./startup.ts resolves the entitlement through the port). */
function started(state: GameState): GameState {
  return { ...state, unlockedForShopIngredientIds: activeProgressionModel().resolveEntitlement(state).unlockedForShopIngredientIds };
}

/** The round `state` is on, at RESULT with this score (a guided order unless it is a Free Cooking round). */
function atResult(state: GameState, stars: QualityStars, total = 80): GameState {
  return { ...state, phase: "RESULT", score: score(stars, total), completion: { status: "PASS" } } as GameState;
}

describe("the shop model is selected", () => {
  it("the flag says shop and the table is complete, so the shop rules run", () => {
    expect(activeProgressionModel().id).toBe("shop");
    expect(SHOP_MODEL_ACTIVE).toBe(true);
    expect(activeShopCatalog().interim).toBe(true);
  });
});

describe("the first order (Q2)", () => {
  it("a new save opens on a Mito order for margherita -- an order, not a Free Cooking round", () => {
    const s = fresh();
    expect(s.phase).toBe("ORDER");
    expect(s.freeCook).toBe(false);
    expect(s.roundKind).toBe("GUIDED");
    expect(s.recipe.id).toBe("margherita");
    expect(getDexEntry(s.dex, "margherita")).toBeUndefined();
    expect(canStartGuidedRound("margherita", s)).toBe(true);
    expect(gameReducer(s, { type: "BEGIN_PREPARE" }).phase).toBe("PREPARE");
  });

  it("serving it registers margherita in the Dex but is not a discovery (no +50, no discovery reputation)", () => {
    const after = gameReducer(atResult(fresh(), 3), { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(getDexEntry(after.dex, "margherita")?.discovered).toBe(true);
    expect(after.justDiscovered).toBe(false);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(0);
    expect(after.shop.reputation).toBe(3);
  });
});

describe("a served order earns Pitz (quality-linked) and reputation (by stars)", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 5],
    [5, 8],
  ] as const)("★%i -> reputation +%i", (stars, gain) => {
    const after = gameReducer(atResult(fresh({ reputation: 0, grantedMenuRecipeIds: [] }, dexOf(["margherita"])), stars), {
      type: "REGISTER_TO_DEX",
    });
    expect(after.shop.reputation).toBe(gain);
    expect(after.lastReputationGain).toMatchObject({ gained: gain, before: 0, after: gain, chapterBefore: 1, chapterAfter: 1 });
  });

  it("the Pitz credit is the existing quality-linked formula, read through the evaluation adapter", () => {
    const before = atResult(fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita"]), 100), 4, 92);
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toEqual(applyPitzCredit(getRecipe("margherita")!.baseRewardPitz, 92, 100, false));
  });

  it("the reputation is cumulative across orders", () => {
    let s = fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita"]));
    for (let i = 0; i < 4; i++) {
      s = gameReducer(atResult(s, 5), { type: "REGISTER_TO_DEX" });
      s = gameReducer(s, { type: "PLAY_AGAIN" });
    }
    expect(s.shop.reputation).toBe(32);
  });
});

describe("the reputation opens chapters, and chapters open materials", () => {
  const floors = REPUTATION_TABLE.chapterFloors as readonly number[];

  it("crossing a chapter floor opens that chapter's materials in the same transition (and RESULT announces them)", () => {
    const start = started(fresh({ reputation: floors[1] - 1, grantedMenuRecipeIds: [] }, dexOf(["margherita"])));
    const catalog = activeShopCatalog();
    const chapter2 = start.unlockedForShopIngredientIds.length;
    expect(start.unlockedForShopIngredientIds.every((id) => (materialChapterOf(id, catalog) ?? 99) <= 1)).toBe(true);
    const after = gameReducer(atResult(start, 2), { type: "REGISTER_TO_DEX" });
    expect(after.shop.reputation).toBe(floors[1] + 1);
    expect(after.lastReputationGain).toMatchObject({ chapterBefore: 1, chapterAfter: 2, nextFloor: floors[2] });
    const opened = after.unlockedForShopIngredientIds.slice(chapter2);
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((id) => materialChapterOf(id, catalog) === 2)).toBe(true);
    expect(after.lastMaterialUnlockNotice?.ingredientIds).toEqual(opened);
  });

  it("at reputation 0 only chapter-1 materials are sold; the ladder's discovered count is not read", () => {
    const s = started(fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita", "pepperoni", "quattro-formaggi"])));
    const catalog = activeShopCatalog();
    expect(s.unlockedForShopIngredientIds.length).toBeGreaterThan(0);
    expect(s.unlockedForShopIngredientIds.every((id) => materialChapterOf(id, catalog) === 1)).toBe(true);
  });

  // Phase 2b: the status also carries the owner's title (./shopRank.ts) -- the chapter fields are unchanged.
  it("HOME's status line reads the same chapter", () => {
    const rank = (level: number) => SHOP_RANKS[level - 1];
    expect(shopReputationStatus({ reputation: 0, grantedMenuRecipeIds: [] })).toEqual({
      reputation: 0,
      chapter: 1,
      nextFloor: 40,
      rank: rank(1),
      nextRank: rank(2),
      nextMaterialRank: rank(3),
    });
    expect(shopReputationStatus({ reputation: 115, grantedMenuRecipeIds: [] })).toEqual({
      reputation: 115,
      chapter: 3,
      nextFloor: 210,
      rank: rank(4),
      nextRank: rank(5),
      nextMaterialRank: rank(5),
    });
    expect(shopReputationStatus({ reputation: 400, grantedMenuRecipeIds: [] })).toEqual({
      reputation: 400,
      chapter: 5,
      nextFloor: null,
      rank: rank(6),
      nextRank: null,
      nextMaterialRank: null,
    });
  });
});

describe("menu development (Free Cooking) keeps its Pitz bonus and adds the reputation bonus", () => {
  it("a first discovery: +50 Pitz (unchanged) and reputation +3 (no order gain)", () => {
    const s = gameReducer(fresh(), { type: "START_FREE_COOK" });
    const result = { ...atResult(s, 5), recipe: getRecipe("margherita")! } as GameState;
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.justDiscovered).toBe(true);
    expect(after.lastPitzCredit?.discoveryBonusPitz).toBe(50);
    expect(after.shop.reputation).toBe(3);
  });

  it("an already discovered recipe made in Free Cooking earns no reputation", () => {
    const s = gameReducer(fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita"])), { type: "START_FREE_COOK" });
    const result = { ...atResult(s, 5), recipe: getRecipe("margherita")! } as GameState;
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.shop.reputation).toBe(0);
    expect(after.lastReputationGain?.gained).toBe(0);
  });
});

describe("the order pool is the menu ∩ cookable", () => {
  it("only menu recipes are ordered (the first menu + the discovered ones)", () => {
    let s = fresh(EMPTY_SHOP_PROGRESS, dexOf(["pepperoni"]), 0);
    const menu = new Set(activeProgressionModel().menuRecipeIds(s));
    expect([...menu].sort()).toEqual(["margherita", "pepperoni"]);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      s = gameReducer(s, { type: "PLAY_AGAIN" });
      expect(s.freeCook).toBe(false);
      seen.add(s.recipe.id);
    }
    // pepperoni's own material is not owned here, so only margherita is cookable.
    expect([...seen]).toEqual(["margherita"]);
  });

  it("a granted recipe is on the menu without a discovery", () => {
    const s = fresh({ reputation: 0, grantedMenuRecipeIds: ["marinara" as RecipeId] });
    expect(activeProgressionModel().isOnMenu("marinara", s)).toBe(true);
    expect(activeProgressionModel().isOnMenu("pepperoni", s)).toBe(false);
  });
});

describe("Lunch Rush keeps its own reward (R7)", () => {
  it("MISSION_NEXT_ORDER never raises the reputation", () => {
    const base = gameReducer(fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita"])), { type: "MISSION_RESET_ORDER" });
    expect(base.isMissionRound).toBe(true);
    const served = gameReducer(atResult(base, 5), { type: "MISSION_NEXT_ORDER" });
    expect(served.shop.reputation).toBe(0);
    expect(served.lastReputationGain).toBeNull();
  });

  it("a Lunch Rush REGISTER_TO_DEX backstop adds no reputation either", () => {
    const base = gameReducer(fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita"])), { type: "MISSION_RESET_ORDER" });
    const after = gameReducer(atResult(base, 5), { type: "REGISTER_TO_DEX" });
    expect(after.shop.reputation).toBe(0);
  });
});
