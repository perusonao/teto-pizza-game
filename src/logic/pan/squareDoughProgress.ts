/**
 * Square-Pan Dough C (Issue #536, Epic #532): how far along the square dough is -- which of the two steps the player is in and whether
 * the dough is finished. Pure and DERIVED from the dough alone: nothing about the step is stored, so it can never be skipped or
 * shown out of order, and because coverage and corner reach only ever grow (squareDoughDrag.ts, squareDoughSpread.ts), a dough
 * that has reached STEP 2 cannot fall back to STEP 1.
 *
 *   STEP 1 「四隅まで伸ばす」: done when every corner is reached (CORNER_REACH_THRESHOLD, squareDough.ts) AND the sheet covers at
 *            least SQUARE_STEP1_COVERAGE_MIN of the pan (a thin arm pulled to each corner does not count).
 *   STEP 2 「厚みを整える」: done when STEP 1 is done AND the evenness is at least SQUARE_COMPLETE_EVENNESS_MIN. That is the
 *            completion that enables 「次へ」; the player may keep editing until 「次へ」 fixes the shape.
 *
 * What the gauge shows is what is judged: the coverage and evenness comparisons are made on the number as the gauge prints it (one
 * decimal of a percent), so "60.0%" on the screen is "reached". The corner threshold stays where A put it (85 %, Owner-confirmed); the two new
 * numbers are initial values for Owner on-device HV.
 */
import {
  CORNER_REACH_THRESHOLD,
  squareCornerReach,
  squareDoughCoverage,
  squareDoughEvenness,
  type SquareDough,
} from "./squareDough";

/** STEP 1's coverage requirement (fraction of the pan). Owner-approved initial value (T2). */
export const SQUARE_STEP1_COVERAGE_MIN = 0.95;
/** The evenness at which the dough is finished -- and the target the STEP 2 gauge shows. Owner-approved initial value; HV decides. */
export const SQUARE_COMPLETE_EVENNESS_MIN = 0.6;

export type SquareDoughStepNumber = 1 | 2;

/** a >= b, judged on the 0.1-percent number the gauge shows. */
export function reachedAsShown(value: number, min: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.round(value * 1000) >= Math.round(min * 1000);
}

export interface SquareDoughProgress {
  readonly coverage: number;
  readonly evenness: number;
  /** NW, NE, SE, SW. */
  readonly corners: readonly boolean[];
  readonly cornersReached: number;
  readonly coverageReached: boolean;
  readonly step1Done: boolean;
  readonly step: SquareDoughStepNumber;
  readonly evennessReached: boolean;
  /** STEP 1 done and evenness reached: 「次へ」 is available. */
  readonly complete: boolean;
}

export function squareDoughProgress(dough: SquareDough): SquareDoughProgress {
  const coverage = squareDoughCoverage(dough);
  const evenness = squareDoughEvenness(dough);
  const corners = squareCornerReach(dough).map((reach) => reach >= CORNER_REACH_THRESHOLD); // the same inclusive test as areAllCornersReached
  const cornersReached = corners.filter(Boolean).length;
  const coverageReached = reachedAsShown(coverage, SQUARE_STEP1_COVERAGE_MIN);
  const step1Done = cornersReached === corners.length && coverageReached;
  const evennessReached = reachedAsShown(evenness, SQUARE_COMPLETE_EVENNESS_MIN);
  return {
    coverage,
    evenness,
    corners,
    cornersReached,
    coverageReached,
    step1Done,
    step: step1Done ? 2 : 1,
    evennessReached,
    complete: step1Done && evennessReached,
  };
}

export function squareDoughStep(dough: SquareDough): SquareDoughStepNumber {
  return squareDoughProgress(dough).step;
}

export function isSquareDoughComplete(dough: SquareDough): boolean {
  return squareDoughProgress(dough).complete;
}
