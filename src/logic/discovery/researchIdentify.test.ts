import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { evaluateIngredientTest, isCanonicalRecipeIngredient, pizzaUsesIngredient } from "./researchIdentify";

/** Issue #356 Slice 1: the pure identification rule. */
const pesto = RECIPES.find((r) => r.id === "pesto-pollo")!;
const pizza = {
  sauceIds: ["pesto"],
  toppings: [
    { id: "a", ingredientId: "chicken", x: 40, y: 40 },
    { id: "b", ingredientId: "egg", x: 50, y: 50 },
  ],
};
const run = (testedIngredientId: string, outcomeKind = "ORIGINAL", p: object = pizza) =>
  evaluateIngredientTest({ targetRecipeId: pesto.id, testedIngredientId, pizza: p, outcomeKind });

describe("membership authority is the recipe's requiredIngredients", () => {
  it("agrees with requiredIngredients for every ingredient of every recipe (sauce / cheese / topping alike)", () => {
    for (const r of RECIPES) {
      for (const q of r.requiredIngredients) expect(isCanonicalRecipeIngredient(r.id, q.ingredientId)).toBe(true);
    }
  });
  it("an ingredient outside the recipe, an unknown recipe and hostile ids are not members", () => {
    expect(isCanonicalRecipeIngredient("pesto-pollo", "egg")).toBe(false);
    expect(isCanonicalRecipeIngredient("no-such-recipe", "pesto")).toBe(false);
    for (const hostile of ["__proto__", "constructor", "toString", ""]) {
      expect(isCanonicalRecipeIngredient("pesto-pollo", hostile)).toBe(false);
    }
  });
  it("a no-sauce recipe has no sauce member", () => {
    const noSauce = RECIPES.find((r) => !r.requiredIngredients.some((q) => ["tomato-sauce", "pesto", "olive-oil"].includes(q.ingredientId)));
    if (noSauce) expect(isCanonicalRecipeIngredient(noSauce.id, "tomato-sauce")).toBe(false);
  });
});

describe("evaluateIngredientTest", () => {
  it("POSITIVE: used, ORIGINAL, in the recipe -> one ing: fact (sauce and topping)", () => {
    expect(run("chicken")).toEqual({ verdict: "POSITIVE", addFactId: "ing:chicken" });
    expect(run("pesto")).toEqual({ verdict: "POSITIVE", addFactId: "ing:pesto" });
  });
  it("NOT_IDENTIFIED: used, ORIGINAL, not in the recipe -> no fact", () => {
    expect(run("egg")).toEqual({ verdict: "NOT_IDENTIFIED", addFactId: null });
  });
  it("NOT_USED: the ingredient is not on the pizza, even when it is in the recipe", () => {
    expect(run("mozzarella")).toEqual({ verdict: "NOT_USED", addFactId: null });
    expect(run("chicken", "ORIGINAL", { sauceIds: [], toppings: [] })).toEqual({ verdict: "NOT_USED", addFactId: null });
  });
  it("INCOMPLETE_MATCH and AMBIGUOUS never give a positive, and are indistinguishable from a negative", () => {
    const negative = run("egg");
    for (const kind of ["INCOMPLETE_MATCH", "AMBIGUOUS"]) {
      expect(run("chicken", kind)).toEqual(negative);
      expect(run("egg", kind)).toEqual(negative);
    }
  });
  it("any other outcome kind never identifies", () => {
    for (const kind of ["NEW_DISCOVERY", "ALREADY_DISCOVERED", "", "x"]) expect(run("chicken", kind).addFactId).toBeNull();
  });
  it("is pure and repeatable: the same input gives the same result", () => {
    expect(run("chicken")).toEqual(run("chicken"));
  });
  it("reads only the declared ingredient: another member on the pizza changes nothing", () => {
    const more = { ...pizza, toppings: [...pizza.toppings, { id: "c", ingredientId: "fresh-tomato", x: 60, y: 60 }] };
    expect(run("egg", "ORIGINAL", more)).toEqual(run("egg"));
  });
  it("malformed pizza fields fail closed", () => {
    expect(pizzaUsesIngredient({ sauceIds: "pesto", toppings: null }, "pesto")).toBe(false);
    expect(run("chicken", "ORIGINAL", { sauceIds: undefined, toppings: [{ ingredientId: 3 }] }).verdict).toBe("NOT_USED");
  });
});
