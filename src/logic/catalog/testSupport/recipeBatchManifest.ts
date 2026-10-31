/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import { pinsaEnabled } from "../../../data/pinsaGate";
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 10 PR-1 (docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md; 69 -> 74 recipes in the Pinsa-ON ordinary view): five ordinary recipes, one ordinary ladder step each (57-61); the last material of each step is the recipe's Research cohort key
 *  (curry-ketchup / beef / paneer / wurstel / swiss-cheese). All five are single-member cohorts, so no existing recipe changes its Research letter (no `acceptedLetterShifts`). New Sauces Phase B-1 (sichuan-eggplant-pizza, #649) and earlier batches (landed)
 *  are covered by the catalog-wide tests. The original PIZZA DB pages were not confirmed; counts, bake window, colours and glyphs are provisional. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-10-pr1",
  status: "landed",
  afterRecipeId: "grandma-pizza",
  recipes: [
    { recipeId: "curry-pizza-japan", keyIngredientId: "curry-ketchup", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "rendang-pizza", keyIngredientId: "beef", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "tandoori-paneer-pizza", keyIngredientId: "paneer", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "currywurst", keyIngredientId: "wurstel", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "cuban-pizza", keyIngredientId: "swiss-cheese", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  followedBy: ["boscaiola", "porcini-pizza", "pescatore", "jamaican-jerk-chicken-pizza"], // (B11 S1 is appended after cuban-pizza, B12 after B11 S1)
};

/**
 * B11 S1 (PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): boscaiola (credited, the key of ordinary step 62), porcini-pizza (`ladderCredit: false`, NO_SAUCE, the same step: REC-04 ties break by recipe id so boscaiola stays the key) and
 * pescatore (credited, the key of ordinary step 63, tomato-sauce only: the Owner-approved omission of the matrix's olive-oil, option A). Cohort keys: porcini (a two-member cohort, so porcini-pizza and boscaiola gain letters; no PRE-EXISTING recipe changes its letter) and mussel (single).
 */
export const B11_S1_BATCH: RecipeBatchManifest = {
  batchId: "b11-s1",
  status: "landed",
  afterRecipeId: "cuban-pizza",
  recipes: [
    { recipeId: "boscaiola", keyIngredientId: "porcini", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "porcini-pizza", keyIngredientId: "porcini", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pescatore", keyIngredientId: "mussel", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  followedBy: ["jamaican-jerk-chicken-pizza"], // (B12 is appended after pescatore)
};

/**
 * B12 (Issue #706; PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION, Owner decision pending): jamaican-jerk-chicken-pizza (`ladderCredit: false`, NO_SAUCE, no new material, so no ladder step of its own). Its Research cohort key is
 * green-pepper (ordinary step 32), shared with the credited veggie-supreme-pizza: that cohort becomes {veggie-supreme-pizza, jamaican-jerk-chicken-pizza}, so veggie-supreme-pizza gains "B" (`-->B`; jerk takes A by registration order), the one named exception
 * (the same shape as Batch 8a's frango-catupiry joining the catupiry cohort); any other shift stays a failure.
 */
export const B12_BATCH: RecipeBatchManifest = {
  batchId: "b12-jamaican-jerk",
  status: "landed",
  afterRecipeId: "pescatore",
  recipes: [{ recipeId: "jamaican-jerk-chicken-pizza", keyIngredientId: "green-pepper", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" }],
  acceptedLetterShifts: { "veggie-supreme-pizza": "-->B" },
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH, B11_S1_BATCH, B12_BATCH];

/**
 * Pinsa Romana (#577 P3-b-3, Owner Q7): the manifest the validator checks in a build where the Pinsa gate (src/data/pinsaGate.ts) is OPEN. Deliberately NOT in
 * `RECIPE_BATCHES`: in the shipped (gate closed) build the recipe does not exist, so `RECIPE_BATCHES` is evaluated unchanged. Pinsa adds no material and no ladder step
 * (`ladderCredit: false`), so `keyIngredientId` is only the cohort key it shares (arugula). The single named exception is jamon's Research letter: arugula's
 * cohort becomes {pinsa-romana, jamon-serrano-pizza}, so jamon gains "B" (`-->B`); any other shift stays a failure. Evaluated by `lateCatalog.pinsa.test.ts`.
 */
export const PINSA_ROMANA_BATCH: RecipeBatchManifest = {
  batchId: "pinsa-romana",
  status: "landed",
  afterRecipeId: "tarako-cream-pizza", // (PR-2 late4: wasabi-beef-pizza and tarako-cream-pizza are appended after bbq-chicken-pizza.) (New Sauces Phase B U1 / U2 / U3 and BBQ Chicken: yuzu-shrimp-pizza, eggplant-dengaku-pizza, eggplant-tahini-pizza and bbq-chicken-pizza are appended after ikura, before Pinsa, so Pinsa stays the last late recipe)
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
  followedBy: ["eggplant-dengaku-pizza", "eggplant-tahini-pizza", "bbq-chicken-pizza", "wasabi-beef-pizza", "tarako-cream-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (New Sauces Phase B U2 / U3: eggplant-dengaku-pizza and eggplant-tahini-pizza are appended after yuzu-shrimp-pizza)
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
  followedBy: ["eggplant-tahini-pizza", "bbq-chicken-pizza", "wasabi-beef-pizza", "tarako-cream-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (New Sauces Phase B U3 / BBQ Chicken: eggplant-tahini-pizza and bbq-chicken-pizza are appended after eggplant-dengaku-pizza)
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
  followedBy: ["bbq-chicken-pizza", "wasabi-beef-pizza", "tarako-cream-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (BBQ Chicken is appended after eggplant-tahini-pizza)
};

/**
 * BBQ Chicken (#611, late catalog): the manifest of `bbq-chicken-pizza`, evaluated by `lateCatalog.bbq.test.ts` over the full catalog (the late recipes included). Like the other late batches it is deliberately NOT in `RECIPE_BATCHES`.
 * The recipe is credited, so its own late ladder step (after the tahini step) unlocks `bbq-sauce` and `cilantro`; its Research cohort key is `cilantro` (the last material of the step), a single-member cohort, so no existing recipe
 * changes its Research letter. It is followed by Pinsa only while the Pinsa gate is open. The original PIZZA DB page was not confirmed: the bbq-sauce PAINT before the bake, the chicken and onion before the bake (no pre-cooking)
 * and the cilantro AFTER the bake are GAMEPLAY ASSUMPTIONS (Owner 2026-10-27).
 */
export const BBQ_CHICKEN_BATCH: RecipeBatchManifest = {
  batchId: "bbq-chicken",
  status: "landed",
  afterRecipeId: "eggplant-tahini-pizza",
  recipes: [{ recipeId: "bbq-chicken-pizza", keyIngredientId: "cilantro", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: ["wasabi-beef-pizza", "tarako-cream-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])], // (PR-2 late4: wasabi-beef-pizza and tarako-cream-pizza are appended after bbq-chicken-pizza)
};

/**
 * PR-2 late4 (#578 / #611, late catalog): the manifest of `wasabi-beef-pizza` and `tarako-cream-pizza` (bulgogi and yakiniku are HOLD), evaluated by `lateCatalog.late4.test.ts` over the full catalog. Like the other late batches it is deliberately NOT in `RECIPE_BATCHES`.
 * Both are credited, each with its own late ladder step (after the BBQ step); the Research cohort keys are `wasabi` and `nori` (the last material of each step), single-member cohorts, so no existing recipe changes its Research letter.
 * The sauces, the beef before the bake (no stir-fry step) and the post-bake garnishes are GAMEPLAY ASSUMPTIONS (docs/design/TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md).
 */
export const LATE4_BATCH: RecipeBatchManifest = {
  batchId: "pr2-late4",
  status: "landed",
  afterRecipeId: "bbq-chicken-pizza",
  recipes: [
    { recipeId: "wasabi-beef-pizza", keyIngredientId: "wasabi", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "tarako-cream-pizza", keyIngredientId: "nori", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  followedBy: pinsaEnabled() ? ["pinsa-romana"] : [],
};
