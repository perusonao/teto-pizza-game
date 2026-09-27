# Dinner Mission DM-3R-2 — Result-Detection UI / Runtime Redesign: Result

- **Issue:** #250 (DM-3R-2 only. Duplicate Gate: no DM-3R-2 Issue or PR existed; #242 / PR #243 are the old DM-3 slice)
- **Branch:** `claude/dm-3r-2-result-detection-ioac6d`, started from fresh `origin/main` `726b0ac`
- **PR:** see §20 (targets `main`, no auto-merge)
- **Authority:**
  - `docs/reports/TETO_DINNER-MISSION_DM-3_HUMAN-REVIEW_REDESIGN.md` (`fe221af`): OD-R1 to OD-R10 and §16 slice 3
  - DM-3R-1 Result Report (§21 integration map, §22 residual risks)
  - DM-3R-0 Result Report (LC-S1 to LC-S4)
  - `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
- **Type:** gameplay / UI. Covered by Human Verification: screenshots are committed; the videos went to the Owner directly.

## 1. Fresh audit (before implementation)

| item | fresh state |
|---|---|
| `origin/main` | `726b0acf…` (Merge PR #249, DM-3R-1). This is the expected SHA. |
| DM-3R-0 / H3-3 / DM-3R-1 | PR #246, #247 and #249 are MERGED. Issue #248 is CLOSED. |
| PR #243 (old DM-3) | OPEN, head `fd4c28b` (unchanged), base `4bf098f`, 25 commits behind main. A local test merge into `726b0ac` conflicts only in `src/App.css`, and both sides are append-only. |
| Issue #242 (old DM-3) | OPEN |
| H3-4 | Not touched |

### 1.1 PR #243 reuse map (from its diff)

| part of #243 | decision | reason |
|---|---|---|
| `dinnerView.ts`: duration resolver, clock format, locked-card privacy, readiness | **KEEP (ported)** | Authority-neutral. Readiness is extended with S. |
| `DinnerMissionScreen.tsx` (Select / Detail) | **KEEP (ported)** | Only the copy changed ("好きな順番で" becomes auto-judge), plus the S line. |
| `DinnerHud`, `DinnerResultOverlay`, `DinnerAbandonDialog` | **KEEP (ported)** | The overlay gained a "最後のピザ" line. |
| `useDinnerRuntime` (display clock, in-app abandon API) | **KEEP (ported)** | `startDinner` now also takes S. |
| HOME Dinner card (`HomeScreen.tsx`) | **KEEP (ported, byte-identical)** | `HomeScreen.tsx` has not changed on main since `4bf098f`. |
| App wiring (Screen `DINNER`, retry / Shop / quit handlers, `?dinnerDuration` DEV/Preview gate) | **KEEP, adapted** | The round key uses `roundSeq` instead of `activeRecipeId`. |
| Dinner CSS | **KEEP / MODIFY** | Board styles removed. Target row and result panel styles added. |
| `DinnerTargetBoard`, `dinnerBoardRows`, `DINNER_SELECT_TARGET` / `CANCEL_TARGET` / `RETURN_TO_TARGETS`, `activeRecipeId` | **REMOVE** | These are the declared-target authority that OD-R1 / OD-R3 removes. |
| `DinnerTargetResultPanel` (declared target PASS/FAILED) | **REPLACE** | Replaced by `DinnerAttemptResultPanel` (6 categories). |
| guided per-target round (`dinnerRoundState` + `startPreparing(recipe)`) | **REPLACE** | Replaced by a recipe-free round (`dinnerFreeRound`). |
| E2E `cookDinnerTarget` / spec | **REPLACE** | Replaced by `cookDinnerPizza` (no board click; any composition). |
| committed screenshots / DM-3 report | not ported | They describe the old flow. Four of them are reused as "before" images (§17). |

### 1.2 PR strategy (chosen before implementing)

**New PR from the latest main. PR #243 is not updated, merged or closed.**

- #243 predates DM-3R-0, H3-3 and DM-3R-1. Its core (Target Board / `activeRecipeId` / guided target round) is exactly what this slice removes, so updating it in place would leave little of its own design.
- The designated branch for this session is a different branch, so pushing to #243's branch is also out of scope.
- The reusable files were ported as file content with attribution, **not** by merging #243's commits. Merging them would make GitHub mark #243 as merged once this PR lands, which would misstate what happened ("do not merge #243 as is").
- **Proposal to the Owner:** after reviewing this PR, close #243 and #242 as superseded by #250. No close was done here.

### 1.3 Runtime audit (what main had before this slice)

- **DM-2 runtime:**
  - `dinnerGuardedReducer` allowed cooking only for `activeRecipeId === recipe.id`.
  - It resolved `RESOLVE_ATTEMPT(recipeId, PASS/FAILED)` from `next.completion` on the transition that reached RESULT.
  - The DM-3R-1 pure layer was not wired in.
- **START_BAKE** is a phase change only.
- **CONFIRM_BAKE** is the single consumption point (`consumePizzaInventory`, exactly-once phase guard). A CUT recipe goes to `POST_BAKE` and reaches RESULT on the last `CONFIRM_MAKING_STEP`.
- **Free Cooking** uses the inert `FREE_COOK_RECIPE` sentinel. Its tray offers all OWNED ingredients through `trayIngredientsFor(freeCook)`.
- **Completion Gate:** the Dinner policy is `"order"` (`completionPolicyForRound`).
- **Scoring 2.0:** `computeScoringV2` + `toLegacyScoreBreakdown` (★ with the bake cap).
- **H3-3:** `PURCHASE_SELECTABLE_HINT` / `PURCHASE_DISCOVERY_HINT` were already in `DINNER_BLOCKED_ACTIONS`. `SHOW_HINT` was not.
- **Attempt log:** `DinnerAttempt = { recipeId, completion, at }`. DM-3R-1 did not update it (its §22 risk 3).

## 2. Result-detection wiring

All logic stays in the DM-3R-1 module. No Dinner matcher, and no new Scoring or Gate logic.

```
DINNER_START(missionId, now, durationMs, minimumStars)
  └─ dinnerFreeRound: FREE_COOK_RECIPE sentinel, roundKind DINNER, freeCook=false, PREPARE, no Cooking Time
PREPARE (all OWNED ingredients; composition actions only here)
START_BAKE ── dinnerStartBake
  ├─ plan = planDinnerBake(pizza)                 (Stage A, internal → dinner.pending.plan)
  ├─ view = dinnerBakePlanView(plan)              (window, post-BAKE steps, cutConfig — no identity)
  ├─ recipe = { ...FREE_COOK_RECIPE, bakeTarget: view.bakeTarget }   (name stays anonymous, OD-R6)
  └─ cookingProfile = preBake(default) + view.postBakeSteps (+cutConfig); cutState recreated
CONFIRM_BAKE ── tick → TIME_UP? (nothing baked)
  ├─ preConsumptionInventory = state.inventory    ← captured HERE, before the one consumption
  ├─ base CONFIRM_BAKE (consumePizzaInventory once; sentinel score/completion cleared)
  ├─ no CUT → Stage B now (cutCompleted=false)
  └─ CUT    → POST_BAKE; pending.preConsumptionInventory stored
last CONFIRM_MAKING_STEP (CUT) ── tick → TIME_UP?
  └─ Stage B with the captured stock (cutCompleted=true)
Stage B = resolveDinnerAttempt(...) → run adopted, lastResult = dinnerAttemptView(classification, dex)
DINNER_NEXT_PIZZA (RESULT, PLAYING) → next dinnerFreeRound (roundSeq+1)
```

- **Player intent is not an input anywhere.** No action, state field or UI value carries a "chosen" target. A chip tap is local view state in `GameScreen` and is never dispatched (R27).
- **Another remaining target made next** completes that target (R4). Nested signatures follow DM-3R-1 (R4 also pins breakfast−bacon = bismarck).
- **Composition is frozen after START_BAKE.** `DINNER_COMPOSITION_ACTIONS` (sauce, topping, dough, RESET) are refused outside PREPARE in the Dinner guard. The test sweeps BAKE / POST_BAKE / RESULT. A repeated START_BAKE does not re-plan.

## 3. Inventory: the exactly-once contract

| point | stock |
|---|---|
| START_BAKE | untouched |
| CONFIRM_BAKE | `preConsumptionInventory := state.inventory` (captured), then the base reducer consumes **once** |
| CUT confirm | **untouched** (the same object as after CONFIRM_BAKE) |
| Stage B | receives the captured pre-consumption stock. Its own `postConsumptionInventory` is used only to judge the remaining set. |

Pinned by:
- **DM-3R-1** `inventory contract: PRE-consumption stock in, consumed exactly once`: unchanged, still passes.
- **Runtime R15 / R16** (`gameReducer.dinner.test.ts`):
  - On the real reducer, with DM-A exact stock and bismarck through CUT:
    - `pending.preConsumptionInventory` equals the start stock
    - CUT does not change `state.inventory`
    - the run stays PLAYING with egg 1 left
    - the attempt's `consumed` is `{egg:1}`
    - the resolver's `postConsumptionInventory` deep-equals the reducer stock
  - A mutation guard shows that feeding the post-bake stock (the double-consumption bug) fails the run as INFEASIBLE.
- **R17:** QUALITY_FAIL, INVALID_PIZZA, ORIGINAL and DUPLICATE all keep their consumption. Nothing is refunded.
- **Feasibility:** after every attempt, `remainingTargetShortages` runs on the post-consumption stock (R18 and the New Haven over-placement case). The last target CLEARs first (R19).

## 4. minimumStars (S): temporary handling

**Choice: injected at DINNER_START, with a `null` DM-5 slot in the mission data, and a DEV/Preview-only explicit placeholder.**

- **Mission data:** `DinnerMissionDefinition.quality.minimumStars: QualityStars | null`. Both shipped missions are `null`. This mirrors `timeLimit.seconds: null`, so DM-5 replaces the value in one place. The validator accepts only 1..5 or null.
- **Runtime:** `DINNER_START` requires `minimumStars` (1..5 integer; no default). The session keeps it for the run, and Stage B receives it.
- **Resolution:** `resolveDinnerMinimumStars(mission, search, previewAllowed)`:
  1. the mission's own S (DM-5 onward)
  2. if `previewAllowed`, a valid `?dinnerMinStars=1..5`
  3. if `previewAllowed`, `DINNER_PREVIEW_MINIMUM_STARS_PLACEHOLDER = 3`
  4. otherwise `null`, which makes readiness NOT_TUNED and disables START
- **Production:** `previewAllowed = DEV || VITE_PREVIEW_MODE`, which Vite replaces statically. So production has no S, and START stays unavailable. It already was, because the duration is untuned (OD-DM3-1). The production bundle has 0 `location.search` references.

Why:
- OD-R2 keeps S as DM-5 authority.
- The placeholder is named, documented and unreachable in production, so it cannot become a balance value by accident.
- Detail shows 「合格ライン ★S 以上」 only when S exists.

## 5. Attempt log

`DinnerAttempt` (DM-1 run state; session only; never saved, pinned by R25 `persistProgress` has no `attempt`):

| field | meaning |
|---|---|
| `category` | TARGET_PASS / QUALITY_FAIL / DUPLICATE_TARGET / NON_TARGET / ORIGINAL / INVALID_PIZZA |
| `identityRecipeId` | **INTERNAL**: the unique composition match, or `null` (no match / ambiguous). May name an undiscovered recipe. Never rendered. |
| `displayedRecipeId` | what the result named (target / discovered), `null` = anonymous. Derived from `dinnerAttemptView`. |
| `completedTargetId` | TARGET_PASS only |
| `stars` | ★ when the quality gate ran (TARGET_PASS / below-S QUALITY_FAIL) |
| `consumed` | pre − post per ingredient (the inventory effect) |
| `at` | resolution time |

- `dinnerRunReducer`'s `RESOLVE_ATTEMPT` now takes this classified attempt, not a declared `recipeId + PASS/FAILED`. `SELECT_TARGET`, `CANCEL_TARGET` and `activeRecipeId` are removed (DM-3R-1 §21).
- It rejects a stale completion (not an open target) and a category/target mismatch.
- `resolveDinnerAttempt` delegates to it. That makes one run transition, and the DM-3R-1 parity test now checks exactly that.
- DM-4 persistence was not anticipated.

## 6. Privacy

- **Mission targets:** named in the target row, the Detail and the results (they are discovered by the unlock rule).
- **Discovered non-target:** NON_TARGET with its name (R7).
- **Undiscovered non-target:**
  - It becomes `{ category: "ORIGINAL" }`, and the copy is 「オリジナルピザ！」 with no reason, candidate or near miss (R8).
  - E2E sweeps the whole DOM (text and every attribute) during BAKE, during CUT, and on the result, using `expectNoUndiscoveredIdentity`.
  - The internal identity lives only in `dinner.pending.plan` / `attempts[].identityRecipeId`. No screen reads them.
- **During BAKE / CUT:** the round shows no recipe name at all (OD-R6). Only the window and the presence of a CUT step are used.
- **Near-miss / hints:**
  - The Dinner round has no hint button. `SHOW_HINT` is refused, along with the H3-3 / HE purchases (R22).
  - `resultNearMiss` / ResultPanel never render for Dinner.
- **No Dex write, discovery or Pitz** (R23 / R24). `REGISTER_TO_DEX` is refused, and every Dinner state keeps `score: null`, so no sentinel score can surface.

## 7. Target row UX

- **Placement:** the PREPARE / BAKE / CUT order-card slot, below the tabs. It shows ⏱ time and 🌙 N/M, then one chip per target: a 30px reference thumbnail, the name (ellipsis) and ✓ when done.
- **The HUD row is folded in.** A separate row appeared in BAKE and moved the tabs down 41px. Layout Contract **L-J** caught this, and it was fixed by keeping one slot through all cooking steps. The standalone `DinnerHud` shows only on the per-pizza result.
- **Height:**
  - 57px at 390×844, the same as the guided order card with its 48px 見本.
  - About 48px at short heights; chips stay ≥44px tall.
  - Chips can scroll sideways if more targets are ever added.
- **Tap behaviour:** a tap opens the existing `ReferencePreview` / `PlayerReferencePreview` popover for that target. It does not select anything (R27, unit + App + E2E).

Result panel copy (audited against the existing tone):

| category | copy |
|---|---|
| TARGET_PASS | 「✔️ ○○完成！」「★n ターゲットクリア」 |
| QUALITY_FAIL | 「もう少し丁寧に作ろう」 + 「○○ ★n（合格は★S以上）」 or the gate reason |
| DUPLICATE_TARGET | 「これはもう完成済み！」 |
| NON_TARGET | 「○○ができた！」「今回のターゲットではありません」 |
| ORIGINAL | 「オリジナルピザ！」 |
| INVALID_PIZZA | 「ピザとして完成しませんでした」 + 生焼け / 焦げ / 具やソース |

Every result then offers 「次のピザを作る →」. The CLEAR / TIME_UP / INFEASIBLE overlay adds 「最後のピザ：…」 when a pizza ended the run.

## 8. Stage measurements (Layout Contract, Chromium, visible pizza diameter px)

| mode / profile | DOUGH | SAUCE | CHEESE | TOPPING | TOPPING p2 | BAKE | CUT | PREPARE variance |
|---|---|---|---|---|---|---|---|---|
| **Dinner N390 (390×844)** | 290 | 290 | 290 | 290 | 290 | 358 | 358 | 0% |
| **Dinner N360 (360×800)** | 274 | 274 | 274 | 274 | 274 | 328 | 328 | 0% |
| **Dinner S390 (390×664)** | 265 | 265 | 265 | 265 | 265 | 333 | 358 | 0% |
| **Dinner S360 (360×640)** | 241 | 241 | 241 | 241 | 241 | 309 | 328 | 0% |
| Dinner E390i (664 + inset) | 184 | 184 | 184 | 184 | 184 | 252 | 322 | 0% |
| Dinner E360i (640 + inset) | 160 | 160 | 160 | 160 | 160 | 228 | 298 | 0% |
| Free (same run) S390 / S360 | 269 / 245 | | | | | | | 0% |
| Lunch (same run) S390 / S360 | 236 / 212 | | | | | | | 0% |
| Guided (same run) S390 / S360 | 279 / 255 | | | | | | | 0% |

Notes:
- The first cut of the row cost 9px at S390 (260 vs Free 269). The short-height padding fix brought that to 4px.
- With the HUD folded in, Dinner at S390 is **29px larger than Lunch Rush**, which does keep a separate HUD row.
- BAKE / CUT keep their existing sizes (OD-R8, not unified).
- New LC-S3 floors (measured − ~6px): **DINNER** S390 259, S360 235, E390i 178, E360i 154. N / P floors are the caps.
- Guided / Free / Lunch diameters are unchanged from the DM-3R-0 report.

## 9. Tests

The R-numbers are the required test list. The files are `gameReducer.dinner.test.ts` (**GR**), `gameReducer.dinnerAmbiguous.test.ts` (**GA**), `dinnerRun.test.ts` (**RUN**), `dinnerResultDetection.test.ts` (**DET**), `dinnerView.test.ts` (**VIEW**), `DinnerGameUi.test.tsx` (**UI**), `DinnerMissionScreen.test.tsx` (**SCR**), `App.dinner.test.tsx` (**APP**), `useDinnerRuntime.test.tsx` (**HOOK**), `e2e/dinner-mission.spec.ts` (**E2E**), `e2e/layout-contract.spec.ts` (**LC**) and `e2e/stage-size-stability.spec.ts` (**PTR**).

| # | test | where |
|---|---|---|
| 1 | Dinner starts with no target declaration | GR R1, APP R1, E2E |
| 2 | any OWNED ingredient can be placed | GR R2 |
| 3 | target pizza → TARGET_PASS | GR R3, E2E |
| 4 | another remaining target made → that one completes | GR R4, E2E (chip bismarck viewed, funghi made) |
| 5 | QUALITY_FAIL (★ < S and the order gate) | GR R5, E2E (S=5) |
| 6 | DUPLICATE_TARGET | GR R6, E2E |
| 7 | NON_TARGET (discovered) | GR R7, E2E |
| 8 | ORIGINAL undiscovered privacy | GR R8, E2E (DOM sweep at BAKE / CUT / result) |
| 9 / 10 | INVALID_PIZZA raw / burnt | GR R9/R10, E2E (raw) |
| 11 | recipe-specific bake window (bismarck 86 → INVALID, margherita 89.5 → PASS) | GR R11 |
| 12 | recipe-specific CUT | GR R12, E2E |
| 13 | no-match generic window, no CUT | GR R13, E2E (funghi+egg) |
| 14 | ambiguous safe fallback (catalog collision injected into the runtime) | GA R14 |
| 15 / 16 | exactly-once consumption; CUT does not double-consume | GR R15/R16 + DET contract test |
| 17 | failed attempts keep their consumption | GR R17 |
| 18 | remaining set infeasible → INFEASIBLE | GR R18, E2E |
| 19 | final target → CLEAR precedence | GR R19 (3 orders), E2E |
| 20 | timer 0 → TIME_UP; late bake / CUT does nothing | GR R20, HOOK, E2E |
| 21 | Shop blocked | GR R21, E2E |
| 22 | hint / hint purchase blocked | GR R22, APP, E2E |
| 23 / 24 | no Dex / Pitz mutation | GR R23/R24, E2E (save diff) |
| 25 | reload abandon | GR R25, E2E |
| 26 | HOME abandon confirm | GR R26, HOOK, APP, E2E |
| 27 | reference tap ≠ selection | UI, APP, E2E |
| 28–31 | 390×844 / 360×800 / 390×664 / 360×640 | LC Dinner (7 profiles), E2E on both Chromium projects, PTR |
| 32 | stage stability | LC Dinner (LC-S1..S4, L-J) |
| 33 | pointer accuracy | PTR Dinner 390×844 / 390×664 / 360×640 |
| 34–36 | H3-3 / Lunch Rush / Free Cooking regression | full Vitest + full Chromium E2E (§10) |

**Replaced tests.** No test was deleted to get green. Every change carries a reason:
- `gameReducer.dinner.test.ts` (DM-2 suite) was rewritten against the new authority.
  - Every surviving rule is kept: round authority, START gate, the order policy, post-bake feasibility, CLEAR, TIME_UP, abandon, reload, isolation, CUT, repeated events, and the seeded invariants.
  - The selection-only cases (DM-2 8–11: select / cancel / non-target selection / re-select) were replaced by the no-declaration cases (R1, R27) and the "removed actions do nothing" case.
- `dinnerRun.test.ts`:
  - P (selection rules) and CANCEL_TARGET became the stale / mismatched-resolution backstop and the non-completing-attempt log.
  - Every other DM-1 rule is unchanged, now driven through `RESOLVE_ATTEMPT(attempt)`.
- `dinnerResultDetection.test.ts`:
  - The DM-1 parity test now compares against the one run transition. `SELECT_TARGET` no longer exists.
  - The BAKE-view key list gains `cutConfig` (a slice count, not identity; still asserted free of ids / names).
  - The attempt-log test was added.
- The ported #243 UI tests: the Target Board / target-result cases became target-row / attempt-result cases.

## 10. Verification

| check | result |
|---|---|
| Focused Dinner suites (GR, GA, RUN, DET, VIEW, UI, SCR, APP, HOOK, mission) | all passed |
| Full Vitest | **190 files, 4036 passed / 1 skipped** (DM-3R-1 final: 185 files, 3983) |
| `tsc -b` | clean |
| `oxlint` | 0 warnings / 0 errors |
| `vite build` | success. Production bundle: 0 `location.search`. |
| Chromium E2E (iphone-390x844, iphone-360x800, layout-chromium) | see §10.1 |
| WebKit / Layout Contract Gate (CI) | success on `7a18e29` (§20) |

### 10.1 Chromium E2E

- **Full local run** (`iphone-390x844`, `iphone-360x800`, `layout-chromium`): **201 passed, 25 skipped, 0 failed** (9.3 min). The skips are the existing per-width project guards. This includes:
  - Lunch Rush (material shortage, result / ranking)
  - Free Cooking phase 3-2
  - discovery / near-miss / hint sheet / hint facts save (H3-3)
  - the making UI, viewport, pizza-cutting, dynamic-steps and finished-pizza suites
  - the Layout Contract (LC-0..LC-5, LC-S guided / free / lunch, the new LC-S Dinner, all 7 profiles)
- **After the last spec edit** (the BAKE / CUT identity sweep in R8), `dinner-mission.spec.ts` and `stage-size-stability.spec.ts` were re-run on both Chromium projects: **28 passed / 6 skipped** (width guards).

### 10.2 Runtime mutation checks

Each mutant was applied to `src/state/gameReducer.ts`, run against `gameReducer.dinner.test.ts` + `gameReducer.dinnerAmbiguous.test.ts` (36 tests), and reverted (the file was byte-compared after).

| mutant | result |
|---|---|
| CUT resolves from the post-bake stock (double consumption) | DETECTED (7 failed) |
| generic bake window always | DETECTED (1) |
| no CUT step after START_BAKE | DETECTED (19) |
| refund for non-PASS results | DETECTED (5) |
| SHOW_HINT allowed in Dinner | DETECTED (1) |
| no deadline check at CONFIRM_BAKE | DETECTED (1) |
| S not required at DINNER_START | DETECTED (1) |
| CUT resolution with `cutCompleted: false` | DETECTED (17) |
| Dinner composition guard removed | survived. **Equivalent:** the base reducer already refuses every composition action outside PREPARE, so the Dinner guard is defense in depth. The freeze test pins the behavior either way. |

The DM-3R-1 pure mutation set (19/19) is unaffected: that module's classification logic is unchanged, and its settle step now delegates to the same DM-1 rules.

## 11. Changed files

| file | change |
|---|---|
| `src/mission/dinner/dinnerRun.ts` | classified `DinnerAttempt`. `RESOLVE_ATTEMPT(attempt)` with stale / mismatch backstop. `SELECT_TARGET`, `CANCEL_TARGET` and `activeRecipeId` removed. |
| `src/mission/dinner/dinnerResultDetection.ts` | builds the attempt record (`dinnerAttemptRecord`) and settles through `dinnerRunReducer`. `cutConfig` in the plan / plan view. Wired note. |
| `src/mission/dinner/dinnerSession.ts` | `minimumStars`, `roundSeq`, `pending { plan, preConsumptionInventory }`, `lastResult` |
| `src/mission/dinner/dinnerMission.ts` | `quality.minimumStars: null` slot + validation |
| `src/state/gameReducer.ts` | Dinner actions (`DINNER_START`+S, `DINNER_NEXT_PIZZA`; select / cancel / return removed); sentinel recipe for Dinner rounds; `dinnerFreeRound` / `dinnerStartBake` / `dinnerResolve` / new guard; `SHOW_HINT` blocked |
| `src/state/dinnerView.ts` (ported) | + `resolveDinnerMinimumStars`, `DINNER_PREVIEW_MINIMUM_STARS_PLACEHOLDER`, `dinnerTargetRowItems`, `dinnerAttemptCopy`; readiness with S; board rows removed |
| `src/state/useDinnerRuntime.ts` (ported) | `startDinner(…, minimumStars)` |
| `src/components/DinnerGameUi.tsx` (ported) | `DinnerTargetRow`, `DinnerAttemptResultPanel`; overlay `lastResult`; board removed |
| `src/screens/DinnerMissionScreen.tsx` (ported) | `minimumStarsFor`, S line, auto-judge copy |
| `src/screens/HomeScreen.tsx` (ported as is) | Dinner card |
| `src/screens/GameScreen.tsx` | Dinner props, target row + reference popover, HUD outside cooking, result panel, overlay, abandon dialog, all-owned tray flag, no hint button in Dinner |
| `src/App.tsx` | Dinner screen, START / retry / quit / shop handlers, DEV/Preview gates for duration and S, round key with `roundSeq` |
| `src/App.css` | #243 Dinner styles (board removed) + target row / chips / attempt panel |
| tests | `gameReducer.dinner.test.ts` (rewritten), `gameReducer.dinnerAmbiguous.test.ts` (new), `dinnerRun.test.ts`, `dinnerResultDetection.test.ts`, `dinnerMission.test.ts`, `roundKind.test.ts`, ported `dinnerView` / `DinnerGameUi` / `DinnerMissionScreen` / `App.dinner` / `useDinnerRuntime` tests |
| e2e | `dinner-mission.spec.ts` + `support/dinner.ts` (ported, rewritten), `layout-contract.spec.ts` (LC-S Dinner + floors), `stage-size-stability.spec.ts` (Dinner pointer smoke) |
| docs | this report, `docs/reports/screenshots/dinner-mission-dm3r2/` |

Not changed:
- matcher / signature / catalog, Completion Gate, Scoring 2.0, `consumePizzaInventory`, `cookingProfiles`
- Discovery / Dex, Hint economy, Lunch Rush, save schema / persistence
- BAKE / CUT sizing
- H3-4

## 12. Scope guard

Not done:
- DM-4 reward / persistence, DM-5 time limits / S balance
- H3-4, hint economy, recipe catalog, matcher / Scoring redesign, Discovery / Dex redesign, monetization
- BAKE/CUT same-diameter

PR #243 / #242 are untouched.

## 13. Residual risks

1. **CUT for a raw / burnt pizza.**
   - The CUT step is fixed at START_BAKE from the composition (Stage A). So a raw or burnt pizza of a CUT recipe is still cut before its INVALID_PIZZA result. This follows the DM-3R-1 authority (`CUT_PENDING` before classification).
   - The Owner may prefer skipping CUT when the bake leaves the band. That would change DM-3R-1's Stage B order, so it is a separate decision.
2. **CUT presence leaks "a CUT recipe matched" during BAKE** (24 of 25 recipes have CUT; an unmatched pizza has none). This is inherent to the DM-3R-1 `dinnerBakePlanView` (`cutRequired` is UI-safe by that authority). It never names a recipe.
3. **Real-gesture ★ in E2E.** Hand-placed pizzas score below ★5, so the E2E pins S=1 for deterministic passes and S=5 for QUALITY_FAIL. The production S is DM-5's.
4. **The Preview placeholder S=3** is only for HV. It must not be read as a balance recommendation.
5. **Thumbnail legibility at 30px.** The chips carry the name, and the popover shows the full reference, but the tiny thumbnails look alike. This is a Human Verification item.
6. **Sentinel score is computed then cleared** in the Dinner CONFIRM_BAKE (base reducer reuse). It is harmless, but it is wasted work.

## 14. Deferred to DM-4 / DM-5

- **DM-4:** reward payout, best time / clear count persistence, whether any attempt data is saved.
- **DM-5:**
  - production `timeLimit.seconds`
  - `quality.minimumStars` (S), which removes the Preview placeholder path from real play
  - the tuning of the thresholds from real play data

## 17. Screenshots and videos

### 17.1 Committed screenshots (`docs/reports/screenshots/dinner-mission-dm3r2/`)

**Before**
- `before-home-no-dinner-390x844` / `-360x800`: main HOME before any Dinner UI (from PR #243's committed set).
- `before-pr243-target-board-390x844` / `-360x800`, `before-pr243-guided-cooking-390x844`, `before-pr243-target-result-390x844`: the old declared-target flow that this slice replaces (from `fd4c28b`).

**After**
- HOME and Mission Detail: `after-home-390x844` / `-360x800`, `after-mission-detail-390x844` / `-360x800`
- PREPARE with the target row, DOUGH / SAUCE / CHEESE / TOPPING at **390×844, 360×800, 390×664, 360×640**: `after-prepare-{dough,sauce,cheese,topping}-{…}`
- BAKE / CUT with the target row at the same 4 viewports: `after-bake-*`, `after-cut-*`
- Reference popover from a chip: `after-reference-popover-390x844`
- Results:
  - `after-result-target-pass-390x844` / `-360x800`
  - `after-result-quality-fail-390x844`
  - `after-result-non-target-390x844`
  - `after-result-original-390x844`
  - `after-result-invalid-390x844`
  - `after-target-row-progress-390x844` (✓ on the completed target)
- Run end: `after-clear-390x844`, `after-failed-infeasible-duplicate-390x844`, `after-failed-timeup-390x844`, `after-abandon-dialog-390x844`

### 17.2 Human Verification videos (390×844, H.264; delivered directly, not committed)

- **A:** `DM-3R-2_HV_A_clear-by-detection_390x844.mp4` (53 s). START, look at a target's reference, then cook funghi → breakfast → margherita → bismarck with no declaration, each judged TARGET_PASS, ending in CLEAR.
- **B:** `DM-3R-2_HV_B_nontarget-original-invalid-duplicate-infeasible_390x844.mp4`. bismarck PASS, marinara NON_TARGET, hawaiian anonymous ORIGINAL, raw funghi INVALID_PIZZA, then bismarck again: DUPLICATE, which uses the last egg and ends in INFEASIBLE.
- **C:** `DM-3R-2_HV_C_qualityfail-abandon-timeup_390x844.mp4`. S=5 QUALITY_FAIL, the HOME dialog (続ける, then やめる), then a 6-second run that reaches TIME_UP.

The Preview captures used `?dinnerDuration=` and `?dinnerMinStars=` (A / B use S=1, C uses S=5). Production has neither.

## 19. Review follow-up (Codex on `daed3dd`)

| finding | fix |
|---|---|
| P2: cooking was still accepted behind the HOME abandon dialog (the run stays PLAYING) | The Dinner guard refuses every cooking action (placement, steps, START_BAKE, CONFIRM_BAKE, CUT) while `abandonRequested`. `PizzaStage` is non-interactive while the dialog is open (any in-flight gesture is aborted). The clock still runs. Test: nothing changes or is consumed behind the dialog; 続ける resumes. A mutant that removes the guard is detected. |
| P2: CLEAR did not show the pizza that cleared the run | The CLEAR overlay now shows 「最後のピザ：○○完成！」 like INFEASIBLE. TIME_UP never shows it, because the clock ended the run, not a pizza. Tests cover both. |

Full Vitest after the fix: 190 files, **4037 passed / 1 skipped**. `tsc -b`, `oxlint` and build are clean. The Dinner E2E on both Chromium projects: 22 passed.

## 20. PR / CI

- PR #252 (`claude/dm-3r-2-result-detection-ioac6d` → `main`), no auto-merge.
- GitHub CI on the code head `7a18e29` (after the review fix): **all 9 checks succeeded**:
  - `classify`, `build`, `layout-chromium`, **Layout Contract Gate**
  - `webkit webkit-390x844 shard 1/2` and `2/2`, `webkit webkit-360x800 shard 1/2` and `2/2`, **WebKit Gate**
- Mergeable: clean against `main` `726b0ac`. No open review threads (both Codex P2 threads are fixed and resolved).
- This CI record is a docs-only commit (no code change).

## 21. Latest-main integration (after the review and CI)

- `origin/main` moved from `726b0ac` to **`5a33d85`**. That brings in PR #251 (H3-4, the Selectable sheet UI) and PR #254 (DH4-1, a Deduction Hint pure layer, not yet wired in).
- **Textual overlap:** only `src/App.css`. Both sides appended, and git merged it cleanly with no conflict.
- **Semantic overlap:** none.
  - H3-4 changes the Free Cooking hint sheet, which Dinner never opens (`SHOW_HINT` and hint purchases are blocked during a run).
  - DH4-1 is a pure layer with no wiring.
- **Merge commit:** `c27e00f`. No rebase and no force-push.
- **Re-verified on the merged tree:**
  - `tsc -b` clean, `oxlint` 0 warnings, build succeeded.
  - Full Vitest: **192 files, 4077 passed / 1 skipped**.
  - Full Chromium E2E (iphone-390x844, iphone-360x800, layout-chromium): **201 passed / 25 skipped (per-width guards) / 0 failed**. This includes the H3-4 hint-sheet specs and LC-S Dinner.
- GitHub CI is re-running on the merged head.
