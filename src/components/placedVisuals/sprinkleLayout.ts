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
 * Rev. 6 (Owner decision 7010525105, A+B trial; rev. 5 kept in git as 0318d2b9): rev. 5's three taps still read as three lumps because each sprinkle's edge stopped
 * about where the next began. So the field is wider (radius 30 -> 34), a sprinkle holds 11..12 pieces, the density FADES toward the edge (the subset is chosen with a bias
 * for the inner lattice points), and four or five crumbs are thrown out of the outer part, so a lump's border dissolves into its neighbour instead of ending in a line.
 *
 * No import from the game's logic / state: the two pizza constants below are copies, pinned to their source by a test.
 */
import { LOOK_DEFAULT, type ParmigianoShaving, type SprinkleLook } from "./parmigianoShavingsData";

/** The placed box of one sprinkle, in CSS px (the wrapper's `--cheese-glyph-size`), and its share of the dough's width (about; the dough is 290..345px wide on the phones). */
export const SPRINKLE_BOX_PX = 96;
export const SPRINKLE_BOX_PCT = 32;
/** Copies of DOUGH_CENTER and DOUGH_RADIUS from the pizza coordinates module, pinned to it by a test. */
export const SPRINKLE_DOUGH_CENTER = 50;
export const SPRINKLE_DOUGH_RADIUS = 48;
/** The inner rotation of the placed wrapper (`.pizza-cheese--parmigiano` rotates by this many degrees); the rim shift is counter-rotated by it. */
export const SPRINKLE_WRAPPER_ROTATION_DEG = -18;

/** Where the shaving centres may fall (viewBox units around (32, 32)); the longest shaving reaches `SPRINKLE_SHAVING_REACH` further. */
export const SPRINKLE_FIELD_RADIUS = 34;
/** Crumbs are thrown a little further than the shavings (a few strays break the edge of the cloud). */
export const SPRINKLE_STRAY_FACTOR = 1.25;
/** Pieces per sprinkle (rev. 6: 11..12) and how many of them are crumbs (4..5) / thin strips (1..2); the rest are broad flakes (at least five). */
export const SPRINKLE_COUNT_MIN = 11;
export const SPRINKLE_COUNT_MAX = 12;
export const SPRINKLE_CRUMBS_MIN = 4;
export const SPRINKLE_CRUMBS_MAX = 5;
/** How strongly the density fades outward in rev. 6: a lattice point at the field's edge is this many times less likely to be kept than one at the centre (priority = random x (1 + FADE x (r/R)^2)). */
export const SPRINKLE_DENSITY_FADE = 2.2;

/**
 * Rev. 7 comparison trial (Owner 7029069474, branch only -- NOT adopted, A+C NOT approved): the two knobs are compared ONE AT A TIME against rev. 6, everything else fixed
 * (radius 34, 11..12 pieces, 4..5 crumbs, rim cap 44, positions of all pieces' random draws).
 *   rev6  the shipped rev. 6 drawing (the default; its output is pinned bit-identical by a test).
 *   v7a   crumbs only: a narrower width/length ratio and a more irregular 7-corner outline, so a crumb reads as a small thin shaving rather than a round grain.
 *         Every position, size, angle, kind and every non-crumb piece is identical to rev. 6 (the extra outline comes from its own random stream).
 *   v7c   outer density only: a gentler fade (0.9 instead of 2.2), so the outer part of one sprinkle holds more pieces and neighbouring taps connect. (REJECTED by the Owner.)
 *
 * V8-1 single trial (Owner, this session; branch only -- NOT adopted): `v81` changes ONE knob, which pieces become crumbs. Rev. 6 draws the 4..5 crumbs from the outer 60% of the
 * centres, so 87% of the pieces that reach a neighbouring tap are tiny crumbs and the big flakes stay inside; `v81` draws them from ALL centres. The centres, the piece count (11..12),
 * the crumb count (4..5), the field radius (34), the density fade (2.2), the crumb shape and the rim cap (44) are all rev. 6's. Only the assignment of kinds to centres changes
 * (and, because kinds draw different numbers of random values, the sizes and angles of the pieces that follow differ -- so v81 is compared statistically over many ids, not per id).
 *
 * V9 single-knob shape trials (Owner V9-1, branch only -- NOT adopted, none combined): each starts from V8-1 (`v81`) and changes ONE thing.
 *   f2  texture only: a lighter fill (0.6 instead of 0.8), half the outline and shadow, no core and no grain line -- the cues that make a flat flake read as a thick slab. The LAYOUT is
 *       bit-identical to v81 (the look is painted by the component, it is not in the layout).
 *   f1  size only: flakes and strips are 0.75 x as long (and as wide); centres, kinds, angles and crumbs are v81's.
 *   f3  flake aspect only: flake width / length 0.28..0.55 instead of 0.38..0.80; everything else is v81's.
 */
export interface SprinkleVariant {
  readonly name: "rev6" | "v7a" | "v7c" | "v81" | "f1" | "f2" | "f3";
  readonly densityFade: number;
  /** Crumb width / length ratio range: the rev. 6 raw draw u in [0,1) maps to `min + u * (max - min)` (rev. 6: 0.60..0.95). */
  readonly crumbRatio: readonly [number, number];
  /** Crumb outline corners: 5 = the rev. 6 draws; more = a separate random stream seeded by the piece id. */
  readonly crumbVerts: number;
  /** Which centres may become crumbs: `outer60` = the outer 60% by distance (rev. 6); `all` = every centre (V8-1). */
  readonly crumbPool: "outer60" | "all";
  /** Flake width / length = `flakeRatioMin + draw * flakeRatioSpan` (rev. 6 / V8-1: 0.38 + 0.42, i.e. 0.38..0.80). */
  readonly flakeRatioMin: number;
  readonly flakeRatioSpan: number;
  /** Multiplies the length and width of flakes and strips after they are drawn (1 = rev. 6 / V8-1). Crumbs are not scaled. */
  readonly sizeScale: number;
  /** How the shavings are painted (not part of the layout). */
  readonly look: SprinkleLook;
}
const SHAPE_DEFAULTS = { flakeRatioMin: 0.38, flakeRatioSpan: 0.42, sizeScale: 1, look: LOOK_DEFAULT } as const;
const V81_BASE = { densityFade: SPRINKLE_DENSITY_FADE, crumbRatio: [0.6, 0.95], crumbVerts: 5, crumbPool: "all", ...SHAPE_DEFAULTS } as const;
export const SPRINKLE_VARIANTS: {
  readonly rev6: SprinkleVariant;
  readonly v7a: SprinkleVariant;
  readonly v7c: SprinkleVariant;
  readonly v81: SprinkleVariant;
  readonly f1: SprinkleVariant;
  readonly f2: SprinkleVariant;
  readonly f3: SprinkleVariant;
} = {
  rev6: { name: "rev6", densityFade: SPRINKLE_DENSITY_FADE, crumbRatio: [0.6, 0.95], crumbVerts: 5, crumbPool: "outer60", ...SHAPE_DEFAULTS },
  v7a: { name: "v7a", densityFade: SPRINKLE_DENSITY_FADE, crumbRatio: [0.36, 0.56], crumbVerts: 7, crumbPool: "outer60", ...SHAPE_DEFAULTS },
  v7c: { name: "v7c", densityFade: 0.9, crumbRatio: [0.6, 0.95], crumbVerts: 5, crumbPool: "outer60", ...SHAPE_DEFAULTS },
  v81: { name: "v81", ...V81_BASE },
  f1: { ...V81_BASE, name: "f1", sizeScale: 0.75 },
  f2: { ...V81_BASE, name: "f2", look: { fillOpacity: 0.6, outlineScale: 0.5, shadowScale: 0.5, core: false, grain: false } },
  f3: { ...V81_BASE, name: "f3", flakeRatioMin: 0.28, flakeRatioSpan: 0.27 },
};
/** The variant the game draws. Stays `rev6` on this branch: the comparison builds flip this one constant (see the V7 Result). */
export const SPRINKLE_ACTIVE_VARIANT: SprinkleVariant["name"] = "rev6";
export const SPRINKLE_SHAVING_REACH = 11;
const VIEWBOX_CENTER = 32;
/** How far (units) the field may be pulled inward at the rim. 44 units = about 66 CSS px in the 96px box. A cap of 52 (about 78px) was compared (rev. 6, Owner Y2: NOT adopted); pass it as `maxShift`. */
export const SPRINKLE_MAX_SHIFT = 44;

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
function spreadCentres(rand: () => number, wanted: number, densityFade: number): { x: number; y: number }[] {
  const pitch = 15 + rand() * 2;
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
  // density fade: each point gets a random priority that grows with its radius, and the best (smallest) ones are kept -- inner points survive more often than outer ones
  const prioritised = points.map((p) => ({ p, key: rand() * (1 + densityFade * (Math.hypot(p.x - VIEWBOX_CENTER, p.y - VIEWBOX_CENTER) / SPRINKLE_FIELD_RADIUS) ** 2) }));
  prioritised.sort((a, b) => a.key - b.key);
  points.length = 0;
  for (const { p } of prioritised) points.push(p);
  for (let attempt = 0; points.length < wanted && attempt < 200; attempt += 1) {
    const radius = SPRINKLE_FIELD_RADIUS * 0.85 * Math.sqrt(rand());
    const theta = rand() * Math.PI * 2;
    const x = VIEWBOX_CENTER + radius * Math.cos(theta);
    const y = VIEWBOX_CENTER + radius * Math.sin(theta);
    if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= 9)) points.push({ x, y });
  }
  return points.slice(0, wanted);
}

/**
 * The shavings of one piece: 11..12 of them -- at least five broad soft flakes, one or two thin strips whose width wanders, four or five crumbs thrown from the outer part --
 * of mixed sizes, each turned its own way, over an even irregular spread that thins toward the edge. Deterministic in `seed`.
 */
export function sprinkleLayout(seed: string, variant: SprinkleVariant = SPRINKLE_VARIANTS[SPRINKLE_ACTIVE_VARIANT]): SprinkleLayout {
  const rand = prng(hashSeed(seed));
  const wanted = SPRINKLE_COUNT_MIN + Math.floor(rand() * (SPRINKLE_COUNT_MAX - SPRINKLE_COUNT_MIN + 1));
  const centres = spreadCentres(rand, wanted, variant.densityFade);
  const crumbs = SPRINKLE_CRUMBS_MIN + Math.floor(rand() * (SPRINKLE_CRUMBS_MAX - SPRINKLE_CRUMBS_MIN + 1));
  // one or two strips, but always at least five broad flakes (11 pieces with five crumbs leave room for one strip only)
  const ribbons = Math.min(1 + Math.floor(rand() * 2), wanted - crumbs - 5);
  // the crumbs are the strays: rev. 6 draws them from the outer 60% of the centres (by distance), V8-1 from all of them; the strips and flakes fill the rest
  const byOuter = centres.map((_, index) => index).sort((a, b) => Math.hypot(centres[b].x - VIEWBOX_CENTER, centres[b].y - VIEWBOX_CENTER) - Math.hypot(centres[a].x - VIEWBOX_CENTER, centres[a].y - VIEWBOX_CENTER));
  const outerPick = shuffle(byOuter.slice(0, Math.ceil(centres.length * 0.6)), rand).slice(0, crumbs); // always drawn, so the main random stream is identical for every variant
  let crumbIndexes = new Set(outerPick);
  if (variant.crumbPool === "all") {
    // V8-1: any centre may be a crumb. Its own random stream (seeded by the piece id), so no main-stream draw changes.
    crumbIndexes = new Set(shuffle(centres.map((_, index) => index), prng(hashSeed(`${seed}|crumbpool`))).slice(0, crumbs));
  }
  const rest = shuffle(centres.map((_, index) => index).filter((index) => !crumbIndexes.has(index)), rand);
  const ribbonIndexes = new Set(rest.slice(0, ribbons));
  const kinds: ParmigianoShaving["kind"][] = centres.map((_, index) => (crumbIndexes.has(index) ? "fragment" : ribbonIndexes.has(index) ? "ribbon" : "flake"));
  // stratified outline strengths, shuffled: every sprinkle holds both faint (thin) and firm edges
  const edges = shuffle(centres.map((_, index) => round(0.35 + 0.65 * ((index + rand()) / centres.length))), rand);
  const shavings: ParmigianoShaving[] = centres.map((c, index) => {
    const kind = kinds[index];
    const fill = Math.min(2, Math.floor(rand() * 3)) as 0 | 1 | 2;
    const angle = Math.round(rand() * 180 - 90);
    const edge = edges[index];
    const core = round(0.45 + rand() * 0.25);
    const verts = (count: number): number[] => Array.from({ length: count }, () => round(0.7 + rand() * 0.6));
    const stray = kind === "fragment" ? SPRINKLE_STRAY_FACTOR : 1;
    const base = { cx: round(VIEWBOX_CENTER + (c.x - VIEWBOX_CENTER) * stray), cy: round(VIEWBOX_CENTER + (c.y - VIEWBOX_CENTER) * stray), angle, fill, edge, core };
    if (kind === "ribbon") {
      const len = 12 + rand() * 6;
      return {
        ...base,
        kind,
        len: round(len * variant.sizeScale),
        wid: round((3.4 + rand() * 2.2) * variant.sizeScale),
        bend: round((rand() < 0.5 ? -1 : 1) * (0.03 + rand() * 0.08)),
        wobble: round((rand() < 0.5 ? -1 : 1) * (0.015 + rand() * 0.035)),
        profile: Array.from({ length: 10 }, () => round(0.6 + rand() * 0.65)),
        verts: [],
      };
    }
    if (kind === "fragment") {
      const len = 4 + rand() * 2.5;
      const ratioDraw = rand();
      const mainVerts = verts(5); // always drawn, so the main random stream (and every later piece) is identical for every variant
      const [ratioMin, ratioMax] = variant.crumbRatio;
      let outline = mainVerts;
      if (variant.crumbVerts !== 5) {
        const own = prng(hashSeed(`${seed}|crumb|${index}`));
        // 0.7..1.3 like the flakes: with a wider range the angular nudge of flakePath (1.6 x deviation) can pass the next corner and the outline crosses itself; here the difference stays above 0.04 corner steps
        outline = Array.from({ length: variant.crumbVerts }, () => round(0.7 + own() * 0.6));
      }
      return { ...base, kind, len: round(len), wid: round(len * (ratioMin + ratioDraw * (ratioMax - ratioMin))), bend: 0, wobble: 0, profile: [], verts: outline };
    }
    const len = 10.5 + rand() * 6.5;
    const flakeRatioDraw = rand();
    return {
      ...base,
      kind,
      len: round(len * variant.sizeScale),
      wid: round(len * variant.sizeScale * (variant.flakeRatioMin + flakeRatioDraw * variant.flakeRatioSpan)),
      bend: 0,
      wobble: 0,
      profile: [],
      verts: verts(9),
    };
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
export function sprinkleShift(
  xPct: number,
  yPct: number,
  rotationDeg: number = SPRINKLE_WRAPPER_ROTATION_DEG,
  maxShift: number = SPRINKLE_MAX_SHIFT,
): { x: number; y: number } {
  const dx = xPct - SPRINKLE_DOUGH_CENTER;
  const dy = yPct - SPRINKLE_DOUGH_CENTER;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance === 0) return { x: 0, y: 0 };
  const overflow = distance + REACH_PCT - SPRINKLE_DOUGH_RADIUS;
  if (overflow <= 0) return { x: 0, y: 0 };
  const units = Math.min(maxShift, overflow * UNITS_PER_PCT);
  const screenX = (-dx / distance) * units;
  const screenY = (-dy / distance) * units;
  const back = (-rotationDeg * Math.PI) / 180;
  return { x: round(screenX * Math.cos(back) - screenY * Math.sin(back)), y: round(screenX * Math.sin(back) + screenY * Math.cos(back)) };
}
