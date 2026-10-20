# Expansion Batch 8b — shirasu-pizza + shiso / whitebait (Result Report)

Branch `claude/teto-pizza-recipe-expansion-5t77y7`, base `c98d957` (main after #573). Dedicated PR (not merged, not deployed; no shared Preview touched).
Authority: Owner Decisions OD-B8-0..3 (`docs/decisions/TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md`, 2026-10-20) on `docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH_Fresh-Audit.md`.
Tracking: Issue #527 (no new Issue). Batch 8c (ikura-salmon + salmon-roe, step 55) starts only after this PR is merged. D2-b, #540 (Draft / HOLD) and the shared Preview are untouched.
Scope: 60 -> 61 recipes, exactly `shirasu-pizza`; 64 -> 66 ingredients; 53 -> 54 ladder steps.

## 1. G0 Preflight (on `c98d957`, before any change) — GREEN

| check | result |
|---|---|
| origin/main | `c98d957` (#573); no open PR adds these recipes / materials; no foreign claim on the touched files (Issue #527 claim posted) |
| catalog ledger / Recipe Batch Validator (Batch 8a landed) / `discoveryLadder.appendOnly` / `discoveryLadder` / `hint5Ladder*` on main | 30 files, 303 tests pass |
| ladder | 53 steps; steps 1-53 are the frozen prefix (step 54 is appended) |
| existing recipes | 60; none has `shiso` or `whitebait` in its composition (neither id existed anywhere in `src/data`) |
| G18 inputs | used glyphs listed from `INGREDIENTS`; the class symbols are 🥩🌊🥬🪴🧂🍇✨ |

## 2. What shipped

| No. | recipe | key materials (ladder step 54, T4 120 / 60 Pitz, no star gate) | sauce | counts (bake) |
|---|---|---|---|---|
| 61 | `shirasu-pizza` (しらすピザ) | `shiso` (herb, 🍁) + `whitebait` (seafood, 🦑); cohort key `whitebait` (the last material of the step) | NO_SAUCE (`null` profile, no SAUCE step) | mozzarella 2 / lemon 2 / shiso 1 / whitebait 3 (58-78) |

- Source: PIZZA DB row `shirasu-pizza-pizzadb-p3` of the 172 matrix (lemon / mozzarella / shiso / whitebait; cheese base; thin dough; no blocker, READY). The live-site re-check (Issue #527 D4) is still blocked by the network policy; the composition stays provisional until the Owner re-confirms it.
- **Counts and the bake window are GAMEPLAY CALIBRATION (provisional): the Owner confirms them on Preview.**
- **Bake window = 58-78, deliberately.** `FREE_COOK_BAKE_TARGET` (the Free Cooking generic window, #482 / #520) is the *median* of the shipped recipes' windows. A first draft used 56-76 (like 7a / 8a); with the 61st recipe the median start moved 58 -> 56 and the generic window changed (`bake5.test`, `gameReducer.failedResearch.test` failed). 58-78 equals the current median, so the generic window, the Completion Gate for Free Cooking and every Owner-decided bake rule are unchanged.
- New materials (`ingredients.ts`): `shiso` (大葉, herb, `bakeRoastResistant`, size class xs, pack 10 = 10 x k with k = 1), `whitebait` (しらす, seafood, size class s, pack 30). Family rows carry an `OD-B8-2` comment; **L1 only, no L2**.
- `shirasu-pizza`: `ladderCredit` true (credited 56 -> 57), `lunchRush:false`, no CUT, permanently key-free Hint, one single-member Research cohort, schema v2 unchanged, no new mechanic, no new sauce type. Reference pizza on the RT-01 8-slot ring in `requiredIngredients` order (`LIGHT_LEAF` for shiso).
- Totals (derived; `catalogLedger.test.ts` is the one ledger): **61 recipes / 66 ingredients (toppings 52; herb 7, seafood 8) / 54 ladder steps / credited 57 / chapter sizes 6, 11, 18, 26 / Lunch Rush pool 25.**
- Research: the cohort has one member, so the label is the bare `？？？ピザ（しらす）` and **no existing recipe changes its letter** (the manifest has no `acceptedLetterShifts`; the validator enforces that).

### Glyphs (OD-B8-2, provisional — Owner HV decides)

| ingredient | glyph | note |
|---|---|---|
| `shiso` | 🍁 | every natural leaf glyph is taken (🌿🍃🌱☘️🍀); 🍁 is a serrated leaf, but red |
| `whitebait` | 🦑 | 🐟🐠🐡🎏🍣🍥🦐🦪 are taken; this is the weakest fit for 「しらす」 |
| `salmon-roe` (Batch 8c) | 🟠 | follows the coloured-dot convention (🔴⚫🟢🟤) |

G18 (`hint5Taxonomy.gate`) passes with 🍁 and 🦑: no class symbol equals an ingredient glyph, no family label contains an ingredient name / id, and glyphs / ids / names are unique. A dedicated SVG (Ingredient Icons 2.0, Style Lock v2) may replace them after the Owner's HV; that needs its own Human Visual Gate and is out of scope here.

## 3. Existing 60 recipes and 53 steps: no change

- Recipe rows, `requiredIngredients`, bake windows, sauce profiles and references: untouched (the diff of every data table is append-only).
- Ladder: steps 1-53 byte-identical (`discoveryLadder.appendOnly` / `ladderCredit`); `validateAppendOnlyExtension` of the frozen 53-step prefix passes.
- Hint 5.0 golden `hint5.ladders55.json`: **+202 lines, 0 deletions** (the one new key-free entry appended; every existing entry is byte-identical). `hint5.alphaFamilyOnly.json`: one value appended (+ the trailing comma of the former last line).
- `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`: catalog-size-derived counts only (`catalogComparisonCandidates`, 37 changed lines), regenerated like every earlier batch (7a precedent).
- Score / Completion Gate / stars / Pitz / economy: no code path touched (data tables and test fixtures only). `finalizeRound` matrix covers the new recipe automatically through its Reference pizza.
- Lunch Rush: opt-out (36 recipes opt out; pool stays 25).

## 4. Test fixture changes (classified; nothing skipped, loosened or quarantined)

| class | files |
|---|---|
| count / list pins that move | `catalogLedger` (61 / 57 / 66 / 52 / 54 / [6,11,18,26]; shelf herb 7, seafood 8), `recipes.test` (tail No.61), `cookingProfiles.test` (step matrix + not-CUT list), `materialShop.test` (+2 rows, `nextMaterialHint` through step 54), `lunchRush.exclusion` (opt-out 36), `progression.test`, `materialEntitlement.batch6` (54 steps), `hint5Ladder.baseCompat` (36 key-free; cheese only 17), `researchLabels.batch8a` (credited 57, 54 steps, 61 recipes; the 8a assertions themselves kept) |
| measured values | `deductionGuard.gate`: the DH4-2A synthetic leak count 123 -> 156 (66 ingredients re-shape the synthetic families, as at every earlier batch); **the hardened-guard `toEqual([])` assertion held for every state** |
| derived expectations | `hint5Economy.sim`: the lone hinted last discovery moves from `frango-catupiry` to the final ladder key (shirasu-pizza); `frango-catupiry` joins the derived blind pool-2 chain (list derived from the ladder, no per-batch pin) |
| validator | `recipeBatchManifest` -> `batch-8b` (landed; key `whitebait`; no letter shifts); `recipeBatch.validator.test` keeps Batch 8a as an in-test fixture (truncated view) for the non-credit / creditedWithoutStep / letter-shift checks, so no check was removed or weakened |
| goldens | see §3 |
| e2e | `expansion-batch7a.spec.ts` pins `LAST_STEP = 53` (it used `DISCOVERY_LADDER.steps.length`); new `expansion-batch8b.spec.ts` |

## 5. Verification

- Full Vitest (Node 22): **477 files passed, 1 skipped; 8952 tests passed, 2 skipped, 6 todo; 0 failed** (includes the Recipe Batch Validator, catalog ledger, Hint 5.0 golden, DH4 / Hint 5.0 production gates, G7 / G17 / G18, `finalizeRound`, `researchLabels.batch8a`, materialShop, ladder, chapters, Lunch Rush exclusion).
- `tsc -b` clean; `oxlint` 0 errors (pre-existing warnings only, none in the changed files).
- Representative E2E `e2e/expansion-batch8b.spec.ts` + the 7a and 8a specs, iphone-390x844 and iphone-360x800: **12 / 12 PASS**.
  - step 54: Shop NEW shiso (🍁, pack 10) and whitebait (🦑, pack 30) at 120 Pitz -> purchase -> Research label `？？？ピザ（しらす）` with no recipe identity in the DOM -> cook with **no sauce step** -> NEW DISCOVERY -> Dex (Chapter 4 complete, schema v2).
- WebKit: CI only (not installed locally).
- Whole-suite Chromium E2E and `npm run build`: see §6.

## 6. Full-suite E2E / build

(filled in at the end of the run)

## 7. Owner Human Verification (Preview, 390x844)

Screenshots: `docs/reports/screenshots/expansion-batch8b/` (390x844 / 360x800). The 390x844 Review Playthrough video is delivered directly, never committed (recorded against a local build of this branch; the shared Preview was not updated).
Check: the glyphs 🍁 (shiso) / 🦑 (whitebait) on the tray, Shop and RESULT; the NEW 120 Pitz rows (packs 10 / 30); the Research entry naming only `しらす`; the missing sauce step; the 8-piece ring look; **the provisional counts and bake window (58-78)**; and whether the glyphs should be replaced by dedicated SVGs.

## 8. Not done / limits

- Batch 8c (ikura-salmon / salmon-roe / step 55), any CUT / Lunch Rush / mechanic change, any L2 tag, any SVG icon: not touched.
- PIZZA DB live re-check (#527 D4): blocked by the network policy.
- `PROJECT_HANDOFF.md` gets a short addendum only; the stale "PR pending" wording of the Batch 7a / 8a addenda is left as written (Owner decides).
- WebKit runs in CI only.
