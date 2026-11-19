/**
 * Topping Visuals 2.0 / Issue #825 (Owner: parmigiano SPRINKLE Pilot): the layout of ONE placed parmigiano piece as a sprinkle of shaved flakes -- a mix of broad
 * flakes, long thin ribbons and small crumbs, spread EVENLY but irregularly over a wide field around the tap point (no ring, no tight lumps, no two taps alike).
 *
 * VISUAL ONLY. One tap is still ONE piece (one `PLACE_TOPPING`, one topping record, one count for the recipe, one unit of stock, one Undo step, nothing in the save);
 * this module only decides how that single piece is drawn. It is a pure, deterministic function of the piece's id (no randomness at render time), so the sprinkle is
 * the same on the pizza, after the bake, in the CUT halves and in RESULT.
 *
 * How the spread is made (Owner HV on ddc2413: the shavings gathered in a few local lumps): a randomly rotated, randomly offset lattice laid over the field, each point
 * jittered, a random subset kept -- an even, blue-noise-like scatter, unlike plain random darts, which clump.
 *
 * No import from the game's logic / state: the two pizza constants below are copies, pinned to their source by a test.
 */
import type { ParmigianoShaving } from "./parmigianoShavingsData";

/** The placed box of one sprinkle, in CSS px (the wrapper's `--cheese-glyph-size`), and its share of the dough's width (about; the dough is 290..345px wide on the phones). */
export const SPRINKLE_BOX_PX = 96;
export const SPRINKLE_BOX_PCT = 32;
/** Copies of DOUGH_CENTER and DOUGH_RADIUS from the pizza coordinates module, pinned to it by a test. */
export const SPRINKLE_DOUGH_CENTER = 50;
export const SPRINKLE_DOUGH_RADIUS = 48;
/** The inner rotation of the placed wrapper (`.pizza-cheese--parmigiano` rotates by this many degrees); the rim shift is counter-rotated by it. */
export const SPRINKLE_WRAPPER_ROTATION_DEG = -18;

/** Where the shaving centres may fall (viewBox units around (32, 32)); the longest shaving reaches `SPRINKLE_SHAVING_REACH` further. */
export const SPRINKLE_FIELD_RADIUS = 24;
export const SPRINKLE_SHAVING_REACH = 11;
const VIEWBOX_CENTER = 32;
/** How far (units) the field may be pulled inward at the rim. */
export const SPRINKLE_MAX_SHIFT = 40;

export interface SprinkleLayout {
  readonly shavings: readonly ParmigianoShaving[];
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

/** Fisher-Yates with the seeded generator. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Centres: a rotated, offset, jittered lattice over the field (even spread), topped up by a few spaced random points if the lattice came up short. */
function spreadCentres(rand: () => number, wanted: number): { x: number; y: number }[] {
  const pitch = 11 + rand() * 2;
  const phi = rand() * Math.PI;
  const offX = (rand() - 0.5) * pitch;
  const offY = (rand() - 0.5) * pitch;
  const u = { x: Math.cos(phi), y: Math.sin(phi) };
  const v = { x: -Math.sin(phi), y: Math.cos(phi) };
  const points: { x: number; y: number }[] = [];
  for (let i = -5; i <= 5; i += 1) {
    for (let j = -5; j <= 5; j += 1) {
      const gx = (i * pitch + offX) * u.x + (j * pitch + offY) * v.x;
      const gy = (i * pitch + offX) * u.y + (j * pitch + offY) * v.y;
      if (Math.hypot(gx, gy) > SPRINKLE_FIELD_RADIUS) continue;
      let x = gx + (rand() - 0.5) * pitch * 0.6;
      let y = gy + (rand() - 0.5) * pitch * 0.6;
      const distance = Math.hypot(x, y);
      if (distance > SPRINKLE_FIELD_RADIUS) {
        x *= SPRINKLE_FIELD_RADIUS / distance;
        y *= SPRINKLE_FIELD_RADIUS / distance;
      }
      points.push({ x: VIEWBOX_CENTER + x, y: VIEWBOX_CENTER + y });
    }
  }
  shuffle(points, rand);
  for (let attempt = 0; points.length < wanted && attempt < 200; attempt += 1) {
    const radius = SPRINKLE_FIELD_RADIUS * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    const x = VIEWBOX_CENTER + radius * Math.cos(theta);
    const y = VIEWBOX_CENTER + radius * Math.sin(theta);
    if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= 7)) points.push({ x, y });
  }
  return points.slice(0, wanted);
}

/**
 * The shavings of one piece: 9..11 of them -- at least five broad soft flakes, one or two thin strips whose width wanders, two or three crumbs -- of mixed sizes, each
 * turned its own way, over an even irregular spread. Deterministic in `seed`.
 */
export function sprinkleLayout(seed: string): SprinkleLayout {
  const rand = prng(hashSeed(seed));
  const wanted = 9 + Math.floor(rand() * 3);
  const centres = spreadCentres(rand, wanted);
  const ribbons = 1 + Math.floor(rand() * 2);
  const crumbs = 2 + (wanted > 9 ? Math.floor(rand() * 2) : 0);
  const kinds: ParmigianoShaving["kind"][] = centres.map((_, index) => (index < ribbons ? "ribbon" : index < ribbons + crumbs ? "fragment" : "flake"));
  shuffle(kinds, rand);
  // stratified outline strengths, shuffled: every sprinkle holds both faint (thin) and firm edges
  const edges = shuffle(centres.map((_, index) => round(0.35 + 0.65 * ((index + rand()) / centres.length))), rand);
  const shavings: ParmigianoShaving[] = centres.map((c, index) => {
    const kind = kinds[index];
    const fill = Math.min(2, Math.floor(rand() * 3)) as 0 | 1 | 2;
    const angle = Math.round(rand() * 180 - 90);
    const edge = edges[index];
    const core = round(0.45 + rand() * 0.25);
    const verts = (count: number): number[] => Array.from({ length: count }, () => round(0.72 + rand() * 0.5));
    const base = { cx: round(c.x), cy: round(c.y), angle, fill, edge, core };
    if (kind === "ribbon") {
      const len = 12 + rand() * 6;
      return {
        ...base,
        kind,
        len: round(len),
        wid: round(3.4 + rand() * 2.2),
        bend: round((rand() < 0.5 ? -1 : 1) * (0.03 + rand() * 0.08)),
        wobble: round((rand() < 0.5 ? -1 : 1) * (0.015 + rand() * 0.035)),
        profile: Array.from({ length: 10 }, () => round(0.6 + rand() * 0.65)),
        verts: [],
      };
    }
    if (kind === "fragment") {
      const len = 4 + rand() * 2.5;
      return { ...base, kind, len: round(len), wid: round(len * (0.6 + rand() * 0.35)), bend: 0, wobble: 0, profile: [], verts: verts(5) };
    }
    const len = 10.5 + rand() * 6.5;
    return { ...base, kind, len: round(len), wid: round(len * (0.45 + rand() * 0.35)), bend: 0, wobble: 0, profile: [], verts: verts(8) };
  });
  return { shavings };
}

/** How far a sprinkle reaches from its centre, in percent of the dough: the field, one shaving's reach, and a 1.15x margin for RESULT (a smaller dough under pieces that shrink less). */
const REACH_PCT = ((SPRINKLE_FIELD_RADIUS + SPRINKLE_SHAVING_REACH) / 64) * SPRINKLE_BOX_PCT * 1.15;
const UNITS_PER_PCT = 64 / SPRINKLE_BOX_PCT;

/**
 * Pulls the field toward the pizza centre when a tap lands near the rim, so the sprinkle stays on the dough instead of spilling over the crust. The piece's own
 * coordinates (what the game scores) never move; this is only the drawing's offset inside its box. Capped at `SPRINKLE_MAX_SHIFT` units. The box sits inside a wrapper
 * rotated by `rotationDeg`, so the on-screen "toward the centre" vector is turned back by that angle to be expressed in the drawing's own frame.
 */
export function sprinkleShift(xPct: number, yPct: number, rotationDeg: number = SPRINKLE_WRAPPER_ROTATION_DEG): { x: number; y: number } {
  const dx = xPct - SPRINKLE_DOUGH_CENTER;
  const dy = yPct - SPRINKLE_DOUGH_CENTER;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance === 0) return { x: 0, y: 0 };
  const overflow = distance + REACH_PCT - SPRINKLE_DOUGH_RADIUS;
  if (overflow <= 0) return { x: 0, y: 0 };
  const units = Math.min(SPRINKLE_MAX_SHIFT, overflow * UNITS_PER_PCT);
  const screenX = (-dx / distance) * units;
  const screenY = (-dy / distance) * units;
  const back = (-rotationDeg * Math.PI) / 180;
  return { x: round(screenX * Math.cos(back) - screenY * Math.sin(back)), y: round(screenX * Math.sin(back) + screenY * Math.cos(back)) };
}
