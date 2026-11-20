import { FOLD_CENTER_X, FOLD_LINE_Y, FOLD_SEAL_DEFAULT_RADIUS } from "./foldSealConstants";

/**
 * FOLD+SEAL geometry (pure): the dough silhouette the machine reads. The silhouette is injected so the machine never imports the game; a hand-stretched
 * dough is adapted by ./foldSealDoughShape.ts.
 *
 * Angle convention = the game's (../doughShape.ts): `atan2(dy, dx)` in screen space, 0 = east, increasing clockwise, so the lower half is angle 0..PI.
 */
export interface FoldSealGeometry {
  /** Silhouette radius (box units) at `angle`. Must be finite and >= 0 for every finite angle. */
  radiusAt(angle: number): number;
}

/** The ideal round dough. */
export function circleGeometry(radius: number = FOLD_SEAL_DEFAULT_RADIUS): FoldSealGeometry {
  const r = Number.isFinite(radius) && radius > 0 ? radius : FOLD_SEAL_DEFAULT_RADIUS;
  return { radiusAt: () => r };
}

export function isFinitePoint(x: number, y: number): boolean {
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y);
}

/** Whether (x, y) is inside the silhouette grown by `margin`. Non-finite input is outside. */
export function containsWithMargin(g: FoldSealGeometry, x: number, y: number, margin: number): boolean {
  if (!isFinitePoint(x, y)) return false;
  const dx = x - FOLD_CENTER_X;
  const dy = y - FOLD_LINE_Y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  return dist <= g.radiusAt(Math.atan2(dy, dx)) + margin;
}
