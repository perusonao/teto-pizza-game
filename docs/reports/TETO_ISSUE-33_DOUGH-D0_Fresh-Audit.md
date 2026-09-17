# Teto Pizza Game — Issue #33 Dough Shaping — D0 Fresh Audit / Interaction Design

**Type:** READ-ONLY audit / design. No production code was changed to produce this report.

**Audited main SHA:** `6e554918c42fc4d8ed267b715992e5ed5cf68e4f` (Merge PR #45: Sauce parity and
olive-oil visibility). Confirmed via `git fetch origin && git rev-parse origin/main` immediately
before this audit — matches the task's expected SHA exactly. This audit branch
(`claude/dough-shaping-d0-audit-phr2my`) is based on this exact commit; nothing else has landed
on `main` since.

> **Revalidated 2026-09-17 against `main` SHA `45fdf1a3ceae305f34dd1a8637b1a306f27dbfd5`
> (Merge PR #50: Issue #47 Slice B Reference UX) — see the "Revalidation" section appended at
> the end of this file.** Everything above this notice is the original D0 audit, unmodified,
> and its recommendations still stand as written; the revalidation section documents what
> changed on `main` in between (Issue #47 Slices A and B) and confirms none of it invalidates
> this audit's architecture assumptions or recommendations.

Scope, per task: Issue #33 D0 — fresh audit of current architecture, interaction-candidate
comparison, a recommended D1 interaction/shape/state contract, and an SSOT sync reflecting that
Issue #32's P1 work is now actually complete on `main`. **No implementation. No Preview. No
video** (audit-only tasks are exempt per `PROJECT_HANDOFF.md`'s "Standard completion rule").

---

## 0. SSOT correction found during this audit

Before auditing DOUGH itself: `docs/PROJECT_HANDOFF.md` (as of the start of this session) still
said Issue #32's P1 fix slice was "not yet implemented," and Issue #22's body still listed "two
confirmed P1 defects remain." Both are now stale. On fresh `main`:

- **PR #45** ("Issue #32: unify sauce painting and restore olive-oil visibility") is **merged**
  (`merged_at: 2026-09-17T13:47:04Z`, merged by the repository owner) — its merge commit
  (`6e55491`) is `origin/main`'s current HEAD.
- Its own result report (`docs/reports/TETO_ISSUE-32_SAUCE-PARITY_Result.md`) confirms 887/887
  tests, clean `tsc`/`lint`/`build`, and states "do not merge until the user confirms Human Feel
  on a real iPhone" — the subsequent merge is the record of that confirmation having happened.
- Both P1 items from `docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_Fresh-Audit.md` (the
  off-recipe sauce fallback, Finding 1-B; olive-oil heatmap visibility, Finding 2-A/2-B) are
  therefore resolved on current `main`. Issue #37's own M0 gate ("#32 P1 Human Feel consistency
  を解決") is satisfied.

This audit's §Finish section updates `docs/PROJECT_HANDOFF.md` and Issue #22 to say so, and
moves Issue #33 to the current active P1/P2 priority — see §Finish for the exact diffs.

---

## 1. Current architecture audit

### 1.1 Making flow today

```
ORDER → PREPARE(SAUCE → CHEESE → TOPPING) → BAKE → RESULT → DISCOVERED
```

`GamePhase` (`src/state/gameReducer.ts:24`) is `"ORDER" | "PREPARE" | "BAKE" | "RESULT" |
"DISCOVERED"`. Nested inside `PREPARE`, `MakingStep` (`gameReducer.ts:31`) is
`"SAUCE" | "CHEESE" | "TOPPING"`, with this exact, load-bearing comment already in place:

> "A string union rather than a numeric index so Issue #33 can prepend `"DOUGH"` later without
> renumbering anything else."

This is a strong, deliberate signal that the current architecture was already built anticipating
this exact task. `MAKING_STEP_ORDER` (`gameReducer.ts:33`) is a plain readonly array driving
`nextMakingStep()` — prepending `"DOUGH"` is a one-line change with no other renumbering.

### 1.2 GamePhase / MakingStep / transitions

- `BEGIN_PREPARE`: `ORDER → PREPARE`, `makingStep` always starts at `"SAUCE"` (`buildOrderState`,
  `gameReducer.ts:169`).
- `CONFIRM_MAKING_STEP`: the one reducer-authoritative, forward-only sub-step transition
  (`SAUCE → CHEESE → TOPPING`, clamped past `TOPPING`; no-op outside `PREPARE`). Bumps
  `makingStepToken` (`gameReducer.ts:393-398`).
- `START_BAKE`: `PREPARE → BAKE` (`TOPPING`'s own forward action, separate from
  `CONFIRM_MAKING_STEP` — the 焼く！ button doubles as TOPPING's implicit confirm).
- `CONFIRM_BAKE`: `BAKE → RESULT`, computes `score`/`bakeState`/`scoringV2Shadow` from the
  canonical `pizza` exactly once.
- `REGISTER_TO_DEX` / `MISSION_NEXT_ORDER`: `RESULT → DISCOVERED` (FREE) or straight to the next
  Mission order (Lunch Rush, deliberately skipping `DISCOVERED`).
- `RESET_PIZZA`: only legal in `PREPARE`; blanks `pizza` and returns `makingStep` to `"SAUCE"`,
  bumping `makingStepToken` the same way a step confirmation does.

### 1.3 PizzaStage gesture architecture (`src/components/PizzaStage.tsx`, 873 lines)

One `<div className="pizza-dough">` (fixed `min(78vw, 300px)` circle, `App.css:191-202`) owns all
pointer events for every making step. Two independent, mutually-exclusive gesture families exist
today, both driven by `activeIngredient?.placement`:

- **`placement: "spread"` (sauce)** — `isPaintMode = true`. `pointerdown` starts a
  `SauceDispenseController` session (RAF-driven, real-time-based ticks, not event-count-based);
  `pointermove` only records a timestamped path; a successful `pointerup` commits the whole
  session atomically via `COMMIT_SAUCE_DISPENSE`. Every abort trigger (`pointercancel`,
  `lostpointercapture`, `blur`/`visibilitychange`, an ingredient change mid-hold, `interactive`
  going false, `resetToken`/`makingStepToken` bumping) discards the session instead — see
  `abortActiveGesture()` (`PizzaStage.tsx:223-235`), the single shared cleanup path every trigger
  above calls into.
- **`placement: "scatter"` (cheese/topping)** — tap commits at the start point, a drag-then-release
  commits one point at the release point (`PizzaStage.tsx:567-581`), both via `onTap` →
  `App.tsx`'s `handleTapPizza` → `PLACE_TOPPING`. A second, independent "physical drag from the
  tray" system also exists (`IngredientTray.tsx`'s `physicalDragEnabled`/`DragSession`).

Both families share one `gestureRef` (`GestureState`, first-finger-wins, `pointerId`-scoped) and
the exact same stale-gesture defenses: `resetToken` (whole-pizza `RESET_PIZZA`) and
`makingStepToken` (a step confirmation) each independently abort any in-flight gesture via a
`useEffect` keyed on that token (`PizzaStage.tsx:264-282`) — this is what stops a slow drag
started in one step from committing into the next step, and it is already generic across every
gesture family, not sauce-specific.

### 1.4 Normalized coordinates (`src/logic/pizzaCoordinates.ts`)

`DOUGH_CENTER = 50`, `DOUGH_RADIUS = 48` — a fixed circle in dough-percent (0–100) space,
independent of the element's actual on-screen pixel size. `clientPointToDoughPercent` converts a
client-space point into this space via the dough element's own `getBoundingClientRect()`.
`isInsideDough`/`clampToDough` are the only two predicates every gesture family (sauce, toppings,
piece-drag-from-tray) already shares. **This is the one true coordinate system for the whole
pizza stage; nothing about it needs to change for DOUGH** (§4.5 below explains why).

### 1.5 Stage dimensions / reset / stale-gesture protection

- `.pizza-dough`: `width/height: min(78vw, 300px)`, circular, centered in `.pizza-stage`
  (flex-centered). `App.tsx`'s outer frame is `max-width: 390px`, so this is already verified at
  the 390×844 baseline.
- Reset (`resetToken`, bumped by `GameScreen`'s local `pizzaResetToken` state on every
  「やり直す」 click, paired with dispatching `RESET_PIZZA`) and step-confirm (`makingStepToken`,
  reducer-owned) both invalidate in-flight gestures through the exact same `useEffect` shape —
  already fully generic, already covers every gesture family that exists today.
- Window-level `pointerup`/`pointercancel` fallback (`PizzaStage.tsx:324-341`) covers the case
  where `setPointerCapture` fails and the release lands outside the element.

### 1.6 CONFIRM_MAKING_STEP / BAKE transition UI

`GameScreen.tsx:328-348`'s `.prepare-bake-bar` already has the exact CTA shape DOUGH needs: a
`次へ →` button dispatching `onConfirmMakingStep` for every step except the last
(`state.makingStep === "TOPPING"` swaps it for 焼く！/`onStartBake`). Prepending `"DOUGH"` to
`MAKING_STEP_ORDER` means this bar's existing conditional needs one more branch, not a rewrite.

### 1.7 FREE / Lunch Rush

No sauce- or step-specific FREE-vs-Mission divergence exists anywhere in `src/` (confirmed by the
Issue #32 audit and unchanged since). Both `buildOrderState` (FREE) and `nextMissionOrderState`
(Mission) route through the exact same function, so a `"DOUGH"` initial `makingStep` value
applies identically to both by construction — there is no separate code path to keep in sync.

### 1.8 Pizza state / Save boundary

`PizzaState` (`src/state/pizzaState.ts`) holds `sauceIds`/`sauceOrigin`/`sauceToken`/
`sauceDeposits`/`toppings`/`bakeResult` — all canonical, reducer-owned, carried forward through
`PREPARE → BAKE → RESULT`, and reset to `createEmptyPizza()` by `RESET_PIZZA` or a fresh round.
**Critically: `GameState` (which contains `PizzaState`) is never persisted at all.**
`src/state/persistence.ts`'s `PersistentSaveV1` only ever serializes `dex`/`pitzBalance`/
`ownedIngredientIds`/`missionBest` — a completely separate, independently-versioned shape. This
means anything added to `PizzaState` today needs **zero** Save schema/migration work; it was
already excluded from the persistence boundary before DOUGH was ever discussed.

### 1.9 Files/functions a DOUGH addition touches (summary — see §10 for the full D1 slice)

| Concern | File | Change shape |
|---|---|---|
| `MakingStep` union + order | `src/state/gameReducer.ts` | prepend `"DOUGH"`, initial `makingStep`, `RESET_PIZZA` target, new commit action |
| Shape data + reset | `src/state/pizzaState.ts` | new `DoughShape` field on `PizzaState`, `createEmptyPizza()` |
| Pure shape math | new `src/logic/doughShape.ts` | mirrors `sauceQuantity.ts`/`sauceField.ts`'s pure-module convention |
| Gesture routing | `src/components/PizzaStage.tsx` | new gesture branch reusing all existing abort/reset/token plumbing |
| Wiring/handlers | `src/App.tsx` | new commit/progress handlers, mirrors `handleDispenseProgress`/`handleDispenseCommit` |
| Step UI / CTA / tray visibility | `src/screens/GameScreen.tsx` | hide `IngredientTray` during DOUGH, extend the existing next-step CTA |
| Hint copy | `src/data/hints.ts` | one new DOUGH branch |
| Visual | `src/App.css` | new dough-shape layer styles only; `.pizza-dough`/`.pizza-stage` sizing untouched |

**Not touched, confirmed by reading each:** `pizzaCoordinates.ts`'s own constants,
`sauceField.ts`, `sauceDispenseController.ts`, `sauceQuantity.ts`, `recipeSauceProfiles.ts`,
`scoring.ts`, `scoringV2/*`, `persistence.ts`, `dex.ts`, `progression.ts`, `economy.ts`,
`mission/lunchRush.ts`, `IngredientTray.tsx`'s physical-drag system, any HOME/Pizza
Select/Dex/Shop component, Reference/`referencePizza.ts`.

---

## 2. Interaction candidates

Compared against: iPhone clarity, 1–5s understandability, visible-change-with-action, skill
differentiation, non-frustrating, 390×844, one-hand, implementation complexity, scoring
extensibility, reset reliability, deterministic testability.

### Candidate A — Drag from center outward (radial stretch)

Player presses anywhere on the dough and drags outward; the dough boundary grows in whichever
direction the finger pulls. Multiple pulls in different directions round it out.

- **Clarity/1–5s:** very high — matches the real physical action (push dough outward from the
  middle) almost literally.
- **Visible change:** direct 1:1 — the boundary follows the finger live, no delay.
- **Skill:** a single straight pull looks lopsided; pulling evenly around the circle is what
  produces a round result — this differentiates skill without punishing a first-timer (a
  lopsided-but-big pizza is still a completable, charming pizza, not a failure state).
- **Frustration:** low — continuous, forgiving, monotonic (see §4).
- **390×844 / one-hand:** the full gesture surface is the existing 300px-max circle, already
  proven comfortable at this size for sauce painting.
- **Implementation complexity:** low — reuses `clientPointToDoughPercent`/`distanceFromCenter`
  and ~90% of `PizzaStage`'s existing gesture-lifecycle plumbing unchanged (see §4.5, §8).
- **Scoring extensibility:** high, if the shape model is a multi-point radial array (§3) —
  variance across points is roundness/evenness/extreme-distortion for free later.
- **Reset reliability:** reuses `resetToken`/`makingStepToken` verbatim, no new abort code.
- **Deterministic testability:** high — pure position math, no timing dependency at all (unlike
  sauce's tick system), trivially unit-testable.

### Candidate B — Press/smear to expand area (paint-style)

Drag around the dough "painting" coverage, similar to sauce's density-field mechanic; shape/size
derived from how much of a coverage field has been touched.

- **Clarity:** moderate — reads more like "spreading a topping" than "stretching dough"; risks
  feeling like a reskin of the SAUCE step the player is about to do next, undermining "this is a
  distinct, new physical action" (a stated product goal).
- **Implementation complexity:** higher — needs a density-field model similar to
  `sauceField.ts`'s 16×16 grid, essentially duplicating that machinery for a different purpose.
- **Scoring extensibility:** good (coverage-based) but conceptually redundant with sauce's own
  coverage metric.
- Everything else comparable to A, but the redundancy with SAUCE and the extra field-math
  complexity make this a worse fit.

### Candidate C — Repeated presses/swipes ("kneading")

Discrete taps or short swipes around the rim, each nudging the boundary outward by a fixed
increment; 3–6 gestures needed to reach full size.

- **Clarity:** the "press again to grow more" idea is easy to explain but less immediately
  tactile than a continuous drag.
- **Frustration risk:** highest of the three — repeated discrete taps around a circle can read as
  a chore rather than "stretching," especially if the required count isn't visually obvious.
- **Skill:** interesting (tap placement/spacing could matter) but hard to communicate without
  explicit instructions, which the product goal explicitly wants to avoid ("1〜5秒で理解可能").
- **Implementation complexity:** comparable to A, but the "how many taps, where" contract needs
  more UI signposting to avoid feeling arbitrary.

### Candidate D (added) — Two-finger pinch-out stretch

Rejected outright: breaks the explicit one-hand/390×844 requirement, has no precedent anywhere in
this codebase (every existing gesture — sauce, toppings, tray drag — is single-pointer), and
would need new multi-touch-aware gesture-lifecycle code the current architecture doesn't have at
all. Not pursued further.

### Recommendation: **Candidate A**

Best on every axis that matters most (clarity, frustration, reuse of proven infrastructure,
deterministic testability) and is the only one whose natural skill differentiation (pull evenly
vs. pull lopsided) comes for free from the physical metaphor itself rather than needing extra UI
explanation.

---

## 3. Shape model

### Candidates

- **A. Scalar radius only** — one number, dough grows as a perfect circle. Simplest possible, but
  a perfectly uniform circle can never look "hand-stretched" — it visually contradicts the
  product goal ("自分で生地を伸ばして...と感じられる操作") no matter how good the gesture feels,
  since the *result* always looks machine-made. Also gives zero future roundness/unevenness
  scoring signal (there is nothing to vary).
- **B. Width + height ellipse** — two numbers (x-radius, y-radius). A step up — captures basic
  asymmetry, trivial to render (`transform: scale()` on the existing circular element) — but two
  axes still reads as too regular/geometric to look genuinely hand-pulled.
- **C. Multi-point radial shape** — N angular control points (recommend N=8), each an independent
  radius, rendered as a smoothed closed curve (Catmull-Rom-style through the points, the same
  idea `smoothSauceFieldForDisplay` already uses to turn sauce's own grid into a soft shape
  instead of visible cells). Directly produces an organic, slightly-imperfect boundary from
  nothing more than "which direction did the player pull, and how far."
- **D. Mesh/freeform** — full deformable 2D mesh. Explicitly overkill: Issue #33 itself says
  evaluation should be "forgiving and structural, not pixel-perfect" — a mesh implies far more
  precision than the product goal calls for, and would need real physics-adjacent math this
  codebase has no analog for anywhere.

### Recommendation: **Candidate C, N=8**

Issue #33's own body already names the future scoring dimensions this needs to support: "final
size / spread amount," "extreme distortion / edge irregularity," "optionally center-vs-rim
balance." An 8-point radial array gives size (mean of the 8 radii), roundness/evenness
(variance or min/max ratio across them), and extreme distortion (the same variance, or a min/max
spread check) **directly**, with no rewrite needed to reach D3. A scalar or ellipse model would
need to be replaced outright once scoring integration starts; the radial model does not.

Complexity cost over an ellipse is small: an array of 8 numbers instead of 2, plus one smoothing
helper for rendering — not materially harder to build, test, or reason about than option B, and
it is the only option that can visually deliver "this looks like I actually shaped it," which is
the D1 acceptance bar itself ("Touch manipulation feels deliberate rather than fiddly").

**Not modeled in D1, flagged as open future work (D3, not a blocker):** "center-vs-rim balance"
and "crust thickness" both need some proxy for mass/thickness distribution, which a pure boundary
model (radius per angle) doesn't capture on its own — these need a follow-up design decision once
scoring integration starts, not a D1 concern.

---

## 4. First prototype (D1) contract

### 4.1 Initial state

`DoughShape` starts as all 8 radii at a small fraction of the target (e.g. ~35–40% of
`DOUGH_RADIUS`, exact value provisional/tunable in D2) — "小さく厚い丸い生地." Because all 8
points start equal, the initial render is a plain small circle, not yet "shaped."

### 4.2 Gesture

Pointerdown anywhere inside the *full* dough hit area (the existing `isInsideDough` check against
the fixed `DOUGH_RADIUS = 48` — the same check sauce/toppings already use), not gated by the
current (smaller) shape — so a first-time player is never punished for missing a tiny target; the
whole familiar 300px circle is always a valid press target from the very first tap. On
`pointermove`, project the current pointer position to `(angle, distance)` from `DOUGH_CENTER`;
split the effect between the two angular control points bracketing that angle, each moved toward
`max(currentValue, distance)` (monotonic — see §4.6) weighted by angular closeness. No RAF/tick
timing is needed (unlike sauce): this is a pure function of the current pointer position, not an
accumulated-over-time quantity, which is simpler than the sauce dispense model, not harder.

### 4.3 Visual

A live SVG path (Catmull-Rom-smoothed through the 8 points) rendered inside the existing
`.pizza-dough` circle, growing/deforming continuously as the gesture progresses. `.pizza-dough`
itself and `.pizza-stage`'s layout are untouched — only the shape drawn inside them changes.

### 4.4 Target / completion

"ピザとして十分な大きさ": mean of the 8 radii reaches a threshold fraction of `DOUGH_RADIUS`
(provisional: **≥ 75%**, explicitly tunable during D2 Human Feel, not final). No roundness/
evenness gate in D1 — the task's own instruction is "厳しすぎない" (not too strict) and "D1では
scoringを実装しない"; a pure size gate is the minimal, forgiving choice, consistent with "a
first-time player should reach it in a few gestures."

### 4.5 Why the fixed `DOUGH_RADIUS = 48` target doesn't change downstream coordinate math

The dough's *final* physical footprint after DOUGH completes is exactly the same circle
(`DOUGH_CENTER=50, DOUGH_RADIUS=48`) that SAUCE/CHEESE/TOPPING already paint/place against today.
D1 does not introduce a second coordinate system or resize the hit area other steps use — the
DOUGH step is a shaping mini-game that visually animates *within* the existing fixed circle, from
small-and-thick toward that same already-used full size. This is what keeps `pizzaCoordinates.ts`,
`sauceField.ts`, `findOpenSpot`, and every existing `isInsideDough` call site completely untouched.

### 4.6 Monotonic growth (forgiving-ness)

Within one DOUGH step attempt, each control point's radius only ever increases, never decreases,
until 「やり直す」 (`RESET_PIZZA`) is pressed. This avoids an "I accidentally shrank it" failure
mode, matches "reasonable imperfection should remain viable," and keeps the mental model simple:
pulling always helps, never hurts.

### 4.7 Incomplete feedback

Reuses the existing low-key hint-line pattern (`buildHintLine`, already step-aware) rather than a
new modal/toast: a DOUGH-specific hint line before threshold ("もう少し伸ばそう" — copy TBD) and
after ("いい大きさ！次へ進めるよ" — copy TBD). The CTA button (§1.6) is disabled until the
threshold is reached, mirroring "CTA disabledまたは明確なfeedback" from the task directly.

### 4.8 Reset

「やり直す」 already dispatches `RESET_PIZZA` and bumps `pizzaResetToken`; `createEmptyPizza()`
gets a `doughShape` field reset to the same initial small-circle value as a fresh round, and
`PizzaStage`'s existing `resetToken`-keyed abort effect (§1.3) invalidates any in-flight DOUGH
gesture with **zero new code** — it already generically aborts whatever gesture family is active.

---

## 5. State design

### Question: ephemeral making state vs. Pizza state?

**Recommendation: `PizzaState`** (i.e. the same place `sauceDeposits`/`toppings` already live),
**not** component-local ephemeral state, for the committed shape — with the *in-progress,
uncommitted* gesture buffer staying component-local (a ref inside `PizzaStage`), exactly
mirroring the existing sauce dispense split (`pendingDepositsRef` = ephemeral, `sauceDeposits` on
`PizzaState` = canonical, committed only at a successful `pointerup`).

Why `PizzaState` and not purely ephemeral:

- Issue #37 M1's own deliverable is "`DOUGH → SAUCE` が『自分で作る』操作として成立" and M2
  explicitly wants dough/sauce/pieces preserved into baked visual identity — the shape needs to
  be canonical, round-scoped state that survives past the DOUGH step itself (even though D1's own
  renderer only visualizes it during DOUGH — see §9's scope boundary), the same way `sauceDeposits`
  already survives SAUCE into BAKE/RESULT for (future) visual/scoring use.
- **This requires zero Save schema change.** §1.8 already establishes that `GameState` (and
  therefore `PizzaState`) is never serialized at all — only `dex`/`pitzBalance`/
  `ownedIngredientIds`/`missionBest` are, via a completely separate, independently-versioned
  `PersistentSaveV1` shape. Adding a `doughShape` field to `PizzaState` is exactly as
  Save-schema-free as `sauceDeposits` already is.

Checked against every listed concern:

| Concern | Result |
|---|---|
| reset | `createEmptyPizza()` + `RESET_PIZZA`, same as every other `PizzaState` field |
| recipe switch | `buildOrderState` always starts a fresh `PizzaState` — no carry-over risk |
| FREE | identical, `buildOrderState` shared |
| Lunch | identical, `nextMissionOrderState` shares `buildOrderState` |
| RESULT | shape data simply rides along in `pizza`, unused by D1's own RESULT rendering (future #37 M2/M5 concern) |
| Save v1/v2 | **no change** — `PizzaState` was never in the persisted shape |
| replay | N/A today (no replay system exists yet) |
| migration | **none needed** — see above |

**Persistent dough stock / inventory** (Issue #33's own "interaction with future dough
inventory/consumption") explicitly stays out of scope until Save v2, per both Issue #33's own
text and `PROJECT_HANDOFF.md`'s P5 roadmap ("Dough inventory/consumption only after Save v2").
D1's `doughShape` is per-round, non-persistent, non-consuming — Practice/FREE/Lunch Rush all
behave identically (no inventory concept exists to differentiate them yet regardless).

---

## 6. Gesture collision

DOUGH's gesture must be active **only** while `state.makingStep === "DOUGH"`, and must never leak
into SAUCE (the very next step, with its own pointer-heavy paint gesture) or be leaked into by a
stale pointerup.

This is already structurally guaranteed by facts established in §1.2–§1.3, requiring **no new
protection code**:

- `activeIngredient` is `null` while `IngredientTray` isn't rendered (§9's proposed change: hide
  the tray entirely during DOUGH, since dough isn't a tray-selectable ingredient) — so
  `isPaintMode`/scatter-placement's own gates (`activeIngredient?.placement === ...`) are already
  `false` by construction whenever DOUGH's own gesture should be active, and vice versa: once
  `activeIngredient` is set again in SAUCE, a routing check on `makingStep` keeps DOUGH's handler
  from firing.
- `makingStepToken` already bumps on every `CONFIRM_MAKING_STEP` (DOUGH → SAUCE included, once
  `MAKING_STEP_ORDER` is extended) and already aborts whatever gesture family is in flight via the
  existing generic `useEffect` (`PizzaStage.tsx:277-282`) — this is the exact mechanism that
  already stops a slow SAUCE drag from committing into CHEESE; it needs no DOUGH-specific
  variant, only the new gesture branch needs to respect the same abort call
  (`abortActiveGesture()`) that the sauce branch already does.
- The reducer-side backstop mirrors `COMMIT_SAUCE_DISPENSE`'s own pattern exactly: a new
  `COMMIT_DOUGH_STRETCH` (or similarly named) action must independently re-check
  `state.phase === "PREPARE" && state.makingStep === "DOUGH"` before touching `pizza`, so even a
  gesture that somehow survives past a step change (a bug elsewhere) cannot mutate canonical state
  for the wrong step — same belt-and-suspenders discipline every existing action already follows.

**Conclusion:** gesture isolation for DOUGH is close to "free" — the existing architecture was
evidently built (per the `MakingStep` comment in §1.1) anticipating this exact extension, and the
generic `resetToken`/`makingStepToken` abort mechanism already covers a step neither of them was
written with in mind.

---

## 7. Visual design

- Reuse `.pizza-dough`'s existing gradient/border look for the dough-shape fill (same warm gold
  `#f3d9a4`/`#e2b876` radial gradient), just clipped to the current 8-point smoothed boundary
  instead of the full circle.
- A single subtle `drop-shadow`/`box-shadow`-equivalent for depth is the only decoration D1 needs
  — flour dust, stretch marks, and elastic wobble are explicitly deferred (task's own "D1では装飾
  より操作感優先"), tracked as D2/polish candidates, not D1 blockers.
- After DOUGH's step completes and the flow advances to SAUCE, rendering reverts to the existing
  plain circular `.pizza-dough` background exactly as it does today — carrying the hand-stretched
  boundary visually into SAUCE/BAKE/RESULT is explicitly Issue #37 M2's job ("dough/sauce/pieces
  の状態を bake renderer が一貫して利用"), not D1's. Keeping `doughShape` on canonical
  `PizzaState` (§5) means that future work is additive (read a field that already exists),
  not a second migration.

---

## 8. Completion threshold (restated, provisional)

```
sizeProgress = mean(doughShape.radii) / DOUGH_RADIUS
complete = sizeProgress >= 0.75   // provisional, tune in D2 Human Feel
```

No roundness/evenness gate in D1, per the task's explicit "厳しすぎない" instruction and its own
"D1ではscoringを実装しない" scope boundary. This threshold, and the initial-radius fraction in
§4.1, are the two provisional numeric knobs this audit flags — both should be treated as
placeholders tuned against a real iPhone in D2, not final values.

---

## 9. Scoring future (not built in D1)

The 8-point radial array (§3) is chosen specifically so a later scoring component can be added
without redesigning the shape model:

| Future dimension | Derivable directly from `doughShape.radii`? |
|---|---|
| size | yes — mean(radii) / target |
| roundness / evenness | yes — variance or min/max ratio across the 8 points |
| extreme distortion / edge irregularity | yes — same variance/spread signal |
| center-vs-rim balance | **no** — needs a thickness/mass proxy this boundary-only model doesn't carry; flagged as an open D3 design question |
| crust thickness | **no** — same gap; a derived proxy (e.g. assumed constant "dough mass" implies thinner as radius grows) is one option, not decided here |

Scoring 2.0 authority itself is untouched by this audit and by D1 — this table exists only to
confirm the shape model doesn't need to be thrown away once scoring integration (Issue #37 M6)
eventually starts.

---

## 10. Test plan (design only — not implemented this session, per task instruction)

Mirrors the exact conventions already established for sauce/toppings in this codebase:

1. **`src/logic/doughShape.test.ts`** (pure logic, no DOM) — initial state shape; a single pull
   updates the nearest bracketing points correctly; monotonic (a closer-in point after a
   farther-out one never shrinks that point); clamped to `DOUGH_RADIUS`; `sizeProgress`/
   `isDoughShapeComplete` at known fixture values.
2. **`src/components/PizzaStage.doughStretch.test.tsx`** (mirrors `PizzaStage.sauceParity.test.tsx`
   / `PizzaStage.sauceReset.test.tsx`'s existing `DOUGH_RECT`/pointer-event fixture pattern) —
   drag increases size live; commit only on a successful pointerup; `pointercancel`/
   `lostpointercapture`/blur/hidden all discard without committing; a stale pointerup after
   `resetToken` or `makingStepToken` bumps commits nothing; gesture never falls through to
   `onTap`/`PLACE_TOPPING`/`APPLY_SAUCE` (an explicit regression pin, learning directly from
   Issue #32 Finding 1-B's lesson: a new step must never silently degrade to a legacy path).
3. **`src/state/gameReducer.ts` additions** (extend `gameReducer.test.ts` or a new
   `gameReducer.doughStretch.test.ts`) — `COMMIT_DOUGH_STRETCH` only legal in
   `PREPARE`+`makingStep === "DOUGH"`; rejects outside that; `CONFIRM_MAKING_STEP` from DOUGH only
   advances once `sizeProgress` gate is met at the **UI** layer (the reducer's own transition stays
   ungated, matching every other step today — SAUCE/CHEESE have no reducer-side completion gate
   either, only a UI-disabled CTA) — worth an explicit test pinning that choice so it's not
   accidentally "fixed" into a stricter reducer gate later without a decision.
4. **`onewayFlow.test.ts` extension** — add a `DOUGH` `describe` block to the existing
   `describe.each([["FREE", false], ["Lunch Rush", true]])` parameterization (§1.7), covering:
   fresh round starts at `"DOUGH"`; `CONFIRM_MAKING_STEP` from DOUGH advances to SAUCE; stale
   gesture safety; `RESET_PIZZA` returns to DOUGH, not SAUCE.
5. **No new persistence tests needed** — `persistence.test.ts` is untouched since `PizzaState`
   was never in scope for it (§5).
6. **No visual/pixel regression harness** — matches the project's existing precedent (no such
   harness exists for sauce either); D2's real-iPhone Human Feel pass is the review gate instead.

---

## 11. Review Playthrough scenario (design only, for D1 implementation to execute)

390×844, single continuous take, 1–3s hold on each state:

1. HOME → 「ピザを作る」 → Pizza Select → pick a recipe.
2. DOUGH: initial hold — small, thick round dough visible, no shaping yet.
3. Short stretch — one drag in one direction; hold to show the resulting lopsided-but-growing
   shape; CTA still disabled.
4. Incomplete feedback — show the disabled CTA/hint line explicitly.
5. More stretching — 2–3 more pulls around the circle; hold once size threshold is crossed; CTA
   becomes enabled; hold on the enabled state.
6. Tap 「次へ →」 → transition into SAUCE; hold on the now-familiar SAUCE palette/dough.
7. Sauce paint — one tap + one short drag, confirming the DOUGH→SAUCE transition feels continuous
   and doesn't jar (the dough should look like the same object across the cut, not reset/pop).
8. RESET mid-DOUGH-gesture once, confirming a clean return to the small initial shape and a
   working fresh gesture afterward.

This is the concrete scenario D1's own implementation session should execute for its Preview
Playthrough — not run in this D0 audit (audit-only, no Preview/video per the task's exemption).

---

## 12. Scope guard confirmation

Confirmed **not** touched by this audit (read-only) and **not** required to be touched by the D1
slice recommended here: production `save` logic, Scoring 2.0 (`scoring.ts`/`scoringV2/*`),
Economy (`economy.ts`), Recipe data (`recipes.ts`/`recipeSauceProfiles.ts`), Reference
(`referencePizza.ts`), Sauce (`sauceField.ts`/`sauceDispenseController.ts`/`sauceQuantity.ts`),
Cheese/Topping (`PLACE_TOPPING`'s own contract, `IngredientTray.tsx`'s physical-drag system),
Bake (`bake.ts`), HOME/`HomeScreen.tsx`, Pizza Select/`PizzaSelectScreen.tsx`. No file in any of
these areas appears in the D1 slice (§13).

---

## 13. Recommended D1 implementation slice (2–3 hour Claude Code task)

**Title:** Issue #33 D1 — Dough Shaping interaction prototype (radial stretch, N=8, size-only
completion gate).

**Files to add:**
- `src/logic/doughShape.ts` — pure functions: `createInitialDoughShape()`,
  `applyStretchPoint(shape, xDough, yDough)` (angle/distance projection, bracketing-pair update,
  monotonic, clamped to `DOUGH_RADIUS`), `doughSizeProgress(shape)`, `isDoughShapeComplete(shape,
  threshold)`, `smoothDoughShapeForDisplay(shape)` (Catmull-Rom-style path points for rendering).
- `src/logic/doughShape.test.ts` — per §10 item 1.
- `src/components/PizzaStage.doughStretch.test.tsx` — per §10 item 2.

**Files to change:**
- `src/state/gameReducer.ts` — `MakingStep = "DOUGH" | "SAUCE" | "CHEESE" | "TOPPING"`;
  `MAKING_STEP_ORDER` prepend; `buildOrderState`'s initial `makingStep: "DOUGH"`; `RESET_PIZZA`'s
  reset target `"DOUGH"`; new `COMMIT_DOUGH_STRETCH` action + reducer case (phase/makingStep/
  validity guards mirroring `COMMIT_SAUCE_DISPENSE`). **Revalidation note:** also update
  `startPreparingRecipe`'s callers implicitly get this for free — `SELECT_RECIPE` and
  `RETRY_SAME_RECIPE` (both added by PR #49 after this D0 audit) both route through
  `buildOrderState`, so changing its one `makingStep: "SAUCE"` literal to `"DOUGH"` is the
  single edit that makes a fresh round, a same-recipe retry, and a Pizza-Select pick all start
  at DOUGH identically — see the Revalidation section below.
- `src/state/pizzaState.ts` — `DoughShape` interface, `DOUGH_SHAPE_POINTS = 8` const, initial-
  radius const, `doughShape: DoughShape` field on `PizzaState`, `createEmptyPizza()` update.
- `src/components/PizzaStage.tsx` — new `doughStepActive`/`makingStep` prop; new gesture branch
  in `handlePointerDown`/`processMovePoint`/`handlePointerUp` (position-driven, no RAF needed);
  local ref for the uncommitted in-progress shape (mirrors `pendingDepositsRef`); new SVG path
  render layer, reusing `abortActiveGesture()`/`resetToken`/`makingStepToken` effects unchanged.
- `src/App.tsx` — `handleDoughStretchProgress`/`handleDoughStretchCommit` handlers (mirrors
  `handleDispenseProgress`/`handleDispenseCommit`); thread new props into `GameScreen`.
- `src/screens/GameScreen.tsx` — don't render `<IngredientTray>` **or the `SauceMetricsPanel`
  block** while `makingStep === "DOUGH"` (the latter is already additionally gated on
  `activeCategory === "sauce"`, which DOUGH will never set, so this is already a no-op in
  practice — confirmed during revalidation, see below); extend `.prepare-bake-bar`'s CTA branch
  to a 4-way switch (DOUGH → 次へ, disabled until `isDoughShapeComplete`; SAUCE/CHEESE → 次へ,
  unchanged; TOPPING → 焼く！, unchanged). **Revalidation note:** the existing ternary is
  `state.makingStep === "TOPPING" ? 焼く！ : 次へ`, so DOUGH already falls into the `次へ` branch
  with zero structural change — the only actual addition is a `disabled={...}` prop on that
  button, which does not exist on any step's CTA today (SAUCE/CHEESE's `次へ` has never been
  disabled) — this is DOUGH's own new pattern, not a divergence from something D0 assumed.
- `src/data/hints.ts` — one new DOUGH-step hint branch.
- `src/App.css` — new `.pizza-dough-shape`/path styles only; **no changes** to `.pizza-dough`/
  `.pizza-stage` sizing rules, and **no changes needed** to `.order-card`/`.mini-reference`
  (Slice B's persistent mini Reference, added after this D0 audit — see Revalidation §2) since
  it lives in the `order-card` row above `PizzaStage`, entirely independent of the dough gesture
  surface.
- `src/state/onewayFlow.test.ts` — extend per §10 item 4.

**Gesture contract:** position-driven (no timer/RAF, unlike sauce), monotonic per control point,
committed atomically at a successful `pointerup` via `COMMIT_DOUGH_STRETCH`, discarded on every
existing abort trigger PizzaStage already handles generically.

**CSS:** additive only — a new shape/path layer inside the existing `.pizza-dough` box; zero
changes to existing sizing/positioning rules.

**Tests:** §10, all 4 items.

**Risks (carried into the D1 session, not resolved here):**
1. Keep `IngredientCategory` (shared with Shop/Dex/ingredients data) completely untouched — hide
   `IngredientTray` at the `GameScreen` level for DOUGH rather than inventing a `"dough"` category,
   to avoid widening blast radius into unrelated ingredient/shop code.
2. `buildHintLine` must get an explicit DOUGH branch, not silently fall through to SAUCE's own
   recipe-specific copy.
3. Guard against the exact Issue #32 Finding 1-B lesson: verify (with a test, §10 item 2) that a
   DOUGH-step gesture can never fall through to `onTap`/`APPLY_SAUCE`/`PLACE_TOPPING`.
4. Re-render cost: reuse `PizzaStage`'s existing `pendingVersion`/`forceRender` ref-plus-counter
   pattern for the live shape rather than inventing a second one.
5. Explicitly do not persist in-progress `doughShape` — already consistent with GameState's
   existing non-persistence (§1.8/§5), but worth calling out so a later PR doesn't casually add it.
6. Keep the completion threshold and initial-radius fraction visibly marked provisional in code
   comments, matching §8/§4.1 — they are expected to move after D2 Human Feel.
7. **(New, from revalidation)** `RESET_PIZZA`'s reducer case currently hardcodes
   `makingStep: "SAUCE"` (`gameReducer.ts:409`) — this literal must become `"DOUGH"` in the same
   edit as `buildOrderState`'s, or a mid-round reset would drop the player back into SAUCE
   instead of a fresh dough ball, silently skipping DOUGH on every retry. Both literals are
   one-line changes in the same file; call out explicitly so D1 doesn't fix one and miss the
   other.

**Explicitly out of scope for D1:** any roundness/evenness/distortion scoring (§9, D3), carrying
the hand-stretched boundary shape visually into SAUCE/BAKE/RESULT (Issue #37 M2), persistent dough
inventory/consumption (Save v2, PROJECT_HANDOFF P5), Practice/Normal/Challenge difficulty modes
(these do not exist in current `main` at all — see §14 below), keyboard/accessibility gesture for
DOUGH (tracked under the same Issue #27 gap sauce painting already has, not reinvented here).

---

## 14. Note: Practice/Normal/Challenge does not exist yet

Issue #33's body mentions "Practice hints vs Normal/Challenge visibility." Current `main` has no
such difficulty system — only FREE vs. Lunch Rush (Mission) exist, and neither differs in hint
policy today. This is tracked as a future item under `PROJECT_HANDOFF.md`'s P6 ("Difficulty /
Hint Policy: Practice, Normal, Challenge, Lunch Rush"), not something D1 needs to build or decide.

---

## Final Verdict (original D0 audit)

**A. READY FOR D1 RADIUS PROTOTYPE** — more precisely, ready for a D1 **multi-point radial**
prototype (§3's Candidate C), which is a small superset of a pure scalar-radius model (an N=8
array instead of one number) chosen specifically so the shape can look hand-stretched from day
one and so D3 scoring integration never needs a shape-model rewrite. If a strictly simpler D1 is
preferred, Candidate A's *gesture* (drag-from-center) still applies unchanged to a plain scalar
radius — the two choices are independent (§2 is the gesture decision, §3 is the shape-model
decision) — but this audit's recommendation is the radial array specifically because Issue #33's
own acceptance criteria ("Touch manipulation feels deliberate," charm, later roundness scoring)
are best served by it at negligible extra D1 cost.

- **Audited SHA:** `6e554918c42fc4d8ed267b715992e5ed5cf68e4f` (matches expected exactly; `main`
  now includes merged PR #45 — Issue #32 P1 is complete, see §0).
- **Recommended gesture:** Candidate A — drag from center outward, position-driven, monotonic.
- **Recommended shape model:** Candidate C — 8-point radial array, smoothed for display.
- **Completion threshold (provisional):** mean(radii)/`DOUGH_RADIUS` ≥ 0.75, size-only, no
  roundness gate in D1.
- **State location:** `PizzaState.doughShape` (canonical, reducer-owned, committed atomically at
  pointerup) — **not** ephemeral component state and **not** a Save schema change (`GameState` is
  never persisted at all; confirmed in §1.8).
- **Exact D1 scope:** §13 — 3 new files, 8 changed files, no changes to Sauce/Cheese/Topping/
  Bake/Save/Scoring/Economy/Recipe/Reference/HOME/Pizza Select.
- **Risks:** listed in §13, none blocking — the existing architecture (per the `MakingStep`
  code comment already anticipating `"DOUGH"`, and the already-generic `resetToken`/
  `makingStepToken` abort mechanism) substantially de-risks this addition versus a from-scratch
  new step.
- **Report:** `docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md` (this file).
- **PR:** opened against `main` from `claude/dough-shaping-d0-audit-phr2my`, docs-only, no
  production code changed.

---

## Revalidation (2026-09-17, post Issue #47 Slice A/B)

**Type:** READ-ONLY revalidation. No production code changed. This section amends the original
D0 audit above (which is left unmodified) rather than duplicating it, per this task's own
instruction.

**Revalidated main SHA:** `45fdf1a3ceae305f34dd1a8637b1a306f27dbfd5` (Merge PR #50: Issue #47
Slice B Reference UX). Confirmed via `git fetch origin main && git log origin/main -1` — matches
the task's expected SHA exactly. Delta since the original audit's `6e554918c`: **PR #49** (Issue
#47 Slice A — Findings A/B/C/D/E/K, merged) and **PR #50** (Issue #47 Slice B — Findings F/H,
merged). Slice C's own two findings (I, J) required no code change (I was confirmed already
correct; J was explicitly handed to Issue #37 M2 rather than implemented by Issue #47 — see
Issue #47's own Fresh Audit and `PROJECT_HANDOFF.md`).

### R.1 Purpose

Per the task: revalidate this existing D0 design against `main` as it stands after Issue #47
Slice A/B, **not** redo the audit from scratch. Every section above was re-read against the new
`main` and checked line-by-line against the two merged PRs' diffs (`gameReducer.ts`,
`GameScreen.tsx`, `App.css`, `pizzaState.ts`, `PizzaStage.tsx`). Finding: **the architecture
assumptions and D1 recommendation in §1–§13 above still hold with zero changes needed to the
gesture, shape model, or state design.** Two small, additive corrections to the *implementation
slice's exact edits* (not its scope or design) are listed in R.4.

### R.2 What changed on `main` since the original audit, and its effect on DOUGH

| Change (Slice A/B) | Effect on this D0 audit |
|---|---|
| `MakingStep` union, `MAKING_STEP_ORDER`, `CONFIRM_MAKING_STEP`, `RESET_PIZZA`'s step-reset behavior | **Byte-for-byte unchanged.** `gameReducer.ts:31` is still exactly `"SAUCE" \| "CHEESE" \| "TOPPING"` with the same "so Issue #33 can prepend DOUGH" comment (`gameReducer.ts:26-30`). §1.1/§1.2/§6's analysis is still accurate as written. |
| New `SELECT_RECIPE`→`startPreparingRecipe` path (Finding C): Pizza Select now lands directly on `PREPARE` instead of routing through `BEGIN_PREPARE`'s `ORDER` gate | **Additive, not a divergence.** `startPreparingRecipe` (`gameReducer.ts:230-239`) calls the same `buildOrderState` §1.2/§4.1/§5 already described — it just also flips `phase` to `"PREPARE"` in the same step. A DOUGH-initial `makingStep` inside `buildOrderState` (the one-line change §13 already specifies) automatically applies to this new path too, with no extra edit — see R.4. |
| New `RETRY_SAME_RECIPE` action (Finding D), replacing the old always-different-recipe `PLAY_AGAIN` for DISCOVERED's primary retry button | **Directly satisfies the task's "RETRY_SAME_RECIPE → fresh dough" requirement for free.** `RETRY_SAME_RECIPE`'s reducer case (`gameReducer.ts:488-496`) calls the exact same `startPreparingRecipe` → `buildOrderState` path as `SELECT_RECIPE` — so once `buildOrderState`'s `makingStep` literal is `"DOUGH"`, retrying the same recipe starts at a fresh dough ball automatically, with no `RETRY_SAME_RECIPE`-specific code needed. Confirmed no separate `PizzaState`-building logic exists for this action. |
| Persistent mini Reference thumbnail in a new `.order-card` compact header, above `PizzaStage` (Finding H, Slice B) | **No effect on the DOUGH gesture surface.** Read `App.css:126-165` and the CSS's own comment at `App.css:2325-2340`: the mini-reference thumbnail is explicitly sized (48px) and commented "so it fits the compact order-card row without crowding... or growing tall enough to threaten PizzaStage's own clearance." `.pizza-dough`/`.pizza-stage` (`App.css:160-181`) are unchanged since the original audit — still `min(78vw, 300px)`, still flex-centered. §1.5/§4.2/§4.5's "300px circle, 390×844-verified" analysis needs no update. |
| `PlayerReferencePreview`/`getPlayerReferencePizza` (Finding F, Slice B) — Reference now exists for all 7 recipes, not just Margherita | **Out of scope for DOUGH, confirmed untouched.** This is purely a `referencePizza`/`playerReference` data + popover change; no `PizzaState`, `MakingStep`, or `PizzaStage` gesture code was touched by it. §12's scope guard ("Reference not touched") still holds for D1's own planned edits — DOUGH doesn't add a Reference for the dough shape itself, matching the original audit's scope. |
| Shop/Dex navigation removed from `GameScreen`'s header (Finding K) | No interaction with DOUGH at all — a header JSX-only change, confirmed by reading the current `GameScreen.tsx:186-201`. |
| `.cta-button--bake` touch target 48px→54px (Finding E) | The `次へ`/`焼く！` CTA DOUGH's own completion gate will extend (§1.6/§13) is the *same* button class — this revalidation confirms DOUGH's new `disabled` state will apply to the already-54px button, not a stale 48px one. No design change, just confirms the D1 slice targets current markup. |
| `isRoundInProgress()` refinement in `App.tsx` (so picking a recipe and immediately leaving doesn't false-positive a "pizza will be lost" confirm) | Not exercised by anything in this audit's scope; confirmed by reading `App.tsx:330-348` that this checks `state.phase`/`hasStartedPreparing`, not `makingStep` — adding a `"DOUGH"` step value doesn't change its logic, since `phase === "PREPARE"` already covers DOUGH once `MAKING_STEP_ORDER` is extended. |

### R.3 Assumptions explicitly re-confirmed valid (not just "presumed still true")

- `PizzaStage.tsx`'s `resetToken`/`makingStepToken` abort effects (`abortActiveGesture()`,
  `gestureRef`, first-finger-wins, `isPaintMode` gate) — read directly in the current file at the
  same structural location (`PizzaStage.tsx` lines ~223–294 keyed off `resetToken` and
  `makingStepToken`), unchanged since the original audit. §1.3/§6's "close to free" gesture
  isolation conclusion stands exactly as written.
- `PizzaState`'s shape (`sauceIds`/`sauceOrigin`/`sauceToken`/`sauceDeposits`/`toppings`/
  `bakeResult`) and `createEmptyPizza()` — read directly in the current `pizzaState.ts`, no
  `doughShape` field yet (as expected — D1 hasn't started), no other field added or removed by
  Slice A/B. §5's "add one field, zero Save impact" plan is unchanged.
- `PersistentSaveV1`/`persistence.ts`'s non-`GameState` persistence boundary — not touched by
  Slice A/B (neither PR's file list includes `persistence.ts`). §1.8/§5's Save-schema-free
  conclusion is unaffected.
- `.prepare-bake-bar`'s CTA ternary (`state.makingStep === "TOPPING" ? 焼く！ : 次へ`) — read
  directly in the current `GameScreen.tsx:362-378`; the DOUGH step still falls into the `次へ`
  branch with no structural change, confirming §1.6/§13's "one more branch, not a rewrite" claim
  (in fact, given the ternary is two-way rather than a switch, DOUGH needs **no new branch at
  all** — only a new `disabled` prop, see R.4).
- FREE/Lunch Rush parity (§1.7) — `buildOrderState` is still the single shared function behind
  every "start a round" path (`nextOrderState` for FREE, `nextMissionOrderState` for Lunch Rush,
  and now also `startPreparingRecipe` for `SELECT_RECIPE`/`RETRY_SAME_RECIPE`) — confirmed by
  reading all four call sites in the current `gameReducer.ts`. A DOUGH-initial `makingStep`
  applies identically across all of them by construction, same conclusion as the original audit,
  now with one more call site (`startPreparingRecipe`) additionally confirmed.

### R.4 Corrections to the D1 slice (additive, not a redesign)

Two small, previously-implicit points made explicit by re-reading the current code line-by-line;
neither changes the recommended gesture (§2), shape model (§3), state location (§5), or file
list (§13) — they only sharpen exactly which literals in `gameReducer.ts` need editing:

1. `buildOrderState`'s `makingStep: "SAUCE"` (`gameReducer.ts:177`) is the **one** place to
   change to `"DOUGH"` for every "fresh round" path (`nextOrderState`/FREE,
   `nextMissionOrderState`/Lunch Rush, and — newly confirmed — `startPreparingRecipe`/
   `SELECT_RECIPE` and `RETRY_SAME_RECIPE`) to start at DOUGH. This was implicitly true in the
   original audit (which only knew about `nextOrderState`/`nextMissionOrderState`) and is now
   explicitly confirmed to also cover the two new Slice A actions with no additional edit.
2. `RESET_PIZZA`'s reducer case (`gameReducer.ts:404-414`) independently hardcodes
   `makingStep: "SAUCE"` (**not** derived from `buildOrderState`) — this is a **second**, separate
   literal that must also change to `"DOUGH"` in the same D1 edit, or a mid-round 「やり直す」
   would drop the player back to SAUCE instead of a fresh dough ball. The original audit's §4.8
   describes the *behavior* this needs ("returns to DOUGH, not SAUCE") correctly, but didn't
   flag that it requires editing a second, independent literal — now flagged explicitly as D1
   Risk 7 in §13 above, so a D1 implementation session can't fix one and miss the other.

Neither correction changes scope, adds a file, or touches anything in §12's scope guard — both
are single-literal edits inside the one file (`gameReducer.ts`) §13 already listed as needing to
change.

### R.5 DOUGH → SAUCE → CHEESE → TOPPING → BAKE fit, re-confirmed

Still fits cleanly, unchanged from the original audit's conclusion. `MAKING_STEP_ORDER` is a
plain array; prepending `"DOUGH"` is still the only structural edit `MakingStep`/
`nextMakingStep()` need. Nothing in Slice A/B introduced a competing sub-step, a new phase, or
any other structural change to `GamePhase`/`MakingStep` that this ordering would need to
accommodate.

### R.6 Gesture re-confirmed against current PizzaStage/mini-Reference/sauce/stale-gesture systems

- **PizzaStage pointer handling:** unchanged (R.3). DOUGH's planned gesture branch (§2/§4/§13)
  still reuses `clientPointToDoughPercent`/`isInsideDough`/`gestureRef`/`abortActiveGesture()`
  exactly as designed.
- **Mini Reference:** lives in a separate DOM subtree (`order-card`, above `PizzaStage`) with its
  own click handler (`onReferencePopoverChange`) — no pointer-capture or z-index overlap with
  `.pizza-dough`'s gesture surface; confirmed by reading both components' current JSX. No
  conflict.
- **Safe-area layout:** `.prepare-bake-bar` is still `position: fixed` (Human Feel Fix 3,
  pre-dates and is unaffected by Slice A/B beyond the 48→54px CTA height bump, R.2) and
  `.ingredient-panel` still reserves matching bottom padding — DOUGH doesn't render
  `IngredientTray` at all (§13's plan), so this reservation is simply inert during DOUGH, not a
  conflict.
- **Sauce gesture system:** `isPaintMode`/`placement: "spread"` gating is unchanged (R.3); DOUGH
  remains routed by `makingStep`, never overlapping sauce's own `activeIngredient`-driven gate.
- **Stale gesture protection:** `resetToken`/`makingStepToken` abort effects unchanged (R.3);
  §6's "close to free" conclusion still holds verbatim.

**No gesture conflict found.** No revision needed to §2's recommended gesture or §6's isolation
design.

### R.7 Priority truth (per task §4)

- Issue #47 Slice A (PR #49) and Slice B (PR #50) are merged into `main` as of this revalidation.
- Slice C's own two findings: **I** (sauce repaint vs. one-way flow) was confirmed already
  correct by the original Fresh Audit — no code change was ever needed. **J** (Cheese/Topping
  drag scope) remains explicitly assigned to **Issue #37 M2**, not Issue #47 — this was Issue
  #47's own Fresh Audit decision (avoid double-implementing a system Issue #37 M2 already owns),
  unaffected by this revalidation.
- **Issue #33 is now the active priority.** This revalidation confirms the existing D0 design
  (§1–§13) is ready for D1 implementation without material revision — see Final Verdict below.
- This revalidation does **not** reopen or touch any Issue #47 implementation work (Slice
  A/B/C content, findings A–K) — confirmed no file in Issue #47's scope was edited by this
  session (docs-only, per the SSOT sync in R.8/R.9).

### R.8 PR #46 strategy assessment (per task §5)

- **A (rebase/reuse as-is): not applicable as a literal rebase** — PR #46's own branch
  (`claude/dough-shaping-d0-audit-phr2my`) is based on the pre-Slice-A/B `main`
  (`6e554918c`), and this revalidation session's designated branch/workflow is a separate branch
  (`claude/dough-d0-revalidation-16lhut`) per this session's repository instructions, so the
  literal file edits in this revalidation land on a new branch/PR rather than being pushed onto
  PR #46's existing branch.
- **B (small D0 report amendment): this is what happened, in substance.** The verdict, gesture,
  shape model, state design, and D1 scope in the original report are **unchanged** — this
  revalidation only appends the section you're reading (R.1–R.10) to the same report file,
  updates `docs/PROJECT_HANDOFF.md`, and refreshes Issue #22/#33. No content from the original
  audit was discarded or rewritten.
- **C (close and replace): not warranted** — nothing in the original D0 design was invalidated
  (R.3), so a from-scratch redo would duplicate work the task explicitly says not to duplicate.
- **Recommendation:** merge this revalidation's branch into PR #46's branch (or update PR #46's
  branch directly with this file's content, since it is a strict superset — same content plus
  this appended section), rather than opening a second competing PR for what is, in substance,
  a "B" amendment. If branch mechanics make that inconvenient, opening a new PR that carries
  PR #46's exact original diff plus this amendment, with PR #46 closed as superseded (not
  because its content was wrong, but because its branch predates Slice A/B and this revalidation
  needed a different branch), is an acceptable **A/B-in-spirit, C-in-mechanics** fallback — see
  this session's final report to the user for the concrete recommendation given actual repo
  state at hand-off time.

### R.9 SSOT updates made by this revalidation

- `docs/PROJECT_HANDOFF.md` — Issue #47 line updated from "Implementation has not started" /
  "PR pending review/merge" (stale, pre-dating PR #49/#50's merges) to reflect Slice A and Slice
  B merged, Slice C's I/J resolution, and Issue #33 as the current active priority with this
  revalidation's SHA and verdict recorded.
- Issue #22 — same correction, plus the roadmap table's "Making Game" timing row.
- Issue #33 — a new comment (this session) records the revalidation verdict, changed
  assumptions (R.2/R.4), and confirms D1 readiness against the current `main` SHA.

### R.10 Final Verdict (revalidation)

**B. PR #46 NEEDS MINOR D0 UPDATE — READY AFTER UPDATE.**

The original D0 audit's architecture assumptions, interaction gesture (Candidate A: drag-from-
center-outward radial stretch), shape model (Candidate C: 8-point radial array), state design
(`PizzaState.doughShape`, no Save schema change), and completion threshold (mean(radii)/
`DOUGH_RADIUS` ≥ 0.75, size-only) all remain valid and unchanged after Issue #47 Slice A/B. The
only update needed is exactly this section: two additive corrections to *which exact literals*
in `gameReducer.ts` the D1 session must edit (R.4), both already folded into §13's slice
description and Risk list above. No redesign, no new files, no scope change. **D1 implementation
may proceed directly from §13 of this report, using R.4's two-literal correction, once this
report's file lands on `main` (via PR #46 update or its replacement — see R.8).**
