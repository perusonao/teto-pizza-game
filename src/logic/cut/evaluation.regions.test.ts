import { describe, expect, it } from "vitest";
import { createIdealDoughShape } from "../doughShape";
import {
  createCentralTriangleFixture,
  createDiameterCutLine,
  createIdealSliceFixtureLines,
  createOffsetCutLine,
  createStoppedCutLine,
} from "./fixtures";
import { evaluateCut } from "./evaluation";
import { computePieceAreas, CIRCLE_AREA } from "./geometry";

const cfg = { requestedSliceCount: 6 } as const;

describe("evaluateCut -- significant regions (#427)", () => {
  it("a tiny central triangle (d=1) is 6 pieces: it does not count", () => {
    const lines = createCentralTriangleFixture(1);
    expect(computePieceAreas(lines)).toHaveLength(7); // geometry still returns every region
    const e = evaluateCut(lines, cfg);
    expect(e.actualPieceCount).toBe(6);
    expect(e.pieceAreas).toHaveLength(6);
  });

  it("a clear triangle (d=6) is 7 pieces", () => {
    expect(evaluateCut(createCentralTriangleFixture(6), cfg).actualPieceCount).toBe(7);
  });

  it("computePieceAreas keeps the sum ~ CIRCLE_AREA even with slivers", () => {
    const sum = computePieceAreas(createCentralTriangleFixture(1)).reduce((s, a) => s + a, 0);
    expect(Math.abs(sum - CIRCLE_AREA)).toBeLessThan(0.1);
  });

  it("is invariant to line order", () => {
    const lines = createCentralTriangleFixture(6, 11);
    const a = evaluateCut(lines, cfg);
    const b = evaluateCut([...lines].reverse(), cfg);
    expect(b.actualPieceCount).toBe(a.actualPieceCount);
    expect(b.cutScore).toBeCloseTo(a.cutScore, 6);
  });

  it("the ideal 6-way split is unchanged: 6 pieces, ~100", () => {
    const e = evaluateCut(createIdealSliceFixtureLines(6), cfg);
    expect(e.actualPieceCount).toBe(6);
    expect(e.cutScore).toBeGreaterThan(99.9);
  });
});

describe("evaluateCut -- stopped strokes are grooves, not splits (#427 / #418)", () => {
  it.each([5.5, 6])("k=%s from the rim still reaches the edge: counts as a split", (k) => {
    expect(evaluateCut([createStoppedCutLine(0, k)], cfg).actualPieceCount).toBe(2);
  });

  it.each([6.5, 8, 20])("k=%s from the rim is a groove: no split", (k) => {
    const e = evaluateCut([createStoppedCutLine(0, k)], cfg);
    expect(e.actualPieceCount).toBe(1);
    expect(e.completedCutCount).toBe(1); // every committed line still counts here
    expect(e.completeness).toBe(0); // ...but not toward completeness
  });

  it("three grooves toward the centre: 1 piece, ~3.3 (was 6 pieces / 100)", () => {
    const grooves = [0, 60, 120].map((a) => createStoppedCutLine(a, 20));
    const e = evaluateCut(grooves, cfg);
    expect(e.actualPieceCount).toBe(1);
    expect(e.completedCutCount).toBe(3);
    expect(e.completeness).toBe(0);
    expect(e.centerAccuracy).toBe(0);
    expect(e.cutScore).toBeCloseTo(3.3, 1);
  });

  it("two through cuts + a groove score the same as two through cuts (no padding)", () => {
    const two = [createDiameterCutLine(0), createDiameterCutLine(90)];
    const padded = [...two, createStoppedCutLine(45, 20)];
    expect(evaluateCut(padded, cfg).cutScore).toBeCloseTo(evaluateCut(two, cfg).cutScore, 6);
    expect(evaluateCut(two, cfg).cutScore).toBeCloseTo(61.7, 1);
    expect(evaluateCut(padded, cfg).completedCutCount).toBe(3);
  });

  it("two off-centre through cuts + grooves: the grooves do not dilute centerAccuracy", () => {
    const base = createCentralTriangleFixture(20);
    const grooves = [createStoppedCutLine(10, 20), createStoppedCutLine(70, 20)];
    expect(evaluateCut([...base, ...grooves], cfg).cutScore).toBeCloseTo(evaluateCut(base, cfg).cutScore, 6);
  });

  it("duplicate through lines still pad completeness (known, tracked in #288)", () => {
    const two = [createDiameterCutLine(0), createDiameterCutLine(90)];
    const dup = [...two, createDiameterCutLine(90)];
    expect(evaluateCut(dup, cfg).completeness).toBe(1);
  });
});

describe("evaluateCut -- shape is used for the through test, same as the renderer", () => {
  it("a line ending inside a shrunken dough counts as through when given that shape", () => {
    const shrunk = { radii: new Array(createIdealDoughShape().radii.length).fill(30) };
    const line = createStoppedCutLine(0, 14); // 14 from the ideal rim = 34 from the centre
    expect(evaluateCut([line], cfg).actualPieceCount).toBe(1); // ideal circle: 14 > crust width
    expect(evaluateCut([line], cfg, shrunk).actualPieceCount).toBe(2);
  });
});

describe("evaluateCut -- sweep of the third line", () => {
  it("steps from 6 to 7 between d=3.5 and d=3.75 and never goes back", () => {
    let prev = 0;
    for (let d = 0; d <= 8; d += 0.25) {
      const n = evaluateCut(createCentralTriangleFixture(d), cfg).actualPieceCount;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
      if (d <= 3.5) expect(n).toBe(6);
      if (d >= 3.75) expect(n).toBe(7);
    }
  });

  it("parallel lines with a 0.25 gap: the band is not a piece", () => {
    const e = evaluateCut([createOffsetCutLine(0, -0.125), createOffsetCutLine(0, 0.125)], { requestedSliceCount: 4 });
    expect(e.actualPieceCount).toBe(2);
  });
});
