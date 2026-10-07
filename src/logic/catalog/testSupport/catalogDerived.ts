/**
 * Recipe Expansion speed-up Phase 1: catalog-derived test support. TEST SUPPORT ONLY (never imported by
 * production code). Every count / seed a test used to hand-pin at "33 recipes / 35 ingredients / 29 steps" is
 * derived here from the authorities (RECIPES, INGREDIENTS, DISCOVERY_LADDER, buildRecipeChapters,
 * participatesInLunchRush), so adding a recipe batch no longer edits ~90 files. The ONE explicit expected-total
 * ledger is `src/data/catalogLedger.test.ts`; nothing here asserts anything.
 */
import { DISCOVERY_LADDER, W1_FIXED_STEP_COUNT } from "../../../data/discoveryLadder";
import { INGREDIENTS } from "../../../data/ingredients";
import { RECIPES, participatesInLunchRush, type Recipe } from "../../../data/recipes";
import { buildRecipeChapters } from "../../../state/recipeChapters";

const ALL_RECIPES: readonly Recipe[] = RECIPES;

/** Starter recipe the Discovery Ladder is played from (the onboarding recipe; step 0, no material). */
export const LADDER_FIRST_RECIPE_ID = "margherita";

export const CATALOG_COUNTS = {
  recipes: RECIPES.length,
  credited: ALL_RECIPES.filter((r) => r.ladderCredit !== false).length,
  ingredients: INGREDIENTS.length,
  toppings: INGREDIENTS.filter((i) => i.category === "topping").length,
  ladderSteps: DISCOVERY_LADDER.steps.length,
  chapterSizes: buildRecipeChapters().map((c) => c.recipes.length),
  lunchRushPool: ALL_RECIPES.filter((r) => participatesInLunchRush(r.id)).length,
} as const;

/** The ingredients unlocked by ladder steps <= `step`, in ladder order. */
export const materialsUpTo = (step: number): string[] =>
  DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

/** Ladder play order: [LADDER_FIRST_RECIPE_ID, []] then each step's key recipe with its unlocked materials. */
export const LADDER_PLAY: readonly (readonly [string, readonly string[]])[] = [
  [LADDER_FIRST_RECIPE_ID, []],
  ...DISCOVERY_LADDER.steps.map((s) => [s.keyRecipeId, s.ingredientIds] as const),
];

/** Recipes that never advance the ladder (`ladderCredit: false`). */
export const NON_CREDIT_RECIPE_IDS: readonly string[] = ALL_RECIPES.filter((r) => r.ladderCredit === false).map((r) => r.id);

/** Credited recipes that are nobody's key recipe (makeable alongside a key recipe). A COMPLETE seed discovers them too. */
export const NON_KEY_CREDITED_RECIPE_IDS: readonly string[] = ALL_RECIPES.filter(
  (r) => r.ladderCredit !== false && !LADDER_PLAY.some(([id]) => id === r.id),
).map((r) => r.id);

export interface LadderSaveOpts {
  newestOwned?: boolean;
  newestStock?: number;
  pitz?: number;
  purchases?: Record<string, number>;
  /** Also discover every recipe outside the ladder's own order (non-credit + non-key credited). */
  complete?: boolean;
}

/** A v2 save with the ladder played to `count` discoveries; the materials of steps <= count owned with stock 10
 *  (the newest step's with `newestStock`, or not owned at all when `newestOwned` is false). */
export function ladderSave(count: number, opts: LadderSaveOpts = {}) {
  const materials = LADDER_PLAY.slice(1, count + 1).flatMap(([, m]) => m);
  const newest = count >= 1 && count < LADDER_PLAY.length ? LADDER_PLAY[count][1] : [];
  const owned = materials.filter((m) => opts.newestOwned !== false || !newest.includes(m));
  const recipeIds = [
    ...LADDER_PLAY.slice(0, count).map(([recipeId]) => recipeId),
    ...(opts.complete ? [...NON_CREDIT_RECIPE_IDS, ...NON_KEY_CREDITED_RECIPE_IDS] : []),
  ];
  return {
    schemaVersion: 2,
    dex: recipeIds.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: opts.pitz ?? 999,
    ...(opts.purchases ? { discoveryHintPurchases: opts.purchases } : {}),
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((m) => [m, newest.includes(m) ? (opts.newestStock ?? 10) : 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
  };
}

/** The materials the ladder steps appended after the frozen W1 steps sell (derived: no per-batch list). */
export const POST_W1_MATERIAL_IDS: readonly string[] = DISCOVERY_LADDER.steps
  .filter((s) => s.step > W1_FIXED_STEP_COUNT)
  .flatMap((s) => s.ingredientIds as readonly string[]);

/** The recipes outside the W1 population: No.27 pesto-pollo onward, except TQ-1D's aussie (a W1-pool recipe). Derived. */
export const POST_W1_RECIPE_IDS: readonly string[] = ALL_RECIPES.slice(ALL_RECIPES.findIndex((r) => r.id === "pesto-pollo"))
  .map((r) => r.id as string)
  .filter((id) => id !== "aussie");
