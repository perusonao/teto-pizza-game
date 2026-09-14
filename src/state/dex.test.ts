import { describe, expect, it } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX, isDiscovered, registerScoreToDex } from "./dex";
import type { ScoreBreakdown, QualityStars } from "../logic/scoring";

function scoreOf(total: number, stars: QualityStars): ScoreBreakdown {
  return {
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
    total,
    stars,
  };
}

describe("registerScoreToDex", () => {
  it("creates a BEST entry on the first result for a recipe", () => {
    const result = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(72, 3));
    expect(result.wasNewDiscovery).toBe(true);
    expect(result.isNewBest).toBe(true);
    expect(result.dex).toEqual([
      { recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 1 },
    ]);
  });

  it("updates BEST when a later score is higher", () => {
    const first = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(72, 3));
    const second = registerScoreToDex(first.dex, "margherita", scoreOf(91, 5));

    expect(second.wasNewDiscovery).toBe(false);
    expect(second.isNewBest).toBe(true);
    const entry = second.dex.find((e) => e.recipeId === "margherita");
    expect(entry).toEqual({
      recipeId: "margherita",
      discovered: true,
      bestScore: 91,
      bestStars: 5,
      timesMade: 2,
    });
  });

  it("does not overwrite BEST with a lower later score, but still counts timesMade", () => {
    const first = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(72, 3));
    const second = registerScoreToDex(first.dex, "margherita", scoreOf(91, 5));
    const third = registerScoreToDex(second.dex, "margherita", scoreOf(60, 3));

    expect(third.isNewBest).toBe(false);
    const entry = third.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(91);
    expect(entry?.bestStars).toBe(5);
    expect(entry?.timesMade).toBe(3);
  });

  it("does not let a higher total override a previously higher star rating (bake-cap regression)", () => {
    // A perfect-bake ★5 round, then a higher-total round that the bake cap holds at ★4.
    const first = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(94, 5));
    const second = registerScoreToDex(first.dex, "margherita", scoreOf(99, 4));

    expect(second.isNewBest).toBe(false);
    const entry = second.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(94);
    expect(entry?.bestStars).toBe(5);
    expect(entry?.timesMade).toBe(2);
  });

  it("lets a higher star rating become BEST even with a lower total", () => {
    const first = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(99, 4));
    const second = registerScoreToDex(first.dex, "margherita", scoreOf(91, 5));

    expect(second.isNewBest).toBe(true);
    const entry = second.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(91);
    expect(entry?.bestStars).toBe(5);
  });

  it("keeps each recipe's BEST and timesMade independent of the others", () => {
    const afterMargherita = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(80, 4));
    const afterBoth = registerScoreToDex(afterMargherita.dex, "marinara", scoreOf(65, 3));

    expect(afterBoth.dex).toHaveLength(2);
    const margherita = afterBoth.dex.find((e) => e.recipeId === "margherita");
    const marinara = afterBoth.dex.find((e) => e.recipeId === "marinara");
    expect(margherita).toEqual({
      recipeId: "margherita",
      discovered: true,
      bestScore: 80,
      bestStars: 4,
      timesMade: 1,
    });
    expect(marinara).toEqual({
      recipeId: "marinara",
      discovered: true,
      bestScore: 65,
      bestStars: 3,
      timesMade: 1,
    });
  });
});

describe("discoveredRecipeIds / isDiscovered", () => {
  it("reflect only recipes that have been discovered", () => {
    const { dex } = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(80, 4));
    expect(discoveredRecipeIds(dex)).toEqual(["margherita"]);
    expect(isDiscovered(dex, "margherita")).toBe(true);
    expect(isDiscovered(dex, "marinara")).toBe(false);
  });

  it("report nothing discovered for an empty dex", () => {
    expect(discoveredRecipeIds(EMPTY_DEX)).toEqual([]);
    expect(isDiscovered(EMPTY_DEX, "margherita")).toBe(false);
  });
});
