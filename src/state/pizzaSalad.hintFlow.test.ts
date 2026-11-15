import { describe, expect, it } from "vitest";
import { buildHintLine } from "../data/hints";
import { RECIPES } from "../data/recipes";
import { createGuidedInitialState } from "./testSupport/guidedRound";
import { gameReducer, type GameState } from "./gameReducer";
import { createEmptyPizza } from "./pizzaState";

/**
 * Batch 25 C-3 (Owner-approved): pizza-salad's two required sauces are tomato-sauce (primary, painted) and yogurt-sauce (one presence dab, #856 I-7).
 * The Hint asks for the yogurt BEFORE the cheese, and that order must match what the real reducer operations do:
 * the SAUCE step is only complete after BOTH sauces are on the pizza, and one 0.02 dab is enough for the yogurt.
 */
const salad = RECIPES.find((r) => r.id === "pizza-salad")!;
const FIRST_FALLBACK = "まずはソースを塗ってみて！ピザを指でなぞると塗れるよ。"; // pizza-salad has no authored `empty` hint: the shared first-sauce line
const hint = (s: GameState) => buildHintLine(salad, s.pizza, s.makingStep, false).textJa;

function start(): GameState {
  const base = createGuidedInitialState("margherita", { ownedIngredientIds: ["tomato-sauce", "yogurt-sauce"] });
  return {
    ...base,
    inventory: { ...base.inventory, "tomato-sauce": 5, "yogurt-sauce": 5 }, // the EP3 stock gate: both sauces are in stock
    phase: "PREPARE",
    makingStep: "SAUCE",
    pizza: createEmptyPizza(),
  };
}
const ring = Array.from({ length: 12 }, (_, i) => ({ x: 50 + 25 * Math.cos((i / 12) * 2 * Math.PI), y: 50 + 25 * Math.sin((i / 12) * 2 * Math.PI), amount: 0.04 }));

describe("pizza-salad: the Hint order matches the real sauce operations", () => {
  it("is a two-sauce recipe: tomato-sauce first, yogurt-sauce second", () => {
    expect(salad.requiredIngredients.filter((r) => ["tomato-sauce", "yogurt-sauce"].includes(r.ingredientId)).map((r) => r.ingredientId)).toEqual(["tomato-sauce", "yogurt-sauce"]);
  });

  it("nothing painted -> the tomato; tomato painted -> the YOGURT (before the cheese); one yogurt dab -> the cheese", () => {
    let s = start();
    expect(hint(s)).toBe(FIRST_FALLBACK);
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: ring });
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(hint(s)).toBe("ヨーグルトソースも塗ってみよう！"); // before any cheese / topping line
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: [{ x: 40, y: 60, amount: 0.02 }] });
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce", "yogurt-sauce"]); // ONE tap / 0.02 is a complete second sauce
    expect(hint(s)).toBe("モッツァレラをのせてみよう！");
  });

  it("the yogurt alone does not satisfy the SAUCE step: the tomato is still asked for first", () => {
    let s = start();
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: [{ x: 40, y: 60, amount: 0.02 }] });
    expect(hint(s)).toBe(FIRST_FALLBACK);
  });
});
