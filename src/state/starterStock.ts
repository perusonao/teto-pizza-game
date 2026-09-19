import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import { recipeUnlocked } from "./progression";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * Economy & Progression 1.0 EP4 (see
 * docs/reports/TETO_ECONOMY-PROGRESSION_EP4_Starter-Stock_Result.md): the free ingredient grant
 * a recipe's *first* unlock pays out, so a player who has just unlocked Recipe #2-#7 can make it
 * at least `STARTER_STOCK_PLAYS_CHAPTER_1` times before ever needing to visit the Shop. One
 * named tuning constant, applied identically to every Chapter 1 recipe (no per-Tier variation --
 * out of scope, see the EP4 task's own Scope Guard). The `_CHAPTER_1` suffix is deliberate, per
 * `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` section 4: once the catalog grows past
 * Chapter 1, this is expected to become tier-scoped rather than a single global value -- that
 * future change is explicitly out of scope here, but the name should never need to change for it.
 */
export const STARTER_STOCK_PLAYS_CHAPTER_1 = 10;

/**
 * `margherita` is the one recipe EP4 deliberately never grants for: it has no `unlockCondition`
 * (always unlocked) and every one of its own ingredients (`tomato-sauce`/`mozzarella`/`basil`)
 * stays permanently Starter/unlimited (no `unlockCondition` of their own, see
 * ../data/ingredients.ts) -- granting inventory for an ingredient `hasStock`/
 * `consumePizzaInventory` never even reads would be inert busywork, not a real grant.
 */
const STARTER_GRANT_EXEMPT_RECIPE_ID: RecipeId = "margherita";

/**
 * The exact Starter Grant amount for one recipe, keyed by ingredient id -- "recipe ingredient
 * requirement x `STARTER_STOCK_PLAYS_CHAPTER_1`" per the EP4 task's own required derivation
 * (matches `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` section 1/2's own "Starter grant
 * on unlock" column exactly). `scatter` grants `req.minCount x STARTER_STOCK_PLAYS_CHAPTER_1`
 * (enough pieces for that many bakes at the recipe's own per-pizza piece count); `spread`/sauce
 * grants exactly `STARTER_STOCK_PLAYS_CHAPTER_1` (1 use per bake, matching
 * `consumePizzaInventory`'s own "1 pizza = 1 unit per distinct sauce id" rule). Skips any
 * ingredient without `unlockCondition` (an unlimited/Starter ingredient, e.g.
 * `tomato-sauce`/`mozzarella` shared with margherita) -- granting it would be inert, and more
 * importantly, a value in `InventoryState` for it would violate the Save v2 invariant that an
 * unlimited ingredient never appears as an inventory key (../state/persistence.ts's
 * `sanitizeInventory` already strips one if it somehow got there). Also skips an unknown
 * ingredient id, mirroring `consumePizzaInventory`'s own fail-closed behavior.
 */
function starterGrantForRecipe(recipe: Recipe): Readonly<Record<string, number>> {
  const grant: Record<string, number> = {};
  for (const req of recipe.requiredIngredients) {
    const ingredient = getIngredient(req.ingredientId);
    if (!ingredient?.unlockCondition) continue;
    const amount =
      ingredient.placement === "scatter"
        ? req.minCount * STARTER_STOCK_PLAYS_CHAPTER_1
        : STARTER_STOCK_PLAYS_CHAPTER_1;
    grant[ingredient.id] = (grant[ingredient.id] ?? 0) + amount;
  }
  return grant;
}

export interface StarterGrantResult {
  inventory: InventoryState;
  ownedIngredientIds: readonly string[];
  /** The updated exactly-once ledger -- persist this alongside `inventory`/`ownedIngredientIds`
   *  (see ../state/persistence.ts). Reference-equal to the input `claimedRecipeIds` when nothing
   *  new was granted (see `applyStarterGrants`'s own no-op fast path). Plain `string`, not
   *  `RecipeId`, matching `DexEntry.recipeId`'s own convention (../state/dex.ts) -- this crosses
   *  the same persistence boundary Dex does. */
  claimedRecipeIds: readonly string[];
  /** Recipe ids newly granted by this exact call, in `RECIPES` order -- empty on every no-op
   *  call. Exposed for tests/telemetry; callers never need to branch on it to stay correct
   *  (every returned field is already fully applied). */
  grantedRecipeIds: readonly RecipeId[];
}

/**
 * The one exactly-once Starter Grant transaction (EP4's central requirement: "reload/PLAY_AGAIN/
 * RETRY_SAME_RECIPE/HOME往復/Shop open-close/... must never re-grant"). Pure and idempotent: for
 * every recipe that is (a) not `margherita`, (b) currently unlocked (`recipeUnlocked`, purely a
 * function of `dex` -- ../state/progression.ts) and (c) not yet in `claimedRecipeIds`, this
 * credits `starterGrantForRecipe`'s amounts into `inventory`, adds every one of that recipe's
 * finite ingredients to `ownedIngredientIds` (so `APPLY_SAUCE`/`PLACE_TOPPING`'s own ownership
 * gate, gameReducer.ts, immediately allows placing it -- a grant that only touched `inventory`
 * without this would leave the ingredient stocked but still unplaceable), and marks the recipe
 * claimed. A recipe already in `claimedRecipeIds` is *never* re-evaluated regardless of whether
 * `recipeUnlocked` is (still, or again) true for it -- this is what keeps a future Achievement
 * Reset safe: resetting `dex` back to empty and letting the player re-discover a recipe must
 * never re-grant its Starter Stock, since "is this recipe currently unlocked" and "has this
 * recipe's Starter Grant ever been claimed" are deliberately two separate, independently
 * persisted concepts (see the EP4 Result report's ledger design section) -- only the latter
 * gates this function.
 *
 * Multiple recipes sharing a finite ingredient (e.g. `oregano`: marinara + fugazza, `olive-oil`:
 * quattro-formaggi + fugazza) each add their own amount additively to the same shared
 * `inventory[id]` -- this is intentional (EP4 task: "Recipe A unlock -> mushroom +X; Recipe B
 * unlock -> mushroom +Y" both apply). The same recipe is still only ever granted once, no matter
 * how many times this function is called with its id already unlocked -- that is the whole point
 * of `claimedRecipeIds`.
 *
 * A true no-op call (nothing newly eligible) returns its exact input `inventory`/
 * `ownedIngredientIds`/`claimedRecipeIds` back by reference -- callers that compare by reference
 * (React state, `persistProgress`'s own no-op-skip checks) never see a spurious "changed" signal
 * on a call that granted nothing, keeping every one of the exactly-once call sites (REGISTER_TO_DEX,
 * MISSION_NEXT_ORDER, and App.tsx's load-time migration catch-up) cheap to call unconditionally.
 */
export function applyStarterGrants(
  dex: DexState,
  ownedIngredientIds: readonly string[],
  inventory: InventoryState,
  claimedRecipeIds: readonly string[],
): StarterGrantResult {
  const claimedSet = new Set<string>(claimedRecipeIds);
  const ownedSet = new Set(ownedIngredientIds);
  let nextInventory = inventory;
  let ownedChanged = false;
  const grantedRecipeIds: RecipeId[] = [];

  for (const recipe of RECIPES) {
    if (recipe.id === STARTER_GRANT_EXEMPT_RECIPE_ID) continue;
    if (claimedSet.has(recipe.id)) continue;
    if (!recipeUnlocked(recipe, dex)) continue;

    const grant = starterGrantForRecipe(recipe);
    const invUpdates: Record<string, number> = {};
    for (const [id, amount] of Object.entries(grant)) {
      invUpdates[id] = (nextInventory[id] ?? 0) + amount;
      if (!ownedSet.has(id)) {
        ownedSet.add(id);
        ownedChanged = true;
      }
    }
    if (Object.keys(invUpdates).length > 0) {
      nextInventory = { ...nextInventory, ...invUpdates };
    }
    claimedSet.add(recipe.id);
    grantedRecipeIds.push(recipe.id);
  }

  if (grantedRecipeIds.length === 0) {
    return { inventory, ownedIngredientIds, claimedRecipeIds, grantedRecipeIds: [] };
  }
  return {
    inventory: nextInventory,
    ownedIngredientIds: ownedChanged ? Array.from(ownedSet) : ownedIngredientIds,
    claimedRecipeIds: Array.from(claimedSet),
    grantedRecipeIds,
  };
}
