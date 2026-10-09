import { describe, expect, it } from "vitest";
import type { DoughShape } from "../doughShape";
import { createIdealDoughShape } from "../doughShape";
import { buildCutVisual, isThroughCut } from "./cutVisual";
import { evaluateCut } from "./evaluation";
import { createChordCutLine, createDiameterCutLine, createGrooveCutLine } from "./fixtures";
import { computePieceLayout } from "./pieces";
import { computeCutRegions, isSignificantRegion } from "./regions";
import type { CutLine } from "./types";

/**
 * #427: the CUT evaluation and the piece drawing must use the same through-cut set and the same regions. Fixed arrangements
 * (a seeded generator, no Math.random) across every dough silhouette the player can end up with.
 */
const SHAPES: Record<string, DoughShape> = {
  ideal: createIdealDoughShape(),
  shrunk12: { radii: new Array(8).fill(12) },
  shrunk20: { radii: new Array(8).fill(20) },
  ellipse: { radii: [55, 40, 22, 40, 55, 40, 22, 40] },
  biased: { radii: [58, 50, 30, 14, 12, 14, 30, 50] },
  larger58: { radii: new Array(8).fill(58) },
};

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function arrangement(seed: number): CutLine[] {
  const next = lcg(seed);
  const count = 1 + Math.floor(next() * 5);
  return Array.from({ length: count }, () => {
    const angle = next() * 180;
    const offset = (next() - 0.5) * 36;
    // One in four strokes stops short of the rim (a groove, or an edge-reaching stroke on a smaller dough).
    return next() < 0.25 ? createGrooveCutLine(angle, 4 + next() * 24) : createChordCutLine(angle, offset);
  });
}

const ARRANGEMENTS = Array.from({ length: 120 }, (_, i) => arrangement(1000 + i));

describe("evaluation and drawing agree (#427)", () => {
  for (const [name, shape] of Object.entries(SHAPES)) {
    it(`${name}: the same through-cut set, and drawn - counted = not-significant regions`, () => {
      for (const lines of ARRANGEMENTS) {
        const layout = computePieceLayout(lines, shape);
        const through = lines.filter((line) => isThroughCut(line, shape));
        // The drawing splits exactly along the cuts the evaluation treats as through.
        expect((layout?.cuts ?? []).map((c) => c.lineIndex)).toEqual(
          lines.flatMap((line, i) => (buildCutVisual(line, shape).through ? [i] : [])),
        );
        expect(through.length).toBe(layout?.cuts.length ?? 0);

        const regions = computeCutRegions(through);
        const counted = evaluateCut(lines, undefined, shape).actualPieceCount;
        expect(counted).toBe(regions.filter((r) => isSignificantRegion(r)).length);
        expect(layout ? layout.pieces.length : 1).toBe(regions.length);
        expect((layout ? layout.pieces.length : 1) - counted).toBe(regions.filter((r) => !isSignificantRegion(r)).length);
      }
    });
  }

  it("with no through cut the pizza is one piece for both", () => {
    const lines = [createGrooveCutLine(10, 20), createGrooveCutLine(70, 20)];
    expect(computePieceLayout(lines, SHAPES.ideal)).toBeNull();
    expect(evaluateCut(lines, undefined, SHAPES.ideal).actualPieceCount).toBe(1);
  });

  it("the same diameters count the same whichever silhouette the dough has", () => {
    const lines = [createDiameterCutLine(0), createDiameterCutLine(60), createDiameterCutLine(120)];
    for (const shape of Object.values(SHAPES)) expect(evaluateCut(lines, undefined, shape).actualPieceCount).toBe(6);
  });
});
