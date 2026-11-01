import { describe, expect, it } from "vitest";
import { INGREDIENTS, getIngredient } from "../data/ingredients";
import { canPlaceIngredient } from "../state/inventory";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { trayStockDisplay } from "./trayStockDisplay";

/**
 * Tray stock display (PR #716, Owner decision 2026-11-01): the chip reads "persisted stock - pieces already placed" for a finite scatter
 * ingredient, and reads 0 exactly when the Stock Gate refuses the next piece. Display only: nothing is written anywhere.
 */
const piecesOf = (ingredientId: string, n: number, others: readonly string[] = []): Pick<PizzaState, "toppings"> => ({
  toppings: [
    ...Array.from({ length: n }, (_, i) => ({ id: `${ingredientId}-${i}`, ingredientId, x: 10 + i, y: 10 })),
    ...others.map((id, i) => ({ id: `${id}-o${i}`, ingredientId: id, x: 80, y: 10 + i })),
  ],
});
const finiteScatter = INGREDIENTS.filter((i) => i.placement === "scatter" && i.unlockCondition);
const starterScatter = INGREDIENTS.filter((i) => i.placement === "scatter" && !i.unlockCondition);

describe("trayStockDisplay", () => {
  it("an empty pizza reads the persisted stock; each placed piece takes one; it never goes below 0", () => {
    const mayo = getIngredient("mayo")!;
    expect([0, 1, 2, 7, 8, 9].map((n) => trayStockDisplay(mayo, { mayo: 7 }, piecesOf("mayo", n)))).toEqual([7, 6, 5, 0, 0, 0]);
    expect(trayStockDisplay(mayo, {}, piecesOf("mayo", 0))).toBe(0); // absent = 0, like remainingStock
  });

  it("counts only the pieces of THAT ingredient (a potato does not take a mayo)", () => {
    const mayo = getIngredient("mayo")!;
    expect(trayStockDisplay(mayo, { mayo: 7 }, piecesOf("mayo", 1, ["potato", "potato", "bacon"]))).toBe(6);
    expect(trayStockDisplay(getIngredient("potato")!, { potato: 5 }, piecesOf("mayo", 3, ["potato"]))).toBe(4);
  });

  it("a mayo stroke is ONE piece, so it takes ONE unit like any tapped piece (the trail is drawing only)", () => {
    const mayo = getIngredient("mayo")!;
    const stroke = { toppings: [{ id: "m1", ingredientId: "mayo", x: 40, y: 40, trail: [{ x: 30, y: 40 }, { x: 50, y: 40 }] }] };
    expect(trayStockDisplay(mayo, { mayo: 7 }, stroke)).toBe(6);
  });

  it("matches the Stock Gate for EVERY finite scatter ingredient: the display is 0 exactly when canPlaceIngredient refuses", () => {
    expect(finiteScatter.length).toBeGreaterThan(10);
    for (const ingredient of finiteScatter) {
      for (const stock of [0, 1, 2, 5]) {
        for (let placed = 0; placed <= stock + 2; placed += 1) {
          const pizza = { ...createEmptyPizza(), ...piecesOf(ingredient.id, placed) };
          const shown = trayStockDisplay(ingredient, { [ingredient.id]: stock }, pizza);
          const label = `${ingredient.id} stock ${stock} placed ${placed}`;
          expect(shown, label).toBe(Math.max(0, stock - placed));
          expect(shown === 0, label).toBe(!canPlaceIngredient(ingredient, { [ingredient.id]: stock }, pizza));
        }
      }
    }
  });

  it("an unlimited (Starter) ingredient is unchanged: always UNLIMITED, however many are placed", () => {
    expect(starterScatter.length).toBeGreaterThan(0);
    for (const ingredient of starterScatter) expect(trayStockDisplay(ingredient, {}, piecesOf(ingredient.id, 9))).toBe("UNLIMITED");
  });

  it("a spread (sauce) ingredient is unchanged: the persisted stock, whatever the pizza holds", () => {
    const sauces = INGREDIENTS.filter((i) => i.placement === "spread");
    expect(sauces.length).toBeGreaterThan(0);
    for (const sauce of sauces) {
      const inv = sauce.unlockCondition ? { [sauce.id]: 4 } : {};
      expect(trayStockDisplay(sauce, inv, piecesOf(sauce.id, 3))).toBe(sauce.unlockCondition ? 4 : "UNLIMITED");
    }
  });

  it("is pure: it never mutates the inventory or the pizza it reads", () => {
    const mayo = getIngredient("mayo")!;
    const inventory = Object.freeze({ mayo: 7 });
    const pizza = Object.freeze({ toppings: Object.freeze(piecesOf("mayo", 2).toppings) as PizzaState["toppings"] });
    expect(() => trayStockDisplay(mayo, inventory, pizza)).not.toThrow();
    expect(inventory).toEqual({ mayo: 7 });
  });
});
