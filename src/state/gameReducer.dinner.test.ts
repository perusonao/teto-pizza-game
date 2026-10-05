import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, type RecipeId } from "../data/recipes";
import { FREE_COOK_BAKE_TARGET, FREE_COOK_RECIPE, isFreeCookRecipe } from "../data/freeCook";
import { requiredCutCount } from "../logic/cut/evaluation";
import { resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { QualityStars } from "../logic/scoring";
import { getDinnerMission, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import { resolveDinnerAttempt } from "../mission/dinner/dinnerResultDetection";
import { remainingTargetIds, startDinnerRun } from "../mission/dinner/dinnerRun";
import type { DexEntry, DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { consumePizzaInventory, type InventoryState } from "./inventory";
import { loadSave, persistProgress, type StorageLike } from "./persistence";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { completionPolicyForRound, isDinnerRound, isFreeCookingRound, isGuidedRound, isLunchRushRound } from "./roundKind";

/**
 * Dinner Mission DM-3R-2 (Issue #250): the recipe-free, result-detection Dinner runtime through the
 * real `gameReducer` -- the actions the cooking screen dispatches, with stock consumed by the real
 * CONFIRM_BAKE and results decided by the DM-3R-1 authority (../mission/dinner/dinnerResultDetection.ts).
 *
 * Replaces the DM-2 suite of the same name, whose cases were built on the declared-target flow
 * (DINNER_SELECT_TARGET / CANCEL_TARGET / RETURN_TO_TARGETS, `activeRecipeId`) that DM-3R-2 removes
 * (OD-R1 / OD-R3). Every rule that survives -- round authority, START gate, "order" policy,
 * post-bake feasibility, CLEAR precedence, TIME_UP, abandon, reload, Shop / Dex / Pitz / Lunch Rush
 * isolation, CUT, repeated events, the seeded invariants -- is kept here against the new flow;
 * the selection-only cases (DM-2 8-11) are replaced by "no declaration" cases (R1, R27).
 * "Rn" numbers follow the DM-3R-2 required test list.
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DM_A = getDinnerMission("dm-a")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;
const DURATION = 600_000;
const PITZ = 500;
const S: QualityStars = 3;
const EXACT_A: InventoryState = { egg: 2, bacon: 3, mushroom: 3 };

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

function saved(inventory: InventoryState, discovered: readonly string[] = [...DM_A_IDS, "marinara"]): GameState {
  return createInitialGameState(dexOf(discovered), ALL_IDS, PITZ, inventory, [], FINITE_IDS, {});
}

function started(inventory: InventoryState = EXACT_A, minimumStars: QualityStars = S, discovered?: readonly string[]): GameState {
  const state = gameReducer(saved(inventory, discovered), {
    type: "DINNER_START",
    missionId: "dm-a",
    now: T0,
    durationMs: DURATION,
    minimumStars,
  });
  if (state.dinner === null) throw new Error("Dinner did not start");
  return state;
}

/** A started session swapped onto a test-only mission (same runtime, custom targets). */
function startedCustom(targets: RecipeId[], inventory: InventoryState, discovered: readonly string[]): GameState {
  const base = started(EXACT_A, S, discovered);
  const mission: DinnerMissionDefinition = { ...DM_A, missionId: "test-custom", targetRecipeIds: targets };
  const custom = startDinnerRun(mission, { dex: base.dex, ownedIngredientIds: ALL_IDS, inventory }, T0, DURATION);
  if (!custom.ok) throw new Error(`custom run: ${JSON.stringify(custom.block)}`);
  return { ...base, inventory, dinner: { ...base.dinner!, run: custom.state } };
}

/** The Reference pizza of `recipeId`, with piece counts overridden per ingredient (extra pieces
 *  are placed inside the dough; fewer take the first Reference positions), plus extra ingredients. */
function pizzaFor(recipeId: string, counts: Record<string, number> = {}, extra: Record<string, number> = {}): PizzaState {
  const reference = getReferencePizza(recipeId);
  if (!reference) throw new Error(`no reference for ${recipeId}`);
  const groups = [
    ...reference.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions })),
    ...Object.keys(extra).map((ingredientId) => ({ ingredientId, positions: [] as { x: number; y: number }[] })),
  ];
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce!.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: groups.flatMap((group, gi) => {
      const count = counts[group.ingredientId] ?? extra[group.ingredientId] ?? group.positions.length;
      return Array.from({ length: count }, (_, i) => ({
        id: `${recipeId}-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...(group.positions[i] ?? { x: 40 + (i % 4) * 5, y: 45 + Math.floor(i / 4) * 5 }),
      }));
    }),
  };
}

function mid(recipeId: string): number {
  const { start, end } = getRecipe(recipeId as RecipeId)!.bakeTarget;
  return Math.round((start + end) / 2);
}

function idealCutLines(count: number): CutLine[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * i) / count;
    const dx = Math.cos(angle) * DOUGH_RADIUS;
    const dy = Math.sin(angle) * DOUGH_RADIUS;
    return { start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy }, end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy } };
  });
}

/** POST_BAKE -> RESULT with the real CUT actions (bounded: a refused confirm stops the walk). */
function cutToResult(state: GameState, now: number): GameState {
  let next = state;
  for (let guard = 0; guard < 4 && next.phase === "POST_BAKE"; guard += 1) {
    if (next.makingStep === "CUT") {
      for (const line of idealCutLines(requiredCutCount(resolveRequestedSliceCount(next.cutState.config)))) {
        next = gameReducer(next, { type: "ADD_CUT_LINE", line });
      }
    }
    const confirmed = gameReducer(next, { type: "CONFIRM_MAKING_STEP", now });
    if (confirmed === next) break;
    next = confirmed;
  }
  return next;
}

/**
 * Puts `pizza` on the current recipe-free Dinner round (the gestures have their own suites) and
 * bakes it -- START_BAKE, CONFIRM_BAKE, CUT when the plan has one -- with the real actions.
 */
function cookPizza(state: GameState, pizza: PizzaState, bake: number, now: number): GameState {
  expect(state.phase, "a Dinner round is at PREPARE").toBe("PREPARE");
  let next = gameReducer({ ...state, pizza }, { type: "START_BAKE", now });
  next = gameReducer(next, { type: "CONFIRM_BAKE", value: bake, now });
  return cutToResult(next, now);
}

function cook(state: GameState, recipeId: string, now: number, counts: Record<string, number> = {}): GameState {
  return cookPizza(state, pizzaFor(recipeId, counts), mid(recipeId), now);
}

function nextPizza(state: GameState, now: number): GameState {
  return gameReducer(state, { type: "DINNER_NEXT_PIZZA", now });
}

function run(state: GameState) {
  return state.dinner!.run;
}

function lastAttempt(state: GameState) {
  const attempts = run(state).attempts;
  return attempts[attempts.length - 1];
}

describe("round authority and START", () => {
  it("R1: START goes straight to a recipe-free DINNER PREPARE round -- no target is declared", () => {
    const state = started();
    expect(state.phase).toBe("PREPARE");
    expect(state.roundKind).toBe("DINNER");
    expect([isDinnerRound(state), isLunchRushRound(state), isFreeCookingRound(state), isGuidedRound(state)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect([state.isMissionRound, state.freeCook]).toEqual([false, false]);
    expect(isFreeCookRecipe(state.recipe)).toBe(true);
    expect(state.recipe.requiredIngredients).toEqual([]);
    expect(state.cookingTiming).toBeNull();
    expect(completionPolicyForRound(state)).toBe("order");
    expect(run(state)).not.toHaveProperty("activeRecipeId");
    expect(state.dinner).toMatchObject({ minimumStars: S, roundSeq: 1, pending: null, lastResult: null });
  });

  it("R2: any OWNED ingredient can be placed -- the round is not narrowed to any target", () => {
    let state = started({ ...EXACT_A, ham: 2, pineapple: 3, capers: 2 });
    const step = (s: GameState) => gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: T0 });
    state = step(step(state)); // DOUGH -> SAUCE -> CHEESE
    expect(state.makingStep).toBe("CHEESE");
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 50 });
    state = step(state); // -> TOPPING
    const placed = ["ham", "pineapple", "capers", "egg"];
    placed.forEach((ingredientId, i) => {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId, x: 35 + i * 10, y: 50 });
    });
    expect(state.pizza.toppings.map((t) => t.ingredientId)).toEqual(["mozzarella", ...placed]);
  });

  it("START needs a valid injected S (no default), an unlocked mission and a feasible set", () => {
    const base = saved(EXACT_A);
    for (const bad of [0, 6, 2.5, Number.NaN, undefined]) {
      const action = { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION, minimumStars: bad } as unknown as GameAction;
      expect(gameReducer(base, action), String(bad)).toBe(base);
    }
    const locked = saved(EXACT_A, ["margherita", "bismarck", "funghi"]);
    expect(gameReducer(locked, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION, minimumStars: S })).toBe(locked);
    const short = saved({ ...EXACT_A, egg: 1 });
    expect(gameReducer(short, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION, minimumStars: S })).toBe(short);
    expect(gameReducer(base, { type: "DINNER_START", missionId: "dm-a", now: T0, minimumStars: S })).toBe(base); // no time limit
    const lunch = gameReducer(base, { type: "MISSION_RESET_ORDER" });
    expect(gameReducer(lunch, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION, minimumStars: S })).toBe(lunch);
    const twice = started();
    expect(gameReducer(twice, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: DURATION, minimumStars: S })).toBe(twice);
  });

  it("Lunch Rush, Free Cooking and guided rounds keep their kinds and have no Dinner session", () => {
    const base = saved({ egg: 5 });
    const lunch = gameReducer(base, { type: "MISSION_RESET_ORDER" });
    expect([lunch.roundKind, lunch.isMissionRound, lunch.dinner]).toEqual(["LUNCH_RUSH", true, null]);
    const free = gameReducer(base, { type: "START_FREE_COOK", now: T0 });
    expect([free.roundKind, free.freeCook, free.dinner]).toEqual(["FREE_COOK", true, null]);
    const guided = gameReducer(base, { type: "SELECT_RECIPE", recipeId: "bismarck", now: T0 });
    expect([guided.roundKind, guided.freeCook, guided.dinner]).toEqual(["GUIDED", false, null]);
    expect(completionPolicyForRound(guided)).toBe("recipe");
  });
});

describe("result detection wired into the runtime", () => {
  it("R3: a target pizza -> TARGET_PASS, the target is ✓, and the next pizza is a fresh free round", () => {
    const result = cook(started(), "bismarck", T0 + 10);
    expect(result.phase).toBe("RESULT");
    expect(run(result)).toMatchObject({ status: "PLAYING", completedRecipeIds: ["bismarck"] });
    expect(result.dinner!.lastResult).toMatchObject({ category: "TARGET_PASS", recipeId: "bismarck", nameJa: "ビスマルク" });
    expect(lastAttempt(result)).toMatchObject({
      category: "TARGET_PASS",
      identityRecipeId: "bismarck",
      displayedRecipeId: "bismarck",
      completedTargetId: "bismarck",
      consumed: { egg: 1 },
      at: T0 + 10,
    });
    const next = nextPizza(result, T0 + 11);
    expect(next.phase).toBe("PREPARE");
    expect(isFreeCookRecipe(next.recipe)).toBe(true);
    expect(next.pizza.toppings).toEqual([]);
    expect(next.dinner).toMatchObject({ roundSeq: 2, pending: null, lastResult: null });
    expect(run(next).completedRecipeIds).toEqual(["bismarck"]);
  });

  it("R4: a different remaining target made next completes that target (no intent anywhere)", () => {
    let state = cook(started(), "bismarck", T0 + 10);
    state = cook(nextPizza(state, T0 + 11), "funghi", T0 + 20);
    expect(run(state).completedRecipeIds).toEqual(["bismarck", "funghi"]);
    // Nested: breakfast minus bacon is bismarck (already done) -> DUPLICATE, not breakfast.
    const dup = cook(nextPizza(started({ ...EXACT_A, egg: 3 }), T0), "breakfast-pizza", T0 + 5, { bacon: 0 });
    expect(dup.dinner!.lastResult).toMatchObject({ category: "QUALITY_FAIL", recipeId: "bismarck" }); // mozzarella 2 < 3
  });

  it("R5: QUALITY_FAIL (★ below S, or the order gate) keeps the target open and consumes", () => {
    // Bake inside the acceptable band but outside the perfect window: ★4 < S = 5.
    const belowStars = cookPizza(started({ ...EXACT_A, egg: 3 }, 5), pizzaFor("bismarck"), 80, T0 + 10);
    expect(belowStars.dinner!.lastResult).toMatchObject({
      category: "QUALITY_FAIL",
      failure: { kind: "BELOW_MINIMUM_STARS", stars: 4, minimumStars: 5 },
    });
    expect(run(belowStars)).toMatchObject({ status: "PLAYING", completedRecipeIds: [] });
    expect(belowStars.inventory.egg).toBe(2);
    expect(lastAttempt(belowStars)).toMatchObject({ category: "QUALITY_FAIL", stars: 4, completedTargetId: null });
    // Two of three mushrooms: the "order" Completion Gate fails.
    const gate = cook(started({ ...EXACT_A, mushroom: 5 }), "funghi", T0 + 10, { mushroom: 2 });
    expect(gate.dinner!.lastResult).toMatchObject({
      category: "QUALITY_FAIL",
      recipeId: "funghi",
      failure: { kind: "COMPLETION_GATE", reason: "INSUFFICIENT_REQUIRED_AMOUNT", ingredientId: "mushroom" },
    });
    expect(gate.inventory.mushroom).toBe(3);
  });

  it("R6: the same target again -> DUPLICATE_TARGET, no progress, stock still consumed", () => {
    let state = cook(started({ ...EXACT_A, egg: 3 }), "bismarck", T0 + 10);
    state = cook(nextPizza(state, T0 + 11), "bismarck", T0 + 20);
    expect(state.dinner!.lastResult).toMatchObject({ category: "DUPLICATE_TARGET", recipeId: "bismarck" });
    expect(run(state).completedRecipeIds).toEqual(["bismarck"]);
    expect(state.inventory.egg).toBe(1);
    expect(run(state).attempts.map((a) => a.category)).toEqual(["TARGET_PASS", "DUPLICATE_TARGET"]);
  });

  it("R7: a discovered non-target recipe -> NON_TARGET with its name", () => {
    const state = cook(started({ ...EXACT_A, garlic: 3, oregano: 2 }), "marinara", T0 + 10);
    expect(state.dinner!.lastResult).toEqual({ category: "NON_TARGET", recipeId: "marinara", nameJa: "マリナーラ" });
    expect(run(state).completedRecipeIds).toEqual([]);
  });

  it("R8: an undiscovered recipe -> anonymous ORIGINAL: no id or name in the result, internal identity only in the log", () => {
    const state = cook(started({ ...EXACT_A, ham: 2, pineapple: 3 }), "hawaiian", T0 + 10);
    expect(state.dinner!.lastResult).toEqual({ category: "ORIGINAL" });
    const shown = JSON.stringify(state.dinner!.lastResult);
    expect(shown).not.toContain("hawaiian");
    expect(shown).not.toContain(getRecipe("hawaiian")!.nameJa);
    expect(lastAttempt(state)).toMatchObject({ category: "ORIGINAL", identityRecipeId: "hawaiian", displayedRecipeId: null });
    // The visible round still carries only the anonymous sentinel.
    expect(isFreeCookRecipe(state.recipe)).toBe(true);
    expect(JSON.stringify({ recipe: state.recipe, order: state.order, hint: state.hint })).not.toContain(getRecipe("hawaiian")!.nameJa);
    // A composition matching nothing is ORIGINAL too.
    const none = cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("funghi", {}, { egg: 1 }), 68, T0 + 10);
    expect(none.dinner!.lastResult).toEqual({ category: "ORIGINAL" });
    expect(lastAttempt(none).identityRecipeId).toBeNull();
  });

  it("R9 / R10: raw and burnt pizzas -> INVALID_PIZZA (UNDERBAKED / OVERBAKED), stock consumed", () => {
    const raw = cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 0, T0 + 10);
    expect(raw.dinner!.lastResult).toEqual({ category: "INVALID_PIZZA", reason: "UNDERBAKED" });
    expect(raw.inventory.egg).toBe(2);
    const burnt = cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 100, T0 + 10);
    expect(burnt.dinner!.lastResult).toEqual({ category: "INVALID_PIZZA", reason: "OVERBAKED" });
    expect(run(burnt).completedRecipeIds).toEqual([]);
    expect(lastAttempt(burnt)).toMatchObject({ category: "INVALID_PIZZA", displayedRecipeId: null, consumed: { egg: 1 } });
  });
});

describe("START_BAKE: Stage A picks the window and the CUT step, and freezes the composition", () => {
  it("R11: the identified recipe's bake window drives BAKE and the result (not the generic one)", () => {
    const bismarck = gameReducer({ ...started(), pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    expect(bismarck.phase).toBe("BAKE");
    expect(bismarck.recipe.bakeTarget).toEqual(getRecipe("bismarck")!.bakeTarget);
    // The round never names the identity during BAKE (OD-R6).
    expect([bismarck.recipe.id, bismarck.recipe.nameJa]).toEqual([FREE_COOK_RECIPE.id, FREE_COOK_RECIPE.nameJa]);
    // bismarck at 86: inside the generic band, outside bismarck's -> INVALID_PIZZA (OVERBAKED).
    const over = cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 86, T0 + 10);
    expect(over.dinner!.lastResult).toEqual({ category: "INVALID_PIZZA", reason: "OVERBAKED" });
    // margherita at 89.5: outside the generic band, inside margherita's -> TARGET_PASS.
    const marg = cookPizza(started(), pizzaFor("margherita"), 89.5, T0 + 10);
    expect(marg.dinner!.lastResult).toMatchObject({ category: "TARGET_PASS", recipeId: "margherita" });
  });

  it("R12: a CUT recipe gets its CUT step after BAKE, and resolves only at the CUT confirm", () => {
    let state = gameReducer({ ...started(), pizza: pizzaFor("funghi") }, { type: "START_BAKE", now: T0 });
    expect(state.cookingProfile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"]);
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: mid("funghi"), now: T0 + 1 });
    expect([state.phase, state.makingStep]).toEqual(["POST_BAKE", "CUT"]);
    expect(run(state).attempts).toEqual([]); // not resolved yet
    expect(state.dinner!.lastResult).toBeNull();
    state = cutToResult(state, T0 + 2);
    expect(state.phase).toBe("RESULT");
    expect(run(state).completedRecipeIds).toEqual(["funghi"]);
  });

  it("R13: no match -> the generic window and no CUT: the result comes at CONFIRM_BAKE", () => {
    let state = gameReducer({ ...started({ ...EXACT_A, egg: 3 }), pizza: pizzaFor("funghi", {}, { egg: 1 }) }, { type: "START_BAKE", now: T0 });
    expect(state.recipe.bakeTarget).toEqual(FREE_COOK_BAKE_TARGET);
    expect(state.cookingProfile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 68, now: T0 + 1 });
    expect(state.phase).toBe("RESULT");
    expect(state.dinner!.lastResult).toEqual({ category: "ORIGINAL" });
  });

  it("new-haven-apizza (identified, no CUT) resolves straight at CONFIRM_BAKE", () => {
    const inventory = { ...EXACT_A, "olive-oil": 1, parmigiano: 2, clam: 3, garlic: 2 };
    const state = cook(startedCustom(["new-haven-apizza", "margherita"], inventory, [...DM_A_IDS, "new-haven-apizza"]), "new-haven-apizza", T0 + 3);
    expect(state.phase).toBe("RESULT");
    expect(run(state).completedRecipeIds).toEqual(["new-haven-apizza"]);
    expect(state.inventory).toMatchObject({ "olive-oil": 0, parmigiano: 0, clam: 0, garlic: 0 });
  });

  it("the composition cannot change after START_BAKE (BAKE / POST_BAKE / RESULT)", () => {
    const composition: GameAction[] = [
      { type: "PLACE_TOPPING", ingredientId: "egg", x: 50, y: 50 },
      { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 },
      { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: [] },
      { type: "RESET_PIZZA" },
    ];
    const bake = gameReducer({ ...started(), pizza: pizzaFor("funghi") }, { type: "START_BAKE", now: T0 });
    const post = gameReducer(bake, { type: "CONFIRM_BAKE", value: mid("funghi"), now: T0 + 1 });
    const result = cutToResult(post, T0 + 2);
    for (const state of [bake, post, result]) {
      for (const action of composition) expect(gameReducer(state, action), `${state.phase} ${action.type}`).toBe(state);
    }
    // START_BAKE twice does not re-plan.
    expect(gameReducer(bake, { type: "START_BAKE", now: T0 + 1 })).toBe(bake);
  });
});

describe("inventory: exactly once, from the stock captured before CONFIRM_BAKE", () => {
  it("R15 / R16: CONFIRM_BAKE consumes once; the CUT confirm resolves against the captured pre-consumption stock and consumes nothing more", () => {
    let state = gameReducer({ ...started(), pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    expect(state.inventory).toEqual(EXACT_A);
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: mid("bismarck"), now: T0 + 1 });
    expect(state.inventory.egg).toBe(1); // consumed now, once
    expect(state.dinner!.pending!.preConsumptionInventory).toEqual(EXACT_A); // captured before it
    const pizza = state.pizza;
    const cut = cutToResult(state, T0 + 2);
    expect(cut.inventory).toBe(state.inventory); // the CUT confirm never touches the stock
    expect(cut.inventory.egg).toBe(1);
    // DM-A exact stock: egg 1 left covers breakfast-pizza. Resolving from the post-bake stock
    // (the double-consumption bug) would see egg 0 and fail the run INFEASIBLE.
    expect(run(cut)).toMatchObject({ status: "PLAYING", completedRecipeIds: ["bismarck"] });
    expect(lastAttempt(cut).consumed).toEqual({ egg: 1 });
    // The resolver's own post-consumption stock equals the reducer's single consumption.
    const parity = resolveDinnerAttempt({
      run: state.dinner!.run,
      pizza,
      cutCompleted: true,
      preConsumptionInventory: EXACT_A,
      ownedIngredientIds: ALL_IDS,
      dex: state.dex,
      minimumStars: S,
      now: T0 + 2,
    });
    expect(parity.status === "RESOLVED" && parity.postConsumptionInventory).toEqual(cut.inventory);
    expect(consumePizzaInventory(pizza, EXACT_A)).toEqual(cut.inventory);
    // Mutation guard: feeding the post-bake stock would double-consume and fail the run.
    const doubled = resolveDinnerAttempt({
      run: state.dinner!.run,
      pizza,
      cutCompleted: true,
      preConsumptionInventory: state.inventory,
      ownedIngredientIds: ALL_IDS,
      dex: state.dex,
      minimumStars: S,
      now: T0 + 2,
    });
    expect(doubled.status === "RESOLVED" && doubled.run.status).toBe("FAILED");
  });

  it("R17: every failed category keeps its consumption (no refund)", () => {
    const cases: [string, GameState][] = [
      ["QUALITY_FAIL", cookPizza(started({ ...EXACT_A, egg: 3 }, 5), pizzaFor("bismarck"), 80, T0 + 1)],
      ["INVALID_PIZZA", cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 0, T0 + 1)],
      ["ORIGINAL", cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("funghi", {}, { egg: 1 }), 68, T0 + 1)],
    ];
    for (const [category, state] of cases) {
      expect(state.dinner!.lastResult?.category, category).toBe(category);
      expect(state.inventory.egg, category).toBe(2);
    }
    let dup = cook(started({ ...EXACT_A, egg: 3 }), "bismarck", T0 + 1);
    dup = cook(nextPizza(dup, T0 + 2), "bismarck", T0 + 3);
    expect(dup.dinner!.lastResult?.category).toBe("DUPLICATE_TARGET");
    expect(dup.inventory.egg).toBe(1);
  });

  it("a starter-only target consumes nothing and never affects feasibility", () => {
    const state = started();
    const result = cook(state, "margherita", T0 + 10, { mozzarella: 9, basil: 9 });
    expect(result.inventory).toEqual(state.inventory);
    expect(run(result).completedRecipeIds).toEqual(["margherita"]);
  });
});

describe("feasibility and the end of the run", () => {
  it("R18: a duplicate that uses up the shared egg -> the remaining set is infeasible -> INFEASIBLE", () => {
    let state = cook(started(), "bismarck", T0 + 10);
    state = cook(nextPizza(state, T0 + 11), "bismarck", T0 + 20);
    expect(state.dinner!.lastResult?.category).toBe("DUPLICATE_TARGET");
    expect(run(state).outcome).toEqual({
      kind: "FAILED",
      reason: "INFEASIBLE",
      endedAt: T0 + 20,
      shortages: [{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }],
    });
    expect(nextPizza(state, T0 + 21)).toBe(state); // the run is over
  });

  it("over-placing a second egg on bismarck completes it, then fails the run at once (post-bake stock)", () => {
    const result = cook(started(), "bismarck", T0 + 10, { egg: 2 });
    expect(result.inventory.egg).toBe(0);
    expect(run(result).completedRecipeIds).toEqual(["bismarck"]);
    expect(run(result).outcome).toMatchObject({ reason: "INFEASIBLE" });
  });

  it("the no-CUT path judges its own post-consumption stock too (New Haven over-places parmigiano)", () => {
    const inventory = { ...EXACT_A, "olive-oil": 1, parmigiano: 4, clam: 3, garlic: 2, eggplant: 3 };
    const board = startedCustom(["new-haven-apizza", "parmigiana-pizza"], inventory, [...DM_A_IDS, "new-haven-apizza", "parmigiana-pizza"]);
    const state = cook(board, "new-haven-apizza", T0 + 3, { parmigiano: 3 });
    expect(state.inventory.parmigiano).toBe(1);
    expect(run(state).outcome).toMatchObject({
      reason: "INFEASIBLE",
      shortages: [{ ingredientId: "parmigiano", need: 2, have: 1, recipeIds: ["parmigiana-pizza"] }],
    });
  });

  it("R19: the final target CLEARs even when it empties the stock (CLEAR before feasibility)", () => {
    for (const order of [DM_A_IDS, [...DM_A_IDS].reverse(), ["funghi", "bismarck", "margherita", "breakfast-pizza"]]) {
      let state = started();
      order.forEach((id, i) => {
        state = cook(state, id, T0 + 1000 * (i + 1));
        if (i < order.length - 1) state = nextPizza(state, T0 + 1000 * (i + 1) + 1);
      });
      expect(run(state).status, order.join(">")).toBe("CLEARED");
      expect(run(state).outcome).toEqual({ kind: "CLEAR", endedAt: T0 + 4000, clearMs: 4000 });
      expect(state.inventory).toEqual({ egg: 0, bacon: 0, mushroom: 0 });
      expect(run(state).attempts).toHaveLength(4);
    }
  });

  it("R20: the clock reaching 0 -> TIME_UP; a bake or CUT confirmed after it consumes and completes nothing", () => {
    const state = started();
    expect(gameReducer(state, { type: "DINNER_TICK", now: T0 + DURATION - 1 })).toBe(state);
    expect(run(gameReducer(state, { type: "DINNER_TICK", now: T0 + DURATION })).outcome).toEqual({
      kind: "FAILED",
      reason: "TIME_UP",
      endedAt: T0 + DURATION,
    });
    const bake = gameReducer({ ...state, pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    const late = gameReducer(bake, { type: "CONFIRM_BAKE", value: mid("bismarck"), now: T0 + DURATION });
    expect(late.phase).toBe("BAKE");
    expect(late.inventory).toBe(bake.inventory);
    expect(run(late).outcome).toMatchObject({ reason: "TIME_UP" });
    const post = gameReducer(bake, { type: "CONFIRM_BAKE", value: mid("bismarck"), now: T0 + 1 });
    const lateCut = cutToResult(post, T0 + DURATION + 5);
    expect(run(lateCut).completedRecipeIds).toEqual([]);
    expect(run(lateCut).outcome).toMatchObject({ reason: "TIME_UP" });
    expect(lateCut.inventory).toBe(post.inventory);
  });
});

describe("Shop / hint / Dex / Pitz / Lunch Rush isolation", () => {
  it("R21: purchases and refills are rejected during a run", () => {
    const state = started();
    expect(gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId: "egg" })).toBe(state);
    expect(gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "capers" })).toBe(state);
  });

  it("R22: hints and hint purchases are rejected during a run", () => {
    const state = started();
    for (const action of [
      { type: "SHOW_HINT" },
      { type: "SHOW_HINT", pinnedRecipeId: "hawaiian" },
      { type: "PURCHASE_DISCOVERY_HINT", level: 1 },
      { type: "PURCHASE_SELECTABLE_HINT", preference: "INGREDIENT", expectedPaidCount: 0 },
    ] as GameAction[]) {
      expect(gameReducer(state, action), action.type).toBe(state);
    }
    expect(state.hintSheetOpen).toBe(false);
  });

  it("R23 / R24: a cleared run and a failed run leave the Dex, discovery and Pitz untouched", () => {
    const board = started(EXACT_A, S, [...DM_A_IDS, "marinara"]);
    const dexBefore = JSON.stringify(board.dex);
    let state = board;
    DM_A_IDS.forEach((id, i) => {
      state = cook(state, id, T0 + 1000 * (i + 1));
      expect(gameReducer(state, { type: "REGISTER_TO_DEX" })).toBe(state);
      expect(state.lastPitzCredit).toBeNull();
      expect(state.lastEfficiencyCredit).toBeNull();
      expect(state.cookingTiming).toBeNull();
      if (i < 3) state = nextPizza(state, T0 + 1000 * (i + 1) + 1);
    });
    expect(run(state).status).toBe("CLEARED");
    const original = cook(started({ ...EXACT_A, ham: 2, pineapple: 3 }), "hawaiian", T0 + 10); // undiscovered
    const failed = cookPizza(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 0, T0 + 10);
    for (const s of [state, original, failed]) {
      expect(JSON.stringify(s.dex)).toBe(dexBefore);
      expect(s.justDiscovered).toBe(false);
      expect(s.justGotNewBest).toBe(false);
      expect(s.lastDiscovery).toBeNull();
      expect(s.pitzBalance).toBe(PITZ);
      expect(s.score).toBeNull(); // no sentinel score left for any screen to misread
    }
  });

  it("Lunch Rush reward / skip / order actions and every other round start are refused during a run", () => {
    const state = started();
    for (const action of [
      { type: "CLAIM_MISSION_REWARD", runId: 9, amount: 100 },
      { type: "MISSION_SKIP_ORDER", recipeId: "bismarck" },
      { type: "MISSION_NEXT_ORDER" },
      { type: "MISSION_RESET_ORDER" },
      { type: "START_FREE_COOK", now: T0 },
      { type: "SELECT_RECIPE", recipeId: "bismarck", now: T0 },
      { type: "BEGIN_PREPARE", now: T0 },
      { type: "RETRY_SAME_RECIPE", now: T0 },
      { type: "PLAY_AGAIN" },
    ] as GameAction[]) {
      expect(gameReducer(state, action), action.type).toBe(state);
    }
    expect(state.missionSoldOutRecipeIds).toEqual([]);
  });

  it("after exiting, Free Cooking and guided rounds work as before", () => {
    const exited = gameReducer(
      gameReducer(gameReducer(started(), { type: "DINNER_REQUEST_ABANDON" }), { type: "DINNER_CONFIRM_ABANDON", now: T0 }),
      { type: "DINNER_EXIT" },
    );
    const free = gameReducer(exited, { type: "START_FREE_COOK", now: T0 });
    expect([free.roundKind, free.freeCook]).toEqual(["FREE_COOK", true]);
    const guided = gameReducer(exited, { type: "SELECT_RECIPE", recipeId: "funghi", now: T0 });
    expect([guided.roundKind, guided.phase]).toEqual(["GUIDED", "PREPARE"]);
    expect(guided.cookingTiming).not.toBeNull();
  });
});

describe("HOME, reload and stale actions", () => {
  it("R26: HOME asks first; cancel keeps the run; confirm abandons (no reward); exit returns to a normal round", () => {
    const state = started();
    const requested = gameReducer(state, { type: "DINNER_REQUEST_ABANDON" });
    expect(requested.dinner!.abandonRequested).toBe(true);
    const cancelled = gameReducer(requested, { type: "DINNER_CANCEL_ABANDON" });
    expect([cancelled.dinner!.abandonRequested, run(cancelled).status]).toEqual([false, "PLAYING"]);
    expect(gameReducer(state, { type: "DINNER_CONFIRM_ABANDON", now: T0 + 5 })).toBe(state); // not requested
    const abandoned = gameReducer(requested, { type: "DINNER_CONFIRM_ABANDON", now: T0 + 5 });
    expect(run(abandoned).outcome).toEqual({ kind: "FAILED", reason: "ABANDONED", endedAt: T0 + 5 });
    expect(abandoned.pitzBalance).toBe(PITZ);
    expect(gameReducer(state, { type: "DINNER_EXIT" })).toBe(state); // refused while PLAYING
    const exited = gameReducer(abandoned, { type: "DINNER_EXIT" });
    expect(exited.dinner).toBeNull();
    expect(exited.roundKind).not.toBe("DINNER");
  });

  it("nothing cooks, bakes or consumes while the HOME confirmation is open; 続ける resumes", () => {
    const prepare = gameReducer(started(), { type: "DINNER_REQUEST_ABANDON" });
    for (const action of [
      { type: "CONFIRM_MAKING_STEP", now: T0 },
      { type: "COMMIT_DOUGH_STRETCH", shape: prepare.pizza.doughShape },
      { type: "START_BAKE", now: T0 },
    ] as GameAction[]) {
      expect(gameReducer(prepare, action), action.type).toBe(prepare);
    }
    const bake = gameReducer({ ...started(), pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    const asked = gameReducer(bake, { type: "DINNER_REQUEST_ABANDON" });
    expect(gameReducer(asked, { type: "CONFIRM_BAKE", value: mid("bismarck"), now: T0 + 1 })).toBe(asked);
    expect(asked.inventory).toEqual(EXACT_A);
    const resumed = gameReducer(asked, { type: "DINNER_CANCEL_ABANDON" });
    const baked = gameReducer(resumed, { type: "CONFIRM_BAKE", value: mid("bismarck"), now: T0 + 2 });
    expect([baked.phase, baked.inventory.egg]).toEqual(["POST_BAKE", 1]);
  });

  it("R25: nothing of a run is saved; a reload starts with no run (consumption stays real)", () => {
    const store = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    };
    const mid1 = nextPizza(cook(started(), "bismarck", T0 + 10), T0 + 11);
    persistProgress(mid1, storage);
    const raw = [...store.values()].join("");
    expect(raw).not.toMatch(/dinner|roundKind|DINNER|attempt/);
    const save = loadSave(storage);
    expect(save.inventory.egg).toBe(1);
    const reloaded = createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance, save.inventory);
    expect(reloaded.dinner).toBeNull();
    expect(reloaded.roundKind).not.toBe("DINNER");
  });

  it("Dinner actions without a run, or out of phase, do nothing; removed selection actions do not exist", () => {
    const base = saved(EXACT_A);
    for (const action of [
      { type: "DINNER_NEXT_PIZZA", now: T0 },
      { type: "DINNER_TICK", now: T0 },
      { type: "DINNER_EXIT" },
      { type: "DINNER_REQUEST_ABANDON" },
      { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 },
    ] as unknown as GameAction[]) {
      expect(gameReducer(base, action)).toBe(base);
    }
    const state = started();
    for (const action of [
      { type: "DINNER_NEXT_PIZZA", now: T0 }, // PREPARE, not a result
      { type: "CONFIRM_BAKE", value: 60, now: T0 }, // nothing started baking
      { type: "DINNER_SELECT_TARGET", recipeId: "bismarck", now: T0 },
      { type: "DINNER_RETURN_TO_TARGETS", now: T0 },
      { type: "DINNER_CANCEL_TARGET", now: T0 },
    ] as unknown as GameAction[]) {
      expect(gameReducer(state, action), action.type).toBe(state);
    }
  });

  it("a result-producing confirm without a clock is refused", () => {
    const bake = gameReducer({ ...started(), pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    expect(gameReducer(bake, { type: "CONFIRM_BAKE", value: 60 })).toBe(bake);
  });

  it("a repeated bake / result event consumes and counts only once", () => {
    const result = cook(started(), "bismarck", T0 + 10);
    expect(gameReducer(result, { type: "CONFIRM_BAKE", value: 60, now: T0 + 11 })).toBe(result);
    expect(gameReducer(result, { type: "CONFIRM_MAKING_STEP", now: T0 + 11 })).toBe(result);
    expect(run(result).attempts).toHaveLength(1);
    expect(result.inventory.egg).toBe(1);
    const next = nextPizza(result, T0 + 12);
    expect(nextPizza(next, T0 + 13)).toBe(next); // not at RESULT any more
  });
});

describe("invariants over random play (seeded)", () => {
  function prng(seed: number) {
    let x = seed >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 0x1_0000_0000;
    };
  }

  it("completed/remaining partition, CLEAR iff empty, terminal is final, stock never rises, one attempt per result, Pitz and Dex never move", () => {
    const pool = [...DM_A_IDS, "marinara", "hawaiian"];
    for (let seed = 1; seed <= 120; seed += 1) {
      const rand = prng(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
      let state = started({
        egg: 2 + Math.floor(rand() * 3),
        bacon: 3 + Math.floor(rand() * 3),
        mushroom: 3 + Math.floor(rand() * 3),
        garlic: 3,
        oregano: 2,
        ham: 2,
        pineapple: 3,
      });
      const dex = JSON.stringify(state.dex);
      let now = T0;
      let wasTerminal = false;
      for (let step = 0; step < 25; step += 1) {
        now += Math.floor(rand() * 40_000);
        const before = state;
        const r = rand();
        if (r < 0.5 && state.phase === "PREPARE" && state.dinner!.run.status === "PLAYING") {
          const id = pick(pool);
          const bake = rand() < 0.15 ? 0 : rand() < 0.1 ? 100 : mid(id);
          state = cookPizza(state, pizzaFor(id, rand() < 0.3 ? { egg: 2, mushroom: 4, bacon: 4 } : {}), bake, now);
          if (state.dinner!.run.status === "PLAYING" && state.phase === "RESULT") {
            expect(run(state).attempts.length, `seed ${seed}`).toBe(run(before).attempts.length + 1);
          }
        } else {
          const actions: GameAction[] = [
            { type: "DINNER_NEXT_PIZZA", now },
            { type: "DINNER_TICK", now },
            { type: "DINNER_REQUEST_ABANDON" },
            { type: "DINNER_CANCEL_ABANDON" },
            { type: "RESTOCK_INGREDIENT", ingredientId: "egg" },
            { type: "PURCHASE_INGREDIENT", ingredientId: "capers" },
            { type: "REGISTER_TO_DEX" },
            { type: "SHOW_HINT" },
            { type: "PLAY_AGAIN" },
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
        expect(session.run.attempts.filter((a) => a.category === "TARGET_PASS").length, `seed ${seed}`).toBe(done.length);
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

describe("Issue #256: a CUT recipe whose bake the Completion Gate failed resolves at CONFIRM_BAKE", () => {
  /** START_BAKE + CONFIRM_BAKE only -- no CUT action is dispatched. */
  function bakeOnly(state: GameState, pizza: PizzaState, bake: number, now: number): GameState {
    const baking = gameReducer({ ...state, pizza }, { type: "START_BAKE", now });
    expect(baking.cookingProfile.steps).toContain("CUT"); // an identified CUT recipe
    return gameReducer(baking, { type: "CONFIRM_BAKE", value: bake, now });
  }

  it("D-1 / D-2: raw and burnt bismarck -> INVALID_PIZZA without CUT; consumed once; no soft-lock", () => {
    for (const [bake, reason] of [[0, "UNDERBAKED"], [100, "OVERBAKED"]] as const) {
      const start = started({ ...EXACT_A, egg: 3 });
      const done = bakeOnly(start, pizzaFor("bismarck"), bake, T0 + 10);
      expect(done.phase).toBe("RESULT");
      expect(done.dinner!.lastResult).toEqual({ category: "INVALID_PIZZA", reason });
      expect(done.dinner!.pending).toBeNull();
      expect(done.cutState.lines).toHaveLength(0);
      expect(done.inventory.egg).toBe(2); // 3 -> 2: exactly one egg, once
      expect(run(done).attempts).toHaveLength(1);
      expect(lastAttempt(done)).toMatchObject({ category: "INVALID_PIZZA", consumed: { egg: 1 } });
      expect(run(done).completedRecipeIds).toEqual([]);
      // The Dinner base completion is cleared as before (the result is the resolver's).
      expect([done.score, done.completion]).toEqual([null, null]);
      // Not stuck: the next pizza starts normally.
      expect(nextPizza(done, T0 + 20).phase).toBe("PREPARE");
      // CUT actions after the result change nothing.
      expect(gameReducer(done, { type: "CONFIRM_MAKING_STEP", now: T0 + 30 })).toBe(done);
    }
  });

  it("D-1b: the result equals the same pizza's result through the old CUT walk (only CUT is gone)", () => {
    const skipped = bakeOnly(started({ ...EXACT_A, egg: 3 }), pizzaFor("bismarck"), 0, T0 + 10);
    const viaResolver = resolveDinnerAttempt({
      run: run(started({ ...EXACT_A, egg: 3 })),
      pizza: { ...pizzaFor("bismarck"), bakeResult: 0 },
      cutCompleted: true,
      preConsumptionInventory: { ...EXACT_A, egg: 3 },
      ownedIngredientIds: ALL_IDS,
      dex: skipped.dex,
      minimumStars: S,
      now: T0 + 10,
    });
    expect(viaResolver.status).toBe("RESOLVED");
    if (viaResolver.status === "RESOLVED") expect(skipped.inventory).toEqual(viaResolver.postConsumptionInventory);
  });

  it("D-3: an in-band bake (incl. a ★4 badge-only one) still requires CUT", () => {
    const { start, end } = getRecipe("bismarck")!.bakeTarget;
    for (const bake of [start - (end - start) * 0.25, mid("bismarck"), end + (end - start) * 0.25]) {
      const state = bakeOnly(started(), pizzaFor("bismarck"), bake, T0 + 10);
      expect([state.phase, state.makingStep]).toEqual(["POST_BAKE", "CUT"]);
      expect(state.dinner!.lastResult).toBeNull();
      expect(run(state).attempts).toEqual([]);
      expect(cutToResult(state, T0 + 20).dinner!.lastResult).toMatchObject({ category: "TARGET_PASS", recipeId: "bismarck" });
    }
  });

  it("D-4: TIME_UP still wins at CONFIRM_BAKE, and the HOME dialog still freezes it", () => {
    const baking = gameReducer({ ...started(), pizza: pizzaFor("bismarck") }, { type: "START_BAKE", now: T0 });
    const late = gameReducer(baking, { type: "CONFIRM_BAKE", value: 0, now: T0 + DURATION });
    expect(late.phase).toBe("BAKE");
    expect(late.inventory).toBe(baking.inventory);
    expect(run(late).outcome).toMatchObject({ reason: "TIME_UP" });
    const asking = gameReducer(baking, { type: "DINNER_REQUEST_ABANDON" });
    expect(asking.dinner!.abandonRequested).toBe(true);
    expect(gameReducer(asking, { type: "CONFIRM_BAKE", value: 0, now: T0 + 5 })).toBe(asking);
  });

  it("an unidentified composition is unchanged: no CUT either way", () => {
    const state = gameReducer({ ...started({ ...EXACT_A, egg: 3 }), pizza: pizzaFor("funghi", {}, { egg: 1 }) }, { type: "START_BAKE", now: T0 });
    expect(state.cookingProfile.steps).not.toContain("CUT");
    const done = gameReducer(state, { type: "CONFIRM_BAKE", value: 0, now: T0 + 1 });
    expect(done.dinner!.lastResult).toEqual({ category: "INVALID_PIZZA", reason: "UNDERBAKED" });
  });
});
