import { describe, expect, it } from "vitest";
import type { BakeTarget } from "../data/recipes";
import {
  bakeVisualStage,
  cheeseVisualFrame,
  charIntensity,
  computeBakeHeat,
  doughVisualColors,
  cheeseMeltCssVars,
  cheeseMeltLook,
  cheeseMeltsShape,
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

describe("cheeseMeltLook (#421 Pilot)", () => {
  it("is exactly the existing melt / toast / char intensities of the same heat (no second doneness authority)", () => {
    for (let heat = -0.5; heat <= 2.5; heat += 0.05) {
      expect(cheeseMeltLook(heat)).toEqual({
        melt: meltIntensity(heat),
        toast: toastIntensity(heat),
        char: charIntensity(heat),
      });
    }
  });

  it("raw cheese (heat 0) is all zeros, i.e. the unchanged raw look", () => {
    expect(cheeseMeltLook(0)).toEqual({ melt: 0, toast: 0, char: 0 });
  });

  it("melts before it browns and browns before it chars; all stay in [0, 1] and never decrease", () => {
    let prev = cheeseMeltLook(0);
    for (let heat = 0; heat <= 2; heat += 0.01) {
      const look = cheeseMeltLook(heat);
      for (const key of ["melt", "toast", "char"] as const) {
        expect(look[key]).toBeGreaterThanOrEqual(0);
        expect(look[key]).toBeLessThanOrEqual(1);
        expect(look[key]).toBeGreaterThanOrEqual(prev[key] - 1e-12);
      }
      prev = look;
    }
    const perfect = cheeseMeltLook(1);
    expect(perfect.melt).toBe(1); // fully melted by the target centre
    expect(perfect.toast).toBeGreaterThan(0);
    expect(perfect.toast).toBeLessThan(1);
    expect(perfect.char).toBe(0);
    const burnt = cheeseMeltLook(2);
    expect(burnt.melt).toBe(1);
    expect(burnt.toast).toBe(1);
    expect(burnt.char).toBeCloseTo(1, 10); // (2 - 1.6) / 0.4 is 0.9999999999999998 in floating point
  });
});

describe("cheeseMeltCssVars / opt-in (#421 Pilot)", () => {
  const vars = (heat: number) => cheeseMeltCssVars(cheeseMeltLook(heat));
  const alpha = (css: string) => Number(/,\s*([\d.]+)\)$/.exec(css)![1]);
  const rgb = (css: string) => /rgba\((\d+), (\d+), (\d+),/.exec(css)!.slice(1, 4).map(Number);

  it("only mozzarella opts into the shape melt", () => {
    expect(cheeseMeltsShape("mozzarella")).toBe(true);
    for (const id of ["gorgonzola", "parmigiano", "fontina", "cheddar", "goat-cheese", "pepperoni"]) {
      expect(cheeseMeltsShape(id)).toBe(false);
    }
  });

  it("every value is a finished rgba() string or a plain 0..1 number, never CSS math (no calc inside a colour)", () => {
    for (let heat = -0.5; heat <= 2.5; heat += 0.1) {
      const v = vars(heat);
      for (const [name, value] of Object.entries(v)) {
        expect(value, name).not.toContain("calc");
        if (name === "--bake-melt") expect(value).toMatch(/^[01]?\.?\d*$/);
        else expect(value, name).toMatch(/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, [01](\.\d{1,3})?\)$/);
      }
    }
  });

  it("raw heat is the raw look: ring 0.8, inset 0.55, and no lobes / gloss / pool / spots", () => {
    const v = vars(0);
    expect(v["--bake-melt"]).toBe("0.000");
    expect(alpha(v["--bake-cheese-ring"])).toBeCloseTo(0.8, 3);
    expect(alpha(v["--bake-cheese-inset"])).toBeCloseTo(0.55, 3);
    for (const k of ["gloss", "lobe-a", "lobe-b", "pool", "spot", "spot-soft"]) expect(alpha(v[`--bake-cheese-${k}`]), k).toBe(0);
  });

  it("melting dissolves the ring and brings the lobes in; browning shows by the target centre", () => {
    const perfect = vars(1);
    expect(alpha(perfect["--bake-cheese-ring"])).toBe(0);
    expect(alpha(perfect["--bake-cheese-lobe-a"])).toBeGreaterThan(0.9);
    expect(alpha(perfect["--bake-cheese-spot"])).toBeGreaterThan(0.4); // visible golden blotches at the properly baked point
  });

  it("raw heat draws the original raw gradient colours at full alpha and none of the melted body / halo", () => {
    const v = vars(0);
    expect(rgb(v["--bake-cheese-raw-0"])).toEqual([255, 253, 245]); // #fffdf5
    expect(rgb(v["--bake-cheese-raw-1"])).toEqual([243, 234, 208]); // #f3ead0
    expect(rgb(v["--bake-cheese-raw-2"])).toEqual([230, 216, 174]); // #e6d8ae
    for (const k of ["raw-0", "raw-1", "raw-2"]) expect(alpha(v[`--bake-cheese-${k}`]), k).toBe(1);
    for (const k of ["body-0", "body-1", "body-2", "body-3", "halo"]) expect(alpha(v[`--bake-cheese-${k}`]), k).toBe(0);
  });

  it("melted cheese: the white lump is gone, the body is cream (not white) with a feathered edge and a cream halo", () => {
    const melted = vars(1);
    for (const k of ["raw-0", "raw-1", "raw-2"]) expect(alpha(melted[`--bake-cheese-${k}`]), k).toBe(0);
    expect(alpha(melted["--bake-cheese-body-0"])).toBe(1);
    expect(alpha(melted["--bake-cheese-body-1"])).toBe(1);
    // feathered: the outermost stop is clearly more transparent than the core, and a halo carries on outside the box
    expect(alpha(melted["--bake-cheese-body-3"])).toBeLessThan(alpha(melted["--bake-cheese-body-0"]));
    expect(alpha(melted["--bake-cheese-body-3"])).toBeGreaterThan(0.3);
    expect(alpha(melted["--bake-cheese-halo"])).toBeGreaterThan(0.5);
    // cream, not white: blue is clearly below the raw lump's #fffdf5 core and red stays highest
    const core = rgb(melted["--bake-cheese-body-0"]);
    expect(core[2]).toBeLessThan(225);
    expect(core[0]).toBeGreaterThan(core[1]);
    expect(core[1]).toBeGreaterThan(core[2]);
    // the hard bottom highlight rim is nearly gone
    expect(alpha(melted["--bake-cheese-inset"])).toBeLessThan(0.1);
  });

  it("the raw lump and the melted body cross-fade without a see-through gap, monotonically", () => {
    let prevRaw = 1;
    let prevBody = 0;
    for (let heat = 0; heat <= 1.2; heat += 0.05) {
      const v = vars(heat);
      const raw = alpha(v["--bake-cheese-raw-0"]);
      const body = alpha(v["--bake-cheese-body-0"]);
      expect(raw).toBeLessThanOrEqual(prevRaw + 1e-9);
      expect(body).toBeGreaterThanOrEqual(prevBody - 1e-9);
      // combined core coverage stays high through the whole melt (no translucent mid-melt look)
      expect(1 - (1 - raw) * (1 - body)).toBeGreaterThan(0.8);
      prevRaw = raw;
      prevBody = body;
    }
  });

  it("charred spots are dark BROWN, not grey: red > green > blue by a clear margin, and darker than golden", () => {
    const golden = rgb(vars(1)["--bake-cheese-spot"]);
    const charred = rgb(vars(2)["--bake-cheese-spot"]);
    expect(alpha(vars(2)["--bake-cheese-spot"])).toBe(1);
    expect(charred[0]).toBeGreaterThan(charred[1] + 30);
    expect(charred[1]).toBeGreaterThan(charred[2] + 20);
    expect(charred[0]).toBeLessThan(golden[0]);
    expect(charred[1]).toBeLessThan(golden[1]);
    // monotonic darkening between golden and charred
    let prev = rgb(vars(1.6)["--bake-cheese-spot"]);
    for (let heat = 1.65; heat <= 2; heat += 0.05) {
      const c = rgb(vars(heat)["--bake-cheese-spot"]);
      expect(c[0]).toBeLessThanOrEqual(prev[0]);
      prev = c;
    }
  });
});
