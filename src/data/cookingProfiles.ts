/**
 * Recipe Cooking Steps 1.0 Phase 1A (see docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §7/§8):
 * the per-recipe-optional "how is this dish made" profile, keyed by `recipeId`, modeled on the
 * exact `REFERENCE_PIZZAS` Map pattern already proven correct for this shape in this codebase
 * (../data/referencePizza.ts's `getReferencePizza` -- absent entry, absent = a defined default,
 * never a special-cased branch at every call site).
 *
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F): `getCookingProfile` below now
 * derives each real recipe's PREPARE-phase `steps` from which ingredient categories its
 * `requiredIngredients` actually touch (`deriveCoreSteps`) instead of every recipe resolving to
 * the same literal `DEFAULT_COOKING_PROFILE`. `DEFAULT_COOKING_PROFILE` itself is unchanged and
 * still used verbatim as the fallback for a `recipeId` with no `RECIPES` entry at all (a synthetic/
 * future id) -- there is nothing to derive from in that case.
 */
import { getRecipe, type Recipe, type RecipeId } from "./recipes";
import { getIngredient, type IngredientCategory } from "./ingredients";
import type { MakingStep } from "../state/gameReducer";
import type { CutConfig } from "../logic/cut/types";

/**
 * A recipe's ordered cooking-step sequence. Deliberately minimal for Phase 1A -- just the
 * ordered `MakingStep` list, no step-specific modifier config (`doughConfig`/`cutConfig`/...) --
 * those are real gameplay data for the step that consumes them and stay out until that step's
 * own implementation phase actually reads them (matches the design doc §10/§11's own "additive,
 * empty until built" discipline, applied here to the data shape itself rather than to
 * scoring/completion).
 */
export interface CookingProfile {
  /** Explicit, ordered. Which of these sit before vs. after BAKE is not encoded here -- it is a
   *  fixed property of the step itself (`POST_BAKE_STEPS` below), not a per-recipe choice, so a
   *  profile can never accidentally place e.g. TOPPING after BAKE. */
  steps: readonly MakingStep[];
  /** Recipe Cooking Steps 1.0 Phase 1A-T (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §22.5):
   *  reserved extension point for a future, explicitly opt-in Challenge Mode's per-step hard
   *  time limit. Absent for every profile today (including every one built through Phase
   *  1A-T/1B/2A/3A/3B) -- FREE and Lunch Rush both stay governed exactly as
   *  §22.3/§22.4/§22.12 describe, with no per-step timeout of any kind. Present in the type but
   *  read by nothing this phase (§22.13 acceptance criterion 6) -- not implemented, not
   *  scheduled, in this slice. */
  stepTimeLimits?: Partial<Record<MakingStep, { maxMs: number }>>;
  /** Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md §1.2): only meaningful
   *  when `"CUT"` is present in `steps` -- absent then means "6 slices" (../logic/cut/types.ts's
   *  own `resolveRequestedSliceCount` default), never "CUT with an undefined slice count".
   *  Absent entirely for a profile that never lists `"CUT"` at all. */
  cutConfig?: CutConfig;
}

/** Exactly today's fixed flow (`gameReducer.ts`'s pre-Phase-1A `MAKING_STEP_ORDER`) -- the
 *  profile every recipe without a `COOKING_PROFILES` entry resolves to. */
export const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
};

/**
 * Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion, see
 * docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md §4 Option C): an explicit,
 * opt-in CUT-eligibility allowlist. CUT eligibility is a *gameplay-shape* decision (a standard
 * round, single-piece, single-bake pizza compatible with the existing Pizza Cutting 1.0
 * ideal-circle geometry, ../logic/cut/geometry.ts's own `DOUGH_CENTER`/`DOUGH_RADIUS`
 * assumption), never inferred from a recipe's id/name. A recipe added to `RECIPES` (../data/
 * recipes.ts) with no entry here -- the normal way every recipe has been added so far -- never
 * inherits CUT; someone must deliberately add its id below after confirming its shape actually
 * fits. This is the same safety property Phase 2's single-entry `COOKING_PROFILES` Map already
 * had (opt-in, never a `DEFAULT_COOKING_PROFILE` default), extended to every recipe that is
 * *actually eligible* rather than hand-authoring one repeated 4-line entry per recipe.
 *
 * Fresh Audit result (Phase 4B): all 15 recipes shipped as of this phase are standard round,
 * single-piece, single-bake pizzas sharing the identical circular-dough contract every DOUGH/
 * SAUCE/TOPPING gesture already uses (confirmed against ../data/recipes.ts and
 * ../data/referencePizza.ts) -- none uses `FOLD`/`SEAL`/`EDGE_FILL` (reserved `MakingStep`
 * members with zero recipe/reducer wiring today). So all 15 are listed here. A future non-round
 * recipe (calzone, fugazzeta, mezza-e-mezza, siciliana, square pizza) must NOT be added until a
 * human deliberately re-confirms its shape fits this engine's ideal-circle scoring.
 */
const CUT_ELIGIBLE_RECIPE_IDS: ReadonlySet<RecipeId> = new Set<RecipeId>([
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
]);

/** Every CUT-eligible recipe uses this shared config unless overridden below -- Phase 4B's Fresh
 *  Audit found no existing authoritative rule for a non-6 slice count on any shipped recipe, so
 *  inventing per-recipe variety here would not be grounded in anything real. */
const STANDARD_CUT_CONFIG: CutConfig = { requestedSliceCount: 6 };

function withCut(steps: readonly MakingStep[], cutConfig: CutConfig): CookingProfile {
  return { steps: [...steps, "CUT"], cutConfig };
}

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F): the one authoritative place
 * that decides which PREPARE-phase core steps a recipe actually needs. DOUGH is always present
 * (every recipe shapes its own dough -- current production contract, unchanged). SAUCE/CHEESE/
 * TOPPING are each included only if `recipe.requiredIngredients` names at least one ingredient of
 * that category (`../data/ingredients.ts`'s own `Ingredient.category`, never inferred from a
 * recipe's id/display name) -- so a step with nothing to place, and nothing for the Completion
 * Gate to ever check, does not get a tab or a forced "次へ" tap. Order is fixed
 * (DOUGH -> SAUCE -> CHEESE -> TOPPING), matching `DEFAULT_COOKING_PROFILE`'s own order minus
 * whichever categories this recipe doesn't need -- deliberately data-driven for all three
 * (including SAUCE, which happens to be required by all 15 shipped recipes today but is not
 * hardcoded as always-present, so a hypothetical future no-sauce recipe would correctly skip it
 * too instead of silently inheriting `DEFAULT_COOKING_PROFILE` semantics).
 */
function deriveCoreSteps(recipe: Recipe): readonly MakingStep[] {
  const categories = new Set<IngredientCategory>();
  for (const requirement of recipe.requiredIngredients) {
    const ingredient = getIngredient(requirement.ingredientId);
    if (ingredient) categories.add(ingredient.category);
  }
  const steps: MakingStep[] = ["DOUGH"];
  if (categories.has("sauce")) steps.push("SAUCE");
  if (categories.has("cheese")) steps.push("CHEESE");
  if (categories.has("topping")) steps.push("TOPPING");
  return steps;
}

/** Reserved per-recipe override point, checked before the allowlist derivation below -- for a
 *  future CUT-eligible recipe that needs something other than `STANDARD_CUT_CONFIG` (e.g. a
 *  large-format recipe wanting 8 slices), without hand-duplicating its whole `steps` array the
 *  way a flat per-recipe Map would require. Empty today: no shipped recipe needs a non-standard
 *  `CutConfig`. */
const COOKING_PROFILE_OVERRIDES: ReadonlyMap<RecipeId, CookingProfile> = new Map([]);

/** Test-only re-export of `COOKING_PROFILE_OVERRIDES` (../data/cookingProfiles.test.ts) -- lets
 *  the override mechanism itself be asserted on without exposing the real map as a general
 *  production import. */
export const COOKING_PROFILE_OVERRIDES_TEST_ONLY = COOKING_PROFILE_OVERRIDES;

/** Absent map/allowlist entry -> `DEFAULT_COOKING_PROFILE`, mirroring `getReferencePizza`'s own
 *  absent-entry contract (../data/referencePizza.ts). `DEFAULT_COOKING_PROFILE` itself is never
 *  mutated to add CUT -- see the module doc-comment above `CUT_ELIGIBLE_RECIPE_IDS`.
 *
 * PR-A: `steps` for a real (`RECIPES`-listed) recipe are now `deriveCoreSteps(recipe)` -- the
 * recipe's own required-ingredient-category-derived sequence -- instead of always the literal
 * `DEFAULT_COOKING_PROFILE.steps`. A `recipeId` absent from `RECIPES` entirely (a synthetic/future
 * id, exactly this function's pre-existing absent-entry case) still resolves to the literal
 * `DEFAULT_COOKING_PROFILE` object, unchanged -- there is no `requiredIngredients` to derive from,
 * and this preserves every existing "unknown id -> DEFAULT_COOKING_PROFILE" reference-identity
 * test. CUT eligibility itself is completely unaffected by this -- `CUT_ELIGIBLE_RECIPE_IDS` is
 * still the sole authority for whether `withCut(...)` runs at all (Phase 4B's own allowlist,
 * untouched), only what it appends CUT *onto* is now recipe-specific. */
export function getCookingProfile(recipeId: RecipeId): CookingProfile {
  const override = COOKING_PROFILE_OVERRIDES.get(recipeId);
  if (override) return override;
  const recipe = getRecipe(recipeId);
  const steps = recipe ? deriveCoreSteps(recipe) : DEFAULT_COOKING_PROFILE.steps;
  if (CUT_ELIGIBLE_RECIPE_IDS.has(recipeId)) {
    return withCut(steps, STANDARD_CUT_CONFIG);
  }
  return recipe ? { steps } : DEFAULT_COOKING_PROFILE;
}

/** Exported for exhaustive test coverage only (../data/cookingProfiles.test.ts) -- production
 *  code should call `getCookingProfile`, never read this set directly. */
export function isCutEligible(recipeId: RecipeId): boolean {
  return CUT_ELIGIBLE_RECIPE_IDS.has(recipeId);
}

/**
 * Which `MakingStep` values sit in `POST_BAKE` rather than `PREPARE` -- a fixed property of the
 * step itself (design doc §3.2's "where it sits" column), never a per-recipe decision. CUT/FINISH
 * are the only two steps the design doc places after BAKE; every other widened `MakingStep` value
 * (FOLD/SEAL/EDGE_FILL) sits in PREPARE, ahead of BAKE, alongside DOUGH/SAUCE/CHEESE/TOPPING.
 */
const POST_BAKE_STEPS: ReadonlySet<MakingStep> = new Set(["CUT", "FINISH"]);

export function isPostBakeStep(step: MakingStep): boolean {
  return POST_BAKE_STEPS.has(step);
}

/** The ordered subsequence of `profile.steps` that runs during PREPARE (before BAKE). For every
 *  recipe on `DEFAULT_COOKING_PROFILE`, this is the profile's `steps` unchanged. */
export function preBakeSteps(profile: CookingProfile): readonly MakingStep[] {
  return profile.steps.filter((step) => !isPostBakeStep(step));
}

/** The ordered subsequence of `profile.steps` that runs during POST_BAKE (after BAKE, before
 *  RESULT). Empty for every recipe on `DEFAULT_COOKING_PROFILE` -- an empty result is exactly
 *  what tells `gameReducer.ts`'s `CONFIRM_BAKE` to skip POST_BAKE straight to RESULT (design doc
 *  §8: "POST_BAKE is skipped entirely ... whenever a recipe's profile declares no post-BAKE
 *  steps"). */
export function postBakeSteps(profile: CookingProfile): readonly MakingStep[] {
  return profile.steps.filter((step) => isPostBakeStep(step));
}
