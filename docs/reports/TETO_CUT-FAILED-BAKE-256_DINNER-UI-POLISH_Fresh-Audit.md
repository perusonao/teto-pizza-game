# Fresh Audit: Cross-mode Failed-Bake CUT UX (Issue #256) + Dinner Mission UI Polish

- **Type:** read-only Fresh Audit. No production code, PR #252, #256 implementation, merge, deploy, or Hint / DH4 change.
- **Committed here:** docs, measurement data and tools only.
- **Date:** 2026-09-27

## 0. Fresh GitHub gate

| item | state |
|---|---|
| `origin/main` | `5a33d85` (Merge PR #254, DH4-1) |
| PR #252 | OPEN, head `d11858a` (test + docs only after code `3e3ae0d` / `7a18e29`). CI and E2E WebKit on `d11858a` both **success**. 2 of 2 review threads resolved. Its own report §22–§23 records "READY TO MERGE" (HOME abandon cleared). |
| Issue #256 | OPEN, 1 comment (Owner device evidence). Not started. |
| Code audited | #252 head `d11858a`, a superset of main. Guided, Lunch Rush and Free Cooking code paths are identical to `main 5a33d85`. |
| Baseline suite on `d11858a` (local) | Vitest **192 files, 4078 passed, 1 skipped** |

---

# PART A — Issue #256: CUT on a pizza whose bake has already failed

## A1. Two different meanings of "生焼け / 焦げ" (read this first)

The code has two bake verdicts, and #256 has to pick one:

| verdict | where | rule (bakeTarget = `{start, end}`) | effect |
|---|---|---|---|
| `bakeState` raw / perfect / burnt | `classifyBake` (`src/logic/bake.ts`) | outside `[start, end]` → raw / burnt | badge 「焼き加減: 生焼け / 焦げ」; `capStarsForBake` turns ★5 into ★4. **The pizza can still PASS.** |
| Completion Gate `UNDERBAKED` / `OVERBAKED` | `checkBake` (`src/logic/completionGate.ts`) | outside `[start − m, end + m]`, `m = 0.5 × (end − start)` (10 points for a 20-wide window) | FAILED: no score, no Dex / Pitz, Lunch Rush serve counts as a failure, Dinner `INVALID_PIZZA` |

So a pizza labelled 「生焼け」 is not necessarily a failure. **"A bake failure is certain" can only mean the Completion Gate's `UNDERBAKED` / `OVERBAKED`.** Dinner's `INVALID_PIZZA` (via `evaluateFreeCookCompletion(pizza, plan.bakeWindow.target)`) uses exactly that same band. Any skip rule keyed on `bakeState` would also skip CUT for servable ★4 pizzas. That is a scope error, and this audit recommends against it.

## A2. Behaviour matrix (#256 deliverable 1)

| | Guided (Pizza Select) | Lunch Rush | Dinner (PR #252) | Free Cooking (じぶんのピザ) |
|---|---|---|---|---|
| **Recipe identity fixed** | before PREPARE (`SELECT_RECIPE` / `RETRY`), shown throughout | at round start (the drawn order), shown throughout | **START_BAKE**, Stage A `planDinnerBake` from the composition; internal only, first shown on the result | **CONFIRM_BAKE** (`resolveFreeCookPizza` matcher) |
| **Cooking profile / CUT eligibility fixed** | round start: `getCookingProfile(recipe.id)`; CUT for 24/25 (`CUT_ELIGIBLE_RECIPE_IDS`; `new-haven-apizza` has none) | round start, same | START_BAKE: identified CUT recipe → CUT; NONE / AMBIGUOUS / New Haven → no CUT | **none**: keeps `DEFAULT_COOKING_PROFILE` even after a match → **Free Cooking never has a CUT step** |
| **Bake quality fixed** | CONFIRM_BAKE: `classifyBake`, Completion Gate, Scoring 2.0 (all from the same `pizza`) | CONFIRM_BAKE, same (completion policy `order`) | CONFIRM_BAKE. The base reducer's score / completion are computed against the sentinel and **cleared**. Stage B classification runs at CONFIRM_BAKE (no CUT) or at CUT confirm, **from inputs all fixed at CONFIRM_BAKE** | CONFIRM_BAKE |
| **Reaching CUT** | `postBakeSteps(cookingProfile).length > 0` only. **`bakeState` / `completion` never read** (`gameReducer.ts` CONFIRM_BAKE) | same base path | same base path (Stage A put CUT into the profile) | n/a |
| **CUT on a Completion-Gate bake failure** | **yes** | **yes** | **yes** when identified as a CUT recipe; no CUT when unidentified (Owner saw both paths on device, HV-prep §12) | n/a |
| **RESULT transition** | the last POST_BAKE `CONFIRM_MAKING_STEP` (CUT, ≥ 3 lines for 6 slices) → RESULT | same → RESULT → 「提供」 (`handleMissionServeNext`: `SERVE` + `MISSION_NEXT_ORDER`) | CUT confirm → `dinnerResolve` (`resolveDinnerAttempt`, `cutCompleted: true`) → attempt panel / overlay | CONFIRM_BAKE → RESULT |
| **Does CUT affect the score?** | **no**. `computeScoringV2` never reads `cutState` (pinned by `cutStep.test` #26). `cutScore` is a standalone block on a **PASS** result only; the FAILED card (`ResultPanel` `completion.status === "FAILED"`) **never shows it** | **no**. `SERVE.qualityTotal = score.total`, or 0 when FAILED | **no**. ★ is `toLegacyScoreBreakdown(computeScoringV2(...))`. CUT is only the gate `cutCompleted` (`CUT_PENDING`) | n/a |
| **Completion gate** | `evaluatePizzaCompletion(recipe, pizza, "recipe")` | same, `"order"` | INVALID = `evaluateFreeCookCompletion` (empty or out-of-band bake, Stage A window); target QUALITY_FAIL = `evaluatePizzaCompletion(..., "order")` | `evaluateFreeCookCompletion` (empty or out-of-band bake) |
| **Clock cost of the CUT** | Cooking Time (手際) ends at START_BAKE, so no score effect. The CUT row appears in the per-step timing only on a PASS result | **the 180 s run clock keeps running during CUT**. A doomed pizza's CUT spends run time that could serve the next order | **the Dinner clock keeps running during CUT**, and `resolveDinnerAttempt` checks TIME_UP at CUT confirm, so a doomed CUT can even run the clock out | n/a |

**Answer to the core question:** once CONFIRM_BAKE lands outside the Completion Gate band, the outcome is fully determined in every mode. What the CUT on such a pizza changes:
- score, ★, completion, Dex, Pitz, Lunch Rush metrics: **nothing**
- the Guided / Lunch Rush result: **nothing visible** (the FAILED card hides the CUT block)
- Lunch Rush and Dinner: **timer seconds are spent** (a small but real negative)
- what remains is only 「切った見た目」: the cut lines stay on the pizza image behind the failure card or attempt panel

The mode is not the problem. The failed-bake CUT is a ritual with no feedback, and in the two timed modes it has a small cost.

Arguments for keeping it (Option A):
- **Predictability:** a CUT recipe always shows the same step list.
- **Dinner information:** today CUT presence is a 1-bit "matched a CUT recipe" signal (#252 report §13 risk 2). Skipping CUT on a failed bake does **not** widen that signal: a failed-bake pizza then looks the same whether it was identified or not. It only narrows it.
- **Hands-on fun:** cutting is a hands-on action some players may enjoy even on a failed pizza. No Owner evidence either way. The Owner's report reads as "気になった" (bothered).

## A3. Change impact (measured) (#256 deliverable 2)

Method: throwaway mutants applied to a scratch checkout of `d11858a`, then the full Vitest suite and the relevant Chromium E2E. The scratch checkout was reverted after each run. Reproduce with `tools/cut256_skip_mutants.py`.

| mutant | rule | Vitest result | notes |
|---|---|---|---|
| **M1** | base `CONFIRM_BAKE`: skip POST_BAKE when the Completion Gate is FAILED **with UNDERBAKED / OVERBAKED among `failures`** | 4 failed / 2 files | `cutStep.test` "CUT never gates completion" (its fixture is empty **and** raw, `value: 5`), plus **3 Dinner tests (R9/R10, R11, R17): `lastResult` stays `null`** |
| **M2** | base: skip POST_BAKE on **any** Completion-Gate FAILED | 18 failed / 6 files | Many CUT tests (cut gesture, step timing, dynamic steps, POST_BAKE fixtures) reach CUT through an intentionally empty, composition-FAILED pizza. Every one of those fixtures would need a rebuild. |
| **M3** | M1 + Dinner Stage B: `resolveDinnerAttempt` does not reject `CUT_PENDING` when the bake is out of band | **1 failed / 1 file** (`cutStep.test` "CUT never gates completion"); `tsc -b` clean | E2E (Chromium 390×844, 7 CUT-related specs, 34 tests): **1 failed**, `dinner-mission.spec` R5/R9, because `cookDinnerPizza` asserts the CUT button on a raw pizza. The Lunch Rush specs, `pizza-cutting-phase4b`, `completion-gate-partial-quantity`, `finished-pizza-visual-2.0` and `dynamic-cooking-steps` pass. |

**Critical coupling (M1):** changing only the shared reducer **soft-locks Dinner**.
- CONFIRM_BAKE lands on RESULT and `dinnerResolve` calls `resolveDinnerAttempt(cutCompleted: false)`.
- Stage A still says `cutRequired`, so the resolver returns `REJECTED: CUT_PENDING`, and `dinnerResolve` returns the old BAKE state. The 取り出す tap becomes a no-op forever.
- Consequence: **#256 cannot be implemented as a base-reducer-only change.** It must change the DM-3R-1 contract "a CUT identity cannot resolve before CUT confirm" in the same slice (M3 shape).
- This is also why it was right **not** to change the behaviour inside #252.

**Contracts that must change for Option B (bake-failure only, all modes):**
1. `src/state/gameReducer.cutStep.test.ts` "CUT never gates completion: a FAILED (empty) margherita pizza still walks CUT to RESULT". Rewrite it into two tests:
   - a **composition**-FAILED pizza with an in-band bake still walks CUT
   - a **bake**-FAILED pizza goes straight to RESULT
2. DM-3R-1 Stage B contract (`CUT_PENDING`): exempt a bake-invalid pizza. Update the DM-3R-1 report §3 wording and the Dinner tests to pin both directions.
3. `e2e/support/dinner.ts` `cookDinnerPizza`: expect CUT only when `spec.cut && !underbake && !overbake`. Also update its doc comment ("a raw / burnt pizza of a CUT recipe is still cut").
4. `e2e/gestures.ts` `failMissionOrderMissingSauce`: behaviour is tolerant (`if count()`). Its takeout is immediate (raw), so under B that pizza skips CUT. Update the doc comment that says "a FAILED bake still lands on POST_BAKE/CUT".
5. Docs that state the current rule as fact: #252 report §13 risk 1, HV-prep §9.3 / §12, Issue #256.

**Other impact to check in the implementation slice (not measured here):**
- **Step tabs:** the PREPARE tab row lists the post-BAKE カット tab for CUT recipes. On a skip, the round jumps from 焼く to RESULT, so the tab must not look "unfinished". HV item.
- **Lunch Rush ranking:** a failed pizza now resolves a few seconds sooner, so there is marginally more time for later orders. The rule change is small, but it touches ranking comparability. Owner call: bump the ruleset / board version or accept.
- **cookingTiming:** no CUT entry on a skip. `cookingTimingDisplay` already omits absent steps. CT1 (手際) is unaffected (it ends at START_BAKE).
- **Dinner #252 §13 risk 2 (CUT presence signal):** unchanged or narrower (see A2).

## A4. Owner options (#256 deliverable 3)

| option | behaviour | cost / risk | recommendation |
|---|---|---|---|
| **A. Keep** | CUT follows every CUT recipe, whatever the bake | 0 change. Keeps the "ritual with no feedback" and the timed-mode cost | acceptable, but does not answer the Owner's discomfort |
| **B. Skip CUT on a Completion-Gate bake failure (all modes)** | out-of-band bake (`UNDERBAKED` / `OVERBAKED` present) → straight to the failure result; in-band bakes (incl. 「生焼け」 badge ★4 PASS) still CUT; composition-only failures still CUT | **small**: 2 production files (base CONFIRM_BAKE + Dinner Stage B), 1 unit test rewritten, 1 E2E helper, ~6 new tests, HV video | **recommended.** It matches the Owner's framing ("生焼け/焦げが確定"): the player has just seen the needle miss, so an immediate result reads as cause → effect. Same rule in every mode; Free Cooking is unaffected (no CUT) |
| B-wide. Skip CUT on **any** Completion-Gate FAILED | also skips for missing / insufficient ingredients and thin sauce | **larger**: 18 tests / 6 files to rebuild (M2). Composition failures are less obvious to the player at 取り出す, so CUT → result is not "wasted" in the same way | later, only if Owner wants it after B |
| C. Mode split (e.g. skip only in timed modes) | Lunch Rush / Dinner skip, Guided keeps | breaks the "one shared flow" the Owner already confirmed (#256: 「Dinner だけ挙動を変えない」) | not recommended |
| D-1. Keep CUT but make it optional | a 「カットしないで結果へ」 button on CUT when the bake failed | new UI element, and the failure is still hidden until the result | not recommended (more UI for the same outcome) |
| D-2. Signal the failure at 取り出す, then skip | BAKE shows 「焦げちゃった…」 for ~1 s, then the result | an animation / copy layer on top of B | optional polish on top of B; not needed for B itself |

**Owner decisions needed for B:**
- **OD-256-1:** scope = Completion-Gate UNDERBAKED / OVERBAKED (recommended), not `bakeState`, not every FAILED.
- **OD-256-2:** the same rule in all CUT modes, Lunch Rush included (recommended). Lunch Rush ranking: accept, or version the board.
- **OD-256-3:** sequencing: **implement after #252 merges**. The Dinner half lives in #252's code, so doing it earlier would mean changing #252 or doing it twice.

---

# PART B — Dinner Mission UI polish (Owner HV non-blocking items)

**Authority kept:** OD-R7, "compact target row / tap = reference only / not a selection". Nothing below adds a selected state, stores a tapped chip, or lets the row influence the result.

## B1. Measurements (#256 deliverable 4 → Dinner UI measurements)

- **Tool:** `tools/dinner_ui_polish_audit.spec.ts`, run against a #252 checkout in Chromium with real gestures and the #252 E2E helpers.
- **Raw data:** `docs/reports/data/cut256-dinner-ui-polish-audit/<w>x<h>.json`
- **Screenshots:** `docs/reports/screenshots/cut256-dinner-ui-polish-audit/`, five per viewport:
  1. the target row
  2. the reference popover
  3. QUALITY_FAIL
  4. the row with 2 targets done
  5. CLEAR

Caveat: Chromium fonts, not Hiragino. On iOS the katakana are about as wide or wider. The Owner's 「マルゲリ…」 on the device agrees with the 360-wide numbers below.

### Target row

| viewport | bar h | status col w | chip w × h | thumb | name font | name room | マルゲリータ | ブレックファストピザ | of the 25 recipe names, fit in one line |
|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 57 | 74.6 | 66.4 × 49 | **30** | 10px | 60px | fits | 「ブレックフ…」 | **11 / 25** |
| 390×664 | 48 | 74.6 | 67.9 × 44 | 26 | 10px | 60–64px | fits | 「ブレックフ…」 | 11 / 25 |
| 360×800 | 57 | 74.6 | 60.0 × 49 | **30** | 10px | 56px | **「マルゲリ…」** | 「ブレック…」 | **7 / 25** |
| 360×640 | 48 | 74.6 | 60.4 × 44 | 26 | 10px | 56px | **「マルゲリ…」** | 「ブレック…」 | 7 / 25 |

- **At 360 wide, only names of 5 katakana or fewer fit.** Examples: フンギ, ナポリ, ペパロニ, フガッサ, マリナーラ, ビスマルク, バンビーノ.
  - A 6-character name such as マルゲリータ misses by 4px.
  - DM-B's メランザーネピザ (8 characters) and パルミジャーナピザ (9 characters) are truncated **at every width**.
  - The longest names, ニューヘイブンアピッツァ (12) and ピッツァ・ポルトゲーザ (11), would show as 4–5 characters and an ellipsis.
- **The full name is always one tap away:** the popover title shows 「ブレックファストピザ 見本」 in full (screenshot 2), and the chip's `aria-label` has the full name.
- The row costs the stage nothing: the bar height matches the order card (the Layout Contract L-J / LC-S DINNER floors guard it).

### Results

| item | 390×844 | 360×640 (worst) | verdict |
|---|---|---|---|
| CLEAR 「最後のピザ：ブレックファストピザ完成！」 (13px) | 1 line | 1 line | fits |
| probe: 「最後のピザ：ニューヘイブンアピッツァ完成！」 (longest of 25) | 1 line, 273px text in a 320–340 panel | 1 line | **fits at every viewport** |
| 「🎉 DINNER CLEAR!」 title (24px) | 255px | 255px | fits |
| probe: 「🎉 ディナー クリア！」 | 250px, 1 line | 1 line | fits |
| QUALITY_FAIL line 「マルゲリータ ★3（合格は★5以上）」 (14px) | 1 line | 1 line | fits |
| probe: 「マルゲリータ ★4 → 合格まで あと★1」 | 1 line | 1 line | fits |
| probe: 「ニューヘイブンアピッツァ ★4（合格は★5以上）」 | 1 line (315px) | 1 line, near the edge | fits, but that is the ceiling |
| page horizontal scroll | none | none | OK |

## B2. Findings

| # | item | finding | class |
|---|---|---|---|
| U1 | 30px thumbnail (26px at ≤700px heights) | Readable as a pizza "icon". Sauce colour and piece layout show, but individual toppings are small. The popover is the detailed view by design (OD-R7). | polish, optional |
| U2 | name ellipsis | Measured: 6-character names truncate at 360, 7+ characters truncate everywhere. It gets worse with DM-B and later missions. | **polish, most valuable** |
| U3 | chip may read as a selection | The chips are raised white cards directly under the step tabs (生地 / ソース / …), which *are* a selectable row. Nothing says 「見本」. Functionally safe: there is no selected state, `aria-haspopup="dialog"`, and R27 pins that a tap changes nothing. | polish (perception) |
| U4 | long 「最後のピザ」 name | Fits even for the longest name at 360×640. **New copy issue:** the INFEASIBLE branch prints `dinnerAttemptCopy(lastResult).titleJa`, so a run that ends on a QUALITY_FAIL reads 「最後のピザ：もう少し丁寧に作ろう」 and on a duplicate 「最後のピザ：これはもう完成済み！」. Those are headlines, not pizza names. | polish (copy) |
| U5 | 「DINNER CLEAR!」 in English | Not isolated: the HUD label in BAKE / CUT / result is 「🌙 DINNER」, and Lunch Rush's intro title is 「⏱ LUNCH RUSH」. English is the mission-brand style. The CLEAR headline is the only English **sentence**. | polish (copy, Owner taste) |
| U6 | QUALITY_FAIL gives no direction | 「もう少し丁寧に作ろう」 + 「★3（合格は★5以上）」. The view already carries `stars` and `minimumStars`, so 「あと★N」 is pure copy. The **bake cap** is a known, exact cause: `capStarsForBake` makes ★5 impossible without a perfect bake, so at S=5 every non-perfect bake fails. It can be detected without new scoring logic (see P6). | polish; P6 touches presentation of scoring → Owner / DM-5 |

## B3. UI polish proposal (#256 deliverable 5)

| id | proposal | fixes | surface | tests that pin today's text / layout |
|---|---|---|---|---|
| **P1** | Chip name: allow **2 lines** (`-webkit-line-clamp: 2`, 9px, `line-height 1.1`) and thumbnail 26px at every height, keeping the chip height (49 / 44). Line breaks within katakana are acceptable; an ellipsis only after line 2. Math at 360: 2 × ~6 characters covers every 12-character name; 26 + 1 + 2 × 9.9 + 4 ≈ 51 → needs ~2px from padding or the status column. **Verify under Layout Contract L-J before committing to it.** | U2 (U1 trade-off: 30→26) | `.dinner-chip*` CSS only | Layout Contract LC-S DINNER floors, L-J (bar ≤ order card) |
| P1-alt | Keep one line, and add optional per-recipe `shortNameJa` display data for names over 5 characters | U2 | recipe display data + chip markup | none. Needs Owner naming for ~18 recipes. |
| **P2** | "Reference" affordance: a small 🔍 badge at the thumbnail's bottom-right (✓ stays top-right), and the row's `aria-label` 「ディナーのターゲット（タップで見本）」. **No** persistent pressed style, and no highlight after closing the popover. | U3 (keeps OD-R7) | chip markup + CSS | `DinnerGameUi.test` R27 still holds (no state change) |
| P2-alt | Visually separate the row from the step tabs: flatter chips (no card shadow, outline only), so the row reads as a list and not as a second tab bar | U3 | CSS | none |
| **P3** | 「最後のピザ」 line from the attempt **view**, not the headline: TARGET_PASS 「○○ ★N」; QUALITY_FAIL 「○○ ★N（合格★S）」; others as now | U4 | `DinnerGameUi.tsx` + a `dinnerView` helper | `DinnerGameUi.test` CLEAR / INFEASIBLE text asserts; E2E `dinner-result-last` |
| **P4** | CLEAR headline in Japanese, keeping the English brand small: 「🎉 ディナー クリア！」 (measured: fits in 250px), with 「DINNER」 left in the HUD. Or keep English for consistency with LUNCH RUSH. **Owner taste.** | U5 | copy | `DinnerGameUi.test.tsx:127`, `e2e/dinner-mission.spec.ts:106` (`"DINNER CLEAR!"`) |
| **P5** | QUALITY_FAIL: title 「あと★N！」 (N = S − ★), line 「マルゲリータ ★4 → 合格 ★5」. Measured: 1 line at every viewport. | U6 (gap) | `dinnerAttemptCopy` only | `dinnerView` copy tests, E2E R5 (「もう少し丁寧に作ろう」) |
| P6 | Reason line only when the bake cap is the sole blocker: `bakeState !== "perfect"` and `starsFromTotal(total) ≥ S` → 「焼き加減がぴったりなら合格！」. Needs `DinnerAttemptView` to carry one boolean, computed in Stage B from the data it already has. Component-level advice (sauce / pieces) is Scoring 3.0 / #176 territory. | U6 (cause) | pure view + copy | new tests only |

Not proposed:
- a bigger thumbnail at the cost of the name
- horizontal scroll of the chips: at 76px basis, 4 chips = 304px > the 262px available at 360, so a target would hide off-screen
- any "current target" highlight (OD-R7)

## B4. Implementation slices (#256 deliverable 6)

Order: **#252 merge first.** Every slice below edits code that exists only in #252.

| slice | content | depends on | HV (policy) |
|---|---|---|---|
| **S-256** | Option B: base CONFIRM_BAKE skips POST_BAKE on a Completion-Gate bake failure; Dinner Stage B exempts a bake-invalid pizza from `CUT_PENDING`. Also: rewrite `cutStep.test` #27 into 2 tests; new tests for Guided raw / burnt, the in-margin edge (still CUT), composition-FAILED (still CUT), Lunch Rush serve, and Dinner identified raw / burnt (resolves at CONFIRM_BAKE, no double consumption, TIME_UP), plus Dinner valid-bake `CUT_PENDING` kept; update the E2E helper and a new E2E per mode; step-tab visual check | OD-256-1..3, #252 merged | yes: 390×844 video of a failed bake in Guided, Lunch Rush and Dinner, plus before / after screenshots |
| **S-UI-1 (copy)** | P3 + P4 + P5 (copy only, no layout) | Owner picks P4 wording; #252 merged | yes (small): screenshots of the CLEAR / INFEASIBLE / QUALITY_FAIL panels |
| **S-UI-2 (chip)** | P1 (or P1-alt) + P2 / P2-alt, under the Layout Contract at N390 / N360 / S390 / S360 / E* | #252 merged | yes: row at 4 viewports, device check of legibility |
| S-UI-3 (reason) | P6 | DM-5 S decision (whether S=5 with the bake cap is intended at all) | yes |

S-UI-1 and S-UI-2 are independent of S-256 and can go in either order.

---

# Is there anything to push back into PR #252's merge blockers?

**No.** Nothing found in this audit is a #252 merge blocker.
- **#256:** Guided, Lunch Rush and Dinner share the same CUT rule, and #252 reuses it unchanged. The M1 measurement shows that changing it *inside* #252 would be wrong: it would need a Stage B contract change, and a base-only change soft-locks Dinner. It stays a post-merge, all-mode slice (S-256).
- **Part B items:** all CSS / copy / view polish. The row is OD-R7-conformant (no selection state; R27 pins it). The long-name concern (U4) is measured to fit at 360×640. The only new wording issue, 「最後のピザ：もう少し丁寧に作ろう」 on INFEASIBLE, is cosmetic.
- **Dinner-specific signal:** the "CUT presence means a CUT recipe matched" signal is already recorded in #252 report §13 as a known risk. #256 option B does not widen it.
- **CI:** CI and E2E WebKit are success on `d11858a`. The local baseline (4078 passed) matches.
