import { describe, expect, it } from "vitest";
import { CORNER_REACH_THRESHOLD, createInitialSquareDough, squareCellCenterPercent, squareCellIndex, type SquareDough } from "./squareDough";
import { dragAlong } from "./squareDoughDrag";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { holdStep, pressAt } from "./squareDoughSpread";
import {
  SQUARE_COMPLETE_EVENNESS_MIN,
  SQUARE_STEP1_COVERAGE_MIN,
  isSquareDoughComplete,
  reachedAsShown,
  squareDoughProgress,
  squareDoughStep,
} from "./squareDoughProgress";

const centre = { x: 50, y: 50 };

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

describe("constants", () => {
  it("corner 85 % kept (Owner), coverage 95 %, evenness 60 % (initial values for HV)", () => {
    expect(CORNER_REACH_THRESHOLD).toBe(0.85);
    expect(SQUARE_STEP1_COVERAGE_MIN).toBe(0.95);
    expect(SQUARE_COMPLETE_EVENNESS_MIN).toBe(0.6);
  });
  it("reachedAsShown judges on the one-decimal number the gauge prints", () => {
    expect(reachedAsShown(0.5996, 0.6)).toBe(true); // prints 60.0%
    expect(reachedAsShown(0.5994, 0.6)).toBe(false); // prints 59.9%
    expect(reachedAsShown(Number.NaN, 0.6)).toBe(false);
  });
});

describe("derived step", () => {
  it("the production start (a small ball) is STEP 1, not complete, with no corner reached", () => {
    const p = squareDoughProgress(createInitialSquareDough());
    expect(p.step).toBe(1);
    expect(p.complete).toBe(false);
    expect(p.cornersReached).toBe(0);
    expect(p.evenness).toBe(0);
  });

  it("the Preview lumpy start has every corner and full coverage: it opens at STEP 2 (STEP 1 already done) and is already above the evenness target", () => {
    const p = squareDoughProgress(createLumpySquareDough());
    expect(p.cornersReached).toBe(4);
    expect(p.step1Done).toBe(true);
    expect(p.step).toBe(2);
    expect(p.complete).toBe(p.evennessReached);
    expect(p.evenness).toBeGreaterThan(SQUARE_COMPLETE_EVENNESS_MIN);
  });

  it("arms to the corners alone (4/4) are not STEP 1: the coverage must be there too", () => {
    let d = createInitialSquareDough();
    for (const [x, y] of [[9, 9], [91, 9], [91, 91], [9, 91]]) d = dragAlong(d, centre, { x, y });
    const p = squareDoughProgress(d);
    expect(p.cornersReached).toBe(4);
    expect(p.coverageReached).toBe(false);
    expect(p.step).toBe(1);
  });

  it("a thin dough that covers everything but leaves a corner empty is STEP 1", () => {
    const thickness = new Array<number>(256).fill(0);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) thickness[squareCellIndex(r, c)] = squareCellCenterPercent(r) < 30 && squareCellCenterPercent(c) < 30 ? 0 : 0.2;
    const p = squareDoughProgress({ thickness } as SquareDough);
    expect(p.cornersReached).toBeLessThan(4);
    expect(p.step).toBe(1);
  });
});

describe("a replayable play-through reaches STEP 2 and the finish in a reasonable number of moves (HV measures the real thing)", () => {
  it("greedy edge pulls, then flattening holds: STEP 1 done, then complete, within 60 moves", () => {
    let d = createInitialSquareDough();
    let step1At = -1;
    let completeAt = -1;
    for (let n = 1; n <= 60 && completeAt < 0; n++) {
      const p = squareDoughProgress(d);
      if (!p.coverageReached) {
        // pull from the covered cell nearest the emptiest region toward it, and a little beyond
        let best: { fx: number; fy: number; tx: number; ty: number } | null = null;
        let bestDist = Infinity;
        for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
          const x = squareCellCenterPercent(c);
          const y = squareCellCenterPercent(r);
          if (Math.abs(x - 50) > 44 || Math.abs(y - 50) > 44) continue;
          if (d.thickness[squareCellIndex(r, c)] >= 0.05) continue;
          for (let r2 = 0; r2 < 16; r2++) for (let c2 = 0; c2 < 16; c2++) {
            if (d.thickness[squareCellIndex(r2, c2)] < 0.05) continue;
            const x2 = squareCellCenterPercent(c2);
            const y2 = squareCellCenterPercent(r2);
            const dist = Math.hypot(x - x2, y - y2);
            if (dist < bestDist) { bestDist = dist; best = { fx: x2, fy: y2, tx: x, ty: y }; }
          }
        }
        if (best === null) break;
        const dx = best.tx - best.fx;
        const dy = best.ty - best.fy;
        const len = Math.hypot(dx, dy) || 1;
        d = dragAlong(d, { x: best.fx, y: best.fy }, { x: best.tx + (dx / len) * 12, y: best.ty + (dy / len) * 12 });
      } else {
        let hi = 0;
        let hx = 50;
        let hy = 50;
        for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
          const v = d.thickness[squareCellIndex(r, c)];
          if (v > hi) { hi = v; hx = squareCellCenterPercent(c); hy = squareCellCenterPercent(r); }
        }
        for (let t = 0; t < 1000; t += 50) d = holdStep(d, { x: hx, y: hy }, t, 50);
      }
      const after = squareDoughProgress(d);
      if (step1At < 0 && after.step1Done) step1At = n;
      if (after.complete) completeAt = n;
    }
    expect(step1At).toBeGreaterThan(0);
    expect(completeAt).toBeGreaterThanOrEqual(step1At);
    expect(completeAt).toBeLessThanOrEqual(60);
    expect(isSquareDoughComplete(d)).toBe(true);
  });
});

describe("the step never goes back (fuzz over drag / tap / hold, ball and lumpy starts)", () => {
  it("once STEP 2, always STEP 2; the step is a pure function of the dough", () => {
    for (const start of [createInitialSquareDough(), createLumpySquareDough()]) {
      for (let seed = 1; seed <= 6; seed++) {
        const rnd = rng(seed * 977);
        let d = start;
        let seen2 = squareDoughStep(d) === 2;
        for (let n = 0; n < 90; n++) {
          const k = rnd();
          const pt = () => ({ x: 6 + rnd() * 88, y: 6 + rnd() * 88 });
          if (k < 0.5) d = dragAlong(d, pt(), pt());
          else if (k < 0.75) d = pressAt(d, pt());
          else { const c = pt(); for (let t = 0; t < 600; t += 50) d = holdStep(d, c, t, 50); }
          const step = squareDoughStep(d);
          if (seen2) expect(step).toBe(2);
          if (step === 2) seen2 = true;
          expect(squareDoughStep(d)).toBe(step);
        }
      }
    }
  });
});
