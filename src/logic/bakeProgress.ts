/**
 * Issue #419 (Bake Human Feel): the one-way bake clock, split out of ../components/BakeOverlay.tsx
 * so it stays pure and independently testable.
 *
 * Bake progress is a pure function of *elapsed active BAKE time*: 0 -> 100 in `BAKE_DURATION_S`,
 * linear, then it holds at 100 (it never returns). `BakeOverlay` feeds the position straight to
 * `CONFIRM_BAKE` and to `PizzaStage`'s continuous `computeBakeHeat`, so the same monotonic value
 * keeps the bake visual from ever running backwards. Scoring (`classifyBake`, Scoring 2.0) is
 * unchanged -- it still receives a 0..100 number.
 *
 * The clock is shared by every mode (FREE / Lunch Rush / Dinner); nothing here reads a recipe,
 * so neither the speed nor the fade can depend on the correct position.
 */

/** Seconds from 0% to 100%. A provisional value (Owner HV may retune it) -- change it here only. */
export const BAKE_DURATION_S = 10;

/** Percent per second, derived from `BAKE_DURATION_S`. */
export const BAKE_SPEED_PCT_PER_S = 100 / BAKE_DURATION_S;

/**
 * Longest slice of real time one frame may add to the bake clock. A backgrounded tab (or a long
 * main-thread stall) delivers a single rAF callback with a huge `dt` on return; one-way progress
 * would jump straight to 100% (burnt). Clamping makes that frame cost at most this much.
 */
export const BAKE_MAX_FRAME_DT_S = 0.1;

/** OD-419: the target zone is fully shown until here ... */
export const BAKE_ZONE_FADE_START_S = 3;
/** ... fades out until here, and stays hidden (never returns) afterwards. */
export const BAKE_ZONE_FADE_END_S = 5;

/** `dt` actually added to the clock: NaN / negative -> 0, otherwise capped at `BAKE_MAX_FRAME_DT_S`. */
export function clampBakeFrameDt(dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return 0;
  return Math.min(dtSeconds, BAKE_MAX_FRAME_DT_S);
}

/** Bake position 0..100 for an elapsed active time; monotonic non-decreasing, holds at 100. */
export function bakePositionAt(elapsedSeconds: number): number {
  if (!(elapsedSeconds > 0)) return 0;
  return Math.min(100, elapsedSeconds * BAKE_SPEED_PCT_PER_S);
}

/** Target-zone opacity: 1 until `BAKE_ZONE_FADE_START_S`, linear to 0 at `BAKE_ZONE_FADE_END_S`, 0 after. */
export function computeBakeZoneOpacity(elapsedSeconds: number): number {
  if (elapsedSeconds <= BAKE_ZONE_FADE_START_S) return 1;
  if (elapsedSeconds >= BAKE_ZONE_FADE_END_S) return 0;
  return 1 - (elapsedSeconds - BAKE_ZONE_FADE_START_S) / (BAKE_ZONE_FADE_END_S - BAKE_ZONE_FADE_START_S);
}
