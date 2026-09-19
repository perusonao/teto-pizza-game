# Cooking Time / Efficiency — Fresh Audit

**Audit-only. No production code changed.** This document is a design/contract audit for
turning the user proposal "調理時間も完成度や点数に反映したい" (also reflect cooking time /
efficiency in completeness and score) into an implementable spec, without making "faster is
always better" the rule. QUALITY stays the primary evaluation axis; EFFICIENCY is a secondary
one that must never punish a careful player and should only modestly reward a player who
reaches the same quality with less wasted motion.

## Baseline / SHA

- Audited/expected `origin/main` SHA: `398d48443f3bd299259bb63e3c9bd717091506ea`. Confirmed
  identical via `git fetch origin main` at audit start — no drift to reconcile.
- Audit branch: `claude/teto-cooking-efficiency-audit-1rzjyy`, created from fresh `origin/main`.
- Other in-flight work (per task instructions): a separate Claude Code session may be
  implementing "M3A Bake Judgment" concurrently. This audit is read-only and touches no bake
  files; checked `docs/reports/` for an existing M3A document — none exists yet at this SHA
  (`TETO_SCORING2-B1_BAKE_Result.md` is the most recent bake-related report, already merged,
  and is not M3A). The design recommended below (§2, §7) does not read from or score against
  `src/logic/bake.ts` / `src/logic/scoringV2/bakeComponent.ts` at all — the recommended timing
  boundary deliberately excludes the BAKE phase — so it should carry no merge/design conflict
  with M3A, but that should be re-confirmed once M3A's own report exists.

## Addendum: main-progression update (CT1 implementation pass)

This document was originally committed read-only against `origin/main` at
`398d48443f3bd299259bb63e3c9bd717091506ea` (branch `claude/teto-cooking-efficiency-audit-1rzjyy`,
never opened as a PR). The implementation task that follows this audit (CT1, see
`docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md`) re-baselined against
`origin/main` at `5df955575fd01ea7b27f4e7cf01f7205f5af0d18` -- 22 commits ahead, including M3A
Bake Judgment, UX-1 (Lunch Rush continuous per-pizza progression), UX-2 (Making Step Tabs),
Save v2/Inventory, and Economy & Progression 1.0 EP1-EP4/Economy Tuning 1. Re-verified against
that head before implementing; every finding/recommendation above still holds as written,
with three drift corrections:

- **M3A Bake Judgment (`aaf56ed`) has landed** (the "may be implementing concurrently" note in
  §Baseline/SHA above is resolved). Confirmed it changes only `src/logic/bake.ts`'s fading-guide/
  oscillator visuals and `bakeComponent.ts`'s scoring internals -- it does not change the
  `START_BAKE`/`CONFIRM_BAKE` action boundary itself, so the recommended timing boundary (§2,
  ending at `START_BAKE`) needed no change and carries no conflict, as §11's own "M3A overlap"
  risk anticipated.
- **`BEGIN_PREPARE` is no longer FREE-exclusive.** UX-1's Lunch Rush continuous per-pizza flow
  (`App.tsx`'s `handleMissionServeNext`) now also dispatches `BEGIN_PREPARE` immediately after
  `MISSION_NEXT_ORDER`, for every pizza after Lunch Rush's first. At the original baseline this
  action was FREE-only by construction; it no longer is. §5's "FREE only" requirement therefore
  cannot be satisfied by trusting the action name alone -- CT1's implementation gates the timing
  start on `GameState.isMissionRound` (already `true` by the time this second `BEGIN_PREPARE`
  fires, since `MISSION_NEXT_ORDER`/`buildOrderState` sets it first), not on which call site
  dispatched the action.
- **`isGlobalOverlayOpen` (`App.tsx`) now also includes the Inventory overlay** (`isInventoryOpen`,
  shipped after this audit's baseline), alongside the Dex/Shop pair §1.5/§2.2 originally listed.
  The recommended pause-trigger set in §2.2/§6 is read as "the current `isGlobalOverlayOpen`
  value, whatever overlays it composes," so this is a transparent extension, not a design change.

No other section required correction: the recipe table (§4), the Scoring 2.0 weight/
availability facts (§1.6), and `persistence.ts`'s schema/migration shape (§1.7, still
`schemaVersion: 2` at the re-baselined SHA) are all still accurate as written.

## 1. Current clock architecture (Audit 1)

**Headline finding: FREE mode has no clock, timer, or timestamp of any kind today.** Every
timing concept that exists in the codebase belongs to one of three unrelated, non-overlapping
systems, none of which touch `GameState`'s FREE-mode round.

### 1.1 Game phase / sub-step machine (`src/state/gameReducer.ts`)

```ts
export type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";
export type MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING"; // nested inside PREPARE
```
(`gameReducer.ts:26,34`, step order forward-only via `nextMakingStep`, line 36-41.)

Note for the task's own framing: DOUGH/SAUCE/CHEESE/TOPPING are `MakingStep` values *inside*
`PREPARE`, not top-level phases running parallel to BAKE/RESULT — the actual top-level phase
list is `ORDER → PREPARE → BAKE → RESULT → (DISCOVERED | fresh ORDER)`.

Transition points: `BEGIN_PREPARE` (ORDER→PREPARE, line 289), `CONFIRM_MAKING_STEP` (advances
`makingStep`, no phase change, line 466), `START_BAKE` (PREPARE→BAKE, line 485), `CONFIRM_BAKE`
(BAKE→RESULT, runs `computeScoringV2`, line 488), `REGISTER_TO_DEX` (RESULT→DISCOVERED, FREE
only, line 504), `MISSION_NEXT_ORDER` (RESULT→fresh ORDER, Mission only, line 580).

**`GameState` (lines 43-107) has zero time/duration/timestamp fields** — confirmed by reading
the full interface: `phase, order, recipe, pizza, makingStep, makingStepToken, score,
bakeState, scoringV2Result, dex, ownedIngredientIds, pitzBalance, lastClaimedMissionRunId,
isMissionRound, justDiscovered, justGotNewBest, hint, placement, lastPitzCredit`. None of
`buildOrderState`/`BEGIN_PREPARE`/`START_BAKE`/`CONFIRM_BAKE` stamp a clock anywhere.
`PizzaState` (`pizzaState.ts:46-66`) is equally timestamp-free.

### 1.2 Lunch Rush's `MissionClock` (`src/mission/lunchRush.ts`) — the only real clock in the app

```ts
export interface MissionConfig { durationSeconds: number; }        // default 180s
export interface MissionClock { startedAt: number; endsAt: number; }
export function startMissionClock(now, config): MissionClock       // lines 48-53
export function remainingMs(now, clock): number                   // clamped >= 0, lines 57-59
export function remainingSeconds(now, clock): number               // Math.ceil, lines 63-65
export function isMissionExpired(now, clock): boolean              // now >= endsAt, 67-69
```

Deliberately **absolute epoch-ms `startedAt`/`endsAt`**, not a decrementing counter (doc
comment, lines 36-41) — remaining time is always recomputed fresh as `endsAt - now`, which is
what makes it immune to background-tab throttling/drift. `missionRunReducer` is pure: it only
ever receives `now` as an action payload (`START { now }`, `SERVE { qualityTotal, now }`,
`TICK { now }`) and never reads `Date.now()` itself. `App.tsx:222-231` is the one place that
reads real wall-clock time: `useState(() => Date.now())` seeds `missionNow`, and a single
`window.setInterval(..., MISSION_TICK_MS = 250)` (App.tsx:36) re-reads `Date.now()` once per
tick, stores it for HUD display, and dispatches `TICK`. The interval only runs while
`mission.mode === "PLAYING"` and is cleared on cleanup. `SERVE` independently re-validates
`isMissionExpired` at the actual serve moment (lines 150-163 comment) to close a race window
between the 250ms tick cadence and an actual serve — a deliberate, already-solved pattern worth
reusing.

Mission's reward (`calculateMissionReward`, `src/logic/economy.ts:56-63`) is a function of
`MissionMetrics` (`servedCount`, quality) only — **no explicit time term**. Speed is rewarded
only indirectly, through how many pizzas fit inside the fixed 180s window.

### 1.3 `performance.now()` / `requestAnimationFrame` — gesture/animation plumbing, not a player clock

- `src/components/BakeOverlay.tsx:35-58` — the BAKE needle gauge is a free-running RAF loop
  (`SPEED = 55` %/sec) that oscillates forever until the player taps to confirm; `bake.ts`'s
  `classifyBake(value, target)` scores the tapped **position** (0-100 gauge value), not any
  elapsed duration. There is no time limit on how long a player can wait before tapping.
- `src/components/PizzaStage.tsx:514,564` + `src/logic/pointerTimestampNormalizer.ts` —
  `performance.now()` sampled once per gesture to smooth dough-stretch / sauce-drag velocity
  interpolation. Pure input-fidelity plumbing, never a duration surfaced to the player.
- `setTimeout` usage (`PizzaStage.tsx:641,692`, `IngredientTray.tsx:150`) is exclusively
  cosmetic (sauce-trail fade, a UI micro-reset).

### 1.4 No dormant fields, no fake-timer tests

Grep for `efficiency|elapsed|duration|speed|clock|timer` across `src/` (excluding tests) turns
up nothing beyond the three systems above (Mission's `duration`/`MissionClock`, Bake's needle
`SPEED`, gesture-duration comments in `doughShape.ts`/`sauceDispenseController.ts` about
per-gesture hold time, unrelated to session timing). **No field named `efficiency` exists
anywhere.** Grep for `vi.useFakeTimers|vi.advanceTimersByTime|vi.setSystemTime` across every
`*.test.ts(x)` file: **zero matches**. `lunchRush.test.ts` tests the pure clock-math functions
by calling them with hand-picked numeric `now` values (e.g. `startMissionClock(1_000, {...})`,
`remainingMs(25_000, clock)`) — never mocking the system clock. Any new timing feature should
follow this same "inject `now`, keep reducers pure" discipline rather than introducing fake
timers for the first time.

### 1.5 Pause / background / visibility — one handler exists, and it isn't a clock pause

`PizzaStage.tsx:341-364` registers `window.addEventListener("blur", ...)` and
`document.addEventListener("visibilitychange", ...)` (checking `document.hidden`) — but only to
call `abortActiveGesture()`, preventing a stale drag session's RAF loop from surviving a
backgrounded tab. It has **no relationship to any session-level clock** — there isn't one
outside Mission, and Mission's own `MissionClock` is deliberately immune to backgrounding by
design (§1.2). No `visibilitychange`/`blur` handling exists at `App.tsx` or `gameReducer.ts`
level.

Modal/overlay states already gating interactivity, and therefore the natural hook points for a
future pause policy: `isReferencePopoverOpen` (App.tsx:121, the Margherita reference popover)
and `isGlobalOverlayOpen = isDexOpen || isShopOpen` (App.tsx:530, Dex/Shop, both reachable
mid-round). `GameScreen.tsx:310`: `interactive={state.phase === "PREPARE" &&
!isReferencePopoverOpen && !isGlobalOverlayOpen}` already disables pizza gestures while either
is open — a clock, once it exists, should pause on exactly this same signal.

### 1.6 Scoring 2.0 and Pitz — confirmed time-free today

`computeScoringV2` (`scoringV2/index.ts:53-161`) weights `SAUCE 52 / PIECES 16 / RECIPE 12 /
BAKE 20` (sums to 100, comment at lines 34-47 explains the B1 rescale). Grepping every
component file (`bakeComponent.ts`, `sauceComponent.ts`, `recipeComponent.ts`,
`piecesComponent.ts`) for `time|duration|speed|elapsed|clock` returns only one unrelated "at
runtime" comment. `pitzReward.ts`'s `calculatePitzReward`/`applyPitzCredit` take an abstract
`total: number` (0-100) and a static `baseRewardPitz`, with bands `90/75/60/40/0 →
1.2/1.0/0.8/0.5/0` — no time term. FREE's per-pizza Pitz credit (`REGISTER_TO_DEX`, gated
`!state.isMissionRound`) and Lunch Rush's per-run reward (`CLAIM_MISSION_REWARD`, gated
`state.isMissionRound`) are structurally mutually exclusive and untouched by this audit.

### 1.7 Recipes and persistence

`Recipe` (`src/data/recipes.ts`) has no time/complexity field today; all 7 share
`baseRewardPitz: 100` and a uniform `bakeTarget` window width of 20 (only its position on the
0-100 gauge varies per recipe). See §4 for the full per-recipe ingredient-count table.

`persistence.ts` is on `schemaVersion: 2` (`CURRENT_SCHEMA_VERSION`, line 67), with an
established `migrateV1toV2` + `toIntermediateV2` + per-field `sanitizeX` pattern. Nothing
timing-related is persisted anywhere; `missionBest` stores only the Mission *score* integer, no
elapsed time. `GameState` (the in-progress round) is never persisted at all — a reload always
restarts at ORDER. `DexEntry` (`src/state/dex.ts`) is `{recipeId, discovered, bestScore,
bestStars, timesMade}` — no timestamps.

## 2. Fair timing boundary (Audit 2)

### Candidates considered

| # | Boundary | Verdict |
|---|---|---|
| A | Pizza Select → RESULT | **Rejected.** Includes recipe-browsing/description-reading time (ORDER phase, before any hands-on action) — directly penalizes a player who reads carefully or compares recipes, which is the opposite of the stated goal. |
| B | DOUGH start (= `BEGIN_PREPARE`) → BAKE complete (= `CONFIRM_BAKE`) | Close, but folds in the BAKE needle-tap minigame's own waiting time (§1.3) — see below. |
| C | Each `MakingStep`'s active time, summed individually | **Rejected for V1.** Requires per-substep pause/resume bookkeeping (4 separate intervals instead of 1) for a benefit (per-step breakdown) nothing in the spec asks for; higher implementation/test surface for no proven player-facing value yet. Worth revisiting only if a future slice wants a per-step ("assembly was fast, but sauce dispensing was slow") breakdown. |
| D | **BAKE-excluded making time**: `BEGIN_PREPARE` → `START_BAKE` | **Recommended.** |
| E | Recipe-specific target time, layered on top of whichever boundary is chosen | Not a boundary choice by itself — this is Audit 4's question, orthogonal to *which* interval is measured. Applies on top of D. |

### Recommendation: D — `BEGIN_PREPARE` → `START_BAKE`

Reasons, weighed against the listed considerations:

- **First-look / reading time**: `BEGIN_PREPARE` fires only once the player has already read the
  order/recipe and tapped to start assembling — everything before it (ORDER phase, recipe
  description, any pre-decision browsing) is outside the window by construction. No exclusion
  logic needed; the existing action boundary already does this for free.
- **Reference / modal / pause**: `isReferencePopoverOpen` and `isGlobalOverlayOpen` (§1.5) both
  fall *inside* the D window (a player can open Dex/Shop or the reference popover mid-PREPARE).
  These must pause the clock (see §2.2) — the alternative (not pausing) would punish exactly the
  "check the reference before placing toppings" behavior the philosophy explicitly wants to
  protect.
- **BAKE's own tap-timing is excluded on purpose.** The BAKE needle (§1.3) is *already* a
  timing-skill mechanic with its own scoring channel (`scoreBakeComponentV2`, distance from
  `recipe.bakeTarget`). If elapsed real time during BAKE also counted against "efficiency," a
  player who patiently waits an extra oscillation cycle for a dead-center needle hit would be
  penalized twice for the same choice — once correctly (bake accuracy) and once wrongly
  (efficiency). Candidate B (ending at `CONFIRM_BAKE`) would create exactly that double
  jeopardy; D avoids it entirely by ending at `START_BAKE`, before the needle ever starts
  moving.
- **background/tab hidden, iOS app interruption**: not resolved by the boundary choice itself —
  handled by the pause policy (§2.2), which reuses the *existing* `blur`/`visibilitychange`
  signal already wired in `PizzaStage.tsx` (§1.5) for gesture-abort, rather than inventing a
  second, possibly-inconsistent detection path.
- **accessibility**: D's window only spans the hands-on assembly steps (DOUGH/SAUCE/CHEESE/
  TOPPING), which is unavoidably where accessibility-driven pace differences show up most (a
  switch-access or motor-impaired player naturally takes longer to complete precise drag
  gestures). This is not solved by the boundary — it's addressed by keeping the evaluation
  side additive-only and generously banded (§3, §6).
- **reset**: `RESET_PIZZA` (mid-PREPARE undo) does **not** reset the clock — it's the same round
  attempt, just redone work; resetting the clock on `RESET_PIZZA` would let a player game a
  "fast" reading by resetting repeatedly right before confirming, which is not a behavior worth
  rewarding.
- **retry / reload**: `RETRY_SAME_RECIPE`/`PLAY_AGAIN` start a genuinely new round (fresh
  `buildOrderState`) — the clock resets at the next `BEGIN_PREPARE`, same as every other
  per-round field. Since `GameState` is never persisted (§1.7), a reload mid-round already
  discards all round state including any in-progress clock — this needs no special handling,
  it's already the existing behavior for everything else on `GameState`.

### 2.1 Testing implication

Following the Mission pattern (§1.4): `BEGIN_PREPARE`/`START_BAKE` should take `now` as an
action payload (exactly like Mission's `START { now }`), never read `Date.now()` inside
`gameReducer.ts` itself. This keeps the reducer pure and testable with hand-picked millisecond
values, with zero new fake-timer infrastructure.

### 2.2 Pause policy

Pause (stop elapsed-time accumulation, resume on the same signal clearing) while any of:
- `isReferencePopoverOpen` is true.
- `isGlobalOverlayOpen` (Dex or Shop) is true.
- `document.hidden` is true, or the tab loses focus (`blur`) — reusing the exact event pair
  `PizzaStage.tsx:341-364` already listens for, so there is only one background-detection
  mechanism in the app, not two that could disagree. This also covers iOS app-switch/
  interruption, which fires the same `visibilitychange`/`pagehide` events.

This is the opposite of Mission's own policy (§1.2), and deliberately so: Mission's clock is
*supposed* to keep running through backgrounding, because the countdown itself is the gameplay
challenge. FREE's clock is not a race — an involuntary interruption (a phone call, switching
apps) must never be held against a player's pace, so it pauses.

## 3. Evaluation design (Audit 3)

Three options compared, per the task's own instruction to keep the 100-point Scoring 2.0 total
untouched for now.

### Option 1 — direct addition to the Scoring 2.0 100-point total

Add a 5th weighted component (e.g., rescale `52/16/12/20` down again to make room for an
Efficiency slice, the same move B1 made for Bake, comment at `scoringV2/index.ts:34-47`).

- **Clarity**: one number stays one number — simplest mental model.
- **Balance / recalibration risk**: **high**. The Sauce:Pieces:Recipe ratio has already been
  iPhone Human-Feel-calibrated once and rescaled once more for Bake (B1); a second rescale for
  Efficiency reopens that calibration surface a third time, with no Human-Feel evidence yet
  that any specific efficiency weight is correct (the exact situation B1's own comment was
  careful to avoid — "deliberately conservative since this new formula has no iPhone Human-Feel
  evidence of its own yet").
  Note: the reasoning above compares against the *pre-Bake* three-way ratio (65:20:15) as the
  original calibration baseline that B1 itself preserved unchanged; a second reopening would be
  the first time that baseline ratio is disturbed at all, not merely rescaled again like B1's
  own proportional scale-down was.
- **Accessibility**: **directly harmful**. A slower-but-precise player's *visible quality score*
  would drop — exactly the "丁寧に作るプレイヤーを不当に罰する" outcome the task explicitly
  rules out.
- **Availability gate**: Scoring 2.0 is `available: false` for 6 of 7 recipes today (no
  Reference fixture yet, §1.6/§4) — folding Efficiency into a system that's already
  partially gated adds another dimension to an incomplete rollout.
- **Lunch Rush overlap**: none directly (Scoring 2.0 already runs identically in both modes),
  but conflating quality and pace into one number is the same design Lunch Rush already *is*
  (time pressure driving score) — doing it again in FREE blurs the two modes' identities (§5).

**Not recommended.**

### Option 2 — separate Efficiency Bonus, decoupled from Scoring 2.0

A secondary, independently-computed readout (e.g., a qualitative tier: GOOD / OK / — ) shown
next to, never inside, the 100-point Quality score. Zero changes to `scoringV2/index.ts`'s
weights or availability gating.

- **Clarity**: two labeled numbers ("品質 88" / "手際 GOOD") — matches the user's own example
  exactly, and mirrors how this codebase already prefers parallel-but-independent systems
  (Scoring V2 vs. legacy `scoring.ts`, FREE Pitz vs. Mission reward, `GameState` vs.
  `MissionState` — two separate `useReducer`s by design, per `lunchRush.ts`'s own top comment).
- **Balance / recalibration risk**: **none** for Scoring 2.0 — this option touches no existing
  weight.
- **Accessibility**: safest of the three — a tier system can be built floor-at-neutral (never a
  "SLOW"/red state, only "GOOD" as an upside), so it structurally cannot look like a penalty.
- **Availability**: fully independent of the Reference-fixture gate (§1.6) — Efficiency only
  needs `Recipe.requiredIngredients` (static data) and the two phase timestamps, so it can ship
  for **all 7 recipes** from day one, unlike Scoring 2.0's Sauce/Pieces/Recipe components.
- **Replay motivation**: gives a second, low-stakes thing to chase ("get GOOD pace on this
  recipe too") without moving the star rating a player already understands.

### Option 3 — small Pitz bonus, layered onto the existing reward

An additive `efficiencyBonusPitz` composed alongside (not replacing) `calculatePitzReward`'s
existing `baseReward * qualityMultiplier` — analogous in shape to how `PitzCredit` already
composes `baseReward`/`multiplier`/`earnedPitz` (`pitzReward.ts:59-90`).

- **Clarity**: lowest of the three alone — a bare Pitz number change is less legible than a
  named tier; needs Option 2's display to be understandable ("why did I get +5 Pitz?").
- **Balance**: low risk — `pitzReward.ts` is already structured as a small, pure, isolated
  module; an additive term is a minimal, easily-capped extension, not a reweighting.
- **Lunch Rush role overlap**: none — Lunch Rush's reward path (`calculateMissionReward`,
  `economy.ts`) is structurally separate (`isMissionRound` guard, confirmed §1.6) and untouched.
- **Replay motivation**: ties efficiency to the currency the player already spends in the Shop
  — a concrete, if small, incentive.

**Not recommended standalone** (opaque without a label) but recommended **paired with Option 2**.

### Recommendation

The task's own worked example — "品質 88 / 手際 GOOD / Efficiency +5 Pitz" — is literally
Option 2 + Option 3 combined, and the evidence above supports exactly that combination: Option
2 alone is safe but under-delivers on "reflect it in Pitz too"; Option 3 alone is legible only
with Option 2's label. **V1 = Option 2 (displayed tier) driving Option 3 (small additive Pitz
bonus)**, both fully decoupled from the Scoring 2.0 100-point total. Option 1 is explicitly not
recommended for V1, matching the task's own steer.

## 4. Recipe fairness (Audit 4)

| Recipe | Ingredient types (minCounts) | Total required items | Notes |
|---|---|---|---|
| `margherita` | tomato-sauce×1, mozzarella×3, basil×2 | 3 types / 6 items | Only recipe with a Reference Pizza fixture today |
| `marinara` | tomato-sauce×1, garlic×3, oregano×2 | 3 types / 6 items | No cheese |
| `quattro-formaggi` | olive-oil×1, mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 | **5 types / 9 items** | Clear outlier — most types and most items of the 7 |
| `genovese` | pesto×1, mozzarella×2, cherry-tomato×3 | 3 types / 6 items | Pesto (non-tomato) base |
| `bismarck` | tomato-sauce×1, mozzarella×3, egg×1 | 3 types / **5 items** | Fewest items of the 7 |
| `funghi` | tomato-sauce×1, mozzarella×2, mushroom×3 | 3 types / 6 items | |
| `fugazza` | olive-oil×1, onion×4, oregano×1 | 3 types / 6 items | No cheese, no tomato; gated behind purchasing `onion` |

All 7 share the same `bakeTarget` window **width** (20 units, only its position differs) —
bake-tap difficulty is already balanced across recipes; the item-count axis is not.

**A single flat target/par time would be unfair.** Quattro-formaggi requires 50% more distinct
ingredient types and 80% more total placements than bismarck for a player of identical skill
and care. Under a flat band, quattro-formaggi would structurally under-perform on pace no
matter how efficient the player is, which risks steering players away from the more complex
recipes and undermining the Dex-completion / mastery loop the game already has (7 recipes to
discover and master).

**Verdict: recipe-specific target times are needed, but full Human-Feel-calibrated per-recipe
constants are premature — there is no telemetry yet to justify 7 hand-picked numbers.**
Recommend a **formula-derived par band** for V1: a simple linear function of data already on
`Recipe` (e.g. `par = baseSeconds + perItemSeconds × totalRequiredItemCount`, coefficients
placeholder until Slice 0's Human Feel data, §9), not a single common band and not 7 bespoke
hand-authored constants. This keeps every recipe's target auditably derived from the same rule
rather than looking arbitrarily generous or strict for any one recipe.

## 5. Lunch Rush differentiation (Audit 5)

Lunch Rush already fully owns "the clock is the game": a live, always-visible countdown
(`MissionHud`, `remainingSeconds`, urgency styling under 10s) drives the core 180s loop, and its
reward already indirectly favors speed through `servedCount`. The recommended FREE design
preserves the split cleanly:

- **No visible/live countdown in FREE.** The `BEGIN_PREPARE`→`START_BAKE` clock (§2) must stay
  silent during play — no ticking HUD, no urgency styling — and be revealed only once, after
  the fact, on RESULT as a static tier. This is the core differentiator: Lunch Rush = pressure
  shown constantly; FREE = pace judged quietly, afterward.
- **Efficiency must stay economically small.** Recommend capping the Option-3 Pitz bonus at a
  small fraction (e.g., under ~10%) of the quality-driven ceiling (`120` Pitz at ★5 /
  `1.2×`), so no realistic combination lets a fast-but-sloppy pizza out-earn a slow-but-excellent
  one — making "QUALITYが主評価、EFFICIENCYは副評価" a real economic invariant, not just stated
  intent. Recommend also gating the bonus on quality clearing at least a minimum band (mirroring
  `QUALITY_MULTIPLIER_BANDS`'s own floor-at-0 for band `<40`) so speed alone can never rescue a
  genuinely bad pizza.
- **`calculateMissionReward`/`economy.ts` untouched.** Already structurally isolated by the
  `isMissionRound` guard (§1.6) — this design needs no change there to satisfy the "既存Lunch
  Rush reward変更は禁止" constraint; it's already true by construction, not something to be
  careful about.
- Non-blocking observation, not a recommendation: `MissionResultOverlay` currently shows no
  elapsed/per-pizza-speed figure despite Lunch Rush being fundamentally time-bounded — a future,
  separately-scoped symmetry opportunity, explicitly out of scope here per the task's own "禁止"
  instruction on Lunch Rush reward changes.

## 6. Data / state changes needed

All items below are **not implemented by this audit** — listed for the eventual V1 slice.

- `GameState`: a new field, e.g. `makingClock: { startedAt: number; pausedAt: number | null;
  accumulatedPauseMs: number } | null`, stamped at `BEGIN_PREPARE` (start) and read/finalized at
  `START_BAKE`. Mirrors `MissionClock`'s "absolute timestamps, pure reducer" shape (§1.2, §2.1)
  — `now` and pause/resume signals passed in as action payloads from `App.tsx`, never
  `Date.now()` read inside `gameReducer.ts`.
- Pause/resume actions driven by the existing `isReferencePopoverOpen` /
  `isGlobalOverlayOpen` signals and the existing `blur`/`visibilitychange` listener pattern
  already in `PizzaStage.tsx` (§1.5, §2.2) — reuse, not a second detection mechanism.
- `Recipe`: either a new static field or (preferred, avoids touching 7 authored records by
  hand) a derived formula function taking `Recipe.requiredIngredients` as input, for the §4
  par-band.
- New pure module, e.g. `src/logic/efficiency.ts`, mirroring `pitzReward.ts`'s shape:
  `classifyPace(elapsedMs, parBand) -> tier` and `computeEfficiencyBonusPitz(tier) -> number`,
  composed into `REGISTER_TO_DEX` alongside (not replacing) `applyPitzCredit`.
- `PitzCredit` (`pitzReward.ts:59-65`): extend with an additive efficiency sub-breakdown field,
  same additive-composition style already used for `baseReward`/`multiplier`/`earnedPitz`.
- `ResultPanel.tsx`: a small secondary "手際" tier badge, rendered independent of (not inside)
  the existing Sauce/具材/配置/焼き score bars — and, importantly, **not** gated behind the same
  `available`/Reference-fixture check those bars use (§3, Option 2's availability point) since
  Efficiency has no Reference-fixture dependency.

## 7. Save migration necessity

**Not required for the recommended V1 scope.** If Efficiency stays ephemeral — computed fresh
each round, displayed once on RESULT, never persisted, no "best time" tracked across reloads —
it needs no schema change at all, exactly matching how `GameState`'s other in-round-only fields
(`score`, `bakeState`, `scoringV2Result`) are already never persisted (§1.7).

**Would be required** only if a later slice adds a persisted per-recipe "fastest time" (a
`DexEntry`-like monotonic-best field, mirroring `bestScore`/`bestStars`). That would need:
`schemaVersion: 3`, a new `migrateV2toV3` pure function following the established
`migrateV1toV2`/`toIntermediateV2` shape (`persistence.ts:275-329`), a new `sanitizeX`
validator, and a `DexEntry` field extension. Recommend deferring this to a later slice, after
the tier thresholds themselves are validated by Human Feel (§9) — persisting an unvalidated
threshold's "best time" risks a second migration once thresholds change.

## 8. Tests required

- Pure clock/pause-math unit tests mirroring `lunchRush.test.ts`'s shape (hand-picked numeric
  `now`, no fake timers): start/pause/resume/elapsed computation; zero-elapsed edge case
  (`START_BAKE` fired immediately); a pause spanning the entire window; multiple pause/resume
  cycles; `RESET_PIZZA` does not reset the clock; `RETRY_SAME_RECIPE`/`PLAY_AGAIN` do reset it.
- Reducer tests: `BEGIN_PREPARE` stamps `startedAt`; `START_BAKE` finalizes elapsed; pause
  actions driven by the overlay/visibility signals behave as specified.
- Pace-tier classification tests per recipe par-band, including exact boundary values.
- Efficiency Pitz bonus composition tests: always non-negative, capped, additive with
  `calculatePitzReward`'s existing output, and zero when quality is in the bottom band (§5's
  gating recommendation).
- Recipe-fairness "formula sanity" test: assert the §4 par-band formula produces a
  monotonically-reasonable target across all 7 `RECIPES` entries (no recipe's derived band is
  wildly out of line for its item count).
- Explicit Lunch Rush non-regression test: assert `calculateMissionReward`/`MissionMetrics`/
  `missionRunReducer` are byte-for-byte unchanged — turns the task's "既存Lunch Rush reward変更
  は禁止" instruction into an enforced regression net, not just a promise.

## 9. Implementation slices

0. **Human Feel data collection** — instrument `BEGIN_PREPARE`→`START_BAKE` elapsed behind a
   dev-only log (no UI, no scoring change) across all 7 recipes on real iPhone playtests, to get
   actual par-time data before hand-picking any coefficient — mirrors B1's own deferral of
   committing weights without Human-Feel evidence.
1. **Clock foundation** — `GameState.makingClock`, `BEGIN_PREPARE`/`START_BAKE` stamps, pause
   wiring from the existing overlay/visibility signals (§6). Fully tested (§8), no visible UI.
2. **Par-time formula + tier classification** — `src/logic/efficiency.ts`, calibrated against
   Slice 0's real data (§4).
3. **RESULT display (Option 2)** — the "手際" badge, UI-only, reads the already-computed tier.
4. **Pitz bonus (Option 3)** — smallest, last, most economy-sensitive change; composed into the
   `REGISTER_TO_DEX` path alongside `applyPitzCredit`.
5. *(Optional, later, only after 1-4 are stable)* persisted best-time tracking — needs the
   Save v3 migration from §7.

## 10. Human Feel validation

Manual iPhone playtests across all 7 recipes, with both a deliberately careful/slow tester and
a deliberately brisk tester, confirming:

- A careful/slow tester never sees a punitive-feeling badge or any quality-score change —
  floor-at-neutral holds in practice, not just in the tier table.
- A normally-paced, attentive player can reach the GOOD tier without feeling pressured into
  speedrunning — this is a "small bonus," not a skill gate.
- Quattro-formaggi's higher item count (§4) does not make it structurally harder to reach GOOD
  than margherita once the formula-derived par band is applied — validates the fairness fix,
  not just the boundary choice.
- Opening the reference popover or Dex/Shop mid-round visibly does not hurt the tier (pause
  actually pauses, not just in unit tests).
- Backgrounding the tab / app-switching on iOS never inflates elapsed time (pause fires
  reliably on the real platform, not just in `visibilitychange`'s jsdom-simulated form).

## 11. Risks

- **Scoring 2.0 recalibration risk** — avoided by construction: Option 1 is rejected, so no
  weight in `scoringV2/index.ts` changes.
- **Recipe-fairness drift** — without §4's formula-derived band, players would gravitate to
  "easy-to-look-fast" recipes (bismarck/marinara) and avoid quattro-formaggi, undermining the
  existing Dex-completion mastery loop. Mitigated by §4's recommendation; residual risk if the
  formula's coefficients (Slice 0 data) turn out not to generalize across all 7 recipes evenly.
- **Accessibility harm** — the single largest risk of this whole feature if built wrong. Fully
  mitigated only if the "never subtract, only add a small bonus, floor at neutral" invariant is
  actually enforced in the tier table and Pitz formula, not just stated as intent — this must be
  checked in code review, not assumed.
- **Pause-signal gaps** — if a pause hook misses a real interruption case (e.g., an iOS PWA
  suspend that doesn't fire `visibilitychange` reliably), elapsed time could be inflated for an
  involuntarily-interrupted player. Mitigated by keeping the whole feature tier-based with
  generous bands rather than points-losing, so a single missed pause rarely flips a tier.
- **M3A Bake Judgment overlap** — no code-level conflict expected (§2's boundary excludes BAKE
  entirely, and no M3A report exists yet to audit against), but should be re-checked once that
  work lands, particularly if M3A changes what `START_BAKE`/`CONFIRM_BAKE` mean.
- **No existing telemetry pipeline** — Slice 0 (§9) needs a lightweight dev-log mechanism that
  does not exist yet; small added scope before any real par-time coefficients can be trusted.

## Final judgment

**C. NEEDS TIMER FOUNDATION.**

FREE mode captures no timestamp of any kind today (§1) — there is no dormant clock field to
attach a display or a Pitz bonus to, so neither "A. READY — Pitz/secondary bonus" nor
"B. READY — separate Efficiency display" is honestly true yet; both require the same
prerequisite (Slice 1's clock capture) before either can be built. This is not a "D. BLOCKED"
situation either — nothing external prevents building the foundation, there is no unresolved
dependency, and the codebase already contains every pattern needed to build it cheaply and
safely: `MissionClock`'s pure-reducer/absolute-timestamp shape to mirror (§1.2), `pitzReward.ts`
's isolated-pure-module shape to extend (§1.6), `persistence.ts`'s migration pattern if
persistence is ever needed (§7), and an existing pause-worthy signal set already wired for
gesture-abort that a clock can reuse verbatim (§1.5/§2.2). Once Slice 1 lands, Slices 2-4 (which
correspond exactly to Options 2+3, i.e. what A and B together would ship) are low-risk and can
proceed directly per §9's sequencing.
