/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): the pure technique-discovery rules. Unwired (TQ-1C
 * calls `registerTechniqueDiscovery` from the same REGISTER_TO_DEX transition that writes the Dex,
 * so a round saves once and a technique is never recorded twice).
 *
 * Rules (Final Implementation Gate §1, Owner Decision Gate §6):
 * - Only a finished pizza counts (recipe-free Completion Gate PASS).
 * - A recipe match always records every technique the recipe requires (INV-TQ-1: a discovered
 *   recipe implies its techniques are discovered). The affordance gate does not apply to it.
 * - An original pizza records a used technique only once that technique's affordance is open
 *   (INV-TQ-6) -- e.g. no "new technique" for a forgotten sauce during onboarding.
 * - Exactly once: the ledger only grows, and a technique already in it is never reported again.
 * - Unknown ids already in the ledger (written by a newer build) are kept, in place.
 * - No ⭐ and no Pitz: nothing here touches either (OD-TQ-7).
 */
import { KNOWN_TECHNIQUE_IDS, TECHNIQUES, type TechniqueId } from "../../data/techniques";
import type { RuntimeSignature } from "../discovery/signature";
import { detectTechniquesUsed, requiredTechniquesOf, type TechniqueTargetView } from "./detection";

export interface TechniqueRegistrationInput {
  /** The persisted ledger (`discoveredTechniqueIds`), possibly holding ids this build does not know. */
  ledger: readonly string[];
  signature: Pick<RuntimeSignature, "ingredientSet" | "sauceBase">;
  completionPassed: boolean;
  /** The recipe target this pizza matched (new or already discovered), or null for an original. */
  matchedTarget: TechniqueTargetView | null;
  isAffordanceOpen: (id: TechniqueId) => boolean;
}

export interface TechniqueRegistrationResult {
  ledger: string[];
  /** Newly discovered this round, in registry order (drives the "technique first" presentation). */
  newlyDiscovered: TechniqueId[];
}

export function registerTechniqueDiscovery(input: TechniqueRegistrationInput): TechniqueRegistrationResult {
  const ledger = [...input.ledger];
  if (!input.completionPassed) return { ledger, newlyDiscovered: [] };
  const fromRecipe = input.matchedTarget ? requiredTechniquesOf(input.matchedTarget) : [];
  const used = detectTechniquesUsed(input.signature);
  const newlyDiscovered = TECHNIQUES.map((t) => t.id).filter(
    (id) => !ledger.includes(id) && (fromRecipe.includes(id) || (used.includes(id) && input.isAffordanceOpen(id))),
  );
  return { ledger: [...ledger, ...newlyDiscovered], newlyDiscovered };
}

/**
 * INV-TQ-1 at load time: every technique a discovered recipe requires is in the ledger (repairs a
 * corrupted or pre-technique save). Unknown ids are kept.
 */
export function backfillTechniqueLedger(
  ledger: readonly string[],
  discoveredTargets: readonly TechniqueTargetView[],
): { ledger: string[]; added: TechniqueId[] } {
  const required = new Set(discoveredTargets.flatMap((t) => requiredTechniquesOf(t)));
  const added = TECHNIQUES.map((t) => t.id).filter((id) => required.has(id) && !ledger.includes(id));
  return { ledger: [...ledger, ...added], added };
}

/** Ids this build knows, in registry order -- what gameplay may read from a ledger. */
export function knownTechniqueIds(ledger: readonly string[]): TechniqueId[] {
  return TECHNIQUES.map((t) => t.id).filter((id) => KNOWN_TECHNIQUE_IDS.includes(id) && ledger.includes(id));
}

/**
 * The affordance (Owner Decision Gate §11): a technique opens at the first ladder step at which a
 * recipe requiring it becomes makeable from unlocked materials -- derived, never an authored step.
 * `materialStep` returns 0 for a starter, the ladder step that unlocks a material, or null when no
 * step does. Returns null when no target requires the technique (INV-TQ-4: a technique no recipe
 * uses never opens, so it can never be "discovered" into a dead end).
 */
export function techniqueAffordanceStep(
  id: TechniqueId,
  targets: readonly (TechniqueTargetView & { items: readonly string[] })[],
  materialStep: (ingredientId: string) => number | null,
): number | null {
  let best: number | null = null;
  for (const target of targets) {
    if (!requiredTechniquesOf(target).includes(id)) continue;
    const steps = target.items.map(materialStep);
    if (steps.some((s) => s === null)) continue;
    const step = Math.max(0, ...(steps as number[]));
    if (best === null || step < best) best = step;
  }
  return best;
}

export function isTechniqueAffordanceOpen(affordanceStep: number | null, discoveredCount: number): boolean {
  return affordanceStep !== null && Number.isFinite(discoveredCount) && discoveredCount >= affordanceStep;
}
