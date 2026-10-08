/**
 * Issue #418: pure drawing geometry for a committed cut. Visual only -- cut authority
 * (`CutLine.path`), evaluation, scoring, save and economy never read anything here.
 *
 * A cut that really reached the pizza's edge is drawn through the crust to the visible edge (the
 * player's hand-shaped silhouette, not the ideal circle) and gets crust details at both ends. A
 * stroke that stopped inside is drawn exactly to where it stopped.
 */
import { doughShapeRadiusAtAngle, type DoughShape } from "../doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import type { CutLine } from "./types";

/**
 * Owner Decision (#418): a cut that ends within the crust's width of the visible pizza edge counts
 * as having reached the edge, for display only -- it is then drawn on through the crust and the
 * pizza parts along it. Anything ending further in is a partial cut: no extension, no separation.
 * (Dough-percent; the stored `CutLine.path` and every scoring input are never touched.)
 */
export const CUT_CRUST_WIDTH = 6;
/** The dough layer's box edge: nothing is ever drawn past it. */
const BOX_EDGE_RADIUS = 50;
/** Drawn cuts run on this far past the traced end; the cut layer is clipped to the pizza. */
const THROUGH_OVERSHOOT_RADIUS = 53;

export interface CutEnd {
  /** Where the cut meets the visible pizza edge. */
  readonly tip: DoughPoint;
  /** Unit vector of the cut's direction as it leaves the pizza. */
  readonly dir: DoughPoint;
}

export interface CutVisual {
  readonly points: readonly DoughPoint[];
  readonly through: boolean;
  /** Both ends for a through cut; empty for a partial stroke. */
  readonly ends: readonly CutEnd[];
}

/** The visible pizza edge radius in the direction of `p` from the centre (<= the dough layer box). */
function edgeRadiusToward(p: DoughPoint, shape: DoughShape | undefined): number {
  if (!shape) return DOUGH_RADIUS;
  const r = doughShapeRadiusAtAngle(shape, Math.atan2(p.y - DOUGH_CENTER, p.x - DOUGH_CENTER));
  return Math.min(BOX_EDGE_RADIUS, Math.max(1, r));
}

/** Did this cut run edge to edge? (chord-only legacy lines always did). Visual only. */
export function isThroughCut(line: CutLine, shape?: DoughShape): boolean {
  const path = line.path;
  if (!path || path.length < 2) return true;
  const reached = (p: DoughPoint) => {
    const r = Math.hypot(p.x - DOUGH_CENTER, p.y - DOUGH_CENTER);
    return r >= Math.min(DOUGH_RADIUS, edgeRadiusToward(p, shape)) - CUT_CRUST_WIDTH;
  };
  return reached(path[0]) && reached(path[path.length - 1]);
}

/** The point reached by walking from `from` along unit `dir` until it is `radius` from the centre. */
export function rayToRadius(from: DoughPoint, dir: DoughPoint, radius: number): DoughPoint {
  const ox = from.x - DOUGH_CENTER;
  const oy = from.y - DOUGH_CENTER;
  const b = ox * dir.x + oy * dir.y;
  const c = ox * ox + oy * oy - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return from;
  const t = -b + Math.sqrt(disc);
  return t <= 0 ? from : { x: from.x + dir.x * t, y: from.y + dir.y * t };
}

function unit(dx: number, dy: number): DoughPoint | null {
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? null : { x: dx / len, y: dy / len };
}

export function buildCutVisual(line: CutLine, shape?: DoughShape): CutVisual {
  const base = line.path && line.path.length >= 2 ? line.path : [line.start, line.end];
  if (!isThroughCut(line, shape)) return { points: base, through: false, ends: [] };

  const chord = unit(line.end.x - line.start.x, line.end.y - line.start.y) ?? { x: 1, y: 0 };
  const first = base[0];
  const last = base[base.length - 1];
  const dirA = unit(first.x - base[1].x, first.y - base[1].y) ?? { x: -chord.x, y: -chord.y };
  const dirB = unit(last.x - base[base.length - 2].x, last.y - base[base.length - 2].y) ?? chord;

  const reach = (p: DoughPoint, dir: DoughPoint) => rayToRadius(p, dir, THROUGH_OVERSHOOT_RADIUS);
  const tipOf = (p: DoughPoint, dir: DoughPoint) => rayToRadius(p, dir, edgeRadiusToward(reach(p, dir), shape));
  return {
    points: [reach(first, dirA), ...base, reach(last, dirB)],
    through: true,
    ends: [
      { tip: tipOf(first, dirA), dir: dirA },
      { tip: tipOf(last, dirB), dir: dirB },
    ],
  };
}
