import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient, type Ingredient } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import { materialIdsOfSteps } from "./discoveryLadder";
import {
  MATERIAL_PACK_PIZZAS,
  MATERIAL_PRICE_TIERS,
  materialK,
  materialLadderStep,
  materialOffer,
  materialShopState,
  nextMaterialHint,
  packQuantity,
  priceTierForStep,
  purchaseFirstPack,
  refillPack,
} from "./materialShop";
import { REC04_W1_25_LADDER_FIXTURE } from "./testSupport/discoveryLadderRule";
import type { InventoryState } from "../state/inventory";

function ing(id: string): Ingredient {
  const found = getIngredient(id);
  if (!found) throw new Error(`unknown ingredient ${id}`);
  return found;
}

/** Expected offer for every material of the production ladder -- the 25-recipe W1 ladder since
 *  I5b-3 (docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §4-§6): [id, step, tier, k, qty, pack, refill]. */
const EXPECTED_OFFERS: readonly [string, number, string, number, number, number, number][] = [
  ["egg", 1, "T1", 1, 10, 60, 30],
  ["bacon", 2, "T1", 3, 30, 60, 30],
  ["mushroom", 3, "T1", 3, 30, 60, 30],
  ["eggplant", 4, "T1", 3, 30, 60, 30],
  ["parmigiano", 5, "T1", 2, 20, 60, 30],
  ["pepperoni", 6, "T2", 4, 40, 80, 40],
  ["sausage", 7, "T2", 3, 30, 80, 40],
  ["ham", 8, "T2", 3, 30, 80, 40],
  ["corn", 9, "T2", 3, 30, 80, 40],
  ["pineapple", 10, "T2", 3, 30, 80, 40],
  ["black-olive", 11, "T2", 2, 20, 80, 40],
  ["oregano", 11, "T2", 2, 20, 80, 40],
  ["onion", 12, "T2", 4, 40, 80, 40],
  ["olive-oil", 13, "T2", 1, 10, 80, 40],
  ["garlic", 14, "T2", 3, 30, 80, 40],
  ["anchovy", 15, "T3", 3, 30, 100, 50],
  ["tuna", 16, "T3", 3, 30, 100, 50],
  ["pesto", 17, "T3", 1, 10, 100, 50],
  ["cherry-tomato", 18, "T3", 3, 30, 100, 50],
  ["clam", 19, "T3", 3, 30, 100, 50],
  ["fresh-tomato", 20, "T3", 3, 30, 100, 50],
  ["potato", 21, "T3", 3, 30, 100, 50],
  ["rosemary", 22, "T3", 3, 30, 100, 50],
  ["capers", 23, "T3", 2, 20, 100, 50],
  ["fontina", 24, "T3", 2, 20, 100, 50],
  ["gorgonzola", 24, "T3", 2, 20, 100, 50],
];

describe("price tiers (REC-04 OD-REC04-3)", () => {
  it("pack 60/80/100/120, refill 30/40/50/60 (half)", () => {
    expect(MATERIAL_PRICE_TIERS.map((t) => [t.tier, t.packPrice, t.refillPrice])).toEqual([
      ["T1", 60, 30],
      ["T2", 80, 40],
      ["T3", 100, 50],
      ["T4", 120, 60],
    ]);
    for (const t of MATERIAL_PRICE_TIERS) expect(t.refillPrice * 2).toBe(t.packPrice);
  });

  it("bands are T1 1-5, T2 6-14, T3 15-29, T4 30+ (contiguous, no gap)", () => {
    const expected = (s: number) => (s <= 5 ? "T1" : s <= 14 ? "T2" : s <= 29 ? "T3" : "T4");
    for (let step = 1; step <= 200; step += 1) {
      expect(priceTierForStep(step)?.tier).toBe(expected(step));
    }
  });

  it("matches REC-04's gate-based tier table (gate = 2 x step; exclusive maxima 12/30/60)", () => {
    const byGate = (gate: number) => (gate < 12 ? "T1" : gate < 30 ? "T2" : gate < 60 ? "T3" : "T4");
    for (let step = 1; step <= 60; step += 1) {
      expect(priceTierForStep(step)?.tier).toBe(byGate(2 * step));
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("step %s has no tier", (step) => {
    expect(priceTierForStep(step)).toBeNull();
  });
});

describe("k and pack quantity (10 x k)", () => {
  it("one pack covers 10 pizzas", () => {
    expect(MATERIAL_PACK_PIZZAS).toBe(10);
  });

  it("k is the largest minCount across recipes, recomputed from recipe data", () => {
    for (const ingredient of INGREDIENTS) {
      const counts = RECIPES.flatMap((r) =>
        r.requiredIngredients.filter((q) => q.ingredientId === ingredient.id).map((q) => q.minCount),
      );
      expect(materialK(ingredient.id)).toBe(counts.length === 0 ? 0 : Math.max(...counts));
      expect(packQuantity(ingredient.id)).toBe(10 * materialK(ingredient.id));
    }
  });

  it("uses the given recipe population (ham: 10 for the pre-W1 recipes, 30 with W1's pizza-portuguesa ham x3)", () => {
    const preW1 = (RECIPES as readonly Recipe[]).filter((r) => r.id === "margherita" || r.unlockCondition);
    expect(preW1).toHaveLength(15);
    expect(packQuantity("ham", preW1)).toBe(10);
    expect(packQuantity("ham")).toBe(30);
  });

  it("an unused or unknown ingredient has k = 0 and no pack", () => {
    expect(materialK("not-an-ingredient")).toBe(0);
    expect(packQuantity("not-an-ingredient")).toBe(0);
    expect(materialK("egg", [])).toBe(0);
  });

  it("ignores malformed minCount values", () => {
    const recipes = [
      { requiredIngredients: [{ ingredientId: "egg", minCount: Number.NaN }] },
      { requiredIngredients: [{ ingredientId: "egg", minCount: 2.5 }] },
      { requiredIngredients: [{ ingredientId: "egg", minCount: -4 }] },
      { requiredIngredients: [{ ingredientId: "egg", minCount: 2 }] },
    ];
    expect(materialK("egg", recipes)).toBe(2);
  });
});

describe("materialOffer: every shipped material (exhaustive)", () => {
  it.each(EXPECTED_OFFERS)("%s: step %i %s k=%i -> %i stock, %i / refill %i", (id, step, tier, k, qty, pack, refill) => {
    expect(materialOffer(ing(id))).toEqual({
      ingredientId: id,
      step,
      tier,
      k,
      packQuantity: qty,
      packPrice: pack,
      refillPrice: refill,
    });
    expect(materialLadderStep(id)).toBe(step);
  });

  it("covers exactly the ladder materials, and every finite ingredient a shipped recipe uses is for sale", () => {
    expect(EXPECTED_OFFERS.map(([id]) => id).sort()).toEqual(
      [...materialIdsOfSteps(DISCOVERY_LADDER.steps)].sort(),
    );
    const finiteUsed = INGREDIENTS.filter((i) => i.unlockCondition && materialK(i.id) > 0).map((i) => i.id).sort();
    expect(EXPECTED_OFFERS.map(([id]) => id).sort()).toEqual(finiteUsed);
  });

  it("starters are never for sale", () => {
    for (const id of STARTER_INGREDIENT_IDS) {
      expect(materialOffer(ing(id))).toBeNull();
      expect(materialLadderStep(id)).toBeNull();
    }
  });

  it("an ingredient missing from the ladder is not for sale", () => {
    const empty = { populationId: "empty", steps: [] };
    expect(materialOffer(ing("egg"), { ladder: empty })).toBeNull();
  });

  it("an ingredient no recipe uses is not for sale", () => {
    expect(materialOffer(ing("egg"), { recipes: [] })).toBeNull();
  });

  it("uses the given ladder's step for the tier (25-recipe fixture moves tuna to T3)", () => {
    expect(materialOffer(ing("tuna"), { ladder: REC04_W1_25_LADDER_FIXTURE })).toMatchObject({
      step: 16,
      tier: "T3",
      packPrice: 100,
      refillPrice: 50,
    });
  });

  it("is deterministic", () => {
    for (const [id] of EXPECTED_OFFERS) expect(materialOffer(ing(id))).toEqual(materialOffer(ing(id)));
  });
});

describe("materialShopState", () => {
  it("starter -> UNLIMITED regardless of lists", () => {
    for (const id of STARTER_INGREDIENT_IDS) {
      expect(materialShopState(ing(id), [], [])).toBe("UNLIMITED");
      expect(materialShopState(ing(id), [id], [id])).toBe("UNLIMITED");
    }
  });

  it.each<[string[], string[], string]>([
    [[], [], "LOCKED"],
    [[], ["egg"], "NEW"],
    [["egg"], [], "OWNED"],
    [["egg"], ["egg"], "OWNED"],
  ])("owned %j, unlocked %j -> %s", (owned, unlocked, expected) => {
    expect(materialShopState(ing("egg"), owned, unlocked)).toBe(expected);
  });
});

describe("nextMaterialHint", () => {
  it("counts the discoveries needed for the next step", () => {
    expect(nextMaterialHint(0)).toEqual({ discoveriesNeeded: 1, step: 1 });
    expect(nextMaterialHint(1)).toEqual({ discoveriesNeeded: 1, step: 2 });
    expect(nextMaterialHint(13)).toEqual({ discoveriesNeeded: 1, step: 14 });
  });

  it("is null once the ladder is complete", () => {
    expect(nextMaterialHint(24)).toBeNull();
    expect(nextMaterialHint(25)).toBeNull();
  });

  it("treats invalid counts as 0", () => {
    expect(nextMaterialHint(Number.NaN)).toEqual({ discoveriesNeeded: 1, step: 1 });
    expect(nextMaterialHint(-3)).toEqual({ discoveriesNeeded: 1, step: 1 });
  });

  // PR #227 review: a migrated EP4 save can already be entitled to later-step materials.
  it("skips steps whose materials are all already entitled (migrated EP4 save)", () => {
    // Dex 2 (margherita, funghi) and mushroom (step 3) already owned -> next new step is 4.
    expect(nextMaterialHint(2, ["egg", "bacon", "mushroom"])).toEqual({ discoveriesNeeded: 2, step: 4 });
    // Several consecutive entitled steps are skipped together (steps 3-5: mushroom, eggplant, parmigiano).
    expect(nextMaterialHint(2, ["egg", "bacon", "mushroom", "eggplant", "parmigiano"])).toEqual({
      discoveriesNeeded: 4,
      step: 6,
    });
  });

  it("a multi-material step still counts while any of its materials is not entitled", () => {
    // Step 11 = black-olive + oregano; only oregano entitled.
    expect(nextMaterialHint(10, ["oregano"])).toEqual({ discoveriesNeeded: 1, step: 11 });
    // Both entitled -> skip to step 12.
    expect(nextMaterialHint(10, ["oregano", "black-olive"])).toEqual({ discoveriesNeeded: 2, step: 12 });
  });

  it("is null when every remaining step is already entitled, even before the last step", () => {
    const all = materialIdsOfSteps(DISCOVERY_LADDER.steps);
    expect(nextMaterialHint(3, all)).toBeNull();
  });

  it("entitlement of already-reached steps never changes the hint", () => {
    expect(nextMaterialHint(1, ["egg"])).toEqual(nextMaterialHint(1));
  });
});

describe("purchaseFirstPack", () => {
  const base = {
    ingredient: ing("bacon"),
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    unlockedForShopIngredientIds: ["egg", "bacon"],
    inventory: {},
    pitzBalance: 100,
  };

  it("NEW -> OWNED, -60 Pitz, stock 0 -> 30", () => {
    const r = purchaseFirstPack(base);
    expect(r).toEqual({
      success: true,
      nextOwnedIngredientIds: [...STARTER_INGREDIENT_IDS, "bacon"],
      nextInventory: { bacon: 30 },
      nextPitzBalance: 40,
      quantity: 30,
      price: 60,
    });
  });

  it("every shipped material: first pack adds 10 x k and charges its tier price", () => {
    for (const [id, , , , qty, pack] of EXPECTED_OFFERS) {
      const r = purchaseFirstPack({
        ...base,
        ingredient: ing(id),
        unlockedForShopIngredientIds: [id],
        pitzBalance: pack,
      });
      expect(r).toMatchObject({ success: true, nextPitzBalance: 0, quantity: qty, price: pack });
      if (r.success) expect(r.nextInventory[id]).toBe(qty);
    }
  });

  it("adds to leftover stock instead of replacing it; corrupt stock reads as 0", () => {
    const leftover = purchaseFirstPack({ ...base, inventory: { bacon: 7, egg: 3 } });
    expect(leftover.success && leftover.nextInventory).toEqual({ bacon: 37, egg: 3 });
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = purchaseFirstPack({ ...base, inventory: { bacon: bad } });
      expect(r.success && r.nextInventory.bacon).toBe(30);
    }
  });

  it("exact balance succeeds; one short fails without charging", () => {
    expect(purchaseFirstPack({ ...base, pitzBalance: 60 }).success).toBe(true);
    expect(purchaseFirstPack({ ...base, pitzBalance: 59 })).toEqual({
      success: false,
      reason: "INSUFFICIENT_FUNDS",
    });
  });

  it.each([Number.NaN, -1, Number.NEGATIVE_INFINITY])("an invalid balance (%s) cannot pay", (pitzBalance) => {
    expect(purchaseFirstPack({ ...base, pitzBalance })).toEqual({
      success: false,
      reason: "INSUFFICIENT_FUNDS",
    });
  });

  it("rejects LOCKED, ALREADY_OWNED (no double purchase), UNLIMITED and NOT_FOR_SALE", () => {
    expect(purchaseFirstPack({ ...base, unlockedForShopIngredientIds: [] })).toEqual({
      success: false,
      reason: "LOCKED",
    });
    const first = purchaseFirstPack(base);
    if (!first.success) throw new Error("expected success");
    expect(
      purchaseFirstPack({
        ...base,
        ownedIngredientIds: first.nextOwnedIngredientIds,
        inventory: first.nextInventory,
        pitzBalance: first.nextPitzBalance,
      }),
    ).toEqual({ success: false, reason: "ALREADY_OWNED" });
    expect(
      purchaseFirstPack({ ...base, ingredient: ing("mozzarella"), unlockedForShopIngredientIds: ["mozzarella"] }),
    ).toEqual({ success: false, reason: "UNLIMITED" });
    expect(purchaseFirstPack({ ...base, recipes: [] })).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("does not mutate its inputs", () => {
    const owned = Object.freeze([...STARTER_INGREDIENT_IDS]);
    const inventory = Object.freeze({ egg: 2 });
    purchaseFirstPack({ ...base, ownedIngredientIds: owned, inventory });
    expect(owned).toEqual([...STARTER_INGREDIENT_IDS]);
    expect(inventory).toEqual({ egg: 2 });
  });
});

describe("refillPack", () => {
  const base = {
    ingredient: ing("ham"),
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "ham"],
    inventory: { ham: 2 } as InventoryState,
    pitzBalance: 100,
  };

  it("OWNED: -40 Pitz (T2 refill), +10 x k stock (ham k = 3 since W1's pizza-portuguesa)", () => {
    expect(refillPack(base)).toEqual({
      success: true,
      nextOwnedIngredientIds: [...STARTER_INGREDIENT_IDS, "ham"],
      nextInventory: { ham: 32 },
      nextPitzBalance: 60,
      quantity: 30,
      price: 40,
    });
  });

  it("every shipped material: refill adds 10 x k at half the pack price", () => {
    for (const [id, , , , qty, , refill] of EXPECTED_OFFERS) {
      const r = refillPack({
        ...base,
        ingredient: ing(id),
        ownedIngredientIds: [id],
        inventory: { [id]: 0 },
        pitzBalance: refill,
      });
      expect(r).toMatchObject({ success: true, nextPitzBalance: 0, quantity: qty, price: refill });
      if (r.success) expect(r.nextInventory[id]).toBe(qty);
    }
  });

  it("is repeatable, charging each time", () => {
    let state = { ...base };
    for (let i = 1; i <= 2; i += 1) {
      const r = refillPack(state);
      if (!r.success) throw new Error("expected success");
      state = { ...state, inventory: r.nextInventory, pitzBalance: r.nextPitzBalance };
    }
    expect(state.inventory).toEqual({ ham: 62 });
    expect(state.pitzBalance).toBe(20);
    expect(refillPack(state)).toEqual({ success: false, reason: "INSUFFICIENT_FUNDS" });
  });

  it("rejects NOT_OWNED (a NEW material needs the first pack), UNLIMITED and NOT_FOR_SALE", () => {
    expect(refillPack({ ...base, ownedIngredientIds: [] })).toEqual({ success: false, reason: "NOT_OWNED" });
    expect(refillPack({ ...base, ingredient: ing("basil"), ownedIngredientIds: ["basil"] })).toEqual({
      success: false,
      reason: "UNLIMITED",
    });
    expect(refillPack({ ...base, ladder: { populationId: "empty", steps: [] } })).toEqual({
      success: false,
      reason: "NOT_FOR_SALE",
    });
  });

  it("never produces negative stock", () => {
    const r = refillPack({ ...base, inventory: { ham: -9 } });
    expect(r.success && r.nextInventory.ham).toBe(30);
  });
});
