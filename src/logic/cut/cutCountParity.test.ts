import { describe, expect, it } from "vitest";
import { createIdealDoughShape, type DoughShape } from "../doughShape";
import {
  createCentralTriangleFixture,
  createDiameterCutLine,
  createIdealSliceFixtureLines,
  createOffsetCutLine,
  createStoppedCutLine,
} from "./fixtures";
import { isThroughCut } from "./cutVisual";
import { evaluateCut } from "./evaluation";
import { computePieceLayout } from "./pieces";
import { computeRegions, significantRegions } from "./regions";
import type { CutLine } from "./types";

const n = createIdealDoughShape().radii.length;
const shapes: Record<string, DoughShape> = {
  ideal: createIdealDoughShape(),
  shrunk: { radii: new Array(n).fill(30) },
  ellipse: { radii: Array.from({ length: n }, (_, i) => 30 + 15 * Math.abs(Math.cos((i / n) * Math.PI * 2))) },
  lopsided: { radii: Array.from({ length: n }, (_, i) => 28 + 18 * ((Math.cos((i / n) * Math.PI * 2) + 1) / 2)) },
  oversize: { radii: new Array(n).fill(55) },
};

const fixtures: Record<string, readonly CutLine[]> = {
  none: [],
  one: [createDiameterCutLine(20)],
  six: createIdealSliceFixtureLines(6),
  eight: createIdealSliceFixtureLines(8),
  tinyTriangle: createCentralTriangleFixture(1),
  edgeTriangle: createCentralTriangleFixture(3.5),
  clearTriangle: createCentralTriangleFixture(6, 17),
  parallelNarrow: [createOffsetCutLine(0, -0.2), createOffsetCutLine(0, 0.2)],
  parallelWide: [createOffsetCutLine(0, -1), createOffsetCutLine(0, 1)],
  parallel3: [createOffsetCutLine(30, -1), createOffsetCutLine(30, 0), createOffsetCutLine(30, 1)],
  shallow: [createOffsetCutLine(0, 0), createOffsetCutLine(1.15, 0)],
  rimSliver: [createOffsetCutLine(0, 47.3)],
  groovesAndThrough: [createDiameterCutLine(0), createStoppedCutLine(60, 20), createDiameterCutLine(90)],
  lopsided: [createOffsetCutLine(15, 12), createOffsetCutLine(75, -9), createOffsetCutLine(140, 4)],
};

describe("evaluation and rendering use the same cuts and regions", () => {
  for (const [shapeName, shape] of Object.entries(shapes)) {
    for (const [name, lines] of Object.entries(fixtures)) {
      it(`${name} / ${shapeName}`, () => {
        const through = lines.filter((l) => isThroughCut(l, shape));
        const evaluation = evaluateCut(lines, { requestedSliceCount: 6 }, shape);
        const layout = computePieceLayout(lines, shape);

        // Same through set: the renderer splits along exactly the cuts the evaluation used.
        expect(layout?.cuts.length ?? 0).toBe(through.length);

        // Geometric regions drawn == regions computed; counted pieces = significant ones.
        const regions = computeRegions(through);
        const drawn = layout?.pieces.length ?? 1;
        expect(drawn).toBe(regions.length);
        const significant = significantRegions(regions).length;
        expect(evaluation.actualPieceCount).toBe(significant);
        expect(evaluation.pieceAreas).toHaveLength(significant);
        // Drawn minus counted = regions too small to be a piece (and equal when there are none).
        expect(drawn - evaluation.actualPieceCount).toBe(regions.length - significant);
        expect(evaluation.completedCutCount).toBe(lines.length);
      });
    }
  }
});
