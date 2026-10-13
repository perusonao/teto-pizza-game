import { describe, expect, it } from "vitest";
import { CHEESE_CANVAS_DEFAULT_PX, CHEESE_CANVAS_OPT_IN_KEY, CHEESE_CANVAS_PRODUCTION_ENABLED, resolveCheeseOptIn, resolveCheeseRenderMode } from "./cheeseRenderMode";

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
});
