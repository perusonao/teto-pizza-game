import { describe, expect, it, vi } from "vitest";
import { INGREDIENTS, getIngredient } from "../../data/ingredients";
import { PREP_TARGET_INGREDIENT_IDS, canPrepIngredient } from "../../data/prepIngredients";

/** Cooking Prep Phase 1 PR-A S1 (spec §5.2): the pure target rule. */
const hoisted = vi.hoisted(() => ({ stripVisual: false }));
vi.mock("../../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/ingredients")>();
  return {
    ...actual,
    getIngredient: (id: string) => {
      const found = actual.getIngredient(id);
      return found && hoisted.stripVisual ? { ...found, pieceVisual: undefined } : found;
    },
  };
});

describe("canPrepIngredient", () => {
  it("Phase 1 targets beef only, and beef has its dedicated visual today", () => {
    expect(PREP_TARGET_INGREDIENT_IDS).toEqual(["beef"]);
    expect(getIngredient("beef")?.pieceVisual).toBe("beef-slices");
    expect(canPrepIngredient("beef")).toBe(true);
  });

  it("every other shipped ingredient is not prep-able", () => {
    for (const ingredient of INGREDIENTS) {
      if (ingredient.id !== "beef") expect(canPrepIngredient(ingredient.id), ingredient.id).toBe(false);
    }
    expect(canPrepIngredient("")).toBe(false);
    expect(canPrepIngredient("no-such-ingredient")).toBe(false);
  });

  it("a target without its dedicated visual is dormant (the SVG guard)", () => {
    hoisted.stripVisual = true;
    try {
      expect(canPrepIngredient("beef")).toBe(false);
    } finally {
      hoisted.stripVisual = false;
    }
    expect(canPrepIngredient("beef")).toBe(true);
  });

  it("takes the ingredient id alone (no recipe / target / round input can change the answer)", () => {
    expect(canPrepIngredient.length).toBe(1);
  });
});
