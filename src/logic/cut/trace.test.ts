import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { isEdgeToEdgeCutLine } from "./types";
import { appendTraceSample, buildTracedCutLine, straightenTrace, STRAIGHT_HOLD_TOLERANCE, STRAIGHT_MAX_SAG_RATIO, STRAIGHT_MIN_LENGTH, tracePathLength, rimCrossing, segmentRimChord, TRACE_MIN_LENGTH, TRACE_SAMPLE_MIN_DISTANCE } from "./trace";

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

/** A rim-to-rim finger path from `a` to `b`, bowed by `bow` (fraction of the chord) with a sine profile. */
function fingerPath(a: [number, number], b: [number, number], bow: number, turns = 0.5, n = 40) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const off = bow * len * Math.sin(2 * Math.PI * turns * t);
    return { x: a[0] + dx * t - (dy / len) * off, y: a[1] + dy * t + (dx / len) * off };
  });
}

function distToPolyline(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i += 1) {
    const a = poly[i - 1];
    const b = poly[i];
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y)));
  }
  return best;
}

describe("buildTracedCutLine keeps the finger's path (no straightening)", () => {
  const cases: [string, [number, number], [number, number], number, number][] = [
    ["arc 6%", [4, 60], [96, 60], 0.06, 0.5],
    ["arc 10%", [4, 60], [96, 60], 0.1, 0.5],
    ["arc 14%", [4, 60], [96, 60], 0.14, 0.5],
    ["diagonal arc 8%", [14, 14], [86, 86], 0.08, 0.5],
    ["S curve 5%", [4, 45], [96, 55], 0.05, 1],
    ["straight, off centre", [4, 30], [96, 30], 0, 0.5],
  ];
  for (const [name, a, b, bow, turns] of cases) {
    it(`${name}: stored path is the traced path, sample for sample`, () => {
      const finger = fingerPath(a, b, bow, turns);
      const line = buildTracedCutLine(finger)!;
      expect(line.path).toEqual(finger);
      // the committed boundary never strays from where the finger went
      for (const p of finger) expect(distToPolyline(p, line.path!)).toBeLessThan(1e-9);
      expect(tracePathLength(line.path!)).toBeCloseTo(tracePathLength(finger), 9);
    });
  }
});

describe("straightenTrace (explicit hold assist)", () => {
  it("turns a near-straight stroke into [start, tip]; start and tip are untouched", () => {
    const finger = fingerPath([4, 40], [96, 40], 0.03);
    const out = straightenTrace(finger)!;
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(finger[0]);
    expect(out[1]).toBe(finger[finger.length - 1]);
  });

  it("never touches a clearly curved stroke (arc 8%, 10%, 14%, S 7%, L-turn)", () => {
    for (const bow of [0.08, 0.1, 0.14]) expect(straightenTrace(fingerPath([4, 60], [96, 60], bow))).toBeNull();
    expect(straightenTrace(fingerPath([4, 45], [96, 55], 0.07, 1))).toBeNull();
    expect(straightenTrace([{ x: 20, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 20 }])).toBeNull();
  });

  it("never touches a short stroke, a lone point or a stroke that doubles back", () => {
    expect(straightenTrace(fingerPath([30, 50], [30 + STRAIGHT_MIN_LENGTH - 1, 50], 0))).toBeNull();
    expect(straightenTrace([{ x: 50, y: 50 }])).toBeNull();
    expect(straightenTrace([{ x: 20, y: 50 }, { x: 70, y: 50 }, { x: 40, y: 50.5 }, { x: 55, y: 50 }])).toBeNull();
  });

  it("the sag limit is a fraction of the stroke length", () => {
    const sag = (ratio: number) => [{ x: 10, y: 50 }, { x: 50, y: 50 + ratio * 80 }, { x: 90, y: 50 }];
    expect(straightenTrace(sag(STRAIGHT_MAX_SAG_RATIO - 0.005))).not.toBeNull();
    expect(straightenTrace(sag(STRAIGHT_MAX_SAG_RATIO + 0.005))).toBeNull();
    expect(STRAIGHT_HOLD_TOLERANCE).toBeGreaterThan(0);
  });
});

describe("rimCrossing", () => {
  it("finds the rim point between an outside and an inside sample (stroke entering the pizza)", () => {
    const entry = rimCrossing({ x: 95, y: 50 }, { x: -10, y: 50 });
    expect(entry.x).toBeCloseTo(DOUGH_CENTER - DOUGH_RADIUS, 6);
    expect(entry.y).toBeCloseTo(50, 6);
  });
});

describe("segmentRimChord", () => {
  it("returns entry and exit rim points for a segment jumping across the pizza", () => {
    const [a, b] = segmentRimChord({ x: -10, y: 50 }, { x: 110, y: 50 })!;
    expect(a.x).toBeCloseTo(C - DOUGH_RADIUS, 6);
    expect(b.x).toBeCloseTo(C + DOUGH_RADIUS, 6);
  });
  it("is null for a segment that misses the pizza or ends inside it", () => {
    expect(segmentRimChord({ x: -10, y: 0 }, { x: 110, y: 0 })).toBeNull();
    expect(segmentRimChord({ x: -10, y: 50 }, { x: 50, y: 50 })).toBeNull();
  });
});
