import { describe, expect, it } from "vitest";
import { evaluatePizzaCompletion } from "./completionGate";
import { computeScoringV2 } from "./scoringV2";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../state/pizzaState";

/**
 * Completion Gate Phase 1 (docs/reports/TETO_COMPLETION-GATE_PHASE1_Result.md): pure unit
 * coverage for `evaluatePizzaCompletion` itself, independent of the reducer -- see
 * ../state/gameReducer.completionGate.test.ts for FAILED semantics (reward/Dex/progression/
 * inventory) at the CONFIRM_BAKE/REGISTER_TO_DEX integration layer.
 */

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

/** A ring of `count` sauce deposits at `radius`% around the dough's center -- the same shape
 *  ../state/gameReducer.scoringV2Authority.test.ts's own `ring()` helper uses, reproduced here
 *  since these are independent test files by this repo's own convention (no shared test-utils
 *  module). `ring(25, 16)` clears the gate's own sauce floor while staying well below the
 *  "poor" sauce tier boundary -- see completionGate.ts's own SAUCE_MIN_RATIO comment. */
function ring(radius: number, count: number, amount = 0.02): SauceDeposit[] {
  const deposits: SauceDeposit[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({ x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, amount });
  }
  return deposits;
}

/** A single tight dab -- the "1回触っただけ" case the spec explicitly calls out: far too little
 *  quantity/coverage to be a real application. */
function singleDab(): SauceDeposit[] {
  return [{ x: 55, y: 55, amount: 0.02 }];
}

/** An ideal, Reference-matching margherita: exact minCounts, exact positions, the fixture the
 *  Reference popover itself is built from for sauce. */
function idealMargherita(bakeResult: number): PizzaState {
  const reference = getReferencePizza("margherita")!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `margherita-ideal-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
    bakeResult,
  });
}

describe("evaluatePizzaCompletion", () => {
  it("1. a complete, ideal pizza -> PASS", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(70));
    expect(result.status).toBe("PASS");
  });

  it("2. a required ingredient present 0 times -> FAILED MISSING_REQUIRED_INGREDIENT", () => {
    const pizza = idealMargherita(70);
    const withoutBasil = { ...pizza, toppings: pizza.toppings.filter((t) => t.ingredientId !== "basil") };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, withoutBasil);
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("MISSING_REQUIRED_INGREDIENT");
    expect(result.status === "FAILED" && result.ingredientId).toBe("basil");
  });

  it("3. minCount - 1 (2 of 3 required mozzarella) -> FAILED INSUFFICIENT_REQUIRED_AMOUNT", () => {
    const pizza = idealMargherita(70);
    const mozzarella = pizza.toppings.filter((t) => t.ingredientId === "mozzarella");
    expect(mozzarella.length).toBe(3); // margherita's own minCount
    const oneShort = {
      ...pizza,
      toppings: pizza.toppings.filter((t) => t.id !== mozzarella[0].id),
    };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, oneShort);
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("INSUFFICIENT_REQUIRED_AMOUNT");
    expect(result.status === "FAILED" && result.ingredientId).toBe("mozzarella");
  });

  it("4. minCount exactly -> PASS candidate (Completion Gate side)", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(70));
    expect(result.status).toBe("PASS");
  });

  it("5. minCount + extra -> still PASSes the Completion Gate (quality is Scoring 2.0's job)", () => {
    const pizza = idealMargherita(70);
    const withExtra = {
      ...pizza,
      toppings: [...pizza.toppings, { id: "extra-mozz", ingredientId: "mozzarella", x: 20, y: 80 }],
    };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, withExtra);
    expect(result.status).toBe("PASS");
  });

  it("6. no sauce at all -> FAILED (tomato-sauce minCount 1, count 0)", () => {
    const pizza = idealMargherita(70);
    const noSauce = { ...pizza, sauceIds: [], sauceDeposits: [] };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, noSauce);
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("MISSING_REQUIRED_INGREDIENT");
    expect(result.status === "FAILED" && result.ingredientId).toBe("tomato-sauce");
  });

  it("7. sauce applied but barely (a single dab, 1回触っただけ) -> FAILED INSUFFICIENT_SAUCE", () => {
    const pizza = idealMargherita(70);
    const barelyTouched = { ...pizza, sauceDeposits: singleDab() };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, barelyTouched);
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("INSUFFICIENT_SAUCE");
    expect(result.status === "FAILED" && result.ingredientId).toBe("tomato-sauce");
  });

  it("8. sauce at (or just above) the gate's own minimum -> PASS", () => {
    const pizza = idealMargherita(70);
    // ring(25, 16) is deliberately mediocre (well below the "poor" tier boundary) but clears
    // the gate's own floor -- see this file's own `ring()` doc comment.
    const minimalButReal = { ...pizza, sauceDeposits: ring(25, 16) };
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, minimalButReal);
    expect(result.status).toBe("PASS");
  });

  it("9. ideal sauce -> PASS", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(70));
    expect(result.status).toBe("PASS");
  });

  it("10. clear underbake (well below the acceptable margin) -> FAILED UNDERBAKED", () => {
    // margin = (80-60)*0.5 = 10 -> FAIL boundary is 50; 20 is clearly below it.
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(20));
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("UNDERBAKED");
  });

  it("11. acceptable slightly underbaked (inside the margin, outside the perfect zone) -> PASS", () => {
    // 52 is between the FAIL boundary (50) and the perfect zone's own start (60).
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(52));
    expect(result.status).toBe("PASS");
  });

  it("12. ideal bake (inside the perfect zone) -> PASS", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(70));
    expect(result.status).toBe("PASS");
  });

  it("13. acceptable slightly overbaked (inside the margin, outside the perfect zone) -> PASS", () => {
    // 88 is between the perfect zone's own end (80) and the FAIL boundary (90).
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(88));
    expect(result.status).toBe("PASS");
  });

  it("14. clear overbake/burnt (well beyond the acceptable margin) -> FAILED OVERBAKED", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(99));
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("OVERBAKED");
  });

  it("15. within the PASS range, Bake Score still varies (Scoring 2.0 is untouched by the gate)", () => {
    const recipe = getRecipe("margherita")!;
    const edge = idealMargherita(52); // acceptable but degraded
    const ideal = idealMargherita(70); // dead center of the perfect zone
    expect(evaluatePizzaCompletion(recipe, edge).status).toBe("PASS");
    expect(evaluatePizzaCompletion(recipe, ideal).status).toBe("PASS");
    const edgeScore = computeScoringV2(recipe, edge).components.bake;
    const idealScore = computeScoringV2(recipe, ideal).components.bake;
    expect(edgeScore.available && idealScore.available).toBe(true);
    if (edgeScore.available && idealScore.available) {
      expect(idealScore.score).toBeGreaterThan(edgeScore.score);
      expect(idealScore.score).toBe(100);
    }
  });

  it("boundary: exactly at the FAIL/PASS bake edge is PASS (only strictly outside the margin fails)", () => {
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, idealMargherita(50));
    expect(result.status).toBe("PASS");
  });

  it("multiple simultaneous failures: priority picks the ingredient failure over the bake one", () => {
    const pizza = idealMargherita(20); // clear underbake
    const noSauce = { ...pizza, sauceIds: [], sauceDeposits: [] }; // + missing sauce
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, noSauce);
    expect(result.status).toBe("FAILED");
    expect(result.status === "FAILED" && result.reason).toBe("MISSING_REQUIRED_INGREDIENT");
    // Both failures are still recorded, even though only one is surfaced as primary.
    expect(result.status === "FAILED" && result.failures.map((f) => f.reason)).toContain("UNDERBAKED");
  });

  it("malformed pizza (non-array toppings/sauceIds/sauceDeposits) fails closed, never throws", () => {
    const malformed = {
      ...createEmptyPizza(),
      toppings: null as unknown as PizzaState["toppings"],
      sauceIds: "not-an-array" as unknown as PizzaState["sauceIds"],
      sauceDeposits: undefined as unknown as PizzaState["sauceDeposits"],
      bakeResult: 70,
    };
    expect(() => evaluatePizzaCompletion(getRecipe("margherita")!, malformed)).not.toThrow();
    const result = evaluatePizzaCompletion(getRecipe("margherita")!, malformed);
    // Sanitizes to a genuinely empty pizza -- every required ingredient reads as missing.
    expect(result.status).toBe("FAILED");
  });

  it("27. all 13 recipes can be evaluated by the Completion Gate (PASS for an ideal pizza, FAILED for an empty one)", () => {
    const allIds: readonly RecipeId[] = RECIPES.map((r) => r.id);
    expect(allIds.length).toBe(13);
    for (const id of allIds) {
      const recipe = getRecipe(id)!;
      const reference = getReferencePizza(id);
      expect(reference).not.toBeNull();
      const idealPizza = pizzaWith({
        sauceIds: [reference!.sauce.ingredientId],
        sauceDeposits: buildIdealSauceFixture(),
        toppings: reference!.pieceGroups.flatMap((group, gi) =>
          group.positions.map((p, i) => ({
            id: `${id}-ideal-${gi}-${i}`,
            ingredientId: group.ingredientId,
            ...p,
          })),
        ),
        bakeResult: Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2),
      });
      expect(evaluatePizzaCompletion(recipe, idealPizza).status).toBe("PASS");

      const emptyPizza = pizzaWith({ bakeResult: recipe.bakeTarget.start });
      const emptyResult = evaluatePizzaCompletion(recipe, emptyPizza);
      expect(emptyResult.status).toBe("FAILED");
    }
  });
});
