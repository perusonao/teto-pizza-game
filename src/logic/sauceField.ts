/**
 * Phase 4A-1A: the Sauce Field -- a 16x16 normalized-quantity density grid over the
 * dough's own 0-100% coordinate box (../logic/pizzaCoordinates.ts), used only to derive
 * Prototype Metrics (quantity/coverage/evenness/overflow) for the Margherita Reference
 * prototype. It is never persisted and never feeds authoritative scoring (../logic/scoring.ts) --
 * see ./referenceScoring.ts's file header for that boundary.
 *
 * Deliberately keeps quantity and coverage as two different numbers computed two different
 * ways (sum of deposited amount vs. fraction of cells touched): a large deposit concentrated
 * on one point must read as high quantity / low coverage / low evenness, and a small amount
 * spread thin must read as low quantity / high coverage, or this whole prototype can't tell
 * "dumped a puddle" apart from "painted it on".
 */
import { DOUGH_RADIUS, distanceFromCenter } from "./pizzaCoordinates";
import { clampQuantity } from "./sauceQuantity";

export interface SauceDepositLike {
  x: number;
  y: number;
  amount: number;
}

/** Grid resolution. 16x16 is the Prototype's base case (SSOT for this phase); kept as a
 *  named constant (not a magic 16) so a later phase can retune it with a recorded reason
 *  instead of a silent edit. */
export const SAUCE_FIELD_SIZE = 16;

/** A density cell counts as "touched" (contributes to coverage) once it holds more than
 *  this much normalized quantity -- filters out the near-zero falloff tail of a brush
 *  that only grazed a neighboring cell, which would otherwise inflate coverage. Kept
 *  deliberately just *below* one full dispense tick's own amount (`SAUCE_RATE_PER_TICK`,
 *  0.02 -- see ../logic/sauceQuantity.ts) rather than equal to it: a single dab landing
 *  squarely in a cell should register as "touched" on its own, not require a second
 *  overlapping tick to clear the bar (Codex Broad Review MUST FIX 6 follow-up -- see
 *  ../data/referencePizza.ts's fixture, which depends on isolated dabs actually counting). */
const COVERAGE_THRESHOLD = 0.015;

/** How many grid cells out from a deposit's own cell the brush falloff reaches. A deposit
 *  lighting up only its exact cell would make "spread while moving" indistinguishable from
 *  "many separate dots"; a small radius reads as one continuous stroke instead. */
const BRUSH_RADIUS_CELLS = 1;

function cellCenterPercent(index: number): number {
  return ((index + 0.5) / SAUCE_FIELD_SIZE) * 100;
}

/** Whether the given grid cell's center falls inside the dough circle -- the denominator
 *  for coverage, and the population evenness is measured over, is *this* set of cells, not
 *  the full 16x16 square (the square's corners are outside the round dough). */
export function isCellInsideDough(row: number, col: number): boolean {
  return distanceFromCenter(cellCenterPercent(col), cellCenterPercent(row)) <= 48;
}

/** Radius (dough-percent units) of a single deposit's own physical footprint -- the "dab" a
 *  dispenser tip leaves at one instant, distinct from BRUSH_RADIUS_CELLS (a grid-cell
 *  falloff used only for the visual/coverage field below). Used to blend a deposit's amount
 *  between quantity (inside) and overflow *smoothly* across the dough rim instead of a
 *  binary inside/outside test on the deposit's center point alone (Codex Broad Review MUST
 *  FIX 5 -- Overflow Boundary): two deposits a fraction of a percent apart, one just inside
 *  the rim and one just outside, must produce nearly the same split, never a 0%/100% flip. */
const DEPOSIT_FOOTPRINT_RADIUS = 3;

/**
 * Human Feel Fix 2 (Sauce Painting Visual/Scoring Discoverability): the "paint up to here,
 * leave the crust bare" boundary, in the same dough-percent units as `DOUGH_RADIUS` --
 * strictly smaller than it (48), leaving a deliberate rim margin. This is the single
 * geometry constant behind both:
 *  - the Target Area Guide rendered on the dough and on the Reference Pizza mini preview
 *    (PizzaStage.tsx, ReferencePreview.tsx) -- so the guide is never drawn from a different
 *    number than the one scoring below actually uses (Human Feel Fix 2 brief section 5).
 *  - `insideTargetFraction`/`edgeAmount`/`edgeRatio` below, the shadow-only "did this sauce
 *    stay off the ear" signal the player-facing ふち (edge) evaluation
 *    (../logic/sauceEvaluation.ts) reads.
 * Chosen so `IDEAL_MARGHERITA_SAUCE_FIXTURE` (../data/referencePizza.ts, outermost ring at
 * radius 36 + its own `DEPOSIT_FOOTPRINT_RADIUS`-sized footprint) stays entirely inside it --
 * pinned by sauceField.test.ts, so an unrelated future tuning change can't silently make the
 * game's own "ideal" example fail its own edge check.
 */
export const SAUCE_TARGET_RADIUS = 40;

/**
 * Fraction (0-1) of a disk of radius `footprintRadius` centered at (x, y) that overlaps a
 * circle of radius `circleRadius` centered on the dough's own center, via the standard
 * circle-circle intersection area formula, normalized by the *deposit's own* footprint area
 * (never the target circle's -- the question is "how much of this deposit landed inside",
 * not "how much of the circle this deposit covers"). 1 well inside, 0 well outside, and a
 * smooth continuous ramp through the thin annulus where the two circles actually overlap --
 * never a discontinuous 0%/100% flip for a deposit a fraction of a percent from the boundary.
 * `insideDoughFraction`/`insideTargetFraction` below are both just this against their own
 * fixed radius, so every boundary in this file shares the exact same continuity guarantee.
 */
export function circleOverlapFraction(
  x: number,
  y: number,
  circleRadius: number,
  footprintRadius: number = DEPOSIT_FOOTPRINT_RADIUS,
): number {
  const d = distanceFromCenter(x, y);
  const R = circleRadius;
  const r = footprintRadius;

  if (d >= R + r) return 0; // Fully outside: the two circles don't touch at all.
  if (d <= R - r) return 1; // Fully inside: the deposit's whole footprint clears the boundary.

  const clampAcos = (value: number) => Math.acos(Math.min(1, Math.max(-1, value)));
  const d2 = d * d;
  const R2 = R * R;
  const r2 = r * r;

  const alphaR = clampAcos((d2 + R2 - r2) / (2 * d * R));
  const alphaR2 = clampAcos((d2 + r2 - R2) / (2 * d * r));
  const triangleTerm =
    0.5 * Math.sqrt(Math.max(0, (-d + R + r) * (d + R - r) * (d - R + r) * (d + R + r)));
  const intersectionArea = R2 * alphaR + r2 * alphaR2 - triangleTerm;

  const footprintArea = Math.PI * r2;
  return Math.min(1, Math.max(0, intersectionArea / footprintArea));
}

/**
 * By construction `insideDoughFraction(...) + (1 - insideDoughFraction(...)) === 1` always,
 * so splitting one deposit's amount by this fraction conserves its full amount exactly
 * (quantity + overflow) at every position, including right on the rim. See
 * `circleOverlapFraction`'s own doc comment for the continuity guarantee this relies on.
 */
export function insideDoughFraction(x: number, y: number): number {
  return circleOverlapFraction(x, y, DOUGH_RADIUS);
}

/** Same continuity guarantee as `insideDoughFraction`, against the smaller
 *  `SAUCE_TARGET_RADIUS` boundary instead of the dough's own edge -- see `edgeAmount` below
 *  for what this feeds. Because `SAUCE_TARGET_RADIUS < DOUGH_RADIUS`,
 *  `insideTargetFraction(x, y) <= insideDoughFraction(x, y)` always holds: the target circle
 *  is strictly inside the dough circle, so anything the target circle doesn't cover fully
 *  overlaps the dough circle's own extra margin (or lies outside the dough entirely). */
export function insideTargetFraction(x: number, y: number): number {
  return circleOverlapFraction(x, y, SAUCE_TARGET_RADIUS);
}

let cachedInDoughCellCount: number | null = null;
function inDoughCellCount(): number {
  if (cachedInDoughCellCount !== null) return cachedInDoughCellCount;
  let n = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) {
      if (isCellInsideDough(r, c)) n += 1;
    }
  }
  cachedInDoughCellCount = n;
  return n;
}

/**
 * Rasterizes deposits (already filtered to inside-dough ones by the caller -- see
 * `computeSauceMetrics` below) into a 16x16 density grid, each deposit spreading a small
 * falloff into its neighboring cells. Exported mainly so the Visual Feedback layer
 * (PizzaStage's sauce heatmap canvas) can reuse the exact same field the metrics are
 * computed from, instead of drawing something that only looks similar.
 */
export function buildSauceField(deposits: readonly SauceDepositLike[]): Float64Array {
  const field = new Float64Array(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
  for (const deposit of deposits) {
    const col = Math.floor((deposit.x / 100) * SAUCE_FIELD_SIZE);
    const row = Math.floor((deposit.y / 100) * SAUCE_FIELD_SIZE);
    for (let dr = -BRUSH_RADIUS_CELLS; dr <= BRUSH_RADIUS_CELLS; dr += 1) {
      for (let dc = -BRUSH_RADIUS_CELLS; dc <= BRUSH_RADIUS_CELLS; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= SAUCE_FIELD_SIZE || c < 0 || c >= SAUCE_FIELD_SIZE) continue;
        const falloff = 1 / (1 + Math.hypot(dr, dc));
        field[r * SAUCE_FIELD_SIZE + c] += deposit.amount * falloff;
      }
    }
  }
  return field;
}

/**
 * 0 (all quantity concentrated in a single cell) to 1 (as uniform as this total quantity
 * can possibly be spread across `values`). Comparing against the *worst case for this same
 * total* -- rather than a fixed scale -- is what keeps evenness meaningful independent of
 * how much sauce is on the pizza at all: a tiny dab spread over two cells and a full
 * dispenser spread over two hundred cells can both score close to 1 if each is about as
 * even as that amount of sauce could be.
 */
function computeEvenness(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 1;
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 1e-9) return 1; // nothing deposited yet -- neutral, not "bad".

  const mean = sum / n;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Worst case for this exact total: every bit of it in one cell, the rest at 0.
  const worstVariance = ((sum - mean) ** 2 + (n - 1) * mean ** 2) / n;
  const worstStddev = Math.sqrt(worstVariance);
  if (worstStddev <= 1e-9) return 1;

  return Math.min(1, Math.max(0, 1 - stddev / worstStddev));
}

export interface SauceMetrics {
  /** Normalized total quantity landed *inside* the dough, 0-1 (see ./sauceQuantity.ts). */
  quantity: number;
  /** Fraction of in-dough grid cells touched by any sauce, 0-1. */
  coverage: number;
  /** How uniformly the in-dough quantity is spread across the dough's cells, 0-1. */
  evenness: number;
  /** Normalized quantity deposited outside the dough circle. */
  overflowAmount: number;
  /** overflowAmount / (quantity + overflowAmount), 0 when nothing has been deposited. */
  overflowRatio: number;
  /** Human Feel Fix 2: normalized quantity deposited beyond `SAUCE_TARGET_RADIUS` -- the rim
   *  band still on the dough (between the target radius and `DOUGH_RADIUS`) *and* true
   *  overflow both count here, unlike `overflowAmount` (dough-radius-relative only), because
   *  the player-facing ふち (edge) evaluation treats "touched the ear" and "missed the pizza
   *  entirely" as the same mistake: sauce that isn't staying inside the target area. See
   *  ../logic/sauceEvaluation.ts. */
  edgeAmount: number;
  /** edgeAmount / (quantity + overflowAmount), 0 when nothing has been deposited. */
  edgeRatio: number;
}

export function emptySauceMetrics(): SauceMetrics {
  return {
    quantity: 0,
    coverage: 0,
    evenness: 1,
    overflowAmount: 0,
    overflowRatio: 0,
    edgeAmount: 0,
    edgeRatio: 0,
  };
}

/**
 * The single entry point Prototype Metrics (and the shadow reference score) read from.
 * Splits every deposit's amount between inside-dough and overflow *continuously*, via
 * `insideDoughFraction` above, instead of the deposit's raw center point alone -- so a
 * deposit landing exactly on the rim contributes half to each, and a position change of a
 * fraction of a percent near the rim shifts the split by a similarly small amount, never a
 * discontinuous 0%/100% flip. quantity/coverage/evenness are derived only from each
 * deposit's inside-weighted share, overflow is tracked purely as amount/ratio, so "sauce
 * that missed the pizza" can never quietly inflate quantity or coverage -- and the two
 * shares always sum back to the deposit's full amount (see `insideDoughFraction`'s own doc
 * comment), so summing quantity + overflowAmount across a whole gesture conserves the total
 * dispensed exactly.
 */
export function computeSauceMetrics(deposits: readonly SauceDepositLike[]): SauceMetrics {
  if (deposits.length === 0) return emptySauceMetrics();

  const insideWeightedDeposits: SauceDepositLike[] = [];
  let quantity = 0;
  let overflowAmount = 0;
  let edgeAmount = 0;
  for (const deposit of deposits) {
    const insideFraction = insideDoughFraction(deposit.x, deposit.y);
    const insideAmount = deposit.amount * insideFraction;
    quantity += insideAmount;
    overflowAmount += deposit.amount - insideAmount; // exact complement -- conservation.
    // Unlike quantity/overflow (split once, between each other), edgeAmount is deliberately
    // *not* part of that split -- it's a second, independent read of the same deposit against
    // a different (smaller) boundary, so "how much stayed off the ear" and "how much stayed
    // on the pizza at all" can disagree freely (a deposit can be fully inside-dough and still
    // fully in the edge band at once).
    edgeAmount += deposit.amount * (1 - insideTargetFraction(deposit.x, deposit.y));
    if (insideAmount > 0) {
      insideWeightedDeposits.push({ x: deposit.x, y: deposit.y, amount: insideAmount });
    }
  }
  quantity = clampQuantity(quantity);

  const field = buildSauceField(insideWeightedDeposits);
  const inDoughValues: number[] = [];
  let touched = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) {
      if (!isCellInsideDough(r, c)) continue;
      const value = field[r * SAUCE_FIELD_SIZE + c];
      inDoughValues.push(value);
      if (value > COVERAGE_THRESHOLD) touched += 1;
    }
  }

  const coverage = inDoughCellCount() === 0 ? 0 : touched / inDoughCellCount();
  const evenness = computeEvenness(inDoughValues);
  const totalDispensedAmount = quantity + overflowAmount;
  const overflowRatio = totalDispensedAmount <= 1e-9 ? 0 : overflowAmount / totalDispensedAmount;
  const edgeRatio = totalDispensedAmount <= 1e-9 ? 0 : edgeAmount / totalDispensedAmount;

  return { quantity, coverage, evenness, overflowAmount, overflowRatio, edgeAmount, edgeRatio };
}

/** Sum of every deposit's amount regardless of inside/outside dough -- the running total
 *  sauceDispenseController.ts clamps future ticks against (see SAUCE_MAX_QUANTITY). */
export function totalDispensed(deposits: readonly SauceDepositLike[]): number {
  return deposits.reduce((sum, d) => sum + d.amount, 0);
}

/** Human Feel Fix 4 (Sauce Visual Polish): the single hex SSOT for "tomato sauce red" --
 *  shared by the painted/baked heatmap below (via `SAUCE_HEATMAP_COLOR`, derived from this)
 *  *and* the tomato-sauce ingredient's own swatch color (../data/ingredients.ts), which
 *  drives the tray chip, the Reference popover's mini-pizza sauce circle and its bar-fill,
 *  and the paint-trail stroke. Before this fix the two lived as separately hard-coded hex
 *  values a few RGB steps apart (#c73b2e vs (196,46,34)) -- close enough nobody had noticed,
 *  but exactly the kind of drift the brief's "PREPARE中と完成/見本のSauceが別物に見えない"
 *  requirement flags. One value now, so they can't separately drift again. */
export const SAUCE_TOMATO_HEX = "#c73b2e";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** The sauce heatmap's own tomato color, r/g/b out of 255 -- derived from `SAUCE_TOMATO_HEX`
 *  above so the visual and that constant can never drift apart. */
export const SAUCE_HEATMAP_COLOR = hexToRgb(SAUCE_TOMATO_HEX);

/**
 * Human Feel Fix 4 (Sauce Visual Polish): alpha curve tuning for `sauceFieldToRgbaPixels`
 * below. Real per-cell field values, measured from `IDEAL_MARGHERITA_SAUCE_FIXTURE`
 * (../data/referencePizza.ts) and a single dispense tick (`SAUCE_RATE_PER_TICK`, 0.02 --
 * see ../logic/sauceQuantity.ts), are what these three constants are tuned against, not
 * round numbers picked in isolation:
 *  - a single tap/light dab lands a touched cell around 0.02-0.03.
 *  - the ideal fixture (a full, evenly-painted coat) sits mostly in 0.02-0.07, its own
 *    heaviest overlap point (adjacent ring falloffs stacking) topping out near 0.068.
 *  - genuinely re-painting the same area (two full coats) pushes a cell past 0.1, up to
 *    roughly 0.14 at its densest.
 * Fix 3's `min(0.85, value * 2.2)` put the *entire* ideal fixture's range at alpha
 * 0.02-0.15 -- so even "painted well" barely registered, reading as "the dough got a
 * little pink" rather than "sauce was spread on it" (the exact Fix 4 Gate complaint). This
 * curve instead front-loads visibility (`ALPHA_FLOOR`, reached almost immediately once a
 * cell is touched at all -- no cell should ever look like bare dough with a faint tint)
 * and lets `DENSITY_AT_CAP` sit comfortably above the ideal fixture's own heaviest cell but
 * still well inside reach of a real re-painted area, so "untouched -> thin -> good coverage
 * -> overlapped" stay four visually distinct reads instead of collapsing opacity to two
 * (see sauceField.test.ts's Fix 4 describe block for the concrete before/after numbers).
 */
const MIN_VISIBLE_VALUE = 0.005;
/** Alpha the instant a cell crosses `MIN_VISIBLE_VALUE` -- already unambiguously "sauce",
 *  with the dough still visibly showing through underneath (the brief's 薄塗り target). */
const ALPHA_FLOOR = 0.46;
/** Alpha at and beyond `DENSITY_AT_CAP` -- a heavily re-painted spot, vivid and dense but
 *  never a flat opaque block (a sliver of dough texture stays visible even here). */
const ALPHA_CAP = 0.93;
/** Field value at which the curve reaches `ALPHA_CAP`. Chosen above the ideal fixture's own
 *  max cell value (~0.068) -- so a single well-painted coat reads as "good", with headroom
 *  left, not "already maxed out" -- and within easy reach of a real two-coat overlap
 *  (~0.1-0.14). */
const DENSITY_AT_CAP = 0.09;

/** value -> alpha (0-1), sqrt-shaped so the rise from `ALPHA_FLOOR` is fast at first (a light
 *  dab is immediately readable as sauce) and gentler approaching `ALPHA_CAP` (extra overlap
 *  past "good coverage" reads as "a bit more", not a second dramatic jump) -- matching the
 *  brief's 薄い/適量/厚い three-way distinction without ever using opacity as a flat on/off
 *  switch. */
function densityToAlpha(value: number): number {
  const t = Math.min(1, Math.max(0, (value - MIN_VISIBLE_VALUE) / (DENSITY_AT_CAP - MIN_VISIBLE_VALUE)));
  return ALPHA_FLOOR + (ALPHA_CAP - ALPHA_FLOOR) * Math.sqrt(t);
}

const BLUR_KERNEL = [
  [1, 2, 1],
  [2, 4, 2],
  [1, 2, 1],
];
const BLUR_KERNEL_WEIGHT_SUM = 16;

/** One 3x3 binomial blur pass. A flat plateau (every cell in a 3x3 window equal to `v`) maps
 *  to itself exactly: the kernel's weights sum to 16, so 9 cells at `v` sum to `16v`, divided
 *  back down to `v`. Cells outside the grid are simply skipped (not counted in the
 *  denominator) rather than clamped/mirrored -- see `smoothSauceFieldForDisplay` below for
 *  why that boundary choice never under-weights a dough-visible cell. */
function blurPass(field: Float64Array): Float64Array {
  const out = new Float64Array(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
  for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
    for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
      let sum = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        const r = row + dr;
        if (r < 0 || r >= SAUCE_FIELD_SIZE) continue;
        for (let dc = -1; dc <= 1; dc += 1) {
          const c = col + dc;
          if (c < 0 || c >= SAUCE_FIELD_SIZE) continue;
          sum += field[r * SAUCE_FIELD_SIZE + c] * BLUR_KERNEL[dr + 1][dc + 1];
        }
      }
      out[row * SAUCE_FIELD_SIZE + col] = sum / BLUR_KERNEL_WEIGHT_SUM;
    }
  }
  return out;
}

/**
 * Phase 4A-1B.1 Fix B (Short Sauce Stroke): a render-only blur applied to a copy of the
 * field, never to the field itself. Callers that feed metrics (`computeSauceMetrics` above)
 * never call this -- only the heatmap canvas's own draw path (PizzaStage.tsx) does, right
 * before `sauceFieldToRgbaPixels` below turns the result into pixels. Same input -> same
 * `buildSauceField` output -> same `computeSauceMetrics` -> only the *pixels* this produces
 * change.
 *
 * Two `blurPass` calls (not one): a single 3x3 pass softened a lone dab's edges but its
 * falloff (BRUSH_RADIUS_CELLS=1, a 3x3 block) still read as a soft-edged *square* rather than
 * a round dab -- composing the same separable kernel twice widens its effective support to
 * 5x5 and pulls the corners down relatively further than the sides (two passes of a
 * binomial kernel approach a Gaussian, which is radially symmetric, unlike a single pass's
 * still-somewhat-square footprint), reading as a round blob. A flat plateau still maps to
 * itself exactly through *both* passes (each pass alone is exact on a plateau, so chaining
 * two is too), so a normal/broad-coverage stroke's already-good look is still untouched --
 * only a lone dab or a short stroke's own hard-edged block (mostly surrounded by untouched,
 * zero-value cells) gets pulled down and spread wider.
 *
 * Independent Review follow-up (Codex, PR #28): two chained passes reach 2 cells out, which
 * let a well-painted coat that (correctly) stops right at `SAUCE_TARGET_RADIUS` bleed a
 * whisper of visible color (just over `MIN_VISIBLE_VALUE`) into cells in the rim band beyond
 * it -- `IDEAL_MARGHERITA_SAUCE_FIXTURE` itself, whose authoritative `edgeAmount` is exactly
 * 0, newly lit up 19 such cells. That is display painting sauce the ふち (edge) evaluation
 * says isn't there. Fixed by never letting the blur *raise* a rim-band cell (distance from
 * center beyond `SAUCE_TARGET_RADIUS`, same boundary `edgeAmount`/`edgeRatio` score against)
 * above its own raw value -- `Math.min` against `field` there, every other cell (everywhere
 * an isolated dab/short stroke actually happens in normal play) still gets the full two-pass
 * smoothing untouched.
 */
export function smoothSauceFieldForDisplay(field: Float64Array): Float64Array {
  const smoothed = blurPass(blurPass(field));
  for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
    for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
      const idx = row * SAUCE_FIELD_SIZE + col;
      if (distanceFromCenter(cellCenterPercent(col), cellCenterPercent(row)) > SAUCE_TARGET_RADIUS) {
        smoothed[idx] = Math.min(smoothed[idx], field[idx]);
      }
    }
  }
  return smoothed;
}

/**
 * Human Feel Fix 3 (Sauce Visual): one RGBA byte quadruple per field cell -- a
 * `SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE * 4`-length buffer, out-of-dough cells and untouched
 * cells left fully transparent (all zero). This is deliberately *pixels*, not shapes: the
 * caller (PizzaStage.tsx) writes it 1:1 into a tiny `SAUCE_FIELD_SIZE`x`SAUCE_FIELD_SIZE`
 * canvas and draws that scaled up with `imageSmoothingEnabled` on, so the browser's own
 * image upscaler blends every cell into its neighbors continuously -- there is no per-cell
 * rect/circle left to tile into a visible grid/stamp pattern the way both the original flat
 * `fillRect` cells and Fix 2's overlapping-circle cells still could. Pulled out as its own
 * pure function (no Canvas API used here at all) specifically so this "one pixel per cell,
 * alpha only, no shape" property is unit-testable without a real browser -- see
 * sauceField.test.ts. Human Feel Fix 4 only changed the color source (now SSOT'd, see
 * `SAUCE_TOMATO_HEX` above) and the value->alpha curve (`densityToAlpha` above); the
 * one-pixel-per-cell/no-shape structure this comment describes is unchanged.
 */
export function sauceFieldToRgbaPixels(field: Float64Array): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE * 4);
  for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
    for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
      if (!isCellInsideDough(row, col)) continue;
      const value = field[row * SAUCE_FIELD_SIZE + col];
      if (value <= MIN_VISIBLE_VALUE) continue;
      const alpha = densityToAlpha(value);
      const pixelIndex = (row * SAUCE_FIELD_SIZE + col) * 4;
      pixels[pixelIndex] = SAUCE_HEATMAP_COLOR.r;
      pixels[pixelIndex + 1] = SAUCE_HEATMAP_COLOR.g;
      pixels[pixelIndex + 2] = SAUCE_HEATMAP_COLOR.b;
      pixels[pixelIndex + 3] = Math.round(alpha * 255);
    }
  }
  return pixels;
}
