/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import { pinsaEnabled } from "../../../data/pinsaGate";
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** New Sauces Phase B-1 (#578; 62 -> 63 recipes; doubanjiang + green-onion are the two materials of ONE ordinary step, green-onion the last = sichuan-eggplant-pizza's Research cohort key; the second new sauce): the manifest the validator
 *  checks. A single-member cohort, so no existing recipe changes its Research letter (no `acceptedLetterShifts`). New Sauces Phase A (flammkuchen, #634), Batch 8b (shirasu-pizza, #580), 8a (the three zero-material recipes, #557), 7a and
 *  Batches 1-6 (landed) are covered by the catalog-wide tests. The original PIZZA DB page was not confirmed (green onion before the bake, doubanjiang painted, eggplant not pre-cooked are provisional assumptions, OD-B9-17). */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-b1",
  status: "landed",
  afterRecipeId: "flammkuchen",
  recipes: [
    { recipeId: "sichuan-eggplant-pizza", keyIngredientId: "green-onion", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  // Square Dough E-2 (#521): grandma-pizza adds no material and no ladder step, so it is not a batch recipe; it is pinned as the tail here.
  followedBy: ["grandma-pizza"],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];

/**
 * Pinsa Romana (#577 P3-b-3, Owner Q7): the manifest the validator checks in a build where the Pinsa gate (src/data/pinsaGate.ts) is OPEN. Deliberately NOT in
 * `RECIPE_BATCHES`: in the shipped (gate closed) build the recipe does not exist, so `RECIPE_BATCHES` is evaluated unchanged. Pinsa adds no material and no ladder step
 * (`ladderCredit: false`), so `keyIngredientId` is only the cohort key it shares (arugula). The single named exception is jamon's Research letter: arugula's
 * cohort becomes {pinsa-romana, jamon-serrano-pizza}, so jamon gains "B" (`-->B`); any other shift stays a failure. Evaluated by `lateCatalog.pinsa.test.ts`.
 */
export const PINSA_ROMANA_BATCH: RecipeBatchManifest = {
  batchId: "pinsa-romana",
  status: "landed",
  afterRecipeId: "eggplant-tahini-pizza", // (New Sauces Phase B U1 / U2 / U3: yuzu-shrimp-pizza, eggplant-dengaku-pizza and eggplant-tahini-pizza are appended after ikura, before Pinsa, so Pinsa stays the last late recipe)
  recipes: [{ recipeId: "pinsa-romana", keyIngredientId: "arugula", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" }],
  acceptedLetterShifts: { "jamon-serrano-pizza": "-->B" },
};

/**
 * New Sauces Phase B U1 (#578, late catalog): the manifest of `yuzu-shrimp-pizza`, evaluated by `lateCatalog.yuzu.test.ts` over the full catalog (the late recipes included). Deliberately NOT in
 * `RECIPE_BATCHES`: that list is evaluated over the ordinary catalog. The recipe is credited, so its own late ladder step (after the roe step) unlocks `yuzu-kosho`, its cohort key; a single-member
 * cohort, so no existing recipe changes its Research letter. It is followed by Pinsa only while the Pinsa gate is open. The original PIZZA DB page was not confirmed on the yuzu-kosho PAINT before the
 * bake, the shrimp before the bake or its (absent) pre-cooking: provisional game-design assumptions (Owner 2026-10-25).
 */
export const YUZU_SHRIMP_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-u1-yuzu-shrimp",
  status: "landed",
  afterRecipeId: "ikura-salmon-pizza",
  recipes: [{ recipeId: "yuzu-shrimp-pizza", keyIngredientId: "yuzu-kosho", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: ["eggplant-dengaku-pizza", "eggplant-tahini-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (New Sauces Phase B U2 / U3: eggplant-dengaku-pizza and eggplant-tahini-pizza are appended after yuzu-shrimp-pizza)
};

/**
 * New Sauces Phase B U2 (#578, late catalog): the manifest of `eggplant-dengaku-pizza`, evaluated by `lateCatalog.dengaku.test.ts` over the full catalog (the late recipes included). Like the yuzu batch it is deliberately NOT in
 * `RECIPE_BATCHES`. The recipe is credited, so its own late ladder step (after the yuzu step) unlocks `miso-sauce` and `white-sesame`; its Research cohort key is `white-sesame` (the last material of the step), a single-member
 * cohort, so no existing recipe changes its Research letter. It is followed by Pinsa only while the Pinsa gate is open. The original PIZZA DB page was not read: the miso-sauce PAINT before the bake, the eggplant before the bake
 * (no pre-cooking) and the white sesame AFTER the bake are GAMEPLAY ASSUMPTIONS (Owner 2026-10-25).
 */
export const EGGPLANT_DENGAKU_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-u2-eggplant-dengaku",
  status: "landed",
  afterRecipeId: "yuzu-shrimp-pizza",
  recipes: [{ recipeId: "eggplant-dengaku-pizza", keyIngredientId: "white-sesame", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: ["eggplant-tahini-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (New Sauces Phase B U3: eggplant-tahini-pizza is appended after eggplant-dengaku-pizza)
};

/**
 * New Sauces Phase B U3 (#578, late catalog): the manifest of `eggplant-tahini-pizza`, evaluated by `lateCatalog.tahini.test.ts` over the full catalog (the late recipes included). Like the yuzu / dengaku batches it is
 * deliberately NOT in `RECIPE_BATCHES`. The recipe is credited, so its own late ladder step (after the dengaku step) unlocks `tahini` and `pomegranate`; its Research cohort key is `pomegranate` (the last material of the step),
 * a single-member cohort, so no existing recipe changes its Research letter. It is followed by Pinsa only while the Pinsa gate is open. The original PIZZA DB page was not confirmed: the tahini PAINT before the bake,
 * the eggplant before the bake (no pre-cooking), the parsley before the bake and the pomegranate AFTER the bake are GAMEPLAY ASSUMPTIONS (Owner 2026-10-26).
 */
export const EGGPLANT_TAHINI_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-u3-eggplant-tahini",
  status: "landed",
  afterRecipeId: "eggplant-dengaku-pizza",
  recipes: [{ recipeId: "eggplant-tahini-pizza", keyIngredientId: "pomegranate", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: pinsaEnabled() ? ["pinsa-romana"] : [],
};
