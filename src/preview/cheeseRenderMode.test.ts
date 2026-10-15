import { describe, expect, it } from "vitest";
import type { StorageLike } from "../state/persistence";
import { CHEESE_CANVAS_DEFAULT_PX, CHEESE_CANVAS_OPT_IN_KEY, parseCheeseCanvasParam, resolveCheeseCanvasOptIn, resolveCheeseRenderMode, resolveCheeseRenderModeWithOptIn } from "./cheeseRenderMode";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
const throwing: StorageLike = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };

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

describe("#486 T1: the production opt-in (OFF by default, own storage key)", () => {
  it("parses only ?cheeseCanvas=1 / 0", () => {
    expect(parseCheeseCanvasParam("?cheeseCanvas=1")).toBe("on");
    expect(parseCheeseCanvasParam("?cheeseCanvas=0")).toBe("off");
    for (const search of ["", "?cheeseCanvas=", "?cheeseCanvas=2", "?cheeseCanvas=true", "?cheese=c64"]) expect(parseCheeseCanvasParam(search)).toBeNull();
  });

  it("is OFF with nothing stored, with no parameter, and with a foreign stored value", () => {
    expect(resolveCheeseCanvasOptIn("", memoryStorage())).toBe(false);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "0" }))).toBe(false);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "yes" }))).toBe(false);
    expect(resolveCheeseCanvasOptIn("", null)).toBe(false);
    expect(resolveCheeseRenderModeWithOptIn("", false, memoryStorage())).toEqual({ kind: "m1" });
  });

  it("?cheeseCanvas=1 turns it on and remembers it; ?cheeseCanvas=0 turns it off and clears the key", () => {
    const storage = memoryStorage();
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=1", storage)).toBe(true);
    expect(storage.map.get(CHEESE_CANVAS_OPT_IN_KEY)).toBe("1");
    expect(resolveCheeseCanvasOptIn("", storage)).toBe(true); // survives a reload without the parameter
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=0", storage)).toBe(false);
    expect(storage.map.has(CHEESE_CANVAS_OPT_IN_KEY)).toBe(false);
    expect(resolveCheeseCanvasOptIn("", storage)).toBe(false);
  });

  it("opted in means Canvas 64x64 at the default size, in a production build (no preview switch)", () => {
    expect(resolveCheeseRenderModeWithOptIn("?cheeseCanvas=1", false, memoryStorage())).toEqual({ kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderModeWithOptIn("", false, memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "1" }))).toEqual({ kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX });
  });

  it("production ignores the S2-B ?cheese= switch (including cheesePx); only the opt-in counts", () => {
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96&cheesePx=90", false, memoryStorage())).toEqual({ kind: "m1" });
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96&cheesePx=90&cheeseCanvas=1", false, memoryStorage())).toEqual({ kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX });
  });

  it("Preview / DEV keep the ?cheese= switch, which wins over the opt-in (an explicit m1 is M1)", () => {
    const optedIn = memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "1" });
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96", true, optedIn)).toEqual({ kind: "canvas", grid: 96, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderModeWithOptIn("?cheese=m1", true, optedIn)).toEqual({ kind: "m1" });
    expect(resolveCheeseRenderModeWithOptIn("", true, optedIn)).toMatchObject({ kind: "canvas", grid: 64 });
  });

  it("a storage that throws never throws: M1 unless the parameter itself asks for it for this load", () => {
    expect(resolveCheeseRenderModeWithOptIn("", false, throwing)).toEqual({ kind: "m1" });
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=1", throwing)).toBe(true);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=0", throwing)).toBe(false);
  });

  it("does not touch the save: the key is its own and no other key is written", () => {
    const storage = memoryStorage({ "teto-pizza-save-v1": "{}" });
    resolveCheeseCanvasOptIn("?cheeseCanvas=1", storage);
    expect([...storage.map.keys()].sort()).toEqual([CHEESE_CANVAS_OPT_IN_KEY, "teto-pizza-save-v1"].sort());
    expect(storage.map.get("teto-pizza-save-v1")).toBe("{}");
  });
});
