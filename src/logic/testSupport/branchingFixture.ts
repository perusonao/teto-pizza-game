/**
 * Discovery 3.0 PR-4a: test/simulation support for a branching pool (more than one DISCOVERABLE
 * unknown recipe at a time). TEST SUPPORT ONLY -- nothing in production imports this file, and
 * it adds no production recipe.
 *
 * A W1 walk used to assume exactly one DISCOVERABLE unknown recipe at every step. With a
 * non-credit branching recipe (OD-D3-17 O3: `ladderCredit: false`) the pool can hold several, the
 * order of discovery is free, and a non-credit discovery never advances the W1 ladder. This module
 * gives tests an explicit way to say which population they mean:
 *
 * - `W1_RECIPES`: the credited recipes (what the W1 ladder counts). Equal to `RECIPES` while no
 *   production recipe opts out.
 * - `SYNTHETIC_BRANCH_B` / `branchingPopulation()`: a synthetic non-credit recipe, discoverable at
 *   the same ladder step as one W1 recipe, so both orders (A then B, B then A) can be walked.
 * - `walkState()`: the game state (Dex, ownership, entitlement, stock) after discovering an
 *   arbitrary ordered list of recipes, derived with the real entitlement authority.
 */
import { DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { countsTowardLadder, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { DEFAULT_IDENTITY_DIMENSIONS } from "../discovery/signature";
import type { RecipeDiscoveryTarget } from "../discovery/matcher";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import { recipeKeyStep } from "../../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";
import { discoveredRecipeCount } from "../discoveryLadder";
import { POST_W1_RECIPE_IDS } from "../catalog/testSupport/catalogDerived";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";

/** Credited recipes behind the appended ladder steps 25-28 (not W1): No.27 pesto-pollo (chicken), Expansion
 *  Slice 1 pesto-gamberi (shrimp), Wave 2 vongole (parsley), pesto-vegetariana (bell-pepper + zucchini) and
 *  ratatouille-pizza (makeable at step 28, nobody's key recipe). */

/** The credited W1 recipes: what the frozen W1 ladder counts. The appended-step recipes above are credited
 *  too but are outside the W1 walk this fixture models. */
export const W1_RECIPES: readonly Recipe[] = RECIPES.filter((r) => countsTowardLadder(r.id) && !POST_W1_RECIPE_IDS.includes(r.id));

/** The W1 ladder played in order: margherita, then each step's key recipe. */
export const W1_ORDER: readonly string[] = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];

export const SYNTHETIC_BRANCH_ID = "synthetic-branch-b" as RecipeId;

/** Synthetic non-credit branching recipe. Production ingredients only; a unique identity (no
 *  production recipe has this ingredient set). */
export const SYNTHETIC_BRANCH_B: Recipe = {
  id: SYNTHETIC_BRANCH_ID,
  nameJa: "合成ブランチB",
  description: "test fixture",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "sausage", minCount: 2 },
    { ingredientId: "onion", minCount: 2 },
    { ingredientId: "black-olive", minCount: 2 },
    { ingredientId: "oregano", minCount: 1 },
  ],
  bakeTarget: { start: 58, end: 78 },
  baseRewardPitz: 100,
  ladderCredit: false,
};

/**
 * The credited production recipes plus the synthetic branch (production recipes are untouched).
 * Built from `W1_RECIPES`, not `RECIPES`, so the fixture means the same thing whether or not a
 * production non-credit recipe exists.
 */
export function branchingPopulation(branch: Recipe = SYNTHETIC_BRANCH_B): readonly Recipe[] {
  return [...W1_RECIPES, branch];
}

/** Does this population's discovery of `recipeId` advance the ladder? */
export function counts(recipes: readonly Recipe[]): (recipeId: string) => boolean {
  return (id) => countsTowardLadder(id, recipes);
}

/** The matcher target of a fixture recipe (same derivation as `RECIPE_DISCOVERY_CATALOG`). */
export function targetOf(recipe: Recipe, targetId = `synthetic:${recipe.id}`): RecipeDiscoveryTarget {
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  return {
    targetId,
    recipeId: recipe.id,
    items: [...ids].sort(),
    sauceBase: ids.filter((id) => getIngredient(id)?.category === "sauce").sort(),
    capabilities: [],
    identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
    eligibility: { status: "ELIGIBLE" },
  };
}

const SCORE = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 } as const;

export function discoverAll(ids: readonly string[], from: DexState = EMPTY_DEX): DexState {
  let dex = from;
  for (const id of ids) dex = registerScoreToDex(dex, id, SCORE).dex;
  return dex;
}

export interface WalkState extends RecipeDiscoveryInputs {
  /** The ladder count the real authority reads (credited discoveries only). */
  ladderCount: number;
  /** Discovered recipes in discovery order. */
  discoveredIds: readonly string[];
}

/**
 * The state after discovering `ids` in that order: every entitled material bought (stock 10),
 * entitlement from the real `resolveShopEntitlement` with this population's credit rule. The
 * Dex order is the discovery order; nothing here depends on array order of `recipes`.
 */
export function walkState(ids: readonly string[], recipes: readonly Recipe[] = RECIPES): WalkState {
  const dex = discoverAll(ids);
  const credit = counts(recipes);
  const ladderCount = discoveredRecipeCount(dex, credit);
  const entitlement = resolveShopEntitlement(dex, [], [], DISCOVERY_LADDER, credit);
  const materials = entitlement.unlockedForShopIngredientIds;
  return {
    dex,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materials],
    unlockedForShopIngredientIds: materials,
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
    ladderCount,
    discoveredIds: ids,
  };
}

/** The DISCOVERABLE recipes of `recipes` in this state, by id (order = population order; an
 *  order-insensitive caller must sort). */
export function poolOf(state: RecipeDiscoveryInputs, recipes: readonly Recipe[] = RECIPES): string[] {
  return recipes.filter((r) => recipeDiscoveryState(r, state) === "DISCOVERABLE").map((r) => r.id);
}

/** The unknown (undiscovered) recipes of `recipes`, sorted. */
export function remainingOf(state: RecipeDiscoveryInputs, recipes: readonly Recipe[] = RECIPES): string[] {
  return recipes.filter((r) => recipeDiscoveryState(r, state) !== "DISCOVERED").map((r) => r.id).sort();
}

/** The W1 step at which `recipe` first becomes DISCOVERABLE, and the credited recipe whose
 *  discovery is the next W1 step at that point (the "A" that branches with it). */
export function branchPoint(recipe: Recipe): { step: number; w1Recipe: string } {
  const step = recipeKeyStep(recipe);
  return { step, w1Recipe: W1_ORDER[step] };
}

const isSauce = (id: string) => getIngredient(id)?.category === "sauce";

/** A pizza holding exactly `ids` (sauces spread, everything else placed once). */
export function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 2, y: 50 })),
    bakeResult: 70,
  };
}
