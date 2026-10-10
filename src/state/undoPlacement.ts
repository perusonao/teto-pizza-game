/**
 * Cooking Steps 2.0 Phase 1 (Issue #449, parent #270): "1つ戻す" -- take back the piece the player placed last.
 *
 * Authority: docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md §3 and the Owner's UD-A
 * (Guided / Free Cooking / Research / Dinner; never Lunch Rush).
 *
 * There is no history stack. `pizza.toppings` is append-only (PLACE_TOPPING only appends) and every piece is
 * category-gated to its step (cheese only in CHEESE, topping only in TOPPING), so "the last piece of the current
 * step's category" *is* the last placement, and a piece from a step that was already confirmed can never match
 * (different category) -- the one-way step flow holds structurally. Nothing is persisted.
 *
 * Out of scope on purpose: sauce (a deposit is not a piece), dough shaping (already reversible), bake, CUT and
 * any confirmed step.
 */
import { getIngredient } from "../data/ingredients";
import type { PizzaState } from "./pizzaState";
import { isLunchRushRound, type HasRoundKind } from "./roundKind";
import type { GamePhase, MakingStep } from "./gameReducer";

/** The slice of `GameState` the rule reads (kept structural so the module has no value import of the reducer). */
export interface UndoPlacementContext extends HasRoundKind {
  phase: GamePhase;
  makingStep: MakingStep;
  pizza: Pick<PizzaState, "toppings">;
}

/** The ingredient category a step places, or null for a step that places no piece. */
function placedCategoryOf(step: MakingStep): "cheese" | "topping" | null {
  if (step === "CHEESE") return "cheese";
  if (step === "TOPPING") return "topping";
  return null;
}

/**
 * Index in `pizza.toppings` of the piece an undo would remove, or -1 when nothing can be undone (wrong phase or
 * step, Lunch Rush, or no piece of the current step's category on the pizza).
 */
export function undoablePlacementIndex(context: UndoPlacementContext): number {
  if (context.phase !== "PREPARE") return -1;
  // Lunch Rush is excluded by the Owner (UD-A); Dinner is not a Lunch Rush round and is included.
  if (isLunchRushRound(context)) return -1;
  const category = placedCategoryOf(context.makingStep);
  if (category === null) return -1;
  const pieces = context.pizza.toppings;
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    if (getIngredient(pieces[index].ingredientId)?.category === category) return index;
  }
  return -1;
}

export function canUndoPlacement(context: UndoPlacementContext): boolean {
  return undoablePlacementIndex(context) >= 0;
}
