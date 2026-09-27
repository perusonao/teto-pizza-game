# Dinner Mission DM-3R-2 (PR #252): Owner Human Verification Preparation

- **Lane:** D (Dinner only). Independent of DH4-x / HintSheet / Recipe Taxonomy lanes.
- **Scope guard:** no production code changed, nothing merged. PR #252, #243 and #242 are untouched. No production deploy.
- **Verdict (prep):** **A. DINNER PREVIEW READY FOR OWNER HUMAN VERIFICATION**
- **Owner iPhone HV:** round 1 is in §9 and round 2 (TIME_UP) is in §10. Every item run passed. Two Owner tests remain before merge (§10.4), so #252 is **not merge-ready yet**. §10.3 supersedes the §9.6 classification.
- Captured: 2026-09-27 (UTC ~10:40–10:50)

## 1. Fresh GitHub Gate

| item | state |
|---|---|
| `origin/main` | `5a33d855674652ab3483c3cedb8815859e88ce6e` (Merge PR #254, DH4-1). It moved during this task: `22658f7` (H3-4 #251 merge) was followed by the #254 merge at 10:28Z. |
| PR #252 | OPEN, not draft. Head `5e217ea` (docs-only). No unexpected commits: 94b27ad → daed3dd → 7a18e29 → 5e217ea. |
| Last code HEAD | `7a18e29630fd12b89ecdfb2c644182b51d1bd2a9`. `5e217ea` only edits the Result Report. |
| Mergeability | GitHub `clean` against its base `726b0ac`. Against the latest main, see §2. |
| CI | `7a18e29`: CI and WebKit workflows success. `5e217ea`: build / classify / Layout Contract Gate / WebKit Gate success. The layout and webkit jobs were skipped as docs-only, as designed. |
| Review threads | 2 threads (Codex P2 ×2), both resolved in `7a18e29`. No open blocker. |
| Auto-merge | none |
| Issue #250 | OPEN, linked to #252 |
| PR #243 / Issue #242 | both OPEN, untouched (their close is the Owner's call after HV) |
| Preview repo (before) | `109fe28`. site/ built from `5dc5f47` (PR #251, H3-4), plus the H3-4 seed page. |

## 2. Latest Main Compatibility Gate (no merge performed)

The trial merge ran in a scratch worktree. It was never pushed.

- **Merge:** `5e217ea` + `origin/main 5a33d85` merges automatically, with no conflict. Trial merge commit: `32cfe9c`, local only.
- **File overlap:** main changed 13 non-docs files since `726b0ac`, and PR #252 changed 28. The only shared file is `src/App.css`.
  - main's edits there are all `.hint-sheet__*` rules plus a new `@keyframes hint-chip-new`.
  - The Dinner rules are `.dinner-*` / `.home-menu__card--dinner` / `--dinner-*`. No selector collides.
- **No shared-file edits on main:**
  - `GameScreen.tsx`, `App.tsx`, `gameReducer.ts`: not touched by main.
  - Dinner logic (`src/mission/dinner/*`, `dinnerView`, `useDinnerRuntime`): not touched by main.
  - DH4-1 (`deductionHint.ts`, `ingredientTaxonomy.ts`): unwired pure layer with no importer from the Dinner code.
- **Semantic check: can Dinner reach a Discovery Hint purchase?** No. Checked on the merged tree:
  - GameScreen renders the PREPARE 「ヒント」 button only when `state.dinner === null`. **Dinner PREPARE has no 「ヒント」 button at all.** There is no Mito-dialogue hint in Dinner either.
  - The reducer's `DINNER_BLOCKED_ACTIONS` refuses these three actions during a Dinner session: `SHOW_HINT`, `PURCHASE_DISCOVERY_HINT` and `PURCHASE_SELECTABLE_HINT`.
  - The H3-4 purchase cases also require `state.freeCook && hintSheetOpen && phase === PREPARE`.
  - A Dinner round runs with `freeCook: false`, so `isHintSheetVisible` is false. HintSheet can never mount.
  - On the Dinner result, `BakeOverlay`'s 「💡 ヒントを見る」 is wired to `state.freeCook ? … : undefined`, so it is absent.
- **Checks on the merged tree (`32cfe9c`):**
  - `tsc -b` clean and `oxlint` 0 warnings.
  - **Vitest:** 192 files, 4077 passed / 1 skipped.
  - **Chromium E2E** (iphone-390x844, iphone-360x800, layout-chromium): **201 passed / 25 skipped / 0 failed**, the same as PR #252 alone. This includes `dinner-mission`, LC-S Dinner and `discovery-hint-sheet`.
- **Result:** compatible. No integration branch is needed for the Preview.

## 3. Preview Slot Gate and deploy

- **Slot state before the switch:** H3-4 (#251) was the last user. Its HV gate is PASS and it is merged into main.
  - DH4-1 (#254) is merged. It is an unwired pure layer with no UI to verify.
  - DH4-2 and 172 Taxonomy are audit-stage. No other session had a pending Preview HV.
  - The switch was judged safe.
- **Build source:** `7a18e29630fd12b89ecdfb2c644182b51d1bd2a9` (PR #252 code HEAD). It is code-identical to head `5e217ea`, and it is not the integrated build.
- **Deploy run:** `deploy-from-source.yml` run [36313372602](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36313372602) succeeded. It pushed preview commit `80a0921` ("Deploy preview: 7a18e29… (7a18e29)").
  - The README shows Source commit `7a18e29…`, Source PR #252, built 2026-09-27T10:42:28Z.
- **Helper page:** preview commit `4e29ac4` adds `site/dm3r2-setup.html`. It is Preview-only and writes only `teto-pizza-preview-save-v1`, with backup and restore.
  - That push triggered `pages.yml` run [36313562618](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36313562618), which succeeded with head `4e29ac4`.
- **Production:** not touched.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
**HV setup helper:** https://perusonao.github.io/teto-pizza-game-preview/dm3r2-setup.html

## 4. HV parameters (HV-only; not balance authority)

These are Human Verification values only. None of them is a DM-5 time limit or ★ threshold. Every mission keeps `timeLimit.seconds: null` / `quality.minimumStars: null`.

Fresh-checked in `7a18e29`:
- `?dinnerDuration=<sec>` and `?dinnerMinStars=1..5` are read only when `import.meta.env.DEV || VITE_PREVIEW_MODE`.
- With no `dinnerMinStars`, the Preview uses a placeholder S=3.
- The production bundle has 0 `location.search` references, so both resolvers receive `""`.

| set | query | purpose |
|---|---|---|
| HV-normal | `?dinnerDuration=600&dinnerMinStars=1` | enough time for 4 pizzas; hand-made targets pass reliably |
| HV-quality-fail | `?dinnerDuration=600&dinnerMinStars=5` | hand-placed pizzas score below ★5, so QUALITY_FAIL (E2E uses the same S=5) |
| HV-time-up | `?dinnerDuration=45&dinnerMinStars=1` | TIME_UP within a minute |
| (optional) | `?dinnerDuration=600` | placeholder S=3 feel. Not a recommendation. |

Seeds on the helper page:
- **通常セーブ:** DM-A targets plus marinara discovered, hawaiian undiscovered, every material 30. It covers NON_TARGET (marinara) and ORIGINAL (hawaiian).
- **INFEASIBLE 用:** the same, with egg = 2.

## 5. Owner HV checklist (390×844 first; 360×800 as a spot check)

Recommended order: 通常セーブ + HV-normal (D1–D6, D8, D10, D12), then HV-quality-fail (D7), then INFEASIBLE 用 (D9), then HV-time-up (D11).

| # | priority | steps | check |
|---|---|---|---|
| HV-D1 Entry | P0 | HOME → 🌙 ディナーミッション → ディナーミッション 1 → Detail → スタート | The path is understandable. START goes straight to cooking. There is no Target Board and no "choose which pizza" step. |
| HV-D2 Target row | P0 | Look at the row under the tabs, then tap a chip | Visible in every step (dough → cut). You can read ⏱, 🌙 N/4, names and ✓. Chips are not too small. **A tap only opens 見本 and selects nothing.** Could the reference tap be mistaken for "choosing the pizza to make"? |
| HV-D3 Auto result | P0 | Make any target with no selection | No recipe name appears before or during BAKE / CUT. The result appears only when the pizza is finished. TARGET_PASS feels good. The chip gets ✓. 「次のピザを作る」 is natural. |
| HV-D12 CLEAR | P0 | Finish all 4 | DINNER CLEAR feels good. 「最後のピザ：○○完成！」 and the clear time show. Next steps (もう一度 / ホーム) are clear. Reward tiers are unimplemented — does it feel too placeholder-like? |
| HV-D4 Free order | P1 | Make the targets in a different order from the list | Any order CLEARs. You decide the next pizza yourself. |
| HV-D8 Invalid | P1 | Take a target out far too early (raw) or late (burnt) | Ends in 「ピザとして完成しませんでした」. **Whether CUT comes first depends on the composition, not on raw vs burnt (see §9.3).** If it identifies as a CUT recipe, CUT comes first; if it identifies as nothing, there is no CUT. Does cutting a failed pizza feel wrong? (Owner Finding candidate) |
| HV-D6 Duplicate | P1 | Make an already-✓ target again | 「これはもう完成済み！」, the ✓ count does not rise, ingredients are used. Is the reason clear? |
| HV-D5 ORIGINAL | P1 | Make hawaiian (ham 2 + pineapple 3, mozzarella 2). Optionally marinara (garlic 3 + oregano 2, no cheese) | Hawaiian shows 「オリジナルピザ！」 and never the name 「ハワイアン」. No Dex / Pitz change. No target progress. Marinara is named (NON_TARGET). |
| HV-D10 HOME abandon | P1 | During cooking: ホーム → 続ける, then ホーム → やめる | The in-app dialog shows. Cooking is frozen behind it, and the timer keeps running. 続ける resumes. やめる returns HOME with no reward. |
| HV-D7 Quality fail | P2 | HV-quality-fail: make a target | The name shows at the result: 「もう少し丁寧に作ろう」 + 「○○ ★n（合格は★5以上）」. Target stays open, ingredients are used. Is the threshold understandable? |
| HV-D9 Infeasible | P2 | INFEASIBLE 用 + HV-normal: bismarck, then bismarck again | Immediately FAILED 「材料が足りなくなりました」. The last pizza line shows 「これはもう完成済み！」. Need / have is shown. The inventory pressure makes sense. |
| HV-D11 TIME_UP | P2 | HV-time-up: START and wait (or cook slowly) | At 0: 時間切れ. **No 「最後のピザ」 line.** もう一度 / ホーム work. Clearing at the last second does not race. |

### Owner UX questions

- Q1 Is Dinner without choosing the pizza first intuitive?
- Q2 Does the target row alone tell you what to make?
- Q3 Is it clear that a chip tap is a reference only?
- Q4 Does automatic judging at the finish feel good?
- Q5 Is the tempo of one pizza → next pizza good?
- Q6 Are the ~30px thumbnails distinguishable on iPhone?
- Q7 Is the CLEAR presentation enough?
- Q8 Is QUALITY_FAIL understandable?
- Q9 Is CUT on a raw / burnt pizza acceptable?
- Q10 Fresh fact: Dinner shows **no** 「ヒント」 button in PREPARE and no 「ヒントを見る」 on its results, so the Dinner flow contains no 「ヒント」 wording. Please confirm nothing in Dinner reads as Discovery Hint.

## 6. Residual risks (classification)

| # | risk | class |
|---|---|---|
| 1 | A raw / burnt pizza **whose composition Stage A identifies as a CUT recipe** goes through CUT, then gets INVALID. A composition that identifies as nothing gets no CUT and INVALID straight after 取り出す. This is the case the Owner saw on iPhone (§9.3). | **Owner decision via HV-D8 / Q9.** Non-blocking for HV. If the Owner rejects it, it becomes a blocking defect for #252, or a separate DM-3R-1 Stage B order change. |
| 2 | The presence of CUT (the 「カット」 tab is shown during BAKE) implies "some CUT recipe matched". It never names the recipe. | non-blocking (inherent to the DM-3R-1 authority) |
| 3 | 30px thumbnails look alike. | non-blocking; HV-D2 / Q6 |
| 4 | The official minimumStars is undecided. | DM-5 deferred |
| 5 | The official time limit is undecided. | DM-5 deferred |
| 6 | Gold / Silver / Bronze and rewards are unimplemented. | DM-4 / DM-5 deferred |
| 7 | Dinner does not mutate the Dex (by design, OD-DM). | non-blocking (spec) |
| 8 | New nit: at 390 wide, the abandon dialog title wraps with 「か？」 alone on line 2. | non-blocking cosmetic |

## 7. Screenshots / videos

### Reuse (PR #252, `docs/reports/screenshots/dinner-mission-dm3r2/`, 46 files)

`7a18e29` changed only two things: the CLEAR overlay's 「最後のピザ」 line, and the abandon-dialog freeze. The freeze is invisible except that cooking is inert. So these are still code-equivalent and are reused as is:
- Mission Detail
- PREPARE (4 steps × 4 viewports)
- BAKE, CUT
- reference popover
- TARGET_PASS / QUALITY_FAIL / NON_TARGET / ORIGINAL / INVALID results
- INFEASIBLE, TIME_UP

Not code-equivalent: `after-clear-390x844.png` (captured at `daed3dd`, no 「最後のピザ」 line) and video A's CLEAR ending.

### New delta captures (`docs/reports/screenshots/dinner-mission-dm3r2-hv-prep/`)

These are from the exact deployed Preview bytes (`teto-pizza-game-preview` site/ at `4e29ac4`), served locally.

- `hvprep-clear-last-pizza-390x844` / `-360x800`: CLEAR with 「最後のピザ：ビスマルク完成！」 (the #252 review fix)
- `hvprep-abandon-dialog-390x844`: the dialog at `7a18e29`
- `hvprep-result-duplicate-390x844`: DUPLICATE_TARGET result panel. The earlier set only had DUPLICATE inside the INFEASIBLE overlay.
- `hvprep-result-invalid-after-cut-390x844`: raw funghi → CUT → INVALID (residual risk 1)
- `hvprep-infeasible-390x844`, `hvprep-timeup-390x844` (no 最後のピザ)
- `hvprep-result-target-pass-390x844` / `-360x800`

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `DM-3R-2_HVprep_A2_clear-last-pizza_7a18e29_390x844.mp4` | 390×844 | 40.2 s | 988 KB | PASS |

- **Codec:** H.264 High, yuv420p, 25 fps.
- **Download:** delivered directly in the session. Not committed.
- **Content:** the helper seed, HV-normal, HOME → Detail → START, a bismarck chip tap (見本 only), then funghi → breakfast → margherita → bismarck with no selection, CLEAR with 「最後のピザ」.
- **Reused:** videos B and C from PR #252 are still code-equivalent.

Video Verification: PASS. The file exists, ffprobe reads H.264 390×844 40.2 s, and a frame at 34 s shows the BAKE step with the target row.

## 8. Preview smoke

| item | result |
|---|---|
| Preview badge | 「PREVIEW · PR#252 · 7a18e29」 |
| Source SHA | README, deploy commit and bundle all point to `7a18e29` |
| Route | `/teto-pizza-game-preview/` (+ `dm3r2-setup.html`) |
| Query | HV-normal / quality-fail / time-up all behave as §4 |
| 390×844 + 360×800 | HOME → Dinner → Detail → START → 4 pizzas → CLEAR pass |
| Horizontal overflow | 0 on HOME, Detail, PREPARE, BAKE, CUT and CLEAR |
| Console errors | 0 |
| Hint surface in Dinner | no 「ヒント」 button, no `.hint-sheet` at any step |

**Constraint:** the sandbox proxy returns 403 for `perusonao.github.io`, so the live URL was not fetched from here. What was verified instead:
- `pages.yml` run 36313562618 succeeded on head `4e29ac4`.
- The smoke ran on that commit's `site/`, served locally at the same base path.
- The site/ JS / CSS match a local `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=252 VITE_PREVIEW_SHA=7a18e29` build byte for byte. Only `index.html` and the manifest differ, from the workflow's noindex and scope post-processing.

The live page itself is to be confirmed by the Owner on iPhone.

## 9. Owner iPhone Human Verification — round 1 (2026-09-27)

- **Device:** iPhone Safari.
- **Preview build:** PR #252, code `7a18e29`. The Owner confirmed the badge 「PREVIEW · PR#252 · 7a18e29」 on the device.

### 9.1 Confirmed on iPhone (Owner)

| item | result | Owner observation |
|---|---|---|
| Entry / START (HV-D1) | PASS | Dinner Mission 1 → START goes straight to cooking. No pizza is chosen first. |
| Automatic result-detection flow (HV-D3 core) | PASS | Pizzas are judged at the finish, with no declaration. |
| CLEAR (HV-D12) | PASS | 「DINNER CLEAR! / 作ったピザ 4 / 4 / クリアタイム 02:34 / 最後のピザ：ブレックファストピザ完成！」. 「もう一度」 and 「ホーム」 show. |
| Burnt INVALID (HV-D8, burnt only) | PASS | 「ピザとして完成しませんでした / 焦げてしまいました / 完成 0 / 4」 |
| Burnt pizza: no CUT before INVALID (this attempt) | PASS as observed | BAKE → 取り出す → INVALID → 次のピザ. CUT was not asked. The general behaviour is in §9.3. |
| QUALITY_FAIL ★4 (HV-D7) | PASS | `dinnerMinStars=5`. A correctly built margherita: 「★4（合格は★5以上）」 / 「もう少し丁寧に作ろう」 / 「完成 0 / 4」 / 「次のピザを作る」 |
| QUALITY_FAIL ★3 (HV-D7) | PASS | Another attempt: ★3, the same outcome |
| The completion count does not rise on a failure | PASS | It stays 0 / 4. |
| The Dinner timer keeps running after a failed attempt | PASS | |

These attempts confirm three behaviours:
- The recipe identity was correct (「マルゲリータ」).
- The quality threshold failed as expected.
- The run continued.

### 9.2 Not yet verified on iPhone

Each item below is untested on iPhone. No PASS is implied.

- **Target-row reference UX** (HV-D2): chip tap = 見本 only, 30px thumbnails, Q2 / Q3 / Q6.
- **Arbitrary-order UX in detail** (HV-D4, Q1 / Q5). The CLEAR run was made in some order, but the order was not an explicit check.
- **Raw / undercooked INVALID** (HV-D8, raw). It is deliberately not folded into the burnt PASS.
- **Burnt pizza with a composition that identifies as a CUT recipe:** does CUT come first? (§9.3)
- DUPLICATE_TARGET (HV-D6)
- ORIGINAL / NON_TARGET (HV-D5)
- HOME abandon (HV-D10)
- INFEASIBLE (HV-D9)
- ~~TIME_UP (HV-D11)~~: verified on iPhone in round 2 (§10.1)
- Q10: no 「ヒント」 wording in Dinner. Not reported either way.

### 9.3 Correction: "raw / burnt always goes through CUT"

The earlier wording in §5 HV-D8 said a raw or burnt pizza still gets the CUT step. The Owner's burnt pizza got no CUT. Both statements are true for different compositions. The rule is below.

**Code (`7a18e29`):**
- `planDinnerBake` (`src/mission/dinner/dinnerResultDetection.ts`) fixes the CUT step at **START_BAKE**, from the composition alone. `bakeResult` does not exist yet at that point.
- When the composition identifies as a recipe with a CUT profile (24 of 25 recipes), CUT follows BAKE.
- No match, an ambiguous match, or a no-CUT recipe (New Haven) gets the generic window and **no CUT**. The result is resolved right at CONFIRM_BAKE (`dinnerGuardedReducer`).
- Nothing in the Dinner path looks at raw vs burnt before deciding on CUT. Raw and burnt are classified afterwards, in Stage B (`INVALID_PIZZA`).

**Automated re-check on the deployed Preview bytes** (`4e29ac4` site/, 390×844, Chromium, real gestures):

| composition | bake | CUT asked? | result |
|---|---|---|---|
| funghi (CUT recipe) | burnt | yes | INVALID 「焦げてしまいました」 |
| margherita (CUT recipe) | burnt | yes | INVALID 「焦げてしまいました」 |
| funghi (CUT recipe) | raw | yes | INVALID 「生焼けでした」 |
| funghi + egg (matches nothing) | burnt | **no** | INVALID 「焦げてしまいました」 |

**Conclusion:**
- The Owner's observation (BAKE → 取り出す → INVALID, no CUT) is the **no-identification** path. The composition of that pizza did not identify as a single CUT recipe.
- It is **not** a general rule that burnt pizzas skip CUT.
- A burnt or raw pizza whose composition *does* identify as a CUT recipe is still cut before INVALID. That is residual risk 1, still open and Owner-decision.
- The iPhone screenshots cannot tell which ingredients that pizza had. So this report does not claim the burnt pizza was a specific recipe.

**Recorded as:**
- Burnt INVALID: PASS
- Burnt without CUT: PASS as observed (no-identification path)
- Burnt / raw of an identified CUT recipe → CUT → INVALID: not yet seen on iPhone; still the Owner's Q9 decision
- Raw INVALID: not verified on iPhone

### 9.4 Is the pizza cut part of the ★? (Owner question; code-verified)

**No. The cut does not enter Dinner's ★, for CUT or non-CUT recipes.**
- **How the ★ is computed:** the internal `classify` in `dinnerResultDetection.ts` computes it as `toLegacyScoreBreakdown(computeScoringV2(recipe, pizza), pizza.bakeResult, recipe.bakeTarget).stars`.
- **What that reads:** `computeScoringV2` reads only `PizzaState`: dough shape, sauce, toppings and `bakeResult`. Its components are Sauce 52 / Pieces 16 / Recipe 12 / Bake 20, times the quantity factor Q. `capStarsForBake` then turns a ★5 into ★4 unless the bake is `perfect`. So even a pizza that scores ★5 shows ★4 whenever its bake is not perfect.
  - `PizzaState` has no cut data. Cut lines live in the separate `cutState`, and nothing in `src/logic/scoringV2/` reads them.
- **What the cut does in Dinner:** `resolveDinnerAttempt` receives only `cutCompleted: boolean`. It is a gate: a CUT recipe cannot resolve before the CUT confirm (`CUT_PENDING`). How well it was cut is never passed in.
- **`evaluateCut`'s `cutScore`:** a standalone preview metric. `gameReducer.cutStep.test.ts` #26 pins that "Scoring 2.0 total is never perturbed by cutState / cutScore".
- **Non-CUT recipes:** same formula, same ★, just no gate.
- **So the Owner's ★3 / ★4 QUALITY_FAIL did not come from the cut.** The source is in sauce, pieces, recipe, bake, the quantity factor or the bake cap. Which one cannot be read from the result screen, which shows only ★ and the threshold. This report does not name a cause. The ★4 could be the bake cap alone, or lower component scores; the screen cannot tell.

### 9.5 New findings (round 1)

| # | finding | class |
|---|---|---|
| F1 | 「最後のピザ：○○完成！」 has not been checked with a long pizza name | non-blocking follow-up (UI polish). The longest current DM-A name, 「ブレックファストピザ」, fit on iPhone. |
| F2 | 「DINNER CLEAR!」 is English while the rest is Japanese | non-blocking (UI polish) |
| F3 | 「もう少し丁寧に作ろう」 does not say what to improve for ★5 | non-blocking. DM-5 / UI polish candidate: a gap display (「あと★1」 / 「マルゲリータ ★4 / 合格 ★5」), and possibly the single largest improvement point if the scoring authority can expose it safely. |
| F4 | The HV-D8 wording in this report was imprecise (§9.3) | fixed in this report. No code change. |

### 9.6 Merge readiness: remaining Owner HV, reclassified

**Automated coverage** (at `7a18e29`; the Dinner E2E also runs in CI WebKit 390×844 / 360×800):

| item | unit (reducer / pure) | Chromium + WebKit E2E | screenshot |
|---|---|---|---|
| DUPLICATE_TARGET | R6, R17 | R6/R18 (duplicate → INFEASIBLE) | hv-prep `result-duplicate` |
| INFEASIBLE | R18, over-placement ×2 | R6/R18 (need / have, retry disabled, no refund) | `after-failed-infeasible-duplicate`, hv-prep `infeasible` |
| TIME_UP | R20 (bake / CUT after 0 changes nothing) | R20 (clock → 時間切れ → HOME) | `after-failed-timeup`, hv-prep `timeup` |
| HOME abandon | R26, the "nothing cooks behind the dialog" test | R26 (in-app dialog, 続ける / やめる, no `window.confirm`) | hv-prep `abandon-dialog` |
| raw INVALID | R9 / R10 | R5/R9 (raw bismarck → INVALID) | `after-result-invalid`, hv-prep `invalid-after-cut` |
| ORIGINAL | R8 | R7/R8/R13 (full DOM sweep during BAKE / CUT / result) | `after-result-original` |
| target-row reference | R27 (unit + App) | R1/R27 (a chip opens 見本 only) | `after-reference-popover` |

**Proposal:**

- **Required before merge (Owner):**
  1. **Target-row reference UX** (HV-D2 / Q2 / Q3 / Q6).
     - Tests only prove that a chip selects nothing. They cannot tell whether a player reads the chip as a selection, or whether 30px thumbnails work on the device.
     - This is the core of OD-R7 and the only UI concept #252 introduces that has no human sign-off yet.
  2. **Q9 decision: CUT before INVALID on a raw / burnt pizza that identifies as a CUT recipe.**
     - The quick check: build a correct target, burn or under-bake it, then see CUT, then INVALID.
     - This also covers raw INVALID on iPhone.
     - If the Owner rejects the behaviour, the fix changes #252 / DM-3R-1 Stage B order. So the decision has to come before merge. The check itself is one pizza.
  3. **HOME abandon (HV-D10), short.**
     - It is the one destructive action, and the review fix `7a18e29` (freezing touch input behind the dialog) is about real touch gestures. Chromium pointer events are not a full stand-in for that.
     - About 30 seconds: 続ける once, やめる once.
- **Non-blocking / follow-up (optional on iPhone):**
  - DUPLICATE_TARGET, INFEASIBLE, TIME_UP.
    - Each is covered by unit tests plus Chromium and WebKit E2E, with screenshots.
    - Their copy is simple, and none carries an open design question.
    - A feel check can ride along with any later HV (for example DM-4 / DM-5).
  - ORIGINAL: privacy is covered by the E2E DOM sweep.
  - Arbitrary-order detail (HV-D4): the CLEAR run and E2E R3/R4 already cover the behaviour.
  - F1–F3.
- **Blocking defects found so far:** none.

**PR #252 merge readiness:** **not yet.** It is waiting on items 1–3 above. CI is green, there are no open review threads, the branch is clean against its base, and the trial merge with main `5a33d85` passes (§2). #252 stays OPEN. #243 / #242 stay OPEN. DM-4 / DM-5 are not started.

## 10. Owner iPhone Human Verification — round 2 (TIME_UP) and merge-readiness re-evaluation

**Fresh gate**, re-checked from GitHub before this update. Nothing changed since round 1:

| item | state |
|---|---|
| `origin/main` | `5a33d85` |
| PR #252 | OPEN, head `5e217ea` (docs-only), code `7a18e29` |
| Mergeability | `clean` |
| CI | green |
| Review threads | 2 of 2 resolved |
| Issue #250 | OPEN |
| PR #243 / Issue #242 | OPEN |
| Preview repo | `4e29ac4`. Source commit is `7a18e29`, source PR #252 (README). |

### 10.1 HV-D11 TIME_UP

**Status: PASS.** Evidence: Owner iPhone Human Verification, Preview PR #252 / `7a18e29` with the badge confirmed on the device.

This is a device observation reported by the Owner. It is separate from the automated E2E R20 and unit R20 passes (§9.6), and it does not replace them.

The Owner's screenshot was the evidence. It is not copied into the repo.

Observed:
- The timer reaching 0 during play moves to the TIME_UP result.
- 「⏰ 時間切れ！」 is shown.
- The completed count shows correctly, as 「0 / 4」 in this run.
- The Retry (「もう一度」) and Home (「ホーム」) buttons are visible.
- No visible layout break.
- Cooking does not continue behind the TIME_UP result; the player does not stay on the cooking screen.
  - This matches the code: `dinnerGuardedReducer` refuses every cooking action once `run.status !== "PLAYING"`, and a bake or CUT confirmed after the deadline consumes and completes nothing (unit R20).

### 10.2 Re-evaluation of the three candidates

**A. HOME abandon.** Kept as a **merge blocker (Owner HV)**.
- `7a18e29` fixed a real touch-interaction issue: cooking accepted gestures behind the dialog.
- Two layers now stop it: the reducer guard refuses every cooking action while `abandonRequested`, and `PizzaStage` is non-interactive behind the dialog.
- Chromium pointer events and the unit test cover the logic. Only a device shows whether an in-flight iOS touch really stops behind the dialog.

**B. CUT recipe + invalid bake.**
- The facts are settled (§9.3 / §9.4):
  - CUT is decided at START_BAKE by the recipe identity, never by the bake.
  - A composition that identifies as nothing gets no CUT.
  - An identified CUT recipe is cut even when raw or burnt, then gets INVALID.
  - The cut never enters the ★.
- What remains is a **UX decision**: is it acceptable to make the player cut a pizza whose failure is already certain? That decision is a merge blocker, because rejecting it would change #252 / the DM-3R-1 Stage B order.
- The shortest check is TEST 2 in §10.4. It also covers raw INVALID on iPhone.

**C. Target row.** Proposed to move to a **non-blocking follow-up**. The Owner can overrule this.

The implementation matches OD-R7 (Issue #250: "compact target row (thumbnail + tap for the reference). Tapping is **not** a selection"):
- Each chip is a `<button>` with `aria-haspopup="dialog"` and the label 「○○の見本を見る」. A tap only opens the existing 見本 popover (`DinnerGameUi.tsx`).
- There is no selected state anywhere.
  - In the UI, the only chip modifier is `dinner-chip--done` (✓), and there is no pressed or active-selection style.
  - In the state, `SELECT_TARGET` / `activeRecipeId` were removed, and a test asserts that removed selection actions do not exist.
  - Unit, App and E2E R27 pin that a tap changes nothing in the run.
- So misreading a chip as a selection cannot produce a wrong outcome: whatever is cooked is judged by its composition anyway.

Presentation findings from the 390×844 captures (the chip-level screenshots the Owner mentioned are not visible in this session, so the committed captures are used):
- The name is 10px with an ellipsis: 「ブレックフ…」 at 390 wide, and 「マルゲリ…」 at narrower chip widths.
- The thumbnail is 30px, and 26px at short heights.
- Both are legibility polish. They live only in `.dinner-chip*` CSS and the chip markup, and the Layout Contract (LC-S Dinner, L-J) guards the row height. A later UI-polish slice can change them without touching the runtime.
- Examples: a wider chip or a 2-line name, a larger thumbnail, or a one-time hint 「タップで見本」.

Why non-blocking: nothing is functionally wrong, the behaviour is the OD-R7 authority, and the fix surface is CSS and copy only. It becomes a blocker only if the Owner judges on the device that the row fails its purpose, "what to make".

### 10.3 Reclassification (supersedes §9.6)

"Owner-confirmed" means already passed on iPhone; it is not asked again.

| item | class | basis |
|---|---|---|
| HOME abandon | **merge blocker (Owner HV: TEST 1)** | real-touch fix `7a18e29` (§10.2 A) |
| CUT recipe invalid-bake UX | **merge blocker (Owner decision: TEST 2)** | a rejection changes #252 behaviour (§10.2 B) |
| raw INVALID | automated coverage sufficient; also observed in TEST 2 | unit R9/R10, E2E R5/R9 (raw bismarck), Preview re-check §9.3 |
| target row | non-blocking follow-up (UI polish) | OD-R7 conformant, no functional issue (§10.2 C) |
| long last-pizza name (F1) | non-blocking follow-up | the longest DM-A name fit on iPhone |
| 「DINNER CLEAR!」 in English (F2) | non-blocking follow-up | copy only |
| QUALITY_FAIL guidance, e.g. 「あと★1」 (F3) | non-blocking follow-up (DM-5 / UI polish) | needs a scoring-authority decision |
| arbitrary order | automated coverage sufficient | unit R4, E2E R3/R4 (a non-list order to CLEAR), plus the Owner's CLEAR run |
| DUPLICATE_TARGET | automated coverage sufficient | unit R6/R17, E2E R6/R18, screenshot |
| ORIGINAL | automated coverage sufficient | unit R8, E2E R7/R8/R13 with a full-DOM identity sweep during BAKE, CUT and the result |
| NON_TARGET | automated coverage sufficient | unit R7, E2E R7 |
| INFEASIBLE | automated coverage sufficient | unit R18 plus 2 over-placement cases, E2E R6/R18, screenshot |
| burnt INVALID | Owner-confirmed (round 1) | §9.1 |
| TIME_UP | Owner-confirmed (round 2) | §10.1 |
| CLEAR | Owner-confirmed (round 1) | §9.1 |

"Automated coverage sufficient" means unit plus Chromium E2E, with the Dinner E2E also run by the CI WebKit gate at 390×844 / 360×800. An optional feel check can ride along with any later HV.

### 10.4 Remaining Owner device tests (max 2)

Preview: https://perusonao.github.io/teto-pizza-game-preview/dm3r2-setup.html

**TEST 1: HOME abandon**
1. On the helper page, tap 「通常セーブ」, then 「HV-normal」.
2. HOME → ディナーミッション → ディナーミッション 1 → スタート.
3. Start the dough step and place a few pieces, then tap 「ホーム」 at the top left.
4. With the dialog open, try to touch the pizza: nothing should change. The timer on the row keeps counting.
5. Tap 「続ける」. You are back in the same cooking state and can keep cooking.
6. Tap 「ホーム」 again, then 「やめる」. You land on HOME with no reward.

**TEST 2: CUT recipe + raw bake** (a new run from TEST 1's HOME)
1. ディナーミッション 1 → スタート. Build a correct margherita: stretch the dough, add tomato sauce, 3 mozzarella, 2 basil.
2. In BAKE, tap 「取り出す」 right away (clearly raw).
3. The CUT step appears. Cut and tap 「切り終わる」.
4. The result reads 「ピザとして完成しませんでした / 生焼けでした」, and the ✓ count does not rise.
5. **Owner decision:** is cutting a pizza that has already failed acceptable (keep as is), or should a failed bake skip CUT (a change to #252 / DM-3R-1)?

### 10.5 PR #252 merge readiness

**Not yet.**
- It needs TEST 1 PASS and a TEST 2 decision of "keep as is".
- CI is green, the review threads are resolved, the PR is `clean` against its base, and the trial merge with `5a33d85` passes (§2).
- No blocking code defect has been found.

If TEST 2 is decided as "skip CUT", a production change is needed, and this lane stops for a new decision before any implementation.

#252 stays OPEN, and #243 / #242 stay OPEN. There has been no production deploy, and DM-4 / DM-5 are not started.
