/**
 * #427 / #426: the one convex-region computation shared by CUT evaluation, the piece renderer
 * (./pieces.ts) and `computePieceAreas` (./geometry.ts), so the RESULT piece count and the pieces
 * on screen can no longer disagree.
 *
 * Every cut is a straight line, so every region is a convex polygon. The ideal circle is a
 * `CIRCLE_POLYGON_SIDES`-gon (error ~0.07 u^2 against ~7238 u^2) clipped by each line's two half-planes
 * in turn. Sides use the same sign convention as `sidesOf` (./geometry.ts).
 *
 * Every geometrically existing region is returned (a sliver included, so it can be drawn); only
 * `isSignificantRegion` regions count as pieces for scoring. Nothing here knows about the dough
 * silhouette: the region basis stays the ideal circle (irregular dough is #429).
 */
import { getCutThresholdOverride } from "../../preview/cutThresholdPreview";
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import type { CutLine } from "./types";

export const CIRCLE_AREA = Math.PI * DOUGH_RADIUS * DOUGH_RADIUS;

const CIRCLE_POLYGON_SIDES = 720;
/** Regions at or below this area (u^2) do not geometrically exist (clipping noise) and are dropped. */
const MIN_EXISTING_REGION_AREA = 1e-6;
const DEGENERATE_LINE_LENGTH = 1e-9;

/** Provisional Owner-Decision thresholds (#427); named so Human Verification can retune them. */
export const SIGNIFICANT_REGION_AREA_FRACTION = 0.001;
export const SIGNIFICANT_REGION_MIN_WIDTH = 1.0;

export interface CutRegion {
  /** Sign tuple over the lines passed in ("1"/"0" per line, 1 = `sidesOf` +1). */
  readonly key: string;
  readonly polygon: readonly DoughPoint[];
  readonly area: number;
  /** 4 * area / perimeter (dough units): the thickness of the region. */
  readonly width: number;
}

export interface SignificanceThresholds {
  readonly areaFraction: number;
  readonly minWidth: number;
}

let previewThresholds: SignificanceThresholds | null = null;

/** Defaults, or the Preview query override (Preview builds only; read once, never saved). */
export function getSignificanceThresholds(): SignificanceThresholds {
  if (import.meta.env.VITE_PREVIEW_MODE) {
    previewThresholds ??= (() => {
      const o = getCutThresholdOverride();
      return { areaFraction: o.areaPct / 100, minWidth: o.minWidth };
    })();
    return previewThresholds;
  }
  return { areaFraction: SIGNIFICANT_REGION_AREA_FRACTION, minWidth: SIGNIFICANT_REGION_MIN_WIDTH };
}

export function isSignificantRegion(
  region: CutRegion,
  thresholds: SignificanceThresholds = getSignificanceThresholds(),
): boolean {
  return region.area >= thresholds.areaFraction * CIRCLE_AREA && region.width >= thresholds.minWidth;
}

let circlePolygon: readonly DoughPoint[] | null = null;
function getCirclePolygon(): readonly DoughPoint[] {
  circlePolygon ??= Array.from({ length: CIRCLE_POLYGON_SIDES }, (_, i) => {
    const a = (i / CIRCLE_POLYGON_SIDES) * Math.PI * 2;
    return { x: DOUGH_CENTER + Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + Math.sin(a) * DOUGH_RADIUS };
  });
  return circlePolygon;
}

function polygonArea(poly: readonly DoughPoint[]): number {
  let twice = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    twice += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return Math.abs(twice) / 2;
}

function polygonPerimeter(poly: readonly DoughPoint[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    sum += Math.hypot(poly[i].x - poly[j].x, poly[i].y - poly[j].y);
  }
  return sum;
}

/** Centroid of a simple polygon; always inside a convex one. Falls back to the vertex mean. */
export function polygonCentroid(poly: readonly DoughPoint[]): DoughPoint {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    twice += f;
    cx += (poly[j].x + poly[i].x) * f;
    cy += (poly[j].y + poly[i].y) * f;
  }
  if (Math.abs(twice) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * twice), y: cy / (3 * twice) };
}

/** Same cross product as `sidesOf` (./geometry.ts): >= 0 is side +1. */
function crossOf(p: DoughPoint, line: CutLine): number {
  return (
    (line.end.x - line.start.x) * (p.y - line.start.y) - (line.end.y - line.start.y) * (p.x - line.start.x)
  );
}

/** Half-plane clip of a convex polygon, keeping points where `sign * cross >= 0`. */
function clipHalfPlane(poly: readonly DoughPoint[], line: CutLine, sign: 1 | -1): DoughPoint[] {
  const out: DoughPoint[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[j];
    const b = poly[i];
    const fa = sign * crossOf(a, line);
    const fb = sign * crossOf(b, line);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function toRegion(key: string, polygon: DoughPoint[]): CutRegion | null {
  if (polygon.length < 3) return null;
  const area = polygonArea(polygon);
  if (area <= MIN_EXISTING_REGION_AREA) return null;
  const perimeter = polygonPerimeter(polygon);
  return { key, polygon, area, width: perimeter > 0 ? (4 * area) / perimeter : 0 };
}

/**
 * Every geometrically existing region the straight `lines` cut the ideal circle into. Zero lines is
 * one region (the whole circle). A zero-length line splits nothing (it is a constant side, as in
 * `sidesOf`). Order-independent as a multiset of areas.
 */
export function computeRegions(lines: readonly CutLine[]): readonly CutRegion[] {
  let regions: CutRegion[] = [toRegion("", [...getCirclePolygon()]) as CutRegion];
  for (const line of lines) {
    // A zero-length line has no direction: like `sidesOf`, every point is on side +1, nothing splits.
    if (Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) <= DEGENERATE_LINE_LENGTH) {
      regions = regions.map((r) => ({ ...r, key: r.key + "1" }));
      continue;
    }
    const next: CutRegion[] = [];
    for (const region of regions) {
      for (const sign of [1, -1] as const) {
        const piece = toRegion(region.key + (sign === 1 ? "1" : "0"), clipHalfPlane(region.polygon, line, sign));
        if (piece) next.push(piece);
      }
    }
    regions = next;
  }
  return regions;
}

export function significantRegions(
  regions: readonly CutRegion[],
  thresholds: SignificanceThresholds = getSignificanceThresholds(),
): readonly CutRegion[] {
  return regions.filter((r) => isSignificantRegion(r, thresholds));
}
