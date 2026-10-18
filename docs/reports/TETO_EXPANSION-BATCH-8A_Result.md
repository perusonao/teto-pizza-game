# Expansion Batch 8a — three non-credit, zero-material recipes (Result Report)

Branch `claude/recipe-expansion-next-batch-mdk2rm`, base `d611839` (main after #548). Dedicated PR (not merged, not deployed; no shared Preview touched). Authority: Owner GO 2026-10-18 on `docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH_Fresh-Audit.md` (Q1 name = 「チリアン」, Q2 chorizo = existing `sausage`, Q4 non-credit, Q5 Research A/B accepted, Q6 n/a). PR-8b (shirasu + shiso / whitebait) is **not** part of this change. #540 / #546 / #553 untouched.
Scope: 57 -> 60 recipes, exactly these three; **ingredients 64 and ladder 53 steps unchanged**.

## 1. What shipped

| No. | recipe | composition (counts = GAMEPLAY CALIBRATION, provisional; Owner confirms on Preview) | makeable from | chapter | Research cohort |
|---|---|---|---|---|---|
| 58 | `chilean-napolitana` チリアン・ナポリターナ | mozzarella 2 / fresh-tomato 3 / oregano 1 (6 pieces), bake 56-76 | step 20 (fresh-tomato) | 3 | joins pesto-caprese's tomato cohort |
| 59 | `spanish-chorizo-pizza` スパニッシュ・チョリソ | mozzarella 2 / sausage 3 / bell-pepper 2 / onion 1 (8 pieces), bake 56-76 | step 28 (bell-pepper) | 3 | own cohort (bell-pepper), bare label |
| 60 | `frango-catupiry` フランゴ・カトゥピリ | mozzarella 2 + catupiry 2 (cheese step) / chicken 3 / oregano 1 (8 pieces), bake 56-76 | step 44 (catupiry) | 4 | joins brazilian-catupiry-corn-pizza's cohort |

All three: PIZZA DB source rows of the 172 matrix (`chilean-napolitana-pizzadb`, `spanish-chorizo-pizza-pizzadb-p4`, `frango-catupiry-pizzadb-p10`; no blocker), cheese base / **NO_SAUCE** (existing TQ-1D mechanic, no SAUCE step, `null` sauce profile), `ladderCredit:false`, `lunchRush:false`, no CUT, permanently key-free Hint, `baseRewardPitz` 100 (precedent), thin standard dough (no new mechanic), Reference pizza on the RT-01 8-slot ring (`LIGHT_LEAF` for oregano). The chorizo is the existing `sausage` (no new ingredient). Schema v2 unchanged.
Data files: `recipes.ts`, `referencePizza.ts`, `discoveryCatalog.ts`, `orders.ts`, `recipeHintRoles.ts`, `recipeSauceProfiles.ts` (no `ingredients.ts`, no taxonomy rows).

## 2. Research A/B label changes (exact)

Cohort = recipes whose last-unlocking material is the same. Only two existing recipes change a label; both gain the letter **A**, the new recipe is **B** (letters are assigned by the existing anonymous order and then fixed, OD-R2-3).

| step | before Batch 8a | after |
|---|---|---|
| 20 (tomato) | `？？？ピザ（トマト）` — pesto-caprese alone, bare | `？？？ピザ A（トマト）` / `？？？ピザ B（トマト）` (pesto-caprese + chilean-napolitana; which is A is hash-ordered, not catalog-ordered) |
| 28 (bell-pepper) | no entry | `？？？ピザ（パプリカ）` bare (spanish-chorizo-pizza); the zucchini pair keeps `A / B（ズッキーニ）` — **unchanged** (chorizo's last material is bell-pepper, not zucchini) |
| 44 (catupiry) | `？？？ピザ（カトゥピリ）` — catupiry-corn alone, bare | `A / B（カトゥピリ）` (brazilian-catupiry-corn-pizza + frango-catupiry) |

Other visible consequences (same kind as the Grandma S3 precedent): from step 20 / 28 / 44 onward an existing save gets **one more Research entry** (non-credit recipes stay in the pool until found), so states that used to be a single entry ("pesto-pollo is the only entry", step 25 with calabresa and aussie found) are now a choice between 2 entries until chilean-napolitana is found. Chapter 3: 16 -> 18, Chapter 4: 24 -> 25 (No.17-18 / No.25). Dex 57 -> 60; credited stays 55; Lunch Rush pool stays 25 (opt-out list 32 -> 35).
Pinned by: `researchLabels.batch8a.test.ts` (new), `recipeBatch.validator` (`acceptedLetterShifts` = exactly `pesto-caprese` and `brazilian-catupiry-corn-pizza`, `-->A`; any other shift, or a listed shift that does not happen, fails), `researchCohortLetter`, `researchEntry`, `DexOverlay.researchIdentity`, `e2e/expansion-batch8a.spec.ts`.

## 3. Existing 57 recipes: no change to discovery, progression, score

- Recipe rows, `requiredIngredients`, bake windows, sauce profiles, references: untouched (diff is append-only in every data table).
- Ladder: 53 steps, steps 1-53 byte-identical (no step added; `discoveryLadder.appendOnly` / `ladderCredit` pass). `COHORT_LETTER_SHIFT` is only the two accepted above.
- Discovery: the matcher still resolves every existing recipe's exact composition to itself (`w1Activation`, dinner "unique signature" per recipe, passes with 60); no new recipe's ingredient set equals any other recipe's.
- Hint 5.0 golden `hint5.ladders55.json`: **+520 lines, 0 deletions** (three new key-free entries appended); `hint5.alphaFamilyOnly.json`: three values appended (+ the trailing comma). The key-free population 32 -> 35 (cheese only 13 -> 16, all three NO_SAUCE).
- Score / Completion Gate / stars / Pitz: no code path touched (data tables and test fixtures only); `finalizeRound` matrix covers the three automatically.
- Lunch Rush: all three opt out (`lunchRush:false`), pool unchanged at 25.

## 4. Test fixture changes (classified; nothing skipped, loosened or quarantined)

| class | files |
|---|---|
| count / list pins that move | `catalogLedger` (60 recipes, chapters 6 / 11 / 18 / 25), `recipes.test` (tail No.58-60), `cookingProfiles.test` (steps + not-CUT list), `lunchRush.exclusion`, `progression.test`, `recipeChapters.test`, `hint5Ladder.baseCompat` (35), `selectableHint` (3-level cap list), `discoveryProgressionModel` / Inspector (multi-recipe steps 12 / 20 / 28 / 44; non-credit list) |
| "all closed" saves now also close chilean-napolitana (or chorizo) so the case keeps meaning what it says | `DexOverlay.hint/research/researchIdentity`, `378.stockBlockedResearch`, `nearMiss`, `researchBoard`, `researchEntry`, `researchCohortLetter`, `discoveryNo27`, `discoveryExpansion1/2`, `discoveryHint.researchChoice`, `gameReducer.researchLoop/Rows/Target`, `homeDiscoveryRoute`, `App.homeDiscovery`, `App.pizzaSelectRouting`, `preview/hvSeeds` (+ its test), and the 13 E2E specs that seed "everything found at step 25" |
| validator extension (test support only) | `recipeBatchValidator.ts`: optional `acceptedLetterShifts`; a former test that used a credited key as its fixture now uses Batch 7a's manifest |
| goldens | Hint 5.0 ladder + alpha-family golden: additive only (see §3) |
| new | `researchLabels.batch8a.test.ts` (9 tests), `e2e/expansion-batch8a.spec.ts` (3 tests x 2 viewports) |

## 5. Verification
- Local (Node 22): `tsc -b` clean; `oxlint` 0 errors (pre-existing warnings only); `npm run build` passes; **full Vitest 450 files passed / 1 skipped, 8537 tests passed / 2 skipped / 0 failed** (incl. Batch Validator, catalog ledger, Hint 5.0 golden, DH4 / Hint 5.0 production gates, `finalizeRound`, `researchLabels.batch8a`).
- Chromium E2E, iphone-390x844, **whole suite** (460 tests): 358 passed / 95 skipped (project filters) / 7 failed on the first run. Classification of the 7 (all fixture or display, no product logic):
  1. Dex counter literals (`27/60`, `28/60`, `29/60`, `30/60`) and chapter totals (`11/16`, `12/16`, `15/16`, `16/16` -> `12/18`, `13/18`, `17/18`, `18/18`) in `discovery3-no27`, `expansion1`, `expansion2-wave2` (x3), `expansion3`: +1 / +2 because the seeded "everything found" saves now also found the non-credit recipes. Updated.
  2. Seeds that listed only calabresa / aussie as closed (`expansion2-wave2` step 28, `expansion3`, `research-stable-identity` step 28) now also close chilean-napolitana / spanish-chorizo-pizza, otherwise a third Research entry appears. Updated (same rule as the Vitest fixtures).
  3. `discovery-inspector-scroll` (DEV Inspector): five non-credit paragraphs pushed Step 1 out of the first screen. The Inspector's non-credit notes are now one compact paragraph and contiguous pool steps collapse to `a〜b` (display only, DEV screen; the same fix class as the Grandma S3 report).
  After the fixes the 7 specs + the new spec: **36 passed on iphone-390x844 and iphone-360x800**. No test was skipped, quarantined or loosened.
- The new `e2e/expansion-batch8a.spec.ts` (3 tests x 2 viewports): the pair labels (`A / B（トマト）`, `A / B（カトゥピリ）`, bare `（パプリカ）`), no recipe identity in the DOM before a discovery, cooking with no sauce step -> NEW DISCOVERY -> Dex (No. / chapter totals), schema v2.
- WebKit (390x844 / 360x800, all shards): CI only (not installed locally). See the PR for the run.
- Codex review: not runnable from this environment; PR number and HEAD are reported to the Owner for the review request.

## 6. Owner Human Verification (Preview, 390x844)
Screenshots in `docs/reports/screenshots/expansion-batch8a/` (390x844 and 360x800): `before-tomato-research-entry-*` / `before-catupiry-research-entry-*` (main: bare label, one entry) vs `batch8a-chilean-pair-research-entry-*` / `batch8a-frango-pair-research-entry-*` (A / B), `batch8a-chorizo-research-entry-*` (bare `（パプリカ）`), `*-tray-*`, `*-new-recipe-*`, `*-dex-*`. The three 390x844 Review Playthrough videos (one per recipe) are delivered directly in the session, never committed. Check: the new names in Pizza Select / Dex / RESULT; the A / B letters; **the provisional counts and bake windows (56-76)**; that chorizo reading as the generic sausage is acceptable.

## 7. Not done / limits
PR-8b (shirasu, shiso, whitebait), any new ingredient / glyph / taxonomy row, any CUT / Lunch Rush / mechanic change, #540 / #546 / #553, the shared Preview: not touched. Local WebKit not run.
