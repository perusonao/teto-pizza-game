import { describe, expect, it } from "vitest";
import {
  SQUEEZE_DOUGH_DIAMETER,
  SQUEEZE_MAX_LENGTH,
  SQUEEZE_MAX_LENGTH_RATIO,
  SQUEEZE_MAX_POINTS,
  SQUEEZE_MIN_LENGTH,
  capTrailLength,
  isSqueezeIngredientId,
  normalizeTrail,
  shiftTrail,
  thinTrail,
  trailAnchor,
  trailLength,
  trailPathD,
} from "./squeeze";
import { DOUGH_RADIUS } from "./pizzaCoordinates";

const line = (n: number, step: number, y = 50) => Array.from({ length: n }, (_, i) => ({ x: 20 + i * step, y }));

describe("squeeze helpers (Expansion Batch 13, Owner 案A)", () => {
  it("only mayo is placed by a stroke", () => {
    expect(isSqueezeIngredientId("mayo")).toBe(true);
    for (const id of ["mozzarella", "potato", "bacon", "corn", "tomato-sauce", "", undefined, null, 7]) expect(isSqueezeIngredientId(id)).toBe(false);
  });

  it("the longest stroke is 60% of the dough's diameter (dough percent)", () => {
    expect(SQUEEZE_MAX_LENGTH_RATIO).toBe(0.6);
    expect(SQUEEZE_DOUGH_DIAMETER).toBe(2 * DOUGH_RADIUS);
    expect(SQUEEZE_MAX_LENGTH).toBeCloseTo(0.6 * 2 * DOUGH_RADIUS, 10);
  });

  it("capTrailLength cuts a long stroke exactly at the cap (interpolated end) and leaves a short one unchanged", () => {
    const long = line(20, 5); // 95 long
    const capped = capTrailLength(long);
    expect(trailLength(capped)).toBeCloseTo(SQUEEZE_MAX_LENGTH, 6);
    expect(capped[0]).toEqual(long[0]);
    const short = line(4, 5);
    expect(capTrailLength(short)).toEqual(short);
  });

  it("normalizeTrail: not a clean stroke -> null (the piece is then the single drop)", () => {
    expect(normalizeTrail(undefined)).toBeNull();
    expect(normalizeTrail("x")).toBeNull();
    expect(normalizeTrail([])).toBeNull();
    expect(normalizeTrail([{ x: 50, y: 50 }])).toBeNull();
    expect(normalizeTrail([{ x: NaN, y: 50 }, { x: 60, y: 50 }])).toBeNull();
    expect(normalizeTrail([{ x: 50, y: 50 }, { x: 50 + SQUEEZE_MIN_LENGTH / 2, y: 50 }])).toBeNull(); // a tap-sized wiggle
  });

  it("normalizeTrail: thins, caps the length at 60% of the diameter and the point count, and runs every point through `clamp`", () => {
    const dense = Array.from({ length: 300 }, (_, i) => ({ x: 10 + i * 0.3, y: 50 })); // 90 long, 300 samples
    const out = normalizeTrail(dense)!;
    expect(out.length).toBeLessThanOrEqual(SQUEEZE_MAX_POINTS);
    expect(trailLength(out)).toBeLessThanOrEqual(SQUEEZE_MAX_LENGTH + 1e-6);
    expect(trailLength(out)).toBeGreaterThan(SQUEEZE_MAX_LENGTH - 2);
    const clamped = normalizeTrail([{ x: 5, y: 50 }, { x: 40, y: 50 }], (x, y) => ({ x: Math.max(20, x), y }))!;
    expect(clamped[0]).toEqual({ x: 20, y: 50 });
  });

  it("trailAnchor is the midpoint by length; shiftTrail moves and re-clamps; trailPathD is an M/L path", () => {
    const stroke = [{ x: 20, y: 50 }, { x: 30, y: 50 }, { x: 30, y: 70 }]; // 10 + 20 = 30 long, midpoint 15 along: 5 up the second leg
    expect(trailAnchor(stroke)).toEqual({ x: 30, y: 55 });
    expect(shiftTrail(stroke, 5, -5)[0]).toEqual({ x: 25, y: 45 });
    expect(shiftTrail(stroke, 100, 0, (x, y) => ({ x: Math.min(90, x), y }))[2].x).toBe(90);
    expect(trailPathD(stroke)).toBe("M 20.00 50.00 L 30.00 50.00 L 30.00 70.00");
  });

  it("thinTrail keeps the first and the last sample", () => {
    const dense = line(50, 0.1);
    const thin = thinTrail(dense);
    expect(thin[0]).toEqual(dense[0]);
    expect(thin[thin.length - 1]).toEqual(dense[dense.length - 1]);
    expect(thin.length).toBeLessThan(dense.length);
  });
});
