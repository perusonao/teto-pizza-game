# Expansion Batch 8c — ikura-salmon-pizza + salmon-roe (Result Report)

Branch `claude/teto-pizza-recipe-expansion-5t77y7`, restarted from main `043f18e` (Batch 8b, #580, squash-merged). Dedicated PR (not merged, not deployed; no shared Preview touched).
Authority: Owner Decisions OD-B8-0..3 and the 2026-10-20 amendment (`docs/decisions/TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md`); started after the merge of #580 was confirmed, as the Owner ordered. Tracking: Issue #527 (no new Issue).
D2-b, #540 (Draft / HOLD) and the shared Preview are untouched.
Scope: 61 -> 62 recipes, exactly `ikura-salmon-pizza`; 66 -> 67 ingredients; 54 -> 55 ladder steps.

## 1. G0 Preflight (on `043f18e`, before any change) — GREEN

main = the #580 squash (parent `7f6f59d`, #582). On that tree: data / catalog / Hint-Discovery / state / Lunch Rush / IngredientGlyph Vitest 228 files, 5095 tests pass; `tsc -b` clean. No open PR adds this recipe or material; no foreign claim on the touched files (Issue #527 claim posted).

## 2. What shipped

| No. | recipe | key material (ladder step 55, T4 120 / 60 Pitz, no star gate) | sauce | counts (bake) |
|---|---|---|---|---|
| 62 | `ikura-salmon-pizza` (いくらとサーモンのピザ) | `salmon-roe` (seafood, dedicated art `salmon-roe-grains`); also needs step 54's `shiso`; cohort key `salmon-roe` | NO_SAUCE (`null` profile, no SAUCE step) | cream-cheese 2 (cheese step) / salmon 3 / shiso 1 / salmon-roe 2 (58-78) |

- Source: PIZZA DB row `ikura-salmon-pizza-pizzadb-p1` of the 172 matrix (cream-cheese / salmon / salmon-roe / shiso; cheese base; thin dough; no blocker, READY). **The pizzadb.jp source is still unverified** (Issue #527 D4; the host is denied): the composition is the repository's 172-matrix evidence row and stays provisional until the Owner re-confirms it.
- **Counts and the bake window are GAMEPLAY CALIBRATION (provisional).** The window is 58-78 for the same reason as Batch 8b: `FREE_COOK_BAKE_TARGET` is the median of the shipped windows, and any other window would move it (the Owner approved keeping it).
- New material (`ingredients.ts`): `salmon-roe` (いくら, seafood, `pieceVisual: "salmon-roe-grains"`, size class xs, pack 20 = 10 x k with k = 2). `emoji` is only the never-displayed text fallback (🟠, shared with no other ingredient; G18 holds). L1 family row only, no L2 (OD-B8-2).
- `ikura-salmon-pizza`: `ladderCredit` true (credited 57 -> 58), `lunchRush:false`, no CUT, permanently key-free Hint, one single-member Research cohort (bare label `？？？ピザ（いくら）`; **no existing recipe changes its letter**, the manifest has no `acceptedLetterShifts` and the validator enforces that), schema v2 unchanged, no new mechanic, no new sauce type. Reference pizza on the RT-01 8-slot ring (`LIGHT_LEAF` for shiso).
- Totals (derived; `catalogLedger.test.ts` is the one ledger): **62 recipes / 67 ingredients (toppings 53; herb 7, seafood 9) / 55 ladder steps / credited 58 / chapter sizes 6, 11, 18, 27 / Lunch Rush pool 25 (opt-out 37) / key-free 37 (cheese only 18).**

### Art (the 8b method; the Owner confirms the design on this PR's HV)
`salmon-roe-grains`: a small pile of six translucent orange grains (two-tone, white highlight, dark-orange outline), 64x64, no `id` / gradient / `<defs>`, ground shadow; added as a third visual on the existing `pieceVisual` method. The CSS 1.2em compensation of 8b is extended to this visual only (same rule). Reference art: `docs/design/references/ingredient-icons-2.0/salmon-roe.svg`. Every other visual and emoji row is untouched.

Legibility (Chromium, DPR 1; measured as in the 8b sheet): the roe is 31px on the tray, 24px on the dough, 18px on RESULT. **Its luminance contrast against the baked dough is about 1.0:1** (orange on orange), so it is read through its dark outline (2.3-3.1:1; weakest on RESULT at 2.3:1) and the bead pattern, not through brightness. See the comparison sheet delivered with this PR.

## 3. Existing 61 recipes and 54 steps: no change

- Recipe rows, `requiredIngredients`, bake windows, sauce profiles, references: untouched (append-only in every data table).
- Ladder: steps 1-54 byte-identical; `validateAppendOnlyExtension` of the frozen 54-step prefix passes.
- Hint 5.0 golden `hint5.ladders55.json`: **+202 lines, 0 deletions** (the new key-free entry appended). `hint5.alphaFamilyOnly.json`: one value appended (+ the trailing comma). `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`: catalog-size-derived counts only (21 changed lines).
- Score / Completion Gate / stars / Pitz / economy: no code path touched (data tables, one visual, one CSS rule, test fixtures). `finalizeRound` covers the new recipe through its Reference pizza.

## 4. Findings that were NOT plain pin updates (each investigated; none weakens a check)

1. **Ladder derivation order.** The REC-04 rule ties `ikura-salmon-pizza` (missing: salmon-roe + shiso), `shirasu-pizza` and the lamb recipe on missing count (2), gain and reuse, and breaks the tie on recipe id; a from-scratch re-derivation would therefore put ikura at step 53 and move the frozen lamb step to 55. The established convention applies (every earlier batch): the tests freeze everything up to the previous step and derive only the newest. `discoveryLadder.test` and `discoveryLadder.appendOnly.test` now freeze steps 1-54 and derive step 55, which is exactly the Owner's plan A (step 55 = salmon-roe, because shiso is already owned from step 54). The derived steps 53-54 are no longer re-checked against the rule (documented in the tests).
2. **Star-gate reachability baseline (`ladderReachability.starGate`).** With 58 credited recipes a uniform-★2 player reaches 122 stars, which meets goat-cheese's 120-star gate: at ★2 only spinach (130) still holds a recipe back. Measured: ★1 gated = california + spinach (unchanged); ★2 gated = spinach only; ★3 all reachable; no collateral, no blocked step, slack 58 - 55 - 2 = 1 (unchanged). The gate values are untouched; this is catalog growth opening a gate for ★2 profiles earlier (an improvement), so the per-★ baseline was tightened (`ACCEPTED_DIRECTLY_GATED_AT_BEST2`), not relaxed. **Flagged for the Owner: it is a small economy-adjacent consequence of adding recipes.**
3. **Selectable-hint free-leak test (`hidden salmon`).** The check used a substring test, so the free key chip `ing:salmon-roe` matched the hidden id `salmon` (its prefix). Verified on the real pre-purchase presentation of `ikura-salmon-pizza`: the only `ing:*` id present is `ing:salmon-roe`; the hidden `salmon`, `cream-cheese` and the reserved `shiso` do not appear. It was a false positive, not an Anti-Oracle leak. The check now matches whole ids (`mentionsIngredient`), exact leaks are still caught, and a new test pins both directions.
4. Measured values: `deductionGuard.gate` DH4-2A synthetic leak count 156 -> 123 (67 ingredients re-shape the synthetic families; the hardened `toEqual([])` held for every state).

## 5. Test fixture changes (nothing skipped, loosened or quarantined)

Count / list pins: `catalogLedger`, `recipes.test`, `cookingProfiles.test`, `materialShop.test` (+1 row, `nextMaterialHint` through step 55), `lunchRush.exclusion` (37), `progression.test`, `materialEntitlement.batch6` (55 steps), `hint5Ladder.baseCompat` (37; cheese only 18), `researchLabels.batch8a` (credited 58, 55 steps, 62 recipes), `IngredientGlyph.test` (+ the production row), the Recipe Batch manifest (`batch-8c`, landed; 8a stays an in-test fixture), `recipeBatch.validator.test`. E2E: `expansion-batch8b.spec.ts` pins `LAST_STEP = 54`; new `expansion-batch8c.spec.ts`.

## 6. Verification

- Full Vitest (Node 22): **479 files passed, 1 skipped; 8979 tests passed, 2 skipped, 6 todo; 0 failed**. (Re-run on the final tree before the PR; see the PR for the CI record.)
- Representative E2E, iphone-390x844 and iphone-360x800: `expansion-batch8c` (new), `8b`, `8a`, `7a` — **14 / 14 PASS**. Step 55: Shop NEW salmon-roe (pack 20, 120 Pitz, dedicated SVG, no emoji text) -> purchase -> Research label `？？？ピザ（いくら）` with no recipe identity in the DOM -> cream-cheese on the cheese step, no sauce step -> tray chip draws the SVG -> NEW DISCOVERY -> Dex (Chapter 4 27/27, schema v2).
- WebKit and the whole-suite E2E of this HEAD: CI (nothing carried over from #580).

## 7. Owner Human Verification (390x844)

Screenshots: `docs/reports/screenshots/expansion-batch8c/` (shop NEW, Research entry, tray, NEW RECIPE, Dex; 390x844 / 360x800). The 390x844 Review Playthrough video and the comparison sheet are delivered directly, never committed (recorded against a local build of this branch; the shared Preview was not updated).

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---:|---:|---:|---|
| `batch8c-review-390x844.mp4` (H.264, converted from Playwright WebM) | 390×844 | 29.4 s | 636,976 B | PASS |

Download: delivered directly in the session (not committed). Video Verification: PASS (exists, size > 0, plays to the end, full viewport, ffprobe: h264 390x844).
Shows: Shop NEW salmon-roe -> purchase -> Research entry `？？？ピザ（いくら）` -> tray -> cooking with no sauce step -> NEW DISCOVERY -> Dex. An automated walkthrough held at each screen; the Owner's own HV result words (PASS / FAIL) are the Owner's to write.
**iPhone Safari HV: not performed** (Chromium material only; a shared-Preview update needs separate Owner approval). Check: the roe pile at 18-31px against the baked dough (it relies on its outline), the NEW 120 Pitz row (pack 20), the Research entry naming only `いくら`, the provisional counts and bake window 58-78.

## 8. Not done / limits

- pizzadb.jp source unverified (see §2). No CUT / Lunch Rush / mechanic change, no L2 tag, no shared-Preview update, no change to D2-b or #540.
- `PROJECT_HANDOFF.md` gets a short addendum only.
