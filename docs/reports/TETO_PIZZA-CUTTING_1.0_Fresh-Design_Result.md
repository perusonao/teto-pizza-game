# TETO Pizza Cutting 1.0 — Fresh Design Result Report (Phase 0, docs-only)

**Audited SHA:** `8d6109b6e5be3a709f8b77d506bf75b1fe6984b7` (`origin/main`, PR #122 "Recipe Cooking
Steps 1.0 Phase 0" merged). This branch (`claude/pizza-cutting-phase0-v7hwm2`) was fast-forwarded
onto that SHA before any of this session's design work was written.

**SSOT design document:** `docs/design/TETO_PIZZA-CUTTING_1.0.md` (companion to this report — full
detail for every claim summarized below lives there). Built directly on top of
`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` (merged, PR #122) — not a re-derivation of it.

## 1. Duplicate Gate — result

Run at session start (`git fetch origin`, full open-PR list, full remote-branch list) and
re-confirmed complete (no `src`/`functions` diff exists in this session, see §8):

- **`origin/main` HEAD:** `8d6109b` (Cooking Steps Phase 0 merge, PR #122). This session
  fast-forwarded its branch onto it (previously at `bdc0be3`).
- **Open PRs (6 total):** #121 (Firebase Production Connection — explicitly out of scope, untouched
  by this task), #105 (Dev Automation A1), #72, #46, #34, #3 — none overlap cutting/CUT/POST_BAKE/
  cooking-steps scope.
- **Remote branches matching `cut|slice|post-bake|postbake|cooking-step`:**
  `claude/teto-pizza-issue-47-slice-a-gr621p`, `...slice-b-24m8yr`, `claude/teto-recipe-cooking-steps-audit-caq0tq`
  (the source branch for the now-merged PR #122), `claude/teto-result-2-slice-1-e6m42f`,
  `claude/teto-slice2-feedback-audit-l0kzbq` — all either merged/superseded ("slice" here is this
  repo's own implementation-increment jargon, not a pizza-slicing feature, confirmed by reading each
  branch's own commit log) or the already-merged Cooking Steps source branch. **No open PR or
  branch of matching Pizza-Cutting scope exists.**
- **PR #122 itself** (`mcp__github__search_pull_requests`, full body read) confirms its own
  duplicate gate ran clean twice and explicitly hands off to "the currently-stopped Pizza Cutting
  Architecture design session" — i.e. this one — as its own intended continuation (design doc §20).

**Verdict: clear to proceed.** No re-opening, no conflict, no re-doing of already-merged work.

## 2. Files / documents audited

**Merged SSOT (read in full):** `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` (889 lines, all 23
sections incl. the Step Timing Architecture §22), `docs/reports/TETO_RECIPE-COOKING-STEPS_Phase0_Result.md`
(227 lines).

**Production code (read directly, confirmed byte-identical between `bdc0be3` and `8d6109b` via
`git diff --stat` on `src/`/`functions/` — the Cooking Steps PR was itself docs-only, so this
session's earlier code audit at `bdc0be3` remains accurate at current `main`):**
`src/state/gameReducer.ts`, `src/state/pizzaState.ts`, `src/logic/doughShape.ts`,
`src/logic/pizzaCoordinates.ts`, `src/logic/completionGate.ts`, `src/logic/scoringV2/{index,types}.ts`,
`src/screens/GameScreen.tsx`, `src/components/{BakeOverlay,PizzaStage}.tsx`,
`src/logic/missionScoring.ts`, `src/mission/lunchRush.ts`, `src/firebase/submitLunchRushScore.ts`,
`src/App.tsx` (specifically `handleConfirmBake`'s orchestration — see design doc §12), `src/App.css`
(viewport authority, `.prepare-bake-bar`/`.pizza-dough` sizing, safe-area conventions).

## 3. Technical feasibility

**Feasible, low-risk, no new architecture class needed.** Every load-bearing piece of this design
reuses an existing, already-shipped pattern in this codebase:

- The CUT gesture (design doc §2) is the *same* pointer-capture architecture `PizzaStage.tsx`
  already implements three times (sauce dispense, DOUGH stretch, topping drag/tap) — a fourth
  branch, not a new pointer system.
- The geometry approach (grid-sampling, §4) needs no segment-intersection/polygon-clipping code at
  all, because every committed cut line is, by gesture-design construction, already a full
  rim-to-rim chord (`clampToDough`, reused unchanged).
- The guide-fade visual (§8.2.1) reuses `logic/bakeGuideFade.ts`'s existing curve, not a new fade
  mechanic.
- Persistence (§10), Step Timing (§9), and Completion Gate (§7) integration all adopt the Cooking
  Steps SSOT's own already-committed policies unchanged, rather than opening new questions.

The one real risk this audit surfaces that wasn't already flagged elsewhere: **`App.tsx`'s
`REGISTER_TO_DEX`/mission-serve orchestration currently fires unconditionally right after
`CONFIRM_BAKE`, assuming it always lands on `phase: "RESULT"`** — once `CONFIRM_BAKE` can land on
`POST_BAKE` instead, that call site must move to fire when the round *actually* reaches `RESULT`
(design doc §12). This is a small, mechanical relocation, not a redesign, but it is exactly the
kind of detail worth naming before implementation starts rather than after a CUT Phase 2 regression
surfaces it.

## 4. Recommended architecture (summary)

| Area | Recommendation |
|---|---|
| Flow | `BAKE -> POST_BAKE -> RESULT`, per the merged Cooking Steps SSOT, unchanged. `FINISH` before `CUT` when both apply (design doc §1.1), matching the SSOT's own §5 walkthrough table. No CUT-specific state machine. |
| Gesture | **A. Edge-to-edge drag** (design doc §2) — reuses `PizzaStage`'s existing pointerdown/move/up/cancel architecture verbatim; rim-clamped commit via existing `clampToDough`. |
| Slice count | **Ship 6 only in Phase 1** (§3). `CutConfig.requestedSliceCount` is already a general per-recipe field — 4/8 are free additions later, not rebuilds. |
| Geometry | **Deterministic grid-sampling** (§4.2, the brief's own candidate D) — a fixed grid, chord-side classification per sample point, no segment-intersection/DCEL code. Scored against the recipe's *ideal* circle (`DOUGH_CENTER`/`DOUGH_RADIUS`), not the player's D3A-distorted dough silhouette — same existing precedent Scoring 2.0's own Sauce component already uses. |
| Evaluation | Count correctness, completeness, center accuracy, and piece-area uniformity (§5) — all four real, uniformity computed from the actual sampled piece areas, never assumed. |
| CUT score weighting | **B — uniformity-heavy** (uniformity 50 / completeness 20 / count 20 / center 10), §6. Time never an input in Phase 1 (§6.1) — Quality-primary/Time-secondary preserved by construction, matching Cooking Steps SSOT §22.6/§22.7. |
| Completion Gate | **A — score-only, never gates completion** (§7) — this is not actually a new decision: the merged Cooking Steps SSOT already committed to `requiredForCompletion: false` for CUT (its own §6/§11); this design adopts it unchanged and confirms it's independently correct for CUT specifically. |
| Scoring 2.0 integration | **D — standalone display in Phase 1; integrate via the SSOT's own already-designed core+bonus mechanism in a later, separately-scoped Scoring 3.0 slice** (§14). `state.score.total` stays byte-identical through all of CUT Phase 1–4, for every recipe. |
| Step Timing | Adopts Cooking Steps SSOT §22 unchanged. `perStepElapsedMs.CUT` recorded (once Phase 1A-T ships), never scored in Phase 1. No dual timeout in FREE or Lunch Rush. |
| Persistence | **No save-schema change.** CUT working data is exactly as transient as `sauceDeposits`/`toppings` already are. A future replay-from-coordinates extension boundary is named (§10), not designed; no image/blob storage proposed. |
| Lunch Rush | No scoring change (§14 makes this true by construction). A real rollout-timing risk (CUT costs new seconds inside `MissionClock`) is named and deliberately deferred to CUT Phase 4's own Activation decision (§13), not solved by guessing here. |

## 5. Recommended first implementation slice

Per design doc §17/§18: **Cooking Steps Phase 1A and Phase 1A-T must land first** — this is a hard
dependency, not a suggestion, and this design explicitly rejects building CUT's gesture/reducer/UI
ahead of or bypassing that foundation (the exact failure mode the Cooking Steps audit itself exists
to prevent).

What *can* start immediately, in parallel with Phase 1A/1A-T landing: **CUT Phase 1 — Geometry +
transient state** (`src/logic/cut/{types,geometry,evaluation}.ts`, pure functions, full unit
coverage per design doc §15.1/§15.2). This has no runtime dependency on `MakingStep`/`POST_BAKE`
existing yet — only a `CutLine[]` type and `requestedSliceCount` — but does need `MakingStep`'s
`"CUT"` literal type to exist for later slices to type against cleanly, so is still sequenced as
"parallel-authorable, not parallel-mergeable ahead of 1A."

## 6. Save impact

**None.** Confirmed at both the Cooking Steps SSOT level (§15/§22.8 of that document) and
independently re-confirmed here for CUT's own specific data (design doc §10): `PersistentSaveV2`
has no serializer for `GameState`/`PizzaState` today, and CUT's `cutLines`/`CutEvaluation` are
designed to live entirely within that already-transient shape. No schema version bump required or
proposed at any point in the CUT Phase 1–4 roadmap.

## 7. Lunch Rush impact

**None in Phase 1–4 as designed** (`state.score.total`/`missionScore`/`LunchRushServeRecord` all
stay byte-identical, §14) — but a real product/timing risk is named, not hidden: CUT costs new
wall-clock seconds inside the single fixed `MissionClock` the moment any real recipe carrying a
CUT-enabled profile is Activated, since `CookingProfile` is keyed by recipe, not by mode, and Mission
reuses the same round machinery FREE does (design doc §13). Recommendation: CUT Phase 1–3 ship with
zero recipes Activated; the Activation decision itself (CUT Phase 4) is made only after real
device/Playwright timing data exists, and is explicitly part of the Human Feel Gate (design doc
§16's own added Lunch-Rush-specific check).

## 8. Firebase impact

**None proposed or required.** No `functions/src/**` change, no `LunchRushServeRecord` shape
change, no new trust-boundary surface (design doc §14 makes this true by construction — CUT never
enters any server-recomputed aggregate in this design). PR #121 (Firebase Production Connection)
was not read for content changes, not touched, and not merged by this task.

## 9. Blockers

None for *this* Phase 0 task (design-only, complete). For the next implementation slice: Cooking
Steps Phase 1A and Phase 1A-T are hard prerequisites (§5/§17 of the design doc) — not blocking this
Fresh Design, but blocking any code-writing slice that follows it.

## 10. Risks (carried forward from the design doc, consolidated)

- **Scope creep into building CUT ahead of Cooking Steps Foundation** — mitigated by making that
  dependency explicit and non-optional (design doc §17), matching the Cooking Steps SSOT's own risk
  mitigation for the analogous concern one level up.
- **The `REGISTER_TO_DEX` orchestration relocation (§12) being missed during CUT Phase 2** —
  mitigated by naming it explicitly here and giving it its own dedicated regression test in the
  testing strategy (design doc §15.3).
- **CUT's near-universal nature making a Scoring 2.0 integration decision higher-stakes than a
  single-recipe step like FOLD would be** — mitigated by recommending standalone display (Option D)
  through the entire CUT Phase 1–4 roadmap, deferring any `state.score.total` change to a
  separately-scoped, separately-reviewed Scoring 3.0 slice.
- **Lunch Rush time-budget impact once CUT is Activated on a real, Mission-reachable recipe** —
  named explicitly (§13/§16), deliberately deferred to CUT Phase 4 with real data rather than
  guessed at now.
- **Weighting/constant tuning (§6, §8.2, §8.4) turning out wrong on first contact with a real
  finger** — mitigated by marking every numeric constant in this design explicitly provisional,
  matching this repo's own established "tunable during Human Feel" convention, and by scoping a
  dedicated CUT Phase 4 for exactly that tuning pass plus the mandatory Human Feel Gate (design doc
  §16) before any Activation.

## Final Verdict

**A. READY FOR PHASE 1.**

This Fresh Design resolves every comparison the brief asked for with a specific, justified
recommendation (not a menu left open) — gesture (edge-to-edge drag), slice count (6 only, first),
geometry (deterministic grid-sampling), evaluation weighting (uniformity-heavy), Completion Gate
policy (adopts the already-merged SSOT decision), and Scoring 2.0 integration timing (standalone
now, Scoring 3.0 later) — while deliberately keeping every one of those recommendations reversible
at low cost (data-driven slice counts, pure-function geometry with no UI dependency, a scoring
integration point that's designed but not yet activated). It builds strictly on top of the merged
Cooking Steps 1.0 foundation rather than duplicating or bypassing it, names its one real
hand-off risk (`REGISTER_TO_DEX` orchestration, §12) explicitly rather than leaving it to be
rediscovered mid-implementation, and defines a Human Feel Gate that keeps "mathematically correct"
and "actually fun" as two separately-required bars, per the brief's own instruction. No blocking
open product decision exists for CUT Phase 1 itself (blocking questions — Lunch Rush time budget,
Scoring 3.0 timing, which recipe(s) to Activate — are already correctly deferred to CUT Phase 4 and
beyond, not silently assumed).
