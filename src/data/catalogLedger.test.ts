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
      recipes: 41,
      credited: 39,
      ingredients: 45,
      toppings: 35,
      ladderSteps: 37,
      chapterSizes: [6, 11, 16, 8],
      lunchRushPool: 25,
    });
  });

  it("topping family distribution (shelf)", () => {
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category;
      byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
    }
    expect(byShelf).toEqual({ sauce: 3, cheese: 7, meat: 7, seafood: 5, vegetable: 12, fruit: 2, herb: 5, spice: 1, other: 3 });
  });
});
