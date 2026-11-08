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
  followedBy: ["boscaiola", "porcini-pizza", "pescatore", "jamaican-jerk-chicken-pizza", "supreme-pizza", "pizza-alla-norma", "potato-mayo-pizza", "moussaka-style-pizza", "nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (B11 S1 is appended after cuban-pizza, B12 after B11 S1, Expansion Batch 12 after B12, Expansion Batch 13 after Expansion Batch 12)
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
  followedBy: ["jamaican-jerk-chicken-pizza", "supreme-pizza", "pizza-alla-norma", "potato-mayo-pizza", "moussaka-style-pizza", "nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (B12 is appended after pescatore; Expansion Batch 12 after B12; Expansion Batch 13 after Expansion Batch 12)
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
  followedBy: ["supreme-pizza", "pizza-alla-norma", "potato-mayo-pizza", "moussaka-style-pizza", "nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 12 is appended after B12; Expansion Batch 13 after Expansion Batch 12)
  acceptedLetterShifts: { "veggie-supreme-pizza": "-->B" },
};

/**
 * Expansion Batch 12 (the second 'B12'; Issue #707, appended after jamaican-jerk-chicken-pizza of #706/#711, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): supreme-pizza (`ladderCredit: false`, no new material, no step of its own) and pizza-alla-norma (credited, the key of ordinary step 64, the one new material ricotta-salata).
 * supreme-pizza's last-unlocking material is bell-pepper (ordinary step 28), the cohort `spanish-chorizo-pizza` already sits in alone (a bare label), so that pair becomes a two-member lettered cohort: spanish-chorizo-pizza's label gains a letter.
 * That is a visible Research-label change to a pre-existing recipe, listed here as the single accepted shift (OWNER CONFIRMATION PENDING; the same kind as Batch 8a's chilean-napolitana / frango-catupiry). pizza-alla-norma's cohort (ricotta-salata) is a single member, so it shifts nothing.
 */
export const B12B_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-12",
  status: "landed",
  afterRecipeId: "jamaican-jerk-chicken-pizza",
  recipes: [
    { recipeId: "supreme-pizza", keyIngredientId: "bell-pepper", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pizza-alla-norma", keyIngredientId: "ricotta-salata", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  followedBy: ["potato-mayo-pizza", "moussaka-style-pizza", "nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 13 is appended after this batch, Expansion Batch 14 after that)
  acceptedLetterShifts: { "spanish-chorizo-pizza": "-->B" },
};

/**
 * Expansion Batch 13 (Issue #708, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): potato-mayo-pizza (credited, NO_SAUCE for this one row by Owner decision 2026-10-30, the key of ordinary step 65: the one new material `mayo`, a spice topping).
 * mayo is the only unlock material of its step and potato-mayo-pizza the only recipe of its cohort, so no existing recipe changes its Research label (no `acceptedLetterShifts`).
 */
export const B13_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-13",
  status: "landed",
  afterRecipeId: "pizza-alla-norma",
  recipes: [{ recipeId: "potato-mayo-pizza", keyIngredientId: "mayo", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: ["moussaka-style-pizza", "nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 14 is appended after this batch, Expansion Batch 15 after that)
};

/**
 * Expansion Batch 14 (PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): moussaka-style-pizza (credited; fromage-blanc-sauce PAINT stands in for the matrix's ambiguous white sauce, Owner decision for this recipe only; the key of ordinary step 66: the one new material `cinnamon`, a spice topping).
 * cinnamon is the only unlock material of its step and moussaka-style-pizza the only recipe of its cohort, so no existing recipe changes its Research label (no `acceptedLetterShifts`).
 */
export const B14_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-14",
  status: "landed",
  afterRecipeId: "potato-mayo-pizza",
  recipes: [{ recipeId: "moussaka-style-pizza", keyIngredientId: "cinnamon", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: ["nigerian-suya-pizza", "ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 15 is appended after this batch)
};

/**
 * Expansion Batch 15 (Issue #728, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): nigerian-suya-pizza (`ladderCredit: false`, no new material, so no ladder step of its own; NO_SAUCE as a SUYA-ONLY Owner exception, 2026-11-02, not a general rule).
 * Its Research cohort key is beef (ordinary step 58), shared with the credited rendang-pizza: that cohort becomes {rendang-pizza, nigerian-suya-pizza}, so rendang-pizza gains "B" (`-->B`; suya takes A by the opaque id hash). Owner-approved (2026-11-02),
 * the one named exception (the same shape as B12's veggie-supreme-pizza); any other shift stays a failure.
 */
export const B15_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-15",
  status: "landed",
  afterRecipeId: "moussaka-style-pizza",
  recipes: [{ recipeId: "nigerian-suya-pizza", keyIngredientId: "beef", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" }],
  acceptedLetterShifts: { "rendang-pizza": "-->B" },
  followedBy: ["ume-shiso-pizza", "goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 16 is appended after this batch)
};

/**
 * Expansion Batch 16 (Issue #736, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): ume-shiso-pizza (credited; the umeboshi-paste PAINT sauce stands for the matrix's unspecified sauce field 'その他', a B16-only Owner exception; every piece placed before the bake;
 * the key of ordinary step 67: the one new material `umeboshi-paste`, a sauce). umeboshi-paste is the only unlock material of its step and ume-shiso-pizza the only recipe of its cohort, so no existing recipe changes its Research label (no `acceptedLetterShifts`).
 */
export const B16_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-16",
  status: "landed",
  afterRecipeId: "nigerian-suya-pizza",
  followedBy: ["goulash-pizza", "baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 17 is appended after this batch)
  recipes: [{ recipeId: "ume-shiso-pizza", keyIngredientId: "umeboshi-paste", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
};

/**
 * Expansion Batch 17 (Issue #741, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): goulash-pizza (credited; the sour-cream PAINT sauce stands for the matrix's unspecified sauce field 'その他', a B17-only Owner exception;
 * the key of ordinary step 68: the one new material `sour-cream`, a sauce). sour-cream is the only unlock material of its step and goulash-pizza the only recipe of its cohort, so no existing recipe changes its Research label (no `acceptedLetterShifts`).
 */
export const B17_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-17",
  status: "landed",
  afterRecipeId: "ume-shiso-pizza",
  followedBy: ["baingan-bharta-pizza", "reina-pepiada-pizza", "pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 18 is appended after this batch)
  recipes: [{ recipeId: "goulash-pizza", keyIngredientId: "sour-cream", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
};

/**
 * Expansion Batch 18 (Issue #748, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): baingan-bharta-pizza (credited; curry-ketchup stands in for the unspecified curry base; the key of ordinary step 69: `cilantro`, PROMOTED from the late catalog, not a new id)
 * and reina-pepiada-pizza (NOT credited, `ladderCredit: false`; fromage-blanc-sauce stands in for the white sauce; mayo is the existing topping). Both are recipe-specific Owner decisions, not NO_SAUCE exceptions. Research: cilantro now unlocks two recipes
 * (baingan / reina, a NEW lettered cohort). In the canonical ladder purchase order, bbq-chicken-pizza (late) is keyed by bbq-sauce, with no letter shift; in the actual entitlement order where cilantro arrives after bbq-sauce, BBQ gains B. Owner approved THAT ORDER-SPECIFIC visible shift on 2026-11-05 (#748).
 * The validator's `acceptedLetterShifts` contract only applies to canonical ladder order, so declaring the alternative-order shift there would cause ACCEPTED_LETTER_SHIFT_NOT_OBSERVED. Keep that gate strict and pin the approved noncanonical shift in `B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS` + expansionBatch18.test.ts.
 */
/** Owner #748 OD-B18-1: explicit acceptance of the actual entitlement-order Research label change, NOT a canonical-ladder validator exception. */
export const B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS = { "bbq-chicken-pizza": "-->B" } as const;

/**
 * Codex P2 on PR #759 (2026-11-05): the audit `researchLetterChangesAcrossOrders` (testSupport/researchLabelAudit.ts) compares the catalog BEFORE and AFTER Batch 18 for
 * many acquisition orders (the full late catalog included). In the CANONICAL ladder order no pre-existing letter changes. In NON-canonical orders (a shared material acquired
 * last) these 39 pre-existing recipes can change their Research letter -- 24 of them can gain a letter where they had none. Only the bbq-chicken-pizza `-->B` change in the
 * bbq-sauce -> cilantro order is Owner-approved (OD-B18-1, which was given on the premise that no other recipe changes; that premise was measured in ONE order only).
 * Owner OD-B18-4 (2026-11-05, Issue #748 comment 6651668675) APPROVED Option A for EXACTLY this audited set (derived Research display labels only; the canonical ladder order must stay at zero
 * existing-letter changes). The membership is fixed: it is not a general waiver, and any new pre-existing recipe in a later batch needs its own audit and Owner Gate.
 * Saves, discoveries, scoring, inventory, entitlement (floor 66), recipe identities and the runtime Research 2.0 rule are NOT changed by this approval.
 * The same audit on the already-merged Batch 17 (goulash-pizza) finds 18 such recipes and on Batch 16 (ume-shiso-pizza) 4: the behaviour follows from the Research 2.0 contract
 * ("a catalog revision that adds a recipe to an existing cohort may change that cohort's letters", researchEntry.ts), it is not specific to Batch 18.
 */
export const B18_APPROVED_AUDITED_ALTERNATE_ORDER_LETTER_CHANGES: readonly string[] = [
  "aussie",
  "baba-ganoush-pizza",
  "bacalhau",
  "bbq-chicken-pizza",
  "brazilian-calabresa",
  "california-style-pizza",
  "chilean-napolitana",
  "curry-pizza-japan",
  "currywurst",
  "eggplant-dengaku-pizza",
  "eggplant-ricotta-pizza",
  "eggplant-tahini-pizza",
  "flammkuchen",
  "frango-catupiry",
  "fugazza",
  "goulash-pizza",
  "jamaican-jerk-chicken-pizza",
  "melanzane-pizza",
  "moussaka-style-pizza",
  "parmigiana-pizza",
  "pesto-caprese",
  "pesto-gamberi",
  "pesto-pollo",
  "pesto-tonno",
  "pesto-trapanese",
  "pesto-vegetariana",
  "pizza-feta-eliniki",
  "pizza-moscow",
  "pizza-portuguesa",
  "polish-kielbasa",
  "potato-mayo-pizza",
  "rendang-pizza",
  "sichuan-eggplant-pizza",
  "spanish-chorizo-pizza",
  "supreme-pizza",
  "tandoori-paneer-pizza",
  "tonno-e-cipolla",
  "veggie-supreme-pizza",
  "wasabi-beef-pizza",
];

export const B18_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-18",
  status: "landed",
  afterRecipeId: "goulash-pizza",
  followedBy: ["pesto-burrata-pizza", "pizza-alla-crudaiola", "pesto-noci-pizza"], // (Expansion Batch 19 is appended after this batch)
  recipes: [
    { recipeId: "baingan-bharta-pizza", keyIngredientId: "cilantro", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "reina-pepiada-pizza", keyIngredientId: "cilantro", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

/**
 * Expansion Batch 19 (Issue #774, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): pesto-burrata-pizza (credited; the key of ordinary step 70: the one new material `burrata`) and pizza-alla-crudaiola (NOT credited, `ladderCredit: false`;
 * a conditional Jaccard 0.429 exception for this recipe only, OD-B19-2). Both have two sauce layers (primary + olive-oil by presence) and every piece is placed before the bake. Research: burrata unlocks two recipes (a NEW lettered cohort A / B); burrata is in no existing recipe,
 * so no existing label shifts in the canonical ladder order (non-canonical orders are audited separately in the Result Report, AC-8).
 */
export const B19_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-19",
  status: "landed",
  afterRecipeId: "reina-pepiada-pizza",
  followedBy: ["pesto-noci-pizza"], // (Expansion Batch 20-A is appended after this batch)
  recipes: [
    { recipeId: "pesto-burrata-pizza", keyIngredientId: "burrata", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pizza-alla-crudaiola", keyIngredientId: "burrata", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

/**
 * Expansion Batch 20-A (Issue #790, PROVISIONAL SPEC, ORIGINAL pizzadb.jp NOT CONFIRMED; GAMEPLAY ASSUMPTION): pesto-noci-pizza (credited; the key of ordinary step 71: the two new materials `honey` and `walnut`, the last one, walnut, is the key material). Two sauce layers (pesto PAINT as the primary + honey by presence),
 * every piece is placed before the bake. Research: its pesto-family neighbours can change letter ONLY in non-canonical acquisition orders (10 existing recipes, individually Owner-approved, see `expansionBatch20.test.ts`); the canonical ladder order changes none.
 */
export const B20A_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-20a",
  status: "landed",
  afterRecipeId: "pizza-alla-crudaiola",
  recipes: [{ recipeId: "pesto-noci-pizza", keyIngredientId: "walnut", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH, B11_S1_BATCH, B12_BATCH, B12B_BATCH, B13_BATCH, B14_BATCH, B15_BATCH, B16_BATCH, B17_BATCH, B18_BATCH, B19_BATCH, B20A_BATCH];

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
 * Expansion Batch 18 (#748): `cilantro` was promoted to ordinary step 69, so the late BBQ step now names only `bbq-sauce` and the key ingredient (the Research cohort key) is `bbq-sauce`; the recipe stays a single-member cohort (no letter).
 */
export const BBQ_CHICKEN_BATCH: RecipeBatchManifest = {
  batchId: "bbq-chicken",
  status: "landed",
  afterRecipeId: "eggplant-tahini-pizza",
  recipes: [{ recipeId: "bbq-chicken-pizza", keyIngredientId: "bbq-sauce", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
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
