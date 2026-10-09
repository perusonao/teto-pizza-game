/**
 * Pizza Cutting 1.0 Phase 1 (docs/design/TETO_PIZZA-CUTTING_1.0.md §4.2): piece areas for a set of
 * straight cut lines. #427: the 96x96 grid approximation is replaced by the exact convex-region
 * computation in ./regions.ts (a 720-gon circle clipped by each line), shared with the piece renderer.
 * Scored against the recipe's *ideal* circle (`DOUGH_CENTER`/`DOUGH_RADIUS`), never the player's
 * D3A-distorted dough silhouette (irregular dough is #429).
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { CIRCLE_AREA, computeRegions } from "./regions";
import type { CutLine } from "./types";

/** The ideal pizza's total area -- the authority every piece-area fraction is measured against. */
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
 * One area (dough-percent^2) per geometrically existing region `lines` produced -- including slivers
 * too thin to count as a piece (the sum stays ~`CIRCLE_AREA`). Which regions count as pieces is
 * `evaluateCut`'s job (./evaluation.ts, `isSignificantRegion`). Never assumed to equal
 * `requestedSliceCount`. Order is not meaningful.
 */
export function computePieceAreas(lines: readonly CutLine[]): readonly number[] {
  return computeRegions(lines).map((r) => r.area);
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
