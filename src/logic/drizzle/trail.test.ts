import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS, isInsideDough } from "../pizzaCoordinates";
import { COORD_ABS_MAX, QUANT_STEP, TAP_LINE_LENGTH, type TrailPoint } from "./postBakeLiquid";
import { clampTrailPoint, clientToTrailPoint, dropRepeats, isTrailPoint, quantize, resampleTrail, tapTrail, thinTrail, trailLength } from "./trail";

const isQuantized = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
const line = (n: number): TrailPoint[] => Array.from({ length: n }, (_, i) => ({ x: 20 + i * 0.5, y: 50 }));

describe("isTrailPoint", () => {
  it("accepts finite plausible points", () => {
    expect(isTrailPoint({ x: 0, y: 0 })).toBe(true);
    expect(isTrailPoint({ x: -3.5, y: COORD_ABS_MAX })).toBe(true);
  });
  it("refuses everything else", () => {
    for (const v of [null, undefined, 1, "x", [], { x: 1 }, { x: "1", y: 2 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: COORD_ABS_MAX + 1, y: 0 }, { x: 0, y: -COORD_ABS_MAX - 1 }]) {
      expect(isTrailPoint(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe("quantize", () => {
  it("rounds to one decimal and never returns -0", () => {
    expect(quantize(12.34)).toBe(12.3);
    expect(quantize(12.36)).toBe(12.4);
    expect(quantize(-0.04)).toBe(0);
    expect(Object.is(quantize(-0.04), -0)).toBe(false);
    expect(quantize(-7.26)).toBe(-7.3);
    expect(quantize(98)).toBe(98);
  });
  it("is idempotent and avoids float noise (0.1 * 3 style)", () => {
    for (let i = -1000; i <= 1000; i += 7) {
      const v = i / 13;
      const q = quantize(v);
      expect(quantize(q)).toBe(q);
      expect(isQuantized(q)).toBe(true);
      expect(String(q).length).toBeLessThanOrEqual(6);
    }
  });
});

describe("clampTrailPoint", () => {
  it("keeps an inside point (quantized)", () => {
    expect(clampTrailPoint(50, 50)).toEqual({ x: 50, y: 50 });
    expect(clampTrailPoint(40.04, 61.26)).toEqual({ x: 40, y: 61.3 });
  });
  it("pulls an outside point back onto the dough, in the same direction", () => {
    const p = clampTrailPoint(150, 50);
    expect(p).not.toBeNull();
    expect(p!.y).toBe(50);
    expect(p!.x).toBeGreaterThan(97);
    expect(p!.x).toBeLessThanOrEqual(50 + DOUGH_RADIUS);
    const q = clampTrailPoint(-100, -100)!;
    expect(q.x).toBeLessThan(50);
    expect(q.y).toBeLessThan(50);
    expect(q.x).toBeCloseTo(q.y, 5);
  });
  it("returns null for non-finite, non-numeric and absurd input", () => {
    for (const [x, y] of [[NaN, 1], [1, NaN], [Infinity, 0], [0, -Infinity], [COORD_ABS_MAX + 1, 0], [0, 1e308]] as [number, number][]) {
      expect(clampTrailPoint(x, y), `${x},${y}`).toBeNull();
    }
    expect(clampTrailPoint("1" as unknown as number, 2)).toBeNull();
  });
  it("every angle and radius ends inside the dough, quantized, finite (rounding at the rim cannot push a point out)", () => {
    for (let deg = 0; deg < 360; deg += 1) {
      for (const r of [0, 10, 47.9, 47.95, 48, 48.04, 48.06, 49, 60, 200]) {
        const a = (deg * Math.PI) / 180;
        const p = clampTrailPoint(DOUGH_CENTER + r * Math.cos(a), DOUGH_CENTER + r * Math.sin(a));
        expect(p, `${deg} ${r}`).not.toBeNull();
        expect(Number.isFinite(p!.x) && Number.isFinite(p!.y)).toBe(true);
        expect(isInsideDough(p!.x, p!.y), `${deg} ${r}: ${p!.x},${p!.y}`).toBe(true);
        expect(isQuantized(p!.x) && isQuantized(p!.y)).toBe(true);
      }
    }
  });
  it("is idempotent", () => {
    for (const [x, y] of [[10.04, 90.06], [130, 20], [51.23, 49.87], [0, 0]] as [number, number][]) {
      const p = clampTrailPoint(x, y)!;
      expect(clampTrailPoint(p.x, p.y)).toEqual(p);
    }
  });
});

describe("clientToTrailPoint (client px -> production dough percent)", () => {
  const rect = { left: 100, top: 200, width: 300, height: 300 };
  it("maps the box centre to the dough centre and the corners into the dough", () => {
    expect(clientToTrailPoint(250, 350, rect)).toEqual({ x: 50, y: 50 });
    expect(clientToTrailPoint(100, 200, rect)).not.toBeNull();
    const corner = clientToTrailPoint(100, 200, rect)!;
    expect(isInsideDough(corner.x, corner.y)).toBe(true);
  });
  it("scales with the box (a quarter across is 25 percent)", () => {
    expect(clientToTrailPoint(175, 350, rect)).toEqual({ x: 25, y: 50 });
    expect(clientToTrailPoint(250, 275, rect)).toEqual({ x: 50, y: 25 });
  });
  it("works for a non-square box", () => {
    expect(clientToTrailPoint(60, 150, { left: 0, top: 0, width: 120, height: 300 })).toEqual({ x: 50, y: 50 });
  });
  it("is null for a degenerate box or a non-finite input", () => {
    expect(clientToTrailPoint(1, 1, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
    expect(clientToTrailPoint(1, 1, { left: 0, top: 0, width: 10, height: -1 })).toBeNull();
    expect(clientToTrailPoint(NaN, 1, rect)).toBeNull();
    expect(clientToTrailPoint(1, 1, { left: NaN, top: 0, width: 10, height: 10 })).toBeNull();
    expect(clientToTrailPoint(Infinity, 1, rect)).toBeNull();
  });
});

describe("trailLength", () => {
  it("sums the segments; 0 and 1 points are 0", () => {
    expect(trailLength([])).toBe(0);
    expect(trailLength([{ x: 1, y: 1 }])).toBe(0);
    expect(trailLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
    expect(trailLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });
});

describe("thinTrail", () => {
  it("returns a copy of a short trail", () => {
    const pts = line(5);
    const out = thinTrail(pts, 24);
    expect(out).toEqual(pts);
    expect(out).not.toBe(pts);
  });
  it("keeps at most `max`, the first and last, in order, and is deterministic", () => {
    const pts = line(160);
    const a = thinTrail(pts, 24);
    expect(a).toHaveLength(24);
    expect(a[0]).toBe(pts[0]);
    expect(a[23]).toBe(pts[159]);
    expect(thinTrail(pts, 24)).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i].x).toBeGreaterThan(a[i - 1].x);
  });
  it("never duplicates a point when thinning (strictly increasing source indices)", () => {
    for (const n of [25, 26, 47, 100, 160, 999]) {
      const a = thinTrail(line(n), 24);
      expect(new Set(a).size, String(n)).toBe(24);
    }
  });
  it("does not change its input", () => {
    const pts = line(60);
    const copy = JSON.stringify(pts);
    thinTrail(pts, 10);
    expect(JSON.stringify(pts)).toBe(copy);
  });
  it("coerces a bad `max` to 2 (a stroke keeps at least its ends)", () => {
    for (const bad of [NaN, -5, 0, 1, 1.9, Number.NaN]) expect(thinTrail(line(10), bad)).toHaveLength(2);
    expect(thinTrail(line(10), 2.9)).toHaveLength(2);
    expect(thinTrail(line(10), 3.9)).toHaveLength(3);
  });
  it("handles empty input", () => {
    expect(thinTrail([], 24)).toEqual([]);
  });
});

describe("resampleTrail", () => {
  it("drops points closer than the minimum and always keeps the ends", () => {
    const pts: TrailPoint[] = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((x) => ({ x: 30 + x, y: 50 }));
    const out = resampleTrail(pts, 1);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
    expect(out.length).toBeLessThan(pts.length);
  });
  it("leaves 0, 1 and 2 points alone", () => {
    expect(resampleTrail([], 1)).toEqual([]);
    expect(resampleTrail(line(2), 100)).toEqual(line(2));
  });
});

describe("dropRepeats", () => {
  it("removes only consecutive equal points", () => {
    const a = { x: 1, y: 1 };
    const b = { x: 2, y: 2 };
    expect(dropRepeats([a, { ...a }, b, b, a])).toEqual([a, b, a]);
    expect(dropRepeats([])).toEqual([]);
  });
});

describe("tapTrail (a line, never a dot)", () => {
  it("is a slanted segment of the tap-line length, rising to the right", () => {
    const t = tapTrail({ x: 50, y: 50 })!;
    expect(t).toHaveLength(2);
    expect(trailLength(t)).toBeGreaterThan(TAP_LINE_LENGTH - 2 * QUANT_STEP);
    expect(trailLength(t)).toBeLessThan(TAP_LINE_LENGTH + 2 * QUANT_STEP);
    expect(t[1].x).toBeGreaterThan(t[0].x);
    expect(t[1].y).toBeLessThan(t[0].y); // y grows downward, so "rising" is a smaller y
  });
  it("is deterministic and centred on the tap in the middle of the dough", () => {
    expect(tapTrail({ x: 40, y: 60 })).toEqual(tapTrail({ x: 40, y: 60 }));
    const t = tapTrail({ x: 40, y: 60 })!;
    expect((t[0].x + t[1].x) / 2).toBeCloseTo(40, 0);
    expect((t[0].y + t[1].y) / 2).toBeCloseTo(60, 0);
  });
  it("keeps the full length and stays inside the dough for a tap anywhere, including past the rim", () => {
    for (let deg = 0; deg < 360; deg += 5) {
      for (const r of [0, 30, 40, 47, 48, 60, 300]) {
        const a = (deg * Math.PI) / 180;
        const t = tapTrail({ x: DOUGH_CENTER + r * Math.cos(a), y: DOUGH_CENTER + r * Math.sin(a) });
        expect(t, `${deg} ${r}`).not.toBeNull();
        for (const p of t!) expect(isInsideDough(p.x, p.y), `${deg} ${r}`).toBe(true);
        expect(trailLength(t!), `${deg} ${r}`).toBeGreaterThan(TAP_LINE_LENGTH - 0.5);
      }
    }
  });
  it("is null for a non-finite or non-point input", () => {
    for (const v of [{ x: NaN, y: 1 }, { x: 1, y: Infinity }, null, undefined, 3, {}]) expect(tapTrail(v as never), JSON.stringify(v)).toBeNull();
  });
});
