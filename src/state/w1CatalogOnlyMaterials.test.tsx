import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { REC04_STARTERS } from "../logic/testSupport/discoveryLadderRule";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import {
  materialK,
  materialLadderStep,
  materialOffer,
  materialShopState,
  nextMaterialHint,
  packQuantity,
  purchaseFirstPack,
  refillPack,
} from "../logic/materialShop";
import { buildMaterialUnlockNotice, resolveShopEntitlement } from "./materialEntitlement";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  persistProgress,
  resetSave,
  type StorageLike,
} from "./persistence";
import type { DexEntry, DexState } from "./dex";
import { ShopOverlay } from "../components/ShopOverlay";
import { IngredientTray } from "../components/IngredientTray";
import { createEmptyPizza } from "./pizzaState";

/**
 * Progression 2.0 W1 Integration I5a-2: the 7 W1 materials are in the catalog but not obtainable
 * yet. RECIPES and DISCOVERY_LADDER are unchanged, so each has k = 0 and no material offer: no
 * Shop row, no unlock notice, no progress-hint change, no automatic entitlement, no Pitz purchase.
 * A save that already carries them (a future build's save) keeps them, and an owned one behaves
 * like any other owned finite ingredient in Free Cooking.
 */

const W1 = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"] as const;

afterEach(cleanup);

function discovered(count: number): DexState {
  return RECIPES.slice(0, count).map(
    (r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }),
  );
}

describe("pure Shop economy: no offer for a catalog-only material", () => {
  it.each(W1)("%s: k = 0, pack 0, no ladder step, no offer", (id) => {
    const ingredient = getIngredient(id)!;
    expect(materialK(id)).toBe(0);
    expect(packQuantity(id)).toBe(0);
    expect(materialLadderStep(id)).toBeNull();
    expect(materialOffer(ingredient)).toBeNull();
  });

  it("the shipped ladder and recipes still name none of them", () => {
    const ladderIds = materialIdsOfSteps(DISCOVERY_LADDER.steps);
    const recipeIds = new Set<string>(RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    for (const id of W1) {
      expect(ladderIds).not.toContain(id);
      expect(recipeIds.has(id)).toBe(false);
    }
    expect(DISCOVERY_LADDER.steps).toHaveLength(14);
    expect(RECIPES).toHaveLength(15);
  });

  it.each(W1)("%s: cannot be bought or refilled with Pitz, even when entitled / owned", (id) => {
    const ingredient = getIngredient(id)!;
    expect(
      purchaseFirstPack({
        ingredient,
        ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
        unlockedForShopIngredientIds: [id],
        inventory: {},
        pitzBalance: 9999,
      }),
    ).toEqual({ success: false, reason: "NOT_FOR_SALE" });
    expect(
      purchaseFirstPack({
        ingredient,
        ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
        unlockedForShopIngredientIds: [],
        inventory: {},
        pitzBalance: 9999,
      }),
    ).toEqual({ success: false, reason: "LOCKED" });
    expect(
      refillPack({ ingredient, ownedIngredientIds: [id], inventory: { [id]: 4 }, pitzBalance: 9999 }),
    ).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it.each(W1)("%s: a finite material, never an unlimited starter", (id) => {
    expect(materialShopState(getIngredient(id)!, [], [])).toBe("LOCKED");
  });

  it("the starter set is unchanged (tomato-sauce / mozzarella / basil)", () => {
    expect([...STARTER_INGREDIENT_IDS].sort()).toEqual([...REC04_STARTERS]);
  });
});

describe("Discovery Ladder entitlement, notice and progress hint are unchanged", () => {
  it("no discovery count ever entitles or announces a W1 material", () => {
    for (let count = 0; count <= RECIPES.length; count += 1) {
      const { unlockedForShopIngredientIds, newlyUnlockedMaterialIds } = resolveShopEntitlement(
        discovered(count),
        [...STARTER_INGREDIENT_IDS],
        [],
      );
      for (const id of W1) {
        expect(unlockedForShopIngredientIds).not.toContain(id);
        expect(newlyUnlockedMaterialIds).not.toContain(id);
      }
      const notice = buildMaterialUnlockNotice(newlyUnlockedMaterialIds);
      for (const id of W1) expect(notice?.namesJa ?? []).not.toContain(getIngredient(id)!.nameJa);
    }
  });

  it("the progress hint is identical whether or not a save already carries W1 ids", () => {
    for (let count = 0; count <= RECIPES.length; count += 1) {
      const ladderSoFar = materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step <= count));
      expect(nextMaterialHint(count, [...ladderSoFar, ...W1])).toEqual(nextMaterialHint(count, ladderSoFar));
    }
    expect(nextMaterialHint(DISCOVERY_LADDER.steps.length, materialIdsOfSteps(DISCOVERY_LADDER.steps))).toBeNull();
  });

  it("W1 ids already in the ledger or owned are kept, never dropped and never re-announced", () => {
    const r = resolveShopEntitlement(discovered(1), [...STARTER_INGREDIENT_IDS, "clam"], ["corn"]);
    expect(r.unlockedForShopIngredientIds).toEqual(["corn", "clam", "egg"]);
    expect(r.newlyUnlockedMaterialIds).toEqual(["egg"]);
  });
});

describe("reducer: Pitz purchase / refill of a W1 material is a no-op", () => {
  it.each(W1)("%s", (id) => {
    const entitled = createInitialGameState(discovered(1), [...STARTER_INGREDIENT_IDS], 9999, {}, [], [id]);
    expect(gameReducer(entitled, { type: "PURCHASE_INGREDIENT", ingredientId: id })).toBe(entitled);
    const owned = createInitialGameState(discovered(1), [...STARTER_INGREDIENT_IDS, id], 9999, { [id]: 4 }, [], []);
    expect(gameReducer(owned, { type: "RESTOCK_INGREDIENT", ingredientId: id })).toBe(owned);
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
  /** A future build's save: W1 materials owned / stocked / entitled, plus ids this build does not know. */
  function futureSave(): Record<string, unknown> {
    return {
      ...createDefaultSave(),
      dex: discovered(2),
      pitzBalance: 120,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "clam", "corn", "calabresa"],
      inventory: { egg: 7, clam: 12, corn: 0, calabresa: 9 },
      unlockedForShopIngredientIds: ["egg", "bacon", "clam", "corn", "fresh-tomato", "calabresa"],
      futureLedger: { purchased: ["clam"] },
    };
  }

  it("loads W1 ids into gameplay state (known ids now) with their stock", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    const save = loadSave(storage);
    expect(save.schemaVersion).toBe(2);
    expect(save.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, "egg", "clam", "corn"]);
    expect(save.inventory).toEqual({ egg: 7, clam: 12, corn: 0 });
    expect(save.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "clam", "corn", "fresh-tomato"]);
  });

  it("round-trips W1 ids and keeps unknown future ids and keys through a write", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    const save = loadSave(storage);
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
    expect(written.futureLedger).toEqual({ purchased: ["clam"] });
  });

  it("every W1 id round-trips byte-identically through a load + no-op write", () => {
    const raw = JSON.stringify({
      ...createDefaultSave(),
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...W1],
      inventory: Object.fromEntries(W1.map((id, i) => [id, i + 1])),
      unlockedForShopIngredientIds: [...W1],
    });
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: raw });
    const save = loadSave(storage);
    persistProgress(
      {
        dex: save.dex,
        pitzBalance: save.pitzBalance,
        ownedIngredientIds: save.ownedIngredientIds,
        inventory: save.inventory,
        starterGrantClaimedRecipeIds: save.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: save.unlockedForShopIngredientIds,
      },
      storage,
    );
    expect(JSON.stringify(storage.raw())).toBe(raw);
  });

  it("Full Game Reset still clears everything, W1 ids included", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    expect(resetSave(storage)).toBe(true);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });
});

describe("Shop UI: a W1 material is never a row", () => {
  it("owned, stocked and entitled W1 materials are not listed; ladder rows are unaffected", () => {
    render(
      <ShopOverlay
        dex={discovered(1)}
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, ...W1, "mushroom"]}
        unlockedForShopIngredientIds={["egg", ...W1]}
        pitzBalance={9999}
        inventory={Object.fromEntries([...W1, "mushroom"].map((id) => [id, 5]))}
        onPurchase={vi.fn()}
        onRestock={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const listed = Array.from(document.querySelectorAll<HTMLElement>(".shop-item")).map((e) => e.dataset.ingredientId);
    expect(listed).toEqual(["egg", "mushroom"]);
    const text = document.body.textContent ?? "";
    for (const id of W1) expect(text).not.toContain(getIngredient(id)!.nameJa);
    expect(document.querySelector(".shop-overlay__progress")?.textContent).toMatch(/あと1つ発見で新しい材料が入荷/);
  });

  it("the catalog now has 29 rows while the Shop can still offer only the 19 ladder materials", () => {
    expect(INGREDIENTS).toHaveLength(29);
    expect(INGREDIENTS.filter((i) => materialOffer(i) !== null)).toHaveLength(19);
  });
});

describe("Free Cooking: an owned W1 material behaves like any owned finite ingredient", () => {
  it("is offered in the Free Cooking tray when owned -- with stock and at 0 stock -- and never when not owned", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "clam", "corn"];
    const tray = render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={owned}
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
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealSauceFixture() });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    return s;
  }

  it("places while stock remains and is stopped by the Stock Gate at 0", () => {
    const base = createInitialGameState(discovered(1), [...STARTER_INGREDIENT_IDS, "clam"], 0, { clam: 1 }, [], []);
    let s = atToppingStep(base);
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "clam", x: 50, y: 50 });
    expect(s.pizza.toppings.filter((t) => t.ingredientId === "clam")).toHaveLength(1);
    const blocked = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "clam", x: 30, y: 60 });
    expect(blocked.pizza.toppings.filter((t) => t.ingredientId === "clam")).toHaveLength(1);
  });

  it("a not-owned W1 material cannot be placed", () => {
    const s = atToppingStep(createInitialGameState(discovered(1), [...STARTER_INGREDIENT_IDS], 0, { clam: 5 }, [], []));
    const next = gameReducer(s, { type: "PLACE_TOPPING", ingredientId: "clam", x: 50, y: 50 });
    expect(next.pizza.toppings.filter((t) => t.ingredientId === "clam")).toHaveLength(0);
  });
});
