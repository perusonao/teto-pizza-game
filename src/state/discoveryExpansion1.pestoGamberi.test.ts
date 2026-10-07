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
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { discoveredRecipeCount } from "../logic/discoveryLadder";
import { materialK, materialOffer, packQuantity } from "../logic/materialShop";
import { discoverAll, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { recipeChapter, recipeChapterSlot, recipeKeyStep } from "./recipeChapters";
import { resolveShopEntitlement } from "./materialEntitlement";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "./recipeDiscoveryState";
import { createDefaultSave } from "./persistence";

/**
 * Expansion Slice 1: pesto-gamberi + shrimp (appended ladder step 26, T3). Focused authority pins;
 * the real production functions throughout (no mocked catalog).
 */
const ID = "pesto-gamberi";
const recipe = getRecipe(ID as RecipeId)!;
const UP_TO_POLLO = [...W1_ORDER, "pesto-pollo"]; // 26 credited discoveries -> step 26 reached

const stateAfter = (found: readonly string[], opts: { shrimpBought: boolean }): RecipeDiscoveryInputs => {
  const dex = discoverAll(found);
  const unlocked = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
  const owned = [...STARTER_INGREDIENT_IDS, ...unlocked.filter((m) => opts.shrimpBought || m !== "shrimp")];
  return { dex, ownedIngredientIds: owned, unlockedForShopIngredientIds: unlocked, inventory: Object.fromEntries(owned.map((m) => [m, 10])) };
};

describe("Expansion Slice 1 authoring: production data", () => {
  it("recipe count 27 -> 28, ingredient count 30 -> 31, pesto-gamberi = No.28 (existing order unchanged; Wave 2 later appends No.29-31 / ingredients 32-34)", () => {
    expect(RECIPES[27].id).toBe(ID);
    expect(RECIPES[26].id).toBe("pesto-pollo");
    expect(INGREDIENTS[30].id).toBe("shrimp");
  });

  it("owner decisions: name / description / order / exact identity / counts / bake / reward", () => {
    expect(recipe.nameJa).toBe("ペストガンベリピザ");
    expect(recipe.description).toBe("ジェノベーゼソースにエビ、トマト、にんにくをのせた、香り立つ魚介の一枚。");
    expect(findOrderForRecipe(ID as RecipeId)?.lineJa).toBe("エビとにんにくのペストガンベリピザ、香りがよさそう！食べてみたいな！");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "fresh-tomato", minCount: 2 },
      { ingredientId: "garlic", minCount: 2 },
      { ingredientId: "shrimp", minCount: 3 },
    ]);
    expect(recipe.requiredIngredients.some((q) => getIngredient(q.ingredientId)!.category === "cheese")).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 50, end: 70 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(getRecipeSauceProfile(ID as RecipeId)).toMatchObject({ ingredientId: "pesto", interaction: "PAINT" });
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)).toMatchObject({
      targetId: "pesto-gamberi-pizzadb-p11",
      sauceBase: ["pesto"],
      items: ["fresh-tomato", "garlic", "pesto", "shrimp"],
    });
  });

  it("Reference: 2 + 2 + 3 = 7 topping pieces inside the 8-slot ring", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([
      ["fresh-tomato", 2],
      ["garlic", 2],
      ["shrimp", 3],
    ]);
    expect(ref.pieceGroups.reduce((n, g) => n + g.positions.length, 0)).toBeLessThanOrEqual(8);
  });

  it("shrimp: topping, 🦐, seafood, finite ladder material at step 26 / T3, pack 30, first 100 / refill 50, no starter grant", () => {
    const shrimp = getIngredient("shrimp")!;
    expect(shrimp).toMatchObject({ category: "topping", nameJa: "エビ", emoji: "\u{1F990}", placement: "scatter", unlockCondition: { minTotalStars: 0 } });
    expect(shrimp.pricePitz).toBeUndefined();
    expect(shrimp.restockQuantity).toBeUndefined();
    expect(shrimp.starterGrantOnly).toBeUndefined();
    expect(STARTER_INGREDIENT_IDS).not.toContain("shrimp");
    expect(ingredientAttributeFamily("shrimp")).toBe("seafood");
    expect(materialOffer(shrimp)).toEqual({ ingredientId: "shrimp", step: 26, tier: "T3", k: 3, packQuantity: 30, packPrice: 100, refillPrice: 50 });
    // No existing pack size moved (garlic / fresh-tomato / pesto maxima unchanged).
    expect([materialK("pesto"), materialK("fresh-tomato"), materialK("garlic")]).toEqual([1, 3, 3]);
    expect([packQuantity("pesto"), packQuantity("fresh-tomato"), packQuantity("garlic")]).toEqual([10, 30, 30]);
  });

  it("Hint class symbol: seafood = 🌊 魚介系, never the shrimp glyph; every other class symbol unchanged", () => {
    expect(HINT_CLASS_DISPLAY.seafood).toEqual({ symbol: "\u{1F30A}", labelJa: "魚介系" });
    expect(HINT_CLASS_DISPLAY.seafood.symbol).not.toBe(getIngredient("shrimp")!.emoji);
    expect(HINT_CLASS_DISPLAY.meat.symbol).toBe("\u{1F969}");
    expect(HINT_CLASS_DISPLAY.vegetable.symbol).toBe("\u{1F96C}");
  });

  it("save schema is unchanged (v2)", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
  });
});

describe("Expansion Slice 1 ladder: step 26 unlocks shrimp; steps 1..25 frozen", () => {
  it("appended step 26 = shrimp -> pesto-gamberi; steps 1..24 and step 25 are byte-identical", () => {
    expect(POST_W1_APPENDED_STEPS.slice(0, 2)).toEqual([
      { ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" },
      { ingredientIds: ["shrimp"], keyRecipeId: ID },
    ]);
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps[24]).toEqual({ step: 25, kind: "MATERIAL", ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" });
    expect(DISCOVERY_LADDER.steps[25]).toEqual({ step: 26, kind: "MATERIAL", ingredientIds: ["shrimp"], keyRecipeId: ID });
  });

  it("credit: pesto-gamberi is credited (30 credited recipes after Wave 2; calabresa stays non-credit); shrimp unlocks at the 26th credited discovery only", () => {
    expect(countsTowardLadder(ID)).toBe(true);
    expect(recipe.ladderCredit).toBeUndefined();
    expect(countsTowardLadder("brazilian-calabresa")).toBe(false);
    expect(discoveredRecipeCount(discoverAll(UP_TO_POLLO), countsTowardLadder)).toBe(26);
    expect(resolveShopEntitlement(discoverAll(W1_ORDER), [], []).unlockedForShopIngredientIds).not.toContain("shrimp");
    expect(resolveShopEntitlement(discoverAll(UP_TO_POLLO), [], []).unlockedForShopIngredientIds).toContain("shrimp");
  });

  it("chapter 3, No.12 (key step 26, T3)", () => {
    expect(recipeKeyStep(recipe)).toBe(26);
    expect(recipeChapter(recipe)).toBe(3);
    expect(recipeChapterSlot(recipe)).toBe(12);
  });

  it("pesto-gamberi is UNKNOWN before shrimp is unlocked, KNOWN_BUT_MISSING_MATERIAL until bought, DISCOVERABLE after", () => {
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(W1_ORDER, { shrimpBought: true }))).toBe("UNKNOWN");
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(UP_TO_POLLO, { shrimpBought: false }))).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(recipeDiscoveryState(recipe as Recipe, stateAfter(UP_TO_POLLO, { shrimpBought: true }))).toBe("DISCOVERABLE");
  });

  it("target: after pollo, with calabresa and aussie found, the lone DISCOVERABLE is pesto-gamberi; once it is found, Wave 2's vongole (step 27) is next", () => {
    const found = [...UP_TO_POLLO, "brazilian-calabresa", "aussie"]; // the two non-credit onion-step recipes (calabresa, TQ-1D aussie)
    expect(selectHintTarget(stateAfter(found, { shrimpBought: false })).kind).toBe("SHOP_NEW");
    expect(selectHintTarget(stateAfter(found, { shrimpBought: true }))).toMatchObject({ kind: "TARGET", recipeId: ID });
    expect(selectHintTarget(stateAfter([...found, ID], { shrimpBought: true }))).toMatchObject({ kind: "TARGET", recipeId: "vongole" });
  });
});

describe("Expansion Slice 1: Lunch Rush exclusion and Hint 5.0 key-free", () => {
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

  it("roles are key-free (no hintKeyToppingId); the ladder has no KEY_TOPPING and no CHEESE rung", () => {
    expect(RECIPE_HINT_ROLES[ID as RecipeId]).toEqual({ keyFree: true });
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as RecipeId])).toBe(true);
    const rungs = buildHint5Ladder(ID)!.rungs;
    const kinds = rungs.map((r) => r.kind);
    expect(kinds).not.toContain("KEY_TOPPING");
    expect(kinds).not.toContain("CHEESE"); // no cheese: the sauce / cheese absence is never read off the RESULT
    for (const r of rungs) if (r.kind !== "STRUCTURE") expect(r.subjectIds.length).toBeGreaterThan(0);
    const sub = rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => [r.subjectIds[0], ingredientAttributeFamily(r.subjectIds[0])]);
    expect(sub.sort()).toEqual([["fresh-tomato", "vegetable"], ["garlic", "herb"], ["shrimp", "seafood"]]);
  });
});
