import { describe, expect, it } from "vitest";
import type { BakeTarget } from "../data/recipes";
import {
  bakeVisualStage,
  cheeseVisualFrame,
  charIntensity,
  computeBakeHeat,
  doughVisualColors,
  meltIntensity,
  rawSheenIntensity,
  toastIntensity,
  toppingVisualFrame,
} from "./bakeVisual";

const TARGET: BakeTarget = { start: 60, end: 80 };

describe("computeBakeHeat", () => {
  it("is 0 at progress 0, 1 at the target center, 2 at progress 100", () => {
    expect(computeBakeHeat(0, TARGET)).toBeCloseTo(0);
    expect(computeBakeHeat(70, TARGET)).toBeCloseTo(1);
    expect(computeBakeHeat(100, TARGET)).toBeCloseTo(2);
  });

  it("is monotonically non-decreasing across the full progress range", () => {
    let previous = -Infinity;
    for (let progress = 0; progress <= 100; progress += 1) {
      const heat = computeBakeHeat(progress, TARGET);
      expect(heat).toBeGreaterThanOrEqual(previous);
      previous = heat;
    }
  });

  it("has no discontinuity at the scoring boundary (start/end)", () => {
    const epsilon = 0.001;
    const belowStart = computeBakeHeat(TARGET.start - epsilon, TARGET);
    const atStart = computeBakeHeat(TARGET.start, TARGET);
    const aboveStart = computeBakeHeat(TARGET.start + epsilon, TARGET);
    expect(Math.abs(aboveStart - belowStart)).toBeLessThan(0.01);
    expect(Math.abs(atStart - belowStart)).toBeLessThan(0.01);

    const belowEnd = computeBakeHeat(TARGET.end - epsilon, TARGET);
    const aboveEnd = computeBakeHeat(TARGET.end + epsilon, TARGET);
    expect(Math.abs(aboveEnd - belowEnd)).toBeLessThan(0.01);
  });

  it("clamps progress outside [0, 100]", () => {
    expect(computeBakeHeat(-20, TARGET)).toBeCloseTo(0);
    expect(computeBakeHeat(150, TARGET)).toBeCloseTo(2);
  });

  it("handles an asymmetric target without dividing by zero", () => {
    const edgeTarget: BakeTarget = { start: 0, end: 10 };
    expect(() => computeBakeHeat(0, edgeTarget)).not.toThrow();
    const fullTarget: BakeTarget = { start: 100, end: 100 };
    expect(Number.isFinite(computeBakeHeat(50, fullTarget))).toBe(true);
  });
});

describe("intensity ramps", () => {
  it.each([
    ["meltIntensity", meltIntensity],
    ["toastIntensity", toastIntensity],
    ["charIntensity", charIntensity],
  ] as const)("%s stays within [0, 1] and is monotonically non-decreasing", (_name, fn) => {
    let previous = -Infinity;
    for (let heat = 0; heat <= 2; heat += 0.02) {
      const value = fn(heat);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it("rawSheenIntensity fades out monotonically as heat rises", () => {
    expect(rawSheenIntensity(0)).toBeCloseTo(1);
    expect(rawSheenIntensity(1)).toBeCloseTo(0);
    expect(rawSheenIntensity(2)).toBeCloseTo(0);
    let previous = Infinity;
    for (let heat = 0; heat <= 2; heat += 0.02) {
      const value = rawSheenIntensity(heat);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });

  it("charIntensity is 0 until deep into the burnt range", () => {
    expect(charIntensity(1.0)).toBe(0);
    expect(charIntensity(1.6)).toBe(0);
    expect(charIntensity(1.8)).toBeGreaterThan(0);
    expect(charIntensity(2.0)).toBeCloseTo(1);
  });
});

describe("bakeVisualStage", () => {
  it("covers the full raw -> charred progression", () => {
    expect(bakeVisualStage(0)).toBe("raw");
    expect(bakeVisualStage(1)).toBe("good");
    expect(bakeVisualStage(2)).toBe("charred");
  });

  it("is a pure function of the continuous heat scalar (no boundary special-casing)", () => {
    const stages = new Set<string>();
    for (let heat = 0; heat <= 2; heat += 0.01) {
      stages.add(bakeVisualStage(heat));
    }
    expect(stages).toEqual(
      new Set(["raw", "heating", "melting", "browningLight", "good", "browningDeep", "charred"]),
    );
  });
});

describe("doughVisualColors", () => {
  it("reproduces the legacy raw/perfect/burnt anchor colors exactly at heat 0/1/2", () => {
    expect(doughVisualColors(0)).toEqual({ colorA: "rgb(250, 241, 220)", colorB: "rgb(240, 226, 188)" });
    expect(doughVisualColors(1)).toEqual({ colorA: "rgb(238, 194, 122)", colorB: "rgb(201, 134, 60)" });
    expect(doughVisualColors(2)).toEqual({ colorA: "rgb(143, 98, 54)", colorB: "rgb(77, 47, 22)" });
  });

  it("never repeats the same color pair across the full heat range with no jump", () => {
    let previous = doughVisualColors(0);
    for (let heat = 0.02; heat <= 2; heat += 0.02) {
      const current = doughVisualColors(heat);
      expect(current).not.toEqual(previous);
      previous = current;
    }
  });
});

describe("cheeseVisualFrame", () => {
  it("matches the legacy raw/perfect/charred anchor values exactly at heat 0/1/2", () => {
    expect(cheeseVisualFrame(0)).toEqual({ scale: 1, brightness: 1, saturate: 1, sepia: 0 });
    expect(cheeseVisualFrame(1)).toEqual({ scale: 1.16, brightness: 1.06, saturate: 1.12, sepia: 0.14 });
    expect(cheeseVisualFrame(2)).toEqual({ scale: 1.16, brightness: 0.6, saturate: 0.75, sepia: 0.25 });
  });

  it("clamps outside [0, 2]", () => {
    expect(cheeseVisualFrame(-5)).toEqual(cheeseVisualFrame(0));
    expect(cheeseVisualFrame(50)).toEqual(cheeseVisualFrame(2));
  });
});

/**
 * Gameplay UX PR-E (Finished Pizza Visual 2.0): `toppingVisualFrame` is the dedicated,
 * deliberate roast curve that replaces the old accidental `cheeseVisualFrame` reuse on every
 * non-cheese topping (see this module's own file comment above the function). These tests pin
 * the observable contract, not the exact numbers: a topping visibly roasts through bake, a
 * roast-resistant (green herb) topping roasts far more gently, and neither ever reproduces
 * cheese's own melt/toast/char curve exactly.
 */
describe("toppingVisualFrame", () => {
  it("is unchanged (no roast) before the target zone (raw)", () => {
    expect(toppingVisualFrame(0, false)).toEqual({ brightness: 1, saturate: 1, sepia: 0 });
    expect(toppingVisualFrame(0, true)).toEqual({ brightness: 1, saturate: 1, sepia: 0 });
  });

  it("darkens/roasts a normal topping continuously as heat rises past ideal", () => {
    let previousBrightness = Infinity;
    for (let heat = 1; heat <= 2; heat += 0.1) {
      const frame = toppingVisualFrame(heat, false);
      expect(frame.brightness).toBeLessThanOrEqual(previousBrightness + 1e-9);
      previousBrightness = frame.brightness;
    }
    expect(toppingVisualFrame(2, false).brightness).toBeLessThan(toppingVisualFrame(0, false).brightness);
    expect(toppingVisualFrame(2, false).sepia).toBeGreaterThan(0);
  });

  it("roasts a roast-resistant (green herb) topping far more gently than a normal one at the same heat", () => {
    for (const heat of [1.2, 1.6, 2.0]) {
      const normal = toppingVisualFrame(heat, false);
      const herb = toppingVisualFrame(heat, true);
      expect(herb.sepia).toBeLessThan(normal.sepia);
      expect(1 - herb.brightness).toBeLessThan(1 - normal.brightness || 1);
      // Herb saturation must never drop below a normal topping's -- keeping green identifiable
      // is exactly what `bakeRoastResistant` exists for.
      expect(herb.saturate).toBeGreaterThanOrEqual(normal.saturate - 1e-9);
    }
  });

  it("never reproduces cheese's own melt/toast/char curve (a distinct, dedicated curve)", () => {
    for (let heat = 0; heat <= 2; heat += 0.25) {
      const cheese = cheeseVisualFrame(heat);
      const topping = toppingVisualFrame(heat, false);
      if (heat > 0) {
        expect({ brightness: topping.brightness, saturate: topping.saturate, sepia: topping.sepia }).not.toEqual({
          brightness: cheese.brightness,
          saturate: cheese.saturate,
          sepia: cheese.sepia,
        });
      }
    }
  });

  it("clamps outside [0, 2] for both curves", () => {
    expect(toppingVisualFrame(-5, false)).toEqual(toppingVisualFrame(0, false));
    expect(toppingVisualFrame(50, false)).toEqual(toppingVisualFrame(2, false));
    expect(toppingVisualFrame(-5, true)).toEqual(toppingVisualFrame(0, true));
    expect(toppingVisualFrame(50, true)).toEqual(toppingVisualFrame(2, true));
  });
});
