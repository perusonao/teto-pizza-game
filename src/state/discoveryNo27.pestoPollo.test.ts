import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { DISCOVERY_LADDER, POST_W1_APPENDED_STEPS, W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { ingredientAttributeFamily } from "../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES } from "../data/recipeHintRoles";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { findOrderForRecipe } from "../data/orders";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { diffCombination } from "../logic/discovery/trialNotebookDiff";
import { notebookView } from "../logic/discovery/trialNotebook";
import { discoveredRecipeCount } from "../logic/discoveryLadder";
import { materialK, materialOffer, packQuantity } from "../logic/materialShop";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { createDefaultSave } from "./persistence";
import { discoveredRecipeIds } from "./dex";
import { hintSheetView, type DiscoveryHintState } from "./discoveryHint";
import { resolveShopEntitlement } from "./materialEntitlement";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "./recipeDiscoveryState";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { discoveredDex } from "./testSupport/guidedRound";
import { MID_BAKE, NOW, referencePieces, register, cook } from "./testSupport/trialNotebookFlow";
import { discoverAll, W1_ORDER } from "../logic/testSupport/branchingFixture";

/**
 * Discovery 3.0 No.27 Vertical Slice: pesto-pollo + chicken (appended ladder step 25).
 * Focused authority pins; the real production functions throughout (no mocked catalog).
 */
const ID = "pesto-pollo";
const CAL = "brazilian-calabresa";
const recipe = getRecipe(ID as RecipeId)!;

/** The 25 credited W1 recipes found (everything the frozen ladder counts). */
const W1_DONE = W1_ORDER; // margherita + 24 step key recipes
const stateAfter = (found: readonly string[], opts: { chickenBought: boolean }): RecipeDiscoveryInputs & { dexIds: string[] } => {
  const dex = discoverAll(found);
  const unlocked = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
  // shrimp (Expansion Slice 1, step 26) is never bought here: these pins are about No.27 only.
  const owned = [...STARTER_INGREDIENT_IDS, ...unlocked.filter((m) => m !== "shrimp" && (opts.chickenBought || m !== "chicken"))];
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: unlocked,
    inventory: Object.fromEntries(owned.map((m) => [m, 10])),
    dexIds: [...found],
  };
};
const pool = (s: RecipeDiscoveryInputs) => RECIPES.filter((r) => recipeDiscoveryState(r, s) === "DISCOVERABLE").map((r) => r.id);
const target = (s: RecipeDiscoveryInputs) => {
  const t = selectHintTarget(s);
  return t.kind === "TARGET" ? `TARGET:${t.recipeId}` : t.kind;
};

describe("No.27 authoring: production data", () => {
  it("recipe count 26 -> 27, ingredient count 29 -> 30, existing No.1..26 unchanged, pesto-pollo = No.27 (Expansion Slice 1 then appends No.28 / the 31st ingredient; Wave 2 No.29-31 / ingredients 32-34)", () => {
    expect(RECIPES).toHaveLength(31);
    expect(INGREDIENTS).toHaveLength(34);
    expect(RECIPES[26].id).toBe(ID);
    expect(RECIPES[25].id).toBe(CAL);
    expect(RECIPES.slice(0, 26).filter((r) => r.id === ID)).toEqual([]);
    expect(INGREDIENTS[29].id).toBe("chicken");
    expect(INGREDIENTS.slice(0, 29).map((i) => i.id)).not.toContain("chicken");
    expect(INGREDIENTS[30].id).toBe("shrimp");
  });

  it("source-authoritative identity: ペストポッロピザ, pesto base, mozzarella + fresh-tomato + chicken (172 matrix pesto-pollo-pizzadb-p12)", () => {
    expect(recipe.nameJa).toBe("ペストポッロピザ");
    expect(recipe.requiredIngredients.map((q) => q.ingredientId).sort()).toEqual(["chicken", "fresh-tomato", "mozzarella", "pesto"]);
    expect(getRecipeSauceProfile(ID as RecipeId)).toMatchObject({ ingredientId: "pesto", interaction: "PAINT" });
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)).toMatchObject({
      targetId: "pesto-pollo-pizzadb-p12",
      sauceBase: ["pesto"],
      items: ["chicken", "fresh-tomato", "mozzarella", "pesto"],
    });
  });

  it("gameplay calibration (not source): counts, bake window, reward -- 7 non-sauce pieces fit the 8-slot ring", () => {
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "pesto", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "fresh-tomato", minCount: 2 },
      { ingredientId: "chicken", minCount: 3 },
    ]);
    const nonSauce = recipe.requiredIngredients.filter((q) => getIngredient(q.ingredientId)!.category !== "sauce");
    expect(nonSauce.reduce((n, q) => n + q.minCount, 0)).toBe(7);
    expect(recipe.bakeTarget).toEqual(getRecipe("pesto-caprese" as RecipeId)!.bakeTarget); // sibling pesto + mozzarella + tomato
    expect(recipe.baseRewardPitz).toBe(100);
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([
      ["mozzarella", 2],
      ["fresh-tomato", 2],
      ["chicken", 3],
    ]);
    expect(findOrderForRecipe(ID as RecipeId)?.id).toBe("order-pesto-pollo");
  });

  it("chicken: topping, family meat, finite ladder material (no legacy shop fields), existing ingredients' k / pack unchanged", () => {
    const chicken = getIngredient("chicken")!;
    expect(chicken).toMatchObject({ category: "topping", nameJa: "チキン", placement: "scatter", unlockCondition: { minTotalStars: 0 } });
    expect(chicken.pricePitz).toBeUndefined();
    expect(chicken.restockQuantity).toBeUndefined();
    expect(chicken.starterGrantOnly).toBeUndefined();
    expect(STARTER_INGREDIENT_IDS).not.toContain("chicken");
    expect(ingredientAttributeFamily("chicken")).toBe("meat");
    expect(materialOffer(chicken)).toEqual({ ingredientId: "chicken", step: 25, tier: "T3", k: 3, packQuantity: 30, packPrice: 100, refillPrice: 50 });
    // The ingredients pesto-pollo shares: no recipe max went up, so no existing pack size moved.
    expect([materialK("pesto"), materialK("fresh-tomato"), packQuantity("pesto"), packQuantity("fresh-tomato")]).toEqual([1, 3, 10, 30]);
    expect(materialK("fresh-tomato", RECIPES.filter((r) => r.id !== ID))).toBe(3);
    expect(materialK("pesto", RECIPES.filter((r) => r.id !== ID))).toBe(1);
  });

  it("save schema is unchanged (v2)", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
  });
});

describe("No.27 ladder: step 25 unlocks chicken; steps 1..24 unchanged", () => {
  it("appended step 25 = chicken -> pesto-pollo; the 24 W1 steps are byte-identical (Expansion Slice 1 appends step 26 after it)", () => {
    expect(POST_W1_APPENDED_STEPS[0]).toEqual({ ingredientIds: ["chicken"], keyRecipeId: ID });
    expect(POST_W1_APPENDED_STEPS).toHaveLength(4); // Expansion Slice 1 step 26, Wave 2 steps 27 / 28
    expect(DISCOVERY_LADDER.steps).toHaveLength(28);
    expect(DISCOVERY_LADDER.steps[24]).toEqual({ step: 25, kind: "MATERIAL", ingredientIds: ["chicken"], keyRecipeId: ID });
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
  });

  it("chicken is unlocked at step 25 only (not at 24), and pesto-pollo is UNKNOWN at every step 0..24", () => {
    const at = (n: number) => stateAfter(W1_DONE.slice(0, n), { chickenBought: true });
    expect(resolveShopEntitlement(discoverAll(W1_DONE.slice(0, 24)), [], []).unlockedForShopIngredientIds).not.toContain("chicken");
    expect(resolveShopEntitlement(discoverAll(W1_DONE), [], []).unlockedForShopIngredientIds).toContain("chicken");
    for (let n = 1; n <= 24; n += 1) expect(recipeDiscoveryState(recipe as Recipe, at(n)), `step ${n}`).toBe("UNKNOWN");
  });
});

describe("No.27 step-25 pool (production functions)", () => {
  it("Case A (calabresa undiscovered): before chicken purchase pool = calabresa only; after purchase pool = calabresa + pesto-pollo -> OPEN_POOL", () => {
    const before = stateAfter(W1_DONE, { chickenBought: false });
    expect(pool(before)).toEqual([CAL]);
    expect(target(before)).toBe(`TARGET:${CAL}`);
    expect(recipeDiscoveryState(recipe as Recipe, before)).toBe("KNOWN_BUT_MISSING_MATERIAL");
    const after = stateAfter(W1_DONE, { chickenBought: true });
    expect(pool(after).sort()).toEqual([CAL, ID].sort());
    expect(target(after)).toBe("OPEN_POOL");
    expect(hintSheetView(hintState(after))).toEqual({ kind: "CHOOSE_RESEARCH" }); // #353: 2 registered entries; names no candidate
  });

  it("Case B (calabresa discovered): after chicken purchase pool = pesto-pollo only -> auto target", () => {
    const found = [...W1_DONE, CAL];
    expect(pool(stateAfter(found, { chickenBought: false }))).toEqual([]);
    expect(target(stateAfter(found, { chickenBought: false }))).toBe("SHOP_NEW");
    const after = stateAfter(found, { chickenBought: true });
    expect(pool(after)).toEqual([ID]);
    expect(target(after)).toBe(`TARGET:${ID}`);
  });

  it("after the discovery: pesto-pollo is DISCOVERED; COMPLETE once calabresa is found too", () => {
    const done = stateAfter([...W1_DONE, CAL, ID], { chickenBought: true });
    expect(pool(done)).toEqual([]);
    // Expansion Slice 1: pesto-gamberi (shrimp, step 26) is now the next undiscovered recipe.
    expect(target(done)).toBe("SHOP_NEW");
    const calOnly = stateAfter([...W1_DONE, ID], { chickenBought: true });
    expect(pool(calOnly)).toEqual([CAL]);
  });
});

describe("No.27 ladderCredit / Lunch Rush", () => {
  it("pesto-pollo is credited (ladderCredit true by default) and advances the credited count; calabresa stays non-credit", () => {
    expect(countsTowardLadder(ID)).toBe(true);
    expect(recipe.ladderCredit).toBeUndefined();
    expect(countsTowardLadder(CAL)).toBe(false);
    expect(getRecipe(CAL as RecipeId)!.ladderCredit).toBe(false);
    expect(discoveredRecipeCount(discoverAll(W1_DONE), countsTowardLadder)).toBe(25);
    expect(discoveredRecipeCount(discoverAll([...W1_DONE, CAL]), countsTowardLadder)).toBe(25);
    expect(discoveredRecipeCount(discoverAll([...W1_DONE, ID]), countsTowardLadder)).toBe(26);
    expect(discoveredRecipeCount(discoverAll([...W1_DONE, CAL, ID]), countsTowardLadder)).toBe(26);
  });

  it("lunchRush is false: never in the Lunch Rush pool even discovered + owned + in stock", () => {
    expect(recipe.lunchRush).toBe(false);
    expect(participatesInLunchRush(ID)).toBe(false);
    const all = INGREDIENTS.map((i) => i.id);
    const pool = missionOrderRecipeIds({ dex: discoverAll(RECIPES.map((r) => r.id)), ownedIngredientIds: all, inventory: Object.fromEntries(all.map((i) => [i, 30])) });
    expect(pool).not.toContain(ID);
    expect(pool).not.toContain(CAL);
    expect(pool).not.toContain("pesto-gamberi");
    expect(pool).toHaveLength(RECIPES.length - 6);
  });
});

function hintState(s: RecipeDiscoveryInputs): DiscoveryHintState {
  return {
    dex: s.dex,
    ownedIngredientIds: s.ownedIngredientIds,
    unlockedForShopIngredientIds: s.unlockedForShopIngredientIds,
    inventory: s.inventory,
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

describe("No.27 Hint: key-free (Migration A kept, no KEY_TOPPING)", () => {
  it("roles are key-free; the rung ladder has no KEY_TOPPING, no empty rung, and names no ingredient / recipe", () => {
    expect(RECIPE_HINT_ROLES[ID as RecipeId]).toEqual({ keyFree: true });
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as RecipeId])).toBe(true);
    expect(Object.values(RECIPE_HINT_ROLES).filter(isKeyFreeHintRoles)).toHaveLength(6); // calabresa + pesto-pollo + Expansion pesto-gamberi; no other recipe moved
    const rungs = buildHint5Ladder(ID)!.rungs;
    expect(rungs.map((r) => r.kind)).not.toContain("KEY_TOPPING");
    for (const r of rungs) if (r.kind !== "STRUCTURE") expect(r.subjectIds.length).toBeGreaterThan(0);
    // Only the rungs that apply: SAUCE (pesto), CHEESE (mozzarella), STRUCTURE, one SUB_CLASS per topping.
    expect(rungs.map((r) => r.kind)).toEqual(["SAUCE", "CHEESE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"]);
    expect(rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => r.subjectIds[0]).sort()).toEqual(["chicken", "fresh-tomato"]);
  });

  it("the sheet for the lone-target state carries no candidate recipe name, count, distance, similarity or Near/Far wording", () => {
    const s = stateAfter([...W1_DONE, CAL], { chickenBought: true }); // pool = pesto-pollo only
    const view = hintSheetView(hintState(s));
    const text = JSON.stringify(view);
    expect(text).not.toContain(recipe.nameJa);
    expect(text).not.toContain(recipe.description);
    expect(text).not.toMatch(/distance|similarity|candidate|nearMiss|ニア|ファー|近い|遠い/i);
  });
});

describe("No.27 Trial Notebook N2 / Near-Far neutralization regression", () => {
  it("the diff of the player's own tries names chicken add / remove and carries no recipe / pool / hint authority", () => {
    const sauce = ["pesto"];
    const before = { sauceBase: sauce, ingredientSet: ["fresh-tomato", "mozzarella", "pesto"] };
    const after = { sauceBase: sauce, ingredientSet: ["chicken", "fresh-tomato", "mozzarella", "pesto"] };
    expect(diffCombination(before, after)).toEqual({ added: ["chicken"], removed: [], sauce: null });
    expect(diffCombination(after, before)).toEqual({ added: [], removed: ["chicken"], sauce: null });
    expect(diffCombination(after, after)).toBeNull();
    // The diff inputs are two combinations only: nothing about pesto-pollo exists in either side or the result.
    expect(JSON.stringify(diffCombination(before, after))).not.toMatch(/pesto-pollo|ペストポッロ|pool|hint|candidate/i);
  });

  it("real free-cook rounds: a near-miss pesto-pollo attempt stores NO feedback (Near/Far neutral), and discovering it is NEW RECIPE", () => {
    const dex = discoveredDex(W1_DONE);
    const unlocked = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
    const owned = [...STARTER_INGREDIENT_IDS, ...unlocked];
    const inventory = Object.fromEntries(unlocked.map((m) => [m, 30]));
    const start = () => gameReducer(createInitialGameState(dex, owned, 0, inventory, []), { type: "START_FREE_COOK", now: NOW });

    // Near miss: everything but the chicken.
    const near = register(
      cook(start(), {
        sauce: "pesto",
        cheese: referencePieces(ID, "mozzarella"),
        toppings: referencePieces(ID, "fresh-tomato"),
      }),
    );
    expect(near.lastDiscovery?.kind).toBe("ORIGINAL");
    const nearRows = notebookView(near.trialNotebook);
    expect(nearRows).toHaveLength(1);
    expect(JSON.stringify(nearRows)).not.toMatch(/pesto-pollo|ペストポッロ|distance|similar|near|far|candidate/i);
    expect(nearRows[0].feedback ?? null).toBeNull();

    // The full recipe: NEW RECIPE DISCOVERED (NEW_DISCOVERY) and the notebook is not written by a recipe discovery.
    const full = register(
      cook(
        gameReducer(near, { type: "START_FREE_COOK", now: NOW }),
        {
          sauce: "pesto",
          cheese: referencePieces(ID, "mozzarella"),
          toppings: [...referencePieces(ID, "fresh-tomato"), ...referencePieces(ID, "chicken")],
        },
        MID_BAKE,
      ),
    );
    expect(full.phase).toBe("DISCOVERED");
    expect(full.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: ID });
    expect(discoveredRecipeIds(full.dex)).toContain(ID);
    expect(notebookView(full.trialNotebook)).toHaveLength(1); // the recipe discovery did not enter the notebook
  });
});
