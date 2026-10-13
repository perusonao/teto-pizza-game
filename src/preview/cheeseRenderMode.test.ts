import { describe, expect, it } from "vitest";
import { CHEESE_CANVAS_DEFAULT_PX, resolveCheeseRenderMode } from "./cheeseRenderMode";

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
