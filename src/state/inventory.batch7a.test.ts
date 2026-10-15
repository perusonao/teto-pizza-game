import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import type { RecipeId } from "../data/recipes";
import { consumePizzaInventory, type InventoryState } from "./inventory";
import { referencePizzaFor } from "./testSupport/confirmBakeMatrix";

/**
 * Batch 7a: inventory consumption of the three new finite materials (mint / lamb / sweet-potato), checked by the ordinary
 * regression path (the frozen B1 golden deliberately does not extend to ingredients added after it was pinned). The consumption
 * logic is the shared `consumePizzaInventory`; this only pins that it counts every placed piece of the new materials, leaves every
 * other stock untouched, and consumes the olive-oil sauce once.
 */
const STOCK = 99;
const generous: InventoryState = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, STOCK]));

function pieceCounts(recipeId: RecipeId): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of referencePizzaFor(recipeId).toppings) counts[t.ingredientId] = (counts[t.ingredientId] ?? 0) + 1;
  return counts;
}

describe("Batch 7a materials consume stock like every other finite material", () => {
  it("new-zealand-lamb-pizza (NO_SAUCE): lamb 3 / sweet-potato 2 / rosemary 1 pieces are consumed; nothing else moves", () => {
    const pizza = referencePizzaFor("new-zealand-lamb-pizza");
    expect(pizza.sauceIds).toEqual([]);
    const next = consumePizzaInventory(pizza, generous);
    expect(next["lamb"]).toBe(STOCK - 3);
    expect(next["sweet-potato"]).toBe(STOCK - 2);
    expect(next["rosemary"]).toBe(STOCK - 1);
    expect(next["mint"]).toBe(STOCK);
    const used = new Set(["lamb", "sweet-potato", "rosemary"]);
    for (const [id, qty] of Object.entries(next)) if (!used.has(id)) expect(qty, id).toBe(STOCK);
  });

  it("eggplant-ricotta-pizza (olive-oil sauce): mint 2 / eggplant 3 / ricotta 3 pieces and one olive-oil use are consumed", () => {
    const pizza = referencePizzaFor("eggplant-ricotta-pizza");
    expect(pizza.sauceIds).toEqual(["olive-oil"]);
    const next = consumePizzaInventory(pizza, generous);
    const pieces = pieceCounts("eggplant-ricotta-pizza");
    expect(pieces).toEqual({ ricotta: 3, eggplant: 3, mint: 2 });
    expect(next["mint"]).toBe(STOCK - 2);
    expect(next["eggplant"]).toBe(STOCK - 3);
    expect(next["ricotta"]).toBe(STOCK - 3);
    expect(next["olive-oil"]).toBe(STOCK - 1);
    expect(next["lamb"]).toBe(STOCK);
    expect(next["sweet-potato"]).toBe(STOCK);
  });

  it("never goes negative: a pizza using more mint than is in stock leaves 0 (the shared clamp)", () => {
    const short: InventoryState = { ...generous, mint: 1 };
    const next = consumePizzaInventory(referencePizzaFor("eggplant-ricotta-pizza"), short);
    expect(next["mint"]).toBe(0);
  });
});
