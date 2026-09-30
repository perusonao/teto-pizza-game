# Result: #256 Failed-Bake CUT Skip + Dinner UI Polish (S-256 / S-UI-1 / S-UI-2)

- **Owner Authority:** OD-CUT256-5 / OD-CUT256-6 and OD-DUI-1a / 2a / 3a / 5a, recorded 2026-09-27 (§1). Carried over unchanged: OD-CUT256-1..4, OD-DUI-4 / 6, OD-R7.
- **Gate:** `docs/reports/TETO_CUT-FAILED-BAKE-256_DINNER-UI_Implementation-Gate.md` (`61e32e9`)
- **Audited main:** `7bb0116` (fetched fresh; it moved from the gate's `51e0923`, see §2)
- **Branch:** `claude/teto-pizza-cut-ux-audit-1fdxaw`
- **PR:** OPEN, not merged, no auto-merge

## 1. Owner Decisions recorded (authority for this implementation)

| id | decision |
|---|---|
| OD-CUT256-5 | **Keep `LUNCH_RUSH_RULESET_VERSION` (`lunch-rush-v1`).** The formula, the Completion Gate range and the duration are unchanged; only the needless CUT time after a certain bake failure goes. In the measured model no run score drops and the best run of every profile is unchanged. A bump would not separate leaderboard storage anyway. |
| OD-CUT256-6 | **Use the full `failures` list.** Any UNDERBAKED / OVERBAKED → skip CUT (MISSING + UNDERBAKED → skip). MISSING only → keep CUT; thin sauce only → keep CUT. Never the primary reason alone. |
| OD-DUI-2a | **Target row V6:** names in up to 2 lines; thumbnail 24px above 700px height, 20px at or below. Re-verify the Layout Contract at 4 viewports and STOP if a stage diameter shrinks. |
| OD-DUI-1a | 🔍 at the chip's top-left, meaning "look at the 見本" (not a selection). ✓ stays top-right. No collisions at 4 viewports. Tap semantics unchanged (tap = reference only). |
| OD-DUI-3a | 「最後のピザ」 shows the actual pizza name + ★N when an identity exists; otherwise a privacy-safe category fallback. It never shows a headline, and never leaks an undiscovered name. |
| OD-DUI-5a | QUALITY_FAIL shows 「あと★N」, with N = the injected `minimumStars` − the actual ★, and nothing when N ≤ 0. No production S. No cause coaching (DM-5). |

## 2. Fresh GitHub Gate

- **`origin/main`:** `7bb0116`, which adds DH4-2A (#264 / #265) on top of `51e0923`.
  - None of its 25 files is touched here (no reducer, Completion Gate, Dinner, CSS or e2e file).
  - It was merged into the branch (`600c446`) before any change.
- **#256:** OPEN, no linked PR.
- **Open PRs:** none touches the cooking flow.
  - #259 (DM-4-1) changes only `dinnerSettlement*` and `dinnerRun.test.ts`.
  - #267 (DH4-2B) changes only `logic/discovery/deduction*`.
  - No duplicate.

## 3. Changed files

| slice | production | tests / e2e | tools / docs |
|---|---|---|---|
| **S-256** `cd972db`, `40d2459`, `d929387` | `src/logic/completionGate.ts` (+`bakeCompletionFailure`), `src/state/gameReducer.ts` (base CONFIRM_BAKE, Dinner guard, `dinnerResolve`), `src/mission/dinner/dinnerResultDetection.ts` (`cutWaivedFor`, `CUT_WAIVER_MISMATCH`) | new `gameReducer.cutSkipFailedBake.test.ts`; `gameReducer.cutStep.test.ts` (#27 split); `gameReducer.dinner.test.ts`; `dinnerResultDetection.test.ts`; new `e2e/cut-skip-failed-bake.spec.ts`; `e2e/support/dinner.ts`; `e2e/gestures.ts` (comment); `e2e/making-ui-1screen.spec.ts` and `e2e/finished-pizza-visual-2.0.spec.ts` (take-outs moved off the band edges, §10) | `tools/cut256_s256_mutation.py` |
| **S-UI-1** `da6f06c` | `src/state/dinnerView.ts` (`dinnerStarGap`, `dinnerLastPizzaLabel`), `src/components/DinnerGameUi.tsx`, `src/App.css` (`.dinner-attempt__gap`) | `dinnerView.test.ts`, `DinnerGameUi.test.tsx`, `e2e/dinner-mission.spec.ts` | — |
| **S-UI-2** `3b5dd26` | `src/App.css` (`.dinner-chip*` only), `src/components/DinnerGameUi.tsx` (🔍 span) | `DinnerGameUi.test.tsx` | `tools/dinner_ui_s2_verify.spec.ts`, before / after data and screenshots |

**Not changed:**
- `LUNCH_RUSH_RULESET_VERSION`, `calculateLunchRushMissionScore`, `functions/**`
- Completion Gate thresholds (`checkBake`, `BAKE_ACCEPTABLE_MARGIN_RATIO`), Scoring 2.0
- mission data (`minimumStars` stays `null`), DM-4 / DM-5, DH4, Dex
- `App.tsx`, `GameScreen.tsx`, `ResultPanel.tsx`, `MissionServePanel.tsx`

## 4. CUT skip: semantics

Skip the post-BAKE steps **iff** the Completion Gate's `failures` (the full list) contain UNDERBAKED or OVERBAKED. The skip applies in Guided, Lunch Rush and Dinner. Free Cooking has no CUT and is unchanged.

| pizza (margherita, band 50–90) | completion | CUT |
|---|---|---|
| normal PASS (70) | PASS | kept |
| ★4 badge 生焼け / 焦げ (50, 55, 85, 90) | PASS | **kept** |
| UNDERBAKED (5, 49) | FAILED | **skipped** |
| OVERBAKED (91, 98) | FAILED | **skipped** |
| MISSING only (no basil, 70) | FAILED | kept |
| thin sauce only (70) | FAILED `INSUFFICIENT_SAUCE` | kept |
| MISSING + UNDERBAKED (primary MISSING) | FAILED | **skipped** |
| MISSING + OVERBAKED | FAILED | **skipped** |

**SSOT / data flow:** the verdict is made once, by the existing Completion Gate, at CONFIRM_BAKE.

| layer | role |
|---|---|
| `completionGate.ts` | `bakeCompletionFailure(completion)` reads that result's `failures` and computes no band |
| base `CONFIRM_BAKE` | gates `postBakeSteps` on it |
| Dinner guard | reads it from the base result **before** clearing it, and passes it as `cutWaivedFor` |
| `resolveDinnerAttempt` | lifts `CUT_PENDING` only when its existing classification is `INVALID_PIZZA` whose `failures` hold the same reason. Otherwise it returns `CUT_WAIVER_MISMATCH` and nothing is consumed or completed (fail closed). **No Completion Gate is re-evaluated in Dinner.** |

## 5. D-P: base verdict vs Stage B (a formal test now)

`dinnerResultDetection.test.ts`, "D-P":
- **Scope:** 26 windows (the generic window plus all 25 recipe windows) × {empty, non-empty} × bake 0–100 in steps of 0.5.
- **Result:** **10,452 cases, all equal.** The count is asserted.
- **What is compared:** the base reducer's verdict (the sentinel recipe carrying the window) against Stage B's bake failure.

The runtime sweep ("D-P runtime") goes further:
- **Scope:** every CUT recipe's Reference pizza at bake 0–100 (> 2 000 checks), fed through the resolver with the forwarded verdict.
- **Result:** never `CUT_WAIVER_MISMATCH`. An out-of-band bake always resolves to `INVALID_PIZZA`; an in-band bake always stays `CUT_PENDING`.

## 6. Guided result

- **Out-of-band bake:** the 失敗 card appears at 取り出す, with no CUT screen (E2E, screenshots A1).
- **In band:** CUT is unchanged (A2).
- **FAILED rounds:** `REGISTER_TO_DEX` is still a no-op, so Dex, Pitz and BEST are untouched.
- **Timing:** Cooking Time (手際) is unchanged; `perStepElapsedMs.CUT` is simply absent.
- **Step tabs:** they never render at RESULT, so no half-finished カット tab can show.

## 7. Lunch Rush result

- **Out-of-band bake:** the FAILED serve panel appears at 取り出す with no CUT. 「次の注文へ」 moves on as before (E2E, B1).
- **Unchanged:**
  - A FAILED round still has a `score`, which `handleMissionServeNext` requires.
  - `SERVE` still logs FAILED with `qualityTotal` 0.
  - `MISSION_NEXT_ORDER` works from RESULT.
- **The only effect:** a failed pizza takes one CUT less time.

## 8. Dinner result

- **Identified CUT recipe, out-of-band bake:** resolves at CONFIRM_BAKE to `INVALID_PIZZA` (生焼け / 焦げ).
  - Stock is consumed exactly once (egg 3 → 2), and it equals what the resolver computes for the same pizza after a CUT.
  - `pending` is cleared, the attempt is logged, and **there is no soft-lock**: the next pizza starts, and CUT actions after the result are no-ops.
- **In band (including ★4 badges):** still requires CUT.
- **Unchanged:** TIME_UP at CONFIRM_BAKE, the HOME-dialog freeze, and unidentified compositions.

## 9. Leaderboard impact

- **No change:**
  - `LUNCH_RUSH_RULESET_VERSION` stays `lunch-rush-v1`
  - `calculateLunchRushMissionScore` (PASS 80 + FAILED 0 → 180)
  - the serve payload and the Cloud Function
  - Both are pinned by a new test.
- **Measured model (gate §6):**
  - Mean effect: +0.5–3 % for failure-heavy runs, at most one extra serve.
  - Runs made worse: 0. Best runs: unchanged.

## 10. S-UI-1 result

| state | before | after |
|---|---|---|
| QUALITY_FAIL (S=5, ★3) | 「マルゲリータ ★3（合格は★5以上）」 | same line + **「あと★2」** (screens C4) |
| CLEAR | 「最後のピザ：ブレックファストピザ完成！」 | **「最後のピザ：ブレックファストピザ ★3」** (D1) |
| INFEASIBLE after a duplicate | 「最後のピザ：これはもう完成済み！」 | 「最後のピザ：ビスマルク」 |

**Fallbacks:**
- ORIGINAL → 「オリジナルピザ」
- INVALID → 「ピザにならなかった」, or with the reason: 「ピザにならなかった（生焼け）」 / 「ピザにならなかった（焦げ）」
- COMPLETION_GATE QUALITY_FAIL, DUPLICATE and NON_TARGET → the name only (their views carry no ★ by design)

**Tests:**
- N is exact for every S = 2..5 × ★ = 1..S−1, and hidden when N ≤ 0.
- No label reuses a headline.
- ORIGINAL / INVALID labels contain no recipe name.

## 11. S-UI-2: target row and Layout Contract

Measured with the same tool on `origin/main` `7bb0116` (before) and this branch (after), Chromium. Data: `docs/reports/data/cut256-implementation/s-ui-2-{before,after}/`.

| viewport | PREPARE dough | BAKE dough | CUT dough | bar | thumbnail | names in full |
|---|---|---|---|---|---|---|
| 390×844 | 290 → **290** | 358 → **358** | 358 → **358** | 57 → 56.8 | 30 → 24 | 11 → **25 / 25** |
| 390×664 | 265 → **265** | 333 → **333** | 358 → **358** | 48 → 48 | 26 → 20 | 11 → **25 / 25** |
| 360×800 | 273.6 → **273.6** | 328 → **328** | 328 → **328** | 57 → 56.8 | 30 → 24 | 7 → **25 / 25** |
| 360×640 | 241 → **241** | 309 → **309** | 328 → **328** | 48 → 48 | 26 → 20 | 7 → **25 / 25** |

- **Diameters:** no stage diameter shrank (the STOP condition was not met).
- **Names:** at most 2 lines for every name. No horizontal page overflow.
- **🔍:** present on all 4 chips. No overlap with the name, thumbnail or ✓ (checked with a completed target). Not clipped.
  - The first version anchored 🔍 to the thumbnail. On the 2-line chip (ブレックファストピザ) it then sat 3 px above the chip and was clipped by the sideways-scrolling list.
  - It is now anchored to the chip's own corner (left 3px, top 2px).
- **Layout Contract** (`layout-chromium`, 7 profiles) and `stage-size-stability`: pass with no floor edited.
- **Tap semantics:** unchanged. A chip still only opens the 見本 popover (unit R27 and E2E R1 / R27). The button name is still 「○○の見本を見る」, and 🔍 is `aria-hidden`.

Screenshots: `docs/reports/screenshots/cut256-dinner-ui-implementation/{before,after}/<viewport>-{row,row-done,prepare,popover,cut}.png`

## 12. Tests

| check | result |
|---|---|
| focused (the 4 S-256 suites + Dinner UI suites) | pass (61 + 57 + 41 + 63 + 26) |
| **full Vitest** | **196 files, 4172 passed, 1 skipped** (baseline 4078 on `51e0923` plus the new tests; DH4-2A adds its own) |
| `tsc -b` / `oxlint` / `vite build` | pass / 0 warnings / pass |

**Mutation / adversarial:** `tools/cut256_s256_mutation.py`, data in `data/cut256-implementation/s256-mutation.json`. **7 / 7 detected**, and the baseline passes after restore.

| mutant | failing tests |
|---|---|
| MU-1 skip keyed on the `bakeState` badge | 8 |
| MU-2 skip on any FAILED | 4 |
| MU-3 base-only (the Dinner guard forwards no waiver) | 5 |
| MU-4 resolver ignores the waiver | 8 |
| MU-5 resolver trusts the waiver (no mismatch guard) | 1 |
| MU-6 selector reads only the primary reason | 5 |
| MU-7 selector ignores OVERBAKED | 7 |

## 13. E2E (Chromium)

**Full run (iphone-390x844, iphone-360x800, layout-chromium, 4 workers):**
- first run: 210 passed, 3 failed
- after the fixes below: **212 passed, 25 skipped, 1 failed**

**The first run's 3 failures:**
- `making-ui-1screen` (390×650): took the pizza out after a **real-time 1300 ms wait** and asserted a CUT. On a loaded runner the needle can pass 90 (OVERBAKED), and that pizza now correctly skips CUT.
  - Fixed: the take-out lands at 70 on the virtual clock.
  - `finished-pizza-visual` Scenario C was hardened the same way (89 → 85: still later than the perfect zone, still PASS).
- `cut-skip-failed-bake` burnt at 99 on 360×800 missed: margherita's burnt range (90–100) is too narrow for a landing that can drift about 10 points under load.
  - Fixed: burnt uses marinara at 97 (its band ends at 75); Lunch Rush uses raw at 2; the Dinner burnt check uses bismarck.
  - The stress re-run of this spec: **40 / 40**.
- `finished-pizza-visual` Scenario B landed about 10 points low. The pizza was still in band, so it still went through CUT. Pre-existing and unrelated to #256.

**The remaining failure: `timing-transparency` Scenario B.**
- **What happened:** `playFullCapricciosaRound` aims at 68 but landed below 48. The pizza was UNDERBAKED, so the result is the 失敗 card, which has no timing summary.
- **Pre-existing, not #256:**
  - Before #256 the same landing led to CUT and then the same 失敗 card, which also has no timing summary.
  - Re-running `timing-transparency` + `finished-pizza-visual` with `--repeat-each=4` on 4 workers: **80 / 80 on `origin/main` and 80 / 80 on this branch**.
- Classified as the pre-existing virtual-clock landing jitter of the shared bake helper under full-suite load. It is not changed by this PR.

**New and updated E2E:**
- `cut-skip-failed-bake` (Guided raw / burnt / in band, Lunch Rush raw / in band)
- the Dinner #256 burnt test, R5/R9 (no CUT before 生焼け)
- CLEAR 「最後のピザ：name ★N」, INFEASIBLE 「最後のピザ：ビスマルク」, QUALITY_FAIL 「あと★N」

**CI on PR #275, head `ad6ef12`: 9 / 9 success.**
- `build`, `classify`, `layout-chromium`, **Layout Contract Gate**
- `webkit webkit-390x844` shards 1/2 and 2/2, `webkit webkit-360x800` shards 1/2 and 2/2, **WebKit Gate**
- mergeable: `clean`; review threads: 0

## 14. Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| HV-A_guided-burnt-skip_inband-cut.mp4 | 390×844 | 28.1 s | 612 KB | PASS |
| HV-B_lunch-rush-raw-skip.mp4 | 390×844 | 15.0 s | 299 KB | PASS |
| HV-C_dinner-row-burnt-qualityfail.mp4 | 390×844 | 28.9 s | 527 KB | PASS |
| HV-D_dinner-clear-last-pizza.mp4 | 390×844 | 36.8 s | 835 KB | PASS |

- **Format:** H.264 (High), yuv420p, 25 fps, 390×844.
- **Recording:** Playwright WebM, converted with imageio-ffmpeg's libx264. Checked with `ffmpeg -i`, plus a frame extract of HV-C at 14 s.
- **Download:** delivered directly in the session. Not committed.

**Video Verification: PASS**

What to look for:

| video | check |
|---|---|
| **A** | Burnt marinara: 取り出す → the 失敗 card (焦げすぎて提供できません / 焼き加減: 焦げ) with **no CUT screen**. Then a margherita at 70 → the **CUT screen still appears** → 切り終わる → the normal result. |
| **B** | Lunch Rush raw margherita: 取り出す → the FAILED serve panel (生焼け…) with **no CUT** → 次の注文へ → the next order. |
| **C** | The target row: 2-line 「ブレックファ / ストピザ」, 🔍 top-left on every chip. A tap opens the 見本 only. A burnt bismarck → 「ピザとして完成しませんでした / 焦げてしまいました」 at 取り出す, **no CUT**. Then S=5 margherita → QUALITY_FAIL with 「マルゲリータ ★3（合格は★5以上）」 and **「あと★2」**. |
| **D** | CLEAR after 4 pizzas → 「最後のピザ：ブレックファストピザ ★3」 (not 「…完成！」). 「DINNER CLEAR!」 unchanged. |

**Screenshots:**
- before (`origin/main`) and after: `docs/reports/screenshots/cut256-dinner-ui-implementation/hv-{before,after}/`
  - A1: before = the CUT screen; after = the 失敗 card.
  - The before C3 shows the result *after* the old helper walked the CUT.
- target row at 4 viewports: `{before,after}/`

## 15. Owner Human Verification (requested)

On an iPhone Preview of this PR:
1. Guided: burn a pizza (let the needle run past the window) → the failure appears right after 取り出す, without the CUT screen.
2. Guided: a normal bake → the CUT screen still appears.
3. Lunch Rush: a raw or burnt pizza → the failed serve panel directly.
4. Dinner: burn a margherita (the Owner's earlier case) → 「焦げてしまいました」 right after 取り出す.
5. Dinner target row: the names are readable in 2 lines, the 🔍 reads as "見本", and a tap still opens only the 見本.
6. Dinner QUALITY_FAIL with `dinnerMinStars=5` → 「あと★N」. CLEAR → 「最後のピザ：name ★N」.

## 16. Rollback

Each slice reverts on its own with `git revert` (S-256: `cd972db` + `40d2459` + `d929387`; S-UI-1: `da6f06c`; S-UI-2: `3b5dd26`).
- There is no save, ruleset, Functions or data migration.
- Dinner sessions are not persisted.
