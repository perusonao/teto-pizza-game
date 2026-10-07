import type { RecipeId } from "./recipes";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: the Hint 5.0 key-topping / sub-topping authority. Data
 * only; UNWIRED (only ../logic/discovery/hint5Ladder.ts reads it, and nothing reads that yet).
 *
 * Authority: docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §6.1 (OD-H5-C1, C1a, C1b and
 * the C1-P principle: the key topping is the main topping that characterises the recipe, a main
 * ingredient over an aroma or garnish, never duplicating sauce / cheese information).
 *
 * - `hintKeyToppingId` is the subject of the paid KEY_TOPPING rung. It is NOT the Hint 3.0 free key
 *   (`hintKeyIngredientId`, the latest-unlocked ingredient): OD-H5-C2 keeps the two apart.
 * - `hintSubToppingOrder` is the SUB_CLASS rung order. It is authored here and is the only order
 *   authority: nothing is derived from `requiredIngredients` order (OD-H5-C1).
 * - `Record<RecipeId, ...>` makes a recipe without an entry a type error (the
 *   `RECIPE_SAUCE_PROFILES` pattern). The data gate (hint5Taxonomy.gate.test.ts, G17) checks that
 *   the key is a topping of the recipe (or null when it has none) and that the order is exactly the
 *   recipe's other toppings.
 */
export interface RecipeHintRoles {
  /** The KEY_TOPPING rung's subject: a topping of the recipe, or null when the recipe has none. */
  hintKeyToppingId: string | null;
  /** The SUB_CLASS rungs, in order: the recipe's toppings minus the key, each exactly once. */
  hintSubToppingOrder: readonly string[];
}

/**
 * Discovery 3.0 PR-3 (OD-D3-19 Migration A, OD-D3-21): the key-free marker. A recipe authored this
 * way needs no hand-written Hint data at all: `buildHint5Ladder` derives its rungs from the recipe
 * itself -- SAUCE (if it has a sauce) -> CHEESE (if it has a cheese) -> STRUCTURE -> one SUB_CLASS
 * per topping in catalog order. There is no KEY_TOPPING rung, and a rung that does not apply is
 * absent (never empty, never a "none" answer). The 25 production recipes keep `RecipeHintRoles`
 * (Hint 5.0 output unchanged); nothing in production is key-free yet. The table is typed `HintRoles`
 * (PR-4b-A, D-5) so a key-free recipe can be added without a type change.
 */
export interface KeyFreeHintRoles {
  keyFree: true;
}

export type HintRoles = RecipeHintRoles | KeyFreeHintRoles;

export const RECIPE_HINT_ROLES: Readonly<Record<RecipeId, HintRoles>> = {
  margherita: { hintKeyToppingId: "basil", hintSubToppingOrder: [] }, // C1a
  marinara: { hintKeyToppingId: "garlic", hintSubToppingOrder: ["oregano"] },
  "quattro-formaggi": { hintKeyToppingId: null, hintSubToppingOrder: [] }, // C1a: no topping
  genovese: { hintKeyToppingId: "cherry-tomato", hintSubToppingOrder: [] },
  bismarck: { hintKeyToppingId: "egg", hintSubToppingOrder: [] },
  funghi: { hintKeyToppingId: "mushroom", hintSubToppingOrder: [] },
  fugazza: { hintKeyToppingId: "onion", hintSubToppingOrder: ["oregano"] }, // C1a
  salsiccia: { hintKeyToppingId: "sausage", hintSubToppingOrder: [] },
  pepperoni: { hintKeyToppingId: "pepperoni", hintSubToppingOrder: [] },
  napoletana: { hintKeyToppingId: "anchovy", hintSubToppingOrder: ["oregano"] },
  "tonno-e-cipolla": { hintKeyToppingId: "tuna", hintSubToppingOrder: ["onion"] },
  "pizza-bianca": { hintKeyToppingId: "rosemary", hintSubToppingOrder: [] },
  "breakfast-pizza": { hintKeyToppingId: "bacon", hintSubToppingOrder: ["egg"] },
  capricciosa: { hintKeyToppingId: "mushroom", hintSubToppingOrder: ["oregano", "ham", "black-olive"] }, // C1b
  "meat-lovers": { hintKeyToppingId: "ham", hintSubToppingOrder: ["bacon", "pepperoni", "sausage"] },
  "melanzane-pizza": { hintKeyToppingId: "eggplant", hintSubToppingOrder: ["basil"] },
  "parmigiana-pizza": { hintKeyToppingId: "eggplant", hintSubToppingOrder: ["basil"] }, // C1a
  bambino: { hintKeyToppingId: "corn", hintSubToppingOrder: ["ham"] },
  hawaiian: { hintKeyToppingId: "pineapple", hintSubToppingOrder: ["ham"] },
  "pizza-portuguesa": { hintKeyToppingId: "ham", hintSubToppingOrder: ["egg", "onion", "black-olive"] }, // C1b
  "pesto-tonno": { hintKeyToppingId: "tuna", hintSubToppingOrder: ["black-olive", "onion"] }, // C1a
  "new-haven-apizza": { hintKeyToppingId: "clam", hintSubToppingOrder: ["garlic"] },
  "pesto-caprese": { hintKeyToppingId: "fresh-tomato", hintSubToppingOrder: ["basil"] },
  "pesto-patate": { hintKeyToppingId: "potato", hintSubToppingOrder: ["bacon"] },
  "puttanesca-pizza": { hintKeyToppingId: "anchovy", hintSubToppingOrder: ["black-olive", "capers", "garlic"] }, // C1b
  // PR-4b-B: the first key-free production recipe (no KEY_TOPPING rung; no cheese rung).
  "brazilian-calabresa": { keyFree: true },
  // No.27: key-free like calabresa (Migration A contract kept; no KEY_TOPPING added).
  "pesto-pollo": { keyFree: true },
  // Expansion Slice 1: permanently key-free (no KEY_TOPPING / hintKeyToppingId).
  "pesto-gamberi": { keyFree: true },
  // Expansion Wave 2: permanently key-free (no KEY_TOPPING / hintKeyToppingId).
  vongole: { keyFree: true },
  "pesto-vegetariana": { keyFree: true },
  "ratatouille-pizza": { keyFree: true },
  // TQ-1D: permanently key-free. A key-free ladder has no SAUCE rung for a recipe without a sauce (no
  // KEY_TOPPING either), so nothing here is reserved, empty or says "no sauce".
  aussie: { keyFree: true },
  // Expansion Slice 3: permanently key-free (no KEY_TOPPING / hintKeyToppingId).
  "pesto-trapanese": { keyFree: true },
  // Expansion Batch 1: permanently key-free.
  "baba-ganoush-pizza": { keyFree: true },
  "prosciutto-funghi": { keyFree: true },
  "veggie-supreme-pizza": { keyFree: true },
};
