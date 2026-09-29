/**
 * Large Catalog UX LC-R5-a (pure): pantry (食材庫) availability, separated from pager availability (OD-R5-10).
 *
 * `pantryWorthwhile` is an OWNERSHIP fact: some step category of the round has more OWNED ingredients than one
 * tray page holds (`> MAX_INGREDIENT_PALETTE_SLOTS`). It reads only the owned ids -- never the hand, the tray's
 * page count / pager, pins, stock, the recipe, the enforcement flag or discovery data -- so that once the tray is
 * fed from the hand (R5-d / R6) the pager can disappear while the pantry entry and its reserved utility row stay.
 *
 * `utilityRow` is the reserved 28px row under the tray: `eligible AND (pager OR pantryWorthwhile)`. The eligible
 * guard is required: without it a guided / Lunch Rush round (recipe-limited tray, pager false) with > 6 owned
 * would gain a row. Today (enforcement off) `pantryWorthwhile === pager` for every eligible round, so the layout
 * is byte-identical.
 */
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS, type IngredientCategory } from "../../data/ingredients";

export function isPantryWorthwhile(input: {
  /** The tray categories of the round's PREPARE steps (SAUCE / CHEESE / TOPPING). */
  categories: readonly IngredientCategory[];
  ownedIngredientIds: readonly string[];
}): boolean {
  const { categories, ownedIngredientIds } = input;
  return categories.some(
    (category) =>
      ingredientsByCategory(category).filter((i) => ownedIngredientIds.includes(i.id)).length > MAX_INGREDIENT_PALETTE_SLOTS,
  );
}

/** Whether the dock reserves the utility (pager / pantry entry) row. Non-eligible rounds keep the pager-only rule. */
export function resolveUtilityRow(input: {
  pager: boolean;
  largeCatalogEligible: boolean;
  pantryWorthwhile: boolean;
}): boolean {
  return input.pager || (input.largeCatalogEligible && input.pantryWorthwhile);
}
