import { describe, expect, it, vi } from "vitest";
import { getIngredient } from "../data/ingredients";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import {
  consumePizzaInventory,
  EMPTY_INVENTORY,
  hasStock,
  remainingStock,
  type InventoryState,
} from "./inventory";

const mozzarella = getIngredient("mozzarella")!; // Starter, no unlockCondition
const onion = getIngredient("onion")!; // finite, unlockCondition + pricePitz

/**
 * Economy & Progression 1.0 EP2: today's shipped `INGREDIENTS` (src/data/ingredients.ts) has
 * exactly one finite (`unlockCondition`-bearing) ingredient, `onion` -- itself a scatter/topping
 * ingredient, not a spread/sauce one. Testing "a finite spread/sauce consumes 1 unit per pizza"
 * and "multiple distinct finite ingredients consume atomically in one transaction" both need at
 * least one finite ingredient this shipped catalog doesn't have (a finite spread) or two finite
 * ingredients at once (this catalog has only one). Rather than adding real, player-visible
 * ingredients to production data purely to make these two rules testable (explicitly out of
 * EP2's scope -- no Shop/economy/content change), this file mocks two synthetic finite fixture
 * ingredients for `consumePizzaInventory`'s own pure-function tests only -- `getIngredient`
 * falls through to the real catalog for every other id, so every other test in this file (and
 * every other file importing "../data/ingredients") is completely unaffected.
 */
vi.mock("../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredients")>();
  const fakeFiniteIngredients: Record<string, ReturnType<typeof actual.getIngredient>> = {
    "ep2-test-finite-scatter": {
      id: "ep2-test-finite-scatter",
      category: "topping",
      nameJa: "EP2テスト用トッピング",
      color: "#000000",
      emoji: "❓",
      placement: "scatter",
      unlockCondition: { minTotalStars: 0 },
    },
    "ep2-test-finite-spread": {
      id: "ep2-test-finite-spread",
      category: "sauce",
      nameJa: "EP2テスト用ソース",
      color: "#000000",
      emoji: "❓",
      placement: "spread",
      unlockCondition: { minTotalStars: 0 },
    },
  };
  return {
    ...actual,
    getIngredient: (id: string) => fakeFiniteIngredients[id] ?? actual.getIngredient(id),
  };
});

const FAKE_FINITE_SCATTER = "ep2-test-finite-scatter";
const FAKE_FINITE_SPREAD = "ep2-test-finite-spread";

describe("hasStock", () => {
  it("is always true for a Starter ingredient regardless of inventory contents", () => {
    expect(hasStock(mozzarella, EMPTY_INVENTORY, 0)).toBe(true);
    expect(hasStock(mozzarella, { mozzarella: 0 }, 0)).toBe(true);
    expect(hasStock(mozzarella, { mozzarella: 0 }, 999)).toBe(true);
  });

  it("is false for a finite ingredient with an absent inventory key", () => {
    expect(hasStock(onion, EMPTY_INVENTORY, 0)).toBe(false);
  });

  it("is true below the persisted count, false at or above it", () => {
    const inventory: InventoryState = { onion: 3 };
    expect(hasStock(onion, inventory, 0)).toBe(true);
    expect(hasStock(onion, inventory, 2)).toBe(true);
    expect(hasStock(onion, inventory, 3)).toBe(false);
    expect(hasStock(onion, inventory, 4)).toBe(false);
  });
});

describe("remainingStock", () => {
  it("reports UNLIMITED for a Starter ingredient regardless of inventory contents", () => {
    expect(remainingStock(mozzarella, EMPTY_INVENTORY)).toBe("UNLIMITED");
    expect(remainingStock(mozzarella, { mozzarella: 0 })).toBe("UNLIMITED");
  });

  it("reads an absent finite-ingredient key as 0", () => {
    expect(remainingStock(onion, EMPTY_INVENTORY)).toBe(0);
  });

  it("reports the persisted count for a finite ingredient", () => {
    expect(remainingStock(onion, { onion: 5 })).toBe(5);
  });
});

function scatterPizza(ingredientId: string, count: number, overrides: Partial<PizzaState> = {}): PizzaState {
  return {
    ...createEmptyPizza(),
    toppings: Array.from({ length: count }, (_, i) => ({
      id: `${ingredientId}-${i}`,
      ingredientId,
      x: i,
      y: i,
    })),
    ...overrides,
  };
}

describe("consumePizzaInventory (Economy & Progression 1.0 EP2)", () => {
  it("never consumes an unlimited (Starter) ingredient, regardless of how many pieces are placed", () => {
    const pizza = scatterPizza("mozzarella", 8, { sauceIds: ["tomato-sauce"] });
    // Even if a Starter ingredient somehow acquired a tracked inventory entry, it must never be
    // read or decremented -- `!ingredient.unlockCondition` is a structural exemption, not a
    // default value.
    const inventory: InventoryState = { mozzarella: 1 };
    expect(consumePizzaInventory(pizza, inventory)).toBe(inventory);
  });

  it("consumes exactly the placed piece count for a finite scatter ingredient -- never the recipe's minCount", () => {
    // fugazza's own requiredIngredients minCount for onion is 4 (src/data/recipes.ts) --
    // placement counts of both above and below that minimum must consume the real amount placed.
    expect(consumePizzaInventory(scatterPizza("onion", 5), { onion: 20 })).toEqual({ onion: 15 });
    expect(consumePizzaInventory(scatterPizza("onion", 2), { onion: 20 })).toEqual({ onion: 18 });
  });

  it("a finite spread/sauce ingredient consumes exactly 1 unit per pizza, regardless of internal deposit count", () => {
    const pizza: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: [FAKE_FINITE_SPREAD],
      sauceDeposits: Array.from({ length: 40 }, (_, i) => ({ x: i, y: i, amount: 0.02 })),
    };
    expect(consumePizzaInventory(pizza, { [FAKE_FINITE_SPREAD]: 5 })).toEqual({
      [FAKE_FINITE_SPREAD]: 4,
    });
  });

  it("consumes multiple distinct finite ingredients together, atomically, from one pure computation", () => {
    const pizza: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: [FAKE_FINITE_SPREAD],
      toppings: [
        { id: "t1", ingredientId: FAKE_FINITE_SCATTER, x: 10, y: 10 },
        { id: "t2", ingredientId: FAKE_FINITE_SCATTER, x: 20, y: 20 },
        { id: "t3", ingredientId: FAKE_FINITE_SCATTER, x: 30, y: 30 },
      ],
    };
    const before: InventoryState = { [FAKE_FINITE_SCATTER]: 10, [FAKE_FINITE_SPREAD]: 5 };
    const after = consumePizzaInventory(pizza, before);
    expect(after).toEqual({ [FAKE_FINITE_SCATTER]: 7, [FAKE_FINITE_SPREAD]: 4 });
    // Both ids are computed from the same `before` snapshot in one returned object -- not two
    // sequential, independently-applied side effects -- and the input is never mutated.
    expect(before).toEqual({ [FAKE_FINITE_SCATTER]: 10, [FAKE_FINITE_SPREAD]: 5 });
  });

  it("clamps to 0 when placed count exceeds remaining stock -- inventory never goes negative", () => {
    const pizza = scatterPizza("onion", 5);
    expect(consumePizzaInventory(pizza, { onion: 2 })).toEqual({ onion: 0 });
    expect(consumePizzaInventory(pizza, { onion: 0 })).toEqual({ onion: 0 });
    expect(consumePizzaInventory(pizza, EMPTY_INVENTORY)).toEqual({ onion: 0 });
  });

  it("returns the exact same inventory reference when the pizza uses no finite ingredient at all", () => {
    const pizza = scatterPizza("mozzarella", 3, { sauceIds: ["tomato-sauce"] });
    const inventory: InventoryState = { onion: 3 };
    expect(consumePizzaInventory(pizza, inventory)).toBe(inventory);
  });

  it("a malformed pizza (non-array toppings/sauceIds) never throws and consumes nothing", () => {
    const malformed = {
      ...createEmptyPizza(),
      toppings: null as unknown as PizzaState["toppings"],
      sauceIds: "not-an-array" as unknown as PizzaState["sauceIds"],
    };
    expect(() => consumePizzaInventory(malformed, { onion: 3 })).not.toThrow();
    expect(consumePizzaInventory(malformed, { onion: 3 })).toEqual({ onion: 3 });
  });

  it("an unknown ingredient id (not in the catalog at all) is never consumed", () => {
    const pizza = scatterPizza("does-not-exist", 4);
    expect(consumePizzaInventory(pizza, { "does-not-exist": 10 })).toEqual({
      "does-not-exist": 10,
    });
  });
});
