import { describe, expect, it } from "vitest";
import { totalStars } from "./mastery";
import { EMPTY_DEX, type DexEntry, type DexState } from "../state/dex";

function entry(overrides: Partial<DexEntry> = {}): DexEntry {
  return {
    recipeId: "margherita",
    discovered: true,
    bestScore: 90,
    bestStars: 5,
    timesMade: 1,
    ...overrides,
  };
}

describe("totalStars", () => {
  it("is 0 for an empty Dex", () => {
    expect(totalStars(EMPTY_DEX)).toBe(0);
  });

  it("sums BEST stars across every discovered recipe", () => {
    const dex: DexState = [
      entry({ recipeId: "margherita", bestStars: 5 }),
      entry({ recipeId: "marinara", bestStars: 3 }),
      entry({ recipeId: "genovese", bestStars: 4 }),
    ];
    expect(totalStars(dex)).toBe(12);
  });

  it("ignores an entry marked undiscovered", () => {
    const dex: DexState = [
      entry({ recipeId: "margherita", bestStars: 5, discovered: true }),
      entry({ recipeId: "marinara", bestStars: 3, discovered: false }),
    ];
    expect(totalStars(dex)).toBe(5);
  });

  it("changes when BEST is updated", () => {
    const before: DexState = [entry({ recipeId: "margherita", bestStars: 3 })];
    const after: DexState = [entry({ recipeId: "margherita", bestStars: 5 })];
    expect(totalStars(before)).toBe(3);
    expect(totalStars(after)).toBe(5);
  });

  it("is unaffected by timesMade", () => {
    const fewPlays: DexState = [entry({ bestStars: 4, timesMade: 1 })];
    const manyPlays: DexState = [entry({ bestStars: 4, timesMade: 99 })];
    expect(totalStars(fewPlays)).toBe(totalStars(manyPlays));
    expect(totalStars(manyPlays)).toBe(4);
  });
});
