import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CUT_AREA_PCT,
  DEFAULT_CUT_MIN_WIDTH,
  cutThresholdBadgeLabel,
  parseCutThresholdQuery,
} from "./cutThresholdPreview";

const D = { areaPct: DEFAULT_CUT_AREA_PCT, minWidth: DEFAULT_CUT_MIN_WIDTH };

describe("parseCutThresholdQuery", () => {
  it("defaults are the Owner Decision values", () => {
    expect(D).toEqual({ areaPct: 0.1, minWidth: 1.0 });
    expect(parseCutThresholdQuery("")).toEqual(D);
  });

  it("accepts valid values, including the range ends", () => {
    expect(parseCutThresholdQuery("?cutAreaPct=0.20&cutMinWidth=1.5")).toEqual({ areaPct: 0.2, minWidth: 1.5 });
    expect(parseCutThresholdQuery("?cutAreaPct=0.02&cutMinWidth=0.2")).toEqual({ areaPct: 0.02, minWidth: 0.2 });
    expect(parseCutThresholdQuery("?cutAreaPct=0.5&cutMinWidth=2")).toEqual({ areaPct: 0.5, minWidth: 2 });
  });

  it.each(["abc", "NaN", "Infinity", "-1", "0.01", "0.6", "0x10", "1e-1", "", " 0.2", "0.2 ", ".2", "1,5"])(
    "an invalid cutAreaPct %j falls back for that parameter only",
    (bad) => {
      expect(parseCutThresholdQuery(`?cutAreaPct=${encodeURIComponent(bad)}&cutMinWidth=1.5`)).toEqual({
        areaPct: DEFAULT_CUT_AREA_PCT,
        minWidth: 1.5,
      });
    },
  );

  it.each(["abc", "-1", "0.1", "2.1", "0x10", "1e0", ""])("an invalid cutMinWidth %j falls back for that parameter only", (bad) => {
    expect(parseCutThresholdQuery(`?cutMinWidth=${encodeURIComponent(bad)}&cutAreaPct=0.3`)).toEqual({
      areaPct: 0.3,
      minWidth: DEFAULT_CUT_MIN_WIDTH,
    });
  });

  it("a repeated parameter is invalid", () => {
    expect(parseCutThresholdQuery("?cutAreaPct=0.2&cutAreaPct=0.3")).toEqual(D);
  });
});

describe("cutThresholdBadgeLabel", () => {
  it("shows nothing at the defaults and the applied values otherwise", () => {
    expect(cutThresholdBadgeLabel(0.1, 1.0)).toBeNull();
    expect(cutThresholdBadgeLabel(0.2, 1.0)).toBe("CUT 0.20%/1.0u");
    expect(cutThresholdBadgeLabel(0.1, 1.5)).toBe("CUT 0.10%/1.5u");
  });
});

/** Fresh `regions.ts` under a stubbed env and `window.location.search`. */
async function regionsWith(previewMode: boolean, search: string) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", previewMode ? "1" : "");
  window.history.replaceState({}, "", `/${search}`);
  return import("../logic/cut/regions");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.replaceState({}, "", "/");
});

describe("getSignificanceThresholds (the only reader)", () => {
  it("production: the query is ignored and window.location.search is never read", async () => {
    const spy = vi.spyOn(window, "location", "get");
    const r = await regionsWith(false, "?cutAreaPct=0.3&cutMinWidth=1.5");
    spy.mockClear();
    expect(r.getSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("Preview: a valid query overrides (percent -> fraction)", async () => {
    const r = await regionsWith(true, "?cutAreaPct=0.30&cutMinWidth=1.5");
    expect(r.getSignificanceThresholds()).toEqual({ areaFraction: 0.003, minWidth: 1.5 });
  });

  it("Preview: invalid values fall back per parameter; no query is the defaults", async () => {
    const bad = await regionsWith(true, "?cutAreaPct=0x10&cutMinWidth=0.5");
    expect(bad.getSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 0.5 });
    const none = await regionsWith(true, "");
    expect(none.getSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
  });

  it("Preview: read once -- a later URL change does not move the value mid-session", async () => {
    const r = await regionsWith(true, "?cutAreaPct=0.20");
    const first = r.getSignificanceThresholds();
    window.history.replaceState({}, "", "/?cutAreaPct=0.40");
    expect(r.getSignificanceThresholds()).toBe(first);
  });

  it("Preview: evaluation uses the override and writes nothing to storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.resetModules();
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    window.history.replaceState({}, "", "/?cutAreaPct=0.5&cutMinWidth=2.0");
    const { evaluateCut } = await import("../logic/cut/evaluation");
    const { createCentralTriangleFixture } = await import("../logic/cut/fixtures");
    // d=6 is a clear 7th piece by default; with 0.5% / 2.0 u the small triangle no longer counts.
    expect(evaluateCut(createCentralTriangleFixture(6)).actualPieceCount).toBeLessThan(7);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
