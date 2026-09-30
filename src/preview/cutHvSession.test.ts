import { describe, expect, it } from "vitest";
import { createIdealSliceFixtureLines } from "../logic/cut/fixtures";
import { evaluateCut } from "../logic/cut/evaluation";
import { evaluateCutQuality } from "../logic/cut/quality";
import { isCutHvRequested, CUT_HV_PREVIEW_MARK } from "./cutHvActivation";
import {
  CUT_HV_STORAGE_KEY,
  HV_TRIAL_PLAN,
  buildHvResultText,
  computeHvMetrics,
  loadHvTrials,
  saveHvTrials,
  type HvAttemptRecord,
} from "./cutHvSession";
import type { StorageLike } from "../state/persistence";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } } as StorageLike & { data: Record<string, string> };
}

describe("cutHvActivation: fail-closed", () => {
  it("only an explicit cuthv=1 turns it on", () => {
    expect(isCutHvRequested("?cuthv=1")).toBe(true);
    expect(isCutHvRequested("?x=2&cuthv=1")).toBe(true);
    for (const v of ["", "?cuthv=0", "?cuthv=", "?cuthv=true", "?CUTHV=1", "?cuthv=1x", undefined, null, 1, {}]) {
      expect(isCutHvRequested(v)).toBe(false);
    }
  });
  it("has a mark the isolation gate can scan for", () => {
    expect(CUT_HV_PREVIEW_MARK).toBe("cut-hv-preview-v1");
  });
});

describe("the Owner procedure", () => {
  it("is careful x3, normal x5, rough x3", () => {
    expect(HV_TRIAL_PLAN).toHaveLength(11);
    expect(HV_TRIAL_PLAN.filter((s) => s === "careful")).toHaveLength(3);
    expect(HV_TRIAL_PLAN.filter((s) => s === "normal")).toHaveLength(5);
    expect(HV_TRIAL_PLAN.filter((s) => s === "rough")).toHaveLength(3);
  });
});

describe("computeHvMetrics", () => {
  const lines = createIdealSliceFixtureLines(6);
  it("reports both zero-side overalls and the existing cutScore from the same lines", () => {
    const m = computeHvMetrics(lines);
    expect(m.overall06).toBe(evaluateCutQuality(lines, { requestedSliceCount: 6 }, { uniformityZeroCreditDeviation: 0.6 }).overall);
    expect(m.overall04).toBe(evaluateCutQuality(lines, { requestedSliceCount: 6 }, { uniformityZeroCreditDeviation: 0.4 }).overall);
    expect(m.cutScore).toBe(evaluateCut(lines, { requestedSliceCount: 6 }).cutScore);
  });
  it("differs between 0.6 and 0.4 only through uniformity, never above the 0.6 value", () => {
    const uneven = [
      { start: { x: 50, y: 2 }, end: { x: 50, y: 98 } },
      { start: { x: 2, y: 30 }, end: { x: 98, y: 66 } },
      { start: { x: 10, y: 80 }, end: { x: 90, y: 20 } },
    ];
    const m = computeHvMetrics(uneven);
    expect(m.overall04).toBeLessThanOrEqual(m.overall06);
    expect(m.uniformity04).toBeLessThanOrEqual(m.uniformity06);
  });
  it("an ideal cut is 1 under both", () => {
    const m = computeHvMetrics(lines);
    expect(m.overall06).toBe(1);
    expect(m.overall04).toBe(1);
  });
});

describe("trial storage", () => {
  const record = (): HvAttemptRecord => ({ index: 0, instructed: "careful", selfRating: "normal", lines: createIdealSliceFixtureLines(6), viewport: "390x844", metrics: computeHvMetrics(createIdealSliceFixtureLines(6)) });
  it("round-trips under its own Preview key only, recomputing metrics", () => {
    const s = memoryStorage();
    saveHvTrials(s, [record()]);
    expect(Object.keys(s.data)).toEqual([CUT_HV_STORAGE_KEY]);
    expect(CUT_HV_STORAGE_KEY).not.toBe("teto-pizza-save-v1");
    const back = loadHvTrials(s);
    expect(back).toHaveLength(1);
    expect(back[0].metrics.overall06).toBe(1);
    expect(back[0].selfRating).toBe("normal");
  });
  it("drops malformed records and never throws", () => {
    for (const raw of ["not json", "{}", "[1,2]", JSON.stringify([{ instructed: "x", selfRating: "normal", lines: [], viewport: "a" }]), JSON.stringify([{ instructed: "careful", selfRating: "normal", lines: [{ start: { x: NaN, y: 0 }, end: { x: 1, y: 1 } }], viewport: "a" }])]) {
      expect(loadHvTrials(memoryStorage({ [CUT_HV_STORAGE_KEY]: raw }))).toEqual([]);
    }
    expect(loadHvTrials(null)).toEqual([]);
  });
  it("caps a load at the plan length", () => {
    const many = Array.from({ length: 30 }, () => ({ instructed: "careful", selfRating: "normal", lines: createIdealSliceFixtureLines(6), viewport: "a" }));
    expect(loadHvTrials(memoryStorage({ [CUT_HV_STORAGE_KEY]: JSON.stringify(many) }))).toHaveLength(HV_TRIAL_PLAN.length);
  });
  it("survives a storage that throws", () => {
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => {} } as StorageLike;
    expect(() => saveHvTrials(bad, [record()])).not.toThrow();
    expect(loadHvTrials(bad)).toEqual([]);
  });
});

describe("buildHvResultText", () => {
  it("has a header, one tab-separated row per trial, both Q columns, the current cutScore and the lines", () => {
    const t: HvAttemptRecord = { index: 0, instructed: "rough", selfRating: "careful", lines: createIdealSliceFixtureLines(6), viewport: "360x800", metrics: computeHvMetrics(createIdealSliceFixtureLines(6)) };
    const text = buildHvResultText([t, t]);
    const rows = text.split("\n");
    expect(rows[0]).toBe(CUT_HV_PREVIEW_MARK);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain("Q(0.6)\tQ(0.4)");
    expect(rows[2].split("\t")).toHaveLength(rows[1].split("\t").length);
    expect(rows[2]).toContain("雑\t丁寧\t1.00\t1.00");
    expect(rows[2]).toContain("360x800");
  });
});
