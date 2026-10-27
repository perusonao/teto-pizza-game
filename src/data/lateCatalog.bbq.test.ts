import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { commit, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { BBQ_CHICKEN_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
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
import { pinsaEnabled } from "./pinsaGate";
import { getReferencePizza } from "./referencePizza";
import { toppingSizeClass } from "./toppingSizeClass";

/**
 * BBQ Chicken (Issue #611, Owner Final Design Gate 2026-10-27): `bbq-chicken-pizza` + `bbq-sauce` + `cilantro`, a LATE-catalog recipe (the cilantro scattered after the bake in FINISH; mozzarella, onion and chicken placed before it)
 * with two late-only materials. The bbq-sauce PAINT-before-bake, the chicken / onion without pre-cooking, the cilantro AFTER the bake, every count and the colour are GAMEPLAY ASSUMPTIONS / PROVISIONAL (the original page was not
 * confirmed; the cilantro timing rests only on the matrix's `catalog_design_tag`), pinned here only as the shipped data. The late step number is always derived from the ladder; the entitlement floor is a FIXED constant.
 */
const BBQ = "bbq-chicken-pizza" as RecipeId;
const SAUCE = "bbq-sauce";
const CIL = "cilantro";

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

describe("OFF (the rollback state) has no BBQ content", () => {
  it("with the late switch OFF, no recipe, ingredient, ladder step, discovery target or order mentions the BBQ content", async () => {
    const off = await loadOff();
    expect(off.recipes.RECIPES.some((r) => (r.id as string) === BBQ)).toBe(false);
    expect(off.ingredients.INGREDIENTS.some((i) => i.id === SAUCE || i.id === CIL)).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.includes(SAUCE) || s.ingredientIds.includes(CIL))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === BBQ)).toBe(false);
    expect(off.orders.ORDERS.some((o) => (o.recipeId as string) === BBQ)).toBe(false);
  });
});

describe("the shipped data (late catalog ON, as in Production)", () => {
  it("the late catalog is on, so the recipe is part of the catalog", () => {
    expect(lateCatalogEnabled()).toBe(true);
    expect(RECIPES.some((r) => r.id === BBQ)).toBe(true);
  });

  it("recipe: bbq-sauce 1 (PAINT) / mozzarella 2 / onion 1 / chicken 3 / cilantro 2 POST_BAKE = 8 non-sauce pieces, bake 58-78, not in Lunch Rush, ladder-credited (no ladderCredit field)", () => {
    const recipe = getRecipe(BBQ)!;
    expect(recipe.nameJa).toBe("BBQチキンピザ");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: SAUCE, minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "onion", minCount: 1 },
      { ingredientId: "chicken", minCount: 3 },
      { ingredientId: CIL, minCount: 2, applicationPhase: "POST_BAKE" },
    ]);
    const pieces = recipe.requiredIngredients.filter((r) => r.ingredientId !== SAUCE).reduce((n, r) => n + r.minCount, 0);
    expect(pieces).toBe(8);
    expect(recipe.requiredIngredients.filter((r) => r.applicationPhase === "POST_BAKE").map((r) => r.ingredientId)).toEqual([CIL]);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.lunchRush).toBe(false);
    expect("ladderCredit" in recipe).toBe(false);
    expect("doughKind" in recipe).toBe(false);
    expect(findOrderForRecipe(BBQ)?.recipeId).toBe(BBQ);
  });

  it("the description is the Owner-fixed sentence and names no moment (Anti-Oracle: it is shown before the recipe is discovered)", () => {
    const description = getRecipe(BBQ)!.description;
    expect(description).toBe("甘辛いソースのチキンに、香菜をそえた一枚。");
    expect(description).not.toMatch(/焼成|焼き上|焼いた|あと|仕上げ|後乗せ|振り/);
  });

  it("bbq-sauce: a late-only finite sauce (spread, ladder-gated, no topping family), provisional colour #7a2f1c", () => {
    const ingredient = getIngredient(SAUCE)!;
    expect(ingredient).toMatchObject({ category: "sauce", placement: "spread", color: "#7a2f1c", nameJa: "バーベキューソース" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(SAUCE)).toBeNull();
  });

  it("cilantro: a late-only finite topping (scatter, ladder-gated), family herb, size class xs, its own sprig art (candidate A)", () => {
    const ingredient = getIngredient(CIL)!;
    expect(ingredient).toMatchObject({ category: "topping", placement: "scatter", nameJa: "パクチー", pieceVisual: "cilantro-leaf" });
    expect(ingredient.unlockCondition).toBeDefined();
    expect(ingredientAttributeFamily(CIL)).toBe("herb");
    expect(toppingSizeClass(CIL)).toBe("xs");
  });

  it("the text fallbacks are unique: no other ingredient shares the bbq-sauce or cilantro emoji (G18)", () => {
    for (const id of [SAUCE, CIL]) {
      const own = getIngredient(id)!.emoji;
      expect(INGREDIENTS.filter((i) => i.emoji === own).map((i) => i.id)).toEqual([id]);
    }
  });

  it("catalog counts after this recipe: 75 recipes (74 with the Pinsa gate off), 85 ingredients, 66 ladder steps (5 late)", () => {
    expect(RECIPES.length).toBe(pinsaEnabled() ? 75 : 74); // Pinsa Romana joins RECIPES only while its own gate is open (as in catalogLedger.test.ts)
    expect(INGREDIENTS.length).toBe(85);
    expect(DISCOVERY_LADDER.steps.length).toBe(66);
    expect(LATE_LADDER_STEPS.length).toBe(5);
  });

  it("tables: PAINT bbq-sauce, key-free hint, a Reference of 8 pieces on the RT-01 layout in requiredIngredients order (the 2 cilantro last, one on the dough centre), no shared slot, no piece-count limit asserted", () => {
    expect(getRecipeSauceProfile(BBQ)).toEqual({ recipeId: BBQ, ingredientId: SAUCE, interaction: "PAINT" });
    expect(RECIPE_HINT_ROLES[BBQ]).toEqual({ keyFree: true });
    const reference = getReferencePizza(BBQ)!;
    expect(reference.sauce).not.toBeNull();
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 2], ["onion", 1], ["chicken", 3], [CIL, 2]]);
    expect(reference.pieceGroups.find((g) => g.ingredientId === CIL)!.interaction.landingStyle).toBe("LIGHT_LEAF");
    const placed = reference.pieceGroups.flatMap((g) => g.positions);
    expect(placed).toEqual(getReferenceSlots(8)); // consecutive slots 1-8
    expect(placed.at(-1)).toEqual({ x: 50, y: 52 }); // the 8th slot is the dough centre
    const slots = placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("discovery identity: the ingredient set + sauce + dimensions are unique among the catalog, and the cilantro is on the late axis (chicken / onion / mozzarella are not)", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const mine = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === BBQ)!;
    expect([...mine.items].sort()).toEqual([SAUCE, CIL, "chicken", "mozzarella", "onion"].sort());
    expect(mine.sauceBase).toEqual([SAUCE]);
    expect(mine.capabilities).toEqual(["LATE_ADDITION"]);
    expect(mine.identityDimensions.late).toEqual([["POST_BAKE", [CIL]]]);
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => key(t) === key(mine)).map((t) => t.recipeId)).toEqual([BBQ]);
    expect(discoveryIdentityOf(getRecipe(BBQ)!).capabilities).toEqual(["LATE_ADDITION"]);
  });
});

describe("ladder, Shop, Research and the entitlement floor", () => {
  const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!;

  it("one late step carries both materials (the sauce first, the cilantro = the Research cohort key last), keyed to the recipe, after the tahini step, with no star gate, a derived number, as the tail", () => {
    const steps = DISCOVERY_LADDER.steps;
    const mine = stepOf(SAUCE);
    expect(mine).toMatchObject({ ingredientIds: [SAUCE, CIL], keyRecipeId: BBQ });
    expect(stepOf(CIL)).toBe(mine);
    expect(mine.starGates).toBeUndefined();
    expect(mine.step).toBe(stepOf("tahini").step + 1);
    expect(steps.at(-1)).toBe(mine);
    expect(mine.step).toBe(ordinaryLadderSteps(steps).length + LATE_LADDER_STEPS.length); // ordinary length + the five late steps
    expect(LATE_LADDER_STEPS.map((s) => s.keyRecipeId)).toEqual(["ikura-salmon-pizza", "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", "eggplant-tahini-pizza", BBQ]);
  });

  it("Shop: both materials are T4 (the sauce pack 120 / refill 60), from the BBQ late step", () => {
    expect(materialOffer(getIngredient(SAUCE)!)!).toMatchObject({ tier: "T4", packPrice: 120, refillPrice: 60, step: stepOf(SAUCE).step });
    expect(materialOffer(getIngredient(CIL)!)!).toMatchObject({ tier: "T4", step: stepOf(CIL).step });
  });

  it("Research: the recipe's cohort is itself alone (no letter), and no other recipe's letter moves", () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const withIt = researchCohortLetters(owned, RECIPES);
    const without = researchCohortLetters(owned, RECIPES.filter((r) => r.id !== BBQ));
    expect(withIt.has(BBQ)).toBe(false);
    expect([...withIt.entries()]).toEqual([...without.entries()]);
  });

  it("the batch manifest validates on the full catalog: the new recipe is the tail (before Pinsa), one credited late step, key ingredient cilantro, no Research letter or chapter shift", () => {
    expect(validateBatchManifest(BBQ_CHICKEN_BATCH, productionCatalogView())).toEqual([]);
  });

  it("the compatibility floors are FIXED at 66 for both materials (never later than the step the ladder derives); the earlier floors are unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, [SAUCE]: 66, [CIL]: 66 });
    for (const id of [SAUCE, CIL]) expect(LATE_ENTITLEMENT_FLOORS[id]).toBeLessThanOrEqual(stepOf(id).step);
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

/** A Free Cooking round: bbq-sauce painted (optional), mozzarella (CHEESE) and the toppings placed, baked, `post` placed in FINISH, 完成, registered. */
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
const PRE = { mozzarella: 2, onion: 1, chicken: 3 };

describe("Free Cooking through the real reducer", () => {
  it("bbq-sauce painted, mozzarella 2 + onion 1 + chicken 3 before the bake, cilantro 2 in FINISH: NEW_DISCOVERY, in the Dex, 後乗せ recorded", () => {
    const r = freeRound({ sauce: true, preBake: PRE, post: { [CIL]: 2 } });
    expect(r.phase).toBe("DISCOVERED");
    expect(r.completion?.status).toBe("PASS");
    expect(r.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: BBQ });
    expect(discoveredRecipeIds(r.dex)).toContain(BBQ);
    expect(r.discoveredTechniqueIds).toContain("late-addition");
  });

  it("the cilantro placed BEFORE the bake, no bbq-sauce, or nothing placed in FINISH is a different pizza (ORIGINAL): the moment is part of the pizza and is never announced", () => {
    for (const round of [
      freeRound({ sauce: true, preBake: { ...PRE, [CIL]: 2 }, post: {} }),
      freeRound({ sauce: false, preBake: PRE, post: { [CIL]: 2 } }),
      freeRound({ sauce: true, preBake: PRE, post: {} }),
    ]) {
      expect(round.lastDiscovery?.kind).toBe("ORIGINAL");
      expect(discoveredRecipeIds(round.dex)).not.toContain(BBQ);
    }
  });

  it("a chicken placed AFTER the bake (or a missing onion / chicken) is a different pizza (ORIGINAL), not the recipe: the chicken is a pre-bake piece", () => {
    expect(freeRound({ sauce: true, preBake: { mozzarella: 2, onion: 1 }, post: { [CIL]: 2, chicken: 3 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { mozzarella: 2, chicken: 3 }, post: { [CIL]: 2 } }).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(freeRound({ sauce: true, preBake: { mozzarella: 2, onion: 1 }, post: { [CIL]: 2 } }).lastDiscovery?.kind).toBe("ORIGINAL");
  });
});

describe("a Guided replay of the discovered recipe through the real reducer", () => {
  it("DOUGH -> SAUCE (bbq-sauce) -> CHEESE -> TOPPING -> BAKE -> FINISH (cilantro x2) -> RESULT: PASS, stock consumed once per use, the Dex entry counted", () => {
    let s = startGuidedPrepare(BBQ, {}, 0);
    expect(s.cookingProfile?.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]); // the cheese step is there (mozzarella), no CUT
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 2_000 });
    expect(s.makingStep).toBe("SAUCE");
    s = painted(s);
    expect(s.pizza.sauceIds).toEqual([SAUCE]);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 3_000 });
    expect(s.makingStep).toBe("CHEESE");
    s = pre(s, "mozzarella", 2, 0);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    expect(s.makingStep).toBe("TOPPING");
    s = pre(s, "onion", 1, 2);
    s = pre(s, "chicken", 3, 3);
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 5_000 });
    s = gameReducer(s, { type: "START_BAKE", now: 20_000 });
    s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
    expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    const before = s.inventory;
    for (let i = 0; i < 2; i += 1) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: CIL, x: DOUGH_CENTER - 20 + i * 14, y: DOUGH_CENTER + 6 });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
    expect(s.phase).toBe("RESULT");
    expect(s.completion?.status).toBe("PASS");
    expect(s.inventory[CIL]).toBe((before[CIL] ?? 0) - 2);
    const done = gameReducer(s, { type: "REGISTER_TO_DEX" });
    expect(done.dex.find((e) => e.recipeId === BBQ)?.timesMade).toBeGreaterThanOrEqual(1);
  });
});
