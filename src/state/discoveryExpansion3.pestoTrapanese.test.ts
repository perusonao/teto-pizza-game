import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { DISCOVERY_LADDER, POST_W1_APPENDED_STEPS, W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { HINT_CLASS_DISPLAY } from "../data/hintClassDisplay";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { ingredientAttributeFamily } from "../data/ingredientTaxonomy";
import { findOrderForRecipe } from "../data/orders";
import { RECIPE_HINT_ROLES } from "../data/recipeHintRoles";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { matchDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { materialK, materialOffer, packQuantity } from "../logic/materialShop";
import { discoverAll, pizzaOf, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { researchEntryViews } from "./discoveryHint";
import { recipeChapter, recipeChapterSlot, recipeKeyStep } from "./recipeChapters";
import { resolveShopEntitlement } from "./materialEntitlement";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "./recipeDiscoveryState";
import { createDefaultSave } from "./persistence";

/**
 * Expansion Slice 3: pesto-trapanese + almond (appended ladder step 29, T3). Focused authority pins; the real
 * production functions throughout (no mocked catalog).
 */
const ID = "pesto-trapanese";
const recipe = getRecipe(ID as RecipeId)!;
/** Every credited recipe before step 29's key recipe: 29 credited discoveries -> step 29 reached. */
const UP_TO_PESTO_VEG = [...W1_ORDER, "pesto-pollo", "pesto-gamberi", "vongole", "pesto-vegetariana"];
const SETTLED = [...UP_TO_PESTO_VEG, "brazilian-calabresa", "aussie"];

const stateAfter = (found: readonly string[], opts: { almondBought: boolean }): RecipeDiscoveryInputs => {
  const dex = discoverAll(found);
  const unlocked = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
  const owned = [...STARTER_INGREDIENT_IDS, ...unlocked.filter((m) => opts.almondBought || m !== "almond")];
  return { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: unlocked, inventory: Object.fromEntries(owned.map((m) => [m, 10])) };
};

describe("Expansion Slice 3 authoring: production data", () => {
  it("recipe count 32 -> 33, ingredient count 34 -> 35, pesto-trapanese = No.33 (existing order unchanged)", () => {
    expect(RECIPES[32].id).toBe(ID);
    expect(RECIPES[31].id).toBe("aussie");
    expect(INGREDIENTS[34].id).toBe("almond");
    expect(INGREDIENTS[33].id).toBe("zucchini");
  });

  it("identity: pesto sauce, fresh-tomato / garlic / almond, no cheese, no new mechanic", () => {
    expect(recipe.nameJa).toBe("ペストトラパネーゼピザ");
    expect(findOrderForRecipe(ID as RecipeId)?.recipeId).toBe(ID);
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "fresh-tomato", minCount: 2 },
      { ingredientId: "garlic", minCount: 2 },
      { ingredientId: "almond", minCount: 3 },
    ]);
    expect(recipe.requiredIngredients.some((q) => getIngredient(q.ingredientId)!.category === "cheese")).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 50, end: 70 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(getRecipeSauceProfile(ID as RecipeId)).toMatchObject({ ingredientId: "pesto", interaction: "PAINT" });
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)).toMatchObject({
      targetId: "pesto-trapanese-pizzadb-p11",
      sauceBase: ["pesto"],
      items: ["almond", "fresh-tomato", "garlic", "pesto"],
    });
  });

  it("matcher: the exact composition identifies only pesto-trapanese; no other recipe's identity changed", () => {
    const keys = RECIPES.map((r) => JSON.stringify([...r.requiredIngredients].map((q) => [q.ingredientId, q.minCount]).sort()));
    expect(new Set(keys).size).toBe(RECIPES.length);
    const m = matchDiscovery(signatureOfPizza(pizzaOf(recipe.requiredIngredients.map((q) => q.ingredientId))), RECIPE_DISCOVERY_CATALOG);
    expect(m.kind).toBe("UNIQUE_MATCH");
    expect(m.kind === "UNIQUE_MATCH" && m.target.recipeId).toBe(ID);
    // The same pizza without almond (a pesto-gamberi-shaped substitution) never matches it.
    const without = matchDiscovery(signatureOfPizza(pizzaOf(["pesto", "fresh-tomato", "garlic"])), RECIPE_DISCOVERY_CATALOG);
    expect(without.kind === "UNIQUE_MATCH" && without.target.recipeId).not.toBe(ID);
  });

  it("Reference: 2 + 2 + 3 = 7 topping pieces inside the 8-slot ring", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([
      ["fresh-tomato", 2],
      ["garlic", 2],
      ["almond", 3],
    ]);
    expect(ref.pieceGroups.reduce((n, g) => n + g.positions.length, 0)).toBeLessThanOrEqual(8);
  });

  it("almond: topping, 🥜, family other (nuts share `other`), finite ladder material at step 29 / T3, pack 30, first 100 / refill 50", () => {
    const almond = getIngredient("almond")!;
    expect(almond).toMatchObject({ category: "topping", nameJa: "アーモンド", emoji: "\u{1F95C}", placement: "scatter", unlockCondition: { minTotalStars: 0 } });
    expect(almond.pricePitz).toBeUndefined();
    expect(almond.restockQuantity).toBeUndefined();
    expect(almond.starterGrantOnly).toBeUndefined();
    expect(STARTER_INGREDIENT_IDS).not.toContain("almond");
    expect(ingredientAttributeFamily("almond")).toBe("other");
    expect(materialOffer(almond)).toEqual({ ingredientId: "almond", step: 29, tier: "T3", k: 3, packQuantity: 30, packPrice: 100, refillPrice: 50 });
    expect([materialK("pesto"), materialK("fresh-tomato"), materialK("garlic")]).toEqual([1, 3, 3]);
    expect([packQuantity("pesto"), packQuantity("fresh-tomato"), packQuantity("garlic")]).toEqual([10, 30, 30]);
  });

  it("Hint class: `other` keeps ✨ ちょっと変わった材料 (egg + almond); the almond glyph equals no class symbol; no class symbol changed", () => {
    expect(HINT_CLASS_DISPLAY.other).toEqual({ symbol: "✨", labelJa: "ちょっと変わった材料" });
    expect(Object.values(HINT_CLASS_DISPLAY).map((d) => d.symbol)).not.toContain(getIngredient("almond")!.emoji);
    expect(HINT_CLASS_DISPLAY.seafood.symbol).toBe("\u{1F30A}");
    expect(INGREDIENTS.filter((i) => ingredientAttributeFamily(i.id) === "other").map((i) => i.id)).toEqual(["egg", "almond"]);
    // Nothing else shares the new glyph.
    expect(INGREDIENTS.filter((i) => i.emoji === getIngredient("almond")!.emoji)).toHaveLength(1);
  });

  it("save schema is unchanged (v2)", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
  });
});

describe("Expansion Slice 3 ladder: step 29 unlocks almond; steps 1..28 frozen (append-only)", () => {
  it("appended step 29 = almond -> pesto-trapanese; steps 1..28 are byte-identical to before", () => {
    expect(POST_W1_APPENDED_STEPS).toEqual([
      { ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" },
      { ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" },
      { ingredientIds: ["parsley"], keyRecipeId: "vongole" },
      { ingredientIds: ["bell-pepper", "zucchini"], keyRecipeId: "pesto-vegetariana" },
      { ingredientIds: ["almond"], keyRecipeId: ID },
    ]);
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps.slice(24, 28).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([
      [25, ["chicken"], "pesto-pollo"],
      [26, ["shrimp"], "pesto-gamberi"],
      [27, ["parsley"], "vongole"],
      [28, ["bell-pepper", "zucchini"], "pesto-vegetariana"],
    ]);
    expect(DISCOVERY_LADDER.steps[28]).toEqual({ step: 29, kind: "MATERIAL", ingredientIds: ["almond"], keyRecipeId: ID });
  });

  it("credit: pesto-trapanese is credited (31 credited recipes); almond unlocks at the 29th credited discovery only", () => {
    expect(countsTowardLadder(ID)).toBe(true);
    expect(recipe.ladderCredit).toBeUndefined();
    const before = [...W1_ORDER, "pesto-pollo", "pesto-gamberi", "vongole"];
    expect(resolveShopEntitlement(discoverAll(before), [], []).unlockedForShopIngredientIds).not.toContain("almond");
    expect(resolveShopEntitlement(discoverAll(UP_TO_PESTO_VEG), [], []).unlockedForShopIngredientIds).toContain("almond");
  });

  it("chapter 3, last slot (key step 29, T3)", () => {
    expect(recipeKeyStep(recipe)).toBe(29);
    expect(recipeChapter(recipe)).toBe(3);
    expect(recipeChapterSlot(recipe)).toBe(16);
  });

  it("UNKNOWN before almond is unlocked, KNOWN_BUT_MISSING_MATERIAL until bought, DISCOVERABLE after", () => {
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(SETTLED.slice(0, 27), { almondBought: true }))).toBe("UNKNOWN");
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(SETTLED, { almondBought: false }))).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(SETTLED, { almondBought: true }))).toBe("DISCOVERABLE");
  });
});

describe("Expansion Slice 3: Lunch Rush exclusion, Hint 5.0 key-free", () => {
  it("lunchRush is false: never in the Lunch Rush pool even discovered + owned + in stock", () => {
    expect(recipe.lunchRush).toBe(false);
    expect(participatesInLunchRush(ID)).toBe(false);
    const all = INGREDIENTS.map((i) => i.id);
    const pool = missionOrderRecipeIds({
      dex: discoverAll(RECIPES.map((r) => r.id)),
      ownedIngredientIds: all,
      inventory: Object.fromEntries(all.map((i) => [i, 30])),
    });
    expect(pool).not.toContain(ID);
  });

  it("roles are key-free; the ladder has no KEY_TOPPING and no CHEESE rung; almond reads as the `other` class", () => {
    expect(RECIPE_HINT_ROLES[ID as RecipeId]).toEqual({ keyFree: true });
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as RecipeId])).toBe(true);
    const rungs = buildHint5Ladder(ID)!.rungs;
    const kinds = rungs.map((r) => r.kind);
    expect(kinds).not.toContain("KEY_TOPPING");
    expect(kinds).not.toContain("CHEESE");
    const sub = rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => [r.subjectIds[0], ingredientAttributeFamily(r.subjectIds[0])]);
    expect(sub.sort()).toEqual([["almond", "other"], ["fresh-tomato", "vegetable"], ["garlic", "herb"]]);
  });
});

describe("Expansion Slice 3: Research cohort identity and privacy", () => {
  const entries = (found: readonly string[], almondBought = true) => researchEntryViews(stateAfter(found, { almondBought }));

  it("pesto-trapanese is its own single cohort (the unlock ingredient is the only identity): 「？？？ピザ（アーモンド）」, no letter", () => {
    const views = entries(SETTLED);
    expect(views.find((v) => v.recipeId === ID)?.label).toBe("？？？ピザ（アーモンド）");
  });

  it("existing cohort letters are untouched: step 28's ratatouille-pizza keeps A（ズッキーニ） beside the new entry", () => {
    const views = Object.fromEntries(entries(SETTLED).map((v) => [v.recipeId, v.label]));
    expect(views["ratatouille-pizza"]).toBe("？？？ピザ A（ズッキーニ）");
    expect(views[ID]).toBe("？？？ピザ（アーモンド）");
  });

  it("the Research labels never carry the undiscovered recipe name or id", () => {
    const text = entries(SETTLED).map((v) => v.label).join("|");
    expect(text).not.toMatch(/トラパネーゼ|trapanese|ペスト/);
  });
});
