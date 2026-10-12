import { describe, expect, it } from "vitest";
import type { BakeTarget } from "../data/recipes";
import {
  LOBE_ALPHA_SCALE,
  bakeVisualStage,
  cheeseVisualFrame,
  charIntensity,
  computeBakeHeat,
  doughVisualColors,
  cheeseMeltCssVars,
  cheeseMeltJitter,
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
        else if (name === "--bake-cheese-spread" || name === "--bake-cheese-aspect") expect(value, name).toMatch(/^\d\.\d{3}$/);
        else if (/^--bake-cheese-(radius|body-at|bleed-off|sp\d-at|sp\d-r)$/.test(name)) {
          // geometry resolved in TypeScript: plain percentages / lengths (and the `/` of border-radius), never CSS math
          expect(value, name).toMatch(/^[-\d.]+(%|px)?( [-\d.]+(%|px)?| \/ [-\d.]+%)*$/);
        } else expect(value, name).toMatch(/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, [01](\.\d{1,3})?\)$/);
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
    // M1: the lobes are a quiet edge (LOBE_ALPHA_SCALE of the A5 strength 0.6), not the A5 cloud
    expect(alpha(perfect["--bake-cheese-lobe-a"])).toBeCloseTo(0.6 * LOBE_ALPHA_SCALE, 2);
    expect(alpha(perfect["--bake-cheese-lobe-a"])).toBeGreaterThan(0.1);
    expect(alpha(perfect["--bake-cheese-spot"])).toBeGreaterThan(0.4); // visible golden blotches at the properly baked point
  });

  it("raw heat draws the original raw gradient colours at full alpha and none of the melted body", () => {
    const v = vars(0);
    expect(rgb(v["--bake-cheese-raw-0"])).toEqual([255, 253, 245]); // #fffdf5
    expect(rgb(v["--bake-cheese-raw-1"])).toEqual([243, 234, 208]); // #f3ead0
    expect(rgb(v["--bake-cheese-raw-2"])).toEqual([230, 216, 174]); // #e6d8ae
    for (const k of ["raw-0", "raw-1", "raw-2"]) expect(alpha(v[`--bake-cheese-${k}`]), k).toBe(1);
    for (const k of ["body-0", "body-1", "body-2", "body-3"]) expect(alpha(v[`--bake-cheese-${k}`]), k).toBe(0);
    expect(v["--bake-cheese-halo"], "M1 removed the halo variable").toBeUndefined();
  });

  it("melted cheese: the white lump is gone, the body is cream (not white) with a feathered edge (and no halo, M1)", () => {
    const melted = vars(1);
    for (const k of ["raw-0", "raw-1", "raw-2"]) expect(alpha(melted[`--bake-cheese-${k}`]), k).toBe(0);
    expect(alpha(melted["--bake-cheese-body-0"])).toBe(1);
    expect(alpha(melted["--bake-cheese-body-1"])).toBe(1);
    // feathered: the outermost stop is clearly more transparent than the core (M1: no halo carries on outside the box)
    expect(alpha(melted["--bake-cheese-body-3"])).toBeLessThan(alpha(melted["--bake-cheese-body-0"]));
    expect(alpha(melted["--bake-cheese-body-3"])).toBeGreaterThan(0.3);
    expect(melted["--bake-cheese-halo"]).toBeUndefined();
    // A5: milky ivory, neither the raw lump's blown-out #fffdf5 nor yellow: a small warm cast (red - blue 8..30), clearly
    // darker than the raw core, and the outer stops are no more yellow than the core (no yolk-like warm centre)
    const core = rgb(melted["--bake-cheese-body-0"]);
    const edge = rgb(melted["--bake-cheese-body-2"]);
    expect(core[0] - core[2]).toBeGreaterThanOrEqual(8);
    expect(core[0] - core[2]).toBeLessThanOrEqual(30);
    expect(core[0] + core[1] + core[2]).toBeLessThan(255 + 253 + 245 - 30);
    expect(edge[0] - edge[2]).toBeLessThanOrEqual(core[0] - core[2] + 12);
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

  it("A4: the per-piece variation is deterministic, differs between pieces, and leaves the raw cheese untouched", () => {
    const keyA = "mozzarella:40.00:50.00";
    const keyB = "mozzarella:60.00:50.00";
    const keyC = "mozzarella:50.00:30.00";
    // same key -> identical values, every time (nothing random between renders / BAKE / CUT / RESULT)
    expect(cheeseMeltJitter(keyA, 24)).toEqual(cheeseMeltJitter(keyA, 24));
    expect(cheeseMeltCssVars(cheeseMeltLook(1), keyA)).toEqual(cheeseMeltCssVars(cheeseMeltLook(1), keyA));
    for (const v of cheeseMeltJitter(keyA, 24)) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    // three pieces of one pizza are not the same disc with the same pattern
    const [a, b, c] = [keyA, keyB, keyC].map((k) => cheeseMeltCssVars(cheeseMeltLook(1.2), k));
    for (const name of ["--bake-cheese-radius", "--bake-cheese-spread", "--bake-cheese-sp1-at", "--bake-cheese-sp2-at", "--bake-cheese-sp3-r", "--bake-cheese-body-at"]) {
      expect(new Set([a[name], b[name], c[name]]).size, name).toBe(3);
    }
    // no key -> the A3 look (centres and radii the stylesheet carries as fallbacks)
    const plain = cheeseMeltCssVars(cheeseMeltLook(1.2));
    expect(plain["--bake-cheese-sp1-at"]).toBe("27.0% 34.0%");
    expect(plain["--bake-cheese-sp1-r"]).toBe("2.59px 1.66px"); // the base blotch, scaled to the small A5 size
    expect(plain["--bake-cheese-body-at"]).toBe("46.0% 44.0%");
    // raw cheese: whatever the key, the outline is the raw outline and every blotch / bleed / body layer is invisible
    const raw = cheeseMeltCssVars(cheeseMeltLook(0), keyA);
    expect(raw["--bake-cheese-radius"]).toBe("55.0% 45.0% 48.0% 52.0% / 55.0% 50.0% 50.0% 45.0%");
    expect(raw["--bake-cheese-bleed-off"]).toBe("0.00px 0.00px");
    for (const k of ["spot-1", "spot-2", "spot-3", "spot-4", "spot-soft-1", "spot-soft-4", "bleed", "body-0"]) {
      expect(alpha(raw[`--bake-cheese-${k}`]), k).toBe(0);
    }
  });

  it("A4: the variation stays inside a modest range: outline radii, blotch positions and strengths cannot run away", () => {
    for (let i = 0; i < 200; i += 1) {
      const v = cheeseMeltCssVars(cheeseMeltLook(2), `mozzarella:${i}:${(i * 7) % 100}`);
      for (const r of v["--bake-cheese-radius"].split(/[ /]+/)) {
        const n = parseFloat(r);
        expect(n).toBeGreaterThanOrEqual(24);
        expect(n).toBeLessThanOrEqual(70);
      }
      for (let s = 1; s <= 4; s += 1) {
        const [x, y] = v[`--bake-cheese-sp${s}-at`].split(" ").map(parseFloat);
        expect(x).toBeGreaterThan(5);
        expect(x).toBeLessThan(95);
        expect(y).toBeGreaterThan(5);
        expect(y).toBeLessThan(95);
        const strength = alpha(v[`--bake-cheese-spot-${s}`]);
        expect(strength).toBeGreaterThan(0.6); // toast 1: 1.6 x (0.45..1.3), quiet but visible
        expect(strength).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(parseFloat(v["--bake-cheese-bleed-off"]))).toBeLessThanOrEqual(3);
    }
  });

  it("A5: the five spread lobes differ in strength per piece, stay inside A3's reach, and the lump's drop shadow fades with melt", () => {
    const keys = ["mozzarella:40.00:50.00", "mozzarella:60.00:50.00", "mozzarella:50.00:30.00"];
    const vs = keys.map((k) => cheeseMeltCssVars(cheeseMeltLook(1.2), k));
    for (let i = 1; i <= 5; i += 1) {
      expect(new Set(vs.map((v) => v[`--bake-cheese-lobe-${i}`])).size, `lobe ${i}`).toBeGreaterThan(1);
    }
    expect(new Set(vs.map((v) => v["--bake-cheese-spread"])).size).toBe(3);
    expect(new Set(vs.map((v) => v["--bake-cheese-aspect"])).size).toBe(3);
    for (let i = 0; i < 200; i += 1) {
      const v = cheeseMeltCssVars(cheeseMeltLook(2), `mozzarella:${i}:${(i * 13) % 100}`);
      // reach: lobe offsets are scaled by `spread` (<= 1.1) and strength never exceeds the M1 base (0.6 / 0.5, times LOBE_ALPHA_SCALE)
      expect(parseFloat(v["--bake-cheese-spread"])).toBeLessThanOrEqual(1.1);
      expect(parseFloat(v["--bake-cheese-spread"])).toBeGreaterThanOrEqual(0.6);
      // a modest aspect change only (no giant or squashed piece)
      expect(parseFloat(v["--bake-cheese-aspect"])).toBeGreaterThanOrEqual(0.95);
      expect(parseFloat(v["--bake-cheese-aspect"])).toBeLessThanOrEqual(1.05);
      for (let l = 1; l <= 5; l += 1) expect(alpha(v[`--bake-cheese-lobe-${l}`])).toBeLessThanOrEqual(0.6 * LOBE_ALPHA_SCALE + 0.001);
    }
    // raw keeps the original drop shadow (0.3); fully melted lies flat (<= 0.1)
    expect(alpha(cheeseMeltCssVars(cheeseMeltLook(0), keys[0])["--bake-cheese-drop"])).toBeCloseTo(0.3, 3);
    expect(alpha(cheeseMeltCssVars(cheeseMeltLook(1), keys[0])["--bake-cheese-drop"])).toBeLessThanOrEqual(0.1);
    // raw: the aspect is exactly neutral whatever the key (BAKE starts at melt 0 and the raw width must not move)
    for (let i = 0; i < 100; i += 1) {
      expect(cheeseMeltCssVars(cheeseMeltLook(0), `mozzarella:${i}:${(i * 7) % 100}`)["--bake-cheese-aspect"]).toBe("1.000");
    }
    // it eases in with melt rather than switching on, and reaches its full range only when fully melted
    const widest = Array.from({ length: 200 }, (_, i) => `mozzarella:${i}:${(i * 13) % 100}`);
    const dev = (heat: number) => Math.max(...widest.map((k) => Math.abs(1 - parseFloat(cheeseMeltCssVars(cheeseMeltLook(heat), k)["--bake-cheese-aspect"]))));
    expect(dev(0.6)).toBeLessThan(dev(0.75));
    expect(dev(0.75)).toBeLessThan(dev(1));
    expect(dev(1)).toBeGreaterThan(0.03);
    // raw: every lobe invisible
    for (let l = 1; l <= 5; l += 1) expect(alpha(cheeseMeltCssVars(cheeseMeltLook(0), keys[0])[`--bake-cheese-lobe-${l}`])).toBe(0);
  });

  it("M1: the lobe colour follows the bake (cream -> a little golden -> brown), never brighter than the A5 cream, and the alpha stays quiet", () => {
    const key = "mozzarella:40.00:50.00";
    const lobe = (heat: number) => rgb(cheeseMeltCssVars(cheeseMeltLook(heat), key)["--bake-cheese-lobe-1"]);
    const melted = lobe(0.8); // melt 1, no toast yet: still the cream
    const baked = lobe(1);
    const deep = lobe(1.6);
    const charred = lobe(2);
    expect(melted).toEqual([241, 237, 224]);
    // monotonically darker / warmer as the cheese bakes, ending brown (red > green > blue by a clear margin)
    const sum = (c: number[]) => c[0] + c[1] + c[2];
    expect(sum(baked)).toBeLessThan(sum(melted));
    expect(sum(deep)).toBeLessThan(sum(baked));
    expect(sum(charred)).toBeLessThan(sum(deep));
    expect(charred[0]).toBeGreaterThan(charred[1] + 20);
    expect(charred[1]).toBeGreaterThan(charred[2] + 20);
    for (const heat of [0.8, 1, 1.6, 2]) {
      const v = cheeseMeltCssVars(cheeseMeltLook(heat), key);
      for (let l = 1; l <= 5; l += 1) expect(alpha(v[`--bake-cheese-lobe-${l}`]), `lobe ${l} @${heat}`).toBeLessThanOrEqual(0.22);
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
