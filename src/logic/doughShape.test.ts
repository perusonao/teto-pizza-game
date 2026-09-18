import { describe, expect, it } from "vitest";
import { DOUGH_RADIUS } from "./pizzaCoordinates";
import {
  DOUGH_COMPLETION_THRESHOLD,
  DOUGH_SHAPE_POINTS,
  INITIAL_DOUGH_RADIUS,
  applyStretchPoint,
  createInitialDoughShape,
  doughSizeProgress,
  isDoughShapeComplete,
  isValidDoughShape,
  smoothDoughShapeForDisplay,
  type DoughShape,
} from "./doughShape";

/** Point on the dough's own coordinate circle at `angleIndex * (360/DOUGH_SHAPE_POINTS)`
 *  degrees, `distance` out from DOUGH_CENTER -- mirrors `applyStretchPoint`'s own angle
 *  convention exactly (index 0 = angle 0 = dough-local "east"). */
function pointAt(angleIndex: number, distance: number): [number, number] {
  const angle = (angleIndex / DOUGH_SHAPE_POINTS) * Math.PI * 2;
  return [50 + Math.cos(angle) * distance, 50 + Math.sin(angle) * distance];
}

describe("createInitialDoughShape", () => {
  it("starts as a small, uniform circle (all N radii equal)", () => {
    const shape = createInitialDoughShape();
    expect(shape.radii).toHaveLength(DOUGH_SHAPE_POINTS);
    expect(shape.radii.every((r) => r === INITIAL_DOUGH_RADIUS)).toBe(true);
    expect(INITIAL_DOUGH_RADIUS).toBeLessThan(DOUGH_RADIUS);
  });

  it("is a valid shape", () => {
    expect(isValidDoughShape(createInitialDoughShape())).toBe(true);
  });
});

describe("applyStretchPoint (Issue #33 D2 Human Feel Fix: neighbor propagation + spike suppression)", () => {
  it("a pull at a control point's own angle changes that point most, its neighbors somewhat, and leaves the opposite side untouched", () => {
    const shape = createInitialDoughShape();
    const [x, y] = pointAt(0, 40);
    const next = applyStretchPoint(shape, x, y);

    // Exact values for this fixture (distance=40 at index 0's own angle), pinned so a future
    // change to the propagation weights or spike cap is caught explicitly rather than only by
    // a looser inequality check.
    expect(next.radii[0]).toBeCloseTo(30.24, 4); // primary, spike-clamped (see below)
    expect(next.radii[1]).toBeCloseTo(28.032, 4); // immediate neighbor (weight 0.45)
    expect(next.radii[7]).toBeCloseTo(28.032, 4); // circular immediate neighbor
    expect(next.radii[2]).toBeCloseTo(20.8512, 4); // next ring out (weight 0.12)
    expect(next.radii[6]).toBeCloseTo(20.8512, 4);
    // Opposite side and its near neighbors (circular distance >= 3) are untouched.
    expect(next.radii[3]).toBe(INITIAL_DOUGH_RADIUS);
    expect(next.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
    expect(next.radii[5]).toBe(INITIAL_DOUGH_RADIUS);

    // Ordering: primary > immediate neighbor > next ring > untouched.
    expect(next.radii[0]).toBeGreaterThan(next.radii[1]);
    expect(next.radii[1]).toBeGreaterThan(next.radii[2]);
    expect(next.radii[2]).toBeGreaterThan(next.radii[3]);
  });

  it("circular neighbor wrapping works at the 0/7 boundary the same way as any other pair", () => {
    const shape = createInitialDoughShape();
    // Touch near index 7's own angle -- index 0 (wrapping past the array end) must react
    // exactly like index 6 (the non-wrapping neighbor) does.
    const [x, y] = pointAt(7, 40);
    const next = applyStretchPoint(shape, x, y);
    expect(next.radii[0]).toBeCloseTo(next.radii[6], 6);
    expect(next.radii[0]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
  });

  it("a pull exactly between two control points affects a wider, smoothly-tapered spread (not just the old two bracketing points)", () => {
    const shape = createInitialDoughShape();
    const step = (Math.PI * 2) / DOUGH_SHAPE_POINTS;
    const midAngle = step / 2; // exactly between control point 0 and 1
    const distance = 30;
    const x = 50 + Math.cos(midAngle) * distance;
    const y = 50 + Math.sin(midAngle) * distance;
    const next = applyStretchPoint(shape, x, y);

    expect(next.radii[0]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[1]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    // Exactly halfway between 0 and 1: both are equally close, so they move equally.
    expect(next.radii[0]).toBeCloseTo(next.radii[1], 5);
    // Unlike D1, points one ring further out (2 and 7) now also pick up some propagated
    // stretch instead of staying frozen at the initial radius.
    expect(next.radii[2]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[7]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[2]).toBeCloseTo(next.radii[7], 5);
    expect(next.radii[2]).toBeLessThan(next.radii[0]);
    // Still nothing reaches all the way to the far side.
    expect(next.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
  });

  it("spike suppression: a single full-reach pull no longer jumps one point straight to DOUGH_RADIUS while its neighbor stays untouched", () => {
    const shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    const next = applyStretchPoint(shape, x, y);

    // D1's own behavior here would have been radii[0] === DOUGH_RADIUS (48) while
    // radii[1] stayed at the untouched initial radius (~18.24) -- a ~30-unit one-step gap.
    // D2's spike clamp caps how far the touched point's own per-call jump may exceed the
    // (pre-call) average of its immediate neighbors.
    expect(next.radii[0]).toBeLessThan(DOUGH_RADIUS);
    const gapToNeighbor = next.radii[0] - next.radii[1];
    const d1BaselineGap = DOUGH_RADIUS - INITIAL_DOUGH_RADIUS;
    expect(gapToNeighbor).toBeLessThan(d1BaselineGap * 0.5);
  });

  it("repeated pulls at the exact same spot cannot create a pathological spike worse than D1's own single-pull baseline", () => {
    let shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    for (let i = 0; i < 30; i += 1) {
      shape = applyStretchPoint(shape, x, y);
    }
    let maxAdjacentGap = 0;
    for (let i = 0; i < DOUGH_SHAPE_POINTS; i += 1) {
      const next = (i + 1) % DOUGH_SHAPE_POINTS;
      maxAdjacentGap = Math.max(maxAdjacentGap, Math.abs(shape.radii[i] - shape.radii[next]));
    }
    const d1BaselineGap = DOUGH_RADIUS - INITIAL_DOUGH_RADIUS;
    expect(maxAdjacentGap).toBeLessThan(d1BaselineGap);
  });

  it("asymmetry remains fully achievable: pulling only one side leaves the opposite side visibly smaller", () => {
    let shape = createInitialDoughShape();
    const [x, y] = pointAt(0, DOUGH_RADIUS);
    for (let i = 0; i < 5; i += 1) {
      shape = applyStretchPoint(shape, x, y);
    }
    // The untouched far side (circular distance >= 3 from index 0) never moves at all --
    // asymmetry is not smoothed away by the propagation/clamp.
    expect(shape.radii[3]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[4]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[5]).toBe(INITIAL_DOUGH_RADIUS);
    expect(shape.radii[0]).toBeGreaterThan(shape.radii[4] * 1.3);
  });

  it("a few (4-6) natural outward gestures spread around the circle reach the 0.75 completion threshold", () => {
    for (const gestureCount of [4, 5, 6]) {
      let shape = createInitialDoughShape();
      for (let g = 0; g < gestureCount; g += 1) {
        const [x, y] = pointAt((g / gestureCount) * DOUGH_SHAPE_POINTS, DOUGH_RADIUS);
        shape = applyStretchPoint(shape, x, y);
      }
      expect(doughSizeProgress(shape)).toBeGreaterThanOrEqual(0.75);
    }
  });

  it("is monotonic: a closer-in point applied after a farther-out one never shrinks", () => {
    const shape = createInitialDoughShape();
    const far = applyStretchPoint(shape, 50 + 45, 50);
    const closerAfter = applyStretchPoint(far, 50 + 10, 50);
    expect(closerAfter.radii[0]).toBe(far.radii[0]);
  });

  it("is monotonic across every point, not just the touched one, across a long mixed gesture sequence", () => {
    let shape = createInitialDoughShape();
    for (let step = 0; step < 40; step += 1) {
      const idx = (step * 1.7) % DOUGH_SHAPE_POINTS;
      const dist = 15 + ((step * 7) % 34);
      const before = shape.radii;
      shape = applyStretchPoint(shape, ...pointAt(idx, dist));
      for (let i = 0; i < DOUGH_SHAPE_POINTS; i += 1) {
        expect(shape.radii[i]).toBeGreaterThanOrEqual(before[i]);
      }
    }
  });

  it("clamps distance to DOUGH_RADIUS for a point pulled outside the dough", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, 50 + 1000, 50);
    expect(next.radii[0]).toBeLessThanOrEqual(DOUGH_RADIUS);
  });

  it("a pull exactly at dough center is a no-op (distance 0, no defined angle)", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, 50, 50);
    expect(next).toBe(shape);
  });

  it("never mutates the input shape", () => {
    const shape = createInitialDoughShape();
    const before = [...shape.radii];
    applyStretchPoint(shape, 50 + 40, 50);
    expect(shape.radii).toEqual(before);
  });
});

describe("doughSizeProgress / isDoughShapeComplete", () => {
  function uniformShape(radius: number): DoughShape {
    return { radii: new Array(DOUGH_SHAPE_POINTS).fill(radius) };
  }

  it("progress is mean(radii) / DOUGH_RADIUS at known fixture values", () => {
    expect(doughSizeProgress(uniformShape(DOUGH_RADIUS))).toBeCloseTo(1, 5);
    expect(doughSizeProgress(uniformShape(DOUGH_RADIUS / 2))).toBeCloseTo(0.5, 5);
    expect(doughSizeProgress(uniformShape(0))).toBe(0);
  });

  it("completion is false below the threshold", () => {
    const shape = uniformShape(DOUGH_RADIUS * (DOUGH_COMPLETION_THRESHOLD - 0.1));
    expect(isDoughShapeComplete(shape)).toBe(false);
  });

  it("completion is true at/above the threshold", () => {
    const atThreshold = uniformShape(DOUGH_RADIUS * DOUGH_COMPLETION_THRESHOLD);
    expect(isDoughShapeComplete(atThreshold)).toBe(true);
    const above = uniformShape(DOUGH_RADIUS);
    expect(isDoughShapeComplete(above)).toBe(true);
  });

  it("evaluates size only -- an uneven-but-large-mean shape still completes", () => {
    // No roundness/evenness/symmetry gate in D1/D2: a lopsided shape whose mean already
    // clears the threshold must complete exactly the same as a perfectly even one.
    const radii = new Array(DOUGH_SHAPE_POINTS).fill(DOUGH_RADIUS);
    radii[0] = 0; // one wildly short point
    const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const shape: DoughShape = { radii };
    expect(isDoughShapeComplete(shape)).toBe(meanRadius / DOUGH_RADIUS >= DOUGH_COMPLETION_THRESHOLD);
  });

  it("Issue #33 D2: the completion threshold is unchanged at 0.75 and remains reachable under the new propagation/clamp math", () => {
    expect(DOUGH_COMPLETION_THRESHOLD).toBe(0.75);
    let shape = createInitialDoughShape();
    for (let i = 0; i < 8; i += 1) {
      shape = applyStretchPoint(shape, ...pointAt(i, DOUGH_RADIUS));
    }
    expect(doughSizeProgress(shape)).toBeGreaterThanOrEqual(0.75);
  });
});

describe("isValidDoughShape", () => {
  it("rejects wrong length", () => {
    expect(isValidDoughShape({ radii: [1, 2, 3] })).toBe(false);
  });

  it("rejects non-finite/out-of-range radii", () => {
    const radii = new Array(DOUGH_SHAPE_POINTS).fill(1);
    expect(isValidDoughShape({ radii: [...radii.slice(1), NaN] })).toBe(false);
    expect(isValidDoughShape({ radii: [...radii.slice(1), -1] })).toBe(false);
    expect(isValidDoughShape({ radii: [...radii.slice(1), DOUGH_RADIUS + 1] })).toBe(false);
  });

  it("accepts a valid shape", () => {
    expect(isValidDoughShape(createInitialDoughShape())).toBe(true);
  });
});

describe("smoothDoughShapeForDisplay", () => {
  it("produces a closed SVG path starting and ending consistently", () => {
    const d = smoothDoughShapeForDisplay(createInitialDoughShape());
    expect(d.startsWith("M ")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("produces a path for an asymmetric shape without throwing", () => {
    const shape = applyStretchPoint(createInitialDoughShape(), 50 + 45, 50);
    expect(() => smoothDoughShapeForDisplay(shape)).not.toThrow();
  });
});
