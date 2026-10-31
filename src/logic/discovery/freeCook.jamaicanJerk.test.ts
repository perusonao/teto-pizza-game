import { describe, expect, it } from "vitest";
import { FREE_COOK_BAKE_TARGET } from "../../data/freeCook";
import { getRecipe } from "../../data/recipes";
import { EMPTY_DEX } from "../../state/dex";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { classifyBake5 } from "../bake";
import { resolveFreeCookPizza } from "./freeCook";

/**
 * B12 (Issue #706; PROVISIONAL SPEC, original pizzadb.jp NOT confirmed): the discovery decision of `jamaican-jerk-chicken-pizza`, pinned end to end
 * through `resolveFreeCookPizza` (the same entry CONFIRM_BAKE uses for a Free Cooking round) with the real catalog and the real Dex-free state.
 *
 * What these cases fix (the existing identity contract, not a new rule): the identity is the exact ingredient SET, base sauce included (matcher.ts rule 1) --
 * counts, positions and the bake value are not identity; the Completion Gate (recipe policy) then needs at least one piece of each required ingredient
 * and a bake inside the generic Free Cooking window. The jerk recipe is NO_SAUCE, so any sauce on the pizza changes the set. Motivated by an iPhone HV report
 * in which a pizza without mozzarella resolved to an original pizza.
 */
const ID = "jamaican-jerk-chicken-pizza";
const JUST = (FREE_COOK_BAKE_TARGET.start + FREE_COOK_BAKE_TARGET.end) / 2;
/** Inside the window but past the JUST band: the badge reads 「惜しい（焼きすぎ）」. */
const OVERDONE_IN_WINDOW = FREE_COOK_BAKE_TARGET.end - 2;

function pizzaOf(counts: Readonly<Record<string, number>>, opts: { sauceIds?: string[]; bake?: number } = {}): PizzaState {
  const pizza = createEmptyPizza();
  pizza.sauceIds = opts.sauceIds ?? [];
  let n = 0;
  for (const [ingredientId, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      // Positions are not identity; they only need to be distinct, finite points.
      pizza.toppings.push({ id: `jerk-${n}`, ingredientId, x: 0.05 * n, y: 0.04 * n });
    }
  }
  pizza.bakeResult = opts.bake ?? JUST;
  return pizza;
}

/** The recipe's own required counts (mozzarella 2 / chicken 3 / green-pepper 1 / pineapple 2), read from the recipe so the cases cannot drift from it. */
function requiredCounts(): Record<string, number> {
  const recipe = getRecipe(ID);
  expect(recipe, ID).toBeDefined();
  return Object.fromEntries(recipe!.requiredIngredients.map((q) => [q.ingredientId, q.minCount]));
}

describe(`${ID}: Free Cooking discovery decision`, () => {
  it("sanity: the bake values used below really are JUST / 惜しい（焼きすぎ） inside the generic window", () => {
    expect(classifyBake5(JUST, FREE_COOK_BAKE_TARGET)).toBe("just");
    expect(classifyBake5(OVERDONE_IN_WINDOW, FREE_COOK_BAKE_TARGET)).toBe("overdone");
    expect(OVERDONE_IN_WINDOW).toBeLessThanOrEqual(FREE_COOK_BAKE_TARGET.end);
  });

  it("mozzarella 2 / chicken 3 / green-pepper 1 / pineapple 2, no sauce, a proper bake -> NEW_DISCOVERY of the recipe", () => {
    expect(requiredCounts()).toEqual({ mozzarella: 2, chicken: 3, "green-pepper": 1, pineapple: 2 });
    const r = resolveFreeCookPizza(pizzaOf(requiredCounts()), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind !== "MATCHED") return;
    expect(r.recipe.id).toBe(ID);
    expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
  });

  it("without mozzarella (the other three ingredients only) -> ORIGINAL, whatever the counts and the bake", () => {
    const { mozzarella: _mozzarella, ...withoutCheese } = requiredCounts();
    for (const counts of [withoutCheese, { pineapple: 3, "green-pepper": 3, chicken: 2 }]) {
      for (const bake of [JUST, OVERDONE_IN_WINDOW]) {
        const r = resolveFreeCookPizza(pizzaOf(counts, { bake }), EMPTY_DEX);
        expect(r.kind, JSON.stringify({ counts, bake })).toBe("ORIGINAL");
        if (r.kind === "ORIGINAL") expect(r.outcome.kind).toBe("ORIGINAL");
      }
    }
  });

  it("with mozzarella, counts different from the ideal but at least one piece of each -> still NEW_DISCOVERY (quantity is not identity)", () => {
    const cases: Record<string, number>[] = [
      { mozzarella: 1, chicken: 1, "green-pepper": 1, pineapple: 1 }, // the minimum
      { mozzarella: 2, pineapple: 3, "green-pepper": 3, chicken: 2 }, // the iPhone HV counts, plus the missing mozzarella
      { mozzarella: 4, chicken: 5, "green-pepper": 4, pineapple: 4 }, // above the ideal
    ];
    for (const counts of cases) {
      const r = resolveFreeCookPizza(pizzaOf(counts), EMPTY_DEX);
      expect(r.kind, JSON.stringify(counts)).toBe("MATCHED");
      if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    }
  });

  it("NO_SAUCE with tomato sauce added -> ORIGINAL (a sauce changes the ingredient set and the base)", () => {
    const r = resolveFreeCookPizza(pizzaOf(requiredCounts(), { sauceIds: ["tomato-sauce"] }), EMPTY_DEX);
    expect(r.kind).toBe("ORIGINAL");
    if (r.kind === "ORIGINAL") expect(r.outcome.kind).toBe("ORIGINAL");
  });

  it("an 惜しい（焼きすぎ） bake inside the window is still NEW_DISCOVERY (it only lowers the Scoring 2.0 bake factor)", () => {
    const r = resolveFreeCookPizza(pizzaOf(requiredCounts(), { bake: OVERDONE_IN_WINDOW }), EMPTY_DEX);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
  });

  it("past the window (焦げ) is a cooking failure, not a discovery -- so the case above is about the window edge, not 'any overbake'", () => {
    const r = resolveFreeCookPizza(pizzaOf(requiredCounts(), { bake: FREE_COOK_BAKE_TARGET.end + 5 }), EMPTY_DEX);
    expect(r.kind).toBe("FAILED");
  });
});
