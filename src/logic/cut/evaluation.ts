/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §5/§6): the four independent
 * CUT evaluation signals (count correctness, completeness, center accuracy, piece-area
 * uniformity) plus a standalone preview `cutScore`.
 *
 * `cutScore` is **never** wired into `state.score.total` / `ScoringV2Result.totalScore` in this
 * phase -- design doc §14 Option D, adopted unchanged. It exists only as a pure, displayable
 * preview value CUT Phase 3's own RESULT UI can read later; Scoring 2.0, star thresholds, Dex
 * BEST, Lunch Rush ranking, and Pitz reward all stay byte-identical through this entire phase.
 * `../completionGate.ts` is not read or modified by this module -- CUT's `requiredForCompletion`
 * stays `false` (design doc §7), which this module has nothing to do with (it only ever
 * *computes* a score, never gates anything).
 */
import { DOUGH_RADIUS } from "../pizzaCoordinates";
import { CIRCLE_AREA, computePieceAreas, perpendicularDistanceFromCenter } from "./geometry";
import {
  resolveRequestedSliceCount,
  type CutConfig,
  type CutEvaluation,
  type CutLine,
} from "./types";

/** "N full lines -> 2N wedges" (design doc §1.2/§3.1) -- the number of committed lines a given
 *  `requestedSliceCount` actually requires. */
const REQUIRED_CUT_COUNT_DIVISOR = 2;

export function requiredCutCount(requestedSliceCount: number): number {
  return requestedSliceCount / REQUIRED_CUT_COUNT_DIVISOR;
}

/**
 * Design doc §6 Option B ("uniformity-heavy" -- recommended), summing to 1. Kept as one named
 * table rather than four separate magic-number constants scattered across this file.
 */
export const CUT_SCORE_WEIGHTS = {
  countCorrectness: 0.2,
  completeness: 0.2,
  centerAccuracy: 0.1,
  uniformity: 0.5,
} as const;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function meanAbsoluteDeviation(values: readonly number[], target: number): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += Math.abs(value - target);
  return sum / values.length;
}

/** Design doc §5: `1 - min(1, |actualPieceCount - requestedSliceCount| / requestedSliceCount)`.
 *  An emergent piece count (from ./geometry.ts) compared against the requested one -- never
 *  assumed to match. */
function countCorrectnessOf(actualPieceCount: number, requestedSliceCount: number): number {
  return 1 - Math.min(1, Math.abs(actualPieceCount - requestedSliceCount) / requestedSliceCount);
}

/** Design doc §5: `min(1, completedCutCount / requiredCutCount)`. A purely aggregate count --
 *  per §4.1, "incomplete" only ever means "fewer committed lines than required", never a
 *  malformed single line (there is no such thing as a half-drawn `CutLine` once committed, by
 *  the Phase 2 gesture layer's own clamp-to-rim construction, §2.2). */
function completenessOf(completedCutCount: number, requestedSliceCount: number): number {
  const required = requiredCutCount(requestedSliceCount);
  if (required <= 0) return 1;
  return Math.min(1, completedCutCount / required);
}

/** Design doc §4.3: per-line perpendicular distance from `DOUGH_CENTER`, normalized against
 *  `DOUGH_RADIUS` (0 = through center, 1 = the worst possible chord) and averaged, then
 *  inverted so 1.0 means "every line passed through center". Zero committed lines has no center
 *  data at all, so it resolves to the worst case (0) rather than an undefined mean of an empty
 *  set -- matching every other signal's "no cuts -> worst-but-defined score" contract. */
function centerAccuracyOf(lines: readonly CutLine[]): number {
  if (lines.length === 0) return 0;
  const normalizedDistances = lines.map((line) =>
    clamp01(perpendicularDistanceFromCenter(line) / DOUGH_RADIUS),
  );
  return 1 - mean(normalizedDistances);
}

/** Design doc §5: `1 - min(1, meanAbsoluteDeviation(pieceAreas) / idealPieceArea)` -- symmetric
 *  under- and over-sized penalties (a piece twice the ideal size contributes as much deviation
 *  as one half the ideal size). */
function uniformityOf(pieceAreas: readonly number[], requestedSliceCount: number): number {
  const idealPieceArea = CIRCLE_AREA / requestedSliceCount;
  const deviation = meanAbsoluteDeviation(pieceAreas, idealPieceArea);
  return 1 - Math.min(1, deviation / idealPieceArea);
}

/**
 * Computes all four evaluation signals plus the standalone preview `cutScore`, once, from
 * `lines`/`config` alone -- mirrors `computeScoringV2`'s own "one call site, computed from the
 * exact canonical data that was just committed" contract (design doc §5's closing paragraph).
 * No Reference-fixture-availability gate is needed (unlike Scoring 2.0's Margherita-only gate):
 * this is computable for any recipe, any `lines`, including zero lines (Result Report test #11 --
 * every field below stays a finite, defined number, never `NaN`/`Infinity`).
 */
export function evaluateCut(
  lines: readonly CutLine[],
  config: CutConfig | undefined = undefined,
): CutEvaluation {
  const requestedSliceCount = resolveRequestedSliceCount(config);
  const pieceAreas = computePieceAreas(lines);
  const actualPieceCount = pieceAreas.length;
  const completedCutCount = lines.length;

  const countCorrectness = countCorrectnessOf(actualPieceCount, requestedSliceCount);
  const completeness = completenessOf(completedCutCount, requestedSliceCount);
  const centerAccuracy = centerAccuracyOf(lines);
  const uniformity = uniformityOf(pieceAreas, requestedSliceCount);

  const cutScore =
    100 *
    (CUT_SCORE_WEIGHTS.countCorrectness * countCorrectness +
      CUT_SCORE_WEIGHTS.completeness * completeness +
      CUT_SCORE_WEIGHTS.centerAccuracy * centerAccuracy +
      CUT_SCORE_WEIGHTS.uniformity * uniformity);

  return {
    requestedSliceCount,
    completedCutCount,
    actualPieceCount,
    pieceAreas,
    countCorrectness,
    completeness,
    centerAccuracy,
    uniformity,
    cutScore,
  };
}
