/**
 * Dough Kind P2 (Issue #577, design §6.4): whether the DOUGH step offers the dough-kind chips. Pure; the same shape as the ○/□ rule
 * (./panSwitch.ts) with the dough technique's OWN affordance, so neither switch's opening depends on the other's.
 *
 * The answer is a function of the round's kind, the step and the player's Dex progress only -- never of a Research target, an
 * ingredient match, a purchased hint or the technique ledger (Anti-Oracle: the chips must not tell the player what a target needs).
 * In Production no catalog target requires the dough technique (INV-TQ-4), so the affordance is closed for every player until P3.
 */
import type { DexState } from "../../state/dex";
import { creditedDiscoveredCount } from "../../state/materialEntitlement";
import type { GamePhase, MakingStep } from "../../state/gameReducer";
import { TECHNIQUES } from "../../data/techniques";
import { DOUGH_TECHNIQUE_ID } from "./detection";
import { isTechniqueAffordanceOpen, techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, type TechniqueRoundEligibility, type TechniqueRuntimeContext } from "./runtime";

/** Whether the dough technique's affordance is open for this Dex (the same rule `resolveRoundTechniques` applies). */
export function isDoughAffordanceOpen(dex: DexState, context: TechniqueRuntimeContext = productionTechniqueContext()): boolean {
  return isTechniqueAffordanceOpen(
    techniqueAffordanceStep(DOUGH_TECHNIQUE_ID, context.catalog, context.materialStep),
    creditedDiscoveredCount(dex, context.countsTowardLadder),
  );
}

export interface DoughSwitchInput {
  phase: GamePhase;
  makingStep: MakingStep;
  eligibility: TechniqueRoundEligibility;
  affordanceOpen: boolean;
}

export function isDoughSwitchVisible(input: DoughSwitchInput): boolean {
  return input.phase === "PREPARE" && input.makingStep === "DOUGH" && input.eligibility === "FREE_COOK" && input.affordanceOpen;
}

/**
 * The second chip's text (Owner, 2026-10-20): the neutral label until the technique is in the player's ledger, then the technique's own
 * name -- whether or not the chip is selected (merely selecting never shows the name). Reads the ledger only; no recipe, target or hint.
 */
export function doughChipOtherLabel(ledger: readonly string[], neutral: string): string {
  if (!ledger.includes(DOUGH_TECHNIQUE_ID)) return neutral;
  return TECHNIQUES.find((t) => t.id === DOUGH_TECHNIQUE_ID)?.nameJa ?? neutral;
}
