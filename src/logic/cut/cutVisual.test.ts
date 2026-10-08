import { describe, expect, it } from "vitest";
import { createIdealDoughShape } from "../doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { buildCutVisual, CUT_CRUST_WIDTH, isThroughCut, rayToRadius } from "./cutVisual";
import type { CutLine } from "./types";

const C = DOUGH_CENTER;
const R = DOUGH_RADIUS;
const radius = (p: { x: number; y: number }) => Math.hypot(p.x - C, p.y - C);

const throughLine: CutLine = {
  start: { x: C - R, y: C },
  end: { x: C + R, y: C },
  path: [{ x: C - R, y: C }, { x: C + R, y: C }],
};
const partialLine: CutLine = {
  start: { x: C - R, y: C },
  end: { x: C + R, y: C },
  path: [{ x: C, y: C }, { x: C + 20, y: C }],
};

describe("isThroughCut (visual only)", () => {
  it("is true for a trace running rim to rim, false for a partial stroke or one end only", () => {
    expect(isThroughCut(throughLine)).toBe(true);
    expect(isThroughCut(partialLine)).toBe(false);
    expect(isThroughCut({ ...partialLine, path: [{ x: C - R, y: C }, { x: C, y: C }] })).toBe(false);
  });
  it("treats a chord-only legacy line as through", () => {
    expect(isThroughCut({ start: throughLine.start, end: throughLine.end })).toBe(true);
  });
  it("counts an end within the crust width of the edge as reached -- and only that", () => {
    const at = (r: number): CutLine => ({
      start: { x: C - r, y: C },
      end: { x: C + r, y: C },
      path: [{ x: C - r, y: C }, { x: C + r, y: C }],
    });
    expect(CUT_CRUST_WIDTH).toBe(6);
    expect(isThroughCut(at(R - CUT_CRUST_WIDTH + 0.1))).toBe(true);
    expect(isThroughCut(at(R - CUT_CRUST_WIDTH - 0.1))).toBe(false);
    expect(isThroughCut(at(R - 3))).toBe(true); // a finger lifted a little short of the rim
    expect(isThroughCut(at(R - 12))).toBe(false); // clearly partial
  });
  it("measures reach against a smaller hand-shaped pizza's own edge, not the ideal circle", () => {
    const small = { radii: new Array(8).fill(40) };
    const path = [{ x: C - 36, y: C }, { x: C + 36, y: C }];
    expect(isThroughCut({ start: path[0], end: path[1], path }, small)).toBe(true);
    expect(isThroughCut({ start: path[0], end: path[1], path })).toBe(false);
  });
});

describe("buildCutVisual", () => {
  it("runs a through cut on past the traced rim end so it can reach the visible edge", () => {
    const v = buildCutVisual(throughLine, createIdealDoughShape());
    expect(v.through).toBe(true);
    expect(v.points[0].x).toBeLessThan(C - R);
    expect(v.points[v.points.length - 1].x).toBeGreaterThan(C + R);
    expect(v.ends).toHaveLength(2);
    for (const e of v.ends) expect(radius(e.tip)).toBeGreaterThanOrEqual(R - 1e-6);
  });
  it("never extends a partial stroke: drawn exactly as traced, no crust ends", () => {
    const v = buildCutVisual(partialLine);
    expect(v.through).toBe(false);
    expect(v.points).toEqual(partialLine.path);
    expect(v.ends).toEqual([]);
  });
  it("keeps a curved through cut's whole traced path (only the two ends are run on)", () => {
    const path = [{ x: C - R, y: C }, { x: C, y: C + 10 }, { x: C + R, y: C }];
    const v = buildCutVisual({ start: path[0], end: path[2], path });
    expect(v.points.slice(1, -1)).toEqual(path);
  });
  it("puts the tip on the shaped pizza's own edge", () => {
    const shape = { radii: new Array(8).fill(49) };
    const v = buildCutVisual(throughLine, shape);
    for (const e of v.ends) expect(radius(e.tip)).toBeCloseTo(49, 6);
  });
});

describe("rayToRadius", () => {
  it("walks a ray to a target radius", () => {
    const p = rayToRadius({ x: C, y: C }, { x: 0, y: 1 }, 30);
    expect(p.x).toBeCloseTo(C, 9);
    expect(p.y).toBeCloseTo(C + 30, 9);
  });
});
