import { describe, expect, it } from "vitest";
import { getPlayerReferencePizza } from "./playerReference";
import { RECIPES } from "./recipes";
import { getIngredient } from "./ingredients";
import { getReferencePizza } from "./referencePizza";

/**
 * Issue #47 Slice B (Findings F/H): pins the player-facing reference generator's own
 * contract -- available for every playable recipe, deterministic, and independent of
 * Scoring 2.0's own Margherita-only `referencePizza.ts` (which this suite also pins as
 * unchanged, per the task's explicit scope guard).
 */
describe("getPlayerReferencePizza", () => {
  it("is available for every recipe in RECIPES (Finding F: no recipe is left without a player reference)", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      expect(reference.recipeId).toBe(recipe.id);
      expect(reference.sauceIngredientId).not.toBeNull();
    }
  });

  it("communicates sauce identity via a real sauce-category ingredient id", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const sauceIngredient = getIngredient(reference.sauceIngredientId ?? "");
      expect(sauceIngredient?.category).toBe("sauce");
    }
  });

  it("communicates cheese/topping identity and approximate piece counts matching requiredIngredients", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const nonSauceRequirements = recipe.requiredIngredients.filter(
        (req) => getIngredient(req.ingredientId)?.category !== "sauce",
      );
      expect(reference.pieceGroups).toHaveLength(nonSauceRequirements.length);
      reference.pieceGroups.forEach((group, index) => {
        const requirement = nonSauceRequirements[index];
        expect(group.ingredientId).toBe(requirement.ingredientId);
        expect(group.positions).toHaveLength(requirement.minCount);
      });
    }
  });

  it("never places two pieces of the same recipe at a colliding slot", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const allPositions = reference.pieceGroups.flatMap((group) => group.positions);
      const keys = allPositions.map((p) => `${p.x},${p.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("is deterministic: two calls for the same recipe produce identical output", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const first = getPlayerReferencePizza(margherita);
    const second = getPlayerReferencePizza(margherita);
    expect(first).toEqual(second);
  });

  it("Bismarck has a player reference despite having no Scoring 2.0 Reference fixture", () => {
    const bismarck = RECIPES.find((r) => r.id === "bismarck")!;
    expect(getReferencePizza("bismarck")).toBeNull();
    const reference = getPlayerReferencePizza(bismarck);
    expect(reference.pieceGroups.map((g) => g.ingredientId)).toEqual(["mozzarella", "egg"]);
    expect(reference.sauceIngredientId).toBe("tomato-sauce");
  });

  it("Margherita's player reference matches its requiredIngredients (mozzarella x3, basil x2)", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const reference = getPlayerReferencePizza(margherita);
    expect(reference.pieceGroups).toEqual([
      { ingredientId: "mozzarella", positions: expect.any(Array) },
      { ingredientId: "basil", positions: expect.any(Array) },
    ]);
    expect(reference.pieceGroups[0].positions).toHaveLength(3);
    expect(reference.pieceGroups[1].positions).toHaveLength(2);
  });
});

describe("Scoring 2.0 Reference fixtures unchanged (scope guard)", () => {
  it("still returns a Reference Pizza only for margherita, null for every other recipe", () => {
    for (const recipe of RECIPES) {
      const scoringReference = getReferencePizza(recipe.id);
      if (recipe.id === "margherita") {
        expect(scoringReference).not.toBeNull();
      } else {
        expect(scoringReference).toBeNull();
      }
    }
  });
});
