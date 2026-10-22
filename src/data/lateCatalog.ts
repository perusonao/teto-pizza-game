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
 * KNOWN LIMIT (decide before E5): the late entries sit AFTER the ordinary ones, so their ladder step numbers (and positions in
 * `RECIPES` / `INGREDIENTS`) are "ordinary length + k" and shift whenever an ordinary batch appends. Production never sees them, but an ON
 * build is not stable across ordinary batches. Before the catalog is switched on, either forbid ordinary batches while it is on, or give
 * late steps a reserved stable range.
 *
 * Production-OFF here means behaviourally identical data; this file does not claim the bundle is byte-identical (the guard and merge calls
 * go through a function, so dead-code removal is not relied on).
 *
 * Content (FIN-E4b-ikura, Issue #621): `ikura-salmon-pizza` and `salmon-roe` below. `RecipeId` therefore includes the late id (types only), and the
 * tables keyed by it carry a row; at runtime every recipe / ingredient / step here exists only when enabled. Switching `LATE_CATALOG_PRODUCTION`
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

/**
 * The data a late recipe carries. Deliberately NOT `Recipe` (whose `id` is `RecipeId`, itself derived from `RECIPES`, which includes
 * `LATE_RECIPES`): checking `LATE_RECIPES` against `Recipe` would make the type circular. `RECIPES` is typed from the literals below, so a
 * field `Recipe` requires and this shape lacks fails wherever `RECIPES` is consumed as `Recipe`.
 */
interface LateRecipeEntry {
  readonly id: string;
  readonly nameJa: string;
  readonly description: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: "POST_BAKE" }[];
  readonly bakeTarget: { readonly start: number; readonly end: number };
  readonly baseRewardPitz: number;
  readonly lunchRush: false;
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

/**
 * Late recipes, in authored order. Each carries at least one `POST_BAKE` requirement and `lunchRush: false`.
 *
 * FIN-E4b-ikura (Issue #621): `ikura-salmon-pizza`. SOURCE AUTHORITY: only the roe and the shiso are post-bake, by their individual
 * PIZZA DB page citations (Owner confirmation on #614 is the source of record). The salmon and the cream cheese are placed BEFORE the bake
 * as a PROVISIONAL game-design default (Owner Q-1) -- NOT confirmed by the original source. The counts (cream-cheese 2 / salmon 3 /
 * salmon-roe 2 / shiso 1) and the bake window 58-78 (= the generic Free Cooking window) are GAMEPLAY CALIBRATION, not source.
 * NO_SAUCE, no CUT, `lunchRush: false`, ladder-credited, T4, no star gate (OD-B8-1).
 */
export const LATE_RECIPES = [
  {
    id: "ikura-salmon-pizza",
    nameJa: "いくらとサーモンのピザ",
    description: "クリームチーズにサーモン、いくらと大葉をあわせた、ぷちぷち華やかな和風の一枚。", // names no moment: the description is shown before the recipe is discovered (Anti-Oracle)
    requiredIngredients: [
      { ingredientId: "cream-cheese", minCount: 2 },
      { ingredientId: "salmon", minCount: 3 },
      { ingredientId: "salmon-roe", minCount: 2, applicationPhase: "POST_BAKE" },
      { ingredientId: "shiso", minCount: 1, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
] as const satisfies readonly LateRecipeEntry[];

/** The order of each late recipe (the shape of `Order` in ./orders.ts, declared here to stay import-cycle free). */
export const LATE_ORDERS = [
  {
    id: "order-ikura-salmon-pizza",
    recipeId: "ikura-salmon-pizza",
    requestedBy: "mito",
    lineJa: "いくらとサーモンのピザ、ぷちぷちで豪華そう！食べてみたいな！",
  },
] as const;

/**
 * Late-only ingredients (each with an `unlockCondition`: reachable only through a late ladder step).
 * `salmon-roe`: finite ladder material, family `seafood` (OD-B8-2), drawn by the dedicated `salmon-roe-grains` visual; `emoji` is only the
 * required, never-displayed text fallback. Copied from the held PR #584 (which stays untouched).
 */
export const LATE_INGREDIENTS: readonly Ingredient[] = [
  {
    id: "salmon-roe",
    category: "topping",
    nameJa: "いくら",
    color: "#f2842b",
    emoji: "\u{1F7E0}",
    pieceVisual: "salmon-roe-grains",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
];

/** Family rows of the late ingredients (OD-B8-2: `salmon-roe` is `seafood`, L1 only). Joined by ./ingredientTaxonomy.ts only when enabled, so an OFF build has no orphan row. */
export const LATE_TAXONOMY_ROWS = [["salmon-roe", "seafood"]] as const;

/** Topping size class of the late ingredients (`salmon-roe` is extra small, like the other fine garnishes). Joined by ./toppingSizeClass.ts only when enabled. */
export const LATE_TOPPING_SIZE_CLASS = { "salmon-roe": "xs" } as const;

/** Discovery target id (PIZZA DB evidence id) of every late recipe. */
export const LATE_DISCOVERY_TARGET_IDS: Readonly<Record<string, string>> = {
  "ikura-salmon-pizza": "ikura-salmon-pizza-pizzadb-p1",
};

/**
 * Late ladder steps, appended AFTER every ordinary appended step, so a late step's number is always "ordinary ladder length + k"
 * and the OFF ladder is a strict prefix of the ON ladder. The step carries NO number (it is derived), and no star gate (OD-B8-1).
 * `ikura-salmon-pizza` also needs step 54's `shiso`, which is an ordinary step and therefore always earlier.
 */
export const LATE_LADDER_STEPS: readonly LateLadderStep[] = [{ ingredientIds: ["salmon-roe"], keyRecipeId: "ikura-salmon-pizza" }];

/** True for a late recipe id in a build where the late catalog is OFF: the id is in type-keyed tables (RecipeId includes it) but the recipe does not exist. */
export function isInactiveLateRecipeId(id: string): boolean {
  return !lateCatalogEnabled() && LATE_RECIPES.some((r) => r.id === id);
}

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
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[]; discoveryTargetIds?: readonly string[] },
  late: LateCatalogInput,
): string[] {
  const problems: string[] = [];
  const baseRecipes = new Set(base.recipeIds);
  const baseIngredients = new Set(base.ingredientIds);

  const lateIngredientIdSet = new Set(late.ingredients.map((i) => i.id));
  const lateRecipeIds = new Set<string>();
  for (const recipe of late.recipes) {
    if (baseRecipes.has(recipe.id) || lateRecipeIds.has(recipe.id)) problems.push(`recipe id is not unique: ${recipe.id}`);
    lateRecipeIds.add(recipe.id);
    if (!recipe.requiredIngredients.some((r) => r.applicationPhase === "POST_BAKE")) problems.push(`late recipe has no POST_BAKE requirement: ${recipe.id}`);
    for (const req of recipe.requiredIngredients) {
      if (!baseIngredients.has(req.ingredientId) && !lateIngredientIdSet.has(req.ingredientId)) problems.push(`late recipe ${recipe.id} requires an unknown ingredient: ${req.ingredientId}`);
    }
    if (recipe.lunchRush !== false) problems.push(`late recipe must be lunchRush:false (Lunch Rush and Dinner exclude FINISH): ${recipe.id}`);
  }

  const lateIngredientIds = new Set<string>();
  for (const ingredient of late.ingredients) {
    if (baseIngredients.has(ingredient.id) || lateIngredientIds.has(ingredient.id)) problems.push(`ingredient id is not unique: ${ingredient.id}`);
    lateIngredientIds.add(ingredient.id);
    // A late ingredient with no unlockCondition would become a Starter and be owned from the start.
    if (!ingredient.unlockCondition) problems.push(`late ingredient needs an unlockCondition (ladder-gated, never a Starter): ${ingredient.id}`);
  }

  const keyed = new Set<string>();
  const stepped = new Set<string>();
  for (const step of late.ladderSteps) {
    if (!lateRecipeIds.has(step.keyRecipeId)) problems.push(`late ladder step key recipe is not a late recipe: ${step.keyRecipeId}`);
    if (keyed.has(step.keyRecipeId)) problems.push(`two late ladder steps share a key recipe: ${step.keyRecipeId}`);
    keyed.add(step.keyRecipeId);
    for (const id of step.ingredientIds) stepped.add(id);
    for (const id of step.ingredientIds) {
      if (!baseIngredients.has(id) && !lateIngredientIds.has(id)) problems.push(`late ladder step names an unknown ingredient: ${id}`);
    }
  }

  // Every late recipe must be reachable (it is the key of a step) and every late ingredient obtainable (named by a step).
  for (const id of lateRecipeIds) {
    if (!keyed.has(id)) problems.push(`late recipe is the key of no late ladder step (unreachable): ${id}`);
  }
  for (const id of lateIngredientIds) {
    if (!stepped.has(id)) problems.push(`late ingredient is named by no late ladder step (unobtainable): ${id}`);
  }
  const takenTargetIds = new Set(base.discoveryTargetIds ?? []);
  for (const id of lateRecipeIds) {
    const targetId = late.discoveryTargetIds[id];
    if (!targetId) problems.push(`late recipe has no discovery target id: ${id}`);
    else if (takenTargetIds.has(targetId)) problems.push(`discovery target id is not unique: ${targetId}`);
    else takenTargetIds.add(targetId);
  }
  for (const id of Object.keys(late.discoveryTargetIds)) {
    if (!lateRecipeIds.has(id)) problems.push(`discovery target id for an unknown late recipe: ${id}`);
  }
  return problems;
}

/** Throws when an ENABLED late catalog breaks a rule; a no-op when disabled (the late arrays are not read at all). */
export function assertLateCatalogValid(
  enabled: boolean,
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[]; discoveryTargetIds?: readonly string[] },
  late: LateCatalogInput,
): void {
  if (!enabled) return;
  const problems = validateLateCatalog(base, late);
  if (problems.length > 0) throw new Error(`Invalid late catalog:\n- ${problems.join("\n- ")}`);
}
