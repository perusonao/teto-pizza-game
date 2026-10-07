import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { isEdgeToEdgeCutLine } from "./types";
import { appendTraceSample, buildTracedCutLine, TRACE_MIN_LENGTH, TRACE_SAMPLE_MIN_DISTANCE } from "./trace";

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
