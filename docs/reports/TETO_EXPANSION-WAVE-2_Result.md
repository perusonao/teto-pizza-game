# Expansion Wave 2 — vongole / pesto-vegetariana / ratatouille-pizza — Result

Branch: `claude/expansion-wave-2-73em4s` (new implementation branch; the Preflight branch was not reused). Implementation (not an audit) after the Fresh Audit / Preflight. One Wave = one PR.

## 1. Base and Duplicate Gate

| | |
|---|---|
| Base `origin/main` (fresh fetch) | `3b1a0eef4efa723e63d65d16a084625754623061` (= the Preflight SHA; main had not advanced) |
| Duplicate Gate | no open PR / issue / branch implements Expansion Wave 2. `claude/wave2-runtime-recipe-design-os06j1` is the unrelated, older "W2-A" material track (no merge base with `main`); open PRs are old docs / audits. |

## 2. Owner Decisions applied

| | vongole (No.13) | pesto-vegetariana (No.14) | ratatouille-pizza (No.15) |
|---|---|---|---|
| required | olive-oil 1, clam 3, garlic 2, parsley 2 | pesto 1, mozzarella 2, eggplant 2, zucchini 2, bell-pepper 2 | tomato-sauce 1, eggplant 2, zucchini 2, bell-pepper 2, oregano 1 |
| sauce / interaction | olive-oil / `PAINT_TEMPORARY` | pesto / `PAINT` | tomato-sauce / `PAINT` |
| cheese | none | mozzarella | none |
| bakeTarget (GAMEPLAY CALIBRATION) | 62–82 | 50–70 | 58–78 |
| ladderCredit / Lunch Rush / CUT / Hint | true / false / none / key-free | same | same |
| requestedBy | mito | mito | mito |

Texts (name / description / order line) are exactly as specified. `RECIPES` declaration order = vongole, pesto-vegetariana, ratatouille-pizza (appended after pesto-gamberi). No `KEY_TOPPING` / `hintKeyToppingId` was added. The bake targets are commented as gameplay calibration, not source authority.

**Vongole olive-oil boundary.** `olive-oil` is vongole's own existing sauce-slot mapping (`PAINT_TEMPORARY`, exactly like `pizza-bianca`; recorded in the `recipes.ts` and `recipeSauceProfiles.ts` data comments). It is **not** a general "no-sauce family = olive-oil sauce" rule. TQ-1D / NO_SAUCE authority is unchanged: `olive-oil` is a sauce-category ingredient, so all 31 recipes still have exactly one sauce, and the DH4-PROD gate ("no NO_SAUCE (Technique) recipe exists yet") passes untouched.

Ingredients: `parsley` (パセリ, topping, herb, ☘️ U+2618 U+FE0F, `bakeRoastResistant`), `bell-pepper` (パプリカ, vegetable, 🫑), `zucchini` (ズッキーニ, vegetable, 🥒). G18 holds (no Hint class symbol equals any ingredient glyph); a future glyph clash with e.g. cucumber is not a blocker. No starter grant, no recipe `unlockCondition`.

Economy (derived by the existing material-shop authority, nothing hand-written on the ingredients): parsley step 27, bell-pepper / zucchini step 28, all T3, first 100 / refill 50 Pitz, k = 2 → pack 20.

## 3. Production change (9 data files, nothing else)

`src/data/{recipes,ingredients,ingredientTaxonomy,discoveryLadder,discoveryCatalog,recipeSauceProfiles,recipeHintRoles,orders,referencePizza}.ts`. No reducer / persistence / save schema / component / mechanic / CUT allowlist change. Discovery target ids are the 172-matrix evidence ids (`vongole-pizzadb`, `pesto-vegetariana-pizzadb-p12`, `ratatouille-pizza-pizzadb-p13`). References put the pieces on the RT-01 8-slot ring in `requiredIngredients` order (7 / 8 / 7 pieces); parsley and oregano land `LIGHT_LEAF`.

**Final counts**

| | before | after |
|---|---:|---:|
| recipes | 28 | **31** |
| ingredients | 31 | **34** |
| toppings | 24 | **27** |
| ladder steps | 26 | **28** |
| credited recipes | 27 | **30** |
| chapters | 6 / 10 / 12 | **6 / 10 / 15** |
| Lunch Rush opt-outs | 3 | **6** |
| HAND capacity / save schema | 12 / v2 | 12 / v2 |

**Ladder 27 / 28.** Steps 1–26 are frozen (pinned by the append-only tests). Step 27 = `parsley` → key recipe `vongole`. Step 28 = `bell-pepper` + `zucchini` → key recipe `pesto-vegetariana`; `ratatouille-pizza` becomes makeable at the same step — the intended **Branching Discovery** (Research Entry pool 2, both credited). `ladderCredit` was not changed to false for ratatouille. The production ladder equals the REC-04 rule applied append-only (steps 1–25 fixed, 26–28 derived). Terminal state of Wave 2 is fine.

**Carry-over to the Wave 3 Preflight (explicit):** the next Wave's slack becomes **+1** — `ratatouille-pizza` is credited but nobody's key recipe, so the 30 credited recipes sit behind 28 steps + margherita (30 = 28 + 1 + 1 non-key).

## 4. Test / pin migration (no assertion weakened)

New: `src/state/discoveryExpansion2.wave2.test.ts` (24 tests: exact 3 recipes + exact texts / identity / counts / bake / reward, exact 3 ingredients + glyph / taxonomy / roast flag, G18, derived economy, steps 27 / 28 and 1–26 frozen, T3, chapter No.13–15, ladderCredit true, Branching Discovery pool 2 (both orders), no identity collision, key-free (no KEY_TOPPING, no CHEESE rung where no cheese), no CUT, Lunch Rush false / total 6, vongole olive-oil mapping, no TQ-1D activation, save v2, HAND 12, no progression softlock under first / last pick policies), the parity fixture `scoreParity.expansion2-wave2.json` (own fixture; the frozen 25 / calabresa / pollo / gamberi fixtures untouched; ideal = 99.54 / 5★ for all three), and `e2e/expansion2-wave2.spec.ts`.

Migrated only what the Wave legitimately changes: 28→31 recipes, 31→34 ingredients, 24→27 toppings, 26→28 steps, chapters …/12→…/15, Dex denominators (`N/28`→`N/31`), Pizza Select (7/8/8/5 → 7/8/8/8; chapter 0/15), Dex slots, Inventory totals, shelf distribution (vegetable 8→10, herb 4→5; the 62-row synthetic catalog now classifies 24 / unclassified 18 because the 3 ids joined the taxonomy), LC fixtures (runtime catalog 34 × 31), tray pager (27 toppings → 5 pages of 6; HAND OFF / ON Dinner & FREE pins), economy table, Lunch Rush exclusion (opt-out total 6), Dinner D-P windows (32 windows / 12,864 cases = 32 × 402), cooking-profile matrices (no CUT, no CHEESE step for vongole / ratatouille), TQ-1C `SAUCE_ONLY` 50 → 59 (+9 at steps 27 / 28), `selectableHint` (the credited W1 measurement still excludes every appended-step recipe, 515), the DH4-1 audit JSON (regenerated; only candidate-universe counts grew by the 3 toppings), hint5 economy walk (the step-28 pair is a pool 2: the walk finds pesto-vegetariana blind, so only ratatouille is hinted — same mechanism as the calabresa), the branching / W1 fixtures now exclude the appended-step recipes (`W1_RECIPES`, `PRODUCTION_W1`, `hintTarget`) instead of weakening assertions, `discoveryHint.walk` (the blind pick falls back to the pool's first when no non-credit recipe is in a pool-2; last stage has no step of its own, so "first stage at a ladder count sells" only applies to counts that are ladder steps).

Slice 1 / No.27 tests that described "everything discovered" were re-scoped to their own slice (e.g. after pesto-gamberi the next target is now vongole).

## 5. Verification (each run once per HEAD, except where stated)

| check | result |
|---|---|
| `tsc -b` / `npm run build` | clean / built |
| `oxlint` | 0 errors; the only warnings are in the untouched `scoringV2.noSauceProfile.test.ts` (pre-existing, identical on `main`) |
| Full Vitest (final HEAD) | **338 files / 6153 tests pass, 1 skipped** (pre-existing skip) |
| Focused (Wave 2) | `discoveryExpansion2.wave2.test.ts` 24 / 24; G18, G7, Hint5, DH4-1 / DH4-2A, TQ-1C, Dinner windows, score parity, economy, progression, branching pool, Research Entry, Contract 2.1, #378, Lunch Rush exclusion all green inside the full run |
| Chromium E2E, `iphone-390x844`, full project | 216 tests: 162 passed, 11 skipped, **43 failed**, all legitimate pins (Dex pill `/28`→`/31`, step counts, chapter totals, topping counts, hint-sheet COMPLETE seed, shelf rows, Slice 1 / No.27 CTA flow) — migrated; the 20 affected specs + the new spec re-run: 54 passed (1 `discovery3-no27-pesto-pollo` Notebook test failed once under 4-worker load and passed alone, 2 / 2) |
| `layout-chromium` | 12 / 12 |
| New spec `expansion2-wave2` at **390×844** and **360×800** | 3 tests × 2 widths: 6 / 6 pass |
| WebKit | not run locally (left to the required `e2e-webkit` PR gate) |

Golden note: `TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json` (a Chromium-only comparison that the WebKit PR gate does not run) had not followed shrimp (Expansion Slice 1) and did not follow Wave 2 either; re-baselined with the same helpers from the rollback build (only the `free22.*` topping snapshots changed; `rebaselineNote2` explains). This is outside the 9 production files (test data only). The `research-stock-blocked-378` spec needed no seed change (its seed ladder is step ≤ 25).

## 6. Contracts held

- Hint 5.0 key-free: rungs vongole = SAUCE(olive-oil), STRUCTURE, SUB_CLASS ×3; pesto-vegetariana = SAUCE, CHEESE(mozzarella), STRUCTURE, SUB_CLASS ×3; ratatouille = SAUCE, STRUCTURE, SUB_CLASS ×4 — no KEY_TOPPING anywhere, no CHEESE rung without cheese. In the sheet the SAUCE rung reads オリーブオイル (screenshot below).
- Contract 2.1 / anti-oracle: the E2E sweeps the whole DOM for undiscovered recipe identity at the Research Entry (pool 1 and pool 2), RESULT, Notebook and Hint sheet; the pool-2 Dex shows two anonymous cards with no digit and no aggregate card; no near / far / candidate wording.
- #378: parsley owned with stock 0 → fixed notice 「研究を続けるには材料の補充が必要」 (no recipe name, ingredient list, number), Shop 「在庫なし」 → refill → Research resumes (existing generic behaviour; no new branch).
- Lunch Rush pool excludes all three (discovered + owned + in stock). Save: `schemaVersion` 2, no persistence file touched. HAND capacity 12 (the tray pager now shows 5 pages for 27 toppings in Dinner / HAND-OFF pins — a consequence of the topping count, not of any HAND change).

## 7. Human Verification

Real operations at 390×844 (and 360×800 for the screenshots / E2E). **Only the starting save is seeded; no RESULT, Hint, Research or discovery state was seeded in place of an operation.** Horizontal overflow is asserted at every state (none); no console errors.

- **Step 27:** Shop parsley NEW (☘️, 10ピザ分（20個）, 初回 100 Pitz) → purchase → Research Entry → Research vongole → trial (olive-oil, parsley, clam, eggplant) → RESULT chips (オリーブオイル○ / あさり○ / ナス×, パセリ ✓ as the known unlock) → Notebook → Hint 5.0 (SAUCE rung オリーブオイル) → exact recipe → NEW RECIPE → Dex 第3章 No.13. The parsley roast tint is asserted against the clam's (gentler, `bakeRoastResistant`).
- **Step 28:** bell-pepper 🫑 + zucchini 🥒 NEW together → purchase → Research Entry pool 2 → target ① → trial → RESULT → Notebook → Hint → pesto-vegetariana discovered → remaining target (ratatouille) → discovered → Dex 31 / 31, No.14 / No.15, 第3章 15/15.
- **#378** stock-block loop with parsley.

### Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `expansion2-step27-vongole-390x844.mp4` | 390×844 | 46.2 s | 1.07 MB | H.264 | PASS |
| `expansion2-step28-pool2-390x844.mp4` | 390×844 | 62.8 s | 1.33 MB | H.264 | PASS |
| `expansion2-378-stock-block-390x844.mp4` | 390×844 | 9.6 s | 0.22 MB | H.264 | PASS |

Converted from Playwright WebM with ffmpeg, checked with `ffprobe`. Delivered directly in the session; **not committed** (per the Policy; `artifacts/` is gitignored).

Screenshots (committed): `docs/reports/screenshots/expansion-wave-2/` (21 states × 2 widths = 42 files): before / after pairs `exp2-shop-parsley-new` → `-bought`, `exp2-shop-bell-pepper-new` / `exp2-shop-zucchini-new` → `exp2-shop-step28-bought`, `exp2-378-dex-stock-blocked` → `-shop-zero-stock` → `-research-resumed`; plus `exp2-research-entry-vongole`, `exp2-vongole-result-research-mark`, `-notebook`, `-hint5-sauce-rung`, `-new-recipe-discovered`, `exp2-dex-no13`, `exp2-pool2-research-cards`, `-result-research-mark`, `-notebook`, `-hint5`, `-new-recipe-pesto-vegetariana`, `-new-recipe-ratatouille`, `exp2-dex-no14-15`.

HV evidence type: real-operation Playwright walkthrough (H.264 video at 390×844 + committed screenshots at 390×844 / 360×800).

## 8. Docs touched

`docs/PROJECT_HANDOFF.md` (Expansion Wave 2 addendum with the new authority counts and the Wave 3 carry-over), `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` (regenerated), the LC-R6b golden (re-baselined, see §5).

## 9. Privacy

No personal data, credentials, e-mail addresses or tokens in any committed file; videos are not committed. The screenshots are test-seeded game states.

## 10. Status

PR opened, **not merged**, no auto-merge. Codex review / Final Gate are the next instruction. Expansion Wave 3 is not started.
