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
| 61 | `shirasu-pizza` (しらすピザ) | `shiso` (herb) + `whitebait` (seafood), both with dedicated art (§2); cohort key `whitebait` (the last material of the step) | NO_SAUCE (`null` profile, no SAUCE step) | mozzarella 2 / lemon 2 / shiso 1 / whitebait 3 (58-78) |

- Source: PIZZA DB row `shirasu-pizza-pizzadb-p3` of the 172 matrix (lemon / mozzarella / shiso / whitebait; cheese base; thin dough; no blocker, READY). The live-site re-check (Issue #527 D4) is still blocked by the network policy; the composition stays provisional until the Owner re-confirms it.
- **Counts and the bake window are GAMEPLAY CALIBRATION (provisional): the Owner confirms them on Preview.**
- **Bake window = 58-78, deliberately.** `FREE_COOK_BAKE_TARGET` (the Free Cooking generic window, #482 / #520) is the *median* of the shipped recipes' windows. A first draft used 56-76 (like 7a / 8a); with the 61st recipe the median start moved 58 -> 56 and the generic window changed (`bake5.test`, `gameReducer.failedResearch.test` failed). 58-78 equals the current median, so the generic window, the Completion Gate for Free Cooking and every Owner-decided bake rule are unchanged.
- New materials (`ingredients.ts`): `shiso` (大葉, herb, `bakeRoastResistant`, size class xs, pack 10 = 10 x k with k = 1, `pieceVisual: "shiso-leaf"`), `whitebait` (しらす, seafood, size class s, pack 30, `pieceVisual: "whitebait-school"`). Family rows carry an `OD-B8-2` comment; **L1 only, no L2**.
- `shirasu-pizza`: `ladderCredit` true (credited 56 -> 57), `lunchRush:false`, no CUT, permanently key-free Hint, one single-member Research cohort, schema v2 unchanged, no new mechanic, no new sauce type. Reference pizza on the RT-01 8-slot ring in `requiredIngredients` order (`LIGHT_LEAF` for shiso).
- Totals (derived; `catalogLedger.test.ts` is the one ledger): **61 recipes / 66 ingredients (toppings 52; herb 7, seafood 8) / 54 ladder steps / credited 57 / chapter sizes 6, 11, 18, 26 / Lunch Rush pool 25.**
- Research: the cohort has one member, so the label is the bare `？？？ピザ（しらす）` and **no existing recipe changes its letter** (the manifest has no `acceptedLetterShifts`; the validator enforces that).

### Art (OD-B8-2, amended by the PR #580 Owner Decision of 2026-10-20)

The first draft drew shiso as 🍁 and whitebait as 🦑 (provisional emoji). **The Owner did not adopt them**; both materials now have dedicated art (a green leaf, small white fish).

**Rendering-method survey (done before any change).** Every ingredient glyph is read in one place (`IngredientGlyph`, the audited `.emoji` reader): without `pieceVisual` it prints the emoji, with one it draws a dedicated inline SVG (Style Lock v2 `pieceVisual` method; existing users: capers, clam, fresh-tomato, sausage, feta, ricotta, hot-dog). Tray chips, drag preview, placed pieces, Shop, Inventory, Dex, Hint, RESULT, thumbnails all go through it, so a `pieceVisual` reaches every context with no call-site change; non-cheese pieces already route through `IngredientPieceVisual` -> `IngredientGlyph`. Options considered: (a) another emoji — none left that is both unique and apt (rejected by the Owner); (b) a new field / renderer — unnecessary; (c) **two new `DedicatedIngredientVisual` values on the existing method — chosen (minimal)**.

**What changed (and only this).**
- `ingredients.ts`: two union members `shiso-leaf` / `whitebait-school`; `pieceVisual` on the two Batch 8b rows. `emoji` stays only as the required, never-displayed text fallback: 🍂 (shiso) / ⚪ (whitebait), shared with no other ingredient and not a class symbol (G18 holds: `hint5Taxonomy.gate` passes). 🍁 and 🦑 are used by nothing.
- `IngredientGlyph.tsx`: two small components, 64x64 viewBox, Style Lock v2 common spec (two-tone, line width about 2.4, ground shadow, **no `id` / gradient / `<defs>`**, decorative `aria-hidden`). The emoji path and every existing visual are byte-identical.
- `App.css`: one rule scoped to `.ingredient-glyph--shiso-leaf` / `--whitebait-school` (1.2em, the same fix class as `--tomato-slice`), because the art sits inside a 64-box margin and reads smaller than emoji that overfill their box. No existing selector touched.
- Reference art for the Owner: `docs/design/references/ingredient-icons-2.0/shiso.svg` and `whitebait.svg` (same folder and spec as the 25 Style Lock art files; these two are Batch 8b additions, not part of the Style Lock v2 decision table).
- Not touched: the other 7 dedicated visuals, every emoji row, cheese CSS, Save schema (`pieceVisual` never reaches a save), discovery / shop / recipe logic.
- `salmon-roe` (Batch 8c) is not touched here; its art will follow the same method in 8c (the earlier 🟠 proposal is superseded).

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
| dedicated art | `IngredientGlyph.test`: `DEDICATED` + the dedicated-row map gain the two visuals (the existing per-visual checks — SVG, no emoji text, viewBox 64, no `id` / `url(#`, id-independence — now cover them) and a new Batch 8b block pins the production rows (glyph and placed piece draw the SVG, nothing is printed, 🍁 / 🦑 are used by nothing, the two fallbacks are shared with no other ingredient) |
| e2e | `expansion-batch7a.spec.ts` pins `LAST_STEP = 53` (it used `DISCOVERY_LADDER.steps.length`); new `expansion-batch8b.spec.ts` (asserts the dedicated SVG in the Shop row and on the tray chip, and that the glyph slot prints no emoji) |

## 5. Verification (final HEAD of this revision)

- Full Vitest (Node 22): **477 files passed, 1 skipped; 8955 tests passed, 2 skipped, 6 todo; 0 failed** (includes the Recipe Batch Validator, catalog ledger, Hint 5.0 golden, DH4 / Hint 5.0 production gates, G7 / G17 / G18 (`hint5Taxonomy.gate`), `finalizeRound`, `researchLabels.batch8a`, `IngredientGlyph`, materialShop, ladder, chapters, Lunch Rush exclusion).
- `tsc -b` clean; `oxlint` 0 errors (pre-existing warnings only, none in the changed files); `npm run build` passes.
- Representative E2E `e2e/expansion-batch8b.spec.ts`, iphone-390x844 and iphone-360x800: **2 / 2 PASS** (re-run on the dedicated art, with screenshots and video). The 7a / 8a specs passed on the first revision (the art change does not touch them); the whole-suite E2E and WebKit of this HEAD are in the CI / PR record, not carried over from the first revision.
  - step 54: Shop NEW shiso (pack 10) and whitebait (pack 30) at 120 Pitz, each drawing its dedicated SVG -> purchase -> Research label `？？？ピザ（しらす）` with no recipe identity in the DOM -> tray chips draw the SVGs -> cook with **no sauce step** -> NEW DISCOVERY -> Dex (Chapter 4 complete, schema v2).
- WebKit: CI only (not installed locally).

## 6. CI / review record

**First revision, HEAD `bec3ab7` (recorded only; NOT reused for this revision's Final Gate).** All 11 checks on that head ended `success`: build, layout-chromium, Layout Contract Gate, classify, webkit 390x844 shards 1-3, webkit 360x800 shards 1-3, WebKit Gate. Codex review of `bec3ab7` completed with no findings. The first revision also had a local whole-suite Chromium run (812 passed, 0 failed, 38.4 min).
**This revision:** the new HEAD's CI and Codex review are tracked on PR #580 and are the Final Gate evidence; nothing from `bec3ab7` is carried over.
The E2E run writes stray screenshots under `docs/reports/screenshots/cooking-tray-family-filter/`; they are not part of this change and are deleted before every commit.

## 7. Owner Human Verification (390x844)

Screenshots: `docs/reports/screenshots/expansion-batch8b/` (6 shots x 390x844 / 360x800: shiso NEW, whitebait NEW, tray, Research entry, NEW RECIPE, Dex), regenerated on the dedicated art. Reference art: `docs/design/references/ingredient-icons-2.0/shiso.svg` / `whitebait.svg`. The 390x844 Review Playthrough video is delivered directly, never committed (recorded against a local build of this branch; the shared Preview was not updated).

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---:|---:|---:|---|
| `batch8b-review-390x844-v2.mp4` (H.264, converted from Playwright WebM) | 390×844 | 28.3 s | 654,188 B | PASS |

Download: delivered directly in the session (not committed). Video Verification: PASS (exists, size > 0, plays to the end, full viewport, ffprobe: h264 390x844; the frames show the new art).
Shows: Shop NEW shiso + whitebait -> purchase -> Research entry `？？？ピザ（しらす）` -> tray (leaf / white fish) -> cooking with no sauce step -> NEW DISCOVERY -> Dex. An automated walkthrough held at each screen (1-3 s); the Owner's own HV result words (PASS / FAIL) are the Owner's to write.
Check: the leaf and the white fish at 20-28 px on the tray, Shop, placed pieces and RESULT (is the whitebait legible against the cream dough?); the NEW 120 Pitz rows (packs 10 / 30); the Research entry naming only `しらす`; the missing sauce step; the 8-piece ring look; **the provisional counts and bake window (58-78, approved)**.

## 8. Not done / limits

- Batch 8c (ikura-salmon / salmon-roe / step 55, including its art) starts only after PR #580 is merged. No CUT / Lunch Rush / mechanic change, no L2 tag.
- **The pizzadb.jp source is still unverified** (Issue #527 D4; the agent proxy denies the host): the composition rests on the repository's 172-matrix evidence row and stays provisional until the Owner re-confirms it.
- `PROJECT_HANDOFF.md` gets a short addendum only; the stale "PR pending" wording of the Batch 7a / 8a addenda is left as written (Owner decides).
- WebKit runs in CI only.
