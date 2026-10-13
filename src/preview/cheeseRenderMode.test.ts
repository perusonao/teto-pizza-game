import { describe, expect, it } from "vitest";
import { CHEESE_CANVAS_DEFAULT_PX, CHEESE_CANVAS_OPT_IN_KEY, CHEESE_CANVAS_PRODUCTION_ENABLED, resolveCheeseOptIn, resolvePreviewCheeseMode, resolveProductionCheeseMode, resolveCheeseRenderMode } from "./cheeseRenderMode";

describe("resolveCheeseRenderMode (#421 S2-B verification switch)", () => {
  it("is M1 unless the build allows the switch (production never reads the query)", () => {
    expect(resolveCheeseRenderMode("?cheese=c64", false)).toEqual({ kind: "m1" });
    expect(resolveCheeseRenderMode("?cheese=c96&cheesePx=70", false)).toEqual({ kind: "m1" });
  });

  it("is M1 by default and for anything it does not know", () => {
    for (const search of ["", "?cheese=m1", "?cheese=c128", "?cheese=", "?other=1"]) {
      expect(resolveCheeseRenderMode(search, true)).toEqual({ kind: "m1" });
    }
  });

  it("selects the Canvas grid and an optional, bounded CSS size", () => {
    expect(resolveCheeseRenderMode("?cheese=c64", true)).toEqual({ kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderMode("?cheese=c96", true)).toEqual({ kind: "canvas", grid: 96, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderMode("?cheese=c96&cheesePx=70", true)).toEqual({ kind: "canvas", grid: 96, sizePx: 70 });
    expect(resolveCheeseRenderMode("?cheese=c64&cheesePx=500", true)).toMatchObject({ sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderMode("?cheese=c64&cheesePx=abc", true)).toMatchObject({ sizePx: CHEESE_CANVAS_DEFAULT_PX });
  });
});

describe("#486 T1: the production opt-in", () => {
  it("is committed OFF (turning it on is a separate, Owner-approved change) and uses its own key", () => {
    expect(CHEESE_CANVAS_PRODUCTION_ENABLED).toBe(false);
    expect(CHEESE_CANVAS_OPT_IN_KEY).toBe("teto-pizza-cheese-canvas");
  });

  it("maps only c64 / c96 to the Canvas; everything else, nothing, '0' and a failing storage are M1", () => {
    const of = (v: string | null) => ({ getItem: (k: string) => (k === CHEESE_CANVAS_OPT_IN_KEY ? v : "c64") });
    expect(resolveCheeseOptIn(of("c64"))).toEqual({ kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseOptIn(of("c96"))).toEqual({ kind: "canvas", grid: 96, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    for (const v of [null, "0", "1", "true", "c128", ""]) expect(resolveCheeseOptIn(of(v))).toEqual({ kind: "m1" });
    expect(resolveCheeseOptIn(null)).toEqual({ kind: "m1" });
    expect(
      resolveCheeseOptIn({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual({ kind: "m1" });
  });

  const mem = (initial: string | null) => {
    const data = new Map<string, string>(initial === null ? [] : [[CHEESE_CANVAS_OPT_IN_KEY, initial]]);
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("Preview / DEV: an explicit ?cheese=m1 beats a stored Canvas opt-in; the stored value applies only without the parameter", () => {
    expect(resolvePreviewCheeseMode("?cheese=m1", mem("c64"))).toEqual({ kind: "m1" });
    expect(resolvePreviewCheeseMode("?cheese=c96", mem("0"))).toMatchObject({ kind: "canvas", grid: 96 });
    expect(resolvePreviewCheeseMode("", mem("c64"))).toMatchObject({ kind: "canvas", grid: 64 });
    expect(resolvePreviewCheeseMode("?other=1", mem(null))).toEqual({ kind: "m1" });
  });

  it("production opt-in: ?cheese=c64 / c96 stores the key and turns the Canvas on; ?cheese=0 / m1 stores the kill switch; no parameter reads the key", () => {
    const s = mem(null);
    expect(resolveProductionCheeseMode("?cheese=c64", s)).toMatchObject({ kind: "canvas", grid: 64 });
    expect(s.data.get(CHEESE_CANVAS_OPT_IN_KEY)).toBe("c64");
    expect(resolveProductionCheeseMode("", s)).toMatchObject({ kind: "canvas", grid: 64 }); // survives without the parameter (home-screen launch)
    expect(resolveProductionCheeseMode("?cheese=m1", s)).toEqual({ kind: "m1" });
    expect(s.data.get(CHEESE_CANVAS_OPT_IN_KEY)).toBe("0");
    expect(resolveProductionCheeseMode("", s)).toEqual({ kind: "m1" });
    expect(resolveProductionCheeseMode("?cheese=bogus", mem("c96"))).toMatchObject({ grid: 96 }); // unknown value: the stored key decides
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(resolveProductionCheeseMode("?cheese=c64", blocked)).toMatchObject({ kind: "canvas" }); // counts for this load even if it cannot be stored
  });
});
