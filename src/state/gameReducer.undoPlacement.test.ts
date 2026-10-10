import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { INGREDIENTS } from "../data/ingredients";
import type { DexEntry, DexState } from "./dex";
import type { InventoryState } from "./inventory";
import { createGuidedInitialState } from "./testSupport/guidedRound";
import { canUndoPlacement, undoablePlacementIndex } from "./undoPlacement";
import { getDinnerMission } from "../mission/dinner/dinnerMission";

/**
 * Cooking Steps 2.0 Phase 1 (Issue #449, parent #270): UNDO_LAST_PLACEMENT.
 * Pins the Owner's UD-A (Guided / Free Cooking / Research / Dinner; never Lunch Rush) and the design's
 * "last piece of the current step's category, nothing else" rule (docs/reports/
 * TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md §3, AC-U1..U4, U7).
 */

const UNDO: GameAction = { type: "UNDO_LAST_PLACEMENT" };
const ALL_IDS = INGREDIENTS.map((i) => i.id);

function prepare(step: GameState["makingStep"], extra: Partial<GameState> = {}): GameState {
  const base = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
  return { ...base, makingStep: step, ...extra };
}

function place(state: GameState, ingredientId: string, x: number, y: number): GameState {
  const next = gameReducer(state, { type: "PLACE_TOPPING", ingredientId, x, y });
  expect(next.pizza.toppings.length, `${ingredientId} was placed`).toBe(state.pizza.toppings.length + 1);
  return next;
}

const ids = (state: GameState) => state.pizza.toppings.map((t) => t.ingredientId);

describe("undoablePlacementIndex / canUndoPlacement (the one rule shared with the button)", () => {
  it("targets the last piece of the current step's category", () => {
    let s = prepare("CHEESE");
    expect(undoablePlacementIndex(s)).toBe(-1);
    expect(canUndoPlacement(s)).toBe(false);
    s = place(place(s, "mozzarella", 40, 40), "mozzarella", 60, 40);
    expect(undoablePlacementIndex(s)).toBe(1);
    expect(canUndoPlacement(s)).toBe(true);
  });

  it("is -1 outside PREPARE and on steps that place no piece", () => {
    const placed = place(prepare("CHEESE"), "mozzarella", 40, 40);
    for (const step of ["DOUGH", "SAUCE"] as const) expect(undoablePlacementIndex({ ...placed, makingStep: step })).toBe(-1);
    for (const phase of ["ORDER", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"] as const) {
      expect(undoablePlacementIndex({ ...placed, phase })).toBe(-1);
    }
  });
});

describe("UNDO_LAST_PLACEMENT in a guided round", () => {
  it("removes only the last cheese in CHEESE and keeps the earlier one in place", () => {
    const s = place(place(prepare("CHEESE"), "mozzarella", 40, 40), "mozzarella", 62, 44);
    const first = s.pizza.toppings[0];
    const next = gameReducer(s, UNDO);
    expect(next.pizza.toppings).toEqual([first]);
    expect(next.placement).toBeNull();
    expect(next.makingStep).toBe("CHEESE");
  });

  it("undoes repeatedly, then is a no-op that returns the very same state", () => {
    let s = place(place(prepare("CHEESE"), "mozzarella", 40, 40), "mozzarella", 62, 44);
    s = gameReducer(gameReducer(s, UNDO), UNDO);
    expect(s.pizza.toppings).toEqual([]);
    expect(gameReducer(s, UNDO)).toBe(s);
  });

  it("never reaches back into a confirmed step: in TOPPING the cheese placed in CHEESE stays", () => {
    let s = place(prepare("CHEESE"), "mozzarella", 40, 40);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    expect(s.makingStep).toBe("TOPPING");
    s = place(s, "basil", 60, 60);
    s = gameReducer(s, UNDO);
    expect(ids(s)).toEqual(["mozzarella"]);
    expect(gameReducer(s, UNDO)).toBe(s);
  });

  it("is refused on DOUGH and SAUCE (sauce deposits are not pieces) and outside PREPARE", () => {
    const placed = place(prepare("CHEESE"), "mozzarella", 40, 40);
    for (const step of ["DOUGH", "SAUCE"] as const) {
      const s = { ...placed, makingStep: step };
      expect(gameReducer(s, UNDO)).toBe(s);
    }
    for (const phase of ["BAKE", "POST_BAKE", "RESULT", "DISCOVERED"] as const) {
      const s = { ...placed, phase };
      expect(gameReducer(s, UNDO)).toBe(s);
    }
  });

  it("changes nothing but the pizza's pieces, the hint and the placement feedback (AC-U3 / AC-U7)", () => {
    const s = place(prepare("CHEESE"), "mozzarella", 40, 40);
    const next = gameReducer(s, UNDO);
    const { pizza: p1, hint: h1, placement: pl1, ...rest1 } = s;
    const { pizza: p2, hint: h2, placement: pl2, ...rest2 } = next;
    expect(rest2).toEqual(rest1);
    expect(next.inventory).toBe(s.inventory);
    expect(next.cookingTiming).toBe(s.cookingTiming);
    expect(next.dex).toBe(s.dex);
    expect(p2.sauceIds).toBe(p1.sauceIds);
    expect(p2.sauceDeposits).toBe(p1.sauceDeposits);
    expect(p2.doughShape).toBe(p1.doughShape);
    void [h1, h2, pl1, pl2];
  });
});

describe("stock and consumption (the Stock Gate frees naturally; consumption stays once, at CONFIRM_BAKE)", () => {
  const finite = (inventory: InventoryState): Partial<GameState> => ({
    ownedIngredientIds: [...new Set([...createGuidedInitialState().ownedIngredientIds, "chicken"])],
    inventory,
  });

  it("a slot freed by Undo can be placed again", () => {
    let s = prepare("TOPPING", finite({ chicken: 1 }));
    s = place(s, "chicken", 40, 40);
    const blocked = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "chicken", x: 62, y: 44 });
    expect(blocked.pizza.toppings.length).toBe(1);
    expect(blocked.placement?.status).toBe("rejected");
    s = gameReducer(s, UNDO);
    s = place(s, "chicken", 62, 44);
    expect(ids(s)).toEqual(["chicken"]);
  });

  it("placing, undoing and placing again consumes the stock once", () => {
    let s = prepare("TOPPING", finite({ chicken: 3 }));
    s = place(s, "chicken", 40, 40);
    s = gameReducer(s, UNDO);
    expect(s.inventory.chicken).toBe(3); // PREPARE never touches inventory
    s = place(s, "chicken", 40, 40);
    s = gameReducer(s, { type: "START_BAKE" });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 50 });
    expect(s.inventory.chicken).toBe(2);
  });
});

describe("modes (UD-A)", () => {
  it("is refused in a Lunch Rush round", () => {
    const placed = place(prepare("CHEESE"), "mozzarella", 40, 40);
    const lunch: GameState = { ...placed, roundKind: "LUNCH_RUSH", isMissionRound: true };
    expect(canUndoPlacement(lunch)).toBe(false);
    expect(gameReducer(lunch, UNDO)).toBe(lunch);
  });

  it("works in a Free Cooking (Research) round", () => {
    const free = gameReducer(createInitialGameState(dexOf(["margherita"]), ALL_IDS, 0, {}, [], [], {}), { type: "START_FREE_COOK" });
    expect(free.roundKind).toBe("FREE_COOK");
    let s = gameReducer(free, { type: "BEGIN_PREPARE" });
    s = { ...s, makingStep: "TOPPING" };
    s = place(s, "basil", 40, 40);
    expect(ids(gameReducer(s, UNDO))).toEqual([]);
  });

  it("works in a Dinner round while PLAYING and only in PREPARE", () => {
    // Same preconditions as gameReducer.dinner.test.ts: DM-A's targets discovered, finite stock exactly enough.
    const finiteIds = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
    const base = createInitialGameState(
      dexOf([...getDinnerMission("dm-a")!.targetRecipeIds, "marinara"]),
      ALL_IDS,
      500,
      { egg: 2, bacon: 3, mushroom: 3 },
      [],
      finiteIds,
      {},
    );
    const dinner = gameReducer(base, { type: "DINNER_START", missionId: "dm-a", now: 1_000_000, durationMs: 600_000, minimumStars: 3 });
    expect(dinner.roundKind).toBe("DINNER");
    let s: GameState = { ...dinner, makingStep: "TOPPING" };
    s = place(s, "basil", 40, 40);
    expect(ids(gameReducer(s, UNDO))).toEqual([]);
    const baking: GameState = { ...s, phase: "BAKE" };
    expect(gameReducer(baking, UNDO)).toBe(baking);
  });
});

function dexOf(recipeIds: readonly string[]): DexState {
  return recipeIds.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}
