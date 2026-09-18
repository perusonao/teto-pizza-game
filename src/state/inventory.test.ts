import { describe, expect, it } from "vitest";
import { getIngredient } from "../data/ingredients";
import { EMPTY_INVENTORY, hasStock, remainingStock, type InventoryState } from "./inventory";

const mozzarella = getIngredient("mozzarella")!; // Starter, no unlockCondition
const onion = getIngredient("onion")!; // finite, unlockCondition + pricePitz

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
