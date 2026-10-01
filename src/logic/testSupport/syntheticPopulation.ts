import type { HintRoles } from "../../data/recipeHintRoles";
import type { Recipe } from "../../data/recipes";

/**
 * Discovery 3.0 PR-4a: synthetic recipe populations for tests. NOTHING here is production data and
 * nothing in `src/data` imports it. It exists so that "exactly one discoverable unknown recipe at a time"
 * -- true of the 25 production recipes, false as soon as a second recipe shares a ladder step -- stops
 * being an implicit premise of the discovery / hint / ladder tests.
 *
 * - `SYNTH_BRANCH_A_ID` is a real W1 recipe (the "A" of A / B). Its key step is the ladder's step 12.
 * - `SYNTH_BRANCH_B` is a synthetic, non-credit (OD-D3-17 O3 `ladderCredit: false`) recipe whose key step
 *   is the SAME step (12): it needs sausage / onion / black-olive / oregano only. With every material of
 *   A and B owned and 12 ladder-counted discoveries, A and B are both DISCOVERABLE (pool = 2).
 * - The id is deliberately not a possible production id (`synthetic-` prefix), so a future production
 *   recipe can never change what these fixtures mean.
 */

/** The 25 production recipes that existed before Discovery 3.0 PR-4 (frozen on purpose). Synthetic populations are
 *  built on THESE, so adding a production recipe later can never change what a synthetic fixture means. */
export const FROZEN_PRODUCTION_25_IDS: readonly string[] = [
  "margherita",
  "marinara",
  "quattro-formaggi",
  "genovese",
  "bismarck",
  "funghi",
  "fugazza",
  "salsiccia",
  "pepperoni",
  "napoletana",
  "tonno-e-cipolla",
  "pizza-bianca",
  "breakfast-pizza",
  "capricciosa",
  "meat-lovers",
  "melanzane-pizza",
  "parmigiana-pizza",
  "bambino",
  "hawaiian",
  "pizza-portuguesa",
  "pesto-tonno",
  "new-haven-apizza",
  "pesto-caprese",
  "pesto-patate",
  "puttanesca-pizza",
];

export function frozenProduction25(recipes: readonly Recipe[]): readonly Recipe[] {
  return recipes.filter((r) => FROZEN_PRODUCTION_25_IDS.includes(r.id));
}

export const SYNTH_BRANCH_A_ID = "pizza-portuguesa";
export const SYNTH_BRANCH_B_ID = "synthetic-branch-b";

type Req = { ingredientId: string; minCount: number };

/** A minimal Recipe for tests. The cast is the point: a synthetic id is not in the production `RecipeId` union. */
export function syntheticRecipe(id: string, requiredIngredients: readonly Req[], extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    nameJa: id,
    description: "",
    requiredIngredients,
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
    ...extra,
  } as unknown as Recipe;
}

export const SYNTH_BRANCH_B: Recipe = syntheticRecipe(
  SYNTH_BRANCH_B_ID,
  [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "sausage", minCount: 3 },
    { ingredientId: "onion", minCount: 2 },
    { ingredientId: "black-olive", minCount: 2 },
    { ingredientId: "oregano", minCount: 1 },
  ],
  { ladderCredit: false, bakeTarget: { start: 58, end: 78 } },
);

/** Key-free hint authoring (OD-D3-21) for the synthetic recipe: nothing hand-authored. */
export const SYNTH_KEY_FREE_ROLES: HintRoles = { keyFree: true };

/** The frozen 25 production recipes plus the synthetic branching recipe (A stays where it is). */
export function withSyntheticBranch(recipes: readonly Recipe[]): readonly Recipe[] {
  return [...frozenProduction25(recipes), SYNTH_BRANCH_B];
}

/** Hint roles for a population that contains `SYNTH_BRANCH_B`: production roles + the key-free marker. */
export function withSyntheticBranchRoles<T extends Readonly<Record<string, HintRoles>>>(
  roles: T,
): Readonly<Record<string, HintRoles>> {
  return { ...roles, [SYNTH_BRANCH_B_ID]: SYNTH_KEY_FREE_ROLES };
}
