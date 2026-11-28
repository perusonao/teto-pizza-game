import "../test/legacyProgression";
import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { shopCopy, SHOP_COPY_ACTIVE } from "../logic/progression/shopCopy";
import { SHOP_MODEL_ACTIVE } from "../logic/progression/shopStatus";
import { applyPitzCredit } from "../logic/pitzReward";
import type { QualityStars } from "../logic/scoring";
import { type DexEntry, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { settlePendingRound } from "./pendingRoundSettle";
import { describeSettledRound } from "./roundNoticeCopy";
import { fugazzaAtBake } from "./testSupport/r8Harness";

/**
 * B案 Phase 2b (Issue #901): the explicit legacy model is untouched by the practice round.
 * Pizza Select and a retry stay `GUIDED` and pay the FREE Pitz exactly as before, the journal carries no `practice` field, and
 * every wording switch returns the legacy string. The shop side is ./gameReducer.shopPractice.test.ts.
 */

function score(stars: QualityStars, total = 80) {
  return { total, stars, matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total };
}

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 10, bestStars: 1, timesMade: 1 }));
}

function fresh(dex: DexState = dexOf(["margherita"]), pitz = 100): GameState {
  return createInitialGameState(dex, STARTER_INGREDIENT_IDS, pitz);
}

function atResult(state: GameState, stars: QualityStars, total = 80): GameState {
  return { ...state, phase: "RESULT", score: score(stars, total), completion: { status: "PASS" } } as GameState;
}

describe("legacy is the model", () => {
  it("no shop rules and no shop wording", () => {
    expect(activeProgressionModel().id).toBe("legacy");
    expect(SHOP_MODEL_ACTIVE).toBe(false);
    expect(SHOP_COPY_ACTIVE).toBe(false);
    expect(shopCopy("レシピ発見", "メニュー開発")).toBe("レシピ発見");
  });
});

describe("Pizza Select and a retry are the guided rounds they always were", () => {
  it("SELECT_RECIPE starts a GUIDED round (never PRACTICE)", () => {
    const s = gameReducer(fresh(), { type: "SELECT_RECIPE", recipeId: "margherita", now: 0 });
    expect(s.phase).toBe("PREPARE");
    expect(s.roundKind).toBe("GUIDED");
  });

  it("RETRY_SAME_RECIPE stays GUIDED", () => {
    const done = gameReducer(atResult(gameReducer(fresh(), { type: "SELECT_RECIPE", recipeId: "margherita", now: 0 }), 3), {
      type: "REGISTER_TO_DEX",
    });
    expect(gameReducer(done, { type: "RETRY_SAME_RECIPE", now: 0 }).roundKind).toBe("GUIDED");
  });

  it("a Pizza Select round pays the FREE Pitz exactly as before; no reputation is touched", () => {
    const before = atResult(gameReducer(fresh(), { type: "SELECT_RECIPE", recipeId: "margherita", now: 0 }), 4, 92);
    const after = gameReducer(before, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toEqual(applyPitzCredit(getRecipe("margherita")!.baseRewardPitz, 92, 100, false));
    expect(after.pitzBalance).toBe(after.lastPitzCredit!.balanceAfter);
    expect(after.lastReputationGain).toBeNull();
    expect(after.shop).toBe(before.shop);
  });

  it("the journal of a picked round has no `practice` field, and settles paying as before", () => {
    const base = fresh(dexOf(["margherita", "fugazza"]), 40);
    const atBake = fugazzaAtBake({ onion: 20 }, { base: { ...base, ownedIngredientIds: [...base.ownedIngredientIds, "onion"] } });
    expect(atBake.roundKind).toBe("GUIDED");
    const baked = gameReducer(atBake, { type: "CONFIRM_BAKE", value: 70, roundId: "round-1", now: 5 });
    expect(baked.pendingRound).not.toHaveProperty("practice");
    const settled = settlePendingRound(baked, baked.pendingRound!)!;
    expect(settled.settled.settled?.earnedPitz).toBeGreaterThan(0);
    expect(settled.settled.settled).not.toHaveProperty("practice");
    expect(describeSettledRound(settled.settled.settled!).lines.join("\n")).not.toContain("練習");
  });
});
