import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { EMPTY_DEX } from "../../state/dex";
import { pizzaForFinalEvaluation } from "../../state/finishEngine";
import { evaluatePizzaCompletion } from "../completionGate";
import { FINISH_FIXTURE_RECIPE, finishedPizza, piece, preBakePizza } from "../../state/testSupport/finishFixture";
import { resolveFreeCookPizza, withFreeCookBakeWindow } from "./freeCook";
import { DEFAULT_IDENTITY_DIMENSIONS } from "./signature";
import type { RecipeDiscoveryTarget } from "./matcher";
import { ordinaryRecipes } from "../catalog/testSupport/lateIds";

/**
 * FIN-E4 (E3b independent review, low finding): Free Cooking identification and the FINAL cooking pass share one phase contract.
 * A late requirement is met by FINISH pieces only, so a pizza identification accepts can never be FAILED by the FINAL Gate.
 * Synthetic late recipe only -- nothing is added to `RECIPES`.
 *
 * Honest scope: no shipped recipe has a late requirement, and a correctly authored late target is already kept apart by the signature's
 * late axis, so these tests are contract pinning and defence in depth. Only the mis-authored-target case (a target with no late axis)
 * fails without the shared phase filter; the parity case guards a future regression.
 */
const targetOf = (late: unknown): RecipeDiscoveryTarget => ({
  targetId: "finish-fixture-bbq-target",
  recipeId: FINISH_FIXTURE_RECIPE.id,
  items: ["chicken", "mozzarella", "parsley", "tomato-sauce"],
  sauceBase: ["tomato-sauce"],
  capabilities: [],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, late } as RecipeDiscoveryTarget["identityDimensions"],
  eligibility: { status: "ELIGIBLE" },
});
const sourcesFor = (late: unknown) => ({
  catalog: [targetOf(late)],
  getRecipe: (id: string) => (id === FINISH_FIXTURE_RECIPE.id ? FINISH_FIXTURE_RECIPE : undefined),
});
const properLate = [["POST_BAKE", ["parsley"]]];
const baked = (p: ReturnType<typeof preBakePizza>) => ({ ...p, bakeResult: 68 });
const finalGate = (pizza: ReturnType<typeof preBakePizza>) =>
  evaluatePizzaCompletion(withFreeCookBakeWindow(FINISH_FIXTURE_RECIPE), pizzaForFinalEvaluation(FINISH_FIXTURE_RECIPE, pizza), "recipe").status;

describe("FIN-E4: Free identification honours the late-requirement phase contract", () => {
  it("parity: whatever identification accepts as MATCHED, the FINAL Completion Gate passes", () => {
    const withPre = { ...finishedPizza(1), toppings: [...finishedPizza(1).toppings, piece("parsley")] };
    for (const pizza of [finishedPizza(1), finishedPizza(2), withPre].map(baked)) {
      const r = resolveFreeCookPizza(pizza, EMPTY_DEX, sourcesFor(properLate));
      expect(r.kind).toBe("MATCHED");
      expect(finalGate(pizza)).toBe("PASS");
    }
  });

  it("pre-bake-only late ingredient is not identified as the late recipe (late axis), and is not MATCHED even for a target that lacks the axis", () => {
    const pizza = baked({ ...preBakePizza(), toppings: [...preBakePizza().toppings, piece("parsley")] });
    expect(finalGate(pizza)).toBe("FAILED");
    expect(resolveFreeCookPizza(pizza, EMPTY_DEX, sourcesFor(properLate)).kind).not.toBe("MATCHED");
    // A mis-authored target (no late axis): the whole-pizza Gate used to accept the pre-bake parsley; the shared phase filter does not.
    const r = resolveFreeCookPizza(pizza, EMPTY_DEX, sourcesFor([]));
    expect(r.kind).toBe("ORIGINAL");
    expect(r.kind === "ORIGINAL" && r.outcome.kind).toBe("INCOMPLETE_MATCH");
  });

  it("every shipped ordinary recipe is untouched: no late requirement, same pizza object", () => {
    for (const recipe of ordinaryRecipes(RECIPES)) {
      expect((recipe.requiredIngredients as readonly { applicationPhase?: string }[]).some((q) => q.applicationPhase === "POST_BAKE")).toBe(false);
      const p = baked(preBakePizza());
      expect(pizzaForFinalEvaluation(recipe, p)).toBe(p);
    }
  });
});
