/**
 * Square Dough F4-b (Issue #538, Epic #532): the player's ○/□ choice in the DOUGH step -- who may choose, and the pizza it leaves.
 * Pure; the reducer's SELECT_PAN and GameScreen's switch both read it, so the two can never disagree.
 *
 * The switch is offered only in Free Cooking / Research (`FREE_COOK`) at the DOUGH step once the derived tray affordance is open
 * (F4-a `isPanSwitchVisible`). It never depends on what the player owns: the affordance is a Dex-progress rule, so a player who has
 * not yet bought the ingredients can still choose the shape. A recipe whose own pan is square (Preview `?pan=square`, a future
 * square-only recipe) has no choice to make.
 *
 * Choosing keeps both doughs: `doughShape` (○) and `squareDough` (□) stay on the pizza, so ○→□→○ loses nothing. Only the explicit
 * `pan` changes (`"tray"` or absent), and absent means the key is removed -- a pizza back on ○ is deep-equal to one never switched.
 * Confirming 「次へ」 leaves the DOUGH step, after which no choice is accepted (O-7); 「作り直す」 (RESET_PIZZA) discards the whole
 * pizza, the choice included.
 */
import { activePanShape, panSwitchForcedOpen } from "../preview/panShapePreview";
import { isPanSwitchVisible, isTrayAffordanceOpen } from "../logic/techniques/panSwitch";
import { techniqueRoundEligibility } from "../logic/techniques/runtime";
import type { DexState } from "./dex";
import type { GamePhase, MakingStep } from "./gameReducer";
import type { PanId, PizzaState } from "./pizzaState";

export type PanChoice = "round" | PanId;

export function isTrayAffordanceOpenNow(dex: DexState): boolean {
  return panSwitchForcedOpen() || isTrayAffordanceOpen(dex);
}

export interface PanSwitchRound {
  phase: GamePhase;
  makingStep: MakingStep;
  isMissionRound: boolean;
  isDinnerRound: boolean;
  freeCook: boolean;
  recipe: Parameters<typeof activePanShape>[0];
  dex: DexState;
}

export function panSwitchOffered(round: PanSwitchRound): boolean {
  return (
    activePanShape(round.recipe) !== "square" &&
    isPanSwitchVisible({
      phase: round.phase,
      makingStep: round.makingStep,
      eligibility: techniqueRoundEligibility(round),
      affordanceOpen: isTrayAffordanceOpenNow(round.dex),
    })
  );
}

/** The pizza after choosing `choice`, or the same object when nothing changes. */
export function pizzaWithPan(pizza: PizzaState, choice: PanChoice): PizzaState {
  if (choice === "tray") return pizza.pan === "tray" ? pizza : { ...pizza, pan: "tray" };
  if (pizza.pan == null) return pizza;
  const { pan: _pan, ...rest } = pizza;
  return rest;
}
