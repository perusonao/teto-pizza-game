/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §4.2): piece-area geometry for CUT evaluation.
 *
 * #427 / #426: the 96x96 grid-sampling approximation this module used is gone. Pieces are now the exact convex regions the
 * cuts make inside the ideal circle (./regions.ts, a 720-gon clipped by one half-plane per chord), the same computation the
 * piece drawing uses (./pieces.ts) -- so a tiny region can no longer be counted by one and missed by the other.
 *
 * Still scored against the recipe's *ideal* circle (`DOUGH_CENTER`/`DOUGH_RADIUS`), never the player's D3A-distorted dough
 * silhouette (../doughShape.ts) -- the same precedent Scoring 2.0's own Sauce component set for `isInsideDough` (design doc
 * §4.2's closing note). Dough-shape-based regions are #429.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { CIRCLE_AREA, computeCutRegions } from "./regions";
import type { CutLine } from "./types";

export { CIRCLE_AREA };

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

/**
 * One area (dough-percent^2, same unit family as `DOUGH_RADIUS`) per region `lines` actually produce -- ALL of them, however
 * small (the areas add up to ~`CIRCLE_AREA`), and never assumed to equal `requestedSliceCount`. Every line is taken as an
 * infinite chord, a partial stroke included; which regions count as pieces, and which lines count as cuts at all, is
 * `evaluateCut`'s job (./evaluation.ts). An empty `lines` array is the whole circle, one region; a degenerate (zero-length)
 * line splits nothing.
 *
 * Order-independence: the returned array's *order* is not meaningful on its own -- every caller only reads its `length` or
 * aggregates over its values (mean, mean absolute deviation), never a specific index.
 */
export function computePieceAreas(lines: readonly CutLine[]): readonly number[] {
  return computeCutRegions(lines).map((region) => region.area);
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
