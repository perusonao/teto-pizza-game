/**
 * M3A Bake Judgment: continuous bake *visuals*, kept deliberately separate from
 * `./bake.ts`'s `classifyBake` (the scoring/dialogue truth -- see that file and
 * `./scoringV2/bakeComponent.ts`, both untouched by this module).
 *
 * Fresh Audit finding (docs/reports/TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md section 4): before
 * this module existed, PizzaStage derived every bake visual (dough color, cheese melt/toast/
 * char, char spots, smoke) from `classifyBake`'s own 3-bucket raw/perfect/burnt split -- the
 * exact same boundary Scoring 2.0 grades against. A CSS `background` (radial-gradient) cannot
 * be transitioned by the browser, so the dough's color visibly *snapped* the instant the
 * needle crossed `recipe.bakeTarget.start`/`.end`, i.e. exactly the moment BAKE's target zone
 * becomes true -- an unintentional "answer reveal" wherever the Guide (BakeOverlay) is hidden
 * or faded (Phase 1). `computeBakeHeat` below replaces that jump with a single continuous
 * scalar with no seam at `start`/`end`, so nothing about the pizza's rendered doneness can
 * snap at the scoring boundary; `PizzaStage` consumes it to compute every visual continuously,
 * every animation frame.
 */
import type { BakeTarget } from "../data/recipes";
import { clamp01 } from "./referenceMatching";

/**
 * Continuous "doneness" scalar: 0 at `progress` = 0, exactly 1 at the recipe's own target
 * center `(start + end) / 2`, 2 at `progress` = 100. Piecewise-linear around the center, so it
 * passes *through* the scoring target zone smoothly (the zone straddles heat = 1, not a single
 * point) -- there is no `progress` value anywhere in [0, 100] where this jumps, unlike
 * `classifyBake`'s discrete raw/perfect/burnt split.
 */
export function computeBakeHeat(progress: number, target: BakeTarget): number {
  const clamped = Math.min(100, Math.max(0, progress));
  const center = (target.start + target.end) / 2;
  if (clamped <= center) {
    return center > 0 ? clamped / center : 0;
  }
  const upperSpan = 100 - center;
  return upperSpan > 0 ? 1 + (clamped - center) / upperSpan : 2;
}

/** 0..1, ramps through "melting" into "good" then holds -- cheese reads as melted well before
 *  the pizza is actually done, never an on/off switch at a fixed instant. */
export function meltIntensity(heat: number): number {
  return clamp01((heat - 0.5) / 0.4);
}

/** #421 motion prototype: 0..1 "the lump tightens" ramp (smaller, thicker) over the heat (0.1 - 0.5) before `meltIntensity` starts at 0.5. */
export function puffIntensity(heat: number): number {
  const t = clamp01((heat - 0.1) / 0.4);
  return t * t * (3 - 2 * t);
}

/** 0..1 golden-toast strength, ramping through "good"/"browningDeep". */
export function toastIntensity(heat: number): number {
  return clamp01((heat - 0.85) / 0.5);
}

/** 0..1 char/burn strength -- stays 0 through "browningDeep", ramping only once heat pushes
 *  into the "charred" tail, so char spots/smoke fade in instead of popping in at full opacity
 *  the instant `classifyBake` would call it "burnt". */
export function charIntensity(heat: number): number {
  return clamp01((heat - 1.6) / 0.4);
}

/** 0..1 fade-out for the early "raw sheen" highlight -- gone by the time cheese starts to melt. */
export function rawSheenIntensity(heat: number): number {
  return clamp01(1 - heat);
}

export type BakeVisualStage =
  | "raw"
  | "heating"
  | "melting"
  | "browningLight"
  | "good"
  | "browningDeep"
  | "charred";

const STAGE_THRESHOLDS: ReadonlyArray<{ stage: BakeVisualStage; upTo: number }> = [
  { stage: "raw", upTo: 0.3 },
  { stage: "heating", upTo: 0.58 },
  { stage: "melting", upTo: 0.82 },
  { stage: "browningLight", upTo: 0.92 },
  { stage: "good", upTo: 1.28 },
  { stage: "browningDeep", upTo: 1.6 },
  { stage: "charred", upTo: Infinity },
];

/** Label-only bucketing of the same continuous `heat` scalar -- for diagnostics/tests/copy,
 *  never for driving a CSS class swap on its own (that would just reintroduce the same snap
 *  `computeBakeHeat`'s doc comment above describes; every real visual reads `heat` directly). */
export function bakeVisualStage(heat: number): BakeVisualStage {
  for (const { stage, upTo } of STAGE_THRESHOLDS) {
    if (heat <= upTo) return stage;
  }
  return "charred";
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RgbColor {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function rgbToCss({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Two-segment RGB lerp across the same 3 keyframe colors the old raw/perfect/burnt CSS
 *  classes used (App.css's `.pizza-dough--raw/--perfect/--burnt .pizza-dough-shape`), so
 *  `heat` = 0/1/2 reproduce those exact tones and everything between is a genuine blend
 *  instead of a hard cut. */
function lerpDoughColor(heat: number, raw: string, good: string, burnt: string): string {
  const t = Math.min(2, Math.max(0, heat));
  const from = t <= 1 ? hexToRgb(raw) : hexToRgb(good);
  const to = t <= 1 ? hexToRgb(good) : hexToRgb(burnt);
  const segmentT = t <= 1 ? t : t - 1;
  return rgbToCss({
    r: lerpChannel(from.r, to.r, segmentT),
    g: lerpChannel(from.g, to.g, segmentT),
    b: lerpChannel(from.b, to.b, segmentT),
  });
}

export interface DoughVisualColors {
  colorA: string;
  colorB: string;
}

/** The dough-shape layer's two radial-gradient stops, continuously blended -- see this
 *  module's own file header for why this replaces the old class-based background swap. */
export function doughVisualColors(heat: number): DoughVisualColors {
  return {
    colorA: lerpDoughColor(heat, "#faf1dc", "#eec27a", "#8f6236"),
    colorB: lerpDoughColor(heat, "#f0e2bc", "#c9863c", "#4d2f16"),
  };
}

interface CheeseVisualFrame {
  heat: number;
  scale: number;
  brightness: number;
  saturate: number;
  sepia: number;
}

/** Anchor frames matching the old discrete cheese rules exactly at heat 0 (raw, no melt
 *  class), 1 (perfect -- "melted toasted"), 2 (burnt -- "charred"), with 2 extra points
 *  ("melting" / "browningDeep") filling in the widened Phase 2 taxonomy so cheese reads as
 *  melting, then toasting, then charring rather than jumping between 3 fixed looks. */
const CHEESE_FRAMES: readonly CheeseVisualFrame[] = [
  { heat: 0, scale: 1, brightness: 1, saturate: 1, sepia: 0 },
  { heat: 0.6, scale: 1.06, brightness: 1.02, saturate: 1.02, sepia: 0 },
  { heat: 1.0, scale: 1.16, brightness: 1.06, saturate: 1.12, sepia: 0.14 },
  { heat: 1.6, scale: 1.16, brightness: 0.85, saturate: 0.95, sepia: 0.2 },
  { heat: 2.0, scale: 1.16, brightness: 0.6, saturate: 0.75, sepia: 0.25 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolates `CHEESE_FRAMES` at `heat` -- piecewise-linear across the table, clamped to its
 *  first/last frame outside [0, 2] (heat itself is already clamped by `computeBakeHeat`). */
export function cheeseVisualFrame(heat: number): Omit<CheeseVisualFrame, "heat"> {
  const clamped = Math.min(2, Math.max(0, heat));
  for (let i = 0; i < CHEESE_FRAMES.length - 1; i += 1) {
    const from = CHEESE_FRAMES[i];
    const to = CHEESE_FRAMES[i + 1];
    if (clamped >= from.heat && clamped <= to.heat) {
      const span = to.heat - from.heat;
      const t = span > 0 ? (clamped - from.heat) / span : 0;
      return {
        scale: lerp(from.scale, to.scale, t),
        brightness: lerp(from.brightness, to.brightness, t),
        saturate: lerp(from.saturate, to.saturate, t),
        sepia: lerp(from.sepia, to.sepia, t),
      };
    }
  }
  const last = CHEESE_FRAMES[CHEESE_FRAMES.length - 1];
  return { scale: last.scale, brightness: last.brightness, saturate: last.saturate, sepia: last.sepia };
}

/**
 * Issue #421 (Finished Pizza Appetite Appeal, Pilot): the three 0..1 scalars a cheese's *shape-level* melt look reads.
 * Nothing new is decided here -- they are the existing `meltIntensity` / `toastIntensity` / `charIntensity` of the same
 * continuous `heat` (so there is still exactly one doneness authority, and a value of 0 across the board is the raw cheese
 * every non-bake context already draws).
 */
export interface CheeseMeltLook {
  /** 0 raw lump -> 1 fully melted (soft irregular outline, spread, gloss). */
  melt: number;
  /** 0 -> 1 local golden browning spots. */
  toast: number;
  /** 0 -> 1 the browning spots turn dark brown (overbaked). */
  char: number;
}

export function cheeseMeltLook(heat: number): CheeseMeltLook {
  return { melt: meltIntensity(heat), toast: toastIntensity(heat), char: charIntensity(heat) };
}

/**
 * Cheeses that get the shape-level melt (Issue #421 Pilot: mozzarella only). Opt-in by ingredient id, so every other cheese
 * keeps its scale-only look and receives none of the variables below. To add a cheese: add its id here AND give its
 * `.pizza-cheese--<id>` CSS rule (src/App.css) the same `var(--bake-cheese-*)` reads as `.pizza-cheese--mozzarella`.
 */
export const MELT_SHAPE_CHEESE_IDS: ReadonlySet<string> = new Set(["mozzarella"]);

export function cheeseMeltsShape(ingredientId: string): boolean {
  return MELT_SHAPE_CHEESE_IDS.has(ingredientId);
}

/** Browning spot colour at char 0 (golden) and char 1 (dark brown), as the spot is *drawn on the cheese element*: the
 *  cheese's own bake `filter` (`cheeseVisualFrame`: brightness 0.6 / saturate 0.75 / sepia 0.25 at heat 2) then darkens it
 *  once more, so the char end is a mid brown that lands on dark brown on screen, never a grey. */
const SPOT_GOLDEN = [190, 146, 90] as const;
const SPOT_CHARRED = [124, 68, 28] as const;

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(a).toFixed(3)})`;
}

/**
 * #421 A4: a deterministic per-piece variation, so three mozzarella pieces on one pizza are not the same disc with the same
 * pattern. Same key -> same values on every render (no Math.random, nothing that changes frame to frame or between the
 * BAKE / CUT / RESULT copies of a piece). The key is the piece's own ingredient id + placement, exactly what
 * `stablePieceRotation` (../logic/pieceDrag.ts) hashes. Returns `count` numbers in [-1, 1].
 */
export function cheeseMeltJitter(key: string, count: number): number[] {
  let state = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    state ^= key.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    // xorshift32: a few cheap, well-spread values from the one hash
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out.push((state / 0xffffffff) * 2 - 1);
  }
  return out;
}

/**
 * #421 motion prototype: the shape change is carried by TIME, not by a blurred outline. Only transform scales / skew (cheap, no
 * extra blur or raster), so there are no spread lobes any more. The choreography is in `cheeseMeltCssVars`.
 */
const SETTLED_SPREAD_X = 0.24;
const SETTLED_SPREAD_Y = -0.155;
const PUFF_X = -0.1;
const PUFF_Y = 0.12;
const OVERSHOOT_X = 0.07;
const OVERSHOOT_Y = -0.05;
const SETTLED_SKEW_DEG = 10;
const WOBBLE_SKEW_DEG = 4;

/**
 * #421 Proto4 (reference-photo observations: irregular white pools, thick creamy centres, thin translucent edges against the sauce, a
 * few amber spots, near-touching neighbours). The shape comes from GRADIENTS only (no blur, no pseudo-element, no extra DOM): once the
 * lump has melted, the element's box is enlarged by a transparent border (`--bake-cheese-pad`, with an equal negative margin so the
 * layout never moves) and 2-3 feathered elliptical "lobes" are painted into that room, each in its own direction, reach and size, with
 * a thick-to-thin alpha ramp. The union of the core and the lobes is the irregular puddle; the tips are thin film.
 */
const CORE_W = 28;
const CORE_H = 23;
const PAD_MAX = 7;
/** melt level at which the pad (and so the lobes) starts, and at which the raw lump / ring / drop shadow are gone. */
const LOBE_START = 0.5;
/** conservative CSS px per % of dough (360 px-wide phones: 260.8 px interior); used only to keep neighbours from merging. */
const DOUGH_PX_PER_PCT = 2.6;
const SETTLED_SCALE_X = 1.16 * (1 + SETTLED_SPREAD_X);
const SETTLED_SCALE_Y = 1.16 * (1 + SETTLED_SPREAD_Y);
const MIN_NEIGHBOUR_GAP_PX = 3;
/** Proto4b: at most this many lobes per piece (3 -> 2 removes one gradient layer; both were compared). */
const LOBES_MAX = 2;

/** Where the nearest other piece of the same cheese is, in the dough's own frame (angle: radians, y down; gapPx: centre distance in px). */
export interface CheeseNeighbour {
  angle: number;
  distancePx: number;
}

/** The nearest other piece (by centre) among `others`, or null when there is none (or it is far away: no interaction beyond 70 px). */
export function nearestCheeseNeighbour(self: { x: number; y: number }, others: ReadonlyArray<{ x: number; y: number }>): CheeseNeighbour | null {
  let best: CheeseNeighbour | null = null;
  for (const o of others) {
    const dx = (o.x - self.x) * DOUGH_PX_PER_PCT;
    const dy = (o.y - self.y) * DOUGH_PX_PER_PCT;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    if (best === null || d < best.distancePx) best = { angle: Math.atan2(dy, dx), distancePx: d };
  }
  return best !== null && best.distancePx <= 70 ? best : null;
}

function polarRadius(a: number, b: number, theta: number): number {
  return (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
}

/** Lobe film colours: creamy white, a little golden while toasting, brown when charred (the same drift as the browning blotches). */
const LOBE_CREAM_A = [240, 233, 216] as const;
const LOBE_CREAM_B = [236, 226, 204] as const;
const LOBE_TOASTED = [222, 190, 140] as const;
const LOBE_CHARRED = [132, 96, 64] as const;

function lobeRgb(cream: readonly number[], toast: number, char: number): [number, number, number] {
  const out: number[] = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    const toasted = cream[i] + (LOBE_TOASTED[i] - cream[i]) * 0.5 * toast;
    out[i] = toasted + (LOBE_CHARRED[i] - toasted) * char;
  }
  return out as [number, number, number];
}

/** The four browning blotches: A3's centre / radii (the fallback the stylesheet carries) plus how far each may drift. */
const SPOTS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 27, y: 34, rx: 3.6, ry: 2.3 },
  { x: 64, y: 25, rx: 2, ry: 2.8 },
  { x: 73, y: 63, rx: 3.2, ry: 2.6 },
  { x: 40, y: 74, rx: 2.6, ry: 1.5 },
];

function clampRange(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** One lobe: an elliptical feathered pool in the (possibly enlarged) box, in px. */
export interface CheeseLobe {
  rx: number;
  ry: number;
  x: number;
  y: number;
  alpha: number;
  warm: boolean;
}

export interface CheeseMeltLobes {
  /** transparent border (px per side) that gives the lobes room; 0 until the second half of the melt */
  pad: number;
  lobes: CheeseLobe[];
  /** local amber blush at the first lobe's tip (null when there is no lobe) */
  amber: { rx: number; ry: number; x: number; y: number } | null;
  /** 0 -> 1 as the lobes come in */
  strength: number;
}

/**
 * Proto4: the irregular pools around the thick core. 1 to `LOBES_MAX` lobes per piece, each with its own direction (a per-piece twist; the
 * first one aims at the nearest neighbour, its reach limited so close pieces keep a gap), size, reach (short: a lobe is a pool, not a wing)
 * and strength. Pure function of the melt, the piece key and the neighbour; `j` is the piece's jitter (recomputed when absent).
 */
export function cheeseMeltLobes(look: CheeseMeltLook, seedKey?: string, neighbour?: CheeseNeighbour | null, jitter?: number[]): CheeseMeltLobes {
  const { melt } = look;
  const j = jitter ?? (seedKey === undefined ? new Array<number>(48).fill(0) : cheeseMeltJitter(seedKey, 48));
  const t = clamp01((melt - LOBE_START) / (1 - LOBE_START));
  const pad = PAD_MAX * t * t * (3 - 2 * t);
  const strength = clamp01((melt - LOBE_START) / 0.3);
  const lobeCount = LOBES_MAX >= 3 && j[20] > -0.2 ? 3 : 2;
  const spacing = ((2 * Math.PI) / lobeCount) * (1 + 0.2 * j[21]);
  const base = Math.PI * (1 + j[22]);
  const cx = pad + CORE_W / 2;
  const cy = pad + CORE_H / 2;
  const boxW = CORE_W + 2 * pad;
  const boxH = CORE_H + 2 * pad;
  const lobes: CheeseLobe[] = [];
  let amber: CheeseMeltLobes["amber"] = null;
  if (pad > 0.001) {
    for (let i = 0; i < lobeCount; i += 1) {
      const toward = i === 0 && neighbour != null;
      const theta = toward ? neighbour.angle : base + i * spacing + 0.5 * j[23 + i];
      const rx = 6 + 2.2 * (0.5 + 0.5 * j[26 + i]);
      const ry = 4.6 + 1.6 * (0.5 + 0.5 * j[29 + i]);
      const coreRad = polarRadius(CORE_W / 2, CORE_H / 2, theta);
      const lobePolar = polarRadius(rx, ry, theta);
      let reach = (i === 0 ? 4.4 : 3.2) * (0.6 + 0.4 * (0.5 + 0.5 * j[32 + i])) + 0.6;
      if (toward) {
        // screen-space room between the two cores at the settled size, shared by the two lobes facing each other
        const scale = Math.hypot(Math.cos(theta) * SETTLED_SCALE_X, Math.sin(theta) * SETTLED_SCALE_Y);
        const coreScreen = polarRadius((CORE_W / 2) * SETTLED_SCALE_X, (CORE_H / 2) * SETTLED_SCALE_Y, theta);
        const room = neighbour.distancePx - 2 * coreScreen - MIN_NEIGHBOUR_GAP_PX;
        reach = Math.min(reach, Math.max(0.6, room / 2 / scale));
      }
      // the tip reaches about `reach` px beyond the core's edge
      const dist = coreRad + reach - lobePolar;
      const x = clampRange(cx + dist * Math.cos(theta), rx, Math.max(rx, boxW - rx));
      const y = clampRange(cy + dist * Math.sin(theta), ry, Math.max(ry, boxH - ry));
      lobes.push({ rx, ry, x, y, alpha: 0.92 * strength * (0.8 + 0.2 * j[35 + i]), warm: i % 2 === 1 });
      if (i === 0) {
        amber = {
          rx: 2.8 + 1.2 * j[38],
          ry: 2 + 0.8 * j[40],
          x: clampRange(cx + (dist + 0.1 * lobePolar) * Math.cos(theta), 3, boxW - 3),
          y: clampRange(cy + (dist + 0.1 * lobePolar) * Math.sin(theta), 3, boxH - 3),
        };
      }
    }
  }
  return { pad, lobes, amber, strength };
}

/**
 * The CSS custom properties `.pizza-cheese--mozzarella` reads (src/App.css). All colours are resolved to plain `rgba()`
 * strings here, not computed in CSS: CSS math inside a colour function (`rgba(calc(...))`) is not safe on every engine
 * (older Safari / in-app WebViews drop the whole declaration), so the stylesheet only ever receives finished values. Every
 * variable has the raw look as its CSS fallback, so a cheese without them is drawn exactly as before. Pure function of the
 * existing scalars (plus an optional per-piece `seedKey`, see `cheeseMeltJitter`); geometry (`--bake-melt`) stays a unitless
 * 0..1 number used in length `calc()`, which every engine supports.
 *
 * Without a `seedKey` every piece is drawn as A3 drew it. With one, the outline, the browning blotches (position, size,
 * strength) and where the body's feathered edge is thinnest vary a little per piece, all scaled by `melt` / `toast`, so
 * the raw cheese (melt 0, toast 0) is unaffected.
 */
export function cheeseMeltCssVars(look: CheeseMeltLook, seedKey?: string, heat?: number, neighbour?: CheeseNeighbour | null): Record<string, string> {
  const { melt, char } = look;
  const toast = look.toast;
  // the pre-melt tightening needs the raw heat itself (melt is still 0 then); without it (undefined) there is no puff
  const puffNow = heat === undefined ? 0 : puffIntensity(heat);
  // the melted body is opaque by the time the raw lump is half gone (no see-through pink mid-melt)
  const body = clamp01(melt * 2);
  // the pad (room for the lobes) grows over the second half of the melt, smoothly (no pop)
  const t = clamp01((melt - LOBE_START) / (1 - LOBE_START));
  const pad = PAD_MAX * t * t * (3 - 2 * t);
  const fadeOut = clamp01(1 - melt / LOBE_START); // 1 raw -> 0 once the lump has melted (ring, drop shadow, raw lump)
  const spotRgb = SPOT_GOLDEN.map((g, i) => g + (SPOT_CHARRED[i] - g) * char);
  // 4 outline + 2 body-centre / bleed direction + 4 x 4 blotch values + 5 lobe strengths + spread + aspect
  const j = seedKey === undefined ? new Array<number>(48).fill(0) : cheeseMeltJitter(seedKey, 48);
  const pct = (value: number) => `${clampRange(value, 24, 70).toFixed(1)}%`;
  const radius =
    `${pct(55 - 15 * melt + 13 * melt * j[0])} ${pct(45 + 15 * melt + 13 * melt * j[1])} ` +
    `${pct(48 + 10 * melt + 13 * melt * j[2])} ${pct(52 - 14 * melt + 13 * melt * j[3])} / ` +
    `${pct(55 + 7 * melt + 10 * melt * j[1])} ${pct(50 - 10 * melt + 10 * melt * j[2])} ` +
    `${pct(50 + 10 * melt + 10 * melt * j[3])} ${pct(45 - 7 * melt + 10 * melt * j[0])}`;
  // body centre (px in the core box)
  const bodyX = ((46 + 13 * j[4]) / 100) * CORE_W;
  const bodyY = ((44 + 13 * j[5]) / 100) * CORE_H;
  const vars: Record<string, string> = {
    "--bake-melt": melt.toFixed(3),
    // once the box is enlarged the outline is the gradients', so the box itself is a plain ellipse that clips nothing the lobes paint
    "--bake-cheese-radius": pad > 0.001 ? "50%" : radius,
    "--bake-cheese-pad": `${pad.toFixed(2)}px`,
    // the feathered body edge is thinnest on the side the centre drifts away from, so the edge blends into the sauce unevenly.
    // Explicit px (the same closest-side ellipse the stylesheet's fallback gives the core) in the possibly enlarged box.
    "--bake-cheese-body-geo": `ellipse ${(pad > 0.001 ? CORE_W / 2 + 1.5 : Math.min(bodyX, CORE_W - bodyX)).toFixed(2)}px ${(pad > 0.001 ? CORE_H / 2 + 1.5 : Math.min(bodyY, CORE_H - bodyY)).toFixed(2)}px at ${(pad + bodyX).toFixed(2)}px ${(pad + bodyY).toFixed(2)}px`,
    // melted cheese lies flat in the sauce: the lump's drop shadow fades with melt
    // (the box-shadows are gone by the time the box is enlarged: they would otherwise outline the transparent pad; the shade gradient replaces them)
    "--bake-cheese-drop": rgba(30, 16, 4, 0.3 * (1 + 0.5 * puffNow * (1 - melt)) * fadeOut),
    "--bake-cheese-ring": rgba(255, 255, 255, 0.8 * fadeOut),
    "--bake-cheese-inset": rgba(255, 255, 255, 0.55 * fadeOut),
    // The raw lump (same three colours as the stylesheet's raw gradient) cross-fades out while a softer, creamier body with a
    // feathered edge fades in, so the hard white disc outline goes away as `melt` rises. Both layers are plain rgba() here.
    "--bake-cheese-raw-0": rgba(255, 253, 245, fadeOut),
    "--bake-cheese-raw-1": rgba(243, 234, 208, fadeOut),
    "--bake-cheese-raw-2": rgba(230, 216, 174, fadeOut),
    "--bake-cheese-body-0": rgba(240, 235, 223, body),
    "--bake-cheese-body-1": rgba(237, 231, 216, body),
    "--bake-cheese-body-2": rgba(234, 226, 208, 0.94 * body),
    "--bake-cheese-body-3": rgba(230, 218, 196, 0.62 * body),
    // a faint tomato-orange stain just outside one side of the edge: the cheese bleeds into the sauce there, not everywhere
    "--bake-cheese-bleed": rgba(218, 104, 66, 0.12 * fadeOut * melt),
    "--bake-cheese-bleed-off": `${(3 * j[4] * melt).toFixed(2)}px ${(2.4 * j[5] * melt).toFixed(2)}px`,
    "--bake-cheese-gloss": rgba(255, 253, 247, 0.22 * melt),
    "--bake-cheese-pool": rgba(60, 30, 8, 0.12 * melt * fadeOut),
    "--bake-cheese-spot": rgba(spotRgb[0], spotRgb[1], spotRgb[2], 2 * toast),
    "--bake-cheese-spot-soft": rgba(spotRgb[0], spotRgb[1], spotRgb[2], 1.1 * toast),
  };
  SPOTS.forEach((spot, i) => {
    const o = 6 + i * 4;
    const strength = clampRange(1 + 0.4 * j[o + 3], 0.45, 1.3);
    const size = 0.72 * clampRange(1 + 0.4 * j[o + 2], 0.6, 1.45);
    vars[`--bake-cheese-sp${i + 1}-at`] = `${(pad + ((spot.x + 12 * j[o]) / 100) * CORE_W).toFixed(2)}px ${(pad + ((spot.y + 10 * j[o + 1]) / 100) * CORE_H).toFixed(2)}px`;
    vars[`--bake-cheese-sp${i + 1}-r`] = `${(spot.rx * size).toFixed(2)}px ${(spot.ry * size).toFixed(2)}px`;
    vars[`--bake-cheese-spot-${i + 1}`] = rgba(spotRgb[0], spotRgb[1], spotRgb[2], 1.6 * toast * strength);
    vars[`--bake-cheese-spot-soft-${i + 1}`] = rgba(spotRgb[0], spotRgb[1], spotRgb[2], 0.9 * toast * strength);
  });
  // Proto4b: once the box is enlarged the whole background is ONE finished value (`--bake-cheese-bg`) holding only the layers that are visible
  // at this moment (a CSS custom property can carry the whole `background` list), instead of a fixed 13-layer list of mostly transparent
  // gradients: gloss + body + the lobes, plus the browning blotches only once there is browning. Before that the stylesheet's own (raw)
  // list is used, so the raw look and every other context are untouched.
  if (pad > 0.001) {
    const layers = cheeseMeltLobes(look, seedKey, neighbour, j);
    const g = (geo: string, stops: string) => `radial-gradient(${geo}, ${stops})`;
    const px = (n: number) => `${n.toFixed(2)}px`;
    const list: string[] = [];
    if (toast > 0.02) {
      // three browning blotches (the fourth, smallest one is dropped); the third sits at the first lobe's tip instead of the core (local
      // amber browning where the film is thin), so there is no separate blush layer
      SPOTS.slice(0, 3).forEach((spot, i) => {
        const o = 6 + i * 4;
        const strength = clampRange(1 + 0.4 * j[o + 3], 0.45, 1.3);
        const size = 0.9 * clampRange(1 + 0.4 * j[o + 2], 0.6, 1.45);
        const tip = i === 2 ? layers.amber : null;
        const geo = tip
          ? `ellipse ${px(tip.rx)} ${px(tip.ry)} at ${px(tip.x)} ${px(tip.y)}`
          : `ellipse ${px(spot.rx * size)} ${px(spot.ry * size)} at ${px(pad + ((spot.x + 12 * j[o]) / 100) * CORE_W)} ${px(pad + ((spot.y + 10 * j[o + 1]) / 100) * CORE_H)}`;
        list.push(
          g(
            geo,
            `${rgba(spotRgb[0], spotRgb[1], spotRgb[2], 2.1 * toast * strength * (tip ? 0.8 : 1))} 0, ${rgba(spotRgb[0], spotRgb[1], spotRgb[2], 1.2 * toast * strength * (tip ? 0.8 : 1))} 45%, transparent 100%`,
          ),
        );
      });
    }
    // soft gloss on the upper-left of the thick core (a lit top)
    list.push(g(`ellipse 13px 10px at ${px(pad + 0.4 * CORE_W)} ${px(pad + 0.3 * CORE_H)}`, `${rgba(255, 253, 247, 0.3 * melt)} 0, transparent 100%`));
    // the thick creamy core: brightest up-left, a warmer, deeper rim down-right (a bevel), feathered to nothing
    list.push(
      g(
        `ellipse ${px(CORE_W / 2 + 1)} ${px(CORE_H / 2 + 1)} at ${px(pad + bodyX)} ${px(pad + bodyY)}`,
        `${rgba(250, 247, 236, body)} 0, ${rgba(243, 237, 221, body)} 55%, ${rgba(234, 222, 200, 0.96 * body)} 82%, ${rgba(224, 207, 176, 0.72 * body)} 95%, transparent 100%`,
      ),
    );
    for (const lobe of layers.lobes) {
      const [lr, lg, lb] = lobeRgb(lobe.warm ? LOBE_CREAM_B : LOBE_CREAM_A, toast, char);
      list.push(
        g(
          `ellipse ${px(lobe.rx)} ${px(lobe.ry)} at ${px(lobe.x)} ${px(lobe.y)}`,
          `${rgba(lr, lg, lb, lobe.alpha)} 0, ${rgba(lr, lg, lb, lobe.alpha * 0.8)} 55%, ${rgba(lr, lg, lb, lobe.alpha * 0.38)} 82%, transparent 100%`,
        ),
      );
    }
    vars["--bake-cheese-bg"] = list.join(", ");
  }
  // Motion: pieces lead / lag each other mid-melt (the stagger is zero at melt 0 and 1, so the raw and the finished look are unaffected),
  // the lump first tightens (puff: smaller and thicker), then spreads wide and flat with a small overshoot that settles, each piece
  // skewing its own way. `-sx/-sy/-skew` are the settled values, `-bx/-by/-wob` the transient part (CSS scales it by `--cheese-motion`,
  // which is 0 under prefers-reduced-motion, so reduced motion keeps only the settled flat, wide shape).
  const mi = clamp01(melt + 0.15 * j[29] * 4 * melt * (1 - melt));
  const release = 1 - mi;
  const puff = puffNow * release;
  const over = Math.sin(Math.PI * Math.pow(mi, 1.8));
  vars["--bake-cheese-sx"] = (1 + (SETTLED_SPREAD_X + 0.1 * j[26]) * mi).toFixed(4);
  vars["--bake-cheese-sy"] = (1 + (SETTLED_SPREAD_Y + 0.04 * j[27]) * mi).toFixed(4);
  vars["--bake-cheese-bx"] = (PUFF_X * puff + OVERSHOOT_X * over).toFixed(4);
  vars["--bake-cheese-by"] = (PUFF_Y * puff + OVERSHOOT_Y * over).toFixed(4);
  vars["--bake-cheese-skew"] = `${(SETTLED_SKEW_DEG * j[30] * mi).toFixed(2)}deg`;
  vars["--bake-cheese-wob"] = `${(WOBBLE_SKEW_DEG * j[31] * over).toFixed(2)}deg`;
  // scaled by `melt`, so it is exactly 1 for the raw cheese (the width must not change when BAKE starts at melt 0)
  vars["--bake-cheese-aspect"] = clampRange(1 + 0.05 * melt * j[28], 0.95, 1.05).toFixed(3);
  return vars;
}

/**
 * Gameplay UX PR-E (Finished Pizza Visual 2.0).
 *
 * Fresh Audit finding (docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md section 7):
 * every non-cheese topping was, until this module, browned through `cheeseVisualFrame` itself --
 * `PizzaStage` passed the *cheese* melt/toast/char `filter` (and a `--bake-melt-scale` custom
 * property only `.pizza-cheese` ever reads) straight onto every topping's `IngredientPieceVisual`,
 * cheese or not. For the emoji branch this `filter` is not a no-op (a CSS `filter` never is): it
 * silently replaced the emoji's own baseline `drop-shadow`, and it roasted every topping along a
 * curve tuned for cheese's own melt/spread/char, not a flat glyph. A second, separate, discrete
 * 3-bucket wrapper filter (the old `.pizza-dough--raw/--perfect/--burnt .pizza-topping` App.css
 * rules) stacked on top of that, snapping at the same `classifyBake` boundary the rest of this
 * module already replaced everywhere else with a continuous scalar. Two overlapping, one
 * unintentional -- exactly the "accidental filter reuse" this PR's task brief asks to fix.
 *
 * `toppingVisualFrame` replaces both with one deliberate, continuous, topping-specific curve:
 * gentler than cheese (no scale/spread -- toppings stay flat glyphs, per the audit's own note
 * that they "never change shape at any bake stage"), ramping later and capping lower so a
 * topping visibly roasts without becoming a cheese-brown lump. `roastResistant` (set via
 * `Ingredient.bakeRoastResistant`, ../data/ingredients.ts) selects a second, far gentler curve
 * for green herbs (basil/oregano/rosemary) so they read as "lightly cooked" rather than turning
 * the same brown as every other topping and becoming unidentifiable -- the task's own explicit
 * constraint ("basil等の緑色具材が全部茶色になって識別不能になるのは禁止").
 */
export interface ToppingVisualFrame {
  brightness: number;
  saturate: number;
  sepia: number;
}

interface ToppingVisualKeyframe extends ToppingVisualFrame {
  heat: number;
}

const TOPPING_FRAMES: readonly ToppingVisualKeyframe[] = [
  { heat: 0, brightness: 1, saturate: 1, sepia: 0 },
  { heat: 0.8, brightness: 1, saturate: 1, sepia: 0 },
  { heat: 1.0, brightness: 0.97, saturate: 1.04, sepia: 0.08 },
  { heat: 1.6, brightness: 0.9, saturate: 0.92, sepia: 0.14 },
  { heat: 2.0, brightness: 0.78, saturate: 0.8, sepia: 0.2 },
];

const HERB_FRAMES: readonly ToppingVisualKeyframe[] = [
  { heat: 0, brightness: 1, saturate: 1, sepia: 0 },
  { heat: 1.0, brightness: 1, saturate: 1, sepia: 0 },
  { heat: 1.6, brightness: 0.96, saturate: 1.02, sepia: 0.03 },
  { heat: 2.0, brightness: 0.9, saturate: 1.0, sepia: 0.06 },
];

function interpolateToppingFrames(
  frames: readonly ToppingVisualKeyframe[],
  heat: number,
): ToppingVisualFrame {
  const clamped = Math.min(2, Math.max(0, heat));
  for (let i = 0; i < frames.length - 1; i += 1) {
    const from = frames[i];
    const to = frames[i + 1];
    if (clamped >= from.heat && clamped <= to.heat) {
      const span = to.heat - from.heat;
      const t = span > 0 ? (clamped - from.heat) / span : 0;
      return {
        brightness: lerp(from.brightness, to.brightness, t),
        saturate: lerp(from.saturate, to.saturate, t),
        sepia: lerp(from.sepia, to.sepia, t),
      };
    }
  }
  const last = frames[frames.length - 1];
  return { brightness: last.brightness, saturate: last.saturate, sepia: last.sepia };
}

/** Continuous, topping-specific roast curve -- see this section's own file comment above for
 *  why toppings need a dedicated curve instead of reusing `cheeseVisualFrame`. */
export function toppingVisualFrame(heat: number, roastResistant: boolean): ToppingVisualFrame {
  return interpolateToppingFrames(roastResistant ? HERB_FRAMES : TOPPING_FRAMES, heat);
}
