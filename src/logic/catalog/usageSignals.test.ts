import { describe, expect, it } from "vitest";
import {
  emptyUsageSession,
  recordNewlyOwned,
  recordUse,
  sanitizeUsageSession,
  toggleFavorite,
} from "./usageSignals";

describe("usage signals (session-only, LC-OD-5)", () => {
  it("toggles favorites", () => {
    const s1 = toggleFavorite(emptyUsageSession(), "bacon");
    expect(s1.favorites).toEqual(["bacon"]);
    expect(toggleFavorite(s1, "bacon").favorites).toEqual([]);
  });

  it("keeps recent newest first, de-duplicated and capped", () => {
    let s = recordUse(emptyUsageSession(), ["a", "b"]);
    expect(s.recent).toEqual(["b", "a"]);
    s = recordUse(s, ["a"]);
    expect(s.recent).toEqual(["a", "b"]);
    s = recordUse(s, ["c", "d", "e"], 3);
    expect(s.recent).toEqual(["e", "d", "c"]);
  });

  it("records newly owned newest first", () => {
    const s = recordNewlyOwned(recordNewlyOwned(emptyUsageSession(), "x"), "y");
    expect(s.newlyOwned).toEqual(["y", "x"]);
  });

  it("sanitizes hostile input", () => {
    expect(sanitizeUsageSession({ favorites: ["a", 1, "a", null], recent: "x", __proto__: { newlyOwned: ["z"] } })).toEqual({
      favorites: ["a"],
      recent: [],
      newlyOwned: [],
    });
    expect(sanitizeUsageSession(null)).toEqual(emptyUsageSession());
  });
});
