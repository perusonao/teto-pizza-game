import {
  clampToDough,
  clientPointToDoughPercent,
  distanceFromCenter,
  type DoughPoint,
} from "./pizzaCoordinates";

export const PIECE_DRAG_THRESHOLD_PX = 6;
export const PIECE_DROP_EDGE_GRACE = 4;

export function hasPieceDragIntent(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  pointerType: string,
): boolean {
  const dx = clientX - startX;
  const dy = clientY - startY;
  if (Math.hypot(dx, dy) < PIECE_DRAG_THRESHOLD_PX) return false;
  if (pointerType === "mouse" || pointerType === "pen") return true;
  return dy < 0 && Math.abs(dy) >= Math.abs(dx) * 0.75;
}

/** Resolves a finger position into the same dough-percent coordinates used by PizzaState. */
export function resolvePieceDrop(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): DoughPoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) {
    return null;
  }
  if (rect.width <= 0 || rect.height <= 0) return null;
  const point = clientPointToDoughPercent(clientX, clientY, rect as DOMRect);
  const distance = distanceFromCenter(point.x, point.y);
  if (distance > 48 + PIECE_DROP_EDGE_GRACE) return null;
  return distance > 48 ? clampToDough(point.x, point.y) : point;
}

/** Stable visual-only leaf rotation. Canonical placement and scoring never read it. */
export function stablePieceRotation(
  ingredientId: string,
  x: number,
  y: number,
  maxDegrees = 14,
): number {
  const key = `${ingredientId}:${x.toFixed(2)}:${y.toFixed(2)}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  return (normalized * 2 - 1) * maxDegrees;
}
