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

/** Number of distinct discovered recipes in the Dex -- the ladder's only input from play. `counts`
 *  (Discovery 3.0 PR-2, OD-D3-17 O3) lets a recipe opt out of the count; the default counts every
 *  recipe, exactly as before. */
export function discoveredRecipeCount(
  dex: DexState,
  counts: (recipeId: string) => boolean = () => true,
): number {
  return new Set(dex.filter((e) => e.discovered && counts(e.recipeId)).map((e) => e.recipeId)).size;
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

/**
 * LAD-1 (Issue #261, Owner Decision OD-W2-1): the append-only ladder. The W1 steps 1..24 are a
 * frozen authority -- adding recipes or ingredients never regenerates or reorders them (a
 * regeneration would change "what step N unlocks" for every save in the middle of W1). Later
 * waves only add steps *after* the frozen ones, so an existing save keeps its next unlock, a
 * mid-W1 save means exactly what it meant before, and a W1-complete save simply reaches the
 * appended steps as its discovered count grows.
 */
export interface AppendedLadderStep {
  ingredientIds: readonly string[];
  keyRecipeId: string;
}

/** `base` (in step order) followed by `appended`, renumbered from `base.steps.length + 1`. Pure:
 *  neither input is mutated. The appended steps are always `MATERIAL` steps. */
export function appendLadderSteps(
  base: DiscoveryLadder,
  appended: readonly AppendedLadderStep[],
  populationId: string = base.populationId,
): DiscoveryLadder {
  const fixed = stepsInOrder(base);
  return {
    populationId,
    steps: [
      ...fixed,
      ...appended.map((s, index) => ({
        step: fixed.length + index + 1,
        kind: "MATERIAL" as const,
        ingredientIds: [...s.ingredientIds],
        keyRecipeId: s.keyRecipeId,
      })),
    ],
  };
}

function sameStep(a: ProgressionStep, b: ProgressionStep): boolean {
  return (
    a.step === b.step &&
    a.kind === b.kind &&
    a.keyRecipeId === b.keyRecipeId &&
    a.ingredientIds.length === b.ingredientIds.length &&
    a.ingredientIds.every((id, i) => id === b.ingredientIds[i])
  );
}

/** Problems (empty when valid) if `next` is not `base` with steps only appended: every base
 *  step must be present, in place and unchanged (same number, kind, materials in the same order,
 *  key recipe). Both ladders are compared in their *authored* array order, never re-sorted by
 *  step number, so moving a fixed step object to another position is caught even when it keeps
 *  its original `step` field (Codex review on #268). */
export function validateAppendOnlyExtension(base: DiscoveryLadder, next: DiscoveryLadder): string[] {
  const problems: string[] = [];
  const fixed = base.steps;
  const candidate = next.steps;
  if (candidate.length < fixed.length) {
    problems.push(`FIXED_STEP_REMOVED: ${fixed.length} fixed steps, next has ${candidate.length}`);
  }
  fixed.forEach((step, index) => {
    const other = candidate[index];
    if (other && !sameStep(step, other)) problems.push(`FIXED_STEP_CHANGED: step ${step.step}`);
  });
  return problems;
}

/** Minimal recipe shape the progression check reads, so tests can pass synthetic populations. */
export interface LadderProgressionRecipe {
  id: string;
  ingredientIds: readonly string[];
}

/**
 * Progression problems of a ladder against a recipe population (empty when valid). Complements
 * `validateDiscoveryLadder` (structure, duplicate unlocks):
 * - `STARTER_IN_LADDER`: a starter is sold again as a ladder material.
 * - `UNUSED_MATERIAL`: a material no recipe uses (a dead unlock).
 * - `KEY_RECIPE`: a step's key recipe is unknown, already makeable before the step, or still not
 *   makeable after it (a useless step).
 * - `UNREACHABLE`: a recipe needs an ingredient that neither the starters nor any step provide.
 * - `SOFTLOCK`: step `s` needs `s` discoveries, but fewer than `s` recipes are makeable from the
 *   starters and the materials of the steps before it -- the player could never reach it.
 */
export function validateLadderProgression(
  ladder: DiscoveryLadder,
  recipes: readonly LadderProgressionRecipe[],
  starters: readonly string[],
): string[] {
  const problems: string[] = [];
  const steps = stepsInOrder(ladder);
  const starterSet = new Set(starters);
  const recipeIds = new Set(recipes.map((r) => r.id));
  const used = new Set(recipes.flatMap((r) => r.ingredientIds));
  const makeable = (owned: ReadonlySet<string>) =>
    new Set(recipes.filter((r) => r.ingredientIds.every((i) => owned.has(i))).map((r) => r.id));

  const owned = new Set(starterSet);
  for (const step of steps) {
    const before = makeable(owned);
    if (before.size < step.step) {
      problems.push(`SOFTLOCK: step ${step.step} needs ${step.step} discoveries, only ${before.size} recipes are makeable before it`);
    }
    for (const id of step.ingredientIds) {
      if (starterSet.has(id)) problems.push(`STARTER_IN_LADDER: ${id} (step ${step.step})`);
      if (!used.has(id)) problems.push(`UNUSED_MATERIAL: ${id} (step ${step.step})`);
      owned.add(id);
    }
    const after = makeable(owned);
    if (!recipeIds.has(step.keyRecipeId)) {
      problems.push(`KEY_RECIPE: step ${step.step} names unknown recipe ${step.keyRecipeId}`);
    } else if (before.has(step.keyRecipeId) || !after.has(step.keyRecipeId)) {
      problems.push(`KEY_RECIPE: step ${step.step} does not newly complete ${step.keyRecipeId}`);
    }
  }
  for (const recipe of recipes) {
    const missing = recipe.ingredientIds.filter((i) => !owned.has(i));
    if (missing.length > 0) problems.push(`UNREACHABLE: ${recipe.id} needs ${[...new Set(missing)].join(", ")}`);
  }
  return problems;
}
