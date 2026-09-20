# TETO Recipe Cooking Steps 1.0 — Phase 1A-T Result Report

**Audited `origin/main` SHA:** `dc0a66bb109dc48f433fe6c9a093ee2b478be2c2` (Recipe Cooking Steps
1.0 Phase 1A: Cooking Step Foundation, #124 — `git fetch origin` re-verified this is
`origin/main` HEAD immediately before implementation started; re-verified again at Duplicate
Gate #2 immediately before opening the PR, see §11).

**Implementation SHA (this commit):** see the PR's head commit (this report is committed in the
same PR; the exact SHA is stated in the completion report to the user).

**SSOT design documents (implementation authority):**
`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` §22 (Step Timing Architecture, all of
§22.1-§22.14 read in full), §21 (Phase 1A / Phase 1A-T boundary), plus
`docs/reports/TETO_RECIPE-COOKING-STEPS_Phase0_Result.md`,
`docs/reports/TETO_RECIPE-COOKING-STEPS_Phase1A_Result.md`,
`docs/design/TETO_PIZZA-CUTTING_1.0.md`, and
`docs/reports/TETO_PIZZA-CUTTING_1.0_Fresh-Design_Result.md` — all read in full before any code
change.

**Scope:** Phase 1A-T — Step Timing instrumentation only. Per-step `activeStep`/`stepStartedAt`/
`perStepElapsedMs` measurement, additive on the existing `CookingTimingState`. No new scoring, no
per-step time limits, no CUT/FOLD/SEAL/EDGE_FILL/FINISH gameplay, no Pizza Cutting geometry/UI, no
Scoring 2.0/Completion Gate/Lunch Rush/Firebase/Economy/Progression/Inventory/Shop/save-schema
change, no production recipe `CookingProfile` activation.

---

## 1. Fresh Audit / Duplicate Gate #1

`git fetch origin` pulled the full remote branch set. Checked against this task's scope (Step
Timing, Cooking Steps, Cooking Time, Pizza Cutting):

- **Open PRs at audit time:** #121 (Firebase Production Connection — explicitly out of scope, not
  touched), #105 (dev automation, draft), #72/#46/#34/#3 (docs/unrelated features). **No open PR
  of matching scope.**
- **This task's own designated branch** (`claude/step-timing-instrumentation-kgs4xt`) already
  existed on the remote but was byte-identical to `origin/main` HEAD (`git rev-parse` on both
  sides returned the same SHA, `dc0a66b`; `git diff --stat` between them was empty) — zero prior
  commits, not a duplicate in progress.
- **Leftover branches with matching-sounding names**
  (`claude/teto-recipe-cooking-steps-audit-caq0tq`, `claude/pizza-cutting-phase0-v7hwm2`,
  `claude/cooking-time-ct1-impl-a86ygk`, `claude/cooking-time-ct2-efficiency-j0kz25`) were checked
  via `git log origin/main..<branch>` — each contains only commits already squash-merged into
  `origin/main` (#122/#123/#124) or ships an already-merged, different feature (Cooking Time
  CT1/CT2 themselves, which this phase extends rather than duplicates). **No unmerged work in
  this scope on any branch.**

**Verdict: clear to proceed, no duplicate.**

## 2. Existing Cooking Timing audit (fresh-read, not assumed)

Read in full before any edit: `src/logic/cookingTiming.ts`, `src/logic/cookingTiming.test.ts`,
`src/state/gameReducer.ts` (every `cookingTiming`/`MakingStep`/`GamePhase`/`CONFIRM_MAKING_STEP`/
`CONFIRM_BAKE`/`START_BAKE`/`RESET_PIZZA` site), `src/state/gameReducer.cookingTiming.test.ts`,
`src/state/gameReducer.cookingSteps.test.ts`, `src/data/cookingProfiles.ts`, `src/logic/
efficiency.ts`, `src/App.tsx`'s dispatch sites. Confirmed, matching design doc §22.1 exactly:

- `CookingTimingState` (`startedAt`/`pausedAt`/`accumulatedPauseMs`/`completedMs`) is a single
  whole-round accumulator, FREE-only (`isMissionRound` gate), BAKE-excluded, pause-aware, never
  persisted, consumed exactly once by `evaluateCookingEfficiency` at `REGISTER_TO_DEX`.
- `RESET_PIZZA` deliberately never touches `cookingTiming` (CT2 policy) — the whole-round clock
  runs uninterrupted through a mid-PREPARE discard/redo.
- Phase 1A's `POST_BAKE`/widened `MakingStep` union/`CookingProfile` foundation (#124) is in place
  and untouched by any production recipe (`COOKING_PROFILES` map is still empty — every one of the
  15 shipped recipes resolves to `DEFAULT_COOKING_PROFILE`).

## 3. Step Timing data model (`src/logic/cookingTiming.ts`)

Four fields added to the *existing* `CookingTimingState` — no new state shape, no second timing
subsystem:

```ts
interface CookingTimingState {
  startedAt: number;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  completedMs: number | null;

  // Phase 1A-T, additive:
  activeStep: MakingStep | null;
  stepStartedAt: number | null;
  stepStartAccumulatedPauseMs: number;
  perStepElapsedMs: Readonly<Partial<Record<MakingStep, number>>>;
}
```

- **`activeStep`**: which `MakingStep` is currently accumulating time, `null` whenever no step is
  open (BAKE itself, or once every step of the round has finalized — e.g. after RESULT for the
  default profile).
- **`stepStartedAt`**: epoch ms the active step's own window began; `null` exactly when
  `activeStep` is `null`.
- **`stepStartAccumulatedPauseMs`** (implementation-internal, not named in the SSOT's 3-field
  sketch but required to satisfy it): `accumulatedPauseMs`'s value at the moment the active step
  started, so step finalization can subtract only the pause time that occurred *during* that step
  rather than the whole round's cumulative pause. Without it, a pause spanning one step would
  incorrectly inflate that step's own bucket by the full pause duration, which would break
  acceptance criterion §22.13 #2 (`perStepElapsedMs` sum vs. `completedMs`) under any pause.
- **`perStepElapsedMs`**: finalized elapsed ms per step already left this round, keyed by
  `MakingStep`. A step never reached is absent from the map (not zero) — the same
  absence-not-sentinel convention `completedMs`'s own `null`-while-unmeasured already uses.

`startCookingTiming(now, initialStep)` — widened from `startCookingTiming(now)` — begins timing
`initialStep` immediately (`activeStep: initialStep, stepStartedAt: now`). One new pure function,
`advanceStepTiming(timing, now, nextStep)`, is the single step-boundary transition used at every
call site: finalizes whatever step is currently active (if any) into `perStepElapsedMs`, then
starts `nextStep` (if given) as the new active step. `nextStep: null` closes step timing out
entirely (used at the BAKE boundary). A true no-op (referentially unchanged) only when there is
nothing to finalize *and* nothing to start — this is what makes it safe to call unconditionally
from `CONFIRM_BAKE` even for every one of the 15 shipped recipes. `finishCookingTiming`/
`pauseCookingTiming`/`resumeCookingTiming` are **completely unmodified** — the whole-round clock's
own math is untouched, byte-for-byte.

`CookingProfile.stepTimeLimits?: Partial<Record<MakingStep, { maxMs: number }>>` (design doc
§22.5) was added to `src/data/cookingProfiles.ts` as the acceptance-criterion #6 inert extension
point — a repo-wide grep (`grep -rn stepTimeLimits src`) confirms it appears exactly once, in its
own type declaration, read by nothing.

## 4. PREPARE transitions (`src/state/gameReducer.ts`)

- **`BEGIN_PREPARE`**: `startCookingTiming(action.now, state.makingStep)` — `state.makingStep` is
  always `"DOUGH"` at this point (`buildOrderState`'s own fixed literal), so this starts timing
  DOUGH immediately, matching the task's own "PREPARE開始時に最初のMakingStepの計測を開始" — no
  hardcoded `"DOUGH"` literal inside `cookingTiming.ts` itself, which stays decoupled from any
  cross-file assumption about which step comes first.
- **`startPreparingRecipe`** (`SELECT_RECIPE`/`RETRY_SAME_RECIPE`'s direct-to-PREPARE path):
  same call, `startCookingTiming(now, orderState.makingStep)`.
- **`CONFIRM_MAKING_STEP`**: widened with an optional `now?: number` payload (same back-compat
  convention as `BEGIN_PREPARE`/`START_BAKE`/`SELECT_RECIPE`/`RETRY_SAME_RECIPE` — omitting it
  leaves `cookingTiming`'s per-step fields untouched by that dispatch, never defaulted to
  `Date.now()` inside the reducer). When `now` is supplied, calls `advanceStepTiming` to finalize
  the outgoing step and start the incoming one — for both the PREPARE and POST_BAKE branches,
  including the "confirming the last POST_BAKE step -> RESULT" branch (`nextStep: null`).
  `App.tsx`'s real dispatch (`onConfirmMakingStep`) now passes `now: Date.now()`.

## 5. BAKE boundary

`START_BAKE`'s reducer case now does two independent things in sequence: `finishCookingTiming`
(unchanged, whole-round `completedMs`) and then `advanceStepTiming(..., null)` (new — finalizes
the last PREPARE step, e.g. TOPPING, and closes step timing out for the duration of BAKE).
**BAKE itself never gets a `MakingStep` entry** — `advanceStepTiming(..., null)` only ever writes
into `perStepElapsedMs` under the *outgoing* step's own key, never a `"BAKE"` key (no such
`MakingStep` value exists), and a subsequent long wall-clock span between `START_BAKE` and
`CONFIRM_BAKE` (test: 60s) never appears in `completedMs` or any `perStepElapsedMs` entry —
verified directly (§9, test 7).

## 6. POST_BAKE transitions

`CONFIRM_BAKE`: when `postBakeSteps(state.cookingProfile)` is non-empty (no production recipe
today), `advanceStepTiming(state.cookingTiming, action.now, postBake[0])` starts timing the first
post-BAKE step the instant the round actually lands on `POST_BAKE`. Since `activeStep` is already
`null` at this point (closed out by `START_BAKE`), this is purely a "start," never a
re-finalization. For every one of the 15 shipped recipes (`postBake.length === 0`), the new
`cookingTiming` computation is **referentially identical** to the input — verified directly (§9,
"is a byte-identical no-op for every one of the 15 shipped recipes"). `App.tsx`'s
`handleConfirmBake` now passes `now: Date.now()`.

Within `POST_BAKE`, `CONFIRM_MAKING_STEP`'s existing walk (unchanged from Phase 1A) drives
`advanceStepTiming` exactly like the PREPARE branch — a two-step fixture (`FINISH` -> `CUT`)
confirms FINISH's elapsed ms and starts CUT, then confirming CUT (the last POST_BAKE step)
finalizes CUT and transitions to RESULT with `activeStep`/`stepStartedAt` both `null`.

## 7. `totalActiveTime` / `totalElapsedTime` semantics (design doc §22.3)

- **`totalActiveTime`** stays exactly `completedMs` — unchanged math, BAKE-excluded, pause-aware,
  the sole input to `efficiency.ts`. Verified: `sum(perStepElapsedMs[s] for s in preBakeSteps)`
  equals `completedMs` for every representative PREPARE walkthrough tested, pause-free and with a
  pause both (acceptance criterion §22.13 #2).
- **`totalElapsedTime`** (a purely informational wall-clock span including post-BAKE steps) is
  **not implemented this phase** — not required for §22.13's acceptance bar, and no call site
  needs it yet (flagged in the design doc itself as "not required for the Phase 1A-T
  instrumentation slice itself to be useful"). `perStepElapsedMs` already carries every
  ingredient a future `totalElapsedTime` helper would need (sum of all entries, pre- and
  post-BAKE), so adding the helper itself is a trivial follow-up whenever a real consumer exists —
  building it speculatively now would be exactly the "additive, empty until built" discipline
  violated in the other direction (scope creep, per the task's own explicit prohibition).
- **BAKE is excluded from both** — confirmed directly (§5/§9 test 7).

## 8. Lunch Rush / Scoring / Completion Gate / save-schema compatibility

- **Lunch Rush**: `cookingTiming` stays `null` for every Mission round, whole-round and per-step
  alike — `MISSION_RESET_ORDER`/`BEGIN_PREPARE`(isMissionRound)/`CONFIRM_MAKING_STEP`/
  `START_BAKE`/`CONFIRM_BAKE`/`MISSION_NEXT_ORDER` all verified directly, including with `now`
  payloads supplied to every dispatch (proving the *gate*, `isMissionRound`, not merely "nobody
  happened to pass `now`", is what keeps Mission timing-free). `mission/lunchRush.ts` (the
  `MissionClock`) and `shared/lunchRushScoring.ts`/`functions/src/submitLunchRushScore.ts` were
  **not touched by this change at all** (confirmed by this PR's own diff, §12) — `MissionClock`
  remains the sole enforced timer, exactly as design doc §22.4/§22.12 require.
- **Scoring 2.0**: `computeScoringV2`'s call site and inputs are unchanged; a direct comparison
  (same pizza-build sequence, once with per-step `now` payloads and once without) produces
  byte-identical `state.score`/`state.scoringV2Result`/`state.completion` — timing data has zero
  influence on scoring, verified directly (§9 test 19).
- **Completion Gate**: `completionGate.ts` was not edited; `evaluatePizzaCompletion`'s call site
  and inputs are unchanged.
- **Efficiency (CT2)**: `evaluateCookingEfficiency` still reads only `completedMs` (whole-round);
  a PASSing pizza's `lastEfficiencyCredit.cookingTimeMs` matches `completedMs` exactly, unaffected
  by any per-step data being present (§9 test 18).
- **Save schema**: `src/state/persistence.ts` was **not edited at all**.
  `CURRENT_SCHEMA_VERSION` stays `2`; `createDefaultSave()`'s keys contain no `cookingTiming`/
  `activeStep`/`perStepElapsedMs` field of any kind (verified directly, §9 test 20) —
  `cookingTiming` (whole-round and per-step alike) is a transient `GameState` field, exactly like
  `pizza`/`score` already are; `persistence.ts` never serialized `GameState` before this phase and
  still doesn't.

## 9. Reset / transition matrix (design doc §22.11 — one test per row)

| Trigger | Whole-round `cookingTiming` (unchanged, CT1/CT2) | Per-step fields (this phase) | Test |
|---|---|---|---|
| `RESET_PIZZA` | Not reset — same run's clock continues uninterrupted | **Not reset either** — `activeStep`/`stepStartedAt`/`perStepElapsedMs` are referentially untouched (`cookingTiming` after reset is `===` the pre-reset object). `makingStep` (UI/game state) resets to `"DOUGH"`, but `cookingTiming.activeStep` intentionally keeps tracking whatever step was active when the discard happened — the timing subsystem's own step tracking is driven by `advanceStepTiming`'s own `activeStep` field, not by `state.makingStep`, so the two can legitimately diverge across a reset exactly as the SSOT describes, and self-heal on the very next `CONFIRM_MAKING_STEP` (which adopts the game's own next `makingStep` value as the new `activeStep`). | §9 test 12 |
| `SELECT_RECIPE` | Fresh clock | Fresh, empty `perStepElapsedMs`, `activeStep: "DOUGH"`, `stepStartedAt: now` | §9 test 13 |
| `RETRY_SAME_RECIPE` | Fresh clock | Same as `SELECT_RECIPE` | §9 test 13 |
| `BEGIN_PREPARE` (FREE) | Fresh clock | Fresh, empty per-step state | §9 test 2 |
| `PLAY_AGAIN` ("NEXT_ORDER") | `cookingTiming` cleared to `null` entirely until the next `BEGIN_PREPARE` | Same — `null` carries no per-step data by construction; the next `BEGIN_PREPARE` starts genuinely empty `perStepElapsedMs`, no leakage from the previous round's DOUGH/SAUCE/CHEESE/TOPPING entries | §9 test 14 |
| `MISSION_NEXT_ORDER` | Stays `null` (FREE-only gate) | Stays `null` for the same reason | §9 test 15 |

Rule stated once, generally (as the design doc itself frames it): any transition that already
starts/clears the whole-round clock does the identical thing to per-step state; the one
transition that preserves the whole-round clock (`RESET_PIZZA`) preserves per-step state too, by
the same mechanism (neither is mentioned in that reducer case's returned object, so `...state`
carries every `cookingTiming` field through unmodified). Per-step timing never needed an
independent reset rule of its own — exactly the property design doc §22.11's closing paragraph
predicts.

## 10. Pizza Cutting hand-off (design doc §22.7/§22.14 contract)

Verified directly via test fixtures (§9 tests 9-11), without implementing any CUT gesture/
geometry/scoring:

```
CONFIRM_BAKE lands on POST_BAKE (test-only 2-step fixture: FINISH -> CUT)
  -> FINISH timing starts (activeStep: "FINISH", stepStartedAt: now)
  -> CONFIRM_MAKING_STEP (FINISH -> CUT): FINISH elapsed captured, CUT timing starts
  -> CONFIRM_MAKING_STEP (CUT -> RESULT): CUT elapsed captured, activeStep -> null
```

`perStepElapsedMs.CUT` is populated as a plain scalar with zero awareness of cut-line coordinates,
piece count, or evenness — exactly the "timing and gesture/scoring data are two independent
channels" contract §22.7 requires. When Phase 1B (CUT) ships, it starts consuming
`perStepElapsedMs.CUT` from its first line of code with **zero timing-state migration** —
`MakingStep` already includes `"CUT"` (Phase 1A), and this phase's `advanceStepTiming` already
exercises it end-to-end via the fixture above.

## 11. Duplicate Gate #2 (pre-PR re-check)

`git fetch origin` re-run immediately before opening the PR. Re-verified: `origin/main` HEAD
(unchanged from §1's `dc0a66b`, or the report states the new HEAD and confirms a clean rebase if
`main` advanced), no new open PR of matching scope (Step Timing / Cooking Steps / Pizza Cutting),
`claude/step-timing-instrumentation-kgs4xt` still the only branch carrying this work, PR #121
(Firebase) untouched. See the completion report to the user for the exact result.

## 12. Files changed

```
 src/App.tsx                                                    |  4 +-
 src/data/cookingProfiles.ts                                    |  8 ++
 src/logic/cookingTiming.ts                                     | 95 ++++++++++++++++-
 src/logic/cookingTiming.test.ts                                 | 30 +++---
 src/logic/cookingTiming.stepTiming.test.ts (new)
 src/state/gameReducer.ts                                       | 79 +++++++++++---
 src/state/gameReducer.completionGateEfficiency.test.ts          | 11 +-
 src/state/gameReducer.cookingTiming.test.ts                     |  8 ++
 src/state/gameReducer.stepTiming.test.ts (new)
 docs/reports/TETO_RECIPE-COOKING-STEPS_Phase1A-T_Result.md (new)
```

No file under `functions/`, `src/mission/`, `src/logic/scoringV2/`, `src/logic/completionGate.ts`,
`src/state/persistence.ts`, `src/data/recipes.ts`, or any component (`src/components/`,
`src/screens/`) was touched.

## 13. Tests

New files:

- `src/logic/cookingTiming.stepTiming.test.ts` — pure `advanceStepTiming`/`startCookingTiming`
  clock math (13 tests): initial per-step state, single and multi-step walks, BAKE-boundary
  closure (no invented entry), starting a step from a closed timing (the `CONFIRM_BAKE` -> CUT
  shape), the true-no-op case, pause-aware accounting scoped to the active step only (not the
  whole round's cumulative pause), the still-paused-at-boundary edge case, negative-clamping,
  same-step-revisited accumulation (defensive, not exercised by any current reducer path), two
  `perStepElapsedMs`-sum-equals-`completedMs` tests (pause-free and pause-including) pinning
  acceptance criterion §22.13 #2, and (added at the Fresh Merge Gate fix, §18) the pause-boundary
  regression reproducing the exact finding.
- `src/state/gameReducer.stepTiming.test.ts` — reducer-level integration (27 tests), organized as
  the task's own 20-item list (§ headers `1.` through `20.` in the file, several with more than
  one `it`) plus a 21st block added at the Fresh Merge Gate fix (§18): initial state, PREPARE/
  DOUGH start, DOUGH->SAUCE->CHEESE->TOPPING->BAKE (with the BAKE-exclusion and completedMs-sum
  checks folded in), default-profile CONFIRM_BAKE->RESULT, future-fixture POST_BAKE entry
  (including the byte-identical-no-op proof for the 15 shipped recipes), FINISH->CUT->RESULT, the
  full §22.11 reset matrix (RESET_PIZZA/RETRY_SAME_RECIPE/SELECT_RECIPE/PLAY_AGAIN/
  MISSION_NEXT_ORDER), Lunch Rush MissionClock non-interference, completedMs/efficiency/
  Scoring-2.0 byte-identical comparisons, the save-schema check, and the pause-boundary
  regression reproducing the exact finding at reducer level.

Modified (structural updates only, to keep compiling/asserting against the widened
`CookingTimingState` shape — **no pre-existing behavioral assertion changed**, same discipline
Phase 1A's own Result Report documents for its own structural-only test updates):

- `src/logic/cookingTiming.test.ts` — every `startCookingTiming(now)` call became
  `startCookingTiming(now, "DOUGH")` (the function's signature widened); the one `toEqual`
  snapshot of the full returned object gained the 4 new fields' expected values.
- `src/state/gameReducer.cookingTiming.test.ts` — two `toEqual` snapshots of
  `state.cookingTiming` (BEGIN_PREPARE's and RETRY_SAME_RECIPE's) gained the same 4 new fields'
  expected values. Every other assertion in this 18-test file (pause boundaries, RESET_PIZZA,
  Lunch Rush, DISCOVERED) is **unmodified** and still passes.
- `src/state/gameReducer.completionGateEfficiency.test.ts` — its one hand-built
  `CookingTimingState` fixture (`cookingTimingOf`) gained the 4 new fields at their "no per-step
  data" default values, to keep compiling against the widened interface.

## 14. Verification

**(As originally verified, before the Fresh Merge Gate fix — see §18/§18.1 for the post-fix
numbers, which supersede these.)**

- **Focused tests** (`cookingTiming.test.ts`, `cookingTiming.stepTiming.test.ts`,
  `gameReducer.cookingTiming.test.ts`, `data/cookingProfiles.test.ts`,
  `gameReducer.cookingSteps.test.ts`, `gameReducer.stepTiming.test.ts`): all passed (53 + 12 + 26
  across the relevant files, no failures).
- **Full suite** (`npx vitest run`), run twice to check for flakiness:
  - Run 1: **97 files / 1853 tests passed**, 0 failed.
  - Run 2: **97 files / 1853 tests passed**, 0 failed. No flake (identical counts both runs).
  - (Phase 1A's own baseline was 95 files / 1815 tests — this phase adds exactly 2 new test files
    and 38 new tests, zero removed, zero pre-existing assertions changed in behavior.)
- **TypeScript** (`npx tsc -b`, the exact command `npm run build` uses): clean, 0 errors.
- **Lint** (`npm run lint` / `oxlint`): clean, 0 errors/warnings, exit code 0.
- **Production build** (`npm run build`): succeeded (`tsc -b && vite build`), 121 modules
  transformed (identical module count to Phase 1A's own report), no new warnings beyond the
  pre-existing "chunk larger than 500kB" advisory (unrelated to this change, present before it).

## 15. UI

**No UI visual change.** Zero component files (`src/components/`, `src/screens/`) were touched.
The only non-logic/non-reducer file changed is `src/App.tsx`, and only at two existing dispatch
call sites (`onConfirmMakingStep`, `handleConfirmBake`), adding a `now: Date.now()` payload to
each — no new prop, no new render path, no new conditional UI. No debug/always-on timing display
was added, per the task's own explicit instruction. Viewport re-verification (390×844/360×800) was
not performed, since there is nothing rendered differently to verify — the same judgment Phase
1A's own Result Report applied to its own non-visual reducer/type changes.

## 16. Known risks

1. **`stepStartAccumulatedPauseMs` is an implementation-internal field beyond the SSOT's literal
   3-field sketch (§3 above).** It is required for the pause-aware per-step accounting §22.2
   itself specifies ("no negative time, pause span never counted... applied once per step") and
   for acceptance criterion §22.13 #2 to hold under any pause — omitting it would have made
   `perStepElapsedMs`'s sum diverge from `completedMs` whenever a pause occurred mid-step. It is
   additive on the same `CookingTimingState` object, not a second timing subsystem, matching the
   task's own "extend the existing state, don't build a separate subsystem" instruction.
2. **`RESET_PIZZA` can leave `cookingTiming.activeStep` and `state.makingStep` pointing at
   different steps** (§9 above) — a deliberate, SSOT-specified consequence of "per-step timing
   never gets an independent reset rule, it strictly inherits the whole-round clock's" (design doc
   §22.11's closing paragraph), not an oversight. It self-heals on the very next
   `CONFIRM_MAKING_STEP` and has zero visible effect for any of the 15 shipped recipes (whose
   profile is 4 steps, `DOUGH` first either way). Flagged here so a future RESULT-display consumer
   of `perStepElapsedMs` is aware a discard-heavy round's bucket keys can attribute time to a step
   the player was on before their most recent reset, not their most recent confirm.
3. **`totalElapsedTime` (design doc §22.3) is not implemented** — flagged as not required for this
   slice's acceptance bar and left for whichever future consumer actually needs it (§7 above).
4. **Widened-signature `startCookingTiming`** now requires an `initialStep` argument at both call
   sites — both already had `state.makingStep`/`orderState.makingStep` in scope (always `"DOUGH"`
   today), so this was a mechanical, zero-ambiguity change, but any *future* third call site must
   remember to supply it.

## 18. Fresh Merge Gate fix — pause-boundary bug in `advanceStepTiming`

**Finding:** a Fresh Merge Gate review of PR #125 (head `22bf491`) identified that a step
boundary (`CONFIRM_MAKING_STEP`) firing while `cookingTiming` was still paused could later cause
the *next* step's `perStepElapsedMs` entry to be incorrectly clamped to `0`, once the round was
eventually resumed.

**Root cause:** `advanceStepTiming`'s incoming-step bookkeeping set `stepStartedAt: now` — the
dispatch's own timestamp — even when that dispatch happened *during* an already-open pause
(`timing.pausedAt !== null`). The outgoing step's own finalization was already correct (it uses
`timing.pausedAt ?? now` as the "effective moment", matching `finishCookingTiming`'s own
discipline), but the incoming step's `stepStartedAt` did not get the same treatment. Concretely,
for the exact reproduction the finding gave (`DOUGH` starts at `0`, paused at `4_000`, a step
transition dispatched at `999_000` while still paused, resumed at `1_000_000`, the next step
transition dispatched at `1_005_000`):

1. `DOUGH` correctly finalizes to `4_000` (its own finalization already used `pausedAt ?? now`).
2. `SAUCE`'s `stepStartedAt` was set to `999_000` (the dispatch's own `now`, still inside the open
   pause) and `stepStartAccumulatedPauseMs` was snapshotted at `accumulatedPauseMs`'s pre-resume
   value (`0`).
3. `resumeCookingTiming` at `1_000_000` adds the pause's **entire** duration
   (`1_000_000 - 4_000 = 996_000`ms) to `accumulatedPauseMs` — including the ~995 seconds that
   elapsed *before* `SAUCE` even nominally started.
4. `SAUCE`'s own finalization at `1_005_000` then computed
   `pauseDuringStep = accumulatedPauseMs(996_000) - stepStartAccumulatedPauseMs(0) = 996_000`, and
   `elapsed = 1_005_000 - 999_000 - 996_000 = -990_000`, clamped to `0` — silently discarding
   `SAUCE`'s genuine 5 real seconds of post-resume activity.

**Fix (minimal — one line, `src/logic/cookingTiming.ts`'s `advanceStepTiming`):**

```diff
- stepStartedAt: nextStep !== null ? now : null,
+ stepStartedAt: nextStep !== null ? (timing.pausedAt ?? now) : null,
```

Anchoring the incoming step's `stepStartedAt` at the pause's own start (exactly the same
"effective moment" substitution already used everywhere else pause-awareness matters in this
file) makes the entire open pause fall *within* the new step's own window by construction, so the
same `accumulatedPauseMs`-delta subtraction at finalization time removes exactly the paused
duration and nothing more — regardless of how long the pause turns out to last or when it is
dispatched relative to it. `stepStartAccumulatedPauseMs`'s own snapshot logic needed no change.
No other file, and no other behavior (whole-round `completedMs`, `efficiency.ts`, `FREE`'s own
Cooking Time, `BAKE` exclusion, Lunch Rush's `MissionClock`, Scoring 2.0, or the save schema), was
touched by this fix — confirmed by re-running the full existing suite unmodified (§18's own
verification below) alongside the two new regression tests.

**Regression tests added:**

- `src/logic/cookingTiming.stepTiming.test.ts` — a new pure-logic test, "Fresh Merge Gate fix: a
  step transition fired mid-pause never lets the pause's full span leak into the next step's
  elapsed time once resumed", reproducing the finding's exact numbers.
- `src/state/gameReducer.stepTiming.test.ts` — a new reducer-level test (`describe` block 21),
  "Fresh Merge Gate fix: a `CONFIRM_MAKING_STEP` dispatched mid-pause never lets the pause leak
  into the next step once resumed", the same scenario driven through `PAUSE_COOKING_TIMING` /
  `CONFIRM_MAKING_STEP` / `RESUME_COOKING_TIMING` dispatches.

**Verified the tests actually catch the bug**, not just pass trivially: both were run against the
pre-fix code (the single line reverted to `now`) and both failed with `SAUCE` (or
`perStepElapsedMs.SAUCE`) `=== 0` instead of the expected `5_000` — then re-verified green again
after restoring the fix.

| Check | Expected | Actual (pre-fix) | Actual (post-fix) |
|---|---|---|---|
| `DOUGH` elapsed | `4_000` | `4_000` (already correct) | `4_000` |
| `SAUCE` elapsed | `5_000` | `0` (bug reproduced) | `5_000` |

**Existing pause/BAKE/POST_BAKE/CUT tests all still pass** — every test in
`cookingTiming.test.ts`, `cookingTiming.stepTiming.test.ts` (the other 11, pre-existing, tests),
`gameReducer.cookingTiming.test.ts` (pause boundary, RESET_PIZZA, BAKE exclusion),
`gameReducer.cookingSteps.test.ts` (POST_BAKE machinery), `gameReducer.stepTiming.test.ts` (the
other 26 tests, including the FINISH→CUT fixture and BAKE-exclusion checks), and
`data/cookingProfiles.test.ts` ran green, unmodified, after the fix.

### 18.1 Verification (post-fix)

- **Focused tests** (all 8 timing/cooking-steps-related files): **110/110 passed**, 0 failed.
- **Full suite**, run twice:
  - Run 1: **97 files / 1855 tests passed**, 0 failed.
  - Run 2: **97 files / 1855 tests passed**, 0 failed. No flake.
  - (2 more tests than the pre-fix §14 baseline of 1853 — exactly the 2 new regression tests
    added; zero removed, zero pre-existing assertions changed.)
- **TypeScript** (`npx tsc -b`): clean, 0 errors.
- **Lint** (`npm run lint` / `oxlint`): clean, exit code 0.
- **Production build** (`npm run build`): succeeded, 121 modules transformed, no new warnings.
- **CI**: see the completion report to the user for PR #125's fresh CI status at push time.

## 19. Final Verdict

**Step Timing instrumentation implemented exactly per design doc §22, as an independent Phase
1A-T slice sequenced after Phase 1A per §22.10.** Zero change to `completedMs`/efficiency/
Scoring 2.0/Completion Gate/Lunch Rush/save-schema behavior, confirmed by an unmodified
pre-existing test suite (only 3 files needed structural, non-behavioral updates for the widened
`CookingTimingState` shape) plus new focused/integration coverage matching every row of the
design doc's own reset matrix (§22.11) and every one of the task's 20 required test scenarios.
`perStepElapsedMs` sums to `completedMs` for the pre-BAKE span (acceptance criterion §22.13 #2,
pause-free and pause-including), BAKE is verifiably excluded from all step timing, and the CUT
timing hand-off (§22.7/§22.14) is proven end-to-end via a test-only fixture with zero gesture/
geometry/scoring code. `CookingProfile.stepTimeLimits` is present in the type, read by nothing
(criterion #6, grep-verified). A Fresh Merge Gate review surfaced one real pause-boundary bug in
`advanceStepTiming` (§18) — fixed with a single-line, minimal change, backed by two new regression
tests proven to catch the original bug, with zero impact on any other verified behavior.
TypeScript/lint/build/tests all clean, full suite run twice with no flake. Ready for external
Merge Gate review; **not merged by this session**, per instructions.
