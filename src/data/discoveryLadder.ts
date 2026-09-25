/**
 * Progression 2.0 W1 Integration I4a: Discovery Ladder authority data (REC-04 = RESOLVED,
 * Owner Decision OD-REC04-1, commit 6fe02e2d23610e926bab2367405fe9f717d25421 --
 * `docs/reports/TETO_PROGRESS2_REC-04_FRESH-DESIGN.md` on branch
 * `claude/rec-04-fresh-design-gz6em4`).
 *
 * OD-REC04-1 (CONFIRMED_OWNER_DECISION):
 * - Every new pizza discovery advances the player one **ordered progression step**: step `s` is
 *   reached once the Dex discovered count is `>= s`.
 * - Stars (⭐) are never a material unlock condition.
 * - The authority is the ordered step list, not "1 discovery = any one material". Each step has a
 *   `kind`, so later waves can add non-material steps; in W1 every step is `MATERIAL`.
 *
 * The concrete order below is DERIVED_FROM_CONFIRMED_RULES: REC-04's key-recipe rule
 * (`key_recipe_ladder` in `tools/progression2_rec04_fresh_design.py`) applied to the **current
 * shipped 15-recipe population** (`RECIPES` in ./recipes.ts). Each step unlocks the smallest
 * ingredient set that completes at least one not-yet-makeable recipe (its key recipe); ties go to
 * most recipes newly makeable, then most reuse by still-unmakeable recipes, then recipe id.
 * `discoveryLadder.test.ts` re-derives this list from `RECIPES` with the same rule and pins it, so
 * it can never silently drift from the recipe data. When content grows (W1: 25 recipes), a new
 * ladder is regenerated for that population -- the logic in ../logic/discoveryLadder.ts is
 * population-agnostic, and entitlements already granted never re-lock (see
 * `resolveMaterialUnlocks`).
 *
 * The onboarding starters (tomato-sauce / mozzarella / basil) are not ladder steps: they keep the
 * existing onboarding starter authority (REC-04 `onboardingStarters`, CONFIRMED).
 *
 * **Not wired yet.** Nothing in the runtime imports this module; App/GameState/Shop/save wiring,
 * pack prices and first-stock handling are I4b.
 */

/** What a progression step unlocks. W1 only ever uses `MATERIAL`; later waves may extend this
 *  union (e.g. a capability or content step) without changing the ladder rule itself. */
export type ProgressionStepKind = "MATERIAL";

export interface MaterialProgressionStep {
  /** 1-based ordered step number. Reached when the Dex discovered count is `>= step`. */
  step: number;
  kind: "MATERIAL";
  /** Ingredients this step makes available for purchase in the Shop, in authored order. Usually
   *  one; several when the key recipe needs more than one new ingredient at once. */
  ingredientIds: readonly string[];
  /** The recipe this step completes (the reason the step exists -- no step is a useless unlock). */
  keyRecipeId: string;
}

/** Discriminated on `kind`; a single member while W1 only has material steps. */
export type ProgressionStep = MaterialProgressionStep;

export interface DiscoveryLadder {
  /** Which recipe population this ladder was generated for. A ladder is regenerated per content
   *  wave, so this names the wave, not a version of the rule. */
  populationId: string;
  steps: readonly ProgressionStep[];
}

/** DERIVED_FROM_CONFIRMED_RULES for the shipped 15-recipe population (14 steps; margherita is the
 *  onboarding recipe and needs only the starters). */
export const SHIPPED_15_DISCOVERY_LADDER: DiscoveryLadder = {
  populationId: "shipped-15",
  steps: [
    { step: 1, kind: "MATERIAL", ingredientIds: ["egg"], keyRecipeId: "bismarck" },
    { step: 2, kind: "MATERIAL", ingredientIds: ["bacon"], keyRecipeId: "breakfast-pizza" },
    { step: 3, kind: "MATERIAL", ingredientIds: ["mushroom"], keyRecipeId: "funghi" },
    { step: 4, kind: "MATERIAL", ingredientIds: ["pepperoni"], keyRecipeId: "pepperoni" },
    { step: 5, kind: "MATERIAL", ingredientIds: ["sausage"], keyRecipeId: "salsiccia" },
    { step: 6, kind: "MATERIAL", ingredientIds: ["ham"], keyRecipeId: "meat-lovers" },
    { step: 7, kind: "MATERIAL", ingredientIds: ["black-olive", "oregano"], keyRecipeId: "capricciosa" },
    { step: 8, kind: "MATERIAL", ingredientIds: ["garlic"], keyRecipeId: "marinara" },
    { step: 9, kind: "MATERIAL", ingredientIds: ["anchovy"], keyRecipeId: "napoletana" },
    { step: 10, kind: "MATERIAL", ingredientIds: ["olive-oil", "onion"], keyRecipeId: "fugazza" },
    { step: 11, kind: "MATERIAL", ingredientIds: ["rosemary"], keyRecipeId: "pizza-bianca" },
    { step: 12, kind: "MATERIAL", ingredientIds: ["tuna"], keyRecipeId: "tonno-e-cipolla" },
    { step: 13, kind: "MATERIAL", ingredientIds: ["cherry-tomato", "pesto"], keyRecipeId: "genovese" },
    {
      step: 14,
      kind: "MATERIAL",
      ingredientIds: ["fontina", "gorgonzola", "parmigiano"],
      keyRecipeId: "quattro-formaggi",
    },
  ],
};

/** The ladder for the content currently shipped. I4b reads this; a later wave swaps it for that
 *  wave's regenerated ladder. */
export const DISCOVERY_LADDER: DiscoveryLadder = SHIPPED_15_DISCOVERY_LADDER;
