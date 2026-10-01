import { describe, expect, it } from "vitest";
import { progressionStars, recipeProgressionStars } from "./progressionStars";
import { totalStars } from "./mastery";
import type { DexEntry } from "../state/dex";

function entry(recipeId: string, bestStars: number, discovered = true) {
  return { recipeId, discovered, bestStars };
}

describe("recipeProgressionStars (max(BEST, 2) per discovered recipe)", () => {
  it.each([
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
  ])("discovered with BEST %i → %i⭐", (best, expected) => {
    expect(recipeProgressionStars(true, best)).toBe(expected);
  });

  it("an undiscovered recipe is worth 0, whatever its BEST says", () => {
    for (const best of [0, 1, 2, 5]) expect(recipeProgressionStars(false, best)).toBe(0);
  });

  it("a corrupt BEST fails safe: discovered still earns the floor, never more than ★5", () => {
    expect(recipeProgressionStars(true, -3)).toBe(2);
    expect(recipeProgressionStars(true, Number.NaN)).toBe(2);
    expect(recipeProgressionStars(true, Number.POSITIVE_INFINITY)).toBe(2);
    expect(recipeProgressionStars(true, 4.9)).toBe(4);
    expect(recipeProgressionStars(true, 99)).toBe(5);
  });
});

describe("progressionStars (Σ over the Dex)", () => {
  it("is 0 for an empty Dex", () => {
    expect(progressionStars([])).toBe(0);
  });

  it("sums max(BEST, 2) over discovered recipes and skips undiscovered ones", () => {
    const dex = [entry("a", 0), entry("b", 1), entry("c", 2), entry("d", 5), entry("e", 5, false)];
    expect(progressionStars(dex)).toBe(2 + 2 + 2 + 5);
  });

  it("counts a duplicated recipe id once, at its best entry", () => {
    expect(progressionStars([entry("a", 1), entry("a", 4), entry("a", 3)])).toBe(4);
    expect(progressionStars([entry("a", 5, false), entry("a", 1)])).toBe(2);
  });

  it("is never below the legacy Σ BEST, so switching can never re-lock a save", () => {
    const dex: DexEntry[] = ([1, 2, 3, 4, 5] as const).map((stars, i) => ({
      recipeId: `r${i}`,
      discovered: true,
      bestScore: 0,
      bestStars: stars,
      timesMade: 1,
    }));
    expect(progressionStars(dex)).toBe(2 + 2 + 3 + 4 + 5);
    expect(progressionStars(dex)).toBeGreaterThanOrEqual(totalStars(dex));
  });

  it("does not mutate its input", () => {
    const dex = Object.freeze([Object.freeze(entry("a", 3))]);
    expect(progressionStars(dex)).toBe(3);
  });
});
