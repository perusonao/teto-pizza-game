import { describe, expect, it } from "vitest";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { squareDoughGaugeStore } from "./squareDoughGaugeStore";
import { pressAt } from "./squareDoughSpread";
import { squareDoughEvenness } from "./squareDough";
import {
  CHANGE_EPSILON,
  changedCells,
  evennessChangePoints,
  smoothnessText,
  thicknessRgb,
} from "./squareDoughView";

/** CIE Lab dE76 (D65), to state the visibility in the unit the Result doc uses. */
function lab([r, g, b]: readonly number[]): [number, number, number] {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a: readonly number[], b: readonly number[]) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

describe("thicknessRgb", () => {
  it("is a baked-dough hue everywhere (R > G > B), never grey", () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const [r, g, b] = thicknessRgb(t);
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });
  it("gets darker as the dough gets thicker, and clamps outside the used range", () => {
    let prev = Infinity;
    for (let t = 0.3; t <= 0.9001; t += 0.05) {
      const [r, g, b] = thicknessRgb(t);
      const sum = r + g + b;
      expect(sum).toBeLessThan(prev);
      prev = sum;
    }
    expect(thicknessRgb(-1)).toEqual(thicknessRgb(0.3));
    expect(thicknessRgb(5)).toEqual(thicknessRgb(0.9));
    expect(thicknessRgb(Number.NaN)).toEqual(thicknessRgb(0.3));
  });
  it("a 0.1 thickness step is clearly visible (dE >= 8; the old ramp gave ~5.8)", () => {
    for (let t = 0.3; t <= 0.8001; t += 0.1) {
      expect(dE(thicknessRgb(t), thicknessRgb(t + 0.1))).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("changedCells", () => {
  it("is empty for identical sheets and for changes at or below the epsilon", () => {
    const a = createLumpySquareDough();
    expect(changedCells(a, a)).toEqual([]);
    const b = { ...a, thickness: a.thickness.map((v, i) => (i === 40 ? v + CHANGE_EPSILON / 2 : v)) };
    expect(changedCells(a, b)).toEqual([]);
  });
  it("lists exactly the cells whose thickness differs", () => {
    const a = createLumpySquareDough();
    const b = { ...a, thickness: a.thickness.map((v, i) => (i === 40 || i === 41 ? v + 0.05 : v)) };
    expect(changedCells(a, b)).toEqual([40, 41]);
  });
  it("a real press changes only the cells it touched", () => {
    const a = createLumpySquareDough();
    const b = pressAt(a, { x: 58, y: 48 });
    const cells = changedCells(a, b);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThan(60);
    const set = new Set(cells);
    for (let i = 0; i < a.thickness.length; i++) if (!set.has(i)) expect(b.thickness[i]).toBe(a.thickness[i]);
  });
});

describe("gauge numbers", () => {
  it("shows the real evenness as a one-decimal percentage, clamped", () => {
    expect(smoothnessText(0.7412)).toBe("74.1%");
    expect(smoothnessText(2)).toBe("100.0%");
    expect(smoothnessText(Number.NaN)).toBe("0.0%");
  });
  it("reports 'no change' (null) for a change that rounds to 0.0, never a fake tick", () => {
    expect(evennessChangePoints(0.74, 0.74)).toBeNull();
    expect(evennessChangePoints(0.74, 0.74049)).toBeNull();
    expect(evennessChangePoints(0.74, 0.7425)).toBeCloseTo(0.25, 5);
    expect(evennessChangePoints(0.74, 0.73)).toBeCloseTo(-1, 5);
    expect(evennessChangePoints(Number.NaN, 0.5)).toBeNull();
  });
  it("a real press moves the evenness by exactly what the gauge change says", () => {
    const a = createLumpySquareDough();
    const b = pressAt(a, { x: 58, y: 48 });
    const points = evennessChangePoints(squareDoughEvenness(a), squareDoughEvenness(b));
    expect(points).not.toBeNull();
    expect(points!).toBeCloseTo((squareDoughEvenness(b) - squareDoughEvenness(a)) * 100, 9);
  });
});

describe("squareDoughGaugeStore", () => {
  it("holds what was pushed, bumps seq per change report, notifies, and resets", () => {
    squareDoughGaugeStore.reset();
    let calls = 0;
    const off = squareDoughGaugeStore.subscribe(() => calls++);
    squareDoughGaugeStore.setEvenness(0.7);
    expect(squareDoughGaugeStore.get().evenness).toBe(0.7);
    squareDoughGaugeStore.reportChange(1.2);
    const first = squareDoughGaugeStore.get().change!;
    squareDoughGaugeStore.reportChange(null);
    const second = squareDoughGaugeStore.get().change!;
    expect(first.points).toBe(1.2);
    expect(second.points).toBeNull();
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(calls).toBeGreaterThanOrEqual(3);
    off();
    squareDoughGaugeStore.reset();
    expect(squareDoughGaugeStore.get()).toEqual({ evenness: null, change: null });
  });
});
