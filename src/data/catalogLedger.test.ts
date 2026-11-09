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
      // BBQ Chicken (#611): + bbq-chicken-pizza (late catalog, credited, chapter 4), + bbq-sauce (a late sauce) + cilantro (a late topping, herb), + their shared late ladder step 66 (after Batch 10's ordinary steps 57-61 and the late steps 62-65).
      // Expansion Batch 10 PR-1: + curry-pizza-japan, rendang-pizza, currywurst, tandoori-paneer-pizza, cuban-pizza (credited, chapter 4); + 8 materials (curry-ketchup / mustard sauces, paneer / swiss-cheese cheeses, beef / wurstel / paprika-powder / pickles toppings); + ordinary steps 57-61 (the late steps shift +5).
      // PR-2 late4 (#578 / #611): + wasabi-beef-pizza and tarako-cream-pizza (late catalog, credited, chapter 4), + soy-sauce and fresh-cream-sauce (late sauces) + wasabi / cod-roe / nori (late toppings), + their late ladder steps 67 and 68.
      // B11 S1 (PROVISIONAL SPEC, original NOT confirmed): + boscaiola (credited, the key of ordinary step 62), + porcini-pizza (non-credit, NO_SAUCE, the same step), + pescatore (credited, the key of ordinary step 63), chapter 4; + porcini (vegetable) and mussel (seafood) toppings; + ordinary steps 62-63 (the late steps shift +2: 64-70).
      // Expansion Batch 12 (#707) on top of B12 (#706): B12 adds jamaican-jerk-chicken-pizza (non-credit, NO_SAUCE, no new material, joins the green-pepper cohort, chapter 4 with its key step 32); Expansion Batch 12 adds supreme-pizza (non-credit, chapter 3, no new material), pizza-alla-norma (credited, chapter 4, the key of ordinary step 64) and ricotta-salata (a cheese, so `toppings` does not move).
      // Expansion Batch 13 (#708, PROVISIONAL SPEC, original NOT confirmed): + potato-mayo-pizza (credited, NO_SAUCE, chapter 4: its key step 65 is the new material `mayo`), + mayo (a spice topping), + ordinary step 65 (the late steps shift +1).
      // Expansion Batch 14 (PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + moussaka-style-pizza (credited, chapter 4: its key is the new material `cinnamon`), + cinnamon (a spice topping), + ordinary step 66 (the late steps shift +1).
      // Expansion Batch 15 (#728, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + nigerian-suya-pizza (non-credit, NO_SAUCE as a suya-only Owner exception, chapter 4, no new material, no new ladder step; it joins the beef cohort of rendang-pizza at ordinary step 58).
      // Expansion Batch 16 (#736, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + ume-shiso-pizza (credited, chapter 4: its key is the new material `umeboshi-paste`), + umeboshi-paste (a SAUCE, so `toppings` does not move), + ordinary step 67 (the late steps shift +1).
      // Expansion Batch 17 (#741, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + goulash-pizza (credited, chapter 4: its key is the new material `sour-cream`), + sour-cream (a SAUCE, so `toppings` does not move), + ordinary step 68 (the late steps shift +1).
      // Expansion Batch 18 (#748, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + baingan-bharta-pizza (credited, chapter 4: its key is `cilantro`, PROMOTED from the late catalog) + reina-pepiada-pizza (non-credit, chapter 4: the same key step 69); no new ingredient id (cilantro was already counted as a late topping, so `ingredients` / `toppings` do not move in this ON build), + ordinary step 69 (the late steps shift +1).
      // Expansion Batch 19 (#774, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + pesto-burrata-pizza (credited, chapter 4: its key is the new material `burrata`) + pizza-alla-crudaiola (non-credit, chapter 4: the same key step 70), + burrata (a CHEESE, so `toppings` does not move), + ordinary step 70 (the late steps shift +1).
      // Expansion Batch 20-A (#790, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + pesto-noci-pizza (credited, chapter 4: its key is the new materials honey + walnut), + honey (a SAUCE) + walnut (a TOPPING, so `toppings` + 1), + ordinary step 71 (the late steps shift +1).
      // Expansion Batch 21 (#780, B21 / RB-01, PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): + taco-pizza and okonomiyaki-style-pizza (late catalog, credited, chapter 4: each has its own late step 79 / 80), + cheddar (a CHEESE) + okonomiyaki-sauce (a SAUCE) + lettuce / tortilla-chips / cabbage / bonito-flakes (TOPPINGS, so `toppings` + 4). No ordinary step; the late steps are appended after the late4 steps.
      recipes: pinsa ? 95 : 94,
      credited: 83,
      ingredients: 106,
      toppings: 73,
      ladderSteps: 80,
      chapterSizes: [6, 12, 19, pinsa ? 58 : 57],
      lunchRushPool: 25,
    });
  });

  it("topping family distribution (shelf)", () => {
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) {
      const shelf = i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category;
      byShelf[shelf] = (byShelf[shelf] ?? 0) + 1;
    }
    expect(byShelf).toEqual({ sauce: 17, cheese: 16, meat: 12, seafood: 12, vegetable: 27, fruit: 3, herb: 9, spice: 7, other: 3 });
  });
});
