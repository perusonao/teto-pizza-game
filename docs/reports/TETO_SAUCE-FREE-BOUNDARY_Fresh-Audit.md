# Teto Pizza Game — Sauce Free Boundary — Fresh Audit

**Type:** Read-only Fresh Audit (Phase 0), from fresh `origin/main`.

- **Audited SHA:** `ceaa78a340362d06a18700251afae9c969df96c9` (merge of PR #65, confirmed via
  `git fetch origin main` + `git rev-parse origin/main` at session start; working tree clean,
  branch already at this SHA).
- **Scope:** sauce (tomato/pesto/olive-oil) painting only. Cheese/topping free placement is a
  separate, already-tracked item (Issue #37 M2) and is not touched here.

## 0. Starting-point confirmation

- `origin/main` HEAD == `ceaa78a3...` == the PR #65 merge commit (Issue #33 D3A reversible dough
  shaping). Confirmed via `git log origin/main -5 --oneline`.
- Working tree clean, session branch `claude/sauce-free-boundary-game-s0i5cs` already at this SHA
  (no rebase needed).
- Issue #37 (parent Making Game 2.0 roadmap) and `docs/PROJECT_HANDOFF.md` both read fresh; their
  own "Free-boundary dough/sauce" candidate (Issue #37's 2026-09-18 Human Feel expansion note) is
  the direct source of this task.

## 1. Files audited

- `src/logic/pizzaCoordinates.ts` — canonical dough coordinate space, `isInsideDough`/`clampToDough`.
- `src/logic/sauceQuantity.ts` — dispense-tick timing/amount model (no coordinates at all).
- `src/logic/sauceDispenseController.ts` — per-session pointer-path → tick-deposit state machine.
- `src/logic/sauceField.ts` — the 16x16 density grid, `SauceMetrics` (quantity/coverage/evenness/
  overflow/edge), and the RGBA pixel renderer the heatmap canvas draws from.
- `src/logic/sauceEvaluation.ts` — player-facing ◎/○/× tiers, reads `SauceMetrics` only.
- `src/logic/scoringV2/sauceComponent.ts` — Scoring 2.0's authoritative Sauce sub-score, reads
  `SauceMetrics` only.
- `src/logic/doughShape.ts` — Issue #33 D1/D2/D3A's 8-point radial dough model.
- `src/components/PizzaStage.tsx` — pointer gesture handling, dispense session wiring, the heatmap
  canvas draw effect, dough-shape clip-path rendering.
- `src/App.css` — `.pizza-dough`/`.pizza-sauce-layer`/`.pizza-sauce-heatmap`/`.pizza-paint-trail`
  geometry and clipping.
- `src/state/pizzaState.ts` / `src/state/gameReducer.ts` — `SauceDeposit`/`isValidSauceDepositBatch`,
  `COMMIT_SAUCE_DISPENSE`.
- `src/data/recipeSauceProfiles.ts`, `src/data/ingredients.ts` — confirmed tomato/pesto/olive-oil
  all share `placement: "spread"` and the same dispense/heatmap gesture path (no per-ingredient
  branch in `PizzaStage.tsx` beyond color/oil-specific CSS class).

## 2. Where does "can't paint outside the correct range" actually happen?

The task asks to classify this into (A) input discards it, (B) state keeps it but render clips it,
or (C) scoring ignores it. **The answer is (B) — and only the render layer, not the state layer,
and only for the visible "real sauce" paint, not the underlying data.**

### A. Input stage — not the cause (for an in-progress stroke)

- `PizzaStage.handlePointerDown` (line 466-472) does gate the **start** of any gesture (dough or
  sauce) on `isInsideDough(dough.x, dough.y)` — a stroke cannot *begin* outside the dough's own
  bounding circle at radius 48.
- Once a sauce dispense session has started, `processMovePoint` (line 533-566) records **every**
  subsequent pointer position into `SauceDispenseController.move()` (line 561-564), with **no**
  `isInsideDough`/`clampToDough` filter at all: the raw `dough.x`/`dough.y` (which can be far
  outside 0-100, if the pointer drags off the whole element while still captured) is passed
  straight through. `SauceDispenseController.step()`'s tick loop then deposits at exactly that
  interpolated position. **Input does not discard or clamp overshoot during an active stroke.**

### B. State stage — not the cause; state already carries full overshoot data

- `SauceDeposit` (`src/state/pizzaState.ts`) is explicitly documented as "dough-percent
  coordinates, which may fall outside the dough circle." `isValidSauceDeposit`/
  `isValidSauceDepositBatch` only require finite `x`/`y`/positive `amount` — **no boundary check
  at all**. `COMMIT_SAUCE_DISPENSE` (`gameReducer.ts` line 338-364) stores every deposit exactly
  as received.
- `computeSauceMetrics` (`sauceField.ts` line 251-294) already **conserves** every deposit's full
  `amount` by splitting it continuously between `quantity` (inside-dough share) and
  `overflowAmount` (the complement) via `insideDoughFraction`, and independently computes
  `edgeAmount`/`edgeRatio` (how much is beyond the smaller `SAUCE_TARGET_RADIUS`, the "ideal"
  ring). **Overshoot is not discarded or ignored in state — it is already a first-class, named
  quantity**, dating back to a "Phase 4A-1A" prototype and Codex Broad Review "MUST FIX 5"
  (Overflow Boundary).

### C. Render stage — this is where overshoot currently becomes invisible

Two independent facts combine to make overshoot practically invisible to the player, even though
the data behind it is fully intact:

1. **`sauceFieldToRgbaPixels`** (`sauceField.ts` line 455-475) only ever writes a pixel for a grid
   cell where `isCellInsideDough(row, col)` is true — a **fixed circle at `DOUGH_RADIUS` (48)**,
   unconditionally, regardless of how the deposit's own weight was computed. Any cell outside that
   fixed circle is left fully transparent. This is the actual "real sauce" visual (the smoothed,
   colored heatmap) — it is **hard-clipped to a circle**, which is exactly the "正解範囲外には塗れ
   ない" behavior the task describes.
2. The **only** visual acknowledgment of overshoot today is a separate, small (`r=3` canvas px),
   faint (`alpha ≤ 0.55 × overflowFraction`) dot drawn per-deposit in `PizzaStage.tsx`'s heatmap
   effect (line 866-881), using the *fixed-circle* `insideDoughFraction`. It is easy to miss and
   reads as a mark, not as "sauce that spread past the edge."
3. `.pizza-sauce-heatmap`'s own CSS (`App.css` line 2196-2217) is **not** clip-path'd to the dough
   circle (confirmed by its own comment: "Not clip-path'd to the dough circle so the faint
   overflow dots it also draws can still show just past the rim") — so nothing in CSS is
   responsible for the clipping. The clipping is entirely inside `sauceFieldToRgbaPixels`'s own
   per-cell `isCellInsideDough` test.
4. The separate, older flat-fill layer, `.pizza-sauce-layer` (`App.css` line 329-356,
   `PizzaStage.tsx` line 950-959), is real dead code for actual gameplay today: it only renders
   when `!isFieldSauceContext` (no committed deposits **and** no active session), but every sauce
   ingredient (`placement: "spread"`) always starts a dispense session at `pointerdown`
   (`wantsDispenseSession = isPaintMode`, line 501), so `isFieldSauceContext` is true from the
   first tick onward. Its own `sauce-spread` keyframe animation ends at `clip-path: circle(150%
   ...)` (effectively unclipped) — it was never the source of the hard boundary either.
5. `scoreSauceComponentV2`/`evaluateSauceForPlayer`/Prototype Metrics all read `SauceMetrics`
   only, i.e., the exact same conserved, continuous inside/overflow/edge split already described
   in §B — **scoring never discards or additionally clips overshoot**; it already degrades
   gracefully via `edgeRatio`/`overflowRatio`/coverage-vs-reference tolerance bands. Category (C)
   from the task ("scoring silently ignores it") does not apply.

### Root cause, one sentence

**Category B/C boundary, narrowly at the render layer only**: state and scoring already treat
overshoot as continuous, conserved data; only `sauceFieldToRgbaPixels`'s hard-coded
`isCellInsideDough` (a fixed circle, radius 48) prevents the *visible* sauce from ever being drawn
past that circle, and the tiny overflow dot marker is not a real substitute for "the sauce visibly
spread past the edge."

## 3. D3A variable `doughShape` relationship — a second, related finding

None of the sauce boundary math (`DOUGH_RADIUS`/`isCellInsideDough`/`insideDoughFraction`/
`SAUCE_TARGET_RADIUS`) reads `PizzaState.doughShape` at all. It is **entirely a fixed circle at
radius 48**, exactly as it was before Issue #33 D1 introduced the 8-point radial dough model, and
unchanged again by D3A's reversible/free-boundary rewrite (`DOUGH_SHAPE_TECHNICAL_MAX_RADIUS = 58`,
`DOUGH_SHAPE_MIN_RADIUS = 10`).

Concretely, this means the pre-existing gap is not merely "sauce can't overshoot the ideal area" —
it is "sauce rendering has never once looked at the player's actual hand-shaped dough boundary,"
including *before* this task, for ordinary D1/D2/D3A play:

- A dough shaped smaller than 48 in some direction (e.g., a player who confirms right at the 75%
  size threshold, or shrinks one side with D3A's new inward drag) still gets sauce heatmap pixels
  rendered out to the full fixed 48-radius circle wherever a deposit lands there — visually able to
  bleed onto the plain backdrop *outside* the player's own smaller dough silhouette
  (`.pizza-dough-shape`, the actual rendered crust boundary, sits *below* the heatmap canvas in DOM
  order and is not used to clip it).
- A dough stretched *past* 48 (now possible up to `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS = 58`, D3A's
  whole point) still has its sauce heatmap hard-capped at the old fixed 48 — the sauce cannot
  currently follow the dough out to its new, legitimately larger silhouette either.

This is the same underlying gap (`isCellInsideDough`'s fixed circle) producing two visible
symptoms: no overshoot allowed, and no connection to the actual (possibly irregular, possibly
larger or smaller) D3A dough shape at all. Fixing the boundary to read `doughShape` instead of a
constant addresses both at once, and is required by the task's explicit instruction not to treat
D3A's dough as a fixed circle.

## 4. Scoring 2.0 impact assessment (Phase 3 preview, elaborated in the Result report)

`scoreSauceComponentV2` (`src/logic/scoringV2/sauceComponent.ts`) and `computeSauceMetrics`
(`sauceField.ts`) are two separate call sites reading the same `SauceMetrics` shape, but they are
**not the same function call** — `computeSauceMetrics` is called once for Prototype Metrics/Scoring
2.0 (via `referenceScoring.ts`/`scoringV2/index.ts`) using only `deposits`, with no `doughShape`
argument today. This audit's planned fix only changes the **render** path
(`sauceFieldToRgbaPixels`'s cell filter and the heatmap effect's own field-building weights in
`PizzaStage.tsx`), which is entirely separate code from `computeSauceMetrics` — so Scoring 2.0's
existing fixed-circle-based `quantity`/`coverage`/`evenness`/`overflowRatio`/`edgeRatio` numbers can
be left completely untouched (same inputs, same function, same outputs, byte-for-byte), leaving
`SAUCE_QUANTITY_WEIGHT`/`SAUCE_COVERAGE_WEIGHT`/`SAUCE_EVENNESS_WEIGHT`/`SAUCE_EDGE_WEIGHT` (52
points combined weight in `totalScore`) and every reference fixture untouched. This is confirmed
further, with concrete evidence, in the Result report.

## 5. Sauce type parity

Confirmed unchanged and irrelevant to this fix: `PizzaStage.tsx` has exactly one dispense/heatmap
code path, gated only on `activeIngredient?.placement === "spread"` — true for tomato, pesto, and
olive oil alike (`src/data/ingredients.ts`). The only per-ingredient branch anywhere in the sauce
render path is `isOilSauce` (`sauceIngredient?.id === "olive-oil"`), which only swaps a CSS class
for a lighter gloss look — it does not change any boundary/geometry logic. The planned fix touches
shared geometry code only, so parity is structurally preserved (same function, same code path, for
all three).

## 6. Reset / stale-event / pointercancel safety (baseline, unchanged by this task)

Confirmed already correct and untouched by anything this task needs to do:

- `pointercancel`/`lostpointercapture`/`visibilitychange`/`blur` all call `endDispenseSession(false)`
  (discard, never commit) — `SauceDispenseController.stop()` is idempotent and safe at any time.
- `COMMIT_SAUCE_DISPENSE`'s reducer guard (`state.phase !== "PREPARE" || state.makingStep !== "SAUCE"`)
  is the canonical backstop independent of component cleanup; `makingStepToken`'s abort effect stops
  a gesture in flight from surviving into the next step.
- None of this task's planned changes touch `SauceDispenseController`, gesture lifecycle, or reducer
  guards — only the render-time cell-visibility test and the render-time field-weighting inside the
  existing heatmap effect.

## 7. Verdict

**B. READY — render-layer boundary fix, no state/scoring changes required.**

Recommended approach (elaborated as the chosen design in the Result report): add a pure,
`doughShape`-aware boundary test (mirroring the existing fixed-circle one) used **only** by the
render path (`sauceFieldToRgbaPixels`'s cell filter + the heatmap effect's field-weighting +
overflow-marker fraction in `PizzaStage.tsx`), leaving `computeSauceMetrics`/`scoreSauceComponentV2`
/`evaluateSauceForPlayer` and every Scoring 2.0 reference fixture calling the fixed-circle boundary
exactly as today. This satisfies the task's V1 fallback explicitly permitted in Phase 2 ("ideal
sauce target → free painting up to and including the dough silhouette / crust-rim") without
requiring a full "paint onto the table" rewrite, which the render architecture (a fixed
`HEATMAP_CANVAS_PX` canvas sized to the dough box, `SAUCE_FIELD_SIZE=16` grid keyed to dough-percent
space) is not naturally suited to representing without a much larger, separate re-architecture.
