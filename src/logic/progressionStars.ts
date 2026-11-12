/**
 * Progression 2.0 Phase 3-4A: progression stars (⭐), the monotonic currency the Phase 3-4
 * authority gates ingredients on (`G4_HYBRID_060`, see
 * docs/reports/PROGRESSION-2.0_PHASE-3-4_PreImplementation-Audit.md §2.4).
 *
 * Each discovered recipe contributes `max(BEST stars, 2)`: +2 for the discovery itself, then +1
 * for each of ★3/★4/★5 its BEST reaches (★1→2, ★2→2, ★3→3, ★4→4, ★5→5). An undiscovered recipe
 * contributes 0. Stars are never spent.
 *
 * **Not wired yet.** The runtime still gates on `totalStars` (../logic/mastery.ts, Σ BEST). Since
 * `max(BEST, 2) >= BEST` for every recipe, switching to this in Phase 3-4C can never re-lock an
 * existing save. Pure functions only -- no Dex writes, no persistence.
 */

/** Stars every discovery is guaranteed, regardless of its BEST. */
export const PROGRESSION_STARS_PER_DISCOVERY = 2;

/** The highest BEST a recipe can have (★5). */
export const PROGRESSION_MAX_BEST_STARS = 5;

/** The part of a Dex entry progression stars read. `DexEntry` (../state/dex.ts) satisfies it. */
export interface ProgressionStarsEntry {
  recipeId: string;
  discovered: boolean;
  bestStars: number;
}

/** A BEST value made safe: non-finite or negative reads as 0, fractions floor, above ★5 caps. */
function sanitizeBestStars(bestStars: number): number {
  if (!Number.isFinite(bestStars) || bestStars <= 0) return 0;
  return Math.min(Math.floor(bestStars), PROGRESSION_MAX_BEST_STARS);
}

/**
 * One recipe's progression stars. A discovered recipe is worth at least
 * `PROGRESSION_STARS_PER_DISCOVERY` even with a BEST of 0 or a corrupt BEST, since the discovery
 * itself is what earns the floor.
 */
export function recipeProgressionStars(discovered: boolean, bestStars: number): number {
  if (!discovered) return 0;
  return Math.max(sanitizeBestStars(bestStars), PROGRESSION_STARS_PER_DISCOVERY);
}

/**
 * Σ `recipeProgressionStars` over the Dex. A recipe id that appears more than once (a corrupt or
 * hand-built Dex) counts once, at its best entry, so duplicates can never inflate the total.
 */
export function progressionStars(dex: readonly ProgressionStarsEntry[]): number {
  const byRecipe = new Map<string, number>();
  for (const entry of dex) {
    const stars = recipeProgressionStars(entry.discovered, entry.bestStars);
    byRecipe.set(entry.recipeId, Math.max(byRecipe.get(entry.recipeId) ?? 0, stars));
  }
  let sum = 0;
  for (const stars of byRecipe.values()) sum += stars;
  return sum;
}
