# TETO Pizza Cutting 1.0 — Phase 4A Small Polish — Result Report

**Scope:** exactly the 3 items named in this task — (A) duplicate/near-duplicate cut line
prevention, (B) Lunch Rush `MissionServePanel` CUT feedback, (C) RESULT copy clarifying CUT score
is a separate evaluation from the total score/star rating. No recipe activation, no 4/8-slice
activation, no Scoring 3.0, no CUT-score integration into `state.score.total`, no Pitz/star/ranking
change, no economy/progression/save-schema/Firebase/workflow change.

## 0. Fresh Sync

- **Audited `origin/main` SHA:** `7d42f3129d0ae01a798e58a5e7f8172323c7bebb` (re-confirmed via
  `git fetch origin` both at session start and again after implementation — unchanged both times).
- **Branch:** `claude/pizza-cutting-phase-4a-k38cxg`, created directly at that tip (branch HEAD
  equaled `origin/main` HEAD exactly before any commit was made this session).
- **Authority read before implementation:** `docs/reports/TETO_PIZZA-CUTTING_Phase4_Human-Feel_Fresh-Audit.md`
  (this task's own named input) in full, plus current code: `src/logic/cut/{types,geometry,evaluation,state}.ts`,
  `src/state/gameReducer.ts` (CUT cases), `src/screens/GameScreen.tsx`, `src/components/{ResultPanel,
  MissionServePanel,PizzaStage}.tsx`, `src/App.tsx`'s CUT wiring, and the existing CUT test suite
  (`src/logic/cut/*.test.ts`, `src/state/gameReducer.cutStep.test.ts`,
  `src/state/gameReducer.cutResultDisplay.test.ts`). Nothing here found any drift between the Fresh
  Audit's own claims and current code — the three gaps it named (§5B/§5D/§11) were exactly as
  described.

## 1. Duplicate Gate #1 (before implementation)

`git fetch origin` + a full open-PR listing + a remote-branch scan for "cutting"/"duplicate
cut"/"angular separation"/"Lunch Rush CUT feedback"/"CUT result clarification": **zero results**
beyond the already-merged Pizza Cutting Phase 0–4 branches and this task's own new branch. Open PRs
at that time: #137 (Recipe Select 2.0 Phase 0, unrelated), #105 (draft, Dev Automation, unrelated),
#72/#46/#34/#3 (stale/superseded docs, unrelated). **No existing Phase 4A work found — clear to
proceed.**

## 2. Duplicate/near-duplicate cut line prevention

### Design

New pure geometry helpers in `src/logic/cut/geometry.ts` (no new module — this is the existing
home for `sidesOf`/`perpendicularDistanceFromCenter`, the same file family):

- `MIN_CUT_ANGULAR_SEPARATION_RADIANS = 15° in radians` — a single named constant (the design
  doc's own §2.2 "e.g. 15°" suggestion), never a magic number at any call site.
- `cutLineOrientationRadians(line)` — a line's orientation normalized to `[0, π)`. Reducing modulo
  `π` (not `2π`) is exactly what makes a line and its 180°-reversed reading (either end read as
  `start`) collapse to the identical value — the task's own "edge-to-edge diameter cut … 0° と
  180° = same orientation" requirement, verified directly by a dedicated test (§4 below).
- `isDuplicateCutLine(candidate, existingLines, minSeparationRadians)` — compares the candidate's
  orientation against every already-committed line's orientation, using center-relative
  orientation, **never raw endpoint pixel distance** (per the task's own explicit instruction).

**One shared rule, two enforcement points** (mirrors this codebase's own "gesture layer pre-checks,
reducer is the real backstop" pattern used everywhere else in CUT):

1. **Reducer backstop** (`src/state/gameReducer.ts`, `ADD_CUT_LINE` case): calls
   `isDuplicateCutLine` and no-ops (returns `state` unchanged, same reference) on a match — never
   trusts the UI alone, exactly like the existing cut-limit/edge-to-edge checks right next to it.
2. **Gesture-layer pre-check** (`src/App.tsx`, `handleAddCutLine`): calls the *same* function
   *before* dispatching, purely so a rejected line can show the player a short reason instead of a
   silent no-op. A rejected line is never dispatched at all.

### Threshold

`15°` — chosen because it comfortably clears the narrowest real spacing any shipped
`RequestedSliceCount` produces (60° between adjacent lines in the shipped 6-slice/3-line pattern;
even a future 8-slice/4-line pattern's 45° clears it by 3×), while still catching a genuine
"redraw almost the same line" mistake. Verified directly: a line 14° off an existing one is
rejected, a line 16° off is accepted (see tests, §4).

### Rejection UX

- The reducer's own rejection is silent (state unchanged) — matches the existing "reject at the
  source" convention for the cut limit/malformed-line checks already there.
- The user-facing feedback is a **local, App.tsx-only** transient message (never part of
  `GameState` — mirrors `pendingSauceDeposits`/`pendingDoughShape`'s own "mirrored up from a
  gesture, canonical state never sees it" pattern), shown as plain text below the progress
  readout: **「同じ位置には切れません」**, auto-clearing after 1.8s or immediately on leaving/
  re-entering the CUT step (whichever comes first). Rendered with `role="status"` so a screen
  reader announces it the same moment a sighted player sees it — never color-only, per this task's
  own Accessibility/Touch requirement.
- Rejected: `cutState.lines` unchanged, `cutState.evaluation` unchanged (never invalidated by a
  no-op), undo history untouched, pointer capture unaffected (the gesture's own `pointerup`
  handling completes normally either way — only the CUT-specific dispatch is skipped).

## 3. Duplicate Cut Line Tests

**Pure unit tests** (`src/logic/cut/geometry.test.ts`, `cutLineOrientationRadians`/
`isDuplicateCutLine` describe blocks, 12 new tests):
- 0° and its own reversed-endpoint reading collapse to the identical orientation.
- Swapping `start`/`end` never changes orientation.
- A degenerate (zero-length) line returns `0`, never `NaN`.
- Exact duplicate rejected; reversed-endpoints duplicate rejected; a 5°-off near-duplicate
  rejected; a line exactly 1° past the threshold accepted; a line exactly 1° inside it rejected.
- A normal 3-line/6-slice pattern (60° apart) never flags any of its own lines as a duplicate of
  another.
- Wraps correctly across the 0/π boundary (178° and 2° are close, not far apart).
- An empty `existingLines` list never flags anything.

**Reducer integration tests** (`src/state/gameReducer.cutStep.test.ts`, new "10c" describe block,
8 new tests, run through the real `ADD_CUT_LINE`/`UNDO_CUT_LINE` actions against margherita's
production `CookingProfile`):
- Exact duplicate rejected (same state reference).
- Reversed-endpoints duplicate rejected.
- Near-duplicate (5°) rejected.
- A line just outside the threshold accepted (`lines.length` grows to 2).
- A normal 3-line/6-slice pattern entirely unaffected by the gate.
- A rejected duplicate never increments `cutState.lines.length`.
- Undo after a rejected duplicate attempt still removes exactly the last **real** line, leaving
  the correct earlier line intact.
- `cutState.evaluation` is byte-identical whether or not rejected duplicate attempts happened in
  between — deterministic regardless of how many rejected attempts occurred.

**Pre-existing test fixture adjustment (required, disclosed):** two already-merged tests in
`src/state/gameReducer.cutResultDisplay.test.ts` used a tightly-clustered (3–6°) near-duplicate
angle as their own "uneven cut" fixture for testing low-uniformity scoring — a pattern this
phase's own new duplicate gate now correctly rejects before it ever reaches evaluation. Both
fixtures were widened to 18°/36° spacing (still clustered relative to the ideal 60° spacing,
producing the same intended low-uniformity/low-`centerAccuracy` result) — clearing the new 15°
gate while preserving each test's own original intent byte-for-byte. Verified: both tests still
pass with their original assertions unchanged.

**Full new/changed test count this phase:** 12 (geometry) + 8 (reducer) + 2 (adjusted fixtures,
assertions unchanged) = 22 tests touched, all passing.

## 4. Lunch Rush CUT Feedback

`src/components/MissionServePanel.tsx` gained one new prop, `cutEvaluation: CutEvaluation | null`
— wired from `state.cutState.evaluation` in `GameScreen.tsx` (the exact same value FREE's own
`ResultPanel` already reads, no new evaluation logic). Rendered only on the **PASS** branch (never
the FAILED card, which stays deliberately minimal), only when non-null (never for a non-CUT
recipe or an unconfirmed CUT), as one compact line between the score and the "+1 SERVED" line:

```
✂️ カット 100点（6切れ）
```

Score + slice count only — no uniformity/center-accuracy breakdown (FREE's own
`.cut-evaluation-summary` already has that detail for a player who wants it; Lunch Rush's own
tempo requirement is "don't overload, don't stall"). **Display only** — `cutEvaluation` is read,
never summed into `score`/`servedCount`/anything ranking-relevant; `MissionServePanel.tsx` has no
mechanism to do that even if it wanted to (`../logic/cut/*` has zero imports into
`scoringV2`/`missionScoring`/`lunchRushScoring`).

Verified live (§7): the Mission clock (`⏱ 2:53` after a ~7s CUT interaction from a 3:00 start)
keeps ticking exactly as before — CUT's own time cost is unchanged, only its *acknowledgement* is
new.

## 5. RESULT Clarification

`src/components/ResultPanel.tsx`'s existing `.cut-evaluation-summary` card gained one new line,
directly below the slice-count row:

```
✂️ カット 100点
6等分
※総合スコアとは別の評価です
```

Copy-only — no score/star/weight change, no CUT-score integration. Styled smaller/muted
(`.cut-evaluation-summary__note`, 10.5px, muted blue) so it reads as a footnote, not a second
headline. Verified live (§7) directly against the Fresh Audit's own named scenario — a
`★★☆☆☆ 50点` overall result sitting next to `カット 100点` — the note now sits immediately below,
resolving the "100点なのになぜ総合50点？" ambiguity the audit flagged, with zero layout overflow
at either viewport.

## 6. Score/Star/Pitz/Ranking Unchanged — Proof

- No file under `src/logic/scoringV2/`, `src/logic/pitzReward.ts`, `src/logic/mastery.ts`,
  `src/mission/lunchRushScoring.ts`/`src/shared/lunchRushScoring.ts`, `src/state/persistence.ts`,
  or any Firestore/`functions/` file was touched — `git diff --stat` (§9) confirms the changed-file
  list is exactly the 13 files this phase's own scope requires, nothing else.
- `src/state/gameReducer.cutResultDisplay.test.ts`'s own pre-existing "CUT time never influences
  cutScore" and "non-CUT recipes never populate `cutState.evaluation`" tests still pass unmodified
  in assertion (only two fixtures' input angles were widened, per §3 above) — confirming this
  phase introduced no scoring-authority drift.
- `gameReducer.cutStep.test.ts`'s own pre-existing "26. Scoring 2.0 total is never perturbed by
  cutState/cutScore" test (`state.score.total` byte-identical with/without CUT lines) still
  passes, now additionally proven robust to rejected duplicate attempts by the new "evaluation is
  deterministic" test in §3.
- `MissionServePanel`'s new `cutEvaluation` prop is read-only display; `score`/`servedCount`
  parameters and their downstream `SERVE`/ranking dispatch are untouched.

## 7. Visual Verification

Real browser (Chromium via Playwright, dev server), both required viewports.

**Authority (390×844):**
- FREE margherita: CUT start → exact-duplicate rejection (feedback shown, line count unchanged) →
  reversed-endpoint-duplicate rejection → near-duplicate (5°) rejection → 3 normal lines accepted
  (60° apart) → confirm → RESULT with CUT card + new clarification note. Zero console/page errors,
  zero horizontal overflow (`scrollWidth <= clientWidth`, asserted programmatically).
- Lunch Rush margherita: order → PREPARE → BAKE → CUT (mission clock visibly ticking, `2:53` after
  a real interaction) → 3 lines → confirm → `MissionServePanel` now shows
  `✂️ カット 100点（6切れ）`, no ranking/score change, tempo preserved (one tap flow, no extra
  screen).
- Non-CUT (funghi, unlocked after a real, PASS margherita discovery): BAKE → RESULT **directly**,
  zero POST_BAKE/CUT step, `切り終わる`-button count 0, `.cut-evaluation-summary` count 0,
  `.cut-rejection-feedback` count 0 — byte-identical regression behavior to before this phase.
- Undo correctness: 2 real lines drawn, a near-duplicate rejected, `1本戻す` tapped — exactly the
  2nd real line removed, the 1st intact (confirmed by successfully redrawing the 2nd line's own
  angle afterward with no rejection).

**Secondary (360×800):** all four scenarios above re-run in full — identical outcomes, zero
overflow, zero console errors, CUT card/note/rejection feedback all fully legible with no
clipping.

Screenshots saved to `docs/reports/screenshots/pizza-cutting-phase4a/` (27 images, both
viewports) — before/after-style coverage of every scenario listed above (`0X-…` = FREE margherita
walkthrough including duplicate rejection, `1X-…` = Lunch Rush, `19/2X-…` = margherita-discovery→
funghi non-CUT regression, `undo-before/after` = undo correctness).

## 8. Accessibility / Touch

- Rejection feedback is **plain text**, never color-only (red text is a secondary cue, the
  Japanese sentence itself carries the meaning) — rendered with `role="status"` so a screen reader
  announces it immediately, same moment a sighted player sees it.
- No pointer-capture change: the gesture layer's own `pointerup` handling completes identically
  whether the resulting line is accepted or rejected — only the reducer dispatch is skipped on
  rejection, so touch/pointer capture behavior for the *next* gesture is unaffected.
- Touch target sizing for the undo/confirm buttons is untouched (no CSS change to
  `.secondary-button`/`.cta-button`).

## 9. Tests / Typecheck / Lint / Build

- **Focused tests:** `npx vitest run src/logic/cut/geometry.test.ts src/state/gameReducer.cutStep.test.ts`
  → 72 passed. `npx vitest run src/state/gameReducer.cutResultDisplay.test.ts` → 9 passed (2
  fixture angles widened per §3, assertions unchanged).
- **Full root suite:** `npm test` → **109 test files, 2066 tests, all passed.**
- **Typecheck:** `npx tsc -b` → clean, zero errors (three `GameScreen.*.test.tsx` files needed a
  new required `cutRejectionMessage={null}` prop added — done).
- **Lint:** `npx oxlint` → clean, zero warnings (one intermediate `react(refs)`/
  `react(set-state-in-effect)` warning pair surfaced during development and was fixed by moving
  the rejection-message reset into the existing render-phase `lastMakingStep` block and keeping
  only the ref's own timeout cleanup — with no `setState` call — inside its effect).
- **Build:** `npm run build` (`tsc -b && vite build`) → succeeds (pre-existing >500kB chunk-size
  advisory only, unrelated to this change).
- `functions/`/Firestore emulator: not touched, not run (no shared-dependency file was changed).

**Changed files (13, `git diff --stat` against `origin/main`):**
```
src/App.css                                      |  37 ++++
src/App.tsx                                      |  56 +++++
src/components/MissionServePanel.tsx             |  28 ++-
src/components/ResultPanel.tsx                   |   7 +
src/logic/cut/geometry.test.ts                   |  81 ++++++
src/logic/cut/geometry.ts                        |  61 +++++
src/screens/GameScreen.keyboardOverlay.test.tsx  |   1 +
src/screens/GameScreen.keyboardSpreadRepeat.test.tsx |  1 +
src/screens/GameScreen.physicalDragOverlay.test.tsx  |  1 +
src/screens/GameScreen.tsx                       |  14 ++
src/state/gameReducer.cutResultDisplay.test.ts   |  16 +-
src/state/gameReducer.cutStep.test.ts            | 106 ++++++++
src/state/gameReducer.ts                         |   8 +
```
Plus 27 new screenshot files under `docs/reports/screenshots/pizza-cutting-phase4a/` and this
report itself.

## 10. Duplicate Gate #2 (after implementation)

Re-ran, before opening the PR: `git fetch origin` → `origin/main` still `7d42f312…`, unchanged
from §0/§1. Open PRs unchanged from §1's own listing — no new PR, branch, or Issue touching Pizza
Cutting/CUT/duplicate-line/Lunch-Rush-CUT-feedback/RESULT-clarification appeared during this
session's implementation window. `git diff --stat`/`git status --porcelain` re-confirmed: exactly
the 13 source files above plus the screenshots/report — zero Firebase file, zero workflow file,
zero save-schema file, zero recipe-catalog file touched.

## 11. Known Limitations

- The 15° threshold is a reasoned choice (design doc's own suggestion, verified not to interfere
  with any shipped slice-count pattern) but, like every other CUT gesture constant, has not been
  validated against a real human's imprecise drag — only scripted/idealized geometry (this
  phase's own testing, like every prior CUT phase's, cannot close that gap; Phase 4B's own
  planned real playtest, named in the Fresh Audit, remains the right venue for it).
- The rejection message's 1.8s auto-clear duration is a reasonable default, not independently
  Human-Feel-tuned against real play.
- `MissionServePanel`'s CUT feedback intentionally omits uniformity/center-accuracy detail (by
  design, for tempo) — a player who wants the full breakdown still only gets it in FREE's own
  RESULT screen, never in Lunch Rush; this is the deliberate scope boundary this task set, not an
  oversight.
- Per this task's own explicit Stop Conditions, no CUT-enabled recipe was added, no 4/8-slice
  config was activated, and no scoring/star/Pitz/ranking calculation was touched.

## 12. Next Recommendation

Per the Fresh Audit's own Phase 4 plan (§16), the next slice this repo's own roadmap already names
is **Phase 4B — a real (non-scripted) human playtest** targeting whether 6-slice difficulty is
well-calibrated and whether a bad cut genuinely invites retry — the one thing no further
code-writing phase (this one included) can substitute for. Recipe activation (Phase 4C) and
Scoring 3.0 remain explicitly downstream of that playtest, unchanged from the Fresh Audit's own
recommendation.
