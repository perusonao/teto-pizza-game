import { describe, expect, it } from "vitest";
import { buildHint5Ladder, isKeyFreeHintRoles } from "../logic/discovery/hint5Ladder";
import { RECIPE_HINT_ROLES, type HintRoles } from "./recipeHintRoles";
import { RECIPES, type RecipeId } from "./recipes";

/** Discovery 3.0 PR-4b-A (D-5): the production table is typed `HintRoles`, so a key-free recipe fits
 *  without a type change, while the 25 production entries stay authored (Hint 5.0 output unchanged). */
describe("RECIPE_HINT_ROLES is typed HintRoles", () => {
  it("accepts a key-free entry (compile-time + runtime), and the 25 original production entries stay keyed (only brazilian-calabresa, No.27 pesto-pollo Expansion Slice 1 pesto-gamberi and Wave 2's 3 recipes are key-free)", () => {
    const withKeyFree: Readonly<Record<RecipeId, HintRoles>> = { ...RECIPE_HINT_ROLES, margherita: { keyFree: true } };
    expect(isKeyFreeHintRoles(withKeyFree.margherita)).toBe(true);
    expect(RECIPES).toHaveLength(31);
    for (const r of RECIPES) {
      expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[r.id]), r.id).toBe(r.id === "brazilian-calabresa" || r.id === "pesto-pollo" || r.id === "pesto-gamberi" || r.id === "vongole" || r.id === "pesto-vegetariana" || r.id === "ratatouille-pizza");
    }
  });

  it("a key-free entry derives its ladder (no KEY_TOPPING rung); keyed output is not affected by it", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const keyed = buildHint5Ladder(margherita.id, RECIPES, RECIPE_HINT_ROLES);
    const keyFree = buildHint5Ladder(margherita.id, RECIPES, { ...RECIPE_HINT_ROLES, margherita: { keyFree: true } });
    expect(keyed?.rungs.some((r) => r.kind === "KEY_TOPPING")).toBe(true);
    expect(keyFree?.rungs.some((r) => r.kind === "KEY_TOPPING")).toBe(false);
    const marinara = RECIPES.find((r) => r.id === "marinara")!;
    expect(buildHint5Ladder(marinara.id, RECIPES, { ...RECIPE_HINT_ROLES, margherita: { keyFree: true } })).toEqual(
      buildHint5Ladder(marinara.id, RECIPES, RECIPE_HINT_ROLES),
    );
  });
});
