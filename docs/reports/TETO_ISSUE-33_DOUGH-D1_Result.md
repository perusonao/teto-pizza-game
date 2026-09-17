# Teto Pizza Game — Issue #33 Dough Shaping — D1 Implementation Result

**Type:** Implementation. Implements D1 directly from
`docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md` (including its post-Issue-47
Revalidation section) — no new audit, per the task instruction.

- **Base SHA (fresh `origin/main` at task start):** `2da3949de5bd642c709ca6ba343bc57d8101d03d`
  (Merge PR #51: Issue #33 Dough D0 revalidation) — matches the task's expected SHA exactly.
- **Implementation SHA (PR head):** `e1f171a309077db6d2df03c90237924e68900e1e`
- **Branch:** `claude/dough-d1-implementation-puivuf`

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
  from `DOUGH_CENTER`; the two angular control points bracketing that angle each move toward
  `max(currentRadius, distance)`, weighted by angular closeness (a touch exactly at a control
  point's own angle moves only that point). **Monotonic by construction** — the blend target is
  never below the current value, so a point can never shrink within one DOUGH attempt.
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

## 11. Known D1 limitations

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

## 12. Recommended D2 polish items

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
