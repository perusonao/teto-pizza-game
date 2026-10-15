import { describe, expect, it } from "vitest";
import type { StorageLike } from "../state/persistence";
import {
  CHEESE_CANVAS_DEFAULT_ON,
  CHEESE_CANVAS_DEFAULT_PX,
  CHEESE_CANVAS_OPT_IN_KEY,
  parseCheeseCanvasParam,
  resolveCheeseCanvasOptIn,
  resolveCheeseRenderMode,
  resolveCheeseRenderModeWithOptIn,
} from "./cheeseRenderMode";

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

describe("#486: the Canvas mozzarella is the standard display (ON by default, ?cheeseCanvas=0 for M1, own storage key)", () => {
  const CANVAS = { kind: "canvas", grid: 64, sizePx: CHEESE_CANVAS_DEFAULT_PX } as const;
  const M1 = { kind: "m1" } as const;

  it("the shipped default is ON", () => {
    expect(CHEESE_CANVAS_DEFAULT_ON).toBe(true);
  });

  it("parses only ?cheeseCanvas=1 / 0", () => {
    expect(parseCheeseCanvasParam("?cheeseCanvas=1")).toBe("on");
    expect(parseCheeseCanvasParam("?cheeseCanvas=0")).toBe("off");
    for (const search of ["", "?cheeseCanvas=", "?cheeseCanvas=2", "?cheeseCanvas=true", "?cheese=c64"]) expect(parseCheeseCanvasParam(search)).toBeNull();
  });

  it("is ON with nothing stored, with no parameter, with no storage at all, and with an unknown stored value", () => {
    expect(resolveCheeseCanvasOptIn("", memoryStorage())).toBe(true);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "yes" }))).toBe(true);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "c64" }))).toBe(true);
    expect(resolveCheeseCanvasOptIn("", null)).toBe(true);
    expect(resolveCheeseRenderModeWithOptIn("", false, memoryStorage())).toEqual(CANVAS);
  });

  it("a stored 1 is ON (a tester who opted in under T1 keeps Canvas) and a stored 0 is M1", () => {
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "1" }))).toBe(true);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "0" }))).toBe(false);
    expect(resolveCheeseRenderModeWithOptIn("", false, memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "0" }))).toEqual(M1);
  });

  it("?cheeseCanvas=0 shows M1 and remembers it across reloads; ?cheeseCanvas=1 turns Canvas back on and remembers that", () => {
    const storage = memoryStorage();
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=0", storage)).toBe(false);
    expect(storage.map.get(CHEESE_CANVAS_OPT_IN_KEY)).toBe("0");
    expect(resolveCheeseCanvasOptIn("", storage)).toBe(false); // survives a reload without the parameter
    expect(resolveCheeseRenderModeWithOptIn("", false, storage)).toEqual(M1);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=1", storage)).toBe(true);
    expect(storage.map.get(CHEESE_CANVAS_OPT_IN_KEY)).toBe("1");
    expect(resolveCheeseCanvasOptIn("", storage)).toBe(true);
  });

  it("defaultOn=false (the one-line rollback) is M1 for everyone without an explicit 1, while an explicit 0 / 1 still wins", () => {
    expect(resolveCheeseCanvasOptIn("", memoryStorage(), false)).toBe(false);
    expect(resolveCheeseCanvasOptIn("", null, false)).toBe(false);
    expect(resolveCheeseCanvasOptIn("", throwing, false)).toBe(false);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "garbage" }), false)).toBe(false);
    expect(resolveCheeseCanvasOptIn("", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "1" }), false)).toBe(true);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=1", memoryStorage(), false)).toBe(true);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=0", memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "1" }), false)).toBe(false);
  });

  it("in a production build (no preview switch) it is Canvas 64x64 at the default size, and M1 only when switched off", () => {
    expect(resolveCheeseRenderModeWithOptIn("", false, memoryStorage())).toEqual(CANVAS);
    expect(resolveCheeseRenderModeWithOptIn("?cheeseCanvas=1", false, memoryStorage())).toEqual(CANVAS);
    expect(resolveCheeseRenderModeWithOptIn("?cheeseCanvas=0", false, memoryStorage())).toEqual(M1);
  });

  it("production ignores the S2-B ?cheese= switch (including cheesePx): the standard Canvas, or M1 with ?cheeseCanvas=0", () => {
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96&cheesePx=90", false, memoryStorage())).toEqual(CANVAS);
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96&cheesePx=90&cheeseCanvas=0", false, memoryStorage())).toEqual(M1);
    expect(resolveCheeseRenderModeWithOptIn("?cheese=m1", false, memoryStorage())).toEqual(CANVAS);
  });

  it("Preview / DEV keep the ?cheese= switch, which wins over the standard (an explicit m1 is M1, c96 is the 96 grid even after ?cheeseCanvas=0 was stored)", () => {
    const standard = memoryStorage();
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96", true, standard)).toEqual({ kind: "canvas", grid: 96, sizePx: CHEESE_CANVAS_DEFAULT_PX });
    expect(resolveCheeseRenderModeWithOptIn("?cheese=m1", true, standard)).toEqual(M1);
    expect(resolveCheeseRenderModeWithOptIn("", true, standard)).toMatchObject({ kind: "canvas", grid: 64 });
    const switchedOff = memoryStorage({ [CHEESE_CANVAS_OPT_IN_KEY]: "0" });
    expect(resolveCheeseRenderModeWithOptIn("", true, switchedOff)).toEqual(M1);
    expect(resolveCheeseRenderModeWithOptIn("?cheese=c96", true, switchedOff)).toEqual({ kind: "canvas", grid: 96, sizePx: CHEESE_CANVAS_DEFAULT_PX });
  });

  it("a storage that throws never throws: the default (Canvas) unless the parameter itself asks otherwise for this load", () => {
    expect(resolveCheeseRenderModeWithOptIn("", false, throwing)).toEqual(CANVAS);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=1", throwing)).toBe(true);
    expect(resolveCheeseCanvasOptIn("?cheeseCanvas=0", throwing)).toBe(false);
    expect(resolveCheeseRenderModeWithOptIn("?cheeseCanvas=0", false, throwing)).toEqual(M1);
  });

  it("does not touch the save: the key is its own and no other key is written", () => {
    for (const search of ["?cheeseCanvas=0", "?cheeseCanvas=1"]) {
      const storage = memoryStorage({ "teto-pizza-save-v1": "{}" });
      resolveCheeseCanvasOptIn(search, storage);
      expect([...storage.map.keys()].sort()).toEqual([CHEESE_CANVAS_OPT_IN_KEY, "teto-pizza-save-v1"].sort());
      expect(storage.map.get("teto-pizza-save-v1")).toBe("{}");
    }
    const untouched = memoryStorage({ "teto-pizza-save-v1": "{}" });
    resolveCheeseCanvasOptIn("", untouched); // merely reading the default writes nothing
    expect([...untouched.map.keys()]).toEqual(["teto-pizza-save-v1"]);
  });
});
