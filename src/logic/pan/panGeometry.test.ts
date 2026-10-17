import { describe, expect, it } from "vitest";
import { mulberry32 as rng } from "../testSupport/seededRng";
import { clampToDough, DOUGH_CENTER, DOUGH_RADIUS, isInsideDough } from "../pizzaCoordinates";
import { SAUCE_TARGET_RADIUS } from "../sauceField";
import { panGeometryFor, roundPanGeometry, SQUARE_PAN_CORNERS, SQUARE_PAN_HALF_SIDE, SQUARE_SAUCE_TARGET_HALF_SIDE, squarePanGeometry } from "./panGeometry";

const random = rng(534);
const POINTS: [number, number][] = [
  ...Array.from({ length: 4000 }, () => [random() * 140 - 20, random() * 140 - 20] as [number, number]),
  ...[-10, 0, 2, 50, 98, 100, 110].flatMap((x) => [-10, 0, 2, 50, 98, 100, 110].map((y) => [x, y] as [number, number])),
];

describe("round pan geometry is a thin wrapper over the existing circular helpers", () => {
  it("is the default shape", () => {
    expect(panGeometryFor()).toBe(roundPanGeometry);
    expect(panGeometryFor("round")).toBe(roundPanGeometry);
    expect(roundPanGeometry.shape).toBe("round");
  });

  it("contains / clamp give exactly isInsideDough / clampToDough at thousands of points (including the rim and far outside)", () => {
    for (const [x, y] of POINTS) {
      expect(roundPanGeometry.contains(x, y), `${x},${y}`).toBe(isInsideDough(x, y));
      expect(roundPanGeometry.clamp(x, y), `${x},${y}`).toEqual(clampToDough(x, y));
    }
    for (const angle of [0, 0.3, 1, 2.2, Math.PI, 4.1, 5.5]) {
      const x = DOUGH_CENTER + Math.cos(angle) * DOUGH_RADIUS;
      const y = DOUGH_CENTER + Math.sin(angle) * DOUGH_RADIUS;
      expect(roundPanGeometry.contains(x, y)).toBe(isInsideDough(x, y));
    }
  });

  it("bounds are the dough circle's box; the target area is the existing sauce target circle", () => {
    expect(roundPanGeometry.bounds()).toEqual({ minX: 2, minY: 2, maxX: 98, maxY: 98 });
    const target = roundPanGeometry.targetArea();
    expect(target.kind).toBe("circle");
    expect(target.area).toBeCloseTo(Math.PI * SAUCE_TARGET_RADIUS ** 2, 9);
    for (const [x, y] of POINTS) expect(target.contains(x, y)).toBe(Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER) <= SAUCE_TARGET_RADIUS);
  });
});

describe("square pan geometry", () => {
  const g = squarePanGeometry;
  const lo = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
  const hi = DOUGH_CENTER + SQUARE_PAN_HALF_SIDE;

  it("is selected by shape 'square' only", () => {
    expect(panGeometryFor("square")).toBe(squarePanGeometry);
    expect(g.shape).toBe("square");
  });

  it("contains is the axis-aligned square, boundary inclusive, and holds all four corners", () => {
    for (const [x, y] of POINTS) expect(g.contains(x, y), `${x},${y}`).toBe(x >= lo && x <= hi && y >= lo && y <= hi);
    for (const c of SQUARE_PAN_CORNERS) expect(g.contains(c.x, c.y)).toBe(true);
    // a square pan reaches where the round dough cannot: its corner is outside the circle
    for (const c of SQUARE_PAN_CORNERS) expect(isInsideDough(c.x, c.y)).toBe(false);
  });

  it("clamp returns an on-pan point unchanged and projects every other point onto the pan (idempotent, never NaN)", () => {
    for (const [x, y] of POINTS) {
      const p = g.clamp(x, y);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(g.contains(p.x, p.y), `${x},${y} -> ${p.x},${p.y}`).toBe(true);
      expect(g.clamp(p.x, p.y)).toEqual(p);
      if (g.contains(x, y)) expect(p).toEqual({ x, y });
    }
  });

  it("clamp moves a point only as far as needed along each axis (a point off one side keeps its other coordinate)", () => {
    expect(g.clamp(200, 50).y).toBe(50);
    expect(g.clamp(50, -40).x).toBe(50);
    expect(g.clamp(200, 200).x).toBeCloseTo(hi, 6);
    expect(g.clamp(200, 200).y).toBeCloseTo(hi, 6);
  });

  it("clamp never returns a non-finite coordinate (NaN / Infinity land on the pan)", () => {
    for (const [x, y] of [[Number.NaN, 50], [50, Number.NaN], [Number.POSITIVE_INFINITY, 50], [50, Number.NEGATIVE_INFINITY], [Number.NaN, Number.NaN]] as const) {
      const p = g.clamp(x, y);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${x},${y}`).toBe(true);
      expect(g.contains(p.x, p.y), `${x},${y}`).toBe(true);
    }
  });

  it("bounds and target area are constant objects (no allocation per call on the hot path)", () => {
    expect(g.bounds()).toBe(g.bounds());
    expect(g.targetArea()).toBe(g.targetArea());
    expect(roundPanGeometry.bounds()).toBe(roundPanGeometry.bounds());
    expect(roundPanGeometry.targetArea()).toBe(roundPanGeometry.targetArea());
  });

  it("bounds are the pan's box", () => {
    expect(g.bounds()).toEqual({ minX: lo, minY: lo, maxX: hi, maxY: hi });
  });

  it("has its OWN sauce target: a square inside the pan with the round target's 8-unit rim margin, not the circular SAUCE_TARGET_RADIUS", () => {
    const target = g.targetArea();
    expect(target.kind).toBe("rect");
    expect(SQUARE_SAUCE_TARGET_HALF_SIDE).toBe(36);
    expect(SQUARE_PAN_HALF_SIDE - SQUARE_SAUCE_TARGET_HALF_SIDE).toBe(DOUGH_RADIUS - SAUCE_TARGET_RADIUS);
    expect(target.area).toBe(72 * 72);
    for (const [x, y] of POINTS) {
      expect(target.contains(x, y), `${x},${y}`).toBe(Math.abs(x - DOUGH_CENTER) <= 36 && Math.abs(y - DOUGH_CENTER) <= 36);
      if (target.contains(x, y)) expect(g.contains(x, y)).toBe(true); // the target lies inside the pan
    }
    // the target reaches the square's corners' direction, where the circular target would not
    expect(target.contains(DOUGH_CENTER + 36, DOUGH_CENTER + 36)).toBe(true);
    expect(roundPanGeometry.targetArea().contains(DOUGH_CENTER + 36, DOUGH_CENTER + 36)).toBe(false);
  });
});
