import { describe, expect, it } from "vitest";
import {
  buildSauceField,
  insideDoughShapeFraction,
  isCellInsideDoughShape,
  sauceFieldToRgbaPixels,
  smoothSauceFieldForDisplay,
  type SauceDepositLike,
} from "./sauceField";
import { createIdealDoughShape, type DoughShape } from "./doughShape";
import {
  buildSauceDisplayPixels,
  SAUCE_DISPLAY_GRID,
  SAUCE_DISPLAY_RIM_TAPER_END_CELLS,
  SAUCE_DISPLAY_RIM_TAPER_START_CELLS,
  SAUCE_DISPLAY_SIGMA_CELLS,
  SAUCE_DISPLAY_VISIBLE_VALUE,
} from "./sauceDisplay";
import { IDEAL_MARGHERITA_SAUCE_FIXTURE } from "../data/referencePizza";
import { SAUCE_RATE_PER_TICK } from "./sauceQuantity";
import { STROKE_FIXTURES } from "./testSupport/sauceStrokeFixtures";
import {
  alphaOfRgba,
  CORE_ALPHA,
  EXTENT_ALPHA,
  shapeStats,
  upscaleAlpha,
} from "./testSupport/sauceDisplayMetrics";
import sauceDisplaySource from "./sauceDisplay.ts?raw";

/**
 * Issue #475 Slice 1 (A1): the display rasterizer draws round, smooth-edged paint where the old 16x16
 * display drew squares and staircases -- without moving, growing or shrinking the paint, and without
 * touching anything scoring reads (that is pinned separately, sauceMetrics.slice1Pin.test.ts).
 *
 * The OLD display is reproduced here from the untouched functions it was made of (`buildSauceField` ->
 * `smoothSauceFieldForDisplay` -> `sauceFieldToRgbaPixels`, bilinear-upscaled like drawImage) so every
 * "same extent / no farther / smoother" claim is checked against the real previous behaviour.
 *
 * These are PROXIES on bilinear upscales: Chromium's and WebKit's real drawImage filters differ a little,
 * so the acceptance numbers (shape distortion, edge roughness measured on the real canvas) are asserted in
 * the browser spec (e2e/sauce-edge-475.spec.ts, Chromium + WebKit), not here.
 */

const SHAPE = createIdealDoughShape();
const COLOR = "#c73b2e";
const FLOOR_ALPHA = Math.round(0.46 * 255);

const NAMED: Record<string, readonly SauceDepositLike[]> = {
  ...STROKE_FIXTURES,
  IDEAL_MARGHERITA: IDEAL_MARGHERITA_SAUCE_FIXTURE,
};

function oldDisplayAlpha16(deposits: readonly SauceDepositLike[]): Float32Array {
  const inside = deposits
    .map((d) => ({ x: d.x, y: d.y, amount: d.amount * insideDoughShapeFraction(SHAPE, d.x, d.y) }))
    .filter((d) => d.amount > 0);
  const field = smoothSauceFieldForDisplay(buildSauceField(inside));
  return alphaOfRgba(sauceFieldToRgbaPixels(field, COLOR, (r, c) => isCellInsideDoughShape(r, c, SHAPE)));
}
const newAlpha64 = (deposits: readonly SauceDepositLike[], shape: DoughShape = SHAPE) =>
  alphaOfRgba(buildSauceDisplayPixels(deposits, shape, COLOR));

function farthestPaint(alpha: ArrayLike<number>, grid: number): number {
  let far = 0;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (alpha[y * grid + x] >= EXTENT_ALPHA) {
        far = Math.max(far, Math.hypot(((x + 0.5) / grid) * 100 - 50, ((y + 0.5) / grid) * 100 - 50));
      }
    }
  }
  return far;
}

function depositCentroid(deposits: readonly SauceDepositLike[]): { x: number; y: number } {
  let w = 0;
  let sx = 0;
  let sy = 0;
  for (const d of deposits) {
    const weight = d.amount * insideDoughShapeFraction(SHAPE, d.x, d.y);
    w += weight;
    sx += weight * d.x;
    sy += weight * d.y;
  }
  return { x: sx / w, y: sy / w };
}

describe("buildSauceDisplayPixels: output contract", () => {
  it("is a 64x64 RGBA buffer, fully transparent for no deposits", () => {
    const pixels = buildSauceDisplayPixels([], SHAPE, COLOR);
    expect(SAUCE_DISPLAY_GRID).toBe(64);
    expect(pixels).toHaveLength(64 * 64 * 4);
    expect(pixels.every((v) => v === 0)).toBe(true);
  });

  it("paints nothing for a deposit that is entirely off the dough", () => {
    const pixels = buildSauceDisplayPixels([{ x: 2, y: 2, amount: SAUCE_RATE_PER_TICK }], SHAPE, COLOR);
    expect(pixels.every((v) => v === 0)).toBe(true);
  });

  it("uses the sauce's own colour and keeps the shared alpha floor (0.46) on every fully-inside pixel", () => {
    const pixels = buildSauceDisplayPixels(STROKE_FIXTURES.SPIRAL_R30, SHAPE, "#6b8e3d");
    let painted = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue;
      painted += 1;
      expect([pixels[i], pixels[i + 1], pixels[i + 2]]).toEqual([0x6b, 0x8e, 0x3d]);
    }
    expect(painted).toBeGreaterThan(500);
    // Away from the crust edge (where the silhouette anti-alias lowers alpha) nothing is below the floor.
    const alpha = alphaOfRgba(pixels);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const a = alpha[y * 64 + x];
        if (a === 0) continue;
        if (Math.hypot(((x + 0.5) / 64) * 100 - 50, ((y + 0.5) / 64) * 100 - 50) < 44) {
          expect(a).toBeGreaterThanOrEqual(FLOOR_ALPHA - 1);
        }
      }
    }
  });

  it("exposes the calibrated constants (a change here is a visible change: re-run the extent tests)", () => {
    expect(SAUCE_DISPLAY_SIGMA_CELLS).toBe(1.26);
    expect(SAUCE_DISPLAY_VISIBLE_VALUE).toBe(0.00404);
    expect([SAUCE_DISPLAY_RIM_TAPER_START_CELLS, SAUCE_DISPLAY_RIM_TAPER_END_CELLS]).toEqual([1.2, 2.8]);
  });
});

describe("determinism (Issue #475 criterion 8)", () => {
  it("the same deposits and shape give the same bytes, every time, without mutating the input", () => {
    const deposits = STROKE_FIXTURES.SPIRAL_R38.map((d) => ({ ...d }));
    const snapshot = JSON.stringify(deposits);
    const first = buildSauceDisplayPixels(deposits, SHAPE, COLOR);
    for (let i = 0; i < 3; i += 1) expect(buildSauceDisplayPixels(deposits, SHAPE, COLOR)).toEqual(first);
    expect(JSON.stringify(deposits)).toBe(snapshot);
  });

  it("redrawing a growing stroke tick by tick gives exactly the bytes a from-scratch build gives", () => {
    const stroke = STROKE_FIXTURES.SPIRAL_R38;
    const other = [{ x: 20, y: 20, amount: SAUCE_RATE_PER_TICK }];
    for (let n = 1; n <= stroke.length; n += 5) {
      const growing = buildSauceDisplayPixels(stroke.slice(0, n), SHAPE, COLOR);
      buildSauceDisplayPixels(other, SHAPE, COLOR); // evicts the incremental cache
      const scratch = buildSauceDisplayPixels(stroke.slice(0, n), SHAPE, COLOR);
      expect(growing).toEqual(scratch);
    }
  });

  it("a different stroke, shape or deposit amount never reuses a stale density", () => {
    const a = buildSauceDisplayPixels(STROKE_FIXTURES.CENTER_HOLD, SHAPE, COLOR);
    const edited = STROKE_FIXTURES.CENTER_HOLD.map((d, i) => (i === 3 ? { ...d, amount: d.amount * 2 } : d));
    const b = buildSauceDisplayPixels(edited, SHAPE, COLOR);
    expect(b).not.toEqual(a);
    expect(buildSauceDisplayPixels(STROKE_FIXTURES.CENTER_HOLD, SHAPE, COLOR)).toEqual(a);
  });

  it("deposit order does not matter beyond float rounding (at most one alpha level)", () => {
    const forward = newAlpha64(STROKE_FIXTURES.SPIRAL_R38);
    const reversed = newAlpha64([...STROKE_FIXTURES.SPIRAL_R38].reverse());
    let worst = 0;
    for (let i = 0; i < forward.length; i += 1) worst = Math.max(worst, Math.abs(forward[i] - reversed[i]));
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("the per-silhouette cache never leaks one dough shape into another", () => {
    const small: DoughShape = { radii: new Array(8).fill(30) };
    const a1 = buildSauceDisplayPixels(STROKE_FIXTURES.RING_TAPS, SHAPE, COLOR);
    const b = buildSauceDisplayPixels(STROKE_FIXTURES.RING_TAPS, small, COLOR);
    const a2 = buildSauceDisplayPixels(STROKE_FIXTURES.RING_TAPS, SHAPE, COLOR);
    expect(a2).toEqual(a1);
    expect(b).not.toEqual(a1);
  });

  it("the source has no randomness and no clock (a pure function of deposits and shape)", () => {
    expect(sauceDisplaySource).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date\(/);
  });
});

describe("silhouette (PR #66 boundary contract is unchanged)", () => {
  it("never paints past the dough's own silhouette, by more than the one-pixel anti-alias", () => {
    const small: DoughShape = { radii: new Array(8).fill(30) };
    const alpha = newAlpha64(STROKE_FIXTURES.CENTER_HOLD.map((d) => ({ ...d, x: 50, y: 50 })), small);
    const spread = newAlpha64(
      Array.from({ length: 40 }, (_, i) => ({ x: 50 + Math.cos(i) * 28, y: 50 + Math.sin(i) * 28, amount: SAUCE_RATE_PER_TICK })),
      small,
    );
    for (const map of [alpha, spread]) {
      for (let y = 0; y < 64; y += 1) {
        for (let x = 0; x < 64; x += 1) {
          const r = Math.hypot(((x + 0.5) / 64) * 100 - 50, ((y + 0.5) / 64) * 100 - 50);
          // doughShapeRadiusAtAngle is a straight-edged octagon: its inscribed radius is cos(22.5deg) * 30.
          if (r > 30 + 100 / 64) expect(map[y * 64 + x]).toBe(0);
        }
      }
    }
  });
});

describe("shape, extent and position against the old display (Issue #475 criteria 1-4)", () => {
  it("a held dab is round (criterion 1: distortion <= 1.15)", () => {
    const stats = shapeStats(upscaleAlpha(newAlpha64(STROKE_FIXTURES.CENTER_HOLD), 64, 200), CORE_ALPHA);
    expect(stats.distortion).toBeGreaterThan(0);
    expect(stats.distortion).toBeLessThanOrEqual(1.15);
  });

  it("stroke edges are smoother than the old display and stay within the roughness budget (criterion 2)", () => {
    for (const name of ["SPIRAL_R30", "RING_TAPS", "IDEAL_MARGHERITA"] as const) {
      const deposits = NAMED[name];
      const before = shapeStats(upscaleAlpha(oldDisplayAlpha16(deposits), 16, 200), CORE_ALPHA);
      const after = shapeStats(upscaleAlpha(newAlpha64(deposits), 64, 200), CORE_ALPHA);
      // 0.5% on a bilinear proxy at 200px (the browser spec holds the real 0.4% line on the real canvas).
      expect(after.roughnessPct, name).toBeLessThanOrEqual(0.5);
      expect(after.roughnessPct, name).toBeLessThan(before.roughnessPct * 0.7);
    }
  });

  it.each(Object.keys(NAMED))("%s: painted extent stays within 5% of the old display (criterion 3)", (name) => {
    const deposits = NAMED[name];
    const before = shapeStats(upscaleAlpha(oldDisplayAlpha16(deposits), 16, 64), EXTENT_ALPHA).areaPct;
    const after = shapeStats(upscaleAlpha(newAlpha64(deposits), 64, 64), EXTENT_ALPHA).areaPct;
    expect(before).toBeGreaterThan(0);
    expect(Math.abs((after - before) / before) * 100).toBeLessThanOrEqual(5);
  });

  it.each(Object.keys(NAMED))("%s: never reaches farther out than the old display (the crust-band reach is kept)", (name) => {
    const deposits = NAMED[name];
    const before = farthestPaint(upscaleAlpha(oldDisplayAlpha16(deposits), 16, 64).alpha, 64);
    const after = farthestPaint(upscaleAlpha(newAlpha64(deposits), 64, 64).alpha, 64);
    expect(after).toBeLessThanOrEqual(before + 0.5);
  });

  it.each(["CENTER_HOLD", "SINGLE_TAP", "RING_TAPS", "SPIRAL_R30", "SPIRAL_R38", "IDEAL_MARGHERITA"])(
    "%s: the paint's centre of mass sits within 1% of the deposits' own (criterion 4)",
    (name) => {
      const deposits = NAMED[name];
      const truth = depositCentroid(deposits);
      const stats = shapeStats(upscaleAlpha(newAlpha64(deposits), 64, 64), EXTENT_ALPHA);
      expect(Math.hypot(stats.cx - truth.x, stats.cy - truth.y)).toBeLessThanOrEqual(1);
    },
  );

  it("a held dab appears under the finger (the old display snapped it to a cell centre, up to ~3% off)", () => {
    // Positions well inside the ideal ring: near the crust a thick dab is cut at the ring on both displays.
    for (const [x, y] of [[50, 50], [40, 44], [57.3, 58.1], [44.9, 53.3], [53, 41.5]]) {
      const deposits = Array.from({ length: 12 }, () => ({ x, y, amount: SAUCE_RATE_PER_TICK }));
      const after = shapeStats(upscaleAlpha(newAlpha64(deposits), 64, 64), EXTENT_ALPHA);
      const before = shapeStats(upscaleAlpha(oldDisplayAlpha16(deposits), 16, 64), EXTENT_ALPHA);
      expect(Math.hypot(after.cx - x, after.cy - y)).toBeLessThanOrEqual(0.4);
      expect(Math.hypot(after.cx - x, after.cy - y)).toBeLessThanOrEqual(Math.hypot(before.cx - x, before.cy - y) + 0.05);
    }
  });
});

describe("one display path: the Reference views and the live pizza draw the same way (criterion 5)", () => {
  const components = import.meta.glob("../components/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const logic = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const isTest = (path: string) => /\.test\.tsx?$/.test(path);

  it("every sauce heatmap on screen (PizzaStage, ReferencePreview, ReferenceThumbnail, PlayerReferencePreview) goes through SauceHeatmapCanvas", () => {
    for (const file of ["PizzaStage", "ReferencePreview", "ReferenceThumbnail", "PlayerReferencePreview"]) {
      const source = components[`../components/${file}.tsx`];
      expect(source, file).toBeTruthy();
      expect(source, file).toMatch(/<SauceHeatmapCanvas/);
    }
  });

  it("SauceHeatmapCanvas is the only caller of the display rasterizer, and nothing else rasterizes the old 16x16 field for the screen", () => {
    const displayCallers = Object.entries(components).filter(([p, s]) => !isTest(p) && s.includes("buildSauceDisplayPixels(")).map(([p]) => p);
    expect(displayCallers).toEqual(["../components/SauceHeatmapCanvas.tsx"]);
    const oldCallers = [...Object.entries(components), ...Object.entries(logic)]
      .filter(([p, s]) => !isTest(p) && s.includes("sauceFieldToRgbaPixels("))
      .map(([p]) => p);
    expect(oldCallers).toEqual(["./sauceField.ts"]);
  });

  it("the Reference fixture and a live stroke take the same builder and produce the same pixels for the same deposits", () => {
    const deposits = IDEAL_MARGHERITA_SAUCE_FIXTURE;
    expect(buildSauceDisplayPixels(deposits, createIdealDoughShape(), COLOR)).toEqual(buildSauceDisplayPixels([...deposits], createIdealDoughShape(), COLOR));
  });
});
