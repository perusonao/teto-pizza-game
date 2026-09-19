import type { Recipe } from "../data/recipes";

/**
 * Cooking Time CT2: "手際" (efficiency) -- a secondary, additive evaluation layered on top of
 * `cookingTiming.ts`'s CT1 measurement (see
 * docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md for the full Fresh Audit and
 * threshold rationale this module implements).
 *
 * Deliberately independent of Scoring 2.0 and Pitz's own quality multiplier:
 * - `Recipe`/`CookingTimingState.completedMs` in, a tier + a small additive Pitz amount out --
 *   never a second score, never mixed into `ScoreBreakdown.total` or
 *   `pitzReward.ts`'s `qualityMultiplierForScore`/`calculatePitzReward` (both untouched).
 * - "Comfortable time -> neutral plateau -> gradual taper", not a perfect-speed race: going
 *   faster than the recipe's own `comfortableMs` earns no extra tier or bonus (GOOD is a flat
 *   ceiling, not a continuous "faster = more" curve) -- see `efficiencyTierForCookingTime`.
 * - Quality-gated: `calculateEfficiencyBonus` returns 0 below `MIN_QUALITY_FOR_ANY_BONUS`, and a
 *   worse quality band always dominates a better efficiency tier (a low-quality, very fast pizza
 *   can never out-earn a high-quality, merely-average-pace one) -- see the bonus table below and
 *   this module's own test file for the fixed comparison.
 */

/** All 11 shipped recipes place between 5 and 9 total required pieces (dough/sauce/bake steps
 *  are otherwise structurally identical across every recipe -- one free-form dough stretch, one
 *  spread-type sauce/oil application, the same BAKE needle-tap minigame excluded from this
 *  window entirely). That's too narrow a spread to justify a hand-tuned per-recipe table, but
 *  wide enough (a ~1.8x range) that a single flat threshold would quietly favor the
 *  lowest-piece-count recipes -- so `comfortableMs` scales linearly with each recipe's own total
 *  piece count rather than either extreme. See the Result Report's "recipe complexity treatment"
 *  section for the full 11-recipe audit table these two constants were sized against.
 */
const BASE_COMFORTABLE_MS = 25_000;
const PER_ITEM_COMFORTABLE_MS = 3_000;

/** Width of the NORMAL plateau above `comfortableMs` -- deliberately wide (35s) so the tier
 *  boundaries read in broad, forgiving bands rather than a 1-second race (per the task's own
 *  "1秒単位の競争にはしない" instruction). Anything beyond this is SLOW, uniformly (no further
 *  sub-tiers/penalty taper below SLOW's own bonus of 0 -- see `calculateEfficiencyBonus`). */
const NORMAL_WINDOW_MS = 35_000;

export type EfficiencyTier = "GOOD" | "NORMAL" | "SLOW";

/** Deliberately non-judgmental Japanese labels (no "遅い"/"下手") -- 手際 is a secondary,
 *  encouraging read on pacing, never a callout of the player. */
export const EFFICIENCY_TIER_LABEL_JA: Record<EfficiencyTier, string> = {
  GOOD: "スムーズ",
  NORMAL: "ふつう",
  SLOW: "ゆったり",
};

export interface EfficiencyThresholds {
  /** At or below this many active ms, the round is GOOD -- a flat ceiling, not a race: finishing
   *  even faster than this earns no additional tier or bonus. */
  comfortableMs: number;
  /** At or below this many active ms (and above `comfortableMs`), the round is NORMAL. Anything
   *  above this is SLOW. */
  normalUpperMs: number;
}

/** Sum of every `RecipeRequirement.minCount` -- the one complexity axis that actually varies
 *  across the 11 shipped recipes (5 for bismarck to 9 for quattro-formaggi); see this module's
 *  own file header for why dough/sauce mechanics are excluded from this count (structurally
 *  identical for every recipe). */
export function totalRequiredItemCount(recipe: Recipe): number {
  return recipe.requiredIngredients.reduce((sum, req) => sum + req.minCount, 0);
}

export function efficiencyThresholdsForRecipe(recipe: Recipe): EfficiencyThresholds {
  const comfortableMs = BASE_COMFORTABLE_MS + PER_ITEM_COMFORTABLE_MS * totalRequiredItemCount(recipe);
  return { comfortableMs, normalUpperMs: comfortableMs + NORMAL_WINDOW_MS };
}

/** Malformed `completedMs` (negative, NaN, non-finite) reads as SLOW rather than propagating --
 *  mirrors `pitzReward.ts`'s own "invalid input clamps to the worst/safest band" discipline. */
export function efficiencyTierForCookingTime(
  completedMs: number,
  thresholds: EfficiencyThresholds,
): EfficiencyTier {
  if (!Number.isFinite(completedMs) || completedMs < 0) return "SLOW";
  if (completedMs <= thresholds.comfortableMs) return "GOOD";
  if (completedMs <= thresholds.normalUpperMs) return "NORMAL";
  return "SLOW";
}

/** Quality bands gating whether -- and how much of -- an efficiency tier's bonus is actually
 *  paid. Ordered highest-`minQuality`-first so `Array.find` returns the first (best-matching)
 *  band a given `scoreTotal` clears. A worse quality band's GOOD-tier rate never reaches a
 *  better band's NORMAL-tier rate (0.03 < ... every band above 60 has NORMAL >= 0), which is
 *  what actually enforces "quality always beats speed": see this module's test file for the
 *  fixed low-quality-fast vs. high-quality-normal comparison the task requires.
 *
 *  Percentages are intentionally small and round-numbered (Pitz Bonus §7: "0〜10%程度"), applied
 *  against the recipe's own static `baseRewardPitz` (100 for all 11 shipped recipes today) --
 *  never against the quality-multiplied `earnedPitz` itself, so this can never compound with a
 *  high quality multiplier into a larger-than-intended bonus. */
const EFFICIENCY_BONUS_BANDS: ReadonlyArray<{
  minQuality: number;
  rates: Record<EfficiencyTier, number>;
}> = [
  { minQuality: 90, rates: { GOOD: 0.1, NORMAL: 0.03, SLOW: 0 } },
  { minQuality: 75, rates: { GOOD: 0.06, NORMAL: 0, SLOW: 0 } },
  { minQuality: 60, rates: { GOOD: 0.03, NORMAL: 0, SLOW: 0 } },
  { minQuality: 0, rates: { GOOD: 0, NORMAL: 0, SLOW: 0 } },
];

export interface EfficiencyBonusResult {
  tier: EfficiencyTier;
  /** Fraction of `baseRewardPitz` this tier/quality combination earns, 0-0.1. */
  bonusRate: number;
  /** `Math.round(baseRewardPitz * bonusRate)`, floored at 0. */
  bonusPitz: number;
}

/**
 * The CT2 additive bonus formula -- quality-gated, small, and never mixed into
 * `pitzReward.ts`'s own `baseReward x qualityMultiplier` (that formula, and the `earnedPitz` it
 * produces, are both untouched; this is a second, independent additive amount computed from the
 * same `scoreTotal` and `baseRewardPitz` inputs `applyPitzCredit` already reads). Malformed
 * inputs clamp the same way `calculatePitzReward` already does (invalid `scoreTotal` reads as 0,
 * invalid `baseRewardPitz` reads as 0), so this can never fabricate a bonus from bad input.
 */
export function calculateEfficiencyBonus(
  tier: EfficiencyTier,
  scoreTotal: number,
  baseRewardPitz: number,
): EfficiencyBonusResult {
  const safeScore = Number.isFinite(scoreTotal) ? Math.min(100, Math.max(0, scoreTotal)) : 0;
  const safeBaseReward =
    Number.isFinite(baseRewardPitz) && baseRewardPitz > 0 ? baseRewardPitz : 0;
  const band = EFFICIENCY_BONUS_BANDS.find((b) => safeScore >= b.minQuality);
  const bonusRate = band ? band.rates[tier] : 0;
  const bonusPitz = Math.max(0, Math.round(safeBaseReward * bonusRate));
  return { tier, bonusRate, bonusPitz };
}

/** Canonical transient RESULT/DISCOVERED display snapshot (`GameState.lastEfficiencyCredit`,
 *  see ../state/gameReducer.ts) -- set once, atomically, by the same `REGISTER_TO_DEX` step that
 *  applies `lastPitzCredit`, so the display layer never recomputes any of these numbers itself
 *  (same discipline `PitzCredit` already follows). */
export interface CookingEfficiencyCredit extends EfficiencyBonusResult {
  cookingTimeMs: number;
}

/** The one function `REGISTER_TO_DEX` calls to derive the full CT2 display+reward snapshot from
 *  this round's already-finalized `completedMs` -- mirrors `applyPitzCredit`'s "one function,
 *  one call site" shape. */
export function evaluateCookingEfficiency(
  recipe: Recipe,
  completedMs: number,
  scoreTotal: number,
  baseRewardPitz: number,
): CookingEfficiencyCredit {
  const tier = efficiencyTierForCookingTime(completedMs, efficiencyThresholdsForRecipe(recipe));
  const bonus = calculateEfficiencyBonus(tier, scoreTotal, baseRewardPitz);
  return { ...bonus, cookingTimeMs: Math.max(0, completedMs) };
}

/** `completedMs` -> `"m:ss"` for RESULT display (e.g. `42_000` -> `"0:42"`, `90_000` ->
 *  `"1:30"`). Never negative/NaN -- malformed input reads as `"0:00"`. */
export function formatCookingTime(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
