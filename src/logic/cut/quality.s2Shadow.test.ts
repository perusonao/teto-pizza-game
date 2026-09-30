/**
 * CUT-S2 (Issue #288): shadow distribution probe for `evaluateCutQuality` -- pure, no app, no
 * scoring. Runs the seeded operator model (../testSupport/cutOperatorModel.ts) at the two real CUT
 * stage sizes (328px on 360x800, 358px on 390x844, measured by e2e/cut-quality-shadow-s2.spec.ts),
 * records the existing `evaluateCut` next to CutQuality, and sweeps tolerance candidates.
 *
 * The assertions pin the fairness properties S2 measured for the DEFAULT tolerances; the sweep
 * output (CUT_S2_WRITE=1) is the evidence behind the recommendation in the S2 report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import {
  OPERATOR_PROFILES,
  planOperatorCuts,
  seededRandom,
  type OperatorProfile,
} from "../testSupport/cutOperatorModel";
import { evaluateCut } from "./evaluation";
import { createIdealSliceFixtureLines } from "./fixtures";
import { isDuplicateCutLine } from "./geometry";
import {
  DEFAULT_CUT_QUALITY_TOLERANCE,
  PROVISIONAL_CUT_QUALITY_WEIGHTS,
  evaluateCutQuality,
  type CutQualityTolerance,
  type CutQualityWeights,
} from "./quality";
import type { CutLine } from "./types";

const SIX = { requestedSliceCount: 6 } as const;
const STAGES = { "360x800": 328, "390x844": 358 } as const;
const TRIALS = 400;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** One confirmable attempt: the game rejects a near-duplicate line, and CUT cannot be confirmed
 *  below the required count, so a player simply draws again. Returns null if 3 lines were not
 *  reached within the operator's 5 tries per slot. */
function drawConfirmableLines(profile: OperatorProfile, pxPerPercent: number, seed: number): CutLine[] | null {
  const rand = seededRandom(seed);
  const accepted: CutLine[] = [];
  for (let attempt = 0; attempt < 8 && accepted.length < 3; attempt++) {
    const plan = planOperatorCuts(profile, pxPerPercent, rand);
    for (const cut of plan) {
      if (accepted.length >= 3) break;
      if (!cut.line) continue;
      if (isDuplicateCutLine(cut.line, accepted)) continue;
      accepted.push(cut.line);
    }
  }
  return accepted.length >= 3 ? accepted.slice(0, 3) : null;
}

interface Sample {
  cutScore: number;
  overall: number;
  centerAccuracy: number;
  sliceUniformity: number;
  sliceCountFit: number;
  sliver: boolean;
  pieces: number;
}

function sample(
  profile: OperatorProfile,
  stagePx: number,
  tolerance: Partial<CutQualityTolerance>,
  weights: CutQualityWeights,
): { samples: Sample[]; unconfirmable: number } {
  const samples: Sample[] = [];
  let unconfirmable = 0;
  const pxPerPercent = stagePx / 100;
  for (let t = 0; t < TRIALS; t++) {
    const lines = drawConfirmableLines(profile, pxPerPercent, 7000 + t);
    if (!lines) {
      unconfirmable++;
      continue;
    }
    const q = evaluateCutQuality(lines, SIX, tolerance, weights);
    samples.push({
      cutScore: evaluateCut(lines, SIX).cutScore,
      overall: q.overall,
      centerAccuracy: q.centerAccuracy,
      sliceUniformity: q.sliceUniformity,
      sliceCountFit: q.sliceCountFit,
      sliver: q.sliverCount > 0,
      pieces: q.actualPieceCount,
    });
  }
  return { samples, unconfirmable };
}

function summarize(samples: Sample[], pick: (s: Sample) => number) {
  const v = samples.map(pick).sort((a, b) => a - b);
  return { p10: percentile(v, 0.1), median: percentile(v, 0.5), p90: percentile(v, 0.9), mean: v.reduce((a, b) => a + b, 0) / v.length };
}

function distribution(tolerance: Partial<CutQualityTolerance>, weights: CutQualityWeights, stage: number) {
  const out: Record<string, unknown> = {};
  for (const id of ["ideal", "normal", "sloppy", "rough"] as const) {
    const { samples, unconfirmable } = sample(OPERATOR_PROFILES[id], stage, tolerance, weights);
    out[id] = {
      n: samples.length,
      unconfirmableRate: unconfirmable / TRIALS,
      overall: summarize(samples, (s) => s.overall),
      cutScore: summarize(samples, (s) => s.cutScore),
      centerAccuracy: summarize(samples, (s) => s.centerAccuracy),
      sliceUniformity: summarize(samples, (s) => s.sliceUniformity),
      sliceCountFit: summarize(samples, (s) => s.sliceCountFit),
      sliverRate: samples.filter((s) => s.sliver).length / samples.length,
      sevenPieceRateUnfiltered: 0,
    };
  }
  return out as Record<"ideal" | "normal" | "sloppy" | "rough", {
    n: number; unconfirmableRate: number; overall: ReturnType<typeof summarize>; cutScore: ReturnType<typeof summarize>;
    centerAccuracy: ReturnType<typeof summarize>; sliceUniformity: ReturnType<typeof summarize>; sliceCountFit: ReturnType<typeof summarize>; sliverRate: number;
  }>;
}

describe("CUT-S2 shadow distribution (default tolerances, both stage sizes)", () => {
  for (const [name, stage] of Object.entries(STAGES)) {
    const d = distribution({}, PROVISIONAL_CUT_QUALITY_WEIGHTS, stage);

    it(`${name}: an ideal cut is ~1 and a natural fingertip cut is not unfairly low`, () => {
      expect(d.ideal.overall.p10).toBeGreaterThanOrEqual(0.98);
      expect(d.normal.overall.p10).toBeGreaterThanOrEqual(0.9);
      expect(d.normal.overall.median).toBeGreaterThanOrEqual(0.97);
    });

    it(`${name}: the ordering ideal >= normal > sloppy > rough holds with clear gaps`, () => {
      expect(d.ideal.overall.median).toBeGreaterThanOrEqual(d.normal.overall.median);
      expect(d.normal.overall.median - d.sloppy.overall.median).toBeGreaterThan(0.08);
      expect(d.sloppy.overall.median - d.rough.overall.median).toBeGreaterThan(0.1);
    });

    it(`${name}: CutQuality is fairer than the existing cutScore for natural cuts`, () => {
      expect(d.normal.overall.median * 100).toBeGreaterThan(d.normal.cutScore.median);
    });
  }

  // Evidence generator, not a regression test: opt in with CUT_S2_WRITE=1 (takes minutes).
  it.skipIf(process.env.CUT_S2_WRITE !== "1")("records the distribution and the tolerance sweep", () => {
    const grid: unknown[] = [];
    for (const cFull of [2, 4, 6]) for (const cZero of [15, 20, 30])
      for (const uFull of [0.05, 0.1, 0.15]) for (const uZero of [0.4, 0.6, 0.8])
        for (const sliver of [0.1, 0.2, 0.3]) {
          const tol = { centerFullCreditDistance: cFull, centerZeroCreditDistance: cZero, uniformityFullCreditDeviation: uFull, uniformityZeroCreditDeviation: uZero, sliverAreaFraction: sliver };
          const perStage: Record<string, unknown> = {};
          for (const [name, stage] of Object.entries(STAGES)) {
            const dist = distribution(tol, PROVISIONAL_CUT_QUALITY_WEIGHTS, stage);
            perStage[name] = Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, { p10: v.overall.p10, median: v.overall.median, p90: v.overall.p90 }]));
          }
          grid.push({ tol, perStage });
        }
    const defaults: Record<string, unknown> = {};
    for (const [name, stage] of Object.entries(STAGES)) defaults[name] = distribution({}, PROVISIONAL_CUT_QUALITY_WEIGHTS, stage);
    mkdirSync("docs/reports/data/cut-s2", { recursive: true });
    writeFileSync("docs/reports/data/cut-s2/distribution-and-sweep.json", JSON.stringify({ trials: TRIALS, stages: STAGES, defaultTolerance: DEFAULT_CUT_QUALITY_TOLERANCE, defaults, grid }, null, 1) + "\n");
  }, 3_600_000);
});

describe("CUT-S2 weights and operator-noise sensitivity (evidence for the recommendation)", () => {
  const RECOMMENDED: Partial<CutQualityTolerance> = { uniformityZeroCreditDeviation: 0.4 };
  const WEIGHT_SETS: Record<string, CutQualityWeights> = {
    "provisional (.15/.15/.30/.40)": PROVISIONAL_CUT_QUALITY_WEIGHTS,
    "uniformity-led (.10/.10/.20/.60)": { lineValidity: 0.1, sliceCountFit: 0.1, centerAccuracy: 0.2, sliceUniformity: 0.6 },
    "equal (.25 each)": { lineValidity: 0.25, sliceCountFit: 0.25, centerAccuracy: 0.25, sliceUniformity: 0.25 },
  };
  it.skipIf(process.env.CUT_S2_WRITE !== "1")("records weight sets and operator-noise sensitivity", () => {
    const weights: Record<string, unknown> = {};
    for (const [name, w] of Object.entries(WEIGHT_SETS)) {
      weights[name] = {};
      for (const [stageName, stage] of Object.entries(STAGES)) {
        const dist = distribution(RECOMMENDED, w, stage);
        (weights[name] as Record<string, unknown>)[stageName] = Object.fromEntries(
          Object.entries(dist).map(([k, v]) => [k, { p10: v.overall.p10, median: v.overall.median, p90: v.overall.p90 }]),
        );
      }
    }
    const sensitivity: Record<string, unknown> = {};
    for (const sigma of [4, 6, 8, 10]) {
      const profile: OperatorProfile = { id: "normal", aimSigmaPx: sigma, angleSigmaDeg: sigma * (4 / 6), centerShiftSigmaPx: sigma / 2 };
      const row: Record<string, unknown> = {};
      for (const [label, tol] of [["default", {}], ["recommended", RECOMMENDED]] as const) {
        const { samples } = sample(profile, STAGES["360x800"], tol, PROVISIONAL_CUT_QUALITY_WEIGHTS);
        row[label] = summarize(samples, (x) => x.overall);
      }
      sensitivity[`aimSigmaPx=${sigma}`] = row;
    }
    mkdirSync("docs/reports/data/cut-s2", { recursive: true });
    writeFileSync("docs/reports/data/cut-s2/weights-and-sensitivity.json", JSON.stringify({ recommendedTolerance: RECOMMENDED, weights, sensitivity360x800: sensitivity }, null, 1) + "\n");
  }, 600_000);
});

describe("CUT-S2 edge-case table (case D) -- recorded, with invariants", () => {
  const ideal = createIdealSliceFixtureLines(6);
  function chordAt(angle: number, offset = 0): CutLine {
    const a = (angle * Math.PI) / 180;
    const half = Math.sqrt(DOUGH_RADIUS ** 2 - offset ** 2);
    const nx = -Math.sin(a) * offset;
    const ny = Math.cos(a) * offset;
    return {
      start: { x: DOUGH_CENTER + nx - Math.cos(a) * half, y: DOUGH_CENTER + ny - Math.sin(a) * half },
      end: { x: DOUGH_CENTER + nx + Math.cos(a) * half, y: DOUGH_CENTER + ny + Math.sin(a) * half },
    };
  }
  const cases: Record<string, CutLine[]> = {
    "A ideal": [...ideal],
    "B finger-width wobble": [chordAt(0, 2), chordAt(63, -2), chordAt(117, 1.5)],
    "B off-centre ~4% + uneven angles": [chordAt(0, 4), chordAt(68, -4), chordAt(124, 3)],
    "C clear centre miss": [chordAt(0, 18), chordAt(60, -18), chordAt(120, 18)],
    "C parallel cuts": [chordAt(0, 20), chordAt(2, 0), chordAt(178, -20)],
    "D small central sliver (3 cuts ~3% off a common point)": [chordAt(0, 3), chordAt(60, 3), chordAt(120, 3)],
    "D near duplicate (2nd cut 5 deg from 1st)": [chordAt(0), chordAt(5), chordAt(90)],
    "D extra line (4th good cut)": [...ideal, chordAt(30)],
    "D degenerate line": [...ideal.slice(0, 2), { start: { x: 50, y: 50 }, end: { x: 50, y: 50 } }],
    "D NaN line": [...ideal.slice(0, 2), { start: { x: NaN, y: 0 }, end: { x: 1, y: 1 } }],
  };

  it("every case is finite and bounded; the recorded rows are written when CUT_S2_WRITE=1", () => {
    const rows = Object.entries(cases).map(([name, lines]) => {
      const q = evaluateCutQuality(lines, SIX);
      const c = evaluateCut(lines, SIX);
      for (const v of [q.lineValidity, q.sliceCountFit, q.centerAccuracy, q.sliceUniformity, q.overall]) {
        expect(Number.isFinite(v) && v >= 0 && v <= 1).toBe(true);
      }
      return { name, cutScore: c.cutScore, completeness: c.completeness, quality: { lineValidity: q.lineValidity, sliceCountFit: q.sliceCountFit, centerAccuracy: q.centerAccuracy, sliceUniformity: q.sliceUniformity, overall: q.overall, pieceAreas: q.pieceAreas, sliverCount: q.sliverCount, actualPieceCount: q.actualPieceCount } };
    });
    if (process.env.CUT_S2_WRITE === "1") {
      mkdirSync("docs/reports/data/cut-s2", { recursive: true });
      writeFileSync("docs/reports/data/cut-s2/edge-cases.json", JSON.stringify(rows, null, 1) + "\n");
    }
  });

  it("the small central sliver is not penalised as a 7th slice (the existing cutScore does)", () => {
    const lines = cases["D small central sliver (3 cuts ~3% off a common point)"];
    expect(evaluateCutQuality(lines, SIX).sliceCountFit).toBe(1);
    expect(evaluateCut(lines, SIX).countCorrectness).toBeLessThan(1);
  });

  it("completeness is a constant 1 at confirm in cutScore, and absent from CutQuality", () => {
    for (const lines of [cases["A ideal"], cases["C clear centre miss"], cases["C parallel cuts"]]) {
      expect(evaluateCut(lines, SIX).completeness).toBe(1);
    }
  });
});

describe("CUT-S2 Owner Decision (HV PASS): the adopted provisional values", () => {
  it("keeps uniformity zero-side 0.6 (0.4 rejected), centre 4/20, sliver 0.2 and the provisional weights", () => {
    expect(DEFAULT_CUT_QUALITY_TOLERANCE.uniformityZeroCreditDeviation).toBe(0.6);
    expect(DEFAULT_CUT_QUALITY_TOLERANCE.uniformityFullCreditDeviation).toBe(0.1);
    expect(DEFAULT_CUT_QUALITY_TOLERANCE.centerFullCreditDistance).toBe(4);
    expect(DEFAULT_CUT_QUALITY_TOLERANCE.centerZeroCreditDistance).toBe(20);
    expect(DEFAULT_CUT_QUALITY_TOLERANCE.sliverAreaFraction).toBe(0.2);
    expect(PROVISIONAL_CUT_QUALITY_WEIGHTS).toEqual({ lineValidity: 0.15, sliceCountFit: 0.15, centerAccuracy: 0.3, sliceUniformity: 0.4 });
  });

  it("a well-formed cut earns full marks however it was drawn: only the finished geometry is scored", () => {
    const ideal = createIdealSliceFixtureLines(6);
    // The same three chords, each drawn from the opposite end: the pointer path differs, the geometry does not.
    const reversed = ideal.map((l) => ({ start: l.end, end: l.start }));
    expect(evaluateCutQuality(reversed, SIX)).toEqual(evaluateCutQuality(ideal, SIX));
    expect(evaluateCutQuality(ideal, SIX).overall).toBe(1);
  });
});
