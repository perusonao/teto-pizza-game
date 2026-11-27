import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "../../data/menuCatalog";
import { getRecipe, type RecipeId } from "../../data/recipes";
import { getIngredient } from "../../data/ingredients";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { REPUTATION_TABLE } from "./reputationTable";
import { activeShopCatalog } from "./shopProgression";
import { hintKeyToppingIdOf } from "../../state/discoveryHint";
import { EMPTY_SHOP_PROGRESS, hintRevealsOf, researchPointBalanceOf, researchPointsSpentOf, type ShopProgressState } from "./shopProgress";
import {
  SHOP_HINT_BASE_PRICE_BY_STAGE,
  SHOP_HINT_ITEM_KINDS,
  SHOP_HINT_PRICE_STEP,
  isShopHintTargetAt,
  purchaseShopHint,
  shopHintAnswer,
  shopHintBoardView,
  shopHintPrice,
  type ShopHintInputs,
  type ShopHintItemKind,
} from "./shopHints";

/**
 * B案 Phase 3d (Issue #901): research point hints -- the provisional price table, the items, the slot order, the purchase rules,
 * the reach guarantee (buying everything reaches the whole answer) and what is carried over from the Pitz hints.
 */
const catalog = activeShopCatalog();
const floors = REPUTATION_TABLE.chapterFloors as readonly [number, number, number, number, number];

function inputs(shop: Partial<ShopProgressState> = {}, more: Partial<ShopHintInputs> = {}): ShopHintInputs {
  return {
    shop: { ...EMPTY_SHOP_PROGRESS, reputation: 340, researchPointsEarned: 1000, ...shop },
    discoveredCount: 1,
    discoveryHintFacts: {},
    discoveryHintPurchases: {},
    ...more,
  };
}

const isTargetFor = (state: ShopHintInputs) => (id: string) => isShopHintTargetAt(id, state.shop.reputation, floors, catalog);

/** Buys `kind` at the price the board shows; returns the new inputs (throws on a refusal). */
function buy(state: ShopHintInputs, recipeId: string, kind: ShopHintItemKind): ShopHintInputs {
  const answer = shopHintAnswer(recipeId, catalog, hintKeyToppingIdOf)!;
  const price = shopHintBoardView(answer, state).price;
  const result = purchaseShopHint({ recipeId, kind, expectedPrice: price }, state, isTargetFor(state), catalog, hintKeyToppingIdOf);
  if (!result.ok) throw new Error(`${recipeId} ${kind}: ${result.reason}`);
  return { ...state, shop: result.shop };
}

describe("the provisional price table (Phase 3f tunes it here)", () => {
  it("base by stage 1 / 1 / 2 / 3 / 4, +1 per earlier purchase on the same recipe, no cap", () => {
    expect(SHOP_HINT_BASE_PRICE_BY_STAGE).toEqual([1, 1, 2, 3, 4]);
    expect(SHOP_HINT_PRICE_STEP).toBe(1);
    expect([1, 2, 3, 4, 5].map((stage) => shopHintPrice(stage, 0))).toEqual([1, 1, 2, 3, 4]);
    expect([0, 1, 2, 3].map((k) => shopHintPrice(3, k))).toEqual([2, 3, 4, 5]);
    expect(shopHintPrice(5, 40)).toBe(44);
  });

  it("the price a purchase charges follows the table: stage base, then +1 each time on that recipe only", () => {
    let state = inputs();
    const charges: number[] = [];
    for (const kind of ["SAUCE", "SHAPE", "INGREDIENT"] as const) {
      const before = researchPointsSpentOf(state.shop);
      state = buy(state, "flammkuchen", kind); // stage 4
      charges.push(researchPointsSpentOf(state.shop) - before);
    }
    expect(charges).toEqual([3, 4, 5]);
    // Another recipe starts again at its own base (stage 2).
    const before = researchPointsSpentOf(state.shop);
    state = buy(state, "napoletana", "SAUCE");
    expect(researchPointsSpentOf(state.shop) - before).toBe(1);
  });
});

describe("items and slot order", () => {
  it("every item kind is for sale on a fresh board", () => {
    const view = shopHintBoardView(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!, inputs());
    expect(view.forSale).toEqual(SHOP_HINT_ITEM_KINDS);
    expect(view.anyRevealed).toBe(false);
    expect(view.slots.every((s) => s.ingredientId === null && s.count === null)).toBe(true);
  });

  it("a cheese is a slot like any topping; the widely used ingredient opens first and the KEY_TOPPING last", () => {
    expect(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!.slotIngredientIds).toEqual(["mozzarella", "basil"]);
    const meat = shopHintAnswer("meat-lovers", catalog, hintKeyToppingIdOf)!;
    expect(meat.slotIngredientIds[0]).toBe("mozzarella");
    expect(meat.slotIngredientIds.at(-1)).toBe("ham");
    expect(shopHintAnswer("capricciosa", catalog, hintKeyToppingIdOf)!.slotIngredientIds.at(-1)).toBe("mushroom");
    expect(shopHintAnswer("quattro-formaggi", catalog, hintKeyToppingIdOf)!.slotIngredientIds).toHaveLength(4);
  });

  it("every adopted recipe: each KEY_TOPPING is the last slot; slots + sauces = the existing 「全部で○種類」", () => {
    for (const entry of MENU_CATALOG) {
      const answer = shopHintAnswer(entry.recipeId, catalog, hintKeyToppingIdOf)!;
      const recipe = getRecipe(entry.recipeId)!;
      const distinct = new Set(recipe.requiredIngredients.map((r) => r.ingredientId)).size;
      expect(answer.slotIngredientIds.length + answer.sauceIds.length, entry.recipeId).toBe(distinct);
      expect(answer.totalKinds, entry.recipeId).toBe(distinct);
      expect(answer.slotIngredientIds.every((id) => getIngredient(id)!.category !== "sauce"), entry.recipeId).toBe(true);
      if (answer.keyToppingId !== null) expect(answer.slotIngredientIds.at(-1), entry.recipeId).toBe(answer.keyToppingId);
    }
  });

  it("only the item bought is revealed; an ingredient purchase reveals the next slot only", () => {
    let state = buy(inputs(), "breakfast-pizza", "INGREDIENT");
    let view = shopHintBoardView(shopHintAnswer("breakfast-pizza", catalog, hintKeyToppingIdOf)!, state);
    expect(view.slots.map((s) => s.ingredientId)).toEqual(["mozzarella", null, null]);
    expect(view.sauceIds).toBeNull();
    expect(view.shape).toBeNull();
    expect(view.method).toBeNull();
    expect(view.countRevealed).toBe(false);
    expect(view.totalKinds).toBeNull();
    state = buy(state, "breakfast-pizza", "COUNT");
    view = shopHintBoardView(shopHintAnswer("breakfast-pizza", catalog, hintKeyToppingIdOf)!, state);
    expect(view.slots.map((s) => s.count)).toEqual([2, 1, 3]);
    expect(view.slots.map((s) => s.ingredientId)).toEqual(["mozzarella", null, null]);
  });

  it("the sauce item answers 「なし」 too, and only then the total shows", () => {
    const state = buy(inputs(), "aussie", "SAUCE");
    const view = shopHintBoardView(shopHintAnswer("aussie", catalog, hintKeyToppingIdOf)!, state);
    expect(view.sauceIds).toEqual([]);
    expect(view.totalKinds).toBe(4);
  });
});

describe("purchase rules", () => {
  it("not enough points: refused, nothing changes (the balance never goes below 0)", () => {
    const state = inputs({ researchPointsEarned: 2, researchPointsSpent: 0 });
    const answer = shopHintAnswer("flammkuchen", catalog, hintKeyToppingIdOf)!; // stage 4: 3 points
    const view = shopHintBoardView(answer, state);
    expect(view.price).toBe(3);
    expect(view.affordable).toBe(false);
    const result = purchaseShopHint({ recipeId: "flammkuchen", kind: "SAUCE", expectedPrice: 3 }, state, isTargetFor(state), catalog, hintKeyToppingIdOf);
    expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_POINTS" });
  });

  it("exactly the balance is enough and leaves 0", () => {
    const state = inputs({ researchPointsEarned: 3 });
    const after = buy(state, "flammkuchen", "SAUCE");
    expect(researchPointBalanceOf(after.shop)).toBe(0);
  });

  it("the same item cannot be bought twice; a stale price (a double tap) is refused", () => {
    const state = inputs();
    const once = buy(state, "margherita", "SAUCE");
    expect(purchaseShopHint({ recipeId: "margherita", kind: "SAUCE", expectedPrice: 2 }, once, isTargetFor(once), catalog, hintKeyToppingIdOf)).toEqual({
      ok: false,
      reason: "ALREADY_REVEALED",
    });
    // The same request the first board showed (price 1) is stale once the price rose.
    expect(purchaseShopHint({ recipeId: "margherita", kind: "SHAPE", expectedPrice: 1 }, once, isTargetFor(once), catalog, hintKeyToppingIdOf)).toEqual({
      ok: false,
      reason: "STALE",
    });
    let all = once;
    all = buy(all, "margherita", "INGREDIENT");
    all = buy(all, "margherita", "INGREDIENT");
    const view = shopHintBoardView(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!, all);
    expect(view.forSale).not.toContain("INGREDIENT");
    expect(purchaseShopHint({ recipeId: "margherita", kind: "INGREDIENT", expectedPrice: view.price }, all, isTargetFor(all), catalog, hintKeyToppingIdOf)).toEqual({
      ok: false,
      reason: "ALREADY_REVEALED",
    });
  });

  it("targets: adopted recipes of an open stage only (developed or not); anything else is refused", () => {
    const early = inputs({ reputation: 0 });
    expect(purchaseShopHint({ recipeId: "napoletana", kind: "SAUCE", expectedPrice: 1 }, early, isTargetFor(early), catalog, hintKeyToppingIdOf)).toEqual({
      ok: false,
      reason: "NOT_A_TARGET",
    });
    const notAdopted = "calzone" as RecipeId;
    expect(purchaseShopHint({ recipeId: notAdopted, kind: "SAUCE", expectedPrice: 1 }, early, () => true, catalog, hintKeyToppingIdOf)).toEqual({ ok: false, reason: "NOT_A_TARGET" });
    expect(purchaseShopHint({ recipeId: 3, kind: "SAUCE", expectedPrice: 1 }, early, () => true, catalog, hintKeyToppingIdOf)).toEqual({ ok: false, reason: "NOT_A_TARGET" });
    expect(purchaseShopHint({ recipeId: "margherita", kind: "NAME", expectedPrice: 1 }, early, isTargetFor(early), catalog, hintKeyToppingIdOf)).toEqual({
      ok: false,
      reason: "UNKNOWN_ITEM",
    });
    // Stage 2 opens at 40.
    const open = inputs({ reputation: 40 });
    expect(purchaseShopHint({ recipeId: "napoletana", kind: "SAUCE", expectedPrice: 1 }, open, isTargetFor(open), catalog, hintKeyToppingIdOf).ok).toBe(true);
  });

  it("any purchase order keeps spent <= earned and stores each item once", () => {
    let state = inputs({ researchPointsEarned: 25 });
    const order: ShopHintItemKind[] = ["COUNT", "INGREDIENT", "SAUCE", "INGREDIENT", "METHOD", "INGREDIENT", "SHAPE", "INGREDIENT"];
    for (const kind of order) {
      const answer = shopHintAnswer("capricciosa", catalog, hintKeyToppingIdOf)!;
      const price = shopHintBoardView(answer, state).price;
      const result = purchaseShopHint({ recipeId: "capricciosa", kind, expectedPrice: price }, state, isTargetFor(state), catalog, hintKeyToppingIdOf);
      if (result.ok) state = { ...state, shop: result.shop };
      expect(researchPointsSpentOf(state.shop)).toBeLessThanOrEqual(25);
      expect(researchPointBalanceOf(state.shop)).toBeGreaterThanOrEqual(0);
    }
    const items = hintRevealsOf(state.shop, "capricciosa");
    expect(new Set(items).size).toBe(items.length);
  });
});

describe("reach guarantee: buying every item reaches the whole answer", () => {
  for (const entry of MENU_CATALOG) {
    it(entry.recipeId, () => {
      let state = inputs({ researchPointsEarned: 100000 });
      const answer = shopHintAnswer(entry.recipeId, catalog, hintKeyToppingIdOf)!;
      for (let guard = 0; guard < 50; guard++) {
        const view = shopHintBoardView(answer, state);
        if (view.complete) break;
        state = buy(state, entry.recipeId, view.forSale[0]);
      }
      const view = shopHintBoardView(answer, state);
      expect(view.complete).toBe(true);
      const recipe = getRecipe(entry.recipeId)!;
      const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === entry.recipeId)!;
      // The ingredient set and the sauce the matcher compares.
      const items = [...(view.sauceIds ?? []), ...view.slots.map((s) => s.ingredientId!)].sort();
      expect(items).toEqual([...target.items].sort());
      expect([...(view.sauceIds ?? [])].sort()).toEqual([...(target.sauceBase ?? [])].sort());
      // The pan, the dough and the late toppings.
      expect(view.shape === "square" ? "tray" : null).toBe(target.identityDimensions.pan);
      expect(view.method!.dough).toBe(target.identityDimensions.dough);
      const late = view.slots.filter((s) => s.late).map((s) => s.ingredientId!).sort();
      expect(late).toEqual([...new Set(target.identityDimensions.late.flatMap(([, ids]) => ids))].sort());
      expect(view.method!.lateCount).toBe(late.length);
      // The counts (minCount).
      for (const slot of view.slots) {
        expect(slot.count).toBe(recipe.requiredIngredients.find((r) => r.ingredientId === slot.ingredientId)!.minCount);
      }
      expect(view.totalKinds).toBe(new Set(recipe.requiredIngredients.map((r) => r.ingredientId)).size);
    });
  }
});

describe("carried over from the Pitz hints (never charged twice)", () => {
  it("a bought name reveals its slot, is not for sale again, and does not raise the price", () => {
    const state = inputs({}, { discoveryHintFacts: { margherita: ["ing:basil", "h5:key", "cls:basil"] } });
    const answer = shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!;
    const view = shopHintBoardView(answer, state);
    expect(view.slots).toEqual([
      { ingredientId: null, count: null, late: false, carriedOver: false },
      { ingredientId: "basil", count: null, late: false, carriedOver: true },
    ]);
    expect(view.price).toBe(1);
    const after = buy(state, "margherita", "INGREDIENT");
    expect(hintRevealsOf(after.shop, "margherita")).toEqual(["ing:mozzarella"]);
    expect(shopHintBoardView(answer, after).forSale).not.toContain("INGREDIENT");
  });

  it("the sauce counts as revealed once every sauce was named", () => {
    const named = inputs({}, { discoveryHintFacts: { "grandma-pizza": ["ing:tomato-sauce", "ing:olive-oil", "h5:sauce"] } });
    expect(shopHintBoardView(shopHintAnswer("grandma-pizza", catalog, hintKeyToppingIdOf)!, named).sauceIds).toEqual(["tomato-sauce", "olive-oil"]);
    const half = inputs({}, { discoveryHintFacts: { "grandma-pizza": ["ing:tomato-sauce"] } });
    expect(shopHintBoardView(shopHintAnswer("grandma-pizza", catalog, hintKeyToppingIdOf)!, half).sauceIds).toBeNull();
  });

  it("an Economy 1.0 level's named line carries over too; a classification, a total or another recipe's name does not", () => {
    const legacy = inputs({}, { discoveryHintPurchases: { margherita: 4 } });
    const view = shopHintBoardView(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!, legacy);
    expect(view.slots.some((s) => s.carriedOver)).toBe(true);
    const nothing = inputs({}, { discoveryHintFacts: { margherita: ["cls:basil", "meta:ingredient-total", "ing:garlic"], funghi: ["ing:mozzarella"] } });
    expect(shopHintBoardView(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!, nothing).anyRevealed).toBe(false);
  });
});

describe("the Research Entry's own clue counts as known", () => {
  it("its unlock ingredient is revealed for free; buying goes on with the next slot", () => {
    const state = inputs({}, { researchKnownIngredientIdOf: (id) => (id === "meat-lovers" ? "sausage" : null) });
    const answer = shopHintAnswer("meat-lovers", catalog, hintKeyToppingIdOf)!;
    const view = shopHintBoardView(answer, state);
    expect(view.slots.filter((s) => s.ingredientId !== null).map((s) => s.ingredientId)).toEqual(["sausage"]);
    expect(view.price).toBe(1);
    const after = buy(state, "meat-lovers", "INGREDIENT");
    expect(hintRevealsOf(after.shop, "meat-lovers")).toEqual(["ing:mozzarella"]);
  });
});

describe("the free Margherita hint (R4 #16)", () => {
  it("while nothing is developed (Dex 0): every Margherita item costs 0 and nothing is spent", () => {
    let state = inputs({ researchPointsEarned: 0 }, { discoveredCount: 0 });
    const answer = shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!;
    expect(shopHintBoardView(answer, state)).toMatchObject({ price: 0, free: true, affordable: true });
    for (let i = 0; i < 6; i++) {
      const view = shopHintBoardView(answer, state);
      if (view.complete) break;
      state = buy(state, "margherita", view.forSale[0]);
    }
    expect(shopHintBoardView(answer, state).complete).toBe(true);
    expect(researchPointsSpentOf(state.shop)).toBe(0);
  });

  it("not another recipe, and not once something is developed", () => {
    expect(shopHintBoardView(shopHintAnswer("marinara", catalog, hintKeyToppingIdOf)!, inputs({}, { discoveredCount: 0 })).free).toBe(false);
    expect(shopHintBoardView(shopHintAnswer("margherita", catalog, hintKeyToppingIdOf)!, inputs({}, { discoveredCount: 1 })).free).toBe(false);
  });
});
