import { W1_25_DISCOVERY_LADDER, type DiscoveryLadder } from "../../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { countsTowardLadder, type Recipe } from "../../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { resolveShopEntitlement } from "../../state/materialEntitlement";
import { countRecipeDiscoveryStates, type RecipeDiscoveryInputs } from "../../state/recipeDiscoveryState";
import { discoverableHintCandidates } from "../discovery/hintTarget";

/**
 * Discovery 3.0 PR-4a: a population-parametric discovery walk. The pre-4a simulations walked ONE path
 * ("the only discoverable recipe is the next ladder key recipe"). With a second recipe on a ladder step
 * (a pool of 2+) several legal orders exist, so this enumerates ALL of them (depth first) instead of
 * assuming one. Pure and deterministic; the Shop is modelled as "buy every entitled material".
 */

export interface WalkStep {
  /** The recipe discovered at this step. */
  discovered: string;
  /** Every DISCOVERABLE recipe id just before the discovery, in hint order (the legal choices). */
  pool: readonly string[];
  /** Ladder-counted discoveries after this step. */
  ladderCount: number;
  /** Recipes still UNKNOWN (a required material is not entitled yet) after this step. */
  unknownAfter: number;
  /** Shop-entitled materials after this step. */
  entitledAfter: readonly string[];
}

export interface WalkResult {
  /** One entry per complete legal order (every recipe discovered). */
  orders: readonly (readonly WalkStep[])[];
  /** Ids of states where recipes remained undiscovered but nothing was DISCOVERABLE. */
  softlocks: readonly string[];
}

/** Ladder-counted discoveries (the ladder's only input from play). Local on purpose: the Discovery Ladder pure
 *  layer may only be imported through its intended bridges (discoveryLadder.test.ts, wiring boundary). */
export function ladderCountOf(dex: DexState, population: readonly Recipe[]): number {
  return new Set(dex.filter((e) => e.discovered && countsTowardLadder(e.recipeId, population)).map((e) => e.recipeId)).size;
}

export function discoverIds(dex: DexState, ids: readonly string[]): DexState {
  let next = dex;
  for (const id of ids) {
    next = registerScoreToDex(next, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return next;
}

/** Inputs for `dex` with every entitled material bought (stock 10), under the population's ladder rule. */
export function walkInputs(
  dex: DexState,
  population: readonly Recipe[],
  ladder: DiscoveryLadder = W1_25_DISCOVERY_LADDER,
): RecipeDiscoveryInputs {
  const credit = (id: string) => countsTowardLadder(id, population);
  const entitled = resolveShopEntitlement(dex, [], [], ladder, credit).unlockedForShopIngredientIds;
  const owned = [...STARTER_INGREDIENT_IDS, ...entitled];
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: entitled,
    inventory: Object.fromEntries(entitled.map((id) => [id, 10])),
  };
}

export function enumerateDiscoveryOrders(
  population: readonly Recipe[],
  options: { ladder?: DiscoveryLadder; maxOrders?: number } = {},
): WalkResult {
  const ladder = options.ladder ?? W1_25_DISCOVERY_LADDER;
  const maxOrders = options.maxOrders ?? 5000;
  const orders: WalkStep[][] = [];
  const softlocks: string[] = [];

  const visit = (dex: DexState, trail: WalkStep[]): void => {
    if (orders.length >= maxOrders) return;
    const inputs = walkInputs(dex, population, ladder);
    const pool = discoverableHintCandidates(inputs, population);
    const undiscovered = population.filter((r) => !dex.some((e) => e.recipeId === r.id && e.discovered));
    if (undiscovered.length === 0) {
      orders.push(trail);
      return;
    }
    if (pool.length === 0) {
      softlocks.push(trail.map((s) => s.discovered).join(">") || "(start)");
      return;
    }
    for (const recipe of pool) {
      const next = discoverIds(dex, [recipe.id]);
      const nextInputs = walkInputs(next, population, ladder);
      visit(next, [
        ...trail,
        {
          discovered: recipe.id,
          pool: pool.map((r) => r.id),
          ladderCount: ladderCountOf(next, population),
          unknownAfter: countRecipeDiscoveryStates(population, nextInputs).UNKNOWN,
          entitledAfter: nextInputs.unlockedForShopIngredientIds,
        },
      ]);
    }
  };

  visit(EMPTY_DEX, []);
  return { orders, softlocks };
}
