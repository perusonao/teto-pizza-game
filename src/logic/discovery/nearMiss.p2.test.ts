import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { getIngredient } from "../../data/ingredients";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { matchDiscovery } from "./matcher";
import { classifyNearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";

/**
 * Original Pizza Recovery P2-B: the near-miss classes stay honest with several candidates, with a
 * colliding (AMBIGUOUS) target, and with no sauce on either side. Synthetic recipes so each case is
 * exact; the real catalog is checked in resultNearMiss.p2.test.ts.
 */
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const base = RECIPES.find((r) => r.id === "bismarck")!;

function fake(id: string, ids: string[]): Recipe {
  return { ...base, id: id as RecipeId, requiredIngredients: ids.map((ingredientId) => ({ ingredientId, minCount: 1 })) };
}
const catalogOf = (recipes: readonly Recipe[]) =>
  recipes.map((r) => {
    const items = [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].sort();
    return { recipeId: r.id, items, sauceBase: items.filter(isSauce) };
  });

function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 2, y: 50 })),
    bakeResult: 70,
  };
}
const nearOf = (pizza: readonly string[], recipes: readonly Recipe[]) =>
  classifyNearMiss(signatureOfPizza(pizzaOf(pizza)), recipes, { catalog: catalogOf(recipes), recipes });

describe("P2-B sauce step (no-sauce never yields a wrong sentence)", () => {
  const withSauce = fake("with-sauce", ["tomato-sauce", "mozzarella", "basil"]);
  const noSauce = fake("no-sauce-recipe", ["mozzarella", "basil"]); // a (future) sauce-less recipe

  it("both sides have a sauce, sauce differs -> CHANGE", () => {
    expect(nearOf(["pesto", "mozzarella", "basil"], [withSauce])).toEqual({ kind: "SAUCE_ONLY", distance: 1, sauceStep: "CHANGE" });
  });

  it("the pizza has no sauce, the target has one -> ADD", () => {
    expect(nearOf(["mozzarella", "basil"], [withSauce])).toEqual({ kind: "SAUCE_ONLY", distance: 1, sauceStep: "ADD" });
  });

  it("the pizza has a sauce, the (sauce-less) target has none -> REMOVE", () => {
    expect(nearOf(["tomato-sauce", "mozzarella", "basil"], [noSauce])).toEqual({ kind: "SAUCE_ONLY", distance: 1, sauceStep: "REMOVE" });
  });

  it("only SAUCE_ONLY carries a step; every other class does not", () => {
    for (const [pizza, recipes] of [
      [["tomato-sauce", "mozzarella"], [withSauce]], // ADD_ONE
      [["tomato-sauce", "mozzarella", "basil", "egg"], [withSauce]], // REMOVE_ONE
      [["tomato-sauce"], [withSauce]], // CLOSE
      [["egg"], [withSauce]], // FAR
    ] as const) {
      const r = nearOf(pizza, recipes);
      expect(r).not.toBeNull();
      expect(r!.kind).not.toBe("SAUCE_ONLY");
      expect("sauceStep" in r!).toBe(false);
    }
  });

  it("a sauce difference plus one ingredient is two steps -> CLOSE, with no direction", () => {
    expect(nearOf(["mozzarella"], [withSauce])).toEqual({ kind: "CLOSE", distance: 2 });
  });
});

describe("P2-B collisions: an unreachable target is never a candidate", () => {
  const a = fake("dup-a", ["tomato-sauce", "mozzarella", "egg"]);
  const b = fake("dup-b", ["tomato-sauce", "egg", "mozzarella"]);
  const solo = fake("solo", ["tomato-sauce", "mozzarella", "egg", "ham"]);

  it("adding one toward a colliding pair is not offered (the matcher would say AMBIGUOUS)", () => {
    expect(nearOf(["tomato-sauce", "mozzarella"], [a, b])).toBeNull();
    expect(nearOf(["tomato-sauce", "mozzarella", "egg", "ham", "basil"], [a, b])).toBeNull();
  });

  it("an exact match with a colliding target is 'no statement', never a line about another recipe", () => {
    expect(nearOf(["tomato-sauce", "mozzarella", "egg"], [a, b, solo])).toBeNull();
  });

  it("a colliding pair does not hide a reachable candidate", () => {
    // pizza is 1 add away from `solo`'s ham-less set? tomato+mozz+egg is exactly a/b (null), so use a 1-away pizza
    const r = nearOf(["tomato-sauce", "mozzarella", "ham"], [a, b, solo]);
    expect(r).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("the promise held by a line is real: following ADD_ONE toward a non-colliding candidate is a UNIQUE_MATCH", () => {
    const catalog = catalogOf([a, b, solo]).map((t) => ({
      ...t,
      targetId: t.recipeId,
      capabilities: [] as string[],
      identityDimensions: RECIPE_DISCOVERY_CATALOG[0].identityDimensions,
      eligibility: { status: "ELIGIBLE" as const },
    }));
    const line = nearOf(["tomato-sauce", "mozzarella", "ham"], [a, b, solo]);
    expect(line?.kind).toBe("ADD_ONE");
    const after = matchDiscovery(signatureOfPizza(pizzaOf(["tomato-sauce", "mozzarella", "ham", "egg"])), catalog);
    expect(after).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: "solo" } });
  });
});

describe("P2-B collisions follow the matcher's role rule (items AND sauce base)", () => {
  const entry = (recipeId: string, items: string[], sauceBase: string[]) => ({ recipeId, items, sauceBase });
  const recipes = [fake("as-base", ["mozzarella", "tomato-sauce"]), fake("as-piece", ["mozzarella", "tomato-sauce"])];

  it("the same ids with a different base are NOT a collision: both stay candidates", () => {
    // as-base: tomato-sauce is the sauce; as-piece: the same id in the piece role (a future authoring case)
    const catalog = [entry("as-base", ["mozzarella", "tomato-sauce"], ["tomato-sauce"]), entry("as-piece", ["mozzarella", "tomato-sauce"], [])];
    const r = classifyNearMiss(signatureOfPizza(pizzaOf(["tomato-sauce"])), recipes, { catalog, recipes });
    expect(r).not.toBeNull();
    expect(r!.distance).toBe(1);
  });

  it("the same ids with the same base ARE a collision (control)", () => {
    const catalog = [entry("as-base", ["mozzarella", "tomato-sauce"], ["tomato-sauce"]), entry("as-piece", ["mozzarella", "tomato-sauce"], ["tomato-sauce"])];
    expect(classifyNearMiss(signatureOfPizza(pizzaOf(["tomato-sauce"])), recipes, { catalog, recipes })).toBeNull();
  });
});

describe("P2-B multiple candidates: a line is true of the nearest one, whichever wins a tie", () => {
  const near1 = fake("near-1", ["tomato-sauce", "mozzarella", "egg"]);
  const near2 = fake("near-2", ["tomato-sauce", "mozzarella", "basil", "onion"]);
  const far = fake("far", ["pesto", "gorgonzola", "mushroom", "garlic", "ham"]);

  it("the nearest candidate decides the class; a farther one never overrides it", () => {
    expect(nearOf(["tomato-sauce", "mozzarella"], [far, near1])).toEqual({ kind: "ADD_ONE", distance: 1 });
    expect(nearOf(["tomato-sauce", "mozzarella"], [near1, far])).toEqual({ kind: "ADD_ONE", distance: 1 });
  });

  it("candidate order never changes the class or the distance", () => {
    const orders = [
      [near1, near2, far],
      [far, near2, near1],
      [near2, far, near1],
    ];
    const results = orders.map((o) => nearOf(["tomato-sauce", "mozzarella", "basil"], o));
    for (const r of results) expect(r).toEqual(results[0]);
  });

  it("an ADD and a REMOVE at the same distance: both statements are true, and the result is one class", () => {
    const add = fake("add-target", ["tomato-sauce", "mozzarella", "basil", "egg"]);
    const remove = fake("remove-target", ["tomato-sauce", "mozzarella"]);
    const r = nearOf(["tomato-sauce", "mozzarella", "basil"], [add, remove]);
    expect(r?.distance).toBe(1);
    expect(["ADD_ONE", "REMOVE_ONE"]).toContain(r?.kind);
  });

  it("no candidates -> null", () => {
    expect(nearOf(["tomato-sauce"], [])).toBeNull();
  });
});

describe("P2-B anti-spoiler is unchanged by the hardening", () => {
  it("the result keys are only kind / distance / keyUnused / sauceStep, and never hold an id or a name", () => {
    const recipes = [fake("secret-recipe-id", ["tomato-sauce", "mozzarella", "gorgonzola", "egg"])];
    const pizzas = [["tomato-sauce"], ["mozzarella", "egg"], ["pesto", "mozzarella", "gorgonzola", "egg"], ["egg"]];
    for (const ids of pizzas) {
      const r = nearOf(ids, recipes);
      if (!r) continue;
      expect(Object.keys(r).every((k) => ["kind", "distance", "keyUnused", "sauceStep"].includes(k))).toBe(true);
      const json = JSON.stringify(r);
      for (const hidden of ["secret-recipe-id", "gorgonzola", "ゴルゴンゾーラ"]) expect(json).not.toContain(hidden);
    }
  });
});
