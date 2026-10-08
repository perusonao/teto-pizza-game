import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { isEdgeToEdgeCutLine } from "./types";
import { appendTraceSample, buildTracedCutLine, shapeTrace, SHAPE_MIN_LENGTH, SHAPE_RAMP, SHAPE_S1, SHAPE_S2, rimCrossing, segmentRimChord, TRACE_MIN_LENGTH, TRACE_SAMPLE_MIN_DISTANCE } from "./trace";

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

describe("shapeTrace (straight-line assist)", () => {
  const keep: [string, [number, number], [number, number], number, number][] = [
    ["arc 6%", [4, 60], [96, 60], 0.06, 0.5],
    ["arc 10%", [4, 60], [96, 60], 0.1, 0.5],
    ["arc 14%", [4, 60], [96, 60], 0.14, 0.5],
    ["diagonal arc 8%", [14, 14], [86, 86], 0.08, 0.5],
    ["S curve 5%", [4, 45], [96, 55], 0.05, 1],
  ];
  for (const [name, a, b, bow, turns] of keep) {
    it(`${name}: a deliberate curve is kept exactly as traced`, () => {
      const finger = fingerPath(a, b, bow, turns);
      expect(shapeTrace(finger)).toBe(finger);
      expect(buildTracedCutLine(finger)!.path).toEqual(finger);
    });
  }

  it("a perfectly straight stroke is unchanged", () => {
    const finger = fingerPath([4, 30], [96, 30], 0);
    expect(shapeTrace(finger).every((p, i) => Math.abs(p.y - finger[i].y) < 1e-9)).toBe(true);
  });

  it("hand sway within the assist band is pulled onto the start->tip line; ends never move", () => {
    const finger = fingerPath([4, 40], [96, 40], 0.02); // sag 2% of the chord
    const out = shapeTrace(finger);
    expect(out[0]).toBe(finger[0]);
    expect(out[out.length - 1]).toBe(finger[finger.length - 1]);
    for (const p of out) expect(Math.abs(p.y - 40)).toBeLessThan(1e-9);
  });

  it("the correction never exceeds SHAPE_S1 of the stroke length (gentle S 3% measured)", () => {
    for (const [bow, turns] of [[0.03, 1], [0.03, 0.5], [0.04, 0.5], [0.02, 1]] as const) {
      const finger = fingerPath([4, 45], [96, 55], bow, turns);
      const out = shapeTrace(finger);
      const len = Math.hypot(92, 10);
      let worst = 0;
      finger.forEach((p, i) => {
        worst = Math.max(worst, Math.hypot(p.x - out[i].x, p.y - out[i].y));
      });
      expect(worst).toBeLessThanOrEqual(SHAPE_S1 * len + 1e-9);
    }
  });

  it("is continuous: no jump as the bow grows through the assist band, or as the stroke lengthens", () => {
    let prev = shapeTrace(fingerPath([4, 60], [96, 60], 0));
    for (let bow = 0.001; bow <= 0.06; bow += 0.001) {
      const cur = shapeTrace(fingerPath([4, 60], [96, 60], bow));
      let step = 0;
      cur.forEach((p, i) => {
        step = Math.max(step, Math.hypot(p.x - prev[i].x, p.y - prev[i].y));
      });
      // a 0.1%-of-length change of bow moves the raw path ~0.09; the taper (1/(S2-S1) = 50x) adds at most ~0.17 more
      expect(step).toBeLessThan(0.3);
      prev = cur;
    }
    let prevLen = shapeTrace(fingerPath([10, 50], [10 + SHAPE_MIN_LENGTH, 50], 0.03));
    for (let len = SHAPE_MIN_LENGTH; len <= SHAPE_MIN_LENGTH + SHAPE_RAMP + 5; len += 0.5) {
      const raw = fingerPath([10, 50], [10 + len, 50], 0.03);
      const out = shapeTrace(raw);
      // each vertex is at most 3% of the length off the line; ramping in moves it at most that far
      const worst = Math.max(...out.map((p, i) => Math.hypot(p.x - raw[i].x, p.y - raw[i].y)));
      expect(worst).toBeLessThanOrEqual(0.03 * len + 1e-9);
      prevLen = out;
    }
    expect(prevLen.length).toBeGreaterThan(2);
  });

  it("does nothing to a short stroke", () => {
    const short = fingerPath([30, 50], [30 + SHAPE_MIN_LENGTH, 50], 0.02);
    expect(shapeTrace(short)).toBe(short);
  });

  it("the commit is the preview: buildTracedCutLine stores exactly shapeTrace of the trace", () => {
    for (const bow of [0.01, 0.03, 0.035, 0.05, 0.1]) {
      const finger = fingerPath([4, 60], [96, 60], bow);
      expect(buildTracedCutLine(finger)!.path).toEqual(shapeTrace(finger));
    }
    expect(SHAPE_S2).toBeGreaterThan(SHAPE_S1);
  });

  it("keeps a clear change of direction (L-turn)", () => {
    const l = [{ x: 20, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 20 }];
    expect(shapeTrace(l)).toBe(l);
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
