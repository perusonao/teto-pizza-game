# Teto Pizza Game — Issue #33 D3A Reversible Dough Shaping — Fresh Audit

**Type:** Audit (Phase 0), immediately followed by implementation in the same session/PR per
the task's own instruction.

- **Base SHA (fresh `origin/main` at task start):** `2a2b9b107990e0ff8b7b2c1b30e21baac181080d`
  (merge of PR #64, Issue #38 E-P1/E-P2 Pitz Reward Core). `git fetch origin` confirmed this is
  the current tip; working tree was clean; the session's own branch
  `claude/reversible-dough-shaping-8o5v4x` was created directly at this SHA (`git merge-base`
  equals `origin/main`'s own HEAD).
- **PR #64 merge status:** confirmed via GitHub API — `merged: true`, `merged_at:
  2026-09-18T11:13:28Z`, merge commit `2a2b9b1` matches `origin/main`'s current tip exactly.
- Issue #33 / #37 2026-09-18 additions (reversible/free-boundary shaping direction) read in
  full before this audit; see the "2026-09-18 D3 expansion" section on #33 and the "Bidirectional
  dough shaping" / "Free-boundary dough/sauce" bullets on #37.

## 1. Scope of this audit

Audit the current 8-point radial dough model and its gesture end-to-end, then judge whether the
existing architecture can become bidirectional (stretch **and** shrink) with a minimal, targeted
change, per the task's own preference for reusing the current interaction architecture rather
than redesigning it.

## 2. Current architecture (as implemented by PR #54, D1 + D2 Human Feel Fix)

- **State:** `PizzaState.doughShape: { radii: number[8] }` (`src/state/pizzaState.ts`,
  `src/logic/doughShape.ts`). Radius at each of 8 evenly-spaced angles, index 0 = dough-local
  "east", increasing clockwise (same convention as every other pizza-percent coordinate math in
  this codebase).
- **Gesture math (`applyStretchPoint`, pure, `src/logic/doughShape.ts`):** projects the current
  touch point to `(angle, distance)` from `DOUGH_CENTER`. Every control point receives a weight
  from a piecewise-linear circular-distance falloff (`stretchFalloff`: `1.0` at the touch's own
  nearest point, `0.45` one point away, `0.12` two points away, `0` beyond), and blends toward
  the touch distance by that weight via `lerpTowardAtLeast`. **That function's name says exactly
  what blocks reversibility**: `target = Math.max(current, distance)` — the target can never be
  *below* the point's current value, so a touch closer to center than the current radius is
  mathematically a no-op there. This, not the falloff/propagation model, is the single
  monotonic-only gate in the whole file.
- **Spike suppression:** after blending, each touched point is re-clamped to
  `[original[i], neighborAverage(original) + STRETCH_SPIKE_MAX_DELTA]` (`STRETCH_SPIKE_MAX_DELTA
  = 12`) — the lower bound (`original[i]`) is the *same* monotonic floor restated at the clamp
  layer, and the upper bound only guards against a single call's growth spike, never against a
  shrink (there is no shrink to guard against yet).
- **Validity (`isValidDoughShape`):** exactly 8 finite radii, each in `[0, DOUGH_RADIUS]`
  (`DOUGH_RADIUS = 48`, `src/logic/pizzaCoordinates.ts`). `DOUGH_RADIUS` is a dual-purpose
  constant today: it is both (a) the dough's own *ideal/reference* target (the dashed
  `.dough-target-guide` ring is drawn at exactly this radius, and it is the number
  `doughSizeProgress`/`DOUGH_COMPLETION_THRESHOLD` measure against) **and** (b) the *hard
  technical ceiling* on every individual control point's own radius. Those two roles happening
  to share one constant is exactly the Phase 2 finding below.
- **Ideal/reference vs. technical bound — audited, no separate hard-stop exists today beyond
  (b) above.** `DOUGH_COMPLETION_THRESHOLD` (0.75, i.e. mean radius ≥ 36) is consulted in exactly
  one place — `App.tsx`'s `doughShapeComplete`, which only gates the `次へ` CTA's `disabled`
  attribute. `CONFIRM_MAKING_STEP` itself is **not** gated on it (explicitly pinned by
  `onewayFlow.test.ts`, matching D0/D1's own "don't accidentally harden this into a stricter
  reducer rule" instruction), and no other code path reads `DOUGH_COMPLETION_THRESHOLD`/
  `doughSizeProgress` at all. So the *ideal* boundary was never itself a hard-stop on the
  gesture — the only real hard-stop today is `DOUGH_RADIUS` itself, which the dashed guide ring
  visually presents to the player as "the target," making it read as a ceiling the player can
  literally never cross. That reading, not a second numeric gate, is what Phase 2 needs to fix.
- **Gesture lifecycle (`src/components/PizzaStage.tsx`):** position-driven, no RAF/tick.
  `doughGestureShapeRef` holds the in-progress (uncommitted) shape; `applyStretchPoint` is
  called on pointerdown (immediate feedback + the structural guarantee that a DOUGH-step press
  can never fall through to `onTap`/`PLACE_TOPPING`/`APPLY_SAUCE`, since the ref becomes
  non-null unconditionally) and on every subsequent pointermove for the same `pointerId`.
  Committed to canonical `pizza.doughShape` via `COMMIT_DOUGH_STRETCH` only at a successful
  pointerup; discarded (never dispatched) on `pointercancel`, `lostpointercapture`,
  blur/`visibilitychange`, a reset (`resetToken`) or step change (`makingStepToken`) mid-hold, or
  the window-level pointerup/pointercancel fallback. `handlePointerDown` requires
  `isInsideDough` to *start* a gesture at all, but once started, `pointermove` is **not**
  re-gated by `isInsideDough` — dragging past the visible rim still registers, its distance
  simply clamped inside `applyStretchPoint` itself (today, to `DOUGH_RADIUS`).
- **Reducer boundary (`COMMIT_DOUGH_STRETCH`, `src/state/gameReducer.ts`):** re-checks
  `phase === "PREPARE" && makingStep === "DOUGH"` and `isValidDoughShape(shape)` independently
  (belt-and-suspenders, mirrors `COMMIT_SAUCE_DISPENSE`).
- **Reset/retry:** every "fresh dough" path (`buildOrderState`'s one shared `makingStep`
  literal — FREE/Lunch Rush/`SELECT_RECIPE`/`RETRY_SAME_RECIPE` — and `RESET_PIZZA`'s own
  independent literal) creates a fresh `createInitialDoughShape()` (uniform circle at
  `INITIAL_DOUGH_RADIUS = DOUGH_RADIUS × 0.38 ≈ 18.24`). `PizzaStage`'s existing
  `resetToken`/`makingStepToken`-keyed `abortActiveGesture()` effects, plus the
  blur/visibilitychange/window-pointerup-fallback aborts, invalidate any in-flight gesture with
  no gesture-family-specific code (they all funnel through the same `discardDoughGesture()`).
- **Stale pointer protection:** every abort path above is keyed off tokens/refs set once at
  gesture start, not off wall-clock time, so a late/stale pointer event from a
  since-reset/since-advanced gesture is structurally inert — `doughGestureShapeRef.current` is
  `null` by the time it would fire, and the reducer's own phase/step re-check is the final
  backstop.
- **DOUGH → SAUCE commit:** `pizza.doughShape` is never touched by anything except
  `COMMIT_DOUGH_STRETCH` (gated to `makingStep === "DOUGH"`), so it carries through
  SAUCE/CHEESE/TOPPING/BAKE/RESULT completely unchanged, confirmed by inspection (no other
  reducer case references `doughShape`) and by `onewayFlow.test.ts`'s existing carry-through
  pins.
- **390×844 touch geometry:** `.pizza-dough`'s own box (`min(78vw, 300px)` square) is unaffected
  by anything here — `DOUGH_CENTER`/`DOUGH_RADIUS` are percent-of-box constants, not pixel
  constants, so this audit's changes (all confined to `doughShape.ts`'s own numeric bounds) carry
  over to any viewport unchanged. No 390×844-specific code path exists for DOUGH today.
- **Visual clipping:** `.pizza-dough-shape` is `position: absolute; inset: 0` inside
  `.pizza-dough` (confirmed in `App.css`), clipped via an `objectBoundingBox` `<clipPath>` built
  from `smoothDoughShapeForDisplay(shape, 0.01)` (0–1 fractional coordinates). A control point's
  raw dough-percent radius maps to fraction `radius / 100`. Since `DOUGH_CENTER = 50` sits at the
  middle of a 0–100 box, a point's fractional coordinate reaches the box's own edge at radius 50
  along the 4 cardinal axes (indices 0/2/4/6 in the 8-point model) and can go out to
  `50√2 ≈ 70.7` along the 4 diagonals (indices 1/3/5/7) before leaving the box's corner entirely.
  A clip-path coordinate that falls outside `.pizza-dough-shape`'s own rectangle cannot paint any
  extra pixels — the element's own box is the hard ceiling on what can ever be visible — so any
  cardinal-axis radius above 50 is **already, silently, harmlessly flattened by the DOM itself**
  to a flat edge at the box boundary, with zero risk of visual breakage regardless of the shape
  data's own numeric value. This is the "technical safety" Phase 2 asks to keep separate from
  the "ideal/reference" gameplay boundary — it already exists structurally, for free, and this
  audit's own new `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (below) only needs to stay safely under the
  diagonal-corner distance (~70.7) to avoid ever being clipped by anything other than that
  natural box edge.

## 3. Root-cause finding

**Exactly one function is responsible for the monotonic (expand-only) behavior:**
`lerpTowardAtLeast`'s `target = Math.max(current, distance)`, restated a second time as the
spike clamp's own `Math.max(original[i], ...)` lower bound. Every other piece of the
architecture — the falloff/propagation model, the spike-suppression *upper* bound, the gesture
lifecycle, the reducer boundary, reset/stale-pointer safety, and the DOUGH→SAUCE carry-through —
is already direction-agnostic and needs **no change** to support shrinking.

**Verdict: minimal-change bidirectional conversion is straightforward and is the recommended
approach**, exactly matching the task's own preference for reusing the current architecture. The
touch position **already** directly encodes "desired local radius for this angular region" (not
a delta/velocity model) — dragging from center outward already reads as "stretch," so removing
only the monotonic floor and reusing the *same* absolute-position semantics for "drag from rim
inward = shrink" requires no new gesture-recognition concept, no second gesture mode, and no new
pointer-lifecycle plumbing. This is chosen over inventing a delta/velocity-based alternative
specifically because it is the smaller change and matches the task's own example description
verbatim ("中心 → 外側 = 伸ばす, 外側 → 中心 = 縮める").

## 4. Planned changes (Phase 1/2, implemented in this same PR)

1. **`lerpTowardAtLeast` → `lerpToward`:** true bidirectional lerp, `current + (target -
   current) * weight`, no floor.
2. **Symmetric spike suppression:** clamp each touched point's *own* per-call change to within
   `neighborAverage(original) ± STRETCH_SPIKE_MAX_DELTA` (was: `[original[i], neighborAverage +
   DELTA]`) — this is what turns "no abrupt jump" into a real guarantee in *both* directions, not
   just growth. Recomputed to apply **only** to points this call's falloff weight is `> 0` for —
   see the correctness note in §5 below (this is a genuine fix, not just symmetry for its own
   sake).
3. **Two independent bounds replacing the single `[0, DOUGH_RADIUS]` range:**
   `DOUGH_SHAPE_MIN_RADIUS` (new floor, prevents shrinking to a degenerate near-point) and
   `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (new ceiling, decoupled from `DOUGH_RADIUS`/the ideal guide
   ring — see §2's clipping analysis for why headroom above 48 is both meaningful, on the
   diagonals, and safe). `DOUGH_RADIUS` itself is untouched — it keeps its existing dual role as
   the *ideal/reference* target (guide ring + completion threshold) and as the unrelated
   hit-testing radius (`isInsideDough`/`clampToDough`) used by every other gesture family; this
   audit does not touch either of those.
4. **Tiny-gesture guard:** if the touch's implied target for the nearest control point is within
   a small epsilon of that point's *current* value, the whole call is a no-op. This is a
   continuity-based definition of "accidental tiny gesture" — deliberately independent of a
   drag-distance/tap-vs-hold heuristic, since the existing (and still desired) "a tap far from
   center registers instant, meaningful feedback" behavior from D1/D2 (pinned by
   `PizzaStage.doughStretch.test.tsx`) must not be broken by a movement-based dead zone that
   would suppress *every* tap indiscriminately, deliberate or accidental alike.
5. **No changes to `PizzaStage.tsx`, `gameReducer.ts`'s `COMMIT_DOUGH_STRETCH` case, reset/retry
   paths, or DOUGH→SAUCE carry-through** — confirmed unnecessary by this audit; the gesture
   lifecycle, reducer boundary, and every reset/stale-pointer safeguard are already
   direction-agnostic.

## 5. A latent correctness issue found and fixed while making the clamp symmetric

The **existing** (D1/D2, monotonic-only) spike-clamp is written as a `.map()` over *every*
control point, including ones this call's falloff weight is `0` for (untouched by this
specific touch). For those points, `Math.max(original[i], Math.min(original[i], cap))` was a
no-op in the old monotonic world (`original[i]` is always `≤ cap` there, since `cap` only ever
grows or holds from a point's own pre-existing value across the shape's whole history). Once the
floor is removed for bidirectionality, that same `.map()` pattern would **retroactively
re-clamp untouched points against a `cap`/`floor` computed from their (possibly since-changed by
some *unrelated* earlier gesture) neighbors** — i.e., dragging in one part of the dough could
silently shrink or grow an *already-set, untouched* point elsewhere, purely as a side effect of
that point's neighbors having drifted asymmetric in an earlier, different gesture. This would
have broken "player-made shape/placement should remain visibly identifiable" and the D2 test's
own "asymmetry remains fully achievable" guarantee. Fixed by only ever computing/clamping a
point whose `stretchFalloff` weight for *this specific call* is `> 0`; every other point is
passed through completely untouched, with no clamp evaluation against it at all.

## 6. No changes needed elsewhere

Confirmed by inspection, no code changes needed in: `pizzaCoordinates.ts` (hit-testing radius
`DOUGH_RADIUS` is a separate concern from the dough's own rendered shape bounds — this audit
leaves it untouched), `sauceField.ts`/`sauceDispenseController.ts`/`sauceQuantity.ts` (sauce is
untouched by this task, per its own §4 scope guard), `scoring.ts`/`scoringV2/*` (no Dough scoring
added, per the task's explicit Phase 4 guard), `persistence.ts` (no Save schema change —
`PizzaState`/`doughShape` are never serialized), `dex.ts`/`progression.ts`/`pitzReward.ts`/
`recipes.ts` (Recipe reference/Pitz/Scoring authority untouched, per Phase 4), any HOME/Pizza
Select/Dex/Shop component.

## 7. Verdict

**A. READY — minimal-change bidirectional conversion, confined to `src/logic/doughShape.ts`'s
own internal math and constants.** No gesture-lifecycle, reducer, reset, or carry-through changes
required. Proceeding directly to Phase 1/2 implementation in this same session/PR, per the task's
own instruction not to treat this as a separate audit-only deliverable.
