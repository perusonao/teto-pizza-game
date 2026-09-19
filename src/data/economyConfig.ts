/**
 * Economy & Progression 1.0 EP4 (Starter Stock, see
 * docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md sec. 4.3 and
 * docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md sec. 4): how many pizzas' worth of a
 * newly-unlocked recipe's new (finite, `Ingredient.unlockCondition`-bearing) ingredient(s) are
 * granted for free, the instant that recipe's `Recipe.unlockCondition` (src/data/recipes.ts)
 * is first satisfied. A single named constant -- `src/state/starterGrant.ts` is the one reader
 * -- never inlined as a literal `10` at any call site, so a future catalog tier can override it
 * per-recipe without a call-site edit (see the Fresh Design's own forward-looking tiered-table
 * note, not implemented here -- Chapter 1 uses exactly one value for every unlockable recipe).
 */
export const STARTER_STOCK_PLAYS_CHAPTER_1 = 10;
