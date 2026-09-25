import { describe, expect, it } from "vitest";
import {
  DISCOVERY_LADDER,
  SHIPPED_15_DISCOVERY_LADDER,
  W1_25_DISCOVERY_LADDER,
} from "../data/discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { materialIdsOfSteps, validateDiscoveryLadder } from "./discoveryLadder";
import {
  MATERIAL_PRICE_TIERS,
  materialK,
  materialOffer,
  priceTierForStep,
  type MaterialOffer,
} from "./materialShop";
import {
  REC04_STARTERS,
  REC04_W1_25_LADDER_FIXTURE,
  W1_RECIPE_POPULATION_FIXTURE,
  W1_RECIPE_REQUIREMENTS_FIXTURE,
  buildKeyRecipeLadder,
  toMaterialLadder,
} from "./testSupport/discoveryLadderRule";
import { ingredientCollectionCount, obtainableIngredientIds, resolveShopEntitlement } from "../state/materialEntitlement";
import type { DexEntry, DexState } from "../state/dex";

/**
 * Progression 2.0 W1 I5b-1 (docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §3-§6): the 25-recipe
 * Discovery Ladder and its material economy, pinned as a pure, disconnected foundation. The
 * runtime still ships the 15-recipe ladder; the W1 recipes' requirements come from test-support
 * data only (they join `RECIPES` in I5b-3).
 */

const W1_POPULATION = [...RECIPES, ...W1_RECIPE_REQUIREMENTS_FIXTURE];
const W1_OPTIONS = { ladder: W1_25_DISCOVERY_LADDER, recipes: W1_POPULATION };
const W1_NEW_MATERIALS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"];

function offer(id: string, options = {}): MaterialOffer | null {
  return materialOffer(getIngredient(id)!, options);
}

describe("W1_25_DISCOVERY_LADDER: the exact 24-step authority", () => {
  const EXPECTED: readonly [number, string, string][] = [
    [1, "egg", "bismarck"],
    [2, "bacon", "breakfast-pizza"],
    [3, "mushroom", "funghi"],
    [4, "eggplant", "melanzane-pizza"],
    [5, "parmigiano", "parmigiana-pizza"],
    [6, "pepperoni", "pepperoni"],
    [7, "sausage", "salsiccia"],
    [8, "ham", "meat-lovers"],
    [9, "corn", "bambino"],
    [10, "pineapple", "hawaiian"],
    [11, "black-olive+oregano", "capricciosa"],
    [12, "onion", "pizza-portuguesa"],
    [13, "olive-oil", "fugazza"],
    [14, "garlic", "marinara"],
    [15, "anchovy", "napoletana"],
    [16, "tuna", "tonno-e-cipolla"],
    [17, "pesto", "pesto-tonno"],
    [18, "cherry-tomato", "genovese"],
    [19, "clam", "new-haven-apizza"],
    [20, "fresh-tomato", "pesto-caprese"],
    [21, "potato", "pesto-patate"],
    [22, "rosemary", "pizza-bianca"],
    [23, "capers", "puttanesca-pizza"],
    [24, "fontina+gorgonzola", "quattro-formaggi"],
  ];

  it("has 24 MATERIAL steps with exactly the authored materials and key recipes", () => {
    expect(W1_25_DISCOVERY_LADDER.populationId).toBe("w1-25");
    expect(
      W1_25_DISCOVERY_LADDER.steps.map((s) => [s.step, s.ingredientIds.join("+"), s.keyRecipeId]),
    ).toEqual(EXPECTED);
    for (const s of W1_25_DISCOVERY_LADDER.steps) expect(s.kind).toBe("MATERIAL");
  });

  it("equals the REC-04 fixture step for step", () => {
    expect(W1_25_DISCOVERY_LADDER.steps).toEqual(REC04_W1_25_LADDER_FIXTURE.steps);
  });

  it("is what the REC-04 key-recipe rule derives for production RECIPES + the W1 10", () => {
    const population = [
      ...RECIPES.map((r) => ({ id: r.id, ingredientIds: r.requiredIngredients.map((q) => q.ingredientId) })),
      ...W1_RECIPE_POPULATION_FIXTURE,
    ];
    expect(toMaterialLadder("w1-25", buildKeyRecipeLadder(population))).toEqual(W1_25_DISCOVERY_LADDER);
  });

  it("the two W1 test-support fixtures describe the same ingredient sets", () => {
    const fromRequirements = W1_RECIPE_REQUIREMENTS_FIXTURE.map((r) => [
      r.id,
      r.requiredIngredients.map((q) => q.ingredientId).sort(),
    ]).sort();
    const fromPopulation = W1_RECIPE_POPULATION_FIXTURE.map((r) => [r.id, [...r.ingredientIds].sort()]).sort();
    expect(fromRequirements).toEqual(fromPopulation);
  });

  it("passes validateDiscoveryLadder", () => {
    expect(validateDiscoveryLadder(W1_25_DISCOVERY_LADDER)).toEqual([]);
  });

  it("covers all 25 recipes: margherita is starter-only (no step), every other recipe is one key", () => {
    const keys = W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId);
    expect(new Set(keys).size).toBe(24);
    expect(keys).not.toContain("margherita");
    expect(new Set([...keys, "margherita"])).toEqual(new Set(W1_POPULATION.map((r) => r.id)));
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    for (const q of margherita.requiredIngredients) expect(REC04_STARTERS).toContain(q.ingredientId);
  });

  it("unlocks exactly the 26 finite catalog materials, never a starter, each once", () => {
    const materials = materialIdsOfSteps(W1_25_DISCOVERY_LADDER.steps);
    expect(materials).toHaveLength(26);
    expect(new Set(materials).size).toBe(26);
    expect([...materials].sort()).toEqual(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id).sort());
    for (const starter of STARTER_INGREDIENT_IDS) expect(materials).not.toContain(starter);
  });

  it("with it, starters + ladder materials = the whole 29-row catalog", () => {
    expect(obtainableIngredientIds(W1_25_DISCOVERY_LADDER)).toEqual(INGREDIENTS.map((i) => i.id));
  });
});

describe("25-ladder economy parity (pure; not wired to the runtime Shop)", () => {
  it("price tiers are the REC-04 authority", () => {
    expect(MATERIAL_PRICE_TIERS.map((t) => [t.tier, t.firstStep, t.lastStep, t.packPrice, t.refillPrice])).toEqual([
      ["T1", 1, 5, 60, 30],
      ["T2", 6, 14, 80, 40],
      ["T3", 15, 29, 100, 50],
      ["T4", 30, null, 120, 60],
    ]);
    expect(priceTierForStep(24)?.tier).toBe("T3");
  });

  // [id, step, tier, k, pack, first purchase, refill] with the 25-recipe ladder + population.
  const EXPECTED_W1_OFFERS: readonly [string, number, string, number, number, number, number][] = [
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

  it.each(EXPECTED_W1_OFFERS)(
    "%s: step %i, %s, k %i, pack %i, first %i, refill %i",
    (id, step, tier, k, pack, packPrice, refillPrice) => {
      expect(offer(id, W1_OPTIONS)).toEqual({ ingredientId: id, step, tier, k, packQuantity: pack, packPrice, refillPrice });
      expect(pack).toBe(10 * k);
    },
  );

  it("covers every finite material; starters stay unlimited and unsold", () => {
    expect(EXPECTED_W1_OFFERS.map(([id]) => id).sort()).toEqual(
      INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id).sort(),
    );
    for (const id of STARTER_INGREDIENT_IDS) expect(offer(id, W1_OPTIONS)).toBeNull();
  });
});

describe("old (shipped-15) -> new (W1-25) regression table", () => {
  // [id, old step, new step, old tier, new tier, old first/refill, new first/refill]
  const CHANGES: readonly [string, number, number, string, string, [number, number], [number, number]][] = [
    ["parmigiano", 14, 5, "T2", "T1", [80, 40], [60, 30]],
    ["pepperoni", 4, 6, "T1", "T2", [60, 30], [80, 40]],
    ["sausage", 5, 7, "T1", "T2", [60, 30], [80, 40]],
    ["anchovy", 9, 15, "T2", "T3", [80, 40], [100, 50]],
    ["tuna", 12, 16, "T2", "T3", [80, 40], [100, 50]],
    ["pesto", 13, 17, "T2", "T3", [80, 40], [100, 50]],
    ["cherry-tomato", 13, 18, "T2", "T3", [80, 40], [100, 50]],
    ["rosemary", 11, 22, "T2", "T3", [80, 40], [100, 50]],
    ["fontina", 14, 24, "T2", "T3", [80, 40], [100, 50]],
    ["gorgonzola", 14, 24, "T2", "T3", [80, 40], [100, 50]],
    ["ham", 6, 8, "T2", "T2", [80, 40], [80, 40]],
  ];

  it.each(CHANGES)("%s: step %i -> %i, %s -> %s", (id, oldStep, newStep, oldTier, newTier, oldPrices, newPrices) => {
    const before = offer(id)!;
    const after = offer(id, W1_OPTIONS)!;
    expect([before.step, before.tier, before.packPrice, before.refillPrice]).toEqual([oldStep, oldTier, ...oldPrices]);
    expect([after.step, after.tier, after.packPrice, after.refillPrice]).toEqual([newStep, newTier, ...newPrices]);
  });

  it("exactly 10 materials change price (1 cheaper, 9 dearer); everything else keeps its prices", () => {
    const changed = INGREDIENTS.filter((i) => materialOffer(i) !== null)
      .map((i) => [i.id, materialOffer(i)!, materialOffer(i, W1_OPTIONS)!] as const)
      .filter(([, a, b]) => a.packPrice !== b.packPrice || a.refillPrice !== b.refillPrice);
    expect(changed.map(([id]) => id).sort()).toEqual(
      ["anchovy", "cherry-tomato", "fontina", "gorgonzola", "parmigiano", "pepperoni", "pesto", "rosemary", "sausage", "tuna"],
    );
    expect(changed.filter(([, a, b]) => b.packPrice < a.packPrice).map(([id]) => id)).toEqual(["parmigiano"]);
  });
});

describe("k / pack foundation", () => {
  it("ham: k 1 -> 3, pack 10 -> 30 (pizza-portuguesa ham x3); the only existing material whose k changes", () => {
    expect(offer("ham")).toMatchObject({ k: 1, packQuantity: 10 });
    expect(offer("ham", W1_OPTIONS)).toMatchObject({ k: 3, packQuantity: 30 });
    const kChanged = INGREDIENTS.filter((i) => materialOffer(i) !== null)
      .filter((i) => materialK(i.id) !== materialK(i.id, W1_POPULATION))
      .map((i) => i.id);
    expect(kChanged).toEqual(["ham"]);
  });

  it.each([
    ["eggplant", 3, 30],
    ["corn", 3, 30],
    ["pineapple", 3, 30],
    ["clam", 3, 30],
    ["fresh-tomato", 3, 30],
    ["potato", 3, 30],
    ["capers", 2, 20],
  ] as const)("%s: k %i, pack %i with the W1 population (k 0 and no offer today)", (id, k, pack) => {
    expect(materialK(id)).toBe(0);
    expect(offer(id)).toBeNull();
    expect(materialK(id, W1_POPULATION)).toBe(k);
    expect(offer(id, W1_OPTIONS)).toMatchObject({ k, packQuantity: pack });
  });
});

describe("I5b-1 no-runtime-change guard", () => {
  function discovered(count: number): DexState {
    return RECIPES.slice(0, count).map(
      (r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }),
    );
  }

  it("the runtime still ships 15 recipes, the 14-step ladder, 29 catalog rows and 22 obtainable", () => {
    expect(RECIPES).toHaveLength(15);
    expect(DISCOVERY_LADDER).toBe(SHIPPED_15_DISCOVERY_LADDER);
    expect(DISCOVERY_LADDER.steps).toHaveLength(14);
    expect(INGREDIENTS).toHaveLength(29);
    expect(obtainableIngredientIds()).toHaveLength(22);
    expect(ingredientCollectionCount([...STARTER_INGREDIENT_IDS])).toEqual({ owned: 3, total: 22 });
  });

  it("the new 7 stay unobtainable: no offer, never entitled or announced by any discovery count", () => {
    for (const id of W1_NEW_MATERIALS) expect(offer(id)).toBeNull();
    for (let count = 0; count <= RECIPES.length; count += 1) {
      const r = resolveShopEntitlement(discovered(count), [...STARTER_INGREDIENT_IDS], []);
      for (const id of W1_NEW_MATERIALS) {
        expect(r.unlockedForShopIngredientIds).not.toContain(id);
        expect(r.newlyUnlockedMaterialIds).not.toContain(id);
      }
    }
  });

  it("no production module reads W1_25_DISCOVERY_LADDER or the W1 test-support fixtures", () => {
    const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../**/testSupport/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const readers = Object.entries(sources)
      .filter(([path]) => !path.endsWith("/data/discoveryLadder.ts"))
      .filter(([, text]) => /W1_25_DISCOVERY_LADDER|W1_RECIPE_REQUIREMENTS_FIXTURE/.test(text))
      .map(([path]) => path);
    expect(readers).toEqual([]);
  });
});
