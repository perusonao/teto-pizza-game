import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { commit, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { YUZU_SHRIMP_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
import { productionCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { RECIPE_DISCOVERY_CATALOG, discoveryIdentityOf } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, lateCatalogEnabled } from "./lateCatalog";
import { findOrderForRecipe } from "./orders";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getRecipe, RECIPES, type RecipeId } from "./recipes";
import { getReferencePizza } from "./referencePizza";

/**
 * New Sauces Phase B U1 (Issue #578, Owner 2026-10-25): `yuzu-shrimp-pizza` + `yuzu-kosho`, a LATE-catalog recipe (shiso placed after the bake in FINISH) whose new material is a
 * late-only sauce. The yuzu-kosho PAINT-before-bake, the shrimp placed before the bake without pre-cooking and every count are PROVISIONAL game-design values (the original page is not
 * confirmed on them), pinned here only as the shipped data. No late step NUMBER is pinned: it is always derived from the ladder.
 */
const YUZU = "yuzu-shrimp-pizza" as RecipeId;
const SAUCE = "yuzu-kosho";

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

describe("OFF (the rollback state) has no yuzu content", () => {
  it("with the late switch OFF, no recipe, ingredient, ladder step, discovery target or order mentions yuzu", async () => {
    const off = await loadOff();
    expect(off.recipes.RECIPES.some((r) => (r.id as string) === YUZU)).toBe(false);
    expect(off.ingredients.INGREDIENTS.some((i) => i.id === SAUCE)).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.includes(SAUCE))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === YUZU)).toBe(false);
    expect(off.orders.ORDERS.some((o) => (o.recipeId as string) === YUZU)).toBe(false);
  });
});

describe("the shipped data (late catalog ON, as in Production)", () => {
  it("the late catalog is on, so the recipe is part of the catalog", () => {
    expect(lateCatalogEnabled()).toBe(true);
    expect(RECIPES.some((r) => r.id === YUZU)).toBe(true);
  });

  it("recipe: yuzu-kosho 1 (PAINT) / mozzarella 2 / shrimp 3 / shiso 1 POST_BAKE, bake 58-78, not in Lunch Rush, ladder-credited (no ladderCredit field)", () => {
    const recipe = getRecipe(YUZU)!;
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: SAUCE, minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "shrimp", minCount: 3 },
      { ingredientId: "shiso", minCount: 1, applicationPhase: "POST_BAKE" },
    ]);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.lunchRush).toBe(false);
    expect("ladderCredit" in recipe).toBe(false);
    expect("doughKind" in recipe).toBe(false);
    expect(findOrderForRecipe(YUZU)?.recipeId).toBe(YUZU);
  });

  it("the description names no moment (Anti-Oracle: it is shown before the recipe is discovered)", () => {
    const description = getRecipe(YUZU)!.description;
    expect(description).not.toMatch(/焼成|焼き上|焼いた|あと|仕上げ|後乗せ/);
  });

  it("yuzu-kosho: a late-only finite sauce (spread, ladder-gated, no topping family, no size class), colour #a3ad52", () => {
    const ingredient = getIngredient(SAUCE)!;
    expect(ingredient).toMatchObject({ category: "sauce", placement: "spread", color: "#a3ad52", nameJa: "柚子胡椒" });
    expect(ingredient.unlockCondition).toBeDefined();
  });

  it("tables: PAINT yuzu-kosho, key-free hint, a Reference of 6 pieces (mozzarella 2 / shrimp 3 / shiso 1) on the 8-slot ring, a sauce target", () => {
    expect(getRecipeSauceProfile(YUZU)).toEqual({ recipeId: YUZU, ingredientId: SAUCE, interaction: "PAINT" });
    expect(RECIPE_HINT_ROLES[YUZU]).toEqual({ keyFree: true });
    const reference = getReferencePizza(YUZU)!;
    expect(reference.sauce).not.toBeNull();
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 2], ["shrimp", 3], ["shiso", 1]]);
    const slots = reference.pieceGroups.flatMap((g) => g.positions.map((p) => `${p.x},${p.y}`));
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("discovery identity: the ingredient set + sauce + dimensions are unique among the catalog, and the shiso is on the late axis", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const mine = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === YUZU)!;
    expect(mine.items).toEqual(["mozzarella", "shiso", "shrimp", SAUCE]);
    expect(mine.sauceBase).toEqual([SAUCE]);
    expect(mine.capabilities).toEqual(["LATE_ADDITION"]);
    expect(mine.identityDimensions.late).toEqual([["POST_BAKE", ["shiso"]]]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => key(t) === key(mine)).map((t) => t.recipeId)).toEqual([YUZU]);
    expect(discoveryIdentityOf(getRecipe(YUZU)!).capabilities).toEqual(["LATE_ADDITION"]);
  });
});

describe("ladder, Shop, Research and the entitlement floor", () => {
  const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!;

  it("a late step keyed to the recipe sits after the roe step, with no star gate and a derived (never authored) number; the ordinary ladder is its exact prefix", () => {
    const steps = DISCOVERY_LADDER.steps;
    const mine = stepOf(SAUCE);
    expect(mine).toMatchObject({ ingredientIds: [SAUCE], keyRecipeId: YUZU });
    expect(mine.starGates).toBeUndefined();
    expect(mine.step).toBe(stepOf("salmon-roe").step + 1);
    expect(steps.at(-2)).toBe(mine); // (New Sauces Phase B U2: the dengaku late step follows it)
    expect(mine.step).toBe(ordinaryLadderSteps(steps).length + 2); // ordinary length + the two late steps up to and including this one
    expect(LATE_LADDER_STEPS.map((s) => s.keyRecipeId)).toEqual(["ikura-salmon-pizza", YUZU, "eggplant-dengaku-pizza"]);
  });

  it("Shop: T4 (pack 120 / refill 60), from its own late step", () => {
    const offer = materialOffer(getIngredient(SAUCE)!)!;
    expect(offer).toMatchObject({ tier: "T4", packPrice: 120, refillPrice: 60, step: stepOf(SAUCE).step });
  });

  it("Research: the recipe's cohort is itself alone (no letter), and no other recipe's letter moves", () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const withIt = researchCohortLetters(owned, RECIPES);
    const without = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== YUZU));
    expect(withIt.has(YUZU)).toBe(false);
    expect([...withIt.entries()]).toEqual([...without.entries()]);
  });

  it("the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa), one credited late step, key ingredient yuzu-kosho, no Research letter or chapter shift", () => {
    expect(validateBatchManifest(YUZU_SHRIMP_BATCH, productionCatalogView())).toEqual([]);
  });

  it("the compatibility floor for yuzu-kosho is fixed at 58 (never later than the step the ladder derives), and salmon-roe stays at 57", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toMatchObject({ "salmon-roe": 57, [SAUCE]: 58 });
    expect(LATE_ENTITLEMENT_FLOORS[SAUCE]).toBeLessThanOrEqual(stepOf(SAUCE).step);
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

/** A Free Cooking round: yuzu-kosho painted (optional), `preBake` pieces placed, baked, `post` placed in FINISH, 完成, registered. */
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
const PRE = { mozzarella: 2, shrimp: 3 };

describe("Free Cooking through the real reducer", () => {
  it("yuzu-kosho painted, mozzarella 2 + shrimp 3 before the bake, shiso 1 in FINISH: NEW_DISCOVERY, in the Dex, 後乗せ recorded", () => {
    const r = freeRound({ sauce: true, preBake: PRE, post: { shiso: 1 } });
    expect(r.phase).toBe("DISCOVERED");
    expect(r.completion?.status).toBe("PASS");
    expect(r.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: YUZU });
    expect(discoveredRecipeIds(r.dex)).toContain(YUZU);
    expect(r.discoveredTechniqueIds).toContain("late-addition");
  });

  it("the shiso placed BEFORE the bake, no yuzu-kosho, or nothing placed in FINISH is a different pizza (ORIGINAL): the moment is part of the pizza and is never announced", () => {
    for (const round of [
      freeRound({ sauce: true, preBake: { ...PRE, shiso: 1 }, post: {} }),
      freeRound({ sauce: false, preBake: PRE, post: { shiso: 1 } }),
      freeRound({ sauce: true, preBake: PRE, post: {} }),
    ]) {
      expect(round.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(round.dex)).not.toContain(YUZU);
    }
  });

  it("a missing pre-bake kind (no shrimp, or no mozzarella) is a different pizza (ORIGINAL), not the recipe", () => {
    expect(freeRound({ sauce: true, preBake: { mozzarella: 2 }, post: { shiso: 1 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { shrimp: 3 }, post: { shiso: 1 } }).lastDiscovery?.kind).toBe("ORIGINAL");
  });
});

describe("a Guided replay of the discovered recipe through the real reducer", () => {
  it("DOUGH -> SAUCE (yuzu-kosho) -> CHEESE -> TOPPING -> BAKE -> FINISH (shiso) -> RESULT: PASS, stock consumed once per use, the Dex entry counted", () => {
    let s = startGuidedPrepare(YUZU, {}, 0);
    expect(s.cookingProfile?.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]); // no CUT
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 2_000 });
    expect(s.makingStep).toBe("SAUCE");
    s = painted(s);
    expect(s.pizza.sauceIds).toEqual([SAUCE]);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 3_000 });
    s = pre(s, "mozzarella", 2, 0);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    s = pre(s, "shrimp", 3, 3);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 5_000 });
    s = gameReducer(s, { type: "START_BAKE", now: 20_000 });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
    expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    const before = s.inventory;
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "shiso", x: DOUGH_CENTER - 20, y: DOUGH_CENTER + 6 });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
    expect(s.phase).toBe("RESULT");
    expect(s.completion?.status).toBe("PASS");
    expect(s.inventory.shiso).toBe((before.shiso ?? 0) - 1);
    const done = gameReducer(s, { type: "REGISTER_TO_DEX" });
    expect(done.dex.find((e) => e.recipeId === YUZU)?.timesMade).toBeGreaterThanOrEqual(1);
  });
});
