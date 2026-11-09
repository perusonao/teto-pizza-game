import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { commit, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { EGGPLANT_DENGAKU_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
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
 * New Sauces Phase B U2 (Issue #578, Owner 2026-10-25): `eggplant-dengaku-pizza` + `miso-sauce` + `white-sesame`, a LATE-catalog recipe (the sesame sprinkled after the bake in FINISH) with two late-only
 * materials. The miso-sauce PAINT-before-bake, the eggplant placed before the bake without pre-cooking, the sesame AFTER the bake and every count are GAMEPLAY ASSUMPTIONS (the original page was not read:
 * pizzadb.jp is unreachable from the build environment), pinned here only as the shipped data. The late step number is always derived from the ladder; the entitlement floor is a FIXED constant.
 */
const DENGAKU = "eggplant-dengaku-pizza" as RecipeId;
const SAUCE = "miso-sauce";
const SESAME = "white-sesame";

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

describe("OFF (the rollback state) has no dengaku content", () => {
  it("with the late switch OFF, no recipe, ingredient, ladder step, discovery target or order mentions the dengaku content", async () => {
    const off = await loadOff();
    expect(off.recipes.RECIPES.some((r) => (r.id as string) === DENGAKU)).toBe(false);
    expect(off.ingredients.INGREDIENTS.some((i) => i.id === SAUCE || i.id === SESAME)).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.includes(SAUCE) || s.ingredientIds.includes(SESAME))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === DENGAKU)).toBe(false);
    expect(off.orders.ORDERS.some((o) => (o.recipeId as string) === DENGAKU)).toBe(false);
  });
});

describe("the shipped data (late catalog ON, as in Production)", () => {
  it("the late catalog is on, so the recipe is part of the catalog", () => {
    expect(lateCatalogEnabled()).toBe(true);
    expect(RECIPES.some((r) => r.id === DENGAKU)).toBe(true);
  });

  it("recipe: miso-sauce 1 (PAINT) / mozzarella 2 / eggplant 3 / white-sesame 1 POST_BAKE, bake 58-78, not in Lunch Rush, ladder-credited (no ladderCredit field)", () => {
    const recipe = getRecipe(DENGAKU)!;
    expect(recipe.nameJa).toBe("ナス田楽ピザ");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: SAUCE, minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "eggplant", minCount: 3 },
      { ingredientId: SESAME, minCount: 1, applicationPhase: "POST_BAKE" },
    ]);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.lunchRush).toBe(false);
    expect("ladderCredit" in recipe).toBe(false);
    expect("doughKind" in recipe).toBe(false);
    expect(findOrderForRecipe(DENGAKU)?.recipeId).toBe(DENGAKU);
  });

  it("the description names no moment (Anti-Oracle: it is shown before the recipe is discovered)", () => {
    const description = getRecipe(DENGAKU)!.description;
    expect(description).not.toMatch(/焼成|焼き上|焼いた|あと|仕上げ|後乗せ|振り/);
  });

  it("miso-sauce: a late-only finite sauce (spread, ladder-gated, no topping family), provisional colour #9a5b2e", () => {
    const ingredient = getIngredient(SAUCE)!;
    expect(ingredient).toMatchObject({ category: "sauce", placement: "spread", color: "#9a5b2e", nameJa: "味噌だれ" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(SAUCE)).toBeNull();
  });

  it("white-sesame: a late-only finite topping (scatter, ladder-gated), family spice, size class xs, its own grain art (never a leaf visual), provisional colour #f4efe0", () => {
    const ingredient = getIngredient(SESAME)!;
    expect(ingredient).toMatchObject({ category: "topping", placement: "scatter", color: "#f4efe0", nameJa: "白ごま", pieceVisual: "sesame-seeds" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(SESAME)).toBe("spice");
    expect(toppingSizeClass(SESAME)).toBe("xs");
  });

  it("the text fallbacks are unique: no other ingredient shares the miso-sauce or white-sesame emoji", () => {
    for (const id of [SAUCE, SESAME]) {
      const own = getIngredient(id)!.emoji;
      expect(INGREDIENTS.filter((i) => i.emoji === own).map((i) => i.id)).toEqual([id]);
    }
  });

  it("tables: PAINT miso-sauce, key-free hint, a Reference of 6 pieces (mozzarella 2 / eggplant 3 / white-sesame 1) on the 8-slot ring, a sauce target, the sesame is a heavy (non-leaf) landing", () => {
    expect(getRecipeSauceProfile(DENGAKU)).toEqual({ recipeId: DENGAKU, ingredientId: SAUCE, interaction: "PAINT" });
    expect(RECIPE_HINT_ROLES[DENGAKU]).toEqual({ keyFree: true });
    const reference = getReferencePizza(DENGAKU)!;
    expect(reference.sauce).not.toBeNull();
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 2], ["eggplant", 3], [SESAME, 1]]);
    expect(reference.pieceGroups.find((g) => g.ingredientId === SESAME)!.interaction.landingStyle).not.toBe("LIGHT_LEAF");
    const slots = reference.pieceGroups.flatMap((g) => g.positions.map((p) => `${p.x},${p.y}`));
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("discovery identity: the ingredient set + sauce + dimensions are unique among the catalog, and the sesame is on the late axis", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const mine = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === DENGAKU)!;
    expect(mine.items).toEqual(["eggplant", SAUCE, "mozzarella", SESAME]);
    expect(mine.sauceBase).toEqual([SAUCE]);
    expect(mine.capabilities).toEqual(["LATE_ADDITION"]);
    expect(mine.identityDimensions.late).toEqual([["POST_BAKE", [SESAME]]]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => key(t) === key(mine)).map((t) => t.recipeId)).toEqual([DENGAKU]);
    expect(discoveryIdentityOf(getRecipe(DENGAKU)!).capabilities).toEqual(["LATE_ADDITION"]);
  });
});

describe("ladder, Shop, Research and the entitlement floor", () => {
  const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!;

  it("one late step carries both materials, keyed to the recipe, after the yuzu step, with no star gate and a derived (never authored) number; the ordinary ladder is its exact prefix", () => {
    const steps = DISCOVERY_LADDER.steps;
    const mine = stepOf(SAUCE);
    expect(mine).toMatchObject({ ingredientIds: [SAUCE, SESAME], keyRecipeId: DENGAKU });
    expect(stepOf(SESAME)).toBe(mine);
    expect(mine.starGates).toBeUndefined();
    expect(mine.step).toBe(stepOf("yuzu-kosho").step + 1);
    expect(steps.at(-5)).toBe(mine); // (New Sauces Phase B U3 / BBQ Chicken: the tahini and bbq late steps follow it)
    expect(mine.step).toBe(ordinaryLadderSteps(steps).length + 3); // ordinary length + the three late steps up to and including this one
    expect(LATE_LADDER_STEPS.map((s) => s.keyRecipeId)).toEqual(["ikura-salmon-pizza", "yuzu-shrimp-pizza", DENGAKU, "eggplant-tahini-pizza", "bbq-chicken-pizza", "wasabi-beef-pizza", "tarako-cream-pizza"]);
  });

  it("Shop: both materials are T4 (the sauce pack 120 / refill 60), from the dengaku late step", () => {
    const sauce = materialOffer(getIngredient(SAUCE)!)!;
    expect(sauce).toMatchObject({ tier: "T4", packPrice: 120, refillPrice: 60, step: stepOf(SAUCE).step });
    const sesame = materialOffer(getIngredient(SESAME)!)!;
    expect(sesame).toMatchObject({ tier: "T4", step: stepOf(SESAME).step });
  });

  it("Research: the recipe's cohort is itself alone (no letter), and no other recipe's letter moves", () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const withIt = researchCohortLetters(owned, RECIPES);
    const without = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== DENGAKU));
    expect(withIt.has(DENGAKU)).toBe(false);
    expect([...withIt.entries()]).toEqual([...without.entries()]);
  });

  it("the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa), one credited late step, key ingredient white-sesame, no Research letter or chapter shift", () => {
    expect(validateBatchManifest(EGGPLANT_DENGAKU_BATCH, productionCatalogView())).toEqual([]);
  });

  it("the compatibility floors are FIXED at 59 for both materials (never later than the step the ladder derives); salmon-roe stays 57 and yuzu-kosho 58", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toMatchObject({ "salmon-roe": 57, "yuzu-kosho": 58, [SAUCE]: 59, [SESAME]: 59 }); // (New Sauces Phase B U3: tahini / pomegranate are fixed at 60, asserted in lateCatalog.tahini.test.ts)
    for (const id of [SAUCE, SESAME]) expect(LATE_ENTITLEMENT_FLOORS[id]).toBeLessThanOrEqual(stepOf(id).step);
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

/** A Free Cooking round: miso-sauce painted (optional), `preBake` pieces placed, baked, `post` placed in FINISH, 完成, registered. */
function freeRound(opts: { sauce: boolean; preBake: Record<string, number>; post: Record<string, number> }): GameState {
  let s = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  s = [{ type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 }].reduce((a, x) => gameReducer(a, x as never), s);
  s = { ...s, makingStep: "SAUCE" };
  if (opts.sauce) s = painted(s);
  let k = 0;
  for (const [id, n] of Object.entries(opts.preBake)) {
    s = { ...s, makingStep: getIngredient(id)?.category === "cheese" ? "CHEESE" : "TOPPING" }; // mozzarella is placed in the CHEESE step, the rest in TOPPING
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
const PRE = { mozzarella: 2, eggplant: 3 };

describe("Free Cooking through the real reducer", () => {
  it("miso-sauce painted, mozzarella 2 + eggplant 3 before the bake, white-sesame 1 in FINISH: NEW_DISCOVERY, in the Dex, 後乗せ recorded", () => {
    const r = freeRound({ sauce: true, preBake: PRE, post: { [SESAME]: 1 } });
    expect(r.phase).toBe("DISCOVERED");
    expect(r.completion?.status).toBe("PASS");
    expect(r.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: DENGAKU });
    expect(discoveredRecipeIds(r.dex)).toContain(DENGAKU);
    expect(r.discoveredTechniqueIds).toContain("late-addition");
  });

  it("the sesame placed BEFORE the bake, no miso-sauce, or nothing placed in FINISH is a different pizza (ORIGINAL): the moment is part of the pizza and is never announced", () => {
    for (const round of [
      freeRound({ sauce: true, preBake: { ...PRE, [SESAME]: 1 }, post: {} }),
      freeRound({ sauce: false, preBake: PRE, post: { [SESAME]: 1 } }),
      freeRound({ sauce: true, preBake: PRE, post: {} }),
    ]) {
      expect(round.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(round.dex)).not.toContain(DENGAKU);
    }
  });

  it("a missing pre-bake kind (no eggplant, or no mozzarella) is a different pizza (ORIGINAL), not the recipe", () => {
    expect(freeRound({ sauce: true, preBake: { mozzarella: 2 }, post: { [SESAME]: 1 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { eggplant: 3 }, post: { [SESAME]: 1 } }).lastDiscovery?.kind).toBe("ORIGINAL");
  });
});

describe("a Guided replay of the discovered recipe through the real reducer", () => {
  it("DOUGH -> SAUCE (miso-sauce) -> CHEESE -> TOPPING -> BAKE -> FINISH (white-sesame) -> RESULT: PASS, stock consumed once per use, the Dex entry counted", () => {
    let s = startGuidedPrepare(DENGAKU, {}, 0);
    expect(s.cookingProfile?.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]); // no CUT
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 2_000 });
    expect(s.makingStep).toBe("SAUCE");
    s = painted(s);
    expect(s.pizza.sauceIds).toEqual([SAUCE]);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 3_000 });
    s = pre(s, "mozzarella", 2, 0);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    s = pre(s, "eggplant", 3, 3);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 5_000 });
    s = gameReducer(s, { type: "START_BAKE", now: 20_000 });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
    expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    const before = s.inventory;
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: SESAME, x: DOUGH_CENTER - 20, y: DOUGH_CENTER + 6 });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
    expect(s.phase).toBe("RESULT");
    expect(s.completion?.status).toBe("PASS");
    expect(s.inventory[SESAME]).toBe((before[SESAME] ?? 0) - 1);
    const done = gameReducer(s, { type: "REGISTER_TO_DEX" });
    expect(done.dex.find((e) => e.recipeId === DENGAKU)?.timesMade).toBeGreaterThanOrEqual(1);
  });
});
