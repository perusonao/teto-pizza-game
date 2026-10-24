import { describe, expect, it } from "vitest";
import { deriveCoreSteps } from "../data/cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { getIngredient } from "../data/ingredients";
import { getRecipe, type Recipe } from "../data/recipes";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { commit, finishedPizza, ringBatch, run, sauceStepState } from "../state/testSupport/sauceKindFixtures";
import { evaluatePizzaCompletion } from "./completionGate";
import { matchDiscovery, type RecipeDiscoveryTarget } from "./discovery/matcher";
import { researchResultRows } from "./discovery/researchResultRows";
import { signatureOfPizza } from "./discovery/signature";
import { scoreRecipeComponentV2 } from "./scoringV2/recipeComponent";
import { isLateRecipeId } from "./catalog/testSupport/lateIds";

/**
 * Issue #521 S2: guards for a recipe that REQUIRES TWO SAUCES (Owner policy: the first sauce is the Reference sauce, judged by its own amount
 * and coverage; the second is judged by use / not used).
 *
 * These run against a synthetic recipe shaped like `grandma-pizza` (S3 has since added the real one; `grandmaPizza.test.ts` pins that). For
 * the Completion Gate it borrows `margherita`'s id so the Reference (tomato-sauce, quantity / coverage floor) resolves -- exactly the situation
 * the real recipe will be in, since its primary sauce is tomato-sauce too. Nothing here edits production data; the existing one-sauce suites
 * (`sauceKinds.*`, `deductionProduction.gate`) stay as they are.
 */
const margherita = getRecipe("margherita")!;
const twoSauce = {
  ...margherita,
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "olive-oil", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 3 },
    { ingredientId: "garlic", minCount: 2 },
  ],
} as Recipe;

const ideal = () => ringBatch(50, 50, 25, 46);
const oneTick = () => ringBatch(50, 50, 25, 1);

function pizzaOf(...actions: ReturnType<typeof commit>[]): PizzaState {
  return finishedPizza(twoSauce, run(sauceStepState(twoSauce), actions).pizza);
}
const failureReasons = (pizza: PizzaState) => {
  const result = evaluatePizzaCompletion(twoSauce, pizza);
  return result.status === "FAILED" ? result.failures.map((f) => `${f.reason}:${f.ingredientId ?? ""}`) : [];
};

describe("Completion Gate: both sauces required, the first judged by amount, the second by use", () => {
  it("both sauces laid properly: PASS", () => {
    const p = pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal()));
    expect(p.sauceIds).toEqual(["tomato-sauce", "olive-oil"]);
    expect(evaluatePizzaCompletion(twoSauce, p).status).toBe("PASS");
  });

  it("the second sauce missing: FAILED with MISSING_REQUIRED_INGREDIENT naming it", () => {
    expect(failureReasons(pizzaOf(commit("tomato-sauce", ideal())))).toEqual(["MISSING_REQUIRED_INGREDIENT:olive-oil"]);
  });

  it("the first sauce missing: FAILED naming it (another sauce never stands in)", () => {
    expect(failureReasons(pizzaOf(commit("olive-oil", ideal())))).toEqual(["MISSING_REQUIRED_INGREDIENT:tomato-sauce"]);
    expect(failureReasons(pizzaOf(commit("pesto", ideal()), commit("olive-oil", ideal())))).toContain("MISSING_REQUIRED_INGREDIENT:tomato-sauce");
  });

  it("use / not used for the second sauce: a single faint dab of it passes (Owner policy: presence only, no amount floor)", () => {
    expect(evaluatePizzaCompletion(twoSauce, pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", oneTick()))).status).toBe("PASS");
  });

  it("the first sauce keeps its amount floor: a thin tomato fails even beside a thick second sauce", () => {
    expect(failureReasons(pizzaOf(commit("tomato-sauce", ringBatch(50, 50, 20, 2)), commit("olive-oil", ideal())))).toEqual(["INSUFFICIENT_SAUCE:tomato-sauce"]);
  });

  it("the order the sauces were painted in does not matter", () => {
    const a = pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal()));
    const b = pizzaOf(commit("olive-oil", ideal()), commit("tomato-sauce", ideal()));
    expect(evaluatePizzaCompletion(twoSauce, a).status).toBe("PASS");
    expect(evaluatePizzaCompletion(twoSauce, b).status).toBe("PASS");
  });
});

describe("Scoring 2.0 Recipe component: the second sauce is one more required type, never a purity extra", () => {
  it("both present: 4 of 4, no extras", () => {
    const c = scoreRecipeComponentV2(twoSauce, pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal())));
    expect(c).toMatchObject({ available: true, requiredTypesPresent: 4, requiredTypesTotal: 4, extraTypesCount: 0, score: 100 });
  });

  it("second sauce missing: 3 of 4", () => {
    const c = scoreRecipeComponentV2(twoSauce, pizzaOf(commit("tomato-sauce", ideal())));
    expect(c).toMatchObject({ available: true, requiredTypesPresent: 3, requiredTypesTotal: 4, extraTypesCount: 0 });
  });

  it("a third sauce (not required) IS an extra type", () => {
    const c = scoreRecipeComponentV2(twoSauce, pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal()), commit("pesto", oneTick())));
    expect(c).toMatchObject({ available: true, requiredTypesPresent: 4, extraTypesCount: 1 });
  });
});

describe("Discovery: a two-sauce target is matched exactly, and adds no ambiguity to production", () => {
  const target: RecipeDiscoveryTarget = {
    targetId: "synthetic-two-sauce",
    recipeId: "margherita", // the type needs a RecipeId; it is never read by the matcher
    // derived exactly as `RECIPE_DISCOVERY_CATALOG` derives it from `requiredIngredients`
    items: [...new Set(twoSauce.requiredIngredients.map((r) => r.ingredientId))].sort(),
    sauceBase: [...new Set(twoSauce.requiredIngredients.map((r) => r.ingredientId).filter((id) => getIngredient(id)?.category === "sauce"))].sort(),
    capabilities: [],
    identityDimensions: RECIPE_DISCOVERY_CATALOG[0].identityDimensions,
    eligibility: { status: "ELIGIBLE" },
  };

  const pizzaFrom = (sauceIds: string[], pieceIds: string[], pan: "tray" | null = null): PizzaState => {
    const pizza = createEmptyPizza();
    pizza.pan = pan;
    pizza.sauceIds = sauceIds;
    pizza.toppings = pieceIds.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 10 + i * 8, y: 50 }));
    return pizza;
  };

  it("the target's sauceBase carries both sauces", () => {
    expect(target.sauceBase).toEqual(["olive-oil", "tomato-sauce"]);
  });

  it("both sauces + the pieces: a unique match, whichever sauce was laid first", () => {
    for (const sauces of [["tomato-sauce", "olive-oil"], ["olive-oil", "tomato-sauce"]]) {
      expect(matchDiscovery(signatureOfPizza(pizzaFrom(sauces, ["mozzarella", "garlic"])), [target]).kind).toBe("UNIQUE_MATCH");
    }
  });

  it("one sauce only, a different second sauce, or an extra third sauce: no match", () => {
    for (const sauces of [["tomato-sauce"], ["olive-oil"], ["tomato-sauce", "pesto"], ["tomato-sauce", "olive-oil", "pesto"]]) {
      expect(matchDiscovery(signatureOfPizza(pizzaFrom(sauces, ["mozzarella", "garlic"])), [target]).kind, sauces.join("+")).toBe("NO_MATCH");
    }
  });

  it("in the production catalog (which now holds grandma-pizza): the two-sauce pizza is discovered only on the tray (E-AC2 / AC3), and every production recipe still matches uniquely (no collision)", () => {
    const catalog = RECIPE_DISCOVERY_CATALOG;
    // E-AC2: cooked round (pan absent / null), the exact grandma ingredients are NOT a discovery.
    expect(matchDiscovery(signatureOfPizza(pizzaFrom(["tomato-sauce", "olive-oil"], ["mozzarella", "garlic"])), catalog).kind).toBe("NO_MATCH");
    // E-AC3: cooked on the tray, they match grandma-pizza uniquely.
    expect(matchDiscovery(signatureOfPizza(pizzaFrom(["tomato-sauce", "olive-oil"], ["mozzarella", "garlic"], "tray")), catalog)).toMatchObject({ kind: "UNIQUE_MATCH", target: { targetId: "grandma-pizza-pizzadb" } });
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      if (isLateRecipeId(t.recipeId)) continue; // E5: needs post-bake pieces (late axis); collision is pinned in lateCatalog.ikura.test.ts
      const sauces = t.sauceBase ?? [];
      const pieces = t.items.filter((id) => !sauces.includes(id));
      const match = matchDiscovery(signatureOfPizza(pizzaFrom([...sauces], pieces, t.identityDimensions?.pan === "tray" ? "tray" : null)), catalog);
      expect(match, t.recipeId).toMatchObject({ kind: "UNIQUE_MATCH", target: { targetId: t.targetId } });
    }
  });
});

describe("Research rows: every sauce on the pizza is judged, and nothing says how many the target has", () => {
  it("a one-sauce target (margherita) with tomato + oil on the pizza: tomato POSITIVE, oil NEGATIVE, in placement order", () => {
    const r = researchResultRows({ targetRecipeId: "margherita", pizza: { sauceIds: ["tomato-sauce", "olive-oil"], toppings: [] }, knownIngredientIds: [] });
    expect(r.rows).toEqual([
      { ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" },
      { ingredientId: "olive-oil", category: "sauce", verdict: "NEGATIVE" },
    ]);
  });

  it("the rows depend only on the pizza and the target's members: a tomato-only pizza gets the same single row whether or not a second sauce exists", () => {
    const only = researchResultRows({ targetRecipeId: "margherita", pizza: { sauceIds: ["tomato-sauce"], toppings: [] }, knownIngredientIds: [] });
    expect(only.rows).toEqual([{ ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" }]);
  });
});

describe("Cooking steps: one SAUCE step covers both sauces", () => {
  it("DOUGH, SAUCE, CHEESE, TOPPING (the same four tabs as a one-sauce recipe; no new step)", () => {
    expect(deriveCoreSteps(twoSauce)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(deriveCoreSteps(margherita)).toEqual(deriveCoreSteps(twoSauce));
  });
});
