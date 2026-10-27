import { describe, expect, it } from "vitest";
import { CATALOG_COUNTS } from "../logic/catalog/testSupport/catalogDerived";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { INGREDIENTS } from "./ingredients";
import { pinsaEnabled } from "./pinsaGate";

/**
 * THE one explicit catalog ledger. Every other test derives its totals from RECIPES / INGREDIENTS / DISCOVERY_LADDER
 * (see logic/catalog/testSupport/catalogDerived.ts), so a recipe batch edits THIS file and nothing else for counts.
 * Update the numbers below deliberately in the batch PR, next to the changed recipe / ingredient data.
 */
describe("catalog ledger (the single hand-maintained total)", () => {
  it("recipes / credited / ingredients / toppings / ladder steps / chapter sizes / Lunch Rush pool", () => {
    // Pinsa Romana (#577 P3-b), only while its gate is open: + pinsa-romana (non-credit, no new material, chapter 4 with its key step arugula = 33).
    const pinsa = pinsaEnabled();
    expect(CATALOG_COUNTS).toEqual({
      // E5 (late catalog ON): + ikura-salmon-pizza (credited, chapter 4), + salmon-roe (a seafood topping), + its late ladder step 57.
      // Square Dough E-2 (#521): + grandma-pizza (non-credit, chapter 2: key step 14, no new material).
      // New Sauces Phase B U1 (#578): + yuzu-shrimp-pizza (late catalog, credited, chapter 4), + yuzu-kosho (a late sauce), + its late ladder step 58.
      // New Sauces Phase B U2 (#578): + eggplant-dengaku-pizza (late catalog, credited, chapter 4), + miso-sauce (a late sauce) + white-sesame (a late topping, spice), + their shared late ladder step 59.
      // New Sauces Phase B U3 (#578): + eggplant-tahini-pizza (late catalog, credited, chapter 4), + tahini (a late sauce) + pomegranate (a late topping, fruit), + their shared late ladder step 60.
      // Expansion Batch 10 PR-1: + curry-pizza-japan, rendang-pizza, currywurst, tandoori-paneer-pizza, cuban-pizza (credited, chapter 4); + 8 materials (curry-ketchup / mustard sauces, paneer / swiss-cheese cheeses, beef / wurstel / paprika-powder / pickles toppings); + ordinary steps 57-61 (the late steps shift +5).
      // PR-2 late4 (#578 / #611): + bulgogi-pizza, wasabi-beef-pizza, mentaiko-cream-pizza (late catalog, credited, chapter 4); + 5 materials (soy-sauce / fresh-cream-sauce sauces, wasabi spice / cod-roe seafood / nori vegetable toppings); + late ladder steps 66-68 (derived). yakiniku is HOLD.
      recipes: pinsa ? 77 : 76,
      credited: 71,
      ingredients: 88,
      toppings: 63,
      ladderSteps: 68,
      chapterSizes: [6, 12, 18, pinsa ? 41 : 40],
      lunchRushPool: 25,
    });
  });

  it("topping family distribution (shelf)", () => {
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category;
      byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
    }
    expect(byShelf).toEqual({ sauce: 12, cheese: 13, meat: 12, seafood: 10, vegetable: 23, fruit: 3, herb: 8, spice: 4, other: 3 });
  });
});
