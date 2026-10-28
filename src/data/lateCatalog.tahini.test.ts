import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { commit, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { EGGPLANT_TAHINI_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
import { productionCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { RECIPE_DISCOVERY_CATALOG, discoveryIdentityOf } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, lateCatalogEnabled } from "./lateCatalog";
import { findOrderForRecipe } from "./orders";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getRecipe, RECIPES, type RecipeId } from "./recipes";
import { getReferencePizza } from "./referencePizza";
import { toppingSizeClass } from "./toppingSizeClass";

/**
 * New Sauces Phase B U3 (Issue #578, Owner 2026-10-26): `eggplant-tahini-pizza` + `tahini` + `pomegranate`, a LATE-catalog recipe (the pomegranate scattered after the bake in FINISH, the parsley placed before it) with two
 * late-only materials. The tahini PAINT-before-bake, the eggplant without pre-cooking, the parsley before the bake, the pomegranate AFTER the bake, every count are GAMEPLAY ASSUMPTIONS /
 * PROVISIONAL (the original page was not confirmed), pinned here only as the shipped data. The late step number is always derived from the ladder; the entitlement floor is a FIXED constant.
 */
const TAHINI_PIZZA = "eggplant-tahini-pizza" as RecipeId;
const SAUCE = "tahini";
const POM = "pomegranate";

async function loadOff() {
  vi.resetModules();
  vi.doMock("./lateCatalog", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./lateCatalog")>()),
    LATE_CATALOG_PRODUCTION: false,
    lateCatalogEnabled: () => false,
  }));
  await import("./lateCatalog");
  const recipes = await import("./recipes");
  const ingredients = await import("./ingredients");
  const ladder = await import("./discoveryLadder");
  const catalog = await import("./discoveryCatalog");
  const orders = await import("./orders");
  return { recipes, ingredients, ladder, catalog, orders };
}

afterEach(() => {
  vi.doUnmock("./lateCatalog");
  vi.resetModules();
});

describe("OFF (the rollback state) has no tahini content", () => {
  it("with the late switch OFF, no recipe, ingredient, ladder step, discovery target or order mentions the tahini content", async () => {
    const off = await loadOff();
    expect(off.recipes.RECIPES.some((r) => (r.id as string) === TAHINI_PIZZA)).toBe(false);
    expect(off.ingredients.INGREDIENTS.some((i) => i.id === SAUCE || i.id === POM)).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.includes(SAUCE) || s.ingredientIds.includes(POM))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === TAHINI_PIZZA)).toBe(false);
    expect(off.orders.ORDERS.some((o) => (o.recipeId as string) === TAHINI_PIZZA)).toBe(false);
  });
});

describe("the shipped data (late catalog ON, as in Production)", () => {
  it("the late catalog is on, so the recipe is part of the catalog", () => {
    expect(lateCatalogEnabled()).toBe(true);
    expect(RECIPES.some((r) => r.id === TAHINI_PIZZA)).toBe(true);
  });

  it("recipe: tahini 1 (PAINT) / eggplant 3 / parsley 1 / pomegranate 2 POST_BAKE, bake 58-78, no cheese, not in Lunch Rush, ladder-credited (no ladderCredit field)", () => {
    const recipe = getRecipe(TAHINI_PIZZA)!;
    expect(recipe.nameJa).toBe("ナスとタヒニのピザ");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: SAUCE, minCount: 1 },
      { ingredientId: "eggplant", minCount: 3 },
      { ingredientId: "parsley", minCount: 1 },
      { ingredientId: POM, minCount: 2, applicationPhase: "POST_BAKE" },
    ]);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.lunchRush).toBe(false);
    expect("ladderCredit" in recipe).toBe(false);
    expect("doughKind" in recipe).toBe(false);
    expect(findOrderForRecipe(TAHINI_PIZZA)?.recipeId).toBe(TAHINI_PIZZA);
  });

  it("the description names no moment (Anti-Oracle: it is shown before the recipe is discovered)", () => {
    expect(getRecipe(TAHINI_PIZZA)!.description).not.toMatch(/焼成|焼き上|焼いた|あと|仕上げ|後乗せ|振り/);
  });

  it("tahini: a late-only finite sauce (spread, ladder-gated, no topping family), Owner-approved colour #7b6a58", () => {
    const ingredient = getIngredient(SAUCE)!;
    expect(ingredient).toMatchObject({ category: "sauce", placement: "spread", color: "#7b6a58", nameJa: "タヒニ" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(SAUCE)).toBeNull();
  });

  it("pomegranate: a late-only finite topping (scatter, ladder-gated), family fruit, size class xs, its own aril art (candidate A')", () => {
    const ingredient = getIngredient(POM)!;
    expect(ingredient).toMatchObject({ category: "topping", placement: "scatter", color: "#c4163f", nameJa: "ザクロ", pieceVisual: "pomegranate-aril" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(POM)).toBe("fruit");
    expect(toppingSizeClass(POM)).toBe("xs");
  });

  it("the text fallbacks are unique: no other ingredient shares the tahini or pomegranate emoji (G18)", () => {
    for (const id of [SAUCE, POM]) {
      const own = getIngredient(id)!.emoji;
      expect(INGREDIENTS.filter((i) => i.emoji === own).map((i) => i.id)).toEqual([id]);
    }
  });

  it("tables: PAINT tahini, key-free hint, a Reference of 6 pieces (eggplant 3 / parsley 1 leaf / pomegranate 2), a sauce target, no shared slot", () => {
    expect(getRecipeSauceProfile(TAHINI_PIZZA)).toEqual({ recipeId: TAHINI_PIZZA, ingredientId: SAUCE, interaction: "PAINT" });
    expect(RECIPE_HINT_ROLES[TAHINI_PIZZA]).toEqual({ keyFree: true });
    const reference = getReferencePizza(TAHINI_PIZZA)!;
    expect(reference.sauce).not.toBeNull();
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["eggplant", 3], ["parsley", 1], [POM, 2]]);
    expect(reference.pieceGroups.find((g) => g.ingredientId === "parsley")!.interaction.landingStyle).toBe("LIGHT_LEAF");
    const slots = reference.pieceGroups.flatMap((g) => g.positions.map((p) => `${p.x},${p.y}`));
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("discovery identity: the ingredient set + sauce + dimensions are unique among the catalog, and the pomegranate is on the late axis (the parsley is not)", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const mine = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === TAHINI_PIZZA)!;
    expect(mine.items).toEqual(["eggplant", "parsley", POM, SAUCE]);
    expect(mine.sauceBase).toEqual([SAUCE]);
    expect(mine.capabilities).toEqual(["LATE_ADDITION"]);
    expect(mine.identityDimensions.late).toEqual([["POST_BAKE", [POM]]]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => key(t) === key(mine)).map((t) => t.recipeId)).toEqual([TAHINI_PIZZA]);
    expect(discoveryIdentityOf(getRecipe(TAHINI_PIZZA)!).capabilities).toEqual(["LATE_ADDITION"]);
  });
});

describe("ladder, Shop, Research and the entitlement floor", () => {
  const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!;

  it("one late step carries both materials (the sauce first, the pomegranate = the Research cohort key last), keyed to the recipe, after the dengaku step, with no star gate, a derived number, as the tail", () => {
    const steps = DISCOVERY_LADDER.steps;
    const mine = stepOf(SAUCE);
    expect(mine).toMatchObject({ ingredientIds: [SAUCE, POM], keyRecipeId: TAHINI_PIZZA });
    expect(stepOf(POM)).toBe(mine);
    expect(mine.starGates).toBeUndefined();
    expect(mine.step).toBe(stepOf("miso-sauce").step + 1);
    expect(steps.at(-2)).toBe(mine); // (BBQ Chicken: the bbq late step follows it)
    expect(mine.step).toBe(ordinaryLadderSteps(steps).length + LATE_LADDER_STEPS.length - 1); // ordinary length + the four late steps up to and including this one (the bbq step follows)
    expect(LATE_LADDER_STEPS.map((s) => s.keyRecipeId)).toEqual(["ikura-salmon-pizza", "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", TAHINI_PIZZA, "bbq-chicken-pizza"]);
  });

  it("Shop: both materials are T4 (the sauce pack 120 / refill 60), from the tahini late step", () => {
    expect(materialOffer(getIngredient(SAUCE)!)!).toMatchObject({ tier: "T4", packPrice: 120, refillPrice: 60, step: stepOf(SAUCE).step });
    expect(materialOffer(getIngredient(POM)!)!).toMatchObject({ tier: "T4", step: stepOf(POM).step });
  });

  it("Research: the recipe's cohort is itself alone (no letter), and no other recipe's letter moves", () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const withIt = researchCohortLetters(owned, RECIPES);
    const without = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== TAHINI_PIZZA));
    expect(withIt.has(TAHINI_PIZZA)).toBe(false);
    expect([...withIt.entries()]).toEqual([...without.entries()]);
  });

  it("the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa), one credited late step, key ingredient pomegranate, no Research letter or chapter shift", () => {
    expect(validateBatchManifest(EGGPLANT_TAHINI_BATCH, productionCatalogView())).toEqual([]);
  });

  it("the compatibility floors are FIXED at 60 for both materials (never later than the step the ladder derives); the earlier floors are unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, [SAUCE]: 60, [POM]: 60, "bbq-sauce": 66, cilantro: 66 });
    for (const id of [SAUCE, POM]) expect(LATE_ENTITLEMENT_FLOORS[id]).toBeLessThanOrEqual(stepOf(id).step);
  });
});

// ---- the real Production reducer (nothing mocked): the late catalog and FINISH are ON ----
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const pre = (state: GameState, ingredientId: string, n: number, k: number): GameState => {
  let next = state;
  for (let i = 0; i < n; i += 1) {
    next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId, x: DOUGH_CENTER - 28 + (((k + i) * 17) % 56), y: DOUGH_CENTER - 24 + (((k + i) * 11) % 48) });
  }
  return next;
};
const painted = (state: GameState): GameState => gameReducer(state, commit(SAUCE, ringBatch(DOUGH_CENTER, DOUGH_CENTER, 22, 40, 0.03)));

/** A Free Cooking round: tahini painted (optional), `preBake` pieces placed, baked, `post` placed in FINISH, 完成, registered. */
function freeRound(opts: { sauce: boolean; preBake: Record<string, number>; post: Record<string, number> }): GameState {
  let s = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  s = [{ type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 }].reduce((a, x) => gameReducer(a, x as never), s);
  s = { ...s, makingStep: "SAUCE" };
  if (opts.sauce) s = painted(s);
  let k = 0;
  for (const [id, n] of Object.entries(opts.preBake)) {
    s = { ...s, makingStep: getIngredient(id)?.category === "cheese" ? "CHEESE" : "TOPPING" };
    s = pre(s, id, n, k);
    k += n;
  }
  s = { ...s, makingStep: "TOPPING" };
  s = gameReducer(s, { type: "START_BAKE", now: 20_000 });
  s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
  expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
  for (const [id, n] of Object.entries(opts.post)) {
    for (let i = 0; i < n; i += 1) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: id, x: DOUGH_CENTER - 20 + i * 14, y: DOUGH_CENTER + 6 });
  }
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
  return gameReducer(s, { type: "REGISTER_TO_DEX" });
}
const PRE = { eggplant: 3, parsley: 1 };

describe("Free Cooking through the real reducer", () => {
  it("tahini painted, eggplant 3 + parsley 1 before the bake, pomegranate 2 in FINISH: NEW_DISCOVERY, in the Dex, 後乗せ recorded", () => {
    const r = freeRound({ sauce: true, preBake: PRE, post: { [POM]: 2 } });
    expect(r.phase).toBe("DISCOVERED");
    expect(r.completion?.status).toBe("PASS");
    expect(r.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: TAHINI_PIZZA });
    expect(discoveredRecipeIds(r.dex)).toContain(TAHINI_PIZZA);
    expect(r.discoveredTechniqueIds).toContain("late-addition");
  });

  it("the pomegranate placed BEFORE the bake, no tahini, or nothing placed in FINISH is a different pizza (ORIGINAL): the moment is part of the pizza and is never announced", () => {
    for (const round of [
      freeRound({ sauce: true, preBake: { ...PRE, [POM]: 2 }, post: {} }),
      freeRound({ sauce: false, preBake: PRE, post: { [POM]: 2 } }),
      freeRound({ sauce: true, preBake: PRE, post: {} }),
    ]) {
      expect(round.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(round.dex)).not.toContain(TAHINI_PIZZA);
    }
  });

  it("a parsley placed AFTER the bake (or a missing eggplant / parsley) is a different pizza (ORIGINAL), not the recipe: the parsley is a pre-bake piece", () => {
    expect(freeRound({ sauce: true, preBake: { eggplant: 3 }, post: { [POM]: 2, parsley: 1 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { eggplant: 3 }, post: { [POM]: 2 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { parsley: 1 }, post: { [POM]: 2 } }).lastDiscovery?.kind).toBe("ORIGINAL");
  });
});

describe("a Guided replay of the discovered recipe through the real reducer", () => {
  it("DOUGH -> SAUCE (tahini) -> TOPPING -> BAKE -> FINISH (pomegranate x2) -> RESULT: PASS, stock consumed once per use, the Dex entry counted", () => {
    let s = startGuidedPrepare(TAHINI_PIZZA, {}, 0);
    const steps = s.cookingProfile?.steps;
    expect(steps).toEqual(["DOUGH", "SAUCE", "TOPPING", "FINISH"]); // no CHEESE (no cheese in the recipe), no CUT
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 2_000 });
    expect(s.makingStep).toBe("SAUCE");
    s = painted(s);
    expect(s.pizza.sauceIds).toEqual([SAUCE]);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 3_000 });
    s = pre(s, "eggplant", 3, 0);
    s = pre(s, "parsley", 1, 3);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 5_000 });
    s = gameReducer(s, { type: "START_BAKE", now: 20_000 });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
    expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    const before = s.inventory;
    for (let i = 0; i < 2; i += 1) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: POM, x: DOUGH_CENTER - 20 + i * 14, y: DOUGH_CENTER + 6 });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
    expect(s.phase).toBe("RESULT");
    expect(s.completion?.status).toBe("PASS");
    expect(s.inventory[POM]).toBe((before[POM] ?? 0) - 2);
    const done = gameReducer(s, { type: "REGISTER_TO_DEX" });
    expect(done.dex.find((e) => e.recipeId === TAHINI_PIZZA)?.timesMade).toBeGreaterThanOrEqual(1);
  });
});
