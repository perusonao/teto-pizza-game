import { describe, expect, it } from "vitest";
import { capStarsForBake, scorePizza, starsFromTotal } from "./scoring";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { getRecipe, type Recipe } from "../data/recipes";

// A minimal recipe used purely as scoring input; reuses a real RecipeId ("margherita")
// since RecipeId is a closed union derived from data/recipes.ts, but the requirements/
// bakeTarget below are shaped for these tests, not copied from the real Margherita.
const RECIPE: Recipe = {
  id: "margherita",
  nameJa: "test recipe",
  description: "",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 1 },
  ],
  bakeTarget: { start: 60, end: 80 },
};

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

describe("starsFromTotal", () => {
  const cases: Array<[number, 1 | 2 | 3 | 4 | 5]> = [
    [0, 1],
    [39, 1],
    [40, 2],
    [59, 2],
    [60, 3],
    [74, 3],
    [75, 4],
    [89, 4],
    [90, 5],
    [100, 5],
  ];

  for (const [total, expected] of cases) {
    it(`total ${total} -> ${expected} star(s)`, () => {
      expect(starsFromTotal(total)).toBe(expected);
    });
  }
});

describe("capStarsForBake", () => {
  it("keeps 5 stars for a perfect bake", () => {
    expect(capStarsForBake(5, "perfect")).toBe(5);
  });

  it("caps 5 stars down to 4 for a raw bake", () => {
    expect(capStarsForBake(5, "raw")).toBe(4);
  });

  it("caps 5 stars down to 4 for a burnt bake", () => {
    expect(capStarsForBake(5, "burnt")).toBe(4);
  });

  it("never raises stars below 5, and leaves them untouched when bake isn't perfect", () => {
    expect(capStarsForBake(4, "raw")).toBe(4);
    expect(capStarsForBake(3, "burnt")).toBe(3);
    expect(capStarsForBake(1, "raw")).toBe(1);
  });
});

describe("scorePizza", () => {
  it("scores a fully-correct, well-placed, perfectly-baked pizza at 100 / ★5", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
      bakeResult: 70, // inside the 60-80 target
    });
    const score = scorePizza(RECIPE, pizza);
    expect(score.total).toBe(100);
    expect(score.stars).toBe(5);
  });

  it("applies the 35/15/20/30 weighted formula", () => {
    // Only tomato-sauce present: matches 1 of 2 required ingredients (mozzarella missing).
    const pizza = pizzaWith({ sauceIds: ["tomato-sauce"], bakeResult: 70 });
    const score = scorePizza(RECIPE, pizza);
    expect(score.matchScore).toBe(50); // 1/2 required satisfied
    expect(score.ingredientScore).toBe(100); // the only ingredient used is a required one
    expect(score.placementScore).toBe(100); // no toppings to place: not structurally penalized
    expect(score.bakeScore).toBe(100); // inside target
    expect(score.total).toBeCloseTo(50 * 0.35 + 100 * 0.15 + 100 * 0.2 + 100 * 0.3);
  });

  it("caps a 90+ raw pizza at ★4", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
      bakeResult: 55, // just below the 60-80 target -> raw, but bakeScore still high
    });
    const score = scorePizza(RECIPE, pizza);
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.stars).toBe(4);
  });

  it("caps a 90+ burnt pizza at ★4", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
      bakeResult: 85, // just above the 60-80 target -> burnt, but bakeScore still high
    });
    const score = scorePizza(RECIPE, pizza);
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.stars).toBe(4);
  });
});

describe("scorePizza -- salami-pizza (Phase 3C-6, real production recipe)", () => {
  const SALAMI_PIZZA = getRecipe("salami-pizza")!;

  /** 5 required toppings (2 mozzarella + 3 salami) spread evenly around a ring -- well within
   *  the dough and far enough apart to earn full placement credit, exactly like any other
   *  recipe (salami gets no special-cased placement scoring, per SSOT section 14). */
  function wellPlacedToppings(): PizzaState["toppings"] {
    const items = [
      { id: "t1", ingredientId: "mozzarella" },
      { id: "t2", ingredientId: "mozzarella" },
      { id: "t3", ingredientId: "salami" },
      { id: "t4", ingredientId: "salami" },
      { id: "t5", ingredientId: "salami" },
    ];
    return items.map((item, i) => {
      const angle = (i / items.length) * Math.PI * 2;
      return { ...item, x: 50 + Math.cos(angle) * 26, y: 50 + Math.sin(angle) * 26 };
    });
  }

  it("can reach ★★★★★ with correct ingredients, good placement, and a perfect bake", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: wellPlacedToppings(),
      bakeResult: (SALAMI_PIZZA.bakeTarget.start + SALAMI_PIZZA.bakeTarget.end) / 2,
    });
    const score = scorePizza(SALAMI_PIZZA, pizza);
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.stars).toBe(5);
  });

  it("is not unfairly penalized for salami's 3-item placement (same generic placement scoring)", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: wellPlacedToppings(),
      bakeResult: (SALAMI_PIZZA.bakeTarget.start + SALAMI_PIZZA.bakeTarget.end) / 2,
    });
    const score = scorePizza(SALAMI_PIZZA, pizza);
    expect(score.placementScore).toBe(100);
  });

  it("caps at ★4 even with perfect ingredients/placement when the bake is raw", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: wellPlacedToppings(),
      bakeResult: SALAMI_PIZZA.bakeTarget.start - 2, // just under target -> raw
    });
    const score = scorePizza(SALAMI_PIZZA, pizza);
    expect(score.stars).toBeLessThanOrEqual(4);
  });

  it("caps at ★4 even with perfect ingredients/placement when the bake is burnt", () => {
    const pizza = pizzaWith({
      sauceIds: ["tomato-sauce"],
      toppings: wellPlacedToppings(),
      bakeResult: SALAMI_PIZZA.bakeTarget.end + 2, // just over target -> burnt
    });
    const score = scorePizza(SALAMI_PIZZA, pizza);
    expect(score.stars).toBeLessThanOrEqual(4);
  });
});
