import { beforeEach, describe, expect, it } from "vitest";
import {
  DOUGH_CENTER,
  DOUGH_RADIUS,
  DRIZZLE_LAB_ON_VALUE,
  DRIZZLE_LAB_PARAM,
  INITIAL_LAB_STATE,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  TAP_LINE_LENGTH,
  clampToDough,
  clientToSurface,
  drizzleLabOptedIn,
  isInsideDough,
  labReset,
  pathLength,
  resetDrizzleLabForTest,
  resolveDrizzleLabOptIn,
  strokeCancel,
  strokeEnd,
  strokeMove,
  strokeStart,
  tapLine,
  thinPoints,
  type LabState,
} from "./drizzleLab";

const C = DOUGH_CENTER;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

beforeEach(() => resetDrizzleLabForTest());

describe("opt-in (?drizzleLab=on, exactly once)", () => {
  it("the names are what the Owner types", () => {
    expect(DRIZZLE_LAB_PARAM).toBe("drizzleLab");
    expect(DRIZZLE_LAB_ON_VALUE).toBe("on");
  });
  it("only a single =on asks for it", () => {
    expect(resolveDrizzleLabOptIn("?drizzleLab=on")).toBe(true);
    expect(resolveDrizzleLabOptIn("?x=1&drizzleLab=on")).toBe(true);
    for (const q of ["", "?drizzleLab", "?drizzleLab=1", "?drizzleLab=ON", "?drizzleLab=on&drizzleLab=on", "?drizzleLab=on&drizzleLab=off", "?drizzlelab=on"]) expect(resolveDrizzleLabOptIn(q)).toBe(false);
    expect(resolveDrizzleLabOptIn(undefined)).toBe(false);
    expect(resolveDrizzleLabOptIn(null)).toBe(false);
  });
  it("the page-load value is read once and cached (DEV build here)", () => {
    window.history.replaceState(null, "", "/?drizzleLab=on");
    expect(drizzleLabOptedIn()).toBe(true);
    window.history.replaceState(null, "", "/");
    expect(drizzleLabOptedIn()).toBe(true); // cached for the page load
    resetDrizzleLabForTest();
    expect(drizzleLabOptedIn()).toBe(false);
  });
});

describe("geometry", () => {
  it("clamps outside points to the dough edge and keeps inside points", () => {
    expect(clampToDough({ x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
    const out = clampToDough({ x: 500, y: 50 });
    expect(out.x).toBeCloseTo(C.x + DOUGH_RADIUS);
    expect(out.y).toBeCloseTo(50);
    for (const p of [{ x: -999, y: -999 }, { x: 0, y: 100 }, { x: 100, y: 0 }]) expect(isInsideDough(clampToDough(p))).toBe(true);
    expect(clampToDough({ x: NaN, y: Infinity })).toEqual(C);
  });
  it("maps client coordinates to surface units and rejects degenerate rects", () => {
    const rect = { left: 10, top: 20, width: 200, height: 200 };
    expect(clientToSurface(110, 120, rect)).toEqual({ x: 50, y: 50 });
    expect(clientToSurface(10, 20, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToSurface(1, 1, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
    expect(clientToSurface(NaN, 1, rect)).toBeNull();
  });
  it("the tap line is a deterministic short line (not a dot), centred on the tap and inside the dough", () => {
    const a = tapLine({ x: 50, y: 50 });
    expect(a).toEqual(tapLine({ x: 50, y: 50 }));
    expect(a).toHaveLength(2);
    expect(dist(a[0], a[1])).toBeCloseTo(TAP_LINE_LENGTH);
    expect((a[0].x + a[1].x) / 2).toBeCloseTo(50);
    const edge = tapLine({ x: 94, y: 50 });
    for (const p of edge) expect(isInsideDough(p)).toBe(true);
    expect(dist(edge[0], edge[1])).toBeGreaterThan(1); // still a line at the edge
  });
  it("thinPoints keeps first and last and respects the cap", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ x: i / 20, y: 50 }));
    const t = thinPoints(pts, 50);
    expect(t).toHaveLength(50);
    expect(t[0]).toBe(pts[0]);
    expect(t[49]).toBe(pts[999]);
    expect(thinPoints(pts.slice(0, 10), 50)).toHaveLength(10);
  });
});

const drag = (s: LabState, id: number, pts: Array<[number, number]>) => {
  let st = strokeStart(s, id, { x: pts[0][0], y: pts[0][1] });
  for (const [x, y] of pts.slice(1)) st = strokeMove(st, id, { x, y });
  return st;
};

describe("stroke state machine", () => {
  it("a drag commits a visual-only stroke on pointerup", () => {
    let s = drag(INITIAL_LAB_STATE, 1, [[30, 50], [40, 50], [50, 52], [60, 55]]);
    expect(s.pending?.points.length).toBe(4);
    s = strokeEnd(s, 1);
    expect(s.pending).toBeNull();
    expect(s.strokes).toHaveLength(1);
    expect(s.strokes[0].tap).toBe(false);
    expect(pathLength(s.strokes[0].points)).toBeGreaterThan(25);
  });
  it("a tap (little movement) commits the short deterministic line", () => {
    let s = strokeStart(INITIAL_LAB_STATE, 1, { x: 50, y: 50 });
    s = strokeMove(s, 1, { x: 50.5, y: 50.4 }); // below resample distance
    s = strokeEnd(s, 1);
    expect(s.strokes).toHaveLength(1);
    expect(s.strokes[0].tap).toBe(true);
    expect(s.strokes[0].points).toEqual(tapLine({ x: 50, y: 50 }));
  });
  it("pointerdown outside the dough starts nothing", () => {
    const s = strokeStart(INITIAL_LAB_STATE, 1, { x: 2, y: 2 });
    expect(s).toBe(INITIAL_LAB_STATE);
    expect(strokeStart(INITIAL_LAB_STATE, 1, null)).toBe(INITIAL_LAB_STATE);
  });
  it("moves outside the dough are clamped to the edge", () => {
    let s = strokeStart(INITIAL_LAB_STATE, 1, { x: 80, y: 50 });
    s = strokeMove(s, 1, { x: 200, y: 50 });
    const last = s.pending!.points.at(-1)!;
    expect(isInsideDough(last)).toBe(true);
    expect(dist(last, C)).toBeCloseTo(DOUGH_RADIUS);
  });
  it("cancel discards the pending stroke and commits nothing", () => {
    let s = drag(INITIAL_LAB_STATE, 1, [[30, 50], [40, 50], [50, 50]]);
    s = strokeCancel(s, 1);
    expect(s.pending).toBeNull();
    expect(s.strokes).toHaveLength(0);
    expect(strokeEnd(s, 1)).toBe(s); // a late pointerup after the cancel does nothing
    expect(strokeCancel(s)).toBe(s);
  });
  it("multi-touch: a second pointer neither starts, moves, ends nor cancels the first", () => {
    let s = drag(INITIAL_LAB_STATE, 1, [[30, 50], [40, 50]]);
    const before = s;
    s = strokeStart(s, 2, { x: 60, y: 60 });
    s = strokeMove(s, 2, { x: 70, y: 60 });
    s = strokeEnd(s, 2);
    s = strokeCancel(s, 2);
    expect(s).toBe(before);
    s = strokeEnd(s, 1);
    expect(s.strokes).toHaveLength(1);
    expect(s.strokes[0].points.every((p) => p.x <= 41)).toBe(true);
  });
  it("is bounded: points per stroke and committed strokes never exceed the caps", () => {
    let s = strokeStart(INITIAL_LAB_STATE, 1, { x: 20, y: 50 });
    for (let i = 0; i < 2000; i++) s = strokeMove(s, 1, { x: 20 + (i % 60), y: 30 + ((i * 7) % 40) });
    expect(s.pending!.points.length).toBeLessThanOrEqual(MAX_POINTS_PER_STROKE);
    s = strokeEnd(s, 1);
    for (let i = 0; i < MAX_STROKES + 10; i++) s = strokeEnd(strokeStart(s, 9, { x: 50, y: 50 }), 9);
    expect(s.strokes).toHaveLength(MAX_STROKES);
  });
  it("resampling drops points closer than the minimum distance", () => {
    let s = strokeStart(INITIAL_LAB_STATE, 1, { x: 40, y: 50 });
    for (let i = 1; i <= 20; i++) s = strokeMove(s, 1, { x: 40 + i * 0.05, y: 50 });
    expect(s.pending!.points).toHaveLength(1);
  });
  it("reset clears everything", () => {
    const s = strokeEnd(drag(INITIAL_LAB_STATE, 1, [[30, 50], [60, 50]]), 1);
    expect(s.strokes).toHaveLength(1);
    expect(labReset()).toEqual(INITIAL_LAB_STATE);
  });
});
