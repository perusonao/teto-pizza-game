import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe, type RecipeRequirement } from "../data/recipes";
import { referencePizzaFor } from "./testSupport/confirmBakeMatrix";
import { MAX_VISIBLE_COOKING_TABS, deriveCoreSteps, getCookingProfile, visibleCookingTabCount } from "../data/cookingProfiles";
import { INGREDIENTS, getIngredient, type IngredientCategory } from "../data/ingredients";
import { bakeCompletionFailure } from "../logic/completionGate";
import { EMPTY_DEX } from "./dex";
import { finalizeRound, type FinalizeRoundInput } from "./finalizeRound";
import { finishAllowedForRound, hasPostBakeRequirement, pizzaForFinalEvaluation, postBakePieces, withoutPostBakeRequirements } from "./finishEngine";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { canPlaceIngredient, canPlacePostBakeIngredient, consumePizzaInventory, consumePostBakeInventory, type InventoryState } from "./inventory";
import type { RoundKind } from "./roundKind";
import { undoablePlacementIndex } from "./undoPlacement";
import { atBake, atBakeFreeWith, bakeValueFor, UNMATCHED_FREE_PIZZAS, ROUND_MODES } from "./testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, finishedPizza, piece, preBakePizza } from "./testSupport/finishFixture";

const STOCK: InventoryState = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 9]));

function input(recipe: Recipe, pizza = preBakePizza(), over: Partial<FinalizeRoundInput> = {}): FinalizeRoundInput {
  return { recipe, pizza, bakeValue: 70, freeCook: false, isMissionRound: false, roundKind: "GUIDED" as RoundKind, dex: EMPTY_DEX, inventory: STOCK, ...over };
}

describe("Production stays inert (D1a)", () => {
  it("no RECIPES requirement is applied after the bake, and no shipped profile has FINISH", () => {
    for (const recipe of RECIPES) {
      expect(recipe.requiredIngredients.every((r) => (r as RecipeRequirement).applicationPhase === undefined), recipe.id).toBe(true);
      expect(hasPostBakeRequirement(recipe), recipe.id).toBe(false);
      expect(getCookingProfile(recipe.id).steps, recipe.id).not.toContain("FINISH");
    }
  });

  it("the Free Cooking round has no FINISH step", () => {
    const free = gameReducer(createInitialGameState(EMPTY_DEX, INGREDIENTS.map((i) => i.id), 0, STOCK), { type: "START_FREE_COOK" });
    expect(free.cookingProfile.steps).not.toContain("FINISH");
  });

  it("deriveCoreSteps equals the pre-FINISH derivation for every RECIPES entry (oracle)", () => {
    const legacy = (recipe: Recipe) => {
      const categories = new Set<IngredientCategory>();
      for (const req of recipe.requiredIngredients) {
        const ing = getIngredient(req.ingredientId);
        if (ing) categories.add(ing.category);
      }
      return ["DOUGH", ...(categories.has("sauce") ? ["SAUCE"] : []), ...(categories.has("cheese") ? ["CHEESE"] : []), ...(categories.has("topping") ? ["TOPPING"] : [])];
    };
    for (const recipe of RECIPES) expect(deriveCoreSteps(recipe), recipe.id).toEqual(legacy(recipe));
  });

  it("withoutPostBakeRequirements returns the very same recipe object for every RECIPES entry", () => {
    for (const recipe of RECIPES) expect(withoutPostBakeRequirements(recipe)).toBe(recipe);
  });

  it("Lunch Rush and Dinner are excluded from FINISH (fail-closed until UD-I)", () => {
    expect(finishAllowedForRound({ roundKind: "LUNCH_RUSH" })).toBe(false);
    expect(finishAllowedForRound({ roundKind: "DINNER" })).toBe(false);
    expect(finishAllowedForRound({ roundKind: "GUIDED" })).toBe(true);
  });
});

describe("FINISH step derivation (fixture)", () => {
  it("appends FINISH after the pre-bake steps, from the recipe's own requirement", () => {
    expect(deriveCoreSteps(FX)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]);
  });

  it("a late-only topping adds FINISH but no TOPPING step", () => {
    const lateOnly: Recipe = { ...FX, requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "parsley", minCount: 1, applicationPhase: "POST_BAKE" }] };
    expect(deriveCoreSteps(lateOnly)).toEqual(["DOUGH", "SAUCE", "FINISH"]);
  });

  it("stays within the 6-tab ceiling without CUT; FINISH + CUT would need 7 (the gate would fail)", () => {
    const steps = deriveCoreSteps(FX);
    expect(visibleCookingTabCount({ steps })).toBeLessThanOrEqual(MAX_VISIBLE_COOKING_TABS);
    expect(visibleCookingTabCount({ steps: [...steps, "CUT"] })).toBeGreaterThan(MAX_VISIBLE_COOKING_TABS);
  });
});

describe("the provisional recipe", () => {
  it("drops only the late requirement", () => {
    const provisional = withoutPostBakeRequirements(FX);
    expect(provisional.requiredIngredients.map((r) => r.ingredientId)).toEqual(["tomato-sauce", "mozzarella", "chicken"]);
    expect(FX.requiredIngredients).toHaveLength(4);
  });
});

describe("post-only stock rules", () => {
  const parsley = getIngredient("parsley")!;
  it("only FINISH pieces count against the stock (a pre-bake piece of the same ingredient is not charged twice)", () => {
    const withPre = { ...preBakePizza(), toppings: [...preBakePizza().toppings, piece("parsley")] };
    const inv: InventoryState = { parsley: 1 };
    expect(canPlaceIngredient(parsley, inv, withPre)).toBe(false); // the whole-pizza gate double counts
    expect(canPlacePostBakeIngredient(parsley, inv, withPre)).toBe(true);
    const onePost = { ...withPre, toppings: [...withPre.toppings, piece("parsley", "post")] };
    expect(canPlacePostBakeIngredient(parsley, inv, onePost)).toBe(false);
  });

  it("refuses a spread ingredient and an unowned (0 stock) finite one", () => {
    expect(canPlacePostBakeIngredient(getIngredient("tomato-sauce")!, STOCK, preBakePizza())).toBe(false);
    expect(canPlacePostBakeIngredient(parsley, {}, preBakePizza())).toBe(false);
  });

  it("consumes the FINISH pieces only, leaving the pre-bake pieces and the sauce to CONFIRM_BAKE", () => {
    const pizza = finishedPizza(2);
    const before: InventoryState = { parsley: 5, chicken: 5 };
    const after = consumePostBakeInventory(pizza, before);
    expect(after).toEqual({ parsley: 3, chicken: 5 });
    expect(before).toEqual({ parsley: 5, chicken: 5 });
    expect(consumePostBakeInventory(preBakePizza(), before)).toBe(before);
  });

  it("provisional + FINISH consumption equals one whole-pizza consumption", () => {
    const pizza = finishedPizza(2);
    const split = consumePostBakeInventory(pizza, consumePizzaInventory(preBakePizza(), STOCK));
    expect(split).toEqual(consumePizzaInventory(pizza, STOCK));
  });
});

describe("FINISH-only Undo", () => {
  const ctx = (pizza = finishedPizza(2), over = {}) => ({ phase: "POST_BAKE" as const, makingStep: "FINISH" as const, roundKind: "GUIDED" as RoundKind, pizza, ...over });
  it("targets the last FINISH piece and never a pre-bake piece", () => {
    const pizza = finishedPizza(2);
    expect(undoablePlacementIndex(ctx(pizza))).toBe(pizza.toppings.length - 1);
    expect(pizza.toppings[undoablePlacementIndex(ctx(pizza))].stage).toBe("post");
    expect(undoablePlacementIndex(ctx(finishedPizza(0)))).toBe(-1);
    // a stage-less parsley (placed before the bake) is not undoable in FINISH
    expect(undoablePlacementIndex(ctx({ ...preBakePizza(), toppings: [piece("parsley")] }))).toBe(-1);
  });
  it("is refused in Lunch Rush, Dinner, other POST_BAKE steps and RESULT", () => {
    expect(undoablePlacementIndex(ctx(undefined, { roundKind: "LUNCH_RUSH" }))).toBe(-1);
    expect(undoablePlacementIndex(ctx(undefined, { roundKind: "DINNER" }))).toBe(-1);
    expect(undoablePlacementIndex(ctx(undefined, { makingStep: "CUT" }))).toBe(-1);
    expect(undoablePlacementIndex(ctx(undefined, { phase: "RESULT" }))).toBe(-1);
  });
  it("postBakePieces lists only FINISH pieces", () => {
    expect(postBakePieces(finishedPizza(2))).toHaveLength(2);
    expect(postBakePieces(preBakePizza())).toHaveLength(0);
  });
});

describe("finalizeRound: provisional -> final (OD-CS-2 = B)", () => {
  it("an absent / SINGLE / PROVISIONAL finalization is identical for every RECIPES entry x mode", () => {
    for (const recipe of RECIPES) {
      for (const mode of ROUND_MODES) {
        const state = atBake(mode, recipe.id);
        const base = { recipe: state.recipe, pizza: state.pizza, bakeValue: bakeValueFor(mode, state, "good"), freeCook: state.freeCook, isMissionRound: state.isMissionRound, roundKind: state.roundKind, dex: state.dex, inventory: state.inventory };
        const absent = finalizeRound(base);
        expect(finalizeRound({ ...base, finalization: "SINGLE" }), `${recipe.id}/${mode}`).toEqual(absent);
        expect(finalizeRound({ ...base, finalization: "PROVISIONAL" }), `${recipe.id}/${mode}`).toEqual(absent);
      }
    }
  }, 120_000);

  it("Free Cooking always runs as a single pass", () => {
    const state = atBakeFreeWith(UNMATCHED_FREE_PIZZAS["odd-mix"]);
    const base = { recipe: state.recipe, pizza: state.pizza, bakeValue: 70, freeCook: true, isMissionRound: false, roundKind: state.roundKind, dex: state.dex, inventory: state.inventory };
    for (const finalization of ["PROVISIONAL", "FINAL"] as const) expect(finalizeRound({ ...base, finalization })).toEqual(finalizeRound(base));
  });

  it("PROVISIONAL does not demand the late ingredient; FINAL does (0 pieces is not a success)", () => {
    expect(finalizeRound(input(FX, preBakePizza(), { finalization: "PROVISIONAL" })).completion.status).toBe("PASS");
    const nothing = finalizeRound(input(FX, preBakePizza(), { finalization: "FINAL" }));
    expect(nothing.completion.status).toBe("FAILED");
    expect(nothing.completion.status === "FAILED" && nothing.completion.failures.map((f) => f.reason)).toContain("MISSING_REQUIRED_INGREDIENT");
    expect(finalizeRound(input(FX, finishedPizza(2), { finalization: "FINAL" })).completion.status).toBe("PASS");
  });

  it("the single-pass result on the same finished pizza is the FINAL result (the full recipe is judged)", () => {
    const pizza = finishedPizza(2);
    const final = finalizeRound(input(FX, pizza, { finalization: "FINAL" }));
    const single = finalizeRound(input(FX, pizza));
    expect(final.completion).toEqual(single.completion);
    expect(final.kind === "SCORED" && single.kind === "SCORED" && final.score).toEqual(single.kind === "SCORED" && single.score);
  });

  it("FINAL consumes only the FINISH pieces, and re-evaluating is deterministic and does not mutate", () => {
    const pizza = finishedPizza(2);
    const snapshot = JSON.stringify(pizza);
    const provisional = finalizeRound(input(FX, preBakePizza(), { finalization: "PROVISIONAL" }));
    const final = finalizeRound(input(FX, pizza, { finalization: "FINAL", inventory: provisional.inventory }));
    expect(final.inventory).toEqual(consumePizzaInventory(pizza, STOCK));
    expect(finalizeRound(input(FX, pizza, { finalization: "FINAL", inventory: provisional.inventory }))).toEqual(final);
    expect(JSON.stringify(pizza)).toBe(snapshot);
  });

  it("a pre-bake piece of the late ingredient does not satisfy the late requirement (Codex P2 on #491)", () => {
    const withEarlyParsley = { ...preBakePizza(), toppings: [...preBakePizza().toppings, piece("parsley"), piece("parsley")] };
    const final = finalizeRound(input(FX, withEarlyParsley, { finalization: "FINAL" }));
    expect(final.completion.status).toBe("FAILED");
    expect(final.completion.status === "FAILED" && final.completion.failures.map((f) => f.reason)).toContain("MISSING_REQUIRED_INGREDIENT");
    // the returned pizza is the real one, and the early pieces are still charged nowhere twice
    expect(final.pizza.toppings).toHaveLength(withEarlyParsley.toppings.length);
    // pre pieces + ONE FINISH piece: the Gate ("recipe" policy) needs one, so PASS; Lunch Rush's "order" (2) would still fail
    const mixed = { ...withEarlyParsley, toppings: [...withEarlyParsley.toppings, piece("parsley", "post")] };
    expect(finalizeRound(input(FX, mixed, { finalization: "FINAL" })).completion.status).toBe("PASS");
    expect(finalizeRound(input(FX, mixed, { finalization: "FINAL", isMissionRound: true })).completion.status).toBe("FAILED");
  });

  it("a FINISH piece of an ordinary (pre-bake) ingredient cannot repair a missing ordinary ingredient (Codex P2 #2 on #491)", () => {
    const noChicken = { ...preBakePizza(), toppings: preBakePizza().toppings.filter((t) => t.ingredientId !== "chicken") };
    const repaired = { ...noChicken, toppings: [...noChicken.toppings, piece("chicken", "post"), piece("chicken", "post"), piece("parsley", "post"), piece("parsley", "post")] };
    const final = finalizeRound(input(FX, repaired, { finalization: "FINAL" }));
    expect(final.completion.status).toBe("FAILED");
    expect(final.completion.status === "FAILED" && final.completion.failures.map((f) => f.ingredientId)).toContain("chicken");
    // an ingredient the recipe does not require is untouched
    expect(pizzaForFinalEvaluation(FX, { toppings: [piece("basil", "post"), piece("basil")] }).toppings).toHaveLength(2);
  });

  it("the provisional score stays available for a recipe with a Reference and a late requirement (Codex P2 on finalizeRound)", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")! as unknown as Recipe;
    const late: Recipe = { ...margherita, requiredIngredients: margherita.requiredIngredients.map((r) => (r.ingredientId === "basil" ? { ...r, applicationPhase: "POST_BAKE" as const } : r)) };
    const full = referencePizzaFor("margherita");
    const pre = { ...full, toppings: full.toppings.filter((t) => t.ingredientId !== "basil") };
    const provisional = finalizeRound(input(late, pre, { finalization: "PROVISIONAL" }));
    expect(provisional.kind === "SCORED" && provisional.scoringV2Result.available).toBe(true);
    expect(provisional.completion.status).toBe("PASS"); // basil is not demanded before FINISH
    const finished = { ...full, toppings: full.toppings.map((t) => (t.ingredientId === "basil" ? { ...t, stage: "post" as const } : t)) };
    const final = finalizeRound(input(late, finished, { finalization: "FINAL" }));
    expect(final.kind === "SCORED" && final.scoringV2Result.available).toBe(true);
    expect(final.completion.status).toBe("PASS");
  });

  it("pizzaForFinalEvaluation returns the same pizza for every RECIPES entry and for a fixture pizza with no early late-ingredient", () => {
    for (const recipe of RECIPES) {
      const pizza = preBakePizza();
      expect(pizzaForFinalEvaluation(recipe, pizza)).toBe(pizza);
    }
    const done = finishedPizza(2);
    expect(pizzaForFinalEvaluation(FX, done)).toBe(done);
  });

  it("a failed bake is visible from the provisional pass (OD-CS-7 = A input); a composition-only failure is not a bake failure", () => {
    const burnt = finalizeRound(input(FX, preBakePizza(), { finalization: "PROVISIONAL", bakeValue: 100 }));
    expect(bakeCompletionFailure(burnt.completion)).toBe("OVERBAKED");
    const raw = finalizeRound(input(FX, preBakePizza(), { finalization: "PROVISIONAL", bakeValue: 10 }));
    expect(bakeCompletionFailure(raw.completion)).toBe("UNDERBAKED");
    const short = { ...preBakePizza(), toppings: preBakePizza().toppings.slice(0, 1) };
    const composition = finalizeRound(input(FX, short, { finalization: "PROVISIONAL" }));
    expect(composition.completion.status).toBe("FAILED");
    expect(bakeCompletionFailure(composition.completion)).toBeNull();
  });
});
