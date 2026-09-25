import type { DiscoveryLadder, ProgressionStep } from "../data/discoveryLadder";
import type { DexState } from "../state/dex";

/**
 * Progression 2.0 W1 Integration I4a: Discovery Ladder pure functions (REC-04 OD-REC04-1, see
 * ../data/discoveryLadder.ts for the authority and its derivation). Pure functions only -- no
 * React, no reducer wiring, no storage access, no Pitz/stock -- so the unlock rule can be unit
 * tested on its own before I4b wires it into App/GameState/Shop/save.
 *
 * The whole rule is: step `s` is reached when the Dex discovered count is `>= s`. Stars never
 * enter into it. Every function takes the ladder as a parameter, so the same code serves the
 * shipped 15-recipe ladder today and a regenerated 25-recipe (W1) ladder later.
 *
 * Every function is deterministic: the same inputs always give the same output, in the same
 * order (ladder step order, then each step's authored ingredient order).
 */

/** A Dex discovered count as the ladder reads it: non-finite or negative input counts as 0, and a
 *  fractional count is floored (a count is always a whole number of discoveries). */
export function normalizeDiscoveredCount(discoveredCount: number): number {
  if (!Number.isFinite(discoveredCount) || discoveredCount <= 0) return 0;
  return Math.floor(discoveredCount);
}

/** Number of distinct discovered recipes in the Dex -- the ladder's only input from play. */
export function discoveredRecipeCount(dex: DexState): number {
  return new Set(dex.filter((e) => e.discovered).map((e) => e.recipeId)).size;
}

function stepsInOrder(ladder: DiscoveryLadder): ProgressionStep[] {
  return [...ladder.steps].sort((a, b) => a.step - b.step);
}

/** Every step reached at `discoveredCount` (step number `<= count`), in step order. */
export function reachedLadderSteps(
  ladder: DiscoveryLadder,
  discoveredCount: number,
): ProgressionStep[] {
  const count = normalizeDiscoveredCount(discoveredCount);
  return stepsInOrder(ladder).filter((s) => s.step <= count);
}

/** Highest step number reached at `discoveredCount`; 0 when no step is reached yet. Never exceeds
 *  the ladder's last step, however large the count. */
export function reachedStepNumber(ladder: DiscoveryLadder, discoveredCount: number): number {
  const reached = reachedLadderSteps(ladder, discoveredCount);
  return reached.length === 0 ? 0 : reached[reached.length - 1].step;
}

/** The first step not yet reached at `discoveredCount`, or `undefined` once the ladder is done. */
export function nextLadderStep(
  ladder: DiscoveryLadder,
  discoveredCount: number,
): ProgressionStep | undefined {
  const count = normalizeDiscoveredCount(discoveredCount);
  return stepsInOrder(ladder).find((s) => s.step > count);
}

/** Material ingredient ids of `steps` (only `kind: "MATERIAL"`), in step order, de-duplicated. */
export function materialIdsOfSteps(steps: readonly ProgressionStep[]): string[] {
  const ids: string[] = [];
  for (const step of steps) {
    if (step.kind !== "MATERIAL") continue;
    for (const id of step.ingredientIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Materials the ladder alone grants at `discoveredCount` (no entitlement history). */
export function ladderUnlockedMaterialIds(
  ladder: DiscoveryLadder,
  discoveredCount: number,
): string[] {
  return materialIdsOfSteps(reachedLadderSteps(ladder, discoveredCount));
}

export interface ResolveMaterialUnlocksInput {
  ladder: DiscoveryLadder;
  discoveredCount: number;
  /** Materials the player was already entitled to (e.g. persisted by I4b). Order is kept; ids not
   *  in `ladder` -- including ids unknown to this build -- are kept as well. Non-string/empty
   *  entries and duplicates are dropped. */
  alreadyUnlockedMaterialIds: readonly unknown[];
}

export interface MaterialUnlockResolution {
  /** `alreadyUnlockedMaterialIds` (cleaned, original order) followed by
   *  `newlyUnlockedMaterialIds`. Always a superset of the prior entitlement. */
  unlockedMaterialIds: string[];
  /** Ladder materials reached now that were not in the prior entitlement, in ladder order -- what
   *  a "NEW MATERIAL" notice would announce. Empty when nothing changed. */
  newlyUnlockedMaterialIds: string[];
}

/**
 * The entitlement union: prior entitlement ∪ ladder materials reached at `discoveredCount`.
 *
 * Never re-locks. A material stays unlocked even when a regenerated ladder moves it to a later
 * step (or drops it), and even when `discoveredCount` is lower than before. Idempotent: feeding
 * `unlockedMaterialIds` back in with the same count yields the same list and no new ids.
 */
export function resolveMaterialUnlocks({
  ladder,
  discoveredCount,
  alreadyUnlockedMaterialIds,
}: ResolveMaterialUnlocksInput): MaterialUnlockResolution {
  const unlockedMaterialIds: string[] = [];
  for (const id of alreadyUnlockedMaterialIds) {
    if (typeof id === "string" && id !== "" && !unlockedMaterialIds.includes(id)) {
      unlockedMaterialIds.push(id);
    }
  }
  const newlyUnlockedMaterialIds = ladderUnlockedMaterialIds(ladder, discoveredCount).filter(
    (id) => !unlockedMaterialIds.includes(id),
  );
  return {
    unlockedMaterialIds: [...unlockedMaterialIds, ...newlyUnlockedMaterialIds],
    newlyUnlockedMaterialIds,
  };
}

/** Whether `ingredientId` is unlocked for the Shop under the entitlement union. */
export function isMaterialUnlocked(input: ResolveMaterialUnlocksInput, ingredientId: string): boolean {
  return resolveMaterialUnlocks(input).unlockedMaterialIds.includes(ingredientId);
}

const KNOWN_STEP_KINDS: readonly string[] = ["MATERIAL"];

/**
 * Structural problems in a ladder (empty when valid): step numbers must be the integers 1..n with
 * no gap or duplicate and listed in order, `kind` must be known, a `MATERIAL` step must list at
 * least one non-empty ingredient id and name a key recipe, and no ingredient may appear in more
 * than one step (a material is unlocked exactly once).
 */
export function validateDiscoveryLadder(ladder: DiscoveryLadder): string[] {
  const problems: string[] = [];
  if (ladder.populationId === "") problems.push("populationId is empty");
  const seenIngredients = new Map<string, number>();
  ladder.steps.forEach((s, index) => {
    const expected = index + 1;
    if (s.step !== expected) problems.push(`step at index ${index} is ${s.step}, expected ${expected}`);
    if (!KNOWN_STEP_KINDS.includes(s.kind)) problems.push(`step ${s.step} has unknown kind ${String(s.kind)}`);
    if (s.keyRecipeId === "") problems.push(`step ${s.step} has no keyRecipeId`);
    if (s.kind === "MATERIAL") {
      if (s.ingredientIds.length === 0) problems.push(`step ${s.step} unlocks no material`);
      for (const id of s.ingredientIds) {
        if (id === "") {
          problems.push(`step ${s.step} has an empty ingredient id`);
          continue;
        }
        const previous = seenIngredients.get(id);
        if (previous !== undefined) {
          problems.push(`ingredient ${id} appears in step ${previous} and step ${s.step}`);
        } else {
          seenIngredients.set(id, s.step);
        }
      }
    }
  });
  return problems;
}
