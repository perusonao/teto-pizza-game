# Phase 4A-1A: Reference Sauce Quantity Prototype -- Result

## 0. Pre-implementation discrepancy (read first)

The task brief pointed at two Phase 4A-0 design artifacts to read in full before starting:

- `docs/design/PIZZA_GAME_Phase4A_Reference-Quantity-Scoring2_Design.md`
- `docs/reports/PIZZA_GAME_Phase4A_PreImplementation_Audit.md`

**Neither file exists anywhere in this repository** -- not on `main`, not on any other
branch (`git ls-remote --heads origin` was checked), not under any other path. Per the
brief's own instruction ("過去情報よりGitHub/mainの実状態を優先してください" -- prefer
GitHub/main's actual state over past information), this implementation proceeds from the
brief's own extremely detailed inline specification (sections 1-15) instead of blocking on
missing documents, since that spec is self-contained and prescriptive enough to build from.
This gap should be reconciled before Phase 4A-1B: either the design docs need to be
committed (if they exist elsewhere) or Phase 4A-1B's brief should stop referencing them.

## 1. Base / HEAD

- Base `main` SHA: `45362e210a3e99ecc949706e9d007bf42e558881` (confirmed via fresh
  `git fetch origin main`; matches the SHA given in the task).
- Branch: `claude/phase-4a-1a-sauce-quantity-f8kcus` (already existed, up to date with
  `main` at session start).
- Final HEAD: see the commit this report ships in.

## 2. Changed files

New:

- `src/logic/sauceQuantity.ts` -- fixed-timestep dispense-tick math (time -> ticks -> capped
  amount). Pure, no DOM/timers.
- `src/logic/sauceDispenseController.ts` -- framework-independent "how long has the
  dispenser been squeezed" state machine (`start`/`move`/`step`/`stop`). PizzaStage only
  wires pointer events + `requestAnimationFrame` to this.
- `src/logic/sauceField.ts` -- 16x16 density field, `computeSauceMetrics` (quantity /
  coverage / evenness / overflow), `buildSauceField` (shared by metrics and the visual
  heatmap).
- `src/data/referencePizza.ts` -- Margherita Reference Pizza data (tomato sauce only),
  normalized `[0,1]` quantity/coverage targets.
- `src/logic/referenceScoring.ts` -- shadow-only similarity vs. the Reference Pizza.
- `src/components/ReferencePreview.tsx` -- "見本" button + compact popover.
- `src/components/SauceMetricsPanel.tsx` -- Prototype Metrics panel (dev/QA-facing).
- Tests: `sauceQuantity.test.ts`, `sauceDispenseController.test.ts`, `sauceField.test.ts`,
  `referenceScoring.test.ts`, `state/gameReducer.sauceDeposit.test.ts`,
  `state/phase4a1a.regression.test.ts`.

Modified:

- `src/state/pizzaState.ts` -- added `SauceDeposit` and `PizzaState.sauceDeposits: []`
  (reset by `createEmptyPizza`/`RESET_PIZZA`, never persisted -- round state never
  persists, see `src/state/persistence.ts`).
- `src/state/gameReducer.ts` -- added `DEPOSIT_SAUCE` action + reducer case. `APPLY_SAUCE`
  now also clears `sauceDeposits` (defensive: a one-shot commit must not inherit a stale
  deposit log from an abandoned dispense session).
- `src/components/PizzaStage.tsx` -- added the gated tomato-sauce dispense path
  (`referenceModeEnabled` prop), the sauce heatmap canvas, `onLostPointerCapture` safety
  handler, and extended the existing BAKE-abort/unmount cleanup effects to also stop the
  dispense controller. The original Phase 3A tap/drag-commit path is unchanged and is still
  exactly what every other ingredient/recipe/Mission play uses.
- `src/App.tsx` -- `referenceModeEnabled` gating (`recipe.id === "margherita" &&
  !isMissionActive`), `handleSauceDeposit`, renders `ReferencePreview`/`SauceMetricsPanel`
  only in that gate during PREPARE.
- `src/App.css` -- new styles for the heatmap canvas, Reference popover, and Metrics panel;
  one existing keyframe (`sauce-spread`) changed its 100% `opacity` from a hard-coded `1` to
  `var(--sauce-target-opacity, 1)` so a later inline style can still affect it (see section
  6 below) -- the default is unchanged for every other case.

## 3. Implementation summary

**Reference basis (Scope Guard: Margherita, tomato sauce only).** `referencePizza.ts`
holds one normalized target (`quantity: 0.55, coverage: 0.72`) for `tomato-sauce` on
`margherita`. The file header is explicit that the PIZZA DB has no gram/ml evidence, so
these numbers are game-balance choices, not measured facts, and must never be treated as
canonical.

**Tomato Sauce Interaction / Deposit Model.** `SauceDispenseController` is a small state
machine: `start(now, pos)` begins a session and deposits one "starter" tick immediately (so
a quick tap still applies a small dab, preserving the old tap-to-apply feel); `move(pos)`
only updates where the *next* tick will land, never deposits by itself; `step(now)`
advances a fixed-timestep accumulator (`sauceQuantity.ts`'s `stepDispenseTicks`,
`SAUCE_TICK_MS = 50`) using real elapsed time and deposits one tick's worth
(`SAUCE_RATE_PER_TICK = 0.02`) per full tick that elapsed; `stop()` ends it, safe to call
any number of times. PizzaStage drives `step()` from a `requestAnimationFrame` loop keyed
on the frame's own timestamp, not on pointermove event count or frame rate. Coalesced
pointer events are still used (as in Phase 3A) purely to interpolate the *position* the
next tick will land at.

**Sauce Field.** `sauceField.ts` rasterizes deposits into a 16x16 grid (each deposit
spreads with a small 1-cell-radius falloff), then computes:

- `quantity` = sum of in-dough deposit amounts, clamped to `SAUCE_MAX_QUANTITY = 1.0`.
- `coverage` = fraction of in-dough cells whose density exceeds a small touched-threshold.
- `evenness` = `1 - stddev/worstCaseStddevForThisTotal` over in-dough cells (1 = as uniform
  as that total quantity could possibly be spread; 0 = all of it in one cell).
- `overflowAmount`/`overflowRatio` = deposits that landed outside `isInsideDough` (the
  existing dough-circle test from `pizzaCoordinates.ts`), independent of the in-dough field.

Quantity and coverage are computed from genuinely different things (a sum vs. a
cells-touched fraction), so "a lot in one spot" and "a little spread thin" cannot collapse
to the same reading -- verified both by unit tests and by the browser session (section 8).

**Cap.** The dispenser's *total* dispensed (`nextDepositAmount` in `sauceQuantity.ts`) is
capped at `SAUCE_MAX_QUANTITY` across **inside + overflow together** -- once the "bottle" is
empty, holding down longer (in or out of the dough) does nothing further. This gives
overflow a real cost (it eats into the same budget) without being a hard penalty.

**Overflow.** Tracked as amount/ratio only, no scoring penalty (Prototype-only metric, per
spec). The heatmap canvas also draws faint dots at overflowed deposit positions as a Human
Feel cue.

**Visual Feedback.** Kept intentionally small: (1) a 16x16 canvas heatmap layered above the
flat `.pizza-sauce-layer` fill, drawn from the *exact same field* the metrics read, so what
the player sees always matches what's measured; (2) the flat base fill's own opacity now
tracks `quantity` for this one case (`0.22 + quantity * 0.68`, capped `0.92`) instead of the
previous fixed `0.85`, so a light dab reads visibly thinner than a full application. Getting
this to actually take effect required one small CSS fix: the existing `sauce-spread`
keyframe's `100%` opacity was hard-coded to `1` and, because CSS animations' `forwards`
fill wins over a later inline style change, silently overrode any dynamic opacity forever
after the 380ms animation finished. Routed through a `--sauce-target-opacity` custom
property (default `1`, unchanged for every other sauce/recipe) instead.

**Reference UI.** `ReferencePreview` renders a "見本" button; its popover is a small static
illustration (CSS-drawn mini pizza + emoji toppings, no new image assets) with two target
bars (quantity/coverage) and one caption line. A full-screen backdrop behind the popover
panel intercepts every tap while open, so a mis-tap can never reach the dough underneath
(verified in-browser, section 8).

**Prototype Metrics.** `SauceMetricsPanel` shows Quantity/Coverage/Evenness/Overflow as
compact chips, explicitly labeled 開発用 (dev/QA-facing), with an expandable shadow-score
detail row that says outright it is not reflected in ★/score.

## 4. Quantity model (section 3/10 detail)

- `SAUCE_TICK_MS = 50`, `SAUCE_RATE_PER_TICK = 0.02`, `SAUCE_MAX_QUANTITY = 1.0`.
- `stepDispenseTicks(elapsedMs, acc)` is a pure function of elapsed time; it carries a
  sub-tick remainder forward so no time is dropped or double-counted across calls, and it
  cannot see pointer/event data by construction (no such parameter exists).
- Verified by unit test: the same wall-clock hold produces the same tick count whether
  simulated as many small steps ("120Hz") or few large steps ("25-30Hz") -- see
  `sauceQuantity.test.ts` and `sauceDispenseController.test.ts`.
- `nextDepositAmount(ticks, alreadyDispensedTotal)` clamps to remaining headroom under the
  cap; once at/over the cap it returns `0` rather than pushing zero-amount deposit entries.

## 5. Sauce field method (section 4 detail)

16x16 grid over the dough's own 0-100% box (`SAUCE_FIELD_SIZE`), each deposit rasterized
with a 1-cell-radius falloff (`1/(1+distance)`), coverage/evenness computed only over the
subset of cells whose centers fall inside the dough circle (`isCellInsideDough`). See
section 3 above for the metric definitions and the cap/overflow interaction.

## 6. Reference UI method (section 7 detail)

Button + popover, not a permanent on-screen image. Popover content is a small CSS/emoji
illustration (~140px), never the real interactive `PizzaStage`, and never accepts pointer
input meant for the dough (the backdrop is a separate full-screen element in front of the
dough, behind the panel).

## 7. Metrics verification (section 8/11)

All verification below ran against a fresh `npm run build`/`npm run dev` at **390x844**
via Playwright (Chromium, pre-installed in this environment) driving real synthetic
pointer gestures (mouse-based `mouse.down/move/up` for A-G, native `PointerEvent`
dispatch with distinct `pointerId`s for the BAKE-race case, since a single virtual mouse
pointer cannot represent two simultaneous touches). Fresh save each run
(`localStorage.clear()` + reload). `console`/`pageerror` listeners were attached for the
whole session; horizontal overflow measured via
`document.documentElement.scrollWidth - clientWidth`.

| Case | Gesture | 量/Quantity | 被覆/Coverage | 均一性/Evenness | はみ出し/Overflow |
|---|---|---|---|---|---|
| A. 短時間だけ (quick tap, ~80ms) | single point | 4% | 1% | 65% | 0% |
| B. 適度な時間＋均等 (circle drag, ~1.5s target) | 12-point circle, r=25 | 94% | 42% | 90% | 0% |
| C. 長時間大量 (long hold, ~3.5s, nearly still) | 3 near-identical points | 100% (capped) | 5% | 65% | 0% |
| D. 一点集中 (2s hold, one spot) | single point | 80% | 5% | 65% | 0% |
| E. 広く薄く (1.6s, spread across dough) | 16-point spiral | 100% (capped)\* | 44-47% | 91% | 0% |
| F. 外へはみ出す (drag off the dough) | center -> off-rim | 14% | 5% | 69% | **75%** |
| G. pointer相当のcancel (release mid-hold) | 300ms hold, release | unchanged before/after a 500ms wait | -- | -- | -- |
| H. 塗布途中でBAKE (2-pointer race, section 9) | see below | phase reached BAKE, dough stopped interactive, 0 errors | | | |

\*Case E's real wall-clock hold ended up longer than its nominal 1.6s target due to
Playwright IPC overhead between synthetic move steps -- this is itself a live
demonstration of the design goal: quantity tracked *actual elapsed time*, not the number of
synthetic points sent, exactly as intended. C and E hitting the same 100% cap while landing
at 5% vs. ~45% coverage respectively is the clearest single proof that quantity and
coverage are never the same number here.

Case G (release/cancel-equivalent): metrics read identically immediately after release and
after an additional 500ms wait, confirming no dispense timer kept running past release (a
leaked `requestAnimationFrame` loop would have kept adding quantity).

Case H (BAKE race, the specific scenario the Phase 3A postmortem fixed) was reproduced
directly rather than via a single mouse pointer (which cannot represent two simultaneous
touches): pointer id 11 pressed down on the dough (starting the dispenser) and was **never
released**; pointer id 22 then tapped the BAKE button (a separate element, unaffected by
pointer id 11's `setPointerCapture`). Result: phase transitioned to BAKE, the dough lost
`interactive`/its capture, and a subsequent late `pointerup` for pointer id 11 arriving
*after* BAKE had already started produced zero console/page errors and no stray sauce
re-application -- the existing `interactive`-keyed abort effect (extended in this phase to
also call `SauceDispenseController.stop()`) handled it exactly as designed.

Across every case above: **console errors = 0, page errors = 0, horizontal overflow = 0px.**

Screenshots captured during this session (not committed to the repo; available for
transfer on request) include the PREPARE screen with Prototype Metrics visible, the
concentrated-vs-wide-spread heatmap contrast, the overflow case showing drip marks past the
crust with the はみ出し chip visibly flagged, the Reference popover, and the expanded
shadow-score detail row.

## 8. Tests

19 test files, 305 tests, all passing (`npm test -- --run`). New coverage added this phase:

- `sauceQuantity.test.ts` -- tick math is time-based and event-count-independent; cap/clamp.
- `sauceDispenseController.test.ts` -- hold time increases quantity; many `move()` calls
  with no elapsed time add nothing; same wall-clock hold via many-small-steps vs.
  few-large-steps yields the same total (the concrete "120Hz vs 30Hz" claim); cap is never
  exceeded and stops appending once reached; `stop()` halts future deposits and is
  idempotent/safe pre-start.
- `sauceField.test.ts` -- center/concentrated deposit, wide distribution, concentrated vs.
  wide at equal total quantity (coverage/evenness both differ), overflow
  detection/independence from quantity, coverage/evenness boundedness.
- `referenceScoring.test.ts` -- perfect match -> 1.0, worst match -> 0.0, monotonicity,
  boundedness for out-of-range input.
- `gameReducer.sauceDeposit.test.ts` -- ownership guard, deposit accumulation,
  origin/token-bumped-once semantics, `RESET_PIZZA` clears the log, `APPLY_SAUCE` clears a
  stale log.
- `phase4a1a.regression.test.ts` -- `scorePizza` is provably blind to `sauceDeposits`;
  `createEmptyPizza`'s new field doesn't change any other default; Dex `registerScoreToDex`
  and Mission `missionScore`/`averageQualityScore` behave identically; a non-Margherita
  recipe's `APPLY_SAUCE` path is untouched; `DEPOSIT_SAUCE` never changes `phase`.

**Not covered by an automated test** (and why): PizzaStage's own pointer-event wiring
(pointerup/pointercancel/`lostpointercapture`/unmount all calling the same
`stopDispensing()`) has no component-test harness available in this repo -- there is no
`@testing-library/react`/jsdom setup, `vitest.config.ts` runs `environment: "node"` only,
and no new dependency was added to avoid destabilizing the already-fragile toolchain (see
section 9). This is why the dispense *logic* was deliberately factored out into
`SauceDispenseController`, a plain class with no DOM/React dependency, so its state-machine
behavior (start/move/step/stop, including "stop is idempotent and halts future deposits")
is fully unit tested. The *wiring* of that controller to real pointer events was verified
by the Playwright browser session in section 7 instead (including the two-pointer BAKE race
reproduced with real `PointerEvent` dispatch).

## 9. Regressions

- Every pre-existing test (254 before this phase) still passes unmodified.
- `scorePizza`, Dex BEST/★, Mission scoring, save schema v1, and Pitz/Shop code paths were
  not touched.
- `APPLY_SAUCE` (used by every recipe except the gated Margherita-tomato-sauce case, and by
  Mission play regardless of recipe) is functionally unchanged; it additionally clears
  `sauceDeposits` defensively, which is a no-op for every existing caller since that field
  didn't exist before this phase.
- `PizzaState.createEmptyPizza()` gained one new field (`sauceDeposits: []`); every other
  field's default is unchanged (regression test asserts this explicitly).
- Non-Margherita sauce painting (marinara's tomato sauce, quattro formaggi, pesto, olive
  oil, everywhere) goes through the exact original Phase 3A pointerdown/move/up/cancel code
  path -- `isTomatoSauceReference` gates the new branch, and it is only true for
  `referenceModeEnabled && ingredient.id === "tomato-sauce"`.

## 10. Known limitations

- Reported Phase 4A-0 issues ("vitest実体欠落", "Node 20.8.1 / oxlint launcher") **did not
  reproduce** in this environment: Node 22.22.2 was already present, `npm ci` installed
  cleanly, and `npm test`/`npm run lint`/`npm run build` all ran without any workaround.
  Nothing was changed to route around a gate that wasn't broken here; if that environment
  issue is specific to a different machine/CI runner, it should be re-investigated there
  rather than assumed fixed by this PR.
- The heatmap is a plain 16x16-cell canvas raster, not a smoothed/anti-aliased painterly
  brush -- visible as soft "graph paper" blocking at close zoom (see screenshots). This was
  a deliberate simplicity trade-off for a Prototype; a later phase could upsample or blur it
  if the blockiness reads as a bug rather than texture during Human Feel testing.
  See docs/design/PIZZA_GAME_Phase4A_Reference-Quantity-Scoring2_Design.md when it exists.
- Because the total-dispensed cap is checked against a value re-derived from
  `PizzaState.sauceDeposits` (via a ref synced from props), a very fast burst of ticks
  landing between renders could in principle overshoot the cap by a fraction of one tick's
  amount before the next render's total is observed; this was not observed in testing
  (quantity settled at exactly 100% in every capped case) and has no gameplay consequence
  (Reference/metrics are shadow-only), but is worth knowing about if the cap is ever made
  authoritative.
- The Reference target values (`quantity: 0.55, coverage: 0.72`) are a single designer
  guess, not derived from any playtesting data -- expect to retune them once real Human
  Feel feedback comes in.
- No screenshots are committed to the repository (per the "avoid huge assets" instruction
  and since docs/reports/screenshots/ in this repo is for prior phases' own artifacts);
  they were generated during this session and can be attached to the PR description or
  sent separately if wanted.

## 11. Human Feel checklist (section 12)

To evaluate "is holding-and-painting more fun than the old tap":

1. Fresh save, フリープレイ (FREE), first order is always Margherita.
2. Tap "見本" once to see the target sauce look before painting.
3. Select トマトソース (already selected by default) and try: a quick tap, a slow circular
   drag, a long still hold, a fast wide spiral, and (deliberately) dragging past the crust.
4. Watch the Prototype Metrics chips update live and compare the heatmap's look to the 見本
   popover's target bars.
5. 焼く！ as normal -- BAKE/RESULT are completely unaffected by any of this (no ★/score
   change from Reference/Prototype Metrics).

## 12. Phase 4A-1B readiness

This phase deliberately did not implement (Scope Guard, unchanged from the brief):
Mozzarella/Basil reference matching, the Hungarian algorithm, authoritative Scoring 2.0,
Difficulty, Hint Policy, Reference Score reaching Mission, full 181-ingredient coverage,
real grams/ml, or any save-schema change. The groundwork now in place for 4A-1B to build on:

- `ReferencePizza`/`getReferencePizza` already has the shape to add `mozzarella`/`basil`
  reference fields without touching the Margherita tomato-sauce entry.
- `SauceMetrics`/`computeSauceMetrics` and `scoreSauceAgainstReference` are pure and
  already separated from `scorePizza` -- wiring a matching algorithm (Hungarian or
  otherwise) for scattered toppings is additive, not a rewrite of this phase's code.
- `PizzaState.sauceDeposits` and `DEPOSIT_SAUCE` are additive fields/actions; nothing about
  them assumes there will only ever be one deposit-tracked ingredient category.
- The still-open item from section 0: locate or re-author the Phase 4A-0 design docs before
  4A-1B starts, so that phase doesn't hit the same missing-artifact gap.
