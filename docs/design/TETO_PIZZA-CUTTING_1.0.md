# TETO Pizza Cutting 1.0 — Fresh Design (Phase 0, docs-only)

**Audited `origin/main` SHA:** `8d6109b6e5be3a709f8b77d506bf75b1fe6984b7` (PR #122, Recipe Cooking
Steps 1.0 Phase 0, merged). This branch was fast-forwarded onto that SHA before this document was
written.

**SSOT this design builds on (not re-derived, not re-decided):**
`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` and its companion
`docs/reports/TETO_RECIPE-COOKING-STEPS_Phase0_Result.md`. That document already designed and
committed the architecture this Pizza Cutting design plugs into — `CookingProfile`, the
`POST_BAKE` phase, the widened `MakingStep` union (which already includes `"CUT"`), the Step
Timing Architecture (`perStepElapsedMs`, Quality-primary/Time-secondary, the CUT timing/gesture-data
separation contract, §22.7/§22.14), and the general new-step Scoring/Completion-Gate integration
patterns (§10/§11). This document does **not** re-open or re-decide any of that — it is the CUT
step's own design, written as the "resumed Pizza Cutting Architecture session" that Cooking Steps
§20 explicitly hands off to.

**Scope: design-only.** No production code, Scoring 2.0 weights, star thresholds, Completion Gate
behavior, Economy, Progression, recipe ingredients, Inventory, Shop, Lunch Rush scoring, Firebase
Ranking, save schema, or Cooking Steps production implementation changes in this task.

**Duplicate Gate #1 result:** `git fetch origin` + a full open-PR and remote-branch search (see
the Result Report §1) found **no open PR or branch** matching cut/cutter/slice/POST_BAKE/cooking-
steps scope. PR #122 (Cooking Steps Phase 0) is merged. The only other open PR touching adjacent
territory is **#121 — Firebase Production Connection**, explicitly out of scope and untouched by
this task.

**Viewport authority:** 390×844 (this repo's own existing authority — `App.css:21`,
`.app-frame { max-width: 390px }`). Secondary: 360×800. Touch-first / iPhone-first, matching every
other interaction family in this codebase (DOUGH stretch, sauce dispense, topping drag).

---

## 1. Basic flow — CUT's place in `CookingProfile`

Per the merged SSOT (§8), the state machine already designed for this is:

```
ORDER -> PREPARE -> BAKE -> POST_BAKE -> RESULT -> DISCOVERED
                               |
                    makingStep walks state.cookingProfile.steps'
                    post-BAKE entries (CUT, FINISH, ...) via the
                    same CONFIRM_MAKING_STEP mechanism PREPARE
                    already uses for DOUGH->SAUCE->CHEESE->TOPPING
```

`POST_BAKE` is skipped straight through to `RESULT` whenever a recipe's profile has no post-BAKE
steps — true for all 15 shipped recipes today, and true for CUT until a recipe's profile actually
lists it (§18 "Activation" gate below). **No CUT-specific exception state machine is designed or
needed** — CUT is simply one entry in `CookingProfile.steps`, walked by the exact same one-way
`CONFIRM_MAKING_STEP` gate every other step already uses.

### 1.1 FINISH vs. CUT ordering

The merged SSOT's own §5 walkthrough table has already answered this, for the recipes that need
both:

```
...BAKE -> FINISH -> CUT -> RESULT      (prosciutto / diavola / frutti-di-mare / detroit-style)
```

This design adopts that ordering unchanged, and states the reasoning explicitly (the SSOT names
the sequence but not the "why," which this document fills in since Pizza Cutting is the one that
actually depends on it):

- **FINISH adds ingredients to the still-whole pizza** (drizzle/scatter across the full baked
  surface) — exactly like real pizza-making, garnish goes on before the pie is sliced. Doing CUT
  first would mean FINISH's own drizzle/scatter placement has to reason about a pizza already
  visually separated into wedges (gaps, offset pieces), which is a strictly harder placement
  surface for no benefit.
- **CUT's own visual (§8 below) is a "final" state** — pieces read as done, ready to serve. Putting
  another interaction step after it (FINISH) would undercut that "you just finished cutting"
  payoff and would require FINISH's placement/scoring code to handle an already-separated dough
  shape.
- This also matches the taxonomy test the SSOT itself establishes (§4 of that document): FINISH is
  additive to the *composition* of the dish; CUT is the *last* thing done to a composed dish before
  it's served. Nothing in this design proposes `CUT -> FINISH` for any recipe.

**Calzone (FOLD/SEAL only) needs no CUT at all** — its profile simply never lists `"CUT"`. This is
exactly the SSOT's own §5 finding ("a closed, folded pizza is served whole"), unchanged here, and
is the concrete proof that CUT is correctly modeled as an opt-in profile entry rather than a
phase every recipe passes through.

### 1.2 CUT's own `CookingProfile` entry

```ts
// Extends the SSOT's own CookingProfile shape (design doc §7) — no new top-level concept.
interface CookingProfile {
  steps: readonly MakingStep[];
  // ...existing doughConfig/sauceConfig/toppingConfig/foldConfig/edgeFillConfig/finishConfig...
  cutConfig?: CutConfig;
}

interface CutConfig {
  /** Even number only in this design (see §3.3) — a real pizza is cut by drawing full lines
   *  across it, and N full cuts through/near the center produce 2N roughly-equal wedges. Absent
   *  means "this recipe's profile doesn't include CUT at all" (steps simply omits "CUT"), never
   *  "CUT with an undefined slice count" — this field only has meaning when "CUT" is present in
   *  `steps`. Default when present-but-unset: 6 (§3.1). */
  requestedSliceCount?: 4 | 6 | 8;
}
```

Every one of the 15 shipped recipes' profile continues to omit `"CUT"` from `steps` entirely until
the explicit Activation gate (§18) — zero visible change for them, by the exact same "additive,
absent-by-default" discipline the SSOT already established for every other new step.

---

## 2. CUT gesture — Fresh Design comparison

Four candidates evaluated (the brief's three plus one more this audit adds for completeness).

| | **A. Edge-to-edge drag** | **B. Center-assisted drag** | **C. Swipe-through (flick detect)** | **D. Two-tap (place point, place point)** |
|---|---|---|---|---|
| What the player does | Press near the rim, drag across the dough, release near the opposite rim | Press anywhere; the engine auto-extends a straight line through the dough's center to the far rim in the drag's direction | A fast flick gesture over the dough; the engine fits a line to the flick's direction/extent | Tap once near one rim point, tap again near the opposite rim point |
| 気持ちよさ (fun) | High — it's literally the cutting motion, matches every prior gesture family in this codebase (drag = commit) | Medium — "did I even cut this, or did the game do it for me" (agency loss) | Medium-high in isolation (arcade "slice" feel), but conflicts with needing *precise, deliberate* lines for an even 6-way cut | Low — feels like a puzzle tap, not a cutting action |
| 片手操作 (one-handed) | Good, with a generous edge-start tolerance (§2.2) | Good | Good | Good, but two separate taps double the chance of a mis-tap being committed before the player can react |
| 誤操作 (mis-taps) | Low risk — reuses this repo's existing tap-vs-drag distance threshold (`DRAG_THRESHOLD_PX`, `PizzaStage.tsx`) to reject a stray tap outright | Low | **High** — a flick's direction/endpoint is inherently noisier to fit than an explicit drag path, and distinguishing "a real cut flick" from "an accidental fast swipe while repositioning a finger" is a real false-positive risk | Medium — a stray tap near the rim commits half a line immediately, no "in-progress" preview to cancel out of |
| 学習コスト (learning cost) | Very low — matches how a real pizza cutter is used | Low, but the auto-center-snap behavior itself needs explaining ("why did my line move") | Medium — players must learn "a proper flick," which is a less universal mental model than "drag across" | Low, but "two taps make a line" is a less intuitive metaphor for *cutting* specifically |
| 4/6/8への拡張 | Trivial — repeat the same gesture `requestedSliceCount / 2` times | Trivial, same repeat pattern | Awkward — flick detection quality degrades as the required precision increases (8 slices needs tighter angular spacing than 4) | Trivial |
| 判定の公平さ (fairness) | **High** — center accuracy and angle are genuine outcomes of where the player actually dragged, so a real center-accuracy/uniformity score means something | **Low** — center accuracy is forced to 1.0 by construction, so that scoring axis (explicitly requested as important, §5) becomes meaningless for this option | Medium — a fitted line from noisy flick data is a worse ground truth than an explicit drag path | High, but "fairness" is undermined by the same lack of an in-progress preview that hurts mis-tap safety |
| 実装複雑度 | **Low** — this is structurally the *same* pointerdown/move/up/cancel architecture `PizzaStage.tsx` already implements three times over (sauce dispense, DOUGH stretch, topping drag/tap) — see §2.2 | Medium — needs an extra "snap the line through center" projection step on top of A's own architecture | High — needs velocity/direction fitting from a move-sample buffer, a genuinely new algorithm class this codebase doesn't have a precedent for | Low, but needs new "first tap pending, waiting for second tap" transient UI state with no existing precedent (every other gesture in this codebase is a single continuous press-drag-release) |
| 390×844視認性 | Good — a rim-to-rim line across a 300px dough (`App.css:167`, `width: min(78vw, 300px)`) is easy to see and easy to aim at even at 8 slices (45° spacing) | Good | Good once committed, but the in-flight flick itself is fast and hard to visually confirm before it resolves | Good, but the "line" only appears after both taps — no continuous visual feedback while aiming |
| 難易度調整余地 (future tuning) | High — guide visibility, edge-start tolerance, and undo slack (§2.2/§10) are all independently tunable constants, matching this repo's existing "provisional, tunable during Human Feel" convention (`doughShape.ts`'s own constants) | Medium — the only real tuning lever is guide visibility, since center accuracy can't vary | Medium — tuning is entangled with the flick-detection algorithm itself | Medium |
| 自動テスト可能性 | **High** — a synthetic `pointerdown` at rim-point A + `pointerup` at rim-point B is trivial to script and assert against, same pattern this codebase's existing `PizzaStage`/gesture tests already use | High, same reason | Low — testing a velocity/fit-based detector requires simulating realistic move-sample timing, not just two coordinates | High |

### 2.1 Recommendation: **A — Edge-to-edge drag**

Chosen because it is simultaneously the most fun (real cutting motion, not an assisted or
puzzle-like substitute), the fairest (center accuracy and uniformity are genuine skill outcomes,
which §5's own emphasis on piece-area uniformity requires to have any meaning), and — critically —
the *lowest-risk to implement*, because it is not a new interaction family at all: it is the same
pointer-capture architecture `PizzaStage.tsx` already runs three times (`handlePointerDown` /
`handlePointerMove` / `handlePointerUp` / `handlePointerCancel` / `handleLostPointerCapture`, plus
the window-level `pointerup`/`pointercancel` fallback listeners for a finger that leaves the
element mid-drag). CUT becomes a fourth branch inside that same dispatch, not a parallel
implementation.

B (center-assisted) is explicitly rejected for exactly the reason the brief itself worries about
("正確すぎて操作しづらい判定は禁止" cuts the other way too: an assist that removes the *possibility*
of a bad cut removes the game). C (swipe/flick) is rejected as needing a genuinely new, noisier
detection algorithm this codebase has no precedent for, for a worse fairness/testability trade.
D (two-tap) is rejected as the weakest "does this feel like cutting a pizza" candidate and the one
candidate needing new transient "first tap is pending" UI state with no reuse of the existing
single-continuous-gesture architecture.

### 2.2 Gesture mechanics (Option A, detailed)

Reuses `PizzaStage.tsx`'s existing primitives directly — no new coordinate system, no new pointer
plumbing:

- **Start tolerance ("no pixel-perfect rim tap"):** `pointerdown` is accepted for CUT anywhere
  from the dough's center out to the rim (i.e., **not** restricted to a thin edge band) — the
  *committed* line's start point is what matters for scoring, not where the finger first touched.
  This directly satisfies the brief's "正確すぎて操作しづらい判定は禁止" instruction: a player who
  presses down 10% short of the rim is not rejected, they simply get a slightly different (and
  fairly scored) center-accuracy/completeness outcome once the line commits (§9's clamp behavior
  determines this, not a start-time gate).
- **In-dough-only start, matching `isInsideDough`:** the one real gate is the existing
  `handlePointerDown`'s own `if (!isInsideDough(dough.x, dough.y)) return;` check — a press that
  starts entirely outside the dough's bounding circle is not a CUT gesture (mirrors every other
  gesture family's own identical guard, zero new logic).
- **Drag-vs-tap distinction:** reuses the existing `DRAG_THRESHOLD_PX` distance check
  (`PizzaStage.tsx`'s `processMovePoint`) verbatim — a press with no meaningful movement is a
  no-op tap, not an accidental zero-length cut line. This is the existing, already-tuned mechanism
  the brief's own "誤操作 (accidental tap) rejection" requirement asks for; no new constant needed.
- **Commit / release clamp:** on `pointerup`, the release point is clamped onto the dough's rim
  along the same direction from center — this is `clampToDough` (`pizzaCoordinates.ts`), already
  used for exactly this "a drag that releases just past the edge should still commit cleanly"
  purpose (piece-drop grace annulus, PR #26). CUT reuses it unchanged: **every committed `CutLine`
  is, by construction, a full rim-to-rim chord** — there is no such thing as a "dangling"
  half-drawn cut once it commits, which meaningfully simplifies the geometry (§4) and removes an
  entire category of "incomplete individual line" edge cases the brief asks about (§4's own
  "incomplete cut detection" item resolves to "was this line ever committed at all," never "did
  this committed line fail to reach the edge").
- **Minimum line length:** in addition to the drag-threshold tap rejection above, a committed line
  whose two *clamped* rim endpoints are closer than a small angular minimum (e.g. 15°) apart is
  rejected as degenerate (a near-duplicate of "the same cut twice") rather than silently accepted
  as a second, valid line — this protects the geometry evaluator from being asked to reason about
  a sliver so thin it's numerically unstable at the grid-sampling resolution (§4.2), not a
  gameplay/fairness concern. Exact angular minimum is Human-Feel-tunable (§21).
- **Multi-touch:** first-finger-wins, reusing `handlePointerDown`'s existing
  `if (gestureRef.current.pointerId !== null) return;` guard verbatim — a second simultaneous
  finger is ignored exactly as it already is for every other gesture family.
- **Line crossing:** **no rejection, no special handling.** Two committed chords may cross freely.
  The grid-sampling evaluator (§4.2) scores whatever regions actually result — a badly-crossed
  configuration simply scores poorly on uniformity/count-correctness, it is never blocked at the
  gesture layer. This is a deliberate simplification (§4 explains why the chosen geometry approach
  makes crossing-detection logic unnecessary, not merely deferred).
- **Cut limit + undo:** see §10.

---

## 3. Slice count

### 3.1 4 / 6 / 8 comparison

| | 4 slices | 6 slices | 8 slices |
|---|---|---|---|
| Cuts required (§1.2's "N full lines -> 2N wedges" convention) | 2 | 3 | 4 |
| Angular spacing per wedge (ideal) | 90° | 60° | 45° |
| Forgiveness at 300px dough diameter | Most forgiving — wide wedges, hard to make visibly uneven by accident | Middle ground — the classic real-world pizza slice count, matches player expectation | Least forgiving — thin wedges make uniformity errors visually obvious fastest, best "skill ceiling" but highest early-frustration risk |
| Learning-curve fit | Feels almost too easy as a first introduction to a brand-new mechanic | **Best first-teach candidate** — familiar real-world count, meaningful but not punishing precision requirement | Best reserved for a later difficulty tier / a Lunch Rush order-condition (future, §17 of the Cooking Steps SSOT), not a first introduction |

### 3.2 Recommendation: **ship 6 only in Phase 1 (CUT Phase 1-4, §20)**

Not "implement 4/6/8 simultaneously." Reasons:

1. **`CutConfig.requestedSliceCount` is already a per-recipe data field** (§1.2) — supporting 4/8
   later is a config-value change on whichever recipe adopts them, not new engine code. There is
   no implementation-cost reason to build all three now; the data model already makes them free
   later.
2. **6 is the correct first-teach value** per §3.1's own table — introducing a brand-new mechanic
   at its *hardest* setting (8) or its least-representative setting (4, which barely exercises the
   uniformity-scoring axis at all — 2 cuts have very little room to be uneven) both make worse
   first impressions than the familiar, moderately-precise 6.
3. Matches this repo's own established slicing convention for *implementation* phases (not pizza
   slices): ship the narrowest correct-by-construction thing first, widen the data afterward. The
   Cooking Steps SSOT's own Phase 1A discipline ("zero new recipes, zero new mechanics beyond the
   one foundation being tested") is the same instinct applied here.
4. A later slice can add 4/8 as pure `CutConfig` data on additional recipes with **zero geometry,
   scoring, or gesture code changes** — the evaluator (§4) and gesture (§2) are already fully
   general in `requestedSliceCount`. This is explicitly *not* deferring hard work; it's deferring a
   product/rollout decision (which recipes get which count) that has no engineering cost either way.

**Rejected: implementing all of 4/6/8 in Phase 1.** This would be building for a rollout decision
(§18) that hasn't been made yet, and testing three difficulty tiers simultaneously before Human
Feel verification (§21) has confirmed even one of them feels good — directly against this task's
own "don't build ahead of need" instruction.

---

## 4. Geometry

### 4.1 What's actually needed (and what isn't)

Per §2.2, every committed `CutLine` is, by construction, a **full rim-to-rim chord** of the dough's
circle. This one fact removes most of the "general-purpose computational geometry engine" surface
the brief explicitly warns against building:

- **No chord-to-circle intersection math needed** — both endpoints are already on the circle by
  the gesture's own clamp behavior (§2.2), not something that has to be *computed* from an
  arbitrary line.
- **No incomplete-individual-cut-line detection needed** — same reason; "incomplete" only ever
  means "fewer committed lines than required" (an aggregate count, §4.3's completeness component),
  never a malformed single line.
- **Center distance** — trivial: perpendicular distance from `DOUGH_CENTER` (the existing
  `pizzaCoordinates.ts` constant, reused unchanged) to each chord.
- **Cut-line clipping / piece polygon generation** — this is the one place a naive approach would
  reach for full computational geometry (a half-edge/DCEL structure to enumerate the exact faces
  N crossing chords divide a disk into). §4.2 below deliberately avoids building that.

### 4.2 Piece area — recommended approach: **deterministic grid-sampling** (the brief's own
candidate D)

Four candidates were on the table (per the brief):

- **A. Center + angle deviation only** — explicitly rejected by the brief's own instruction
  ("単に「角度差」だけで採点しない"); doesn't answer the piece-area-uniformity question at all.
- **B. Exact polygon clipping (segment arrangement / DCEL)** — mathematically exact, but is
  precisely the "general-purpose computational geometry engine" the brief says not to build for
  Phase 1: correctly enumerating the faces of an arbitrary arrangement of up to 4 crossing chords
  inside a disk needs a real half-edge data structure, segment-intersection computation, and
  careful handling of degenerate cases (near-parallel chords, near-duplicate angles) — a
  meaningfully larger and more fragile surface than this feature needs.
- **C. Closed-form circular-segment/sector formulas** — only stays simple in the special case
  every chord passes through (or very near) the exact center; the moment a real player's chord is
  off-center (which is *exactly* the case the center-accuracy score exists to measure), the
  resulting piece shapes are asymmetric circular segments bounded by two different chords, and the
  closed-form formulas stop being simple — this approach quietly re-derives most of B's complexity
  the instant it has to handle realistic input.
- **D. Sampled area approximation — recommended.** Lay a fixed grid of candidate points over the
  dough's bounding square, keep only the points inside the circle (`isInsideDough`, reused
  unchanged), and classify each kept point by which side of each committed chord it falls on (a
  sign per chord, e.g. `+`/`-` from the chord's line equation). Two points with the identical sign
  *tuple* are unambiguously in the same piece. `pieceArea[tuple] = (count[tuple] / totalKeptPoints)
  * circleArea`.

Recommended concretely as:

```ts
// src/logic/cut/geometry.ts (new file, pure functions only — mirrors sauceField.ts's own
// "no DOM, no React, no timing" discipline)

interface CutLine {
  start: DoughPoint; // dough-percent coordinates, same space as every other gesture family
  end: DoughPoint;
}

/** A fixed, deterministic grid -- never Math.random(). Same input always produces the exact
 *  same output, which is what makes this both unit-testable and, if a future phase ever wants
 *  a server-authoritative recompute (Lunch Rush Phase 3, out of scope here), reproducible
 *  without needing a shared RNG seed. */
const GRID_RESOLUTION = 96; // 96x96 candidate points over the bounding square; tunable (§21)

function sidesOf(point: DoughPoint, line: CutLine): 1 | -1 { /* line-equation sign */ }

/** Returns one area (in the same 0-100 dough-percent² unit as DOUGH_RADIUS) per distinct
 *  region the committed lines actually produced -- however many that is (never assumed to
 *  equal requestedSliceCount; see uniformity's own handling of a mismatched count, §6.1). */
export function computePieceAreas(lines: readonly CutLine[]): readonly number[] { ... }
```

This is recommended because it:

1. **Needs no segment-intersection or polygon-clipping code at all** — the "clipping" the naive
   approach would need is replaced entirely by a per-point classification, which is a handful of
   line-equation evaluations, not a geometry library.
2. **Handles every degenerate/adversarial input for free** — crossing lines, near-duplicate
   angles, wildly off-center lines, a count that doesn't match `requestedSliceCount` — all of these
   simply produce whatever distinct sign-tuples they produce; there is no special case to write for
   any of them (directly satisfying §2.2's "no line-crossing rejection needed" and the brief's
   "duplicate line" / "near-identical angle" test cases, §21).
3. **Is cheap enough for any phone**: at `GRID_RESOLUTION = 96`, roughly 7,000–7,500 points land
   inside the circle, each checked against at most 4 lines (8-slice case) — on the order of 30,000
   simple arithmetic comparisons, well under a millisecond on any real device. A lower resolution
   (e.g. 48) is available for a cheap live-preview recompute while the player is still dragging, if
   a future slice wants one; Phase 1 does not require a live preview (§7).
4. **Is trivially unit-testable**: a fixed grid means a given set of `CutLine`s always produces the
   exact same `pieceAreas` array, so "perfect 6," "off-center 6," "duplicate line," etc. are all
   ordinary deterministic assertions (§20).
5. Directly matches the brief's own explicit invitation to use this candidate, and its own
   "円形ピザに必要な最小実装を優先" instruction — this is the minimum geometry that still answers
   the real question (how equal are the resulting pieces), not the minimum that merely looks simple
   and then needs the full engine anyway once real input arrives (as C would).

**Note on dough shape:** the player's actual baked dough may be a D3A-distorted, non-circular
8-point radial shape (`logic/doughShape.ts`), not a perfect circle. **This design deliberately
scores CUT against the recipe's *ideal* circle (`DOUGH_CENTER`/`DOUGH_RADIUS`, unchanged constants
from `pizzaCoordinates.ts`), not the player's own distorted silhouette.** Rendering (§8) can still
draw the cut lines and the pizza's true rendered shape together — visual fidelity and scoring
geometry are independent concerns, exactly like Scoring 2.0's own Sauce component already scores
against `isInsideDough`'s fixed circle rather than the free-boundary dough shape
(`doughShape.ts`'s own header comment: "the fixed-circle `isInsideDough` ... remains what Scoring
2.0's `computeSauceMetrics` ... reads, unchanged"). This is not a new precedent — it is the same
existing one, applied to CUT.

### 4.3 Center accuracy

Per committed line, `distanceFromCenterOfLine = perpendicular distance from DOUGH_CENTER to the
chord`, normalized against `DOUGH_RADIUS` (0 = passes exactly through center, 1 = the worst
possible chord, i.e. barely grazing the rim tangentially). `centerAccuracy = 1 -
mean(normalizedDistance across all committed lines)`, 0–1.

---

## 5. CUT evaluation — the four signals

Per the brief's own instruction, all four are designed, none reduce to "just angle":

| Signal | Definition | Range |
|---|---|---|
| **Count correctness** | `1 - min(1, |actualPieceCount - requestedSliceCount| / requestedSliceCount)` where `actualPieceCount` is `computePieceAreas(...).length` (§4.2) — an emergent count from the geometry, never assumed | 0–1 |
| **Completeness** | `min(1, completedCutCount / requiredCutCount)` where `requiredCutCount = requestedSliceCount / 2` (§1.2/§3) | 0–1 |
| **Center accuracy** | §4.3 | 0–1 |
| **Piece-area uniformity (primary signal, per the brief's own emphasis)** | `1 - min(1, meanAbsoluteDeviation(pieceAreas) / idealPieceArea)`, where `idealPieceArea = circleArea / requestedSliceCount` — a piece that's twice the ideal size contributes as much deviation as one that's half, symmetric under- and over-sized penalties | 0–1 |

`CutEvaluation` (new pure type, `src/logic/cut/types.ts`):

```ts
interface CutEvaluation {
  requestedSliceCount: number;
  completedCutCount: number;
  actualPieceCount: number;
  pieceAreas: readonly number[];
  countCorrectness: number;   // 0-1
  completeness: number;       // 0-1
  centerAccuracy: number;     // 0-1
  uniformity: number;         // 0-1
  cutScore: number;           // 0-100, see §6
}
```

Computed once, by one pure function (`evaluateCut(lines, requestedSliceCount)`), at the CUT step's
own confirm action — mirroring `computeScoringV2`'s and `evaluatePizzaCompletion`'s own "one call
site, computed from the exact canonical data that was just committed" contract exactly. No
Reference-fixture-availability gate is needed (unlike Scoring 2.0's Margherita-only gate) — CUT's
evaluation is computable from `lines`/`requestedSliceCount` alone, for any recipe.

---

## 6. CUT score — weighting candidates

`cutScore = 100 * (wCount*countCorrectness + wComplete*completeness + wCenter*centerAccuracy +
wUniform*uniformity)`, weights summing to 1.

| | **A. Flat** | **B. Uniformity-heavy — recommended** | **C. Count-gated** |
|---|---|---|---|
| countCorrectness | 25 | 20 | *(gate, not a weight — see below)* |
| completeness | 25 | 20 | 30 |
| centerAccuracy | 25 | 10 | 15 |
| uniformity | 25 | **50** | 55 |
| Mechanism | plain weighted sum | plain weighted sum | `cutScore = countGateMultiplier * (weighted sum of the other three)`, `countGateMultiplier = 1` if `actualPieceCount == requestedSliceCount` else `0.6` |

**Recommended: B.** Rationale:

- **Uniformity is the signal the brief explicitly asks to be the primary one** ("最終的な piece
  area uniformity を主要評価にする"). A is flat and doesn't reflect that.
- **Count correctness and center accuracy are heavily correlated with uniformity in practice** —
  a player who cuts 3 lines reasonably close to center and evenly spaced will score well on all
  four simultaneously; count correctness and center accuracy mostly add *redundant* information on
  top of uniformity rather than independent signal, so giving them large independent weight (as A
  does) double-counts the same underlying skill. Lower, non-zero weight (20/10) keeps them as real
  contributors without letting them dominate.
- **C's hard gate is rejected for Phase 1** as too punishing for a first introduction to the
  mechanic — a player who draws 4 lines instead of 3 (creating 7-8 pieces instead of 6) has clearly
  engaged with the mechanic in good faith; multiplying their entire score by 0.6 for an off-by-one
  piece count contradicts the brief's own "多少悪くても悪印象を与えない" (don't make imperfect
  cutting feel bad) instruction. **Flagged as a candidate to revisit** if Human Feel testing (§21)
  finds count mismatches need stronger discouragement — the data shape (`CutEvaluation` above)
  supports switching to C's gate later with zero geometry changes.

All four weights (and the exact formula shape) are explicitly **provisional, tunable during Human
Feel** — matching this repo's own established convention for exactly this kind of first-pass
constant (`doughShape.ts`'s own `DOUGH_COMPLETION_THRESHOLD`/`STRETCH_SPIKE_MAX_DELTA` comments are
the precedent this design follows).

### 6.1 Time: never scored in Phase 1

Per the Cooking Steps SSOT's own Quality-primary/Time-secondary discipline (§22.6/§22.7) and its
explicit CUT timing/gesture-data separation contract: `cookingTiming.perStepElapsedMs.CUT` (already
available once Phase 1A-T ships, per that document) is recorded for future display/telemetry only.
**It is not an input to `cutScore` in Phase 1.** This design compares two options and picks the
first:

- **Recommended: no CUT-time bonus at all in Phase 1.** Simplest, cannot regress "quality primary"
  by construction (there is nothing to regress — the input doesn't exist yet), and matches this
  document's own §1's instruction to not build ahead of need.
- **Deferred candidate (a future slice, not Phase 1):** a small, additive, quality-gated CUT-pace
  bonus following `efficiency.ts`'s own already-established discipline exactly (a worse quality
  band always dominates a better time tier) — the same boundary the Cooking Steps SSOT already
  commits any future per-step time bonus to (§22.6). Not designed further here; flagged only so a
  future slice has a named landing spot rather than inventing its own rule.

---

## 7. Completion Gate — adopting the SSOT's own already-committed policy

The merged Cooking Steps SSOT has **already decided** this, not merely proposed it — its own §6
table states CUT's "Can fail completion?" as **No ("degrades score only")**, and §11 states
`requiredForCompletion` defaults to **`false` for CUT** (true only for FOLD/SEAL/EDGE_FILL, whose
failure modes are structural — an unfolded calzone genuinely isn't a calzone). This design does not
reopen that question; it adopts it unchanged, and states why doing so is also independently correct
for CUT specifically:

| | A. Score-only (adopted — matches SSOT §6/§11) | B. Extreme-incomplete-CUT-only failure | C. CUT quality gates completion |
|---|---|---|---|
| Aligns with merged SSOT | **Yes** | No — would require reopening §11's `requiredForCompletion: false` decision for CUT | No — same conflict |
| Matches "多少悪くても pizza 自体を FAILED にしない" instruction | **Yes, directly** | Partially — still fails a player who, say, drew zero lines by mistake, even though the dish itself (ingredients/sauce/bake) is fine | No |
| Player experience | A badly-cut pizza is still a pizza — disappointing cut score, never a wasted round | A player who skips CUT loses the whole round over one step, disproportionate to a low-stakes finishing action | Same, worse |

**Adopted: A.** A pizza with zero committed cuts still passes the Completion Gate as long as the
*dish itself* (ingredients/sauce/bake — the existing, unchanged gate) passes; it simply receives the
worst possible `cutScore` (§6). This is both what the SSOT already committed to and independently
the right call for a first introduction to a brand-new mechanic (Human Feel §21's own "やり直したく
なるか" check would fail immediately if a clumsy first attempt could invalidate an otherwise-good
pizza).

---

## 8. Visual / UX (390×844)

### 8.1 Layout

Reuses this repo's own already-solved PREPARE/BAKE layout patterns directly — no new layout
paradigm:

```
┌─────────────────────────────────┐
│ 🏠 ホーム              🪙 Pitz  │  <- unchanged app-header
├─────────────────────────────────┤
│  "6等分にカットしよう！"         │  <- .order-card-style instruction row (reused component)
├─────────────────────────────────┤
│                                   │
│         [ 300px pizza ]           │  <- unchanged .pizza-dough / PizzaStage, CUT-mode gesture
│      (cut lines + cutter icon)    │
│                                   │
├─────────────────────────────────┤
│  2 / 3 本                         │  <- small numeric readout (mirrors MissionHud's own style)
├─────────────────────────────────┤
│ [やり直す]   [カット完了 →]       │  <- .prepare-bake-bar-style fixed bottom bar, safe-area-aware
└─────────────────────────────────┘
```

No vertical scroll, same budget PREPARE/BAKE already proved works at this viewport (Human Feel
Fix 3's own fixed-bottom-bar solution, `App.css`'s `.prepare-bake-bar`, is reused verbatim in
structure — `position: fixed`, `max-width: 390px`, `env(safe-area-inset-bottom, 0px)` padding).

### 8.2 Guide-line visibility — comparison

| Option | Description | Verdict |
|---|---|---|
| 常時guide (always-on full guide) | Ideal N angles always drawn, full opacity | Rejected — the brief's own worry: trivializes the whole mechanic, nothing left to aim for |
| 最初だけguide (once-ever) | Full guide shown only the player's very first-ever CUT | Needs a new persisted "have I seen this" flag — extra save-schema-adjacent state for a one-time reveal; rejected for that cost alone |
| **薄いguide + 中心のみ持続 — recommended** | Full-opacity angle guide for the first few seconds of *each* CUT step, fading to just a low-opacity center-point marker afterward | **Recommended** — see §8.2.1 |
| 中心のみguide | Only ever a center marker, no angle hints at all | Plausible fallback if the fading version proves too complex; loses the "teach the ideal spacing" value on a player's first encounter |
| guideなし | No aid at all | Rejected as too punishing for a first introduction to a brand-new mechanic |
| 難易度で変更 | Guide strength tied to a difficulty setting | No difficulty setting exists anywhere else in this game today — would be a new, standalone concept invented just for CUT; rejected as scope creep for Phase 1 |

#### 8.2.1 Why the fading option, specifically

This is not a novel mechanic — it reuses an **already-shipped, already-proven precedent in this
exact codebase**: `BakeOverlay`'s own Guide-fade (`logic/bakeGuideFade.ts`'s `computeGuideOpacity`,
`GUIDE_FADE_END_S`) already does precisely "show the helpful answer clearly for the first few
seconds of this attempt, then fade it to nothing, without gating it behind any persisted
first-time-only flag." CUT's guide reuses the same `computeGuideOpacity`-style curve, keyed off
`cookingTiming`'s own per-step elapsed time (§22.2 of the Cooking Steps SSOT — `perStepElapsedMs`'s
in-progress `stepStartedAt`, already designed to exist), fading the angle-guide lines to 0 over a
few seconds while a low-opacity center-point marker (not fading) remains for the whole step. This
directly answers the brief's own "guide だけだとゲーム性が弱まる" concern: full guidance is
available long enough to *teach* the ideal spacing on every attempt (never punishing an unfamiliar
player), but the actual scored cut always happens with only a faint center hint, preserving real
skill expression. No new persisted state, no new fade-curve math — the exact existing pattern,
applied to a new step.

### 8.3 Cut trail / cutter icon / finger occlusion

- **In-progress drag preview:** reuses `PizzaStage`'s existing `.pizza-paint-trail` SVG-stroke
  mechanism (already rendered live during a sauce-paint drag) — for CUT, the same rendering path
  draws a straight line from the gesture's start point to the current pointer position (rather than
  a freehand path), giving a real-time preview of the pending cut before it commits.
- **Committed lines:** unlike the paint trail (which fades after commit), each committed
  `CutLine` renders as a **permanent** thin dark line on top of the dough for the rest of the CUT
  step — plain inline SVG in the same 0–100 dough-percent coordinate space every other overlay
  already uses (`smoothDoughShapeForDisplay`'s own convention). No image asset needed.
  Piece-separation animation (a subtle per-wedge offset once cutting completes) is explicitly
  **deferred to CUT Phase 4 / Human-Feel tuning** (§20) — Phase 1's own visual can ship as a flat
  line overlay with no separation, matching this repo's own "ship the correct-but-plain version
  first, human-feel-tune the polish second" pattern (the exact same order the M3A Bake Judgment and
  Phase 4A-1B iPhone Human-Feel series already followed for BAKE/sauce).
- **Cutter icon:** an emoji (`🔪`), matching this repo's consistent "emoji over custom art" choice
  for every other UI affordance (`🔥` bake flame, `🏠` home, `🍕` free-play) — follows the pointer
  during drag, offset ~24px above the fingertip in screen space so the icon itself is never
  underneath the finger that's occluding the view. This single offset is the entire answer to
  "指で隠れる問題" — no new architecture, a CSS transform on an already-tracked pointer position.
- **Sound/haptic hook:** a call-site placeholder only (e.g. an `onCutCommitted` callback CUT Phase
  2's reducer wiring can fire) — no actual audio/haptic asset or API call is part of this design;
  this repo has no existing sound system to hook into today, and inventing one is out of scope for
  a Fresh Design.

### 8.4 Undo / cut limit

- **Undo: last-cut-only, recommended.** One "1本戻す" button removes only the most recently
  committed line. Rejected: unlimited undo/redo history (real state complexity for no scoring
  benefit — cuts are order-independent for every evaluation signal in §5, so "undo the 2nd cut but
  keep the 4th" is never a meaningful operation) and no-undo-at-all (directly contradicts "多少ズレ
  ても気持ちよく切れる設計を優先" — a single bad first cut with no recovery on a 6-slice pizza would
  feel punishing on the very first attempt at a brand-new mechanic).
- **Cut limit:** `requiredCutCount + 2` (i.e. 5 attempts allowed for a 3-required 6-slice cut),
  not a hard `requiredCutCount` ceiling — gives slack for an intentional redraw-via-undo-then-redraw
  cycle without feeling gated, while still bounding the interaction. Exact slack value flagged
  Human-Feel-tunable (§21), same discipline as every other numeric constant in this design.
- **"カット完了" CTA enabled state:** mirrors the existing `nextStepReady`/`doughShapeComplete`
  pattern (`GameScreen.tsx`) — disabled until `completedCutCount >= requiredCutCount`, enabled
  (never forcibly auto-advanced) once met, exactly like DOUGH's own size-completion gate today.

### 8.5 Safe area / accessibility

- `touch-action: none` on the CUT-active dough element, matching `.pizza-dough--interactive`'s
  existing rule (prevents page-scroll hijacking a drag, already solved).
- Committed-line color is dark against the crust regardless of bake state (raw/perfect/burnt all
  already have distinct backgrounds, `App.css`'s `.pizza-dough--raw/--perfect/--burnt`) — contrast
  checked against all three at implementation time, not color-coding any *meaning* (a line is just
  a line, no red/green correctness color is shown live — per "誤操作/正確すぎる判定" concerns,
  showing live correctness feedback color would itself be a second, unwanted guide channel).
- CTA/progress readout hit targets match the existing `.cta-button`/`.secondary-button` sizing
  already used by every other bottom bar in this game — no new smaller-than-established tap target
  introduced.
- `prefers-reduced-motion`: the (Phase 1-deferred, §8.3) piece-separation animation, once built,
  must respect it, same as any future animation in this codebase should; no motion at all ships in
  Phase 1's own scope.

---

## 9. Step Timing integration

Adopts the Cooking Steps SSOT's §22 architecture unchanged. Concretely for CUT:

- **`activeStep = "CUT"` / `stepStartedAt`** set the moment `makingStep` enters `"CUT"` (the exact
  same `CONFIRM_MAKING_STEP`-driven finalize-and-restart mechanism every other step already gets
  once Phase 1A-T ships — no CUT-specific timing code).
- **`perStepElapsedMs.CUT`** finalized the moment CUT's own confirm action fires (§13) — available
  for a future RESULT display (e.g. "カット: 4秒") but **not consumed by `cutScore`** (§6.1).
- **FREE:** no hard timeout, ever — a player may spend as long as they like drawing/undoing lines.
- **Lunch Rush:** `MissionClock` remains the *sole* enforced time limit. CUT introduces **no
  second timer** — not visually, not as an enforcement mechanism. If a Lunch Rush round ever
  reaches a CUT-enabled recipe (a rollout decision, §18, not this phase's), the seconds spent
  cutting simply count against the existing single mission countdown exactly like every other
  PREPARE/BAKE second already does — no new dual-timeout risk, matching SSOT §22.4/§22.12 exactly.
- **Future Challenge Mode:** `CookingProfile.stepTimeLimits?.CUT` stays exactly as reserved-but-
  inert as every other step's entry in that same optional record — no CUT-specific carve-out.

---

## 10. Persistence

**No save-schema change.** `PersistentSaveV2` never serializes `GameState`/`PizzaState` today (per
both this repo's own `persistence.ts` and the Cooking Steps SSOT §15's independent confirmation) —
CUT's own working data (`cutLines: CutLine[]`, the in-progress drag preview, `CutEvaluation`) is
exactly as transient as `sauceDeposits`/`toppings` already are, discarded at round end by the same
`buildOrderState`-style reset every other per-round field already goes through.

**Future extension boundary (not designed, flagged only):** if a future RESULT/Dex-"MY BEST"/
"Recent Works" feature ever wants to redraw a completed pizza's actual cut lines, it would need its
own new, additively-absent-by-default `PersistentSaveV2` field storing just the small
`readonly CutLine[]` coordinate array (a handful of numbers per line, no image blob) — following
the exact precedent `starterGrantClaimedRecipeIds` already set for extending the save shape without
a version bump (`persistence.ts:121-134`). **This design does not propose image/blob storage of any
kind** — a future replay is drawn live, from stored coordinates, using the same rendering this
document already designs (§8.3), never a rasterized snapshot.

---

## 11. Data boundary — who owns what

| Owner | New/changed shape | Lifetime |
|---|---|---|
| `src/data/cookingProfiles.ts` (Cooking Steps SSOT §7, extended here) | `CookingProfile.cutConfig?: CutConfig` (§1.2) | Static recipe data |
| `src/state/pizzaState.ts` (or a sibling transient shape alongside it) | `cutLines: readonly CutLine[]` — committed lines only, same "committed canonical, mirrors `toppings`" pattern | Per-round, transient |
| `src/state/gameReducer.ts` `GameState` | `phase: "POST_BAKE"`, `makingStep: "CUT"` (already-widened union per Cooking Steps §8); `cutResult: CutEvaluation \| null` — computed once at CUT's own confirm action, mirrors `scoringV2Result`/`completion`'s existing "compute once, store, never live-recompute" contract | Per-round, transient, `null` until confirmed |
| `src/logic/cut/types.ts` (new) | `CutLine`, `CutEvaluation` (§5) | Pure types |
| `src/logic/cut/geometry.ts` (new) | `computePieceAreas`, chord-side classification (§4.2) | Pure functions |
| `src/logic/cut/evaluation.ts` (new) | `evaluateCut(lines, requestedSliceCount): CutEvaluation` (§5/§6) | Pure function, one call site |
| `GameState.cookingTiming.perStepElapsedMs.CUT` (Cooking Steps SSOT §22.2, owned there) | *read-only* from CUT's own display/future-bonus code | Per-round, transient |

`CookingProfile` decides *whether* CUT happens and with what `requestedSliceCount`.
`PizzaState`/`GameState` hold *what actually happened this round*. `src/logic/cut/*` is pure
evaluation math with no knowledge of React, reducers, or timing. This split mirrors the Scoring
2.0 / Completion Gate / Step Timing split the Cooking Steps SSOT already established elsewhere in
this codebase — CUT introduces no new architectural pattern, only new data inside existing ones.

---

## 12. A concrete finding: `REGISTER_TO_DEX` orchestration must move

Tracing the *current* code (unchanged since the audited SHA) surfaces a real hand-off detail the
Cooking Steps SSOT's own abstract "`POST_BAKE` skipped straight through to RESULT" description
doesn't spell out at the call-site level, and CUT Phase 2 (§20) must get right:

**Today**, `App.tsx`'s `handleConfirmBake` dispatches `CONFIRM_BAKE` and `REGISTER_TO_DEX`
back-to-back, synchronously, in the same handler — relying on `CONFIRM_BAKE` landing the round
directly on `phase: "RESULT"` so `REGISTER_TO_DEX`'s own `if (state.phase !== "RESULT" ...)
return state;` guard passes on the very next dispatch. Once `CONFIRM_BAKE` can instead land on
`phase: "POST_BAKE"` (any recipe whose profile has a post-BAKE step), that same immediate
`REGISTER_TO_DEX` call would silently no-op (the guard correctly rejects it) — and **nothing else
in the current code would ever call it again**, since it has exactly one call site.

**Required for CUT Phase 2, stated here so it isn't rediscovered the hard way mid-implementation:**
the action that finally leaves `POST_BAKE` for `RESULT` (CUT's own "カット完了" confirm, or
whichever step is last in a given profile) must trigger the same `REGISTER_TO_DEX` (FREE) /
mission-serve (`handleMissionServeNext`'s equivalent, Lunch Rush) orchestration `App.tsx` currently
fires immediately after `CONFIRM_BAKE`. Concretely: `App.tsx`'s post-bake-completion call site
needs to move from "always fires the instant `CONFIRM_BAKE` returns" to "fires the instant the
round *actually* reaches `RESULT`" — which is immediate (zero profile steps, all 15 existing
recipes, zero behavior change) or after `POST_BAKE`'s last step confirms (any CUT-enabled recipe).
This is a **mechanical relocation of one existing call site**, not a new registration rule, a new
gate, or a new side effect — but it is exactly the kind of easy-to-miss detail a Fresh Design
should name explicitly rather than leave for a mid-implementation surprise.

---

## 13. Lunch Rush interaction — a scoped rollout risk, not an engine change

Because `CookingProfile` is keyed by `recipeId`, not by mode, a CUT-enabled recipe's profile
applies identically whether that round is FREE or Lunch Rush — Mission is, per the SSOT's own
framing, "a thin outer wrapper" around the same round machinery, and this design does not propose
any CUT-specific carve-out of that (per the brief's own "CUT専用の例外的 state machine を作らない"
instruction). Two things follow from that, one architectural (already handled) and one product
(flagged, not solved here):

- **Architectural:** §9 already establishes that CUT introduces no second timer and never gates a
  step in either mode — so a Lunch Rush round reaching a CUT-enabled recipe is not a *timing*
  regression by design.
- **Product/rollout, flagged:** CUT interaction still costs real wall-clock seconds inside Lunch
  Rush's single fixed-duration `MissionClock`, exactly like every other PREPARE/BAKE second
  already does — but CUT is a *brand-new* few seconds no recipe charged before. Whether that's an
  acceptable time cost inside a 180-second run is a real Human-Feel/balance question this document
  does not have data to answer yet. **Recommendation:** CUT Phase 1–3 (§20) ship with **zero real
  recipes** carrying a CUT-enabled profile — the mechanic is built and fully tested in isolation
  first (a temporary dev-only profile override, or direct reducer/component tests, exercise it).
  **Activating** CUT on any real recipe (which, per Cooking Steps SSOT §16, is the natural
  "mid-tier, teach broadly" first new operation — i.e. likely to reach *many* recipes eventually,
  including ones Lunch Rush already rotates through) is its own explicit, reviewable decision in
  CUT Phase 4 (§20), made with real Lunch-Rush-time-budget verification data in hand, not assumed
  away here.

---

## 14. Scoring 2.0 integration

The Cooking Steps SSOT has already designed the *general* mechanism any new step's score
contribution should use (§10 of that document): core score (unchanged 52/16/12/20) + an additive,
clamped-to-100 per-step bonus. That mechanism is available to CUT the moment it's wired on — but
this design recommends **not** wiring it on in Phase 1, for a CUT-specific reason the general SSOT
discussion doesn't need to consider for a single-recipe step like FOLD: **CUT is explicitly
near-universal** (Cooking Steps SSOT §16/§19: "no catalog mechanic maps to CUT — it's cross-cutting,
not a per-recipe differentiator"), so the day it activates on any real recipe (§13), it is likely
to eventually activate on *most* recipes — unlike FOLD (Calzone only) or EDGE_FILL (Stuffed Crust
only), flipping CUT's score contribution on is not a one-recipe change, it is eventually a
"every pizza's visible total score composition just changed" change.

| | A. Standalone display, never summed | B. Re-split existing 100pts to include CUT | C. Existing 100 + CUT bonus (the SSOT's own general mechanism, activated now) | **D. Standalone in Phase 1; integrate via C in a later Scoring 3.0 slice — recommended** |
|---|---|---|---|---|
| Existing 15 recipes' score compatibility | Perfect — `state.score.total` byte-identical, always | **Rejected outright** — re-splitting weights changes every existing recipe's score meaning, exactly the regression the Cooking Steps SSOT §10 itself already rejected this option for | Perfect by construction (clamped, additive) *for recipes without CUT* — but the moment CUT activates broadly, most players' visible total score composition changes at once | Perfect in Phase 1 (identical to A); the *timing* of ever integrating is deferred to a dedicated, separately-reviewed slice |
| Dex BEST / Lunch Rush ranking / Pitz reward stability | Untouched | Broken (same rejection as B) | Untouched for CUT-free recipes; shifts the moment CUT activates anywhere | Untouched through all of Phase 1 |
| Matches "今回は変更しない" instruction for Scoring 2.0 | Yes | No | Technically yes (additive), but changes *visible outcomes* broadly once activated — a bigger practical blast radius than the formula change itself suggests | **Yes, most conservatively** |
| Engineering cost to eventually integrate | Low — flip on the already-designed SSOT §10 mechanism later | N/A (rejected) | N/A (this row *is* that mechanism) | Low — identical to C, just sequenced later, after CUT's own Human Feel (§21) is verified |

**Recommended: D.** Phase 1 computes and *displays* `cutScore` (§6) independently — in the RESULT
screen (a small CUT sub-score/badge, alongside the existing Scoring 2.0 breakdown) and in the
existing `ScoringV2DebugPanel`-style debug surface — but **never adds it into `state.score.total` /
`ScoringV2Result.totalScore`**. Dex BEST, star thresholds, Lunch Rush ranking, and Pitz reward all
keep reading exactly what they read today, for every recipe, through the entirety of CUT Phase 1–4.
A later, separately-scoped **Scoring 3.0** slice is the deliberate point where CUT's bonus flips on
via the SSOT's own already-designed §10 mechanism — by which point real Human Feel data (§21) and a
real rollout decision (§13/§18) both exist to inform *how* it should weigh in, rather than guessing
now. This is the user's own "D" candidate, and this Fresh Design adopts it as the recommendation,
not merely one option among several.

---

## 15. Testing strategy

### 15.1 Unit — geometry (`src/logic/cut/geometry.ts`)

- Perfect 4 / perfect 6 / perfect 8 (evenly-spaced, through-center lines) → `pieceAreas` all
  within a small tolerance of `idealPieceArea`.
- Off-center lines (still full chords, deliberately not through `DOUGH_CENTER`) → asymmetric but
  still-summing-to-`circleArea` piece areas.
- Duplicate line (near-identical angle to an existing committed line) → rejected pre-commit by the
  minimum-angular-separation gate (§2.2), never reaches the evaluator with a degenerate near-zero
  piece.
- Near-identical-but-not-quite-duplicate angle (just above the rejection threshold) → produces one
  correctly-tiny sliver piece, `pieceAreas.length` reflects it, uniformity penalizes it accordingly
  — no special-case code path exercised, proving §4.2's "handles degenerate input for free" claim.
- Crossing lines (two chords that cross well off-center) → correct region count/areas, still
  summing to `circleArea`.
- `computePieceAreas([])` (zero lines) → a single region, the whole circle.

### 15.2 Unit — evaluation (`src/logic/cut/evaluation.ts`)

- `evaluateCut` for each of §15.1's fixtures → correct `countCorrectness`/`completeness`/
  `centerAccuracy`/`uniformity`/`cutScore`, pinned against the recommended weighting (§6, Option B).
- `requiredCutCount` derivation for `requestedSliceCount` 4/6/8 → 2/3/4 respectively.
- Center-distance normalization at the exact `DOUGH_RADIUS` boundary (a chord tangent to the rim)
  → `centerAccuracy` contribution clamps to 0, never negative or `NaN`.

### 15.3 Reducer / state (once CUT Phase 2 wires the reducer)

- CUT step entered (`makingStep` transitions into `"CUT"` inside `POST_BAKE`) — `cutLines: []`,
  `cutResult: null`.
- Add line (a valid pointerdown→pointerup pair) — `cutLines` grows by one, matches §2.2's clamp
  behavior exactly.
- Reject: degenerate line (below minimum angular separation, §2.2) — `cutLines` unchanged.
- Undo — removes exactly the most recent line, no others.
- Cut-limit reached — further `ADD_CUT_LINE`-equivalent dispatches are no-ops (mirrors
  `PURCHASE_INGREDIENT`'s own "failed transaction returns state unchanged" pattern).
- CUT complete (confirm) below `requiredCutCount` — rejected (CTA itself is disabled per §8.4, but
  the reducer-level guard is the real backstop, matching every other action's "never trust the UI
  alone" discipline already established, e.g. `COMMIT_SAUCE_DISPENSE`'s own phase/step re-check).
- CUT complete at/above `requiredCutCount` — `cutResult` computed once, `phase` transitions to
  `RESULT`, and **§13's `REGISTER_TO_DEX`/mission-serve orchestration actually fires** (the finding
  from §12 — a dedicated regression test for exactly this, since it is the one detail most likely
  to be silently missed).
- Retry / recipe change (`RETRY_SAME_RECIPE`/`SELECT_RECIPE`) — `cutLines`/`cutResult` reset to
  empty/`null`, same "fresh round" discipline every other per-round field already gets.
- Lunch Rush `MISSION_NEXT_ORDER` — same reset; and (once any CUT-enabled recipe is ever
  Activated, §13) a regression test confirming `missionScore`/`LunchRushServeRecord` stay
  byte-identical to a CUT-free round's own shape, per §14's "never summed into total" guarantee.
- A profile with zero post-BAKE steps (all 15 existing recipes) — `CONFIRM_BAKE` still lands
  directly on `RESULT` with **zero observable difference**, the single most important regression
  test this whole feature needs, mirrored from Cooking Steps Phase 1A's own top-line acceptance
  criterion.

### 15.4 UI (component-level, once CUT Phase 2/3 build real components)

- 390×844 and 360×800 — no horizontal/vertical overflow, `.prepare-bake-bar`-style bottom bar
  clearance verified exactly like every prior PREPARE/BAKE Human-Feel pass already checks.
- Touch drag — synthetic `pointerdown`/`pointermove`/`pointerup` at real rim coordinates commits a
  line; a `pointercancel`/lost-capture mid-drag commits nothing (mirrors the existing DOUGH-stretch/
  sauce-dispense discard tests exactly).
- Multi-cut — three sequential drags each commit independently; a 4th beyond the cut limit (§8.4)
  is rejected with the button itself reflecting a disabled/limited state, not a silent failure.
- CTA visibility/enabled-state at 0, `requiredCutCount - 1`, and `requiredCutCount` lines.
- Guide-fade visibility over elapsed CUT-step time, mirroring `bakeGuideFade.test.ts`'s own
  existing test shape for `computeGuideOpacity`.

### 15.5 Future E2E scope (not this phase)

A full BAKE→POST_BAKE(CUT)→RESULT Playwright walkthrough at 390×844, once a real recipe is
Activated (§13/§18) — mirrors this repo's own existing manual-verification convention for every
prior Human-Feel slice (screenshot capture at the authority + secondary viewport, no console
errors, no overflow). Not required before CUT Phase 1–3's own unit/component test coverage lands,
since no real recipe exercises the path end-to-end until Activation.

---

## 16. Human Feel Gate (mandatory before CUT Phase 4 completes)

Per the brief's own instruction, mathematically-correct evaluation is not the bar — a dedicated
verification pass, after CUT Phase 1–3 land, checks (at minimum):

- 指で狙いやすいか (is the target easy to aim for with a real thumb, at 300px dough / 45–90°
  wedges)
- 切った感触があるか (does a commit read as a satisfying "cut," not just a line appearing)
- 線が見やすいか (line contrast against raw/perfect/burnt crust backgrounds, §8.5)
- 6等分が難しすぎないか (is the chosen first slice count, §3.2, actually well-calibrated — not
  merely theoretically reasonable)
- やり直したくなるか (does a bad cut invite a retry via undo, §8.4, rather than feeling like a
  wasted attempt)
- 成功時に気持ちいいか (does a good cut/full completion feel rewarding — the deferred
  piece-separation visual, §8.3, is a strong candidate to promote from CUT Phase 4 if this check
  fails without it)
- 既存の BAKE→RESULT より楽しいか (does adding CUT make the overall cooking loop better, not just
  longer)
- **Added by this audit:** Lunch-Rush-specific — does CUT's added time cost (§13) feel acceptable
  inside a real 180-second mission run, checked with real device/Playwright timing data before any
  recipe is Activated for Mission play.

A CUT Phase 4 that passes every geometry/reducer/UI test in §15 but fails this gate is **not**
considered done — matching the brief's own explicit framing that correctness and fun are two
independent bars, both required.

---

## 17. Dependency on Cooking Steps Phase 1A / 1A-T — explicit, not optional

This design **requires**, in order:

1. **Cooking Steps Phase 1A** (`CookingProfile`/`getCookingProfile`, `MakingStep`/`GamePhase`
   widening including `POST_BAKE`, `MakingStepTabs` generalization) — CUT's own `makingStep: "CUT"`
   value and the `POST_BAKE` phase it lives in do not exist before this lands.
2. **Cooking Steps Phase 1A-T** (per-step `activeStep`/`stepStartedAt`/`perStepElapsedMs` on
   `CookingTimingState`) — §9's guide-fade timing (§8.2.1) and any future CUT-pace signal (§6.1)
   both key off `perStepElapsedMs.CUT`, which this instrumentation slice is what creates.

**Building CUT's gesture/geometry/UI ahead of, or bypassing, Cooking Steps Foundation is explicitly
rejected** — not merely deprioritized. Doing so would recreate exactly the hardcoded, one-off
fixed-flow problem the Cooking Steps audit exists to prevent (its own §20 says this outright: "any
future 'Pizza Cutting 1.0' work should build on this foundation ... not as a one-off hardcoded
post-BAKE phase"). CUT Phase 1 (§20)'s own geometry/evaluation math (§4-§6) has no dependency on
Phase 1A/1A-T at all (it's pure functions over `CutLine[]`) and *can* be built and fully unit-tested
in parallel/ahead of time — but CUT Phase 2 (reducer/UI wiring) cannot land before Phase 1A, and
CUT Phase 2's guide-fade/timing-display pieces cannot land before Phase 1A-T.

---

## 18. Implementation roadmap (2–3 hour slices)

| Slice | Scope | Depends on |
|---|---|---|
| **CUT Phase 0 — Fresh Design** | This document + its Result Report. | none (this task) |
| **CUT Phase 1 — Geometry + transient state** | `src/logic/cut/{types,geometry,evaluation}.ts`, full unit coverage (§15.1/§15.2). No reducer/UI wiring, no recipe activated. | Cooking Steps Phase 1A (types only — `MakingStep`'s `"CUT"` literal); can be authored in parallel with 1A/1A-T landing |
| **CUT Phase 2 — Touch UI + `POST_BAKE` integration** | `PizzaStage` CUT-mode pointer handling (§2.2, reusing existing architecture), reducer actions (add line / undo / confirm), the `REGISTER_TO_DEX`/mission-serve orchestration relocation (§12), bottom bar UI (§8.1/§8.4). Still zero recipes activated — exercised via a dev-only profile override + direct tests. | CUT Phase 1, Cooking Steps Phase 1A (full) |
| **CUT Phase 3 — Evaluation + Result UI** | `CutEvaluation`/`cutScore` display (standalone, §14 Option D), CUT debug panel (mirrors `ScoringV2DebugPanel`), RESULT screen CUT badge. Guide-fade visual (§8.2.1) — needs Phase 1A-T's `perStepElapsedMs.CUT`. Still standalone score only. | CUT Phase 2, Cooking Steps Phase 1A-T |
| **CUT Phase 4 — Human Feel tuning + Activation** | Tune every provisional constant (§2.2/§6/§8.4/§8.2.1) against real device/Playwright verification; run the full Human Feel Gate (§16), including the Lunch-Rush-time-budget check (§13); make the explicit product decision of which real recipe(s) first carry a CUT-enabled `CookingProfile` entry. This is the slice that turns CUT from "built and tested in isolation" into "actually playable." | CUT Phase 3 |
| *(future, separately scoped, not part of this roadmap)* **Scoring 3.0 integration** | Flip on the Cooking Steps SSOT's own already-designed §10 core+bonus mechanism for CUT. | CUT Phase 4, real Human Feel + rollout data |
| *(future, separately scoped)* **Lunch Rush CUT order-conditions** ("6等分で！" etc.) | Per Cooking Steps SSOT §17 — an additive `Order.requiredCutPieces?` field read against `CutConfig`. | Scoring 3.0 integration, a real Lunch Rush CUT rollout |

Each slice above independently regression-tests against the other three (CUT Phase 2 doesn't touch
Cooking Steps' own zero-behavior-change guarantee for CUT-free recipes; CUT Phase 3 doesn't touch
`state.score.total`; CUT Phase 4 doesn't touch geometry/evaluation math, only constants and
rollout) — matching the Cooking Steps SSOT's own migration-strategy discipline (§18 of that
document) applied one level down, to CUT specifically.

---

## 19. Explicit non-goals (this document)

- No production code change of any kind ships in this task.
- No Scoring 2.0 weight change, star-threshold change, Completion Gate behavior change, Economy/
  Progression change, recipe-ingredient change, Inventory/Shop change, Lunch Rush scoring change,
  Firebase Ranking change, or save-schema bump.
- No Firebase Production Connection (#121) change or merge.
- No general-purpose computational geometry engine — §4.2's grid-sampling approach is the
  deliberate alternative to building one.
- No 4/8-slice UI or content shipped in Phase 1 (§3.2) — only the data field (`CutConfig`) that
  makes them free later.
- No CUT-pace scoring bonus (§6.1) — a named future slice, not designed further here.
- No Scoring 3.0 integration, no Lunch Rush CUT order-conditions (§18's two future rows) — flagged
  as the eventual destinations this design's data shapes already support, not built now.
- No sound/haptic asset or API integration (§8.3) — a call-site placeholder only.
- No image/blob persistence of any kind (§10).
- No Challenge Mode, no per-step hard timeout in FREE or Lunch Rush — inherits the Cooking Steps
  SSOT's own §22.5/§22.12 restriction unchanged; CUT introduces no exception to it.
