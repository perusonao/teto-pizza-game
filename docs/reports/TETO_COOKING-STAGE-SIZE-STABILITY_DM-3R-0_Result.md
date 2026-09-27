# DM-3R-0 Cooking Stage Size Stability — Result Report

- Issue: #245
- PR: #246 (OPEN, no auto-merge)
- Branch: `claude/dinner-stage-size-stability-l8e5le`
- Owner Decisions in force: OD-R5, OD-R8 (DEFERRED), OD-R9, OD-R10
- Source audit: `docs/reports/TETO_DINNER-MISSION_DM-3_HUMAN-REVIEW_REDESIGN.md` (`fe221af`, §10 HV-1)

## 1. Audited main

- `origin/main` was fresh-fetched at `4e78f3d` (Merge PR #244, Discovery Hint 3.0 H3-2). The branch starts from that commit.
- PR #243 (Dinner DM-3) is OPEN at `fd4c28b`. It is not merged into this branch and was not changed.
- There is no Dinner runtime on `main`, so Dinner was not measured (as the task specifies). The Dinner case is covered structurally: the Dinner HUD sits above the stage like the Lunch HUD, and the fix does not depend on the mode.

## 2. HV reproduction

The HV-1 mechanism reproduces on the current `main` in Guided, Free Cooking and Lunch Rush on a Safari-like visible height:

- Guided, 390×664: DOUGH 290px → SAUCE 240px (−17%).
- Lunch Rush, 390×664: TOPPING 158px (−46% vs DOUGH).
- Lunch Rush, 360×620: TOPPING 114px (−58%).

The audit's Dinner figure (290 → 199px) is the same mechanism plus the Dinner HUD.

## 3. Root cause

- `.game-screen--cooking` is a flex column. The only flex-grow item is `.pizza-stage`, and the dough is `min(76vw, 290px, 100cqh)`.
- Every step therefore gives the dough whatever height is left after the rows below it:

| step | below the stage (before) |
|---|---|
| DOUGH | nothing (the tray is not rendered) |
| SAUCE | ソースのでき readout (39px), plus a live-message line that appears **only while painting**, plus the tray |
| CHEESE / TOPPING | a tray of 1 row (≈114px) or 2 rows (≈198px), plus the always-on pager row |

- At 844 and 800 the 290 / 274px caps bind, so the shrink is invisible there. It appears only below ≈750px of visible height, which is real Safari.
- The live-message line also meant the pizza shrank **under the finger** at the moment painting started.

## 4. Before measurements

- Method: Chromium, real mouse gestures, with each phase measured at every viewport by resizing in place.
- The raw data is in `docs/reports/screenshots/dm-3r-0-stage-size-stability/measurements-before.json`. It includes the visible diameter, the dough box, the stage top/bottom/height, the heights of the rows above and below, and overflow.

Visible pizza diameter (px):

| mode / viewport | DOUGH | SAUCE | CHEESE | TOPPING | BAKE | CUT | PREPARE variance |
|---|---|---|---|---|---|---|---|
| Guided 390×844 | 290 | 290 | 290 | 290 | 358 | 358 | 0% |
| Guided 360×800 | 274 | 274 | 274 | 274 | 328 | 328 | 0% |
| Guided 390×664 | 290 | **240** | 287 | 283 | 322 | 358 | 17.2% |
| Guided 360×620 | 274 | **196** | 243 | 239 | 278 | 328 | 28.5% |
| Free 390×844 | 290 | 290 | 290 | 290 | 358 | — | 0% |
| Free 360×800 | 274 | 274 | 274 | 274 | 328 | — | 0% |
| Free 390×664 | 290 | 290 | 241 | **233** | 322 | — | 19.7% |
| Free 360×620 | 274 | 273 | 197 | **189** | 278 | — | 31.0% |
| Lunch 390×844 | 290 | 290 | 290 | 290 | 358 | 358 | 0% |
| Lunch 360×800 | 274 | 274 | 274 | 274 | 328 | 328 | 0% |
| Lunch 390×664 | 290 | 242 | 246 | **158** | 281 | 358 | 45.5% |
| Lunch 360×620 | 274 | 198 | 202 | **114** | 237 | 322 | 58.4% |

Stage container at 390×664 before the fix (Guided):
- DOUGH 413px (top 181 / bottom 594)
- SAUCE 248px (181 / 429)
- CHEESE 295px
- TOPPING 291px

The rows below the stage in SAUCE were readout 39 + tray 114 + CTA bar 70. There was no horizontal overflow and no page scroll at any sample (0 / 0).

## 5. Implementation

**Feasibility check before implementing.**
- The stage takes the left-over height. So if the height of the rows under it is made the same in every PREPARE step, the diameter is the same by construction (variance 0%).
- Everything that decides that height is fixed when the round starts: the recipe, free-cook or not, the owned ingredients, and whether the readout shows.
- **The 10% target is achievable, so no alternative threshold was needed.**

Changes (shared cooking layout only):

1. **`src/logic/prepareDock.ts` (new).**
   - `trayIngredientsFor` is now the single tray filter. `IngredientTray` uses it, with identical behavior.
   - `prepareDockReserve` works out, over the round's PREPARE steps:
     - the sauce rows
     - the widest cheese / topping page (in rows)
     - whether any step pages
     - whether SAUCE shows the readout
2. **`GameScreen.tsx`: the PREPARE dock.**
   - The readout and the tray now sit in one `.prepare-dock` between the stage and the CTA bar.
   - The dock is laid out in **every** PREPARE step, DOUGH included (empty there), with the reservation passed as CSS custom properties.
   - Nothing else in the skeleton moved. The HUD, tabs, order card and CTA bar are untouched.
3. **`App.css`.**
   - The dock's `min-height` is the maximum of two sums:
     - SAUCE step: readout block + sauce rows + pager
     - other steps: rows + pager
   - The parts have fixed heights so the reservation is exact and does not depend on fonts: chip 64px, pager row 34px, readout block 62px.
   - It is `min-height` rather than `height`: anything taller than reserved (Preview's expanded 開発用 metrics) grows the dock and nothing overlaps.
   - The tray is anchored to the bottom of the dock (`justify-content: flex-end`), so the chips sit at the same height in every step.
   - Short heights (`max-height: 700px`) only: chip 64 → 58px and the 見本 thumbnail 48 → 40px. Nothing is removed. At 844 and 800 the layout values are unchanged except for the chip's fixed 64px height.
4. **`SauceMetricsPanel.tsx`.**
   - The live-message line is always laid out: empty and `aria-hidden` while idle, filled while painting. The readout no longer grows mid-stroke.
   - The Preview-only toggle (`🧪 開発用 ▾`, `aria-label` unchanged) shares that line.
   - No information was removed.
5. **`IngredientTray.tsx`.**
   - New prop `reservePagerRow` (default `true`, the old behavior).
   - GameScreen passes `false` when no step of the round pages. The dock is reserved per round, so a round that never pages has no later page to make room for. This saves 34px in every Guided and Lunch round.

Layout priority was followed:
- The pizza is protected first.
- The CTA bar is untouched.
- Status (HUD, tabs, order card) is only 8px smaller at short heights, through the thumbnail.
- The ingredient controls were compacted but stay ≥44px.
- The readout was reorganized into fixed lines without removing anything.

## 6. After measurements

The raw data is in `docs/reports/screenshots/dm-3r-0-stage-size-stability/measurements-after.json`.

| mode / viewport | DOUGH | SAUCE | CHEESE | TOPPING | BAKE | CUT | PREPARE variance |
|---|---|---|---|---|---|---|---|
| Guided 390×844 | 290 | 290 | 290 | 290 | 358 | 358 | 0% |
| Guided 360×800 | 274 | 274 | 274 | 274 | 328 | 328 | 0% |
| Guided 390×664 | 279 | 279 | 279 | 279 | 322 | 358 | **0%** |
| Guided 360×620 | 235 | 235 | 235 | 235 | 278 | 328 | **0%** |
| Free 390×844 | 290 | 290 | 290 | 290 | 358 | — | 0% |
| Free 360×800 | 274 | 274 | 274 | 274 | 328 | — | 0% |
| Free 390×664 | 269 | 269 | 269 | 269 | 322 | — | **0%** |
| Free 360×620 | 225 | 225 | 225 | 225 | 278 | — | **0%** |
| Lunch 390×844 | 290 | 290 | 290 | 290 | 358 | 358 | 0% |
| Lunch 360×800 | 274 | 274 | 274 | 274 | 328 | 328 | 0% |
| Lunch 390×664 | 236 | 236 | 236 | 236 | 281 | 358 | **0%** |
| Lunch 360×620 | 192 | 192 | 192 | 192 | 237 | 322 | **0%** |

Layout Contract profiles (Chromium, LC-S tests), smallest PREPARE diameter:

| profile | Guided | Free | Lunch |
|---|---|---|---|
| N390 390×844 | 290 | 290 | 290 |
| N360 360×800 | 274 | 274 | 274 |
| P390i 390×844 + inset | 290 | 290 | 290 |
| S390 390×664 | 279 | 269 | 236 |
| S360 360×640 | 255 | 245 | 212 |
| E390i 390×664 + inset | 198 | 188 | 155 |
| E360i 360×640 + inset | 174 | 164 | 131 |

Other after-fix observations:
- Dough top and center are identical across DOUGH / SAUCE / CHEESE / TOPPING (for example, Guided 390×664: stage 173–460 in every step).
- Horizontal overflow and page scroll are 0 everywhere.

## 7. LC-S1..LC-S4

**Placement: inside the existing Layout Contract.**

Checking the current classifier and WebKit authority:
- `e2e/layout-contract.spec.ts` already runs in the `layout-chromium` CI job across all 7 profiles, including S390 = 390×664 and S360 = 360×640.
- It also runs in each WebKit shard on the N and S profiles of that shard's width. Its evidence feeds the required **Layout Contract Gate** and **WebKit Gate**.
- So no new viewport or profile was needed: the Safari-like 664 height is already a CI authority profile.
- The new tests use the existing `lc.checkpoint`, which runs every L-* invariant on every profile, plus a `beforeMeasure` hook for the stage rects.

New describe block: `DM-3R-0 Stage Size Stability (LC-S1..LC-S4)`, with three flows:
- Guided margherita (readout, CUT)
- Free Cooking (paged tray, TOPPING page 1 and page 2)
- Lunch Rush Portuguesa (HUD, two-row tray, CUT)

| id | rule | threshold |
|---|---|---|
| LC-S1 | DOUGH / SAUCE / CHEESE / TOPPING diameter variance per profile; the dough center does not jump | ≤ 10%; drift ≤ 8px |
| LC-S2 | SAUCE is not the outlier; the diameter does not change **mid-stroke** (live message visible) | SAUCE ≥ 90% of the largest; Δ ≤ 1px |
| LC-S3 | minimum usable PREPARE diameter per profile and mode | N/P = the 290 / 274 cap. S390 272 / 262 / 230, S360 248 / 238 / 205, E390i 192 / 182 / 148, E360i 168 / 158 / 125 (Guided / Free / Lunch = measured minus ~6px) |
| LC-S4 | the dough is inside its stage, below the HUD / tabs / order card, and above the dock / readout / tray / CTA bar | 1px tolerance |

One existing invariant was adjusted:
- **L-B** (pager to CTA gap ≥ 8px, P0) used to fail when no pager row was laid out.
- It now measures the tray's bottom when the round has no pager row. The same 8px gap is still required.
- This is the only change to an existing check.

Existing Owner-pending P1 entries (`KNOWN_P1`) are untouched.

## 8. Pointer accuracy

New file: `e2e/stage-size-stability.spec.ts`. It runs on the iphone-* and webkit-* projects, once per engine per forced viewport. It drives a real mouse at 390×844, 390×664 and 360×640:

- **Dough stretch:** 8-point stretch; 「次へ」 becomes enabled.
- **Sauce:** one dab at (35%, 40%). The alpha-weighted centroid of the sauce heatmap canvas must be within 4%. It measured 34.1% for x at 390×664. A mutation check with the expected value changed to 60% failed, so the check is real.
- **Topping:** mozzarella at (30,45) and (68,55), and basil at (50,28), each within 3% of where they were tapped.
- **CUT:** three drag-across lines register.
- The dough diameter is also asserted equal across SAUCE, CHEESE and TOPPING.

Existing gesture suites all pass unchanged, including `making-ui-1screen.spec.ts` with its 390×650 physical drag + CUT and `PizzaStage.sauceParity`. One comment in `making-ui-1screen.spec.ts` was updated because DOUGH is now also shrunk at 650; its assertion (`≤ 290`) is unchanged.

## 9. Mobile layout

- **Safe area:** P390i, E390i and E360i pass L-I.
- **No horizontal overflow (L-D), no page scroll (L-E):** pass on all 7 profiles.
- **CTA reachable (L-A / L-F):** pass.
- **Chips ≥ 44px (L-M):** chips are 58–64px tall.
- **Lunch HUD (L-G):** passes.
- **Free Cooking pagination:** LC-1 and LC-S Free pass. On a paged round the pager row is reserved in every step. Page 1 and page 2 give the same diameter (269px at S390).
- **Hint sheet, reference popover, ingredient tray:** the existing E2E suites (`discovery-hint-sheet`, `discovery-dex-hint`, `making-ui-1screen`, `rt01-reference-capacity`, …) pass.

## 10. Regressions

- Vitest: 183 files; 3884 passed, 1 skipped.
- Chromium E2E (iphone-390x844 + iphone-360x800): 155 passed, 19 skipped. The skips are the existing OD-V-6 per-width skips plus the new spec's own.
- layout-chromium: 11/11 passed.
- No behavior change in scoring, placement, stock gate, hint, reference or mission logic. The diff is layout plus the one extracted tray filter.
- Updated unit test: `GameScreen.makingStepNav` "a one-page tray still lays out the pager row" is split in two:
  - a round that never pages has no row
  - a one-page step in a round that pages keeps the invisible, inert row
- New unit tests:
  - dock DOM contract (present in DOUGH, identical reservation in every step, gone in BAKE)
  - `prepareDock.test.ts` (8 tests)
  - `SauceMetricsPanel` live line reserved while idle

## 11. Screenshots

All are in `docs/reports/screenshots/dm-3r-0-stage-size-stability/`. Each montage is BEFORE (main `4e78f3d`, red row) vs AFTER (green row), for DOUGH / SAUCE / CHEESE / TOPPING / BAKE, with the diameter printed on every frame.

- `guided-{390x844,360x800,390x664,360x620}-before-after.png`
- `free-{…}-before-after.png`
- `lunch-{…}-before-after.png`
- **`dough-vs-sauce-390x664.png`**: DOUGH vs SAUCE side by side, Guided and Lunch, before and after (the HV-1 comparison)
- `preview-sauce-painting-360x640.png`: Preview build mid-stroke, showing the live message and the 🧪 toggle on one line; dough 255px idle = 255px painting
- `measurements-before.json` / `measurements-after.json`: raw data

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `DM-3R-0_A_after_guided_390x844.mp4` | 390×844 | 32.6s | 456 KB | H.264 | PASS |
| `DM-3R-0_C_after_guided_390x664.mp4` | 390×664 | 33.0s | 426 KB | H.264 | PASS |
| `DM-3R-0_B_after_lunch_390x664.mp4` | 390×664 | 32.6s | 378 KB | H.264 | PASS |
| `DM-3R-0_D_before_lunch_390x664_main.mp4` | 390×664 | 32.7s | 402 KB | H.264 | PASS |

- **Download:** delivered directly in the session (not committed; `artifacts/` is gitignored).
- **Video Verification: PASS.** ffprobe confirmed codec, resolution, duration and size, and frames were extracted and checked at 22s.

What to check:
- **B vs D (Lunch Rush 390×664):** in D (before) the pizza shrinks from DOUGH to SAUCE and again to a small disc at TOPPING. In B (after) it keeps one size from DOUGH to TOPPING.
- **C (Guided 390×664):** SAUCE painting does not move or shrink the pizza while the ソースのでき live message appears.
- **A (Guided 390×844):** the authority viewport looks as before (290px throughout PREPARE), and BAKE / CUT are unchanged.
- **Every video:** CTA always reachable; the tray chips sit at the same height in every step.

Scenario, for each video: HOME → start round → DOUGH stretch → SAUCE paint → CHEESE taps → TOPPING taps → 焼く → 取り出す → CUT, holding 1.5–2.5s on each step.

## 12. Tests

| check | result |
|---|---|
| focused unit (`prepareDock`, `GameScreen.makingStepNav`, `SauceMetricsPanel`) | pass |
| full Vitest | 3884 passed / 1 skipped |
| typecheck (`tsc -b`) | pass |
| lint (oxlint) | pass, 0 findings |
| build | pass (existing chunk-size warning only) |
| Chromium E2E | 155 passed / 19 skipped |
| Layout Contract (layout-chromium, 7 profiles) | 11 / 11 passed |
| new pointer smoke | 3 / 3 passed (Chromium) |

## 13. CI / WebKit

- The classifier requires WebKit: the PR touches `src/` and `e2e/`.
- PR #246 CI at `3cf421a` (runtime commit):
  - `build`: success
  - `layout-chromium`: success
  - `Layout Contract Gate`: success
  - `classify`: success
  - `webkit webkit-390x844` shard 1/2 + 2/2: success
  - `webkit webkit-360x800` shard 1/2 + 2/2: success (every e2e spec, including the new `stage-size-stability.spec.ts` and the LC-S tests on the N/S profiles)
  - **`WebKit Gate`: success**
- All 9 / 9 checks are green. Run: https://github.com/perusonao/teto-pizza-game/actions/runs/36298469046
- The follow-up commit with this report and the screenshots is docs-only, so under the classifier it reuses the passing WebKit result on the same base.

## 14. Changed files

- `src/logic/prepareDock.ts` (new), `src/logic/prepareDock.test.ts` (new)
- `src/screens/GameScreen.tsx`, `src/screens/GameScreen.makingStepNav.test.tsx`
- `src/components/IngredientTray.tsx`
- `src/components/SauceMetricsPanel.tsx`, `src/components/SauceMetricsPanel.test.tsx`
- `src/App.css`
- `e2e/layout-contract.spec.ts`, `e2e/support/layoutInvariants.ts` (L-B fallback), `e2e/stage-size-stability.spec.ts` (new), `e2e/making-ui-1screen.spec.ts` (comment only)
- `docs/reports/…` (this report, screenshots)

## 15. Scope

**Not touched:**
- Dinner result-detection, the PR #243 Dinner runtime, mission target logic, quality gate, timer, rewards, persistence
- Hint 3.0, Shop economy, recipe data, matcher, #234
- the Layout Contract viewport and profile set
- CI workflows
- BAKE / CUT sizing rules

PR #243 was not pushed to, and nothing from it is on this branch.

## 16. OD-R8 evidence (BAKE / CUT size — DEFERRED, not decided here)

After the fix, the jump from PREPARE to BAKE / CUT at each viewport:

| viewport | PREPARE (G / F / L) | BAKE (G / F / L) | CUT (G / L) |
|---|---|---|---|
| 390×844 | 290 / 290 / 290 | 358 / 358 / 358 (+23%) | 358 / 358 |
| 360×800 | 274 / 274 / 274 | 328 (+20%) | 328 / 328 |
| 390×664 | 279 / 269 / 236 | 322 / 322 / 281 (+15% / +20% / +19%) | 358 / 358 |
| 360×620 | 235 / 225 / 192 | 278 / 278 / 237 (+18–24%) | 328 / 322 |

- The PREPARE → BAKE change is now **one** step (before the fix it came on top of the PREPARE jitter).
- Option (a), "same size throughout", would mean capping BAKE / CUT at the PREPARE diameter: −68px at 844 and more on short heights where CUT currently gets 358px.
- Option (b), "BAKE larger" (today's behavior), is unchanged by this PR.
- Recommendation: compare videos A (844) and C (664) on an iPhone before deciding.

## 17. Residual risks

- **DOUGH is smaller on short heights than before.** It now has the size of the other PREPARE steps, for example Lunch 390×664: 290 → 236px and Guided 290 → 279px. This is the intended stability trade (priority 1 = one stable gesture area), but DOUGH loses area on short Safari heights. At 844 and 800 nothing changes.
- **LC-S3 floors vs the audit's 260px proposal:**
  - Guided (279) and Free (269) meet 260 at 390×664.
  - Lunch Rush (236) does not. The Lunch HUD (33px) plus the two-row Portuguesa tray leave no more room without shrinking the CTA bar or the HUD, which rank above the tray in the priority list and were left alone.
  - The Dinner HUD will be in the same position. Raising the Lunch/Dinner floor would need a decision on HUD or tab compaction and is left to the Owner / DM-3R-2.
- **E-profiles** (664 visible **plus** 47/34 insets) are extreme: Lunch E360i = 131px. They are pinned against regression, not endorsed as usable.
- **Real-device fonts:** fixed heights make the reservation exact under Chromium and WebKit metrics. A taller iOS glyph inside a chip is contained visually by the chip's padding, but it still needs the iPhone check.
- **Free-cook tray in DM-3R-2 (OD-R5):** Dinner with all owned materials will use the paged tray. Its dock reservation is two rows plus the pager (the Free numbers above), plus the Dinner HUD. Expect roughly Lunch-level size (≈236px at 390×664), stable across steps.
- **The Preview dev metrics** (🧪 expanded) still push the pizza up. This is by design (`min-height`) and is Preview-only.

## 18. Merge recommendation

- The branch is ready for Owner review: all 9 CI checks, including the WebKit Gate, are green (§13).
- Merge before rebasing PR #243 (OD-R9 / OD-R10).
- Do not merge before the iPhone check of videos A / C and the OD-R8 decision input in §16. The OD-R8 decision itself does not block this PR, because this PR does not change BAKE / CUT.
