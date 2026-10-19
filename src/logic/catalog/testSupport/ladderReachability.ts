/**
 * Economy / Progression Phase 1 (#561): ladder reachability analysis. TEST SUPPORT ONLY (never imported by
 * production code; nothing here changes the ladder, rewards, prices or unlock rules).
 *
 * Question answered: for a player whose Dex BEST stars follow a given profile, which credited recipes can be
 * discovered at all, and which ladder steps are never reached? The fixed point is computed with the production
 * unlock function (`resolveMaterialUnlocks`), so the star gates (#420 OD-420-1) are evaluated exactly as in play.
 *
 * A recipe is discoverable when every ingredient it requires is a starter or an unlocked ladder material. The
 * ladder reads only the credited discovery count, so a gated material can hold back later steps (collateral
 * closure): that propagation is what `collateralRecipeIds` / `blockedSteps` expose.
 */
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../../data/ingredients";
import { RECIPES, type Recipe } from "../../../data/recipes";
import { resolveMaterialUnlocks } from "../../discoveryLadder";

/** The slice of a recipe the analysis reads (so a test can pass a synthetic population). */
export interface ReachabilityRecipe {
  id: string;
  /** False = `ladderCredit: false`: discoverable but does not advance the ladder. */
  credited: boolean;
  ingredientIds: readonly string[];
}

export const PRODUCTION_REACHABILITY_RECIPES: readonly ReachabilityRecipe[] = (RECIPES as readonly Recipe[]).map((r) => ({
  id: r.id,
  credited: r.ladderCredit !== false,
  ingredientIds: r.requiredIngredients.map((q) => q.ingredientId),
}));

/**
 * How Dex BEST stars are distributed over the discovered recipes.
 * - `uniform`: every discovered recipe has BEST = `best` (1..5).
 * - `total`: the Dex BEST sum is `total`, but never below one star per discovered recipe (there is no star 0).
 */
export type StarProfile = { kind: "uniform"; best: 1 | 2 | 3 | 4 | 5 } | { kind: "total"; total: number };

export function totalStarsFor(profile: StarProfile, discoveredCount: number): number {
  if (profile.kind === "uniform") return profile.best * discoveredCount;
  return Math.max(profile.total, discoveredCount);
}

export interface ReachabilityResult {
  /** Dex BEST sum at the fixed point. */
  totalStars: number;
  discoveredIds: readonly string[];
  /** Credited discoveries at the fixed point (what the ladder reads). */
  creditedReached: number;
  creditedTotal: number;
  /** Ladder steps never reached (`step > creditedReached`). */
  blockedSteps: readonly number[];
  /** Materials of a reached step still held back by an unmet star gate. */
  starLockedMaterialIds: readonly string[];
  /** Recipes that can never be discovered under the profile, in catalog order. */
  unreachableRecipeIds: readonly string[];
  /** Unreachable only because they need a star-gated material (the gate is the stated intent). */
  directlyGatedRecipeIds: readonly string[];
  /** Unreachable although they need no star-gated material: the gate propagated through the count. */
  collateralRecipeIds: readonly string[];
}

export function analyzeLadderReachability(input: {
  profile: StarProfile;
  ladder?: DiscoveryLadder;
  recipes?: readonly ReachabilityRecipe[];
}): ReachabilityResult {
  const ladder = input.ladder ?? DISCOVERY_LADDER;
  const recipes = input.recipes ?? PRODUCTION_REACHABILITY_RECIPES;
  const starters = new Set<string>(STARTER_INGREDIENT_IDS);
  const gatedIds = new Set(ladder.steps.flatMap((s) => Object.keys(s.starGates ?? {})));

  let discovered = new Set<string>();
  let unlocked: readonly string[] = [];
  let stars = 0;
  // Monotone: more discoveries -> more stars and more unlocks -> more discoveries. Bounded by recipes.length.
  for (let i = 0; i <= recipes.length + 1; i++) {
    const credited = recipes.filter((r) => discovered.has(r.id) && r.credited).length;
    stars = totalStarsFor(input.profile, discovered.size);
    unlocked = resolveMaterialUnlocks({
      ladder,
      discoveredCount: credited,
      totalStars: stars,
      alreadyUnlockedMaterialIds: unlocked,
    }).unlockedMaterialIds;
    const have = new Set([...starters, ...unlocked]);
    const next = new Set(recipes.filter((r) => r.ingredientIds.every((id) => have.has(id))).map((r) => r.id));
    if (next.size === discovered.size && [...next].every((id) => discovered.has(id))) break;
    discovered = next;
  }

  const creditedReached = recipes.filter((r) => discovered.has(r.id) && r.credited).length;
  const unreachable = recipes.filter((r) => !discovered.has(r.id));
  const directly = unreachable.filter((r) => r.ingredientIds.some((id) => gatedIds.has(id)));
  const unlockedSet = new Set(unlocked);
  return {
    totalStars: stars,
    discoveredIds: recipes.filter((r) => discovered.has(r.id)).map((r) => r.id),
    creditedReached,
    creditedTotal: recipes.filter((r) => r.credited).length,
    blockedSteps: ladder.steps.filter((s) => s.step > creditedReached).map((s) => s.step),
    starLockedMaterialIds: ladder.steps
      .filter((s) => s.step <= creditedReached)
      .flatMap((s) => s.ingredientIds.filter((id) => !unlockedSet.has(id))),
    unreachableRecipeIds: unreachable.map((r) => r.id),
    directlyGatedRecipeIds: directly.map((r) => r.id),
    collateralRecipeIds: unreachable.filter((r) => !directly.includes(r)).map((r) => r.id),
  };
}
