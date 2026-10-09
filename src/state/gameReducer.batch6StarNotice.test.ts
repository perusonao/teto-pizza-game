import { describe, expect, it } from "vitest";
import { RECIPES, countsTowardLadder, getRecipe } from "../data/recipes";
import { INGREDIENTS, getIngredient } from "../data/ingredients";
import { totalStars } from "../logic/mastery";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { buildMaterialUnlockNotice, resolveShopEntitlement } from "./materialEntitlement";

/**
 * Batch 6 PR-3 (OD-B6-PR3-1/2/6): a star gate crossed in Lunch Rush is announced (once, from
 * `newlyUnlockedMaterialIds` only); load / restore unlock silently; nothing new is persisted.
 */
const CREDITED = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);
const SERVED = CREDITED[0];

/** 50 credited recipes; `SERVED` sits at 1 star, the rest sum to `restStars`. */
function dexWith(restStars: number, servedStars = 1): DexState {
  let left = restStars;
  return CREDITED.slice(0, 50).map((recipeId): DexEntry => {
    if (recipeId === SERVED) return { recipeId, discovered: true, bestScore: 10, bestStars: servedStars as DexEntry["bestStars"], timesMade: 1 };
    const stars = Math.min(5, left);
    left -= stars;
    return { recipeId, discovered: true, bestScore: 10, bestStars: stars as DexEntry["bestStars"], timesMade: 1 };
  });
}

/** A Lunch Rush round sitting at RESULT with `SERVED` baked at `stars`. */
function missionResult(dex: DexState, unlocked: readonly string[], stars: 1 | 2 | 3 | 4 | 5): GameState {
  const base = gameReducer(createInitialGameState(dex, [], 0, {}, [], unlocked), { type: "MISSION_RESET_ORDER" });
  return {
    ...base,
    phase: "RESULT",
    recipe: getRecipe(SERVED)!,
    score: { total: 90, stars, matchScore: 90, ingredientScore: 90, placementScore: 90, bakeScore: 90 },
  } as GameState;
}

const ledgerAt = (dex: DexState) => resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;

describe("Lunch Rush star-gate unlock is announced once", () => {
  it("119 -> 120 stars during a serve unlocks goat-cheese and records it for the run result", () => {
    const dex = dexWith(118); // 118 + 1 = 119
    expect(totalStars(dex)).toBe(119);
    const ledger = ledgerAt(dex);
    expect(ledger).not.toContain("goat-cheese");
    const next = gameReducer(missionResult(dex, ledger, 2), { type: "MISSION_NEXT_ORDER" });
    expect(totalStars(next.dex)).toBe(120);
    expect(next.unlockedForShopIngredientIds).toContain("goat-cheese");
    expect(next.missionMaterialUnlockIds).toEqual(["goat-cheese"]);
    expect(buildMaterialUnlockNotice(next.missionMaterialUnlockIds)?.messageJa).toBe("🆕 新しい材料が入荷：チーズ".replace("チーズ", getIngredient("goat-cheese")!.nameJa));
  });

  it("a serve that stays at 119 announces nothing", () => {
    const dex = dexWith(118);
    const next = gameReducer(missionResult(dex, ledgerAt(dex), 1), { type: "MISSION_NEXT_ORDER" });
    expect(next.missionMaterialUnlockIds).toEqual([]);
    expect(next.unlockedForShopIngredientIds).not.toContain("goat-cheese");
  });

  it("no duplicate: a later serve past the gate, or a repeated serve, adds nothing", () => {
    const dex = dexWith(118);
    const first = gameReducer(missionResult(dex, ledgerAt(dex), 2), { type: "MISSION_NEXT_ORDER" });
    const again = gameReducer(
      { ...missionResult(first.dex, first.unlockedForShopIngredientIds, 5), missionMaterialUnlockIds: first.missionMaterialUnlockIds },
      { type: "MISSION_NEXT_ORDER" },
    );
    expect(again.missionMaterialUnlockIds).toEqual(["goat-cheese"]);
  });

  it("a save already past the gate (ledger already holds it) never announces it", () => {
    const dex = dexWith(150);
    const ledger = ledgerAt(dex);
    expect(ledger).toContain("goat-cheese");
    const next = gameReducer(missionResult(dex, ledger, 5), { type: "MISSION_NEXT_ORDER" });
    expect(next.missionMaterialUnlockIds).toEqual([]);
  });

  it("the record is run-scoped: a new run (MISSION_RESET_ORDER) and a free round empty it", () => {
    const dex = dexWith(118);
    const unlocked = gameReducer(missionResult(dex, ledgerAt(dex), 2), { type: "MISSION_NEXT_ORDER" });
    expect(unlocked.missionMaterialUnlockIds).toEqual(["goat-cheese"]);
    // a run that can actually start (everything owned and stocked) begins with an empty record
    const owned = INGREDIENTS.map((i) => i.id);
    const stocked = { ...unlocked, ownedIngredientIds: owned, inventory: Object.fromEntries(owned.map((id) => [id, 99])) };
    const restarted = gameReducer(stocked, { type: "MISSION_RESET_ORDER" });
    expect(restarted.isMissionRound).toBe(true);
    expect(restarted.missionMaterialUnlockIds).toEqual([]);
    expect(gameReducer(unlocked, { type: "PLAY_AGAIN" }).missionMaterialUnlockIds).toEqual([]);
  });

  it("when the serve leaves nothing cookable (the run ends early) the record is still kept for the result overlay", () => {
    const dex = dexWith(118);
    const ended = gameReducer(missionResult(dex, ledgerAt(dex), 2), { type: "MISSION_NEXT_ORDER" });
    expect(ended.phase).toBe("RESULT");
    expect(ended.missionMaterialUnlockIds).toEqual(["goat-cheese"]);
  });
});

describe("load / restore unlock silently (OD-B6-PR3-2) without a schema change (OD-B6-PR3-6)", () => {
  it("a save at 125 stars unlocks goat-cheese retroactively on load; no notice state is created", () => {
    const dex = dexWith(124);
    const r = resolveShopEntitlement(dex, [], []);
    expect(r.unlockedForShopIngredientIds).toContain("goat-cheese");
    const state = createInitialGameState(dex, [], 0, {}, [], r.unlockedForShopIngredientIds);
    expect(state.lastMaterialUnlockNotice).toBeNull();
    expect(state.missionMaterialUnlockIds).toEqual([]);
    // the ledger is the "already announced" memory: resolving again reports nothing new
    expect(resolveShopEntitlement(dex, [], r.unlockedForShopIngredientIds).newlyUnlockedMaterialIds).toEqual([]);
  });
});
