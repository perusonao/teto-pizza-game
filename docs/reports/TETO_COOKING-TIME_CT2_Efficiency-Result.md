# Cooking Time CT2: Efficiency Feedback and Pitz Bonus -- Result Report

Attaches CT1's measurement-only Cooking Time (`src/logic/cookingTiming.ts`) to a secondary,
non-competitive "手際" (Efficiency) evaluation: a RESULT-screen tier badge plus a small additive
Pitz bonus, gated on quality so a low-quality/high-speed pizza can never out-earn a
high-quality/normal-pace one. See `docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md` and
`docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md` for the design/CT1 groundwork this
implements.

## Base / branch

- Base `origin/main` SHA: `37c11d3d4d0416654c41087d2c64ef1b4b467d27` (Recipe Expansion Batch 1A,
  PR #100 -- 11 recipes / 18 ingredients).
- Implementation branch: `claude/cooking-time-ct2-efficiency-j0kz25` (pre-existing, already at
  this SHA when the task started -- no rebase needed).

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

No file under `src/logic/scoringV2/`, `src/logic/bake.ts`, `src/logic/pitzReward.ts`,
`src/logic/economy.ts`, `src/mission/`, or `src/state/persistence.ts` was touched.

## Tests

### New/changed test counts

- `src/logic/efficiency.test.ts`: 37 (new file)
- `src/logic/cookingTiming.test.ts`: +9 (pause-reason combinator)
- `src/state/gameReducer.cookingTiming.test.ts`: RESET_PIZZA block net +2 (1 old test -> 3 new)
- `src/state/gameReducer.efficiency.test.ts`: 8 (new file)
- `src/App.cookingTimingBackground.test.tsx`: 4 (new file, real end-to-end `App` rendering)
- `src/components/ResultPanel.test.tsx`: +3

### Full suite

`npx vitest run`: **77 test files, 1553 tests, all passing** (up from CT1's own 1469 baseline,
1509 immediately before this task's new test files -- no existing test file needed a behavior
edit except the one RESET_PIZZA describe block the CT2 policy change itself requires, which CT1's
own report explicitly pre-flagged as expected to change).

### Typecheck / Lint / Build

- `npx tsc -b --noEmit`: clean.
- `npx oxlint`: clean, exit code 0.
- `npm run build`: succeeds (`dist/assets/index-*.js` 347.53 kB, gzip 107.90 kB;
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

## Mobile Human Feel verification

Ran `npm run dev` (Vite) and drove the real app with Playwright against the environment's
pre-installed Chromium (`/opt/pw-browsers/chromium`), at both required viewports.

**390x844**, three patterns (margherita):

- **A (careful, normal pace)**: full Reference-position placement, bake confirmed inside the
  perfect zone. Score 67/★3, GOOD/スムーズ, +3 Pitz bonus, **+83 Pitz** total. Quality
  (heading/stars/score/bake badge) visually dominant; 調理時間/手際/手際ボーナス render as small
  rows inside the existing Pitz card, never competing with the score.
- **B (careful, fast)**: identical placement, played back-to-back with ~0 extra wait. Identical
  **+83 Pitz** result -- directly demonstrates GOOD's flat-ceiling behavior (no reward for being
  even faster) in the real UI, not just in unit tests.
- **C (sloppy, fast)**: partial placement (missing basil, off-target cheese), bake confirmed
  instantly at 0% (raw). Score 34/★1 (< 60 gate), **+0 Pitz**, no Efficiency Bonus row at all --
  confirms careless-but-fast play is never advantaged.

**360x800**: pattern A repeated -- identical layout, no overflow, no truncation, same result
composition as 390x844.

Checked directly: quality reads as the primary/largest element in every screenshot; 手際 reads as
a secondary, encouraging line, never larger or more prominent than the score; no horizontal
scroll/overflow at either viewport (`document.documentElement.scrollWidth` == viewport width in
every run); zero `console.error`/`pageerror` events across all four runs.

Recipes covered in this pass: margherita only (chosen because it is always unlocked in a fresh
save and has a Scoring 2.0 Reference fixture for a reliable high-quality placement). Napoletana
and tonno-e-cipolla were not separately driven through the browser in this pass -- their
complexity-adjusted thresholds are covered numerically by `efficiency.test.ts`'s 11-recipe sweep,
but not visually confirmed on a real device/browser. Flagged below as a CT3/follow-up item.

## Screenshots

Four screenshots were captured during the Playwright run and sent to the user directly (not
committed to the repository, consistent with this repo's existing docs/reports convention of
text-only reports): `result_390x844_A_careful_normal.png`,
`result_390x844_B_careful_fast.png`, `result_390x844_C_sloppy_fast.png`,
`result_360x800_A_careful_normal.png`.

## Unresolved Human Feel findings

- **Threshold calibration is audit-based, not telemetry-based.** No real playtest data exists yet
  for any recipe's actual completion-time distribution (CT1's own report recommended a Slice 0
  data-collection pass that this task's timeline did not include). The `25_000 + 3_000 x
  itemCount` / `+35_000` constants are a reasoned estimate, not a measured one.
- **Only margherita was driven through a real browser.** The other 10 recipes' complexity-adjusted
  thresholds are unit-tested but not Human-Feel-verified on a real device.
- **A genuinely "SLOW" real-device run was not captured** (would require several tens of seconds
  of real wait per the current thresholds) -- SLOW's own UI rendering (手際: ゆったり, no bonus
  row) is covered by the `ResultPanel.test.tsx` unit test's `NORMAL`/0-bonus case, but not by a
  screenshot of an actual timed-out real playthrough.

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

**A. CT2 READY TO MERGE**

Every constraint the task specifies is met: Cooking Time and Efficiency are fully independent of
the 100-point quality score and Scoring 2.0; the Efficiency bonus is strictly additive, small
(0-10%), and quality-gated (verified both by unit tests with fixed numbers and by a real-browser
example matching the formula exactly); "faster is always better" is explicitly not implemented
(GOOD is a flat ceiling); the background/overlay pause boundary closes CT1's own explicitly-
flagged gap, including the specific overlap scenario the task calls out, with an end-to-end test
proving it; the `RESET_PIZZA` policy gap CT1 flagged is explicitly re-decided and documented;
Lunch Rush, Save, and Scoring are all unaffected (regression-tested, not just asserted); the full
suite grew from 1469 to 1553 tests with zero unintended regressions and zero unexplained existing-
test edits (the one edited test file is the CT1 RESET_PIZZA behavior the task itself asked to be
re-decided); `tsc`/`oxlint`/`npm run build` are all clean; and the RESULT UI was verified on a
real, rendered mobile browser at both required viewports across three distinct play patterns,
with quality staying visually dominant and 手際 staying a secondary, non-blaming line throughout.
Not blocked on anything -- the two "B. minor tuning" candidates (real telemetry calibration,
broader per-recipe Human Feel coverage) are both explicitly deferred to CT3 as data-dependent
follow-up, not correctness gaps in this slice.
