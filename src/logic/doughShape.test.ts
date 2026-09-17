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

describe("applyStretchPoint", () => {
  it("a pull exactly at a control point's own angle only moves that point", () => {
    const shape = createInitialDoughShape();
    // index 0 is angle 0 ("east"): (DOUGH_CENTER + distance, DOUGH_CENTER).
    const next = applyStretchPoint(shape, 50 + 40, 50);
    expect(next.radii[0]).toBeCloseTo(40, 5);
    for (let i = 1; i < DOUGH_SHAPE_POINTS; i += 1) {
      expect(next.radii[i]).toBe(INITIAL_DOUGH_RADIUS);
    }
  });

  it("only the two bracketing points change for an in-between pull", () => {
    const shape = createInitialDoughShape();
    const step = (Math.PI * 2) / DOUGH_SHAPE_POINTS;
    const midAngle = step / 2; // exactly between control point 0 and 1
    const distance = 30;
    const x = 50 + Math.cos(midAngle) * distance;
    const y = 50 + Math.sin(midAngle) * distance;
    const next = applyStretchPoint(shape, x, y);

    expect(next.radii[0]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    expect(next.radii[1]).toBeGreaterThan(INITIAL_DOUGH_RADIUS);
    // Exactly halfway: both bracketing points move by the same amount.
    expect(next.radii[0]).toBeCloseTo(next.radii[1], 5);
    for (let i = 2; i < DOUGH_SHAPE_POINTS; i += 1) {
      expect(next.radii[i]).toBe(INITIAL_DOUGH_RADIUS);
    }
  });

  it("is monotonic: a closer-in point applied after a farther-out one never shrinks", () => {
    const shape = createInitialDoughShape();
    const far = applyStretchPoint(shape, 50 + 45, 50);
    const closerAfter = applyStretchPoint(far, 50 + 10, 50);
    expect(closerAfter.radii[0]).toBe(far.radii[0]);
  });

  it("clamps distance to DOUGH_RADIUS for a point pulled outside the dough", () => {
    const shape = createInitialDoughShape();
    const next = applyStretchPoint(shape, 50 + 1000, 50);
    expect(next.radii[0]).toBeLessThanOrEqual(DOUGH_RADIUS);
    expect(next.radii[0]).toBeCloseTo(DOUGH_RADIUS, 5);
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
    // No roundness/evenness/symmetry gate in D1: a lopsided shape whose mean already clears
    // the threshold must complete exactly the same as a perfectly even one.
    const radii = new Array(DOUGH_SHAPE_POINTS).fill(DOUGH_RADIUS);
    radii[0] = 0; // one wildly short point
    const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const shape: DoughShape = { radii };
    expect(isDoughShapeComplete(shape)).toBe(meanRadius / DOUGH_RADIUS >= DOUGH_COMPLETION_THRESHOLD);
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
