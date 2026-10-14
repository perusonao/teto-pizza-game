# Expansion Batch 7a — two recipes (Result Report)

Branch `claude/teto-pizza-recipe-audit-4myjil`, base `616ef54` (main after PR #490, CS-1b `finalizeRound`). Dedicated PR; not merged, not deployed.
Authority: Owner Decision **OD-B7-1** (`docs/decisions/TETO_EXPANSION-BATCH-7_OWNER-DECISIONS.md`), the Stage 1 Pre-Implementation Gate and the Batch 7a Gate v2 (reports in the session; nothing was re-audited). Batch 7b (ikura-salmon / shirasu), #487 and #489 are untouched.
Scope: 55 -> 57 recipes, exactly these two.

## 1. G0 (re-verified on `616ef54` before any change) — GREEN

| check | result |
|---|---|
| main = the merge commit of #490 | `616ef54b3c7fa22e94a439732d00b9c5973cbbac` |
| ladder derived with the production rule (`buildAppendOnlyLadder`, 7a recipes added) | step 52 = `mint`, step 53 = `lamb` + `sweet-potato` |
| steps 1-51 | unchanged (frozen prefix compared) |
| cohort keys (ladder order) | `mint`, `sweet-potato`; both cohorts single-member; 0 existing recipes change their unlock |
| `COHORT_LETTER_SHIFT` | 0 (the Batch Validator, landed manifest) |
| `hint5Ladder.golden55`, `recipeBatch.validator`, `catalogLedger`, `finalizeRound` on main before the change | pass |
| G18 with the three glyphs added | class symbols (🥩🌊🥬🪴🧂🍇✨) never equal an ingredient glyph; no family label contains an ingredient name / id; 🍀 🐑 🍠, ids and names unique |

## 2. What shipped

| No. | recipe | key material (ladder step, T4 120 / 60 Pitz) | sauce | counts (bake) |
|---|---|---|---|---|
| 56 | `eggplant-ricotta-pizza` (ナスとリコッタのピザ) | `mint` (52, topping, family herb, 🍀) | olive-oil, PAINT_TEMPORARY (existing mapping, like pizza-bianca-ricotta) | olive-oil 1 / ricotta 3 / eggplant 3 / mint 2 (54-74) |
| 57 | `new-zealand-lamb-pizza` (ニュージーランドラムピザ) | `lamb` + `sweet-potato` (53; cohort key sweet-potato) | NO_SAUCE | mozzarella 2 / rosemary 1 / lamb 3 / sweet-potato 2 (56-76) |

- New materials: `mint` (herb, 🍀, `bakeRoastResistant`, pack 20), `lamb` (meat, 🐑, pack 30), `sweet-potato` (vegetable, 🍠, pack 20). Step 53 sells two materials (first purchase 240 Pitz in total; precedent: steps 28 / 37 / 50 / 51).
- Both: `lunchRush:false`, no CUT, `ladderCredit` true, permanently key-free Hint, one Research cohort each, schema v2 unchanged, no new mechanic, no new sauce type.
- Source: PIZZA DB rows `eggplant-ricotta-pizza-pizzadb-p5` / `new-zealand-lamb-pizza-pizzadb-p6` of the 172 matrix (no blocker, READY). **Counts and bake windows are GAMEPLAY CALIBRATION (provisional, Gate v2 values), not source: the Owner confirms them on Preview.**
- Reference pizza (Reference Truth) added for both; 8 non-sauce pieces take the RT-01 ring in `requiredIngredients` order. Leafy herbs (`mint`, `rosemary`) use `LIGHT_LEAF`, as the existing precedent test requires.
- Totals (derived; `catalogLedger.test.ts` is the one ledger): **57 recipes / 64 ingredients (toppings 50, cheeses 11; herb 6 / meat 10 / vegetable 21) / 53 ladder steps / credited 55 / chapter sizes 6, 11, 16, 24 / Lunch Rush pool 25.**

## 3. Taxonomy (OD-B7-1)

`mint` = herb, `lamb` = meat, `sweet-potato` = vegetable, L1 only. **No L2 subfamily.** The three rows carry an `OD-B7-1` comment in `ingredientTaxonomy.ts`. The decision is limited to these three materials and to Batch 7a: it does not approve PR #255 / #293 / #296 as a whole and does not mean the Human Classification Gate (OD-TAX-7) is complete. Batch 7b's `salmon-roe` / `shiso` / `whitebait` need their own decision. `🍀` is provisional for mint (a dedicated SVG may follow under Ingredient Icons 2.0).

## 4. Golden / snapshot changes (all classified; no existing golden entry changed)

| file | change | class |
|---|---|---|
| `hint5.ladders55.json` (the Hint 5.0 ladder golden) | +405 lines, **0 deletions**: the two new key-free recipes are appended; every existing entry is byte-identical | additive |
| `hint5.alphaFamilyOnly.json` | the two new recipes appended (+ the trailing comma of the former last line); no existing value moved | additive |
| `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` | `catalogComparisonCandidates` family / group / category **counts** (49 lines, numbers only) | catalog-size-derived counts, regenerated like every earlier batch (Gate v2 plan) |
| `finalizeRound.test.ts` (CS-1b) | **unchanged**; its `RECIPES`-derived matrix (4 modes x 3 bakes x 2 pizzas) now covers the two new recipes automatically, which is why the Reference pizza is required | derived, no snapshot |

Count / list pins that moved (assertions around them intact): catalog ledger and shelf distribution, recipes tail (No.56-57), the ladder derivation tests (frozen prefix 1-51, derive 52-53), materialShop rows (+3) and `nextMaterialHint` (through step 53), Lunch Rush opt-out lists (30 -> 32), progression fresh-save availability list, cooking profiles, the Hint 5.0 base-compat counts (30 -> 32 key-free recipes; sauce + cheese 12 -> 13, cheese only 12 -> 13), Batch 6's total-steps pin (51 -> 53), the Recipe Batch manifest (`landed`, batch-7a).
The representative E2E was renamed `expansion-batch6.spec.ts` -> `expansion-batch7a.spec.ts` (the earlier batches' convention: the spec follows the latest step).

## 5. Verification (budget respected: no full Vitest, no local WebKit)

- Batch Validator (landed) + catalog ledger: GREEN.
- Focused Vitest `src/data src/logic src/state src/mission src/components src/screens` on the final tree: **343 files passed, 1 skipped; 6659 tests passed, 2 skipped; 0 failed** (includes `finalizeRound.test.ts`, the Hint 5.0 golden, G7 / G17 / G18, DH4-PROD, DH4-1 audit, materialShop, ladder, Lunch Rush exclusion, progression, chapters, dinner collision).
- `deductionGuard.gate.test.ts` (Issue #446 follow-up: record the heavy tests' times): A 25.1 s (limit 120 s), B 28.1 s (limit 300 s), C 18.1 s (limit 120 s); file 77 s, 16 tests pass.
- `tsc -b` clean; `oxlint` 0 errors (pre-existing warnings only, none in the changed files); `npm run build` passes.
- Representative E2E `e2e/expansion-batch7a.spec.ts`, **iphone-390x844 and iphone-360x800: 2 tests each PASS.**
  - step 53: Shop NEW lamb + sweet-potato (T4, packs 30 / 20) -> purchase -> Research label names only `さつまいも` and no recipe identity reaches the DOM -> cook with **no sauce step** -> NEW DISCOVERY -> Dex (Chapter 4 complete, schema v2).
  - step 52: Shop NEW mint -> purchase -> Research label `ミント` (a single entry; lamb is not researchable until its materials are bought) -> cook with the **olive-oil sauce step** -> NEW DISCOVERY.

### CI finding and fix (WebKit, first push `c3960da`)
`e2e/batch6-pr3-hv.spec.ts` (Batch 6 PR-3's HV walkthrough, step D "step 51 / 130 stars") asserted `.shop-locked` count 0 ("every material is unlocked"). With Batch 7a, step 51 is no longer the end of the ladder, so the Shop correctly shows the anonymous LOCKED section for the step 52-53 materials. This was the only failure (webkit-360x800 shard 2/2 and webkit-390x844 shard 2/2; 183 / 175 passed). The assertion now uses the spec's own `expectAnonymousLocked` helper (anonymous, identical slots, no identity). No product code changed. Verified locally on Chromium 390x844 and 360x800: `batch6-pr3-hv`, `batch6-pr3-star-notice`, `shop-locked-422`, `shop-buttons-sticky-tabs-455` all pass (24 tests).

## 6. Owner HV (Preview)

Screenshots in `docs/reports/screenshots/expansion-batch7a/` (390x844). The 390x844 Review Playthrough video is delivered directly, never committed. Check on Preview: the glyphs 🍀 (mint) / 🐑 (lamb) / 🍠 (sweet-potato) on the tray, Shop and RESULT; the NEW 120 Pitz rows (mint; lamb + sweet-potato); the Research entries naming only `ミント` / `さつまいも`; the olive-oil sauce step of eggplant-ricotta and the missing sauce step of the lamb recipe; the 8-piece ring look; **the provisional counts and bake windows (54-74 / 56-76)**.

## 7. Not done / limits

- Batch 7b, #487, #489, any CUT / Lunch Rush change, any L2 tag, any SVG icon: not touched.
- PROJECT_HANDOFF gets a short addendum; the CS-1b report asked for a single later handoff update, this PR's addendum covers only Batch 7a.
- WebKit runs in CI only.
