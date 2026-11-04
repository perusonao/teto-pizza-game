import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES, type Recipe } from "../../data/recipes";
import { planDinnerBake, resolveDinnerIdentity } from "../../mission/dinner/dinnerResultDetection";
import type { PizzaState } from "../../state/pizzaState";
import {
  commit,
  finishedPizza,
  otherSauceKind,
  recipeSauceKind,
  ringBatch,
  run,
  SAUCE_KINDS,
  sauceStepState,
} from "../../state/testSupport/sauceKindFixtures";
import { evaluateDiscovery } from "./matcher";
import { resolveFreeCookPizza } from "./freeCook";
import { classifyNearMiss } from "./nearMiss";
import { signatureOfPizza } from "./signature";
import { MULTI_SAUCE_RECIPE_IDS, requiredSauceIds } from "../testSupport/requiredSauces";

/**
 * Sauce B1, Research / Dex / near-miss / Dinner Mission: a pizza that carries TWO OR MORE sauce kinds must never be
 * identified as a recipe (no false discovery, no false Dinner CLEAR) and must not leak anything the player did not
 * already have. No catalog target uses two sauces, so the exact-match rule makes the first part structural; the tests
 * pin it so a future recipe or matcher change cannot silently break it.
 */
const ideal = () => ringBatch(50, 50, 25, 46);
const faint = () => ringBatch(50, 50, 20, 2);

const withSauces = (recipe: Recipe, kinds: readonly string[]): PizzaState =>
  finishedPizza(
    recipe,
    run(sauceStepState(recipe), kinds.map((k, i) => commit(k, i === 0 ? ideal() : faint()))).pizza,
  );

// The one-sauce recipes with a spread sauce. A two-sauce recipe (grandma-pizza, Multi-Sauce S3) is deliberately NOT here: its own composition IS a mixed pizza,
// so "an extra sauce makes it no recipe" does not apply; it is covered by `grandmaPizza.test.ts` and `multiSauce.guards.test.ts`.
const saucy = RECIPES.filter((r) => recipeSauceKind(r) !== null && !MULTI_SAUCE_RECIPE_IDS.includes(r.id));

describe("no catalog target uses two sauce kinds, except the allowlisted two-sauce recipes (the structural reason an unplanned mixed pizza cannot match)", () => {
  it("every target's sauceBase has at most one sauce, except the allowlisted two-sauce recipes, which have exactly their two", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      if (MULTI_SAUCE_RECIPE_IDS.includes(t.recipeId)) expect([...(t.sauceBase ?? [])], t.recipeId).toEqual(requiredSauceIds(t.recipeId).sort());
      else expect((t.sauceBase ?? []).length, t.recipeId).toBeLessThanOrEqual(1);
    }
  });
});

describe("a pizza with an extra sauce kind is never identified as a recipe", () => {
  it("every recipe's own composition + one or two extra sauce kinds: no discovery, no Free Cooking match, no Dinner identity", () => {
    for (const recipe of saucy) {
      const own = recipeSauceKind(recipe)!;
      const extras = SAUCE_KINDS.filter((k) => k !== own);
      for (const kinds of [[own, extras[0]], [own, extras[1]], [own, extras[0], extras[1]]]) {
        const pizza = withSauces(recipe, kinds);
        const sig = signatureOfPizza(pizza);
        expect(sig.sauceBase.value, `${recipe.id} ${kinds}`).toEqual([...kinds].sort());
        expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, []).kind, recipe.id).toBe("ORIGINAL");
        expect(resolveFreeCookPizza(pizza, sauceStepState(recipe).dex).kind, recipe.id).not.toBe("MATCHED");
        expect(resolveDinnerIdentity(pizza).kind, recipe.id).toBe("NONE");
        const plan = planDinnerBake(pizza);
        expect(plan.bakeWindow.source).toBe("GENERIC"); // the Free Cooking fallback, exactly like any unmatched pizza
        expect(plan.cutRequired).toBe(false);
      }
    }
  });

  it("positive control: the recipe's own composition with its ONE sauce is still identified", () => {
    const recipe = RECIPES.find((r) => r.id === "margherita")!;
    const pizza = withSauces(recipe, ["tomato-sauce"]);
    expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("NEW_DISCOVERY");
    expect(resolveDinnerIdentity(pizza)).toEqual({ kind: "RECIPE", recipeId: "margherita" });
  });

  it("a NO_SAUCE recipe's composition with any sauce is not that recipe either (unchanged: one wrong sauce already broke it)", () => {
    for (const recipe of RECIPES.filter((r) => recipeSauceKind(r) === null)) {
      const pizza = withSauces(recipe, ["tomato-sauce", "pesto"]);
      expect(resolveDinnerIdentity(pizza).kind, recipe.id).toBe("NONE");
    }
  });
});

describe("a one-shot sauce followed by a painted one is a mixed pizza too (Codex P2)", () => {
  it("is identified as no recipe, whichever sauce was applied first", () => {
    for (const recipe of saucy) {
      const own = recipeSauceKind(recipe)!;
      const extra = otherSauceKind(own);
      const state = run(sauceStepState(recipe), [{ type: "APPLY_SAUCE", ingredientId: own, x: 50, y: 50 }, commit(extra, ideal())]);
      const pizza = finishedPizza(recipe, state.pizza);
      expect(signatureOfPizza(pizza).sauceBase.value, recipe.id).toEqual([own, extra].sort());
      expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, []).kind, recipe.id).toBe("ORIGINAL");
      expect(resolveDinnerIdentity(pizza).kind, recipe.id).toBe("NONE");
    }
  });
});

describe("near-miss: an extra sauce reveals nothing", () => {
  it("the class does not depend on WHICH extra sauce was added (no probing the identity of a sauce)", () => {
    for (const recipe of saucy) {
      const own = recipeSauceKind(recipe)!;
      const classes = SAUCE_KINDS.filter((k) => k !== own).map((extra) =>
        classifyNearMiss(signatureOfPizza(withSauces(recipe, [own, extra])), RECIPES),
      );
      expect(classes[0], recipe.id).toEqual(classes[1]);
    }
  });

  it("the right toppings with a mixed sauce read as 'only the sauce differs', with the existing generic wording step", () => {
    for (const recipe of saucy) {
      const own = recipeSauceKind(recipe)!;
      const near = classifyNearMiss(signatureOfPizza(withSauces(recipe, [own, otherSauceKind(own)])), RECIPES);
      expect(near, recipe.id).toMatchObject({ kind: "SAUCE_ONLY", distance: 1, sauceStep: "CHANGE" });
    }
  });

  it("that is the same line a single WRONG sauce already gets (no new class or wording is introduced)", () => {
    const recipe = RECIPES.find((r) => r.id === "margherita")!;
    const wrongOnly = classifyNearMiss(signatureOfPizza(withSauces(recipe, ["pesto"])), RECIPES);
    const mixed = classifyNearMiss(signatureOfPizza(withSauces(recipe, ["tomato-sauce", "pesto"])), RECIPES);
    expect(mixed).toEqual(wrongOnly);
  });
});

describe("identity ignores how much sauce: a faint extra still changes the sauce set, a one-sauce pizza never does", () => {
  it("one sauce kind: the signature is the same whatever the amounts", () => {
    const recipe = RECIPES.find((r) => r.id === "margherita")!;
    const a = signatureOfPizza(finishedPizza(recipe, run(sauceStepState(recipe), [commit("tomato-sauce", ideal())]).pizza));
    const b = signatureOfPizza(finishedPizza(recipe, run(sauceStepState(recipe), [commit("tomato-sauce", faint())]).pizza));
    expect(a).toEqual(b);
  });
});
