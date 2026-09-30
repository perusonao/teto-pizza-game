/**
 * CUT-S1 (Issue #288): a pure `CutQuality` evaluator -- "how well was this pizza actually cut",
 * independent of scoring.
 *
 * **Not connected to anything.** No reducer, `state.score`, Scoring 2.0, save, UI, Dex, Pitz, Lunch
 * Rush, Dinner or ranking imports this module; it exists so CUT-S2 (shadow evaluation) and a later
 * integration decision have a stable, tested value to read. `evaluateCut` / `cutScore`
 * (./evaluation.ts) are untouched and remain the display-only preview.
 *
 * Differences from `evaluateCut`:
 * - No `completeness` signal. The reducer only lets CUT be confirmed once `requiredCutCount` lines
 *   exist, so at confirm time `completeness` is always 1 -- a constant that would silently add a free
 *   fraction of every score. The counts are exposed as information (`lineCount`,
 *   `requiredLineCount`), never as a scored signal.
 * - Line validity is scored (finite / long enough / on the dough / not a near-duplicate).
 * - Every signal is a 0-1 credit with a **full-credit dead zone** and a **zero-credit distance**
 *   (`CutQualityTolerance`), so a finger-sized error on a 360px screen still earns full credit.
 *   The tolerance values below are PROVISIONAL: CUT-S2 Human Verification decides the real ones.
 * - Malformed input (NaN / Infinity / degenerate lines) never throws and never yields NaN.
 *
 * No weights are decided here. `CutQuality.overall` is computed from caller-supplied weights;
 * `PROVISIONAL_CUT_QUALITY_WEIGHTS` only exists so S2 tooling has a default to start from and is
 * NOT a production specification. A CUT that was not performed (non-CUT recipe, skipped, FAILED)
 * has no `CutQuality` -- callers simply do not call this; there is no "zero" for it.
 */
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import {
  CIRCLE_AREA,
  MIN_CUT_ANGULAR_SEPARATION_RADIANS,
  computePieceAreas,
  cutLineOrientationRadians,
  perpendicularDistanceFromCenter,
} from "./geometry";
import { requiredCutCount } from "./evaluation";
import { resolveRequestedSliceCount, type CutConfig, type CutLine } from "./types";

/** The adjustable authority. Distances are dough-percent (DOUGH_RADIUS = 48, i.e. ~3.3px per unit
 *  on the 328px stage of a 360px phone). */
export interface CutQualityTolerance {
  /** A line this close to the center (or closer) gets full center credit. */
  readonly centerFullCreditDistance: number;
  /** A line this far from the center (or farther) gets zero center credit. */
  readonly centerZeroCreditDistance: number;
  /** Mean absolute piece-area deviation / ideal piece area at or below which uniformity is 1. */
  readonly uniformityFullCreditDeviation: number;
  /** ...at or above which uniformity is 0. */
  readonly uniformityZeroCreditDeviation: number;
  /** A chord shorter than this is not a usable cut. */
  readonly minChordLength: number;
  /** An endpoint farther than `DOUGH_RADIUS + this` from the center is off the dough. */
  readonly endpointMargin: number;
  /** Lines closer than this in orientation (mod pi) count as one cut. */
  readonly minAngularSeparationRadians: number;
  /** A piece smaller than this fraction of the ideal piece area is a sliver: it is neither counted
   *  as a piece nor measured for uniformity. Three cuts that miss a common point by a finger's width
   *  leave a tiny triangle in the middle; without this, that alone would read as "7 slices". */
  readonly sliverAreaFraction: number;
}

/** PROVISIONAL defaults -- deliberately generous; S2 Human Verification sets the real values. */
export const DEFAULT_CUT_QUALITY_TOLERANCE: CutQualityTolerance = Object.freeze({
  centerFullCreditDistance: 4,
  centerZeroCreditDistance: 20,
  uniformityFullCreditDeviation: 0.1,
  uniformityZeroCreditDeviation: 0.6,
  minChordLength: DOUGH_RADIUS,
  endpointMargin: 6,
  minAngularSeparationRadians: MIN_CUT_ANGULAR_SEPARATION_RADIANS,
  sliverAreaFraction: 0.2,
});

export interface CutQualityWeights {
  readonly lineValidity: number;
  readonly sliceCountFit: number;
  readonly centerAccuracy: number;
  readonly sliceUniformity: number;
}

/** PROVISIONAL, not a production specification (see the module header). */
export const PROVISIONAL_CUT_QUALITY_WEIGHTS: CutQualityWeights = Object.freeze({
  lineValidity: 0.15,
  sliceCountFit: 0.15,
  centerAccuracy: 0.3,
  sliceUniformity: 0.4,
});

export interface CutQuality {
  readonly requestedSliceCount: number;
  /** Committed lines passed in. */
  readonly lineCount: number;
  /** Information only (never scored): lines the recipe needs. */
  readonly requiredLineCount: number;
  /** Lines that are finite, long enough and on the dough. */
  readonly validLineCount: number;
  /** Valid lines after merging near-duplicate orientations. */
  readonly distinctLineCount: number;
  /** Pieces the valid lines produced, not counting slivers (see `sliverAreaFraction`). */
  readonly actualPieceCount: number;
  /** Every region's area, slivers included (information only). */
  readonly pieceAreas: readonly number[];
  /** Regions below the sliver threshold. */
  readonly sliverCount: number;
  /** distinctLineCount / lineCount; 0 with no lines. */
  readonly lineValidity: number;
  /** 1 - min(1, |actual - requested| / requested). */
  readonly sliceCountFit: number;
  /** Mean per-line center credit over valid lines; 0 with none. */
  readonly centerAccuracy: number;
  /** Area-deviation credit against the ideal piece area. */
  readonly sliceUniformity: number;
  /** Weighted mean of the four signals under the supplied weights. */
  readonly overall: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** 1 at/below `full`, 0 at/above `zero`, linear between. Requires full < zero. */
function creditBetween(value: number, full: number, zero: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= full) return 1;
  if (value >= zero) return 0;
  return (zero - value) / (zero - full);
}

function isFinitePoint(p: { x: number; y: number }): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isValidLine(line: CutLine, tolerance: CutQualityTolerance): boolean {
  if (!isFinitePoint(line.start) || !isFinitePoint(line.end)) return false;
  if (Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) < tolerance.minChordLength) return false;
  const limit = DOUGH_RADIUS + tolerance.endpointMargin;
  return (
    Math.hypot(line.start.x - DOUGH_CENTER, line.start.y - DOUGH_CENTER) <= limit &&
    Math.hypot(line.end.x - DOUGH_CENTER, line.end.y - DOUGH_CENTER) <= limit
  );
}

/** Single-linkage clusters of orientations on the mod-pi circle. Sorting first makes the result
 *  independent of line order. */
function countDistinctOrientations(lines: readonly CutLine[], minSeparation: number): number {
  if (lines.length === 0) return 0;
  const angles = lines.map(cutLineOrientationRadians).sort((a, b) => a - b);
  let clusters = 1;
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - angles[i - 1] >= minSeparation) clusters++;
  }
  // The circle wraps at pi: the last and first angles may belong to one cluster.
  if (clusters > 1 && angles[0] + Math.PI - angles[angles.length - 1] < minSeparation) clusters--;
  return clusters;
}

/** Replaces any missing / malformed / mis-ordered tolerance field with its default. */
function resolveTolerance(partial: Partial<CutQualityTolerance> | undefined): CutQualityTolerance {
  const d = DEFAULT_CUT_QUALITY_TOLERANCE;
  const pick = (v: number | undefined, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  let centerFull = pick(partial?.centerFullCreditDistance, d.centerFullCreditDistance);
  let centerZero = pick(partial?.centerZeroCreditDistance, d.centerZeroCreditDistance);
  if (centerZero <= centerFull) {
    centerFull = d.centerFullCreditDistance;
    centerZero = d.centerZeroCreditDistance;
  }
  let uniFull = pick(partial?.uniformityFullCreditDeviation, d.uniformityFullCreditDeviation);
  let uniZero = pick(partial?.uniformityZeroCreditDeviation, d.uniformityZeroCreditDeviation);
  if (uniZero <= uniFull) {
    uniFull = d.uniformityFullCreditDeviation;
    uniZero = d.uniformityZeroCreditDeviation;
  }
  return {
    centerFullCreditDistance: centerFull,
    centerZeroCreditDistance: centerZero,
    uniformityFullCreditDeviation: uniFull,
    uniformityZeroCreditDeviation: uniZero,
    minChordLength: pick(partial?.minChordLength, d.minChordLength),
    endpointMargin: pick(partial?.endpointMargin, d.endpointMargin),
    minAngularSeparationRadians: pick(partial?.minAngularSeparationRadians, d.minAngularSeparationRadians),
    sliverAreaFraction: (() => {
      const v = partial?.sliverAreaFraction;
      return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1 ? v : d.sliverAreaFraction;
    })(),
  };
}

function combine(
  signals: Pick<CutQuality, "lineValidity" | "sliceCountFit" | "centerAccuracy" | "sliceUniformity">,
  weights: CutQualityWeights,
): number {
  const w = [weights.lineValidity, weights.sliceCountFit, weights.centerAccuracy, weights.sliceUniformity].map(
    (x) => (Number.isFinite(x) && x > 0 ? x : 0),
  );
  const total = w[0] + w[1] + w[2] + w[3];
  if (total === 0) return 0;
  return clamp01(
    (w[0] * signals.lineValidity +
      w[1] * signals.sliceCountFit +
      w[2] * signals.centerAccuracy +
      w[3] * signals.sliceUniformity) /
      total,
  );
}

/**
 * Pure and deterministic: the same lines (in any order) / config / tolerance always give the same
 * result. Every field is finite and every 0-1 field lies in [0, 1].
 */
export function evaluateCutQuality(
  lines: readonly CutLine[],
  config: CutConfig | undefined = undefined,
  tolerance: Partial<CutQualityTolerance> | undefined = undefined,
  weights: CutQualityWeights = PROVISIONAL_CUT_QUALITY_WEIGHTS,
): CutQuality {
  const tol = resolveTolerance(tolerance);
  const requestedSliceCount = resolveRequestedSliceCount(config);
  const validLines = lines.filter((line) => isValidLine(line, tol));
  const distinctLineCount = countDistinctOrientations(validLines, tol.minAngularSeparationRadians);

  const pieceAreas = computePieceAreas(validLines);
  const ideal = CIRCLE_AREA / requestedSliceCount;
  const significantAreas = pieceAreas.filter((area) => area >= tol.sliverAreaFraction * ideal);
  // Every region a sliver (only possible with a fraction the ideal area cannot satisfy): keep them all.
  const measuredAreas = significantAreas.length > 0 ? significantAreas : pieceAreas;
  const actualPieceCount = measuredAreas.length;

  const lineValidity = lines.length === 0 ? 0 : clamp01(distinctLineCount / lines.length);
  const sliceCountFit = clamp01(
    1 - Math.min(1, Math.abs(actualPieceCount - requestedSliceCount) / requestedSliceCount),
  );

  let centerAccuracy = 0;
  if (validLines.length > 0) {
    let sum = 0;
    for (const line of validLines) {
      sum += creditBetween(
        perpendicularDistanceFromCenter(line),
        tol.centerFullCreditDistance,
        tol.centerZeroCreditDistance,
      );
    }
    centerAccuracy = clamp01(sum / validLines.length);
  }

  let deviationSum = 0;
  for (const area of measuredAreas) deviationSum += Math.abs(area - ideal);
  const relativeDeviation = deviationSum / measuredAreas.length / ideal;
  const sliceUniformity = clamp01(
    creditBetween(relativeDeviation, tol.uniformityFullCreditDeviation, tol.uniformityZeroCreditDeviation),
  );

  const signals = { lineValidity, sliceCountFit, centerAccuracy, sliceUniformity };
  return {
    requestedSliceCount,
    lineCount: lines.length,
    requiredLineCount: requiredCutCount(requestedSliceCount),
    validLineCount: validLines.length,
    distinctLineCount,
    actualPieceCount,
    pieceAreas,
    sliverCount: pieceAreas.length - significantAreas.length,
    ...signals,
    overall: combine(signals, weights),
  };
}
