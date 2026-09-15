# Phase 4A-1A: Post-Codex-Fix Result

Fixes for Codex Broad Review findings on PR #21 (P0=0, P1=2, P2=8, P3=2, verdict "C. NEEDS
FIX BEFORE USER TEST"). Same branch (`claude/phase-4a-1a-sauce-quantity-f8kcus`), same PR
#21 -- no new PR, no merge to `main`.

## 0. Verification of starting state

- `git fetch origin claude/phase-4a-1a-sauce-quantity-f8kcus main` confirmed PR #21's actual
  HEAD was `1f122797bef281eda20424366e3423a5c92435e4`, matching the task's "Expected current
  HEAD" exactly, before any change in this session.
- PR #21 (`pull_request_read`) confirmed open, `mergeable_state: clean`, base `main` at
  `45362e210a3e99ecc949706e9d007bf42e558881`.

## 1. Finding disposition

| # | Finding | Status | How |
|---|---|---|---|
| P1-1 | MUST FIX 1 -- Gesture Session Safety | **FIXED** | Section 2 |
| P1-2 | MUST FIX 2 -- Reducer Scope Guard | **FIXED** | Section 3 |
| P2-1 | MUST FIX 3 -- Background/Stall | **FIXED** | Section 4 |
| P2-2 | MUST FIX 4 -- Spatial Sampling | **FIXED** | Section 5 |
| P2-3 | MUST FIX 5 -- Overflow Boundary | **FIXED** | Section 6 |
| P2-4 | MUST FIX 6 -- Reachable Reference | **FIXED** | Section 7 |
| P2-5 | MUST FIX 7 -- Cancel Transaction | **FIXED** | Section 8 |
| P2-6 | MUST FIX 8 -- Visual Truth | **FIXED** | Section 9 |
| P2-7 | MUST FIX 9 -- Mobile Termination | **FIXED** | Section 10 |
| P2-8 | MUST FIX 10 -- Tests | **FIXED** | Section 11 |
| P3-1 | finite validation | **FIXED** (with MUST FIX 2) | Section 3 |
| P3-2 | Reference type refactor for 4A-1B | **DEFERRED** (as instructed) | Section 12 |

No finding was **NOT REPRODUCED** -- every one described a real gap in the pre-fix code,
confirmed by re-reading it against the finding before changing anything.

## 2. MUST FIX 1 -- Gesture Session Safety

**Root cause.** `PizzaStage`'s pointermove/up/cancel handlers re-read live props
(`isTomatoSauceReference`, itself derived from `activeIngredient`/`referenceModeEnabled`)
on every event. A second finger switching the tray selection, or opening the Reference
popover, mid-hold would flip those props out from under an in-progress dispense session:
the `requestAnimationFrame` loop kept running (nothing had stopped it), while the pointer
handlers silently started treating the same gesture as the *new* selection's legacy
tap/drag path -- an orphaned RAF loop plus a state machine straddling two code paths.

**Fix.** `PizzaStage.tsx` now snapshots a `DispenseSession` (`token`, `pointerId`,
`ingredientId`) once, at `pointerdown`, in `activeSessionRef`. Every subsequent
pointermove/up/cancel/`lostpointercapture` compares against that snapshot's `pointerId`
before deciding whether this event belongs to the active dispense session -- never against
current props. `token` additionally lets the RAF loop self-check "am I still the current
session" before calling `step()` or scheduling its next frame, so a stale frame that somehow
outlives its own `cancelAnimationFrame` (belt-and-suspenders; it shouldn't happen, but now
can't matter if it does) can never call back into a superseded or stopped controller.

New abort triggers, all routed through one shared `abortActiveGesture()`:
- **Ingredient change mid-hold**: a `useEffect` diffs `activeIngredient?.id` and aborts if
  it changed while a session was active.
- **Reference overlay open**: lifted `ReferencePreview`'s open state to `App.tsx`, which
  folds it into `PizzaStage`'s `interactive` prop (`interactive={phase === "PREPARE" &&
  !isReferencePopoverOpen}`) -- reusing the exact effect BAKE already aborts through,
  instead of adding a second parallel abort mechanism.
- **BAKE**: unchanged mechanism (the same `interactive`-keyed effect), now also stopping the
  session.
- **Unmount**: the cleanup effect now also aborts any active session.

Verified live in Chromium (390x844): case 7 (ingredient switch via a real second-`pointerId`
`PointerEvent`) and case 8 (Reference popover opened the same way) both show quantity drop
to 0% the instant the abort fires, and stay at 0% after the original pointer's release --
proving the RAF loop actually stopped rather than merely being ignored. See section 11's
table.

## 3. MUST FIX 2 -- Reducer Scope Guard (+ P3-1 finite validation)

**Root cause.** `DEPOSIT_SAUCE`'s only guard was ingredient ownership. Phase/recipe/
ingredient/Mission were entirely the UI's responsibility to gate correctly -- a stale action
(e.g. one already in flight when BAKE started) could still mutate canonical pizza state for
BAKE/RESULT/ORDER, and nothing stopped a non-finite or negative `amount`/`x`/`y` from ever
reaching the reducer.

**Fix.** `DEPOSIT_SAUCE` is removed outright and replaced by `COMMIT_SAUCE_DISPENSE`
(`ingredientId`, `deposits: SauceDeposit[]` -- see section 8 for why it's a batch, not a
per-tick action). Its reducer case (`gameReducer.ts`) checks, independently, in order:

```
phase === "PREPARE"
!isMissionRound
getReferencePizza(recipe.id) exists and its sauce.ingredientId === action.ingredientId
ingredient is owned
every deposit is valid: x/y/amount all Number.isFinite, amount > 0
```

Any failure is a complete no-op (`return state`, identity-equal). `isValidSauceDeposit`/
`isValidSauceDepositBatch` (new, in `pizzaState.ts`) hold the finite/positive-amount check
(P3-1), applied to the whole batch -- one invalid deposit rejects the entire commit rather
than partially applying a corrupted payload.

**Mission is enforced from state, not trusted from the caller.** `GameState` gained
`isMissionRound: boolean`, set by `buildOrderState`'s two callers (`nextOrderState` ->
`false`, `nextMissionOrderState` -> `true`) and read directly by the guard above -- because
Margherita is one of the six Mission-eligible recipes, checking the recipe alone cannot
tell Mission and free play apart. This makes "the Prototype never applies during Mission"
a fact the reducer verifies from its own state, not a contract `App.tsx` has to uphold
correctly on every call site forever. Transient only (never read/written by
`persistence.ts` -- a round in progress is never persisted, unaffected by save schema v1).

**Inverted the old spec, as instructed.** The pre-fix regression test asserted
"`DEPOSIT_SAUCE` from ORDER is *accepted*, only `phase` itself is left unchanged" (it had no
phase gate at all). `phase4a1a.regression.test.ts` now asserts the opposite: dispatching
`COMMIT_SAUCE_DISPENSE` from ORDER returns the exact same state reference (full rejection).

Full guard-boundary suite: `gameReducer.commitSauceDispense.test.ts` (17 tests) --
ORDER/BAKE/RESULT/Mission/non-Margherita/non-tomato-sauce/unowned/empty-batch/NaN/Infinity/
zero/negative all individually proven to reject.

## 4. MUST FIX 3 -- Background/Stall

**Root cause.** `stepDispenseTicks` converted *any* elapsed time into ticks with no upper
bound. A backgrounded tab resuming after several real seconds (or minutes) would compute a
huge tick count in one `step()` call and deposit that entire gap as a single burst.

**Fix, two independent layers:**
1. **Hard cap in the tick math.** `sauceQuantity.ts`'s `computeDueTicks` (replacing
   `stepDispenseTicks`) caps at `MAX_TICKS_PER_STEP = 10` (500ms worth) per call; excess
   ticks are *dropped*, not queued -- `nextDueAt` resets to `now + SAUCE_TICK_MS` rather than
   preserving a backlog, so the very next call also behaves like a fresh short hold, never
   "catching up" later. Pinned in `sauceQuantity.test.ts` (a 10,000-tick-equivalent gap
   yields exactly `MAX_TICKS_PER_STEP` ticks, and the following call is unaffected) and
   `sauceDispenseController.test.ts`.
2. **Outright session abort on backgrounding.** New `visibilitychange`/`blur` listeners in
   `PizzaStage.tsx` call the same `abortActiveGesture()` as every other abort trigger --
   independent of and in addition to (1), so even if this listener ever failed to fire for
   some reason, the tick cap alone still bounds the damage.

Verified live: cases 11/11b (blur, `document.hidden` + `visibilitychange`) both show
quantity drop to 0% and stay there. Case 14 (`Emulation.setCPUThrottlingRate(20x)` for 1.5s
of real held time) settled at a bounded 64% rather than an instant 100% spike or runaway
growth -- an end-to-end, real-browser exercise of the cap, not just the unit tests.

## 5. MUST FIX 4 -- Spatial Sampling

**Root cause.** `SauceDispenseController.step()` deposited every tick due in a batch at
`this.position` -- wherever the finger happened to be *when the batch was processed*. A slow
frame leaving 4 ticks due at once dumped all 4 at one point; a fast device spread the same
4 ticks across 4 separate `step()` calls, each at its own position. Frame cadence alone
changed the spatial distribution (and therefore coverage/evenness) at a fixed total quantity.

**Fix.** `computeDueTicks` returns each due tick's own absolute timestamp (`dueAts`), not
just a count. The controller now records a timestamped path (`move(pos, now)` appends `{t,
x, y}`) and, for each due tick, linearly interpolates the finger's position at that tick's
exact timestamp (`interpolate(t)`) before depositing -- so a multi-tick batch lands along
the path the finger actually traveled, not bunched at the endpoint. Holding still (no
`move()` between ticks) still deposits every tick at the same point, correctly.

Pinned in `sauceDispenseController.test.ts`: a 4-move, one-`step()`-call batch produces 3
regular ticks at 3 distinct, strictly-increasing interpolated x-positions (the pre-fix
behavior would have deposited all 3 at the single endpoint position); a still hold still
deposits every tick at one point.

## 6. MUST FIX 5 -- Overflow Boundary

**Root cause.** `computeSauceMetrics` classified each deposit as 100% inside or 100%
overflow based solely on whether its center point passed `isInsideDough` -- a binary test.
A deposit at distance 47.99 from center counted entirely as quantity; one at 48.01 counted
entirely as overflow. Two positions a fraction of a percent apart could flip a deposit's
whole contribution between the two metrics.

**Fix.** New `insideDoughFraction(x, y)` (`sauceField.ts`) models each deposit as having a
small physical footprint (`DEPOSIT_FOOTPRINT_RADIUS = 3`, dough-percent units) and computes,
via the standard circle-circle intersection-area formula, what fraction of that footprint
disk overlaps the dough circle -- 1 well inside the rim, 0 well outside, and a smooth ramp
through the ~6-unit-wide annulus where they actually overlap. `computeSauceMetrics` now
splits every deposit's `amount` by this fraction (`insideAmount = amount *
insideDoughFraction(...)`, `overflowPart = amount - insideAmount`) instead of the old
either/or filter. The two shares are exact complements by construction, so
`quantity + overflowAmount` conserves the deposit's full amount at every position,
including exactly on the rim.

Pinned in `sauceField.test.ts`: `insideDoughFraction` is 1 well inside, 0 well outside, ~0.5
exactly on the rim, changes by <0.05 for a 0.2-unit position shift near the rim (the
"no discontinuous flip" property), is monotonically non-increasing with distance, and a
mixed-deposit conservation test (`quantity + overflowAmount === totalDispensed(deposits)`,
including a deposit exactly on the rim) holds to floating-point precision.

**Follow-up tuning this exposed:** `COVERAGE_THRESHOLD` was exactly equal to
`SAUCE_RATE_PER_TICK` (both 0.02), meaning a single isolated tick's own cell (falloff = 1)
landed *exactly* at the threshold and failed the strict `>` check -- an isolated dab never
registered as "touched" on its own, only overlapping ticks could. Lowered to 0.015 so a
single dab counts, which was also necessary groundwork for MUST FIX 6's fixture (see below).

## 7. MUST FIX 6 -- Reachable Reference

**Root cause.** `quantity: 0.55, coverage: 0.72` were two independently-chosen numbers.
`computeSauceMetrics`'s quantity (a sum) and coverage (a cells-touched fraction) are related,
not free variables, under this field model -- and, given `COVERAGE_THRESHOLD`, that specific
pair turned out to require more overlapping ticks (hence more quantity) than 0.55 could ever
produce to clear enough cells for 0.72 coverage. The two targets could not be hit together.

**Fix.** `referencePizza.ts` now builds `IDEAL_MARGHERITA_SAUCE_FIXTURE`: a concrete,
literally-paintable deposit sequence -- four concentric rings (46 points total, one
dispense tick's amount each) covering the dough's interior evenly while leaving a bare rim
margin, exactly matching the Reference popover's own caption ("生地全体にまんべんなく、ふち
を少し残して塗る"). `MARGHERITA_REFERENCE.sauce.quantity`/`coverage` are *derived* from that
fixture's own `computeSauceMetrics` output (rounded to 2 decimals: quantity 0.92, coverage
0.72), not chosen independently. Reachability is therefore true by construction.

`referencePizza.test.ts` (new) pins this: the fixture's own computed metrics land within
0.03 of the derived target, score >0.95 shadow similarity against it, never overflow, never
get clamped by the quantity cap (which would make the derivation circular/meaningless), and
the target values are non-degenerate (each strictly between 0.1 and 1).

The new target is honestly higher-quantity than the original guess -- "evenly coating most
of the dough to a reasonable depth" turns out to require a fairly generous total amount
under this field model, which is a more coherent design statement than the old, unreachable
"moderate amount, high coverage" pairing was. 0.55/0.72 were placeholders the brief itself
said could change before Human Feel; 0.92/0.72 replaces them, still placeholders, still not
real grams/ml (no unit field was added -- see `referencePizza.test.ts`'s explicit check).

## 8. MUST FIX 7 -- Cancel Transaction

**Root cause.** Every dispense tick dispatched `DEPOSIT_SAUCE` immediately, committing to
canonical `PizzaState.sauceDeposits` as it happened. There was no way to "undo" a tick once
generated -- an aborted gesture (any of MUST FIX 1/3/9's triggers) could only stop *further*
ticks, never retract the ones already committed. BAKE could therefore still inherit a
partially-painted, never-intentionally-finished stroke.

**Fix.** `PizzaStage` now buffers every tick of the *current* session in a local
`pendingDepositsRef` -- never dispatched anywhere as it happens. Two callbacks replace the
old per-tick `onSauceDeposit`:
- `onDispenseProgress(deposits)`: called on every tick with the full pending array so far
  (and with `[]` the instant the session ends, for any reason). `App.tsx` mirrors this into
  `pendingSauceDeposits` state, merged with canonical `state.pizza.sauceDeposits` purely for
  the Prototype Metrics panel's live numbers -- canonical game state never sees it.
- `onDispenseCommit(ingredientId, deposits)`: called **exactly once**, only from a
  *successful* pointerup, dispatching the new `COMMIT_SAUCE_DISPENSE` action with the whole
  session's deposits as one atomic batch.

Every abort path (pointercancel, `lostpointercapture`, blur/hidden, ingredient change,
Reference overlay open, BAKE, unmount, the window-level capture-failure fallback) calls
`endDispenseSession(false)` -- discard, never commit. BAKE specifically therefore can never
inherit an unfinished gesture: whatever was mid-stroke when BAKE started is thrown away in
full, and only previously *completed* (released) strokes remain on the pizza. Verified live
(case 12's screenshot): triggering BAKE mid-hold leaves the pizza with no sauce painted at
all, since that was the very first, still-unfinished stroke.

## 9. MUST FIX 8 -- Visual Truth

**Root cause.** The flat, full-circle `.pizza-sauce-layer` fill (present the instant any
sauce existed) tinted the *entire* dough uniformly, just at a quantity-scaled opacity --
so a single concentrated dab and a light all-over dusting could look similarly "sauced
everywhere", misrepresenting low coverage as "faint but present across the whole pizza".

**Fix.** For this one gated case (Margherita Reference tomato sauce, `PizzaStage`'s
`isReferenceSauceContext`), the flat fill is skipped entirely -- the 16x16 field-derived
heatmap canvas (already existing, per-cell density) is now the *only* sauce visual, both
while a session is buffering uncommitted ticks and once a stroke is committed. Bare cells
render as bare dough; only actually-touched cells render, at an intensity proportional to
their own density. Overflow dots (already existing) now scale their alpha by
`1 - insideDoughFraction` (MUST FIX 5's continuous split), so a near-rim dab reads as a
faint touch and a fully-overflowed one as a solid mark. Every other recipe/sauce/ingredient
keeps the exact original flat-fill rendering, completely untouched.

One follow-up CSS fix this exposed: the heatmap canvas had no bake-state tinting (raw/
perfect/burnt), which the flat fill used to provide -- added three small filter rules
(`.pizza-sauce-heatmap--raw/--perfect/--burnt`) mirroring the flat fill's own existing
values, so the sauce still visually reacts to bake state once baked.

Verified live: case 5 (rim stroke) screenshot shows only a thin red arc exactly where the
stroke ran, bare dough everywhere else -- unlike the pre-fix full-circle wash, this cannot
be mistaken for "sauce everywhere". Case D vs. E from the original PR (concentrated vs.
wide) now show a small dense patch vs. a broad textured area respectively, with no
background tint implying coverage that isn't there.

## 10. MUST FIX 9 -- Mobile Termination

Checked/addressed, in order:

- **`isPrimary`**: not filtered on -- the existing `pointerId`-keyed gesture/session model
  already ignores any second concurrent pointer touching the dough itself ("first finger
  wins"), which is the actual mobile-multitouch hazard; a second pointer tapping a
  *different* element (tray, Bake button) was always fine and remains so.
- **`preventDefault` where appropriate**: added to `pointerdown` (prevents a compatibility
  mouse event / text-selection drag starting alongside the pointer gesture).
- **`touch-action`**: already `none` on `.pizza-dough--interactive` (Phase 3A); unchanged.
- **`user-select`/`-webkit-user-select`/`-webkit-touch-callout`**: added to
  `.pizza-dough--interactive` -- a long hold no longer risks a text-selection or iOS
  callout bubble competing with the dispense gesture.
- **`contextmenu` suppression during an active gesture**: new `onContextMenu` handler
  preventing the default context menu while `gestureRef.current.pointerId !== null`.
- **`visibilitychange`/`blur`**: section 4.
- **`lostpointercapture`**: already handled pre-fix; now also ends the session via the
  same `abortActiveGesture()` as every other trigger.
- **Pointer capture failure**: the existing try/catch around `setPointerCapture` already
  let the gesture continue via normal bubbling; the gap was *release* after capture failed
  and the finger left the element before lifting.
- **Window-level `pointerup`/`pointercancel` fallback** (new): catches exactly that gap --
  verified live by overriding `setPointerCapture` to throw, then dragging off the dough and
  releasing there; the session still ended cleanly (quantity stable across an extra 600ms
  wait, zero console/page errors) instead of leaking.

## 11. MUST FIX 10 -- Tests

**New/updated unit test files** (pure logic, no DOM/component harness needed): 3 new files
plus 5 rewritten to match the fixed APIs. Full list and counts in section 15.

**What a focused RED-then-GREEN pass looked like for the architectural fixes:** the fixed
APIs (`computeDueTicks`'s per-tick timestamps, `insideDoughFraction`'s continuous split,
`COMMIT_SAUCE_DISPENSE`'s guard, the fixture-derived Reference target) did not exist in the
pre-fix code at all, so "run the new test against the old code" isn't meaningful for most of
them -- the old code's behavior *was* the bug the finding described, verified by re-reading
it against each finding before writing the replacement. Two cases did get a literal
RED-then-GREEN cycle within this session: the spatial-sampling test initially asserted 4
ticks/an endpoint-exclusion property that didn't match `computeDueTicks`'s actual due-time
semantics (an off-by-one in the test itself, not the implementation) and failed until
corrected to 3 ticks at distinct interpolated points; the wide-distribution/thin-spread
`sauceField.test.ts` cases failed until deposit amounts were raised above
`COVERAGE_THRESHOLD` following that constant's fix.

**Live-browser scenarios (390x844, fresh save each run, Chromium via Playwright)**,
covering the failure modes a unit test can't reach without a DOM:

| # | Scenario | Result |
|---|---|---|
| 1 | Normal stroke | 量38% 被覆12% 均一性77% はみ出し0% |
| 2 | Short dab | 量2% (one starter tick) |
| 3 | Concentrated long stroke | 量100%(capped) 被覆5% |
| 4 | Wide spread | 量88% 被覆48% 均一性91% |
| 5 | Rim stroke | 量34% 被覆12% はみ出し28% -- smooth arc, no flat wash (screenshot) |
| 6 | Outside/rim crossing | 量30% はみ出し32% |
| 7 | Ingredient change mid-hold | mid 14% -> after switch **0%** -> after release **0%** |
| 8 | Reference popover open mid-hold | mid 14% -> popover open, release no-ops -> after close **0%** |
| 9 | `pointercancel` | before 10% -> after + 400ms wait **0%**, no growth |
| 10 | `lostpointercapture` | **0%** after |
| 11 | `blur` | before 10% -> after + wait **0%** |
| 11b | `visibilitychange` (hidden) | before 10% -> after + wait **0%** |
| 12 | BAKE mid-hold (2-pointer race) | dough loses `interactive`; pizza shows no sauce (unfinished stroke discarded, per MUST FIX 7) |
| 13 | Rapid down/up x5 | 量10% (5 x one starter tick, no double-counting) |
| 14 | Frame stall (20x CPU throttle, 1.5s held) | 量64%, bounded -- not an instant spike, not runaway |
| capture-failure fallback | drag off-dough, release outside with `setPointerCapture` forced to throw | session ended cleanly (13% stable across +600ms), no leak |

**Across every scenario above and the original A-H set: console errors = 0, page errors =
0, horizontal overflow = 0px.**

**Not covered by an automated test, and why:** PizzaStage's own event wiring has no
component-test harness in this repo (no `@testing-library/react`/jsdom; `vitest.config.ts`
runs `environment: "node"`) -- unchanged from the original PR, and no new dependency was
added to avoid destabilizing the toolchain further. Every piece of *logic* the fixes
introduced (tick timing/capping/interpolation, the overflow split, the reducer guard, fixture
reachability) is unit tested directly; the *wiring* of that logic to real pointer/window/
visibility events is what the live-browser table above verifies instead.

## 12. P3 disposition

- **P3-1** (finite validation): folded into MUST FIX 2, see section 3.
- **P3-2** (Reference type refactor for 4A-1B): **deferred**, as the brief explicitly
  allowed. No `version`/`id`/tolerance fields were added -- `ReferenceSauce`/`ReferencePizza`
  are unchanged in shape from the original PR, only `MARGHERITA_REFERENCE`'s two numeric
  values and their derivation changed (MUST FIX 6). Hungarian algorithm, Mozzarella/Basil
  matching, and authoritative Scoring 2.0 remain unimplemented, as instructed.

## 13. Scope Guard (unchanged)

`scorePizza`, Dex BEST/★, `totalStars`, Mission scoring, Pitz/Shop, and save schema v1 were
not touched by any of the above. The Reference/Quantity Prototype remains gated to FREE
Margherita only -- now enforced independently at the reducer level (`isMissionRound` +
`getReferencePizza`), not just by the UI, which is itself one of the ten fixes.

## 14. Regressions

All 254 pre-existing tests (from before Phase 4A-1A) and the 51 tests added in the original
PR still pass, updated only where their own spec was the thing MUST FIX 2 asked to invert
(`phase4a1a.regression.test.ts`) or where they exercised an API this session's fixes
replaced (`sauceQuantity.test.ts`, `sauceDispenseController.test.ts`,
`gameReducer.sauceDeposit.test.ts` -> `gameReducer.commitSauceDispense.test.ts`). No
previously-passing behavioral assertion was weakened; several were strengthened (e.g. the
ORDER-phase test now asserts full rejection instead of partial acceptance).

## 15. Quality gates

- `npm test -- --run`: **340/340 passing** (up from 305 pre-fix: +2 net test files after
  removing the old DEPOSIT_SAUCE-specific file and adding
  `gameReducer.commitSauceDispense.test.ts` + `referencePizza.test.ts`, with several
  existing files gaining new cases).
- `npm run lint` (oxlint): clean, 0 warnings, 0 errors (one `react-hooks/exhaustive-deps`
  warning surfaced mid-session from a memoization gap this fix introduced, fixed via a
  proper `useMemo` before the final pass).
- `tsc -b && vite build`: clean.
- `git diff --check`: clean (no whitespace errors).
- Node 22.22.2 throughout -- the Phase 4A-0-reported Node/oxlint issue did not reproduce in
  this environment, consistent with the original PR's report.

## 16. Files changed this session

New: `src/data/referencePizza.test.ts`,
`src/state/gameReducer.commitSauceDispense.test.ts`.
Removed: `src/state/gameReducer.sauceDeposit.test.ts` (superseded).
Modified: `src/App.css`, `src/App.tsx`, `src/components/PizzaStage.tsx`,
`src/components/ReferencePreview.tsx`, `src/data/referencePizza.ts`,
`src/logic/sauceDispenseController.ts` (+ its test), `src/logic/sauceField.ts` (+ its
test), `src/logic/sauceQuantity.ts` (+ its test), `src/state/gameReducer.ts`,
`src/state/pizzaState.ts`, `src/state/phase4a1a.regression.test.ts`.

## 17. Human Feel Gate readiness

**Technical Merge Readiness: restored.** Every P1/P2 finding has a verified fix (unit tests
plus live-browser reproduction where the finding was about event wiring); no known P0/P1
remains; P2 items are exhausted; P3 items are either folded in or explicitly, correctly
deferred per the brief. Quality gates are green with a regression-free 340-test suite.

**Human Feel Readiness: ready to proceed**, with the same known limitations already on
record from the original PR (heatmap is a blocky 16x16 raster, not anti-aliased; the
Reference target is still a placeholder pending real feedback -- now at least a reachable
one) plus one new, explicitly acceptable trade-off from MUST FIX 7: a gesture in progress
when BAKE starts is discarded in full, not partially preserved -- this was the finding's own
explicit ask ("ユーザーが確定済みstrokeだけを使う安全な仕様にする"), not a bug.
