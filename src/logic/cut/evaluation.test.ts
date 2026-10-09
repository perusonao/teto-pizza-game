import { describe, expect, it } from "vitest";
import { createChordCutLine, createDiameterCutLine, createGrooveCutLine, createIdealSliceFixtureLines } from "./fixtures";
import { CUT_SCORE_WEIGHTS, evaluateCut, requiredCutCount } from "./evaluation";
import { createIdealDoughShape } from "../doughShape";
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

// ---------------------------------------------------------------------------------------------
// #427 / #426: exact regions, significant pieces only, through cuts only
// ---------------------------------------------------------------------------------------------
describe("evaluateCut -- the centre triangle of three nearly concurrent cuts (#427)", () => {
  const triangle = (d: number): CutLine[] => [createChordCutLine(0), createChordCutLine(60), createChordCutLine(120, d)];

  it("a tiny triangle (d=1) is no 7th slice: still 6 pieces, and pieceAreas agrees", () => {
    const evaluation = evaluateCut(triangle(1));
    expect(evaluation.actualPieceCount).toBe(6);
    expect(evaluation.pieceAreas).toHaveLength(6);
    expect(evaluation.countCorrectness).toBe(1);
    expect(evaluation.cutScore).toBeGreaterThan(98);
  });

  it("a clear triangle (d=6) is a 7th piece -- RESULT may say 7等分 (目標 6等分)", () => {
    const evaluation = evaluateCut(triangle(6));
    expect(evaluation.actualPieceCount).toBe(7);
    expect(evaluation.pieceAreas).toHaveLength(7);
    expect(evaluation.requestedSliceCount).toBe(6);
    expect(evaluation.countCorrectness).toBeCloseTo(1 - 1 / 6, 10);
  });

  it("the boundary is the same on both sides for every rotation: 3.5 -> 6, 3.75 -> 7", () => {
    for (const angle of [0, 10, 20, 30, 45]) {
      const at = (d: number) =>
        evaluateCut([createChordCutLine(angle), createChordCutLine(angle + 60), createChordCutLine(angle + 120, d)]);
      expect(at(3.5).actualPieceCount).toBe(6);
      expect(at(3.75).actualPieceCount).toBe(7);
    }
  });

  it("the score no longer steps at d~0.7 (it jumped ~10 points with the sampling grid): smooth from 0 to 3.5", () => {
    let previous = evaluateCut(triangle(0)).cutScore;
    for (let d = 0.05; d <= 3.5; d += 0.05) {
      const score = evaluateCut(triangle(d)).cutScore;
      expect(Math.abs(score - previous), `step at d=${d.toFixed(2)}`).toBeLessThan(0.3);
      previous = score;
    }
  });

  it("a perfectly concentric 6-slice is 100 within the polygon's own rounding", () => {
    const evaluation = evaluateCut([...createIdealSliceFixtureLines(6)]);
    expect(evaluation.actualPieceCount).toBe(6);
    expect(evaluation.cutScore).toBeCloseTo(100, 2);
  });
});

describe("evaluateCut -- a requested slice count of 4 / 8 uses the same significance (the predicate has no slice input)", () => {
  it("4 and 8 slices: tiny extra region ignored, the ideal fixture exact", () => {
    expect(evaluateCut([...createIdealSliceFixtureLines(4)], { requestedSliceCount: 4 }).actualPieceCount).toBe(4);
    expect(evaluateCut([...createIdealSliceFixtureLines(8)], { requestedSliceCount: 8 }).actualPieceCount).toBe(8);
    const nearlyConcurrent4 = [createChordCutLine(0), createChordCutLine(45), createChordCutLine(90), createChordCutLine(135, 1)];
    expect(evaluateCut(nearlyConcurrent4, { requestedSliceCount: 8 }).actualPieceCount).toBe(8);
  });
});

describe("evaluateCut -- two near-parallel cuts (#426): the strip counts only when it is wide enough", () => {
  it("a 0.45 u gap: 2 pieces; a 0.55 u gap: 3", () => {
    expect(evaluateCut([createChordCutLine(0), createChordCutLine(0, 0.45)]).actualPieceCount).toBe(2);
    expect(evaluateCut([createChordCutLine(0), createChordCutLine(0, 0.55)]).actualPieceCount).toBe(3);
  });
});

describe("evaluateCut -- through cuts only split the pizza and fill completeness / centre (Decision 5 = Y)", () => {
  const grooves = [createGrooveCutLine(0, 20), createGrooveCutLine(60, 20), createGrooveCutLine(120, 20)];

  it("three grooves toward the centre cut nothing: 1 piece, completeness 0, centre 0, score 3.3 (was 100)", () => {
    const evaluation = evaluateCut(grooves);
    expect(evaluation.actualPieceCount).toBe(1);
    expect(evaluation.completeness).toBe(0);
    expect(evaluation.centerAccuracy).toBe(0);
    expect(evaluation.uniformity).toBe(0);
    expect(evaluation.cutScore).toBeCloseTo(3.33, 1);
    expect(evaluation.completedCutCount).toBe(3); // the display still counts every committed line
  });

  it("two through cuts: 61.7; adding a groove adds NOTHING (it used to inflate completeness to 68.3)", () => {
    const two = [createDiameterCutLine(0), createDiameterCutLine(60)];
    const base = evaluateCut(two);
    expect(base.cutScore).toBeCloseTo(61.7, 1);
    const withGroove = evaluateCut([...two, grooves[2]]);
    expect(withGroove.cutScore).toBeCloseTo(base.cutScore, 6);
    expect(withGroove.completeness).toBeCloseTo(base.completeness, 10);
    expect(withGroove.completedCutCount).toBe(3);
    expect(base.completedCutCount).toBe(2);
  });

  it("grooves do not dilute the centre error either (3 off-centre through cuts with and without 2 grooves)", () => {
    const through = [createChordCutLine(0, 20), createChordCutLine(60, 0), createChordCutLine(120, 0)];
    const plain = evaluateCut(through);
    const withGrooves = evaluateCut([...through, grooves[0], grooves[1]]);
    expect(withGrooves.centerAccuracy).toBeCloseTo(plain.centerAccuracy, 10);
    expect(withGrooves.cutScore).toBeCloseTo(plain.cutScore, 6);
  });

  it("a groove among real cuts never becomes a region", () => {
    const lines = [createDiameterCutLine(0), grooves[1], createDiameterCutLine(90)];
    expect(evaluateCut(lines).actualPieceCount).toBe(4);
  });

  it.each([
    [5.5, true],
    [6, true],
    [6.5, false],
    [8, false],
  ])("a third stroke stopping %s u short of the rim: through = %s (the crust width is 6)", (k, through) => {
    const lines = [createDiameterCutLine(0), createDiameterCutLine(90), createGrooveCutLine(45, k)];
    // A through 3rd cut makes 6 regions; a groove leaves 4.
    expect(evaluateCut(lines).actualPieceCount).toBe(through ? 6 : 4);
  });
});

describe("evaluateCut -- known remaining overcount: a duplicated through cut (tracked in #288, not changed here)", () => {
  it("the same through cut laid over again still counts for completeness (68.3 vs 61.7)", () => {
    const two = [createDiameterCutLine(0), createDiameterCutLine(60)];
    const doubled = evaluateCut([...two, createDiameterCutLine(60)]);
    expect(doubled.actualPieceCount).toBe(4);
    expect(doubled.completeness).toBe(1);
    expect(doubled.cutScore).toBeCloseTo(68.3, 1);
  });
});

describe("evaluateCut -- order independence and the dough silhouette (through test only)", () => {
  it("reordering the lines changes nothing", () => {
    const lines = [createChordCutLine(10, 4), createChordCutLine(70, -3), createChordCutLine(130, 8), createGrooveCutLine(40, 15)];
    const a = evaluateCut(lines);
    const b = evaluateCut([...lines].reverse());
    expect(b.actualPieceCount).toBe(a.actualPieceCount);
    expect(b.cutScore).toBeCloseTo(a.cutScore, 6);
  });

  it("an ideal-circle silhouette gives the same answer as none; a shrunken one only changes which strokes reached the edge", () => {
    const lines = [createDiameterCutLine(0), createDiameterCutLine(60), createGrooveCutLine(120, 14)];
    expect(evaluateCut(lines, undefined, createIdealDoughShape()).cutScore).toBeCloseTo(evaluateCut(lines).cutScore, 10);
    // On a dough shrunk to radius 36, a stroke ending 14 u inside the IDEAL rim (34 from the centre) reached its edge.
    const shrunk = { radii: new Array(8).fill(36) };
    expect(evaluateCut(lines, undefined, shrunk).actualPieceCount).toBe(6);
    expect(evaluateCut(lines).actualPieceCount).toBe(4);
  });
});
