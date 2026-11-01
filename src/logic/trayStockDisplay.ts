/**
 * Tray stock display (PR #716, Owner decision 2026-11-01 after the iPhone HV): what the tray chip's `×N` shows BEFORE the bake.
 *
 * The persisted stock (`InventoryState`) is only decremented by `CONFIRM_BAKE` (placement = reservation, bake = consumption; EP2 / EP3), so
 * the chip used to read the same `×7` while pieces were placed and when they were taken back with 「1つ戻す」. For a finite scatter
 * ingredient the chip now reads "persisted stock - pieces of it already on this pizza": placing one reads `×6`, 「1つ戻す」 reads `×7` again,
 * and the last unit reads `×0` exactly when the Stock Gate (`canPlaceIngredient`) refuses the next piece.
 *
 * DISPLAY ONLY. Nothing here reads or writes `inventory`, the reducer or the save: the number is derived from the pizza on screen, so it
 * follows Undo / reset automatically and is continuous with what the stock is after the bake (stock - pieces). Unlimited (Starter)
 * ingredients, spread (sauce) ingredients and the FINISH tray (which has its own `あと a/b`, only the pieces placed in FINISH count) are not
 * touched: for them this returns the persisted stock unchanged.
 */
import type { Ingredient } from "../data/ingredients";
import { remainingStock, type InventoryState } from "../state/inventory";
import type { PizzaState } from "../state/pizzaState";

export function trayStockDisplay(
  ingredient: Ingredient,
  inventory: InventoryState,
  pizza: Pick<PizzaState, "toppings">,
): number | "UNLIMITED" {
  const stock = remainingStock(ingredient, inventory);
  if (stock === "UNLIMITED" || ingredient.placement !== "scatter") return stock;
  // The same count `canPlaceIngredient` gates on (every piece of this ingredient on the pizza): the display reaches 0 exactly when the gate refuses.
  const placed = pizza.toppings.filter((piece) => piece.ingredientId === ingredient.id).length;
  return Math.max(0, stock - placed);
}
