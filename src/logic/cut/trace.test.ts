import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { isEdgeToEdgeCutLine } from "./types";
import { buildDragCutPath, buildTracedCutLine, TRACE_MIN_LENGTH } from "./trace";

const C = DOUGH_CENTER;
const R = DOUGH_RADIUS;
const onRim = (p: { x: number; y: number }) => Math.hypot(p.x - C, p.y - C);

describe("buildDragCutPath", () => {
  it("passes exactly through a start and end that are both on the pizza (no change at all)", () => {
    const a = { x: 30.123, y: 41.5 };
    const b = { x: 71.25, y: 62.875 };
    const path = buildDragCutPath(a, b)!;
    expect(path[0]).toBe(a);
    expect(path[1]).toBe(b);
  });

  it("clips a start outside the pizza to the rim, on the same line", () => {
    const path = buildDragCutPath({ x: -10, y: 40 }, { x: 60, y: 40 })!;
    expect(path[1]).toEqual({ x: 60, y: 40 });
    expect(onRim(path[0])).toBeCloseTo(R, 9);
    expect(path[0].y).toBeCloseTo(40, 9);
  });

  it("clips an end outside the pizza to the rim, on the same line", () => {
    const path = buildDragCutPath({ x: 40, y: 50 }, { x: 40 + 100, y: 50 + 50 })!;
    expect(path[0]).toEqual({ x: 40, y: 50 });
    expect(onRim(path[1])).toBeCloseTo(R, 9);
    expect((path[1].y - 50) / (path[1].x - 40)).toBeCloseTo(0.5, 9);
  });

  it("an outside-to-outside drag across the pizza is the rim-to-rim chord of that line", () => {
    const start = { x: -8, y: 30 };
    const end = { x: 112, y: 74 };
    const [from, to] = buildDragCutPath(start, end)!;
    expect(onRim(from)).toBeCloseTo(R, 9);
    expect(onRim(to)).toBeCloseTo(R, 9);
    for (const p of [from, to]) {
      const t = (p.x - start.x) / (end.x - start.x);
      expect(p.y).toBeCloseTo(start.y + t * (end.y - start.y), 9);
    }
  });

  it("horizontal, vertical and diagonal drags stay exactly on their axis", () => {
    const h = buildDragCutPath({ x: 5, y: 37 }, { x: 95, y: 37 })!;
    expect(h[0].y).toBe(37);
    expect(h[1].y).toBe(37);
    const v = buildDragCutPath({ x: 63, y: 5 }, { x: 63, y: 95 })!;
    expect(v[0].x).toBe(63);
    expect(v[1].x).toBe(63);
    const d = buildDragCutPath({ x: 5, y: 5 }, { x: 95, y: 95 })!;
    expect(d[0].x).toBeCloseTo(d[0].y, 9);
    expect(d[1].x).toBeCloseTo(d[1].y, 9);
  });

  it("a drag that misses the pizza, or has no length, is no cut", () => {
    expect(buildDragCutPath({ x: -10, y: -5 }, { x: 110, y: -5 })).toBeNull();
    expect(buildDragCutPath({ x: 50, y: 50 }, { x: 50, y: 50 })).toBeNull();
  });

  it("a tap-length drag (under TRACE_MIN_LENGTH on the pizza) is discarded", () => {
    expect(buildDragCutPath({ x: C, y: C }, { x: C + TRACE_MIN_LENGTH / 2, y: C })).toBeNull();
    expect(buildDragCutPath({ x: C, y: C }, { x: C + TRACE_MIN_LENGTH, y: C })).not.toBeNull();
    // a graze through the rim edge is too short to count
    expect(buildDragCutPath({ x: -10, y: C - (R - 0.1) }, { x: 110, y: C - (R - 0.1) })).toBeNull();
  });

  it("is a pure function of the two points: moving the end never moves the start", () => {
    const start = { x: 20, y: 60 };
    for (const end of [{ x: 70, y: 40 }, { x: 80, y: 90 }, { x: 120, y: 60 }]) {
      expect(buildDragCutPath(start, end)![0]).toBe(start);
    }
  });
});

describe("buildTracedCutLine", () => {
  it("returns null for a tap-length path", () => {
    expect(buildTracedCutLine([{ x: C, y: C }, { x: C + TRACE_MIN_LENGTH / 2, y: C }])).toBeNull();
  });

  it("keeps the exact path as the cut's authority; start/end is only the evaluation chord", () => {
    const path = buildDragCutPath({ x: 20, y: 50 }, { x: 80, y: 50 })!;
    const line = buildTracedCutLine(path)!;
    expect(line.path).toBe(path);
    expect(isEdgeToEdgeCutLine(line)).toBe(true);
  });
});
