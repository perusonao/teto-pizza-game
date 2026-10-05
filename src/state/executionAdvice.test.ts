import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../data/recipes";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { executionAdviceJa, genericSauceReference, SAUCE_THIN_ADVICE_JA } from "./executionAdvice";
import { createEmptyPizza, type PizzaState } from "./pizzaState";

/**
 * Discovery 3.0 PR-1: the recipe-independent execution advice. It is a pure function of the player's own pizza:
 * it must equal the Completion Gate's "sauce too thin" floor, and must not move with the composition.
 */
const IDEAL = buildIdealSauceFixture();
const funghi = RECIPES.find((r) => r.id === "funghi") as unknown as Recipe;

function pizza(deposits: PizzaState["sauceDeposits"], toppings: string[] = ["mozzarella", "mushroom"], sauceIds: string[] = ["tomato-sauce"]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds,
    sauceDeposits: deposits,
    bakeResult: 68,
    toppings: toppings.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 40 + i * 4, y: 50 })),
  };
}

describe("the shared sauce reference", () => {
  it("every recipe's Reference sauce amount equals the generic one (the assumption the advice rests on)", () => {
    const generic = genericSauceReference();
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id)!;
      // TQ-1D: aussie has no sauce Reference, so there is no sauce amount to compare.
      if (reference.sauce === null) {
        expect(recipe.id).toBe("aussie");
        continue;
      }
      expect({ id: recipe.id, quantity: reference.sauce.quantity, coverage: reference.sauce.coverage }).toEqual({ id: recipe.id, ...generic });
    }
  });
});

describe("executionAdviceJa", () => {
  it("a single dab is too thin; the ideal sauce is not", () => {
    expect(executionAdviceJa(pizza(IDEAL.slice(0, 1)))).toBe(SAUCE_THIN_ADVICE_JA);
    expect(executionAdviceJa(pizza(IDEAL))).toBeNull();
  });

  it("says nothing without a sauce, and for the instant-fill action (no deposit log) exactly like the gate", () => {
    expect(executionAdviceJa(pizza(IDEAL.slice(0, 1), ["mozzarella"], []))).toBeNull();
    expect(executionAdviceJa(pizza([]))).toBeNull();
  });

  it("is the Completion Gate's own sauce floor: same verdict as INSUFFICIENT_SAUCE for every prefix of the ideal fixture", () => {
    for (let n = 1; n <= IDEAL.length; n += 1) {
      const px = pizza(IDEAL.slice(0, n));
      const gate = evaluatePizzaCompletion(funghi, { ...px, toppings: [...px.toppings, { id: "t9", ingredientId: "mushroom", x: 60, y: 60 }] });
      const gateThin = gate.status === "FAILED" && gate.failures.some((f) => f.reason === "INSUFFICIENT_SAUCE");
      expect(executionAdviceJa(px) !== null, `prefix ${n}`).toBe(gateThin);
    }
  });

  it("does not depend on the composition: any toppings, any sauce id, the same advice", () => {
    const thin = IDEAL.slice(0, 1);
    const compositions: [string[], string[]][] = [
      [["mozzarella", "mushroom"], ["tomato-sauce"]],
      [["basil", "egg"], ["tomato-sauce"]],
      [["mozzarella", "mushroom"], ["pesto"]],
      [[], ["olive-oil"]],
      [["garlic", "oregano", "anchovy", "tuna"], ["tomato-sauce"]],
    ];
    for (const [toppings, sauces] of compositions) {
      expect(executionAdviceJa(pizza(thin, toppings, sauces))).toBe(SAUCE_THIN_ADVICE_JA);
      expect(executionAdviceJa(pizza(IDEAL, toppings, sauces))).toBeNull();
    }
  });

  it("is deterministic and total on malformed input (fails closed to no advice)", () => {
    expect(executionAdviceJa(pizza(IDEAL.slice(0, 1)))).toBe(executionAdviceJa(pizza(IDEAL.slice(0, 1))));
    expect(executionAdviceJa({ ...createEmptyPizza(), sauceIds: ["tomato-sauce"], sauceDeposits: "x" as never })).toBeNull();
    expect(executionAdviceJa(null as never)).toBeNull();
  });

  it("names no recipe, ingredient or distance", () => {
    expect(SAUCE_THIN_ADVICE_JA).not.toMatch(/図鑑|レシピ|あと少し|おしい|近い|正解|材料|[0-9]/);
  });
});
