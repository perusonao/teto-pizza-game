import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { getRecipe, type RecipeId } from "../../data/recipes";
import type { DexEntry, DexState } from "../../state/dex";
import { consumePizzaInventory, type InventoryState } from "../../state/inventory";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { recipeFiniteNeed, type RecipeSetInputs } from "../../state/recipeSetFeasibility";
import { getDinnerMission } from "./dinnerMission";
import {
  dinnerProgress,
  dinnerRunReducer,
  dinnerStartBlock,
  isRemainingTargetSetFeasible,
  remainingTargetIds,
  startDinnerRun,
  type DinnerRunAction,
  type DinnerRunState,
} from "./dinnerRun";

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const DM_A = getDinnerMission("dm-a")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;
const DURATION = 300_000;

function dexOf(ids: readonly string[]): DexState {
  return Object.freeze(
    ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  );
}
const DEX_A = dexOf(DM_A_IDS);

function stockOf(inventory: InventoryState): RecipeSetInputs {
  return { ownedIngredientIds: ALL_IDS, inventory };
}

function start(inventory: InventoryState, dex: DexState = DEX_A): DinnerRunState {
  const result = startDinnerRun(DM_A, { dex, ...stockOf(inventory) }, T0, DURATION);
  if (!result.ok) throw new Error(`start blocked: ${JSON.stringify(result.block)}`);
  return result.state;
}

/** A pizza of `recipeId` carrying exactly its minimum pieces, plus `extra` pieces per ingredient. */
function pizzaFor(recipeId: string, extra: Record<string, number> = {}): PizzaState {
  const recipe = getRecipe(recipeId as RecipeId)!;
  const pizza = createEmptyPizza();
  let n = 0;
  for (const { ingredientId, minCount } of recipe.requiredIngredients) {
    const ingredient = INGREDIENTS.find((i) => i.id === ingredientId)!;
    if (ingredient.placement === "spread") {
      pizza.sauceIds = [ingredientId];
      continue;
    }
    for (let i = 0; i < minCount + (extra[ingredientId] ?? 0); i += 1) {
      pizza.toppings.push({ id: `t${(n += 1)}`, ingredientId, x: 50, y: 50 });
    }
  }
  return pizza;
}

/** Cooks the target through the real consumption transaction and resolves it. */
function cook(
  state: DinnerRunState,
  inventory: InventoryState,
  recipeId: string,
  completion: "PASS" | "FAILED",
  now: number,
  extra: Record<string, number> = {},
): { state: DinnerRunState; inventory: InventoryState } {
  const selected = dinnerRunReducer(state, { type: "SELECT_TARGET", recipeId, now });
  const after = consumePizzaInventory(pizzaFor(recipeId, extra), inventory);
  const resolved = dinnerRunReducer(selected, {
    type: "RESOLVE_ATTEMPT",
    recipeId,
    completion,
    stock: stockOf(after),
    now: now + 1,
  });
  return { state: resolved, inventory: after };
}

const EXACT_A = { egg: 2, bacon: 3, mushroom: 3 };

describe("START gate (OD-DM-2)", () => {
  it("A: locked while a target is undiscovered", () => {
    expect(dinnerStartBlock(DM_A, { dex: dexOf(["margherita", "bismarck", "funghi"]), ...stockOf(EXACT_A) })).toEqual({
      reason: "LOCKED",
      undiscoveredCount: 1,
    });
  });

  it("C/D: full and exactly-sufficient stock can start", () => {
    expect(dinnerStartBlock(DM_A, { dex: DEX_A, ...stockOf({ egg: 99, bacon: 99, mushroom: 99 }) })).toBeNull();
    expect(dinnerStartBlock(DM_A, { dex: DEX_A, ...stockOf(EXACT_A) })).toBeNull();
  });

  it("E: one egg short cannot start, though bismarck and breakfast-pizza are each cookable alone", () => {
    expect(dinnerStartBlock(DM_A, { dex: DEX_A, ...stockOf({ ...EXACT_A, egg: 1 }) })).toEqual({
      reason: "INSUFFICIENT_STOCK",
      shortages: [{ ingredientId: "egg", need: 2, have: 1, recipeIds: ["bismarck", "breakfast-pizza"] }],
    });
    expect(startDinnerRun(DM_A, { dex: DEX_A, ...stockOf({ ...EXACT_A, egg: 1 }) }, T0, DURATION).ok).toBe(false);
  });

  it("an untuned time limit needs an explicit duration", () => {
    const result = startDinnerRun(DM_A, { dex: DEX_A, ...stockOf(EXACT_A) }, T0);
    expect(result).toEqual({ ok: false, block: { reason: "NO_TIME_LIMIT" } });
  });

  it("a started run is PLAYING with every target open and 0/4 progress", () => {
    const state = start(EXACT_A);
    expect(state).toMatchObject({ status: "PLAYING", activeRecipeId: null, outcome: null });
    expect(state.clock).toEqual({ startedAt: T0, endsAt: T0 + DURATION });
    expect(remainingTargetIds(state)).toEqual(DM_A_IDS);
    expect(dinnerProgress(state)).toEqual({ completed: 0, total: 4 });
  });
});

describe("completing targets", () => {
  it("F/G: a starter-only target completes without touching stock", () => {
    const { state, inventory } = cook(start(EXACT_A), EXACT_A, "margherita", "PASS", T0 + 10);
    expect(inventory).toBe(EXACT_A);
    expect(state.completedRecipeIds).toEqual(["margherita"]);
    expect(dinnerProgress(state)).toEqual({ completed: 1, total: 4 });
    expect(state.status).toBe("PLAYING");
  });

  it("H/I/M: every order clears with exact stock, consuming exactly the aggregate need", () => {
    const perms = (xs: string[]): string[][] =>
      xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
    const orders = perms(DM_A_IDS);
    expect(orders).toHaveLength(24);
    for (const order of orders) {
      let state = start(EXACT_A);
      let inventory: InventoryState = EXACT_A;
      order.forEach((id, i) => {
        ({ state, inventory } = cook(state, inventory, id, "PASS", T0 + 1000 * (i + 1)));
      });
      expect(state.status, order.join(">")).toBe("CLEARED");
      expect(state.outcome).toEqual({ kind: "CLEAR", endedAt: T0 + 4001, clearMs: 4001 });
      expect(inventory).toEqual({ egg: 0, bacon: 0, mushroom: 0 });
    }
  });

  it("J: after a completion the remaining set is re-checked and stays feasible", () => {
    const { state, inventory } = cook(start(EXACT_A), EXACT_A, "bismarck", "PASS", T0 + 10);
    expect(inventory.egg).toBe(1);
    expect(state.status).toBe("PLAYING");
    expect(isRemainingTargetSetFeasible(state, stockOf(inventory))).toBe(true);
    expect(remainingTargetIds(state)).toEqual(["margherita", "breakfast-pizza", "funghi"]);
  });
});

describe("OD-DM-3: FAILED as soon as the remaining set cannot be completed", () => {
  it("K: over-placing a second egg on bismarck completes it, then fails the run at once", () => {
    const { state, inventory } = cook(start(EXACT_A), EXACT_A, "bismarck", "PASS", T0 + 10, { egg: 1 });
    expect(inventory.egg).toBe(0);
    expect(state.completedRecipeIds).toEqual(["bismarck"]);
    expect(state.status).toBe("FAILED");
    expect(state.outcome).toEqual({
      kind: "FAILED",
      reason: "INFEASIBLE",
      endedAt: T0 + 11,
      shortages: [{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }],
    });
  });

  it("over-placement with room to spare is allowed (nothing is prevented or rescued)", () => {
    const roomy = { ...EXACT_A, egg: 3 };
    const { state, inventory } = cook(start(roomy), roomy, "bismarck", "PASS", T0 + 10, { egg: 1 });
    expect(inventory.egg).toBe(1);
    expect(state.status).toBe("PLAYING");
  });

  it("over-placing a material no remaining target needs never fails the run", () => {
    const withMushrooms = { ...EXACT_A, mushroom: 10 };
    const { state } = cook(start(withMushrooms), withMushrooms, "funghi", "PASS", T0 + 10, { mushroom: 7 });
    expect(state.status).toBe("PLAYING");
  });

  it("the last target completes the run even if it used up everything", () => {
    let state = start(EXACT_A);
    let inventory: InventoryState = EXACT_A;
    for (const id of ["margherita", "funghi", "bismarck"]) ({ state, inventory } = cook(state, inventory, id, "PASS", T0 + 10));
    ({ state } = cook(state, inventory, "breakfast-pizza", "PASS", T0 + 20, { bacon: 0 }));
    expect(state.status).toBe("CLEARED");
  });
});

describe("OD-DM-4: a quality-FAILED pizza", () => {
  it("O: does not complete the target, keeps its consumption, and can be retried when still feasible", () => {
    const spare = { ...EXACT_A, egg: 3 };
    const failed = cook(start(spare), spare, "bismarck", "FAILED", T0 + 10);
    expect(failed.inventory.egg).toBe(2);
    expect(failed.state.status).toBe("PLAYING");
    expect(failed.state.completedRecipeIds).toEqual([]);
    expect(failed.state.attempts).toEqual([{ recipeId: "bismarck", completion: "FAILED", at: T0 + 11 }]);
    const retried = cook(failed.state, failed.inventory, "bismarck", "PASS", T0 + 20);
    expect(retried.state.completedRecipeIds).toEqual(["bismarck"]);
    expect(retried.state.status).toBe("PLAYING");
  });

  it("fails the run at once when its consumption leaves the remaining set short", () => {
    const { state } = cook(start(EXACT_A), EXACT_A, "bismarck", "FAILED", T0 + 10);
    expect(state.status).toBe("FAILED");
    expect(state.outcome).toMatchObject({
      reason: "INFEASIBLE",
      shortages: [{ ingredientId: "egg", need: 2, have: 1, recipeIds: ["bismarck", "breakfast-pizza"] }],
    });
  });
});

describe("time, abandon and the target-selection rules", () => {
  it("L: TICK at the deadline fails with TIME_UP", () => {
    const state = start(EXACT_A);
    expect(dinnerRunReducer(state, { type: "TICK", now: T0 + DURATION - 1 })).toBe(state);
    expect(dinnerRunReducer(state, { type: "TICK", now: T0 + DURATION }).outcome).toEqual({
      kind: "FAILED",
      reason: "TIME_UP",
      endedAt: T0 + DURATION,
    });
  });

  it("L: a pizza resolved at or after the deadline does not count", () => {
    const selected = dinnerRunReducer(start(EXACT_A), { type: "SELECT_TARGET", recipeId: "margherita", now: T0 });
    const late = dinnerRunReducer(selected, {
      type: "RESOLVE_ATTEMPT",
      recipeId: "margherita",
      completion: "PASS",
      stock: stockOf(EXACT_A),
      now: T0 + DURATION,
    });
    expect(late.completedRecipeIds).toEqual([]);
    expect(late.outcome).toMatchObject({ reason: "TIME_UP" });
  });

  it("Q/R: ABANDON (reload / HOME) fails the run", () => {
    expect(dinnerRunReducer(start(EXACT_A), { type: "ABANDON", now: T0 + 5 }).outcome).toEqual({
      kind: "FAILED",
      reason: "ABANDONED",
      endedAt: T0 + 5,
    });
  });

  it("P: non-target, completed, or second selections and mismatched results are ignored", () => {
    const state = start(EXACT_A);
    expect(dinnerRunReducer(state, { type: "SELECT_TARGET", recipeId: "hawaiian", now: T0 })).toBe(state);
    const selected = dinnerRunReducer(state, { type: "SELECT_TARGET", recipeId: "bismarck", now: T0 });
    expect(dinnerRunReducer(selected, { type: "SELECT_TARGET", recipeId: "funghi", now: T0 })).toBe(selected);
    const wrong: DinnerRunAction = {
      type: "RESOLVE_ATTEMPT",
      recipeId: "funghi",
      completion: "PASS",
      stock: stockOf(EXACT_A),
      now: T0 + 1,
    };
    expect(dinnerRunReducer(selected, wrong)).toBe(selected);
    expect(dinnerRunReducer(state, { ...wrong, recipeId: "bismarck" })).toBe(state);
    const { state: done } = cook(state, EXACT_A, "margherita", "PASS", T0 + 1);
    expect(dinnerRunReducer(done, { type: "SELECT_TARGET", recipeId: "margherita", now: T0 + 2 })).toBe(done);
  });

  it("CANCEL_TARGET returns to selection without other changes", () => {
    const selected = dinnerRunReducer(start(EXACT_A), { type: "SELECT_TARGET", recipeId: "funghi", now: T0 });
    const cancelled = dinnerRunReducer(selected, { type: "CANCEL_TARGET", now: T0 + 1 });
    expect(cancelled).toEqual({ ...selected, activeRecipeId: null });
  });

  it("finished runs ignore every action", () => {
    const failed = dinnerRunReducer(start(EXACT_A), { type: "ABANDON", now: T0 });
    for (const action of [
      { type: "TICK", now: T0 + DURATION * 2 },
      { type: "SELECT_TARGET", recipeId: "funghi", now: T0 },
      { type: "ABANDON", now: T0 },
    ] as DinnerRunAction[]) {
      expect(dinnerRunReducer(failed, action)).toBe(failed);
    }
  });
});

describe("separation from the Dex and from Lunch Rush (OD-DM-11 / architecture)", () => {
  it("no run transition reads or writes the Dex: a whole CLEAR and a FAILED run leave it untouched", () => {
    const dex = DEX_A;
    const snapshot = JSON.stringify(dex);
    let state = start(EXACT_A, dex);
    let inventory: InventoryState = EXACT_A;
    for (const id of DM_A_IDS) ({ state, inventory } = cook(state, inventory, id, "PASS", T0 + 10));
    cook(start(EXACT_A, dex), EXACT_A, "bismarck", "FAILED", T0 + 10);
    expect(JSON.stringify(dex)).toBe(snapshot);
  });

  it("the Dinner modules import no Dex writer and nothing from Lunch Rush or the game reducer", () => {
    const sources = import.meta.glob<string>(["./*.ts", "!./*.test.ts"], { query: "?raw", import: "default", eager: true });
    expect(Object.keys(sources).sort()).toEqual(["./dinnerMission.ts", "./dinnerReward.ts", "./dinnerRun.ts"]);
    for (const [file, source] of Object.entries(sources)) {
      const imports = source.split("\n").filter((line: string) => /^import |^} from /.test(line)).join("\n");
      expect(imports, file).not.toMatch(/lunchRush|gameReducer|persistence|registerScoreToDex/);
      expect(source, file).not.toMatch(/registerScoreToDex\(/);
    }
  });

  it("recipeFiniteNeed is the only per-recipe need the run relies on (DM-A needs egg 2 in total)", () => {
    expect(DM_A_IDS.map((id) => recipeFiniteNeed(getRecipe(id as RecipeId)!).egg ?? 0)).toEqual([0, 1, 1, 0]);
  });
});
