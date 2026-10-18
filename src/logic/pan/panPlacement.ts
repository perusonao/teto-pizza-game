/**
 * Square-Pan Dough D1 (Issue #537, Epic #532): cheese / topping drop validity through the pan interface.
 *
 * `resolvePieceDrop` (../pieceDrag.ts), the reducer's `isInsideDough` check and `findOpenSpot` (../../state/pizzaState.ts)
 * all assume the round dough. The functions here take a `PanGeometry` instead, so the square pan uses the same
 * rules against its own edge. For `ROUND_PAN_GEOMETRY` they agree with the existing functions (panPlacement.test.ts
 * probes that), but the round code paths are NOT rerouted here: the round pizza keeps calling its own functions.
 *
 * Inert: no caller yet (reducer wiring is a later D slice, after B/C land). Pure.
 */
import { clientPointToDoughPercent, type DoughPoint } from "../pizzaCoordinates";
import { PIECE_DROP_EDGE_GRACE, resolvePieceDrop } from "../pieceDrag";
import { getPanGeometry, type PanGeometry } from "./panGeometry";
import type { PanShape } from "./panShape";

/** The only fields of a placed piece the spot search reads (structurally a `PlacedTopping`; the pan module imports no state). */
export interface PlacedPoint {
  readonly x: number;
  readonly y: number;
}

export interface OpenPanSpot {
  x: number;
  y: number;
}

function isTooClose(existing: readonly PlacedPoint[], x: number, y: number, minDistance: number): boolean {
  return existing.some((t) => Math.hypot(t.x - x, t.y - y) < minDistance);
}

/**
 * Where a point past the pan lands. Round: the existing radial `clamp`, whose distance is exactly the rim overshoot.
 * Square: the nearest point of the square, not the radial projection -- near a corner the radial one moves the point
 * along the edge and would measure a larger overshoot than the finger actually is from the pan (Codex P2 on #549).
 */
function nearestOnPan(geometry: PanGeometry, point: DoughPoint): DoughPoint {
  if (geometry.shape !== "square") return geometry.clamp(point.x, point.y);
  const { minX, minY, maxX, maxY } = geometry.bounds;
  return { x: Math.min(maxX, Math.max(minX, point.x)), y: Math.min(maxY, Math.max(minY, point.y)) };
}

/**
 * Finger position -> dough-percent point on the pan, or null. A drop on the pan is kept as it is; one within
 * `PIECE_DROP_EDGE_GRACE` (dough-percent) past the edge is pulled onto the edge; anything farther is rejected.
 * The grace is measured as the distance from the point to its clamped position -- for the round pan that is exactly
 * `distanceFromCenter - 48`, the existing rule; for the square pan it is the distance to the nearest point of the square, so the four corners keep the same finger tolerance as the sides.
 */
export function resolveGeometryPieceDrop(
  geometry: PanGeometry,
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): DoughPoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  const point = clientPointToDoughPercent(clientX, clientY, rect as DOMRect);
  if (geometry.contains(point.x, point.y)) return point;
  const clamped = nearestOnPan(geometry, point);
  if (Math.hypot(point.x - clamped.x, point.y - clamped.y) > PIECE_DROP_EDGE_GRACE) return null;
  return clamped;
}

/**
 * `findOpenSpot` against a pan: the requested point if it is free, else the nearest free spot of a small spiral
 * search that stays on the pan, else null (packed). Same rings, steps and angles as the round function.
 */
export function findOpenSpotOnPan(
  geometry: PanGeometry,
  existing: readonly PlacedPoint[],
  x: number,
  y: number,
  /** The caller passes `MIN_TOPPING_DISTANCE` (../../state/pizzaState.ts), which this module may not import. */
  minDistance: number,
): OpenPanSpot | null {
  if (!isTooClose(existing, x, y, minDistance)) return { x, y };

  const ringCount = 4;
  const stepsPerRing = 8;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const radius = minDistance * 0.6 * ring;
    for (let step = 0; step < stepsPerRing; step += 1) {
      const angle = (step / stepsPerRing) * Math.PI * 2 + ring;
      const nx = x + Math.cos(angle) * radius;
      const ny = y + Math.sin(angle) * radius;
      if (!geometry.contains(nx, ny)) continue;
      if (nx < 0 || nx > 100 || ny < 0 || ny > 100) continue;
      if (!isTooClose(existing, nx, ny, minDistance)) return { x: nx, y: ny };
    }
  }
  return null;
}

/**
 * The drop resolver for a round of this pan: the round pan keeps `resolvePieceDrop` itself (so a round pizza's drop is the
 * function it has always used), the square pan uses `resolveGeometryPieceDrop`. The caller (App.tsx) wires it in a D2 slice.
 */
export function resolvePieceDropForPan(
  shape: PanShape,
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): DoughPoint | null {
  if (shape !== "square") return resolvePieceDrop(clientX, clientY, rect);
  return resolveGeometryPieceDrop(getPanGeometry(shape), clientX, clientY, rect);
}
