# Cooking Time CT1: Implementation Result

Deterministic FREE-only "active making" timing **measurement foundation** -- no UI, no scoring,
no Pitz, no Save changes. See `docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md` for the
design audit this implements (its Addendum documents the main-drift re-verification done before
this pass).

## Base / branch

- Base `origin/main` SHA: `5df955575fd01ea7b27f4e7cf01f7205f5af0d18`.
- Implementation branch: `claude/cooking-time-ct1-impl-a86ygk`.

## Fresh duplicate gate

- `git fetch origin` at task start: `origin/main` unchanged at the SHA above -- no drift since
  the prior audit task to reconcile.
- Searched all branches for `cooking|efficiency|timing|ct1`: only this implementation branch and
  `origin/claude/teto-cooking-efficiency-audit-1rzjyy` (the prior read-only audit branch, one
  docs-only commit, never opened as a PR, based on an older `main` -- confirmed not a duplicate
  implementation).
- No open PR/issue for a Cooking Time / Efficiency / CT1 implementation was found. Issue #37 is
  the parent tracking issue and was not treated as a duplicate, per instructions.
- Re-ran the same duplicate check immediately before opening the PR (see §"Git / PR" below) --
  unchanged result.

## Prior audit report

`docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md` was local/untracked in the prior
session and did not survive into this session's fresh container. Recovered verbatim from
`origin/claude/teto-cooking-efficiency-audit-1rzjyy`'s single commit (`11b688d`) and committed
into this branch at the filename this task specifies. Re-verified against the current, more
advanced `origin/main` (398d484 -> 5df9555, 22 commits) and found still accurate; added one
Addendum section documenting three drift corrections (M3A landed with no boundary conflict,
`BEGIN_PREPARE` no longer FREE-exclusive since Lunch Rush's continuous per-pizza flow, and
`isGlobalOverlayOpen` now also includes Inventory) -- no other content was rewritten or
simplified.

## Actual timing start / finish actions

Current-main action names (unchanged from the audit's own finding) -- `BEGIN_PREPARE`
(ORDER -> PREPARE) and `START_BAKE` (PREPARE -> BAKE), `src/state/gameReducer.ts`. One addition
the audit's original baseline didn't need to account for: two other FREE-only entry points land
directly at `phase: "PREPARE"` without ever dispatching `BEGIN_PREPARE` --
`SELECT_RECIPE`/`RETRY_SAME_RECIPE`'s shared `startPreparingRecipe` helper. All three now start
`cookingTiming`; `START_BAKE` is the sole finish point.

## Measurement semantics

New pure module `src/logic/cookingTiming.ts`, mirroring `src/mission/lunchRush.ts`'s
`MissionClock` shape exactly (absolute epoch-ms fields, every function takes `now` as a plain
argument, never reads `Date.now()` itself):

```ts
export interface CookingTimingState {
  startedAt: number;
  pausedAt: number | null;        // epoch ms the current pause began, or null while running
  accumulatedPauseMs: number;     // total ms already spent paused (excludes an in-progress pause)
  completedMs: number | null;     // finalized elapsed active ms; null until START_BAKE
}

startCookingTiming(now)
pauseCookingTiming(timing, now)   // no-op if already paused/finished
resumeCookingTiming(timing, now)  // no-op if not paused/finished
finishCookingTiming(timing, now)  // no-op if already finished; if still paused, finalizes at pausedAt
```

`completedMs = finishTime - startedAt - accumulatedPauseMs`, clamped to `>= 0`. If `START_BAKE`
fires while still paused, the pause's own start is used as the effective end (the open pause is
never counted either way).

## FREE / Lunch Rush boundary

`GameState.cookingTiming: CookingTimingState | null` is gated on `!state.isMissionRound`
everywhere it can start (`BEGIN_PREPARE`, `RESET_PIZZA`, `startPreparingRecipe`), not on which
call site dispatched the action -- this matters because UX-1 made `BEGIN_PREPARE` no longer
FREE-exclusive (Lunch Rush's continuous per-pizza flow dispatches it too, from
`App.tsx`'s `handleMissionServeNext`, right after `MISSION_NEXT_ORDER` has already set
`isMissionRound: true`). Chosen option from the audit's §5 fork: **Cooking Time never starts for
a Mission round** (not "starts but is excluded from evaluation") -- simplest, and there is no
evaluation logic yet for it to be excluded from. `MissionClock`, `missionRunReducer`,
`calculateMissionReward`, and `src/logic/economy.ts` are untouched (confirmed by `git diff` --
zero lines changed in `src/mission/` or `src/logic/economy.ts`).

## Reset / retry / HOME policy

| Path | Behavior | Reducer site |
|---|---|---|
| NEW FREE RUN (initial load, `PLAY_AGAIN`) | `cookingTiming: null` until its own `BEGIN_PREPARE` | `buildOrderState` |
| RESET_PIZZA (discard mid-PREPARE) | old timing discarded, **fresh timing starts immediately** | `RESET_PIZZA` case |
| RETRY_SAME_RECIPE | fresh timing (lands at PREPARE directly, no `BEGIN_PREPARE`) | `startPreparingRecipe` |
| SELECT_RECIPE (other recipe) | fresh timing, same as above | `startPreparingRecipe` |
| HOME (`PLAY_AGAIN` mid-round) | timing discarded entirely, `null` until next round's own start | `buildOrderState` |
| RESULT | `completedMs` readable only for the in-progress run (never persisted) | -- |
| DISCOVERED | keeps the same `completedMs` the round just produced (`REGISTER_TO_DEX` doesn't touch the field) | -- |
| reload | never restored -- `GameState` (all of it, not just timing) is never persisted | `persistence.ts` (unchanged) |

**Explicit deviation from the Fresh Audit's own §2 recommendation**: the audit recommended
`RESET_PIZZA` should *not* reset the clock (same-attempt, redo-work reasoning, to avoid a future
reward being gameable by reset-spamming). This task's own instructions (§6, and test #4 in §10)
explicitly specify "RESET / DISCARD: old timerを破棄" and "reset → old timing cleared" as a
distinct case from "retry → fresh timing" -- i.e. `RESET_PIZZA` is expected to behave like a
restart, not a same-run pause. Implemented per the current instructions: `RESET_PIZZA` discards
the old timing and starts a new one at the reset's own `now`. This is safe for CT1's scope
specifically because **no reward or score is attached to Cooking Time yet** -- the gaming concern
the audit raised only becomes real once a later slice (CT2+) attaches a Pitz bonus or displayed
tier to `completedMs`. **Flagged for explicit re-decision before CT2**: if a future slice adds an
Efficiency bonus/tier, `RESET_PIZZA`'s reset-and-restart behavior should be re-audited against
that reward, since restart-on-discard would then let a player "re-roll" a slow start.

## Pause / background — implemented vs. deferred

**Implemented** (minimal, reuses an existing signal, no new detection mechanism): `App.tsx`
already gates `PizzaStage` interactivity during PREPARE on
`!isReferencePopoverOpen && !isGlobalOverlayOpen` (`GameScreen.tsx`) -- confirmed on the current
`main` that the Reference popover and the Dex/Shop/Inventory overlays are all reachable
mid-PREPARE. A new effect in `App.tsx` tracks that same combined boolean
(`isReferencePopoverOpen || isDexOpen || isShopOpen || isInventoryOpen`) and dispatches two new
actions, `PAUSE_COOKING_TIMING`/`RESUME_COOKING_TIMING`, on its transitions. Both are no-ops
outside `PREPARE` or once `cookingTiming` is finished/absent (a Mission round always has it
`null`), so a stray dispatch can never affect BAKE/RESULT or a Mission round.

**Deliberately deferred to CT2/CT3, not implemented here**: `visibilitychange`/`blur`
(browser-background / tab-switch / iOS app-interruption) pausing. `PizzaStage.tsx` already has a
`blur`/`visibilitychange` listener, but it only aborts an in-progress gesture -- it is not wired
to `cookingTiming` in this slice. This is a real gap (an interrupted player's clock keeps running
across a backgrounded tab), but CT1's own scope instruction is "don't build a large lifecycle
system pre-emptively" -- there is no reward yet for an inflated `completedMs` to unfairly cost a
player, so the risk is currently cosmetic, not economic. **CT2 recommended scope** (below) should
resolve this before any reward/display is attached.

## State fields added

- `GameState.cookingTiming: CookingTimingState | null` (`src/state/gameReducer.ts`).
- `GameAction`: `now?: number` added to `BEGIN_PREPARE`, `RESET_PIZZA`, `START_BAKE`,
  `SELECT_RECIPE`, `RETRY_SAME_RECIPE` (all optional -- see "Clock injection" below); two new
  actions, `PAUSE_COOKING_TIMING`/`RESUME_COOKING_TIMING` (`now` required, both brand new with no
  legacy callers).

## Clock injection method

Followed the codebase's own established pattern (`MissionClock`'s `START { now }`,
`lunchRush.test.ts`'s hand-picked-`now` tests) rather than introducing fake timers for the first
time: `now` is passed as an action payload, `App.tsx` is the only place that calls `Date.now()`,
and `gameReducer.ts`/`cookingTiming.ts` never read the wall clock. `now` is **optional** on the
five pre-existing actions specifically so the ~50 existing test call sites across the suite that
dispatch them with no timing concern at all keep compiling and passing unchanged -- omitting it
simply leaves `cookingTiming` unset/unstarted for that dispatch (it is never defaulted to
`Date.now()` inside the reducer, which would have reintroduced non-determinism). Confirmed zero
existing test files needed edits.

## Save impact

None. `cookingTiming` is not part of any object `persistProgress`/`loadSave` reads or writes
(`src/state/persistence.ts` untouched -- `git diff` confirms zero lines changed in that file).
`schemaVersion` stays `2`; no `migrateV2toV3` added.

## Scoring impact

None. `computeScoringV2`, `scoringV2/*`, `src/logic/bake.ts`/`classifyBake`/`bakeTarget`, and
`src/logic/scoring.ts` are all untouched (`git diff` confirms zero lines changed under
`src/logic/scoringV2/` or in `bake.ts`). `cookingTiming` is not read by `CONFIRM_BAKE`'s scoring
call.

## Pitz impact

None. `src/logic/pitzReward.ts`/`applyPitzCredit`/`calculatePitzReward` untouched (`git diff`
confirms zero lines changed). `REGISTER_TO_DEX`'s `lastPitzCredit` computation is unchanged and
does not read `cookingTiming`.

## Changed / new files

```
 src/App.tsx                                  | 36 ++++++++++++++++++++----
 src/state/gameReducer.ts                     | 110 +++++++++++++++++++++++++++++++++++++++++++++++++++++--------
 src/logic/cookingTiming.ts                   | new (pure timing module)
 src/logic/cookingTiming.test.ts              | new (12 tests)
 src/state/gameReducer.cookingTiming.test.ts  | new (16 tests)
 docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md | new (recovered + addendum)
 docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md | new (this file)
```

## Tests

### Focused (28 new, all passing)

`src/logic/cookingTiming.test.ts` (12): start/finish exact-30000ms case, zero-elapsed edge case,
backwards-`now` clamp, idempotent double-finish, single and multi pause/resume cycles, a pause
spanning the whole window, finishing while still paused, pause/resume no-ops (already paused,
not paused, already finished).

`src/state/gameReducer.cookingTiming.test.ts` (16), covering every item in the task's §10 list:
1. FREE `BEGIN_PREPARE` starts timing (plus: stays `null` if `now` omitted).
2. 30s later `START_BAKE` -> `completedMs = 30000`.
3. Time elapsed *during* BAKE (including a pause/resume signal fired mid-BAKE) never changes
   `completedMs`; `CONFIRM_BAKE` doesn't touch it either.
4. `RESET_PIZZA` clears the old timing and starts a fresh one.
5. `RETRY_SAME_RECIPE`/`SELECT_RECIPE` each start a fresh timing.
6. `PLAY_AGAIN` (HOME mid-round) clears timing to `null`.
7. Two Lunch Rush non-regression tests: `BEGIN_PREPARE` after `MISSION_RESET_ORDER` stays `null`;
   a full Mission round through `MISSION_NEXT_ORDER` never carries a Cooking Time forward, and
   `lastPitzCredit` stays governed by `isMissionRound` exactly as before, untouched by this field.
8. (reload/Save) -- structural, not a runtime test: `cookingTiming` is not part of
   `persistProgress`'s parameter object, confirmed by reading `persistence.ts`; a runtime test
   would need to fake a whole reload path this codebase doesn't otherwise test that way.
9. Pause boundary tests (excludes a paused span; no-op outside PREPARE) + a
   DISCOVERED-keeps-completedMs test.
10. Reducer-level regression coverage IS the full suite below (Bake Judgment / Scoring 2.0).

### Full suite

`npx vitest run`: **74 test files, 1469 tests, all passing** (1441 pre-existing + 28 new; zero
existing test file required edits).

### Typecheck

`npx tsc -b --noEmit`: clean, no errors.

### Lint

`npx oxlint`: clean, no warnings/errors.

### Build

`npm run build` (`tsc -b && vite build`): succeeds --
`dist/assets/index-*.js` 338.91 kB (gzip 106.18 kB), `dist/assets/index-*.css` 40.07 kB.

## Regression findings

None. Full suite green with zero modifications to any existing test file. `git diff --stat`
against `origin/main` touches exactly `src/App.tsx` and `src/state/gameReducer.ts` (both purely
additive: new field, new optional action payloads, new reducer cases, one new effect) plus the
new files listed above -- no line in `src/logic/scoringV2/`, `src/logic/bake.ts`,
`src/logic/pitzReward.ts`, `src/logic/economy.ts`, `src/mission/`, or `src/state/persistence.ts`
was touched.

No UI changed (no new component, no new visible text/element) -- per the task's own instruction,
Preview/iPhone Human Feel verification was not treated as required for this slice; only the
non-UI checks above were run.

## CT2 recommended scope

(Unchanged from the Fresh Audit's own §9 sequencing, Slices 2-4 -- restated here as the concrete
next step now that Slice 1/CT1's foundation exists.)

1. **`visibilitychange`/`blur` pause** -- wire `cookingTiming` into the pause signal
   `PizzaStage.tsx` already listens for, closing the gap this report's "Pause / background"
   section flags. Should land before any reward/display so an interrupted player is never
   penalized once one exists.
2. **Human Feel data collection** (Fresh Audit §9 Slice 0, if not already done) -- a dev-only log
   of real `completedMs` across all 7 recipes before hand-picking any par-time coefficient.
3. **Par-time formula + tier classification** (`src/logic/efficiency.ts`) -- the
   `parBand = baseSeconds + perItemSeconds × totalRequiredItemCount` shape from the Fresh Audit
   §4, calibrated against Slice 0's data.
4. **RESULT display** (Fresh Audit Option 2) -- a "手際" tier badge, UI-only, reading the
   already-computed tier; independent of the Scoring 2.0 `available` gate.
5. **Small additive Pitz bonus** (Fresh Audit Option 3) -- composed into `REGISTER_TO_DEX`
   alongside `applyPitzCredit`, capped small relative to the quality ceiling, gated on a minimum
   quality band per the Fresh Audit §5.
6. **Re-decide `RESET_PIZZA`'s reset-and-restart behavior** (this report's "explicit deviation"
   note above) once a reward exists to game -- revisit whether resetting should instead pause/
   discard without restarting, to close the "reset to re-roll a slow start" gap the original
   Fresh Audit's §2 was concerned with.

## Unresolved Human Feel constants

None hand-picked in this slice -- CT1 adds no par-time, tier threshold, or Pitz-bonus constant of
any kind (by design; those all belong to CT2 Slice 0's real playtest data per the Fresh Audit
§4/§9). Nothing here needs an iPhone Human-Feel pass to validate a magic number, because no
magic number was introduced.

## Final Verdict

**B. CT1 READY WITH MINOR FOLLOW-UP**

The measurement foundation is complete, deterministic, fully FREE-scoped, and verified
regression-free (full suite/typecheck/lint/build all green, zero existing test edits). It is not
"A. READY TO MERGE" outright only because of one open, explicitly-flagged item: the
`visibilitychange`/`blur` pause gap (deferred to CT2 by design, not an oversight) and the
`RESET_PIZZA` reset-vs-restart decision that should be explicitly re-confirmed once a reward is
ever attached to this data. Neither blocks merging CT1 itself -- both are pre-declared follow-up
for the slice that actually attaches a reward/display to `completedMs`, consistent with CT1's own
"measurement foundation only" mandate.
