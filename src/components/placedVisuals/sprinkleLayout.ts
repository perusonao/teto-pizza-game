/**
 * Topping Visuals 2.0 / Issue #825 (Owner: parmigiano SPRINKLE Pilot): the layout of ONE placed parmigiano piece as a sprinkle -- ten to fourteen thin shavings
 * scattered irregularly over a wide field around the tap point, each with its own position, direction and size, so three taps never look like the same stamp
 * (the Owner's iPhone HV on 8dfb99e: three identical ring-shaped patterns).
 *
 * VISUAL ONLY. One tap is still ONE piece (one `PLACE_TOPPING`, one topping record, one count for the recipe, one unit of stock, one Undo step, nothing in the save);
 * this module only decides how that single piece is drawn. It is a pure, deterministic function of the piece's id (no randomness at render time), so the sprinkle is
 * the same on the pizza, after the bake, in the CUT halves and in RESULT.
 *
 * No import from the game's logic / state: the two pizza constants below are copies, pinned to their source by a test.
 */
import type { ParmigianoChip, ParmigianoShaving } from "./parmigianoShavingsData";

/** The placed box of one sprinkle, in CSS px (the wrapper's `--cheese-glyph-size`), and its share of the dough's width (about; the dough is 290..345px wide on the phones). */
export const SPRINKLE_BOX_PX = 60;
export const SPRINKLE_BOX_PCT = 20;
/** Copies of DOUGH_CENTER and DOUGH_RADIUS from the pizza coordinates module, pinned to it by a test. */
export const SPRINKLE_DOUGH_CENTER = 50;
export const SPRINKLE_DOUGH_RADIUS = 48;

/** Where the shaving centres may fall (viewBox units around (32, 32)); a shaving reaches at most 7.5 further. */
export const SPRINKLE_FIELD_RADIUS = 23;
const MIN_SEPARATION = 6.2;
const VIEWBOX_CENTER = 32;
/** How far (units) the field may be pulled inward at the rim. */
export const SPRINKLE_MAX_SHIFT = 18;

export interface SprinkleLayout {
  readonly shavings: readonly ParmigianoShaving[];
  readonly chips: readonly ParmigianoChip[];
}

/** 32-bit FNV-1a. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small deterministic PRNG returning [0, 1). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Uniform in the disc (not a ring), then thinned by dart throwing so no two shaving centres sit closer than `MIN_SEPARATION`. */
export function sprinkleLayout(seed: string): SprinkleLayout {
  const rand = prng(hashSeed(seed));
  const count = 10 + Math.floor(rand() * 5);
  const centres: { x: number; y: number }[] = [];
  for (let n = 0; n < count; n += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt += 1) {
      const radius = SPRINKLE_FIELD_RADIUS * Math.sqrt(rand());
      const theta = rand() * Math.PI * 2;
      const x = VIEWBOX_CENTER + radius * Math.cos(theta);
      const y = VIEWBOX_CENTER + radius * Math.sin(theta);
      if (centres.every((c) => Math.hypot(c.x - x, c.y - y) >= MIN_SEPARATION)) {
        centres.push({ x, y });
        placed = true;
      }
    }
  }
  const shavings: ParmigianoShaving[] = centres.map((c) => {
    const len = 6 + Math.pow(rand(), 1.4) * 9;
    return {
      cx: round(c.x),
      cy: round(c.y),
      len: round(len),
      half: round(len * (0.09 + 0.06 * rand())),
      angle: Math.round(rand() * 180 - 90),
      fill: Math.min(2, Math.floor(rand() * 3)) as 0 | 1 | 2,
      skew: round(rand() * 2 - 1),
    };
  });
  const chips: ParmigianoChip[] = [];
  const chipCount = 3 + Math.floor(rand() * 3);
  for (let n = 0; n < chipCount; n += 1) {
    const radius = (SPRINKLE_FIELD_RADIUS + 5) * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    chips.push({
      cx: round(VIEWBOX_CENTER + radius * Math.cos(theta)),
      cy: round(VIEWBOX_CENTER + radius * Math.sin(theta)),
      size: round(1.8 + rand() * 1.4),
      angle: Math.round(rand() * 180 - 90),
    });
  }
  return { shavings, chips };
}

/** How far a sprinkle reaches from its centre, in percent of the dough: the field, one shaving's reach, and a 1.3x margin for RESULT (a smaller dough under pieces that shrink less). */
const REACH_PCT = ((SPRINKLE_FIELD_RADIUS + 9) / 64) * SPRINKLE_BOX_PCT * 1.3;
const UNITS_PER_PCT = 64 / SPRINKLE_BOX_PCT;

/**
 * Pulls the field toward the pizza centre when a tap lands near the rim, so the sprinkle stays on the dough instead of spilling over the crust. The piece's own
 * coordinates (what the game scores) never move; this is only the drawing's offset inside its box. Capped at `SPRINKLE_MAX_SHIFT` units.
 */
export function sprinkleShift(xPct: number, yPct: number): { x: number; y: number } {
  const dx = xPct - SPRINKLE_DOUGH_CENTER;
  const dy = yPct - SPRINKLE_DOUGH_CENTER;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance === 0) return { x: 0, y: 0 };
  const overflow = distance + REACH_PCT - SPRINKLE_DOUGH_RADIUS;
  if (overflow <= 0) return { x: 0, y: 0 };
  const units = Math.min(SPRINKLE_MAX_SHIFT, overflow * UNITS_PER_PCT);
  return { x: round((-dx / distance) * units), y: round((-dy / distance) * units) };
}
