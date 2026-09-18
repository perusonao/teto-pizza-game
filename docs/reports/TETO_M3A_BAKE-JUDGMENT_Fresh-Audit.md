# Teto Pizza Game — M3A Bake Judgment / Fading Bake Guide — Fresh Audit

**Type:** Read-only Fresh Audit (Phase 0), from fresh `origin/main`.

- **Audited SHA:** `cf6d41495b0f6cb3e568abadba16f5bb8ecbf80e` (PR #66, Sauce Free Boundary,
  confirmed merged via `git fetch origin main` + `git log origin/main -1` at session start;
  matches the task's expected SHA; working tree clean, session branch already at this SHA).
- **Scope:** BAKE phase only — the oscillating-needle mini-game (`BakeOverlay`), the pizza's own
  bake-time visual rendering (`PizzaStage`), and how both relate to Scoring 2.0's Bake component
  (`scoreBakeComponentV2`). Sauce/Pieces/Recipe scoring, Pitz multiplier, Save schema, and the
  Scoring 2.0 Bake formula itself are explicitly out of scope (Phase 5 regression guard).

## 0. What "BAKE" actually is today (this changes the whole plan)

There is **no fixed-duration cook timer**. `BakeOverlay` (`src/components/BakeOverlay.tsx`)
runs a `requestAnimationFrame` loop that bounces a single "needle" value back and forth between
0 and 100 at a constant `SPEED = 55` percent/second — a full 0→100→0 sweep takes ~3.64s, forever,
until the player taps "取り出す！" (`onConfirm(positionRef.current)`). The tapped value is the
*entire* input to scoring; there is no elapsed-time score, no auto-fail, no countdown. This means:

- "Guide fade timing" cannot be tied to the needle's own oscillation phase (that repeats every
  ~3.6s forever) — it has to be tied to **elapsed real BAKE-phase time since START_BAKE**, which
  is a wholly new concept for this phase (Phase 4's remit: audit whether introducing *any*
  time-based behavior here is fair — see §6).
- A player who taps immediately (within the first cycle) never sees the guide fade at all — the
  fade is opt-in by virtue of taking longer, never a hard cutoff imposed on a fast player.

## 1. Files audited

- `src/logic/bake.ts` — `classifyBake`/`BakeState` (raw/perfect/burnt), the scoring ground truth.
- `src/logic/scoringV2/bakeComponent.ts` — Scoring 2.0's Bake sub-score (`scoreBakeComponentV2`):
  continuous `distanceFromNearestEdge`/`similarity`, reads `bakeResult` (the raw confirmed
  number) and `Recipe.bakeTarget` only.
- `src/components/BakeOverlay.tsx` — the needle mini-game: gauge (target/raw/burnt zones),
  needle, Teto caption, CTA.
- `src/components/PizzaStage.tsx` — the pizza's own bake-time rendering (dough/crust color,
  cheese melt, char spots, smoke, sauce/topping tint).
- `src/App.css` — `.bake-*`/`.pizza-dough--*`/`.pizza-cheese--*`/`.pizza-bake-overlay*`/
  `.pizza-char-spots`/`.pizza-smoke*` rules.
- `src/App.tsx` — `bakeProgress` derivation (`liveBake` during BAKE, `pizza.bakeResult` during
  RESULT/DISCOVERED), `handleBakeTick` (frame-skip throttle down to every 3rd tick for the rest
  of the app), START_BAKE/CONFIRM_BAKE dispatch wiring.
- `src/state/gameReducer.ts` — `START_BAKE`/`CONFIRM_BAKE` reducer cases, `PLAY_AGAIN`/
  `RETRY_SAME_RECIPE`/`RESET_PIZZA` reset paths.
- `src/data/recipes.ts` — all 7 `BakeTarget`s (`{start, end}`, all 20-wide windows, `start`
  ranging 45-65 across recipes — see §2).
- `src/components/ResultPanel.tsx`, `src/data/dialogue.ts` (`buildTetoBakeLine`) — post-BAKE and
  in-BAKE Teto dialogue consumers of `bakeState`.
- Existing tests grepped for any coupling to bake visuals: none assert PizzaStage's rendered
  `pizza-dough--*`/`pizza-bake-overlay*`/`pizza-char-spots` class names or DOM structure — only
  `bakeState` as *data* (RESULT/scoringV2/reducer level) is covered. This meant the visual layer
  could be freely restructured with zero risk to existing coverage (confirmed before writing any
  code; see the new PR's diff for what changed).

## 2. Where does the correct zone come from, and is UI coupled to scoring?

**Not coupled at the data/reducer level — coupled at the render level, and that coupling is the
whole story of what needed fixing.**

- `Recipe.bakeTarget` (`{start, end}`, `src/data/recipes.ts`) is the single source of truth,
  authored per recipe (7 recipes, all 20-point-wide windows: 45-65 through 65-85 across the set).
- `BakeOverlay` receives `targetStart`/`targetEnd` as props (from `state.recipe.bakeTarget`) and
  draws them directly as the gauge's colored zones — this is **the Guide**, a pure UI hint with
  no back-channel into scoring.
- `CONFIRM_BAKE`'s reducer case (`gameReducer.ts`) takes only `{ type: "CONFIRM_BAKE"; value:
  number }` — the raw needle position at tap time — and calls `computeScoringV2(recipe, {
  ...pizza, bakeResult: value })`. `scoreBakeComponentV2` (`bakeComponent.ts`) reads `bakeResult`
  and `bakeTarget` only, with a continuous `distanceFromNearestEdge`/`similarity` formula (0 at
  either edge of the zone, growing linearly on both sides) — nothing about the UI, opacity, or
  what the player could currently see enters this calculation at any point.
- **Hiding/fading the Guide (BakeOverlay's own rendering) cannot change scoring** — verified
  both by reading the call graph (BakeOverlay has no scoring import at all; `onConfirm` always
  fires with `positionRef.current`, the true needle value, regardless of any opacity state) and
  now by a dedicated regression test (`src/state/gameReducer.bakeGuideRegression.test.ts`) that
  drives `CONFIRM_BAKE` directly and pins identical scores for identical tap values.
- **The player CAN currently read under/good/over directly off the pizza's own appearance**,
  because `PizzaStage` derives its rendering from `classifyBake(bakeProgress, recipe.bakeTarget)`
  — the *exact same 2-value boundary* Scoring 2.0 grades against. This is fine in principle (the
  brief wants the player to eventually rely on exactly this signal) — the problem is *how* it was
  rendered (§4).

## 3. The CTA glow is also part of the Guide (a finding, not just an audit note)

`BakeOverlay`'s "取り出す！" button gets a `cta-button--glow` class whenever
`classifyBake(position, target) === "perfect"` — i.e. it glows in perfect sync with the needle
being inside the scoring target zone, **updated every animation frame, with no relationship to
the gauge's own visibility**. A naive Guide-fade implementation that only faded `.bake-gauge`
would leave this glow operating exactly as before, silently handing the player a second,
un-fadeable "you're in the zone right now" signal and defeating the entire feature. This is
folded into the Guide's own fade window in the implementation (see the Result report).

## 4. Visual progression audit — the actual "answer reveal" bug

`PizzaStage` computed a local `bakeState = classifyBake(bakeProgress, recipe.bakeTarget)`
(raw/perfect/burnt, 3 buckets) and used it to pick between 3 **entirely different CSS
`background` values** (radial-gradients) for the dough's crust color, plus discrete class swaps
for cheese melt/toast/char and a binary show/hide for char spots + smoke.

**`background` is not an animatable CSS property** (browsers cannot interpolate between two
different gradients) — so every time the needle's continuous position crossed `bakeTarget.start`
or `.end` (i.e. *exactly* the scoring boundary, twice per ~3.6s oscillation cycle), the dough's
crust color **snapped instantly** between pale/golden/charred. Cheese similarly jumped between 3
fixed melt/toast/char looks at the same instants, and char spots/smoke popped in at full opacity
the moment the needle crossed into "burnt". This is precisely the "answer reveal at the correct
instant" failure mode the brief calls out ("正解の瞬間だけ突然見た目が変わるような答え合わせ表現には
しない") — and it would have completely undermined the Guide fade: hide the gauge, and the pizza
itself still telegraphs the exact boundary via a hard color snap every ~1.8 seconds.

This audit treats this as the primary Phase 2 finding, not an optional nice-to-have: making the
Guide fade meaningful *requires* fixing this snap, because otherwise the pizza becomes a second,
un-hideable Guide with pixel-perfect boundary precision.

## 5. FREE vs. Lunch Rush

`BakeOverlay`/`PizzaStage` are mode-agnostic — `GameScreen.tsx` renders the identical
`<BakeOverlay>`/`<PizzaStage>` regardless of `mission.mode`. `CONFIRM_BAKE` is dispatched from
the same one call site for both (per the reducer's own comment). There is currently no
FREE/Lunch Rush behavioral difference in BAKE at all. Per the brief's "V1で現在モードへ適用する範囲
はFresh Audit後に最小安全案を選ぶ" — the minimal safe choice is to apply the same fade behavior
identically to both modes for V1 (documented as the "Normal"-equivalent baseline in §8's
Difficulty Policy prep), rather than inventing a per-mode branch this task doesn't need yet.

## 6. Timer fairness (Phase 4 — audited, not implemented)

- The needle's own rAF loop has **no `visibilitychange`/`blur` handling** at all (unlike
  `PizzaStage`'s sauce-dispense session and `IngredientTray`'s long-press, both of which abort on
  `document.hidden`). A large `dt` after a backgrounded tab is harmless for the needle itself —
  the per-frame position update clamps to [0, 100] and flips direction at most once regardless of
  how large `dt` was, so no multi-cycle glitch is possible.
- **Finding:** introducing a *new* elapsed-time-based mechanic (the Guide fade) into a component
  with no visibility handling needed a deliberate fairness decision. The implementation
  accumulates fade-elapsed-time as a running sum of each frame's own `dt`, inside the same rAF
  callback that already drives the needle — since browsers throttle or fully pause
  `requestAnimationFrame` for backgrounded tabs, the fade accumulator (like the needle) is not
  advanced by wall-clock time the player spent away from the tab. A player who backgrounds the
  tab does not come back to find the Guide already gone. This reuses an existing, already-audited
  property of the loop rather than adding a new `visibilitychange` listener.
- **Residual limitation (documented, not fixed here):** some browsers throttle rather than fully
  pause background rAF (e.g. to ~1fps), so a long background stay could still advance the fade
  slightly. Given BAKE has no fail state and the player controls when to confirm, this is a minor
  fairness edge case, not a scoring-fairness one — noted for M3B if a real Cooking Time score is
  ever added (explicitly out of scope this round per the brief).
- No new `setInterval`/wall-clock timer was introduced anywhere in this change.

## 7. Accessibility / 390×844

- The gauge (`.bake-gauge`) carries no text content and was already effectively decorative;
  `aria-hidden="true"` is now set on it explicitly (it wasn't before) so a screen reader never
  tries to describe the zone/needle divs.
- The Teto caption (`.bake-oven__caption`) is real text and stays in the accessibility tree
  throughout — it swaps to a neutral, state-independent line once the Guide is fully hidden
  (see the Result report) rather than disappearing, so there's always something read there.
- `.bake-overlay`'s layout (flex column, `gap`, no fixed pixel widths beyond the existing
  `.bake-gauge` bar) is unchanged by this work; the existing CTA bar sizing (Issue #47 Finding E,
  54px min-height) is untouched. No new elements were added outside the existing flex flow, so
  390×844 overflow risk is unchanged from before this change (verified in the Result report's
  Preview).

## 8. Design decisions carried into Phase 1-4 implementation

- **Fade window:** `GUIDE_FADE_START_S = 3.6` (~1 full needle sweep, so a player always sees the
  whole zone at least once), `GUIDE_FADE_END_S = 7.2` (~2 full sweeps). Linear opacity 1→0
  in between, deterministic and monotonic — never derived from needle position/proximity to the
  target, per the brief's explicit "fade timingとしてgood/perfect境界を直接公開しない" constraint.
- **What fades together:** the gauge bar (`.bake-gauge`, zones+needle), the Teto caption's
  state-revealing text, and the CTA's target-zone glow — all three are "the Guide" per §3's
  finding, all gated on the same `guideOpacity`/`guideOpacity > 0` signal so nothing outlives the
  gauge as a hidden tell.
- **Visual continuity:** replaced the 3-bucket `classifyBake`-driven background/melt/char swap
  with a continuous `bakeHeat` scalar (0 at progress 0, exactly 1 at the recipe's own target
  center, 2 at progress 100 — piecewise-linear, no seam at `start`/`end`) driving dough color
  (RGB-lerped, set inline per frame), cheese melt/toast/char (a small interpolated keyframe
  table), and char-spot/smoke opacity (a continuous ramp starting well past the scoring
  boundary, not at it). `classifyBake`/`bakeState` itself is untouched and still used for
  RESULT-screen dialogue/`ResultPanel` (a post-decision reveal, not a BAKE-time tell) and for the
  one-shot perfect-glow, which only ever renders once `resultRevealed` is true.
- **Difficulty policy prep (Phase 3):** no new difficulty system or Save-schema field was added.
  The fade window constants (`src/logic/bakeGuideFade.ts`) and the visual-continuity module
  (`src/logic/bakeVisual.ts`) are both pure functions of `(progress, target)`/`(elapsedSeconds)`
  with no mode/settings coupling — a future Practice/Normal/Challenge split can pass different
  `GUIDE_FADE_START_S`/`GUIDE_FADE_END_S` (or `Infinity`/`0` for "never fades"/"no guide at all")
  without touching scoring or this module's internals. V1 applies today's single fade curve to
  every mode (FREE and Lunch Rush alike), documented as the "Normal"-equivalent baseline.
- **Regression guard:** Scoring 2.0 weights/formulas, Pitz multiplier, Lunch Rush reward, Save
  schema, and Recipe data are untouched by this change (no file under `src/logic/scoringV2/`,
  `src/logic/pitzReward.ts`, `src/state/persistence.ts`, or `src/data/recipes.ts` was modified).
