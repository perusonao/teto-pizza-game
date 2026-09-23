import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { totalStars } from "./mastery";
import { recipeUnlocked } from "../state/progression";
import { applyStarterGrants, STARTER_STOCK_PLAYS_CHAPTER_1 } from "../state/starterStock";
import { EMPTY_INVENTORY, consumePizzaInventory, type InventoryState } from "../state/inventory";
import { restockIngredient } from "./economy";
import { applyPitzCredit } from "./pitzReward";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import type { QualityStars } from "./scoring";

/**
 * Economy Tuning 2: a deterministic, code-driven simulation of a representative player's
 * journey through the full 15-recipe / 22-ingredient chain, exercising the exact same
 * production formulas the real game uses (Starter Grant, Pitz reward, Shop restock,
 * inventory consumption, recipe/ingredient unlock gates) rather than re-deriving them.
 *
 * Deliberately NOT a Monte Carlo simulation -- "deterministic" per the task's own instruction.
 * Each player profile is a fixed, repeating cycle of round outcomes (a star rating 1-5, or
 * FAILED) rather than a random draw, so the exact same profile always produces the exact same
 * trace, byte for byte, on every run. This is analysis/test-only: no production code imports
 * this module.
 */

export type RoundOutcome = QualityStars | "FAILED";

/** One representative round outcome cycle per player archetype (§3 of the task). Indices
 *  cycle indefinitely via `nextOutcome`. Representative total scores per star tier are chosen
 *  to land inside `STAR_THRESHOLDS`'/`QUALITY_MULTIPLIER_BANDS`' own bands (both 90/75/60/40/0)
 *  so the simulated Pitz reward always matches the star shown. */
export interface PlayerProfile {
  name: "GOOD" | "NORMAL" | "STRUGGLING" | "STRUGGLING_HARD_CAP";
  /** Repeating sequence of round outcomes. */
  cycle: readonly RoundOutcome[];
}

export const GOOD_PLAYER: PlayerProfile = {
  name: "GOOD",
  // ~average ★4.3, 1/14 FAILED (~7%) -- "平均★4相当, FAILED少ない".
  cycle: [5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 4, 5, 4, "FAILED"],
};

export const NORMAL_PLAYER: PlayerProfile = {
  name: "NORMAL",
  // ★2-4 mixed, 2/16 FAILED (12.5%) -- "★2〜★4混在, 時々FAILED".
  cycle: [4, 3, 2, 4, 3, "FAILED", 3, 4, 2, 3, 4, 3, 2, "FAILED", 4, 3],
};

export const STRUGGLING_PLAYER: PlayerProfile = {
  name: "STRUGGLING",
  // ★1-3 CENTERED (task wording: "中心" = centered around, not a hard ceiling) with two rare
  // ★4 excursions -- a real human player's execution varies round to round, so a "struggling"
  // player who never once clears the ★4 band across an entire 15-recipe playthrough would be
  // an unrealistically harsh floor, not a representative one. 4/20 FAILED (20%) -- "FAILEDあり".
  cycle: [2, 1, 3, "FAILED", 2, 1, "FAILED", 3, 2, 1, "FAILED", 4, 2, 3, 1, "FAILED", 2, 1, 3, 4],
};

/**
 * Economy Tuning 2 Fresh Merge Gate follow-up: a SEPARATE, independent stress case -- never a
 * substitute for `STRUGGLING_PLAYER` above, and never described as its "ruled out" precursor.
 * This profile literally never rolls above ★3 for any bake, for the entire run -- the single
 * most pessimistic reading of "★1〜★3", with no execution-variance excursions at all. It exists
 * to answer one specific, purely mathematical question about the unlock chain itself (see the
 * Result Report's own "Progression Tuning Handoff" section): with every recipe's own BEST
 * capped at exactly ★3, is `meat-lovers`' 44-totalStars gate reachable at all, independent of
 * Pitz/inventory/Shop? 14 non-`meat-lovers` recipes × ★3 = 42 totalStars, one gate short of 44
 * by construction -- this profile is expected, by design, to plateau below the top of the
 * chain. That plateau is a PROGRESSION finding (unlock pacing / minTotalStars gate spacing), not
 * an economy one: `simulateProgression` on this profile is expected to report `completed: false`
 * with `shortageEvents.length === 0` -- i.e. it stops because totalStars cannot go any higher,
 * never because Pitz or inventory ran out. Same 20% FAILED rate as `STRUGGLING_PLAYER`, so the
 * two profiles differ in exactly one respect (the ★4 excursions), isolating that variable.
 */
export const STRUGGLING_HARD_CAP_PLAYER: PlayerProfile = {
  name: "STRUGGLING_HARD_CAP",
  cycle: [2, 1, 3, "FAILED", 2, 1, "FAILED", 3, 2, 1, "FAILED", 2, 3, 1, "FAILED", 2],
};

/** Representative 0-100 total for each star tier, chosen inside that tier's own band
 *  (STAR_THRESHOLDS/QUALITY_MULTIPLIER_BANDS, both 90/75/60/40/0) so the simulated Pitz reward
 *  always matches the star shown. */
const REPRESENTATIVE_TOTAL_FOR_STAR: Record<QualityStars, number> = {
  5: 95,
  4: 80,
  3: 65,
  2: 45,
  1: 20,
};

/** How many times a newly-available recipe is attempted back-to-back before the simulation
 *  moves on to the next recipe in the focus queue, absent a shortage. Mirrors a player
 *  "settling" a recipe's Dex BEST before moving to the next one, rather than grinding one
 *  recipe forever (each recipe's BEST caps at 5 stars, so grinding past a handful of attempts
 *  yields rapidly diminishing returns). */
const ATTEMPTS_PER_FOCUS_VISIT = 3;

/** Safety cap on total bake attempts -- if a profile hasn't discovered every recipe within
 *  this many attempts, the simulation reports it as BLOCKED (a soft-lock) rather than looping
 *  forever. Chosen generously (>> any expected real value) so it only ever fires on a genuine
 *  progression-breaking economy bug. */
const MAX_TOTAL_ATTEMPTS = 4000;

export interface ShortageEvent {
  attemptIndex: number;
  recipeId: RecipeId;
  ingredientId: string;
  pitzBalance: number;
  pitzNeeded: number;
}

export interface UnlockEvent {
  recipeId: RecipeId;
  attemptIndex: number;
  pitzBalanceAtUnlock: number;
  totalStarsAtUnlock: number;
}

export interface RestockPurchase {
  attemptIndex: number;
  recipeId: RecipeId;
  ingredientId: string;
  pricePitz: number;
  restockQuantity: number;
}

export interface SimulationResult {
  profile: PlayerProfile["name"];
  /** True if every recipe was discovered within `MAX_TOTAL_ATTEMPTS`. */
  completed: boolean;
  totalAttempts: number;
  totalBakes: number;
  totalFailedBakes: number;
  cumulativePitzEarned: number;
  cumulativePitzSpentOnRestock: number;
  finalPitzBalance: number;
  finalInventory: InventoryState;
  finalTotalStars: number;
  unlockEvents: UnlockEvent[];
  restockPurchases: RestockPurchase[];
  shortageEvents: ShortageEvent[];
  /** Ingredient id -> number of shortage events for it, descending by count. */
  repeatedShortageIngredients: Array<{ ingredientId: string; count: number }>;
  firstShortage: ShortageEvent | null;
}

function nextOutcome(profile: PlayerProfile, attemptIndex: number): RoundOutcome {
  return profile.cycle[attemptIndex % profile.cycle.length];
}

/** Builds a synthetic canonical `PizzaState` that places exactly `recipe.requiredIngredients`'
 *  own minCount of each ingredient -- the "typical, no-waste play" assumption this simulation
 *  uses throughout (a player placing exactly what's asked, never extra off-recipe pieces).
 *  Only the fields `consumePizzaInventory` actually reads (`toppings`, `sauceIds`) are
 *  populated; every other `PizzaState` field is irrelevant to inventory consumption. */
function buildTypicalPizza(recipe: Recipe): PizzaState {
  const toppings: PizzaState["toppings"] = [];
  const sauceIds: string[] = [];
  let toppingSeq = 0;
  for (const req of recipe.requiredIngredients) {
    const ingredient = getIngredient(req.ingredientId);
    if (!ingredient) continue;
    if (ingredient.placement === "scatter") {
      for (let i = 0; i < req.minCount; i++) {
        toppings.push({ id: `sim-${toppingSeq++}`, ingredientId: ingredient.id, x: 0, y: 0 });
      }
    } else {
      sauceIds.push(ingredient.id);
    }
  }
  return {
    ...createEmptyPizza(),
    sauceIds,
    toppings,
    bakeResult: (recipe.bakeTarget.start + recipe.bakeTarget.end) / 2,
  };
}

/** Every finite (`unlockCondition`-bearing) ingredient `recipe` requires, with its own
 *  `minCount` -- the set this simulation must guarantee is in stock before a bake attempt. */
function finiteRequirements(recipe: Recipe): Array<{ ingredientId: string; minCount: number }> {
  return recipe.requiredIngredients
    .map((req) => ({ req, ingredient: getIngredient(req.ingredientId) }))
    .filter((x) => x.ingredient?.unlockCondition)
    .map((x) => ({ ingredientId: x.req.ingredientId, minCount: x.req.minCount }));
}

/**
 * Runs one full deterministic playthrough of the 15-recipe chain for `profile`, exercising the
 * real production Starter Grant / Pitz reward / Shop restock / inventory / progression
 * formulas at every step. See this module's own file header for the overall approach.
 */
export function simulateProgression(profile: PlayerProfile): SimulationResult {
  let dex: DexState = EMPTY_DEX;
  let ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS;
  let inventory: InventoryState = EMPTY_INVENTORY;
  let pitzBalance = 0;
  let claimedRecipeIds: readonly string[] = [];

  const unlockEvents: UnlockEvent[] = [];
  const restockPurchases: RestockPurchase[] = [];
  const shortageEvents: ShortageEvent[] = [];
  let cumulativePitzEarned = 0;
  let cumulativePitzSpentOnRestock = 0;
  let totalBakes = 0;
  let totalFailedBakes = 0;

  // margherita is unconditionally unlocked and never Starter-Granted (its own ingredients are
  // all permanently unlimited) -- record it as "unlocked" up front, matching real game state.
  unlockEvents.push({
    recipeId: "margherita",
    attemptIndex: 0,
    pitzBalanceAtUnlock: 0,
    totalStarsAtUnlock: 0,
  });

  const grantedRecipeIdsSeen = new Set<RecipeId>(["margherita"]);

  function applyGrantsAndRecordUnlocks(attemptIndex: number) {
    const grant = applyStarterGrants(dex, ownedIngredientIds, inventory, claimedRecipeIds);
    inventory = grant.inventory;
    ownedIngredientIds = grant.ownedIngredientIds;
    claimedRecipeIds = grant.claimedRecipeIds;
    for (const recipeId of grant.grantedRecipeIds) {
      if (grantedRecipeIdsSeen.has(recipeId)) continue;
      grantedRecipeIdsSeen.add(recipeId);
      unlockEvents.push({
        recipeId,
        attemptIndex,
        pitzBalanceAtUnlock: pitzBalance,
        totalStarsAtUnlock: totalStars(dex),
      });
    }
  }

  function isAvailable(recipe: Recipe): boolean {
    if (!recipeUnlocked(recipe, dex)) return false;
    return recipe.requiredIngredients.every((req) => ownedIngredientIds.includes(req.ingredientId));
  }

  /** Attempts to ensure `recipe`'s finite ingredients are in stock for one more bake, spending
   *  Pitz on `restockIngredient` as needed. Returns false (and records a ShortageEvent) if
   *  Pitz is insufficient to cover a needed restock -- the caller must then skip this bake. */
  function ensureStockOrRecordShortage(recipe: Recipe, attemptIndex: number): boolean {
    for (const { ingredientId, minCount } of finiteRequirements(recipe)) {
      const have = inventory[ingredientId] ?? 0;
      if (have >= minCount) continue;
      const ingredient = getIngredient(ingredientId)!;
      const result = restockIngredient({
        ingredient,
        ownedIngredientIds,
        inventory,
        pitzBalance,
      });
      if (!result.success) {
        shortageEvents.push({
          attemptIndex,
          recipeId: recipe.id,
          ingredientId,
          pitzBalance,
          pitzNeeded: ingredient.pricePitz ?? 0,
        });
        return false;
      }
      inventory = result.nextInventory;
      pitzBalance = result.nextPitzBalance;
      cumulativePitzSpentOnRestock += ingredient.pricePitz!;
      restockPurchases.push({
        attemptIndex,
        recipeId: recipe.id,
        ingredientId,
        pricePitz: ingredient.pricePitz!,
        restockQuantity: ingredient.restockQuantity!,
      });
      // Re-check: a single restock batch may still be short of `minCount` for a recipe that
      // needs more than one batch's worth in a single sitting (none currently do, but stay
      // correct if that ever changes) -- loop until sufficient or Pitz runs out.
      if ((inventory[ingredientId] ?? 0) < minCount) {
        return ensureStockOrRecordShortage(recipe, attemptIndex);
      }
    }
    return true;
  }

  function bakeOnce(recipe: Recipe, attemptIndex: number) {
    const pizza = buildTypicalPizza(recipe);
    inventory = consumePizzaInventory(pizza, inventory);
    totalBakes++;
    const outcome = nextOutcome(profile, attemptIndex);
    if (outcome === "FAILED") {
      totalFailedBakes++;
      return; // Completion Gate: no Dex/Pitz/Starter Grant credit for a FAILED round.
    }
    const total = REPRESENTATIVE_TOTAL_FOR_STAR[outcome];
    const scoreBreakdown = {
      matchScore: total,
      ingredientScore: total,
      placementScore: total,
      bakeScore: total,
      total,
      stars: outcome,
    };
    const { dex: nextDex, wasNewDiscovery } = registerScoreToDex(dex, recipe.id, scoreBreakdown);
    dex = nextDex;
    // Codex review (P2): OD-02's +50 first-discovery bonus (../logic/pitzReward.ts) must be fed
    // by this same wasNewDiscovery flag, or the simulator silently treats every discovery as a
    // repeat and under-models pitzBalance/cumulativePitzEarned/shortage-deadlock outcomes.
    const credit = applyPitzCredit(recipe.baseRewardPitz, total, pitzBalance, wasNewDiscovery);
    pitzBalance = credit.balanceAfter;
    cumulativePitzEarned += credit.earnedPitz + credit.discoveryBonusPitz;
    applyGrantsAndRecordUnlocks(attemptIndex);
  }

  let attemptIndex = 0;
  // Every recipe id, used only for the final "did every recipe get discovered" check --
  // membership, not order, is all that's read from this.
  const allRecipeIds: RecipeId[] = RECIPES.map((r) => r.id);
  const isDiscovered = (id: RecipeId) => dex.some((e) => e.recipeId === id && e.discovered);
  const bestStarsOf = (id: RecipeId) => dex.find((e) => e.recipeId === id)?.bestStars ?? 0;

  // Round-robin cursor for the grinding phase (below) -- deterministic across calls, never
  // reset mid-run, so the same profile always grinds recipes in the same order.
  let grindCursor = 0;
  // How many consecutive full grind sweeps (one attempt on every still-improvable discovered
  // recipe) produced zero totalStars improvement -- once this exceeds `MAX_STALLED_SWEEPS`,
  // every discovered recipe has reached this player's own permanent ceiling for it (their
  // profile's cycle never rolls a higher star for that recipe again) and no further grinding
  // can ever raise totalStars further; the run is reported BLOCKED rather than spinning until
  // `MAX_TOTAL_ATTEMPTS`.
  let stalledSweeps = 0;
  let starsAtSweepStart = 0;
  let sweepProgress = 0;
  const MAX_STALLED_SWEEPS = 3;

  while (attemptIndex < MAX_TOTAL_ATTEMPTS) {
    const allDiscovered = allRecipeIds.every(isDiscovered);
    if (allDiscovered) break;
    if (stalledSweeps >= MAX_STALLED_SWEEPS) break; // Genuine ceiling reached -- BLOCKED.

    const available = RECIPES.filter((r) => isAvailable(r));
    if (available.length === 0) break; // Should never happen (margherita is always available).

    // Phase 1 (discover): any available recipe never yet baked to a PASS takes priority over
    // grinding an already-discovered one -- a player naturally tries new content as it opens
    // up rather than re-grinding what they've already mastered.
    const undiscovered = available.filter((r) => !isDiscovered(r.id));

    let focusTarget: Recipe;
    if (undiscovered.length > 0) {
      focusTarget = undiscovered[0];
    } else {
      // Phase 2 (grind): round-robin over every discovered, available recipe that hasn't yet
      // hit ITS OWN ceiling (5 stars, or this profile's cycle simply never rolling higher --
      // detected via `stalledSweeps` below, not per-recipe here). `available` is re-filtered
      // to discovered ids so a recipe whose own totalStars gate later locks it back out (never
      // happens today, but stays correct if it ever could) is skipped.
      const discoveredAvailable = available.filter((r) => isDiscovered(r.id));
      grindCursor = grindCursor % discoveredAvailable.length;
      focusTarget = discoveredAvailable[grindCursor];
      grindCursor++;
      sweepProgress++;
      if (sweepProgress >= discoveredAvailable.length) {
        // Completed one full round-robin sweep -- check whether it moved totalStars at all.
        const starsNow = totalStars(dex);
        stalledSweeps = starsNow > starsAtSweepStart ? 0 : stalledSweeps + 1;
        starsAtSweepStart = starsNow;
        sweepProgress = 0;
      }
    }

    if (!ensureStockOrRecordShortage(focusTarget, attemptIndex)) {
      // Can't afford this recipe's restock right now. Try to earn Pitz via any other
      // available recipe that doesn't need a restock, so a shortage on one ingredient never
      // fully halts progress if an alternative income source exists.
      const alternative = available.find(
        (r) => r.id !== focusTarget.id && ensureStockOrRecordShortage(r, attemptIndex),
      );
      if (alternative) {
        bakeOnce(alternative, attemptIndex);
      }
      attemptIndex++;
      continue;
    }

    // Bake the focus target for one "visit" (a small burst of attempts during the discover
    // phase; exactly one attempt at a time during the grind phase, so the round-robin sweep
    // above advances one recipe per loop iteration rather than exhausting one recipe first).
    const visitLength = undiscovered.length > 0 ? ATTEMPTS_PER_FOCUS_VISIT : 1;
    for (let i = 0; i < visitLength && attemptIndex < MAX_TOTAL_ATTEMPTS; i++) {
      if (i > 0 && !ensureStockOrRecordShortage(focusTarget, attemptIndex)) break;
      bakeOnce(focusTarget, attemptIndex);
      attemptIndex++;
      if (isDiscovered(focusTarget.id) && bestStarsOf(focusTarget.id) >= 5) break;
      if (i === 0 && visitLength > 1 && isDiscovered(focusTarget.id)) {
        // Already discovered on the first attempt of this visit -- no need to keep spending
        // the rest of the burst on it; re-derive the focus target next outer iteration.
        break;
      }
    }
  }

  const shortageCounts = new Map<string, number>();
  for (const event of shortageEvents) {
    shortageCounts.set(event.ingredientId, (shortageCounts.get(event.ingredientId) ?? 0) + 1);
  }
  const repeatedShortageIngredients = Array.from(shortageCounts.entries())
    .map(([ingredientId, count]) => ({ ingredientId, count }))
    .sort((a, b) => b.count - a.count);

  return {
    profile: profile.name,
    completed: allRecipeIds.every(isDiscovered),
    totalAttempts: attemptIndex,
    totalBakes,
    totalFailedBakes,
    cumulativePitzEarned,
    cumulativePitzSpentOnRestock,
    finalPitzBalance: pitzBalance,
    finalInventory: inventory,
    finalTotalStars: totalStars(dex),
    unlockEvents,
    restockPurchases,
    shortageEvents,
    repeatedShortageIngredients,
    firstShortage: shortageEvents[0] ?? null,
  };
}

/** All ingredients with a Shop price/restock batch, for the Economy Table report (§2). */
export function financeIngredientTable() {
  return INGREDIENTS.filter((i) => i.unlockCondition).map((i) => ({
    id: i.id,
    pricePitz: i.pricePitz,
    restockQuantity: i.restockQuantity,
    pitzPerUnit:
      i.pricePitz !== undefined && i.restockQuantity ? i.pricePitz / i.restockQuantity : undefined,
    starterGrantOnly: i.starterGrantOnly ?? false,
  }));
}

export { STARTER_STOCK_PLAYS_CHAPTER_1 };
