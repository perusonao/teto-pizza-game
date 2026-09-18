# Teto Pizza Game — Issue #33 Dough Shaping — D1 Implementation Result

**Type:** Implementation. Implements D1 directly from
`docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md` (including its post-Issue-47
Revalidation section) — no new audit, per the task instruction.

- **Base SHA (fresh `origin/main` at task start):** `2da3949de5bd642c709ca6ba343bc57d8101d03d`
  (Merge PR #51: Issue #33 Dough D0 revalidation) — matches the task's expected SHA exactly.
- **D1 implementation SHA:** `19e993274e86216417ea2c238cefa7ea6ad25518`
- **D2 Human Feel Fix SHA (PR head):** `8ddefcdba54b598ae1abadd74dacbece9deb7994`
- **Branch:** `claude/dough-d1-implementation-puivuf` (same branch/PR throughout D1 and D2)
- **PR:** [#54](https://github.com/perusonao/teto-pizza-game/pull/54) — CI green, `mergeable_state: clean`.
- **Preview:** deployed to `perusonao/teto-pizza-game-preview` at the current HEAD each time —
  see §11 for D1's own deployment record and §14 for D2's.
- **Status:** D1 functional result — PASS. D1 Human Feel result (ChatGPT review of
  `TETO_ISSUE-33_DOUGH-D1_ReviewPlaythrough.mp4`) — **NEEDS D2 POLISH BEFORE MERGE** (sharp
  local spikes from a single-direction drag). §14 documents the D2 fix for that finding.

---

## 1. Scope delivered

Making flow changed from `SAUCE → CHEESE → TOPPING` to
`DOUGH → SAUCE → CHEESE → TOPPING`, exactly as specified. The player must physically stretch
the dough (single-finger radial drag from center outward) before sauce becomes available.

## 2. State model

- `PizzaState.doughShape: DoughShape` (`src/state/pizzaState.ts`) — an 8-point radial array
  (`src/logic/doughShape.ts`), reducer-owned, canonical.
- `DoughShape = { radii: number[8] }` — `radii[i]` is the boundary radius at angle
  `i * (360°/8)`, measured the same way `clientPointToDoughPercent`/`isInsideDough` already do
  (0 = dough-local "east", increasing clockwise).
- Fresh pizza (`createEmptyPizza()`): all 8 radii equal `INITIAL_DOUGH_RADIUS`
  (`DOUGH_RADIUS × 0.38 ≈ 18.24`) — "小さく厚い丸い生地," a plain small circle.
- **No Save schema change.** `GameState` (and therefore `PizzaState`) is never serialized —
  confirmed unchanged in `src/state/persistence.ts` (not touched by this PR).
- `MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING"` (`src/state/gameReducer.ts`),
  `MAKING_STEP_ORDER` prepended with `"DOUGH"`.
- **The audited two-literal correction, both applied:**
  - `buildOrderState`'s initial `makingStep`: `"SAUCE"` → `"DOUGH"` (the one shared path behind
    every "start a new round" case — FREE, Lunch Rush, `SELECT_RECIPE`, `RETRY_SAME_RECIPE`).
  - `RESET_PIZZA`'s reducer case `makingStep` target: `"SAUCE"` → `"DOUGH"` (independent
    literal, confirmed both now move together).
- New action `COMMIT_DOUGH_STRETCH { shape: DoughShape }` — commits one gesture's final shape
  atomically, re-checks `phase === "PREPARE" && makingStep === "DOUGH"` and
  `isValidDoughShape(shape)` independently at the reducer boundary (mirrors
  `COMMIT_SAUCE_DISPENSE`'s own belt-and-suspenders guard).
- `CONFIRM_MAKING_STEP` is **not** gated on dough completion at the reducer layer (matches
  every other step — SAUCE/CHEESE have no reducer-side completion gate either); it now also
  recomputes `hint` for the step being entered, so DOUGH's own hint text doesn't linger into
  SAUCE for a moment after confirming (see §7).

## 3. Gesture model

`src/logic/doughShape.ts` (pure, no DOM, mirrors `sauceQuantity.ts`'s own convention):

- `applyStretchPoint(shape, xDough, yDough)`: projects the touch point to `(angle, distance)`
  from `DOUGH_CENTER`. **Updated by the D2 Human Feel Fix (§14)** — originally (D1) only the
  two control points bracketing the touch angle moved; as of D2, the touch spreads across a
  falloff of nearby control points (strongest at the closest point, tapering through its
  neighbors) with a spike-suppression clamp, so a single drag no longer creates a sharp
  isolated bulge. **Monotonic by construction** — every point's own value only ever increases
  across calls, so a point can never shrink within one DOUGH attempt (see §14 for exactly how
  this is preserved alongside the new clamp).
- `smoothDoughShapeForDisplay(shape, scale)`: Catmull-Rom-to-Bezier through the 8 points,
  producing a closed SVG path — used both for the on-screen shape (`scale = 1`, 0–100 percent
  space) and for `PizzaStage`'s `objectBoundingBox` clip-path (`scale = 0.01`, 0–1 fractions).

`src/components/PizzaStage.tsx` — new DOUGH gesture branch, reusing 100% of the existing
gesture-lifecycle plumbing:

- Position-driven, **no RAF/tick** (unlike sauce) — every `pointermove` (and `pointerdown`
  itself, for immediate feedback) calls `applyStretchPoint` directly against a local
  `doughGestureShapeRef` (mirrors `pendingDepositsRef`'s ephemeral/canonical split).
- Applying the stretch on `pointerdown` too (not just `pointermove`) makes a plain tap register
  instantly and — structurally — guarantees a DOUGH-step press can never fall through to
  `onTap`/`PLACE_TOPPING`/`APPLY_SAUCE` (`handlePointerUp`'s DOUGH-commit branch runs before the
  generic tap fallback, gated on `doughGestureShapeRef.current !== null`, which is always
  non-null after any DOUGH pointerdown). Regression-pinned in
  `PizzaStage.doughStretch.test.tsx`.
- Committed atomically via `onDoughStretchCommit` at a successful pointerup only. Discarded
  (never committed) on `pointercancel`, `lostpointercapture`, blur/hidden, a reset
  (`resetToken`) or step change (`makingStepToken`) mid-hold, or the window-level
  pointerup/pointercancel fallback.
- **Found and fixed a pre-existing gap while wiring this up:** the blur/`visibilitychange`
  abort effect (`abortForBackgrounding`) only ever checked `activeSessionRef` (the sauce
  dispense session), never the more general "is any gesture live" check the
  `resetToken`/`makingStepToken` effects already use — so backgrounding the tab mid-DOUGH-drag
  didn't abort it. Widened to `activeSessionRef.current || gestureRef.current.pointerId !==
  null`, matching those other two effects exactly; full suite re-run clean afterward (this also
  incidentally closes the same latent gap for the topping/scatter gesture family).
- `isKeyboardPlaceable` now also excludes DOUGH (same reasoning as sauce's own SPREAD
  exclusion) — no real keyboard equivalent exists yet (tracked under Issue #27, not built here).

## 4. Visual / carry-through

- `PizzaStage` renders `.pizza-dough-shape` (`src/App.css`) — a dedicated inner layer, first
  child of `.pizza-dough`, clipped via an `objectBoundingBox <clipPath>` built from
  `smoothDoughShapeForDisplay(displayShape, 0.01)`, carrying the dough's own gold gradient.
  `.pizza-dough` itself becomes a neutral "work surface" tone (`--has-shape-layer` modifier)
  once the shape layer is present, so the actual hand-stretched boundary reads clearly instead
  of blending into an already-full circle of the same hue.
- This single mechanism is what satisfies "sauce/cheese/toppings sit on the shaped dough": all
  of `PizzaStage`'s other layers are unaffected children of the same clipped
  `.pizza-dough-shape`-adjacent DOM, so nothing about their own rendering needed to change.
- Renders from the moment PREPARE begins (`showDoughShape = state.phase !== "ORDER"`) through
  SAUCE/CHEESE/TOPPING/BAKE/RESULT unchanged, since `pizza.doughShape` only ever mutates via
  `COMMIT_DOUGH_STRETCH`, itself gated to `makingStep === "DOUGH"`.
- `.pizza-dough--raw/--perfect/--burnt`'s own crust-color swap is mirrored onto
  `.pizza-dough-shape` (their `filter` already cascades to it automatically; `background` does
  not, so that one property is restated) — BAKE's raw/perfect/burnt visual identity is
  preserved exactly, just now painted on the correct (possibly irregular) boundary.
- A faint dashed target-guide ring at the full `DOUGH_RADIUS` (`.dough-target-guide`, mirrors
  the existing `.sauce-target-guide` convention) shows only during DOUGH's own interaction, so
  a first-time player always has a visible target to pull toward.
- Zero changes to `.pizza-dough`/`.pizza-stage`'s own sizing/positioning rules, or to
  `pizzaCoordinates.ts`'s constants — the physical hit area (`DOUGH_RADIUS = 48`) is unchanged;
  only what's *painted* inside it changes.

## 5. Completion rule

```
sizeProgress = mean(doughShape.radii) / DOUGH_RADIUS
complete = sizeProgress >= 0.75   // DOUGH_COMPLETION_THRESHOLD, provisional
```

Size only — no roundness/evenness/symmetry gate in D1, per the task's own "厳しすぎない"
instruction. Enforced **only at the UI layer**: `GameScreen`'s `次へ` button gets
`disabled={state.makingStep === "DOUGH" && !doughShapeComplete}`; `doughShapeComplete` is
computed live in `App.tsx` from `pendingDoughShape ?? state.pizza.doughShape` (mirrors
`sauceMetrics`' own live-preview pattern), so the CTA unlocks mid-drag, before the player even
releases. The reducer's own `CONFIRM_MAKING_STEP` is deliberately **not** gated (pinned by an
explicit test in `onewayFlow.test.ts`, matching D0 §10 item 3's instruction not to accidentally
harden this into a stricter reducer rule later).

## 6. Reset / retry lifecycle

Every "fresh dough" path is now covered:

| Path | Result |
|---|---|
| Fresh FREE round (`nextOrderState`) | `makingStep: "DOUGH"`, fresh `doughShape` |
| Fresh Lunch Rush round (`nextMissionOrderState`) | same, via shared `buildOrderState` |
| Pizza Select (`SELECT_RECIPE`) | same, via shared `buildOrderState`/`startPreparingRecipe` |
| Same-recipe retry (`RETRY_SAME_RECIPE`) | same, via shared `buildOrderState`/`startPreparingRecipe` |
| Mid-round discard (`RESET_PIZZA`) | `makingStep: "DOUGH"`, fresh `doughShape`, `makingStepToken` bumped |

All five share the same one or two code paths (`buildOrderState`'s single `makingStep` literal,
`RESET_PIZZA`'s own independent literal) — no per-path drift possible.

`PizzaStage`'s existing `resetToken`/`makingStepToken`-keyed abort effects invalidate any
in-flight DOUGH gesture with **zero new abort code** (only the new gesture branch itself needed
to respect the same shared `abortActiveGesture()`/`discardDoughGesture()` calls every other
family already goes through).

## 7. Guidance copy

`src/data/hints.ts`'s `buildHintLine` now takes `makingStep` and short-circuits to a dedicated
DOUGH branch before the sauce/ingredient-based inference: `「生地を外側へ伸ばそう」` (default),
a slightly longer explicit-hint variant for the `ヒント` button. `CONFIRM_MAKING_STEP` now
recomputes `hint` for the newly-entered step (a small, zero-behavior-change-elsewhere addition
needed once DOUGH's hint stopped "naturally expiring" via ingredient-content inference the way
SAUCE's always incidentally did).

## 8. Exact files

**New:**
- `src/logic/doughShape.ts` — pure shape math.
- `src/logic/doughShape.test.ts` — 17 tests.
- `src/components/PizzaStage.doughStretch.test.tsx` — 10 tests.
- `docs/reports/TETO_ISSUE-33_DOUGH-D1_Result.md` — this file.

**Changed:**
- `src/state/gameReducer.ts` — `MakingStep`/`MAKING_STEP_ORDER`, `buildOrderState`,
  `RESET_PIZZA`, new `COMMIT_DOUGH_STRETCH` action/case, `CONFIRM_MAKING_STEP` hint recompute,
  every `buildHintLine` call site updated for its new `makingStep` parameter.
- `src/state/pizzaState.ts` — `doughShape` field, `createEmptyPizza()`.
- `src/components/PizzaStage.tsx` — new DOUGH gesture branch (pointerdown/move/up/cancel/
  lostpointercapture/window-fallback), shape-layer + target-guide rendering, the
  `abortForBackgrounding` fix, `isKeyboardPlaceable` DOUGH exclusion.
- `src/App.tsx` — `makingStepToCategory` DOUGH case, `pendingDoughShape` state,
  `handleDoughStretchProgress`/`handleDoughStretchCommit`, `showDoughShape`/
  `doughShapeComplete` derivations, `selectedIngredientId` lifecycle moved from round-start to
  "reaching SAUCE," `isRoundInProgress()`'s `!== "SAUCE"` → `!== "DOUGH"`.
- `src/screens/GameScreen.tsx` — `PizzaStage`/CTA wiring, `IngredientTray`/`SauceMetricsPanel`
  hidden during DOUGH, 4-way CTA branch with DOUGH's own `disabled` state.
- `src/data/hints.ts` — DOUGH branch + copy.
- `src/App.css` — `.pizza-dough-shape`, `.pizza-dough--has-shape-layer`, cascaded
  raw/perfect/burnt overrides, `.dough-target-guide`. No changes to existing
  `.pizza-dough`/`.pizza-stage` sizing rules.
- Test fixtures updated for the new required props/initial step across `App.test.tsx`,
  `App.humanFeelFix3.test.tsx`, `App.playerReference.test.tsx`,
  `IngredientPieceVisual.test.tsx`, `IngredientTray.physicalDragReset.test.tsx`,
  `IngredientTray.stepLock.test.tsx`, `PizzaStage.sauceParity.test.tsx`,
  `PizzaStage.sauceReset.test.tsx`, `GameScreen.keyboardOverlay.test.tsx`,
  `GameScreen.keyboardSpreadRepeat.test.tsx`, `GameScreen.physicalDragOverlay.test.tsx`,
  `gameReducer.test.ts`, `gameReducer.commitSauceDispense.test.ts`,
  `gameReducer.pieceDrag.test.ts`, `phase4a1a.regression.test.ts`, `onewayFlow.test.ts`
  (substantially extended, not just patched — see §9), `hints.test.ts`.

**Not touched** (confirmed): `pizzaCoordinates.ts`'s own constants, `sauceField.ts`,
`sauceDispenseController.ts`, `sauceQuantity.ts`, `recipeSauceProfiles.ts`, `scoring.ts`,
`scoringV2/*`, `persistence.ts`, `dex.ts`, `progression.ts`, `economy.ts`,
`mission/lunchRush.ts`, `IngredientTray.tsx`'s own physical-drag system, any HOME/Pizza
Select/Dex/Shop component, `referencePizza.ts`.

## 9. Tests

`npm test`: **972/972 passing** (up from 938 baseline), across 54 files (up from 53).

Coverage added/extended, per the task's own list:
- initial step is DOUGH (`onewayFlow.test.ts`, `gameReducer.test.ts`)
- Pizza Select starts DOUGH (`gameReducer.test.ts` `SELECT_RECIPE`)
- same-recipe retry starts fresh DOUGH (`gameReducer.test.ts` `RETRY_SAME_RECIPE`)
- RESET starts fresh DOUGH (`onewayFlow.test.ts`, extended `steps` array)
- radial shape mutation / only intended point(s) change (`doughShape.test.ts`,
  `PizzaStage.doughStretch.test.tsx`)
- completion below/at/above 0.75 (`doughShape.test.ts`)
- cannot advance early is a UI-only gate, reducer stays ungated (explicit pin in
  `onewayFlow.test.ts`); UI-level disabled-CTA check in `App.humanFeelFix3.test.tsx`
- DOUGH → SAUCE transition + shape preserved after it and through every later step, BAKE,
  RESULT (`onewayFlow.test.ts`)
- stale gesture after reset/step-transition ignored (`PizzaStage.doughStretch.test.tsx`,
  `onewayFlow.test.ts`'s `COMMIT_DOUGH_STRETCH` stale-event pin)
- FREE and Lunch Rush flows (`onewayFlow.test.ts`'s `describe.each`, `gameReducer.test.ts`'s
  own Lunch Rush Scoring 2.0 Shadow test)
- existing Sauce/Cheese/Topping behavior unaffected (every fixture above updated to route
  through DOUGH first, then re-verified green)
- Save schema unchanged (confirmed by inspection — `persistence.ts` untouched; no dedicated
  test needed, matches D0 §5's own "no persistence tests needed" conclusion)
- Scoring2 unchanged (`gameReducer.test.ts`'s Scoring 2.0 Shadow FREE/Lunch Rush tests still
  pass unmodified in substance, only their fixture's step sequence gained the extra DOUGH hop)

`npx tsc -b`: clean. `npm run lint` (oxlint): clean. `npm run build`: clean
(316.33 kB / 101.06 kB gzip).

## 10. Scope guard

Confirmed **not** implemented, per the task's explicit list: Dough scoring, roundness score,
evenness score, Dough inventory, Save migration, Economy/Pitz changes, Scoring 2.0 authority
changes, Recipe changes, Reference scoring changes, Sauce scoring changes, Cheese/Topping
gesture redesign, Bake scoring changes.

## 11. Preview deployment & smoke verification

Deployed via `teto-pizza-game-preview`'s existing manual pipeline (unchanged, no new workflow
files added), following the exact process from `docs/reports/TETO_ISSUE-39_PS1-PS2_Preview-Gate.md`:

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=19e993274e86216417ea2c238cefa7ea6ad25518`,
   `pr_number=54` → success, pushed `perusonao/teto-pizza-game-preview`'s `site/` and `README.md`
   as commit `5beda69825d83e517b3fd0f7c0ea56d7f178c358` ("Deploy preview:
   19e993274e86216417ea2c238cefa7ea6ad25518 (19e9932)").
2. `pages.yml` (`workflow_dispatch`) → success, published that same commit.
3. `README.md` on the preview repo's `main` confirms: Source ref `19e993274e86216417ea2c238cefa7ea6ad25518`,
   Source PR `#54`.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

This sandboxed session's outbound network policy blocks `perusonao.github.io` directly (same
caveat the PS1/PS2 Preview-Gate report already documented for this project). To still verify
real behavior rather than only trusting the Actions run logs, this session rebuilt **the exact
same source commit with the exact same build command** the workflow used
(`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=54 VITE_PREVIEW_SHA=19e9932 vite build
--base=/teto-pizza-game-preview/`, plus the same manifest/`noindex` post-processing read
directly from `deploy-from-source.yml`), served that output locally, and drove a real
headless-Chromium (390×844) smoke test and the full Review Playthrough recording against it —
byte-for-byte the same static bundle now live at the Preview URL.

| Check | Result |
|---|---|
| Preview badge | ✅ `"PREVIEW · PR#54 · 19e9932"` |
| `noindex` | ✅ `<meta name="robots" content="noindex, nofollow">` present |
| Storage isolation | ✅ confirmed by inspection — `persistence.ts` (untouched by this PR) keys the save under `teto-pizza-preview-save-v1` whenever `VITE_PREVIEW_MODE` is set, never the production `teto-pizza-save-v1`; empty `localStorage` on first load confirms a fresh preview-scoped save |
| Production untouched | ✅ `deploy-from-source.yml` only ever pushes to the separate `teto-pizza-game-preview` repo (confirmed by reading the unmodified workflow); no push was made to `teto-pizza-game`'s `main`/Pages/Actions by this session |
| 390×844 no overflow | ✅ `scrollWidth === clientWidth` (390) |
| DOUGH renders correctly | ✅ small initial dough, dashed target-guide ring, DOUGH-specific hint text, tray/SauceMetricsPanel hidden |
| Next CTA gating | ✅ disabled before the size threshold, enabled after a full radial stretch |

**One real gap found and fixed during this smoke pass:** the DOUGH CTA's `disabled` attribute
correctly blocked the click but had no visual distinction from the enabled state (no
`.cta-button:disabled` rule existed anywhere in `App.css`, since no CTA before this PR was ever
disabled). Added a muted/flat disabled style (commit `19e9932`) so "not yet" reads at a glance,
per the task's own "Next disabled / unavailable... clearly available" requirement — screenshots
before/after confirmed the fix, full suite re-verified green afterward.

## 12. Known D1 limitations

1. **Provisional numeric knobs**, exactly as flagged by the D0 audit: `INITIAL_DOUGH_RADIUS_FRACTION`
   (0.38) and `DOUGH_COMPLETION_THRESHOLD` (0.75) are both tunable, not final — real iPhone
   Human Feel (D2) is expected to adjust them.
2. **No roundness/evenness feedback** — a wildly lopsided-but-large-mean shape completes
   identically to an even one, by design (D1 scope boundary), but this means the *visual*
   payoff of pulling evenly (a rounder final crust) is currently the only incentive; no numeric
   signal reinforces it yet.
3. **No decoration** — flour dust, stretch marks, elastic wobble are explicitly deferred to D2
   ("D1では装飾より操作感優先"). The dough-shape layer today is a smoothed gradient fill only.
4. **No keyboard/accessibility path for DOUGH** — same pre-existing gap as sauce painting,
   tracked under Issue #27, not built here (the dough is simply excluded from the keyboard tab
   order while it's the active step, same treatment SPREAD ingredients already get).
5. **Edge case: a topping placed near a "thin" wedge of a very lopsided committed dough** could
   land at a coordinate that's technically inside `DOUGH_RADIUS` (still valid, since hit-testing
   is unchanged) but visually outside the *painted* (clipped) boundary at that particular angle,
   since topping placement doesn't consult `doughShape` at all. Low severity for D1 (requires an
   extreme, still-passing-threshold shape) and consistent with "reasonable imperfection remains
   viable" — flagged for D2/D3 consideration, not fixed here (would require topping placement to
   either consult the dough boundary or accept the visual mismatch as charming imperfection).
6. **`.pizza-dough`'s decorative border ring** becomes invisible in areas where the current
   `doughShape` boundary sits well inside the full 300px circle (e.g. the initial small dough) —
   acceptable for D1 (decoration explicitly deferred), but a D2 polish candidate.

## 13. Recommended D2 polish items

- Real iPhone Human Feel pass on `INITIAL_DOUGH_RADIUS_FRACTION`/`DOUGH_COMPLETION_THRESHOLD`.
- Decoration pass: subtle flour texture, stretch-mark shading along the boundary, a soft
  "give"/elastic wobble on release.
- Consider a light `roundness`/`evenness` *visual* cue (not a scoring gate) — e.g. a gentle
  shimmer once the shape is both complete AND reasonably even — to reward pulling evenly without
  introducing a hard D1 scoring rule.
- Consider whether topping placement should be visually nudged inward when it would land in a
  currently-thin wedge (§11 item 5), once D3 scoring integration revisits placement rules.
- Re-evaluate `.pizza-dough`'s border-ring visibility once the shape is small (§11 item 6) —
  possibly a thin outer guide ring that stays visible regardless of the inner shape's size.

---

## 14. D2 Human Feel Fix

### 14.1 Original Human Feel finding

ChatGPT reviewed `artifacts/review/TETO_ISSUE-33_DOUGH-D1_ReviewPlaythrough.mp4`. D1's
functional result: **PASS** (every acceptance item in the original task — DOUGH first,
gesture, completion gate, carry-through, reset/retry — worked correctly). D1's Human Feel
result: **NEEDS D2 POLISH BEFORE MERGE** — dragging in one direction could produce a sharp,
localized bulge that read as manipulating polygon/control points rather than stretching pizza
dough. Root cause (confirmed by inspection and reproduced numerically, see 14.2): D1's
`applyStretchPoint` only ever moved the two control points immediately bracketing the touch
angle. A single full-reach pull at one control point's own angle jumped that point from
`INITIAL_DOUGH_RADIUS` (≈18.24) straight to `DOUGH_RADIUS` (48) — a ~30-unit radius gap to its
completely untouched immediate neighbor over one 45° step — which the Catmull-Rom smoothing
could soften visually but not eliminate at that magnitude.

**D2 scope discipline (per the task's own instruction): the D1 architecture is unchanged.**
Still the 8-point radial array, still reducer-owned `PizzaState.doughShape`, still a
single-finger outward stretch committed atomically at pointerup, still `resetToken`/
`makingStepToken` stale-gesture protection, still the 0.75 size-only completion rule, still
carry-through into SAUCE/CHEESE/TOPPING/BAKE/RESULT unchanged. Only `applyStretchPoint`'s own
internal math changed; its signature, its call sites (`PizzaStage.tsx`), and every other
exported function in `doughShape.ts` are untouched.

### 14.2 Algorithm: before vs. after

**D1 (before):** touch angle → continuous index `rawIndex` → the two bracketing integer
indices `index0 = floor(rawIndex)`, `index1 = index0 + 1` each blend toward the touch distance
with complementary weights `weight0 + weight1 = 1`. No other point is ever touched by a given
gesture step.

**D2 (after):** touch angle → the same continuous `rawIndex` → **every** control point `i`
receives a weight from a continuous, circular-distance-based falloff (`stretchFalloff`,
14.3), and blends toward the touch distance by that weight (zero-weight points, `circularDistance
>= 2`, are skipped as a no-op). The result is then passed through a **spike-suppression clamp**
(14.4) before being returned. Both stages live inside the same `applyStretchPoint` function in
`src/logic/doughShape.ts`; nothing moved to a new file or a new exported API.

```
// D1
radii[index0] = lerpTowardAtLeast(radii[index0], distance, weight0);
radii[index1] = lerpTowardAtLeast(radii[index1], distance, weight1);

// D2
for (i of all 8 points) {
  weight = stretchFalloff(circularIndexDistance(i, rawIndex, 8));
  if (weight > 0) propagated[i] = lerpTowardAtLeast(original[i], distance, weight);
}
radii[i] = max(original[i], min(propagated[i], neighborAvg(original, i) + SPIKE_MAX_DELTA));
```

### 14.3 Propagation weights

`stretchFalloff(d)` — piecewise-linear, continuous in the circular distance `d` (in
control-point-index units) from the touch angle to a given control point:

| Circular distance `d` | Weight |
|---|---|
| 0 (touch itself) | 1.0 |
| 1 (immediate neighbor, `i±1`) | **0.45** |
| 2 (next ring, `i±2`) | **0.12** |
| > 2 | 0 |

Linearly interpolated between these anchors (e.g. `d = 0.5` → weight `0.725`) so a touch
between two control points doesn't snap discontinuously between weight profiles. These are the
task's own example-concept numbers (adjacent ~0.35–0.55, next ~0–0.15) — chosen as a starting
point and confirmed sufficient by the numeric/visual verification in 14.6, not further tuned.
`i±2` is included (not left out) because the D0/D2 audit's own "optionally, only if needed"
condition was met: without it, the falloff cut off too abruptly at the first neighbor and the
transition from "touched region" to "untouched region" was still visually a step.

Circular indexing (`circularIndexDistance`) means index 0 and index 7 are always exactly 1
apart, matching every other 8-point wraparound already in this codebase (`(i + 1) %
DOUGH_SHAPE_POINTS` etc.) — verified explicitly by a dedicated test (14.7).

### 14.4 Spike suppression

A **neighbor-aware clamp**, not a physics/spring model and not a global average:

```
cap = (original[i-1] + original[i+1]) / 2 + SPIKE_MAX_DELTA   // SPIKE_MAX_DELTA = 12
radii[i] = max(original[i], min(propagated[i], cap))
```

- The cap uses each point's **pre-call** neighbor values, so it measures "how far did *this one
  gesture step* push this point past what its surroundings already were" — exactly the
  "sharp mountain from one drag" complaint — rather than a shape-wide constraint.
- The outer `max(original[i], ...)` floor is what keeps every point's own monotonic
  non-decrease intact (D0 §4.6, explicitly kept): the clamp can only soften *this* gesture's
  own reach, it can never undo growth a previous gesture already committed. Pinned by an
  explicit test (`doughShape.test.ts`, "is monotonic across every point... across a long mixed
  gesture sequence").
- Reaching `DOUGH_RADIUS` at one exact spot now takes a few gestures in roughly the same area
  (each one also raises that area's neighbors, which raises the next pull's own cap) instead of
  one instant full-reach drag — this is what satisfies task item 4's "progressive and
  controllable... not rubbery snap/instant inflation" without a separate sensitivity change
  (14.5).
- Never forces a perfect circle and never globally averages: a point with no nearby touch
  history is never altered by a clamp evaluation elsewhere on the shape (the clamp only ever
  runs against the point *this call's* propagation just touched), and the floor guarantees
  genuine player-made asymmetry (e.g. one side pulled, the other never touched) is fully
  preserved — see 14.7's "asymmetry remains fully achievable" test.

`SPIKE_MAX_DELTA = 12` was chosen and confirmed (14.6) to noticeably soften a single pull
(the D1-baseline ~30-unit one-step gap drops to well under half that) while still letting the
touched point end up clearly the largest in its neighborhood, and without preventing the 0.75
completion threshold from being reached in a handful of gestures (14.6).

### 14.5 Drag sensitivity

Reviewed per task item 4. **No gain/sensitivity reduction was made.** The touched point's own
target distance is still a direct 1:1 mapping of pointer distance from center (unchanged from
D1) — this is what makes the gesture feel immediately responsive, and the Human Feel complaint
was specifically about the *shape* one drag produced (an isolated spike), not about how far a
single drag could reach. Softening that shape via propagation + the spike clamp (14.3/14.4)
addressed the complaint directly without also making the primary point's own response feel
laggy. Confirmed by the visual check in 14.6: a single strong pull now reads as a smooth,
rounded bulge, not a rubbery snap or a slow crawl.

### 14.6 Verification

**Numeric** (via a standalone reimplementation matching `doughShape.ts` exactly, cross-checked
against the actual unit tests):

| Scenario | Result |
|---|---|
| 1 full-reach pull at one control point | touched point: 48 → clamped to 30.24; immediate neighbor: 18.24 → 28.03 (gap 2.21, vs. D1's ~30) |
| 1 full-reach pull, opposite-side point | unchanged (weight 0 beyond circular distance 2) |
| 4 full-reach pulls spread evenly around the circle | mean/`DOUGH_RADIUS` = 0.800 (already clears 0.75) |
| 6 full-reach pulls spread evenly | mean/`DOUGH_RADIUS` = 0.904 |
| 6 moderate (80%-reach) pulls spread evenly | mean/`DOUGH_RADIUS` = 0.764 (clears 0.75 within the task's own 4–6 gesture guidance) |
| 30 repeated pulls at the exact same spot (adversarial, ignoring the rest of the dough) | max adjacent-pair gap ≈ 26.9, still under the D1 single-pull baseline gap (≈29.8) |
| 8 full-reach pulls, one at each control point | mean/`DOUGH_RADIUS` = 0.956 |

**Visual** (headless Chromium, 390×844, against the live dev build): a single full-reach pull
now renders as a smooth, rounded, organic bulge with no visible corner or octagon vertex; five
gestures spread around the circle render as a broad, near-circular pizza disc indistinguishable
from "handmade dough" at a glance. Screenshots reviewed directly during this session (not
committed; the same shapes are shown live in the focused comparison MP4, §14.8). Given these
screenshots showed no remaining corners, `smoothDoughShapeForDisplay`'s existing Catmull-Rom
interpolation (§3) was **not** modified — task item 5 was explicitly conditional on visible
corners persisting after the propagation/clamp change, and none did.

### 14.7 Tests

`src/logic/doughShape.test.ts` — the `applyStretchPoint` describe block was substantially
rewritten for D2 (24 tests total in the file, up from 12):

- primary point changes most, immediate neighbors change by a pinned exact amount, next ring
  changes by a smaller pinned amount, opposite side (`circularDistance >= 3`) is byte-for-byte
  untouched — one test with exact numeric pins plus an explicit ordering assertion
- circular neighbor wrapping at the 0/7 boundary behaves identically to any interior pair
- a touch exactly between two control points spreads to a wider, smoothly-tapered set of
  points (not just the old two bracketing points)
- spike suppression: a single full-reach pull's one-step gap to its neighbor is asserted to be
  less than half the D1 baseline gap
- repeated pulls at the exact same spot cannot exceed the D1 single-pull baseline gap
  (adversarial-case bound, see 14.6)
- asymmetry remains fully achievable: an untouched far side stays exactly at
  `INITIAL_DOUGH_RADIUS` after repeated same-side pulls, and ends up meaningfully smaller than
  the pulled side
- a few (4, 5, and 6) natural gestures spread around the circle each independently reach the
  0.75 completion threshold
- monotonic non-decrease, both the original single-point check and a new 40-step mixed-gesture
  sequence check covering **every** point, not just the touched one
- the original clamp-to-`DOUGH_RADIUS`, center-tap-no-op, and no-mutation tests are unchanged

`src/components/PizzaStage.doughStretch.test.tsx` — the one test whose title/assertions
literally described the removed "only two bracketing points" behavior was rewritten to
describe the new propagation behavior at the level this component test actually observes (mean
progress), without re-deriving per-point math that's already pinned in `doughShape.test.ts`.

Every other D1 test file (`onewayFlow.test.ts`'s DOUGH describe block, the reducer-level
`COMMIT_DOUGH_STRETCH` stale-event/monotonic/carry-through tests, the App/GameScreen
integration tests) required **no changes** — they exercise `applyStretchPoint` only through
its public contract (a monotonic, valid `DoughShape` in, a monotonic, valid `DoughShape` out),
which D2 preserves exactly.

`npm test`: **979/979 passing** (up from 972 before this fix — the doughShape describe block
gained tests net of the two rewrites). `npx tsc -b`: clean. `npm run lint` (oxlint): clean.
`npm run build`: clean.

### 14.8 Exact final SHA

D2 code SHA: `8ddefcdba54b598ae1abadd74dacbece9deb7994` (see this report's own header for any
later docs-only commits on top). Only `src/logic/doughShape.ts` (algorithm),
`src/logic/doughShape.test.ts` (rewritten tests), `src/components/PizzaStage.doughStretch.test.tsx`
(one test description update), and this report were touched — no other file in the D1 diff
changed.

Focused comparison video: `artifacts/review/TETO_ISSUE-33_DOUGH-D2_HumanFeel.mp4` (not
committed).

### 14.9 Remaining cosmetic D2 ideas (not implemented — out of this task's scope per its own §8)

- Flour texture / particle effects (explicitly excluded by this task).
- A slightly larger `i±2` weight or a third ring (`i±3`) if a real-device Human Feel pass still
  finds the transition between "touched" and "untouched" regions too abrupt for a very isolated
  single pull — the current weights were tuned against headless-Chromium visual review, not a
  physical iPhone.
- `SPIKE_MAX_DELTA` could be lowered further (softer single-pull bulge, slower to reach full
  radius at one spot) or raised (more immediate single-pull reach, less clamping) — 12 was
  chosen as a reasonable middle ground and is a single named constant, trivial to retune.
- The adversarial "30 repeated pulls at the exact same spot" case (14.6) still leaves a
  moderate gap at the edge of the influence radius; a possible D3-era refinement is widening
  the falloff or adding a very small `i±3` weight specifically to soften that boundary, without
  changing the general design.
