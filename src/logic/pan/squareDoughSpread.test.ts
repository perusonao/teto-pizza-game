import { describe, expect, it } from "vitest";
import { DOUGH_CENTER } from "../pizzaCoordinates";
import { createLumpySquareDough } from "./squareDoughFixtures";
import {
  HOLD_BRUSH_RADIUS_MAX,
  HOLD_GROW_MS,
  HOLD_MAX_STEP_MS,
  HOLD_RATE_PER_S,
  PRESS_BRUSH_RADIUS,
  PRESS_STRENGTH,
  applyPressEffect,
  applyPressEffects,
  holdBrushRadius,
  holdStep,
  pressAt,
  relaxAt,
} from "./squareDoughSpread";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  SQUARE_DOUGH_MAX_THICKNESS,
  createInitialSquareDough,
  isSquareCellOnPan,
  isValidSquareDough,
  squareCellCenter,
  squareCellIndex,
  squareDoughCoverage,
  squareDoughEvenness,
  type SquareDough,
} from "./squareDough";

const N = SQUARE_DOUGH_GRID;
const sum = (d: SquareDough) => d.thickness.reduce((a, b) => a + b, 0);
const coveredSet = (d: SquareDough) => d.thickness.map((t) => t >= SQUARE_COVER_MIN_THICKNESS);

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** A random valid dough: a random subset of the on-pan cells covered, each at a random covered thickness. */
function randomDough(next: () => number): SquareDough {
  const thickness = new Array<number>(N * N).fill(0);
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (isSquareCellOnPan(row, col) && next() < 0.7) {
        thickness[squareCellIndex(row, col)] = SQUARE_COVER_MIN_THICKNESS + next() * (SQUARE_DOUGH_MAX_THICKNESS - SQUARE_COVER_MIN_THICKNESS);
      }
    }
  }
  return { thickness };
}

/** The middle lump of createLumpySquareDough. */
const LUMP = { x: 58, y: 48 };

function changedIndexes(a: SquareDough, b: SquareDough): number[] {
  return a.thickness.flatMap((t, i) => (t !== b.thickness[i] ? [i] : []));
}

function distanceOfIndex(index: number, center: { x: number; y: number }): number {
  const row = Math.floor(index / N);
  const col = index % N;
  const c = squareCellCenter(row, col);
  return Math.hypot(c.x - center.x, c.y - center.y);
}

describe("relaxAt -- the one operator behind tap and hold", () => {
  it("returns the very same object when nothing can change", () => {
    const lumpy = createLumpySquareDough();
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, 0, 0.5)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, -3, 0.5)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, NaN, 0.5)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, Infinity, 0.5)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, 9, 0)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: LUMP.y }, 9, NaN)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: NaN, y: LUMP.y }, 9, 0.5)).toBe(lumpy);
    expect(relaxAt(lumpy, { x: LUMP.x, y: Infinity }, 9, 0.5)).toBe(lumpy);
  });

  it("does nothing where there is no dough: a brush over an uncovered area, or off the pan entirely", () => {
    const ball = createInitialSquareDough();
    expect(relaxAt(ball, { x: 90, y: 90 }, 9, 1)).toBe(ball);
    expect(relaxAt(ball, { x: -50, y: 150 }, 9, 1)).toBe(ball);
  });

  it("a uniform sheet is already level: unchanged", () => {
    const sheet = { thickness: createLumpySquareDough().thickness.map((t) => (t > 0 ? 0.6 : 0)) };
    expect(relaxAt(sheet, { x: 40, y: 40 }, 20, 1)).toBe(sheet);
  });

  it("only touches cells inside the brush, and leaves every other cell exactly as it was", () => {
    const lumpy = createLumpySquareDough();
    const after = relaxAt(lumpy, LUMP, 12, 0.8);
    const changed = changedIndexes(lumpy, after);
    expect(changed.length).toBeGreaterThan(0);
    for (const index of changed) expect(distanceOfIndex(index, LUMP)).toBeLessThan(12);
  });

  it("never changes the outline: the covered cells are the same, the uncovered stay exactly 0, and the dough stays valid", () => {
    const next = lcg(11);
    for (let run = 0; run < 150; run++) {
      const dough = randomDough(next);
      const center = { x: next() * 100, y: next() * 100 };
      const after = relaxAt(dough, center, 2 + next() * 30, next());
      expect(coveredSet(after)).toEqual(coveredSet(dough));
      expect(isValidSquareDough(after)).toBe(true);
      expect(squareDoughCoverage(after)).toBe(squareDoughCoverage(dough));
    }
  });

  it("conserves the total thickness (dough is moved from thick to thin, not made or lost)", () => {
    const next = lcg(23);
    for (let run = 0; run < 150; run++) {
      const dough = run % 3 === 0 ? createLumpySquareDough() : randomDough(next);
      const after = relaxAt(dough, { x: next() * 100, y: next() * 100 }, 2 + next() * 30, next());
      expect(Math.abs(sum(after) - sum(dough))).toBeLessThan(1e-9);
    }
  });

  it("never lowers evenness, and strictly raises it when a lump is under the brush", () => {
    const next = lcg(37);
    for (let run = 0; run < 150; run++) {
      const dough = randomDough(next);
      const after = relaxAt(dough, { x: next() * 100, y: next() * 100 }, 2 + next() * 30, next());
      expect(squareDoughEvenness(after)).toBeGreaterThanOrEqual(squareDoughEvenness(dough) - 1e-12);
    }
    const lumpy = createLumpySquareDough();
    expect(squareDoughEvenness(relaxAt(lumpy, LUMP, PRESS_BRUSH_RADIUS, PRESS_STRENGTH))).toBeGreaterThan(squareDoughEvenness(lumpy));
  });

  it("every covered cell moves toward the brush mean and never past it (so a thin cell never gets thinner, a thick one never thicker)", () => {
    const lumpy = createLumpySquareDough();
    const after = relaxAt(lumpy, LUMP, 14, 1);
    const touched = changedIndexes(lumpy, after);
    const lo = Math.min(...touched.map((i) => lumpy.thickness[i]));
    const hi = Math.max(...touched.map((i) => lumpy.thickness[i]));
    for (const i of touched) {
      expect(after.thickness[i]).toBeGreaterThanOrEqual(lo - 1e-12);
      expect(after.thickness[i]).toBeLessThanOrEqual(hi + 1e-12);
    }
    // the peak comes down, the valley comes up
    expect(Math.max(...touched.map((i) => after.thickness[i]))).toBeLessThan(hi);
    expect(Math.min(...touched.map((i) => after.thickness[i]))).toBeGreaterThan(lo);
  });

  it("a covered cell stays covered even when the dough is right at the cover threshold", () => {
    const t: number[] = createLumpySquareDough().thickness.map((v) => (v > 0 ? SQUARE_COVER_MIN_THICKNESS : 0));
    t[squareCellIndex(7, 7)] = 1;
    const after = relaxAt({ thickness: t }, { x: 50, y: 50 }, 25, 1);
    expect(coveredSet(after)).toEqual(coveredSet({ thickness: t }));
    expect(isValidSquareDough(after)).toBe(true);
  });

  it("an edge-of-pan and a corner brush work (the brush may overhang the pan)", () => {
    const lumpy = createLumpySquareDough();
    for (const center of [
      { x: 9, y: 9 },
      { x: 91, y: 91 },
      { x: 50, y: 6 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]) {
      const after = relaxAt(lumpy, center, 22, 1);
      expect(isValidSquareDough(after)).toBe(true);
      expect(Math.abs(sum(after) - sum(lumpy))).toBeLessThan(1e-9);
    }
  });
});

describe("TAP: a local push-in", () => {
  it("is strong and local: it changes only cells within the tap radius, and flattens the lump under the finger", () => {
    const lumpy = createLumpySquareDough();
    const after = pressAt(lumpy, LUMP);
    for (const index of changedIndexes(lumpy, after)) expect(distanceOfIndex(index, LUMP)).toBeLessThan(PRESS_BRUSH_RADIUS);
    const underFinger = lumpy.thickness.flatMap((_, i) => (distanceOfIndex(i, LUMP) < PRESS_BRUSH_RADIUS ? [i] : []));
    const peakBefore = Math.max(...underFinger.map((i) => lumpy.thickness[i]));
    const peakAfter = Math.max(...underFinger.map((i) => after.thickness[i]));
    expect(peakAfter).toBeLessThan(peakBefore);
    // a single push-in takes a clear bite out of the lump, not a hair
    expect(peakBefore - peakAfter).toBeGreaterThan(0.03);
  });

  it("is idempotent in direction: a second tap on the same spot flattens it further but never reverses it", () => {
    const lumpy = createLumpySquareDough();
    const once = pressAt(lumpy, LUMP);
    const twice = pressAt(once, LUMP);
    expect(squareDoughEvenness(twice)).toBeGreaterThanOrEqual(squareDoughEvenness(once));
    expect(squareDoughEvenness(once)).toBeGreaterThan(squareDoughEvenness(lumpy));
  });
});

describe("HOLD: a continuing spread", () => {
  it("the brush starts at the tap size, grows monotonically to the maximum, and never leaves that range", () => {
    expect(holdBrushRadius(0)).toBe(PRESS_BRUSH_RADIUS);
    expect(holdBrushRadius(HOLD_GROW_MS)).toBe(HOLD_BRUSH_RADIUS_MAX);
    expect(holdBrushRadius(HOLD_GROW_MS * 10)).toBe(HOLD_BRUSH_RADIUS_MAX);
    expect(holdBrushRadius(-500)).toBe(PRESS_BRUSH_RADIUS);
    expect(holdBrushRadius(NaN)).toBe(PRESS_BRUSH_RADIUS);
    let previous = holdBrushRadius(0);
    for (let ms = 10; ms <= HOLD_GROW_MS + 100; ms += 10) {
      const radius = holdBrushRadius(ms);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
    expect(PRESS_BRUSH_RADIUS).toBeLessThan(HOLD_BRUSH_RADIUS_MAX);
  });

  it("a hold step with no time, a negative time or a non-finite time changes nothing", () => {
    const lumpy = createLumpySquareDough();
    for (const dt of [0, -16, NaN, Infinity]) expect(holdStep(lumpy, LUMP, 300, dt)).toBe(lumpy);
  });

  it("one hold step is gentle: far smaller than a tap on the same spot", () => {
    const lumpy = createLumpySquareDough();
    const gain = (d: SquareDough) => squareDoughEvenness(d) - squareDoughEvenness(lumpy);
    expect(gain(holdStep(lumpy, LUMP, 0, 16))).toBeGreaterThan(0);
    expect(gain(pressAt(lumpy, LUMP))).toBeGreaterThan(5 * gain(holdStep(lumpy, LUMP, 0, 16)));
  });

  it("keeps spreading while held and reaches farther than a tap ever does", () => {
    const lumpy = createLumpySquareDough();
    let dough = lumpy;
    for (let ms = 0; ms < 900; ms += 16) dough = holdStep(dough, LUMP, ms, 16);
    const farthest = Math.max(...changedIndexes(lumpy, dough).map((i) => distanceOfIndex(i, LUMP)));
    expect(farthest).toBeGreaterThan(PRESS_BRUSH_RADIUS);
    expect(farthest).toBeLessThan(HOLD_BRUSH_RADIUS_MAX);
    expect(squareDoughEvenness(dough)).toBeGreaterThan(squareDoughEvenness(pressAt(lumpy, LUMP)));
    expect(Math.abs(sum(dough) - sum(lumpy))).toBeLessThan(1e-9);
    expect(coveredSet(dough)).toEqual(coveredSet(lumpy));
    expect(isValidSquareDough(dough)).toBe(true);
  });

  it("does not depend on the frame rate: 120, 60 and 30 steps per second end in (nearly) the same dough", () => {
    const lumpy = createLumpySquareDough();
    const run = (stepMs: number) => {
      let dough = lumpy;
      for (let ms = 0; ms < 900; ms += stepMs) dough = holdStep(dough, LUMP, ms, stepMs);
      return dough;
    };
    const fast = run(1000 / 120);
    const normal = run(1000 / 60);
    const slow = run(1000 / 30);
    const evenness = [fast, normal, slow].map(squareDoughEvenness);
    expect(Math.max(...evenness) - Math.min(...evenness)).toBeLessThan(0.03);
    // the worst single-cell disagreement between 120 fps and 30 fps stays small
    const worst = Math.max(...fast.thickness.map((t, i) => Math.abs(t - slow.thickness[i])));
    expect(worst).toBeLessThan(0.05);
  });

  it("a stalled frame cannot produce one huge step: any gap is treated as at most HOLD_MAX_STEP_MS", () => {
    const lumpy = createLumpySquareDough();
    const capped = holdStep(lumpy, LUMP, 400, HOLD_MAX_STEP_MS);
    expect(holdStep(lumpy, LUMP, 400, HOLD_MAX_STEP_MS * 50)).toEqual(capped);
    expect(squareDoughEvenness(capped)).toBeLessThan(squareDoughEvenness(relaxAt(lumpy, LUMP, holdBrushRadius(400), 1)));
    expect(HOLD_RATE_PER_S).toBeGreaterThan(0);
  });
});

describe("applyPressEffect(s)", () => {
  it("a press effect is a tap, a hold effect is a hold step, and a list applies in order", () => {
    const lumpy = createLumpySquareDough();
    const center = { x: LUMP.x, y: LUMP.y };
    expect(applyPressEffect(lumpy, { kind: "press", center })).toEqual(pressAt(lumpy, center));
    expect(applyPressEffect(lumpy, { kind: "hold", center, elapsedMs: 250, dtMs: 16 })).toEqual(holdStep(lumpy, center, 250, 16));
    const both = applyPressEffects(lumpy, [
      { kind: "press", center },
      { kind: "hold", center, elapsedMs: 10, dtMs: 10 },
    ]);
    expect(both).toEqual(holdStep(pressAt(lumpy, center), center, 10, 10));
    expect(applyPressEffects(lumpy, [])).toBe(lumpy);
    expect(DOUGH_CENTER).toBe(50);
  });
});
