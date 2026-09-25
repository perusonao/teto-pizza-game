import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { ORDERS } from "../data/orders";
import { RECIPE_SAUCE_PROFILES } from "../data/recipeSauceProfiles";
import { RECIPE_DISCOVERY_CATALOG, RECIPE_DISCOVERY_TARGET_IDS } from "../data/discoveryCatalog";
import { getReferencePizza, buildIdealSauceFixture } from "../data/referencePizza";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { evaluateDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { materialOffer } from "../logic/materialShop";
import { resolveShopEntitlement } from "./materialEntitlement";
import { availableRecipeIds } from "./progression";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { SAVE_STORAGE_KEY, createDefaultSave, loadSave, persistProgress, resetSave, type StorageLike } from "./persistence";
import type { DexEntry, DexState } from "./dex";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { ShopOverlay } from "../components/ShopOverlay";
import { IngredientTray } from "../components/IngredientTray";
import { pickMissionOrder } from "../mission/lunchRush";
import {
  LUNCH_RUSH_RULESET_VERSION,
  calculateLunchRushMissionScore,
  isValidLunchRushServeRecord,
} from "../shared/lunchRushScoring";

/**
 * Progression 2.0 W1 I5b-3 activation (docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md): the 10
 * W1 recipes and the 25-recipe ladder are live. Replaces I5a's catalog-only guards: the 7 W1
 * materials now unlock at their ladder step, are sold by the Shop, and the new recipes are
 * orderable, discoverable, scoreable and (except New Haven) CUT.
 */

afterEach(cleanup);

const W1_RECIPES: readonly RecipeId[] = [
  "melanzane-pizza",
  "parmigiana-pizza",
  "bambino",
  "hawaiian",
  "pizza-portuguesa",
  "pesto-tonno",
  "new-haven-apizza",
  "pesto-caprese",
  "pesto-patate",
  "puttanesca-pizza",
];
const NEW7: readonly [string, number][] = [
  ["eggplant", 4],
  ["corn", 9],
  ["pineapple", 10],
  ["clam", 19],
  ["fresh-tomato", 20],
  ["potato", 21],
  ["capers", 23],
];

function dexOf(count: number): DexState {
  return RECIPES.slice(0, count).map(
    (r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }),
  );
}

function ingredientsOf(id: RecipeId): string[] {
  return getRecipe(id)!.requiredIngredients.map((q) => q.ingredientId);
}

/** A pizza carrying exactly `ids` (sauces as sauceIds, one piece each for the rest). */
function pizzaWithItems(ids: readonly string[]): PizzaState {
  const sauceIds = ids.filter((id) => getIngredient(id)?.category === "sauce");
  const pieces = ids.filter((id) => getIngredient(id)?.category !== "sauce");
  return {
    ...createEmptyPizza(),
    sauceIds,
    toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 20 + i * 6, y: 50 })),
  };
}

describe("production tables: 25 recipes, one row each", () => {
  it("RECIPES, ORDERS, references, discovery targets and sauce profiles all cover the same 25 ids", () => {
    const ids = RECIPES.map((r) => r.id).sort();
    expect(ids).toHaveLength(25);
    expect(ORDERS.map((o) => o.recipeId).sort()).toEqual(ids);
    expect(Object.keys(RECIPE_SAUCE_PROFILES).sort()).toEqual(ids);
    expect(Object.keys(RECIPE_DISCOVERY_TARGET_IDS).sort()).toEqual(ids);
    expect(RECIPE_DISCOVERY_CATALOG.map((t) => t.recipeId).sort()).toEqual(ids);
    for (const id of ids) expect(getReferencePizza(id)?.recipeId).toBe(id);
    for (const id of W1_RECIPES) {
      expect(ORDERS.filter((o) => o.recipeId === id).map((o) => o.id)).toEqual([`order-${id}`]);
      expect(getRecipe(id)).toMatchObject({ baseRewardPitz: 100 });
      expect(getRecipe(id)).not.toHaveProperty("unlockCondition");
    }
  });

  it("new recipes keep the REC-01..03 values (Hawaiian 60-80, New Haven description, 9 / 10 / 9)", () => {
    expect(getRecipe("hawaiian")!.bakeTarget).toEqual({ start: 60, end: 80 });
    expect(getRecipe("new-haven-apizza")!.description).toBe(
      "オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたニューヘイブン風の一枚。",
    );
    const nonSauce = (id: RecipeId) =>
      getRecipe(id)!.requiredIngredients
        .filter((q) => getIngredient(q.ingredientId)!.category !== "sauce")
        .reduce((sum, q) => sum + q.minCount, 0);
    expect([nonSauce("parmigiana-pizza"), nonSauce("pizza-portuguesa"), nonSauce("puttanesca-pizza")]).toEqual([9, 10, 9]);
  });

  it.each(W1_RECIPES)("%s: Pizza Select can start it (SELECT_RECIPE -> PREPARE with its own order)", (id) => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ingredientsOf(id)];
    const state = createInitialGameState(dexOf(1), owned, 0, Object.fromEntries(ingredientsOf(id).map((i) => [i, 99])), [], []);
    const next = gameReducer(state, { type: "SELECT_RECIPE", recipeId: id });
    expect(next.phase).toBe("PREPARE");
    expect(next.recipe.id).toBe(id);
    expect(next.order.id).toBe(`order-${id}`);
  });
});

describe("exact-set discovery (Free Cooking)", () => {
  it.each(RECIPES.map((r) => r.id))("%s: its own ingredient set discovers exactly it", (id) => {
    const outcome = evaluateDiscovery(signatureOfPizza(pizzaWithItems(ingredientsOf(id))), RECIPE_DISCOVERY_CATALOG, []);
    expect(outcome).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
  });

  it("Melanzane is a subset of Parmigiana, but neither is mistaken for the other", () => {
    const melanzane = ingredientsOf("melanzane-pizza");
    const parmigiana = ingredientsOf("parmigiana-pizza");
    expect(melanzane.every((i) => parmigiana.includes(i))).toBe(true);
    expect(evaluateDiscovery(signatureOfPizza(pizzaWithItems(melanzane)), RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({
      recipeId: "melanzane-pizza",
    });
    expect(evaluateDiscovery(signatureOfPizza(pizzaWithItems(parmigiana)), RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({
      recipeId: "parmigiana-pizza",
    });
  });

  it("a superset / subset of a recipe's set is an original pizza, never a discovery (e.g. Melanzane + corn, Hawaiian minus pineapple)", () => {
    for (const items of [
      [...ingredientsOf("melanzane-pizza"), "corn"],
      ingredientsOf("hawaiian").filter((i) => i !== "pineapple"),
      [...ingredientsOf("pesto-tonno"), "mozzarella"],
    ]) {
      expect(evaluateDiscovery(signatureOfPizza(pizzaWithItems(items)), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("ORIGINAL");
    }
  });
});

describe("CUT: New Haven ends at BAKE; the other W1 recipes cut", () => {
  function bakeReferencePizza(id: RecipeId): GameState {
    const recipe = getRecipe(id)!;
    const reference = getReferencePizza(id)!;
    const owned = [...STARTER_INGREDIENT_IDS, ...ingredientsOf(id)];
    let s = createInitialGameState(dexOf(1), owned, 0, Object.fromEntries(ingredientsOf(id).map((i) => [i, 99])), [], []);
    s = gameReducer(s, { type: "SELECT_RECIPE", recipeId: id });
    s = gameReducer(s, { type: "BEGIN_PREPARE" });
    const steps = s.cookingProfile.steps.filter((step) => step !== "CUT");
    for (const step of steps) {
      if (step === "SAUCE") {
        s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: reference.sauce.ingredientId, deposits: buildIdealSauceFixture() });
      }
      if (step === "CHEESE" || step === "TOPPING") {
        for (const g of reference.pieceGroups) {
          if (getIngredient(g.ingredientId)!.category !== (step === "CHEESE" ? "cheese" : "topping")) continue;
          for (const p of g.positions) s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: g.ingredientId, x: p.x, y: p.y });
        }
      }
      if (step !== steps[steps.length - 1]) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    }
    s = gameReducer(s, { type: "START_BAKE" });
    return gameReducer(s, { type: "CONFIRM_BAKE", value: (recipe.bakeTarget.start + recipe.bakeTarget.end) / 2 });
  }

  it("New Haven (olive-oil PAINT_TEMPORARY + clam): CONFIRM_BAKE goes straight to RESULT, never CUT, and passes", () => {
    const s = bakeReferencePizza("new-haven-apizza");
    expect(s.cookingProfile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(s.phase).toBe("RESULT");
    expect(s.makingStep).not.toBe("CUT");
    expect(s.completion?.status).toBe("PASS");
    expect(s.scoringV2Result?.available).toBe(true);
    expect(s.pizza.toppings.some((t) => t.ingredientId === "clam")).toBe(true);
  });

  it.each(W1_RECIPES.filter((id) => id !== "new-haven-apizza"))("%s: CONFIRM_BAKE lands on POST_BAKE CUT (6 slices)", (id) => {
    const s = bakeReferencePizza(id);
    expect(s.phase).toBe("POST_BAKE");
    expect(s.makingStep).toBe("CUT");
    expect(s.cutState.config.requestedSliceCount).toBe(6);
  });
});

describe("the 7 new materials: hidden -> NEW (stock 0) -> first pack -> OWNED -> refill", () => {
  it.each(NEW7)("%s (step %i)", (id, step) => {
    const offer = materialOffer(getIngredient(id)!)!;
    expect(offer.step).toBe(step);
    // One discovery short of the step: not entitled, no Shop row.
    const before = resolveShopEntitlement(dexOf(step - 1), [...STARTER_INGREDIENT_IDS], []);
    expect(before.unlockedForShopIngredientIds).not.toContain(id);
    const shopBefore = render(
      <ShopOverlay
        dex={dexOf(step - 1)}
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        unlockedForShopIngredientIds={before.unlockedForShopIngredientIds}
        pitzBalance={999}
        inventory={{}}
        onPurchase={vi.fn()}
        onRestock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(shopBefore.container.querySelector(`.shop-item[data-ingredient-id="${id}"]`)).toBeNull();
    shopBefore.unmount();

    // Reaching the step: entitled, announced once, NEW at stock 0 (no free grant).
    const at = resolveShopEntitlement(dexOf(step), [...STARTER_INGREDIENT_IDS], before.unlockedForShopIngredientIds);
    expect(at.newlyUnlockedMaterialIds).toContain(id);
    const shopAt = render(
      <ShopOverlay
        dex={dexOf(step)}
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS]}
        unlockedForShopIngredientIds={at.unlockedForShopIngredientIds}
        pitzBalance={999}
        inventory={{}}
        onPurchase={vi.fn()}
        onRestock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const row = shopAt.container.querySelector<HTMLElement>(`.shop-item[data-ingredient-id="${id}"]`)!;
    expect(row.dataset.shopState).toBe("NEW");
    expect(row.textContent).toContain("在庫 0");
    shopAt.unmount();

    // First pack through the reducer: OWNED, +10 x k, -pack price. Then one refill.
    let s = createInitialGameState(dexOf(step), [...STARTER_INGREDIENT_IDS], offer.packPrice + offer.refillPrice, {}, [], at.unlockedForShopIngredientIds);
    s = gameReducer(s, { type: "PURCHASE_INGREDIENT", ingredientId: id });
    expect(s.ownedIngredientIds).toContain(id);
    expect(s.inventory[id]).toBe(offer.packQuantity);
    expect(s.pitzBalance).toBe(offer.refillPrice);
    s = gameReducer(s, { type: "RESTOCK_INGREDIENT", ingredientId: id });
    expect(s.inventory[id]).toBe(offer.packQuantity * 2);
    expect(s.pitzBalance).toBe(0);
  });
});

describe("Free Cooking: owned new materials are in the tray; not-owned ones cannot be placed", () => {
  it("owned clam (stocked) and corn (stock 0) are listed; pineapple (not owned) is not", () => {
    const tray = render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "clam", "corn"]}
        recipe={FREE_COOK_RECIPE}
        freeCook
        inventory={{ clam: 3, corn: 0 }}
        pizza={createEmptyPizza()}
      />,
    );
    expect(tray.getByRole("button", { name: /あさり/ })).toBeInTheDocument();
    expect(tray.getByRole("button", { name: /コーン/ })).toBeInTheDocument();
    expect(tray.queryByRole("button", { name: /パイナップル/ })).not.toBeInTheDocument();
  });

  function atToppingStep(state: GameState): GameState {
    let s = gameReducer(state, { type: "START_FREE_COOK", now: 1_000_000 });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealSauceFixture() });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
    return s;
  }

  it("places while stock remains; the Stock Gate stops it at 0; a not-owned material never places", () => {
    let s = atToppingStep(createInitialGameState(dexOf(1), [...STARTER_INGREDIENT_IDS, "clam"], 0, { clam: 1 }, [], ["clam"]));
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "clam", x: 50, y: 50 });
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "clam", x: 30, y: 60 });
    expect(s.pizza.toppings.filter((t) => t.ingredientId === "clam")).toHaveLength(1);
    const notOwned = atToppingStep(createInitialGameState(dexOf(1), [...STARTER_INGREDIENT_IDS], 0, { corn: 5 }, [], []));
    expect(gameReducer(notOwned, { type: "PLACE_TOPPING", ingredientId: "corn", x: 50, y: 50 }).pizza.toppings).toHaveLength(0);
  });
});

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { raw(): Record<string, unknown> } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    raw: () => JSON.parse(store.get(SAVE_STORAGE_KEY) ?? "null"),
  };
}

describe("save compatibility (schemaVersion 2, no bump)", () => {
  function futureSave(): Record<string, unknown> {
    return {
      ...createDefaultSave(),
      dex: [...dexOf(2), { recipeId: "brazilian-calabresa", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
      pitzBalance: 120,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "clam", "corn", "calabresa"],
      inventory: { egg: 7, clam: 12, corn: 0, calabresa: 9 },
      unlockedForShopIngredientIds: ["egg", "bacon", "clam", "corn", "fresh-tomato", "calabresa"],
      missionBest: { "lunch-rush": 900 },
      futureLedger: { purchased: ["clam"] },
    };
  }

  it("round-trips W1 ids, stock, ledger, Pitz and Lunch Rush data; keeps unknown ids and keys", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, "egg", "clam", "corn"]);
    persistProgress(
      {
        dex: save.dex,
        pitzBalance: save.pitzBalance - 60,
        ownedIngredientIds: save.ownedIngredientIds,
        inventory: { ...save.inventory, egg: 17 },
        starterGrantClaimedRecipeIds: save.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: save.unlockedForShopIngredientIds,
      },
      storage,
    );
    const written = storage.raw();
    expect(written.schemaVersion).toBe(2);
    expect(written.pitzBalance).toBe(60);
    expect(written.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, "egg", "clam", "corn", "calabresa"]);
    expect(written.inventory).toEqual({ egg: 17, clam: 12, corn: 0, calabresa: 9 });
    expect(written.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "clam", "corn", "fresh-tomato", "calabresa"]);
    expect(written.missionBest).toEqual({ "lunch-rush": 900 });
    expect(written.futureLedger).toEqual({ purchased: ["clam"] });
    expect((written.dex as { recipeId: string }[]).map((e) => e.recipeId)).toContain("brazilian-calabresa");
  });

  it("Full Game Reset still clears everything", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    expect(resetSave(storage)).toBe(true);
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });
});

describe("Lunch Rush: the new recipe ids flow through (ruleset unchanged)", () => {
  it("a discovered, makeable W1 recipe joins the mission pool; an undiscovered one does not", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ingredientsOf("hawaiian")];
    const dex: DexState = [
      { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
      { recipeId: "hawaiian", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 },
    ];
    const available = availableRecipeIds(dex, owned);
    expect(available).toContain("hawaiian");
    expect(available).toContain("margherita");
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) seen.add(pickMissionOrder(available, ["margherita", "hawaiian"])!.recipeId);
    expect([...seen].sort()).toEqual(["hawaiian", "margherita"]);
    const onlyMargherita = pickMissionOrder(available, ["margherita"]);
    expect(onlyMargherita?.recipeId).toBe("margherita");
  });

  it("server/client serve validation and mission scoring accept W1 recipe ids; ruleset stays lunch-rush-v1", () => {
    const serves = W1_RECIPES.map((recipeId) => ({ recipeId, qualityTotal: 80, completionStatus: "PASS" as const }));
    for (const serve of serves) expect(isValidLunchRushServeRecord(serve)).toBe(true);
    expect(calculateLunchRushMissionScore(serves).servedCount).toBe(10);
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
  });
});

describe("onboarding: the starters still make only Margherita", () => {
  it("availability with a fresh Dex and the 3 starters is Margherita only; the W1 recipes need Shop materials", () => {
    expect(availableRecipeIds([], [...STARTER_INGREDIENT_IDS])).toEqual(["margherita"]);
    const starterSubsets = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]].map((s) => s.map((i) => STARTER_INGREDIENT_IDS[i]));
    const discoverable = starterSubsets
      .map((items) => evaluateDiscovery(signatureOfPizza(pizzaWithItems(items)), RECIPE_DISCOVERY_CATALOG, []))
      .filter((o) => o.kind === "NEW_DISCOVERY")
      .map((o) => (o as { recipeId: string }).recipeId);
    expect(discoverable).toEqual(["margherita"]);
  });

  it("before the first discovery, SELECT_RECIPE cannot start a W1 recipe even if its materials are owned", () => {
    const owned = [...STARTER_INGREDIENT_IDS, ...ingredientsOf("melanzane-pizza")];
    const s = createInitialGameState([], owned, 0, { eggplant: 30 }, [], []);
    expect(gameReducer(s, { type: "SELECT_RECIPE", recipeId: "melanzane-pizza" })).toBe(s);
  });

  it("step 1 is still egg and DISCOVERY_LADDER is the 24-step W1 ladder", () => {
    expect(DISCOVERY_LADDER.steps).toHaveLength(24);
    expect(DISCOVERY_LADDER.steps[0]).toMatchObject({ step: 1, ingredientIds: ["egg"] });
    expect(resolveShopEntitlement(dexOf(1), [...STARTER_INGREDIENT_IDS], []).newlyUnlockedMaterialIds).toEqual(["egg"]);
  });
});
