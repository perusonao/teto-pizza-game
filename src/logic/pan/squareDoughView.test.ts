import { describe, expect, it } from "vitest";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { squareDoughGaugeStore } from "./squareDoughGaugeStore";
import { pressAt } from "./squareDoughSpread";
import { createInitialSquareDough, squareDoughEvenness } from "./squareDough";
import {
  CORNER_MARKS,
  changedCells,
  changePoints,
  cornerHint,
  smoothnessText,
  thicknessFill,
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
  it("is empty for identical sheets and for a change too small to move any colour channel", () => {
    const a = createLumpySquareDough();
    expect(changedCells(a, a)).toEqual([]);
    const b = { ...a, thickness: a.thickness.map((v, i) => (i === 40 ? v + 1e-9 : v)) };
    expect(thicknessFill(b.thickness[40])).toBe(thicknessFill(a.thickness[40]));
    expect(changedCells(a, b)).toEqual([]);
  });
  it("lists exactly the cells whose drawn colour differs", () => {
    const a = createLumpySquareDough();
    const b = { ...a, thickness: a.thickness.map((v, i) => (i === 40 || i === 41 ? v + 0.05 : v)) };
    expect(changedCells(a, b)).toEqual([40, 41]);
  });
  it("marks a cell iff its drawn colour changed, for presses all over the sheet (CI webkit-390x844 shard 3 regression)", () => {
    const a = createLumpySquareDough();
    for (let x = 20; x <= 80; x += 3) {
      for (let y = 20; y <= 80; y += 3) {
        const b = pressAt(a, { x, y });
        const marked = new Set(changedCells(a, b));
        for (let i = 0; i < a.thickness.length; i++) {
          const recoloured = thicknessFill(a.thickness[i]) !== thicknessFill(b.thickness[i]);
          expect(marked.has(i), `press ${x},${y} cell ${i}`).toBe(recoloured);
        }
      }
    }
  });
  it("a real press changes only the cells it touched", () => {
    const a = createLumpySquareDough();
    const b = pressAt(a, { x: 58, y: 48 });
    const cells = changedCells(a, b);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThan(80);
  });
});

describe("gauge numbers", () => {
  it("shows the real evenness as a one-decimal percentage, clamped", () => {
    expect(smoothnessText(0.7412)).toBe("74.1%");
    expect(smoothnessText(2)).toBe("100.0%");
    expect(smoothnessText(Number.NaN)).toBe("0.0%");
  });
  it("reports 'no change' (null) for a change that rounds to 0.0, never a fake tick", () => {
    expect(changePoints(0.74, 0.74)).toBeNull();
    expect(changePoints(0.74, 0.74049)).toBeNull();
    expect(changePoints(0.74, 0.7425)).toBeCloseTo(0.25, 5);
    expect(changePoints(0.74, 0.73)).toBeCloseTo(-1, 5);
    expect(changePoints(Number.NaN, 0.5)).toBeNull();
  });
  it("a real press moves the evenness by exactly what the gauge change says", () => {
    const a = createLumpySquareDough();
    const b = pressAt(a, { x: 58, y: 48 });
    const points = changePoints(squareDoughEvenness(a), squareDoughEvenness(b));
    expect(points).not.toBeNull();
    expect(points!).toBeCloseTo((squareDoughEvenness(b) - squareDoughEvenness(a)) * 100, 9);
  });
});

describe("squareDoughGaugeStore", () => {
  it("holds the dough pushed, bumps seq per change report (with its metric), notifies, and resets", () => {
    squareDoughGaugeStore.reset();
    let calls = 0;
    const off = squareDoughGaugeStore.subscribe(() => calls++);
    const dough = createLumpySquareDough();
    squareDoughGaugeStore.setDough(dough);
    squareDoughGaugeStore.setCommitted(dough);
    expect(squareDoughGaugeStore.get().dough).toBe(dough);
    expect(squareDoughGaugeStore.get().committed).toBe(dough);
    squareDoughGaugeStore.reportChange(1.2, "evenness");
    const first = squareDoughGaugeStore.get().change!;
    squareDoughGaugeStore.reportChange(null, "coverage");
    const second = squareDoughGaugeStore.get().change!;
    expect(first.points).toBe(1.2);
    expect(first.metric).toBe("evenness");
    expect(second.points).toBeNull();
    expect(second.metric).toBe("coverage");
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(calls).toBeGreaterThanOrEqual(3);
    off();
    squareDoughGaugeStore.reset();
    expect(squareDoughGaugeStore.get()).toEqual({ dough: null, committed: null, change: null });
  });
});

describe("colour ramps", () => {
  it("the lumpy ramp is the one B2 shipped (default argument unchanged)", () => {
    expect(thicknessRgb(0.3)).toEqual(thicknessRgb(0.3, "lumpy"));
    expect(thicknessFill(0.6)).toBe(thicknessFill(0.6, "lumpy"));
    expect(thicknessRgb(0.3, "lumpy")).toEqual([250, 238, 208]);
    expect(thicknessRgb(0.9, "lumpy")).toEqual([166, 98, 38]);
  });
  it("the ball ramp has two zones: the thin film (0.05..0.30) and the thick remnant (0.30..1.0) are both readable", () => {
    expect(thicknessRgb(0.05, "ball")).toEqual([250, 238, 208]);
    expect(thicknessRgb(1, "ball")).toEqual([166, 98, 38]);
    expect(thicknessRgb(2, "ball")).toEqual([166, 98, 38]); // clamped
    // the film zone gets 60 % of the colour travel: it meets the thick zone at u = 0.6
    expect(thicknessRgb(0.3, "ball")).toEqual(thicknessRgb(0.3, "ball"));
    for (let t = 0.08; t <= 0.28; t += 0.04) {
      expect(dE(thicknessRgb(t, "ball"), thicknessRgb(t + 0.02, "ball")), `film ${t.toFixed(2)}`).toBeGreaterThanOrEqual(2.2);
    }
    for (let t = 0.35; t <= 0.9; t += 0.1) {
      expect(dE(thicknessRgb(t, "ball"), thicknessRgb(t + 0.1, "ball")), `remnant ${t.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
    // darker with thickness all the way (a thick lump is never lighter than a thinner one) and always a dough hue
    let prev = Infinity;
    for (let t = 0.05; t <= 1.0001; t += 0.01) {
      const [r, g, b] = thicknessRgb(t, "ball");
      expect(r > g && g > b).toBe(true);
      expect(r + g + b).toBeLessThanOrEqual(prev);
      prev = r + g + b;
    }
    // the old ramp (linear 0.05..0.5) showed nothing above 0.5: the remnants that carry the unevenness were invisible
    expect(dE(thicknessRgb(0.6, "ball"), thicknessRgb(0.8, "ball"))).toBeGreaterThan(6);
    expect(dE(thicknessRgb(0.1, "lumpy"), thicknessRgb(0.2, "lumpy"))).toBe(0); // and the lumpy ramp stays what B2 shipped
  });
  it("changedCells follows the ramp it is told (a change the ramp cannot show is not a changed cell)", () => {
    const a = { thickness: new Array<number>(256).fill(0) };
    a.thickness[120] = 0.1;
    const b = { thickness: a.thickness.slice() };
    b.thickness[120] = 0.2;
    expect(changedCells(a, b, "lumpy")).toEqual([]);
    expect(changedCells(a, b, "ball")).toEqual([120]);
  });
});

describe("corner marks and hints", () => {
  it("four marks inside the pan corners, NW NE SE SW", () => {
    expect(CORNER_MARKS).toHaveLength(4);
    expect(CORNER_MARKS[0].x).toBeLessThan(50);
    expect(CORNER_MARKS[0].y).toBeLessThan(50);
    expect(CORNER_MARKS[2].x).toBeGreaterThan(50);
    expect(CORNER_MARKS[2].y).toBeGreaterThan(50);
  });
  it("the hint runs from the dough's outermost point toward the corner to the corner mark", () => {
    const ball = createInitialSquareDough();
    for (let c = 0; c < 4; c++) {
      const h = cornerHint(ball, c);
      expect(h.to).toEqual(CORNER_MARKS[c]);
      expect(Math.hypot(h.from.x - 50, h.from.y - 50)).toBeLessThan(Math.hypot(h.to.x - 50, h.to.y - 50));
    }
    const lumpy = createLumpySquareDough();
    const h = cornerHint(lumpy, 1);
    expect(Math.hypot(h.from.x - h.to.x, h.from.y - h.to.y)).toBeLessThan(2); // the dough already reaches the mark
  });
});
