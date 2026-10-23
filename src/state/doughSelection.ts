/**
 * Dough Kind P2 (Issue #577): the player's dough-kind choice in the DOUGH step -- who may choose, and the pizza it leaves.
 * Pure; the reducer's SELECT_DOUGH and GameScreen's chips both read it, so the two can never disagree.
 *
 * Mirrors ./panSelection.ts and is independent of it: choosing a dough kind writes only `pizza.dough` (never `pan`, `doughShape`,
 * `squareDough`, the cooking profile or the CUT state), and choosing a pan never touches `dough` (design §2.2). The chips are offered
 * only in Free Cooking / Research at the DOUGH step once the dough technique's own derived affordance is open; a recipe that fixes
 * its own dough kind (a Guided Pinsa) has no choice to make. Confirming 「次へ」 leaves the DOUGH step, after which no choice is
 * accepted; 「作り直す」 (RESET_PIZZA) discards the whole pizza, the choice included. Never persisted.
 */
import { isDoughKind, resolveDoughKind, type DoughKind } from "../logic/dough/doughKind";
import { isDoughAffordanceOpen, isDoughSwitchVisible } from "../logic/techniques/doughSwitch";
import { techniqueRoundEligibility } from "../logic/techniques/runtime";
import { doughSwitchForcedOpen } from "../preview/doughKindPreview";
import type { DexState } from "./dex";
import type { GamePhase, MakingStep } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";

export function isDoughAffordanceOpenNow(dex: DexState): boolean {
  return doughSwitchForcedOpen() || isDoughAffordanceOpen(dex);
}

export interface DoughSwitchRound {
  phase: GamePhase;
  makingStep: MakingStep;
  isMissionRound: boolean;
  isDinnerRound: boolean;
  freeCook: boolean;
  recipe: object | null | undefined;
  dex: DexState;
}

export function doughSwitchOffered(round: DoughSwitchRound): boolean {
  return (
    resolveDoughKind(round.recipe) === "standard" &&
    isDoughSwitchVisible({
      phase: round.phase,
      makingStep: round.makingStep,
      eligibility: techniqueRoundEligibility(round),
      affordanceOpen: isDoughAffordanceOpenNow(round.dex),
    })
  );
}

/** The pizza after choosing `kind`, or the same object when nothing changes (an unknown kind changes nothing). */
export function pizzaWithDough(pizza: PizzaState, kind: DoughKind): PizzaState {
  if (!isDoughKind(kind)) return pizza;
  if (kind !== "standard") return pizza.dough === kind ? pizza : { ...pizza, dough: kind };
  if (pizza.dough === undefined) return pizza;
  const { dough: _dough, ...rest } = pizza;
  return rest;
}

/**
 * P3-a1 (Issue #577, Owner D5): the pizza a round starts from. Empty, plus the dough kind the RECIPE fixes (`Recipe.doughKind`, resolved by
 * `resolveDoughKind`): without it a Guided Pinsa would keep the `"standard"` dough axis and be discovered as the recipe that shares its
 * ingredients. A standard recipe (every shipped one) and the Free Cooking sentinel return `createEmptyPizza()` with no `dough` key, so
 * nothing about an existing round changes. Used by `buildOrderState` (every round start / retry) and `RESET_PIZZA` (a discarded pizza
 * restarts from the recipe's own dough, design §6.5).
 */
export function startingPizzaFor(recipe: object | null | undefined): PizzaState {
  return pizzaWithDough(createEmptyPizza(), resolveDoughKind(recipe));
}
