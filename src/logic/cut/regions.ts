/**
 * #427 / #426: the one region computation shared by CUT evaluation (./evaluation.ts, ./geometry.ts) and the piece
 * drawing (./pieces.ts). Pure geometry -- no DOM, no React.
 *
 * Every cut the player makes is a straight chord, so every region the cuts make is a convex polygon. The ideal circle is
 * approximated by a 720-gon (area error 0.07 u^2 against ~7238 u^2) and cut by one half-plane per chord: each chord splits
 * every region it crosses into two, and a region of (almost) no area is dropped. Nothing is sampled on a grid, so a region
 * that exists is never missed and one that does not exist is never invented -- the grid versions disagreed on exactly the
 * tiny ones (the centre triangle of three nearly concurrent cuts, #427; the thin strip between two near-parallel cuts, #426).
 *
 * Two questions are answered separately:
 * - Which regions EXIST (`computeCutRegions`): all of them are drawn.
 * - Which are SIGNIFICANT (`isSignificantRegion`): only those count as pieces in the CUT evaluation. A region is significant
 *   when it is large enough (area) AND not a sliver (width = 4 * area / perimeter) -- a one-pixel strip or a fleck at the
 *   crossing of three cuts is real geometry but not something the player cut.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { getPreviewCutThresholds } from "../../preview/cutThresholdPreview";
import type { CutLine } from "./types";

/** Corners of the polygon standing in for the ideal circle. */
export const CIRCLE_POLYGON_SIDES = 720;

/** The ideal pizza's area (the authority every piece-area fraction is measured against). */
export const CIRCLE_AREA = Math.PI * DOUGH_RADIUS * DOUGH_RADIUS;

/** A region smaller than this is a numerical artefact of clipping (e.g. a line cutting along another), not geometry. */
export const MIN_REGION_AREA = 1e-6;

/** Chords shorter than this carry no direction: they split nothing (the old sign-tuple test also saw one constant side). */
const DEGENERATE_CHORD_LENGTH = 1e-9;

export interface CutSignificanceThresholds {
  /** Minimum area, as a fraction of `CIRCLE_AREA` (0.001 = 0.1%). Independent of the requested slice count. */
  readonly areaFraction: number;
  /** Minimum width `4 * area / perimeter`, in dough units (u). */
  readonly minWidth: number;
}

/** Owner Decision (#427): the initial thresholds -- 0.1% of the pizza (~7.2 u^2) and 1.0 u. Adjusted on a real device. */
export const DEFAULT_CUT_SIGNIFICANCE: CutSignificanceThresholds = Object.freeze({ areaFraction: 0.001, minWidth: 1.0 });

/**
 * The thresholds in effect. Production: always the defaults. A Preview build (`VITE_PREVIEW_MODE`) may override them with
 * a URL query (../../preview/cutThresholdPreview.ts); that branch -- and the module it imports -- is removed from a
 * production bundle.
 */
export function getCutSignificanceThresholds(): CutSignificanceThresholds {
  if (import.meta.env.VITE_PREVIEW_MODE) return getPreviewCutThresholds(DEFAULT_CUT_SIGNIFICANCE);
  return DEFAULT_CUT_SIGNIFICANCE;
}

export interface CutRegion {
  /** Corners, in order. Convex. */
  readonly polygon: readonly DoughPoint[];
  readonly area: number;
  readonly perimeter: number;
  /** `4 * area / perimeter`: the diameter of the circle the region would be if it were one (a sliver has a small width). */
  readonly width: number;
  readonly centroid: DoughPoint;
}

/** The infinite line a cut makes: through the first and last point of its traced path, else through `start` / `end`. */
export function chordOf(line: CutLine): { readonly a: DoughPoint; readonly b: DoughPoint } {
  const path = line.path;
  return path && path.length >= 2 ? { a: path[0], b: path[path.length - 1] } : { a: line.start, b: line.end };
}

/** Is the cut's traced path a straight line (every point within `tolerance` u of the first-to-last chord)? */
export function isStraightCut(line: CutLine, tolerance = 0.01): boolean {
  const path = line.path;
  if (!path || path.length <= 2) return true;
  const { a, b } = chordOf(line);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < DEGENERATE_CHORD_LENGTH) return true;
  return path.every((p) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / length <= tolerance);
}

let circle: readonly DoughPoint[] | null = null;
function circlePolygon(): readonly DoughPoint[] {
  circle ??= Array.from({ length: CIRCLE_POLYGON_SIDES }, (_, i) => {
    const angle = (2 * Math.PI * i) / CIRCLE_POLYGON_SIDES;
    return { x: DOUGH_CENTER + DOUGH_RADIUS * Math.cos(angle), y: DOUGH_CENTER + DOUGH_RADIUS * Math.sin(angle) };
  });
  return circle;
}

/** Keeps the part of the convex `polygon` where `keep * cross(b - a, p - a) >= 0` (Sutherland-Hodgman, one half-plane). */
function clipHalfPlane(
  polygon: readonly DoughPoint[],
  a: DoughPoint,
  b: DoughPoint,
  keep: 1 | -1,
): DoughPoint[] {
  const side = (p: DoughPoint) => keep * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const out: DoughPoint[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

function measure(polygon: readonly DoughPoint[]): CutRegion | null {
  if (polygon.length < 3) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  let perimeter = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const cross = p.x * q.y - q.x * p.y;
    twiceArea += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
    perimeter += Math.hypot(q.x - p.x, q.y - p.y);
  }
  const area = Math.abs(twiceArea) / 2;
  if (area <= MIN_REGION_AREA || perimeter <= 0) return null;
  const centroid = { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
  return { polygon, area, perimeter, width: (4 * area) / perimeter, centroid };
}

/**
 * Every region the given chords make inside the ideal circle (area above `MIN_REGION_AREA`). No chords: the whole pizza,
 * one region. The result does not depend on the order of the chords (up to the order of the regions).
 */
export function computeCutRegions(lines: readonly CutLine[]): CutRegion[] {
  let polygons: DoughPoint[][] = [[...circlePolygon()]];
  for (const line of lines) {
    const { a, b } = chordOf(line);
    if (Math.hypot(b.x - a.x, b.y - a.y) < DEGENERATE_CHORD_LENGTH) continue;
    const next: DoughPoint[][] = [];
    for (const polygon of polygons) {
      for (const keep of [1, -1] as const) {
        const part = clipHalfPlane(polygon, a, b, keep);
        if (part.length >= 3 && measure(part)) next.push(part);
      }
    }
    polygons = next;
  }
  return polygons.flatMap((polygon) => measure(polygon) ?? []);
}

/** Is this region a real piece for the CUT evaluation: big enough AND not a sliver? */
export function isSignificantRegion(
  region: Pick<CutRegion, "area" | "width">,
  thresholds: CutSignificanceThresholds = getCutSignificanceThresholds(),
): boolean {
  return region.area >= thresholds.areaFraction * CIRCLE_AREA && region.width >= thresholds.minWidth;
}
