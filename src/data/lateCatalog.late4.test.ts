import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveredRecipeIds, EMPTY_DEX } from "../state/dex";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { commit, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import { materialOffer } from "../logic/materialShop";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { LATE4_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";
import { productionCatalogView, validateBatchManifest } from "../logic/catalog/testSupport/recipeBatchValidator";
import { RECIPE_DISCOVERY_CATALOG } from "./discoveryCatalog";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { getIngredient, INGREDIENTS } from "./ingredients";
import { ingredientAttributeFamily } from "./ingredientTaxonomy";
import { LATE_DISCOVERY_TARGET_IDS, LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS } from "./lateCatalog";
import { findOrderForRecipe } from "./orders";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";
import { getRecipe, RECIPES, type RecipeId } from "./recipes";
import { getReferencePizza } from "./referencePizza";
import { toppingSizeClass } from "./toppingSizeClass";

/**
 * PR-2 late4 (Issue #578 / #611; design record docs/design/TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md): `wasabi-beef-pizza`, `tarako-cream-pizza` (bulgogi and yakiniku are HOLD, Owner 2026-10-28) + `soy-sauce`, `wasabi`, `cod-roe`,
 * `fresh-cream-sauce`, `nori`. Every sauce choice, count, timing (the mid-bake cod-roe approximated as POST_BAKE), colour and the beef without a stir-fry step are PROVISIONAL / GAMEPLAY ASSUMPTIONS (Owner 2026-10-28); pinned here only as the shipped data. Late step numbers are derived from the ladder; the entitlement floors are FIXED constants.
 */
const WASABI_BEEF = "wasabi-beef-pizza" as RecipeId;
const TARAKO = "tarako-cream-pizza" as RecipeId;
const NEW_RECIPES = [WASABI_BEEF, TARAKO];
const NEW_INGREDIENTS = ["soy-sauce", "wasabi", "cod-roe", "fresh-cream-sauce", "nori"];

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

describe("OFF (the rollback state) has no late4 content", () => {
  it("with the late switch OFF, no recipe, ingredient, ladder step, discovery target or order mentions it", async () => {
    const off = await loadOff();
    expect(off.recipes.RECIPES.some((r) => NEW_RECIPES.includes(r.id as RecipeId))).toBe(false);
    expect(off.ingredients.INGREDIENTS.some((i) => NEW_INGREDIENTS.includes(i.id))).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.some((id) => NEW_INGREDIENTS.includes(id)))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => NEW_RECIPES.includes(t.recipeId as RecipeId))).toBe(false);
    expect(off.orders.ORDERS.some((o) => NEW_RECIPES.includes(o.recipeId as RecipeId))).toBe(false);
  });
});

describe("the shipped data (late catalog ON, as in Production)", () => {
  it("wasabi-beef: soy-sauce 1 (PAINT) / mozzarella 2 / onion 1 / beef 3 / wasabi 1 POST_BAKE", () => {
    const recipe = getRecipe(WASABI_BEEF)!;
    expect(recipe.nameJa).toBe("わさび牛ピザ");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "soy-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "onion", minCount: 1 },
      { ingredientId: "beef", minCount: 3 },
      { ingredientId: "wasabi", minCount: 1, applicationPhase: "POST_BAKE" },
    ]);
  });

  it("tarako-cream: fresh-cream-sauce 1 (PAINT) / mozzarella 2 / cod-roe 2 + nori 1 + shiso 1, all three POST_BAKE", () => {
    const recipe = getRecipe(TARAKO)!;
    expect(recipe.nameJa).toBe("たらこクリームピザ");
    expect(recipe.requiredIngredients).toEqual([
      { ingredientId: "fresh-cream-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "cod-roe", minCount: 2, applicationPhase: "POST_BAKE" },
      { ingredientId: "nori", minCount: 1, applicationPhase: "POST_BAKE" },
      { ingredientId: "shiso", minCount: 1, applicationPhase: "POST_BAKE" },
    ]);
  });

  it("both: bake 58-78, not in Lunch Rush, credited (no ladderCredit field), an order, key-free hint, PAINT sauce profile", () => {
    const sauces: Record<string, string> = { [WASABI_BEEF]: "soy-sauce", [TARAKO]: "fresh-cream-sauce" };
    for (const id of NEW_RECIPES) {
      const recipe = getRecipe(id)!;
      expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
      expect(recipe.lunchRush).toBe(false);
      expect(recipe.baseRewardPitz).toBe(100);
      expect("ladderCredit" in recipe).toBe(false);
      expect(findOrderForRecipe(id)?.recipeId).toBe(id);
      expect(RECIPE_HINT_ROLES[id]).toEqual({ keyFree: true });
      expect(getRecipeSauceProfile(id)).toEqual({ recipeId: id, ingredientId: sauces[id], interaction: "PAINT" });
    }
  });

  it("the descriptions name no moment (Anti-Oracle: they are shown before the recipe is discovered)", () => {
    for (const id of NEW_RECIPES) expect(getRecipe(id)!.description).not.toMatch(/焼成|焼き上|焼いた|あと|仕上げ|後乗せ|振り/);
  });

  it("new materials: sauces are late-only spread sauces without a family; toppings are scatter with the families/sizes the design gate recommends", () => {
    for (const id of ["soy-sauce", "fresh-cream-sauce"]) {
      expect(getIngredient(id)).toMatchObject({ category: "sauce", placement: "spread" });
      expect(getIngredient(id)!.unlockCondition).toBeDefined();
      expect(ingredientAttributeFamily(id)).toBeNull();
    }
    expect(getIngredient("soy-sauce")).toMatchObject({ color: "#2a1a12", nameJa: "醤油ソース" });
    expect(getIngredient("fresh-cream-sauce")).toMatchObject({ color: "#efb9b4", nameJa: "クリームソース" });
    const toppings: Record<string, [string, string, string]> = {
      wasabi: ["spice", "xs", "wasabi-dab"],
      "cod-roe": ["seafood", "xs", "cod-roe-mass"],
      nori: ["vegetable", "xs", "nori-strips"],
    };
    for (const [id, [family, size, visual]] of Object.entries(toppings)) {
      expect(getIngredient(id)).toMatchObject({ category: "topping", placement: "scatter", pieceVisual: visual });
      expect(getIngredient(id)!.unlockCondition).toBeDefined();
      expect(ingredientAttributeFamily(id)).toBe(family);
      expect(toppingSizeClass(id)).toBe(size);
    }
  });

  it("the text fallbacks are unique (G18)", () => {
    for (const id of NEW_INGREDIENTS) {
      const own = getIngredient(id)!.emoji;
      expect(INGREDIENTS.filter((i) => i.emoji === own).map((i) => i.id)).toEqual([id]);
    }
  });

  it("References: pieces on the RT-01 layout in requiredIngredients order, no shared slot", () => {
    const expected: Record<string, [string, number][]> = {
      [WASABI_BEEF]: [["mozzarella", 2], ["onion", 1], ["beef", 3], ["wasabi", 1]],
      [TARAKO]: [["mozzarella", 2], ["cod-roe", 2], ["nori", 1], ["shiso", 1]],
    };
    for (const id of NEW_RECIPES) {
      const reference = getReferencePizza(id)!;
      expect(reference.sauce).not.toBeNull();
      expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual(expected[id]);
      const placed = reference.pieceGroups.flatMap((g) => g.positions);
      expect(placed).toEqual(getReferenceSlots(8).slice(0, placed.length));
    }
  });

  it("discovery identity: each ingredient set + sauce + dimensions is unique in the catalog, with the post-bake axis exactly as authored", () => {
    const key = (t: (typeof RECIPE_DISCOVERY_CATALOG)[number]) => JSON.stringify([t.items, t.sauceBase, t.identityDimensions]);
    const late: Record<string, string[]> = { [WASABI_BEEF]: ["wasabi"], [TARAKO]: ["cod-roe", "nori", "shiso"] };
    for (const id of NEW_RECIPES) {
      const mine = RECIPE_DISCOVERY_CATALOG.find((t) => (t.recipeId as string) === id)!;
      expect(mine.capabilities).toEqual(["LATE_ADDITION"]);
      expect(mine.identityDimensions.late).toEqual([["POST_BAKE", [...late[id]].sort()]]);
      expect(RECIPE_DISCOVERY_CATALOG.filter((t) => key(t) === key(mine)).map((t) => t.recipeId)).toEqual([id]);
    }
  });
});

describe("discovery targets", () => {
  it("tarako-cream keeps the PIZZA DB evidence id mentaiko-cream-pizza-pizzadb-p4; wasabi-beef its own id", () => {
    expect(RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === TARAKO)).toBe(true);
    expect(LATE_DISCOVERY_TARGET_IDS[TARAKO]).toBe("mentaiko-cream-pizza-pizzadb-p4");
    expect(LATE_DISCOVERY_TARGET_IDS[WASABI_BEEF]).toBe("wasabi-beef-pizza");
  });
});

describe("ladder, Shop, Research and the entitlement floors", () => {
  const stepOf = (ingredientId: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(ingredientId))!;

  it("two late steps after the BBQ step, keyed to the recipes, no star gate, derived numbers (67 and 68), as the tail", () => {
    const steps = DISCOVERY_LADDER.steps;
    expect(stepOf("wasabi")).toMatchObject({ ingredientIds: ["soy-sauce", "wasabi"], keyRecipeId: WASABI_BEEF });
    expect(stepOf("soy-sauce")).toBe(stepOf("wasabi"));
    expect(stepOf("nori")).toMatchObject({ ingredientIds: ["cod-roe", "fresh-cream-sauce", "nori"], keyRecipeId: TARAKO });
    expect(stepOf("wasabi").step).toBe(stepOf("bbq-sauce").step + 1);
    expect(stepOf("nori").step).toBe(stepOf("wasabi").step + 1);
    expect([stepOf("wasabi").step, stepOf("nori").step]).toEqual([67, 68]);
    expect(steps.at(-1)).toBe(stepOf("nori"));
    for (const id of ["wasabi", "nori"]) expect(stepOf(id).starGates).toBeUndefined();
    expect(stepOf("nori").step).toBe(ordinaryLadderSteps(steps).length + LATE_LADDER_STEPS.length);
    expect(LATE_LADDER_STEPS.map((s) => s.keyRecipeId)).toEqual(["ikura-salmon-pizza", "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", "eggplant-tahini-pizza", "bbq-chicken-pizza", WASABI_BEEF, TARAKO]);
  });

  it("Shop: every new material is T4 (sauce pack 120 / refill 60), from its own late step", () => {
    for (const id of NEW_INGREDIENTS) expect(materialOffer(getIngredient(id)!)!).toMatchObject({ tier: "T4", step: stepOf(id).step });
    expect(materialOffer(getIngredient("soy-sauce")!)!).toMatchObject({ packPrice: 120, refillPrice: 60 });
  });

  it("Research: each new recipe is its own single-member cohort (no letter), and no other recipe's letter moves", () => {
    const owned = INGREDIENTS.map((i) => i.id);
    const withIt = researchCohortLetters(owned, RECIPES);
    const without = researchCohortLetters(owned, RECIPES.filter((r) => !NEW_RECIPES.includes(r.id as RecipeId)));
    for (const id of NEW_RECIPES) expect(withIt.has(id)).toBe(false);
    expect([...withIt.entries()]).toEqual([...without.entries()]);
  });

  it("the batch manifest validates on the full catalog", () => {
    expect(validateBatchManifest(LATE4_BATCH, productionCatalogView())).toEqual([]);
  });

  it("the compatibility floors are FIXED (67 / 68), never later than the derived step; the earlier floors are unchanged", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({
      "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66,
      "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68,
    });
    for (const id of NEW_INGREDIENTS) expect(LATE_ENTITLEMENT_FLOORS[id]).toBeLessThanOrEqual(stepOf(id).step);
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

/** A Free Cooking round: `sauce` painted (optional), pre-bake pieces placed, baked, `post` placed in FINISH, 完成, registered. */
function freeRound(opts: { sauce: string | null; preBake: Record<string, number>; post: Record<string, number> }): GameState {
  let s = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  s = [{ type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 }].reduce((a, x) => gameReducer(a, x as never), s);
  s = { ...s, makingStep: "SAUCE" };
  if (opts.sauce) s = gameReducer(s, commit(opts.sauce, ringBatch(DOUGH_CENTER, DOUGH_CENTER, 22, 40, 0.03)));
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

describe("Free Cooking through the real reducer", () => {
  const cases: { id: RecipeId; sauce: string; preBake: Record<string, number>; post: Record<string, number> }[] = [
    { id: WASABI_BEEF, sauce: "soy-sauce", preBake: { mozzarella: 2, onion: 1, beef: 3 }, post: { wasabi: 1 } },
    { id: TARAKO, sauce: "fresh-cream-sauce", preBake: { mozzarella: 2 }, post: { "cod-roe": 2, nori: 1, shiso: 1 } },
  ];

  for (const c of cases) {
    it(`${c.id}: NEW_DISCOVERY, in the Dex, 後乗せ recorded`, () => {
      const r = freeRound(c);
      expect(r.phase).toBe("DISCOVERED");
      expect(r.completion?.status).toBe("PASS");
      expect(r.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: c.id });
      expect(discoveredRecipeIds(r.dex)).toContain(c.id);
      expect(r.discoveredTechniqueIds).toContain("late-addition");
    });

    it(`${c.id}: the post-bake pieces placed BEFORE the bake, or the sauce missing, is a different pizza (ORIGINAL); the moment is never announced`, () => {
      const [postId, postN] = Object.entries(c.post)[0];
      for (const round of [
        freeRound({ sauce: c.sauce, preBake: { ...c.preBake, [postId]: postN }, post: Object.fromEntries(Object.entries(c.post).slice(1)) }),
        freeRound({ sauce: null, preBake: c.preBake, post: c.post }),
      ]) {
        expect(round.lastDiscovery?.kind).toBe("ORIGINAL");
        expect(discoveredRecipeIds(round.dex)).not.toContain(c.id);
      }
    });
  }

  it("the wasabi-beef set with white-sesame instead of wasabi is not this recipe (bulgogi is HOLD: the pair is not in the catalog)", () => {
    const r = freeRound({ sauce: "soy-sauce", preBake: { mozzarella: 2, onion: 1, beef: 3 }, post: { "white-sesame": 1 } });
    expect(r.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(r.dex)).not.toContain(WASABI_BEEF);
  });
});
