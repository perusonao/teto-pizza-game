import { afterEach, describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ingredientCategory } from "./ingredientCategoryIndex";

/** Issue #446: `ingredientCategory` must answer exactly what `getIngredient(id)?.category` answers. */
describe("ingredientCategory (deduction O(1) category lookup)", () => {
  const added: unknown[] = [];
  afterEach(() => {
    for (const row of added.splice(0)) INGREDIENTS.splice(INGREDIENTS.indexOf(row as never), 1);
  });

  it("matches getIngredient(id)?.category for every catalog id", () => {
    for (const { id } of INGREDIENTS) expect(ingredientCategory(id), id).toBe(getIngredient(id)?.category);
  });
  it("is undefined for unknown and non-string ids, like getIngredient", () => {
    for (const id of ["", "nope", "toString", "__proto__", 3, null, undefined, {}] as never[]) {
      expect(ingredientCategory(id)).toBe(getIngredient(id)?.category);
      expect(ingredientCategory(id)).toBeUndefined();
    }
  });
  it("sees a row pushed / spliced at run time, and the first row with an id wins", () => {
    const row = { ...INGREDIENTS[0], id: "issue-446-extra", category: "cheese" } as (typeof INGREDIENTS)[number];
    expect(ingredientCategory(row.id)).toBeUndefined();
    INGREDIENTS.push(row);
    added.push(row);
    expect(ingredientCategory(row.id)).toBe("cheese");
    const duplicate = { ...row, category: "topping" } as typeof row;
    INGREDIENTS.push(duplicate);
    added.push(duplicate);
    expect(ingredientCategory(row.id)).toBe(getIngredient(row.id)?.category);
    expect(ingredientCategory(row.id)).toBe("cheese");
    for (const r of added.splice(0)) INGREDIENTS.splice(INGREDIENTS.indexOf(r as never), 1);
    expect(ingredientCategory(row.id)).toBeUndefined();
  });
});
