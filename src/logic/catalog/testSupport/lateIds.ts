/**
 * Tables keyed by `RecipeId` (sauce profiles, hint roles, ...) carry a row for every late-catalog recipe in EVERY build, because
 * `RecipeId` includes the late ids (types only). In a build where the late catalog is OFF (Production) those recipes do not exist at
 * runtime, so a "table keys == RECIPES" check must ignore their rows. With the catalog ON nothing is ignored. TEST SUPPORT ONLY.
 */
import { LATE_RECIPES, lateCatalogEnabled } from "../../../data/lateCatalog";
import { createEmptyPizza, type PizzaState } from "../../../state/pizzaState";

const INACTIVE: ReadonlySet<string> = lateCatalogEnabled() ? new Set() : new Set(LATE_RECIPES.map((r) => r.id));

/** `ids` without the late recipes that do not exist in this build. */
export function withoutInactiveLate<T extends string>(ids: readonly T[]): T[] {
  return ids.filter((id) => !INACTIVE.has(id));
}

/** The values of a RecipeId-keyed table, without the rows of late recipes that do not exist in this build. */
export function activeRows<V>(table: Readonly<Record<string, V>>): V[] {
  return Object.entries(table).filter(([id]) => !INACTIVE.has(id)).map(([, v]) => v);
}

const LATE_IDS: ReadonlySet<string> = new Set(LATE_RECIPES.map((r) => r.id));

/**
 * E5: the recipes of the ORDINARY catalog, i.e. `RECIPES` without the late-addition ones, whether or not the late catalog is on in this build.
 * For "ordinary recipes are unchanged" checks (no FINISH, no post-bake requirement, default dimensions, ...): the late recipe is the one
 * deliberate exception and is asserted on its own (lateCatalog.ikura.test.ts), so those checks must not iterate it.
 */
export function ordinaryRecipes<T extends { readonly id: string }>(recipes: readonly T[]): T[] {
  return recipes.filter((r) => !LATE_IDS.has(r.id));
}

/** True for a recipe the late catalog adds (whether or not it is active in this build). */
export function isLateRecipeId(id: string): boolean {
  return LATE_IDS.has(id);
}

/**
 * E5: a pizza assembled from a recipe's Reference Pizza, with the pieces of every POST_BAKE requirement marked `stage: "post"` (what the
 * FINISH step records). Ordinary recipes have no such requirement, so for them this is the plain reference pizza.
 */
export function referencePizzaWithLateStage(
  recipe: { readonly requiredIngredients: readonly { readonly ingredientId: string; readonly applicationPhase?: string }[] },
  reference: {
    readonly sauce: { readonly ingredientId: string } | null;
    readonly pieceGroups: readonly { readonly ingredientId: string; readonly positions: readonly { readonly x: number; readonly y: number }[] }[];
  },
): PizzaState {
  const late = new Set(recipe.requiredIngredients.filter((q) => q.applicationPhase === "POST_BAKE").map((q) => q.ingredientId));
  return {
    ...createEmptyPizza(),
    sauceIds: reference.sauce ? [reference.sauce.ingredientId] : [],
    toppings: reference.pieceGroups.flatMap((g, gi) =>
      g.positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: g.ingredientId, ...p, ...(late.has(g.ingredientId) ? { stage: "post" as const } : {}) })),
    ),
  } as PizzaState;
}

/** The ordinary Discovery Ladder steps, i.e. without the step(s) keyed to a late recipe (which sit after every ordinary step). */
export function ordinaryLadderSteps<S extends { readonly keyRecipeId: string }>(steps: readonly S[]): S[] {
  return steps.filter((s) => !LATE_IDS.has(s.keyRecipeId));
}

/** `ladder` without its late step(s) -- the ordinary ladder the append-only / golden pins were written against. */
export function ordinaryLadder<L extends { readonly steps: readonly { readonly keyRecipeId: string }[] }>(ladder: L): L {
  return { ...ladder, steps: ordinaryLadderSteps(ladder.steps) };
}
