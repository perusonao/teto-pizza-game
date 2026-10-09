import { appendLadderSteps, type AppendedLadderStep } from "../logic/discoveryLadder";

/**
 * Progression 2.0 W1 Integration I4a: Discovery Ladder authority data (REC-04 = RESOLVED,
 * Owner Decision OD-REC04-1, commit 6fe02e2d23610e926bab2367405fe9f717d25421 --
 * `docs/reports/TETO_PROGRESS2_REC-04_FRESH-DESIGN.md` on branch
 * `claude/rec-04-fresh-design-gz6em4`).
 *
 * OD-REC04-1 (CONFIRMED_OWNER_DECISION):
 * - Every new pizza discovery advances the player one **ordered progression step**: step `s` is
 *   reached once the Dex discovered count is `>= s`.
 * - Stars (⭐) are never a material unlock condition -- EXCEPT the two materials Issue #420 OD-420-1 gates by
 *   cumulative stars (Batch 6): goat-cheese (step 50, 120 stars) and spinach (step 51, 130 stars), via a step's
 *   `starGates`. That exception is limited to those two ingredients and supersedes the earlier 140-star
 *   Phase-3/4 sketch (`docs/design/TETO_PROGRESSION2_PHASE34_UNLOCKS.md`).
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
  /**
   * Batch 6 / #420 (OD-420-1): per-ingredient accumulated-star gate. An ingredient listed here is
   * unlocked only when this step is reached AND `totalStars(dex)` (the sum of Dex BEST stars) is
   * `>= starGates[id]`; ingredients not listed unlock on the step alone, exactly as before. Stars
   * are a non-consumed cumulative achievement (never spent), and a granted unlock never re-locks
   * (see `resolveMaterialUnlocks`). Keys must be members of `ingredientIds`. An exception to
   * OD-REC04-1's "stars are never a material unlock condition", limited to the ingredients an
   * Owner Decision gates this way.
   */
  starGates?: Readonly<Record<string, number>>;
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

/**
 * LAD-1 (Issue #261, Owner Decision OD-W2-1): the W1 steps 1..24 are frozen. New recipes or
 * ingredients never regenerate or reorder them; later unlocks are appended after step 24
 * (`POST_W1_APPENDED_STEPS`). `discoveryLadder.appendOnly.test.ts` pins both halves: the first
 * `W1_FIXED_STEP_COUNT` steps equal `W1_25_DISCOVERY_LADDER`, and the appended steps equal the
 * REC-04 key-recipe rule run in append-only mode over `RECIPES` (`buildAppendOnlyLadder`).
 */
export const W1_FIXED_STEP_COUNT = 24;

/** Steps appended after the frozen W1 ladder, in order. Step 25 (Discovery 3.0 No.27) unlocks
 *  `chicken` (key recipe `pesto-pollo`), step 26 `shrimp` (`pesto-gamberi`); it equals what `buildAppendOnlyLadder` derives
 *  from `RECIPES` (pinned by discoveryLadder.appendOnly.test.ts). */
export const POST_W1_APPENDED_STEPS: readonly AppendedLadderStep[] = [
  { ingredientIds: ["chicken"], keyRecipeId: "pesto-pollo" },
  // Step 26 (Expansion Slice 1): `shrimp`, key recipe `pesto-gamberi` (tier T3). Steps 1-25 frozen.
  { ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" },
  // Step 27 (Expansion Wave 2): `parsley`, key recipe `vongole` (T3).
  { ingredientIds: ["parsley"], keyRecipeId: "vongole" },
  // Step 28 (Expansion Wave 2): `bell-pepper` + `zucchini`, key recipe `pesto-vegetariana` (T3).
  // `ratatouille-pizza` becomes makeable here too (intended Branching Discovery; credited).
  { ingredientIds: ["bell-pepper", "zucchini"], keyRecipeId: "pesto-vegetariana" },
  // Step 29 (Expansion Slice 3): `almond`, key recipe `pesto-trapanese` (T3). Steps 1-28 frozen.
  { ingredientIds: ["almond"], keyRecipeId: "pesto-trapanese" },
  // Steps 30-32 (Expansion Batch 1, T4): one material per recipe. Steps 1-29 frozen.
  { ingredientIds: ["pine-nuts"], keyRecipeId: "baba-ganoush-pizza" },
  { ingredientIds: ["prosciutto-crudo"], keyRecipeId: "prosciutto-funghi" },
  { ingredientIds: ["green-pepper"], keyRecipeId: "veggie-supreme-pizza" },
  // Steps 33-37 (Expansion Batch 2, T4): one step per recipe. Steps 1-32 frozen.
  { ingredientIds: ["arugula"], keyRecipeId: "jamon-serrano-pizza" },
  { ingredientIds: ["salami"], keyRecipeId: "calabresa-argentina" },
  { ingredientIds: ["grana-padano"], keyRecipeId: "rucola-e-grana" },
  { ingredientIds: ["cashew-cheese"], keyRecipeId: "vegan-cashew-cheese-pizza" },
  { ingredientIds: ["cream-cheese", "lemon", "salmon"], keyRecipeId: "pesto-salmone" },
  // Steps 38-43 (Expansion Batch 3, T4): one step per recipe. Steps 1-37 frozen.
  { ingredientIds: ["salt-cod"], keyRecipeId: "bacalhau" },
  { ingredientIds: ["baked-beans"], keyRecipeId: "full-english-pizza" },
  { ingredientIds: ["palm-heart"], keyRecipeId: "palmito-pizza" },
  { ingredientIds: ["sauerkraut"], keyRecipeId: "polish-kielbasa" },
  { ingredientIds: ["pork"], keyRecipeId: "porchetta-pizza" },
  { ingredientIds: ["friarielli"], keyRecipeId: "salsiccia-e-friarielli" },
  // Steps 44-47 (Expansion Batch 4, T4): one step per recipe. Steps 1-43 frozen.
  { ingredientIds: ["catupiry"], keyRecipeId: "brazilian-catupiry-corn-pizza" },
  { ingredientIds: ["jalapeno"], keyRecipeId: "jalapeno-popper-pizza" },
  { ingredientIds: ["feta"], keyRecipeId: "pizza-feta-eliniki" },
  { ingredientIds: ["sardine"], keyRecipeId: "pizza-moscow" },
  // Steps 48-49 (Expansion Batch 5, T4): one step per recipe. Steps 1-47 frozen.
  { ingredientIds: ["ricotta"], keyRecipeId: "pizza-bianca-ricotta" },
  { ingredientIds: ["hot-dog"], keyRecipeId: "pizza-overload" },
  // Steps 50-51 (Batch 6, T4; Issue #420 OD-420-1). Steps 1-49 frozen. The second material of each step is star-gated: it unlocks only when the step is reached AND the cumulative Dex BEST stars reach the gate
  // (never spent, never re-locked; an exception to OD-REC04-1 limited to these two materials, superseding the earlier 140-star Phase-3/4 sketch). The key recipe needs both materials.
  { ingredientIds: ["avocado", "goat-cheese"], starGates: { "goat-cheese": 120 }, keyRecipeId: "california-style-pizza" },
  { ingredientIds: ["artichoke", "spinach"], starGates: { spinach: 130 }, keyRecipeId: "spinach-artichoke-pizza" },
];

/** The ladder for the content currently shipped. I4b read `SHIPPED_15_DISCOVERY_LADDER`; since
 *  Progression 2.0 W1 I5b-3 (the 10 W1 recipes joined `RECIPES` in the same change) it is the
 *  25-recipe `W1_25_DISCOVERY_LADDER`. Entitlements already granted by the 15-recipe ladder are
 *  kept: the Shop ledger is a union and never re-locks (../state/materialEntitlement.ts). Since
 *  LAD-1 it is the frozen W1 ladder followed by `POST_W1_APPENDED_STEPS` -- with no appended step
 *  its content is exactly `W1_25_DISCOVERY_LADDER`. */
export const DISCOVERY_LADDER: DiscoveryLadder = appendLadderSteps(W1_25_DISCOVERY_LADDER, POST_W1_APPENDED_STEPS);
