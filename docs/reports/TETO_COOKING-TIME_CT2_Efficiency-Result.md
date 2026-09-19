# Cooking Time CT2: Efficiency Feedback and Pitz Bonus -- Result Report

Attaches CT1's measurement-only Cooking Time (`src/logic/cookingTiming.ts`) to a secondary,
non-competitive "手際" (Efficiency) evaluation: a RESULT-screen tier badge plus a small additive
Pitz bonus, gated on quality so a low-quality/high-speed pizza can never out-earn a
high-quality/normal-pace one. See `docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md` and
`docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md` for the design/CT1 groundwork this
implements.

## Base / branch

- Original base `origin/main` SHA (PR #101's own first version): `37c11d3d4d0416654c41087d2c64ef1b4b467d27`
  (Recipe Expansion Batch 1A, PR #100 -- 11 recipes / 18 ingredients).
- Implementation branch: `claude/cooking-time-ct2-efficiency-j0kz25`.
- **Fresh Sync update**: merged forward onto `origin/main`'s current tip,
  `ecb5c8c3af513187fe2e0621c577c12a87f056cb` (Completion Gate Phase 1, PR #102, merged). See
  "Completion Gate Integration" below for the full merge/integration record. Pre-merge PR #101
  HEAD: `60ab9d41fae2e4aaef664ef3072adef3bc1e5e87`.

## Completion Gate Integration

PR #102 (Completion Gate Phase 1, merged to `main` at `ecb5c8c3af513187fe2e0621c577c12a87f056cb`)
introduced `src/logic/completionGate.ts`'s `evaluatePizzaCompletion` and `GameState.completion:
PizzaCompletionResult | null` -- a pizza missing/insufficient required ingredients, an
essentially unpainted sauce, or a bake outside an acceptable margin is now **FAILED**: 0 Pitz, no
Dex/BEST/progression/Starter Grant credit, no star rating, entirely independent of Scoring 2.0.
This landed as an open PR alongside CT2 and merged first, so CT2 needed to integrate with it
rather than the other way around.

**Merge method**: `git merge origin/main` (a real merge commit, not a rebase -- no force-push, PR
#101's own history preserved). Merge commit `11c4074` (message: "Merge origin/main (Completion
Gate Phase 1, PR #102) into CT2").

**Conflict Audit result**: git's own three-way merge resolved every one of the five flagged files
(`gameReducer.ts`, `ResultPanel.tsx`, `ResultPanel.test.tsx`, `GameScreen.tsx`,
`gameReducer.cookingTiming.test.ts`) with **zero manual conflict markers** -- PR #102 and CT2
touched disjoint regions of each shared file (PR #102 added a `completion` field/FAILED guard/
FAILED UI branch; CT2 added a `lastEfficiencyCredit` field/bonus computation/PASS-branch UI rows).
Verified by hand afterward, not just trusted:

- `gameReducer.ts`'s `REGISTER_TO_DEX` case: PR #102's `if (state.completion?.status ===
  "FAILED") return state;` guard sits at line 745, strictly *before* CT2's own
  `lastEfficiencyCredit` computation (line 785) -- a FAILED round returns before that code is ever
  reached, exactly per this task's §4 requirement ("Completion GateのFAILED guardをEfficiency計算
  より前に置くこと"). No code change was needed to achieve this -- it fell out of the merge
  correctly because CT2's own computation was already positioned after the existing `!state.score`
  guard, and PR #102 inserted its own guard in the same spot, ahead of everything both PRs added
  after it.
- `ResultPanel.tsx`: PR #102's FAILED branch (`if (completion?.status === "FAILED") { ... return
  ...; }`) is a hard early return before the component ever reaches the `pitzCredit`/
  `efficiencyCredit` markup in the PASS branch below it -- so 調理時間/手際/手際ボーナス are
  structurally unreachable on a FAILED round, not just conditionally hidden. Added one more test
  (`ResultPanel.test.tsx`) that defensively passes a non-null `efficiencyCredit` alongside a
  FAILED `completion` to pin that this can never leak through even from a future caller bug.
- `GameScreen.tsx`: both PRs' new props (`completion={state.completion}` from #102,
  `efficiencyCredit={state.lastEfficiencyCredit}` from CT2) landed as separate, adjacent lines on
  the same `<ResultPanel>` call -- no overlap.
- `gameReducer.cookingTiming.test.ts`: PR #102 had already updated the pre-existing "DISCOVERED
  keeps completedMs" test (CT1-era) to build a real PASSing pizza instead of an empty one (an
  empty pizza is now FAILED, which never reaches DISCOVERED) -- this hunk didn't overlap with
  CT2's own edit to the file (the `RESET_PIZZA` describe block, earlier in the file), so git
  merged both independently without any manual intervention.

**One thing the merge could not fix automatically**: CT2's own `App.cookingTimingBackground.test.tsx`
(new in this branch, so it had no counterpart in PR #102 to merge against) built its test pizzas
by only advancing making-steps with zero ingredients placed -- exactly the "empty pizza" case
Completion Gate now fails. All 4 of its tests broke post-merge (`FAILED` where they expected a
`PASS` RESULT screen with a 調理時間 row to read from). Fixed by adopting PR #102's own
`selectAndTapPizza`/`paintSauceRing`/`controlBakeNeedle` helper pattern (copied from its
`App.test.tsx` additions) so these tests now build a real, PASSing bismarck pizza (トマトソース
ring + 3x モッツァレラ + 1x たまご, bake confirmed inside the {55,75} target zone) before
asserting on the displayed Cooking Time. This is the one hand-written fix this integration
required; everything else was either a clean automatic merge or fell out of the two PRs'
pre-existing designs.

**New Completion Gate x Efficiency test file**: `src/state/gameReducer.completionGateEfficiency.test.ts`
(13 tests) -- see "Tests" below for the full breakdown.

## Duplicate Gate

- `git fetch origin` at task start: `origin/main` at the SHA above, matching the task's stated
  "最新既知main".
- `search_pull_requests`/`list_pull_requests` (state: open) across the repo: the only open PRs
  are #72 (docs), #46 (Dough Shaping D0), #34 (Reference visuals Phase 1), #3 (docs) -- none
  related to Cooking Time / CT2 / efficiency / 手際 / Pitz bonus / visibilitychange / blur /
  RESULT efficiency.
- `search_issues` for the same keyword set: 0 results.
- Issue #37 (Making Game 2.0, the parent roadmap) explicitly lists "Cooking-time skill... Status:
  not started" as of its own 2026-09-18 Fresh Sync note -- not treated as a duplicate per the
  task's own instruction.
- Re-ran the same PR search immediately before opening the PR (see "Git / PR" below):
  unchanged result.

## CT1 Fresh Audit (re-confirmed from code, not from memory of the reports)

Read directly from `src/logic/cookingTiming.ts`, `src/state/gameReducer.ts`, and `src/App.tsx` on
the base SHA before writing any CT2 code:

- `CookingTimingState { startedAt, pausedAt, accumulatedPauseMs, completedMs }`, pure
  absolute-epoch-ms functions (`startCookingTiming`/`pauseCookingTiming`/`resumeCookingTiming`/
  `finishCookingTiming`), mirroring `MissionClock`'s shape exactly -- `now` is always an argument,
  never read from the wall clock inside the reducer.
- Measures `BEGIN_PREPARE` (or `SELECT_RECIPE`/`RETRY_SAME_RECIPE`'s shared `startPreparingRecipe`,
  which land straight at PREPARE) through `START_BAKE` -- `CONFIRM_BAKE`/BAKE's own needle-tap
  minigame is outside the window entirely.
- FREE-only via `!state.isMissionRound`, checked at every start site rather than by action name
  (`BEGIN_PREPARE` also fires for Lunch Rush's per-pizza flow) -- `cookingTiming` is always `null`
  for a Mission round.
- Pause: `App.tsx` already tracked one combined boolean
  (`isReferencePopoverOpen || isDexOpen || isShopOpen || isInventoryOpen`) and dispatched
  `PAUSE_COOKING_TIMING`/`RESUME_COOKING_TIMING` on its transitions, guarded to PREPARE-only in
  the reducer. No `visibilitychange`/`blur` wiring existed yet (CT1's own explicitly-declared
  scope boundary).
- `RESET_PIZZA` (CT1): discarded the old timing and started a fresh one at the reset's own `now`
  -- explicitly flagged in the CT1 report as "re-decide before CT2" once a reward exists to game.
- Both prior reports (`..._Fresh-Audit.md`, `..._CT1_Implementation-Result.md`) confirmed to still
  match the code as read (no drift since PR #99 merged).

## Background / pause policy (CT2)

**Design decision: combine every pause reason into one boolean via `Array.some`, not a
reason-`Set`/counter.** `src/logic/cookingTiming.ts` gained
`isAnyCookingTimingPauseReasonActive(...reasons: boolean[])`. `App.tsx` now calls it with six
reasons: `isReferencePopoverOpen`, `isDexOpen`, `isShopOpen`, `isInventoryOpen`,
`isDocumentHidden`, `isWindowBlurred`. Two new pieces of App-level state track the last two,
driven by `document.addEventListener("visibilitychange", ...)` and `window.addEventListener(
"blur"/"focus", ...)` respectively (tracked as two independent booleans, not one merged handler,
since a mobile browser backgrounding can fire one without the other depending on platform).

This is provably safe against the overlap case the task calls out (Reference open -> app
backgrounds -> foregrounds -> Reference still open) **without** a reason-Set: the existing
CT1 effect already only dispatches PAUSE/RESUME on *transitions of the combined boolean*, and a
boolean OR only flips `false` once every input is `false` simultaneously, regardless of the order
they toggled in. Unit-tested directly in `cookingTiming.test.ts` (`isAnyCookingTimingPauseReasonActive`
describe block) and end-to-end in `App.cookingTimingBackground.test.tsx` (see Tests below), which
is the more convincing check -- it drives the real `App` component through the exact overlap
sequence and asserts the *displayed* Cooking Time excludes the whole span.

`PizzaStage.tsx`'s own pre-existing `blur`/`visibilitychange` listeners (which abort an
in-progress sauce/dough gesture, unrelated to cooking-time pausing) are untouched and do not
double-fire against this -- they are a separate `addEventListener` registration for a separate
purpose; both coexist without interference (confirmed by the full suite staying green and by the
new integration tests, which exercise both surfaces in the same run).

## RESET_PIZZA policy decision

Compared the three options the task poses:

| Option | Behavior | Verdict |
|---|---|---|
| A. Fresh timer | CT1's original behavior -- `RESET_PIZZA` restarts `cookingTiming` from the reset's own `now` | **Rejected.** Once an Efficiency bonus exists, this lets a player "re-roll" a slow start for free: notice you're behind pace, tear up the pizza, get a brand-new clock. |
| B. Same run, timer continues uninterrupted | `RESET_PIZZA` does not touch `cookingTiming` at all -- the clock (including any in-progress pause) carries straight through the reset | **Chosen.** |
| C. Accumulated active time preserved, pizza resets | A restart that explicitly carries forward total active ms into a new segment | Not chosen -- mathematically equivalent to B in every case that matters (when not paused at reset time), but strictly more code (a `restartCookingTiming` function, an edge case for "reset while paused" to get right) for no behavioral gain over B. |

**Chosen: B.** Implemented by deleting CT1's `cookingTiming: startCookingTiming(action.now)`
override from the `RESET_PIZZA` case entirely -- `...state`'s own spread now carries
`cookingTiming` through completely untouched. This is provably correct even for the edge case of
resetting while paused (an overlay open): since the action touches nothing, a paused timing stays
paused across the reset with no special-casing, and resumes normally later exactly as it would
without any intervening reset. `RESET_PIZZA`'s own `now?: number` payload became entirely unused
by this change, so it was removed from the action type (`App.tsx`'s dispatch site simplified to
match) rather than left as dead API surface.

This directly closes the gap CT1's own report flagged ("Flagged for explicit re-decision before
CT2: if a future slice adds an Efficiency bonus/tier, RESET_PIZZA's reset-and-restart behavior
should be re-audited against that reward"). It is also the most natural read of what a mid-round
redo *is*: the player is still on the same order, just discarding and reassembling -- the clock
counts the whole attempt, resets included, exactly like a real cook restarting a fumbled dough
ball costs real time.

## Recipe complexity treatment (11-recipe Fresh Audit)

Read `src/data/recipes.ts` directly (all 11 shipped recipes) and summed each
`requiredIngredients[].minCount`:

| Recipe | Required pieces (sum of minCount) | Ingredient types | Sauce op | Dough op |
|---|---|---|---|---|
| bismarck | 5 | 3 | spread (tomato-sauce) | free-form stretch (identical mechanic every recipe) |
| margherita | 6 | 3 | spread (tomato-sauce) | " |
| marinara | 6 | 3 | spread (tomato-sauce) | " |
| genovese | 6 | 3 | spread (pesto) | " |
| funghi | 6 | 3 | spread (tomato-sauce) | " |
| fugazza | 6 | 3 | spread (olive-oil) | " |
| salsiccia | 6 | 3 | spread (tomato-sauce) | " |
| pepperoni | 7 | 3 | spread (tomato-sauce) | " |
| napoletana | 7 | 4 | spread (tomato-sauce) | " |
| tonno-e-cipolla | 8 | 4 | spread (tomato-sauce) | " |
| quattro-formaggi | 9 | 5 | spread (olive-oil) | " |

**Finding**: dough and sauce mechanics are structurally identical across all 11 recipes (one
free-form radial dough stretch, one single spread-type sauce/oil application) -- the only axis
that actually varies is topping piece count, and even that only spans 5-9 (a ~1.8x range, not
order-of-magnitude). A single flat threshold would quietly favor bismarck (5 pieces) over
quattro-formaggi (9 pieces); a per-recipe hand-tuned table would be overkill for a ~1.8x spread
with no real playtest telemetry behind it yet (CT1's own report recommended a "Human Feel data
collection" Slice 0 before hand-picking constants, which this task's timeline does not include).

**Decision**: a minimal linear complexity adjustment, per recipe:

```
comfortableMs = 25_000 + 3_000 x totalRequiredItemCount(recipe)
normalUpperMs = comfortableMs + 35_000
```

| Piece count | comfortableMs | normalUpperMs | Recipes |
|---|---|---|---|
| 5 | 40s | 75s | bismarck |
| 6 | 43s | 78s | margherita, marinara, genovese, funghi, fugazza, salsiccia |
| 7 | 46s | 81s | pepperoni, napoletana |
| 8 | 49s | 84s | tonno-e-cipolla |
| 9 | 52s | 87s | quattro-formaggi |

These are hand-audited estimates (not calibrated against real playtest telemetry -- there was no
Slice 0 data-collection pass in this task), sized to feel unhurried for a mobile pizza-assembly
flow (DOUGH free-stretch + one sauce pass + a handful of taps). Flagged as a CT3 candidate for
real-data recalibration below.

## Efficiency evaluation design (`src/logic/efficiency.ts`, new module)

"Comfortable time -> neutral plateau -> gradual taper", exactly per the task's own recommendation,
not a perfect-speed race:

- **GOOD** (`スムーズ`): `completedMs <= comfortableMs`. A flat ceiling, not a continuous curve --
  finishing even faster than `comfortableMs` earns no extra tier or bonus. Verified directly:
  `calculateEfficiencyBonus("GOOD", 95, 100)` returns the identical `bonusPitz` whether
  `completedMs` is `1`ms or exactly `comfortableMs`.
- **NORMAL** (`ふつう`): `comfortableMs < completedMs <= comfortableMs + 35_000`. A wide (35s)
  plateau so the boundary reads as a broad band, not a 1-second race.
- **SLOW** (`ゆったり`): anything beyond that, uniformly (no further sub-tiers or worsening
  penalty -- SLOW's own bonus is already 0, so there is nothing left to "taper" downward).

Labels are deliberately non-judgmental (`スムーズ`/`ふつう`/`ゆったり`) -- no "遅い"/"下手"/any
wording that blames the player, per the task's explicit instruction.

## Quality-first guard

`EFFICIENCY_BONUS_BANDS` (percent of the recipe's static `baseRewardPitz`, all 11 recipes = 100):

| Quality band | GOOD | NORMAL | SLOW |
|---|---|---|---|
| < 60 | 0% | 0% | 0% |
| 60-74 | 3% | 0% | 0% |
| 75-89 | 6% | 0% | 0% |
| 90-100 | 10% | 3% | 0% |

Below 60, the bonus is always 0 regardless of tier -- a low-quality pizza can never earn an
Efficiency bonus no matter how fast it was made. This alone guarantees "低品質高速 <
高品質通常" for any quality below 60: the comparison only needs checking at the 60/75 boundaries,
which `efficiency.test.ts` does directly (see Tests). The bonus percentages are also small enough
(max 10%) that they never overcome the *existing* quality-multiplier bands' own 20-point spacing
(0/0.5/0.8/1.0/1.2) -- verified with a fixed-number test using the real `baseRewardPitz = 100`.

## Pitz Bonus: additive, not mixed into the multiplier

`pitzReward.ts` (`qualityMultiplierForScore`/`calculatePitzReward`/`applyPitzCredit`) is
**unchanged** -- confirmed by `git diff` showing zero lines touched in that file. CT2's bonus is a
second, independent computation (`evaluateCookingEfficiency`, `src/logic/efficiency.ts`) applied
in `REGISTER_TO_DEX` on top of the existing quality credit:

```
pitzBalance = lastPitzCredit.balanceAfter + lastEfficiencyCredit.bonusPitz
```

`lastPitzCredit` itself (the existing `PitzCredit` object -- `baseReward`/`multiplier`/
`earnedPitz`/`balanceBefore`/`balanceAfter`) is untouched in shape and value; a new sibling field,
`GameState.lastEfficiencyCredit: CookingEfficiencyCredit | null`, carries the bonus. `ResultPanel`
adds the two back together for the displayed final total/balance arrow.

## Example calculations (verified end-to-end via `npm run dev` + Playwright, not just unit math)

Real browser run, margherita, ideal Reference placement (`src/data/referencePizza.ts`'s own
`MARGHERITA_REFERENCE` positions), bake confirmed inside the perfect zone:

- Score 67 (60-74 band, multiplier x0.80 -> 80 Pitz), Cooking Time 0:02 (well inside the 43s
  comfortable window) -> GOOD/スムーズ -> 3% bonus = **+3 Pitz** -> displayed total **+83 Pitz**,
  balance `0 -> 83`. Matches `baseReward(100) x 0.80 + round(100 x 0.03) = 80 + 3 = 83` exactly.
- Same recipe/placement, played again immediately (0:00 Cooking Time, still GOOD/スムーズ):
  identical **+83 Pitz** (`83 -> 166`) -- confirms GOOD's flat-ceiling behavior in a real browser,
  not just in the pure-function tests.
- Sloppy/fast run (minimal placement, no basil, bake confirmed instantly at 0% = raw): score 34
  (< 60 quality gate) -> **+0 Pitz** total, no Efficiency Bonus row shown at all (手際 still shows
  スムーズ informationally, but earns nothing) -- confirms careless-but-fast play is never
  rewarded.

## RESULT UI

Added to the existing `pitz-credit-summary` card in `ResultPanel.tsx` (reusing its existing
`__row`/`dt`/`dd` styles -- no new CSS needed, so the new rows are exactly as visually
small/secondary as the pre-existing "基本報酬"/"出来栄え倍率" rows already were):

- 調理時間 (`0:42`-style, `formatCookingTime`)
- 手際 (`スムーズ`/`ふつう`/`ゆったり`)
- 手際ボーナス (`+N Pitz`) -- **omitted entirely** when the bonus is 0, so a 0-bonus round doesn't
  read as a failure callout (mirrors the existing zero-Pitz note's own restraint).
- The headline `+N Pitz` total and the `所持Pitz` balance arrow both include the bonus, so the
  numbers always reconcile with the actual `pitzBalance` change.

Quality (stars, score, bake badge) remains the only large/prominent element on the screen --
verified visually on real screenshots at both 390x844 and 360x800 (see Human Feel below), not just
asserted from the JSX diff.

`ResultPanel`'s new `efficiencyCredit` prop is optional (`?:`) specifically so this component's
pre-existing test call sites needed zero edits (omitting it renders exactly as `null` would).

## Lunch Rush boundary

`lastEfficiencyCredit` is computed only when `!state.isMissionRound` **and**
`state.cookingTiming?.completedMs != null` -- both conditions are already guaranteed false/null
for every Mission round (CT1 never starts `cookingTiming` for one at all), so this is a redundant
but explicit belt-and-suspenders guard, matching `lastPitzCredit`'s own existing discipline.
`MissionClock`/`missionRunReducer`/`calculateMissionReward`/`src/mission/lunchRush.ts` are
untouched (confirmed by `git diff`). Verified with a dedicated reducer test
(`lastEfficiencyCredit` stays `null` through a full Mission round via `MISSION_NEXT_ORDER`).

## Save impact

None. `cookingTiming`/`lastEfficiencyCredit` are both transient `GameState` fields, never read or
written by `src/state/persistence.ts` (confirmed by `git diff` -- zero lines changed in that
file). `schemaVersion` stays `2`. The only persisted value CT2 touches is `pitzBalance` itself
(already an existing persisted number) -- its value now includes the Efficiency bonus, exactly
the same as any other Pitz-earning transaction already was; no new field was added to the save
shape. No "fastest time" record of any kind was added to Dex `bestScore`/`bestStars`.

## Scoring impact

None. `computeScoringV2`, `scoringV2/*`, `src/logic/bake.ts`/`classifyBake`, and
`src/logic/scoring.ts` are all untouched (confirmed by `git diff`). `ScoreBreakdown.total` never
reads Cooking Time or Efficiency; the 100-point quality score and the "手際" evaluation remain two
fully independent numbers, per the task's own explicit prohibition on mixing them.

## Economy impact

`pitzReward.ts` untouched (see above). The bonus is capped at 10% of `baseRewardPitz` (100 for
every recipe today, per Issue #38 V1's "no difficulty-based reward differentiation" rule) --
maximum +10 Pitz per round, only reachable at 90+ quality and GOOD efficiency simultaneously.
Checked against Economy Tuning 1 (PR #98)'s Shop TARGET prices and the Starter Grant floor: a
10-Pitz ceiling is small relative to a 100-Pitz base recipe reward (a full round already nets up
to 120 Pitz at a 1.2x quality multiplier) and negligible relative to Shop ingredient prices --
this does not meaningfully accelerate progression or destabilize the Starter Grant's own 10-play
floor.

## 11-recipe compatibility

`efficiency.test.ts` iterates all 11 `RECIPES` (`RECIPES.length === 11` asserted directly) and
confirms every one produces valid, strictly-increasing `comfortableMs`/`normalUpperMs`
thresholds -- no recipe is left with a degenerate or inverted threshold pair.

## Changed files

CT2's own changes (unchanged from before the merge):

```
src/logic/efficiency.ts                        | new (tier/bonus/format module)
src/logic/efficiency.test.ts                    | new (37 tests)
src/logic/cookingTiming.ts                      | +isAnyCookingTimingPauseReasonActive, doc updates
src/logic/cookingTiming.test.ts                 | +9 tests (pause-reason combinator)
src/state/gameReducer.ts                        | RESET_PIZZA policy change, lastEfficiencyCredit wiring
src/state/gameReducer.cookingTiming.test.ts     | RESET_PIZZA describe block rewritten for the new policy (net +2 tests)
src/state/gameReducer.efficiency.test.ts        | new (8 tests)
src/App.tsx                                     | +visibilitychange/blur tracking, RESET_PIZZA dispatch simplified
src/App.cookingTimingBackground.test.tsx        | new (4 end-to-end tests)
src/screens/GameScreen.tsx                      | +efficiencyCredit prop wiring
src/components/ResultPanel.tsx                  | +調理時間/手際/手際ボーナス rows, balance arrow includes bonus
src/components/ResultPanel.test.tsx             | +3 tests
docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md | new (this file)
```

Brought in from PR #102 via the merge (Completion Gate Phase 1's own files, untouched by CT2
beyond the merge itself): `src/logic/completionGate.ts`, `src/logic/completionGate.test.ts`,
`src/data/completionMessages.ts`, `src/state/gameReducer.completionGate.test.ts`,
`src/state/gameReducer.pitzReward.test.ts`, `src/state/gameReducer.scoringV2Authority.test.ts`,
`src/App.test.tsx`, `docs/reports/TETO_COMPLETION-GATE_PHASE1_Result.md`, and its own
`docs/reports/screenshots/completion-gate-phase1/*.png`.

Added during this Fresh Sync task, specifically for the CT2 x Completion Gate boundary:

```
src/state/gameReducer.completionGateEfficiency.test.ts | new (13 tests)
src/components/ResultPanel.test.tsx                     | +1 test (FAILED never leaks efficiency markup)
src/App.cookingTimingBackground.test.tsx                | fixed: real PASSing pizza + needle control (Completion Gate compatibility)
```

No file under `src/logic/scoringV2/`, `src/logic/bake.ts`, `src/logic/pitzReward.ts`,
`src/logic/economy.ts`, `src/mission/`, or `src/state/persistence.ts` was touched by CT2 or by
this integration task (Completion Gate's own merge into `main` also left all of these untouched,
per PR #102's own report).

## Tests

### New/changed test counts

- `src/logic/efficiency.test.ts`: 37 (new file)
- `src/logic/cookingTiming.test.ts`: +9 (pause-reason combinator)
- `src/state/gameReducer.cookingTiming.test.ts`: RESET_PIZZA block net +2 (1 old test -> 3 new)
- `src/state/gameReducer.efficiency.test.ts`: 8 (new file)
- `src/App.cookingTimingBackground.test.tsx`: 4 (new file, real end-to-end `App` rendering)
- `src/components/ResultPanel.test.tsx`: +4 (3 from CT2's first pass, +1 FAILED-guard test added
  during this Fresh Sync)
- `src/state/gameReducer.completionGateEfficiency.test.ts`: 13 (new file, added during this Fresh
  Sync -- the FAILED x Efficiency and PASS x quality-band boundary specifically)

Brought in from PR #102 (Completion Gate Phase 1) via the merge, not part of CT2's own count:
`src/logic/completionGate.test.ts` (19), `src/state/gameReducer.completionGate.test.ts` (14), plus
edits to `src/App.test.tsx`/`src/state/gameReducer.pitzReward.test.ts`/
`src/state/gameReducer.scoringV2Authority.test.ts` for empty-pizza-is-now-FAILED fixture updates.

### Full suite

`npx vitest run` **before** this Fresh Sync merge (CT2 alone, on the original `origin/main`):
77 test files, 1553 tests.

`npx vitest run` **after** merging `origin/main` (PR #102 already merged there): 78 files, 1586
tests, **4 failing** -- `App.cookingTimingBackground.test.tsx`'s own 4 tests, because their test
pizzas placed zero ingredients (a now-FAILED round under Completion Gate, so the RESULT screen
never reached the 手際/調理時間 markup they asserted on). Fixed per "Completion Gate Integration"
above.

`npx vitest run` **final** (after the fix + this task's new test files): **80 test files, 1600
tests, all passing** -- net +60 over PR #102's own post-merge baseline (1540, per its own PR
body), and zero unintended regressions anywhere else in the suite.

### Typecheck / Lint / Build

- `npx tsc -b --noEmit`: clean.
- `npx oxlint`: clean, exit code 0.
- `npm run build`: succeeds (`dist/assets/index-*.js` 350.77 kB, gzip 108.81 kB;
  `dist/assets/index-*.css` 40.07 kB, gzip 8.36 kB).

### Coverage against the task's own 20-item list

1. Tier from Cooking Time -- `efficiency.test.ts`.
2. Boundary values -- `efficiency.test.ts` (`comfortableMs`/`normalUpperMs` inclusive boundaries).
3. Extreme speed never abnormal -- `efficiency.test.ts` ("no 'faster is always better'").
4. Low quality -> bonus 0 -- `efficiency.test.ts` (quality-first guard).
5. High quality + GOOD -> small additive bonus -- `efficiency.test.ts` +
   `gameReducer.efficiency.test.ts` + real-browser example above.
6. High quality + NORMAL -> quality reward maintained -- `efficiency.test.ts` (0 bonus at 75-89
   band).
7. 低品質高速 < 高品質通常 -- `efficiency.test.ts` (three separate fixed comparisons, including
   the tightest edge case).
8. BAKE wait time never affects Efficiency -- inherited unchanged from CT1's own boundary
   (`completedMs` finalizes at `START_BAKE`, before `CONFIRM_BAKE` ever runs); re-confirmed by
   the full CT1 regression suite staying green.
9. Background time excluded -- `App.cookingTimingBackground.test.tsx` (`blur`/`focus` and
   `document.hidden`/`visibilitychange`, both end-to-end).
10. Overlay pause -- `App.cookingTimingBackground.test.tsx` (Reference popover).
11. Overlay + background overlap -> no premature resume -- `App.cookingTimingBackground.test.tsx`
    (the exact scenario the task names) + `cookingTiming.test.ts`'s pure-function version.
12. RESET policy -- `gameReducer.cookingTiming.test.ts` (3 tests: untouched, spans-a-reset total,
    reset-while-paused).
13. Retry fresh run -- pre-existing CT1 tests (`RETRY_SAME_RECIPE`/`SELECT_RECIPE` start a fresh
    timing), unchanged and still green.
14. HOME clears timing -- pre-existing CT1 test, unchanged and still green.
15. Lunch Rush bonus none -- `gameReducer.efficiency.test.ts`.
16. Save schema unchanged -- structural (`git diff` on `persistence.ts` is empty).
17. 11 recipes evaluable -- `efficiency.test.ts`.
18. Scoring 2.0 regression -- full suite green, zero lines touched under `scoringV2/`.
19. Starter Grant/economy regression -- full suite green, zero lines touched in `economy.ts`;
    Economy Tuning 1 impact reasoned through above.
20. CT1 regression -- full suite green (all of CT1's own tests still pass, RESET_PIZZA's block
    updated per its own explicitly-pre-flagged policy change).

### Coverage against this Fresh Sync task's own 30-item list (§11)

Items 20-30 are the same CT2-only items 12-20 above (RESET/background/overlap/BAKE-wait/Lunch
Rush/Save/Scoring/11-recipe/regression), re-verified green after the merge -- not re-listed here.
Items 1-19, the Completion Gate x Efficiency boundary specifically:

1-5. FAILED (missing ingredient / insufficient amount / insufficient sauce / underbaked /
   overbaked) -> `lastEfficiencyCredit` null -- `gameReducer.completionGateEfficiency.test.ts`,
   one test per reason, each confirming both `completion.reason` and the null credit.
6. FAILED -> 0 Pitz -- same file, plus every FAILED reducer/mobile-Human-Feel run showed `+0
   Pitz` explicitly.
7. FAILED -> no 手際 display -- `ResultPanel.test.tsx`'s new defensive test (a non-null
   `efficiencyCredit` passed alongside FAILED still renders nothing) + real-browser confirmation
   (patterns A/B/C below never show 調理時間/手際/手際ボーナス).
8. FAILED -> no Efficiency Bonus display -- same as above.
9-11. FAILED -> no Dex/progression/Starter Grant --
   `gameReducer.completionGateEfficiency.test.ts` (`after.dex` unchanged, `after` is the exact
   same object as `result`, i.e. `REGISTER_TO_DEX` is a complete no-op) + PR #102's own
   pre-existing `gameReducer.completionGate.test.ts` coverage (unperturbed by CT2's merge).
12-14. PASS with score < 60 -> `completion.status` is `"PASS"` (not FAILED), the existing quality
   reward formula is unchanged (`multiplier` reflects the real 40-59 band), and the Efficiency
   bonus is 0 while the tier itself is still computed/displayed -- `gameReducer.
   completionGateEfficiency.test.ts`'s "FAILED != low-quality PASS" describe block, the one test
   that most directly pins the distinction this integration is about.
15-17. PASS, GOOD tier, quality bands 60-74/75-89/90+ -> bonuses of 3/6/10% respectively -- same
   file, three tests with an injected exact `score.total`.
18. PASS, NORMAL tier, 90+ quality -> 3% bonus -- same file.
19. PASS, SLOW tier -> 0 bonus even at 100 quality, with the existing quality reward (`x1.2`
   multiplier) completely unaffected -- same file.

## Mobile Human Feel verification

Ran `npm run dev` (Vite) and drove the real app with Playwright against the environment's
pre-installed Chromium (`/opt/pw-browsers/chromium`), at both required viewports, across two
sessions (CT2's original pass, before Completion Gate existed; this Fresh Sync's own pass,
specifically for the FAILED/PASS boundary).

### CT2 original pass (pre-Completion-Gate; recipe quality/tier UI only)

**390x844**, three patterns (margherita), labeled independently of this Fresh Sync's own §12
A-F patterns below:

- **careful, normal pace**: full Reference-position placement, bake confirmed inside the perfect
  zone. Score 67/★3, GOOD/スムーズ, +3 Pitz bonus, **+83 Pitz** total. Quality
  (heading/stars/score/bake badge) visually dominant; 調理時間/手際/手際ボーナス render as small
  rows inside the existing Pitz card, never competing with the score.
- **careful, fast**: identical placement, played back-to-back with ~0 extra wait. Identical
  **+83 Pitz** result -- directly demonstrates GOOD's flat-ceiling behavior (no reward for being
  even faster) in the real UI, not just in unit tests.
- **sloppy, fast**: partial placement (missing basil, off-target cheese), bake confirmed
  instantly at 0% (raw). Score 34/★1 (< 60 gate), **+0 Pitz**, no Efficiency Bonus row at all --
  confirms careless-but-fast play is never advantaged. (Re-run under Completion Gate, this exact
  scenario is now FAILED outright rather than a low-score PASS -- see the A-F patterns below for
  the post-merge equivalent.)

**360x800**: the careful/normal-pace pattern repeated -- identical layout, no overflow, no
truncation, same result composition as 390x844.

### This Fresh Sync's own pass: Completion Gate FAILED vs PASS (§12 patterns A-F, margherita, 390x844)

Sauce is now painted as a real multi-tap ring (16 separate tap-release cycles, matching PR #102's
own `paintSauceRing`/`ring()` fixtures) rather than a single tap -- Completion Gate Phase 1 made
the legacy single-tap `APPLY_SAUCE` path unreachable from the real touch/mouse UI (every spread
ingredient now starts a real paint/dispense session on pointerdown), and a single tap's one
starter dab is deliberately too little to clear `SAUCE_MIN_RATIO`.

- **A (材料不足 -- missing basil)**: FAILED, reason shown: "バジルが入っていません". No
  調理時間/手際/手際ボーナス anywhere on screen (asserted programmatically, not just eyeballed).
  `+0 Pitz`, no ★.
- **B (生焼け -- confirmed instantly, needle near 0)**: FAILED, "トマトソースが少なすぎます" was
  the actual highest-priority failure on the very first attempt (a real paint ring must clear the
  gate for UNDERBAKED to even be reachable as the *shown* reason -- composition failures outrank
  a bake mistake, exactly per `completionGate.ts`'s own `PRIORITY_ORDER`). Confirms the priority
  order end-to-end in a real browser, not just in the pure-logic unit tests.
- **C (焦げすぎ -- needle driven past the ceiling and back down to ~95)**: FAILED,
  "焦げすぎて提供できません", 焼き加減 badge shows 🔥焦げ. No efficiency markup.
- **D (PASS, degraded quality)**: a real paint ring reduced to radius 15 (still clears
  `SAUCE_MIN_RATIO`, confirmed by a dedicated radius sweep -- 12 fails, 15/18/20 all PASS),
  cheese/basil clustered into a single point, bake confirmed at ~51 (inside the {50,90}
  acceptable band, well outside the {60,80} perfect zone). Landed at score 61/★3 (the 60-74
  quality band, not the < 60 the task's own example describes) -- **PASS**, 手際 (スムーズ) is
  displayed, and it does earn a small +3 Pitz bonus (60-74 x GOOD = 3%). The task's own literal
  "低品質 -> bonus 0" example needs quality strictly below 60, which is separately, exactly
  covered by `gameReducer.completionGateEfficiency.test.ts`'s injected-score-45 test -- see
  "Unresolved Human Feel findings" below for why this browser pass didn't chase that exact number
  further.
- **E (PASS, high quality, GOOD)**: full Reference placement + perfect-zone bake. Score 68/★3,
  🌟NEW BEST, GOOD/スムーズ, **+3 Pitz** bonus, **+83 Pitz** total (0 -> 83 Pitz balance shown).
- **F (PASS, high quality, NORMAL)**: identical placement to E, but with a real ~50s wait
  mid-PREPARE before confirming (margherita's own `comfortableMs`=43s / `normalUpperMs`=78s, so
  50s lands squarely in NORMAL). Score 68/★3, 調理時間 **0:50**, 手際 **ふつう**, **no bonus row**
  (60-74 x NORMAL = 0%) -- the quality reward (+80 Pitz) is unchanged, exactly matching "PASS +
  normal efficiency -> quality reward maintained."

**360x800**: pattern A (FAILED) and a full-ideal PASS repeated -- `document.documentElement.
scrollWidth` == 360 in both, no overflow, no truncation.

Checked directly across both passes: quality reads as the primary/largest element in every
screenshot; 手際 reads as a secondary, encouraging line, never larger or more prominent than the
score; FAILED's own "失敗" card never shows a star row, a quality score, or any 手際/Efficiency
markup at all (not merely a smaller one); no horizontal scroll/overflow at either viewport in any
run; zero `console.error`/`pageerror` events across every run in both passes.

Recipes covered in both passes: margherita only (chosen because it is always unlocked in a fresh
save and has a Scoring 2.0 Reference fixture for a reliable high-quality placement). Bismarck was
covered by the merge-fix to `App.cookingTimingBackground.test.tsx` (jsdom, not a real browser).
Napoletana and tonno-e-cipolla were not separately driven through a real browser in either pass --
their complexity-adjusted thresholds are covered numerically by `efficiency.test.ts`'s 11-recipe
sweep, but not visually confirmed on a real device/browser. Flagged below as a CT3/follow-up item.

## Screenshots

Ten screenshots total were captured and sent to the user directly (not committed to the
repository, consistent with this repo's existing `docs/reports/` convention for the CT2 report
itself -- PR #102's own report is a documented exception that does commit its screenshots):

CT2 original pass: `result_390x844_A_careful_normal.png`, `result_390x844_B_careful_fast.png`,
`result_390x844_C_sloppy_fast.png`, `result_360x800_A_careful_normal.png`.

This Fresh Sync's own pass: `gate_A_missing_ingredient.png`, `gate_B_underbaked.png`,
`gate_C_overbaked.png`, `gate_D_pass_low_quality.png`, `gate_E_pass_good.png`,
`gate_F_pass_normal.png`, plus `gate_360_A_failed.png`/`gate_360_E_pass.png` for the 360x800
overflow check.

## Unresolved Human Feel findings

- **Threshold calibration is audit-based, not telemetry-based.** No real playtest data exists yet
  for any recipe's actual completion-time distribution (CT1's own report recommended a Slice 0
  data-collection pass that this task's timeline did not include). The `25_000 + 3_000 x
  itemCount` / `+35_000` constants are a reasoned estimate, not a measured one.
- **Only margherita was driven through a real browser.** The other 10 recipes' complexity-adjusted
  thresholds are unit-tested but not Human-Feel-verified on a real device.
- **A genuinely "SLOW" real-device run was not captured** (would require several tens of seconds
  of real wait per the current thresholds) -- SLOW's own UI rendering (手際: ゆったり, no bonus
  row) is covered by the `ResultPanel.test.tsx` unit test's `NORMAL`/0-bonus case and by
  `gameReducer.completionGateEfficiency.test.ts`'s SLOW-tier test, but not by a screenshot of an
  actual timed-out real playthrough. (Pattern F did capture a real NORMAL-tier run, a real ~50s
  wait -- SLOW would need ~80s+, judged not worth the added run time for this task.)
- **Pattern D landed at 61 quality (60-74 band, small +3 bonus), not literally <60 (bonus 0) as
  the task's own §12 example describes.** A real browser run's quality score is an emergent
  property of Scoring 2.0's actual weights, not something this task's placement/bake tweaks could
  precisely dial down further without materially more iteration (a probe into sauce-ring radius,
  cheese clustering, and bake-edge timing only moved the score from 67 to 61). The exact <60 ->
  bonus-0 behavior this pattern was meant to demonstrate is rigorously covered instead by
  `gameReducer.completionGateEfficiency.test.ts`'s dedicated test (an injected `score.total = 45`
  against a real GOOD-tier timing, confirming `bonusPitz === 0` while `completion.status` stays
  `"PASS"`) -- the reducer-level guarantee is proven; only the exact real-browser number is a gap.

## CT3 recommendation

1. Collect real Cooking Time telemetry (dev-only log, per the Fresh Audit's own original Slice 0
   recommendation) across all 11 recipes, then recalibrate `BASE_COMFORTABLE_MS`/
   `PER_ITEM_COMFORTABLE_MS`/`NORMAL_WINDOW_MS` against actual player data instead of an audited
   estimate.
2. Human-Feel-verify the other 10 recipes on a real device, especially the two extremes
   (bismarck's 5-piece/40s comfortable window, quattro-formaggi's 9-piece/52s one), to confirm the
   linear complexity adjustment actually feels fair at both ends.
3. Consider whether a recipe-level `baseRewardPitz` differentiation (still explicitly out of
   scope per Issue #38 V1) would ever change the Efficiency bonus's own percentage table, once
   that decision is made independently.

## Final Verdict

**A. #101 READY TO MERGE**

Every constraint both this task and the original CT2 task specify is met, now integrated with
Completion Gate Phase 1 (PR #102, merged first):

- Cooking Time and Efficiency remain fully independent of the 100-point quality score, Scoring
  2.0, and (now) the Completion Gate's own PASS/FAILED question -- three orthogonal systems, each
  verified not to leak into either of the others.
- **FAILED semantics are airtight**: a FAILED round's `REGISTER_TO_DEX` returns before CT2's own
  `lastEfficiencyCredit` computation is ever reached (verified by reading the merged code, not
  just by test success), so a FAILED pizza can never display 調理時間/手際/手際ボーナス or earn a
  bonus -- confirmed by 13 new reducer tests (every FAILED reason x null credit), a defensive
  ResultPanel unit test (a non-null `efficiencyCredit` still can't leak through a FAILED
  `completion`), and 3 real-browser FAILED runs (missing ingredient / underbaked / overbaked, all
  showing zero efficiency markup and `+0 Pitz`).
- **FAILED != low-quality PASS is explicitly preserved**: a PASS round with quality < 60 still
  computes and displays a 手際 tier (it is a real, if mediocre, dish) while its Efficiency bonus
  is 0 -- a materially different outcome from FAILED's complete non-registration, pinned by a
  dedicated test and (partially, at quality 61 rather than <60) by a real-browser run.
- The Efficiency bonus is still strictly additive, small (0-10%), and quality-gated; "faster is
  always better" is still explicitly not implemented (GOOD is a flat ceiling); the
  background/overlay pause boundary (including the overlapping-pause-reasons scenario) and the
  re-decided `RESET_PIZZA` policy are both unaffected by the Completion Gate merge and remain
  fully tested.
- Lunch Rush, Save, and Scoring 2.0 are all unaffected by CT2 and by this integration
  (regression-tested, not just asserted) -- Completion Gate Phase 1 also deliberately deferred
  Lunch Rush gating this phase, so the two features' shared "FREE only" boundary stays consistent
  without this task extending either one into Mission.
- The merge itself required no manual conflict resolution (git's own three-way merge cleanly
  combined both PRs' disjoint edits across all five flagged files) and the one break it did
  surface (`App.cookingTimingBackground.test.tsx`'s empty-pizza fixtures, now FAILED under the
  gate) was fixed using the exact same helper pattern PR #102 itself had already built for this.
- The full suite grew from PR #102's own post-merge baseline of 1540 tests to **1600**, with zero
  unintended regressions anywhere in the suite; `tsc`/`oxlint`/`npm run build` are all clean on
  the final merged HEAD.
- The RESULT UI was verified on a real, rendered mobile browser at both required viewports, across
  three original CT2 patterns plus six new Completion Gate patterns (A-F: three FAILED reasons,
  a degraded-but-PASSing round, and PASS at both GOOD and NORMAL efficiency tiers) -- quality
  stays visually dominant and 手際 stays a secondary, non-blaming line throughout, and FAILED's
  own card never shows any of it.

Not blocked on anything. The unresolved items are the same class of data-dependent follow-up the
original CT2 report already deferred to CT3 (real telemetry calibration, broader per-recipe
Human Feel coverage), plus one new minor gap this integration surfaced: pattern D's real-browser
quality landed at 61 rather than strictly <60, so the exact "quality < 60 -> bonus 0" case is
proven by a reducer test with an injected score rather than by an unmodified real playthrough --
not a correctness gap (the reducer-level guarantee is real and tested), just a browser-run
number that didn't land exactly where the illustrative example described.
