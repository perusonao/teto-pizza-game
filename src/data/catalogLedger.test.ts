import { describe, expect, it } from "vitest";
import { CATALOG_COUNTS } from "../logic/catalog/testSupport/catalogDerived";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { INGREDIENTS } from "./ingredients";

/**
 * THE one explicit catalog ledger. Every other test derives its totals from RECIPES / INGREDIENTS / DISCOVERY_LADDER
 * (see logic/catalog/testSupport/catalogDerived.ts), so a recipe batch edits THIS file and nothing else for counts.
 * Update the numbers below deliberately in the batch PR, next to the changed recipe / ingredient data.
 */
describe("catalog ledger (the single hand-maintained total)", () => {
  it("recipes / credited / ingredients / toppings / ladder steps / chapter sizes / Lunch Rush pool", () => {
    expect(CATALOG_COUNTS).toEqual({
      // E5 (late catalog ON): + ikura-salmon-pizza (credited, chapter 4), + salmon-roe (a seafood topping), + its late ladder step 57.
      recipes: 64,
      credited: 60,
      ingredients: 70,
      toppings: 54,
      ladderSteps: 57,
      chapterSizes: [6, 11, 18, 29],
      lunchRushPool: 25,
    });
  });

  it("topping family distribution (shelf)", () => {
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category;
      byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
    }
    expect(byShelf).toEqual({ sauce: 5, cheese: 11, meat: 10, seafood: 9, vegetable: 21, fruit: 2, herb: 8, spice: 1, other: 3 });
  });
});
