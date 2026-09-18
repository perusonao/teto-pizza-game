/**
 * A1 Authority Cutover: converts a `ScoringV2Result` into the legacy `ScoreBreakdown` shape
 * every non-UI consumer (Dex `registerScoreToDex`/`isBetterQuality`, `progression.ts`,
 * `mastery.ts`, `missionScoring.ts`, `persistence.ts`, `MissionServePanel`, `dialogue.ts`)
 * already reads formula-agnostically via `.total`/`.stars` alone (see
 * docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md section 5.A) -- this is
 * the one new piece of code the cutover needs, called from `gameReducer.ts`'s `CONFIRM_BAKE`
 * in place of `../scoring.ts`'s `scorePizza`.
 *
 * `ScoreBreakdown` and `ScoringV2Result.components` are not structurally parallel (Audit
 * section 2): `matchScore`/`ingredientScore`/`placementScore`/`bakeScore` below are each
 * populated with the closest *real* Scoring 2.0 signal, never the legacy formula's own value
 * and never a fabricated stand-in --
 * - `matchScore` <- `components.recipe`'s required-ingredient-*type* presence ratio (before its
 *   own purity multiplier is applied), since `ScoreBreakdown.matchScore` has always meant
 *   "required ingredients present", never blended with purity.
 * - `ingredientScore` <- `components.recipe.purityMultiplier`, the purity term `matchScore`
 *   above deliberately excludes.
 * - `placementScore` <- `components.pieces.score` (quantity + placement combined -- Scoring 2.0
 *   has no separate placement-only number; see Audit section 2's table).
 * - `bakeScore` <- `components.bake.score`, the same concept as legacy, different formula.
 *
 * Sauce (Scoring 2.0's single heaviest component, 52/100) has no legacy `ScoreBreakdown` field
 * to hold it and is deliberately NOT folded into any of the four above -- `ResultPanel` reads
 * it separately, straight from `ScoringV2Result.components.sauce`, so it is never discarded
 * from player-facing feedback (see `ResultPanel.tsx` and this cutover's Result report).
 *
 * `available: false` (Reference/Recipe/Pieces/Bake data failing strict validation --
 * `./index.ts`'s fail-closed contract) should not happen for any of the 7 shipped recipes
 * today, but this function must not throw if it somehow does: every field below has an
 * explicit, finite zero-floor fallback rather than reading through a `null`/`undefined`.
 */
import type { BakeTarget } from "../../data/recipes";
import { classifyBake } from "../bake";
import { capStarsForBake, starsFromTotal, type ScoreBreakdown } from "../scoring";
import type { ScoringV2Result } from "./types";

export function toLegacyScoreBreakdown(
  result: ScoringV2Result,
  bakeResult: number | null,
  bakeTarget: BakeTarget,
): ScoreBreakdown {
  const { recipe, pieces, bake } = result.components;

  const matchScore = recipe.available
    ? recipe.requiredTypesTotal === 0
      ? 100
      : (recipe.requiredTypesPresent / recipe.requiredTypesTotal) * 100
    : 0;
  const ingredientScore = recipe.available ? recipe.purityMultiplier * 100 : 0;
  const placementScore = pieces.available ? pieces.score : 0;
  const bakeScore = bake.available ? bake.score : 0;

  const total = result.available && result.totalScore !== null ? result.totalScore : 0;

  const bakeState = bakeResult !== null ? classifyBake(bakeResult, bakeTarget) : null;
  const stars = capStarsForBake(starsFromTotal(total), bakeState);

  return { matchScore, ingredientScore, placementScore, bakeScore, total, stars };
}
