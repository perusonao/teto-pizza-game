# TETO Pizza Cutting 1.0 — Phase 2 Result Report (Touch UI + POST_BAKE Integration)

**Audited `origin/main` SHA (session start):** `a2cd715f2b42cdebfa13750333cc24da91ed888e` (PR #126,
"Pizza Cutting 1.0 Phase 1: geometry and evaluation foundation", merged). Re-confirmed via
`git fetch origin` immediately before PR creation (Duplicate Gate #2) — `origin/main` had
advanced to `9bd5db7170347c2b31234f529b87564e691a444d` (PR #121, "Firebase Production
Connection", merged) in the meantime; see §24 for the merge-forward/re-verification detail.

**SSOT authority:** `docs/design/TETO_PIZZA-CUTTING_1.0.md` (Fresh Design, PR #123) and
`docs/reports/TETO_PIZZA-CUTTING_Phase1_Result.md` (Phase 1, PR #126). No alternative gesture,
geometry, or evaluation design was invented — this phase wires Phase 1's already-shipped pure
`src/logic/cut/*` module into the real reducer/UI, per that document's own §18 "CUT Phase 2"
roadmap row.

---

## 1. Duplicate Gate

- **Gate #1 (before implementation):** `git fetch origin` + full open-PR scan. `origin/main` at
  `a2cd715`, matching PR #126's own merge SHA. Open PRs: #121 (Firebase Production Connection —
  explicitly out of scope), #105 (draft, Dev Automation), #72/#46/#34/#3 (docs/unrelated design
  audits). **None overlap Pizza Cutting/CUT/POST_BAKE/Cooking Steps scope.** Designated branch
  `claude/pizza-cutting-phase-2-d36vrn` was already checked out at `origin/main`'s tip. Clear to
  proceed.
- **Gate #2 (immediately before PR creation):** re-ran `git fetch origin` and re-checked open
  PRs. `origin/main` had advanced to `9bd5db7` (PR #121 merged, Firebase Production Connection) —
  its diff (`functions/src/index.ts`, `src/firebase/submitLunchRushScore.{ts,test.ts}`,
  `.github/workflows/deploy.yml`, two docs files) has zero overlap with this phase's files. No
  new PR of matching scope appeared. The branch fast-forward-merged `origin/main` (§24) and the
  full verification pass (§23) was re-run against the merged result. Clear to open the PR.

## 2. Fresh code audit

Read in full before writing any code: `src/App.tsx`, `src/App.css`, `src/screens/GameScreen.tsx`,
`src/components/PizzaStage.tsx`, `src/state/gameReducer.ts`, `src/data/cookingProfiles.ts`,
`src/logic/cookingTiming.ts`, `src/logic/pizzaCoordinates.ts`, `src/components/MakingStepTabs.tsx`,
`src/logic/bakeGuideFade.ts`, `src/state/pizzaState.ts`, `src/logic/completionGate.ts` (confirmed
it never mentions CUT/POST_BAKE — CUT's `requiredForCompletion: false` is structural, not a
special case to preserve), and the full Phase 1 `src/logic/cut/{types,geometry,evaluation,
state,fixtures}.ts` + their tests. Confirmed via `git log`/`git rev-parse` that
`gameReducer.ts`'s `CONFIRM_BAKE`/`CONFIRM_MAKING_STEP` already correctly route a profile's
post-BAKE steps (Cooking Steps Phase 1A, already shipped) — Phase 2's own job is real wiring:
activation data, reducer actions, gesture UI, and the `REGISTER_TO_DEX` relocation the Phase 1
design doc's own §12 finding named but did not fix.

**Key finding confirmed live in the codebase (not just theoretical):** `createInitialGameState`'s
`preferFirst: true` (`src/data/orders.ts`) always resolves to margherita — meaning margherita is
the *default* recipe underlying the large majority of this repo's existing reducer/integration
tests. Activating CUT on margherita therefore had a much wider blast radius than "one recipe's
own tests" — see §14.

## 3. Activation recipe

**Margherita**, per this task's own explicit instruction and the design doc's own §18 first
candidate. `src/data/cookingProfiles.ts`'s `COOKING_PROFILES` map now has exactly one entry:

```ts
["margherita", { steps: [..., "CUT"], cutConfig: { requestedSliceCount: 6 } }]
```

Every other of the 14 shipped recipes still resolves to `DEFAULT_COOKING_PROFILE` (unchanged) —
pinned exhaustively in `src/data/cookingProfiles.test.ts`.

## 4. CookingProfile change

Added `cutConfig?: CutConfig` to the `CookingProfile` interface (`src/data/cookingProfiles.ts`),
importing Phase 1's own `CutConfig` type unchanged. `requestedSliceCount: 6` — Phase 1's own
shipping target, no 4/8-slice UI/content added (the type already supports it for a future data
change).

## 5. Gesture architecture

Reused `PizzaStage.tsx`'s existing pointer-capture architecture unchanged — no new canvas, no
new coordinate system. CUT is a fourth branch inside the same
pointerdown/pointermove/pointerup/pointercancel/lostpointercapture dispatch DOUGH/sauce/topping
already share:

- **Start:** `handlePointerDown`'s existing `isInsideDough` gate (already generic, no per-step
  change needed) plus a new CUT-specific cut-limit check (§8).
- **Drag-vs-tap:** reuses `DRAG_THRESHOLD_PX` (10px) verbatim, in the same generic
  `processMovePoint` fallthrough sauce-paint/topping-drag already use — no new constant.
- **Commit:** a new pure function, `buildRimToRimCutLine` (`src/logic/cut/types.ts`), constructs
  the committed `CutLine` from the raw press/release pair by intersecting the infinite line
  through both points with the dough's circle (standard line-circle intersection, a handful of
  arithmetic operations — not a general geometry engine). This satisfies the design doc's own
  "press/release may land short of the rim" start tolerance for *both* endpoints (not just the
  release point), by construction: since the press point is always inside the circle
  (`isInsideDough` gate), the intersection always exists.
- **Preview:** an imperative-ref-updated `<line>` (mirrors the existing `pathRef`/sauce-trail
  pattern exactly — no React re-render per pointermove), showing the *real* rim-to-rim chord the
  drag would commit if released right now.
- **Cutter icon:** `🔪`, offset 8 dough-percent above the live pointer position (design doc §8.3),
  updated on the same imperative ref.

## 6. Threshold / limits

- Drag-vs-tap: `DRAG_THRESHOLD_PX = 10` (existing, reused unchanged).
- Cut limit: `requiredCutCount + 2` (5 for 6 slices) — a further press once reached simply starts
  no gesture (reducer's own `ADD_CUT_LINE` guard is the real backstop).
- No minimum-angular-separation duplicate-line gate was added — Phase 1's own evaluator already
  handles duplicate/near-duplicate lines gracefully (tested), and this task's own required-test
  list does not ask for it; flagged as Human-Feel-tunable for a future phase, matching the design
  doc's own §2.2 framing.

## 7. Pointer capture / multi-pointer / cancel safety

All inherited unchanged from the existing architecture: `setPointerCapture` at pointerdown (with
existing window-level pointerup/pointercancel fallback), first-finger-wins multi-touch guard
(`gestureRef.current.pointerId !== null` check, unmodified), `pointercancel`/
`lostpointercapture` both discard without committing (new `clearCutPreviewLine()` call added to
each, mirroring `discardDoughGesture()`'s own role). CUT is additionally cleared by every
existing abort trigger (`resetToken`, `makingStepToken`, `interactive` going false, blur/hidden)
via `abortActiveGesture()`.

## 8. Preview / committed line visuals

- **Preview:** dashed line, 55% opacity stroke, fades out on release/abort (120ms opacity
  transition).
- **Committed:** permanent solid dark line (`stroke-width: 2`), rendered from `cutState.lines`
  directly — no separation animation (explicitly deferred to a future Human Feel phase, per the
  design doc's own §8.3).
- Both live in a new `.pizza-cut-layer` SVG (same 0-100 coordinate space / clip-path convention
  as the existing `.pizza-paint-trail`).

## 9. Guide

Full-opacity angle guide (evenly-spaced diameters at the ideal count) for the first
`GUIDE_FADE_START_S` (3.6s) of *this* CUT attempt, fading to 0 by `GUIDE_FADE_END_S` (7.2s) — the
exact `computeGuideOpacity` curve `BakeOverlay`'s own Guide-fade already ships
(`src/logic/bakeGuideFade.ts`), reused unchanged rather than a new curve. A low-opacity center dot
never fades, for the whole CUT step. Driven by a self-contained `requestAnimationFrame` loop keyed
on `makingStepToken` (restarts at full opacity every time CUT is (re-)entered), independent of
`cookingTiming` — matching this task's own "don't build ahead of need" instruction (no new
persisted first-time-only flag, no per-step-elapsed-time plumbing beyond what already exists).

## 10. CUT step UI

New instruction row (reuses `.order-card`, PREPARE's own component, verbatim) — "ピザを6等分に
切ろう！" — above the pizza. Progress readout ("N / 3 本") below it. A dedicated bottom bar
(`.prepare-bake-bar`/`.cta-button`/`.secondary-button`, all reused CSS) with "↩ 1本戻す" (undo,
disabled at 0 lines) and "切り終わる →" (confirm, disabled until `requiredCutCount` lines are
committed). Deliberately a *new* bar, not a relabeled PREPARE one — "やり直す" there discards the
whole pizza via `RESET_PIZZA`, which is PREPARE-only and has no meaning once BAKE has already
happened.

## 11. Step Timing integration

Unchanged mechanism, new call sites only: `CONFIRM_BAKE` already started `POST_BAKE`'s first
step's timing window (Phase 1A-T, pre-existing). `CONFIRM_MAKING_STEP`'s CUT-confirm branch (new
in this phase) computes `evaluateCutState` immediately before the existing `advanceStepTiming`
call that finalizes `perStepElapsedMs.CUT` — two independent operations in the same reducer case,
no coupling between them (CUT geometry/evaluation still never imports from `cookingTiming.ts`).
Pause boundary (`PAUSE_COOKING_TIMING`/`RESUME_COOKING_TIMING`) is **unchanged** — still
PREPARE-only, by design (§18's own analysis: every overlay that could pause it — Dex/Shop/
Inventory — is already unreachable during a round per Issue #47 Finding K, so the gap is inert
in practice; not widened, to avoid touching Phase 1A-T's already-verified pause math for
something CUT's own score never reads).

## 12. REGISTER_TO_DEX / Lunch Rush serve relocation (the design doc's own §12 finding)

**Before:** `App.tsx`'s `handleConfirmBake` dispatched `CONFIRM_BAKE` then unconditionally
`REGISTER_TO_DEX`, relying on the latter's own `phase !== "RESULT"` guard to no-op whenever a
CUT-enabled recipe instead landed on `POST_BAKE`. That guard already made the *premature* call
safe (confirmed by a still-passing Phase 1A regression test) — but **nothing ever fired
`REGISTER_TO_DEX` again** once the round actually reached `RESULT` via CUT's own confirm.

**After:** a new `handleConfirmMakingStep` in `App.tsx` mirrors `handleConfirmBake`'s exact
pattern — dispatches `CONFIRM_MAKING_STEP` then (FREE only) `REGISTER_TO_DEX` — and is now what
`GameScreen`'s `onConfirmMakingStep` prop calls, for *every* `CONFIRM_MAKING_STEP` dispatch
(every PREPARE step tab/CTA, and CUT's own "切り終わる"). The guard makes every PREPARE-step call
a harmless no-op (phase never `RESULT` there); the CUT-confirm call is the one that actually
matters, and now fires. **Lunch Rush needed zero changes**: `MissionServePanel` already only
renders when `state.phase === "RESULT"`, so a CUT-enabled recipe simply doesn't show it until
CUT confirms — the existing Mission serve flow (`handleMissionServeNext` → `MISSION_NEXT_ORDER`)
then works unmodified.

## 13. Reset semantics

- `RESET_PIZZA` (PREPARE-only): never touches `cutState` — correct, since CUT hasn't started at
  that point in the round; verified as a referential no-op (`RESET_PIZZA` during CUT itself is
  rejected outright, `phase !== "PREPARE"`).
- `RETRY_SAME_RECIPE` / `SELECT_RECIPE` / `PLAY_AGAIN` / `MISSION_NEXT_ORDER` /
  `MISSION_RESET_ORDER`: all route through `buildOrderState`, the one place
  `cutState: createCutState(cookingProfile.cutConfig)` is (re)created — a previous pizza's
  committed lines/evaluation can never leak into the next round, regardless of which recipe it
  is. Explicitly tested (`gameReducer.cutStep.test.ts`).

## 14. Existing-suite fallout (the real size of this phase)

Activating CUT on margherita — the *default* test recipe used pervasively by this repo's own
pre-existing reducer/integration suite (`createInitialGameState`'s `preferFirst: true`) — broke
**79 previously-passing tests across 15 files**, none for a wrong reason: every one of them had
assumed `CONFIRM_BAKE` on the round's own default/first recipe lands directly on `RESULT`, which
stopped being true for margherita. Per this task's own "既存テストを削除して通すのは禁止"
instruction, every one was **updated, never deleted**:

- A new shared test helper, `src/state/testSupport/postBakeFlow.ts` (`walkPostBakeToResult`),
  commits the minimum required ideal cut lines and confirms — a no-op passthrough for any
  CUT-free recipe. Used by test files whose fixture is genuinely margherita-specific (Dex/
  Pitz/Efficiency/starter-grant assertions that need the real recipe).
  For test files that were only using margherita as a generic "any recipe" stand-in for
  something profile-unrelated, the profile itself is forced to `DEFAULT_COOKING_PROFILE`
  directly instead (matching those files' own existing "inject a fixture profile" pattern).
- **A real, independent latent bug this surfaced and fixed along the way:** two existing helper
  functions (`gameReducer.completionGate.test.ts`'s `playToResultForRecipe`,
  `gameReducer.scoringV2Authority.test.ts`'s own same-named helper) swapped in `recipe`/`order`/
  `pizza` directly but never re-resolved `cookingProfile` for the recipe actually being
  simulated — meaning every one of those `it.each(ALL_RECIPE_IDS)` cases was silently running
  against margherita's own (now CUT-enabled) profile regardless of which recipe id it claimed to
  test. Fixed by re-resolving `cookingProfile`/`cutState` from the actual `recipeId` in both
  helpers — a correctness fix, not merely a CUT accommodation.
- `App.test.tsx`'s own real end-to-end Lunch Rush tests (HOME → Lunch Rush → PREPARE → BAKE →
  「取り出す！」→ …) needed a real UI-level fix, not just a reducer-level bypass: a new
  `completeCutStepIfPresent(user)` helper performs 3 real pointer drags (the actual gesture, via
  `fireEvent.pointerDown/Move/Up`) and taps "切り終わる" whenever that button is present — a
  no-op for a repeat Lunch Rush order that happens to land on a different (CUT-free) recipe.

Full before/after list of touched files is in the PR diff; every one of the 15 recipes' own
regression status is additionally pinned directly in `src/data/cookingProfiles.test.ts` and
`src/state/gameReducer.cutStep.test.ts`.

## 15. Lunch Rush

Margherita is **not** excluded from Lunch Rush rotation — the architecture already handles it
correctly with zero CUT-specific code in `src/mission/lunchRush.ts`/`missionRunReducer` (CUT
introduces no second timer, `MissionServePanel`'s own `phase === "RESULT"` gate already defers
correctly). Verified end-to-end in `App.test.tsx`'s real Lunch Rush flows (PASS, FAILED, and
PASS-right-after-FAILED orders, two consecutive pizzas) and in
`gameReducer.cutStep.test.ts`'s "Lunch Rush serve exactly once" tests.

## 16. Tests

30/30 required scenarios covered, largely via real end-to-end paths (reducer + a real DOM
pointer-gesture harness) rather than synthetic dispatches alone:

| # | Scenario | Where |
|---|---|---|
| 1 | CUT-enabled CookingProfile resolves CUT postBake step | `cookingProfiles.test.ts`, `gameReducer.cutStep.test.ts` |
| 2 | non-CUT recipe remains no postBake step | `cookingProfiles.test.ts` |
| 3 | BAKE on CUT recipe → POST_BAKE/CUT | `gameReducer.cutStep.test.ts` |
| 4 | BAKE on normal recipe → RESULT | full existing regression suite (unchanged) |
| 5 | CUT state created fresh | `gameReducer.cutStep.test.ts` |
| 6 | pointer drag commits line | `PizzaStage.cutGesture.test.tsx` |
| 7 | pointer preview appears during drag | `PizzaStage.cutGesture.test.tsx` |
| 8 | pointercancel does not commit | `PizzaStage.cutGesture.test.tsx` |
| 9 | short drag/tap does not commit | `PizzaStage.cutGesture.test.tsx` |
| 10 | CUT inactive step cannot commit | `gameReducer.cutStep.test.ts` |
| 11 | first/second/third line progress | `gameReducer.cutStep.test.ts` |
| 12 | reset clears lines | `gameReducer.cutStep.test.ts` |
| 13 | recipe change clears lines | `gameReducer.cutStep.test.ts` |
| 14 | retry clears lines | `gameReducer.cutStep.test.ts` |
| 15 | ideal 3-line CUT confirm computes evaluation | `gameReducer.cutStep.test.ts` |
| 16 | CUT confirm → RESULT | `gameReducer.cutStep.test.ts` |
| 17 | CUT confirm finalizes perStepElapsedMs.CUT | `gameReducer.stepTiming.test.ts` (#11), `gameReducer.cutStep.test.ts` |
| 18 | pause boundary remains correct | `gameReducer.cutStep.test.ts`, full existing CT1/CT2 suite (unchanged) |
| 19 | CUT recipe BAKE does not REGISTER_TO_DEX | `gameReducer.cutStep.test.ts` |
| 20 | CUT confirm REGISTER_TO_DEX exactly once | `gameReducer.cutStep.test.ts` |
| 21 | double confirm cannot duplicate Dex registration | `gameReducer.cutStep.test.ts` |
| 22 | normal recipe BAKE Dex registration unchanged | full existing regression suite |
| 23 | Lunch Rush serve exactly once | `gameReducer.cutStep.test.ts`, `App.test.tsx` |
| 24 | Lunch Rush next order clears CUT state | `gameReducer.cutStep.test.ts` |
| 25 | save schema unchanged | `src/state/persistence.ts` untouched, `CURRENT_SCHEMA_VERSION` still 2 |
| 26 | Scoring 2.0 total unchanged by cutScore | `gameReducer.cutStep.test.ts` |
| 27 | Completion Gate unchanged | `gameReducer.cutStep.test.ts` |
| 28 | existing Cooking Steps regressions | full existing suite green |
| 29 | existing Step Timing regressions | full existing suite green |
| 30 | all current recipes/profile regression | `cookingProfiles.test.ts` |

New files: `src/state/gameReducer.cutStep.test.ts` (31 tests), `src/components/
PizzaStage.cutGesture.test.tsx` (6 tests), `src/state/testSupport/postBakeFlow.ts` (shared
helper, not a test file itself).

## 17. Browser verification

Dev server (`npm run dev`) driven by a standalone Playwright script (Chromium at
`/opt/pw-browsers`, no browser download) through the full production HOME → Pizza Select →
margherita → DOUGH → SAUCE → CHEESE → TOPPING → BAKE (confirmed inside the perfect zone,
`.cta-button--glow` polled for) → confirm → **POST_BAKE/CUT** → 3 real pointer drags → 「切り終わる」
→ RESULT, at both **390×844** and **360×800**.

- Cut lines commit and render (permanent, dark) exactly where dragged.
- Preview line + 🔪 cutter icon visible mid-drag, offset above the fingertip.
- Progress readout advances 0/3 → 1/3 → 2/3 → 3/3; "切り終わる" becomes enabled exactly at 3/3.
- Guide (angle lines + center dot) visible at CUT start, matching the design's fade contract.
- RESULT reached, showing the discovery banner ("マルゲリータを発見しました！"), funghi Starter
  Grant notice, Pitz credit, and the player's own cut lines still visible on the finished pizza
  (a nice side effect of reusing the same rendering unconditionally — matches "既存pizza visualを
  壊さない").
- **No horizontal overflow** at either viewport (`document.documentElement.scrollWidth <=
  clientWidth`, asserted programmatically).
- **Zero console errors/pageerrors** at either viewport, across the full walkthrough.
- Existing PREPARE screen (unrelated to CUT) screenshotted too, confirmed visually unchanged.

Screenshots saved to `docs/reports/screenshots/pizza-cutting-phase2/`: CUT start, 1-line,
3-lines, confirm-ready (390×844), RESULT (390×844), and a 360×800 3-lines shot for the secondary
viewport.

## 18. Save compatibility

Not touched. `src/state/persistence.ts` is untouched by this phase; `CURRENT_SCHEMA_VERSION`
stays `2`. `GameState.cutState` is never serialized anywhere (no persistence call site reads or
writes it) — exactly as transient as `pizza`/`cookingTiming` already are.

## 19. Scoring / Completion Gate compatibility

Not touched. `src/logic/scoringV2/*`, `src/logic/completionGate.ts`, `src/logic/pitzReward.ts`,
`src/logic/missionScoring.ts` are all untouched by this phase and are not imported by
`src/logic/cut/*` or by any of the CUT-specific reducer/UI code added here.
`cutState.evaluation`/`cutScore` are computed and stored but never read by `state.score`,
`scoringV2Result`, or `completion` — verified directly (`gameReducer.cutStep.test.ts` §26/§27).

## 20. Known risks

- **Pause boundary is PREPARE-only, unchanged** (§11) — if a future slice ever makes Dex/Shop/
  Inventory reachable mid-round again, `perStepElapsedMs.CUT` would no longer correctly exclude
  that pause span. Low-severity today since (a) no such UI path exists, and (b) CUT's own score
  never reads this value in this phase (§6.1 of the design doc).
- **No minimum-angular-separation duplicate-line gate** (§6) — a player who redraws the exact
  same cut twice gets two overlapping lines the geometry evaluator handles gracefully (tested in
  Phase 1) but which visually reads as one line. Flagged for Human Feel tuning, not a Phase 2
  gap per the task's own scope.
- **Piece-separation animation deferred** (design doc §8.3, Phase 4) — committed lines render
  flat, no visual wedge separation yet.
- **Guide-fade timing is a self-contained rAF loop, not keyed off `cookingTiming.perStepElapsedMs`
  directly** — deliberately, to avoid coupling CUT's decorative fade to a pause-sensitive clock
  this phase didn't extend to POST_BAKE (see the pause-boundary risk above); the visible fade
  timing is real-wall-clock, not pause-aware, which is a cosmetic-only gap.
- **Lunch Rush time-budget for CUT** (design doc §13, explicitly flagged there as a Phase 4
  product decision) is not re-litigated here — CUT is active in Lunch Rush per §15 above, with no
  new hard timer, but whether ~3-5 seconds of CUT interaction is the right cost inside a 180s run
  is still an open Human Feel question for a later phase.

## 21. Phase 3 handoff

Explicitly **not** built here (Phase 3's own scope, design doc §18):
- A dedicated CUT `cutScore`/`CutEvaluation` display on the RESULT screen (evaluation is computed
  and stored on `cutState.evaluation`, ready for Phase 3 to read and render — see
  `gameReducer.cutStep.test.ts`'s own evaluation assertions for its exact shape).
- A CUT debug panel (mirroring `ScoringV2DebugPanel`).
- Any Scoring 3.0 integration (`cutScore` stays fully standalone — §19).

---

## 22. Verification summary

- **Focused CUT tests:** `npx vitest run src/state/gameReducer.cutStep.test.ts
  src/components/PizzaStage.cutGesture.test.tsx src/data/cookingProfiles.test.ts` — 3 files,
  60/60 passed.
- **Full suite, run 1:** `npx vitest run` — 103 files, 1948/1948 passed.
- **Full suite, run 2 (determinism confirmation):** 103 files, 1948/1948 passed, identical
  count.
- **TypeScript typecheck:** `npx tsc -b` — clean, no errors.
- **Lint:** `npx oxlint` — clean, no warnings/errors.
- **Production build:** `npm run build` — succeeds; only the pre-existing >500kB single-chunk
  advisory (unrelated to this change, already noted in the Phase 1 report).

## 23. Fresh Merge Gate follow-up — main catch-up

Performed after `origin/main` advanced to `9bd5db7` (PR #121, Firebase Production Connection)
during this session:

1. `git fetch origin` — confirmed `origin/main` at `9bd5db7170347c2b31234f529b87564e691a444d`.
2. Open-PR/scope re-check: PR #121's diff (`.github/workflows/deploy.yml`, two docs files,
   `functions/src/index.ts`, `src/firebase/submitLunchRushScore.{ts,test.ts}`) — zero overlap
   with any file this phase touches.
3. `git merge origin/main --no-edit` — clean fast-forward (this branch had no commits of its own
   yet at merge time), zero conflicts.
4. Full re-verification (§22) re-run against the merged result — all green, including the +1 test
   PR #121 itself added (1948 → 1949 including that one; re-confirmed at 1948 the pass immediately
   before this commit, both runs identical to each other).

## Final Verdict

**Margherita's CUT step is fully wired, operable, and safely integrated into the real game flow**
— BAKE → POST_BAKE (CUT) → RESULT is now reachable end-to-end in production, gesture-driven,
with zero behavior change for the other 14 recipes (pinned exhaustively) and zero change to
Scoring 2.0/Completion Gate/save schema/Lunch Rush's own timer. Every required test scenario
(30/30) passes, full suite green ×2 post-merge, typecheck/lint/build clean, and a real browser
walkthrough at both target viewports reached RESULT with no console errors and no overflow. Not
merged — left open for independent review, per this task's own instruction. Phase 3 (Result
evaluation UI) and Phase 4 (Human Feel tuning + full rollout decision) are explicitly not started.
