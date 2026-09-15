import { describe, expect, it } from "vitest";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";
import type { PlacedTopping } from "../state/pizzaState";
import { distanceSimilarity, matchReferencePositions, scorePieceGroup } from "./referenceMatching";

const mozzarella = MARGHERITA_REFERENCE.pieceGroups[0];

function pieces(points: readonly { x: number; y: number }[]): PlacedTopping[] {
  return points.map((point, index) => ({ id: `piece-${index}`, ingredientId: "mozzarella", ...point }));
}

describe("permutation-invariant reference matching", () => {
  it("gives exact target placement full credit independent of order and ids", () => {
    const exact = scorePieceGroup(pieces(mozzarella.positions), mozzarella);
    const reversed = scorePieceGroup(pieces([...mozzarella.positions].reverse()), mozzarella);
    expect(exact.quantitySimilarity).toBe(1);
    expect(exact.placementSimilarity).toBe(1);
    expect(reversed.placementSimilarity).toBe(exact.placementSimilarity);
  });

  it("finds the natural minimum-distance assignment", () => {
    const matches = matchReferencePositions(
      [{ x: 80, y: 50 }, { x: 20, y: 50 }],
      [{ x: 18, y: 50 }, { x: 82, y: 50 }],
      8,
      22,
    );
    expect(matches.map((match) => match.distance)).toEqual([2, 2]);
  });

  it("keeps placement separate from missing and extra count penalties", () => {
    const missing = scorePieceGroup(pieces(mozzarella.positions.slice(0, 2)), mozzarella);
    const extra = scorePieceGroup(
      pieces([...mozzarella.positions, { x: 5, y: 5 }]),
      mozzarella,
    );
    expect(missing.quantitySimilarity).toBe(0.75);
    expect(extra.quantitySimilarity).toBe(0.75);
    expect(missing.placementSimilarity).toBe(1);
    expect(extra.placementSimilarity).toBe(1);
  });

  it("returns not-evaluated placement for no pieces", () => {
    const empty = scorePieceGroup([], mozzarella);
    expect(empty.quantitySimilarity).toBe(0);
    expect(empty.placementSimilarity).toBeNull();
  });

  it("handles duplicate positions and ties deterministically", () => {
    const first = matchReferencePositions(
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      8,
      22,
    );
    expect(first).toEqual(matchReferencePositions(
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      8,
      22,
    ));
    expect(first.every((match) => match.similarity === 1)).toBe(true);
  });

  it("uses a forgiving plateau and continuous falloff", () => {
    expect(distanceSimilarity(8, 8, 22)).toBe(1);
    expect(distanceSimilarity(14, 8, 22)).toBeGreaterThan(0);
    expect(distanceSimilarity(14, 8, 22)).toBeLessThan(1);
    expect(distanceSimilarity(22, 8, 22)).toBe(0);
  });
});
