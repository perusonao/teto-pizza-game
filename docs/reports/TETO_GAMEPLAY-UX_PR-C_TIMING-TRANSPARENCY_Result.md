# Gameplay UX PR-C: Timing Transparency — Result Report

Status: **Implementation complete**, pending external Merge Gate review (per this task's own
instruction, do not auto-merge).

Umbrella: #176 (Gameplay UX / Scoring 3.0). Child Issue: #184. Base `main` SHA:
`70d85b4034f3b69f8902cce5e2cf319e9bca274d` (PR #181, "Gameplay UX PR-D: RESULT 1-Screen 2.0",
merged — this session's own branch was created directly from that exact commit, confirmed via
`git merge-base`/`git rev-parse` at session start). Branch: `claude/timing-transparency-gtqq6t`.

---

## 1. Fresh Start

- `git fetch origin` at session start: `origin/main` HEAD = `70d85b4` (PR #181 merged, matches
  the task prompt's own stated "直前完了"). Working tree clean.
- Open Issues re-confirmed: #176 (umbrella, open, this PR's own parent). No other open issue
  overlapped this scope.
- Open PRs re-confirmed at session start: none touching timing/cooking-time/RESULT scope. #177
  (Fresh Audit), #179 (PR-A Dynamic Steps), #181 (PR-D RESULT 1-Screen 2.0) all already merged.
- This branch (`claude/timing-transparency-gtqq6t`) was already checked out at exactly
  `origin/main`'s tip at session start — no rebase needed.

## 2. Duplicate Gate #1 (task start)

Searched open issues/PRs for: "Timing Transparency", "cooking time", "step timing", "elapsed
time", "efficiency", "手際", "調理時間", "Result timing", "timing breakdown", "MissionClock".

**No open issue or PR covered this scope.** #176 is the umbrella (parent context, not a
duplicate). Conclusion: proceed, create child Issue #184 under #176 (done, see below).

## 3. Duplicate Gate #2 (immediately before push)

- `git fetch origin main`: `origin/main` unchanged, still `70d85b4034f3b69f8902cce5e2cf319e9bca274d`.
- Re-searched open issues/PRs: one new item appeared since session start — **Issue #182 /
  PR #183** ("Progression 2.0: PIZZA DB全量を基準にレシピ発見・材料アンロックを再設計" /
  "Progression 2.0 Phase 0: Fresh Audit"). Confirmed **unrelated scope** (recipe discovery/
  unlock progression, not cooking time/timing/RESULT display) — no overlap, no fold-in needed.
- No rebase needed (base unchanged).

## 4. Fresh Timing Audit (re-verified against latest `main`, not just the prior Fresh Audit doc)

The task's own §4 instruction is to re-verify current code, since the Fresh Audit doc
(`docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md`, audited at an older SHA before PR-A/
PR-D landed) could be stale on exactly this point. Re-reading `src/logic/cookingTiming.ts`,
`src/logic/efficiency.ts`, `src/components/ResultPanel.tsx`, `src/data/cookingProfiles.ts`, and
`src/state/gameReducer.ts` at this session's own base SHA found one **load-bearing fact the prior
audit's summary undersold**: the total elapsed time (`調理時間`) and the 手際 tier were **already
being rendered** on RESULT before this PR — inside `.pitz-credit-summary__breakdown`'s collapsed
`<details>` (`efficiencyCredit.cookingTimeMs`/`.tier`, via the pre-existing `formatCookingTime`/
`EFFICIENCY_TIER_LABEL_JA`). What was genuinely missing, confirmed by code-reading (not assumed
from the older doc):

1. **No Tier 1 (always-visible) elapsed-time line** — 調理時間/手際 were buried inside Pitz's own
   collapsed breakdown, not their own standalone summary.
2. **No per-step breakdown table anywhere** — `CookingTimingState.perStepElapsedMs` (already
   computed, already persisted through to RESULT/DISCOVERED phase state, confirmed by tracing
   `state.cookingTiming` through every `gameReducer.ts` phase transition) was read by **zero**
   production UI code.

### A. What is measured

`cookingTiming.ts`'s `CookingTimingState`:
- `completedMs` — whole-round active-PREPARE elapsed (pause-aware), finalized once at
  `START_BAKE`, never re-touched.
- `perStepElapsedMs: Partial<Record<MakingStep, number>>` — per-step elapsed, finalized at every
  step boundary (`advanceStepTiming`, called at `CONFIRM_MAKING_STEP` and at the PREPARE→BAKE and
  BAKE→POST_BAKE edges). Absence (not `0`) means "not measured yet."

### B. Timer start point

`BEGIN_PREPARE` (or an equivalent fresh-PREPARE entry: `SELECT_RECIPE`, `RETRY_SAME_RECIPE`) —
`startCookingTiming(now, initialStep)`.

### C. Timer end point

Whole-round `completedMs`: finalized at `START_BAKE` (`finishCookingTiming`), **excludes BAKE**.
Per-step `perStepElapsedMs`: each step finalizes at its own `advanceStepTiming` boundary; the
*last* step to finalize is whichever POST_BAKE step is last (CUT, for all 15 CUT-eligible
recipes) — finalized the instant `phase` becomes `"RESULT"` (`gameReducer.ts`'s `CONFIRM_BAKE`
case, `advanceStepTiming(state.cookingTiming, action.now, null)`).

### D. PREPARE per-step elapsed

DOUGH/SAUCE/CHEESE/TOPPING each get their own `perStepElapsedMs` entry, keyed by `MakingStep`,
present only for a step the round's own derived `CookingProfile.steps` actually includes (PR-A's
`deriveCoreSteps` — a recipe with no required cheese/topping ingredient never has that step at
all, so it structurally never appears in `perStepElapsedMs` either).

### E. BAKE

**Not measured as a step at all** — BAKE is not a `MakingStep` value; it has its own separate
needle-tap minigame scored independently by Scoring 2.0's Bake component. `perStepElapsedMs` has
no BAKE key, ever, by construction. This PR's Timing Detail table therefore never has (and never
needs an explicit exclusion for) a BAKE row — confirmed structurally impossible, not just
"we chose not to show it."

### F. CUT

**Measured** (`perStepElapsedMs.CUT`, for every CUT-eligible recipe — all 15 shipped recipes)
but **excluded from the whole-round `completedMs`/手際 total** — `completedMs` finalizes at
`START_BAKE`, strictly before CUT (a POST_BAKE step) ever starts. This PR displays CUT's own
per-step time as its own row (since it *is* real, measured data), with an explicit disclaimer
("※「調理時間」にカットの時間は含みません") so it is never misread as already summed into the
Tier 1 headline number. **No change to `completedMs`'s formula, the 手際 tier thresholds, or CUT
scoring** — confirmed via `git diff --stat`, zero lines changed in `cookingTiming.ts`,
`efficiency.ts`, or `src/logic/cut/**`.

### G. FREE

Efficiency/timing is FREE-only by construction (`evaluateCookingEfficiency` gated
`!state.isMissionRound`); this PR's own new UI (`ResultPanel.tsx`'s `.cooking-timing-summary`)
renders only when `efficiencyCredit` is non-null, which is `null` for every Mission round —
**the same existing gate, no new gate added.**

### H. Lunch Rush

`state.lastEfficiencyCredit`/`cookingTiming` are never populated for a Mission round; Lunch
Rush's own `MissionResultOverlay` is an architecturally separate component that never imports
`ResultPanel.tsx` at all. Fresh-confirmed via real E2E (Scenario E, both this PR's own spec and
the pre-existing `result-1screen-2.0.spec.ts`'s own Lunch Rush regression): `.cooking-timing-
summary` never renders anywhere inside `.mission-overlay`. **No FREE Timing UI change was needed
in Lunch Rush** — its own MissionClock/RESULT semantics are provably untouched (`git diff --stat`
shows zero changes to `src/mission/**`, `MissionResultOverlay.tsx`, `MissionServePanel.tsx`,
`missionScoring.ts`).

### I/J. What was (and now is) passed to/persisted into RESULT

`state.cookingTiming` (the *entire* `CookingTimingState`, including `perStepElapsedMs`) was
already carried, unmodified, through `RESULT`/`DISCOVERED` phase transitions before this PR (a
pre-existing fact, not something this PR added) — confirmed by tracing every `gameReducer.ts`
phase-transition case. This PR's only *new* wiring is a pure derivation
(`stepTimingRows(state.cookingProfile.steps, state.cookingTiming?.perStepElapsedMs)`,
`src/logic/cookingTimingDisplay.ts`) computed in `GameScreen.tsx` and passed as a new
`ResultPanel` prop — no new state field, no new persistence, no schema change.

### K. Pitz-relevant time

`efficiencyCredit.cookingTimeMs` (== `completedMs`) is what `calculateEfficiencyBonus` already
reads — **unchanged by this PR**.

### L. Efficiency rank formula

`comfortableMs = 25_000 + 3_000 × totalRequiredItemCount(recipe)`, `normalUpperMs = comfortableMs
+ 35_000` — re-confirmed byte-identical in `src/logic/efficiency.ts` at this session's base SHA.
**Not changed by this PR** (scope guard §14 forbids it) — this PR only *displays* the already-
computed tier label, never the raw threshold numbers themselves (per the task's own explicit
"do not show a target/threshold number" instruction, §9).

## 5. FREE Timing Transparency — what shipped

**Tier 1** (always visible, no tap required): a compact single-line `<summary>` headline —
"⏱️ 調理時間 **M:SS**（手際: ラベル）" — using the exact pre-existing `formatCookingTime`/
`EFFICIENCY_TIER_LABEL_JA` (no new formatter invented; the task's own §12 instruction to reuse an
existing formatter if one exists). Implemented as a native `<details>`'s own `<summary>` (not a
separate header line above a nested `<details>`) specifically to fit RESULT 1-Screen 2.0's fixed
first-view vertical budget — see §7 below for the exact measurement work this required.

**Tier 2** (behind the same `<details>`, default closed): a `工程 | 実績` table
(`.cooking-timing-summary__details`, a `<dl>` matching the existing `.pitz-credit-summary__row`/
`.cut-evaluation-summary__row` convention), one row per step **actually present in this round's
own `CookingProfile.steps`** (never a hardcoded 4/5/6-row template) — derived by the new pure
function `stepTimingRows()` (`src/logic/cookingTimingDisplay.ts`), which takes its row *order*
from `steps`, never from `perStepElapsedMs`'s own keys, so a step absent from the round's actual
profile can never appear even defensively. A CUT row carries the explanatory disclaimer described
in §4F above.

**No Pitz/Timing duplication**: 調理時間/手際 used to render inside `.pitz-credit-summary`'s own
breakdown `<details>` — removed from there entirely (kept only 手際ボーナス, a Pitz-specific
amount, not a raw timing fact) and consolidated into the one new `.cooking-timing-summary`
element. Confirmed via unit test (`ResultPanel.test.tsx`'s "without duplicating 調理時間/手際"
case) that the Pitz breakdown's own `<dl>` no longer contains either string.

## 6. BAKE/CUT semantics (unchanged, displayed accurately)

- BAKE: never included in either the Tier 1 total or the Tier 2 table (structurally impossible,
  §4E) — no explicit exclusion code was needed, since it was never a `MakingStep` to begin with.
- CUT: shown in Tier 2 (real, measured data) with an explicit "not included in 調理時間" note;
  `completedMs`'s own formula, `efficiency.ts`'s thresholds, and `cut/evaluation.ts`'s CUT score
  are all byte-identical to base (confirmed via `git diff` scoped to those files: no changes).

## 7. RESULT 1-Screen 2.0 regression (PR #181's own contract)

The pre-existing `e2e/result-1screen-2.0.spec.ts` Scenario A asserts `.game-screen`'s default
(details-closed) view has **zero** scroll overflow at 390×844. Adding the new
`.cooking-timing-summary` element as a naive boxed card (headline `<p>` + separate nested
`<details>`, initial padding `10px 16px`) **broke this contract** — measured **+31px overflow at
360×800** via a temporary Playwright measurement script (removed before commit, not part of this
PR's diff). Fixed by:

1. Merging the headline into the `<details>`'s own `<summary>` line (removing an entire separate
   header row + its own margin) — the same single-summary-line shape `.cut-evaluation-summary`/
   `.pitz-credit-summary__breakdown-summary` already use elsewhere on this screen.
2. Trimming the card's own padding to `4px 16px` (from an initial `10px 16px`).

Re-measured after each change (same temporary script) until overflow returned to exactly **0px**
at 360×800. Final CSS is in `src/App.css`'s `.cooking-timing-summary` block.

### Real-Chromium measurements (both viewports, this PR's own final state)

| Scenario | Viewport | `.game-screen` overflow (details closed) |
|---|---|---:|
| Margherita CUT, full round | 390×844 | **0px** |
| Margherita CUT, full round | 360×800 | **0px** |
| Capricciosa (heaviest recipe: CUT + 8 pieces/5 ingredient types) | 390×844 | 0px |
| Capricciosa | 360×800 | **0px** |
| Marinara (no CHEESE, dynamic steps) | 390×844 | 0px |
| Marinara | 360×800 | **0px** |

All re-confirmed via the pre-existing `result-1screen-2.0.spec.ts` (unchanged assertions, still
green — see §15) plus this PR's own new `e2e/timing-transparency.spec.ts` Scenario A/B.

## 8. Dynamic-step behavior (PR-A regression, re-confirmed for Timing specifically)

- Marinara (no CHEESE): `stepTimingRows` never includes a CHEESE row — confirmed at the pure-
  function level (`cookingTimingDisplay.test.ts`), the component level (`ResultPanel.test.tsx`),
  and real-browser E2E (`timing-transparency.spec.ts` Scenario C + a Human Verification video).
- Quattro-formaggi (no TOPPING): same three-level confirmation for the TOPPING/具材 row
  (Scenario D). This PR added a new `playFullQuattroFormaggiRound` E2E gesture helper
  (`e2e/gestures.ts`) since no prior spec drove this recipe through a full round to RESULT.
- No recipe-ID branching anywhere in the new code — `stepTimingRows()` takes `steps: MakingStep[]`
  and `perStepElapsedMs`, nothing recipe-specific.

## 9. Efficiency / 手際 transparency (second-order goal)

The 手際 tier label (スムーズ/ふつう/ゆったり) is shown directly next to 調理時間 in the same
Tier 1 line, so a player can correlate their own elapsed time with the tier they received.
**No threshold number (comfortableMs/normalUpperMs) is shown anywhere** — per the task's own
explicit "do not invent/expose a target time" instruction (§9); this PR treats elapsed-time
transparency as the primary goal and threshold transparency as explicitly out of scope for this
slice, exactly as the original Fresh Audit's PR-C description framed it.

## 10. Pitz relationship (unchanged)

`pitzReward.ts`/`calculateEfficiencyBonus`/`calculatePitzReward`: zero lines changed (`git diff
--stat`). The only change touching Pitz-adjacent UI is removing the now-duplicate 調理時間/手際
rows from `.pitz-credit-summary`'s own breakdown (display-only; 手際ボーナス's own row, a real
Pitz amount, is untouched).

## 11. Lunch Rush (no change needed, regression-tested)

Confirmed via Fresh Audit (§4H above) that no FREE-only Timing UI has any path into
`MissionResultOverlay`. Per the task's own instruction ("不要ならLunch Rush UIは変更しない。変更
しない場合でもregression testは必須"), **zero production changes to Lunch Rush's own components**
— only new/re-confirmed regression tests (Scenario E, both new and pre-existing specs).

## 12. Formatting

Reused the pre-existing `formatCookingTime` (`src/logic/efficiency.ts`) unchanged — per the
task's own §12 instruction to reuse an existing formatter rather than write a new one. Added the
explicit boundary-value unit tests the task requested that weren't already covered
(`efficiency.test.ts`): `999ms → "0:00"`, `1000ms → "0:01"`, `59_999ms → "0:59"`,
`60_000ms → "1:00"`, and a 60+-minute duration (`3_723_000ms → "62:03"`). Pre-existing tests
already covered `0ms`, general sub-minute/minute-plus formatting, and malformed-input clamping.

## 13. Scope Guard (confirmed via `git diff --stat`)

Zero changes to: `score.total`/`scoringV2/**`, ★ threshold (`scoring.ts`'s `starsFromTotal`),
`cut/evaluation.ts` (CUT score/weights), `pitzReward.ts` (formula), `efficiency.ts` (thresholds/
bonus rates — display-only reads added, no formula lines touched), `src/mission/**`/Lunch Rush
scoring, Firebase/Firestore/Cloud Functions, inventory/economy, `recipes.ts` (requirements/
bakeTarget — read-only for E2E gesture targets, not modified).

## 14. Changed files

**Production code**:
- `src/logic/cookingTimingDisplay.ts` (new) — pure `stepTimingRows()` derivation.
- `src/data/makingStepLabels.ts` (new) — `STEP_LABEL` extracted from `MakingStepTabs.tsx` so both
  it and `ResultPanel.tsx` share one label map (also fixes an oxlint react-refresh warning that
  exporting a non-component from a components file would otherwise trigger).
- `src/components/MakingStepTabs.tsx` — imports `STEP_LABEL` from the new data module instead of
  defining it locally (no behavior change).
- `src/components/ResultPanel.tsx` — new `.cooking-timing-summary` Tier 1/2 UI; removed the
  duplicate 調理時間/手際 rows from the Pitz breakdown.
- `src/screens/GameScreen.tsx` — computes and passes the new `stepTimingRows` prop.
- `src/App.css` — new `.cooking-timing-summary*` rules.

**Tests**:
- `src/logic/cookingTimingDisplay.test.ts` (new, 9 cases).
- `src/logic/efficiency.test.ts` — 5 new boundary-value cases for `formatCookingTime`.
- `src/components/ResultPanel.test.tsx` — updated existing Pitz-breakdown cases (no more
  duplicated 調理時間/手際), added a new "Timing Transparency" describe block (11 cases).
- `src/App.cookingTimingBackground.test.tsx` — updated its own `readDisplayedCookingTime()` probe
  helper to the new DOM location (no assertion behavior change).
- `e2e/gestures.ts` — added `playFullQuattroFormaggiRound`; fixed a **pre-existing flaky
  `waitForTimeout(1300)`** in `playFullMarinaraRound` (found while stabilizing this PR's own new
  spec — see §16) to use the existing `bakeToTarget()` virtual-clock helper instead, per this
  task's own §17 instruction never to add a new `waitForTimeout`-based bake helper and to use
  `bakeToTarget()`.
- `e2e/result-1screen-2.0.spec.ts` — scoped two `page.getByText("具材")` queries to
  `.result-panel__details` specifically, since this PR's own Timing Detail table can also contain
  a "具材" (TOPPING) row once opened, which would otherwise make the query ambiguous.
- `e2e/timing-transparency.spec.ts` (new) — Scenario A–E (13 total assertions across both
  viewports where applicable).

**Docs**: this Result Report; `docs/reports/screenshots/gameplay-ux-timing-transparency/*.png`
(5 files, committed).

## 15. Tests

- Focused: `cookingTimingDisplay.test.ts` 9/9, `efficiency.test.ts` (formatCookingTime block)
  10/10, `ResultPanel.test.tsx` 40/40 (11 new Timing Transparency cases + updated Pitz-breakdown
  cases), `App.cookingTimingBackground.test.tsx` unaffected assertions still pass.
- **Full Vitest: 2310/2310 pass** (117 files + this PR's 1 new file = 118 files total).
- TypeScript (`tsc --noEmit`): clean. `oxlint`: clean (0 warnings — including after fixing the
  one transient react-refresh warning found mid-implementation, §14).
- Build (`tsc -b && vite build`): clean.

## 16. Chromium E2E

- New `e2e/timing-transparency.spec.ts`: **10/10 pass** at both 390×844/360×800 (Scenario A–E,
  Scenario E is viewport-agnostic so it isn't duplicated per-viewport in the same way).
- Pre-existing suites re-run for regression, all green: `result-1screen-2.0.spec.ts` (10/10),
  `dynamic-cooking-steps.spec.ts` (8/8), `pizza-cutting-phase4b.spec.ts`, `viewport-1screen.spec.ts`,
  `making-ui-1screen.spec.ts`, `lunch-rush-result-ranking-phase4.spec.ts`.
- **Full Chromium E2E suite total: 92/92 pass** at both `iphone-390x844`/`iphone-360x800`
  projects (`npx playwright test --project=iphone-390x844 --project=iphone-360x800`).
- **One real pre-existing flake found and fixed** (not introduced by this PR, but found while
  stabilizing this PR's own new Marinara scenario): `playFullMarinaraRound` (`e2e/gestures.ts`)
  used a fixed `waitForTimeout(1300)` real-time wait for its BAKE step instead of the repo's own
  `bakeToTarget()` virtual-clock helper. Marinara's `bakeTarget` (`{45,65}`, needle speed 55%/s)
  put 1300ms uncomfortably close to the OVERBAKED threshold — reproduced directly via
  `--repeat-each` under parallel load (5/6 failures with "焦げすぎて提供できません"). Fixed to call
  `bakeToTarget(page, { start: 45, end: 65 })`, matching every other round-driving helper in the
  same file; re-verified 8/8 and 6/6 reliable afterward (both this PR's own spec and the
  pre-existing `result-1screen-2.0.spec.ts` Scenario E that also uses this helper). This is a
  test-infrastructure-only fix — zero production code touched by it.
- WebKit: not runnable in this sandbox (no `webkit-*` package under `/opt/pw-browsers`, the same
  pre-existing limitation every prior PR in this repo documents) — this PR's own GitHub Actions
  WebKit CI run (`.github/workflows/e2e-webkit.yml`) is authoritative.

## 17. WebKit

Not runnable locally (documented limitation, see above). No new `waitForTimeout`-based bake
helper was added by this PR (the one fix in §16 above *replaces* a `waitForTimeout` with
`bakeToTarget()`, moving further away from the WebKit-unsafe pattern, not toward it). GitHub
Actions' own dedicated WebKit job is authoritative for this PR's exact HEAD.

## 18. Human Verification Videos A–D

All four recorded via a standalone Playwright script (real human-paced gestures, 1.2–2.6s holds
between states, no test-speed instant taps — never using the CI-oriented virtual-clock
`bakeToTarget` for these specifically, so the BAKE needle visibly sweeps in real time), using this
session's own freshly-installed system `ffmpeg`/`ffprobe` (6.1.1, `--enable-libx264`) to convert
WebM→MP4/H.264. Delivered directly to the user this session (never committed to the repo, per
policy §6).

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---:|---:|---:|---|---|
| A — Margherita full round → RESULT → Timing details | 390×844 | 30.96s | 591 KB | H.264/yuv420p | PASS |
| B — Capricciosa (heavy) → RESULT → Timing details | 360×800 | 31.08s | 593 KB | H.264/yuv420p | PASS |
| C — Marinara (no CHEESE) → RESULT → Timing details | 390×844 | 30.40s | 597 KB | H.264/yuv420p | PASS |
| D — Lunch Rush → RESULT (no FREE Timing UI leak) | 390×844 | 12.76s | 208 KB | H.264/yuv420p | PASS |

Download: delivered directly in this session (SendUserFile), never committed.

Video Verification: **PASS** — each file: exists, size > 0, full-decode check
(`ffmpeg -i <file> -f null -`) completed with zero errors, resolution matches its target viewport,
`ffprobe` confirms `h264`/`yuv420p`.

What each video shows:
- **A**: HOME → Recipe Select → PREPARE (DOUGH/SAUCE/CHEESE/TOPPING, real gestures) → BAKE (real
  needle sweep) → CUT → RESULT. RESULT's first viewport shows pizza/★/total/CUT summary/Pitz/
  **調理時間 Tier 1 line**, all with zero scroll. Tapping the Timing summary opens Tier 2, showing
  生地/ソース/チーズ/具材/カット each with a real elapsed time and the CUT disclaimer note.
- **B**: 360×800, Capricciosa (the heaviest shipped recipe — CUT + 8 placed pieces across 5
  ingredient types). Same RESULT contract holds at the secondary viewport; Timing Detail opened,
  all 5 steps' rows visible (CTA overlaps the tail of the expanded/scrolled content by design —
  the same "fixed CTA over scrollable expanded detail" contract PR-D's own Scenario C already
  established and tests).
- **C**: Marinara — the PREPARE step strip never shows a CHEESE tab; RESULT's Timing Detail, once
  opened, lists only 生地/ソース/具材/カット — no CHEESE row, matching the round's own actual
  cooking profile.
- **D**: Lunch Rush (`?missionDuration=1` fixture, matching this repo's own existing
  near-instant-RESULT test pattern) — HOME → ランチラッシュ intro → RESULT
  (`挑戦`/`成功`/`失敗`/`成功率`/スコア/Pitz, `MissionResultOverlay`'s own pre-existing fields,
  unchanged). No `.cooking-timing-summary` anywhere on screen.

**One recording-infrastructure issue found and fixed while producing Video D** (not a production
bug): Playwright's `recordVideo` context option intermittently failed to capture the exact frame
where `MissionResultOverlay` mounts, because that transition is driven purely by an internal
timer with no coincident user-input event (every other transition in these videos is a real
button click, which reliably triggers a capturable paint). Real-time screenshots taken at the
same instant always showed the correct RESULT content — only the *recorded video* missed it, for
which a real-repaint nudge (a 1px viewport resize-and-back, matching a normal `page.
setViewportSize` no-op the recorder can be forced through) reliably fixed the capture. Purely a
video-recording-script workaround (not committed, not part of the app or its test suite).

## 19. Screenshots

Committed under `docs/reports/screenshots/gameplay-ux-timing-transparency/`:

- `A-result-timing-390x844.png` — Margherita RESULT, Tier 1 (Timing summary closed), full first
  viewport visible with zero scroll.
- `B-result-timing-details-390x844.png` — same round, Timing Detail opened (工程/実績 rows +
  CUT disclaimer).
- `C-result-timing-360x800.png` — Capricciosa (heaviest recipe) at the secondary viewport, Tier 1
  visible with zero horizontal/vertical overflow.
- `D-marinara-dynamic-timing.png` — Marinara RESULT, Timing Detail opened, confirming no CHEESE
  row.
- `E-lunch-rush-regression.png` — Lunch Rush RESULT overlay, confirming no
  `.cooking-timing-summary` leak.

## 20. Limitations / Follow-ups

- **Threshold transparency (why a given 手際 tier was earned) is explicitly deferred**, per the
  task's own instruction that elapsed-time transparency is the first goal and threshold
  transparency a separate, later follow-up (§9). This PR shows *what happened* (elapsed time +
  tier), not *why the boundary sits where it does*.
- **Per-step target times remain unimplemented and undesigned**, per the Fresh Audit's own
  finding that no authoritative per-step target exists anywhere in the codebase/data and the
  task's explicit instruction not to invent one this slice.
- Video D is shorter (12.76s) than the general 20–45s guideline in the Human Verification Policy,
  because Lunch Rush's own `?missionDuration=1` fixture (this repo's existing pattern for
  reaching Mission RESULT deterministically fast) makes the whole flow inherently brief; extending
  it further would mean padding with idle holds rather than showing more real content, so it was
  kept close to its natural length instead.
- WebKit CI is, as with every prior PR in this repo, authoritative only via GitHub Actions (not
  locally runnable in this sandbox) — see §16/§17.
