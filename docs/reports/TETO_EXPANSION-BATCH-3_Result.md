# Expansion Batch 3 — six NO_SAUCE recipes (Result Report)

Branch `claude/teto-pizza-batch-3-candidates-dek2x2` (base `c8b6bd7`, Production after Batch 2). No PR yet (Owner HV first).
Authority: Owner Decision A (2026-10-07): `tsukimi-pizza` + `green-onion` removed from the batch; OD-DH4-2-9, its "other" reach condition / copy and the privacy contract are unchanged; the ladder order is not rearranged to dodge it.

## 1. What shipped

| No. | recipe | key material (ladder step, T4 120 / 60 Pitz) | counts (non-sauce pieces) |
|---|---|---|---|
| 42 | `bacalhau` | salt-cod (38) | mozzarella 2 / onion 2 / black-olive 1 / salt-cod 2 |
| 43 | `full-english-pizza` | baked-beans (39) | mozzarella 2 / bacon 1 / egg 1 / sausage 2 / baked-beans 2 (8 = the ring) |
| 44 | `palmito-pizza` | palm-heart (40) | mozzarella 2 / black-olive 2 / palm-heart 3 |
| 45 | `polish-kielbasa` | sauerkraut (41) | mozzarella 2 / sausage 2 / onion 1 / sauerkraut 2 |
| 46 | `porchetta-pizza` | pork (42) | mozzarella 2 / pork 3 / rosemary 2 |
| 47 | `salsiccia-e-friarielli` | friarielli (43) | mozzarella 2 / sausage 3 / friarielli 2 |

All: NO_SAUCE (`RECIPE_SAUCE_PROFILES[id] === null`, the TQ-1D mechanic; no SAUCE step), existing mozzarella, no CUT, `lunchRush:false`, `ladderCredit` true, permanently key-free Hint, one dedicated new key material, a single-member Research cohort (label `？？？ピザ（<材料>）`, no letter; no existing cohort / letter moves).

**Order.** The ladder is the append-only REC-04 rule applied to the production recipes (pinned by `discoveryLadder.test.ts` / `discoveryLadder.appendOnly.test.ts`). With no material reuse between the six, its tie-break is the recipe id, so the steps come out alphabetically (bacalhau 38 … salsiccia-e-friarielli 43). The recipe tail, the manifest and the ladder all use that one order. (bacalhau is therefore the FIRST step, not the last; the representative E2E plays the final step, salsiccia-e-friarielli.)

Totals (derived from the code; `catalogLedger.test.ts` is the one ledger): **47 recipes / 51 ingredients (toppings 41) / 43 ladder steps / credited 45 / chapter sizes 6, 11, 16, 14 / Lunch Rush pool 25.** Steps 1-37 frozen; save schema v2 unchanged.

## 2. NO_SAUCE contract (Phase 1)

The NO_SAUCE set is no longer "aussie": `RECIPE_SAUCE_PROFILES` is `as const satisfies Record<RecipeId, RecipeSauceProfile | null>`, and `NoSauceRecipeId` / `noSauceRecipeIds()` derive the set from its `null` entries. `computeMechanicalSauceReference`'s overload is `Exclude<RecipeId, NoSauceRecipeId>`. No runtime behavior changed (cooking steps, technique detection, Scoring 2.0, Hint 5.0 key-free ladder and the Research rows were already data-driven).

The legacy `["aussie"]` pins now assert the derived set, cross-checked against the independent authorities (recipe data: no sauce-category ingredient; Hint 5.0 ladder: no SAUCE rung; discovery catalog: empty `sauceBase`; Technique `requiredTechniquesOf`): Hint 5.0 G7, DH4-PROD (2 places), `recipeSauceProfiles`, `referencePizza`, `playerReference`, `cookingProfiles`, `discoveryCatalog`, `executionAdvice`, `gameReducer.techniques`, `researchResultRows` (2), `scoringV2.noSauceParity`, `dexView`, `techniques` (4), `runtime` (2), `discoveryExpansion2.wave2`. No assertion was deleted, skipped or weakened.

## 3. Privacy gates

- Hint 5.0 G7 (Cooking Techniques tripwire): GREEN. Every NO_SAUCE recipe: no SAUCE rung, no KEY_TOPPING, first rung CHEESE, indices 1..n, no RESERVED / empty rung.
- DH4-PROD privacy sweep (14 tests): GREEN, incl. the OD-DH4-2-9 "その他 is unreachable" test and the independent-attacker test (0 leaks).
- The only value that moved was a measured snapshot: the set of recipes whose Hint 3.0 public model already leaves one candidate (`preExistingPublic`) is `["melanzane-pizza", "parmigiana-pizza"]` again (Batch 2 had added `pesto-caprese`; Batch 3's six new materials widen its candidate set). Every per-state guard assertion held; the snapshot was updated, nothing was relaxed.
- `tsukimi-pizza` deferred: it broke OD-DH4-2-9 (egg as the reserve with `other` family members almond / pine-nuts owned made `attr:*:other` answerable).

## 4. Taxonomy / glyph / economy

- Families: pork meat, salt-cod seafood, friarielli / sauerkraut / palm-heart vegetable, **baked-beans vegetable** (existing rule: `other` is egg / nuts / sweets; plant produce like corn / potato is `vegetable`; no new rule).
- Glyphs (G18-checked; no new Hint class symbol): pork 🐖, friarielli 🥦, sauerkraut 🥫, palm-heart 🌴, baked-beans 🫘, salt-cod 🐡. Anything that reads oddly goes to Owner HV.
- Economy: the existing T4 tier (first purchase 120 Pitz, refill 60, pack = 10 pizzas of the key count); no price invented.

## 5. Verification

Batch Validator, G7, DH4-PROD, DH4-1 audit JSON (regenerated: category / family / group counts only), matcher / collision (no exact / subset / superset against the 41), ladder / reachability, Research cohort / privacy, Hint, materialShop, tsc, oxlint (0 errors; 2 pre-existing warnings), full Vitest once, representative Playwright (`e2e/expansion-batch3.spec.ts`, iphone-390x844, pagination-aware `chipOnTrayOrPin`): Shop NEW → purchase → Research (no identity leak) → cook (the Research round is recipe-free, so the step strip is the same for every target and the sauce step is skipped) → NEW DISCOVERY → Dex.

## 6. Owner HV (Preview)
See the PR / hand-off message; screenshots in `docs/reports/screenshots/expansion-batch3/` (the video is delivered directly, not committed).

tsukimi-pizza: OD-DH4-2-9 other-unreachable contractに抵触するためdeferred
