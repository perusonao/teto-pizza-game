/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §4.2): deterministic
 * grid-sampling piece-area approximation. Deliberately **not** a polygon-clipping/DCEL
 * computational-geometry engine -- the design doc's own §4.2 rejects that approach explicitly
 * (candidate B) in favor of this one, because every committed `CutLine` is, by the Phase 2
 * gesture layer's own construction, a full rim-to-rim chord, which removes the need for any
 * segment-intersection or face-enumeration code.
 *
 * Algorithm: lay a fixed `GRID_RESOLUTION x GRID_RESOLUTION` grid of candidate points over the
 * dough's bounding square, keep only the points inside the ideal circle (`isInsideDough`,
 * reused unchanged), and classify each kept point by which side of every committed chord it
 * falls on (a `+1`/`-1` sign per line). Two points with the identical sign tuple are
 * unambiguously in the same piece; `pieceArea = (pointsInGroup / totalKeptPoints) * circleArea`.
 *
 * Deterministic by construction: the grid is fixed (never `Math.random()`), so the same
 * `lines` array always produces the exact same `pieceAreas` array (test #5/#20 in the Result
 * Report). Scored against the recipe's *ideal* circle (`DOUGH_CENTER`/`DOUGH_RADIUS`), never the
 * player's D3A-distorted dough silhouette (../doughShape.ts) -- same existing precedent
 * Scoring 2.0's own Sauce component already established for `isInsideDough` (design doc §4.2's
 * closing note).
 */
import { DOUGH_CENTER, DOUGH_RADIUS, isInsideDough, type DoughPoint } from "../pizzaCoordinates";
import type { CutLine } from "./types";

/**
 * 96x96 candidate points over the bounding square -- roughly 7,200 land inside the circle
 * (`~pi * DOUGH_RADIUS^2` of the ~9,216-point square), each checked against at most 4 lines
 * (the 8-slice case): on the order of 30,000 simple arithmetic comparisons, well under a
 * millisecond on any real device (design doc §4.2 point 3). Kept as a named constant, never
 * inlined, so a future phase can retune it with a recorded reason instead of a silent edit --
 * matching ../sauceField.ts's own `SAUCE_FIELD_SIZE` precedent.
 */
export const GRID_RESOLUTION = 96;

/** The ideal pizza's total area -- the authority every piece-area fraction is measured against
 *  (design doc §4.2's `circleArea`). */
export const CIRCLE_AREA = Math.PI * DOUGH_RADIUS * DOUGH_RADIUS;

/** Below this chord length, a line carries no reliable direction (it is, numerically, a point,
 *  not a line) -- `sidesOf`/`perpendicularDistanceFromCenter` treat it via the documented
 *  degenerate-input fallback below rather than dividing by (near-)zero. A duplicate-endpoint or
 *  near-tangent adversarial fixture (Result Report tests #12/#14) is the realistic source of
 *  this case; it must never crash or produce `NaN`. */
const DEGENERATE_LINE_LENGTH_EPSILON = 1e-9;

/**
 * Which side of `line` does `point` fall on? A pure line-equation sign, no division -- safe even
 * for a zero-length (degenerate) line, which simply returns a constant sign for every point
 * (an arbitrary but deterministic classification, never a crash). This is the entire
 * "clipping" step this module needs -- no segment-intersection math, per the module header.
 */
export function sidesOf(point: DoughPoint, line: CutLine): 1 | -1 {
  const cross =
    (line.end.x - line.start.x) * (point.y - line.start.y) -
    (line.end.y - line.start.y) * (point.x - line.start.x);
  return cross >= 0 ? 1 : -1;
}

function signTupleKey(point: DoughPoint, lines: readonly CutLine[]): string {
  let key = "";
  for (let i = 0; i < lines.length; i++) {
    key += sidesOf(point, lines[i]);
    key += ",";
  }
  return key;
}

/**
 * Returns one approximate area (dough-percent^2, same unit family as `DOUGH_RADIUS`) per
 * distinct region `lines` actually produced -- however many that is, **never** assumed to equal
 * `requestedSliceCount` (that comparison is `countCorrectness`'s job, ./evaluation.ts). Handles
 * every degenerate/adversarial input "for free", with no special-case branch: crossing lines,
 * near-duplicate angles, an empty `lines` array (the whole circle, one region), and a
 * near-tangent/duplicate-endpoint line all simply produce whatever distinct sign-tuples they
 * produce (design doc §4.2 point 2).
 *
 * Order-independence: the returned array's *order* depends on scan order and is not meaningful
 * on its own -- every caller in this module family (`evaluateCut`, ./evaluation.ts) only ever
 * reads this array's `length` or aggregates over its values (mean, mean absolute deviation),
 * never a specific index, so reordering `lines` cannot change any evaluation signal (Result
 * Report test #6).
 */
export function computePieceAreas(
  lines: readonly CutLine[],
  gridResolution: number = GRID_RESOLUTION,
): readonly number[] {
  const counts = new Map<string, number>();
  let totalKept = 0;
  const step = (DOUGH_RADIUS * 2) / gridResolution;
  const minCoord = DOUGH_CENTER - DOUGH_RADIUS;

  for (let row = 0; row < gridResolution; row++) {
    const y = minCoord + (row + 0.5) * step;
    for (let col = 0; col < gridResolution; col++) {
      const x = minCoord + (col + 0.5) * step;
      if (!isInsideDough(x, y)) continue;
      totalKept++;
      const key = signTupleKey({ x, y }, lines);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Grid resolution is a fixed positive constant in every real call, so `totalKept` is always
  // well over zero in practice -- this guard exists purely to keep the function provably
  // NaN/Infinity-free (Result Report's numerical-robustness requirement) rather than to handle a
  // realistic input.
  if (totalKept === 0) return [CIRCLE_AREA];

  const areas: number[] = [];
  for (const count of counts.values()) {
    areas.push((count / totalKept) * CIRCLE_AREA);
  }
  return areas;
}

/**
 * Perpendicular distance from the dough's ideal center to the infinite line through
 * `line.start`/`line.end` (design doc §4.3). A degenerate (near-zero-length) line has no
 * reliable direction, so it is treated as the worst case -- as far from center as geometrically
 * possible (`DOUGH_RADIUS`) -- rather than dividing by (near-)zero.
 */
export function perpendicularDistanceFromCenter(line: CutLine): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= DEGENERATE_LINE_LENGTH_EPSILON) return DOUGH_RADIUS;
  const numerator = Math.abs(
    dy * DOUGH_CENTER - dx * DOUGH_CENTER + line.end.x * line.start.y - line.end.y * line.start.x,
  );
  return numerator / length;
}
