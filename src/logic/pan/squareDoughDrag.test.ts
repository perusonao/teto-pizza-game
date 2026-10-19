import { describe, expect, it } from "vitest";
import { createInitialSquareDough, squareCornerReach, squareDoughCoverage, squareDoughEvenness, SQUARE_COVER_MIN_THICKNESS, type SquareDough } from "./squareDough";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { holdStep, pressAt } from "./squareDoughSpread";
import { HOLD_BRUSH_RADIUS_MAX, HOLD_RATE_PER_S, PRESS_BRUSH_RADIUS, PRESS_STRENGTH } from "./squareDoughSpread";
import {
  DRAG_BRUSH_RADIUS,
  DRAG_DONOR_DECAY,
  DRAG_DONOR_POWER,
  DRAG_FILM_THICKNESS,
  applyGestureEffects,
  dragAlong,
  dragFillAt,
} from "./squareDoughDrag";

const mass = (d: SquareDough) => d.thickness.reduce((a, b) => a + b, 0);
const centre = { x: 50, y: 50 };

/** A tiny deterministic generator so the fuzz is replayable. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

describe("drag model constants (Owner-approved: C plan, then the balance pass)", () => {
  it("brush radius 16 %, film 0.16, donor decay 20, donor power 2", () => {
    expect(DRAG_BRUSH_RADIUS).toBe(16);
    expect(DRAG_FILM_THICKNESS).toBe(0.16);
    expect(DRAG_DONOR_DECAY).toBe(20);
    expect(DRAG_DONOR_POWER).toBe(2);
  });

  it("the tap / long-press balance pass (E2): push radius 16, hold radius up to 34, 4.0 per second; the push strength is unchanged", () => {
    expect(PRESS_BRUSH_RADIUS).toBe(16);
    expect(HOLD_BRUSH_RADIUS_MAX).toBe(34);
    expect(HOLD_RATE_PER_S).toBe(4.0);
    expect(PRESS_STRENGTH).toBe(0.9);
  });
});

describe("donor weighting (power 2): the thickest dough pays first", () => {
  it("of two donors at the same distance, the thicker gives disproportionately more", () => {
    const thickness = new Array<number>(256).fill(0);
    // two covered donor cells at the same distance from the film point: row 7 col 4 (0.9 thick) and row 7 col 12 (0.4 thick)
    thickness[7 * 16 + 4] = 0.9;
    thickness[7 * 16 + 12] = 0.4;
    const out = dragFillAt({ thickness }, { x: 50, y: 50 });
    const gave = (i: number) => thickness[i] - out.thickness[i];
    expect(gave(7 * 16 + 4)).toBeGreaterThan(0);
    expect(gave(7 * 16 + 4)).toBeGreaterThan(gave(7 * 16 + 12) * 2); // power 2 on spare (0.74 vs 0.24): ~9.5x, plainly more than linear (~3x)
    expect(Math.abs(mass(out) - mass({ thickness }))).toBeLessThan(1e-9);
  });
});

describe("dragAlong: mass-conserving", () => {
  it("pulling out of the ball conserves the total dough exactly (to float noise) and grows coverage", () => {
    const start = createInitialSquareDough();
    const end = dragAlong(start, centre, { x: 90, y: 90 });
    expect(Math.abs(mass(end) - mass(start))).toBeLessThan(1e-9);
    expect(squareDoughCoverage(end)).toBeGreaterThan(squareDoughCoverage(start));
  });

  it("a pull to a corner reaches that corner (and a pull elsewhere does not)", () => {
    const start = createInitialSquareDough();
    const toNe = dragAlong(start, centre, { x: 91, y: 9 });
    const reach = squareCornerReach(toNe);
    expect(reach[1]).toBeGreaterThanOrEqual(0.85);
    expect(reach[3]).toBeLessThan(0.85);
  });

  it("never uncovers a covered cell, never exceeds the maximum, never goes non-finite or negative (fuzz, ball and lumpy starts)", () => {
    for (const start of [createInitialSquareDough(), createLumpySquareDough()]) {
      const rnd = rng(4242);
      let d = start;
      for (let n = 0; n < 120; n++) {
        const before = d;
        const a = { x: -10 + rnd() * 120, y: -10 + rnd() * 120 };
        const b = { x: -10 + rnd() * 120, y: -10 + rnd() * 120 };
        d = dragAlong(d, a, b);
        expect(Math.abs(mass(d) - mass(before))).toBeLessThan(1e-9);
        for (let i = 0; i < d.thickness.length; i++) {
          const v = d.thickness[i];
          expect(Number.isFinite(v) && v >= 0 && v <= 1 + 1e-12).toBe(true);
          if (before.thickness[i] >= SQUARE_COVER_MIN_THICKNESS) expect(v).toBeGreaterThanOrEqual(SQUARE_COVER_MIN_THICKNESS);
        }
        expect(squareDoughCoverage(d)).toBeGreaterThanOrEqual(squareDoughCoverage(before) - 1e-12);
        const r0 = squareCornerReach(before);
        squareCornerReach(d).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(r0[i] - 1e-12));
      }
    }
  });

  it("does not depend on how often the pointer is reported (one long segment vs many short ones)", () => {
    const start = createInitialSquareDough();
    const one = dragAlong(start, centre, { x: 90, y: 20 });
    let many = start;
    let prev = centre;
    for (let k = 1; k <= 40; k++) {
      const p = { x: centre.x + ((90 - centre.x) * k) / 40, y: centre.y + ((20 - centre.y) * k) / 40 };
      many = dragAlong(many, prev, p);
      prev = p;
    }
    one.thickness.forEach((v, i) => expect(many.thickness[i]).toBeCloseTo(v, 3)); // sub-steps are cut per segment: equal to well under the colour resolution
  });

  it("lays a thinner film when the dough around cannot pay for a full one (nothing appears from nowhere)", () => {
    const tiny = { thickness: new Array<number>(256).fill(0) };
    // one covered cell just above the film thickness: almost nothing to give
    tiny.thickness[8 * 16 + 8] = DRAG_FILM_THICKNESS + 0.02;
    const out = dragAlong(tiny, centre, { x: 80, y: 50 });
    expect(Math.abs(mass(out) - mass(tiny))).toBeLessThan(1e-9);
  });

  it("returns the very same object when nothing changes (non-finite points, an already-covered patch, no dough to give)", () => {
    const lumpy = createLumpySquareDough();
    expect(dragAlong(lumpy, { x: Number.NaN, y: 1 }, centre)).toBe(lumpy);
    expect(dragFillAt(lumpy, { x: Number.POSITIVE_INFINITY, y: 0 })).toBe(lumpy);
    const empty = { thickness: new Array<number>(256).fill(0) };
    expect(dragAlong(empty, centre, { x: 80, y: 80 })).toBe(empty);
    expect(dragFillAt(createInitialSquareDough(), { x: 500, y: 500 })).toBeTruthy();
  });
});

describe("applyGestureEffects", () => {
  it("revert returns to the dough the gesture started from; press / hold / drag compose in order", () => {
    const start = createLumpySquareDough();
    const tapped = applyGestureEffects(start, start, [{ kind: "press", center: { x: 58, y: 48 } }]);
    expect(tapped).not.toBe(start);
    const reverted = applyGestureEffects(tapped, start, [{ kind: "revert" }]);
    expect(reverted).toBe(start);
    const ball = createInitialSquareDough();
    const dragged = applyGestureEffects(ball, ball, [{ kind: "revert" }, { kind: "drag", from: centre, to: { x: 85, y: 85 } }]);
    expect(squareDoughCoverage(dragged)).toBeGreaterThan(squareDoughCoverage(ball));
    const held = applyGestureEffects(ball, ball, [{ kind: "hold", center: { x: 58, y: 48 }, elapsedMs: 400, dtMs: 50 }]);
    expect(held).toBeTruthy();
  });
});

describe("the spread operations never undo what a drag laid (coverage / corners stay)", () => {
  it("tap and hold after a drag keep coverage and corner reach", () => {
    let d = dragAlong(createInitialSquareDough(), centre, { x: 90, y: 10 });
    const cov = squareDoughCoverage(d);
    const reach = squareCornerReach(d);
    d = pressAt(d, { x: 70, y: 30 });
    for (let t = 0; t < 800; t += 50) d = holdStep(d, { x: 60, y: 40 }, t, 50);
    expect(squareDoughCoverage(d)).toBeGreaterThanOrEqual(cov - 1e-12);
    squareCornerReach(d).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(reach[i] - 1e-12));
    expect(squareDoughEvenness(d)).toBeGreaterThanOrEqual(0);
  });
});
