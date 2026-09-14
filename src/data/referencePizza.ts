/**
 * Phase 4A-1A: Reference Pizza data.
 *
 * Prototype target is Margherita's tomato sauce only (Mozzarella/Basil reference matching
 * are explicitly deferred to Phase 4A-1B -- see the Phase 4A-1A result report's Scope
 * Guard section).
 *
 * IMPORTANT -- these are NOT real-world quantities. The PIZZA DB backing this game has no
 * quantity evidence for any ingredient (no grams/ml, no volume), so `quantity`/`coverage`
 * below are internal, normalized [0, 1] game-balance targets in the same unit as
 * `SauceMetrics` (../logic/sauceField.ts) and `SAUCE_MAX_QUANTITY` (../logic/sauceQuantity.ts)
 * -- chosen purely so the Reference UI and shadow scoring have something to compare the
 * player's sauce against. Never add a grams/ml field here, and never register one of these
 * numbers as a "canonical fact" about the dish.
 */

export interface ReferenceSauce {
  ingredientId: string;
  /** Target normalized quantity, 0.0-1.0. A game-design choice, not a measured fact. */
  quantity: number;
  /** Target coverage (fraction of the dough painted), 0.0-1.0. Same caveat as above. */
  coverage: number;
}

export interface ReferencePizza {
  recipeId: "margherita";
  sauce: ReferenceSauce;
}

export const MARGHERITA_REFERENCE: ReferencePizza = {
  recipeId: "margherita",
  sauce: {
    ingredientId: "tomato-sauce",
    // A classic Margherita is sauced generously but not swimming in it, and spread edge to
    // edge (leaving only the cornicione rim bare) rather than dabbed in the middle.
    quantity: 0.55,
    coverage: 0.72,
  },
};

/** Returns the Reference Pizza for `recipeId`, or null for every recipe but Margherita
 *  (Scope Guard: no other recipe gets a Reference Pizza in this phase). */
export function getReferencePizza(recipeId: string): ReferencePizza | null {
  return recipeId === MARGHERITA_REFERENCE.recipeId ? MARGHERITA_REFERENCE : null;
}
