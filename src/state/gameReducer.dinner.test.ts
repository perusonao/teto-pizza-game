import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, type RecipeId } from "../data/recipes";
import { isCutEligible } from "../data/cookingProfiles";
import { getDinnerMission, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import { remainingTargetIds, startDinnerRun } from "../mission/dinner/dinnerRun";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import type { InventoryState } from "./inventory";
import { loadSave, persistProgress, type StorageLike } from "./persistence";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { completionPolicyForRound, isDinnerRound, isFreeCookingRound, isGuidedRound, isLunchRushRound } from "./roundKind";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Dinner Mission DM-2 (Issue #239): runtime integration through the real `gameReducer` -- the
 * DM-1 run driven by the same actions the cooking screen dispatches, with stock consumed by the
 * real CONFIRM_BAKE. Numbers in the test names follow the DM-2 test list.
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DM_A = getDinnerMission("dm-a")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;
const DURATION = 600_000;
const PITZ = 500;
const EXACT_A: InventoryState = { egg: 2, bacon: 3, mushroom: 3 };

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

function saved(inventory: InventoryState, discovered: readonly string[] = DM_A_IDS): GameState {
  return createInitialGameState(dexOf(discovered), ALL_IDS, PITZ, inventory, [], FINITE_IDS, {});
}

function started(inventory: InventoryState = EXACT_A, missionId = "dm-a"): GameState {
  const state = gameReducer(saved(inventory), { type: "DINNER_START", missionId, now: T0, durationMs: DURATION });
  if (state.dinner === null) throw new Error("Dinner did not start");
  return state;
}

/** The Reference pizza of `recipeId`, with piece counts overridden per ingredient (extra pieces
 *  are placed inside the dough; fewer take the first Reference positions). */
function pizzaFor(recipeId: string, counts: Record<string, number> = {}): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`no reference for ${recipeId}`);
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) => {
      const count = counts[group.ingredientId] ?? group.positions.length;
      return Array.from({ length: count }, (_, i) => ({
        id: `${recipeId}-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...(group.positions[i] ?? { x: 40 + (i % 4) * 5, y: 45 + Math.floor(i / 4) * 5 }),
      }));
    }),
  };
}

interface CookOptions {
  counts?: Record<string, number>;
  /** Bake far below the target: Completion Gate FAILED (UNDERBAKED). */
  underbake?: boolean;
}

function bakeValue(recipeId: string, underbake = false): number {
  const { start, end } = getRecipe(recipeId as RecipeId)!.bakeTarget;
  return underbake ? 0 : Math.round((start + end) / 2);
}

/** Selects `recipeId` and cooks it to RESULT (CUT included) with the real actions. */
function cook(state: GameState, recipeId: string, now: number, options: CookOptions = {}): GameState {
  let next = gameReducer(state, { type: "DINNER_SELECT_TARGET", recipeId, now });
  expect(next.phase, `select ${recipeId}`).toBe("PREPARE");
  // The gestures themselves are covered by their own suites; here the finished pizza is placed
  // on the round the Dinner target actually started.
  next = { ...next, pizza: pizzaFor(recipeId, options.counts) };
  next = gameReducer(next, { type: "START_BAKE", now });
  next = gameReducer(next, { type: "CONFIRM_BAKE", value: bakeValue(recipeId, options.underbake), now });
  return walkPostBakeToResult(next, now);
}

function back(state: GameState, now: number): GameState {
  return gameReducer(state, { type: "DINNER_RETURN_TO_TARGETS", now });
}

function run(state: GameState) {
  return state.dinner!.run;
}

describe("1-4: explicit round authority", () => {
  it("1: a Dinner run makes DINNER rounds that are neither Lunch Rush nor Free Cooking", () => {
    const board = started();
    expect(board.roundKind).toBe("DINNER");
    expect([isDinnerRound(board), isLunchRushRound(board), isFreeCookingRound(board), isGuidedRound(board)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(board.isMissionRound).toBe(false);
    expect(board.freeCook).toBe(false);
    const target = gameReducer(board, { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    expect(target.roundKind).toBe("DINNER");
    expect(target.isMissionRound).toBe(false);
    expect(completionPolicyForRound(target)).toBe("order");
  });

  it("2/3/4: Lunch Rush, Free Cooking and guided rounds keep their kinds and have no Dinner session", () => {
    const base = saved({ egg: 5 });
    const lunch = gameReducer(base, { type: "MISSION_RESET_ORDER" });
    expect([lunch.roundKind, lunch.isMissionRound, lunch.dinner]).toEqual(["LUNCH_RUSH", true, null]);
    const free = gameReducer(base, { type: "START_FREE_COOK", now: T0 });
    expect([free.roundKind, free.freeCook, free.dinner]).toEqual(["FREE_COOK", true, null]);
    const guided = gameReducer(base, { type: "SELECT_RECIPE", recipeId: "bismarck", now: T0 });
    expect([guided.roundKind, guided.isMissionRound, guided.freeCook, guided.dinner]).toEqual(["GUIDED", false, false, null]);
    expect(completionPolicyForRound(guided)).toBe("recipe");
  });
});

describe("5-7, 43: starting a run", () => {
  it("5: DM-A starts at target selection with the injected duration", () => {
    const board = started();
    expect(board.phase).toBe("ORDER");
    expect(run(board)).toMatchObject({ missionId: "dm-a", status: "PLAYING", activeRecipeId: null });
    expect(run(board).clock).toEqual({ startedAt: T0, endsAt: T0 + DURATION });
    expect(board.dinner!.abandonRequested).toBe(false);
  });

  it("6: a locked mission (one target undiscovered) does not start", () => {
    const locked = saved(EXACT_A, ["margherita", "bismarck", "funghi"]);
    expect(gameReducer(locked, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION })).toBe(locked);
  });

  it("7: an initially infeasible set (one egg short) does not start", () => {
    const short = saved({ ...EXACT_A, egg: 1 });
    expect(gameReducer(short, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION })).toBe(short);
  });

  it("43: unknown mission, no time limit, a second run, or a Lunch Rush round fail closed", () => {
    const base = saved(EXACT_A);
    expect(gameReducer(base, { type: "DINNER_START", missionId: "nope", now: T0, durationMs: DURATION })).toBe(base);
    expect(gameReducer(base, { type: "DINNER_START", missionId: "dm-a", now: T0 })).toBe(base); // untuned, no duration
    const board = started();
    expect(gameReducer(board, { type: "DINNER_START", missionId: "dm-b", now: T0, durationMs: DURATION })).toBe(board);
    const lunch = gameReducer(base, { type: "MISSION_RESET_ORDER" });
    expect(gameReducer(lunch, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION })).toBe(lunch);
  });
});

describe("8-11, 44: target selection", () => {
  it("8: selecting a remaining target starts its guided PREPARE round (no Cooking Time)", () => {
    const target = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "funghi", now: T0 + 1 });
    expect(target.phase).toBe("PREPARE");
    expect(target.recipe.id).toBe("funghi");
    expect(run(target).activeRecipeId).toBe("funghi");
    expect(target.cookingTiming).toBeNull();
  });

  it("9/44: a non-target or unknown recipe is rejected", () => {
    const board = started();
    expect(gameReducer(board, { type: "DINNER_SELECT_TARGET", recipeId: "hawaiian", now: T0 })).toBe(board);
    expect(gameReducer(board, { type: "DINNER_SELECT_TARGET", recipeId: "no-such-recipe", now: T0 })).toBe(board);
  });

  it("10: a completed target cannot be selected again", () => {
    const done = back(cook(started(), "margherita", T0 + 10), T0 + 11);
    expect(run(done).completedRecipeIds).toEqual(["margherita"]);
    expect(gameReducer(done, { type: "DINNER_SELECT_TARGET", recipeId: "margherita", now: T0 + 12 })).toBe(done);
  });

  it("11: cancelling a selected target changes nothing but the selection", () => {
    const board = started();
    const target = gameReducer(board, { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    const placed = { ...target, pizza: pizzaFor("bismarck") };
    const cancelled = gameReducer(placed, { type: "DINNER_CANCEL_TARGET", now: T0 + 1 });
    expect(cancelled.phase).toBe("ORDER");
    expect(run(cancelled)).toMatchObject({ activeRecipeId: null, completedRecipeIds: [], attempts: [], status: "PLAYING" });
    expect(cancelled.inventory).toBe(board.inventory);
    expect(cancelled.pitzBalance).toBe(PITZ);
    expect(cancelled.dex).toBe(board.dex);
    expect(cancelled.pizza.toppings).toEqual([]);
  });

  it("cancel is only for a PREPARE round (not after baking has started)", () => {
    let target = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    target = gameReducer({ ...target, pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    expect(gameReducer(target, { type: "DINNER_CANCEL_TARGET", now: T0 })).toBe(target);
  });
});

describe("12-17: cooking targets", () => {
  it("12/13: the full ordered quantity is required -- two of three mushrooms does not complete funghi", () => {
    const result = cook(started(), "funghi", T0 + 10, { counts: { mushroom: 2 } });
    expect(result.completion).toMatchObject({ status: "FAILED", reason: "INSUFFICIENT_REQUIRED_AMOUNT" });
    expect(run(result).completedRecipeIds).toEqual([]);
    expect(run(result).attempts).toEqual([{ recipeId: "funghi", completion: "FAILED", at: T0 + 10 }]);
    expect(result.inventory.mushroom).toBe(1); // the two placed are consumed (EXACT_A had 3)
  });

  it("12: the same short pizza completes a guided round (recipe policy) -- Dinner does not inherit it", () => {
    let guided = gameReducer(saved(EXACT_A), { type: "SELECT_RECIPE", recipeId: "funghi", now: T0 });
    guided = { ...guided, pizza: pizzaFor("funghi", { mushroom: 2 }) };
    guided = gameReducer(guided, { type: "START_BAKE", now: T0 });
    guided = walkPostBakeToResult(gameReducer(guided, { type: "CONFIRM_BAKE", value: bakeValue("funghi"), now: T0 }), T0);
    expect(guided.completion?.status).toBe("PASS");
  });

  it("14/15: a completed target is marked, and the next one can be selected from the target list", () => {
    const result = cook(started(), "bismarck", T0 + 10);
    expect(result.phase).toBe("RESULT");
    expect(run(result)).toMatchObject({ completedRecipeIds: ["bismarck"], activeRecipeId: null, status: "PLAYING" });
    const board = back(result, T0 + 11);
    expect(board.phase).toBe("ORDER");
    const next = gameReducer(board, { type: "DINNER_SELECT_TARGET", recipeId: "funghi", now: T0 + 12 });
    expect(next.recipe.id).toBe("funghi");
  });

  it("16/17: any order clears; CLEAR records the clear time", () => {
    for (const order of [DM_A_IDS, [...DM_A_IDS].reverse(), ["funghi", "bismarck", "margherita", "breakfast-pizza"]]) {
      let state = started();
      order.forEach((id, i) => {
        state = cook(state, id, T0 + 1000 * (i + 1));
        if (i < order.length - 1) state = back(state, T0 + 1000 * (i + 1) + 1);
      });
      expect(run(state).status, order.join(">")).toBe("CLEARED");
      expect(run(state).outcome).toEqual({ kind: "CLEAR", endedAt: T0 + 4000, clearMs: 4000 });
      expect(state.inventory).toEqual({ egg: 0, bacon: 0, mushroom: 0 });
    }
  });
});

describe("24-28: post-bake inventory (the stock the run judges is the stock after CONFIRM_BAKE)", () => {
  it("A/24: remaining need egg 2, stock 2, bismarck uses 1 -> post-bake egg 1 -> still feasible", () => {
    const result = cook(started(), "bismarck", T0 + 10);
    expect(result.inventory.egg).toBe(1);
    expect(run(result).status).toBe("PLAYING");
  });

  it("B/25: over-placing a second egg on bismarck -> post-bake egg 0 -> breakfast-pizza impossible -> INFEASIBLE at once", () => {
    const result = cook(started(), "bismarck", T0 + 10, { counts: { egg: 2 } });
    expect(result.inventory.egg).toBe(0);
    expect(run(result).completedRecipeIds).toEqual(["bismarck"]);
    expect(run(result).outcome).toEqual({
      kind: "FAILED",
      reason: "INFEASIBLE",
      endedAt: T0 + 10,
      shortages: [{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }],
    });
  });

  it("C/26: quality FAILED consumes the egg, the target stays open, and it can be retried", () => {
    const failed = cook(started({ ...EXACT_A, egg: 3 }), "bismarck", T0 + 10, { underbake: true });
    expect(failed.completion?.status).toBe("FAILED");
    expect(failed.inventory.egg).toBe(2);
    expect(run(failed)).toMatchObject({ status: "PLAYING", completedRecipeIds: [] });
    const retried = cook(back(failed, T0 + 11), "bismarck", T0 + 20);
    expect(run(retried).completedRecipeIds).toEqual(["bismarck"]);
    expect(retried.inventory.egg).toBe(1);
  });

  it("D/27: quality FAILED whose consumption leaves the set short -> FAILED(INFEASIBLE), judged on the post-bake stock", () => {
    const failed = cook(started(), "bismarck", T0 + 10, { underbake: true });
    expect(failed.inventory.egg).toBe(1);
    expect(run(failed).outcome).toMatchObject({
      reason: "INFEASIBLE",
      // have: 1 is the post-bake stock; the pre-bake stock (2) would have been feasible.
      shortages: [{ ingredientId: "egg", need: 2, have: 1, recipeIds: ["bismarck", "breakfast-pizza"] }],
    });
  });

  it("a CUT recipe consumes at CONFIRM_BAKE and resolves at the CUT confirm, reading the stock then", () => {
    expect(isCutEligible("bismarck")).toBe(true);
    let state = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("bismarck", { egg: 2 }) }, { type: "START_BAKE", now: T0 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue("bismarck"), now: T0 + 5 });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.inventory.egg).toBe(0); // consumed now
    expect(run(state)).toMatchObject({ status: "PLAYING", activeRecipeId: "bismarck" }); // not resolved yet
    state = walkPostBakeToResult(state, T0 + 9);
    expect(run(state).outcome).toMatchObject({ reason: "INFEASIBLE", endedAt: T0 + 9 });
  });

  it("28: a starter-only target consumes nothing and never affects feasibility", () => {
    const board = started();
    const result = cook(board, "margherita", T0 + 10, { counts: { mozzarella: 9, basil: 9 } });
    expect(result.inventory).toBe(board.inventory);
    expect(run(result).completedRecipeIds).toEqual(["margherita"]);
  });
});

describe("18-22: time, HOME and reload", () => {
  it("18: the clock reaching 0 fails the run with TIME_UP", () => {
    const board = started();
    expect(gameReducer(board, { type: "DINNER_TICK", now: T0 + DURATION - 1 })).toBe(board);
    expect(run(gameReducer(board, { type: "DINNER_TICK", now: T0 + DURATION })).outcome).toEqual({
      kind: "FAILED",
      reason: "TIME_UP",
      endedAt: T0 + DURATION,
    });
  });

  it("18: a bake confirmed after the deadline consumes nothing and completes nothing", () => {
    let state = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    const late = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue("bismarck"), now: T0 + DURATION });
    expect(late.phase).toBe("BAKE");
    expect(late.inventory).toBe(state.inventory);
    expect(run(late).outcome).toMatchObject({ reason: "TIME_UP" });
    expect(gameReducer(late, { type: "CONFIRM_BAKE", value: 60, now: T0 + DURATION + 1 })).toBe(late);
  });

  it("19/20: HOME asks first; cancel keeps the run going", () => {
    const requested = gameReducer(started(), { type: "DINNER_REQUEST_ABANDON" });
    expect(requested.dinner!.abandonRequested).toBe(true);
    const cancelled = gameReducer(requested, { type: "DINNER_CANCEL_ABANDON" });
    expect(cancelled.dinner!.abandonRequested).toBe(false);
    expect(run(cancelled).status).toBe("PLAYING");
  });

  it("21: confirming abandons (FAILED / ABANDONED, no reward); exiting returns to a normal round", () => {
    const board = started();
    const requested = gameReducer(board, { type: "DINNER_REQUEST_ABANDON" });
    expect(gameReducer(board, { type: "DINNER_CONFIRM_ABANDON", now: T0 + 5 })).toBe(board); // not requested
    const abandoned = gameReducer(requested, { type: "DINNER_CONFIRM_ABANDON", now: T0 + 5 });
    expect(run(abandoned).outcome).toEqual({ kind: "FAILED", reason: "ABANDONED", endedAt: T0 + 5 });
    expect(abandoned.pitzBalance).toBe(PITZ);
    const exited = gameReducer(abandoned, { type: "DINNER_EXIT" });
    expect(exited.dinner).toBeNull();
    expect(exited.roundKind).not.toBe("DINNER");
  });

  it("DINNER_EXIT is refused while the run is still PLAYING", () => {
    const board = started();
    expect(gameReducer(board, { type: "DINNER_EXIT" })).toBe(board);
  });

  it("22: nothing of a run is saved; a reload starts with no run", () => {
    const store = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    };
    const mid = back(cook(started(), "bismarck", T0 + 10), T0 + 11);
    persistProgress(mid, storage);
    const raw = [...store.values()].join("");
    expect(raw).not.toMatch(/dinner|roundKind|DINNER/);
    const save = loadSave(storage);
    expect(save.inventory.egg).toBe(1); // consumption is real and stays
    const reloaded = createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance, save.inventory);
    expect(reloaded.dinner).toBeNull();
    expect(reloaded.roundKind).not.toBe("DINNER");
  });
});

describe("23, 29-36: isolation from the Shop, the Dex, Pitz and Lunch Rush", () => {
  it("23: purchases and refills are rejected during a run", () => {
    const board = started();
    expect(gameReducer(board, { type: "RESTOCK_INGREDIENT", ingredientId: "egg" })).toBe(board);
    expect(gameReducer(board, { type: "PURCHASE_INGREDIENT", ingredientId: "capers" })).toBe(board);
  });

  it("29-34: a cleared run and a failed run leave Dex, discovery and Pitz untouched", () => {
    const board = started();
    const dexBefore = JSON.stringify(board.dex);
    let state = board;
    DM_A_IDS.forEach((id, i) => {
      state = cook(state, id, T0 + 1000 * (i + 1));
      // The App never dispatches it for Dinner; the reducer refuses it anyway.
      expect(gameReducer(state, { type: "REGISTER_TO_DEX" })).toBe(state);
      expect(state.lastPitzCredit).toBeNull();
      expect(state.lastEfficiencyCredit).toBeNull();
      expect(state.cookingTiming).toBeNull();
      if (i < 3) state = back(state, T0 + 1000 * (i + 1) + 1);
    });
    expect(run(state).status).toBe("CLEARED");
    const failed = cook(started(), "bismarck", T0 + 10, { underbake: true });
    for (const s of [state, failed]) {
      expect(JSON.stringify(s.dex)).toBe(dexBefore);
      expect(s.justDiscovered).toBe(false);
      expect(s.justGotNewBest).toBe(false);
      expect(s.lastDiscovery).toBeNull();
      expect(s.pitzBalance).toBe(PITZ); // no FREE Pitz, no Dinner payout yet
    }
  });

  it("33/35/36: Lunch Rush reward, skip and SOLD OUT actions are refused during a run", () => {
    const board = started();
    for (const action of [
      { type: "CLAIM_MISSION_REWARD", runId: 9, amount: 100 },
      { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" },
      { type: "MISSION_NEXT_ORDER" },
      { type: "MISSION_RESET_ORDER" },
    ] as GameAction[]) {
      expect(gameReducer(board, action)).toBe(board);
    }
    expect(board.missionSoldOutRecipeIds).toEqual([]);
  });

  it("no other round can start during a run (no Free Cooking switch, no guided round, no hint purchase)", () => {
    const board = started();
    for (const action of [
      { type: "START_FREE_COOK", now: T0 },
      { type: "SELECT_RECIPE", recipeId: "bismarck", now: T0 },
      { type: "BEGIN_PREPARE", now: T0 },
      { type: "RETRY_SAME_RECIPE", now: T0 },
      { type: "PLAY_AGAIN" },
      { type: "PURCHASE_DISCOVERY_HINT", level: 1 },
    ] as GameAction[]) {
      expect(gameReducer(board, action)).toBe(board);
    }
  });

  it("39/40: after exiting, Free Cooking and guided rounds work as before", () => {
    const exited = gameReducer(
      gameReducer(gameReducer(started(), { type: "DINNER_REQUEST_ABANDON" }), { type: "DINNER_CONFIRM_ABANDON", now: T0 }),
      { type: "DINNER_EXIT" },
    );
    const free = gameReducer(exited, { type: "START_FREE_COOK", now: T0 });
    expect(free.roundKind).toBe("FREE_COOK");
    const guided = gameReducer(exited, { type: "SELECT_RECIPE", recipeId: "funghi", now: T0 });
    expect([guided.roundKind, guided.phase]).toEqual(["GUIDED", "PREPARE"]);
    expect(guided.cookingTiming).not.toBeNull();
  });
});

describe("41/42: CUT and New Haven (no CUT)", () => {
  it("41: every DM-A target goes through the existing CUT step", () => {
    for (const id of DM_A_IDS) expect(isCutEligible(id as RecipeId), id).toBe(true);
    let state = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "funghi", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("funghi") }, { type: "START_BAKE", now: T0 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue("funghi"), now: T0 });
    expect([state.phase, state.makingStep]).toEqual(["POST_BAKE", "CUT"]);
  });

  it("42: New Haven resolves straight at CONFIRM_BAKE", () => {
    expect(isCutEligible("new-haven-apizza")).toBe(false);
    const inventory = { ...EXACT_A, "olive-oil": 1, parmigiano: 2, clam: 3, garlic: 2 };
    const board = gameReducer(saved(inventory, [...DM_A_IDS, "new-haven-apizza"]), {
      type: "DINNER_START",
      missionId: "dm-a",
      now: T0,
      durationMs: DURATION,
    });
    // A test-only mission containing New Haven, run on the same runtime.
    const mission: DinnerMissionDefinition = { ...DM_A, missionId: "test-nh", targetRecipeIds: ["new-haven-apizza", "margherita"] };
    const custom = startDinnerRun(mission, { dex: board.dex, ownedIngredientIds: ALL_IDS, inventory }, T0, DURATION);
    if (!custom.ok) throw new Error("custom run");
    let state: GameState = { ...board, dinner: { run: custom.state, abandonRequested: false } };
    state = gameReducer(state, { type: "DINNER_SELECT_TARGET", recipeId: "new-haven-apizza", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("new-haven-apizza") }, { type: "START_BAKE", now: T0 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue("new-haven-apizza"), now: T0 + 3 });
    expect(state.phase).toBe("RESULT");
    expect(run(state).completedRecipeIds).toEqual(["new-haven-apizza"]);
    expect(state.inventory).toMatchObject({ "olive-oil": 0, parmigiano: 0, clam: 0, garlic: 0 });
  });
});

describe("24/25 on the no-CUT path: CONFIRM_BAKE itself resolves against its own post-consumption stock", () => {
  it("New Haven over-places parmigiano -> parmigiana-pizza can no longer be made -> INFEASIBLE (pre-bake stock would pass)", () => {
    const discovered = [...DM_A_IDS, "new-haven-apizza", "parmigiana-pizza"];
    const inventory = { ...EXACT_A, "olive-oil": 1, parmigiano: 4, clam: 3, garlic: 2, eggplant: 3 };
    const board = gameReducer(saved(inventory, discovered), { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION });
    const mission: DinnerMissionDefinition = {
      ...DM_A,
      missionId: "test-nh-parm",
      targetRecipeIds: ["new-haven-apizza", "parmigiana-pizza"],
    };
    const custom = startDinnerRun(mission, { dex: board.dex, ownedIngredientIds: ALL_IDS, inventory }, T0, DURATION);
    if (!custom.ok) throw new Error("custom run");
    let state: GameState = { ...board, dinner: { run: custom.state, abandonRequested: false } };
    state = gameReducer(state, { type: "DINNER_SELECT_TARGET", recipeId: "new-haven-apizza", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("new-haven-apizza", { parmigiano: 3 }) }, { type: "START_BAKE", now: T0 });
    expect(state.inventory.parmigiano).toBe(4); // pre-bake: 4 >= 2 + 2 would still be feasible
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue("new-haven-apizza"), now: T0 + 3 });
    expect(state.phase).toBe("RESULT");
    expect(state.inventory.parmigiano).toBe(1);
    expect(run(state).outcome).toMatchObject({
      reason: "INFEASIBLE",
      shortages: [{ ingredientId: "parmigiano", need: 2, have: 1, recipeIds: ["parmigiana-pizza"] }],
    });
  });
});

describe("45/46: stale and repeated actions", () => {
  it("45: Dinner actions without a run, and cooking actions on the target list, do nothing", () => {
    const base = saved(EXACT_A);
    for (const action of [
      { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 },
      { type: "DINNER_TICK", now: T0 },
      { type: "DINNER_EXIT" },
      { type: "DINNER_REQUEST_ABANDON" },
    ] as GameAction[]) {
      expect(gameReducer(base, action)).toBe(base);
    }
    const board = started();
    for (const action of [
      { type: "START_BAKE", now: T0 },
      { type: "CONFIRM_BAKE", value: 60, now: T0 },
      { type: "PLACE_TOPPING", ingredientId: "egg", x: 50, y: 50 },
      { type: "DINNER_RETURN_TO_TARGETS", now: T0 },
      { type: "DINNER_CANCEL_TARGET", now: T0 },
    ] as GameAction[]) {
      expect(gameReducer(board, action)).toBe(board);
    }
  });

  it("45: a result-producing confirm without a clock is refused", () => {
    let state = gameReducer(started(), { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 });
    state = gameReducer({ ...state, pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    expect(gameReducer(state, { type: "CONFIRM_BAKE", value: 60 })).toBe(state);
  });

  it("46: a repeated bake / result event consumes and counts only once", () => {
    const result = cook(started(), "bismarck", T0 + 10);
    const again = gameReducer(result, { type: "CONFIRM_BAKE", value: 60, now: T0 + 11 });
    expect(again).toBe(result);
    expect(gameReducer(result, { type: "CONFIRM_MAKING_STEP", now: T0 + 11 })).toBe(result);
    expect(run(result).attempts).toHaveLength(1);
    expect(result.inventory.egg).toBe(1);
  });
});

describe("invariants over random play (seeded)", () => {
  /** Small deterministic PRNG so failures reproduce. */
  function prng(seed: number) {
    let x = seed >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 0x1_0000_0000;
    };
  }

  it("completed/remaining partition, CLEAR iff empty, terminal is final, stock never rises, Pitz and Dex never move", () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const rand = prng(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
      let state = started({ egg: 2 + Math.floor(rand() * 3), bacon: 3 + Math.floor(rand() * 3), mushroom: 3 + Math.floor(rand() * 3) });
      const dex = JSON.stringify(state.dex);
      let now = T0;
      let wasTerminal = false;
      for (let step = 0; step < 25; step += 1) {
        now += Math.floor(rand() * 40_000);
        const before = state;
        const r = rand();
        if (r < 0.45 && state.dinner?.run.activeRecipeId === null && state.phase === "ORDER") {
          const id = pick(remainingTargetIds(state.dinner.run));
          if (id) {
            try {
              state = cook(state, id, now, {
                underbake: rand() < 0.2,
                counts: rand() < 0.3 ? { egg: 2, mushroom: 4, bacon: 4 } : {},
              });
            } catch {
              // The deadline passed at selection: SELECT did not reach PREPARE.
              state = gameReducer(state, { type: "DINNER_SELECT_TARGET", recipeId: id, now });
            }
          }
        } else {
          const actions: GameAction[] = [
            { type: "DINNER_RETURN_TO_TARGETS", now },
            { type: "DINNER_TICK", now },
            { type: "DINNER_REQUEST_ABANDON" },
            { type: "DINNER_CANCEL_ABANDON" },
            { type: "RESTOCK_INGREDIENT", ingredientId: "egg" },
            { type: "PURCHASE_INGREDIENT", ingredientId: "capers" },
            { type: "REGISTER_TO_DEX" },
            { type: "PLAY_AGAIN" },
            { type: "DINNER_SELECT_TARGET", recipeId: pick([...DM_A_IDS, "hawaiian"]), now },
            { type: "DINNER_CANCEL_TARGET", now },
          ];
          state = gameReducer(state, pick(actions));
        }
        const session = state.dinner!;
        const remaining = remainingTargetIds(session.run);
        const done = session.run.completedRecipeIds;
        expect(done.filter((id) => remaining.includes(id)), `seed ${seed}`).toEqual([]);
        expect([...done, ...remaining].sort(), `seed ${seed}`).toEqual([...DM_A_IDS].sort());
        expect(session.run.status === "CLEARED", `seed ${seed}`).toBe(remaining.length === 0);
        if (wasTerminal) expect(session.run.status, `seed ${seed}`).not.toBe("PLAYING");
        wasTerminal = session.run.status !== "PLAYING";
        for (const id of FINITE_IDS) {
          expect(state.inventory[id] ?? 0, `seed ${seed} ${id}`).toBeLessThanOrEqual(before.inventory[id] ?? 0);
        }
        expect(state.pitzBalance).toBe(PITZ);
        expect(JSON.stringify(state.dex)).toBe(dex);
        expect(state.roundKind).toBe("DINNER");
      }
    }
  });
});
