# Discovery Hint 4.0 — DH4-PROD: 構成 / 特徴 Production Enablement (Result)

> **Status:** Implementation. Part of #253. Owner iPhone Human Verification is required before merge.
>
> **Scope**
> - 構成 (structure) and 特徴 (attribute) hints become available in production at a **fixed** price: 構成 5 Pitz, 特徴 5 Pitz.
> - The feature was already built and verified in DH4-2A / 2B / 2C. Nothing is rebuilt. The change is the flag, the price source and tests.
> - **Unchanged:**
>   - 材料 hint behavior and its ESC ladder (5 / 10 / 20 / 40);
>   - the save schema (v2, no new key);
>   - the matcher, recipe discovery, scoring, ranking, Dinner and Lunch Rush;
>   - Cooking Techniques (TQ-1C / TQ-1D / PR #289);
>   - near-miss;
>   - #260 and #275.

## 0. Owner Authority

### OD-DH4-PROD-1: fixed initial production price (decided and confirmed by the Owner on 2026-09-28)

| Item | Decision |
|---|---|
| Option | **B. Fixed price.** Chosen from the Fresh Gate options (A: reuse the shared ESC rung, B: fixed price, C: DH4-ECON first) |
| 構成ヒント | **5 Pitz** |
| 特徴ヒント | **5 Pitz** |
| 材料ヒント | Current ESC pricing unchanged (5 / 10 / 20 / 40) |
| Ladder | 構成 / 特徴 are **not** mixed into the 材料 ESC ladder. A deduction purchase never moves the 材料 price, and the 材料 paid count never moves the deduction price. |
| Acquisition / storage | Per recipe, as the existing authority says (OD-DH4-2-1..13; T1a, OD-DH4-2B-G1) |
| DH4-ECON | **Not a blocker.** 5 / 5 is the *initial* production price; DH4-ECON may re-tune it from real data. |
| Never | 0 Pitz in production · re-charging a purchased fact · a charge when no new fact can be returned · a double charge from a stale or double request |

**What it supersedes:**
- **OD-DH4-2-5 (E3):** the "DEV / Preview only" and "production prices come from DH4-ECON" parts. The rule "no 0-Pitz production price" and the unchanged 材料 ESC stay.
- **OD-DH4-9:** the timing only. Production ships before DH4-ECON; DH4-ECON keeps the right to change the numbers.

## 1. Fresh Gate (before enabling)

**Re-run on 2026-09-28 against `main` `d38cf22`, which includes TQ-1C.** TQ-1C was merged as PR #289 (Issue #287); TQ-1D has not started. `d38cf22` is merged into this branch. The gate below holds on that base; §1.2 adds the TQ-1C runtime audit. Verdict: **A. READY.**

| Check | Result |
|---|---|
| `main` at the start | `c9e5e1f` (Merge PR #286) |
| Duplicates | #253 OPEN; #277 (2B) and #283 (2C) CLOSED; **no DH4-ECON / H3-ECON-1 issue or PR**. None created. |
| Cooking Techniques | PR #289 (TQ-1C) OPEN at `253dc8d`. Read only; not touched. |
| What disabled production | `src/logic/discovery/deductionFlag.ts`: `DEDUCTION_HINTS_ENABLED = DEV \|\| VITE_PREVIEW_MODE` (one line) |
| Existing DH4 / hint tests on `main` | 170 / 170 pass (12 files) |
| Gate verdict | **A. READY** (after OD-DH4-PROD-1) |

### 1.1 Privacy gate on real data

New test: `src/logic/discovery/deductionProduction.gate.test.ts`.

**States:** 2,244 in total.
- The 300 ladder states: every target at its own step and every later step.
- 24 "everything owned" states.
- 40 seeded random acquisition orders × 24 recipes × 2 points: the first makeable prefix, and everything owned.

| Property | Result |
|---|---|
| k ≥ 2, including the topping clause: the guarded answer never narrows the reserve to one candidate | **0 violations** |
| Independent attacker: it does not read the guard's hypothesis set, and uses the catalog, Rule W, the key and the priors | **0 leaks** |
| Coarse / existence fallback | Answers seen: `category:*`, `group:produce` and `existence` |
| Reserve outside H (a non-ladder order bought the reserve after the key) | Fails closed: existence, no clause |
| 「その他」 (provisional copy, OD-DH4-2-9) | **Unreachable**: no `family:other` / `group:other` answer in any state |
| Pitz charged only when a real new fact is produced | Holds in every state. ANSWERED = 5; EXISTENCE_ONLY / GUIDANCE_ONLY / ALREADY_OWNED = 0; asking again after an answer = 0. |
| Lines | Positive facts from the fixed templates only. No ingredient or recipe name, recipe description or ASCII id. No 「？」, 残り, あと, 0種類 or absence wording. |
| Pre-purchase leak | An unaffordable request is refused as `INSUFFICIENT_PITZ` for every target and family, before any answer is computed |
| DOM (App, `src/App.hintSheet.test.tsx`) | No recipe name, description or id in the text or in any attribute (`aria-*`, `data-*`, …), and no `<img>`: on the panel before a request, after 構成, after 特徴, and after a reload |

**A pre-existing finding, not caused by DH4.** In some random acquisition orders, Rule W plus a fully known 材料 part already leaves a single candidate (|H| = 1) for `melanzane-pizza` and `parmigiana-pizza`, with no 構成 / 特徴 answer at all.
- This is the Hint 3.0 class already recorded in #253 ("ladder pairs: the capricciosa and quattro-formaggi reserves are public").
- DH4 adds nothing there: the answer is existence and the clause is not told. The test pins this.

### 1.2 Cooking Techniques privacy (TQ-1C runtime included; TQ-1D contract)

**TQ-1C runtime (`d38cf22`).** It adds `discoveredTechniqueIds` / `lastTechniqueDiscovery` to the reducer and the save, and `src/logic/techniques/runtime.ts`.

**INV-TQ-4 holds, proven with the runtime's own functions:**
- `productionTechniqueContext().catalog` is `RECIPE_DISCOVERY_CATALOG`: 25 targets, one for each production recipe;
- `requiredTechniquesOf` is `[]` for every target;
- `techniqueAffordanceStep` is `null` for every technique;
- so no technique can be recognised in production.

**The hint path never reads Technique state:**
- no technique import or ledger field appears in the deduction, hint or `discoveryHint` modules, in `HintSheet.tsx` or in the taxonomy (source scan);
- through the real reducer, a ledger holding `no-sauce` leaves the sheet view and every 構成 / 特徴 / 材料 result identical, for all 24 targets.

**TQ-1D is not a blocker. The contract is fixed in three places:**
- the gate test fails as soon as a production target requires a technique;
- this report;
- `docs/PROJECT_HANDOFF.md` (the Cooking Techniques section).

**From the first gate run:**

- All 25 production recipes have **exactly one sauce**, so no production recipe is a NO_SAUCE (Technique) recipe.
- 構成 / 特徴 read `requiredIngredients` only.
- In every gate state:
  - no stored id is anything other than `meta:ingredient-total`, `meta:topping-total` or `attr:(family|group|category):…`;
  - no line contains a Technique id, name or riddle, or any sauce-absence / technique wording.
- 構成 total = the recipe's distinct ingredient count. Checked for all 24 non-onboarding recipes.
- **Contract:** the one-sauce test fails as soon as a production recipe has a sauce count other than 1. TQ-1D must then re-run this gate and the DH4 privacy sweeps with its Technique recipes before shipping them. No Technique copy or near-miss changes here.

## 2. Change

| File | Change |
|---|---|
| `src/logic/discovery/deductionFlag.ts` | `DEDUCTION_HINTS_ENABLED = true`, a constant with no env condition. It stays one line, so a rollback is one line. `DEDUCTION_HINT_PRICE = { structure: 5, attribute: 5 }`. |
| `src/state/discoveryHint.ts` | `deductionPricing` takes the price from `DEDUCTION_HINT_PRICE[family]` instead of `selectableHintBatchPrice(paidCount)`. The paid count is unchanged and is now only the STALE token. |
| `src/logic/discovery/deductionRequest.ts` | Comment only |

**Unchanged:**
- The DH4-2A authority, the guard, T1a, the taxonomy, the sheet UI and CSS.
- The reducer and the save format.
- `VITE_PREVIEW_MODE` still gives Preview its own save key.

## 3. Tests

**Updated: `src/state/gameReducer.deductionHint.test.ts`**
- Economy tests for 5 / 5:
  - the price does not follow the 材料 paid count;
  - deductions never move the 材料 ladder;
  - parity: after 構成 + 特徴, the 材料 ladder still reads 5 / 10 / 20 / 40.
- An old legacy-ladder save pays 5 for 構成, while its 材料 price stays 20.
- Already covered there and still green: stale / double request, insufficient Pitz, legacy total ownership, unknown / future ids, reload, Full Reset, Dinner / onboarding / closed-sheet no-op, and T1a through the reducer.

**Updated: `src/state/gameReducer.deductionHint.flagOff.test.ts`**
- It is now the rollback parity test.

**New:**
- `src/logic/discovery/deductionProduction.gate.test.ts` (§1).
- `src/App.hintSheet.test.tsx`, 2 tests:
  - the real App: 構成 then 特徴 at 5 each, the save diff (Pitz and `discoveryHintFacts` only; schema 2), the DOM leak sweep, and a reload with no resale;
  - insufficient Pitz (4) with nothing saved.
- `e2e/discovery-hint-sheet.spec.ts`:
  - 構成 + 特徴 through the real sheet;
  - the board with the three sections, checked on every Layout Contract profile (390×844, 360×800, 390×664, 360×640, plus the Chromium safe-area profiles): no horizontal overflow, controls ≥ 44 px, safe area respected, background unmoved;
  - a reload.

## 4. Verification

| Check | Result |
|---|---|
| Focused DH4 / hint tests (deduction*, gameReducer.deductionHint*, HintSheet, App.hintSheet) | Green |
| Production privacy gate (`deductionProduction.gate.test.ts`) | 14 / 14 (TQ-1C INV-TQ-4 and hint-path isolation included) |
| DH4 + TQ-1C focused suites (deduction*, hint sheet, App hint, techniques, reducer techniques, App techniques) | 19 files, 256 passed |
| Full Vitest | **215 files, 4509 passed, 1 skipped** (on the `d38cf22` merge base; the earlier run on `c9e5e1f` was 211 files, 4465 passed) |
| `tsc -b` | Clean |
| Lint (`oxlint`) | 0 errors. The only warnings are 2 pre-existing ones in an unrelated scoring test. |
| `npm run build` | OK |
| Chromium e2e: `discovery-hint-sheet` (390×844 project; all 7 Layout Contract profiles, including 390×664, 360×640 and safe area) | **7 / 7**, including the new DH4-PROD test |
| Chromium e2e: full suite (`iphone-390x844`, `iphone-360x800`, `layout-chromium`) | See the PR |
| WebKit | CI WebKit Gate on the PR head |
| Production build (no DEV, no `VITE_PREVIEW_MODE`), driven in Chromium at 390×844 | 構成 / 特徴 are live at 5 / 5. Pitz goes 100 → 95 → 90, then 85 after one 材料 request (5, unchanged). A reload keeps everything. |

**One existing e2e expectation changed, and it is intended.**
- In `purchase CTA … insufficient`, a legacy buyer with 25 Pitz faces a 40-Pitz 材料 request, which is still disabled.
- 構成 / 特徴 now cost 5, so they are affordable. The sheet's existing rule moves focus to the first open request, which is now 構成 instead of もどる.

## 5. Human Verification

This is a visible production UI change. The PR stays unmerged until the Owner's iPhone Human Verification on the dedicated Preview passes.

### Screenshots

In `docs/reports/screenshots/dh4-prod-enablement/`, 390×844. Production builds with the same save: Dex 11 and 100 Pitz, target capricciosa.

| File | What |
|---|---|
| `before-01-board.png`, `before-02-panel.png` | `main` (`c9e5e1f`) production: the panel has the 材料 card only |
| `after-01-board.png` | This branch: the board before any request |
| `after-02-panel.png`, `after-03-panel-scrolled.png` | 材料 / 構成 / 特徴 cards, all 「たずねる 5 Pitz」 |
| `after-04-after-structure.png` | 構成 answered: 「このピザは全部で6種類の材料を使うよ」 / 「トッピングは4種類使うよ」, 95 Pitz |
| `after-05-after-attribute.png` | 特徴 answered: 「まだわかっていないトッピングがあるよ」, 90 Pitz |
| `after-06-owned.png` | Both families read 「✓ もらいずみ」; the 材料 card is still 5 Pitz |
| `after-07-after-material.png` | 材料 request at 5 (ladder unchanged), 85 Pitz |
| `after-08-reload.png` | After a reload: every line is back, 85 Pitz, nothing charged |

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `dh4-prod-hv-390x844.mp4` (H.264, 25 fps) | 390×844 | 28.6 s | 522 KB | PASS |

Download: delivered directly in the session (never committed; `artifacts/` is gitignored).

Video Verification: PASS. `ffprobe`: h264, yuv420p, 390×844, 28.56 s. A frame at 17 s shows both families 「✓ もらいずみ」 at 90 Pitz.

**What the video shows:**
- the production build and the path Free Cooking → 具材 → 「ヒント」;
- the panel with the three cards at 5 Pitz;
- 構成 answered (−5), then 特徴 answered (−5);
- both 「✓ もらいずみ」;
- 材料 still 5 (−5);
- close, reload, and the lines back with no charge.
