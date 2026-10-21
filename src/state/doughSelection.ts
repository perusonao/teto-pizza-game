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
import type { PizzaState } from "./pizzaState";

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
