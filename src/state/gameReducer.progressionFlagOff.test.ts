import "../test/legacyProgression";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, countsTowardLadder, getRecipe, type RecipeId } from "../data/recipes";
import { LEGACY_PROGRESSION, activeProgressionModel, type ProgressionInputs } from "../logic/progression/progressionModel";
import { PROGRESSION_MODEL_ID } from "../logic/progression/progressionModelFlag";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { resolveShopEntitlement } from "./materialEntitlement";
import { SAVE_STORAGE_KEY } from "./persistence";
import { buildStartup } from "./startup";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * B案 Phase 1a (Issue #901), design §3.4 `gameReducer.progressionFlagOff`: with legacy selected,
 * the three entitlement call sites that now go through the progression port -- REGISTER_TO_DEX,
 * MISSION_NEXT_ORDER and the startup load -- produce exactly the state the pre-1a code produced.
 *
 * "The pre-1a code" is reproduced literally: the port's method is replaced by the call the site made before 1a
 * (`resolveShopEntitlement(dex, ownedIngredientIds, unlockedForShopIngredientIds)`), the same transition is run again, and
 * the two whole states must be equal. The port is also checked to have been called with the transition's new Dex.
 */

const PRE_1A = (inputs: ProgressionInputs) =>
  resolveShopEntitlement(inputs.dex, inputs.ownedIngredientIds, inputs.unlockedForShopIngredientIds);

/** Runs `run` through the port, then again with the pre-1a call in its place; returns both results and the port's inputs. */
function throughPortAndPre1a<T>(run: () => T): { port: T; pre1a: T; calls: ProgressionInputs[] } {
  const spy = vi.spyOn(LEGACY_PROGRESSION, "resolveEntitlement");
  const port = run();
  const calls = spy.mock.calls.map(([inputs]) => inputs);
  spy.mockImplementation(PRE_1A);
  const pre1a = run();
  spy.mockRestore();
  return { port, pre1a, calls };
}

afterEach(() => vi.restoreAllMocks());

const CREDITED: RecipeId[] = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);

function dexOf(ids: readonly string[], stars: DexEntry["bestStars"] = 1): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 10, bestStars: stars, timesMade: 1 }));
}

/** A FREE round sitting at RESULT, about to register `recipeId` (stars as given). */
function freeResult(dex: DexState, recipeId: RecipeId, stars: 1 | 2 | 3 | 4 | 5, unlocked: readonly string[] = []): GameState {
  const base = createInitialGameState(dex, STARTER_INGREDIENT_IDS, 0, {}, [], unlocked);
  return {
    ...base,
    phase: "RESULT",
    recipe: getRecipe(recipeId)!,
    score: { total: 90, stars, matchScore: 90, ingredientScore: 90, placementScore: 90, bakeScore: 90 },
  } as GameState;
}

/** A Lunch Rush round sitting at RESULT, about to serve `recipeId`. */
function missionResult(dex: DexState, recipeId: RecipeId, stars: 1 | 2 | 3 | 4 | 5, unlocked: readonly string[]): GameState {
  const base = gameReducer(createInitialGameState(dex, [], 0, {}, [], unlocked), { type: "MISSION_RESET_ORDER" });
  return {
    ...base,
    phase: "RESULT",
    recipe: getRecipe(recipeId)!,
    score: { total: 90, stars, matchScore: 90, ingredientScore: 90, placementScore: 90, bakeScore: 90 },
  } as GameState;
}

describe("progression flag OFF (production default)", () => {
  it("the build runs the legacy model", () => {
    expect(PROGRESSION_MODEL_ID).toBe("legacy");
    expect(activeProgressionModel()).toBe(LEGACY_PROGRESSION);
  });

  it("REGISTER_TO_DEX: a first discovery that unlocks a material -- same state as pre-1a, port fed the new Dex", () => {
    const before = freeResult([], "margherita", 3);
    const { port, pre1a, calls } = throughPortAndPre1a(() => gameReducer(before, { type: "REGISTER_TO_DEX" }));
    expect(port).toEqual(pre1a);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.dex).toBe(port.dex);
    expect(calls[0]!.ownedIngredientIds).toBe(before.ownedIngredientIds);
    expect(calls[0]!.unlockedForShopIngredientIds).toBe(before.unlockedForShopIngredientIds);
    // The transition really unlocked something (the case is not vacuous).
    expect(port.unlockedForShopIngredientIds.length).toBeGreaterThan(0);
    expect(port.lastMaterialUnlockNotice).not.toBeNull();
  });

  it("REGISTER_TO_DEX: a re-registration that unlocks nothing keeps the ledger by reference", () => {
    const dex = dexOf(CREDITED.slice(0, 10));
    const ledger = resolveShopEntitlement(dex, STARTER_INGREDIENT_IDS, []).unlockedForShopIngredientIds;
    const before = freeResult(dex, CREDITED[0]!, 1, ledger);
    const { port, pre1a } = throughPortAndPre1a(() => gameReducer(before, { type: "REGISTER_TO_DEX" }));
    expect(port).toEqual(pre1a);
    expect(port.unlockedForShopIngredientIds).toBe(ledger);
    expect(port.lastMaterialUnlockNotice).toBeNull();
  });

  it("MISSION_NEXT_ORDER: a serve that crosses the 120★ gate -- same state as pre-1a", () => {
    // 50 credited recipes, the served one at 1★ and the rest summing to 118 (119 total); serving it at 2★ makes 120.
    const served = CREDITED[0]!;
    const others = CREDITED.slice(1, 50);
    let left = 118;
    const dex: DexState = [
      { recipeId: served, discovered: true, bestScore: 10, bestStars: 1, timesMade: 1 },
      ...others.map((recipeId, j): DexEntry => {
        const stars = Math.max(1, Math.min(5, left - (others.length - j - 1))); // leave at least 1★ for each remaining recipe
        left -= stars;
        return { recipeId, discovered: true, bestScore: 10, bestStars: stars as DexEntry["bestStars"], timesMade: 1 };
      }),
    ];
    const ledger = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
    const before = missionResult(dex, served, 2, ledger);
    const { port, pre1a, calls } = throughPortAndPre1a(() => gameReducer(before, { type: "MISSION_NEXT_ORDER" }));
    expect(port).toEqual(pre1a);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.dex).toBe(port.dex);
    expect(port.unlockedForShopIngredientIds).toContain("goat-cheese");
    expect(port.missionMaterialUnlockIds).toEqual(["goat-cheese"]);
  });

  it("startup: an existing save is migrated to the same state as pre-1a", () => {
    const dex = dexOf(CREDITED.slice(0, 12), 2);
    const raw = JSON.stringify({
      schemaVersion: 2,
      dex,
      pitzBalance: 40,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      unlockedForShopIngredientIds: [],
      missionBest: {},
      inventory: {},
    });
    const { port, pre1a, calls } = throughPortAndPre1a(() => buildStartup(memoryStorage({ [SAVE_STORAGE_KEY]: raw })));
    expect(port).toEqual(pre1a);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.dex).toEqual(dex);
    expect(port.state.unlockedForShopIngredientIds).toEqual(resolveShopEntitlement(dex, STARTER_INGREDIENT_IDS, []).unlockedForShopIngredientIds);
    expect(port.state.unlockedForShopIngredientIds.length).toBeGreaterThan(0);
  });

  it("startup: no save -- same state as pre-1a", () => {
    const { port, pre1a } = throughPortAndPre1a(() => buildStartup(memoryStorage()));
    expect(port).toEqual(pre1a);
  });
});
