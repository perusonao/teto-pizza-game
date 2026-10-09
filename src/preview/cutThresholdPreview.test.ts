import { afterEach, describe, expect, it, vi } from "vitest";
import type { CutSignificanceThresholds } from "../logic/cut/regions";
import {
  CUT_AREA_PCT_RANGE,
  CUT_MIN_WIDTH_RANGE,
  CUT_THRESHOLD_PREVIEW_MARK,
  cutThresholdBadgeLabel,
  resolveCutThresholdOverride,
} from "./cutThresholdPreview";

const DEFAULTS: CutSignificanceThresholds = { areaFraction: 0.001, minWidth: 1.0 };

describe("resolveCutThresholdOverride (pure parser, #427)", () => {
  it("no query, or a non-string: the defaults", () => {
    expect(resolveCutThresholdOverride("", DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride(undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride(42, DEFAULTS)).toEqual(DEFAULTS);
  });

  it("valid values override (cutAreaPct is a PERCENT, stored as a fraction)", () => {
    expect(resolveCutThresholdOverride("?cutAreaPct=0.20&cutMinWidth=1.5", DEFAULTS)).toEqual({ areaFraction: 0.002, minWidth: 1.5 });
    expect(resolveCutThresholdOverride("?cutAreaPct=0.05", DEFAULTS)).toEqual({ areaFraction: 0.0005, minWidth: 1.0 });
    expect(resolveCutThresholdOverride("cutMinWidth=0.5", DEFAULTS)).toEqual({ areaFraction: 0.001, minWidth: 0.5 });
  });

  it("the range ends are accepted; one step outside is not", () => {
    expect(resolveCutThresholdOverride(`?cutAreaPct=${CUT_AREA_PCT_RANGE.min}`, DEFAULTS).areaFraction).toBeCloseTo(0.0002, 12);
    expect(resolveCutThresholdOverride(`?cutAreaPct=${CUT_AREA_PCT_RANGE.max}`, DEFAULTS).areaFraction).toBeCloseTo(0.005, 12);
    expect(resolveCutThresholdOverride(`?cutMinWidth=${CUT_MIN_WIDTH_RANGE.min}`, DEFAULTS).minWidth).toBe(0.2);
    expect(resolveCutThresholdOverride(`?cutMinWidth=${CUT_MIN_WIDTH_RANGE.max}`, DEFAULTS).minWidth).toBe(2.0);
    expect(resolveCutThresholdOverride("?cutAreaPct=0.01", DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride("?cutAreaPct=0.6", DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride("?cutMinWidth=0.1", DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveCutThresholdOverride("?cutMinWidth=2.1", DEFAULTS)).toEqual(DEFAULTS);
  });

  it.each(["abc", "NaN", "Infinity", "-1", "-0.1", "0x10", "1e-1", "1e0", "", " 0.2", "0.2 ", "+0.2", ".2", "0,2", "0.2.1", "0.2abc"])(
    "a malformed value %j falls back for that parameter only (the other stays valid)",
    (bad) => {
      const result = resolveCutThresholdOverride(`?cutAreaPct=${encodeURIComponent(bad)}&cutMinWidth=1.5`, DEFAULTS);
      expect(result).toEqual({ areaFraction: 0.001, minWidth: 1.5 });
      const result2 = resolveCutThresholdOverride(`?cutAreaPct=0.2&cutMinWidth=${encodeURIComponent(bad)}`, DEFAULTS);
      expect(result2).toEqual({ areaFraction: 0.002, minWidth: 1.0 });
    },
  );

  it("a repeated parameter is invalid for that parameter (never 'the first' or 'the last')", () => {
    expect(resolveCutThresholdOverride("?cutAreaPct=0.2&cutAreaPct=0.3&cutMinWidth=1.5", DEFAULTS)).toEqual({ areaFraction: 0.001, minWidth: 1.5 });
  });

  it("unrelated parameters are ignored", () => {
    expect(resolveCutThresholdOverride("?hint5=1&foo=bar&cutMinWidth=1.5", DEFAULTS)).toEqual({ areaFraction: 0.001, minWidth: 1.5 });
  });
});

describe("cutThresholdBadgeLabel", () => {
  it("nothing with the defaults, `CUT 0.20%/1.5u` when overridden", () => {
    expect(cutThresholdBadgeLabel(DEFAULTS, DEFAULTS)).toBeNull();
    expect(cutThresholdBadgeLabel({ areaFraction: 0.002, minWidth: 1.5 }, DEFAULTS)).toBe("CUT 0.20%/1.5u");
    expect(cutThresholdBadgeLabel({ areaFraction: 0.001, minWidth: 0.5 }, DEFAULTS)).toBe("CUT 0.10%/0.5u");
  });

  it("the mark is a stable string the bundle gate looks for", () => {
    expect(CUT_THRESHOLD_PREVIEW_MARK).toBe("cut-threshold-preview-v1");
  });
});

// The wiring: regions.ts reads the query ONLY behind VITE_PREVIEW_MODE, once, and never writes anything.
async function regionsModule(previewMode: boolean, search: string) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", previewMode ? "1" : "");
  window.history.pushState({}, "", `/${search}`);
  return import("../logic/cut/regions");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("./cutThresholdPreview");
  vi.restoreAllMocks();
  vi.resetModules();
  window.history.pushState({}, "", "/");
});

describe("regions.ts wiring (#427)", () => {
  it("production (no VITE_PREVIEW_MODE): a query is never read -- the defaults, and the preview module is not even called", async () => {
    const read = vi.fn();
    vi.doMock("./cutThresholdPreview", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./cutThresholdPreview")>()),
      getPreviewCutThresholds: read,
    }));
    const regions = await regionsModule(false, "?cutAreaPct=0.3&cutMinWidth=1.5");
    expect(regions.getCutSignificanceThresholds()).toBe(regions.DEFAULT_CUT_SIGNIFICANCE);
    expect(regions.getCutSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
    expect(read).not.toHaveBeenCalled();
  });

  it("Preview: a valid query overrides; evaluation and the count use it", async () => {
    const regions = await regionsModule(true, "?cutAreaPct=0.5&cutMinWidth=2");
    expect(regions.getCutSignificanceThresholds()).toEqual({ areaFraction: 0.005, minWidth: 2 });
    const { createChordCutLine } = await import("../logic/cut/fixtures");
    const { evaluateCut } = await import("../logic/cut/evaluation");
    // d=5 is a significant triangle at the defaults (7 pieces) but not at 0.5% (36 u^2): 6.
    const lines = [createChordCutLine(0), createChordCutLine(60), createChordCutLine(120, 5)];
    expect(evaluateCut(lines).actualPieceCount).toBe(6);
  });

  it("Preview with no / invalid query: the defaults", async () => {
    expect((await regionsModule(true, "")).getCutSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
    expect((await regionsModule(true, "?cutAreaPct=abc&cutMinWidth=-1")).getCutSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
  });

  it("Preview: read once -- a later change to the URL does not move the thresholds within the session", async () => {
    const regions = await regionsModule(true, "?cutAreaPct=0.2");
    expect(regions.getCutSignificanceThresholds().areaFraction).toBe(0.002);
    window.history.pushState({}, "", "/?cutAreaPct=0.4");
    expect(regions.getCutSignificanceThresholds().areaFraction).toBe(0.002);
  });

  it("never writes to storage (not the save, not localStorage / sessionStorage)", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const regions = await regionsModule(true, "?cutAreaPct=0.2&cutMinWidth=1.5");
    regions.getCutSignificanceThresholds();
    const { createChordCutLine } = await import("../logic/cut/fixtures");
    const { evaluateCut } = await import("../logic/cut/evaluation");
    evaluateCut([createChordCutLine(0), createChordCutLine(60)]);
    expect(setItem).not.toHaveBeenCalled();
  });
});
