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
 *
 * #426: WHICH combinations exist is no longer found by sampling a grid (a thin piece between two near-parallel cuts fell
 * between the sample centres and was never drawn). When every through cut is a straight chord -- every cut the game can
 * make -- the pieces are the exact convex regions (./regions.ts, the same computation the CUT evaluation uses), every one
 * of them, however small; a region's side combination is read at its centroid, which is always inside it. Only a curved
 * traced path (no gesture produces one any more) still uses the sample grid below.
 *
 * #427: every cut the reducer commits is straight (`ADD_CUT_LINE` reduces a longer path to its two ends,
 * `normalizeCutLine` in ./trace.ts), so the sample grid is not reached by the game flow. It stays only for a direct
 * call of this pure function with a curved path (its own tests and any future trace-based cut, #288); removing it is a
 * separate decision.
 */
import { DOUGH_SHAPE_TECHNICAL_MAX_RADIUS, type DoughShape } from "../doughShape";
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";
import { buildCutVisual, rayToRadius } from "./cutVisual";
import { computeCutRegions, isStraightCut } from "./regions";
import type { CutLine } from "./types";

/** Radius of the huge disk the side polygons are closed on (far outside the pizza). */
const BIG_RADIUS = 400;
const ARC_STEP_RADIANS = (12 * Math.PI) / 180;
/** Grid used to find which side combinations really contain pizza (dough-percent per axis). */
const SAMPLE_GRID = 64;
const SAMPLE_RADIUS = 51;
/** A toppings' reach, used to decide which neighbouring pieces also show a sliced topping's half. */
export const TOPPING_REACH = 5;
/**
 * The radius (dough-percent) the piece outlines `placeTopping` intersects are cut to. The rendered pieces are the cut half-planes over the player's
 * actual dough, which can be stretched past the ideal circle (up to `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS`), so an outline clipped to the ideal circle
 * would put a neighbouring piece's stretched lobe out of a rim topping's reach. Over-covering is harmless; the CUT evaluation never reads these.
 */
export const PIECE_OUTLINE_RADIUS = Math.ceil(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS) + 6;
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
  /** The piece's size in sample-grid cells (area / one cell's area, at least 1). Informational: nothing reads it. */
  readonly sampleCount: number;
  /**
   * The piece's exact outline (convex, dough-percent) when every through cut is a straight chord: what `placeTopping` intersects a
   * topping's footprint with. Absent for the curved-path fallback (those pieces come from the sample grid and have no outline).
   */
  readonly polygon?: readonly DoughPoint[];
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

  const throughLines = cuts.map((c) => lines[c.lineIndex]);
  const pieces = throughLines.every((line) => isStraightCut(line))
    ? piecesFromRegions(cuts, throughLines)
    : piecesFromSamples(cuts);
  return { cuts, pieces };
}

/** Area of one sample-grid cell (dough-percent^2): the unit `PizzaPiece.sampleCount` is counted in. */
const SAMPLE_CELL_AREA = ((SAMPLE_RADIUS * 2) / SAMPLE_GRID) ** 2;

function makePiece(sides: boolean[], centroid: DoughPoint, sampleCount: number, polygon?: readonly DoughPoint[]): PizzaPiece {
  const dx = centroid.x - DOUGH_CENTER;
  const dy = centroid.y - DOUGH_CENTER;
  const outward = Math.hypot(dx, dy) < MIN_CENTROID_OFFSET ? { x: 0, y: 0 } : unit(dx, dy);
  return polygon ? { sides, centroid, outward, sampleCount, polygon } : { sides, centroid, outward, sampleCount };
}

/** Every exact region is a piece; its side combination is read at its centroid (inside a convex region by construction). */
function piecesFromRegions(cuts: readonly SplitCut[], throughLines: readonly CutLine[]): PizzaPiece[] {
  const byKey = new Map<string, PizzaPiece>();
  // each cell again, cut to the wider circle: the outline a topping's footprint is intersected with (see PIECE_OUTLINE_RADIUS)
  const outlines = new Map<string, readonly DoughPoint[]>();
  for (const wide of computeCutRegions(throughLines, PIECE_OUTLINE_RADIUS)) {
    outlines.set(keyOf(sidesAt({ cuts }, wide.centroid.x, wide.centroid.y)), wide.polygon);
  }
  for (const region of computeCutRegions(throughLines)) {
    const sides = sidesAt({ cuts }, region.centroid.x, region.centroid.y);
    const key = keyOf(sides);
    const sampleCount = Math.max(1, Math.round(region.area / SAMPLE_CELL_AREA));
    const known = byKey.get(key);
    // Distinct cells of a line arrangement have distinct side combinations; a repeat can only be numerical noise on a
    // vanishing region, so the larger one wins rather than drawing the same clip twice.
    if (!known || sampleCount > known.sampleCount) byKey.set(key, makePiece(sides, region.centroid, sampleCount, outlines.get(key) ?? region.polygon));
  }
  return [...byKey.values()];
}

/** The pre-#426 method, kept for curved traced paths only: which side combinations hold a sample of the pizza. */
function piecesFromSamples(cuts: readonly SplitCut[]): PizzaPiece[] {
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
  return [...groups.values()].map((g) => makePiece(g.sides, { x: g.sx / g.n, y: g.sy / g.n }, g.n));
}

export interface ToppingPlacement {
  /** The piece the topping's centre lies in: rendered whole (clipped to that piece). */
  readonly home: number;
  /** Other pieces the topping overlaps: each shows the sliced-off part only. */
  readonly halves: readonly number[];
}

/** Distance (dough-percent) from a point to a convex polygon: 0 when the point is inside it or on its edge. */
export function distanceToConvexPolygon(x: number, y: number, polygon: readonly DoughPoint[]): number {
  let sign = 0;
  let inside = true;
  let nearest = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j];
    const b = polygon[i];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const cross = ex * (y - a.y) - ey * (x - a.x);
    if (cross !== 0) {
      const side = cross > 0 ? 1 : -1;
      if (sign === 0) sign = side;
      else if (side !== sign) inside = false;
    }
    const lenSq = ex * ex + ey * ey;
    const t = lenSq < 1e-12 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / lenSq));
    nearest = Math.min(nearest, Math.hypot(x - (a.x + t * ex), y - (a.y + t * ey)));
  }
  return inside ? 0 : nearest;
}

/**
 * Which pieces show a topping at (x, y): its home piece (the one holding its centre) plus every other piece its footprint touches.
 * `reach` (dough-percent) is the footprint's RADIUS: a disc around (x, y) that must contain everything the topping draws.
 * It defaults to `TOPPING_REACH`; a topping drawn larger passes its own (../cut/toppingFootprint.ts).
 *
 * #479 S3: with exact piece outlines (every through cut a straight chord, i.e. every cut the game can make) a piece shows a copy
 * whenever the disc intersects its outline. That does not depend on the cut's angle or on how narrow the piece is. The curved-path
 * fallback (no outlines) keeps the old eight-direction probe.
 */
export function placeTopping(layout: PieceLayout, x: number, y: number, reach: number = TOPPING_REACH): ToppingPlacement {
  const index = new Map(layout.pieces.map((p, i) => [keyOf(p.sides), i]));
  const centre = index.get(keyOf(sidesAt(layout, x, y)));
  const seen = new Set<number>();
  if (layout.pieces.every((p) => p.polygon !== undefined)) {
    layout.pieces.forEach((p, i) => {
      if (distanceToConvexPolygon(x, y, p.polygon!) <= reach) seen.add(i);
    });
  } else {
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      const idx = index.get(keyOf(sidesAt(layout, x + Math.cos(a) * reach, y + Math.sin(a) * reach)));
      if (idx !== undefined) seen.add(idx);
    }
  }
  const home = centre ?? [...seen][0] ?? 0;
  seen.delete(home);
  return { home, halves: [...seen] };
}
