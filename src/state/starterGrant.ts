import { RECIPES, type Recipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import { STARTER_STOCK_PLAYS_CHAPTER_1 } from "../data/economyConfig";
import { recipeUnlocked } from "./progression";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * Economy & Progression 1.0 EP4 (Starter Stock, see
 * docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md sec. 4 and
 * docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md sec. 1/4): the exactly-once transaction that
 * grants a newly-unlocked recipe's new (finite) ingredient(s) a free starter stock, sized to
 * `STARTER_STOCK_PLAYS_CHAPTER_1` pizzas' worth, the instant `recipeUnlocked` (EP1,
 * ../state/progression.ts) first turns true for that recipe. This is a genuinely different
 * transaction from both `purchaseIngredient` (Pitz -> OWNED, ../logic/economy.ts) and
 * `restockIngredient` (Pitz -> +inventory, same file) -- it is never Pitz-gated, it is
 * recipe-triggered rather than ingredient-triggered, and it can credit *several* ingredients in
 * one shot (quattro-formaggi's unlock grants four). Kept as its own module for the same reason
 * those two are already separate from each other: one file, one clear transaction contract.
 */

/** Persisted, permanent record of which recipes' starter grants have already been claimed --
 *  the ledger the task's "exactly once, forever" requirement needs. Deliberately independent
 *  from both `DexState` (recipe unlock is *derived* from Dex, but Dex can be rewound by a
 *  future Achievement Reset, #89, without this ledger being touched -- see the module-level
 *  contract below) and `ownedIngredientIds` (an ingredient can be owned via a real Shop
 *  purchase, EP3, completely independent of whether its introducing recipe's grant has ever
 *  fired -- `ownedIngredientIds` alone cannot answer "was this recipe's grant already paid
 *  out," only "is this ingredient currently placeable"). */
export type StarterGrantClaimedRecipeIds = readonly string[];

export const EMPTY_STARTER_GRANT_CLAIMS: StarterGrantClaimedRecipeIds = [];

/** The three fields one starter-grant transaction reads and writes together, atomically. */
export interface StarterGrantCarry {
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  starterGrantClaimedRecipeIds: StarterGrantClaimedRecipeIds;
}

/**
 * Applies exactly one recipe's starter grant, or returns `carry` completely unchanged
 * (reference-stable no-op) when there is nothing to do:
 *
 * - `recipe.unlockCondition` absent (margherita only) -- margherita is permanently unlimited
 *   and never participates in this mechanism at all (Fresh Design sec. 5).
 * - `recipe.id` already present in `starterGrantClaimedRecipeIds` -- the exactly-once guard.
 *   This is checked *before* touching `ownedIngredientIds`/`inventory` at all, so a duplicate
 *   call (reload, retry, re-lock/re-unlock, a future Achievement Reset that rewinds Dex but
 *   must never rewind this ledger, ...) can never re-credit stock no matter how many times or
 *   from how many call sites it's invoked for the same recipe id.
 *
 * When it does apply, every one of `recipe.requiredIngredients` that names a *finite*
 * ingredient (`getIngredient(id)?.unlockCondition` present -- i.e. not one of the 3 permanently
 * unlimited Starter ingredients margherita alone owns) is granted additively:
 * `minCount * STARTER_STOCK_PLAYS_CHAPTER_1` units for a scatter ingredient, or
 * `STARTER_STOCK_PLAYS_CHAPTER_1` uses (binary per pizza, never multiplied by `minCount`) for a
 * spread/sauce ingredient (Fresh Design sec. 4.4/6.1's already-ratified unit model). The
 * ingredient is also added to `ownedIngredientIds` (a `Set`-based, idempotent union -- already
 * owning it, e.g. via a real EP3 Shop purchase made before this recipe ever unlocked, is
 * harmless and never double-adds or double-charges anything).
 *
 * This is what makes the shared-ingredient case (oregano: marinara x2, fugazza x1; olive-oil:
 * quattro-formaggi x1, fugazza x1) resolve correctly without any special-casing: each recipe's
 * own unlock event grants strictly according to *that recipe's own* `minCount`, added on top of
 * whatever is already in `inventory[id]` -- marinara's unlock grants oregano 2*10=20, and
 * fugazza's later, separate unlock event additively tops it up by another 1*10=10, landing at
 * 30 total (Ingredient Economy Fresh Audit sec. 4.2's own worked example). Two ledger entries
 * (`marinara`, `fugazza`) are recorded, one per recipe -- never one shared "oregano was granted"
 * flag, so each recipe's own exactly-once guarantee is independent of the other's.
 *
 * Every required ingredient that is *not* finite (`tomato-sauce`/`mozzarella`/`basil`, reused by
 * almost every recipe) is skipped entirely -- granting them inventory would be dead data (they
 * never read `inventory` at all, see `hasStock`) and would muddy `sanitizeInventory`'s existing
 * "never a Starter id" invariant (../state/persistence.ts) for no benefit.
 */
function grantStarterStockFor(recipe: Recipe, carry: StarterGrantCarry): StarterGrantCarry {
  if (!recipe.unlockCondition) return carry;
  if (carry.starterGrantClaimedRecipeIds.includes(recipe.id)) return carry;

  const nextOwned = new Set(carry.ownedIngredientIds);
  const nextInventory: Record<string, number> = { ...carry.inventory };

  for (const requirement of recipe.requiredIngredients) {
    const ingredient = getIngredient(requirement.ingredientId);
    if (!ingredient?.unlockCondition) continue; // permanently-unlimited Starter ingredient
    nextOwned.add(ingredient.id);
    const quantity =
      ingredient.placement === "spread"
        ? STARTER_STOCK_PLAYS_CHAPTER_1
        : requirement.minCount * STARTER_STOCK_PLAYS_CHAPTER_1;
    nextInventory[ingredient.id] = (nextInventory[ingredient.id] ?? 0) + quantity;
  }

  return {
    ownedIngredientIds: [...nextOwned],
    inventory: nextInventory,
    starterGrantClaimedRecipeIds: [...carry.starterGrantClaimedRecipeIds, recipe.id],
  };
}

/**
 * The one call site this module expects: applies every recipe's starter grant that newly
 * crosses LOCKED -> unlocked between `prevDex` and `nextDex`, in `RECIPES` order (deterministic
 * regardless of iteration order elsewhere). A recipe already unlocked in `prevDex` (including
 * one that was unlocked before this session even started) is untouched -- there is no "was
 * unlocked, still is" case here, only a genuine false -> true transition triggers a grant
 * attempt (which `grantStarterStockFor`'s own ledger check then finalizes as either a real
 * grant or a no-op).
 *
 * Folding (each recipe's grant is applied against the *previous* recipe's already-updated
 * carry, not all against the original input) keeps two recipes that cross in the very same Dex
 * update atomic and additive together -- e.g. a single high-quality RESULT that simultaneously
 * satisfies both a chain discovery and a `minTotalStars` floor for two different recipes still
 * grants both, correctly summed, in one state transition, never silently dropping the second.
 *
 * Reused verbatim by two call sites with the exact same contract: gameReducer's
 * `REGISTER_TO_DEX`/`MISSION_NEXT_ORDER` (live gameplay, `prevDex`/`nextDex` are one round's
 * before/after Dex) and `persistence.ts`'s `migrateV2toV3` (a one-time migration, `prevDex` is
 * `EMPTY_DEX` and `nextDex` is an existing save's real Dex -- see that function's own doc
 * comment for why "as if everything unlocked from nothing" is exactly the right migration
 * semantics here).
 */
export function applyStarterGrantsOnDexChange(
  prevDex: DexState,
  nextDex: DexState,
  carry: StarterGrantCarry,
): StarterGrantCarry {
  return RECIPES.reduce((acc, recipe) => {
    if (recipeUnlocked(recipe, prevDex) || !recipeUnlocked(recipe, nextDex)) return acc;
    return grantStarterStockFor(recipe, acc);
  }, carry);
}
