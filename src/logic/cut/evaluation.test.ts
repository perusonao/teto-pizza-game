import { describe, expect, it } from "vitest";
import { createDiameterCutLine, createIdealSliceFixtureLines } from "./fixtures";
import { CUT_SCORE_WEIGHTS, evaluateCut, requiredCutCount } from "./evaluation";
import type { CutLine } from "./types";

function expectAllFinite(evaluation: ReturnType<typeof evaluateCut>): void {
  for (const value of [
    evaluation.countCorrectness,
    evaluation.completeness,
    evaluation.centerAccuracy,
    evaluation.uniformity,
    evaluation.cutScore,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(Number.isNaN(value)).toBe(false);
  }
}

describe("requiredCutCount", () => {
  it("derives 2/3/4 committed lines for 4/6/8 requested slices", () => {
    expect(requiredCutCount(4)).toBe(2);
    expect(requiredCutCount(6)).toBe(3);
    expect(requiredCutCount(8)).toBe(4);
  });
});

describe("evaluateCut -- weights sum to 1 (design doc §6 Option B)", () => {
  it("sums to exactly 1", () => {
    const sum =
      CUT_SCORE_WEIGHTS.countCorrectness +
      CUT_SCORE_WEIGHTS.completeness +
      CUT_SCORE_WEIGHTS.centerAccuracy +
      CUT_SCORE_WEIGHTS.uniformity;
    expect(sum).toBeCloseTo(1);
  });

  it("weights uniformity as primary (50)", () => {
    expect(CUT_SCORE_WEIGHTS.uniformity).toBe(0.5);
  });
});

describe("evaluateCut -- ideal 6-slice fixture", () => {
  const lines = createIdealSliceFixtureLines(6);
  const evaluation = evaluateCut(lines, { requestedSliceCount: 6 });

  it("scores near-perfect on every signal", () => {
    expect(evaluation.actualPieceCount).toBe(6);
    expect(evaluation.completedCutCount).toBe(3);
    expect(evaluation.countCorrectness).toBe(1);
    expect(evaluation.completeness).toBe(1);
    expect(evaluation.centerAccuracy).toBeGreaterThan(0.99);
    expect(evaluation.uniformity).toBeGreaterThan(0.95);
    expect(evaluation.cutScore).toBeGreaterThan(95);
  });

  it("stays free of NaN/Infinity", () => {
    expectAllFinite(evaluation);
  });
});

describe("evaluateCut -- determinism", () => {
  it("returns identical results for identical input across repeated calls", () => {
    const lines = createIdealSliceFixtureLines(6);
    const first = evaluateCut(lines, { requestedSliceCount: 6 });
    const second = evaluateCut(lines, { requestedSliceCount: 6 });
    expect(second).toEqual(first);
  });
});

describe("evaluateCut -- line order independence", () => {
  it("produces the same evaluation signals regardless of committed-line order", () => {
    const lines = createIdealSliceFixtureLines(6);
    const reordered = [lines[2], lines[0], lines[1]];
    const original = evaluateCut(lines, { requestedSliceCount: 6 });
    const shuffled = evaluateCut(reordered, { requestedSliceCount: 6 });

    expect(shuffled.actualPieceCount).toBe(original.actualPieceCount);
    expect(shuffled.completedCutCount).toBe(original.completedCutCount);
    expect(shuffled.countCorrectness).toBeCloseTo(original.countCorrectness);
    expect(shuffled.completeness).toBeCloseTo(original.completeness);
    expect(shuffled.centerAccuracy).toBeCloseTo(original.centerAccuracy);
    expect(shuffled.uniformity).toBeCloseTo(original.uniformity);
    expect(shuffled.cutScore).toBeCloseTo(original.cutScore);
  });
});

describe("evaluateCut -- missing one ideal line lowers count correctness", () => {
  it("2 of 3 required diameters scores lower countCorrectness than the full 3", () => {
    const full = createIdealSliceFixtureLines(6);
    const missingOne = full.slice(0, 2);

    const fullEval = evaluateCut(full, { requestedSliceCount: 6 });
    const partialEval = evaluateCut(missingOne, { requestedSliceCount: 6 });

    expect(partialEval.countCorrectness).toBeLessThan(fullEval.countCorrectness);
    expect(fullEval.countCorrectness).toBe(1);
  });
});

describe("evaluateCut -- offset cut lowers center accuracy", () => {
  it("a chord clearly offset from center scores lower centerAccuracy than an ideal center line", () => {
    const centerLine = createDiameterCutLine(0);
    const halfWidth = Math.sqrt(48 * 48 - 30 * 30);
    const offsetLine: CutLine = {
      start: { x: 50 - halfWidth, y: 50 + 30 },
      end: { x: 50 + halfWidth, y: 50 + 30 },
    };

    const centerEval = evaluateCut([centerLine], { requestedSliceCount: 6 });
    const offsetEval = evaluateCut([offsetLine], { requestedSliceCount: 6 });

    expect(offsetEval.centerAccuracy).toBeLessThan(centerEval.centerAccuracy);
    expect(centerEval.centerAccuracy).toBeGreaterThan(0.99);
  });
});

describe("evaluateCut -- short/incomplete cut lowers completeness", () => {
  it("fewer committed lines than requiredCutCount scores lower completeness", () => {
    const oneLine = [createDiameterCutLine(0)];
    const fullThree = createIdealSliceFixtureLines(6);

    const partial = evaluateCut(oneLine, { requestedSliceCount: 6 });
    const full = evaluateCut(fullThree, { requestedSliceCount: 6 });

    expect(partial.completeness).toBeLessThan(full.completeness);
    expect(partial.completeness).toBeCloseTo(1 / 3);
    expect(full.completeness).toBe(1);
  });
});

describe("evaluateCut -- uneven cuts lower uniformity", () => {
  it("3 lines clustered tightly together score lower uniformity than the evenly-spaced ideal", () => {
    const ideal = createIdealSliceFixtureLines(6);
    const clustered = [createDiameterCutLine(0), createDiameterCutLine(5), createDiameterCutLine(10)];

    const idealEval = evaluateCut(ideal, { requestedSliceCount: 6 });
    const unevenEval = evaluateCut(clustered, { requestedSliceCount: 6 });

    expect(unevenEval.uniformity).toBeLessThan(idealEval.uniformity);
    expect(idealEval.uniformity).toBeGreaterThan(0.95);
  });
});

describe("evaluateCut -- no cuts", () => {
  it("returns a safe, fully-finite worst-case result with no NaN/Infinity", () => {
    const evaluation = evaluateCut([], { requestedSliceCount: 6 });
    expectAllFinite(evaluation);
    expect(evaluation.completedCutCount).toBe(0);
    expect(evaluation.actualPieceCount).toBe(1);
    expect(evaluation.completeness).toBe(0);
    expect(evaluation.centerAccuracy).toBe(0);
    expect(evaluation.uniformity).toBe(0);
    expect(evaluation.cutScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.cutScore).toBeLessThanOrEqual(100);
  });

  it("also stays finite with no config passed at all (defaults to 6)", () => {
    const evaluation = evaluateCut([]);
    expect(evaluation.requestedSliceCount).toBe(6);
    expectAllFinite(evaluation);
  });
});

describe("evaluateCut -- duplicate/near-duplicate lines never crash", () => {
  it("an exact duplicate line produces a defined, finite evaluation", () => {
    const line = createDiameterCutLine(0);
    const evaluation = evaluateCut([line, line], { requestedSliceCount: 6 });
    expectAllFinite(evaluation);
    expect(evaluation.actualPieceCount).toBe(2);
  });

  it("a near-duplicate angle line produces a defined, finite evaluation", () => {
    const evaluation = evaluateCut([createDiameterCutLine(0), createDiameterCutLine(1)], {
      requestedSliceCount: 6,
    });
    expectAllFinite(evaluation);
  });
});

describe("evaluateCut -- 4/8 future configs work without any 6-hard-coded breakage", () => {
  it("evaluates a perfect 4-slice fixture correctly", () => {
    const evaluation = evaluateCut(createIdealSliceFixtureLines(4), { requestedSliceCount: 4 });
    expect(evaluation.actualPieceCount).toBe(4);
    expect(evaluation.completedCutCount).toBe(2);
    expect(evaluation.countCorrectness).toBe(1);
    expect(evaluation.completeness).toBe(1);
    expectAllFinite(evaluation);
  });

  it("evaluates a perfect 8-slice fixture correctly", () => {
    const evaluation = evaluateCut(createIdealSliceFixtureLines(8), { requestedSliceCount: 8 });
    expect(evaluation.actualPieceCount).toBe(8);
    expect(evaluation.completedCutCount).toBe(4);
    expect(evaluation.countCorrectness).toBe(1);
    expect(evaluation.completeness).toBe(1);
    expectAllFinite(evaluation);
  });
});

describe("evaluateCut -- boundary case: chord tangent to the rim", () => {
  it("centerAccuracy clamps to 0 rather than going negative or NaN for a tangent-like chord", () => {
    const tangentLike: CutLine = {
      start: { x: 50 + 48 - 0.001, y: 50 },
      end: { x: 50 + 48, y: 50 + 0.02 },
    };
    const evaluation = evaluateCut([tangentLike], { requestedSliceCount: 6 });
    expectAllFinite(evaluation);
    expect(evaluation.centerAccuracy).toBeGreaterThanOrEqual(0);
  });
});
