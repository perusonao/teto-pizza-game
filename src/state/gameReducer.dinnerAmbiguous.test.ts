import { describe, expect, it, vi } from "vitest";
import type { DexEntry } from "./dex";

/**
 * Dinner Mission DM-3R-2 (Issue #250), R14: the runtime's safe fallback when a composition is
 * AMBIGUOUS. The shipped catalog has no collision (DM-3R-1 test 32), so this suite injects one --
 * a future clone of funghi's signature under another recipe id -- through the one catalog the
 * runtime reads, and drives the real reducer: generic bake window, no CUT, anonymous ORIGINAL, no
 * progress, no first-match pick.
 */
vi.mock("../data/discoveryCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/discoveryCatalog")>();
  const funghi = actual.RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "funghi")!;
  return {
    ...actual,
    RECIPE_DISCOVERY_CATALOG: [{ ...funghi, targetId: "aaa-future-clone", recipeId: "margherita" }, ...actual.RECIPE_DISCOVERY_CATALOG],
  };
});

const { INGREDIENTS } = await import("../data/ingredients");
const { buildIdealSauceFixture, getReferencePizza } = await import("../data/referencePizza");
const { FREE_COOK_BAKE_TARGET } = await import("../data/freeCook");
const { createInitialGameState, gameReducer } = await import("./gameReducer");
const { createEmptyPizza } = await import("./pizzaState");

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const T0 = 1_000_000;

describe("R14: an ambiguous composition falls back safely at runtime", () => {
  it("generic window, no CUT, ORIGINAL with no name, nothing completed, stock still consumed", () => {
    const dex: DexEntry[] = ["margherita", "bismarck", "breakfast-pizza", "funghi"].map((recipeId) => ({
      recipeId,
      discovered: true,
      bestScore: 70,
      bestStars: 3 as const,
      timesMade: 1,
    }));
    let state = gameReducer(createInitialGameState(dex, ALL_IDS, 100, { egg: 2, bacon: 3, mushroom: 3 }, [], FINITE_IDS, {}), {
      type: "DINNER_START",
      missionId: "dm-a",
      now: T0,
      durationMs: 600_000,
      minimumStars: 1,
    });
    const reference = getReferencePizza("funghi")!;
    const pizza = {
      ...createEmptyPizza(),
      sauceIds: [reference.sauce!.ingredientId],
      sauceDeposits: buildIdealSauceFixture(),
      toppings: reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `f-${gi}-${i}`, ingredientId: g.ingredientId, ...p }))),
    };
    state = gameReducer({ ...state, pizza }, { type: "START_BAKE", now: T0 });
    expect(state.dinner!.pending!.plan.identity.kind).toBe("AMBIGUOUS");
    expect(state.recipe.bakeTarget).toEqual(FREE_COOK_BAKE_TARGET);
    expect(state.cookingProfile.steps).not.toContain("CUT");
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 68, now: T0 + 1 });
    expect(state.phase).toBe("RESULT");
    expect(state.dinner!.lastResult).toEqual({ category: "ORIGINAL" });
    expect(state.dinner!.run.completedRecipeIds).toEqual([]);
    expect(state.dinner!.run.attempts[0]).toMatchObject({ category: "ORIGINAL", identityRecipeId: null, completedTargetId: null });
    expect(state.inventory.mushroom).toBe(0);
    // The remaining set (funghi still needs 3 mushrooms) is now infeasible: consumed, never refunded.
    expect(state.dinner!.run.outcome).toMatchObject({ kind: "FAILED", reason: "INFEASIBLE" });
  });
});
