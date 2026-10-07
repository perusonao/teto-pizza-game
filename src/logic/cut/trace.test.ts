import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { isEdgeToEdgeCutLine } from "./types";
import { appendTraceSample, buildTracedCutLine, stabilizeTrace, rimCrossing, TRACE_MIN_LENGTH, TRACE_SAMPLE_MIN_DISTANCE } from "./trace";

const C = DOUGH_CENTER;

describe("appendTraceSample", () => {
  it("drops sub-threshold jitter but keeps every real sample verbatim (no smoothing)", () => {
    let path = [{ x: C, y: C }];
    path = [...appendTraceSample(path, { x: C + TRACE_SAMPLE_MIN_DISTANCE / 2, y: C }).path];
    expect(path).toHaveLength(1);
    const kept = appendTraceSample(path, { x: C + 5, y: C + 3 });
    expect(kept.path[1]).toEqual({ x: C + 5, y: C + 3 });
    expect(kept.exited).toBe(false);
  });

  it("ends on the rim when the finger leaves the dough", () => {
    const r = appendTraceSample([{ x: C, y: C }], { x: C + 80, y: C });
    expect(r.exited).toBe(true);
    const end = r.path[r.path.length - 1];
    expect(end.x).toBeCloseTo(C + DOUGH_RADIUS, 6);
    expect(end.y).toBeCloseTo(C, 6);
  });
});

describe("buildTracedCutLine", () => {
  it("returns null for a tap-length path", () => {
    expect(buildTracedCutLine([{ x: C, y: C }, { x: C + TRACE_MIN_LENGTH / 2, y: C }])).toBeNull();
  });

  it("keeps the exact path as the cut's authority; start/end is only the evaluation chord", () => {
    const path = [
      { x: 30, y: 50 },
      { x: 50, y: 30 },
      { x: 70, y: 50 },
    ];
    const line = buildTracedCutLine(path)!;
    expect(line.path).toBe(path);
    expect(isEdgeToEdgeCutLine(line)).toBe(true);
  });

  it("still yields a chord for a path that curls back to its start", () => {
    const path = [
      { x: 50, y: 50 },
      { x: 60, y: 50 },
      { x: 60, y: 60 },
      { x: 50, y: 51 },
    ];
    expect(buildTracedCutLine(path)).not.toBeNull();
  });
});

describe("stabilizeTrace", () => {
  it("collapses a stroke that hugs its chord to just start and end (no extension, no snap)", () => {
    const p = [{ x: 20, y: 50 }, { x: 35, y: 51.5 }, { x: 50, y: 48.8 }, { x: 65, y: 50.9 }, { x: 80, y: 52 }];
    expect(stabilizeTrace(p)).toEqual([p[0], p[4]]);
  });

  it("keeps a clear curve exactly as traced", () => {
    const p = [{ x: 20, y: 50 }, { x: 50, y: 35 }, { x: 80, y: 50 }];
    expect(stabilizeTrace(p)).toBe(p);
  });

  it("scales the allowance with stroke length: a natural arm arc on a long stroke stays straight", () => {
    const arc = [{ x: 10, y: 50 }, { x: 30, y: 46 }, { x: 50, y: 44.5 }, { x: 70, y: 46 }, { x: 90, y: 50 }];
    expect(stabilizeTrace(arc)).toEqual([arc[0], arc[4]]); // 5.5 sag on an 80 chord (~7%)
    const bowed = [{ x: 10, y: 50 }, { x: 50, y: 32 }, { x: 90, y: 50 }]; // 18 sag (~22%)
    expect(stabilizeTrace(bowed)).toBe(bowed);
  });

  it("keeps a clear change of direction (L-turn)", () => {
    const p = [{ x: 20, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 20 }];
    expect(stabilizeTrace(p)).toBe(p);
  });

  it("keeps a stroke that doubles back", () => {
    const p = [{ x: 20, y: 50 }, { x: 60, y: 50 }, { x: 40, y: 50.5 }, { x: 55, y: 50 }];
    expect(stabilizeTrace(p)).toBe(p);
  });
});

describe("rimCrossing", () => {
  it("finds the rim point between an outside and an inside sample (stroke entering the pizza)", () => {
    const entry = rimCrossing({ x: 95, y: 50 }, { x: -10, y: 50 });
    expect(entry.x).toBeCloseTo(DOUGH_CENTER - DOUGH_RADIUS, 6);
    expect(entry.y).toBeCloseTo(50, 6);
  });
});
