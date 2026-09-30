// @vitest-environment node
/**
 * CUT-S2 Owner Human Verification (Issue #288): the Owner's 11 real-finger trials (`cut-hv-preview-v1`,
 * docs/reports/data/cut-s2/owner-hv-raw.tsv, pasted verbatim) are the authority. This test recomputes every
 * figure from the committed `lines` with the current evaluator and checks it against the pasted values, so the
 * report's aggregates can never drift from the data. The pasted `lines` are rounded to 2 decimals, which is why the
 * comparison tolerance is one rounding step.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CutLine } from "../logic/cut/types";
import { HV_STYLE_LABEL_JA, computeHvMetrics, type HvMetrics, type HvStyle } from "./cutHvSession";

const FILE = join(__dirname, "../../docs/reports/data/cut-s2/owner-hv-raw.tsv");
const STYLE_OF: Record<string, HvStyle> = { 丁寧: "careful", 普通: "normal", 雑: "rough" };

interface Row {
  n: number;
  instructed: HvStyle;
  self: HvStyle;
  pasted: { q06: number; q04: number; u06: number; u04: number; center: number; validity: number; count: number; cutScore: number; sliver: number; pieces: number };
  viewport: string;
  lines: CutLine[];
}

function parse(): Row[] {
  const [mark, header, ...rows] = readFileSync(FILE, "utf8").trim().split("\n");
  expect(mark).toBe("cut-hv-preview-v1");
  expect(header.split("\t")).toHaveLength(15);
  return rows.map((line) => {
    const c = line.split("\t");
    const raw = JSON.parse(c[14]) as number[][];
    return {
      n: Number(c[0]),
      instructed: STYLE_OF[c[1]],
      self: STYLE_OF[c[2]],
      pasted: { q06: +c[3], q04: +c[4], u06: +c[5], u04: +c[6], center: +c[7], validity: +c[8], count: +c[9], cutScore: +c[10], sliver: +c[11], pieces: +c[12] },
      viewport: c[13],
      lines: raw.map(([sx, sy, ex, ey]) => ({ start: { x: sx, y: sy }, end: { x: ex, y: ey } })),
    };
  });
}

const rows = parse();
const recomputed: HvMetrics[] = rows.map((r) => computeHvMetrics(r.lines));
const STEP = 0.0051; // the pasted values are printed to 2 decimals

function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

describe("Owner HV raw data (cut-hv-preview-v1, 11 trials)", () => {
  it("has the procedure's 11 trials: instructed careful x3 / normal x5 / rough x3, one viewport", () => {
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const count = (s: HvStyle) => rows.filter((r) => r.instructed === s).length;
    expect([count("careful"), count("normal"), count("rough")]).toEqual([3, 5, 3]);
    expect(new Set(rows.map((r) => r.viewport))).toEqual(new Set(["402x714"]));
    expect(rows.every((r) => r.lines.length === 3)).toBe(true);
  });

  it.each(rows.map((r) => [r.n, r] as const))("trial %i: every pasted figure is reproduced from its lines", (_n, r) => {
    const m = recomputed[r.n - 1];
    expect(Math.abs(m.overall06 - r.pasted.q06)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.overall04 - r.pasted.q04)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.uniformity06 - r.pasted.u06)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.uniformity04 - r.pasted.u04)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.center - r.pasted.center)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.validity - r.pasted.validity)).toBeLessThanOrEqual(STEP);
    expect(Math.abs(m.count - r.pasted.count)).toBeLessThanOrEqual(STEP);
    expect(Math.round(m.cutScore)).toBe(r.pasted.cutScore);
    expect(m.sliverCount).toBe(r.pasted.sliver);
    expect(m.pieces).toBe(r.pasted.pieces);
  });

  it("Owner-rated 丁寧 and 普通 trials are 1.00 under both 0.6 and 0.4; the rough-rated #1 is also 1.00", () => {
    for (const r of rows.filter((x) => x.self !== "rough")) {
      expect([r.n, r.pasted.q06, r.pasted.q04]).toEqual([r.n, 1, 1]);
    }
    const first = rows[0];
    expect(first.self).toBe("rough");
    expect([first.pasted.q06, first.pasted.q04]).toEqual([1, 1]);
    expect(recomputed[0].overall06).toBe(1);
    expect(recomputed[0].overall04).toBe(1);
  });

  it("Q(0.4) never exceeds Q(0.6), and they differ only on Owner-rated 雑 trials", () => {
    rows.forEach((r, i) => {
      expect(recomputed[i].overall04).toBeLessThanOrEqual(recomputed[i].overall06);
      if (r.self !== "rough") expect(recomputed[i].overall04).toBe(recomputed[i].overall06);
    });
    expect(rows.filter((_, i) => recomputed[i].overall04 < recomputed[i].overall06).map((r) => r.n)).toEqual([7, 8, 9, 10, 11]);
  });

  it("the existing cutScore carries a sliver artifact: equal-quality cuts with a sliver score ~10 lower", () => {
    const perfect = rows.filter((_, i) => recomputed[i].overall06 === 1);
    const withSliver = perfect.filter((r) => r.pasted.sliver > 0).map((r) => r.pasted.cutScore);
    const noSliver = perfect.filter((r) => r.pasted.sliver === 0).map((r) => r.pasted.cutScore);
    expect(Math.min(...noSliver) - Math.max(...withSliver)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...noSliver)).toBeGreaterThanOrEqual(96);
  });

  it("writes the recomputed rows and the per-self-rating aggregates when CUT_S2_WRITE=1", () => {
    const aggregate = (pick: (r: Row) => HvStyle) =>
      (["careful", "normal", "rough"] as const).map((s) => {
        const idx = rows.map((r, i) => [r, i] as const).filter(([r]) => pick(r) === s).map(([, i]) => i);
        const col = (f: (m: HvMetrics) => number) => idx.map((i) => f(recomputed[i]));
        return {
          group: HV_STYLE_LABEL_JA[s],
          n: idx.length,
          trials: idx.map((i) => i + 1),
          q06: { min: Math.min(...col((m) => m.overall06)), mean: mean(col((m) => m.overall06)), max: Math.max(...col((m) => m.overall06)) },
          q04: { min: Math.min(...col((m) => m.overall04)), mean: mean(col((m) => m.overall04)), max: Math.max(...col((m) => m.overall04)) },
          diff06minus04: { mean: mean(col((m) => m.overall06 - m.overall04)), max: Math.max(...col((m) => m.overall06 - m.overall04)) },
          cutScore: { min: Math.min(...col((m) => m.cutScore)), mean: mean(col((m) => m.cutScore)), max: Math.max(...col((m) => m.cutScore)) },
          sliverTrials: idx.filter((i) => recomputed[i].sliverCount > 0).length,
        };
      });
    if (process.env.CUT_S2_WRITE !== "1") return;
    mkdirSync(join(__dirname, "../../docs/reports/data/cut-s2"), { recursive: true });
    writeFileSync(
      join(__dirname, "../../docs/reports/data/cut-s2/owner-hv-recomputed.json"),
      JSON.stringify({ rows: rows.map((r, i) => ({ n: r.n, instructed: r.instructed, self: r.self, pasted: r.pasted, recomputed: recomputed[i] })), bySelfRating: aggregate((r) => r.self), byInstruction: aggregate((r) => r.instructed) }, null, 1) + "\n",
    );
  });
});
