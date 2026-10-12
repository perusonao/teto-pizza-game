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
 * #421 outline prototype 2: prototype 1 drew six hard-ish copies of the outline, and the Owner read them as a stack of white
 * ovals (a visible inner oval edge, round overhangs, sheet-like layers). The mechanism is now a feathered SKIRT, not copies:
 *  - the body's own rim fades to about the strength the skirt has where it starts (`--bake-cheese-body-3`), so there is no step
 *    between the thick milky centre and the thin cream film around it;
 *  - four near layers (soft, 1.4 - 1.9 px blur) are the skirt: lopsided per piece, small reach, each only a shade stronger toward
 *    the body, so overlaps build a continuous thick -> thin gradient;
 *  - two far layers (2.2 px blur, weak) are the thin tongues: only a short, faint irregularity beyond the skirt, never a round bulge.
 * No layer has an edge crisp enough to read as its own shape; the silhouette is the soft sum.
 */
const FILM_COUNT = 6;
const FILM_NEAR = 4;
/** blur / reach / spread / alpha for the near skirt layers and the far tongues (px, px, px, 0..1) */
const FILM_NEAR_BLUR = [1.4, 1.9, 1.6, 1.8] as const;
const FILM_FAR_BLUR = 2.2;
const FILM_NEAR_ALPHA = 0.2;
const FILM_FAR_ALPHA = 0.14;
const LOBE_CREAM_A = [232, 208, 176] as const;
const LOBE_CREAM_B = [228, 200, 166] as const;
/** What a lobe's colour moves towards: a pale golden while the cheese toasts, a brown (like the blotches) once it chars. */
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
export function cheeseMeltCssVars(look: CheeseMeltLook, seedKey?: string): Record<string, string> {
  const { melt, toast, char } = look;
  // the melted body is opaque by the time the raw lump is half gone (no see-through pink mid-melt)
  const body = clamp01(melt * 1.6);
  const spotRgb = SPOT_GOLDEN.map((g, i) => g + (SPOT_CHARRED[i] - g) * char);
  // 4 outline + 2 body-centre / bleed direction + 4 x 4 blotch values + 5 lobe strengths + spread + aspect
  const j = seedKey === undefined ? new Array<number>(48).fill(0) : cheeseMeltJitter(seedKey, 48);
  const pct = (value: number) => `${clampRange(value, 24, 70).toFixed(1)}%`;
  const radius =
    `${pct(55 - 15 * melt + 13 * melt * j[0])} ${pct(45 + 15 * melt + 13 * melt * j[1])} ` +
    `${pct(48 + 10 * melt + 13 * melt * j[2])} ${pct(52 - 14 * melt + 13 * melt * j[3])} / ` +
    `${pct(55 + 7 * melt + 10 * melt * j[1])} ${pct(50 - 10 * melt + 10 * melt * j[2])} ` +
    `${pct(50 + 10 * melt + 10 * melt * j[3])} ${pct(45 - 7 * melt + 10 * melt * j[0])}`;
  const vars: Record<string, string> = {
    "--bake-melt": melt.toFixed(3),
    "--bake-cheese-radius": radius,
    // the feathered body edge is thinnest on the side the centre drifts away from, so the edge blends into the sauce unevenly
    "--bake-cheese-body-at": `${(46 + 13 * j[4]).toFixed(1)}% ${(44 + 13 * j[5]).toFixed(1)}%`,
    // melted cheese lies flat in the sauce: the lump's drop shadow fades with melt
    "--bake-cheese-drop": rgba(30, 16, 4, 0.3 * (1 - 0.7 * melt)),
    "--bake-cheese-ring": rgba(255, 255, 255, 0.8 * (1 - melt)),
    "--bake-cheese-inset": rgba(255, 255, 255, 0.55 - 0.5 * melt),
    // The raw lump (same three colours as the stylesheet's raw gradient) cross-fades out while a softer, creamier body with a
    // feathered edge fades in, so the hard white disc outline goes away as `melt` rises. Both layers are plain rgba() here.
    "--bake-cheese-raw-0": rgba(255, 253, 245, 1 - melt),
    "--bake-cheese-raw-1": rgba(243, 234, 208, 1 - melt),
    "--bake-cheese-raw-2": rgba(230, 216, 174, 1 - melt),
    "--bake-cheese-body-0": rgba(240, 235, 223, body),
    "--bake-cheese-body-1": rgba(237, 231, 216, body),
    "--bake-cheese-body-2": rgba(235, 226, 207, 0.9 * body),
    "--bake-cheese-body-3": rgba(228, 212, 182, 0.6 * body),
    // a faint tomato-orange stain just outside one side of the edge: the cheese bleeds into the sauce there, not everywhere
    "--bake-cheese-bleed": rgba(218, 104, 66, 0.12 * melt),
    "--bake-cheese-bleed-off": `${(3 * j[4] * melt).toFixed(2)}px ${(2.4 * j[5] * melt).toFixed(2)}px`,
    "--bake-cheese-gloss": rgba(255, 253, 247, 0.22 * melt),
    "--bake-cheese-pool": rgba(60, 30, 8, 0.12 * melt),
    "--bake-cheese-spot": rgba(spotRgb[0], spotRgb[1], spotRgb[2], 2 * toast),
    "--bake-cheese-spot-soft": rgba(spotRgb[0], spotRgb[1], spotRgb[2], 1.1 * toast),
  };
  SPOTS.forEach((spot, i) => {
    const o = 6 + i * 4;
    const strength = clampRange(1 + 0.4 * j[o + 3], 0.45, 1.3);
    const size = 0.72 * clampRange(1 + 0.4 * j[o + 2], 0.6, 1.45);
    vars[`--bake-cheese-sp${i + 1}-at`] = `${(spot.x + 12 * j[o]).toFixed(1)}% ${(spot.y + 10 * j[o + 1]).toFixed(1)}%`;
    vars[`--bake-cheese-sp${i + 1}-r`] = `${(spot.rx * size).toFixed(2)}px ${(spot.ry * size).toFixed(2)}px`;
    vars[`--bake-cheese-spot-${i + 1}`] = rgba(spotRgb[0], spotRgb[1], spotRgb[2], 1.6 * toast * strength);
    vars[`--bake-cheese-spot-soft-${i + 1}`] = rgba(spotRgb[0], spotRgb[1], spotRgb[2], 0.9 * toast * strength);
  });
  // Skirt layers: all lengths are already multiplied by `melt`, so at melt 0 every layer has zero geometry and zero alpha (the raw look).
  // Near layers sit in four loosely spread directions (a per-piece twist + jitter) with a small, uneven reach; the two far layers are
  // faint tongues, kept mostly horizontal (the piece is a flat oval, squashed vertically as it melts). Vertical reach is x0.8.
  const twist = 0.9 * j[27];
  for (let i = 0; i < FILM_COUNT; i += 1) {
    const near = i < FILM_NEAR;
    const angle = near
      ? twist + (i / FILM_NEAR) * 2 * Math.PI + 0.55 * j[22 + (i % 5)]
      : twist + (i === FILM_NEAR ? 0.3 : Math.PI + 0.3) + 0.9 * j[22 + (i % 5)];
    const reach = (near ? 1 + 2.2 * (0.5 + 0.5 * j[32 + i]) : 3.6 + 2 * (0.5 + 0.5 * j[32 + i])) * melt;
    const grow = (near ? 0.3 + 0.6 * (0.5 + 0.5 * j[38 + i]) : 0) * melt;
    const blur = (near ? FILM_NEAR_BLUR[i] : FILM_FAR_BLUR) * melt;
    const [fr, fg, fb] = lobeRgb(i % 2 === 0 ? LOBE_CREAM_A : LOBE_CREAM_B, toast, char);
    const base = near ? FILM_NEAR_ALPHA : FILM_FAR_ALPHA;
    const strength = base * clampRange(0.85 + 0.25 * j[38 + ((i + 3) % 6)], 0.6, 1.05);
    vars[`--bake-cheese-film-${i + 1}-g`] =
      `${(reach * Math.cos(angle)).toFixed(2)}px ${(reach * Math.sin(angle) * 0.8).toFixed(2)}px ${blur.toFixed(2)}px ${grow.toFixed(2)}px`;
    vars[`--bake-cheese-film-${i + 1}`] = rgba(fr, fg, fb, strength * melt);
  }
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
