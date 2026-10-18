/**
 * Square Dough F4-a (Issue #538, Epic #532): whether the DOUGH step offers the ○/□ switch. Pure; nothing renders it yet
 * (F4-b wires the switch and its action).
 *
 * The answer is a function of the round's kind, the step and the player's progress only -- never of a Research target, an
 * ingredient match or a purchased hint (Anti-Oracle: the switch must not tell the player what a target needs). It is shown
 * only where the tray can actually be used (`FREE_COOK`: Free Cooking and Research; INV-TQ-6 / OD-TQ1C-3), so a guided
 * round (the recipe fixes the pan), Lunch Rush and Dinner never get it.
 *
 * The affordance is the derived one (`techniqueAffordanceStep`, OD-TQ1D-2 credited count): no catalog target requires the
 * tray yet, so in Production it is closed for every player until Square Dough E adds the first such recipe (INV-TQ-4).
 */
import type { DexState } from "../../state/dex";
import { creditedDiscoveredCount } from "../../state/materialEntitlement";
import type { GamePhase, MakingStep } from "../../state/gameReducer";
import { isTechniqueAffordanceOpen, techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, type TechniqueRoundEligibility, type TechniqueRuntimeContext } from "./runtime";

/** Whether the tray technique's affordance is open for this Dex (the same rule `resolveRoundTechniques` applies). */
export function isTrayAffordanceOpen(dex: DexState, context: TechniqueRuntimeContext = productionTechniqueContext()): boolean {
  return isTechniqueAffordanceOpen(
    techniqueAffordanceStep("tray", context.catalog, context.materialStep),
    creditedDiscoveredCount(dex, context.countsTowardLadder),
  );
}

export interface PanSwitchInput {
  phase: GamePhase;
  makingStep: MakingStep;
  eligibility: TechniqueRoundEligibility;
  affordanceOpen: boolean;
}

export function isPanSwitchVisible(input: PanSwitchInput): boolean {
  return input.phase === "PREPARE" && input.makingStep === "DOUGH" && input.eligibility === "FREE_COOK" && input.affordanceOpen;
}
