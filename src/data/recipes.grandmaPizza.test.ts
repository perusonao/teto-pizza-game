import { describe, expect, it } from "vitest";
import { getCookingProfile, isCutEligible } from "./cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER } from "./discoveryLadder";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { countsTowardLadder, getRecipe, participatesInLunchRush, RECIPES, type Recipe } from "./recipes";
import { findOrderForRecipe } from "./orders";
import { getReferencePizza } from "./referencePizza";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { matchDiscovery } from "../logic/discovery/matcher";
import { researchResultRows } from "../logic/discovery/researchResultRows";
import { signatureOfPizza } from "../logic/discovery/signature";
import { missionOrderRecipeIds } from "../mission/lunchRush";
import { discoverAll, walkState, W1_ORDER } from "../logic/testSupport/branchingFixture";
import { requiredSauceIds } from "../logic/testSupport/requiredSauces";
import { recipeDiscoveryState } from "../state/recipeDiscoveryState";
import { recipeChapter, recipeChapterSlot } from "../state/recipeChapters";
import { EMPTY_DEX } from "../state/dex";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { createDefaultSave, loadSave, persistDex, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { commit, finishedPizza, ringBatch, run, sauceStepState } from "../state/testSupport/sauceKindFixtures";

/**
 * Multi-Sauce S3 (Issue #521): authoring and behaviour pins for `grandma-pizza`, the first recipe with TWO required sauces
 * (tomato-sauce = the primary / Reference sauce, olive-oil = the secondary, judged by presence). Design Lock:
 * docs/reports/TETO_MULTI-SAUCE-RECIPES_Design-Lock.md. Counts and the bake window are GAMEPLAY CALIBRATION, not source authority.
 */
const ID = "grandma-pizza";
const recipe = getRecipe(ID as Recipe["id"])!;

const ideal = () => ringBatch(50, 50, 25, 46);
const oneTick = () => ringBatch(50, 50, 25, 1);

function pizzaOf(...actions: ReturnType<typeof commit>[]): PizzaState {
  return finishedPizza(recipe, run(sauceStepState(recipe), actions).pizza);
}

describe("grandma-pizza authoring", () => {
  it("is production recipe No.58, appended after Batch 7a (the earlier 57 keep their order)", () => {
    expect(RECIPES[57].id).toBe(ID);
    expect(RECIPES).toHaveLength(58);
    expect(recipe.nameJa).toBe("グランマピザ");
    expect(recipe.description).not.toMatch(/焼く前|焼いた後|塗った生地/); // the source does not say when the oil goes on: no timing is asserted
  });

  it("uses the Owner-fixed composition: tomato-sauce 1 / olive-oil 1 / mozzarella 3 / garlic 2, bake 56-76 (provisional)", () => {
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 3 },
      { ingredientId: "garlic", minCount: 2 },
    ]);
    expect(recipe.bakeTarget).toEqual({ start: 56, end: 76 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(requiredSauceIds(ID)).toEqual(["tomato-sauce", "olive-oil"]);
  });

  it("is non-credit (ladderCredit:false) and out of Lunch Rush; the ladder is untouched", () => {
    expect(recipe.ladderCredit).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(countsTowardLadder(ID)).toBe(false);
    expect(participatesInLunchRush(ID)).toBe(false);
    expect(missionOrderRecipeIds({ dex: EMPTY_DEX } as never)).not.toContain(ID);
    expect(DISCOVERY_LADDER.steps.slice(0, 24)).toEqual(W1_25_DISCOVERY_LADDER.steps);
    expect(DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)).not.toContain(ID);
    expect(DISCOVERY_LADDER.steps).toHaveLength(53);
  });

  it("uses only existing ingredients and has no CUT", () => {
    expect(isCutEligible(ID as Recipe["id"])).toBe(false);
    expect(getCookingProfile(ID as Recipe["id"]).steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
  });

  it("every production table has its row: primary sauce profile (tomato-sauce), ORDERS entry, discovery target, Reference", () => {
    expect(getRecipeSauceProfile(ID as Recipe["id"])).toEqual({ recipeId: ID, ingredientId: "tomato-sauce", interaction: "PAINT" });
    expect(findOrderForRecipe(ID as Recipe["id"])?.id).toBe("order-grandma-pizza");
    const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === ID)!;
    expect(target.targetId).toBe("grandma-pizza-pizzadb");
    expect(target.items).toEqual(["garlic", "mozzarella", "olive-oil", "tomato-sauce"]);
    expect(target.sauceBase).toEqual(["olive-oil", "tomato-sauce"]);
    expect(getReferencePizza(ID)?.sauce).toMatchObject({ ingredientId: "tomato-sauce" });
  });

  it("the Reference pieces take the 8-slot ring consecutively (mozzarella 3, then garlic 2)", () => {
    const reference = getReferencePizza(ID)!;
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 3], ["garlic", 2]]);
    expect(reference.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).slice(0, 5));
  });

  it("Hint 5.0: key-free; ONE SAUCE rung naming both sauces, then CHEESE, STRUCTURE and a SUB_CLASS per topping", () => {
    expect(RECIPE_HINT_ROLES[ID as Recipe["id"]]).toEqual({ keyFree: true });
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[ID as Recipe["id"]])).toBe(true);
    const rungs = buildHint5Ladder(ID)!.rungs;
    expect(rungs.filter((r) => r.kind === "SAUCE")).toHaveLength(1);
    expect([...rungs.find((r) => r.kind === "SAUCE")!.subjectIds].sort()).toEqual(["olive-oil", "tomato-sauce"]);
    expect(rungs.map((r) => r.kind)).not.toContain("KEY_TOPPING");
  });
});

describe("grandma-pizza progression: makeable from ladder step 14, a branching pool beside marinara", () => {
  it("is not makeable at step 13 (garlic missing) and DISCOVERABLE together with marinara at step 14", () => {
    const poolAt = (n: number) => RECIPES.filter((r) => recipeDiscoveryState(r, walkState(W1_ORDER.slice(0, n))) === "DISCOVERABLE").map((r) => r.id);
    expect(poolAt(13)).not.toContain(ID);
    expect(poolAt(14)).toContain(ID);
    expect(poolAt(14)).toContain("marinara");
  });

  it("chapter / No. identity: it is the last slot of chapter 2 (key step 14); every earlier recipe keeps its slot (it is appended, so none moves)", () => {
    const before = RECIPES.filter((r) => r.id !== ID);
    expect(recipeChapter(recipe)).toBe(2);
    expect(recipeChapterSlot(recipe)).toBe(RECIPES.filter((r) => recipeChapter(r) === 2).length);
    for (const r of before) {
      expect(recipeChapterSlot(r), r.id).toBe(recipeChapterSlot(r, before));
    }
  });

  it("finding it never advances the ladder (ladderCredit:false)", () => {
    const before = walkState(W1_ORDER.slice(0, 14));
    const after = walkState([...W1_ORDER.slice(0, 14), ID]);
    expect(after.ladderCount).toBe(before.ladderCount);
    expect(after.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds);
  });
});

describe("grandma-pizza with two sauces: the real reducer, Completion Gate and discovery", () => {
  it("tomato then olive-oil keeps both sauces on the pizza, each with its own deposits (the ledger is per kind)", () => {
    const pizza = pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal()));
    expect([...pizza.sauceIds].sort()).toEqual(["olive-oil", "tomato-sauce"]);
    expect(pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId === "tomato-sauce").length).toBeGreaterThan(0);
    expect(pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId === "olive-oil").length).toBeGreaterThan(0);
  });

  it("both orders (tomato -> oil, oil -> tomato) pass the Completion Gate; the oil is judged by presence (one tick passes)", () => {
    for (const actions of [
      [commit("tomato-sauce", ideal()), commit("olive-oil", ideal())],
      [commit("olive-oil", ideal()), commit("tomato-sauce", ideal())],
      [commit("tomato-sauce", ideal()), commit("olive-oil", oneTick())],
    ]) {
      expect(evaluatePizzaCompletion(recipe, pizzaOf(...actions)).status).toBe("PASS");
    }
  });

  it("a missing sauce FAILS: tomato only (no oil), oil only (no tomato), and a faint tomato still fails its quantity floor", () => {
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("tomato-sauce", ideal())))).toMatchObject({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "olive-oil" });
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("olive-oil", ideal())))).toMatchObject({ status: "FAILED", ingredientId: "tomato-sauce" });
    expect(evaluatePizzaCompletion(recipe, pizzaOf(commit("tomato-sauce", oneTick()), commit("olive-oil", ideal())))).toMatchObject({ status: "FAILED", reason: "INSUFFICIENT_SAUCE", ingredientId: "tomato-sauce" });
  });

  it("is discovered as grandma-pizza only with both sauces; tomato-only is not it, and no production recipe collides", () => {
    const both = signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", ideal())));
    expect(matchDiscovery(both, RECIPE_DISCOVERY_CATALOG)).toMatchObject({ kind: "UNIQUE_MATCH", target: { recipeId: ID } });
    const tomatoOnly = signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal())));
    const tomatoOnlyMatch = matchDiscovery(tomatoOnly, RECIPE_DISCOVERY_CATALOG);
    expect(tomatoOnlyMatch.kind === "UNIQUE_MATCH" ? tomatoOnlyMatch.target.recipeId : null).not.toBe(ID);
    const withPesto = signatureOfPizza(pizzaOf(commit("tomato-sauce", ideal()), commit("olive-oil", oneTick()), commit("pesto", oneTick())));
    expect(matchDiscovery(withPesto, RECIPE_DISCOVERY_CATALOG).kind).toBe("NO_MATCH");
  });

  it("Research rows: both sauces are POSITIVE for the grandma target, and a one-sauce target still sees the oil as NEGATIVE", () => {
    const pizza = { sauceIds: ["tomato-sauce", "olive-oil"], toppings: [] };
    expect(researchResultRows({ targetRecipeId: ID, pizza, knownIngredientIds: [] }).rows).toEqual([
      { ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" },
      { ingredientId: "olive-oil", category: "sauce", verdict: "POSITIVE" },
    ]);
    expect(researchResultRows({ targetRecipeId: "margherita", pizza, knownIngredientIds: [] }).rows).toEqual([
      { ingredientId: "tomato-sauce", category: "sauce", verdict: "POSITIVE" },
      { ingredientId: "olive-oil", category: "sauce", verdict: "NEGATIVE" },
    ]);
  });
});

describe("grandma-pizza and existing saves", () => {
  const fakeStorage = (initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } => {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
      dump: () => Object.fromEntries(store),
    };
  };

  it("keeps the save schema at v2 and a save made before grandma-pizza loads unchanged", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    const dex = discoverAll(W1_ORDER.slice(0, 20));
    const storage = fakeStorage();
    persistDex(dex, storage);
    const before = storage.dump()[SAVE_STORAGE_KEY];
    const loaded = loadSave(storage);
    expect(loaded.dex).toEqual(dex);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(ID);
    expect(storage.dump()[SAVE_STORAGE_KEY]).toBe(before); // loading never rewrites the save
  });

  it("a Dex entry for grandma-pizza round-trips through the save", () => {
    const dex = discoverAll([...W1_ORDER.slice(0, 14), ID]);
    const storage = fakeStorage();
    persistDex(dex, storage);
    expect(loadSave(storage).dex).toEqual(dex);
    expect(loadSave(storage).dex.map((e) => e.recipeId)).toContain(ID);
  });

  it("an empty pizza stays a valid starting point for the recipe (no state migration)", () => {
    expect(createEmptyPizza().sauceIds).toEqual([]);
  });
});
