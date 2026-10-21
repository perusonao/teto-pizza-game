import { describe, expect, it } from "vitest";
import { MAX_VISIBLE_COOKING_TABS, deriveCoreSteps, getCookingProfile, visibleCookingTabCount } from "../../data/cookingProfiles";
import { getIngredient } from "../../data/ingredients";
import { RECIPES, participatesInLunchRush, type RecipeRequirement } from "../../data/recipes";
import { DINNER_MISSIONS, validateDinnerMissions } from "../../mission/dinner/dinnerMission";
import { missionOrderRecipeIds } from "../../mission/lunchRush";
import { EMPTY_DEX } from "../../state/dex";
import { canPlacePostBakeIngredient } from "../../state/inventory";
import { isRecipeCookable, recipeStockShortage } from "../../state/recipeDiscoveryState";
import { productionCatalogView, validateCatalogTables, validateFinishCatalog } from "./testSupport/recipeBatchValidator";
import { SYNTHETIC_LATE_ID, syntheticCatalogView, syntheticLateRecipe } from "./testSupport/syntheticLateCatalog";

/**
 * FINISH FIN-E1 (Issue #294 / TQ-2 #604): the safety guards that must hold BEFORE a recipe with a late addition can be
 * added (E4) and FINISH switched on (E5). Everything here is test-side: the shipped catalog has no late recipe, so every guard
 * is vacuous for Production (asserted first), and each guard is proven to BITE on a synthetic catalog (TQ-1C precedent), never
 * by adding a recipe or an ingredient to `RECIPES`.
 */
describe("Production is unchanged: no late recipe, FINISH is not in any shipped profile", () => {
  it("the production catalog passes every table check, including the FINISH guards", () => {
    const view = productionCatalogView();
    expect(validateCatalogTables(view)).toEqual([]);
    expect(validateFinishCatalog(view)).toEqual([]);
  });

  it("no shipped recipe asks for a late addition and none has FINISH; every strip fits the tab ceiling", () => {
    for (const recipe of RECIPES) {
      expect((recipe.requiredIngredients as readonly RecipeRequirement[]).some((q) => q.applicationPhase === "POST_BAKE"), recipe.id).toBe(false);
      const profile = getCookingProfile(recipe.id);
      expect(profile.steps, recipe.id).not.toContain("FINISH");
      expect(visibleCookingTabCount(profile), recipe.id).toBeLessThanOrEqual(MAX_VISIBLE_COOKING_TABS);
    }
  });

  it("no Dinner mission targets a recipe that would need FINISH", () => {
    for (const mission of DINNER_MISSIONS) {
      for (const id of mission.targetRecipeIds) {
        expect(getCookingProfile(id).steps, `${mission.missionId}/${id}`).not.toContain("FINISH");
      }
    }
  });
});

describe("synthetic catalog: a well-formed late recipe passes (FINISH is wired, but only for a late recipe)", () => {
  it("passes every table check and every FINISH guard", () => {
    const view = syntheticCatalogView();
    expect(validateCatalogTables(view)).toEqual([]);
    expect(deriveCoreSteps(syntheticLateRecipe())).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]);
  });

  it("the synthetic recipe is never part of RECIPES (the catalog is untouched)", () => {
    expect(RECIPES.some((r) => r.id === SYNTHETIC_LATE_ID)).toBe(false);
  });
});

describe("synthetic catalog: each guard bites", () => {
  const problems = (view: ReturnType<typeof syntheticCatalogView>) => validateCatalogTables(view);

  it("LATE_WITHOUT_FINISH: a late requirement whose profile has no FINISH", () => {
    expect(problems(syntheticCatalogView(syntheticLateRecipe(), { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] }))).toContain(`LATE_WITHOUT_FINISH: ${SYNTHETIC_LATE_ID}`);
  });

  it("FINISH_WITHOUT_LATE: FINISH on a recipe with no late requirement", () => {
    const plain = syntheticLateRecipe({ requiredIngredients: syntheticLateRecipe().requiredIngredients.map((q) => ({ ingredientId: q.ingredientId, minCount: q.minCount })) });
    expect(problems(syntheticCatalogView(plain, { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] }))).toContain(`FINISH_WITHOUT_LATE: ${SYNTHETIC_LATE_ID}`);
  });

  it("LATE_WITH_CUT + TAB_CEILING: FINISH and CUT together make 7 tabs", () => {
    const view = syntheticCatalogView(syntheticLateRecipe(), { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"] });
    expect(problems(view)).toEqual(expect.arrayContaining([`LATE_WITH_CUT: ${SYNTHETIC_LATE_ID}`, `TAB_CEILING: ${SYNTHETIC_LATE_ID} 7 tabs`]));
  });

  it("TAB_CEILING also fires for a recipe with no late requirement (the ceiling is catalog-wide)", () => {
    const plain = syntheticLateRecipe({ requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "mozzarella", minCount: 2 }] });
    const view = syntheticCatalogView(plain, { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL", "CUT"] });
    expect(problems(view)).toContain(`TAB_CEILING: ${SYNTHETIC_LATE_ID} 8 tabs`);
  });

  it("LATE_IN_LUNCH_RUSH: a late recipe that forgot `lunchRush: false` (the pool opts IN by default)", () => {
    const forgot = syntheticLateRecipe({ lunchRush: undefined });
    expect(participatesInLunchRush(forgot.id, [...RECIPES, forgot])).toBe(true); // why the guard exists
    expect(problems(syntheticCatalogView(forgot))).toContain(`LATE_IN_LUNCH_RUSH: ${SYNTHETIC_LATE_ID}`);
    expect(participatesInLunchRush(SYNTHETIC_LATE_ID, [...RECIPES, syntheticLateRecipe()])).toBe(false);
    // the real pool never offers a recipe outside RECIPES, and an opted-out recipe is filtered by the same merge point
    expect(missionOrderRecipeIds({ dex: EMPTY_DEX, ownedIngredientIds: [], inventory: {} }, [], [...RECIPES, syntheticLateRecipe()])).not.toContain(SYNTHETIC_LATE_ID);
  });

  it("LATE_IN_DINNER: a Dinner mission targeting a late recipe (the structural mission validator does not catch it)", () => {
    const mission = { ...DINNER_MISSIONS[0], targetRecipeIds: [...DINNER_MISSIONS[0].targetRecipeIds.slice(0, 3), SYNTHETIC_LATE_ID] };
    expect(validateDinnerMissions([mission], [...RECIPES, syntheticLateRecipe()])).toEqual([]); // why the catalog guard exists
    expect(problems(syntheticCatalogView(syntheticLateRecipe(), { dinnerTarget: true }))).toContain(`LATE_IN_DINNER: ${SYNTHETIC_LATE_ID}`);
  });

  it("LATE_NOT_TOPPING: a late cheese or sauce (FINISH places scatter toppings only; liquids are #579)", () => {
    const cheese = syntheticLateRecipe({ requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "chicken", minCount: 2 }, { ingredientId: "mozzarella", minCount: 2, applicationPhase: "POST_BAKE" }] });
    expect(getIngredient("mozzarella")?.category).toBe("cheese");
    expect(problems(syntheticCatalogView(cheese))).toContain(`LATE_NOT_TOPPING: ${SYNTHETIC_LATE_ID} mozzarella`);
    const sauce = syntheticLateRecipe({ requiredIngredients: [{ ingredientId: "chicken", minCount: 2 }, { ingredientId: "tomato-sauce", minCount: 1, applicationPhase: "POST_BAKE" }] });
    expect(problems(syntheticCatalogView(sauce))).toContain(`LATE_NOT_TOPPING: ${SYNTHETIC_LATE_ID} tomato-sauce`);
  });

  it("LATE_BOTH_PHASES: one ingredient required both before and after the bake", () => {
    const both = syntheticLateRecipe({ requiredIngredients: [...syntheticLateRecipe().requiredIngredients, { ingredientId: "parsley", minCount: 1 }] });
    expect(problems(syntheticCatalogView(both))).toContain(`LATE_BOTH_PHASES: ${SYNTHETIC_LATE_ID} parsley`);
  });

  it("LATE_NO_REFERENCE: no Reference pizza, or fewer Reference pieces of the late ingredient than the requirement", () => {
    expect(problems(syntheticCatalogView(syntheticLateRecipe(), { referencePieces: null }))).toContain(`LATE_NO_REFERENCE: ${SYNTHETIC_LATE_ID} parsley (no Reference < 2)`);
    expect(problems(syntheticCatalogView(syntheticLateRecipe(), { referencePieces: { chicken: 3, mozzarella: 3, parsley: 1 } }))).toContain(
      `LATE_NO_REFERENCE: ${SYNTHETIC_LATE_ID} parsley (1 < 2)`,
    );
  });

  it("a shipped recipe forced to carry FINISH is caught (the guard watches Production data too)", () => {
    const view = productionCatalogView();
    const target = RECIPES[0].id;
    const tampered = { ...view, cookingSteps: (id: string) => (id === target ? [...view.cookingSteps(id), "FINISH"] : view.cookingSteps(id)) };
    expect(validateFinishCatalog(tampered)).toContain(`FINISH_WITHOUT_LATE: ${target}`);
  });
});

describe("stock: a late recipe is startable only with the late ingredient in stock, and FINISH placement stops at the stock", () => {
  const recipe = syntheticLateRecipe();
  const owned = ["tomato-sauce", "mozzarella", "chicken", "parsley"];
  const stock = (parsley: number) => ({ "tomato-sauce": 5, mozzarella: 5, chicken: 5, parsley });

  it("zero late stock: not cookable, and the shortage names the late ingredient", () => {
    expect(isRecipeCookable(recipe, { ownedIngredientIds: owned, inventory: stock(0) })).toBe(false);
    expect(recipeStockShortage(recipe, { ownedIngredientIds: owned, inventory: stock(0) }).map((s) => s.ingredientId)).toContain("parsley");
  });

  it("one short of the requirement: not cookable; exactly the requirement: cookable", () => {
    expect(isRecipeCookable(recipe, { ownedIngredientIds: owned, inventory: stock(1) })).toBe(false);
    expect(isRecipeCookable(recipe, { ownedIngredientIds: owned, inventory: stock(2) })).toBe(true);
  });

  it("an unowned late ingredient is not cookable even with stock", () => {
    expect(isRecipeCookable(recipe, { ownedIngredientIds: ["tomato-sauce", "mozzarella", "chicken"], inventory: stock(9) })).toBe(false);
  });

  it("FINISH placement boundary: the stock-th piece is allowed, the next one is refused (only post pieces count)", () => {
    const parsley = getIngredient("parsley")!;
    const post = (n: number) => ({ toppings: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, ingredientId: "parsley", x: 50, y: 50, stage: "post" as const })) });
    const pre = { toppings: [{ id: "pre", ingredientId: "parsley", x: 50, y: 50 }] };
    expect(canPlacePostBakeIngredient(parsley, stock(2), post(1))).toBe(true);
    expect(canPlacePostBakeIngredient(parsley, stock(2), post(2))).toBe(false);
    expect(canPlacePostBakeIngredient(parsley, stock(1), pre)).toBe(true); // a pre-bake piece is already consumed: it does not count again
    expect(canPlacePostBakeIngredient(parsley, stock(0), post(0))).toBe(false);
  });
});
