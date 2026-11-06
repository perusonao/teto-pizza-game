import { describe, expect, it } from "vitest";
import { isInsideDough } from "../pizzaCoordinates";
import {
  MAX_RAW_LIQUIDS,
  MAX_RAW_TRAIL_POINTS,
  PERSIST_MAX_LIQUIDS,
  PERSIST_MAX_POINTS_PER_STROKE,
  type PostBakeLiquid,
  type TrailPoint,
} from "./postBakeLiquid";
import { sanitizePostBakeLiquid, sanitizePostBakeLiquids, sanitizeTrail } from "./sanitize";
import { tapTrail } from "./trail";

const pts = (n: number, y = 50): TrailPoint[] => Array.from({ length: n }, (_, i) => ({ x: 20 + (i * 60) / Math.max(1, n - 1), y }));
const liquid = (over: Record<string, unknown> = {}) => ({ id: "l-1", ingredientId: "olive-oil", trail: pts(10), stage: "post", ...over });
const utf8 = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe("sanitizeTrail", () => {
  it("is [] for anything that is not a short-enough array", () => {
    for (const v of [null, undefined, 3, "abc", {}, { length: 3 }, new Array(MAX_RAW_TRAIL_POINTS + 1).fill({ x: 50, y: 50 })]) expect(sanitizeTrail(v)).toEqual([]);
  });
  it("drops non-finite / non-point entries and keeps the rest in order", () => {
    const out = sanitizeTrail([{ x: 30, y: 30 }, { x: NaN, y: 1 }, null, "p", { x: 40, y: 40 }, { x: 1, y: Infinity }, { x: 50, y: 50 }]);
    expect(out).toEqual([{ x: 30, y: 30 }, { x: 40, y: 40 }, { x: 50, y: 50 }]);
  });
  it("clamps into the dough and quantizes", () => {
    const out = sanitizeTrail([{ x: 30.04, y: 30.06 }, { x: 400, y: 50 }]);
    expect(out[0]).toEqual({ x: 30, y: 30.1 });
    expect(isInsideDough(out[1].x, out[1].y)).toBe(true);
  });
  it("removes repeated points (a slow finger) and thins to the persist limit", () => {
    expect(sanitizeTrail([{ x: 30, y: 30 }, { x: 30.01, y: 30.01 }, { x: 31, y: 31 }])).toHaveLength(2);
    const out = sanitizeTrail(pts(160));
    expect(out).toHaveLength(PERSIST_MAX_POINTS_PER_STROKE);
    expect(out[0]).toEqual({ x: 20, y: 50 });
    expect(out[out.length - 1]).toEqual({ x: 80, y: 50 });
  });
  it("a back-and-forth trail is already in canonical form after one pass (thinning must not leave repeats behind)", () => {
    const zig = Array.from({ length: 48 }, (_, i) => ({ x: i % 2 ? 40 : 30, y: 50 }));
    const once = sanitizeTrail(zig);
    expect(once.length).toBeLessThanOrEqual(PERSIST_MAX_POINTS_PER_STROKE);
    for (let i = 1; i < once.length; i++) expect(once[i].x !== once[i - 1].x || once[i].y !== once[i - 1].y).toBe(true);
    expect(sanitizeTrail(once)).toEqual(once);
    expect(sanitizeTrail(JSON.parse(JSON.stringify(once)))).toEqual(once);
    for (const n of [25, 26, 47, 48, 49, 96, 160]) {
      for (const period of [2, 3, 5]) {
        const t = Array.from({ length: n }, (_, i) => ({ x: 20 + (i % period) * 7, y: 50 }));
        const a = sanitizeTrail(t);
        expect(sanitizeTrail(a), `${n}/${period}`).toEqual(a);
      }
    }
  });
  it("a liquid made from a back-and-forth trail is idempotent too", () => {
    const zig = Array.from({ length: 48 }, (_, i) => ({ x: i % 2 ? 40 : 30, y: 50 }));
    const once = sanitizePostBakeLiquid(liquid({ trail: zig }));
    if (once) expect(sanitizePostBakeLiquid(once)).toEqual(once);
  });
  it("never throws on hostile input (throwing getters, proxies, prototype keys)", () => {
    const evil = [{ get x(): number { throw new Error("x"); }, y: 1 }];
    expect(() => sanitizeTrail(evil)).not.toThrow();
    expect(sanitizeTrail(evil)).toEqual([]);
    const proxy = new Proxy([], { get() { throw new Error("boom"); } });
    expect(() => sanitizeTrail(proxy)).not.toThrow();
    expect(sanitizeTrail(JSON.parse('[{"__proto__":{"x":1},"x":30,"y":30},{"x":40,"y":40}]'))).toHaveLength(2);
  });
});

/** An array whose `length` changes between reads: the first read passes the size check, later reads are huge. */
function shiftyArray(items: unknown[]): unknown[] {
  let reads = 0;
  return new Proxy(items, {
    get(target, key, receiver) {
      if (key === "length") return reads++ === 0 ? target.length : Infinity;
      return Reflect.get(target, key, receiver);
    },
  });
}

describe("a length that changes between reads cannot make a scan run forever", () => {
  it("sanitizeTrail reads the length once", () => {
    const out = sanitizeTrail(shiftyArray([{ x: 30, y: 30 }, { x: 40, y: 40 }]));
    expect(out).toEqual([{ x: 30, y: 30 }, { x: 40, y: 40 }]);
  });
  it("sanitizePostBakeLiquids reads the length once", () => {
    const out = sanitizePostBakeLiquids(shiftyArray([liquid({ id: "a" }), liquid({ id: "b" })]));
    expect(out.map((l) => l.id)).toEqual(["a", "b"]);
  });
  it("a non-integer or negative length is refused, not scanned", () => {
    for (const bad of [Infinity, -1, 1.5, NaN]) {
      const weird = new Proxy([{ x: 30, y: 30 }, { x: 40, y: 40 }], { get: (t, k, r) => (k === "length" ? bad : Reflect.get(t, k, r)) });
      expect(sanitizeTrail(weird)).toEqual([]);
      expect(sanitizePostBakeLiquids(weird)).toEqual([]);
    }
  });
});

describe("sanitizePostBakeLiquid", () => {
  it("accepts a well-formed liquid and returns the canonical shape", () => {
    const out = sanitizePostBakeLiquid(liquid())!;
    expect(out).not.toBeNull();
    expect(Object.keys(out).sort()).toEqual(["id", "ingredientId", "stage", "trail"]);
    expect(out.id).toBe("l-1");
    expect(out.ingredientId).toBe("olive-oil");
    expect(out.stage).toBe("post");
    expect(out.trail).toHaveLength(10);
  });
  it("accepts a tap line as a liquid", () => {
    expect(sanitizePostBakeLiquid(liquid({ trail: tapTrail({ x: 50, y: 50 }) }))).not.toBeNull();
  });
  it("is null for every malformed shape", () => {
    const bad: unknown[] = [
      null, undefined, 1, "x", [], [liquid()],
      liquid({ stage: "pre" }), liquid({ stage: undefined }), liquid({ stage: "POST" }),
      liquid({ ingredientId: "honey" }), liquid({ ingredientId: "tomato-sauce" }), liquid({ ingredientId: undefined }),
      liquid({ id: "" }), liquid({ id: 5 }), liquid({ id: "a b" }), liquid({ id: "x".repeat(41) }), liquid({ id: undefined }),
      liquid({ trail: undefined }), liquid({ trail: "abc" }), liquid({ trail: {} }), liquid({ trail: [] }),
      liquid({ trail: [{ x: 50, y: 50 }] }),
      liquid({ trail: [{ x: 50, y: 50 }, { x: 50, y: 50 }] }),
      liquid({ trail: [{ x: 50, y: 50 }, { x: 50.04, y: 50.04 }] }),
      liquid({ trail: [{ x: NaN, y: 50 }, { x: 40, y: 50 }] }),
      liquid({ trail: new Array(MAX_RAW_TRAIL_POINTS + 1).fill({ x: 50, y: 50 }) }),
    ];
    for (const v of bad) expect(sanitizePostBakeLiquid(v), JSON.stringify(v)?.slice(0, 80)).toBeNull();
  });
  it("drops unknown fields instead of passing them through", () => {
    const out = sanitizePostBakeLiquid(liquid({ extra: 1, __proto__: { polluted: true }, amount: 9, width: 3 }))!;
    expect(Object.keys(out).sort()).toEqual(["id", "ingredientId", "stage", "trail"]);
    expect((out as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("does not mutate its input", () => {
    const raw = liquid({ trail: pts(160) });
    const before = JSON.stringify(raw);
    sanitizePostBakeLiquid(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("keeps the thinned trail inside the dough and within the persist limit", () => {
    const out = sanitizePostBakeLiquid(liquid({ trail: pts(160).map((p) => ({ x: p.x * 3, y: p.y * 3 })) }))!;
    expect(out.trail.length).toBeLessThanOrEqual(PERSIST_MAX_POINTS_PER_STROKE);
    for (const p of out.trail) expect(isInsideDough(p.x, p.y)).toBe(true);
  });
  it("never throws on a hostile object", () => {
    const evil = { get stage(): string { throw new Error("s"); } };
    expect(() => sanitizePostBakeLiquid(evil)).not.toThrow();
    expect(sanitizePostBakeLiquid(evil)).toBeNull();
  });
  it("is idempotent and stable through a JSON round trip", () => {
    const once = sanitizePostBakeLiquid(liquid({ trail: pts(160).map((p) => ({ x: p.x + 0.037, y: p.y - 0.013 })) }))!;
    expect(sanitizePostBakeLiquid(once)).toEqual(once);
    expect(sanitizePostBakeLiquid(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});

describe("sanitizePostBakeLiquids", () => {
  it("is [] for a non-array", () => {
    for (const v of [null, undefined, 1, "a", {}, liquid()]) expect(sanitizePostBakeLiquids(v)).toEqual([]);
  });
  it("drops invalid entries and keeps the valid ones in order", () => {
    const out = sanitizePostBakeLiquids([liquid({ id: "a" }), null, liquid({ id: "b", ingredientId: "honey" }), liquid({ id: "c" })]);
    expect(out.map((l) => l.id)).toEqual(["a", "c"]);
  });
  it("keeps only the newest PERSIST_MAX_LIQUIDS (the last ones), in their original order", () => {
    const raw = Array.from({ length: 7 }, (_, i) => liquid({ id: `l${i}` }));
    expect(sanitizePostBakeLiquids(raw).map((l) => l.id)).toEqual(["l3", "l4", "l5", "l6"]);
    expect(PERSIST_MAX_LIQUIDS).toBe(4);
  });
  it("a repeated id keeps its LAST entry", () => {
    const out = sanitizePostBakeLiquids([liquid({ id: "a", trail: pts(5, 40) }), liquid({ id: "b" }), liquid({ id: "a", trail: pts(5, 60) })]);
    expect(out.map((l) => l.id)).toEqual(["b", "a"]);
    expect(out[1].trail[0].y).toBe(60);
  });
  it("reads a very long array from its end, without scanning it all", () => {
    const raw = [...new Array(MAX_RAW_LIQUIDS + 50).fill(null), liquid({ id: "last" })];
    expect(sanitizePostBakeLiquids(raw).map((l) => l.id)).toEqual(["last"]);
    const old = [liquid({ id: "old" }), ...new Array(MAX_RAW_LIQUIDS + 5).fill(null)];
    expect(sanitizePostBakeLiquids(old)).toEqual([]);
  });
  it("never throws, even for a hostile array", () => {
    const proxy = new Proxy([], { get() { throw new Error("boom"); } });
    expect(() => sanitizePostBakeLiquids(proxy)).not.toThrow();
    expect(sanitizePostBakeLiquids(proxy)).toEqual([]);
  });
  it("is idempotent and stable through JSON", () => {
    const once = sanitizePostBakeLiquids(Array.from({ length: 6 }, (_, i) => liquid({ id: `l${i}`, trail: pts(160) })));
    expect(sanitizePostBakeLiquids(once)).toEqual(once);
    expect(sanitizePostBakeLiquids(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});

describe("the saved size (the pending-round journal is capped at 64KB)", () => {
  /** Worst case: every liquid at the limits, every coordinate as wide as a dough coordinate gets (a 4-character decimal). */
  const worst = (): PostBakeLiquid[] =>
    sanitizePostBakeLiquids(
      Array.from({ length: PERSIST_MAX_LIQUIDS }, (_, i) => ({
        id: `${"x".repeat(37)}-${i}`.slice(0, 40),
        ingredientId: "olive-oil",
        stage: "post",
        trail: Array.from({ length: PERSIST_MAX_POINTS_PER_STROKE }, (_, j) => ({ x: 23.7 + j * 1.1 + (j % 2 ? 0.3 : 0), y: 21.3 + (j % 5) * 11.7 })),
      })),
    );
  it("the worst case holds the maximum and fits in 4KB", () => {
    const w = worst();
    expect(w).toHaveLength(PERSIST_MAX_LIQUIDS);
    for (const l of w) expect(l.trail).toHaveLength(PERSIST_MAX_POINTS_PER_STROKE);
    const bytes = utf8(w);
    // Recorded in the Result Report. The lab's own display limits (160 x 24) would be ~77KB and are NOT what is saved.
    expect(bytes).toBeLessThanOrEqual(4096);
  });
  it("a display-limit stroke (160 points) is thinned to the persist limit before it is kept", () => {
    const l = sanitizePostBakeLiquid(liquid({ trail: pts(160) }))!;
    expect(l.trail).toHaveLength(PERSIST_MAX_POINTS_PER_STROKE);
    expect(utf8(l)).toBeLessThanOrEqual(1024);
  });
});
