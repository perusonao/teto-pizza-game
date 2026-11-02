/**
 * Cooking Sear Phase 1 (#724, iPhone HV follow-up): where the "🔥 炙る" pill sits (pure geometry).
 *
 * The pill's home is the centred band under the dough (pill bottom = stage bottom - 18px, 120x44). The dough is a CIRCLE centred in the stage, so the band is
 * free only when the stage is tall enough: stage height >= dough + 2 * (18 + 44 + clearance) = about +124px (390 wide: >= 414, 360 wide: >= 398). On a real
 * iPhone Safari the visible height is shorter (address / tab bar), the dough fills the stage and the centred pill sat 30-58px ON it. In that case the pill goes
 * to the stage's bottom-right CORNER, which is outside the circle. Measured, never assumed: the same function decides from the live rects, so any stage
 * height / width / dough size (and the address bar collapsing) lands on the right side of the line.
 */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The centred band's own size and offset (./Sear.css `.cooking-sear-pill`). */
export const SEAR_BAND_PILL_W = 120;
export const SEAR_BAND_PILL_H = 44;
export const SEAR_BAND_BOTTOM = 18;
/** Smallest gap kept between the pill box and the dough's circle for the band to count as clear. */
export const SEAR_BAND_CLEARANCE = 3;

/** Distance from the circle's edge to the nearest point of the box (negative = they overlap). */
export function clearanceToCircle(box: Box, circle: { cx: number; cy: number; r: number }): number {
  const nx = Math.min(Math.max(circle.cx, box.left), box.right);
  const ny = Math.min(Math.max(circle.cy, box.top), box.bottom);
  return Math.hypot(nx - circle.cx, ny - circle.cy) - circle.r;
}

/** True when the centred band would touch the dough, so the pill must use the corner. Non-finite / empty rects (not laid out yet) keep the band. */
export function searPillNeedsCorner(stage: Box, dough: Box): boolean {
  const vals = [stage.left, stage.top, stage.right, stage.bottom, dough.left, dough.top, dough.right, dough.bottom];
  if (!vals.every(Number.isFinite)) return false;
  const w = dough.right - dough.left;
  const h = dough.bottom - dough.top;
  if (w <= 0 || h <= 0 || stage.right - stage.left <= 0) return false;
  const centre = (stage.left + stage.right) / 2;
  const band: Box = {
    left: centre - SEAR_BAND_PILL_W / 2,
    right: centre + SEAR_BAND_PILL_W / 2,
    bottom: stage.bottom - SEAR_BAND_BOTTOM,
    top: stage.bottom - SEAR_BAND_BOTTOM - SEAR_BAND_PILL_H,
  };
  return clearanceToCircle(band, { cx: (dough.left + dough.right) / 2, cy: (dough.top + dough.bottom) / 2, r: Math.min(w, h) / 2 }) < SEAR_BAND_CLEARANCE;
}
