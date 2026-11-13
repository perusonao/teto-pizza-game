import { describe, expect, it } from "vitest";
import { CATALOG_COUNTS } from "../logic/catalog/testSupport/catalogDerived";
import { COMPOSED } from "../logic/catalog/testSupport/composedForBuild";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { INGREDIENTS } from "./ingredients";

/**
 * The catalog ledger. R-1 (#780): the expected totals are no longer a hand-edited number block that every recipe batch rewrote; they are COMPOSED from two records that do not
 * read the code under test -- the FROZEN BASELINE (the shipped catalog at one historical commit, `src/logic/catalog/testSupport/frozenBaseline.json`, recorded by
 * `node tools/train-kit/cli.mjs freeze`) and the Owner-approved train specs (`src/trainKit/landed/*.json`, written by `apply`). The comparison is still EXACT equality, so adding,
 * dropping or re-classifying a recipe / ingredient / ladder step without its spec fails here exactly as a wrong hand-written number did.
 * The per-batch history that used to be commented here is in git (`git log -p -- src/data/catalogLedger.test.ts`) and in each landed spec.
 * Every other test derives its totals from the implementation (logic/catalog/testSupport/catalogDerived.ts); this file and ../logic/catalog/catalogComposition.test.ts are where the implementation is checked against the record.
 */
describe("catalog ledger (composed from the frozen baseline and the landed trains)", () => {
  it("recipes / credited / ingredients / toppings / ladder steps / chapter sizes / Lunch Rush pool", () => {
    expect(CATALOG_COUNTS).toEqual({
      recipes: COMPOSED.recipeIds.length,
      credited: COMPOSED.creditedIds.length,
      ingredients: COMPOSED.ingredients.length,
      toppings: COMPOSED.toppingCount,
      ladderSteps: COMPOSED.steps.length,
      chapterSizes: COMPOSED.chapterSizes,
      lunchRushPool: COMPOSED.lunchRushPool,
    });
  });

  it("topping family distribution (shelf)", () => {
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category;
      byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
    }
    expect(byShelf).toEqual(COMPOSED.byShelf);
  });
});
