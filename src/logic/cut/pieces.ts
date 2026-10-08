/**
 * Issue #418: visual piece separation. Pure geometry -- no DOM, no React. Derived read-only from the
 * committed `CutLine.path`s; cut authority, evaluation, scoring, save and economy never read it.
 *
 * Every rim-to-rim ("through") cut splits the pizza into two sides. Instead of a polygon-clipping
 * engine, each cut is turned into two simple polygons that tile a huge disk (the drawn cut path,
 * run on past the pizza at both ends, closed by an arc around the outside -- one polygon per arc
 * direction). A point's "side" for that cut is just point-in-polygon. A piece is a distinct
 * combination of sides over all through cuts, so curved cuts and cuts that cross each other need no
 * special casing; the renderer nests one clip per cut to draw a piece exactly.
 */
import type { DoughShape } from "../doughShape";
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";
import { buildCutVisual, rayToRadius } from "./cutVisual";
import type { CutLine } from "./types";

/** Radius of the huge disk the side polygons are closed on (far outside the pizza). */
const BIG_RADIUS = 400;
const ARC_STEP_RADIANS = (12 * Math.PI) / 180;
/** Grid used to find which side combinations really contain pizza (dough-percent per axis). */
const SAMPLE_GRID = 64;
const SAMPLE_RADIUS = 51;
/** A toppings' reach, used to decide which neighbouring pieces also show a sliced topping's half. */
export const TOPPING_REACH = 5;
/** Pieces whose centroid is this close to the pizza centre are not pushed in any direction. */
const MIN_CENTROID_OFFSET = 3;

export interface SplitCut {
  /** Index into the `lines` the layout was built from. */
  readonly lineIndex: number;
  /** The two sides of this cut: tile the huge disk, share the cut path. */
  readonly sideA: readonly DoughPoint[];
  readonly sideB: readonly DoughPoint[];
}

export interface PizzaPiece {
  /** One entry per `PieceLayout.cuts` entry: true = side A of that cut. */
  readonly sides: readonly boolean[];
  readonly centroid: DoughPoint;
  /** Unit vector from the pizza centre towards the piece (zero for a piece around the centre). */
  readonly outward: DoughPoint;
  readonly sampleCount: number;
}

export interface PieceLayout {
  readonly cuts: readonly SplitCut[];
  readonly pieces: readonly PizzaPiece[];
}

function pointInPolygon(x: number, y: number, poly: readonly DoughPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function unit(dx: number, dy: number): DoughPoint {
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

function arcPoints(from: number, delta: number): DoughPoint[] {
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / ARC_STEP_RADIANS));
  const out: DoughPoint[] = [];
  for (let i = 1; i < steps; i += 1) {
    const a = from + (delta * i) / steps;
    out.push({ x: DOUGH_CENTER + Math.cos(a) * BIG_RADIUS, y: DOUGH_CENTER + Math.sin(a) * BIG_RADIUS });
  }
  return out;
}

/** The two simple polygons that tile the huge disk, split along `path` (extended past the pizza). */
export function buildSidePolygons(path: readonly DoughPoint[]): [DoughPoint[], DoughPoint[]] {
  const first = path[0];
  const last = path[path.length - 1];
  const dirStart = unit(first.x - path[1].x, first.y - path[1].y);
  const dirEnd = unit(last.x - path[path.length - 2].x, last.y - path[path.length - 2].y);
  const q0 = rayToRadius(first, dirStart, BIG_RADIUS);
  const qn = rayToRadius(last, dirEnd, BIG_RADIUS);
  const full = [q0, ...path, qn];
  const aEnd = Math.atan2(qn.y - DOUGH_CENTER, qn.x - DOUGH_CENTER);
  const aStart = Math.atan2(q0.y - DOUGH_CENTER, q0.x - DOUGH_CENTER);
  let ccw = (aStart - aEnd) % (Math.PI * 2);
  if (ccw < 0) ccw += Math.PI * 2;
  const cw = ccw - Math.PI * 2;
  return [
    [...full, ...arcPoints(aEnd, ccw)],
    [...full, ...arcPoints(aEnd, cw)],
  ];
}

const keyOf = (sides: readonly boolean[]) => sides.map((s) => (s ? "1" : "0")).join("");

/** Which side of each split cut a point falls on. */
export function sidesAt(layout: Pick<PieceLayout, "cuts">, x: number, y: number): boolean[] {
  return layout.cuts.map((c) => pointInPolygon(x, y, c.sideA));
}

/**
 * Builds the piece layout from the committed cuts, or `null` when no cut ran through (nothing
 * separates: the pizza stays one piece and partial strokes remain just grooves).
 */
export function computePieceLayout(lines: readonly CutLine[], shape?: DoughShape): PieceLayout | null {
  const cuts: SplitCut[] = [];
  lines.forEach((line, lineIndex) => {
    const visual = buildCutVisual(line, shape);
    if (!visual.through || visual.points.length < 2) return;
    const [sideA, sideB] = buildSidePolygons(visual.points);
    cuts.push({ lineIndex, sideA, sideB });
  });
  if (cuts.length === 0) return null;

  const groups = new Map<string, { sides: boolean[]; sx: number; sy: number; n: number }>();
  const step = (SAMPLE_RADIUS * 2) / SAMPLE_GRID;
  for (let row = 0; row < SAMPLE_GRID; row += 1) {
    const y = DOUGH_CENTER - SAMPLE_RADIUS + (row + 0.5) * step;
    for (let col = 0; col < SAMPLE_GRID; col += 1) {
      const x = DOUGH_CENTER - SAMPLE_RADIUS + (col + 0.5) * step;
      if (Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER) > SAMPLE_RADIUS) continue;
      const sides = sidesAt({ cuts }, x, y);
      const key = keyOf(sides);
      const g = groups.get(key);
      if (g) {
        g.sx += x;
        g.sy += y;
        g.n += 1;
      } else {
        groups.set(key, { sides, sx: x, sy: y, n: 1 });
      }
    }
  }

  const pieces: PizzaPiece[] = [...groups.values()].map((g) => {
    const centroid = { x: g.sx / g.n, y: g.sy / g.n };
    const dx = centroid.x - DOUGH_CENTER;
    const dy = centroid.y - DOUGH_CENTER;
    const outward = Math.hypot(dx, dy) < MIN_CENTROID_OFFSET ? { x: 0, y: 0 } : unit(dx, dy);
    return { sides: g.sides, centroid, outward, sampleCount: g.n };
  });
  return { cuts, pieces };
}

export interface ToppingPlacement {
  /** The piece the topping's centre lies in: rendered whole (clipped to that piece). */
  readonly home: number;
  /** Other pieces the topping overlaps: each shows the sliced-off part only. */
  readonly halves: readonly number[];
}

/** Which pieces show a topping at (x, y): its home piece plus any piece it is sliced into. */
export function placeTopping(layout: PieceLayout, x: number, y: number): ToppingPlacement {
  const index = new Map(layout.pieces.map((p, i) => [keyOf(p.sides), i]));
  const centre = index.get(keyOf(sidesAt(layout, x, y)));
  const seen = new Set<number>();
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    const idx = index.get(keyOf(sidesAt(layout, x + Math.cos(a) * TOPPING_REACH, y + Math.sin(a) * TOPPING_REACH)));
    if (idx !== undefined) seen.add(idx);
  }
  const home = centre ?? [...seen][0] ?? 0;
  seen.delete(home);
  return { home, halves: [...seen] };
}
