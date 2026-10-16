import { describe, expect, it } from "vitest";
import { requiredCutCount } from "../logic/cut/evaluation";
import { createChordCutLine } from "../logic/cut/fixtures";
import { computePieceLayout } from "../logic/cut/pieces";
import {
  planSauceLayers,
  SAUCE_CUT_CANVAS_MAX,
  SAUCE_MAX_CUT_PIECES,
  SAUCE_PIECES_FOR_TWO_GROUPS,
  sauceBudgetForPieces,
  type SauceLayer,
} from "./sauceLayers";

/**
 * Codex P2 on PR #494: the sauce canvases of a CUT pizza stay within a pizza-wide budget whatever the cuts. The piece count is bounded by
 * the cut rules (the reducer's `requiredCutCount + 2` limit) and the line-arrangement geometry; the per-piece budget depends on it.
 */
const maxPieces = (lines: number) => (lines * (lines + 1)) / 2 + 1; // n straight lines: at most n(n+1)/2 + 1 regions

// run i of a worst-case history for the canvas count: oil and another sauce alternating
const layer = (kind: string, i: number): SauceLayer => ({ ingredientId: kind, deposits: [{ x: i, y: 50, amount: 0.02, ingredientId: kind }], under: [] });
const alternating = (n: number, other: string) => Array.from({ length: n }, (_, i) => layer(i % 2 ? "olive-oil" : other, i));

describe("how many pieces a cut pizza can have", () => {
  it("the reducer allows requiredCutCount + 2 lines, at most 6 (the 8-slice order), so at most 22 pieces", () => {
    for (const slices of [4, 6, 8] as const) {
      expect(requiredCutCount(slices) + 2).toBe(slices / 2 + 2);
    }
    const lines = requiredCutCount(8) + 2;
    expect(lines).toBe(6);
    expect(SAUCE_MAX_CUT_PIECES).toBe(maxPieces(lines));
  });

  it("the real geometry reaches 22 pieces with 6 committed cuts (not 8), and never more, for random cut arrangements", () => {
    const spec: Array<[number, number]> = [[72.7, -6.7], [109.4, -21.4], [82.5, -12.5], [23.7, -17.9], [53, -16.2], [132.3, -16.3]];
    expect(computePieceLayout(spec.map(([a, o]) => createChordCutLine(a, o)))!.pieces.length).toBe(SAUCE_MAX_CUT_PIECES);
    let seed = 11;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let n = 1; n <= 6; n += 1) {
      for (let k = 0; k < 400; k += 1) {
        const lines = Array.from({ length: n }, () => createChordCutLine(rnd() * 180, (rnd() - 0.5) * 70));
        expect(computePieceLayout(lines)!.pieces.length).toBeLessThanOrEqual(maxPieces(n));
      }
    }
  });
});

describe("the sauce canvas budget of a cut pizza", () => {
  const canvasesPerPiece = (history: SauceLayer[], pieces: number) => {
    const plan = planSauceLayers(history, sauceBudgetForPieces(pieces));
    return 2 * (plan.merged.length + plan.own.length);
  };

  it("holds for every piece count from 1 to 22, for the worst-case histories (alternating oil / other, 100 runs)", () => {
    for (let pieces = 1; pieces <= SAUCE_MAX_CUT_PIECES; pieces += 1) {
      for (const other of ["tomato-sauce", "pesto"]) {
        for (const runs of [1, 9, 12, 50, 100]) {
          expect(pieces * canvasesPerPiece(alternating(runs, other), pieces)).toBeLessThanOrEqual(SAUCE_CUT_CANVAS_MAX);
        }
      }
    }
  });

  it("up to 8 pieces a piece may use two groups (4 canvases), beyond that one group (2 canvases)", () => {
    const history = alternating(60, "tomato-sauce");
    expect(canvasesPerPiece(history, SAUCE_PIECES_FOR_TWO_GROUPS)).toBe(4);
    expect(canvasesPerPiece(history, SAUCE_PIECES_FOR_TWO_GROUPS + 1)).toBe(2);
    expect(SAUCE_PIECES_FOR_TWO_GROUPS * 4).toBe(32);
    expect(SAUCE_MAX_CUT_PIECES * 2).toBe(SAUCE_CUT_CANVAS_MAX);
  });

  it("the one-group plan still covers every run in order, and a mixed group bakes its oil", () => {
    const history = alternating(30, "pesto");
    const plan = planSauceLayers(history, sauceBudgetForPieces(22));
    expect(plan.own).toEqual([]);
    expect(plan.merged).toHaveLength(1);
    expect(plan.merged[0].runs).toEqual(history);
    expect(plan.merged[0]).toMatchObject({ oil: false, bakedOil: true });
  });

  it("an oil-only or oil-free history keeps its exact treatment (no baking) under the one-group plan", () => {
    const oilOnly = planSauceLayers(Array.from({ length: 5 }, (_, i) => layer("olive-oil", i)), sauceBudgetForPieces(22));
    expect(oilOnly.merged[0]).toMatchObject({ oil: true, bakedOil: false });
    const noOil = planSauceLayers(Array.from({ length: 5 }, (_, i) => layer(i % 2 ? "pesto" : "tomato-sauce", i)), sauceBudgetForPieces(22));
    expect(noOil.merged[0]).toMatchObject({ oil: false, bakedOil: false });
  });
});
