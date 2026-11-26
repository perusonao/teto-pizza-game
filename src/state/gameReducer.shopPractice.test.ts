import { describe, expect, it, vi } from "vitest";

// B案 Phase 2b: this file runs the reducer under the shop model (what `?progression=shop` selects on Preview). The flag is a
// per-page-load constant, so the module is replaced before anything imports it (same as ./gameReducer.shopService.test.ts).
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import { SHOP_COPY_ACTIVE } from "../logic/progression/shopCopy";
import { SHOP_MODEL_ACTIVE } from "../logic/progression/shopStatus";
import { applyPitzCredit } from "../logic/pitzReward";
import type { QualityStars } from "../logic/scoring";
import { getDexEntry, type DexEntry, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { readStoredPendingRound, type PendingRound } from "./pendingRound";
import { settlePendingRound } from "./pendingRoundSettle";
import { describeSettledRound } from "./roundNoticeCopy";
import { completionPolicyForRound, isCookingStepRound, registersToDexAtResult } from "./roundKind";
import { fugazzaAtBake } from "./testSupport/r8Harness";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * B案 Phase 2b (Issue #901), design §6 Q7: under the shop model Pizza Select is a no-reward 「練習」. A recipe the player picks
 * (Pizza Select, a retry) is a `PRACTICE` round: cooked and registered to the Dex like a guided round, but no Pitz (quality,
 * menu-development bonus, efficiency) and no reputation. A service order (the FREE Mito order) pays exactly as in Phase 2a. The
 * R8 journal carries the kind, so a practice round completed from it stays practice. The legacy side is pinned by
 * ./gameReducer.shopPractice.flagOff.test.ts.
 */

function score(stars: QualityStars, total = 80) {
  return { total, stars, matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total };
}

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 10, bestStars: 1, timesMade: 1 }));
}

function fresh(shop: ShopProgressState = EMPTY_SHOP_PROGRESS, dex: DexState = dexOf(["margherita"]), pitz = 100): GameState {
  return createInitialGameState(dex, STARTER_INGREDIENT_IDS, pitz, {}, [], [], {}, {}, undefined, [], {}, shop);
}

/** The round `state` is on, at RESULT with this score, as if cooked from PREPARE (the cooking clock ran, so CT2 could pay). */
function atResult(state: GameState, stars: QualityStars, total = 80): GameState {
  return {
    ...state,
    phase: "RESULT",
    score: score(stars, total),
    completion: { status: "PASS" },
    cookingTiming: { startedAt: 0, pausedAt: null, accumulatedPauseMs: 0, completedMs: 30_000 },
  } as GameState;
}

const select = (s: GameState) => gameReducer(s, { type: "SELECT_RECIPE", recipeId: "margherita", now: 0 });

describe("the shop model is selected", () => {
  it("the flag says shop and the table is complete; the copy switch agrees with the model switch", () => {
    expect(activeProgressionModel().id).toBe("shop");
    expect(SHOP_MODEL_ACTIVE).toBe(true);
    expect(SHOP_COPY_ACTIVE).toBe(SHOP_MODEL_ACTIVE);
  });
});

describe("which rounds are practice", () => {
  it("Pizza Select (SELECT_RECIPE) starts a PRACTICE round at PREPARE", () => {
    const s = select(fresh());
    expect(s.phase).toBe("PREPARE");
    expect(s.roundKind).toBe("PRACTICE");
    expect(s.freeCook).toBe(false);
    expect(s.isMissionRound).toBe(false);
    expect(s.recipe.id).toBe("margherita");
  });

  it("the service order (the FREE Mito order) stays GUIDED -- an order, as in Phase 2a", () => {
    const s = gameReducer(fresh(), { type: "PLAY_AGAIN" });
    expect(s.phase).toBe("ORDER");
    expect(s.roundKind).toBe("GUIDED");
    expect(gameReducer(s, { type: "BEGIN_PREPARE" }).roundKind).toBe("GUIDED");
  });

  it("a retry is practice, whether the round was practice or an order (a retry is the player's pick, not a customer's)", () => {
    const practice = gameReducer(atResult(select(fresh()), 3), { type: "REGISTER_TO_DEX" });
    expect(gameReducer(practice, { type: "RETRY_SAME_RECIPE", now: 0 }).roundKind).toBe("PRACTICE");
    const order = gameReducer(atResult(fresh(), 3), { type: "REGISTER_TO_DEX" });
    expect(order.roundKind).toBe("GUIDED");
    expect(gameReducer(order, { type: "RETRY_SAME_RECIPE", now: 0 }).roundKind).toBe("PRACTICE");
  });

  it("Free Cooking (menu development) is not practice", () => {
    expect(gameReducer(fresh(), { type: "START_FREE_COOK", now: 0 }).roundKind).toBe("FREE_COOK");
  });

  it("「次の注文へ」 after practice draws a service order again", () => {
    const practice = gameReducer(atResult(select(fresh()), 3), { type: "REGISTER_TO_DEX" });
    expect(gameReducer(practice, { type: "PLAY_AGAIN" }).roundKind).toBe("GUIDED");
  });

  it("a practice round cooks like a guided one: same completion policy, same step affordances, registers to the Dex", () => {
    const practice = { roundKind: "PRACTICE" as const };
    const guided = { roundKind: "GUIDED" as const };
    expect(completionPolicyForRound(practice)).toBe(completionPolicyForRound(guided));
    expect(isCookingStepRound("PRACTICE")).toBe(true);
    expect(registersToDexAtResult(practice)).toBe(true);
    expect(select(fresh()).cookingProfile).toEqual(gameReducer(gameReducer(fresh(), { type: "PLAY_AGAIN" }), { type: "BEGIN_PREPARE" }).cookingProfile);
  });
});

describe("a practice round earns no Pitz and no reputation (Q7)", () => {
  it.each([1, 3, 5] as const)("★%i practice: no Pitz credit, no efficiency bonus, no reputation; the Dex still records it", (stars) => {
    const before = atResult(select(fresh()), stars, 90);
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(after.pitzBalance).toBe(100);
    expect(after.lastPitzCredit).toBeNull();
    expect(after.lastEfficiencyCredit).toBeNull();
    expect(after.shop).toBe(before.shop);
    expect(after.shop.reputation).toBe(0);
    expect(after.lastReputationGain).toBeNull();
    expect(after.justDiscovered).toBe(false);
    // the Dex is a record, not a reward: BEST / timesMade are kept as for any cooked pizza
    expect(getDexEntry(after.dex, "margherita")?.timesMade).toBe(2);
  });

  it("the same pizza as a service order still pays Pitz and reputation exactly as in Phase 2a", () => {
    const before = atResult(gameReducer(fresh(), { type: "PLAY_AGAIN" }), 4, 92);
    expect(before.roundKind).toBe("GUIDED");
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toEqual(applyPitzCredit(getRecipe("margherita")!.baseRewardPitz, 92, 100, false));
    expect(after.shop.reputation).toBe(5);
    expect(after.lastReputationGain).toMatchObject({ gained: 5, before: 0, after: 5 });
    expect(after.lastEfficiencyCredit).not.toBeNull();
  });

  it("practice never opens a chapter's materials (the reputation does not move)", () => {
    // what startup does before the first round (./startup.ts resolves the entitlement through the port)
    const created = fresh({ reputation: 39, grantedMenuRecipeIds: [] });
    const start = { ...created, unlockedForShopIngredientIds: activeProgressionModel().resolveEntitlement(created).unlockedForShopIngredientIds };
    const after = gameReducer(atResult(select(start), 5), { type: "REGISTER_TO_DEX" });
    expect(after.shop.reputation).toBe(39);
    expect(after.unlockedForShopIngredientIds).toEqual(start.unlockedForShopIngredientIds);
    expect(after.lastMaterialUnlockNotice).toBeNull();
    // the same ★5 as an order crosses 40 and opens them
    const order = gameReducer(atResult(gameReducer(start, { type: "PLAY_AGAIN" }), 5), { type: "REGISTER_TO_DEX" });
    expect(order.shop.reputation).toBe(47);
    expect(order.lastMaterialUnlockNotice).not.toBeNull();
  });

  it("a menu-development reward is never paid from practice, even if the pizza matches another recipe", () => {
    const s = select(fresh());
    // a guided round's pizza is still run through the matcher; whatever it writes, no bonus is paid
    const after = gameReducer(atResult(s, 5), { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toBeNull();
    expect(after.shop.reputation).toBe(0);
  });
});

describe("R8: the journal keeps the kind -- a resumed practice round is never turned into an order", () => {
  /** Fugazza (a CUT recipe) on the menu, baked with a journal; `kind` picks practice or order. */
  function bakedWithJournal(kind: "PRACTICE" | "GUIDED") {
    const base = fresh(EMPTY_SHOP_PROGRESS, dexOf(["margherita", "fugazza"]), 40);
    const atBake = { ...fugazzaAtBake({ onion: 20 }, { base: { ...base, ownedIngredientIds: [...base.ownedIngredientIds, "onion"] } }), roundKind: kind };
    const baked = gameReducer(atBake, { type: "CONFIRM_BAKE", value: 70, roundId: "round-1", now: 5 });
    expect(baked.phase).toBe("POST_BAKE");
    return baked;
  }

  it("a practice bake writes `practice: true` on its GUIDED journal; an order bake does not", () => {
    expect(bakedWithJournal("PRACTICE").pendingRound).toMatchObject({ kind: "GUIDED", recipeId: "fugazza", practice: true });
    expect(bakedWithJournal("GUIDED").pendingRound).not.toHaveProperty("practice");
  });

  it("the stored journal reads back with the kind (JSON round trip)", () => {
    const journal = bakedWithJournal("PRACTICE").pendingRound!;
    const read = readStoredPendingRound(JSON.parse(JSON.stringify(journal)));
    expect(read).toEqual({ kind: "round", round: journal });
  });

  it("settling a practice journal pays nothing and says so; settling an order journal pays as finishing it by hand", () => {
    const practice = bakedWithJournal("PRACTICE");
    const settledPractice = settlePendingRound(practice, practice.pendingRound!)!;
    expect(settledPractice.settled.settled).toMatchObject({ outcome: "REGISTERED", earnedPitz: 0, practice: true });
    expect(settledPractice.state.pitzBalance).toBe(practice.pitzBalance);
    expect(settledPractice.state.shop.reputation).toBe(0);
    expect(getDexEntry(settledPractice.state.dex, "fugazza")?.timesMade).toBe(2);
    expect(describeSettledRound(settledPractice.settled.settled!).lines).toContain("練習のピザなので、Pitz・評判は入りません。");

    const order = bakedWithJournal("GUIDED");
    const settledOrder = settlePendingRound(order, order.pendingRound!)!;
    expect(settledOrder.settled.settled?.earnedPitz).toBeGreaterThan(0);
    expect(settledOrder.settled.settled).not.toHaveProperty("practice");
    expect(settledOrder.state.shop.reputation).toBeGreaterThan(0);
  });

  it("a practice round finished by hand and the same journal settled agree (no Pitz, no reputation, same Dex)", () => {
    const practice = bakedWithJournal("PRACTICE");
    const byHand = gameReducer(walkPostBakeToResult(practice), { type: "REGISTER_TO_DEX" });
    const settled = settlePendingRound(practice, practice.pendingRound!)!;
    expect(byHand.lastPitzCredit).toBeNull();
    expect(byHand.pitzBalance).toBe(settled.state.pitzBalance);
    expect(byHand.shop).toEqual(settled.state.shop);
    expect(byHand.dex).toEqual(settled.state.dex);
  });

  it("a journal whose `practice` is not `true`, or sits on a Free Cooking journal, is held as corrupt (never guessed)", () => {
    const journal: PendingRound = bakedWithJournal("PRACTICE").pendingRound!;
    expect(readStoredPendingRound({ ...journal, practice: "yes" })).toEqual({ kind: "held", reason: "corrupt" });
    expect(readStoredPendingRound({ ...journal, practice: false })).toEqual({ kind: "held", reason: "corrupt" });
    const { recipeId: _r, ...free } = journal;
    expect(readStoredPendingRound({ ...free, kind: "FREE_COOK" })).toEqual({ kind: "held", reason: "corrupt" });
  });
});
