import type { DexState } from "../state/dex";

/**
 * Mastery (Phase 3C-3, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 7 and this
 * phase's own scope note: Mastery here is defined as the sum of Dex BEST stars across every
 * recipe -- a single number rather than a per-recipe counter, since that's all the
 * ingredient unlock conditions in src/state/progression.ts need). Deliberately **not**
 * persisted: it's derived fresh from Dex (`GameState.dex` / `PersistentSaveV1.dex`) every
 * time it's needed, the same way `discoveredRecipeIds` is -- there is no separate Mastery
 * field anywhere in canonical state.
 */

/**
 * Sum of Dex BEST stars across every discovered recipe. An undiscovered recipe (no entry,
 * or an entry with `discovered: false`) contributes 0 -- it has no BEST yet. Repeat plays
 * that don't beat a recipe's existing BEST don't change this either: `timesMade` has no
 * effect on totalStars, only `bestStars` does.
 */
export function totalStars(dex: DexState): number {
  return dex.reduce((sum, entry) => sum + (entry.discovered ? entry.bestStars : 0), 0);
}
