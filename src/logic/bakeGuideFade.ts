/**
 * M3A Bake Judgment Phase 1: the Guide fade curve, split out of ../components/BakeOverlay.tsx
 * itself only so it stays a pure, independently testable function (oxlint's
 * `react/only-export-components` flags a component file exporting anything else, since it
 * breaks fast refresh) -- see BakeOverlay.tsx's own file header for the full fade contract
 * (why it's elapsed BAKE-phase time, not needle proximity to the target zone).
 */

/** ~1 full 0->100->0 needle sweep at BakeOverlay's own SPEED, so the zone is seen whole at
 *  least once before the Guide starts fading. */
export const GUIDE_FADE_START_S = 3.6;
/** ~2 full sweeps; the Guide is fully hidden from here on. */
export const GUIDE_FADE_END_S = 7.2;

/** 1 up to `GUIDE_FADE_START_S`, linearly down to 0 by `GUIDE_FADE_END_S`, 0 after --
 *  monotonically non-increasing in elapsed time. */
export function computeGuideOpacity(elapsedSeconds: number): number {
  if (elapsedSeconds <= GUIDE_FADE_START_S) return 1;
  if (elapsedSeconds >= GUIDE_FADE_END_S) return 0;
  return 1 - (elapsedSeconds - GUIDE_FADE_START_S) / (GUIDE_FADE_END_S - GUIDE_FADE_START_S);
}
