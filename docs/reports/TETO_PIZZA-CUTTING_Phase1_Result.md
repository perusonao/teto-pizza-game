# TETO Pizza Cutting 1.0 — Phase 1 Result Report (Geometry / Evaluation Foundation)

**Originally audited `origin/main` SHA (PR #126's own base):**
`d62d535305dd65bf5f45c847363c38f421a40e23` (PR #125, "Recipe Cooking Steps 1.0 Phase 1A-T: Step
Timing instrumentation", merged). Re-confirmed fresh via `git fetch origin` at both session start
and immediately before PR creation (Duplicate Gate #2) — `main` did not move between the two
checks.

**Fresh Merge Gate follow-up (main-catch-up pass):** `origin/main` advanced to
`a7b842cb69925da6226d956306b470253df62818` (PR #127, "HOME Weekly Ranking route: reuse
WeeklyRankingOverlay from HOME", merged) while PR #126 was under independent review. `git fetch
origin` re-confirmed this SHA; PR #127 is entirely scoped to `src/App.tsx`/`src/screens/
HomeScreen.tsx`/`src/App.test.tsx` (HOME routing), with zero overlap with `src/logic/cut/*`. The
branch was merged forward onto `origin/main` (`git merge origin/main --no-edit`) — **clean, zero
conflicts** (merge commit `3faae4b`) — and the full verification pass (§14) was re-run against the
merged result. See §14/§24 for the re-verification detail and updated diff scope.

**Implementation SHA (current PR head, post-merge):** the commit on
`claude/pizza-cutting-phase1-geometry-oja36m` this report ships alongside (see the PR's own head
commit — `git log -1` on this branch).

**SSOT authority:** `docs/design/TETO_PIZZA-CUTTING_1.0.md` (Fresh Design, PR #123, merged) and its
companion `docs/reports/TETO_PIZZA-CUTTING_1.0_Fresh-Design_Result.md`. No alternative cut-scoring
design was invented — every formula, weight, and algorithm choice below cites the section of that
document it implements unchanged.

---

## 1. Duplicate Gate — result (both passes)

- **Gate #1 (before implementation):** `git fetch origin` + full open-PR list + remote-branch scan.
  6 open PRs total: #121 (Firebase Production Connection — explicitly out of scope, untouched),
  #105 (Dev Automation A1, draft), #72, #46, #34, #3 — none overlap Pizza Cutting/CUT/Cooking
  Steps/Step Timing scope. #123/#124/#125 are merged, not duplicates. **Clear to proceed.**
- **Gate #2 (immediately before PR creation):** re-ran `git fetch origin` and re-checked open PRs
  and `origin/main` HEAD. No new PR of matching scope appeared; `origin/main` unchanged at
  `d62d535`. **Clear to open the PR.**

## 2. Fresh code audit

Read in full: `src/state/gameReducer.ts` (`MakingStep` union — `"CUT"` already present, added by
Cooking Steps Phase 1A), `src/data/cookingProfiles.ts` (`CookingProfile`/`getCookingProfile`,
`isPostBakeStep`/`preBakeSteps`/`postBakeSteps` — `"CUT"` already classified as a post-BAKE step;
**not modified** by this phase, see §14), `src/logic/cookingTiming.ts` (per-step timing shape —
read for the Step Timing handoff boundary, §11, never called by this phase's code),
`src/screens/GameScreen.tsx`, `src/components/PizzaStage.tsx`, `src/App.tsx` — read to confirm the
existing gesture/pointer architecture (§2.2 of the design doc) and to confirm none of them needed
or received any change. `src/logic/pizzaCoordinates.ts` (`DOUGH_CENTER`/`DOUGH_RADIUS`/
`DoughPoint`/`isInsideDough`/`clampToDough`) — the coordinate system this phase reuses unchanged
(§3 below). `src/logic/doughShape.ts` — confirmed the design doc's own instruction to score
against the *ideal* circle, not the D3A-distorted silhouette, and that this phase never imports
from it.

## 3. Geometry coordinate contract

No new or conflicting coordinate system. `src/logic/cut/*` imports `DoughPoint`, `DOUGH_CENTER`
(50), `DOUGH_RADIUS` (48), `distanceFromCenter`, and `isInsideDough` directly from
`../pizzaCoordinates.ts` — the exact same 0–100 dough-percent box every other gesture family
(DOUGH stretch, sauce dispense, topping drag) already uses. `CutLine.start`/`end` are `DoughPoint`s
in that same space.

## 4. `CutConfig`

`src/logic/cut/types.ts`:

```ts
export type RequestedSliceCount = 4 | 6 | 8;
export const DEFAULT_REQUESTED_SLICE_COUNT: RequestedSliceCount = 6;
export interface CutConfig { readonly requestedSliceCount?: RequestedSliceCount; }
export function resolveRequestedSliceCount(config: CutConfig | undefined): RequestedSliceCount;
```

`6` is never hard-coded inside `geometry.ts`/`evaluation.ts` — every slice-count-dependent
computation (`idealPieceArea`, `requiredCutCount`, `countCorrectness`) reads `requestedSliceCount`
through `resolveRequestedSliceCount`. 4/6/8 are all exercised by tests (§13); only 6 is the
Phase 1 shipping target (design doc §3.2). **Not wired into `../../data/cookingProfiles.ts`'s
`CookingProfile`** — that wiring is explicit Phase 2/4 scope (design doc §18), not this one; see
§14 below.

## 5. `CutLine` / edge-to-edge contract

```ts
export interface CutLine { readonly start: DoughPoint; readonly end: DoughPoint; }
export const RIM_TOLERANCE_DOUGH_PERCENT = 1e-6;
export function isNearRim(point: DoughPoint, toleranceEpsilon?: number): boolean;
export function isEdgeToEdgeCutLine(line: CutLine, toleranceEpsilon?: number): boolean;
```

Pure data, no DOM/pointer knowledge. `isEdgeToEdgeCutLine` is the explicit, checkable contract
Phase 2's UI layer (pointer start → drag → pointer end → `clampToDough`-clamped commit) will use
to confirm every line it ever dispatches is a genuine rim-to-rim chord — the geometry/evaluation
engine itself does not enforce this (any two points produce a well-defined, if degenerate, result
either way — design doc §4.1), so this function is a boundary contract, not an internal guard.

## 6. Ideal circle definition

`CIRCLE_AREA = Math.PI * DOUGH_RADIUS * DOUGH_RADIUS` (`src/logic/cut/geometry.ts`). All scoring
is against this ideal circle, never the player's D3A-distorted dough silhouette
(`../doughShape.ts`) — same existing precedent Scoring 2.0's Sauce component already uses for
`isInsideDough` (design doc §4.2's closing note). `doughShape.ts` is not imported anywhere in
`src/logic/cut/`.

## 7. Grid sampling design

Deterministic (no `Math.random()` anywhere in this phase). `GRID_RESOLUTION = 96` candidate points
per axis over the dough's bounding square; each point inside the circle (`isInsideDough`, reused
unchanged) is classified by a `+1`/`-1` sign per committed line (`sidesOf`, a pure line-equation
cross-product — no segment-intersection/DCEL/polygon-clipping code, no external geometry
dependency). Points sharing an identical sign tuple belong to the same piece;
`pieceArea = (pointsInGroup / totalKeptPoints) * CIRCLE_AREA`.

- **Sample count:** empirically ~7,238 of the 9,216-point grid land inside the circle (matches the
  design doc's own ~7,000–7,500 estimate, §4.2 point 3).
- **Representative computation:** the 8-slice case (worst case, 4 lines) is ~7,238 points × 4 sign
  evaluations ≈ 29,000 simple arithmetic comparisons per `computePieceAreas` call — well under a
  millisecond on any real device, matching the design doc's own estimate exactly.

## 8. Piece classification / area approximation

`computePieceAreas(lines, gridResolution = GRID_RESOLUTION): readonly number[]` — returns one area
per distinct region, however many that is, never assumed to equal `requestedSliceCount`. Verified
order-independent: every downstream evaluation signal only reads `.length` or an aggregate
(mean / mean-absolute-deviation) over the returned values, never a specific index, so reordering
the input `lines` array cannot change any evaluation signal (verified by a dedicated determinism +
reordering test, §13).

## 9. Evaluation signals (all four, independent, pure)

`src/logic/cut/evaluation.ts`, `evaluateCut(lines, config?): CutEvaluation`:

| Signal | Formula (design doc §5) |
|---|---|
| Count correctness | `1 - min(1, \|actualPieceCount - requestedSliceCount\| / requestedSliceCount)` |
| Completeness | `min(1, completedCutCount / requiredCutCount)`, `requiredCutCount = requestedSliceCount / 2` |
| Center accuracy | `1 - mean(clamp01(perpendicularDistanceFromCenter(line) / DOUGH_RADIUS))` across lines; `0` (worst) for zero lines |
| Piece-area uniformity | `1 - min(1, meanAbsoluteDeviation(pieceAreas, idealPieceArea) / idealPieceArea)`, `idealPieceArea = CIRCLE_AREA / requestedSliceCount` |

`cutScore = 100 * (0.2*count + 0.2*completeness + 0.1*center + 0.5*uniformity)` — design doc §6
Option B ("uniformity-heavy", recommended), weights verified to sum to exactly 1 by a dedicated
test.

## 10. Standalone evaluation — Scoring 2.0 non-integration

`cutScore`/`CutEvaluation` are a pure, displayable preview only. **Nothing in this phase reads or
writes `state.score.total`, `ScoringV2Result`, star thresholds, Dex BEST, Lunch Rush ranking, or
Pitz reward** — `src/logic/cut/*` imports nothing from `../scoringV2/*`, `../missionScoring.ts`,
`../pitzReward.ts`, or `../mastery.ts`, and nothing outside `src/logic/cut/` imports from it either
(confirmed by `git diff origin/main --stat`, §14). Matches design doc §14 Option D exactly.

## 11. Transient state

`src/logic/cut/state.ts` — `CutState { config, lines, evaluation }`, pure helpers:

- `createCutState(config?)` — fresh state, `lines: []`, `evaluation: null`.
- `addCutLine(state, line)` — appends a line, invalidates (`null`s) any prior evaluation.
- `resetCutState(state)` — clears `lines`/`evaluation`, keeps `config` (same-recipe retry
  discipline, design doc §15.3).
- `evaluateCutState(state)` — computes and stores `evaluateCut(state.lines, state.config)`.

**Not integrated into `GameState`** — this is a standalone module `App.tsx`/`gameReducer.ts` do
not import, matching CUT Phase 1's own "geometry + transient state foundation, no reducer/UI
wiring" scope (design doc §18's roadmap row). Phase 2's reducer wiring is expected to call these
same functions rather than reimplement them.

## 12. Step Timing handoff boundary

**`src/logic/cut/*` never imports from `../cookingTiming.ts` and never reads/writes
`CookingTimingState`/`perStepElapsedMs`.** Per the design doc §9/§6.1 and Cooking Steps SSOT §22.6/
§22.7 (Quality-primary/Time-secondary): CUT geometry has no concept of time. The intended Phase 2
handoff, stated explicitly per this task's own instruction:

```
POST_BAKE CUT start
  -> Step Timing activeStep = "CUT" (../cookingTiming.ts, already available since Phase 1A-T)
  -> gesture/cut lines (Phase 2 UI, dispatched through this phase's addCutLine/evaluateCutState)
  -> CUT confirm
  -> perStepElapsedMs.CUT finalized (../cookingTiming.ts's advanceStepTiming)
```

`perStepElapsedMs.CUT` is never an input to `cutScore` in this phase (design doc §6.1) — this
phase's `evaluateCut` has no `now`/timestamp parameter of any kind, by construction.

## 13. Tests (all 20 required scenarios covered)

4 new files, 52 tests, all passing:

| # | Scenario | File |
|---|---|---|
| 1 | default `CutConfig` = 6 slices | `types.test.ts` |
| 2 | valid cut line model (edge-to-edge contract) | `types.test.ts` |
| 3 | ideal 3 diameter lines → 6 pieces | `geometry.test.ts` |
| 4 | ideal 6 slices → areas approximately uniform (< 3% of ideal, measured max ~0.11%) | `geometry.test.ts` |
| 5 | same input → deterministic identical output | `geometry.test.ts`, `evaluation.test.ts` |
| 6 | line order change → evaluation substantially unchanged | `evaluation.test.ts` |
| 7 | missing one ideal line → count correctness drops | `evaluation.test.ts` |
| 8 | offset cut → center accuracy drops | `evaluation.test.ts` |
| 9 | short/incomplete cut → completeness drops | `evaluation.test.ts` |
| 10 | uneven cuts → uniformity drops | `evaluation.test.ts` |
| 11 | no cuts → safe, fully-finite worst-case result | `evaluation.test.ts` |
| 12 | duplicate/near-duplicate line → no crash, defined result | `geometry.test.ts`, `evaluation.test.ts` |
| 13 | horizontal/vertical/diagonal lines | `geometry.test.ts` |
| 14 | circle-boundary tangent/near-tangent case → no crash | `geometry.test.ts`, `evaluation.test.ts` |
| 15 | 4/8 future config → engine not 6-hard-coded | `geometry.test.ts`, `evaluation.test.ts` |
| 16 | cut state add line | `state.test.ts` |
| 17 | cut state reset | `state.test.ts` |
| 18 | evaluation refresh | `state.test.ts` |
| 19 | save schema unchanged | verified directly (§14) |
| 20 | existing Cooking Steps / Step Timing regression green | full suite, §14 |

## 14. Verification

Original pass (base `d62d535`):

- **Focused geometry/state tests:** `npx vitest run src/logic/cut/` — 4 files, 52/52 passed.
- **Full suite, run 1:** `npx vitest run` — 101 files, 1907/1907 passed.
- **Full suite, run 2 (determinism confirmation):** 101 files, 1907/1907 passed, identical count.
- **TypeScript typecheck:** `npx tsc -b` — clean, no errors.
- **Lint:** `npx oxlint` — clean, no warnings/errors.
- **Production build:** `npm run build` — succeeds (`tsc -b && vite build`); the only warning is
  the pre-existing >500kB single-chunk advisory, unrelated to this change.
- **Diff scope:** `git diff origin/main --stat` shows **zero changes to any existing file** — this
  phase is entirely new files under `src/logic/cut/`. `CURRENT_SCHEMA_VERSION` in
  `src/state/persistence.ts` is unchanged (`= 2`). No `functions/**`, no `src/data/**`, no
  `src/state/gameReducer.ts`, no `src/App.tsx`, no `src/screens/**`, no `src/components/**` touched.

**Re-verification pass, after merging `origin/main` @ `a7b842c` forward into this branch (§24):**

- **Focused geometry/state tests:** `npx vitest run src/logic/cut/` — 4 files, 52/52 passed.
- **Full suite, run 1:** `npx vitest run` — 101 files, **1909/1909** passed (+2 vs. the original
  pass — PR #127's own `App.test.tsx` additions for the HOME Weekly Ranking route; no `src/logic/
  cut/*` test count changed).
- **Full suite, run 2 (determinism confirmation):** 101 files, 1909/1909 passed, identical count.
- **TypeScript typecheck:** `npx tsc -b` — clean, no errors.
- **Lint:** `npx oxlint` — clean, no warnings/errors.
- **Production build:** `npm run build` — succeeds; same pre-existing >500kB chunk-size advisory,
  unrelated.
- **Diff scope (against the new `origin/main` @ `a7b842c`):** `git diff origin/main --stat` shows
  **exactly the same 10 files as the original pass** —
  `docs/reports/TETO_PIZZA-CUTTING_Phase1_Result.md` + the 9 files under `src/logic/cut/`. No
  scope leakage from PR #127 (or anything else) into this PR's diff.

## 15. Numerical robustness

- `computePieceAreas` and `evaluateCut` are verified NaN/Infinity-free for: zero lines, a
  zero-length (degenerate) line, a near-tangent line barely grazing the rim, exact-duplicate
  lines, and near-duplicate-angle lines (dedicated tests in both `geometry.test.ts` and
  `evaluation.test.ts`).
- `perpendicularDistanceFromCenter` treats a line shorter than
  `DEGENERATE_LINE_LENGTH_EPSILON = 1e-9` as the worst case (`DOUGH_RADIUS`) instead of dividing
  by (near-)zero.
- `RIM_TOLERANCE_DOUGH_PERCENT = 1e-6` (rim-membership check) and
  `DEGENERATE_LINE_LENGTH_EPSILON = 1e-9` (degenerate-line guard) are the two named epsilon
  constants this phase introduces — each declared once, at its point of use, with a doc comment
  explaining its derivation; no magic-number epsilons elsewhere in `src/logic/cut/`.
- Piece areas always sum to ≈`CIRCLE_AREA` (verified in every geometry adversarial-input test);
  no negative area fraction is possible (`count / totalKept` with both operands non-negative and
  `totalKept > 0` in every real call).

## 16. Performance

`GRID_RESOLUTION = 96` (≈7,238 in-circle samples); worst case (8-slice, 4 lines) ≈29,000
arithmetic comparisons per `computePieceAreas` call — sub-millisecond on any real device (design
doc §4.2 point 3, reproduced empirically during this phase's own scratch verification). No
micro-optimization attempted beyond this — Phase 1 prioritizes deterministic/readable/testable per
this task's own instruction, and this cost is already well within a realistic per-gesture budget.

## 17. Completion Gate compatibility

Not touched. `src/logic/completionGate.ts` was not modified and is not imported by
`src/logic/cut/*`. CUT's `requiredForCompletion: false` (already committed by the merged Cooking
Steps SSOT, §7/§11) is unaffected — this phase never gates anything, it only computes a score.

## 18. Lunch Rush compatibility

Not touched. `src/mission/lunchRush.ts`, `src/logic/missionScoring.ts`,
`src/firebase/submitLunchRushScore.ts` were not modified and are not imported by
`src/logic/cut/*`. `MissionClock` and Lunch Rush scoring stay byte-identical.

## 19. Save compatibility

Not touched. `src/state/persistence.ts`'s `CURRENT_SCHEMA_VERSION` remains `2`. No migration
added. `CutState`/`CutLine`/`CutEvaluation` are never serialized anywhere in this phase — they
exist only as pure, in-memory data structures with no persistence call site.

## 20. 15 recipes / production flow compatibility

Not touched. `src/data/cookingProfiles.ts`'s `COOKING_PROFILES` map remains empty; every recipe
still resolves to `DEFAULT_COOKING_PROFILE` (`DOUGH → SAUCE → CHEESE → TOPPING`). No recipe's
profile carries a `CUT` entry or `cutConfig`. `BAKE → RESULT` (immediate, zero post-BAKE steps)
is unchanged for all 15 shipped recipes — confirmed indirectly by the full, unmodified Cooking
Steps regression suite passing unchanged (§14).

## 21. UI

**No UI change of any kind.** `PizzaStage.tsx`, `GameScreen.tsx`, `App.tsx`, `App.css` are
byte-identical to `origin/main`. No cut gesture was added to `PizzaStage`. Browser screenshots were
not taken, per this task's own instruction that they are not required when no UI changes exist.

## 22. Known risks

- **Grid-sampling discretization noise** is small (~0.1% of ideal piece area at
  `GRID_RESOLUTION = 96` for the ideal 6-slice fixture) but non-zero — a future phase retuning
  `GRID_RESOLUTION` down for a cheap live-preview recompute (design doc §4.2 point 3's own
  suggestion) should re-verify the uniformity tolerance still holds at the lower resolution before
  shipping it.
- **The CUT score weighting (§6 Option B) and every numeric constant in this phase remain
  provisional**, exactly as the design doc itself states (§6's closing paragraph) — Phase 4's
  Human Feel Gate is the intended place to revisit them with real device/finger data, not this
  phase.
- **`isEdgeToEdgeCutLine`'s rim tolerance (`1e-6`)** is sized for this phase's own synthetic
  fixtures (`Math.cos`/`Math.sin`-derived rounding, ~1e-13 at this radius); Phase 2's real
  `clampToDough`-clamped pointer data has its own, independently-tuned inset epsilon
  (`CLAMP_INSET_EPSILON = 1e-9`, `../pizzaCoordinates.ts`) — the two are not required to match
  exactly, but Phase 2 should confirm a real clamped commit still passes this check.

## 23. Phase 2 handoff

What Phase 2 (design doc §18: "Touch UI + `POST_BAKE` integration") can build directly on top of
this phase, unchanged:

- `src/logic/cut/types.ts` — `CutLine`, `CutConfig`, `isEdgeToEdgeCutLine` (the exact contract a
  real `pointerdown`→drag→`pointerup`→`clampToDough` commit must satisfy before dispatching).
- `src/logic/cut/geometry.ts` / `evaluation.ts` — `evaluateCut(lines, config)`, already fully
  general over 4/6/8, ready to call from a real reducer action.
- `src/logic/cut/state.ts` — `createCutState`/`addCutLine`/`resetCutState`/`evaluateCutState`,
  ready to be the implementation a `GameState.cutState`-shaped reducer slice delegates to, rather
  than reimplemented.
- **Not done here, explicitly Phase 2's own work:** wiring `CookingProfile.cutConfig` (design doc
  §1.2), `PizzaStage` CUT-mode pointer handling, the `REGISTER_TO_DEX`/mission-serve orchestration
  relocation (design doc §12), any bottom-bar UI, and the guide-fade visual (needs
  `perStepElapsedMs.CUT`, already available since Phase 1A-T but not read by this phase).

## 24. Fresh Merge Gate follow-up — main catch-up

Performed after `origin/main` advanced to `a7b842c` (PR #127, HOME Weekly Ranking route) while
PR #126 was under independent review:

1. `git fetch origin` — confirmed `origin/main` at `a7b842cb69925da6226d956306b470253df62818`.
2. Open-PR/scope re-check: PR #127's diff (`src/App.tsx`, `src/screens/HomeScreen.tsx`,
   `src/App.test.tsx`, plus its own `docs/reports/TETO_HOME-WEEKLY-RANKING_Result.md` and
   screenshots) touches HOME routing only — no file under `src/logic/cut/` or this report.
3. `git merge origin/main --no-edit` on `claude/pizza-cutting-phase1-geometry-oja36m` — **clean
   merge, zero conflicts** (merge commit `3faae4b`); `git status` reported no unmerged paths.
4. `git merge-base HEAD origin/main` == `origin/main`'s own HEAD — branch is fully caught up.
5. Post-merge diff re-check (`git diff origin/main --stat`): identical 10-file list to the
   original PR — `docs/reports/TETO_PIZZA-CUTTING_Phase1_Result.md` +
   `src/logic/cut/{types,types.test,geometry,geometry.test,evaluation,evaluation.test,state,
   state.test,fixtures}.ts`. **No scope leakage.**
6. Full re-verification (§14's "Re-verification pass") — all green, pushed as the new PR head.

## Final Verdict

**READY FOR PHASE 2 — and current on `main`.** Every Phase 1 acceptance criterion (design doc
§18's own "Geometry + transient state" row) is met: `src/logic/cut/{types,geometry,evaluation,
state,fixtures}.ts` ship as pure functions with full unit coverage (52/52 focused, 1909/1909 full
suite ×2 post-merge, typecheck clean, lint clean, build clean), zero production code touched
(`git diff origin/main --stat` is empty outside the new `src/logic/cut/` directory, both before
and after the §24 main catch-up), zero recipes activated, zero Scoring 2.0/Completion Gate/Lunch
Rush/save-schema changes, and the Step Timing hand-off boundary is both respected in code (no
import of `../cookingTiming.ts`) and stated explicitly in this report (§12). The branch merged
`origin/main` @ `a7b842c` (PR #127) forward with zero conflicts and zero scope drift (§24). Not
merged — left open for independent review, per this task's own instruction.
