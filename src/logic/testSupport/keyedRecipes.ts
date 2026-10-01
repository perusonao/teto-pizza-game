import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { RECIPES } from "../../data/recipes";
import { isKeyFreeHintRoles } from "../discovery/hint5Ladder";

/**
 * Discovery 3.0 PR-4a: the production recipes that carry hand-authored Hint 5.0 roles (key topping + sub-topping
 * order). The 25 recipes that existed before key-free authoring are all keyed, so this equals `RECIPES` today.
 * Tests of the KEYED ladder shape iterate this; a production recipe authored `{ keyFree: true }` is covered by
 * the key-free tests instead, never silently skipped (see hint5Taxonomy.gate.test.ts).
 */
export const KEYED_RECIPES = RECIPES.filter((r) => !isKeyFreeHintRoles(RECIPE_HINT_ROLES[r.id]));
