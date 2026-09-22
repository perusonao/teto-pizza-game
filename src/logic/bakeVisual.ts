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
