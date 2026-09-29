import { describe, expect, it } from "vitest";
import { ingredientsByCategory, MAX_INGREDIENT_PALETTE_SLOTS, type IngredientCategory } from "../../data/ingredients";
import { isPantryWorthwhile, resolveUtilityRow } from "./pantryAvailability";

const ids = (category: IngredientCategory, n: number) =>
  ingredientsByCategory(category)
    .slice(0, n)
    .map((i) => i.id);

describe("isPantryWorthwhile (ownership only)", () => {
  it("boundary: exactly one page (6) is not worthwhile, 7 is", () => {
    expect(MAX_INGREDIENT_PALETTE_SLOTS).toBe(6);
    expect(isPantryWorthwhile({ categories: ["topping"], ownedIngredientIds: ids("topping", 6) })).toBe(false);
    expect(isPantryWorthwhile({ categories: ["topping"], ownedIngredientIds: ids("topping", 7) })).toBe(true);
  });

  it("only categories the round has count; owning many toppings does not matter without a TOPPING step", () => {
    const owned = ids("topping", 10);
    expect(isPantryWorthwhile({ categories: ["sauce", "cheese"], ownedIngredientIds: owned })).toBe(false);
    expect(isPantryWorthwhile({ categories: [], ownedIngredientIds: owned })).toBe(false);
  });

  it("any one step category over a page is enough (no summing across categories)", () => {
    const owned = [...ids("sauce", 3), ...ids("cheese", 3), ...ids("topping", 3)];
    expect(isPantryWorthwhile({ categories: ["sauce", "cheese", "topping"], ownedIngredientIds: owned })).toBe(false);
    expect(isPantryWorthwhile({ categories: ["sauce", "cheese", "topping"], ownedIngredientIds: [...owned, ...ids("topping", 7)] })).toBe(true);
  });

  it("unknown ids and duplicates do not count", () => {
    const owned = [...ids("topping", 6), "nope-1", "nope-2"];
    expect(isPantryWorthwhile({ categories: ["topping"], ownedIngredientIds: owned })).toBe(false);
  });
});

describe("resolveUtilityRow = eligible AND (pager OR pantryWorthwhile) [pager alone for non-eligible]", () => {
  const cases: [boolean, boolean, boolean, boolean][] = [
    // pager, eligible, worthwhile, => row
    [true, true, true, true], // pager + worthwhile
    [false, true, true, true], // pager gone (future hand enforcement), pantry still worthwhile: row + entry stay
    [false, true, false, false], // nothing to do
    [true, true, false, true], // pager-only
    [false, false, true, false], // not eligible (guided / Lunch Rush / Dinner): worthwhile must not add a row
    [true, false, true, true], // not eligible keeps the existing pager row
    [true, false, false, true],
    [false, false, false, false],
  ];
  it.each(cases)("pager=%s eligible=%s worthwhile=%s => %s", (pager, largeCatalogEligible, pantryWorthwhile, expected) => {
    expect(resolveUtilityRow({ pager, largeCatalogEligible, pantryWorthwhile })).toBe(expected);
  });
});
