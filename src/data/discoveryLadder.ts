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
 * Wiring: the Shop entitlement (../state/materialEntitlement.ts), the material Shop
 * (../logic/materialShop.ts) and the reducer read `DISCOVERY_LADDER` below (I4b); the 25-recipe
 * W1 ladder became `DISCOVERY_LADDER` in I5b-3.
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

/**
 * Progression 2.0 W1 I5b-1 (docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §3): the same REC-04
 * key-recipe rule applied to the W1 population -- the shipped 15 recipes plus the 10 W1 recipes
 * (25 recipes, 24 steps; margherita still needs only the starters). Equal to the ladder REC-04
 * simulated (`REC04_W1_25_LADDER_FIXTURE` in the ladder test-support module; pinned equal by
 * ../logic/w1LadderEconomy.test.ts).
 *
 * Wired as `DISCOVERY_LADDER` since I5b-3, in the same change that added the 10 W1 recipes to
 * `RECIPES` (switching earlier would have unlocked materials no shipped recipe used).
 */
export const W1_25_DISCOVERY_LADDER: DiscoveryLadder = {
  populationId: "w1-25",
  steps: [
    { step: 1, kind: "MATERIAL", ingredientIds: ["egg"], keyRecipeId: "bismarck" },
    { step: 2, kind: "MATERIAL", ingredientIds: ["bacon"], keyRecipeId: "breakfast-pizza" },
    { step: 3, kind: "MATERIAL", ingredientIds: ["mushroom"], keyRecipeId: "funghi" },
    { step: 4, kind: "MATERIAL", ingredientIds: ["eggplant"], keyRecipeId: "melanzane-pizza" },
    { step: 5, kind: "MATERIAL", ingredientIds: ["parmigiano"], keyRecipeId: "parmigiana-pizza" },
    { step: 6, kind: "MATERIAL", ingredientIds: ["pepperoni"], keyRecipeId: "pepperoni" },
    { step: 7, kind: "MATERIAL", ingredientIds: ["sausage"], keyRecipeId: "salsiccia" },
    { step: 8, kind: "MATERIAL", ingredientIds: ["ham"], keyRecipeId: "meat-lovers" },
    { step: 9, kind: "MATERIAL", ingredientIds: ["corn"], keyRecipeId: "bambino" },
    { step: 10, kind: "MATERIAL", ingredientIds: ["pineapple"], keyRecipeId: "hawaiian" },
    { step: 11, kind: "MATERIAL", ingredientIds: ["black-olive", "oregano"], keyRecipeId: "capricciosa" },
    { step: 12, kind: "MATERIAL", ingredientIds: ["onion"], keyRecipeId: "pizza-portuguesa" },
    { step: 13, kind: "MATERIAL", ingredientIds: ["olive-oil"], keyRecipeId: "fugazza" },
    { step: 14, kind: "MATERIAL", ingredientIds: ["garlic"], keyRecipeId: "marinara" },
    { step: 15, kind: "MATERIAL", ingredientIds: ["anchovy"], keyRecipeId: "napoletana" },
    { step: 16, kind: "MATERIAL", ingredientIds: ["tuna"], keyRecipeId: "tonno-e-cipolla" },
    { step: 17, kind: "MATERIAL", ingredientIds: ["pesto"], keyRecipeId: "pesto-tonno" },
    { step: 18, kind: "MATERIAL", ingredientIds: ["cherry-tomato"], keyRecipeId: "genovese" },
    { step: 19, kind: "MATERIAL", ingredientIds: ["clam"], keyRecipeId: "new-haven-apizza" },
    { step: 20, kind: "MATERIAL", ingredientIds: ["fresh-tomato"], keyRecipeId: "pesto-caprese" },
    { step: 21, kind: "MATERIAL", ingredientIds: ["potato"], keyRecipeId: "pesto-patate" },
    { step: 22, kind: "MATERIAL", ingredientIds: ["rosemary"], keyRecipeId: "pizza-bianca" },
    { step: 23, kind: "MATERIAL", ingredientIds: ["capers"], keyRecipeId: "puttanesca-pizza" },
    { step: 24, kind: "MATERIAL", ingredientIds: ["fontina", "gorgonzola"], keyRecipeId: "quattro-formaggi" },
  ],
};

/** The ladder for the content currently shipped. I4b read `SHIPPED_15_DISCOVERY_LADDER`; since
 *  Progression 2.0 W1 I5b-3 (the 10 W1 recipes joined `RECIPES` in the same change) it is the
 *  25-recipe `W1_25_DISCOVERY_LADDER`. Entitlements already granted by the 15-recipe ladder are
 *  kept: the Shop ledger is a union and never re-locks (../state/materialEntitlement.ts). */
export const DISCOVERY_LADDER: DiscoveryLadder = W1_25_DISCOVERY_LADDER;
