import type { ScoreBreakdown, QualityStars } from "../logic/scoring";

/**
 * Per-recipe Dex record. Phase 3C-1 scope (see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 15): discovery is now paired with
 * "mastery" — the best Quality ever achieved for that recipe, plus how many times it's
 * been made. `bestScore`/`bestStars` only ever move up (see registerScoreToDex below);
 * `timesMade` counts every completed round regardless of whether it beat the BEST.
 *
 * Deliberately plain data (no class, no methods) so it serializes as-is once Phase 3C-2
 * adds localStorage persistence — nothing here is shaped around this session only.
 */
export interface DexEntry {
  recipeId: string;
  discovered: boolean;
  bestScore: number;
  bestStars: QualityStars;
  timesMade: number;
}

export type DexState = readonly DexEntry[];

export const EMPTY_DEX: DexState = [];

export function getDexEntry(dex: DexState, recipeId: string): DexEntry | undefined {
  return dex.find((e) => e.recipeId === recipeId);
}

export function isDiscovered(dex: DexState, recipeId: string): boolean {
  return getDexEntry(dex, recipeId)?.discovered ?? false;
}

/** Ids of every discovered recipe, in Dex order — the shape older call sites (order
 *  selection, Mito's repeat-order dialogue) already expect. */
export function discoveredRecipeIds(dex: DexState): string[] {
  return dex.filter((e) => e.discovered).map((e) => e.recipeId);
}

export interface DexRegisterResult {
  dex: DexState;
  /** True the very first time this recipe is ever completed. */
  wasNewDiscovery: boolean;
  /** True when this round's score beat (or established) the recipe's BEST. */
  isNewBest: boolean;
}

/**
 * Ranks a round against an existing Dex entry by stars first, total second. Quality (per
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 15) *is* the star rating — the total is
 * just supporting detail — so stars has to be the primary, monotonic axis: comparing by total
 * alone would let a higher-total round baked outside the perfect zone (capped below ★5) quietly
 * overwrite an earlier round that actually reached a higher star tier, making BEST's displayed
 * stars go down even though "BEST never goes down" is the whole point of this model.
 */
function isBetterQuality(score: ScoreBreakdown, existing: DexEntry): boolean {
  if (score.stars !== existing.bestStars) return score.stars > existing.bestStars;
  return score.total > existing.bestScore;
}

/**
 * Registers one completed round's score against the Dex. This is the only place BEST is
 * ever written, so "BEST never goes down" and "timesMade always increments exactly once
 * per round" both hold by construction — callers just need to call this exactly once per
 * RESULT (gameReducer's REGISTER_TO_DEX action does, and only there).
 */
export function registerScoreToDex(
  dex: DexState,
  recipeId: string,
  score: ScoreBreakdown,
): DexRegisterResult {
  const existing = getDexEntry(dex, recipeId);

  if (!existing) {
    const entry: DexEntry = {
      recipeId,
      discovered: true,
      bestScore: score.total,
      bestStars: score.stars,
      timesMade: 1,
    };
    return { dex: [...dex, entry], wasNewDiscovery: true, isNewBest: true };
  }

  const isNewBest = isBetterQuality(score, existing);
  const updated: DexEntry = {
    ...existing,
    discovered: true,
    bestScore: isNewBest ? score.total : existing.bestScore,
    bestStars: isNewBest ? score.stars : existing.bestStars,
    timesMade: existing.timesMade + 1,
  };
  const nextDex = dex.map((e) => (e.recipeId === recipeId ? updated : e));
  return { dex: nextDex, wasNewDiscovery: false, isNewBest };
}
