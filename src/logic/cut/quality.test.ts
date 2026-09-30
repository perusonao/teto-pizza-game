import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { evaluateCut } from "./evaluation";
import { createDiameterCutLine, createIdealSliceFixtureLines } from "./fixtures";
import {
  DEFAULT_CUT_QUALITY_TOLERANCE,
  PROVISIONAL_CUT_QUALITY_WEIGHTS,
  evaluateCutQuality,
  type CutQuality,
} from "./quality";
import type { CutLine } from "./types";

const SIX = { requestedSliceCount: 6 } as const;
const idealSix = createIdealSliceFixtureLines(6);

/** A diameter-direction chord at `angleDegrees`, shifted `offset` dough-percent off center. */
function chord(angleDegrees: number, offset = 0): CutLine {
  const a = (angleDegrees * Math.PI) / 180;
  const nx = -Math.sin(a) * offset;
  const ny = Math.cos(a) * offset;
  const half = Math.sqrt(Math.max(0, DOUGH_RADIUS * DOUGH_RADIUS - offset * offset));
  const dx = Math.cos(a) * half;
  const dy = Math.sin(a) * half;
  return {
    start: { x: DOUGH_CENTER + nx - dx, y: DOUGH_CENTER + ny - dy },
    end: { x: DOUGH_CENTER + nx + dx, y: DOUGH_CENTER + ny + dy },
  };
}

function unitFields(q: CutQuality): number[] {
  return [q.lineValidity, q.sliceCountFit, q.centerAccuracy, q.sliceUniformity, q.overall];
}

function expectBounded(q: CutQuality): void {
  for (const v of unitFields(q)) {
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
  for (const a of q.pieceAreas) expect(Number.isFinite(a)).toBe(true);
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

describe("evaluateCutQuality -- perfect / good / poor", () => {
  it("a perfect 6-slice cut scores 1 on every signal", () => {
    const q = evaluateCutQuality(idealSix, SIX);
    expect(q.lineValidity).toBe(1);
    expect(q.sliceCountFit).toBe(1);
    expect(q.centerAccuracy).toBe(1);
    expect(q.sliceUniformity).toBe(1);
    expect(q.overall).toBe(1);
    expect(q.actualPieceCount).toBe(6);
    expect(q.validLineCount).toBe(3);
    expect(q.distinctLineCount).toBe(3);
  });

  it("perfect 4- and 8-slice cuts score 1 (slice count is data, not hard-coded)", () => {
    for (const n of [4, 8] as const) {
      const q = evaluateCutQuality(createIdealSliceFixtureLines(n), { requestedSliceCount: n });
      expect(q.overall).toBe(1);
      expect(q.actualPieceCount).toBe(n);
    }
  });

  it("a finger-sized wobble (~2 dough-percent off center, ~3 degrees off) still earns full credit", () => {
    const q = evaluateCutQuality([chord(0, 2), chord(63, -2), chord(117, 1.5)], SIX);
    expect(q.centerAccuracy).toBe(1);
    expect(q.sliceUniformity).toBeGreaterThan(0.9);
    expect(q.overall).toBeGreaterThan(0.95);
  });

  it("orders perfect > good > poor, with poor clearly low", () => {
    const perfect = evaluateCutQuality(idealSix, SIX).overall;
    const good = evaluateCutQuality([chord(0, 6), chord(65, -6), chord(125, 5)], SIX).overall;
    const poor = evaluateCutQuality([chord(0, 30), chord(10, -30), chord(20, 32)], SIX).overall;
    expect(perfect).toBeGreaterThan(good);
    expect(good).toBeGreaterThan(poor);
    expect(poor).toBeLessThan(0.5);
  });

  it("three parallel off-center cuts are poor on centre and uniformity", () => {
    const q = evaluateCutQuality([chord(0, 25), chord(0.5, 0), chord(180, -25)], SIX);
    expect(q.sliceCountFit).toBeLessThan(1);
    expect(q.sliceUniformity).toBeLessThan(0.5);
  });
});

describe("evaluateCutQuality -- slivers from non-concurrent cuts", () => {
  const wobble = [chord(0, 2), chord(63, -2), chord(117, 1.5)];

  it("three cuts missing a common point leave a sliver that is not counted as a 7th slice", () => {
    const q = evaluateCutQuality(wobble, SIX);
    expect(q.pieceAreas.length).toBe(7);
    expect(q.sliverCount).toBe(1);
    expect(q.actualPieceCount).toBe(6);
    expect(q.sliceCountFit).toBe(1);
  });

  it("with slivers counted (fraction 0) the same cut reads as 7 pieces", () => {
    const q = evaluateCutQuality(wobble, SIX, { sliverAreaFraction: 0 });
    expect(q.sliverCount).toBe(0);
    expect(q.actualPieceCount).toBe(7);
    expect(q.sliceCountFit).toBeLessThan(1);
  });

  it("a genuine extra cut is not a sliver", () => {
    const q = evaluateCutQuality([...idealSix, chord(30)], SIX);
    expect(q.sliverCount).toBe(0);
    expect(q.actualPieceCount).toBe(8);
  });

  it("the sliver threshold is exact at the boundary", () => {
    const areas = evaluateCutQuality(wobble, SIX).pieceAreas;
    const ideal = (Math.PI * DOUGH_RADIUS * DOUGH_RADIUS) / 6;
    const smallest = Math.min(...areas) / ideal;
    expect(evaluateCutQuality(wobble, SIX, { sliverAreaFraction: smallest - 1e-9 }).sliverCount).toBe(0);
    expect(evaluateCutQuality(wobble, SIX, { sliverAreaFraction: smallest + 1e-9 }).sliverCount).toBe(1);
  });

  it("an invalid sliver fraction falls back to the default", () => {
    const base = evaluateCutQuality(wobble, SIX);
    for (const bad of [NaN, -1, 1, 5]) {
      expect(evaluateCutQuality(wobble, SIX, { sliverAreaFraction: bad })).toEqual(base);
    }
  });

  it("a single diameter (two half discs) has no slivers and does not fall into the all-sliver fallback", () => {
    const q = evaluateCutQuality([chord(0)], SIX);
    expect(q.sliverCount).toBe(0);
    expect(q.actualPieceCount).toBe(2);
  });
});

describe("evaluateCutQuality -- completeness is not a scored signal", () => {
  it("has no completeness field; counts are information only", () => {
    const q = evaluateCutQuality(idealSix, SIX);
    expect("completeness" in q).toBe(false);
    expect(q.requiredLineCount).toBe(3);
    expect(q.lineCount).toBe(3);
  });

  it("an extra valid cut changes the score only through count fit / uniformity, never a completeness bonus", () => {
    const four = evaluateCutQuality([...idealSix, chord(30)], SIX);
    expect(four.lineCount).toBe(4);
    expect(four.sliceCountFit).toBeLessThan(1);
  });
});

describe("evaluateCutQuality -- determinism and order independence", () => {
  it("is deterministic", () => {
    const lines = [chord(0, 5), chord(70, -3), chord(110, 8)];
    expect(evaluateCutQuality(lines, SIX)).toEqual(evaluateCutQuality(lines, SIX));
  });

  it("does not mutate its input", () => {
    const lines = [chord(0, 5), chord(70, -3), chord(110, 8)];
    const snapshot = JSON.stringify(lines);
    evaluateCutQuality(lines, SIX);
    expect(JSON.stringify(lines)).toBe(snapshot);
  });

  it("every ordering of the same lines gives identical signals (areas compared as a multiset)", () => {
    const lines = [chord(0, 5), chord(70, -3), chord(110, 8)];
    const base = evaluateCutQuality(lines, SIX);
    for (const p of permutations(lines)) {
      const q = evaluateCutQuality(p, SIX);
      expect(q.lineValidity).toBe(base.lineValidity);
      expect(q.sliceCountFit).toBe(base.sliceCountFit);
      expect(q.centerAccuracy).toBeCloseTo(base.centerAccuracy, 12);
      expect(q.sliceUniformity).toBeCloseTo(base.sliceUniformity, 12);
      expect(q.overall).toBeCloseTo(base.overall, 12);
      expect([...q.pieceAreas].sort()).toEqual([...base.pieceAreas].sort());
    }
  });

  it("reversing a line's direction changes nothing", () => {
    const flipped = idealSix.map((l) => ({ start: l.end, end: l.start }));
    expect(evaluateCutQuality(flipped, SIX)).toEqual(evaluateCutQuality(idealSix, SIX));
  });

  it("near-duplicate detection is order independent, including across the 0/pi wrap", () => {
    const a = chord(1);
    const b = chord(179);
    const c = chord(90);
    const results = permutations([a, b, c]).map((p) => evaluateCutQuality(p, SIX).distinctLineCount);
    expect(new Set(results)).toEqual(new Set([2]));
  });
});

describe("evaluateCutQuality -- geometry boundaries", () => {
  const tol = DEFAULT_CUT_QUALITY_TOLERANCE;

  it("centre credit is full at the full-credit distance and zero at the zero-credit distance", () => {
    const at = (d: number) =>
      evaluateCutQuality([chord(0, d)], SIX, { minChordLength: 0 }).centerAccuracy;
    expect(at(tol.centerFullCreditDistance - 1e-6)).toBe(1);
    expect(at(tol.centerFullCreditDistance + 0.5)).toBeLessThan(1);
    expect(at(tol.centerZeroCreditDistance - 0.5)).toBeGreaterThan(0);
    expect(at(tol.centerZeroCreditDistance + 1e-6)).toBe(0);
    expect(at(tol.centerZeroCreditDistance + 5)).toBe(0);
  });

  it("centre credit falls monotonically with distance", () => {
    let previous = 2;
    for (let d = 0; d <= 30; d += 1) {
      const v = evaluateCutQuality([chord(0, d)], SIX, { minChordLength: 0 }).centerAccuracy;
      expect(v).toBeLessThanOrEqual(previous);
      previous = v;
    }
  });

  it("a chord exactly at minChordLength is valid; just under is not", () => {
    // Offset d gives chord length 2*sqrt(R^2 - d^2).
    const lengthAt = (d: number) => 2 * Math.sqrt(DOUGH_RADIUS ** 2 - d ** 2);
    const target = 60;
    const d = Math.sqrt(DOUGH_RADIUS ** 2 - (target / 2) ** 2);
    expect(lengthAt(d)).toBeCloseTo(target, 9);
    expect(evaluateCutQuality([chord(0, d)], SIX, { minChordLength: target }).validLineCount).toBe(1);
    expect(evaluateCutQuality([chord(0, d)], SIX, { minChordLength: target + 0.001 }).validLineCount).toBe(0);
  });

  it("an endpoint exactly endpointMargin outside the rim is valid; beyond it is not", () => {
    const limit = DOUGH_RADIUS + tol.endpointMargin;
    const ok: CutLine = { start: { x: DOUGH_CENTER - limit, y: DOUGH_CENTER }, end: { x: DOUGH_CENTER + limit, y: DOUGH_CENTER } };
    const bad: CutLine = { start: { x: DOUGH_CENTER - limit - 0.01, y: DOUGH_CENTER }, end: ok.end };
    expect(evaluateCutQuality([ok], SIX).validLineCount).toBe(1);
    expect(evaluateCutQuality([bad], SIX).validLineCount).toBe(0);
  });

  it("orientations just past the separation count as distinct; just under as one", () => {
    const sep = (tol.minAngularSeparationRadians * 180) / Math.PI;
    expect(evaluateCutQuality([chord(0), chord(sep + 0.001)], SIX).distinctLineCount).toBe(2);
    expect(evaluateCutQuality([chord(0), chord(sep - 0.01)], SIX).distinctLineCount).toBe(1);
  });

  it("uniformity is 1 inside the dead zone and 0 at the zero-credit deviation", () => {
    const perfect = evaluateCutQuality(idealSix, SIX).sliceUniformity;
    expect(perfect).toBe(1);
    // A single diameter: two half-discs, each at 3x the ideal (1/6) area -> deviation 2 >> 0.6.
    expect(evaluateCutQuality([chord(0)], SIX).sliceUniformity).toBe(0);
  });
});

describe("evaluateCutQuality -- malformed / degenerate input", () => {
  const nan: CutLine = { start: { x: NaN, y: 0 }, end: { x: 10, y: 10 } };
  const inf: CutLine = { start: { x: Infinity, y: 0 }, end: { x: 10, y: 10 } };
  const zero: CutLine = { start: { x: 50, y: 50 }, end: { x: 50, y: 50 } };
  const tiny: CutLine = { start: { x: 50, y: 50 }, end: { x: 50.0000001, y: 50 } };
  const far: CutLine = { start: { x: -500, y: -500 }, end: { x: 500, y: 500 } };

  it("no lines: finite, bounded, all zero, never NaN", () => {
    const q = evaluateCutQuality([], SIX);
    expectBounded(q);
    expect(q.lineValidity).toBe(0);
    expect(q.centerAccuracy).toBe(0);
    expect(q.validLineCount).toBe(0);
    expect(q.actualPieceCount).toBe(1);
    expect(q.overall).toBeLessThan(0.3);
  });

  it.each([
    ["NaN", nan],
    ["Infinity", inf],
    ["zero-length", zero],
    ["near-zero-length", tiny],
    ["far off the dough", far],
  ])("%s line is invalid, bounded and never helps the score", (_name, bad) => {
    const q = evaluateCutQuality([bad], SIX);
    expectBounded(q);
    expect(q.validLineCount).toBe(0);
    expect(q.lineValidity).toBe(0);
    const withBad = evaluateCutQuality([...idealSix, bad], SIX);
    const clean = evaluateCutQuality(idealSix, SIX);
    expectBounded(withBad);
    expect(withBad.overall).toBeLessThan(clean.overall);
    expect(withBad.validLineCount).toBe(3);
    expect(withBad.actualPieceCount).toBe(6);
  });

  it("an all-malformed set is bounded", () => {
    expectBounded(evaluateCutQuality([nan, inf, zero, tiny, far], SIX));
  });

  it("identical duplicated lines collapse to one distinct cut", () => {
    const q = evaluateCutQuality([chord(0), chord(0), chord(0)], SIX);
    expect(q.distinctLineCount).toBe(1);
    expect(q.lineValidity).toBeCloseTo(1 / 3, 12);
  });

  it("many lines stay bounded", () => {
    const lines = Array.from({ length: 12 }, (_, i) => chord(i * 15, i % 3));
    expectBounded(evaluateCutQuality(lines, SIX));
  });

  it("bounds hold over a sweep of pseudo-random cuts", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 150; i++) {
      const n = 1 + Math.floor(rnd() * 5);
      const lines = Array.from({ length: n }, () => chord(rnd() * 180, (rnd() - 0.5) * 60));
      expectBounded(evaluateCutQuality(lines, SIX));
    }
  });
});

describe("evaluateCutQuality -- tolerance / weights are adjustable authorities", () => {
  it("a wider centre tolerance raises centre credit; a tighter one lowers it", () => {
    const lines = [chord(0, 8)];
    const base = evaluateCutQuality(lines, SIX, { minChordLength: 0 }).centerAccuracy;
    const wide = evaluateCutQuality(lines, SIX, { minChordLength: 0, centerFullCreditDistance: 10 }).centerAccuracy;
    const tight = evaluateCutQuality(lines, SIX, { minChordLength: 0, centerZeroCreditDistance: 10 }).centerAccuracy;
    expect(wide).toBeGreaterThan(base);
    expect(tight).toBeLessThan(base);
  });

  it("malformed tolerance fields fall back to the defaults", () => {
    const lines = [chord(0, 6), chord(65, -6), chord(125, 5)];
    const base = evaluateCutQuality(lines, SIX);
    expect(evaluateCutQuality(lines, SIX, { centerFullCreditDistance: NaN, minChordLength: -3 })).toEqual(base);
    // full >= zero is nonsensical -> both fall back together
    expect(
      evaluateCutQuality(lines, SIX, { centerFullCreditDistance: 30, centerZeroCreditDistance: 10 }),
    ).toEqual(base);
  });

  it("weights are caller-supplied; degenerate weights give 0, never NaN", () => {
    const q = evaluateCutQuality(idealSix, SIX, undefined, { lineValidity: 0, sliceCountFit: 0, centerAccuracy: 0, sliceUniformity: 0 });
    expect(q.overall).toBe(0);
    const only = evaluateCutQuality([chord(0, 30), chord(10, -30), chord(20, 32)], SIX, undefined, {
      lineValidity: 1, sliceCountFit: 0, centerAccuracy: 0, sliceUniformity: 0,
    });
    expect(only.overall).toBeCloseTo(only.lineValidity, 12);
  });

  it("the provisional weights are positive and not all zero (they are not a production spec)", () => {
    const w = PROVISIONAL_CUT_QUALITY_WEIGHTS;
    expect(w.lineValidity + w.sliceCountFit + w.centerAccuracy + w.sliceUniformity).toBeGreaterThan(0);
  });

  it("the default tolerance objects are frozen", () => {
    expect(Object.isFrozen(DEFAULT_CUT_QUALITY_TOLERANCE)).toBe(true);
    expect(Object.isFrozen(PROVISIONAL_CUT_QUALITY_WEIGHTS)).toBe(true);
  });
});

describe("evaluateCutQuality -- mutation-driven pins", () => {
  const shortOffCenter: CutLine = { start: { x: 10, y: 10 }, end: { x: 10, y: 30 } };

  it("both endpoints must be on the dough", () => {
    const good = chord(0);
    const badEnd: CutLine = { start: good.start, end: { x: 500, y: 50 } };
    expect(evaluateCutQuality([badEnd], SIX).validLineCount).toBe(0);
  });

  it("invalid lines do not enter the centre average", () => {
    const q = evaluateCutQuality([...idealSix, shortOffCenter], SIX);
    expect(q.validLineCount).toBe(3);
    expect(q.centerAccuracy).toBe(1);
  });

  it("an invalid line's own centre credit never inflates the average", () => {
    const shortThroughCenter: CutLine = { start: { x: 50, y: 45 }, end: { x: 50, y: 55 } };
    const alone = evaluateCutQuality([chord(0, 12)], SIX, { minChordLength: 0 });
    const withInvalid = evaluateCutQuality([chord(0, 12), shortThroughCenter], SIX, { minChordLength: 40 });
    expect(alone.centerAccuracy).toBeGreaterThan(0.3);
    expect(alone.centerAccuracy).toBeLessThan(0.7);
    expect(withInvalid.validLineCount).toBe(1);
    expect(withInvalid.centerAccuracy).toBeCloseTo(alone.centerAccuracy, 12);
  });

  it("orientations exactly at the separation are distinct", () => {
    const horizontal: CutLine = { start: { x: 2, y: 50 }, end: { x: 98, y: 50 } };
    const vertical: CutLine = { start: { x: 50, y: 2 }, end: { x: 50, y: 98 } };
    expect(evaluateCutQuality([horizontal, vertical], SIX, { minAngularSeparationRadians: Math.PI / 2 }).distinctLineCount).toBe(2);
  });

  it("with a separation above pi everything is one cut (no wrap double-count)", () => {
    expect(evaluateCutQuality(idealSix, SIX, { minAngularSeparationRadians: 4 }).distinctLineCount).toBe(1);
  });

  it("when every region is below the sliver threshold, all are kept rather than none", () => {
    const many = createIdealSliceFixtureLines(24);
    const q = evaluateCutQuality(many, SIX, { sliverAreaFraction: 0.5 });
    expect(q.actualPieceCount).toBe(24);
    expect(q.sliceUniformity).toBeGreaterThanOrEqual(0);
  });

  it("requiredLineCount follows the slice count", () => {
    expect(evaluateCutQuality([], { requestedSliceCount: 4 }).requiredLineCount).toBe(2);
    expect(evaluateCutQuality([], { requestedSliceCount: 8 }).requiredLineCount).toBe(4);
  });

  it("weights are normalised: scaling them all leaves overall unchanged", () => {
    const lines = [chord(0, 6), chord(65, -6), chord(125, 5)];
    const w = PROVISIONAL_CUT_QUALITY_WEIGHTS;
    const scaled = { lineValidity: w.lineValidity * 7, sliceCountFit: w.sliceCountFit * 7, centerAccuracy: w.centerAccuracy * 7, sliceUniformity: w.sliceUniformity * 7 };
    expect(evaluateCutQuality(lines, SIX, undefined, scaled).overall).toBeCloseTo(evaluateCutQuality(lines, SIX).overall, 12);
  });

  it("a negative weight counts as zero", () => {
    const lines = [chord(0, 30), chord(10, -30), chord(20, 32)];
    const a = evaluateCutQuality(lines, SIX, undefined, { lineValidity: -5, sliceCountFit: 0, centerAccuracy: 1, sliceUniformity: 0 });
    const b = evaluateCutQuality(lines, SIX, undefined, { lineValidity: 0, sliceCountFit: 0, centerAccuracy: 1, sliceUniformity: 0 });
    expect(a.overall).toBe(b.overall);
  });

  it("a mis-ordered uniformity tolerance falls back to the defaults", () => {
    const lines = [chord(0, 6), chord(65, -6), chord(125, 5)];
    expect(
      evaluateCutQuality(lines, SIX, { uniformityFullCreditDeviation: 0.5, uniformityZeroCreditDeviation: 0.2 }),
    ).toEqual(evaluateCutQuality(lines, SIX));
  });

  it("a negative tolerance falls back to the default", () => {
    const short: CutLine = { start: { x: 30, y: 50 }, end: { x: 40, y: 50 } };
    expect(evaluateCutQuality([short], SIX, { minChordLength: -3 }).validLineCount).toBe(0);
    expect(evaluateCutQuality([short], SIX, { endpointMargin: -100 }).validLineCount).toBe(0);
  });
});

describe("existing evaluateCut behavior is unchanged (regression)", () => {
  it("a perfect 6-slice cut is still cutScore 100 with completeness 1", () => {
    const e = evaluateCut(idealSix, SIX);
    expect(e.cutScore).toBeGreaterThan(99.9);
    expect(e.completeness).toBe(1);
  });

  it("evaluateCut still reports completeness (the constant this evaluator drops)", () => {
    expect(evaluateCut([createDiameterCutLine(0)], SIX).completeness).toBeCloseTo(1 / 3, 12);
  });
});

describe("CutQuality is not connected to anything (S1 scope guard)", () => {
  const src = join(__dirname, "..", "..");
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  }

  it("no non-test source file outside src/logic/cut imports ./quality", () => {
    const offenders = walk(src).filter((f) => {
      if (!/\.(ts|tsx)$/.test(f) || /\.test\./.test(f)) return false;
      if (f.includes(join("logic", "cut") + "/")) return false;
      return /(?:from|import)\s+"[^"]*(?:\/cut)?\/quality"/.test(readFileSync(f, "utf8"));
    });
    expect(offenders).toEqual([]);
  });

  it("quality.ts imports no reducer, scoring, state, component, mission or persistence module", () => {
    const text = readFileSync(join(__dirname, "quality.ts"), "utf8");
    const imports = [...text.matchAll(/(?:from|import)\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      expect(spec).toMatch(/^(\.\/|\.\.\/pizzaCoordinates$)/);
    }
    expect(imports).not.toContain("./state");
  });
});
