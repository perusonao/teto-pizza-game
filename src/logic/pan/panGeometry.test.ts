import { describe, expect, it } from "vitest";
import {
  CLAMP_INSET_EPSILON,
  DOUGH_CENTER,
  DOUGH_RADIUS,
  clampToDough,
  isInsideDough,
} from "../pizzaCoordinates";
import { SAUCE_TARGET_RADIUS } from "../sauceField";
import {
  ROUND_PAN_GEOMETRY,
  SQUARE_PAN_CORNERS,
  SQUARE_PAN_GEOMETRY,
  SQUARE_PAN_HALF_SIDE,
  SQUARE_TARGET_HALF_SIDE,
  getPanGeometry,
} from "./panGeometry";

const LO = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
const HI = DOUGH_CENTER + SQUARE_PAN_HALF_SIDE;

/** A deterministic spread of points: a dense grid past the box on every side, plus both rims and angles. */
function probePoints(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let x = -20; x <= 120; x += 0.5) for (let y = -20; y <= 120; y += 0.5) points.push({ x, y });
  for (let i = 0; i < 360; i++) {
    const angle = (i / 360) * Math.PI * 2;
    for (const r of [0, 10, 47.999999, 48, 48.000001, 48.5, 60, 100]) {
      points.push({ x: DOUGH_CENTER + Math.cos(angle) * r, y: DOUGH_CENTER + Math.sin(angle) * r });
    }
  }
  return points;
}

describe("ROUND_PAN_GEOMETRY is the existing round behaviour, by reference", () => {
  it("contains / clamp are the very same functions the round pizza uses today", () => {
    expect(ROUND_PAN_GEOMETRY.contains).toBe(isInsideDough);
    expect(ROUND_PAN_GEOMETRY.clamp).toBe(clampToDough);
    expect(ROUND_PAN_GEOMETRY.shape).toBe("round");
  });

  it("pins the legacy boundary semantics (inclusive rim at DOUGH_RADIUS)", () => {
    expect(ROUND_PAN_GEOMETRY.contains(DOUGH_CENTER + DOUGH_RADIUS, DOUGH_CENTER)).toBe(true);
    expect(ROUND_PAN_GEOMETRY.contains(DOUGH_CENTER + DOUGH_RADIUS + 1e-9, DOUGH_CENTER)).toBe(false);
    expect(ROUND_PAN_GEOMETRY.contains(DOUGH_CENTER, DOUGH_CENTER)).toBe(true);
  });

  it("agrees with the legacy functions on every probe point", () => {
    for (const p of probePoints()) {
      expect(ROUND_PAN_GEOMETRY.contains(p.x, p.y)).toBe(isInsideDough(p.x, p.y));
      expect(ROUND_PAN_GEOMETRY.clamp(p.x, p.y)).toEqual(clampToDough(p.x, p.y));
    }
  });

  it("bounds and target area are the existing round numbers", () => {
    expect(ROUND_PAN_GEOMETRY.bounds).toEqual({ minX: 2, minY: 2, maxX: 98, maxY: 98 });
    expect(ROUND_PAN_GEOMETRY.targetArea.contains(DOUGH_CENTER + SAUCE_TARGET_RADIUS, DOUGH_CENTER)).toBe(true);
    expect(ROUND_PAN_GEOMETRY.targetArea.contains(DOUGH_CENTER + SAUCE_TARGET_RADIUS + 1e-9, DOUGH_CENTER)).toBe(false);
    expect(ROUND_PAN_GEOMETRY.targetArea.area).toBeCloseTo(Math.PI * SAUCE_TARGET_RADIUS ** 2, 9);
  });
});

describe("SQUARE_PAN_GEOMETRY", () => {
  it("layout constants stay inside the dough box and keep an area close to the round dough", () => {
    expect(SQUARE_PAN_HALF_SIDE).toBe(44);
    expect(LO).toBeGreaterThan(0);
    expect(HI).toBeLessThan(100);
    const squareArea = (2 * SQUARE_PAN_HALF_SIDE) ** 2;
    const roundArea = Math.PI * DOUGH_RADIUS ** 2;
    expect(Math.abs(squareArea - roundArea) / roundArea).toBeLessThan(0.1);
  });

  it("contains: all four edges are inclusive, one hair outside is not", () => {
    const eps = 1e-9;
    for (const [x, y] of [
      [LO, 50],
      [HI, 50],
      [50, LO],
      [50, HI],
    ]) {
      expect(SQUARE_PAN_GEOMETRY.contains(x, y), `${x},${y}`).toBe(true);
    }
    for (const [x, y] of [
      [LO - eps, 50],
      [HI + eps, 50],
      [50, LO - eps],
      [50, HI + eps],
    ]) {
      expect(SQUARE_PAN_GEOMETRY.contains(x, y), `${x},${y}`).toBe(false);
    }
  });

  it("contains: the four corners are inside, and a point just past a corner on either axis is not", () => {
    for (const corner of SQUARE_PAN_CORNERS) {
      expect(SQUARE_PAN_GEOMETRY.contains(corner.x, corner.y)).toBe(true);
      const sx = Math.sign(corner.x - DOUGH_CENTER);
      expect(SQUARE_PAN_GEOMETRY.contains(corner.x + sx * 1e-9, corner.y)).toBe(false);
    }
    // a corner is outside the round dough: that is exactly the area the square pan adds
    expect(isInsideDough(SQUARE_PAN_CORNERS[0].x, SQUARE_PAN_CORNERS[0].y)).toBe(false);
    expect(SQUARE_PAN_CORNERS).toHaveLength(4);
  });

  it("contains: non-finite coordinates are never on the pan", () => {
    for (const [x, y] of [
      [NaN, 50],
      [50, NaN],
      [Infinity, 50],
      [50, -Infinity],
      [NaN, NaN],
    ]) {
      expect(SQUARE_PAN_GEOMETRY.contains(x, y)).toBe(false);
    }
  });

  it("clamp: a point already on the pan comes back unchanged", () => {
    for (const p of probePoints()) {
      if (!SQUARE_PAN_GEOMETRY.contains(p.x, p.y)) continue;
      expect(SQUARE_PAN_GEOMETRY.clamp(p.x, p.y)).toEqual({ x: p.x, y: p.y });
    }
  });

  it("clamp: a point off the pan lands on the pan, keeps its direction from the centre, and is stable", () => {
    for (const p of probePoints()) {
      if (SQUARE_PAN_GEOMETRY.contains(p.x, p.y)) continue;
      const c = SQUARE_PAN_GEOMETRY.clamp(p.x, p.y);
      expect(SQUARE_PAN_GEOMETRY.contains(c.x, c.y), `${p.x},${p.y}`).toBe(true);
      // same direction from the centre: the cross product of the two offsets is ~0 and they point the same way
      const dx = p.x - DOUGH_CENTER;
      const dy = p.y - DOUGH_CENTER;
      const cx = c.x - DOUGH_CENTER;
      const cy = c.y - DOUGH_CENTER;
      expect(Math.abs(dx * cy - dy * cx)).toBeLessThan(1e-6);
      expect(dx * cx + dy * cy).toBeGreaterThan(0);
      // lands on the rim (a hair inside), never deeper
      expect(Math.max(Math.abs(cx), Math.abs(cy))).toBeCloseTo(SQUARE_PAN_HALF_SIDE - CLAMP_INSET_EPSILON, 6);
      // clamping again changes nothing
      expect(SQUARE_PAN_GEOMETRY.clamp(c.x, c.y)).toEqual(c);
    }
  });

  it("clamp: a point just past the rim, and one far away on the diagonal, both land on the pan", () => {
    const near = SQUARE_PAN_GEOMETRY.clamp(HI + 1e-9, 50);
    expect(SQUARE_PAN_GEOMETRY.contains(near.x, near.y)).toBe(true);
    const far = SQUARE_PAN_GEOMETRY.clamp(1e9, 1e9);
    expect(SQUARE_PAN_GEOMETRY.contains(far.x, far.y)).toBe(true);
    expect(far.x).toBeCloseTo(far.y, 9);
  });

  it("clamp: a non-finite point has no direction and lands on the centre", () => {
    for (const [x, y] of [
      [NaN, 10],
      [10, Infinity],
    ]) {
      expect(SQUARE_PAN_GEOMETRY.clamp(x, y)).toEqual({ x: DOUGH_CENTER, y: DOUGH_CENTER });
    }
  });

  it("bounds are the pan edges, and every pan point is inside them", () => {
    expect(SQUARE_PAN_GEOMETRY.bounds).toEqual({ minX: LO, minY: LO, maxX: HI, maxY: HI });
  });

  it("targetArea: inside the pan, inclusive at its own edge, proportional to the round target", () => {
    expect(SQUARE_TARGET_HALF_SIDE).toBeCloseTo(SQUARE_PAN_HALF_SIDE * (SAUCE_TARGET_RADIUS / DOUGH_RADIUS), 12);
    expect(SQUARE_TARGET_HALF_SIDE).toBeLessThan(SQUARE_PAN_HALF_SIDE);
    expect(SQUARE_PAN_GEOMETRY.targetArea.contains(DOUGH_CENTER + SQUARE_TARGET_HALF_SIDE, DOUGH_CENTER)).toBe(true);
    expect(SQUARE_PAN_GEOMETRY.targetArea.contains(DOUGH_CENTER + SQUARE_TARGET_HALF_SIDE + 1e-9, DOUGH_CENTER)).toBe(false);
    expect(SQUARE_PAN_GEOMETRY.targetArea.contains(NaN, 50)).toBe(false);
    expect(SQUARE_PAN_GEOMETRY.targetArea.area).toBeCloseTo((2 * SQUARE_TARGET_HALF_SIDE) ** 2, 9);
    for (const p of probePoints()) {
      if (SQUARE_PAN_GEOMETRY.targetArea.contains(p.x, p.y)) expect(SQUARE_PAN_GEOMETRY.contains(p.x, p.y)).toBe(true);
    }
  });
});

describe("getPanGeometry", () => {
  it("maps each shape to its geometry", () => {
    expect(getPanGeometry("round")).toBe(ROUND_PAN_GEOMETRY);
    expect(getPanGeometry("square")).toBe(SQUARE_PAN_GEOMETRY);
  });
});
