/**
 * FIN-E4 foundation (Issue #611 / #294 / #604, Owner decision D-3 = 案 1): the ONE place where late-addition (後乗せ,
 * `applicationPhase: "POST_BAKE"`) content joins the catalog.
 *
 * A late recipe cannot be completed unless the FINISH step runs, and FINISH is OFF in Production. A late recipe that were
 * visible there would be undiscoverable and would stall the ladder, the hint economy and Research (measured: 8 progression
 * walks fail). So late content never enters `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` unless the BUILD-TIME constant
 * below is `true`. With it `false` (Production) every merge below returns its base array ITSELF -- same object, same bytes --
 * and the discovery catalog, Dex / save sanitizers, Shop, Research, hints and inventory (all derived from those three) see
 * exactly the catalog they saw before this file existed.
 *
 * This file holds NO content: the three arrays are empty, so the types of `RecipeId` / the catalogs are unchanged. A later PR
 * (FIN-E4b BBQ chicken, the ikura-salmon redesign) fills them; it needs no other wiring. Switching `LATE_CATALOG_PRODUCTION`
 * on is a separate Owner decision (E5), together with the FINISH production switch (./freeCookFinishGate.ts).
 *
 * Imports are type-only (and the ladder step shape is declared here, structurally identical to `AppendedLadderStep`) so this module can be read by
 * recipes.ts / ingredients.ts / discoveryLadder.ts without a cycle, and without adding an importer of the ladder pure layer
 * (the runtime-wiring boundary test in logic/discoveryLadder.test.ts).
 */
import type { Ingredient } from "./ingredients";

/** Build-time switch (Owner D-3 案 1). `false` in Production; a literal so a bundler drops the late branch. */
export const LATE_CATALOG_PRODUCTION = false;

export function lateCatalogEnabled(): boolean {
  return LATE_CATALOG_PRODUCTION;
}

/** What the guards read from a late recipe (the full `Recipe` is checked by the type system where the data lives). */
export interface LateRecipeShape {
  readonly id: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: "POST_BAKE" }[];
  readonly lunchRush?: boolean;
}

/** A late ladder step; the same shape as `AppendedLadderStep` (../logic/discoveryLadder.ts), which `appendLadderSteps` accepts. */
export interface LateLadderStep {
  readonly ingredientIds: readonly string[];
  readonly starGates?: Readonly<Record<string, number>>;
  readonly keyRecipeId: string;
}

/** Late recipes, in authored order. Each carries at least one `POST_BAKE` requirement and `lunchRush: false`. EMPTY until E4 data. */
export const LATE_RECIPES = [] as const;

/** Late-only ingredients (each with an `unlockCondition`: reachable only through a late ladder step). EMPTY until E4 data. */
export const LATE_INGREDIENTS: readonly Ingredient[] = [];

/** Discovery target id (PIZZA DB evidence id) of every late recipe. EMPTY until E4 data. */
export const LATE_DISCOVERY_TARGET_IDS: Readonly<Record<string, string>> = {};

/**
 * Late ladder steps, appended AFTER every ordinary appended step, so a late step's number is always "ordinary ladder length + k"
 * and the OFF ladder is a strict prefix of the ON ladder. EMPTY until E4 data.
 */
export const LATE_LADDER_STEPS: readonly LateLadderStep[] = [];

/** `base` followed by `late` when enabled; otherwise `base` itself (not a copy). */
export function mergeLate<B extends readonly unknown[], L extends readonly unknown[]>(base: B, late: L, enabled: boolean): readonly [...B, ...L] {
  return (enabled && late.length > 0 ? [...base, ...late] : base) as unknown as readonly [...B, ...L];
}

export interface LateCatalogInput {
  recipes: readonly LateRecipeShape[];
  ingredients: readonly Pick<Ingredient, "id" | "unlockCondition">[];
  ladderSteps: readonly Pick<LateLadderStep, "ingredientIds" | "keyRecipeId">[];
  discoveryTargetIds: Readonly<Record<string, string>>;
}

/**
 * Structural rules a late catalog must satisfy. Pure; returns the violations (empty = valid). `merge*` callers throw on a
 * non-empty result when the catalog is enabled, so a bad late entry fails the build instead of reaching a player.
 */
export function validateLateCatalog(
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[] },
  late: LateCatalogInput,
): string[] {
  const problems: string[] = [];
  const baseRecipes = new Set(base.recipeIds);
  const baseIngredients = new Set(base.ingredientIds);

  const lateRecipeIds = new Set<string>();
  for (const recipe of late.recipes) {
    if (baseRecipes.has(recipe.id) || lateRecipeIds.has(recipe.id)) problems.push(`recipe id is not unique: ${recipe.id}`);
    lateRecipeIds.add(recipe.id);
    if (!recipe.requiredIngredients.some((r) => r.applicationPhase === "POST_BAKE")) problems.push(`late recipe has no POST_BAKE requirement: ${recipe.id}`);
    if (recipe.lunchRush !== false) problems.push(`late recipe must be lunchRush:false (Lunch Rush and Dinner exclude FINISH): ${recipe.id}`);
  }

  const lateIngredientIds = new Set<string>();
  for (const ingredient of late.ingredients) {
    if (baseIngredients.has(ingredient.id) || lateIngredientIds.has(ingredient.id)) problems.push(`ingredient id is not unique: ${ingredient.id}`);
    lateIngredientIds.add(ingredient.id);
    // A late ingredient with no unlockCondition would become a Starter and be owned from the start.
    if (!ingredient.unlockCondition) problems.push(`late ingredient needs an unlockCondition (ladder-gated, never a Starter): ${ingredient.id}`);
  }

  for (const step of late.ladderSteps) {
    if (!lateRecipeIds.has(step.keyRecipeId)) problems.push(`late ladder step key recipe is not a late recipe: ${step.keyRecipeId}`);
    for (const id of step.ingredientIds) {
      if (!baseIngredients.has(id) && !lateIngredientIds.has(id)) problems.push(`late ladder step names an unknown ingredient: ${id}`);
    }
  }

  for (const id of lateRecipeIds) {
    if (!late.discoveryTargetIds[id]) problems.push(`late recipe has no discovery target id: ${id}`);
  }
  for (const id of Object.keys(late.discoveryTargetIds)) {
    if (!lateRecipeIds.has(id)) problems.push(`discovery target id for an unknown late recipe: ${id}`);
  }
  return problems;
}

/** Throws when an ENABLED late catalog breaks a rule; a no-op when disabled (the late arrays are not read at all). */
export function assertLateCatalogValid(
  enabled: boolean,
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[] },
  late: LateCatalogInput,
): void {
  if (!enabled) return;
  const problems = validateLateCatalog(base, late);
  if (problems.length > 0) throw new Error(`Invalid late catalog:\n- ${problems.join("\n- ")}`);
}
