/**
 * Recipe Cooking Steps 1.0 Phase 1A (see docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §7/§8):
 * the per-recipe-optional "how is this dish made" profile, keyed by `recipeId`, modeled on the
 * exact `REFERENCE_PIZZAS` Map pattern already proven correct for this shape in this codebase
 * (../data/referencePizza.ts's `getReferencePizza` -- absent entry, absent = a defined default,
 * never a special-cased branch at every call site).
 *
 * Zero behavior change is the whole point of this file for Phase 1A: `COOKING_PROFILES` below is
 * an empty Map -- every one of the 15 shipped recipes resolves to `DEFAULT_COOKING_PROFILE`,
 * which is byte-identical to today's fixed DOUGH -> SAUCE -> CHEESE -> TOPPING flow (previously
 * `gameReducer.ts`'s own module-level `MAKING_STEP_ORDER`). Activating a non-default profile on
 * any real recipe is explicitly out of scope for this phase (see that design doc's Phase 1A
 * acceptance criteria, §18) -- this file only makes a recipe-specific sequence *representable*.
 */
import type { RecipeId } from "./recipes";
import type { MakingStep } from "../state/gameReducer";

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
}

/** Exactly today's fixed flow (`gameReducer.ts`'s pre-Phase-1A `MAKING_STEP_ORDER`) -- the
 *  profile every recipe without a `COOKING_PROFILES` entry resolves to. */
export const DEFAULT_COOKING_PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
};

/**
 * No recipe has an entry yet (Phase 1A ships the foundation only -- see this file's own header).
 * A future step-implementation phase (CUT first, per the design doc's roadmap §21) adds real
 * entries here, one recipe at a time, each independently regression-tested against every recipe
 * that still resolves to `DEFAULT_COOKING_PROFILE`.
 */
const COOKING_PROFILES: ReadonlyMap<RecipeId, CookingProfile> = new Map();

/** Absent map entry -> `DEFAULT_COOKING_PROFILE`, mirroring `getReferencePizza`'s own
 *  absent-entry contract (../data/referencePizza.ts). */
export function getCookingProfile(recipeId: RecipeId): CookingProfile {
  return COOKING_PROFILES.get(recipeId) ?? DEFAULT_COOKING_PROFILE;
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
