import { describe, expect, it } from "vitest";
import type { StorageLike } from "../state/persistence";
import { HINT5_PREVIEW_OPT_IN_KEY, parseHint5PreviewParam, resolveHint5PreviewDecision, resolveHint5PreviewOptIn } from "./hint5PreviewOptIn";

/** Discovery Hint 5.0 H5-5: the Preview opt-in parser and its storage. Pure; the production
 *  isolation is ./previewIsolation.gate.test.ts. */

function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe("parseHint5PreviewParam", () => {
  it("?hint5=1 is on, ?hint5=0 is off, everything else is no instruction", () => {
    expect(parseHint5PreviewParam("?hint5=1")).toBe("on");
    expect(parseHint5PreviewParam("?a=1&hint5=1&hv=normal")).toBe("on");
    expect(parseHint5PreviewParam("?hint5=0")).toBe("off");
    for (const search of ["", "?", "?hint5", "?hint5=", "?hint5=2", "?hint5=true", "?hint5=on", "?Hint5=1", "?xhint5=1", "?hint5[]=1"]) {
      expect(parseHint5PreviewParam(search), search).toBeNull();
    }
  });

  it("hostile / non-string input is no instruction", () => {
    for (const search of [null, undefined, 1, {}, [], ["?hint5=1"], Symbol.for("x")]) expect(parseHint5PreviewParam(search)).toBeNull();
  });
});

describe("resolveHint5PreviewOptIn", () => {
  it("no parameter and nothing stored: off (the old behaviour)", () => {
    const storage = memory();
    expect(resolveHint5PreviewOptIn("", storage)).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it("?hint5=1 turns it on and stores it in the Preview key only; a later load without the parameter keeps it", () => {
    const storage = memory({ "teto-pizza-save-v1": "PRODUCTION-SAVE" });
    expect(resolveHint5PreviewOptIn("?hint5=1", storage)).toBe(true);
    expect([...storage.map.keys()].sort()).toEqual([HINT5_PREVIEW_OPT_IN_KEY, "teto-pizza-save-v1"].sort());
    expect(storage.map.get("teto-pizza-save-v1")).toBe("PRODUCTION-SAVE");
    expect(resolveHint5PreviewOptIn("", storage)).toBe(true);
    expect(resolveHint5PreviewOptIn("?hv=normal", storage)).toBe(true);
  });

  it("?hint5=0 turns it off again and removes the key", () => {
    const storage = memory({ [HINT5_PREVIEW_OPT_IN_KEY]: "1" });
    expect(resolveHint5PreviewOptIn("?hint5=0", storage)).toBe(false);
    expect(storage.map.has(HINT5_PREVIEW_OPT_IN_KEY)).toBe(false);
    expect(resolveHint5PreviewOptIn("", storage)).toBe(false);
  });

  it("only the exact stored value 1 counts", () => {
    for (const value of ["0", "true", "on", "", "1 "]) expect(resolveHint5PreviewOptIn("", memory({ [HINT5_PREVIEW_OPT_IN_KEY]: value })), value).toBe(false);
  });

  it("no storage / a throwing storage never throws: ?hint5=1 still works for this load, the stored value reads as off", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(resolveHint5PreviewOptIn("?hint5=1", broken)).toBe(true);
    expect(resolveHint5PreviewOptIn("", broken)).toBe(false);
    expect(resolveHint5PreviewOptIn("?hint5=0", broken)).toBe(false);
    expect(resolveHint5PreviewOptIn("?hint5=1", null)).toBe(true);
    expect(resolveHint5PreviewOptIn("", null)).toBe(false);
  });

  it("the opt-in key is a Preview key: never the save key and never the DEV key", () => {
    expect(HINT5_PREVIEW_OPT_IN_KEY).toMatch(/^teto-pizza-preview-/);
    expect(HINT5_PREVIEW_OPT_IN_KEY).not.toBe("teto.dev.hint5Ladder");
  });
});

describe("resolveHint5PreviewDecision (an explicit off is not the same as no instruction)", () => {
  it("?hint5=1 is on, ?hint5=0 is off, a stored opt-in is on, nothing is none", () => {
    expect(resolveHint5PreviewDecision("?hint5=1", memory())).toBe("on");
    expect(resolveHint5PreviewDecision("?hint5=0", memory({ [HINT5_PREVIEW_OPT_IN_KEY]: "1" }))).toBe("off");
    expect(resolveHint5PreviewDecision("", memory({ [HINT5_PREVIEW_OPT_IN_KEY]: "1" }))).toBe("on");
    expect(resolveHint5PreviewDecision("", memory())).toBe("none");
    expect(resolveHint5PreviewDecision("?hv=normal", memory())).toBe("none");
  });

  it("a throwing storage keeps the parameter's meaning", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(resolveHint5PreviewDecision("?hint5=1", broken)).toBe("on");
    expect(resolveHint5PreviewDecision("?hint5=0", broken)).toBe("off");
    expect(resolveHint5PreviewDecision("", broken)).toBe("none");
  });
});
