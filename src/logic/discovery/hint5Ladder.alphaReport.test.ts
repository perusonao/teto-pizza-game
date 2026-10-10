import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { ingredientAttributeFamily } from "../../data/ingredientTaxonomy";
import { RECIPES, type Recipe } from "../../data/recipes";
import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { buildHint5Ladder, isKeyFreeHintRoles } from "./hint5Ladder";

/**
 * Hint 5.0 PR-B: the alpha metric (docs/decisions/TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md section 6) as a REPORT,
 * FAMILY-ONLY (the display tags of #436 do not exist yet and are PR-C). This is NOT the alpha gate: it does not
 * enforce the threshold, and it never gets an exception added to it. PR-C adds the tag-aware gate in its own file;
 * this family-only baseline stays valid because it never reads a tag.
 *
 * Definition (derived from code and data, nothing hard-coded):
 * - pool: toppings whose Discovery Ladder step is <= the largest step among the recipe's ingredients
 *   (starters, which are in no step, count as 0), minus the key topping (none for a key-free recipe);
 * - row candidates: pool members of the same family as the sub row's topping;
 * - assignments: injective picks, one per sub row. A key-free recipe's sub order is the catalog order, so its picks
 *   must be strictly increasing in catalog order (the real information the player has); a keyed recipe uses its
 *   authored sub order and key, so its picks only have to be distinct.
 * - scope: every recipe with at least one sub row (the section 6 allowlist is made of keyed recipes).
 */

const STEP_OF = new Map<string, number>(DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds.map((id) => [id, s.step] as const)));
const stepOf = (id: string) => STEP_OF.get(id) ?? 0;
const CATALOG_INDEX = new Map(INGREDIENTS.map((ingredient, i) => [ingredient.id, i]));

function assignments(recipe: Recipe): number {
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  const maxStep = Math.max(0, ...ids.map(stepOf));
  const roles = RECIPE_HINT_ROLES[recipe.id];
  const keyfree = isKeyFreeHintRoles(roles);
  const key = keyfree ? null : roles.hintKeyToppingId;
  const pool = INGREDIENTS.filter((i) => i.category === "topping" && stepOf(i.id) <= maxStep && i.id !== key).map((i) => i.id);
  const rows = buildHint5Ladder(recipe.id)!.rungs.filter((x) => x.kind === "SUB_CLASS").map((x) => ingredientAttributeFamily(x.subjectIds[0]));
  const count = (row: number, after: number, used: readonly string[]): number => {
    if (row === rows.length) return 1;
    return pool
      .filter((id) => ingredientAttributeFamily(id) === rows[row] && !used.includes(id) && (!keyfree || CATALOG_INDEX.get(id)! > after))
      .reduce((sum, id) => sum + count(row + 1, CATALOG_INDEX.get(id)!, [...used, id]), 0);
  };
  return count(0, -1, []);
}

describe("PR-B alpha metric, family-only baseline (report)", () => {
  const withSubs = RECIPES.filter((r) => buildHint5Ladder(r.id)!.rungs.some((x) => x.kind === "SUB_CLASS"));
  const report = Object.fromEntries(withSubs.map((r) => [r.id, assignments(r)]));

  it("matches the report golden", async () => {
    await expect(JSON.stringify(report, null, 1) + "\n").toMatchFileSnapshot("./__golden__/hint5.alphaFamilyOnly.json");
  });

  it("the real recipe is always one of its own assignments, so no count is below 1", () => {
    for (const [id, n] of Object.entries(report)) expect(n, id).toBeGreaterThanOrEqual(1);
    expect(withSubs.length).toBeLessThan(RECIPES.length);
    expect(getIngredient("capers")).toBeDefined();
  });
});
