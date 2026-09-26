import { describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { isRecipeCookable, recipeStockShortage } from "./recipeDiscoveryState";
import {
  aggregateFiniteNeed,
  isRecipeSetCookable,
  recipeFiniteNeed,
  recipeSetStockShortage,
  type RecipeSetInputs,
} from "./recipeSetFeasibility";

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

function recipe(id: string): Recipe {
  const r = getRecipe(id as RecipeId);
  if (!r) throw new Error(`unknown recipe ${id}`);
  return r;
}

/** Everything owned; finite stock as given (absent = 0). */
function stock(inventory: Record<string, number>): RecipeSetInputs {
  return { ownedIngredientIds: ALL_IDS, inventory };
}

const FULL = stock(Object.fromEntries(FINITE_IDS.map((id) => [id, 99])));

describe("runtime facts the Dinner feasibility tests rely on", () => {
  it("egg / ham / olive-oil / pesto are finite, mozzarella / tomato-sauce / basil are starters", () => {
    for (const id of ["egg", "ham", "olive-oil", "pesto"]) expect(getIngredient(id)?.unlockCondition).toBeDefined();
    for (const id of ["mozzarella", "tomato-sauce", "basil"]) expect(getIngredient(id)?.unlockCondition).toBeUndefined();
  });

  it("needs come from the catalog: bismarck egg 1, breakfast-pizza egg 1 + bacon 3, bambino/hawaiian ham 2", () => {
    expect(recipeFiniteNeed(recipe("bismarck"))).toEqual({ egg: 1 });
    expect(recipeFiniteNeed(recipe("breakfast-pizza"))).toEqual({ egg: 1, bacon: 3 });
    expect(recipeFiniteNeed(recipe("bambino"))).toEqual({ ham: 2, corn: 3 });
    expect(recipeFiniteNeed(recipe("hawaiian"))).toEqual({ ham: 2, pineapple: 3 });
    expect(recipeFiniteNeed(recipe("margherita"))).toEqual({});
  });
});

describe("parity with the #212 single-recipe authority", () => {
  /** Stock scenarios that hit every branch of the need rule for every recipe. */
  function scenarios(r: Recipe): [string, RecipeSetInputs][] {
    const need = recipeFiniteNeed(r);
    const exact = Object.fromEntries(Object.entries(need).map(([id, n]) => [id, n]));
    const oneShort = Object.fromEntries(Object.entries(need).map(([id, n], i) => [id, i === 0 ? n - 1 : n]));
    return [
      ["full", FULL],
      ["empty inventory", stock({})],
      ["exact", stock(exact)],
      ["first material one short", stock(oneShort)],
      ["nothing owned but starters", { ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: exact }],
      ["owned list empty", { ownedIngredientIds: [], inventory: FULL.inventory }],
    ];
  }

  it("isRecipeCookable(r) === isRecipeSetCookable([r]) and the shortage lists agree, for every recipe", () => {
    let checked = 0;
    for (const r of RECIPES) {
      for (const [label, inputs] of scenarios(r)) {
        const single = recipeStockShortage(r, inputs);
        const set = recipeSetStockShortage([r], inputs);
        expect(isRecipeSetCookable([r], inputs), `${r.id} / ${label}`).toBe(isRecipeCookable(r, inputs));
        expect(
          set.map(({ ingredientId, need, have }) => ({ ingredientId, need, have })),
          `${r.id} / ${label}`,
        ).toEqual(single);
        checked += 1;
      }
    }
    expect(checked).toBe(RECIPES.length * 6);
  });

  it("parity also holds on need-rule edges no real recipe hits (sauce minCount 2, scatter minCount 0)", () => {
    const edge = {
      ...recipe("margherita"),
      requiredIngredients: [
        { ingredientId: "pesto", minCount: 2 },
        { ingredientId: "egg", minCount: 0 },
      ],
    } as Recipe;
    expect(recipeFiniteNeed(edge)).toEqual({ pesto: 1, egg: 1 });
    for (const inventory of [{}, { pesto: 1, egg: 1 }, { pesto: 1 }, { egg: 1 }] as Record<string, number>[]) {
      const inputs = stock(inventory);
      expect(isRecipeSetCookable([edge], inputs)).toBe(isRecipeCookable(edge, inputs));
      expect(recipeSetStockShortage([edge], inputs).map(({ ingredientId, need, have }) => ({ ingredientId, need, have }))).toEqual(
        recipeStockShortage(edge, inputs),
      );
    }
  });

  it("an unknown ingredient id fails closed exactly like recipeStockShortage (need 1, have 0)", () => {
    const fake = { ...recipe("margherita"), requiredIngredients: [{ ingredientId: "no-such-thing", minCount: 3 }] } as Recipe;
    expect(recipeStockShortage(fake, FULL)).toEqual([{ ingredientId: "no-such-thing", need: 1, have: 0 }]);
    expect(recipeSetStockShortage([fake], FULL)).toEqual([
      { ingredientId: "no-such-thing", need: 1, have: 0, recipeIds: ["margherita"] },
    ]);
    expect(isRecipeSetCookable([fake], FULL)).toBe(false);
  });
});

describe("recipe-set feasibility (shared finite materials)", () => {
  const bismarck = recipe("bismarck");
  const breakfast = recipe("breakfast-pizza");

  it("egg: each cookable alone with one egg, but not both together", () => {
    const inputs = stock({ egg: 1, bacon: 3 });
    expect(isRecipeCookable(bismarck, inputs)).toBe(true);
    expect(isRecipeCookable(breakfast, inputs)).toBe(true);
    expect(isRecipeSetCookable([bismarck, breakfast], inputs)).toBe(false);
    expect(recipeSetStockShortage([bismarck, breakfast], inputs)).toEqual([
      { ingredientId: "egg", need: 2, have: 1, recipeIds: ["bismarck", "breakfast-pizza"] },
    ]);
  });

  it("egg: exactly enough stock is enough", () => {
    expect(isRecipeSetCookable([bismarck, breakfast], stock({ egg: 2, bacon: 3 }))).toBe(true);
  });

  it("ham: bambino + hawaiian need 4 (3 is one short, 4 is exact)", () => {
    const set = [recipe("bambino"), recipe("hawaiian")];
    const base = { corn: 3, pineapple: 3 };
    expect(recipeSetStockShortage(set, stock({ ...base, ham: 3 }))).toEqual([
      { ingredientId: "ham", need: 4, have: 3, recipeIds: ["bambino", "hawaiian"] },
    ]);
    expect(isRecipeSetCookable(set, stock({ ...base, ham: 4 }))).toBe(true);
  });

  it("olive-oil (a sauce, one unit per pizza): fugazza + pizza-bianca with one bottle", () => {
    const set = [recipe("fugazza"), recipe("pizza-bianca")];
    const inputs = stock({ "olive-oil": 1, onion: 4, oregano: 1, rosemary: 3 });
    expect(set.every((r) => isRecipeCookable(r, inputs))).toBe(true);
    expect(recipeSetStockShortage(set, inputs)).toEqual([
      { ingredientId: "olive-oil", need: 2, have: 1, recipeIds: ["fugazza", "pizza-bianca"] },
    ]);
  });

  it("pesto: genovese + pesto-caprese with one jar", () => {
    const set = [recipe("genovese"), recipe("pesto-caprese")];
    const inputs = stock({ pesto: 1, "cherry-tomato": 3, "fresh-tomato": 3 });
    expect(set.every((r) => isRecipeCookable(r, inputs))).toBe(true);
    expect(isRecipeSetCookable(set, inputs)).toBe(false);
    expect(isRecipeSetCookable(set, stock({ pesto: 2, "cherry-tomato": 3, "fresh-tomato": 3 }))).toBe(true);
  });

  it("starter-only recipes never need stock, even repeated", () => {
    const m = recipe("margherita");
    expect(aggregateFiniteNeed([m, m])).toEqual({});
    expect(isRecipeSetCookable([m, m], stock({}))).toBe(true);
    expect(isRecipeSetCookable([m], { ownedIngredientIds: [], inventory: {} })).toBe(true);
  });

  it("an owned-list gap reads as 0 usable even with inventory on record", () => {
    const inputs = { ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], inventory: { egg: 5 } };
    expect(recipeSetStockShortage([bismarck], inputs)).toEqual([
      { ingredientId: "egg", need: 1, have: 0, recipeIds: ["bismarck"] },
    ]);
  });

  it("the set is a multiset: a duplicate target doubles its need", () => {
    expect(aggregateFiniteNeed([bismarck, bismarck])).toEqual({ egg: 2 });
    expect(isRecipeSetCookable([bismarck, bismarck], stock({ egg: 1 }))).toBe(false);
    expect(recipeSetStockShortage([bismarck, bismarck], stock({ egg: 1 }))[0].recipeIds).toEqual(["bismarck"]);
  });

  it("the empty set is cookable", () => {
    expect(isRecipeSetCookable([], stock({}))).toBe(true);
  });

  it("order never changes the answer (every permutation of DM-A)", () => {
    const set = ["margherita", "bismarck", "breakfast-pizza", "funghi"].map(recipe);
    const tight = stock({ egg: 2, bacon: 3, mushroom: 3 });
    const short = stock({ egg: 1, bacon: 3, mushroom: 3 });
    const perms = (xs: Recipe[]): Recipe[][] =>
      xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
    for (const p of perms(set)) {
      expect(isRecipeSetCookable(p, tight)).toBe(true);
      expect(isRecipeSetCookable(p, short)).toBe(false);
    }
  });
});
