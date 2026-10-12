/**
 * Issue #475 Slice 1: fixed, deterministic deposit lists shared by the Sauce display tests.
 * Each one is what a real dispense produces (one deposit per 50ms tick, `SAUCE_RATE_PER_TICK`
 * each), written as plain data so the same list can feed `computeSauceMetrics` (pinned against
 * main's exact output) and the display rasterizer (roundness / roughness / extent / centroid).
 */
import { SAUCE_RATE_PER_TICK } from "../sauceQuantity";
import type { SauceDepositLike } from "../sauceField";

const TICKS = 46; // a 2.3s hold: 46 x 50ms

function ticks(position: (t: number) => { x: number; y: number }): SauceDepositLike[] {
  return Array.from({ length: TICKS }, (_, i) => {
    const t = Math.min(1, i / (TICKS - 1));
    const { x, y } = position(t);
    return { x, y, amount: SAUCE_RATE_PER_TICK };
  });
}

/** A hold at the centre of the dough (the "中央長押し" case: ideally a round puddle). */
export const CENTER_HOLD: readonly SauceDepositLike[] = ticks(() => ({ x: 50, y: 50 }));

/** Three turns outward from the centre to radius 38 (the "中心から渦巻き" case). */
export const SPIRAL_R38: readonly SauceDepositLike[] = ticks((t) => {
  const a = t * 3 * Math.PI * 2;
  return { x: 50 + Math.cos(a) * 38 * t, y: 50 + Math.sin(a) * 38 * t };
});

/** The same three turns, but staying inside the ideal sauce ring (radius 30): the "good spiral". */
export const SPIRAL_R30: readonly SauceDepositLike[] = ticks((t) => {
  const a = t * 3 * Math.PI * 2;
  return { x: 50 + Math.cos(a) * 30 * t, y: 50 + Math.sin(a) * 30 * t };
});

/** Only the left part of the dough, zig-zagging down (an uneven, one-sided coat). */
export const LEFT_ONLY: readonly SauceDepositLike[] = ticks((t) => ({
  x: 22 + (Math.floor(t * 15) % 2 === 0 ? 0 : 10),
  y: 20 + t * 60,
}));

/** A ring of 16 single taps at radius 25 (what the e2e `paintSauceRing` helper does). */
export const RING_TAPS: readonly SauceDepositLike[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: 50 + Math.cos(a) * 25, y: 50 + Math.sin(a) * 25, amount: SAUCE_RATE_PER_TICK };
});

/** A drag that drifts out over the rim (r 44 -> 58): paint on the crust and past the dough. */
export const RIM_SPILL: readonly SauceDepositLike[] = ticks((t) => {
  const a = t * 2 * Math.PI * 2;
  const r = 44 + t * 14;
  return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
});

/** A single tap. */
export const SINGLE_TAP: readonly SauceDepositLike[] = [{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }];

export const STROKE_FIXTURES = {
  CENTER_HOLD,
  SPIRAL_R38,
  SPIRAL_R30,
  LEFT_ONLY,
  RING_TAPS,
  RIM_SPILL,
  SINGLE_TAP,
} as const;
