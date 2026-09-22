# Gameplay UX / Scoring 3.0 — Fresh Audit & Implementation Plan

Status: **Fresh Audit (docs-only)**. No production code changed by this task.

Audited `main` SHA: `d3627a0cf911ab8009bc9cd4f64dd0c535327323` (PR #173, "Pizza Cutting Phase 4B: Full
Recipe Expansion", merged).
Audit branch: `claude/teto-gameplay-scoring-audit-28uosn`, created directly from the SHA above
(`git merge-base HEAD origin/main` == `origin/main` HEAD at audit start — zero divergence).

PR #175 ("Lunch Rush Phase 4: Result Summary & Ranking achievedAt") is **open**, based on the
older `4a3e604` main, `mergeable_state: dirty` (needs a rebase over #173, not this audit's
concern) — this audit branch was **not** created from it, per the task's own instruction.

---

## 0. Fresh Start

- `git fetch origin` run at task start; `origin/main` HEAD = `d3627a0c` (PR #173 merged).
- PR #173 (Pizza Cutting Phase 4B): **merged**, is in fact the current main tip.
- PR #175 (Lunch Rush Phase 4): **open**, unrelated scope (Mission result stats + ranking
  `achievedAt` display), not touched by this audit.
- Working tree was clean at task start.
- This audit branch (`claude/teto-gameplay-scoring-audit-28uosn`) was created from `origin/main`
  at `d3627a0c`, not from PR #175's branch.

## 1. Required Reading (completed)

- `CLAUDE.md`, `docs/PROJECT_HANDOFF.md` (full), `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` (full).
- `docs/design/TETO_PIZZA-CUTTING_1.0.md`, `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md`.
- Scoring SSOTs: `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md`,
  `TETO_SCORING2-A1_AUTHORITY_Result.md`, `TETO_PHASE-4A-2_SCORING-2_Shadow_Result.md`.
- Economy/reward: `docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md`,
  `TETO_ISSUE-38_PITZ-REWARD_Result.md`.
- Cooking-time/efficiency: `docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md`,
  `TETO_COOKING-TIME_CT1_Implementation-Result.md`, `TETO_COOKING-TIME_CT2_Efficiency-Result.md`.
- RESULT/1-screen: `docs/reports/TETO_COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit.md` + PR-A/B/C
  results, `TETO_RESULT-2_Fresh-Audit.md`, `TETO_RESULT-2_SLICE1_Result.md`,
  `TETO_RESULT-2_SLICE2_FEEDBACK_Preflight.md`, `TETO_VISUAL-POLISH_2.0C_Fresh-Audit.md` +
  `TETO_VISUAL-POLISH_2.0C_P1-5_Result.md`.
- Bake guide/visual: `TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md`, `TETO_M3A_BAKE-JUDGMENT_Result.md`.
- Pizza Cutting Phase reports (Phase1–4B, including the Phase3/4 Human-Feel Fresh Audits).
- Full current-`main` source: `src/logic/scoringV2/*`, `src/logic/cut/*`, `src/logic/pitzReward.ts`,
  `src/logic/efficiency.ts`, `src/logic/cookingTiming.ts`, `src/logic/bakeGuideFade.ts`,
  `src/logic/bakeVisual.ts`, `src/data/cookingProfiles.ts`, `src/data/recipes.ts`,
  `src/components/ResultPanel.tsx`, `src/components/PizzaStage.tsx`,
  `src/components/MakingStepTabs.tsx`, `src/components/IngredientTray.tsx`,
  `src/components/PizzaVisualPieces.tsx`, `src/state/gameReducer.ts`, `src/App.tsx`,
  `src/App.css`, `src/shared/lunchRushScoring.ts`, `src/firebase/submitLunchRushScore.ts`.

## 2. Duplicate Gate #1 (searched at task start)

Searched open issues/PRs for: "Scoring 3.0", "CUT score", "total score", "cooking time", "step
timing", "efficiency"/手際, "result one screen"/"result layout", "finished pizza"/"post bake",
"skip cooking step"/"cooking profile", "bake guide"/"bake zone"/"bake timing", 焼く, 目安時間.

Findings:

- **No open issue or PR titled or scoped exactly to this task's 7 items** (CUT/total relationship,
  RESULT 1-screen, finished-pizza visual, dynamic step skip, bake emoji, timing transparency,
  bake-guide-fade redesign).
- **Issue #22** ("[SSOT] development roadmap / session handoff") — open, general parent roadmap
  issue. Not a duplicate; this audit's umbrella issue should reference it, not replace it.
- **Issue #37** ("Making Game 2.0: physical pizza-making flow") — open, parent issue for M0–M6.
  Its own 2026-09-18 addendum explicitly named "Cooking-time skill" as **"not started"** and framed
  "fading bake guidance" as an open design candidate — that candidate **shipped and merged** via
  PR #68 since Issue #37's body was last edited (Issue #37's own text is stale on this one point;
  fresh code state wins, see §5 Audit H below). Issue #37 is relevant background, not a duplicate
  of any of the 7 items — it does not mention RESULT 1-screen, finished-pizza visual, dynamic step
  skip, or the bake emoji at all.
- **Issue #38** ("Economy: Scoring 2.0連動 Pitz報酬") — open, its own next step (E-P3 Human
  Feel/balance) overlaps tangentially with this audit's Cross-System Interaction section (§11) but
  is not a duplicate of the timing-transparency or CUT-scoring asks.
- Open PRs at Duplicate-Gate time: **#175** (Lunch Rush Phase 4 result/ranking display, unrelated
  scope), **#105** (dev-automation opt-in worker, unrelated), and three long-stale PRs (**#72**,
  **#46**, **#34**) already documented elsewhere as superseded by later merged work — none overlap
  this audit's 7 items.

**Conclusion: no duplicate to fold into. One new umbrella Issue is warranted** (§15), referencing
Issue #22/#37 as parent context rather than replacing them.

## 3. Audit A — CUT Score

### Current Truth (traced from code)

`state.score` (`ScoreBreakdown.total`) is computed by `computeScoringV2` (`src/logic/scoringV2/index.ts`)
then adapted via `toLegacyScoreBreakdown` (`src/logic/scoringV2/toLegacyScoreBreakdown.ts`), called
from `CONFIRM_BAKE` in `src/state/gameReducer.ts`.

**Total-score formula** (`src/logic/scoringV2/index.ts:48-51,143-151`):

```
SAUCE_WEIGHT = 52, PIECES_WEIGHT = 16, RECIPE_WEIGHT = 12, BAKE_WEIGHT = 20   (sum = 100)

totalScore = safeUnit(
  (sauce.score*52 + pieces.score*16 + recipeComponent.score*12 + bake.score*20) / 100 / 100
) * 100
```

This is the pre-existing iPhone-calibrated 65:20:15 Sauce:Pieces:Recipe ratio rescaled ×0.8 →
52:16:12, with the freed 20 points given to the Bake component (B1, already merged, PR #58).

Component formulas:
- **Sauce** (`sauceComponent.ts`): `quantitySimilarity*30 + coverageSimilarity*30 + evennessScore*20 + edgeScore*20`.
- **Pieces** (`piecesComponent.ts`): per-group `quantitySimilarity*30 + placementSimilarity*70*placementGate`, averaged across groups.
- **Recipe** (`recipeComponent.ts`): `(requiredTypesPresent/requiredTypesTotal)*100*purityMultiplier`.
- **Bake** (`bakeComponent.ts`): `similarity = 1 - distanceFromNearestEdge/center`; `score = similarity*100`.

Stars (`src/logic/scoring.ts:29-35`): `{90:5, 75:4, 60:3, 40:2, 0:1}`, then `capStarsForBake` caps
a 5-star result to 4 unless `bakeState === "perfect"`.

**CUT score formula** (`src/logic/cut/evaluation.ts`), `CUT_SCORE_WEIGHTS` (sum 1, "Option B —
uniformity-heavy"):

```
countCorrectness: 0.2, completeness: 0.2, centerAccuracy: 0.1, uniformity: 0.5

countCorrectness = 1 - min(1, |actualPieceCount - requestedSliceCount| / requestedSliceCount)
completeness     = min(1, completedCutCount / requiredCutCount)     // requiredCutCount = requestedSliceCount/2
centerAccuracy    = 1 - mean(clamp01(perpendicularDistanceFromCenter(line)/DOUGH_RADIUS))
uniformity        = 1 - min(1, meanAbsoluteDeviation(pieceAreas, idealPieceArea)/idealPieceArea)

cutScore = 100 * (0.2*countCorrectness + 0.2*completeness + 0.1*centerAccuracy + 0.5*uniformity)
```

### A. Is CUT included in `score.total` today?

**No.** `computeScoringV2` never imports anything from `src/logic/cut/`; `toLegacyScoreBreakdown`
builds `total` solely from `ScoringV2Result.totalScore`. Confirmed by the module's own file-header
statement (`evaluation.ts:6-9`): *"`cutScore` is never wired into `state.score.total` ... It exists
only as a pure, displayable preview value."*

### B. Why was it designed this way?

`docs/design/TETO_PIZZA-CUTTING_1.0.md` §14 tabled four options and picked **D**:

- A. Standalone display, never summed.
- B. Re-split the existing 100 pts to include CUT — **rejected outright**: *"re-splitting weights
  changes every existing recipe's score meaning, exactly the regression the Cooking Steps SSOT §10
  itself already rejected this option for."*
- C. Existing 100 + CUT bonus (the SSOT's general core+bonus mechanism), activated now.
- **D. Standalone in Phase 1; integrate via C in a later Scoring 3.0 slice — adopted.**

Key rationale quoted: *"CUT is explicitly near-universal ... unlike FOLD (Calzone only) or
EDGE_FILL (Stuffed Crust only), flipping CUT's score contribution on is not a one-recipe change,
it is eventually a 'every pizza's visible total score composition just changed' change."* The
recommendation explicitly deferred activation to *"a later, separately-scoped Scoring 3.0 slice
... by which point real Human Feel data and a real rollout decision both exist."*

**This audit is that Scoring 3.0 slice.** Phase 4B has since made CUT available on all 15 shipped
recipes (was the trigger condition Option D's own rationale named), so the original blocker for
revisiting this decision ("only 1 recipe has it") no longer applies.

### C–F. Does CUT affect ★ / Pitz / Lunch Rush / Ranking?

All confirmed **NO**, independently for each:

| Consumer | Reads CUT? | Evidence |
|---|---|---|
| ★ stars | No | `starsFromTotal`/`capStarsForBake` (`scoring.ts:29-50`) read only `total`/`bakeState` |
| Pitz reward | No | `pitzReward.ts` docstring: "deliberately independent of `scoringV2/`... takes an abstract 0-100 quality `total`"; no `cut/` import |
| Lunch Rush score | No | `missionScoring.ts`: `missionScore = servedCount*100 + totalQualityScore`, and `totalQualityScore` is documented as "sum of every served pizza's `ScoreBreakdown.total`" |
| Firebase Ranking | No | `src/shared/lunchRushScoring.ts`'s `LunchRushServeRecord.qualityTotal` = "a single pizza's ScoringV2 `score.total`"; `submitLunchRushScore.ts` payload has no CUT field |

CUT's own result is display-only: `ResultPanel.tsx` renders "✂️ カット **N点**"; `cutState` is
never persisted (transient `GameState` field); `completionGate.ts` has zero CHEESE/CUT coupling
(`requiredForCompletion: false` for CUT).

### G. Is this design still the right call after full-recipe CUT expansion?

The original Option D rationale's own trigger condition — *"the day it activates on any real
recipe, it is likely to eventually activate on most recipes"* — has now occurred (15/15 recipes,
PR #173). The design doc's own recommendation anticipated exactly this moment as the point to
revisit. **Recommendation: move from Option D (permanently standalone) to a deliberate Option C
activation (bonus, not re-split) — see below.**

### Scoring 3.0 candidates (≥3 compared, per the task's requirement)

| | **Option A — Direct re-split into total** | **Option B — Independent skill bonus into total** | **Option C — Keep total = pizza quality; CUT stays separate (status quo)** |
|---|---|---|---|
| Description | Fold CUT into the existing 4-component weighted average (e.g. re-derive Sauce:Pieces:Recipe:Bake:Cut weights summing to 100) | Add a small, additively-capped CUT bonus on top of the existing `total` (same shape as the efficiency-bonus pattern already used for Pitz, §4) — total = pizza-quality total + bounded CUT bonus | No change: CUT stays a fully separate, display-only score |
| Player clarity | Confusing — every existing recipe's "same pizza, different score" expectation breaks; retroactively changes the meaning of every historical BEST score | Clear if labeled well ("cutting skill bonus"); total still primarily reflects pizza quality | Clearest single-purpose meaning per score, but the CUT number visually looks like it "should" matter and currently doesn't — this is the player confusion the user is actually reporting |
| Existing score compatibility | **Breaks** — every stored `bestScore`/`bestStars`/Dex BEST becomes non-comparable pre/post change (the exact regression §14's Option B was rejected for) | Compatible if the bonus is capped and the base pizza-quality total is unchanged in isolation (BEST comparisons need a documented "score includes a CUT bonus now" migration note, but old best scores remain valid lower bounds) | Fully compatible, zero migration |
| ★ impact | Yes, materially — star thresholds are on `total`, so bad cutting could now drop stars for an otherwise perfect pizza | Only at the margin (small bonus near a threshold) — same category of effect the efficiency Pitz bonus already accepts for Pitz, but stars are more visible/permanent than Pitz | None |
| Pitz impact | Indirect via `qualityMultiplierForScore(total)` — CUT would now influence currency, an entirely new economy lever | Same indirect effect, but bounded/small by design | None |
| Lunch Rush impact | `missionScore` sums `ScoreBreakdown.total` per serve — CUT skill would now affect mission ranking, which changes the actual mission-clear bar mid-season for players who already recorded scores | Same, but bounded | None |
| Ranking impact | Weekly leaderboard `qualityTotal` shifts retroactively in meaning; already-submitted scores become non-comparable to future ones on the same board | Same risk, smaller magnitude | None |
| Past `bestScore`/BEST impact | Existing Dex BEST records become "under-counted" relative to future rounds — a real regression risk flagged by the original Option B rejection | Same category of risk but much smaller in magnitude (a capped bonus, not a full re-weight) | None |
| Test impact | Large — every Golden Matrix fixture, `scoringV2.test.ts`'s per-recipe pinned totals, `missionScoring` tests, Pitz reward band tests all need review/re-pinning | Moderate — new bonus function + its own tests, but base component tests untouched | None |

**Recommendation: Option B (independent, capped bonus into total), not Option A, and not indefinite
Option C.** Rationale:

- Option A was already explicitly rejected once, for a still-valid reason (retroactive
  re-weighting of every recipe's score meaning) that has not changed.
- The design doc's own Option D was never "keep this separate forever" — it was "separate until a
  real Scoring 3.0 slice with real data exists." That slice is now enterable (15/15 recipe coverage
  exists; Human Feel data can now be collected across many recipes, not one).
- A capped additive bonus mirrors a pattern this codebase already ships and already accepts the
  tradeoffs of: the cooking-time efficiency Pitz bonus (§4) is exactly this shape — a secondary,
  bounded, clearly-labeled bonus that never lets a secondary skill dominate or invert the primary
  quality signal. Reusing that same pattern for CUT (e.g. "CUT skill bonus, up to +N% of total,
  gated on already scoring well on the base pizza") keeps the mental model consistent across the
  whole game rather than introducing a second, differently-shaped mechanism.
- This still requires: (1) a real product decision on the bonus's cap/shape (do not invent numbers
  here — this audit is not authorized to set scoring coefficients), (2) a dedicated regression
  suite pinning old vs. new `total` for every existing Golden Matrix fixture, (3) an explicit
  Result Report note that Dex BEST comparisons before/after the change are not apples-to-apples,
  and (4) Human Feel verification specifically on whether players *notice and understand* the new
  bonus rather than just "the number moved." None of this should ship in the same PR as any of the
  other 6 items in this audit — see PR-F in §12.

## 4. Audit B — Cooking Time / 手際

### A. Exact thresholds

`src/logic/efficiency.ts`:

```
BASE_COMFORTABLE_MS = 25_000
PER_ITEM_COMFORTABLE_MS = 3_000
NORMAL_WINDOW_MS = 35_000

comfortableMs = 25_000 + 3_000 × totalRequiredItemCount(recipe)   // sum of every RecipeRequirement.minCount
normalUpperMs = comfortableMs + 35_000

completedMs <= comfortableMs           → GOOD   ("スムーズ")
comfortableMs < completedMs <= normalUpperMs → NORMAL ("ふつう")
completedMs > normalUpperMs (or invalid) → SLOW  ("ゆったり")
```

For the user's screenshot (調理時間 0:57 → 手際 ふつう): a recipe whose `totalRequiredItemCount`
places `comfortableMs` below 57 000 ms and `normalUpperMs` above it classifies as NORMAL — the
formula is exact and reproducible per-recipe from `minCount` sums; no separate "57s = normal"
magic constant exists, it falls out of the two constants above plus that recipe's own ingredient
count.

### B. Rank names

`スムーズ` (GOOD), `ふつう` (NORMAL), `ゆったり` (SLOW) — deliberately non-judgmental naming (no
"遅い"/"下手"), per the module's own comment.

### C–G. Does time/efficiency affect total / Pitz / multiplier / ★ / Lunch Rush?

| Consumer | Affected? | Mechanism |
|---|---|---|
| `ScoreBreakdown.total` | **No** | `efficiency.ts` header: "never mixed into `ScoreBreakdown.total`" |
| ★ stars | **No** | No reference to efficiency/timing anywhere in `scoring.ts` |
| Pitz `qualityMultiplier` | **No** | `qualityMultiplierForScore` is untouched by efficiency |
| Pitz reward (total credited) | **Yes — but as a second, independent, additive credit**, not a multiplier change | `REGISTER_TO_DEX`: `pitzBalance = pitzBalanceAfterQuality + (lastEfficiencyCredit?.bonusPitz ?? 0)`. Bonus rate table is quality-gated: max 10% of `baseRewardPitz` (only if score ≥90 AND GOOD), 0% below score 60, 0% at SLOW regardless of score. Explicitly never compounds with the quality multiplier (applied to `baseRewardPitz`, not `earnedPitz`). |
| Lunch Rush | **No** | `evaluateCookingEfficiency` is gated `!state.isMissionRound` — Mission/Lunch Rush rounds never receive an efficiency credit at all |

The 出来栄え倍率 ×1.00 shown in the user's screenshot is the Pitz quality-multiplier band display
(unaffected by efficiency); efficiency instead would appear as a separate additive bonus line if
one is due, not as a change to that multiplier.

### H. Does BAKE/CUT time count toward "total cooking time"?

**BAKE: excluded.** `cookingTiming.ts` measures `BEGIN_PREPARE → START_BAKE` only, by explicit
design ("BAKE's own needle-tap minigame is deliberately excluded ... never reads anything from
`../logic/bake.ts`"). The Cooking-Time Fresh Audit explicitly rejected including BAKE, calling it
*"double jeopardy"* since BAKE time is *"already a skill-timing minigame scored by Scoring 2.0's
Bake component."*

**CUT: measured per-step but excluded from the whole-round total.** `perStepElapsedMs.CUT` is
populated (CUT is a valid `MakingStep`, and `advanceStepTiming` fires during POST_BAKE too), but
`completedMs` (the value efficiency reads) is finalized at `START_BAKE` and never re-touched —
so CUT time is captured as diagnostic per-step data but plays no role in the 手際 tier or its Pitz
bonus.

**Pause/background handling**: a genuine `document.visibilitychange` + `window` `blur`/`focus`
listener pair (`src/App.tsx`), OR'd with any overlay being open (Reference popover/Dex/Shop/
Inventory), dispatches `PAUSE_COOKING_TIMING`/`RESUME_COOKING_TIMING`; paused time is excluded from
`completedMs` via an `accumulatedPauseMs` accumulator. This is a real listener-based pause, unlike
the Bake Guide fade (Audit H), which deliberately relies on rAF-throttling instead.

Cross-check against `docs/reports/TETO_COOKING-TIME-EFFICIENCY_Fresh-Audit.md` and
`TETO_COOKING-TIME_CT2_Efficiency-Result.md`: **no drift** — code matches both documents' formulas
and boundary choice byte-for-byte.

## 5. Audit C — Step Target Times

### Matrix (measured / persisted / score-relevant / target exists)

| Step | Measured? | Persisted? | Score/reward relevant? | Existing target time? |
|---|---|---|---|---|
| DOUGH | Yes (`perStepElapsedMs.DOUGH`) | No (transient `GameState`, never serialized) | No | **No — none found anywhere in code/data/docs** |
| SAUCE | Yes | No | No | No |
| CHEESE | Yes | No | No | No |
| TOPPING | Yes | No | No | No |
| BAKE | **Not measured at all** (not a `MakingStep`; has its own separate needle-position scoring instead) | N/A | N/A | No |
| CUT | Yes (`perStepElapsedMs.CUT`) | No | No — `cutScore` is purely geometry-based | No |

Only the whole-round `completedMs` (PREPARE-phase only) feeds the 手際 tier/Pitz bonus (Audit B);
no per-step time is read by any scoring/reward path today. **No target time — per-step or
whole-round beyond `comfortableMs`/`normalUpperMs` — exists anywhere for an individual step.** Per
the task's explicit instruction, this audit does not invent one.

### Design implications for a "current step / elapsed / target" display

Since `perStepElapsedMs` already exists as a live-updatable field, a **prior-step elapsed time**
display (DOUGH took you 8s) is cheap to surface today (data already collected, just not yet read
by any UI). A **live current-step elapsed counter** requires only reading `cookingTiming.stepStartedAt`
each render tick (no new state). A **per-step target time**, however, does not exist and per the
task's explicit instruction must not be invented — the only currently-grounded time reference is
the whole-round `comfortableMs`, which is itself only meaningful summed across a whole round (it is
derived from total `minCount` across all ingredient categories, not any one step). Recommendation:
this needs an explicit design decision (real playtest data, or a per-step proportional slice of
`comfortableMs` — e.g. weighting each step's share by its own `minCount` contribution — as a
starting hypothesis to validate, not a shipped constant) before any UI ships a number labeled "目安
時間" per step.

Proposed UI shape (matches the task's own suggestion, not yet designed in detail):

- **During play**: current step name + elapsed seconds (cheap, already-collected data) is safe to
  ship without a target-time decision. Showing elapsed-only, no target, is the safe first slice.
  Adding "目安 YY秒" per step requires the target-time design decision above first.
- **RESULT details**: a 工程 | 実績 | 目安 table is only fully populate-able for the 実績 (actual)
  column today (`perStepElapsedMs`, once it's persisted through to RESULT — currently it is not:
  confirm during implementation whether `cookingTiming` needs to survive into `RESULT`/`DISCOVERED`
  phase state, since today nothing reads it there).
- **Speed-pressure risk**: flagged per the task's own concern — a highly visible running countdown
  risks pushing players toward "faster over careful," which directly contradicts this repo's
  existing efficiency design philosophy (`efficiency.ts`'s own non-judgmental tier names, and the
  explicit "quality primary, time secondary bonus" principle already stated in Issue #37). Any
  elapsed-time display should stay low-emphasis (small, neutral-colored, no countdown/alarm
  styling) to avoid re-introducing the "faster is always better" pressure the existing design
  deliberately avoided.
- **FREE vs. Lunch Rush**: Lunch Rush already deliberately excludes cooking-time efficiency (Audit
  B) — a live per-step timer in Lunch Rush would visually suggest time matters there when it
  currently doesn't affect anything, which would be actively misleading. Recommend: if implemented,
  gate the elapsed/target display to FREE mode only, consistent with the existing
  `!state.isMissionRound` gate efficiency itself already uses.

## 6. Audit D — RESULT 1-Screen

### Current Truth

FREE's RESULT/DISCOVERED phases are already merged into one screen (RESULT 2.0 Slice 1, PR #75,
merged) with an already-lean render tree: `.app-header` → `PizzaStage` (shared, unchanged instance
from BAKE) → `ResultPanel`. The dialogue area and step-nav tabs are both already stripped out at
RESULT specifically to reclaim vertical space.

`ResultPanel`'s own stacked sections, in order: heading → stars/score/bake-badge headline →
(discovery/BEST banner, conditional) → (starter-grant notice, conditional) → Pitz credit `<dl>`
(always, 3–6 rows) → CUT evaluation `<details>` (now shown for **all 15** CUT-eligible recipes,
default-closed since PR "Visual Polish 2.0C P1-5") → "くわしいスコアを見る" `<details>` (always,
default-closed) → CTA row.

**The `.game-screen` container is the app's only scroll container by deliberate architecture**
(`overflow-y:auto`), and the Phase0 Fresh Audit states outright that *"RESULT is the one screen
designed to use [the scroll fallback]"* — an existing Playwright test
(`e2e/viewport-1screen.spec.ts`, `FREE RESULT` describe block) explicitly asserts the CTA is
reachable *by scrolling*, not that it fits without scrolling. This is the opposite contract from
every MAKING-phase screen, which are asserted to need **zero** internal scroll.

**Measured overflow** (`TETO_VISUAL-POLISH_2.0C_Fresh-Audit.md`, real Chromium
`getBoundingClientRect()`+pointer-gesture measurements, before the P1-5 CUT-collapse fix):
390×844 CTA-bottom overflow ranged **104px (no-CUT, first discovery) to 253px (CUT, first
discovery)**; 360×800 ranged **128.8px to 277.8px**. After the P1-5 fix (collapsing the CUT card by
default), the CUT-bearing scenarios improved by exactly 112px each but **the report's own verdict
was "B — improved, but not resolved"**: every one of its 6 measured scenarios still put the CTA
below the fold, best case 44px over at 390×844 (a retry round), worst case 165.8px over at
360×800 (first discovery).

**Load-bearing fact this audit adds**: those measurements were taken when CUT was margherita-only.
**CUT is now enabled on all 15 shipped recipes** (Phase 4B, this audit's own base SHA) — the
"funghi, no CUT" best-case row in every prior measurement **no longer exists as a real scenario**.
Effectively every RESULT screen today includes the CUT `<details>` (collapsed by default, but its
`<summary>` line still adds height, and its ~150px-when-expanded cost — previously rare — is now
something almost every player can trigger). **The scrolling problem is very likely more universal
today than when it was last measured.**

Root structural cause of the *unreachable-without-scroll* CTA specifically (not just "content is
long"): RESULT's CTA row uses the generic `.action-row` class (`margin-top: auto`, normal document
flow) rather than the `position: fixed` `.prepare-bake-bar` pattern every MAKING-phase CTA already
uses. The codebase's own CSS comment states plainly that `margin-top: auto` "only pushes to the
bottom of content that already fits on screen" — i.e., it provides no guarantee at all once content
overflows, unlike a fixed-position bar.

### Reusable pattern already in the codebase

A native `<details>`/`<summary>` disclosure pattern is **already used twice** inside
`ResultPanel.tsx` itself (the CUT card and the "くわしいスコアを見る" score-breakdown card) — no
JS state, shared CSS arrow-toggle convention, already tested. **No other part of the app uses any
accordion pattern** (MAKING solved its own budget with static hand-tuned px caps instead; the
Reference popover is a modal, not a disclosure). A RESULT redesign should extend this exact
existing convention rather than invent a new one.

### Recommendation

Two independent, additive fixes, doable as separate small PRs:

1. **Fix the CTA reachability contract first** (smallest, most surgical, matches the 2.0C report's
   own already-identified "Option A" fix): give RESULT's CTA row the same `position: fixed`
   `.prepare-bake-bar` treatment every MAKING screen already uses. This alone makes the CTA always
   reachable regardless of content length, without touching information architecture at all.
2. **Reduce first-view height via Summary/Details reorganization**, reusing the existing native
   `<details>` convention: keep on the always-visible "first view" only what's already unconditional
   and short (finished pizza at its current default-size PizzaStage instance, heading, stars+total,
   a one-line CUT summary, a one-line Pitz-reward summary, CTAs); move the Pitz credit breakdown
   rows, the full CUT breakdown, and the sauce/pieces/recipe/bake score bars into `<details>` blocks
   (the CUT one already is one; the Pitz `<dl>` currently is not). This satisfies "no information
   deleted, just re-homed" per the task's explicit requirement.
3. Re-run the exact `getBoundingClientRect()` region-table methodology the Phase0/2.0C audits
   already used (real Chromium measurements, both 390×844 and 360×800, per-`ResultPanel`-subsection
   `y/height/bottom`) against the *new* layout before calling this done — do not assume the fix
   fits from CSS alone, per that same methodology's own stated rationale (font/engine/toolbar
   variance already burned this exact codebase once).

## 7. Audit E — Finished Pizza Visual 2.0

### Current Truth

**PREPARE/BAKE/CUT/RESULT all share one `PizzaStage` component** — literally the same mounted
instance carried across phase transitions, differing only by props (`interactive`,
`resultRevealed`, `roomy`/`compact`, `bakeProgress`). **Reference/"見本" views never import
`PizzaStage` at all** — they are architecturally separate, sharing only two extracted low-level
primitives (`SauceHeatmapCanvas` for the sauce raster, and `renderPizzaVisualPieces` for static
piece positioning), fed the *ideal* fixture rather than the player's live data.

**Bake visuals are already continuous, not a 3-state snap** (`src/logic/bakeVisual.ts`,
`computeBakeHeat`: 0→raw, 1→perfect/center-of-target, 2→fully burnt, piecewise-linear, no seam).
**Cheese already has real melt/spread/browning**: a 5-keyframe `cheeseVisualFrame` interpolation
drives `--bake-melt-scale` (up to 1.16× scale-up = "spread") plus
`brightness()`/`saturate()`/`sepia()` filters (= melt-brighten then toast/char), all pure CSS
`transform`+`filter`, no new assets.

**Non-cheese toppings get *some* continuous browning too, but via what looks like an unintentional
code path**: `IngredientPieceVisual`'s emoji branch applies the same cheese-derived
`brightness/saturate/sepia` `style` prop the code's own comments call "a no-op for the emoji
branch" — it is not a no-op (a CSS `filter` never is), and it silently overrides the emoji's
baseline `drop-shadow`. A separate, intentional, discrete 3-bucket wrapper filter
(`.pizza-dough--raw/--perfect/--burnt .pizza-topping`) also applies and stacks with it. Net effect:
non-cheese toppings already visibly brown/tint through bake today, just through two overlapping
mechanisms (one probably accidental) rather than one clean, dedicated one — and they never change
*shape* (no shrink, no curl) at any bake stage, remaining flat emoji glyphs throughout.

**RESULT preserves the player's real recorded state exactly** — `state.pizza` (toppings, sauce
deposits, dough shape) is carried unchanged from PREPARE through BAKE into RESULT with no
regeneration step, and `bakeProgress` at RESULT reads the player's own final `bakeResult`, not an
idealized value. **Reference is, and architecturally must remain, the less-baked-looking of the
two** — it has no `bakeHeat` concept at all (always flat "how to build it" geometry) — so the
player's own completed pizza already looks more finished than the construction diagram, which is
the correct relationship for their respective purposes.

**Rendering technology**: 100% DOM + CSS (gradients, `box-shadow`, `border-radius`, `filter`,
`transform`, SVG `clipPath` for the dough boundary) + one Canvas 2D layer for sauce only. No WebGL,
no SVG filters, **zero image assets for any ingredient** (`ingredient.emoji`, a Unicode glyph, is
the only per-ingredient "art" that exists today).

### Option comparison (3 requested)

| | **A — Make Reference itself more "baked"** | **B — RESULT-only baked transform (recommended)** | **C — Continuous transform from BAKE onward (status quo, extend it)** |
|---|---|---|---|
| What it means | Give the construction-target Reference view its own bake-state rendering | Add/extend baked-looking CSS treatment specifically gated on `resultRevealed`/final `bakeResult`, layered on the existing shared `PizzaStage` | Keep (and clean up/extend) the already-existing continuous `bakeHeat`-driven treatment that already runs live from BAKE through RESULT |
| Fits current architecture | Poor — Reference is deliberately geometry-only, no `bakeHeat` concept exists there, and its own docs state it must represent "construction target, never a cut-line/doneness target" | Good — precedent already exists (`.pizza-perfect-glow`, a RESULT-only flourish layered on the same shared pipeline) | Good — this is literally already how cheese behaves today, needs only extension/cleanup, not new architecture |
| New assets needed | No (CSS-only), but conceptually wrong purpose for Reference | No — CSS-only per Audit E's technology review | No — CSS-only |
| Risk | Confuses Reference's own purpose (would need an explicit new design decision to justify) | Low — isolated to RESULT-only code paths, testable in isolation | Low, but requires deliberately fixing the likely-accidental non-cheese filter reuse first so the "existing" behavior being extended is actually the intended one |
| Addresses user's actual complaint | No — user's complaint is specifically about the *finished/RESULT* pizza, not Reference | **Yes, directly** | Partially — already true today for cheese, but non-cheese topping treatment needs a deliberate (not accidental) implementation first |

**Recommendation: B, but implemented by cleaning up and deliberately extending C's existing
mechanism** rather than building something wholly new — i.e., give non-cheese toppings their own
named `toppingVisualFrame`-style curve (fixing the accidental filter-reuse bug found in this
audit), consider a RESULT-only oil-sheen flourish reusing the existing `.pizza-sauce-oil-sheen`
pattern, and evaluate `border-radius`/`filter:blur()` edge-softening — all pure CSS/JS, no new
image-asset pipeline required. Genuinely irregular melt-pool silhouettes, browned-bubble texture,
or per-ingredient illustrated crisping are the one category that **would** need new image assets
(the renderer has zero illustrated art today) — flag as a separate, larger, explicitly asset-driven
future slice, not part of the near-term CSS-only work.

## 8. Audit F — Skip Unnecessary Steps

### Current Truth

`CookingProfile.steps` (`src/data/cookingProfiles.ts`) is a **data shape capable of per-recipe
variation** (`COOKING_PROFILE_OVERRIDES` exists as an escape hatch), but **in practice it never
varies today** — `COOKING_PROFILE_OVERRIDES` is an empty map, and every one of the 15 shipped
recipes resolves to the exact same `["DOUGH","SAUCE","CHEESE","TOPPING","CUT"]` (all are
CUT-eligible; `DEFAULT_COOKING_PROFILE` is the same literal 4-array for every recipe). Tab
rendering (`MakingStepTabs.tsx`) already takes `steps`/`postSteps` as props (not hardcoded), and
step-navigation (`nextStepWithin`/`CONFIRM_MAKING_STEP` in `gameReducer.ts`) already walks an
arbitrary `steps` array generically — **neither of these needs new logic to support skipping.** The
entire gap is that `getCookingProfile` never derives `steps` from `requiredIngredients` category
membership.

Design docs (`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` and its Phase reports) established
`CookingProfile` as a mechanism for **adding** genuinely new interaction moments (CUT, FOLD, SEAL,
EDGE_FILL, FINISH) — never as a mechanism for **omitting** the DOUGH/SAUCE/CHEESE/TOPPING core,
which they explicitly call out as "CORE (existing, universal) ... kept as-is." **This is new scope,
not something already solved.**

### Recipe × step necessity matrix (all 15 shipped recipes)

| Recipe | DOUGH | SAUCE | CHEESE | TOPPING | BAKE | CUT |
|---|---|---|---|---|---|---|
| margherita | Y | Y | Y | Y | Y | Y |
| **marinara** | Y | Y | **N** | Y | Y | Y |
| **quattro-formaggi** | Y | Y | Y | **N** | Y | Y |
| genovese | Y | Y | Y | Y | Y | Y |
| bismarck | Y | Y | Y | Y | Y | Y |
| funghi | Y | Y | Y | Y | Y | Y |
| **fugazza** | Y | Y | **N** | Y | Y | Y |
| salsiccia | Y | Y | Y | Y | Y | Y |
| pepperoni | Y | Y | Y | Y | Y | Y |
| napoletana | Y | Y | Y | Y | Y | Y |
| tonno-e-cipolla | Y | Y | Y | Y | Y | Y |
| **pizza-bianca** | Y | Y | **N** | Y | Y | Y |
| breakfast-pizza | Y | Y | Y | Y | Y | Y |
| capricciosa | Y | Y | Y | Y | Y | Y |
| meat-lovers | Y | Y | Y | Y | Y | Y |

CHEESE is unnecessary for 3/15 (marinara, fugazza, pizza-bianca); TOPPING is unnecessary for 1/15
(quattro-formaggi); DOUGH/SAUCE/BAKE/CUT are universal today. Marinara's own recipe description
text says outright "チーズを使わない" (uses no cheese) — confirmed against `requiredIngredients`
(no mozzarella/gorgonzola/parmigiano/fontina entry).

### Important distinction the task asked not to blur

"No cheese ingredient in `requiredIngredients`" and "the CHEESE step has nothing to do" are
**currently the same signal**, because `IngredientTray.tsx` was already changed (Issue #159) to
show *only* ingredients a recipe's `requiredIngredients` names — the old "optional/bonus browsing"
tray behavior was deliberately removed. So for all 15 shipped recipes today, a 0-cheese recipe's
CHEESE tab is provably empty; there is no shipped concept of an "optional, non-required" ingredient
that could make CHEESE meaningful despite zero required cheese items. **This equivalence is
incidental to the current data model, not a documented invariant** — flag this explicitly if a
future "optional/bonus ingredient" feature is ever added, since it would break the equivalence this
audit's skip design would otherwise safely rely on.

### Architectural risk / touch points for a skip implementation

- `DEFAULT_COOKING_PROFILE`/`getCookingProfile` (`cookingProfiles.ts`) is the one place that needs
  new logic — either per-recipe `COOKING_PROFILE_OVERRIDES` entries, or (better, scales to future
  recipes automatically) generalizing `getCookingProfile` to derive `steps` from which ingredient
  categories a recipe's `requiredIngredients` actually touches.
- `src/App.css`'s `.making-step-tabs`/`.making-step-tab`/`.making-step-tab--bake` flex-sizing rules
  were tuned assuming exactly 6 items in the strip — removing a tab changes every other tab's
  proportional flex share and must be re-verified against the same real-device margin math the
  Phase0 audit already used.
- **Zero existing e2e coverage** for a recipe with a skipped step — `e2e/making-ui-1screen.spec.ts`'s
  only exercised scenario is Margherita (all 6 steps present). A skip implementation needs new e2e
  coverage using Marinara/Fugazza/Pizza-Bianca (no cheese) and Quattro Formaggi (no topping) as
  fixtures, not just new unit tests.
- `nextStepWithin`/`CONFIRM_MAKING_STEP` (`gameReducer.ts`) and `makingStepToCategory` (`App.tsx`)
  need **no changes** — they already handle an arbitrary `steps` array/step set generically.
  `completionGate.ts` has zero CHEESE-specific coupling, so no interaction there either.

### Recommendation

Generalize `getCookingProfile` to derive `steps` from `requiredIngredients` category membership
(omit CHEESE when zero required cheese-category ingredients; omit TOPPING when zero required
topping-category ingredients — matches Marinara/Fugazza/Pizza-Bianca and Quattro Formaggi exactly,
with zero new per-recipe data entries needed). This is safe under the current data model (per the
distinction above) and needs no reducer/navigation changes — only new tab-strip CSS verification
and new e2e fixtures for the 4 affected recipes. Document the "0 required ingredients of category
X ⇒ skip step X" rule explicitly as a real invariant (not just an emergent coincidence) so a future
optional-ingredient feature is forced to reconsider it deliberately rather than silently breaking
it.

## 9. Audit G — Bake Tab Emoji

### Current Truth

Exactly two rendered 🔥 instances in the whole codebase: the non-interactive BAKE tab indicator
(`MakingStepTabs.tsx`, `aria-hidden="true"`) and the separate, structurally distinct "🔥 焼く！"
primary CTA button (`GameScreen.tsx`). The user's complaint is about the former.

Tab sizing is fully flex-based (`flex: <grow> 1 0; min-width: 0`, `white-space: nowrap; overflow:
hidden; text-overflow: ellipsis`), not fixed-width — every tab, including the BAKE indicator,
already shrinks proportionally to fit the row. At 390px viewport with a full 6-item strip
(Margherita-shaped: DOUGH/SAUCE/CHEESE/TOPPING flex-grow 1 each + BAKE flex-grow 0.7 + CUT
flex-grow 1 = 5.7 total), the BAKE tab's own share is roughly **~43px** (CSS-math estimate, not
pixel-measured). The codebase's own CSS comment documents that this exact tab was previously the
site of a real overflow bug ("「焼く」のはみ出し", Issue #167/#159) directly attributed to Apple
Color Emoji glyph-metric variance — this is not a hypothetical risk, it already happened once.

**The emoji is purely decorative today**: the wrapping element is already `aria-hidden="true"`, no
aria-label depends on it, and **zero** test files (`*.test.ts(x)`/`e2e/*.ts`) match on the literal
emoji character — every test matches the plain-text substring "焼く" via regex, which will continue
to match with or without the emoji prefix. **Removing it requires no test updates.**

No other step tab has an emoji (`STEP_LABEL` is plain text for every real tab: 生地/ソース/チーズ/
具材/カット/etc.) — 🔥 is the *only* emoji in the entire tab strip, appearing solely on this one
hardcoded indicator, not through the shared label-rendering path other tabs use.

### Recommendation

Remove the emoji from the BAKE **tab** indicator specifically (`MakingStepTabs.tsx`). This
directly reduces pressure on the tab previously responsible for a real overflow bug, requires zero
test changes, and has no accessibility impact (already `aria-hidden`). The separate BAKE **CTA
button** ("🔥 焼く！", `GameScreen.tsx`) is a different, larger, non-cramped element — leave it out
of scope for this specific fix unless the user also wants full cross-surface consistency, which is
a separate, so-far-unrequested decision (the task's own item 5 only asked about the narrow tab).

## 10. Audit H — Bake Guide Fade

### Current Truth: **this feature already exists, merged (PR #68), and already matches the user's
own described target design.**

`src/logic/bakeGuideFade.ts`:

```ts
GUIDE_FADE_START_S = 3.6   // ~1 full needle sweep — zone seen whole at least once
GUIDE_FADE_END_S = 7.2     // ~2 full sweeps — fully hidden from here on

computeGuideOpacity(elapsedSeconds):
  elapsedSeconds <= 3.6 → 1
  elapsedSeconds >= 7.2 → 0
  else → linear 1→0 between them
```

This is fixed-time fade (Option A in the task's own framing), confirmed by the code (the function
takes only elapsed time, no needle-position argument) and by the merged PR's own description:
*"never by needle proximity to `targetStart`/`targetEnd` — the brief's own constraint against
exposing the scoring boundary as fade timing."* A needle-proximity fade (Option B) was explicitly
considered and rejected for exactly the reason the task's own brief worries about: it would itself
leak where the target zone is.

**After the guide fades, the pizza's own visual state remains judgeable — this was the explicit
purpose of the same PR's Phase 2 work.** `src/logic/bakeVisual.ts`'s continuous `bakeHeat` scalar
drives dough color and cheese melt/toast/char continuously with no discontinuity at the scoring
boundary — replacing an earlier implementation that *did* snap discretely exactly at the
score-relevant boundary (an "unintentional answer reveal" the same PR's audit found and fixed
specifically so the fade feature wouldn't be defeated by it).

`CONFIRM_BAKE` scoring is provably independent of Guide visibility: the action payload carries only
`{type, value}`, no timing/fade field exists to score against, and a dedicated regression test
(`gameReducer.bakeGuideRegression.test.ts`) pins identical scores for identical taps regardless of
elapsed BAKE time.

### 3-option comparison (already resolved in the shipped implementation)

| | A — Fixed time (shipped) | B — Needle-position/proximity | C — Skill/play-count adaptive |
|---|---|---|---|
| Predictable/testable | Yes — deterministic, exactly what the regression test pins | No — would need to encode a "distance to answer" concept purely for fade timing | No — needs a play-count/mastery model that doesn't exist |
| Leaks the scoring boundary | No | **Yes — rejected for exactly this reason** | Not inherently, but adds unrelated complexity |
| Already implemented | **Yes** | No | No — not discussed in any prior doc found |

No prior doc discusses Option C (skill/mastery-adaptive fade) at all — only fixed-time (chosen) vs.
proximity-based (rejected) were compared during the original M3A work.

### Recommendation

**No new implementation needed for this item.** If the task's underlying real complaint is that
the *current* fixed 3.6s/7.2s window feels wrong in practice (too fast, too slow, or the post-fade
color cues aren't legible enough on a real device), that is a **tuning/Human-Feel question**, not a
design/architecture question — the mechanism the task describes is already exactly what's shipped.
Recommend: confirm with the user whether their complaint is about the *existence* of a fade (already
solved) or its *current timing/legibility* (would need a real-device Human Feel pass measuring
whether players can still call good/bad timing correctly after 7.2s, which no report found evidence
of being tested against real users yet — only automated/Playwright verification exists per the
M3A Result Report).

## 11. Cross-System Interaction (dependency graph)

```
Step Timing (perStepElapsedMs, cookingTiming.completedMs)
        │
        ├─(whole-round completedMs only)──► 手際 tier (efficiency.ts)
        │                                          │
        │                                          └─(additive, quality-gated, capped ≤10%)──► Pitz reward (bonus line, additive to baseRewardPitz)
        │
        └─(per-step, currently unused by anything)  [no downstream consumer today]

Scoring 2.0 (sauce/pieces/recipe/bake components) ──► ScoreBreakdown.total
        │                                                    │
        │                                                    ├──► ★ stars (via starsFromTotal + capStarsForBake on bakeState)
        │                                                    ├──► Pitz qualityMultiplier (qualityMultiplierForScore(total))
        │                                                    ├──► Lunch Rush missionScore (sum of served-pizza totals)
        │                                                    └──► Firebase Ranking qualityTotal (= total, submitted per serve)
        │
CUT score (cutScore, src/logic/cut) ──✕── (today: fully isolated, display-only; NOT wired into total/★/Pitz/Lunch Rush/Ranking)
        │
        └─(THIS AUDIT'S Option B recommendation, not yet decided/implemented)──► would become a bounded additive term on `total`
                                                                                        │
                                                                                        └─(if implemented)──► ripples into ★, Pitz, Lunch Rush, Ranking — see §3's option table for exact impact per consumer

Bake Guide Fade (bakeGuideFade.ts, elapsed-time only) ──✕── (deliberately) no path into CONFIRM_BAKE scoring at all — regression-tested isolation

RESULT rendering (PizzaStage shared instance + bakeVisual.ts) ──reads──► state.pizza (player's real recorded placement/sauce/dough/bakeResult), unmodified since PREPARE
Reference rendering (ReferencePreview/ReferenceThumbnail) ──reads──► idealized fixtures only, architecturally cannot read bakeHeat/player state

Cooking Profile (cookingProfiles.ts CookingProfile.steps) ──drives──► MakingStepTabs tab list + CONFIRM_MAKING_STEP step-walk order
        │
        └─(currently uniform for all 15 recipes; this audit's Audit F recommendation would make it requiredIngredients-derived)
```

**The one live cross-system link the 7 items actually share today is Pitz**: both the timing/
efficiency bonus (Audit B, shipped) and a potential future CUT bonus (Audit A, proposed) are
additive terms layered onto the Pitz reward pipeline, using the same "small, quality-gated, capped,
never compounding with the base quality multiplier" shape. Everything else (RESULT layout, finished
-pizza visuals, dynamic step skip, bake emoji, bake-guide-fade tuning) is presentation-layer and has
**zero** scoring/economy blast radius by construction — this is exactly why §12's PR split keeps
Scoring 3.0 (PR-F) isolated from the other five.

## 12. Recommended PR Split

| PR | Scope | Dependencies | Risk | Tests | Human Verification | Est. effort |
|---|---|---|---|---|---|---|
| **PR-A — Dynamic Cooking Steps** | Generalize `getCookingProfile` to derive `steps` from `requiredIngredients` category membership (skip CHEESE/TOPPING when a recipe requires none); remove 🔥 from the BAKE tab indicator; new e2e fixtures for the 4 affected recipes; navigation regression tests | None on other PRs | Low-medium (touches tab flex-sizing math for all recipes, needs real-device re-verification) | New unit tests for `getCookingProfile` per-recipe derivation; new e2e for marinara/fugazza/pizza-bianca/quattro-formaggi; existing Margherita e2e as regression | Required — gameplay/UI change | ~2–3h |
| **PR-B — Bake Guide Tuning (conditional)** | Only if Human Feel confirms the *existing* fixed-time fade (already shipped) needs its window (3.6s/7.2s) or post-fade color legibility retuned; otherwise **skip this PR entirely** | None | Low if scoped to constant tuning only | Existing `bakeGuideFade.test.ts`/`bakeVisual.test.ts`/regression test extended for new constants | Required if any visual/timing constant changes | ~1–2h, or 0 if not needed |
| **PR-C — Timing Transparency** | Live current-step elapsed-time display (FREE only, low-emphasis styling); persist `perStepElapsedMs` through to RESULT phase state; RESULT details 工程/実績/目安 table (実績 column only until a target-time design decision is made — do not ship an invented 目安 column) | None (target-time design decision is a separate, later follow-up, not a blocker for shipping elapsed-only) | Low — additive display only, no scoring change | New unit tests for elapsed-time formatting; new component tests for RESULT timing table; explicit test that Lunch Rush does NOT show this UI | Required — new gameplay UI | ~2–3h |
| **PR-D — RESULT 1-Screen 2.0** | Fixed-position CTA bar (reuse `.prepare-bake-bar` pattern) + Summary/Details reorganization (move Pitz breakdown into a `<details>`, keep only 1-line summaries in the always-visible view) + fresh `getBoundingClientRect()` region-table verification at 390×844/360×800 for all 15 CUT-eligible recipes (not just Margherita) | None, but should land after PR-A if PR-A changes which tabs/steps show (unlikely to conflict, but sequence for clean rebases) | Medium — this is the item with the most existing measured evidence of being genuinely hard (2.0C's own prior attempt only partially fixed it) | Extend `e2e/viewport-1screen.spec.ts`'s `FREE RESULT` describe block to assert CTA visible **without** scroll, not just reachable by scrolling; re-run the region-table script for CUT + no-CUT + first-discovery + retry scenarios | Required — layout change, both viewports | ~3–4h (largest single item) |
| **PR-E — Finished Pizza Visual 2.0** | Fix the accidental cheese-filter reuse into a dedicated, deliberate `toppingVisualFrame`-style continuous curve for non-cheese toppings; consider a RESULT-only oil-sheen/edge-softening flourish reusing existing `.pizza-sauce-oil-sheen`-style patterns; explicitly defer illustrated-asset-level effects (melt-pool silhouettes, curling edges) as a separate future slice | None | Low-medium (pure CSS/JS, but touches every recipe's bake visuals — needs regression screenshots across several ingredient types, not just Margherita) | Extend `bakeVisual.test.ts` for the new per-category curve; visual regression screenshots for a cheese-heavy, topping-heavy, and no-cheese recipe | Required — visual change across multiple recipes | ~2–3h |
| **PR-F — Scoring 3.0 (CUT/total relationship)** | Only after the product owner has explicitly decided Option A/B/C from §3; if Option B, implement a capped, additive CUT bonus into `total` (or a Pitz-parallel bonus, per whatever the decision specifies) with full Golden Matrix re-pinning and an explicit BEST-comparability migration note | **Blocks on a human scoring decision — do not implement speculatively** | High — the one item with real economy/ranking/Dex-BEST blast radius (see §3's option table) | Full `scoringV2` Golden Matrix re-verification, `missionScoring` tests, Pitz reward band tests, a dedicated before/after regression fixture set | Required — scoring/economy change, both viewports, plus explicit before/after score comparison video | Unscoped until the decision is made; likely the largest and highest-risk item in this list |

PR-A/B/C/D/E are all independent of each other and of PR-F; PR-F is the only item this audit
recommends treating as gated on a human decision rather than "ready to implement."

## 13. Priority Recommendation

Ranked by (player confusion reduction × low implementation/scoring risk), separating "small, safe
UI improvements" from "the one item that changes gameplay balance":

1. **PR-A (Dynamic Steps + emoji removal)** — cheapest, zero scoring risk, directly fixes a
   concrete "why am I tapping through an empty tab" confusion, and removes a tab-emoji that already
   caused one real overflow bug historically.
2. **PR-D (RESULT 1-Screen 2.0)** — highest player-visible impact (every single round ends here),
   already has the most measurement evidence and a partially-attempted prior fix to build on;
   correctly sequenced after PR-A only to avoid rebase churn, not because of a real dependency.
3. **PR-C (Timing Transparency)** — moderate value, no scoring risk, but should explicitly ship
   elapsed-time-only first and treat "target time per step" as an open design question rather than
   a blocker — do not delay this PR waiting on a target-time decision that isn't ready.
4. **PR-E (Finished Pizza Visual 2.0)** — meaningful visual-quality win, pure CSS/JS, but lower
   urgency than the above three since the pizza is already reasonably legible today; also directly
   fixes a real (if minor) latent bug (the accidental topping-filter reuse).
5. **PR-B (Bake Guide Tuning)** — likely **not needed at all**; only pursue if a real-device Human
   Feel session specifically flags the already-shipped fade as mistimed. Do not treat "the user
   asked about bake-guide-fade" as evidence that new work is required here — the audit found the
   feature already matches the requested design.
6. **PR-F (Scoring 3.0)** — deliberately last. It is the only item that changes what a score number
   *means* retroactively (Dex BEST comparability, Lunch Rush ranking fairness across a season,
   weekly leaderboard comparability). Per this repo's own standing rule ("scoring coefficient
   changes gated behind Human Feel evidence"), this should not ship until a human has explicitly
   chosen Option A/B/C from §3 and reviewed the BEST-comparability tradeoff — never bundle it into
   the same PR as any UI-only item above.

## 14. Deliverables

- This report: `docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md`.
- No machine-readable matrix was created separately — the recipe×step matrix (§8) and the timing
  matrix (§5) are both already in this document as the authoritative copies; do not duplicate them
  into a second file that could drift.

## 15. Issue

Duplicate Gate (§2) found no existing issue covering this exact 7-item scope. An umbrella Issue is
created (see PR/Issue links in §19) titled *"Gameplay UX / Scoring 3.0: 調理工程・時間評価・
RESULT・焼成表現の再設計"*, with the 7 items as Acceptance Areas, referencing Issue #22 (roadmap
SSOT) and Issue #37 (Making Game 2.0 parent) as related context rather than duplicating either. Per
the task's instruction, no child implementation issues were created — PR-A through PR-F above are
recorded in this report and the umbrella Issue as the implementation plan; child issues should be
opened only once each PR's scope is actually about to start.

## 16. Verification

- All code/doc references above were re-confirmed against `main` SHA `d3627a0c` (this audit's own
  base) during this session — not carried over from memory of any earlier audit.
- Recipe count re-confirmed at **15** (`src/data/recipes.ts`, cross-checked against
  `CUT_ELIGIBLE_RECIPE_IDS`, which also lists all 15).
- Step-count / `MakingStep` union re-confirmed from `src/state/gameReducer.ts` directly.
- Score formulas/weights and CUT formula/weights quoted directly from `src/logic/scoringV2/*` and
  `src/logic/cut/evaluation.ts` source, not from any doc alone (cross-checked against docs where
  available — no drift found anywhere in this audit).
- Timing thresholds (`efficiency.ts`, `cookingTiming.ts`, `bakeGuideFade.ts`) quoted directly from
  source, cross-checked against their own Fresh Audit/Result docs — no drift found.
- Reward formulas (`pitzReward.ts`, the efficiency bonus bands) quoted directly from source.
- Changed files this session: this report only, plus (after this report) the umbrella Issue and a
  docs-only PR description — **no `src/` file was modified**.

---

## Final Report

**Issue**: created — see repository Issues for *"Gameplay UX / Scoring 3.0: 調理工程・時間評価・
RESULT・焼成表現の再設計"* (linked from the PR below).

**PR**: created — docs-only, title *"Gameplay UX / Scoring 3.0: Fresh Audit & Implementation
Plan"*, **not merged**, per instruction.

**Latest main SHA**: `d3627a0cf911ab8009bc9cd4f64dd0c535327323`
**Audit HEAD**: same commit at audit start (`claude/teto-gameplay-scoring-audit-28uosn` created
directly from it; this report is the branch's own first commit).

**Duplicate Gate #1**: no existing issue/PR duplicates this scope; Issue #22/#37/#38 are related
parent context only (see §2).
**Duplicate Gate #2**: re-run immediately before push (see push-time note in the PR itself) —
`main` unchanged / re-confirmed unrelated to this scope at push time.

### 1. CUT score
- **Current**: fully independent of `score.total`/★/Pitz/Lunch Rush/Ranking, by deliberate original
  design (Option D, `TETO_PIZZA-CUTTING_1.0.md` §14) — confirmed unchanged through Phase 1–4B.
- **Recommendation**: this is now the intended moment to revisit that decision (all 15 recipes are
  CUT-eligible, satisfying Option D's own stated trigger condition). Move to **Option B** — a
  small, capped, additive CUT skill bonus into Pitz/total, mirroring the existing efficiency-bonus
  pattern — as PR-F, gated on an explicit human decision, not bundled with any other PR.

### 2. RESULT 1-screen
- **Current**: RESULT is architecturally the one screen designed to scroll; measured overflow
  ranges 44–277.8px depending on scenario/viewport, and is now more universal than when last
  measured because CUT (the single largest content swing item) is on all 15 recipes, not one.
- **Recommendation**: PR-D — fixed-position CTA bar (reuse `.prepare-bake-bar`) + move remaining
  detail rows into the already-established native `<details>` convention; re-verify with the same
  real-device measurement methodology already used for MAKING screens.

### 3. Finished pizza visual
- **Current**: cheese already has real continuous melt/spread/browning (CSS transform+filter, no
  assets); non-cheese toppings get *some* continuous browning too, but via what looks like an
  unintentional filter-reuse bug; RESULT already renders the player's true recorded state, already
  more "baked-looking" than the (intentionally flat) Reference view.
- **Recommendation**: PR-E — fix the topping-filter reuse into a deliberate per-category curve;
  add CSS-only oil-sheen/edge-softening flourishes; defer illustrated-asset-level effects (melt-pool
  silhouettes, curling edges) as an explicitly separate, larger future slice.

### 4. Dynamic steps
- **Current**: `CookingProfile` is data-shape-capable of per-recipe step lists but never varies
  today; 3/15 recipes need no CHEESE, 1/15 needs no TOPPING; the reducer/tab component already
  handle an arbitrary step list generically — the only real gap is `getCookingProfile` itself.
- **Recommendation**: PR-A — derive `steps` from `requiredIngredients` category membership; add
  e2e coverage for the 4 affected recipes (currently zero).

### 5. Bake emoji
- **Current**: 🔥 on the BAKE tab is purely decorative (already `aria-hidden`, zero tests depend on
  it), and this exact tab previously caused a real overflow bug attributed to emoji glyph-metric
  variance.
- **Recommendation**: remove it from the tab (bundle into PR-A); leave the separate BAKE CTA
  button's emoji out of scope unless full cross-surface consistency is separately requested.

### 6. Timing
- **手際 thresholds**: `comfortableMs = 25000 + 3000×totalRequiredItemCount`; `normalUpperMs =
  comfortableMs + 35000`; GOOD/NORMAL/SLOW ("スムーズ"/"ふつう"/"ゆったり") split at those two
  boundaries.
- **Score impact**: none on `total`/★; a separate, additive, quality-gated, capped (≤10% of base
  reward) Pitz bonus only, and only for FREE (never Lunch Rush).
- **Pitz impact**: yes, via the bonus above — never via the quality multiplier itself.
- **Step timing current state**: per-step elapsed time is already measured (`perStepElapsedMs`,
  DOUGH/SAUCE/CHEESE/TOPPING/CUT — not BAKE, which has its own separate scoring mechanism) but
  never persisted or read by any scoring/reward/UI path today; **no per-step target time exists
  anywhere** and none should be invented without real data.
- **Recommendation**: PR-C — ship elapsed-time-only UI (FREE only, low-emphasis) now; treat
  per-step target times as an explicitly open design question for later, informed by real playtest
  data.

### 7. Bake guide
- **Current**: fixed-time linear fade (3.6s→7.2s) already shipped (PR #68), already paired with a
  continuous post-fade bake-color visual specifically so players can keep judging doneness by eye,
  already regression-tested as scoring-independent — this **already is** the design the task asked
  to evaluate (Option A from the task's own framing).
- **Recommendation**: no new implementation (PR-B) unless a real-device Human Feel session
  specifically flags the existing timing/legibility as wrong — confirm with the user which of
  "doesn't exist" vs. "exists but feels off" their original complaint actually meant before
  scheduling any work here.

**Recipe-step matrix**: see §8 (CHEESE unnecessary for marinara/fugazza/pizza-bianca; TOPPING
unnecessary for quattro-formaggi; all other steps universal across all 15 recipes).

**Dependency summary**: Pitz is the one live junction where a timing bonus (shipped) and a possible
future CUT bonus (proposed) share the same additive-and-capped shape; every other item in this
audit is presentation-layer with no scoring/economy blast radius (see §11's graph).

**Recommended implementation order**:
- PR-A: Dynamic Cooking Steps + bake-tab emoji removal
- PR-D: RESULT 1-Screen 2.0 (fixed CTA + summary/details reorg)
- PR-C: Timing Transparency (elapsed-only; target-time design deferred)
- PR-E: Finished Pizza Visual 2.0 (fix accidental filter reuse + CSS-only flourishes)
- PR-B: Bake Guide Tuning — **only if** Human Feel finds the existing shipped fade needs retuning
- PR-F: Scoring 3.0 (CUT/total relationship) — **gated on an explicit human scoring decision**,
  implemented last, never bundled with any UI PR

**Changed files**: this report (`docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md`) plus
the umbrella Issue and PR description created from it.
**Production code changed: NO.**

**Known uncertainties**:
- Whether the user's Audit H complaint means "this doesn't exist" (it does) or "the existing
  3.6s/7.2s timing/legibility feels wrong" (would need real-device Human Feel evidence this audit
  did not find had ever been collected).
- The exact numeric shape (cap %, activation curve) of a future CUT bonus is explicitly left
  undecided per the task's own "do not change scoring yet" instruction.
- Per-step target times for PR-C have no grounded source data yet; this audit deliberately did not
  invent any.
- The RESULT 1-screen fix's exact final height budget after PR-D's reorganization has not been
  re-measured (this audit reused prior measurements taken before the CUT-eligibility expansion and
  before any reorg) — PR-D's own task list includes re-running the measurement methodology fresh.

**Next recommended action**: begin PR-A (lowest risk, no dependencies, fixes two concrete
confirmed issues — empty-step tapping and the emoji-driven overflow risk) while the product owner
separately decides the CUT/total scoring question (§3) needed before PR-F can start.

**STOP.** Do NOT merge. ChatGPT will independently Fresh Review this audit against current
GitHub/main before implementation begins.
