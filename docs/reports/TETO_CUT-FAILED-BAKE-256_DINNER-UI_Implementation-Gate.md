# Implementation Gate: #256 Failed-Bake CUT Skip + Dinner UI S-UI-1 / S-UI-2

- **Type:** Implementation Gate (docs / data / tools only).
- **Not done here:** production code, CSS, e2e, #256 or Dinner UI implementation, leaderboard, deploy, DM-4 / DM-5, DH4.
- **Date:** 2026-09-27
- **Predecessor:** `docs/reports/TETO_CUT-FAILED-BAKE-256_DINNER-UI-POLISH_Fresh-Audit.md`
- **Owner Decisions applied:** OD-CUT256-1..5 and OD-DUI-1..6, as given for this gate.

## 1. Fresh GitHub Gate

| item | state |
|---|---|
| `origin/main` | **`51e0923`** (Merge PR #252). Fetched fresh; it was not assumed. **Its tree is byte-identical to `d11858a`**, the head the Fresh Audit measured (`git diff --quiet d11858a 51e0923`). |
| PR #252 | MERGED 2026-09-27 13:47 UTC. Issue #250 is closed. |
| Issue #256 | OPEN, 1 comment (the Owner's device evidence). No linked PR. Not started. |
| Duplicate / review | Searched "CUT skip underbaked overbaked 生焼け 焦げ": only #256 matches. #176 covers different areas (CUT score weight, dynamic steps), and #248 is closed. No open PR touches the cooking flow: the open PRs are #255, #243, #221, #220, #219, #218, #217, #214, #211 and #209, all docs / CI / other lanes. #243 (old DM-3) is still OPEN and superseded; it is not touched here. |
| Other recent lane | `claude/dinner-mission-dm4-dm5-audit-0dotex` (`31f1c47`, DM-4 / DM-5 audit). It is docs / tools only, has no PR, and changes no `src`. This gate uses its **modelled** CUT and cycle times as labelled assumptions (§6). |
| Baseline on `51e0923` (local) | Vitest **192 files, 4078 passed, 1 skipped** |

## 2. Fresh Audit mutants, re-run on `51e0923`

Tool: `tools/cut256_skip_mutants.py`. The logs are in `docs/reports/data/cut256-implementation-gate/mutant-M*-51e0923.txt`. The results are **identical to the Fresh Audit**.

| mutant | Vitest | what it proves |
|---|---|---|
| M1: base reducer only, bake failure | 4 failed / 2 files | Dinner R9/R10, R11 and R17 end with `lastResult = null`. **A base-only change soft-locks Dinner (OD-CUT256-4).** |
| M2: base reducer only, any FAILED | 18 failed / 6 files | Composition failures must keep CUT (OD-CUT256-2), and many CUT fixtures rely on it. |
| M3: base + Dinner resolver | 1 failed / 1 file (`cutStep` #27) | The coordinated shape is small. |

M3 was an *impact probe*. It re-evaluated the bake inside the resolver (`evaluateFreeCookCompletion`). **The design below does not do that** (§4).

## 3. CUT skip: exact semantics

Definitions: `completion` is the value `evaluatePizzaCompletion` returns at `CONFIRM_BAKE`, the only Completion Gate call for the round. For margherita, `bakeTarget` is 60–80 and the acceptable band is 50–90 (`BAKE_ACCEPTABLE_MARGIN_RATIO` = 0.5).

| case (margherita) | bakeState badge | completion | CUT today | **CUT after #256** |
|---|---|---|---|---|
| bake 3 / 49 | raw | FAILED `UNDERBAKED` | yes | **skipped → RESULT** |
| bake 50 (band edge) | raw | PASS (★ capped at 4) | yes | yes |
| bake 55 | raw badge | PASS ★≤4 | yes | **yes (OD-CUT256-1)** |
| bake 70 | perfect | PASS | yes | yes |
| bake 85 / 90 | burnt badge | PASS ★≤4 | yes | **yes** |
| bake 91 / 98 | burnt | FAILED `OVERBAKED` | yes | **skipped → RESULT** |
| empty pizza, bake 70 | perfect | FAILED `MISSING_REQUIRED_INGREDIENT` | yes | **yes (OD-CUT256-2)** |
| thin sauce, bake 70 | perfect | FAILED `INSUFFICIENT_SAUCE` | yes | yes |
| **missing ingredient + bake 3** | raw | FAILED, primary `MISSING…`, `failures` also has `UNDERBAKED` | yes | **needs OD-CUT256-6** (§12). Recommended: skip. |

Measured on `51e0923` with real gestures (`tools/cut256_cut_timing.spec.ts`, 60 runs, `data/cut256-implementation-gate/cut-timing-51e0923.jsonl`):
- CUT appears today for **all five** bake values (3 / 55 / 70 / 85 / 98), in Guided and in Lunch Rush.
- The Completion Gate result matched the table.
- One harness run aimed at 55 landed below 50. The needle moves 55 %/s, so the 10-point margin is only about 180 ms of needle travel. This was harness timing jitter, not a product defect.

**Rule (one predicate, all modes):** skip the post-BAKE steps **iff** `completion.status === "FAILED"` and `completion.failures` contains `UNDERBAKED` or `OVERBAKED`.
- The ★4 badge-only pizzas keep CUT (they are PASS).
- Composition-only failures keep CUT.
- Free Cooking is unchanged: it has no CUT, and its `free-cook` branch returns before the post-BAKE code.
- New Haven (no CUT profile) is unchanged.
- **Guided and Lunch Rush:** skipping CUT when the recipe is a CUT recipe is the observable difference.
- **Dinner:** its base completion is bake-only (§5.3), so the rule reduces to "the bake is outside the Stage A window's band". That is exactly Dinner's `INVALID_PIZZA` bake condition, so the modes stay consistent (OD-CUT256-3).

## 4. SSOT / data-flow design

The verdict is made **once**, by the existing Completion Gate, at `CONFIRM_BAKE`. Every later layer **reads that value** and never re-derives a bake verdict. No new threshold, no second band calculation, and no Dinner-side re-evaluation are added.

```
Layer 0  src/logic/completionGate.ts           (SSOT, pure)
         checkBake()  ── unchanged, the only band logic
         evaluatePizzaCompletion() ── unchanged
       + bakeCompletionFailure(completion): "UNDERBAKED" | "OVERBAKED" | null
           reads completion.failures only; no numbers, no bakeTarget

Layer 1  src/state/gameReducer.ts  base CONFIRM_BAKE   (Guided, Lunch Rush and Dinner all run it)
         completion = evaluatePizzaCompletion(...)      ── the one call, unchanged
       + postBake = bakeCompletionFailure(completion) ? [] : postBakeSteps(cookingProfile)
           → phase RESULT; makingStep and cutState untouched; no CUT timing started

Layer 2  src/state/gameReducer.ts  dinnerGuardedReducer CONFIRM_BAKE
         baked = baseGameReducer(state, action)
       + cutWaivedFor = bakeCompletionFailure(baked.completion)   ── read BEFORE the existing clear
         next = { ...baked, score: null, scoringV2Result: null, completion: null }   (unchanged)
         next.phase === "RESULT" → dinnerResolve(..., { cutCompleted: false, cutWaivedFor }, now)

Layer 3  src/mission/dinner/dinnerResultDetection.ts  resolveDinnerAttempt (Stage B)
       + DinnerAttemptInput.cutWaivedFor?: "UNDERBAKED" | "OVERBAKED" | null   (a runtime fact, like cutCompleted)
         CUT_PENDING rule: plan.cutRequired && !cutCompleted && !cutWaivedFor → REJECTED
         classify(): UNCHANGED (its existing INVALID_PIZZA evaluation stays the Dinner result authority)
       + fail-closed consistency, only when the waiver is what lifts CUT_PENDING
         (plan.cutRequired && !cutCompleted && cutWaivedFor): the classification must be
         INVALID_PIZZA whose completion.failures contain cutWaivedFor; otherwise
         REJECTED "CUT_WAIVER_MISMATCH" (nothing consumed or completed). It compares values already
         computed and adds no evaluation. It uses `failures`, not the primary `reason`, so an
         empty + raw pizza (primary MISSING) cannot trip it. A waiver on a pizza without CUT is
         simply unused.
```

**Why this is not a re-computation in Dinner:**
- The skip / waiver decision exists only in Layer 1.
- Stage B's `classify` evaluated INVALID before #256 and still does. It is the DM-3R-1 result authority for every Dinner pizza, including the no-CUT and empty-pizza paths.
- The mismatch guard only compares two values that already exist.
- A property test (D-P in §8) pins that the two agree. It was already checked once on `51e0923` with a throwaway test: 26 windows × {empty, non-empty} × 201 bake values = 10 452 cases, all equal. The test pins the agreement over every recipe window, the generic window, and bake values 0–100. That makes the guard unreachable by construction; it stays only as a fail-closed backstop against a future drift.

**Rejected alternatives:**

| alternative | why rejected |
|---|---|
| base-only skip | soft-locks Dinner (M1) |
| resolver re-evaluates the bake band (M3 shape) | a second verdict path; forbidden by this gate's SSOT rule |
| skip keyed on `bakeState` | violates OD-CUT256-1 (★4 badge pizzas would lose CUT) |
| make Stage B consume the base `completion` instead of its own `evaluateFreeCookCompletion` | the true single path, but it rewrites the DM-3R-1 pure API and many of its tests. That is an unrelated refactor for this slice; it can be a later cleanup. |
| store a new `GameState` field (`postBakeSkipped`) | redundant: `state.completion` already records the verdict for Guided / Lunch Rush, and Dinner needs it only inside one reducer call |

## 5. Impact by mode

### 5.1 Guided

- **Flow:** `handleConfirmBake` dispatches `CONFIRM_BAKE` and then `REGISTER_TO_DEX`. With a skip, the round lands on RESULT directly. `REGISTER_TO_DEX` already returns state unchanged for FAILED, so nothing is registered, exactly as today after CUT.
- **UI:** the FAILED card (`ResultPanel`, `completion.status === "FAILED"`) already hides the CUT block and timing. The pizza image simply has no cut lines.
- **No changes needed in:** `App.tsx`, `GameScreen.tsx`, `ResultPanel.tsx`.
  - `MakingStepTabs` renders only in PREPARE / BAKE / POST_BAKE-CUT (`GameScreen.tsx:507–509`), never in RESULT. So no half-finished カット tab can show.
- **Cooking time (手際):** unchanged. `completedMs` ends at START_BAKE. `perStepElapsedMs.CUT` is simply absent, and the display already omits absent steps.
- **Dex / Pitz / BEST:** unchanged. FAILED registers nothing today either.

### 5.2 Lunch Rush

- **Flow:** RESULT arrives about one CUT earlier. `handleMissionServeNext` is unchanged: it requires `state.score`, which a FAILED non-free-cook round still has.
- **Serve and ranking:** `SERVE` is logged with `completionFailed: true`, so the serve log and the submission payload are unchanged.
- **UI:** `MissionServePanel`'s FAILED variant already hides the CUT score. Measured: a PASS shows 「✂️ カット 100点」, a FAILED shows only 「生焼けで提供できません / 注文失敗 🚫」.
- **Timing effect:** the only effect is time. See §6.

### 5.3 Dinner

- **What the base completion checks in Dinner:** `dinnerStartBake` sets `recipe = { ...FREE_COOK_RECIPE, bakeTarget: planWindow }`. The sentinel has no required ingredients and no Reference, so the base `completion` in a Dinner round is **bake-only against the Stage A window**. Stage B uses the same window (`planDinnerBake` on the same frozen composition, which is pinned).
- **Identified CUT recipe with an out-of-band bake:** resolves **at CONFIRM_BAKE** to `INVALID_PIZZA` (UNDERBAKED / OVERBAKED).
  - Stock is consumed once (the pre-consumption stock is still captured before the base reducer).
  - `pending` is cleared, `lastResult` is set, and no CUT screen appears.
- **Unchanged paths:**
  - an unidentified or ambiguous composition (it already had no CUT)
  - an in-band bake (CUT still required; `CUT_PENDING` kept)
  - TIME_UP (the clock check before the bake still wins)
  - the HOME dialog freeze
- **Anti-spoiler:** the "CUT presence means a CUT recipe matched" signal (#252 report §13 risk 2) gets **narrower**. A failed bake now looks the same whether the pizza was identified or not.
- **Dinner run clock:** a failed identified pizza now costs about one CUT less (same size as in Lunch Rush). The DM-4 / DM-5 audit models this as 2–5 s per failed pizza, and it does not change that audit's recommendations.

## 6. Lunch Rush: measured and modelled impact (OD-CUT256-5)

### 6.1 How long does CUT take?

| source | value | kind |
|---|---|---|
| UI floor: `取り出す` → CUT screen | 0.02–0.05 s | **(M)** 60 real-gesture runs, Chromium 390×844, `51e0923` |
| UI floor: 3 automated drags + `切り終わる` → result | median **0.50–0.75 s** (gestures 0.35–0.70 s, confirm → result 0.08–0.20 s) | **(M)** |
| fixed "human-like" pacing (450 ms per drag, 650 ms gaps, 350 ms before confirm) | 4.5–4.8 s | (A): an input assumption, not a human measurement |
| player model (DM-4 / DM-5 audit, KLM-based) | EXPERT 2.1 s, AVERAGE 3.0 s, BEGINNER 4.8 s | (A) |
| real human telemetry | **none exists** (no analytics, and `perStepElapsedMs` is never persisted) | — |

Cheap human sample, if the Owner wants one: the Guided RESULT timing detail already shows 「カット m:ss」 per round on the device. Five rounds read off an iPhone would replace the (A) rows.

### 6.2 How the score is built (code, `51e0923`)

- `score = round(PASS × 100 + Σ qualityTotal(PASS))`. FAILED adds 0 (`calculateLunchRushMissionScore`, used by the client and bundled into the Cloud Function).
- The serve log carries `{ recipeId, qualityTotal, completionStatus }`, **with no timing**. The server's only pace guard is `MAX_SERVES_PER_RUN` = 90, counting PASS serves.
- #256 changes **none** of the listed `LUNCH_RUSH_RULESET_VERSION` bump triggers: formula, Completion Gate applicability, and duration (180 s).
- **Leaderboard keys are `weekly_<isoWeek>`, `monthly_<yyyymm>` and `all_time`, with no version component.** A ruleset bump would therefore *not* separate old and new scores. It would only make the Cloud Function reject submissions from clients still on the old version, and it requires a Functions deploy.

### 6.3 Run-score model

Tool: `tools/cut256_lunch_rush_impact.py`, seeded, 20 000 runs per cell, common random numbers. `--check` reproduces the output byte for byte. Data: `data/cut256-implementation-gate/lunch-rush-impact.json`.

With per-pizza cycle variance σ = 20 % (A):

| profile (cycle / CUT) | bake-fail rate p | mean score, current → skip | Δ | runs improved | best run, current → skip |
|---|---|---|---|---|---|
| EXPERT (18.9 s / 2.1 s) | 0.05 | 1588.8 → 1597.4 | +8.6 (+0.54 %) | 4.6 % | 2220 → **2220** |
| EXPERT | 0.20 | 1337.9 → 1367.2 | +29.3 (+2.19 %) | 15.9 % | 2035 → **2035** |
| AVERAGE (29.9 s / 3.0 s) | 0.10 | 872.2 → 880.1 | +7.9 (+0.90 %) | 4.5 % | 1400 → **1400** |
| AVERAGE | 0.30 | 679.6 → 698.1 | +18.5 (+2.72 %) | 10.5 % | 1225 → **1225** |
| BEGINNER (50.1 s / 4.8 s) | 0.20 | 410.5 → 416.9 | +6.5 (+1.57 %) | 3.9 % | 825 → **825** |

- **Without variance (σ = 0, the lower bound):** the effect is almost always **0**. An AVERAGE player would need about 29 s saved (10 failed bakes) to fit one more pizza.
- **In every cell:** runs made worse = **0**. The best run is unchanged, because the best run is a no-failure run. One affected run gains at most **one** extra PASS serve (+165…185).

### 6.4 What changes in the ranking

1. **The top of every board is unaffected.** Top scores come from runs with no bake failure, and those are identical under both rules.
2. **A bake failure is still expensive.** It keeps costing a whole order (0 points) plus about 90 % of a pizza cycle. Only the CUT portion is refunded, so failing is never rewarded and the order of skill is kept.
3. **Mid-board, failure-heavy runs** gain about +0.5–3 % on average. A lucky run gains at most one serve.
4. **Board mixing:** weekly boards reset weekly. Monthly and all-time boards would hold a few pre-#256 runs that are at most one serve lower. A version bump would **not** separate them (no version in the key).

**Recommendation for OD-CUT256-5: do not bump `LUNCH_RUSH_RULESET_VERSION`.** None of its documented triggers change, and top scores are provably unchanged in the model.
- A bump would reject in-flight older clients.
- It would need a Functions deploy.
- It would still not partition the boards.
- If the Owner wants partitioned boards, that is **LR Ranking 2.0 (#224) scope**, not #256.

## 7. Implementation files (#256, slice S-256)

| file | change | size |
|---|---|---|
| `src/logic/completionGate.ts` | add `bakeCompletionFailure()` and its type (reads `failures` only) | ~15 lines |
| `src/state/gameReducer.ts` | base `CONFIRM_BAKE`: gate `postBake` on the selector. `dinnerGuardedReducer` CONFIRM_BAKE: read `cutWaivedFor` before clearing. `dinnerResolve`: pass it through. | ~15 lines |
| `src/mission/dinner/dinnerResultDetection.ts` | `DinnerAttemptInput.cutWaivedFor`, the `CUT_PENDING` rule, the `CUT_WAIVER_MISMATCH` rejection | ~15 lines |
| `src/App.tsx`, `GameScreen.tsx`, `ResultPanel.tsx`, `MissionServePanel.tsx`, CSS | **none** | — |
| `src/shared/lunchRushScoring.ts`, `functions/**` | **none** (OD-CUT256-5 recommendation) | — |
| docs | Result Report. DM-3R-1 contract note: "a CUT identity cannot resolve before CUT confirm, **unless the Completion Gate reported a bake failure**". PROJECT_HANDOFF addendum. | — |

## 8. Test matrix (S-256)

**Unit, pure:**

| id | file | assertion |
|---|---|---|
| G-1 | `completionGate.test.ts` | selector: null / PASS → null; FAILED{UNDERBAKED} → UNDERBAKED; FAILED{OVERBAKED} → OVERBAKED; FAILED{MISSING} → null; FAILED{INSUFFICIENT_SAUCE} → null; FAILED{MISSING, UNDERBAKED} → per OD-CUT256-6 |

**Unit, reducer** (`gameReducer.cutStep.test.ts`; #27 is rewritten, not deleted):

| id | assertion |
|---|---|
| C-1 | margherita bake 49 / 5 → RESULT; `makingStep` unchanged; `cutState.lines` empty; no `perStepElapsedMs.CUT`; stock consumed once; completion UNDERBAKED |
| C-2 | bake 91 / 98 → RESULT, OVERBAKED |
| C-3 | bake 50 / 55 / 70 / 85 / 90 → POST_BAKE / CUT (boundaries + badge-only; OD-CUT256-1) |
| C-4 | empty margherita at bake 70 → still POST_BAKE / CUT, then RESULT FAILED MISSING (replaces #27; OD-CUT256-2) |
| C-5 | empty margherita at bake 5 → per OD-CUT256-6 |
| C-6 | Lunch Rush round (`isMissionRound`, `bakedMargheritaAtCut` path) → same as C-1 / C-3 |
| C-7 | new-haven and Free Cooking unchanged (existing `freeCook` tests plus one explicit check) |
| C-8 | after a skip, `CONFIRM_MAKING_STEP`, `ADD_CUT_LINE` and a second `CONFIRM_BAKE` are no-ops |

**Unit, Dinner** (`gameReducer.dinner.test.ts`):

| id | assertion |
|---|---|
| D-1 | identified margherita, bake below band → resolved at CONFIRM_BAKE: `INVALID_PIZZA` UNDERBAKED, `pending` null, consumed once (equal to the no-CUT path), no POST_BAKE |
| D-2 | same above band → OVERBAKED |
| D-3 | identified, in-band (incl. badge-only) → POST_BAKE; resolver still rejects without CUT |
| D-4 | TIME_UP at CONFIRM_BAKE unchanged; HOME dialog still freezes CONFIRM_BAKE |
| D-5 | R9 / R10 / R11 / R17 stay green unchanged (they passed under M3) |

**Unit, resolver** (`dinnerResultDetection.test.ts`):

| id | assertion |
|---|---|
| D-R1 | `cutRequired`, not cut, waiver → RESOLVED `INVALID_PIZZA` |
| D-R2 | no waiver → `CUT_PENDING` |
| D-R3 | waiver with an in-band bake → `CUT_WAIVER_MISMATCH`, nothing consumed or completed. A waiver on a no-CUT plan is ignored (the result is the normal one). |
| D-P | property: for every recipe window and the generic window, bake 0–100 in 0.5 steps, with an empty and a non-empty pizza, the base verdict `bakeCompletionFailure(evaluatePizzaCompletion(sentinel with window, pizza))` equals the bake entry of Stage B's INVALID `completion.failures` (both null when the bake is in band) |

**Mutants (all must be detected):**

| mutant | detected by |
|---|---|
| skip on `bakeState` | C-3 |
| skip on any FAILED | C-4 |
| base only (M1) | D-1 |
| waiver ignored | D-1 |
| waiver trusted without the guard | D-R3 |
| primary `reason` instead of `failures` | C-5 (if OD-CUT256-6 = failures) |
| selector returns non-null for PASS | C-3 |

**E2E** (Chromium 390 and 360; the WebKit CI gate runs the specs):

| id | file | change |
|---|---|---|
| E-1 | `e2e/support/dinner.ts` | `cookDinnerPizza` expects CUT only when `spec.cut && !underbake && !overbake`; update the doc comment |
| E-2 | `e2e/dinner-mission.spec.ts` | R5/R9 asserts no 「切り終わる」 before 生焼け. New: an identified margherita, burnt → no CUT → 「焦げてしまいました」 |
| E-3 | new `e2e/cut-skip-failed-bake.spec.ts` | Guided raw and burnt → 失敗 card, no CUT. Guided bake 55 → CUT kept, then PASS. Lunch Rush burnt → FAILED serve panel with no CUT; 次の注文へ goes on to the next order. |
| E-4 | `e2e/gestures.ts` | doc comment of `failMissionOrderMissingSauce` only (the behaviour is already tolerant: `if count()`) |

**Human Verification** (policy; 390×844 video delivered directly, never committed):
- Guided burnt → result, and Guided bake 55 → CUT kept
- Lunch Rush burnt → failed serve
- Dinner identified margherita burnt → INVALID with no CUT
- before / after screenshots under `docs/reports/screenshots/cut256-*`

## 9. Dinner UI plan

### 9.1 S-UI-1: copy only, no layout

| item | plan | data authority |
|---|---|---|
| **「あと★N」** (OD-DUI-5) | QUALITY_FAIL `BELOW_MINIMUM_STARS` line `「マルゲリータ ★4 → あと★1」`. The title stays 「もう少し丁寧に作ろう」; the Owner may pick 「あと★1！」 as the title instead. | `view.failure.stars` and `view.failure.minimumStars` are already in `DinnerAttemptView`. `minimumStars` is the **injected** `session.minimumStars` (`DINNER_START` requires it; DEV / Preview `?dinnerMinStars`, placeholder 3; production START stays unavailable without S). `stars` is the displayed, bake-capped ★. So `N = minimumStars − stars` is exact for whatever S was injected, and is ≥ 1 by construction (`stars < minimumStars` is the category's definition). `COMPLETION_GATE` failures have no ★, so they keep the ingredient message. |
| **「最後のピザ」** (OD-DUI-3) | a new pure `dinnerLastPizzaLabel(view)` in `dinnerView.ts`, rendered by the CLEAR and INFEASIBLE branches (see the table below) | presentation-safe `DinnerAttemptView` only (OD-R4 kept) |
| 「DINNER CLEAR!」 (OD-DUI-4) | **no change** | — |
| cause coaching (OD-DUI-6) | **not implemented** (DM-5 authority) | — |

「最後のピザ」 label by category. The old headline strings (「もう少し丁寧に作ろう」, 「これはもう完成済み！」) no longer appear after 「最後のピザ：」.

| last attempt | label | notes |
|---|---|---|
| TARGET_PASS (always the case on CLEAR) | `マルゲリータ ★4` | name + ★ |
| QUALITY_FAIL, below S | `マルゲリータ ★3（合格 ★5）` | |
| QUALITY_FAIL, Completion Gate | `マルゲリータ（未完成）` | no ★ exists |
| DUPLICATE_TARGET | `マルゲリータ（完成済み）` | no ★ computed (by design) |
| NON_TARGET | `フンギ（ターゲット外）` | not scored |
| ORIGINAL | `オリジナルピザ` | anonymous (OD-R4) |
| INVALID_PIZZA | `ピザにならなかった（生焼け / 焦げ / 具なし）` | no identity by design |

Width: the longest possible label, `ニューヘイブンアピッツァ ★3（合格 ★5）`, is shorter than the probe that already measured 1 line at 360×640 (Fresh Audit B1). Re-measure in the slice.

Files: `src/state/dinnerView.ts`, `src/components/DinnerGameUi.tsx`.

Tests that pin today's strings and must be updated:
- `DinnerGameUi.test.tsx`: lines 94, 129 and 168 (168 pins 「最後のピザ：これはもう完成済み！」)
- `dinnerView.test.ts`: the copy table at line 144
- `e2e/dinner-mission.spec.ts`: lines 124 and 161–162

New tests:
- label per category
- N for S = 1..5 × ★ = 1..S−1
- no name in ORIGINAL / INVALID (anti-spoiler sweep)

### 9.2 S-UI-2: target row (OD-DUI-1 / OD-DUI-2)

Prototyped with **browser-only injected CSS** on `51e0923`, measured the Layout Contract way (dough = `[data-pizza-drop-target]` width), in PREPARE and BAKE.
- Tool: `tools/dinner_ui_s2_prototype.spec.ts`
- Data: `data/cut256-implementation-gate/dinner-ui-s2/`
- Bar crops: `screenshots/cut256-implementation-gate/`

| variant | 390×844 bar / dough (PREP · BAKE) | 390×664 | 360×800 | 360×640 | names fitting (of 25) |
|---|---|---|---|---|---|
| V0 today (1 line 10px, thumb 30 / 26) | 57 / 290 · 358 | 48 / 265 · 333 | 57 / 273.6 · 328 | 48 / 241 · 309 | 11 (390) / 7 (360) |
| V1 2 lines 10px | 67 / 290 | 57 / **256 (−9)** | 67 / 273.6 | 57 / **232 (−9)** | 22–25 |
| V2 2 lines 9px, thumb 26 | 58.8 / 290 | 54.8 / **258.2 (−6.8)** · **326.2 (−6.8)** | 58.8 / 273.6 | 54.8 / **234.2 (−6.8)** · **302.2** | 25 |
| V3 2 lines 9px, thumb 24 | 56.8 / 290 | 52.8 / **260.2 (−4.8)** | 56.8 / 273.6 | 52.8 / **236.2 (−4.8)** | 25 |
| V4 2 lines 9px lh 1.05, thumb 20 | 56 / 290 · 358 | 48 / 265 · 333 | 56 / 273.6 · 328 | 48 / 241 · 309 | 25 |
| **V6 = V3 above 700 px height, V4 at or below** (the row's existing `@media (max-height: 700px)` split) | **56.8 / 290 · 358** | **48 / 265 · 333** | **56.8 / 273.6 · 328** | **48 / 241 · 309** | **25 / 25** |

- Result: 2-line names at 9px fit every name at every viewport. At short heights (664 / 640) the 2-line variants that keep a 24–30 px thumbnail **shrink the stage by 4.8–9 px**. That fails OD-DUI-2, so V1–V3 are out.
- **V6 keeps every PREPARE and BAKE diameter identical to today at all four viewports** (the bar is 0.2 px shorter), with 25 / 25 names fully shown and no page scroll. Its cost is the thumbnail: **30 → 24 px (tall), 26 → 20 px (short)**. The full picture remains one tap away in the 見本 popover.
- `L-J` (tabs top stable) is unaffected: the tabs sit above the bar.

「見本」 affordance, the minimal options compared (OD-DUI-1). Screenshots `*-A*.png` and `*-V6+A1*.png`.

| option | layout cost | result |
|---|---|---|
| A1 🔍 bottom-right of the thumbnail | 0 | **overlaps the name at 360×640** (「マルゲリ🔍タ」). Rejected. |
| **A1b 🔍 top-left of the thumbnail** (✓ stays top-right) | 0 px; bar and dough identical to V6 | readable, no collision. **Recommended.** Markup `<span aria-hidden>`, not CSS content, so it is testable. |
| A2 flat dashed outline chips | +1–2 px bar height; stage 265 → 264 at 390×664 | reads less like a button, but loses contrast and changes the row's look more than needed |
| A3 vertical 「見本」 row label | −4.5 px per chip width | 10px vertical text, hard to read. Rejected. |

The accessible name stays 「○○の見本を見る」. Optionally, the list's label becomes 「ディナーのターゲット（タップで見本）」. No pressed or selected state is added (OD-R7).

Files:
- `src/App.css` (`.dinner-chip*` only)
- `src/components/DinnerGameUi.tsx` (badge span)

Tests:
- `DinnerGameUi.test` R27 unchanged (a tap selects nothing), plus an assertion that the badge is aria-hidden
- `layout-contract.spec.ts` **LC-S DINNER floors unchanged and passing** (the acceptance criterion: no floor edit)
- `stage-size-stability.spec.ts` unchanged
- new E2E: no DM-A / DM-B chip name is truncated (`scrollHeight ≤ clientHeight`) at 390×844 / 360×800 (plus 664 / 640 via the Layout Contract profiles)

Human Verification: a 390×844 video of the row plus a popover tap, and before / after screenshots at 4 viewports. The iOS colour emoji 🔍 may render larger than Chromium's; check it on the device.

## 10. Order and rollback

**Order:** S-256 → S-UI-1 → S-UI-2, each its own PR (no bundling of behaviour and UI). S-UI-1 and S-UI-2 are independent of S-256 and can go in either order.

| slice | rollback | persistence / server impact |
|---|---|---|
| S-256 | `git revert` of one PR, which restores CUT on failed bakes everywhere | none: no save field, no ruleset, no Functions change. Dinner sessions are not persisted. Lunch Rush serves carry no timing. |
| S-UI-1 | revert (copy and a pure helper) | none |
| S-UI-2 | revert (CSS and one span) | none; the Layout Contract floors are untouched either way |

## 11. Evidence index

| file | what |
|---|---|
| `tools/cut256_skip_mutants.py` | M1–M3 (from the Fresh Audit) |
| `docs/reports/data/cut256-implementation-gate/mutant-M{1,2,3}-51e0923.txt` | the re-run on `51e0923` |
| `tools/cut256_cut_timing.spec.ts` | CUT applicability and timing |
| `…/cut-timing-51e0923.jsonl` | 60 runs |
| `tools/cut256_lunch_rush_impact.py` | the run-score model (`--check`) |
| `…/lunch-rush-impact.json` | 30 cells |
| `tools/dinner_ui_s2_prototype.spec.ts` | the S-UI-2 prototype |
| `…/dinner-ui-s2/*.json`, `docs/reports/screenshots/cut256-implementation-gate/*.png` | 4 viewports × variants |

## 12. Owner Decisions still open

| id | question | recommendation | blocks |
|---|---|---|---|
| **OD-CUT256-5** | Bump `LUNCH_RUSH_RULESET_VERSION`? | **No** (§6.4). Measured: no documented trigger changes; best runs are unchanged; a bump would not partition the boards. | S-256 |
| **OD-CUT256-6** (new) | A pizza with **both** a composition failure and a Completion-Gate bake failure (e.g. missing sauce + taken out at once). OD-1 says "UNDERBAKED / OVERBAKED confirmed → skip"; OD-2 says composition failures do not skip. | **Skip** (use `failures`, not the primary `reason`). The bake failure is certain whatever the composition, and Dinner's INVALID precedence already treats it that way. | S-256 (C-5, one mutant) |
| **OD-DUI-2a** | Accept a smaller thumbnail (30 → 24 px tall, 26 → 20 px short) to get 2-line names with no stage loss? | **Yes (V6).** The alternative that keeps the thumbnail is V5 (2 lines only above 700 px height), which leaves 「マルゲリ…」 at 360×640 / 390×664. | S-UI-2 |
| **OD-DUI-1a** | Affordance: 🔍 top-left (A1b), or none? | **A1b** | S-UI-2 |
| OD-DUI-3a | The 「最後のピザ」 fallback wording in §9.1 | approve the table, or edit the words | S-UI-1 (wording only) |
| OD-DUI-5a | 「あと★N」 in the line (recommended) or the title | line | S-UI-1 (wording only) |

## 13. FINAL VERDICT

**B. OWNER DECISION REQUIRED**, a small, bounded set:
- **S-256** needs OD-CUT256-5 (recommended: no bump) and OD-CUT256-6 (recommended: skip on any bake failure).
- **S-UI-2** needs OD-DUI-2a (recommended: V6) and OD-DUI-1a (recommended: A1b).
- **S-UI-1** needs only wording approval (OD-DUI-3a / 5a).

If the Owner accepts the recommendations as written, every slice is **ready to implement** exactly as planned in §7–§10. No blocker was found: #252 is merged, `51e0923` matches the measured head, no duplicate issue or PR exists, and the SSOT design adds no second bake verdict.
