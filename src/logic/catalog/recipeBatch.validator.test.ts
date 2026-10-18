import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { NEXT_RECIPE_BATCH, RECIPE_BATCHES } from "./testSupport/recipeBatchManifest";
import {
  productionCatalogView,
  validateBatchManifest,
  validateCatalogTables,
  type CatalogView,
  type RecipeBatchManifest,
} from "./testSupport/recipeBatchValidator";

/** Recipe Batch Validator (minimal): cross-table consistency a recipe batch must keep. See recipeBatchValidator.ts. */
const view = productionCatalogView();
const tail = RECIPES[RECIPES.length - 1].id;

describe("production catalog", () => {
  it("passes the cross-table checks", () => {
    expect(validateCatalogTables(view)).toEqual([]);
  });

  it("Batch 8a is LANDED and consistent: appended tail, append-only ladder, cohort / chapter identity, explicit declarations", () => {
    expect(RECIPE_BATCHES).toContain(NEXT_RECIPE_BATCH);
    expect(NEXT_RECIPE_BATCH.status).toBe("landed");
    expect(NEXT_RECIPE_BATCH.recipes.map((r) => r.recipeId)).toEqual(["chilean-napolitana", "spanish-chorizo-pizza", "frango-catupiry"]);
    expect(NEXT_RECIPE_BATCH.recipes.map((r) => r.keyIngredientId)).toEqual(["fresh-tomato", "bell-pepper", "catupiry"]);
    expect(validateBatchManifest(NEXT_RECIPE_BATCH, view)).toEqual([]);
  });
});

/** The validator must actually fire: each check against a synthetic break (so it is never a tautology). */
describe("validator catches", () => {
  const withRecipes = (recipes: CatalogView["recipes"]): CatalogView => ({ ...view, recipes });
  const last = RECIPES[RECIPES.length - 1];

  it("recipe id / ingredient id duplicates and unknown ingredients", () => {
    expect(validateCatalogTables(withRecipes([...RECIPES, RECIPES[0]]))).toContain(`RECIPE_ID_DUPLICATE: ${RECIPES[0].id}`);
    expect(validateCatalogTables({ ...view, ingredients: [...view.ingredients, view.ingredients[0]] })).toContain(`INGREDIENT_ID_DUPLICATE: ${view.ingredients[0].id}`);
    const ghost = { ...last, id: "ghost" as typeof last.id, requiredIngredients: [{ ingredientId: "no-such-ingredient", minCount: 1 }] };
    expect(validateCatalogTables(withRecipes([...RECIPES, ghost]))).toContain("INGREDIENT_UNKNOWN: ghost needs no-such-ingredient");
  });

  it("a finite material no ladder step unlocks", () => {
    expect(validateCatalogTables({ ...view, ladder: { ...view.ladder, steps: view.ladder.steps.slice(0, -1) } }).some((p) => p.startsWith(`MATERIAL_NOT_ON_LADDER: ${view.ladder.steps.at(-1)!.ingredientIds[0]}`))).toBe(true);
  });

  it("CUT eligibility without a CUT step, a step the runtime does not wire, an unsupported capability", () => {
    expect(validateCatalogTables({ ...view, isCutEligible: (id) => id === "margherita" || view.isCutEligible(id), cookingSteps: (id) => view.cookingSteps(id).filter((s) => s !== "CUT") })).toContain("CUT_PROFILE_MISMATCH: margherita");
    expect(validateCatalogTables({ ...view, cookingSteps: (id) => (id === tail ? [...view.cookingSteps(id), "FOLD"] : view.cookingSteps(id)) })).toContain(`STEP_NOT_WIRED: ${tail} uses FOLD`);
    expect(validateCatalogTables({ ...view, targetCapabilities: (id) => (id === tail ? ["calzone-fold"] : []) })).toContain(`CAPABILITY_UNSUPPORTED: ${tail} needs calzone-fold`);
  });

  it("a planned batch that already exists, or is not next in line", () => {
    const planned: RecipeBatchManifest = { ...NEXT_RECIPE_BATCH, status: "planned" };
    const exists: RecipeBatchManifest = { ...planned, recipes: [{ recipeId: tail, keyIngredientId: "almond" }] };
    expect(validateBatchManifest(exists, view)).toEqual(expect.arrayContaining([`PLANNED_RECIPE_EXISTS: ${tail}`, "PLANNED_INGREDIENT_EXISTS: almond"]));
    expect(validateBatchManifest({ ...planned, afterRecipeId: "aussie" }, view)).toContain("BASE_NOT_LAST: aussie is not the last recipe");
  });

  it("a landed batch with a wrong tail (No. identity), a missing / wrong declaration, or a moved ladder", () => {
    const landed = NEXT_RECIPE_BATCH;
    const [first, ...rest] = landed.recipes;
    const id = first.recipeId;
    expect(validateBatchManifest({ ...landed, afterRecipeId: "aussie" }, view).some((p) => p.startsWith("NO_IDENTITY"))).toBe(true);
    expect(validateBatchManifest({ ...landed, recipes: [{ ...first, lunchRush: undefined, cut: undefined }, ...rest] }, view)).toEqual(expect.arrayContaining([`DECLARATION_MISSING: ${id}.lunchRush`, `DECLARATION_MISSING: ${id}.cut`]));
    expect(validateBatchManifest({ ...landed, recipes: [{ ...first, lunchRush: true, cut: true, hint: "keyed", ladderCredit: true }, ...rest] }, view)).toEqual(
      expect.arrayContaining([`LUNCH_RUSH_MISMATCH: ${id} declared true`, `CUT_MISMATCH: ${id} declared true`, `HINT_MISMATCH: ${id} declared keyed`, `LADDER_CREDIT_MISMATCH: ${id} declared true`]),
    );
  });

  it("a credited batch whose key material is not the ladder step's / the recipe's last material (Batch 7a, the previous credited batch, as the fixture)", () => {
    const base7a = RECIPES.slice(0, RECIPES.findIndex((r) => r.id === "new-zealand-lamb-pizza") + 1);
    const view7a: CatalogView = { ...view, recipes: base7a };
    const batch7a: RecipeBatchManifest = {
      batchId: "batch-7a",
      status: "landed",
      afterRecipeId: "spinach-artichoke-pizza",
      recipes: [
        { recipeId: "eggplant-ricotta-pizza", keyIngredientId: "mint", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
        { recipeId: "new-zealand-lamb-pizza", keyIngredientId: "sweet-potato", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
      ],
    };
    expect(validateBatchManifest(batch7a, view7a)).toEqual([]);
    const wrong = { ...batch7a, recipes: [{ ...batch7a.recipes[0], keyIngredientId: "zucchini" }, batch7a.recipes[1]] };
    expect(validateBatchManifest(wrong, view7a)).toEqual(expect.arrayContaining([expect.stringMatching(/^LADDER_MATERIAL|^COHORT_UNLOCK/)]));
  });

  it("a non-credit batch's cohort letter shifts must be listed exactly (accepted shift missing / not observed / unknown recipe)", () => {
    const landed = NEXT_RECIPE_BATCH;
    expect(validateBatchManifest({ ...landed, acceptedLetterShifts: {} }, view)).toEqual(expect.arrayContaining(["COHORT_LETTER_SHIFT: pesto-caprese - -> A"]));
    expect(validateBatchManifest({ ...landed, acceptedLetterShifts: { ...landed.acceptedLetterShifts, margherita: "-->A" } }, view)).toContain("ACCEPTED_LETTER_SHIFT_NOT_OBSERVED: margherita");
    expect(validateBatchManifest({ ...landed, acceptedLetterShifts: { ...landed.acceptedLetterShifts, ghost: "-->A" } }, view)).toContain("ACCEPTED_LETTER_SHIFT_UNKNOWN_RECIPE: ghost");
  });

  it("a new recipe that joins an existing single-member Research cohort (the existing recipe would gain a letter)", () => {
    // The tail recipe re-authored to unlock on garlic joins marinara's cohort (garlic is its last finite material).
    const joiner = { ...last, requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: 1 }, { ingredientId: "mozzarella", minCount: 1 }, { ingredientId: "garlic", minCount: 1 }] };
    const v = withRecipes([...RECIPES.slice(0, -1), joiner]);
    const landed = NEXT_RECIPE_BATCH;
    expect(validateBatchManifest(landed, v).some((p) => p.startsWith("COHORT_LETTER_SHIFT"))).toBe(true);
  });
});
