import { describe, expect, it, vi } from "vitest";

// B案 Phase 3c: this file runs the reducer under the shop model (what `?progression=shop` selects on Preview). The flag is a
// per-page-load constant, so the module is replaced before anything imports it.
vi.mock("../logic/progression/progressionModelFlag", () => ({
  PROGRESSION_MODEL_ID: "shop",
  PROGRESSION_MODEL_DEV_KEY: "teto.dev.progressionModel",
  progressionModelId: () => "shop",
}));

import { INGREDIENTS } from "../data/ingredients";
import { MENU_CATALOG } from "../data/menuCatalog";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { RESEARCH_POINTS_BY_STAGE } from "../logic/progression/researchPoints";
import { researchPointBalanceOf, type ShopProgressState } from "../logic/progression/shopProgress";
import type { QualityStars } from "../logic/scoring";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { SAVE_STORAGE_KEY } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { onionPizza, SEED_SAVE, Tab } from "./testSupport/r8Harness";

/**
 * B案 Phase 3c (Issue #901, Owner 2026-11-27): a Free Cooking trial (menu development) earns research points once its result is
 * out. Phase 3f takes the adopted match stage capped by the research target (stage 1 without a match). Never for an order, a
 * practice round, Lunch Rush, or a trial left before the bake; never twice for one trial (a repeated dispatch, a reload, a settle).
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FULL_STOCK = Object.fromEntries(ALL_IDS.map((id) => [id, 99]));
const firstOfStage = (stage: number) => MENU_CATALOG.find((e) => e.chapter === stage)!.recipeId as RecipeId;

function score(stars: QualityStars, total = 80) {
  return { total, stars, matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total };
}
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 60, bestStars: 2, timesMade: 1 }));
const shopAt = (reputation: number, extra: Partial<ShopProgressState> = {}): ShopProgressState => ({
  reputation,
  grantedMenuRecipeIds: [],
  ...extra,
});
function stocked(shop: ShopProgressState, dexIds: readonly string[] = ["margherita"]): GameState {
  return createInitialGameState(dexOf(dexIds), ALL_IDS, 0, FULL_STOCK, [], [], {}, {}, undefined, [], {}, shop);
}
const balance = (state: GameState) => researchPointBalanceOf(state.shop);

/** A Free Cooking round at RESULT whose pizza matched `recipeId` (null = no match: an original pizza's RESULT shape). */
function freeCookResult(state: GameState, recipeId: RecipeId | null, options: { researchTargetId?: string; failed?: boolean } = {}): GameState {
  const s = gameReducer(state, { type: "START_FREE_COOK", ...(options.researchTargetId ? { researchTargetId: options.researchTargetId } : {}) });
  expect(s.freeCook).toBe(true);
  const completion = options.failed ? { status: "FAILED", failures: [{ kind: "OVERBAKED" }] } : { status: "PASS" };
  return recipeId
    ? ({ ...s, recipe: getRecipe(recipeId)!, phase: "RESULT", score: score(3), completion } as GameState)
    : ({ ...s, phase: "RESULT", score: null, completion } as GameState);
}

describe("how much one trial earns by stage", () => {
  it("an adopted exact match earns its stage's entry, stage 1..5", () => {
    for (let stage = 1; stage <= 5; stage++) {
      // A reputation high enough that every stage is open (an exact match before its stage is the Phase 3b 判明 path, which
      // earns the same: the stage is the recipe's either way).
      const after = gameReducer(freeCookResult(stocked(shopAt(400)), firstOfStage(stage)), { type: "REGISTER_TO_DEX" });
      expect(after.lastResearchPointGain, `stage ${stage}`).toEqual({
        earned: RESEARCH_POINTS_BY_STAGE[stage - 1],
        stage,
        balanceAfter: RESEARCH_POINTS_BY_STAGE[stage - 1],
      });
      expect(balance(after)).toBe(RESEARCH_POINTS_BY_STAGE[stage - 1]);
    }
  });

  it("an exact match before its stage opens (判明) earns by the recipe's stage too", () => {
    const after = gameReducer(freeCookResult(stocked(shopAt(10)), "meat-lovers" as RecipeId), { type: "REGISTER_TO_DEX" });
    expect(after.lastIdentifiedAwaiting?.recipeId).toBe("meat-lovers");
    expect(after.lastResearchPointGain).toMatchObject({ earned: 2, stage: 2 });
  });

  it("a high-stage research target cannot raise the points for an easier match or an original pizza", () => {
    const base = stocked(shopAt(400), ["margherita"]);
    const target = firstOfStage(4);
    const started = gameReducer(base, { type: "START_FREE_COOK", researchTargetId: target });
    expect(started.researchTargetId).toBe(target);
    const matchedOther = gameReducer(freeCookResult(base, firstOfStage(2), { researchTargetId: target }), { type: "REGISTER_TO_DEX" });
    expect(matchedOther.lastResearchPointGain).toEqual({ earned: 2, stage: 2, balanceAfter: 2 });
    const original = gameReducer(freeCookResult(base, null, { researchTargetId: target }), { type: "REGISTER_TO_DEX" });
    expect(original.lastResearchPointGain).toEqual({ earned: 1, stage: 1, balanceAfter: 1 });
  });

  it("a low-stage research target caps a higher-stage exact match", () => {
    const base = stocked(shopAt(400));
    const atResult = freeCookResult(base, firstOfStage(4), { researchTargetId: firstOfStage(2) });
    const after = gameReducer(atResult, { type: "REGISTER_TO_DEX" });
    expect(after.lastResearchPointGain).toEqual({ earned: 2, stage: 2, balanceAfter: 2 });
  });

  it("no target and no adopted match (an original pizza, a non-adopted match): stage 1", () => {
    const original = gameReducer(freeCookResult(stocked(shopAt(400)), null), { type: "REGISTER_TO_DEX" });
    expect(original.lastResearchPointGain).toEqual({ earned: 1, stage: 1, balanceAfter: 1 });
    const notAdopted = RECIPES.find((r) => !MENU_CATALOG.some((e) => e.recipeId === r.id))!.id;
    const after = gameReducer(freeCookResult(stocked(shopAt(400)), notAdopted), { type: "REGISTER_TO_DEX" });
    expect(after.lastResearchPointGain).toMatchObject({ earned: 1, stage: 1 });
  });

  it("the pool is shared: trials of different recipes add up", () => {
    let s = stocked(shopAt(400));
    s = gameReducer(freeCookResult(s, firstOfStage(1)), { type: "REGISTER_TO_DEX" });
    s = gameReducer(freeCookResult(s, firstOfStage(3)), { type: "REGISTER_TO_DEX" });
    s = gameReducer(freeCookResult(s, null), { type: "REGISTER_TO_DEX" });
    expect(balance(s)).toBe(1 + 3 + 1);
    expect(s.lastResearchPointGain?.balanceAfter).toBe(5);
  });
});

describe("a failed (burnt) trial still has a result and earns -- once", () => {
  it("matched but failed: earns, stays at RESULT, and a repeated dispatch pays nothing more", () => {
    const at = freeCookResult(stocked(shopAt(400)), firstOfStage(2), { failed: true });
    const once = gameReducer(at, { type: "REGISTER_TO_DEX" });
    expect(once.phase).toBe("RESULT");
    expect(once.lastResearchPointGain).toMatchObject({ earned: 2 });
    const twice = gameReducer(once, { type: "REGISTER_TO_DEX" });
    expect(twice).toBe(once);
    expect(balance(twice)).toBe(2);
  });

  it("unmatched and failed: earns stage 1, once", () => {
    const once = gameReducer(freeCookResult(stocked(shopAt(0)), null, { failed: true }), { type: "REGISTER_TO_DEX" });
    expect(once.phase).toBe("RESULT");
    expect(balance(once)).toBe(1);
    expect(gameReducer(once, { type: "REGISTER_TO_DEX" })).toBe(once);
  });
});

describe("only a Free Cooking trial earns", () => {
  it("a served order (guided round) earns none", () => {
    const s = stocked(shopAt(0));
    expect(s.freeCook).toBe(false);
    const order = { ...s, recipe: getRecipe("margherita")!, phase: "RESULT", score: score(4), completion: { status: "PASS" } } as GameState;
    const after = gameReducer(order, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(after.lastReputationGain).not.toBeNull();
    expect(after.lastResearchPointGain).toBeNull();
    expect(balance(after)).toBe(0);
  });

  it("practice (Pizza Select) earns none", () => {
    const picked = gameReducer(stocked(shopAt(0)), { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(picked.roundKind).toBe("PRACTICE");
    const after = gameReducer({ ...picked, phase: "RESULT", score: score(5), completion: { status: "PASS" } } as GameState, { type: "REGISTER_TO_DEX" });
    expect(after.lastResearchPointGain).toBeNull();
    expect(balance(after)).toBe(0);
  });

  it("a Lunch Rush round earns none", () => {
    const s = stocked(shopAt(0));
    const mission = { ...s, isMissionRound: true, roundKind: "LUNCH_RUSH", recipe: getRecipe("margherita")!, phase: "RESULT", score: score(4), completion: { status: "PASS" } } as GameState;
    expect(gameReducer(mission, { type: "REGISTER_TO_DEX" }).lastResearchPointGain).toBeNull();
  });

  it("a dispatch before the result (a trial still in PREPARE / BAKE) earns none", () => {
    const started = gameReducer(stocked(shopAt(0)), { type: "START_FREE_COOK" });
    expect(started.phase).not.toBe("RESULT");
    const after = gameReducer(started, { type: "REGISTER_TO_DEX" });
    expect(balance(after)).toBe(0);
    expect(after.lastResearchPointGain).toBeNull();
  });

  it("the next round starts with no gain shown (RESULT shows it once)", () => {
    const earned = gameReducer(freeCookResult(stocked(shopAt(0)), firstOfStage(1)), { type: "REGISTER_TO_DEX" });
    expect(earned.lastResearchPointGain).not.toBeNull();
    const next = gameReducer(earned, { type: "RETRY_SAME_RECIPE" });
    expect(next.lastResearchPointGain).toBeNull();
    expect(balance(next)).toBe(1);
  });
});

describe("the real save path: bake -> save -> reload (R8 round commits)", () => {
  /** A Free Cooking fugazza (stage 1) on `tab`, at BAKE. */
  function freeCookFugazzaAtBake(tab: Tab): void {
    const started = gameReducer(tab.state, { type: "START_FREE_COOK" });
    expect(started.freeCook).toBe(true);
    tab.setRound(gameReducer({ ...started, pizza: onionPizza(4) }, { type: "START_BAKE" }));
    expect(tab.state.phase).toBe("BAKE");
  }
  function finishRound(tab: Tab): void {
    for (let i = 0; i < 4 && tab.state.phase === "POST_BAKE"; i++) tab.cutAndConfirm();
  }
  const storedPoints = (tab: Tab) => (tab.stored().shopProgress as Record<string, unknown> | undefined)?.researchPointsEarned;

  it("a finished trial earns once, the save holds it, and a reload neither loses nor repeats it", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    expect(balance(tab.state)).toBe(0);
    freeCookFugazzaAtBake(tab);
    expect(tab.bake(70).status).toBe("committed");
    finishRound(tab);
    expect(["RESULT", "DISCOVERED"]).toContain(tab.state.phase);
    expect(tab.state.lastResearchPointGain).toMatchObject({ earned: 1, stage: 1, balanceAfter: 1 });
    expect(storedPoints(tab)).toBe(1);
    // the same RESULT shown again (a re-render dispatches nothing; a stray dispatch is rejected)
    tab.apply({ type: "REGISTER_TO_DEX" });
    expect(balance(tab.state)).toBe(1);
    // reload
    const reloaded = new Tab(storage);
    expect(balance(reloaded.state)).toBe(1);
    expect(reloaded.state.lastResearchPointGain).toBeNull();
    expect(storedPoints(reloaded)).toBe(1);
    // a second trial adds on top of the reloaded balance
    freeCookFugazzaAtBake(reloaded);
    reloaded.bake(70, 5_000, "round-2");
    finishRound(reloaded);
    expect(balance(reloaded.state)).toBe(2);
    expect(balance(new Tab(storage).state)).toBe(2);
  });

  it("a burnt trial earns once too, and survives a reload", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    freeCookFugazzaAtBake(tab);
    expect(tab.bake(100).status).toBe("committed");
    finishRound(tab);
    expect(tab.state.completion?.status).toBe("FAILED");
    expect(tab.state.lastResearchPointGain).toMatchObject({ earned: 1 });
    tab.apply({ type: "REGISTER_TO_DEX" }, { type: "REGISTER_TO_DEX" });
    expect(balance(tab.state)).toBe(1);
    expect(balance(new Tab(storage).state)).toBe(1);
  });

  it("a trial left before the bake (cancelled) earns nothing", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    const started = gameReducer(tab.state, { type: "START_FREE_COOK" });
    tab.setRound({ ...started, pizza: onionPizza(4) });
    tab.goHome();
    expect(balance(tab.state)).toBe(0);
    expect(storedPoints(tab)).toBeUndefined();
    expect(balance(new Tab(storage).state)).toBe(0);
  });

  it("a baked trial completed from its journal (HOME before CUT, or a restart) earns once, and never again on reload", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    freeCookFugazzaAtBake(tab);
    tab.bake(70);
    // Free Cooking waits in FINISH after the bake: the journal holds the round until it is finished or settled.
    expect(tab.state.phase).toBe("POST_BAKE");
    expect(balance(tab.state)).toBe(0);
    // restart while the journal is pending: startup settles it once
    const restarted = new Tab(storage);
    expect(balance(restarted.state)).toBe(1);
    expect(balance(new Tab(storage).state)).toBe(1);
    // leaving for HOME instead (the same settle) on the original tab cannot add a second time over the stored total
    tab.goHome();
    expect(balance(new Tab(storage).state)).toBe(1);
  });
});
