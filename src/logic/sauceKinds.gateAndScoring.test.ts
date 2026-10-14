import { describe, expect, it } from "vitest";
import { getRecipe, RECIPES, type Recipe } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { getIngredient } from "../data/ingredients";
import type { PizzaState } from "../state/pizzaState";
import {
  commit,
  finishedPizza,
  otherSauceKind,
  recipeSauceKind,
  ringBatch,
  run,
  sauceStepState,
} from "../state/testSupport/sauceKindFixtures";
import { sauceOwnDeposits } from "../state/sauceLedger";
import { evaluatePizzaCompletion } from "./completionGate";
import { executionAdviceJa } from "../state/executionAdvice";
import { computeScoringV2 } from "./scoringV2";

const margherita = getRecipe("margherita")!;
const ideal = (n = 46) => ringBatch(50, 50, 25, n);
const thin = () => ringBatch(50, 50, 20, 2);

function pizzaOf(recipe: Recipe, ...actions: ReturnType<typeof commit>[]): PizzaState {
  return finishedPizza(recipe, run(sauceStepState(recipe), actions).pizza);
}
const failures = (recipe: Recipe, pizza: PizzaState) => {
  const r = evaluatePizzaCompletion(recipe, pizza);
  return r.status === "FAILED" ? r.failures.map((f) => f.reason) : [];
};

describe("Completion Gate: the required sauce is judged by ITS OWN deposits", () => {
  it("single sauce: unchanged (enough passes, thin fails)", () => {
    expect(failures(margherita, pizzaOf(margherita, commit("tomato-sauce", ideal())))).toEqual([]);
    expect(failures(margherita, pizzaOf(margherita, commit("tomato-sauce", thin())))).toContain("INSUFFICIENT_SAUCE");
  });

  it("another sauce's thick deposits do NOT stand in for a thin required sauce", () => {
    const p = pizzaOf(margherita, commit("tomato-sauce", thin()), commit("pesto", ideal()));
    expect(p.sauceIds).toEqual(["tomato-sauce", "pesto"]);
    expect(failures(margherita, p)).toContain("INSUFFICIENT_SAUCE");
  });

  it("a thick required sauce passes whatever else is on the pizza (the extra is a purity matter, not a Gate failure)", () => {
    const p = pizzaOf(margherita, commit("tomato-sauce", ideal()), commit("pesto", thin()));
    expect(failures(margherita, p)).toEqual([]);
  });

  it("the required sauce absent is still MISSING_REQUIRED_INGREDIENT, with other sauces present", () => {
    const p = pizzaOf(margherita, commit("pesto", ideal()), commit("olive-oil", ideal(20)));
    expect(failures(margherita, p)).toContain("MISSING_REQUIRED_INGREDIENT");
  });

  it("the one-shot exemption holds only for an EMPTY log: the required sauce applied instantly, then another sauce, is not exempt", () => {
    const state = run(sauceStepState(margherita), [{ type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 }]);
    expect(failures(margherita, finishedPizza(margherita, state.pizza))).toEqual([]); // exempt: nothing but the one-shot
    // a THICK pesto (a full ideal ring) must still not satisfy tomato: the reason is "tomato has no deposits of its own"
    const mixed = run(state, [commit("pesto", ideal())]);
    expect(mixed.pizza.sauceIds).toEqual(["tomato-sauce", "pesto"]);
    expect(sauceOwnDeposits(mixed.pizza, "tomato-sauce")).toEqual([]);
    expect(sauceOwnDeposits(mixed.pizza, "pesto")).toHaveLength(46);
    expect(failures(margherita, finishedPizza(margherita, mixed.pizza))).toContain("INSUFFICIENT_SAUCE");
  });

  it("the recipe-independent RESULT advice judges the pooled sauce (unchanged for one sauce)", () => {
    expect(executionAdviceJa(pizzaOf(margherita, commit("tomato-sauce", thin())))).not.toBeNull();
    expect(executionAdviceJa(pizzaOf(margherita, commit("tomato-sauce", ideal())))).toBeNull();
  });
});

describe("Scoring 2.0: the sauce component reads the reference sauce's own deposits", () => {
  const sauceScore = (r: Recipe, p: PizzaState) => {
    const result = computeScoringV2(r, p);
    return result.available ? result.components.sauce : null;
  };

  it("another sauce laid on top does not move the sauce component", () => {
    const only = pizzaOf(margherita, commit("tomato-sauce", ideal()));
    const withExtra = pizzaOf(margherita, commit("tomato-sauce", ideal()), commit("pesto", ideal(30)));
    expect(sauceScore(margherita, withExtra)).toEqual(sauceScore(margherita, only));
  });

  it("the extra kind is an extra TYPE in the Recipe component (the existing purity penalty), and only there", () => {
    const only = computeScoringV2(margherita, pizzaOf(margherita, commit("tomato-sauce", ideal())));
    const withExtra = computeScoringV2(margherita, pizzaOf(margherita, commit("tomato-sauce", ideal()), commit("pesto", thin())));
    expect(only.available && withExtra.available).toBe(true);
    if (!only.available || !withExtra.available) return;
    const a = only.components.recipe;
    const b = withExtra.components.recipe;
    if (!a.available || !b.available) throw new Error("recipe component unavailable");
    expect(b.extraTypesCount).toBe(a.extraTypesCount + 1);
    expect(b.purityMultiplier).toBeLessThan(a.purityMultiplier);
    expect(withExtra.components.pieces).toEqual(only.components.pieces);
    expect(withExtra.components.bake).toEqual(only.components.bake);
    expect(withExtra.rulesetVersion).toBe(only.rulesetVersion);
  });

  it("a one-shot required sauce followed by a thick painted sauce: the painted one never counts as the required sauce", () => {
    const state = run(sauceStepState(margherita), [
      { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 },
      commit("pesto", ideal()),
    ]);
    const component = sauceScore(margherita, finishedPizza(margherita, state.pizza));
    const empty = sauceScore(margherita, finishedPizza(margherita, sauceStepState(margherita).pizza));
    expect(component).not.toBeNull();
    expect(component).toEqual(empty); // scored on tomato's own (empty) deposits, exactly like a pizza with no sauce laid
  });

  it("a reference sauce that laid nothing scores as an empty sauce, not as the other sauce's quantity", () => {
    const p = pizzaOf(margherita, commit("pesto", ideal()), commit("olive-oil", ideal(10)));
    const own = sauceOwnDeposits(p, "tomato-sauce");
    expect(own).toEqual([]);
  });
});

describe("single-sauce pooled view == the reference sauce's own view, for every recipe (new recipes included)", () => {
  it("any one-kind pizza, right or wrong sauce, is judged on every deposit", () => {
    for (const recipe of RECIPES) {
      const own = recipeSauceKind(recipe);
      const kind = own ?? "tomato-sauce";
      for (const laid of [kind, otherSauceKind(kind)]) {
        const p = run(sauceStepState(recipe), [commit(laid, ideal(30))]).pizza;
        const ref = getReferencePizza(recipe.id)?.sauce?.ingredientId ?? kind;
        expect(sauceOwnDeposits(p, ref), `${recipe.id} laid ${laid}`).toHaveLength(30);
      }
      if (getIngredient(kind)?.category !== "sauce") throw new Error("sauce kind expected");
    }
  });
});
