/**
 * Discovery 3.0 PR-4a: test support for the Hint 5.0 roles table now that a recipe may be key-free
 * (`{ keyFree: true }`, OD-D3-19 / OD-D3-21). TEST SUPPORT ONLY.
 *
 * The 25 production recipes author `hintKeyToppingId` / `hintSubToppingOrder`; a key-free recipe
 * authors nothing. Tests that pin the authored table iterate `KEYED_RECIPES` and read
 * `authoredRoles`; the key-free population (`KEY_FREE_RECIPES`: brazilian-calabresa since PR-4b-B) is checked by its own rules, never by the authored-key ones.
 */
import { RECIPE_HINT_ROLES, type HintRoles, type RecipeHintRoles } from "../../data/recipeHintRoles";
import { RECIPES, type Recipe } from "../../data/recipes";
import { isKeyFreeHintRoles } from "../discovery/hint5Ladder";

const table: Readonly<Record<string, HintRoles>> = RECIPE_HINT_ROLES;

export const KEYED_RECIPES: readonly Recipe[] = RECIPES.filter((r) => !isKeyFreeHintRoles(table[r.id]));
export const KEY_FREE_RECIPES: readonly Recipe[] = RECIPES.filter((r) => isKeyFreeHintRoles(table[r.id]));

/** The authored roles of a keyed recipe; throws for a key-free one so a test cannot read a key that does not exist. */
export function authoredRoles(recipeId: string): RecipeHintRoles {
  const roles = table[recipeId];
  if (!roles || isKeyFreeHintRoles(roles)) throw new Error(`${recipeId} has no authored key / sub-topping roles`);
  return roles;
}
