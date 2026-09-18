# Teto Pizza Game — Sauce Free Boundary — Result

**Type:** Implementation, directly from `docs/reports/TETO_SAUCE-FREE-BOUNDARY_Fresh-Audit.md`
(Phase 0, same session/PR per the task's own instruction).

- **Start SHA (fresh `origin/main`):** `ceaa78a340362d06a18700251afae9c969df96c9` (merge of PR #65,
  Issue #33 D3A Reversible Dough Shaping — confirmed merged and current via `git fetch origin
  main` + `git rev-parse origin/main` before starting).
- **Final SHA (PR head):** `9cdd57de4e8441fb0403e2f7cb384f51b102ec11`
- **Branch:** `claude/sauce-free-boundary-game-s0i5cs`
- **PR:** [#66](https://github.com/perusonao/teto-pizza-game/pull/66) — CI green (`run
  35344426813`, conclusion `success`).
- **Status:** Implementation complete, Preview deployed, Review Playthrough recorded and
  delivered. **Left OPEN, pending Human Review.**

---

## 1. Current clipping root cause (recap of the Fresh Audit)

Classified against the task's own A/B/C split:

- **A. Input** does *not* discard overshoot. `handlePointerDown` only gates where a *stroke can
  start* (`isInsideDough`); once a sauce dispense session is running, every subsequent
  `pointermove` is recorded and ticked into a deposit at its raw, unclamped position (`src/
  components/PizzaStage.tsx` `processMovePoint`/`SauceDispenseController`).
- **B. State** does *not* discard or silently ignore overshoot either. `SauceDeposit`
  (`src/state/pizzaState.ts`) is explicitly documented as "may fall outside the dough circle";
  `computeSauceMetrics` (`src/logic/sauceField.ts`) already conserves every deposit's full amount,
  continuously split into `quantity`/`overflowAmount`/`edgeAmount`/`edgeRatio` — this was already
  a reviewed Phase 4A-1A prototype primitive, not something this task had to invent.
- **C. Scoring** does *not* additionally clip or ignore it either — `scoreSauceComponentV2`
  already reads `edgeRatio`/`overflowRatio`-derived continuous similarity, tolerant of overshoot
  by design.
- **The actual boundary was render-only**: `sauceFieldToRgbaPixels` (`src/logic/sauceField.ts`)
  only ever painted a grid cell inside a **fixed `DOUGH_RADIUS` (48) circle**, regardless of the
  weight computed for it. The only other visual acknowledgment of overshoot was a small, faint
  per-deposit dot marker — easy to miss, not "sauce that visibly spread."
- **Second, related finding**: that same fixed circle has never once read `PizzaState.doughShape`
  (Issue #33 D1/D2/D3A's 8-point radial model) — sauce rendering was completely disconnected from
  the player's actual (possibly irregular, possibly larger/smaller) hand-shaped dough, both before
  and after D3A. One root cause, two symptoms (no overshoot allowed; no D3A shape awareness at
  all).

## 2. Chosen boundary contract

Three boundaries, kept structurally separate exactly as the task's Phase 1 asks:

1. **Ideal sauce area** — `SAUCE_TARGET_RADIUS` (40, `src/logic/sauceField.ts`). **Unchanged.**
   Still the exact boundary `edgeAmount`/`edgeRatio`/Scoring 2.0's Sauce component and the
   player-facing ふち tier all read. This PR does not touch what counts as "the ideal target" at
   all.
2. **Current dough silhouette** — `PizzaState.doughShape` (Issue #33's 8-point radial array,
   possibly asymmetric/stretched/shrunk by D3A). **Newly connected to sauce rendering** via two
   new pure functions:
   - `doughShapeRadiusAtAngle`/`isInsideDoughShape` (`src/logic/doughShape.ts`) — the dough's own
     local radius at an arbitrary angle (linear interpolation between the two bracketing control
     points — a straight-edged N-gon reading of the shape, not the smoothed Catmull-Rom display
     curve, since this is a boundary *test*, not a display path).
   - `isCellInsideDoughShape`/`insideDoughShapeFraction` (`src/logic/sauceField.ts`) — the
     sauce-grid-space counterparts, used only by the render path.
3. **Technical interaction canvas** — unchanged from D3A: `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58)
   already bounds how far `doughShape` itself can reach (enforced by `isValidDoughShape`/
   `applyStretchPoint`, both untouched by this PR). Sauce rendering inherits this ceiling for free
   by reading `doughShape` directly — there is no separate, independent sauce-side technical
   clamp to add, since a deposit's own raw coordinates were already unclamped state (per §1) and
   the *visible* boundary now simply tracks wherever the dough itself legitimately reaches.

Overshoot past the ideal target (1) onto the dough/crust (2) is now **fully visible, real
heatmap paint** — not a marker dot. Overshoot past the actual dough silhouette (2) — i.e.,
genuinely off the pizza — still gets the pre-existing faint dot-marker treatment, now measured
against the real silhouette instead of the old fixed circle.

D3A's own instruction — never treat a distorted D3A dough as a fixed circle — is satisfied
structurally: `isInsideDoughShape` degrades to the exact old fixed-circle test only in the
special case where every one of the 8 radii equals `DOUGH_RADIUS` (pinned by a dedicated test,
§6), and diverges from it correctly in every other shape.

## 3. V1 scope decision (Phase 2's own explicit fallback)

The task's Phase 2 explicitly permits, if "painting all the way to the table" is unnatural/
high-risk for the current renderer: "ideal sauce target → free painting up to and including the
dough silhouette (crust/rim)." That is exactly what this PR implements, for a concrete
architectural reason found during the audit: the sauce heatmap is a fixed `HEATMAP_CANVAS_PX`
(200×200) canvas and a `SAUCE_FIELD_SIZE=16` grid, both keyed to the *dough box's own* 0–100
dough-percent coordinate space (`src/logic/pizzaCoordinates.ts`). "Painting onto the table" would
require an entirely separate, unbounded coordinate space and canvas sizing strategy — a much
larger re-architecture with no existing reviewed geometry to build on, and no product requirement
in Issue #37's own text asks for it (the brief's own examples — "はみ出した位置が視覚的に分かる",
"crust/rimへソースが乗る:許可" — are both satisfied by painting up to the dough silhouette).

## 4. D3A variable `doughShape` connection

Confirmed end-to-end: `PizzaStage`'s heatmap render effect now reads `pizza.doughShape` directly
(added to the effect's own dependency array) and passes a shape-aware predicate into
`sauceFieldToRgbaPixels`'s new `isCellVisible` parameter, plus reweights each deposit's
inside/overflow split via `insideDoughShapeFraction(pizza.doughShape, ...)` instead of the old
fixed-circle `insideDoughFraction`. A player who used D3A to stretch one region out toward
`DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58) can now see sauce follow that region out past the old
fixed 48 circle; a player who left part of the dough smaller than 48 no longer has sauce bleed
onto the plain backdrop outside their own smaller shape (the pre-existing gap identified in the
Fresh Audit §3, present since D1, not something D3A itself introduced but only made more visible).

## 5. Scoring 2.0 impact

**None — by construction, not merely by testing.** `computeSauceMetrics` (`src/logic/
sauceField.ts`), `scoreSauceComponentV2` (`src/logic/scoringV2/sauceComponent.ts`), and
`evaluateSauceForPlayer` (`src/logic/sauceEvaluation.ts`) are three separate call sites, all still
reading only `deposits`/`SauceMetrics` — no `doughShape` parameter was added to any of them, and
none of those three files, `src/logic/scoring.ts`, `src/state/gameReducer.ts`, `src/state/
pizzaState.ts`, `src/data/recipes.ts`, `src/logic/dex.ts`/`progression.ts`, or `src/logic/
pitzReward.ts` appear anywhere in this PR's diff (confirmed by `git diff --stat` against
`origin/main`: only `src/logic/doughShape.ts`, `src/logic/sauceField.ts`, `src/components/
PizzaStage.tsx`, their two test files, and this pair of docs reports). The full existing
Scoring 2.0 / Pitz / economy / reducer regression suite (389 tests across
`scoringV2/*.test.ts`, `pitzReward.test.ts`, `economy.test.ts`, `recipes.test.ts`,
`gameReducer.pitzReward.test.ts`, `gameReducer.scoringV2Authority.test.ts`, `gameReducer.
commitSauceDispense.test.ts`) re-ran green, unmodified. **No BLOCKER to report** — the task's own
"if scoring breaks unintentionally, report as BLOCKER rather than fixing it yourself" condition
did not trigger, because scoring's own inputs never changed.

`SAUCE_QUANTITY_WEIGHT`/`SAUCE_COVERAGE_WEIGHT`/`SAUCE_EVENNESS_WEIGHT`/`SAUCE_EDGE_WEIGHT` (the
Sauce component's 52-point weight), Pitz multipliers, Dough scoring, Recipe targets, the Save
schema, and Lunch Rush rewards are all untouched, per the task's own explicit prohibition list.

## 6. Sauce type parity

Unchanged and structurally guaranteed: `PizzaStage.tsx` has exactly one dispense/heatmap code
path, gated only on `activeIngredient?.placement === "spread"` (true for tomato sauce, pesto, and
olive oil alike, `src/data/ingredients.ts`). The only per-ingredient branch in the sauce render
path is `isOilSauce`, a CSS-class swap for the oil's own glossy look — unrelated to the boundary
geometry this PR changes. The Review Playthrough (§8) demonstrates both tomato (Margherita) and
pesto (Genovese) hitting the same overshoot behavior through the identical code path.

## 7. Tests

`npm test`: **1146/1146 passing** (up from 1132 pre-PR, 14 new).

New coverage, mapped to the task's own Phase 4 list:

- **ideal target内 painting**: unaffected/pre-existing (`sauceField.test.ts`'s existing
  `computeSauceMetrics`/`SAUCE_TARGET_RADIUS` describe blocks, re-verified green, untouched by
  this PR's diff).
- **ideal boundary越え painting / overshoot remains visible & stateful**: new —
  `doughShapeRadiusAtAngle`/`isInsideDoughShape` (`doughShape.test.ts`, 7 new tests: exact match
  at each control point for a uniform shape, linear interpolation between bracketing points,
  agreement with a plain circle test, an asymmetric shape's stretched-side/shrunk-side behavior,
  center-always-inside, technical-max-radius reach past `DOUGH_RADIUS`) and
  `isCellInsideDoughShape`/`insideDoughShapeFraction`/`sauceFieldToRgbaPixels`'s new
  `isCellVisible` parameter (`sauceField.test.ts`, 7 new tests: uniform-shape agreement with the
  old fixed-circle test, a stretched shape making a previously-outside cell paintable, a shrunk
  shape making a previously-inside cell no longer paintable, fraction agreement/divergence,
  `sauceFieldToRgbaPixels`'s default-unchanged guarantee, and a shape-aware predicate never
  painting a cell with zero underlying field value).
- **distorted D3A dough との座標整合**: the same asymmetric-shape tests above are the direct pin
  for this — a stretched-side cell/point and a shrunk-side cell/point are both explicitly checked
  against the *old* fixed-circle result to confirm they now diverge correctly.
- **repaint / tomato / pesto / olive oil / pointercancel / reset / stale pointer / SAUCE confirm
  後の late event no-op / next stepへ state保持 / existing Scoring 2.0 regressionなし / Pitz
  regressionなし / Lunch Rush regressionなし**: all covered by the **existing, unmodified**
  regression suite (`PizzaStage.sauceParity.test.tsx`, `PizzaStage.sauceReset.test.tsx`,
  `PizzaStage.doughStretch.test.tsx`, `onewayFlow.test.ts`, `gameReducer.commitSauceDispense.
  test.ts`, the full `scoringV2`/`pitzReward`/`economy` suites) — none of these files, or any
  file they exercise beyond `sauceField.ts`'s new additive exports, were touched by this PR's
  diff, and all re-ran green, which is itself the proof this change didn't disturb that surface
  (the same "unmodified tests still pass" argument Issue #33 D3A's own Result report used for its
  reset/stale-pointer claims).

No PizzaStage-level canvas-pixel integration test was added: this repo's existing convention
(confirmed by every `PizzaStage.*.test.tsx` file) mocks `HTMLCanvasElement.prototype.getContext`
to return `null` specifically to avoid exercising real canvas drawing in jsdom (which has no
canvas 2D implementation) — pixel-level behavior is unit-tested directly against the pure
`sauceField.ts` functions instead (as above), and verified visually via the Review Playthrough
(§8), matching the same split D3A's own PR #65 used (pure-math tests + Review Playthrough,
no jsdom canvas pixel tests).

`npx tsc -b`: clean. `npm run lint` (oxlint): clean. `npm run build`: clean (330.21 kB /
103.68 kB gzip preview build; 324.80 kB / 102.59 kB gzip production build).

## 8. Preview deployment

Deployed via `teto-pizza-game-preview`'s existing manual pipeline (unchanged, no new workflow
files):

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=9cdd57de4e8441fb0403e2f7cb384f51b102ec11`,
   `pr_number=66` → run [35344493502](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35344493502),
   success, pushed commit `7dec0eee976ab13b12aa135810e15d6aa5ae1a42` ("Deploy preview:
   9cdd57de4e8441fb0403e2f7cb384f51b102ec11 (9cdd57d)").
2. `pages.yml` (`workflow_dispatch`) → run [35345866034](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35345866034),
   success.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

This sandboxed session's outbound network policy blocks `perusonao.github.io` directly (the same
caveat every prior Preview-Gate report for this project documents). To still verify and record
real behavior rather than only trusting the Actions run logs, this session rebuilt **the exact
same source commit with the exact same build command** the workflow used
(`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=66 VITE_PREVIEW_SHA=9cdd57d vite build
--base=/teto-pizza-game-preview/`, plus the same manifest/`noindex` post-processing read directly
from `deploy-from-source.yml`), served that output locally via `vite preview`, and drove a real
headless-Chromium (390×844) session against it with Playwright — byte-for-byte the same static
bundle now live at the Preview URL.

| Check | Result |
|---|---|
| App loads, HOME → Pizza Select → Margherita/Genovese navigation | ✅ |
| DOUGH gesture (D3A stretch/shrink) responds to synthetic pointer drags | ✅ |
| SAUCE dispense/heatmap responds to synthetic pointer drags for tomato and pesto | ✅ |
| Console errors during the full scripted run | ✅ none |

## 9. Review Playthrough

Delivered directly to the user (390×844, MP4/H.264, ~40s; not committed to the repo, per this
project's standard workflow — `artifacts/`/review videos are gitignored and never checked in).

Scenes (recorded against the local rebuild of the exact preview commit, §8):

- **A — D3A dough shaping with visible overshoot**: a Margherita round is built up to a mostly
  round dough near the ideal `DOUGH_RADIUS` guide ring, then one direction is pulled further out
  — visibly crossing the dashed guide ring, reaching toward `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS`
  (58) — while the opposite side is pulled back in for a genuinely asymmetric, "imperfect but
  reasonable" shape (D3A's own reversible-gesture contract, unchanged by this PR).
- **B — SAUCE painted normally, then deliberately past the old fixed rim**: a centered stroke
  well inside the ideal target, then a stroke dragged from inside the old fixed `DOUGH_RADIUS`
  circle out toward the dough's own stretched rim. The sauce visibly continues past the dashed
  guide ring, following the dough's own irregular boundary — not a fixed circle, and not merely a
  faint dot marker.
- **C — Carry-through**: confirming SAUCE → CHEESE shows the identical dough shape and sauce
  overshoot underneath, unchanged, proving it is the same canonical `pizza` state carried forward,
  not a transient gesture-only visual.
- **D — Reset**: pressing `やり直す` from CHEESE reverts to a fresh, small, undeformed dough
  circle with no sauce — confirming no stale overshoot paint survives a reset (the dedicated
  mid-gesture pointercancel/reset regressions themselves are covered by the existing, unmodified
  automated suite — see §7).
- **E — Pesto parity**: a second recipe (Genovese/pesto) is built through the same DOUGH → SAUCE
  flow and painted with an overshoot stroke, demonstrating the identical free-boundary behavior
  through the same shared code path (§6).

## 10. Known limitations

- The dough-silhouette boundary test (`doughShapeRadiusAtAngle`) linearly interpolates between
  the 8 raw control points (a straight-edged N-gon), not the smoothed Catmull-Rom curve the
  dough's own visible crust edge renders with (`smoothDoughShapeForDisplay`). Near a control
  point this is exact; roughly mid-way between two control points, the boundary test can differ
  from the rendered crust edge by a small amount (bounded by how far the smoothed curve bows
  in/out relative to the straight edge between the same two points — visually subtle at
  `DOUGH_SHAPE_POINTS=8`, not visible in the Review Playthrough, but worth flagging precisely
  since it is a deliberate simplification, not an oversight).
- `smoothSauceFieldForDisplay`'s existing rim-band clamp (never let the blur *raise* a cell beyond
  `SAUCE_TARGET_RADIUS` above its own raw value) is unchanged and still keyed to the fixed
  `SAUCE_TARGET_RADIUS`, not the dough shape — harmless today since it only ever *lowers* a
  value, never adds visible sauce, but noted for completeness.
- No PizzaStage-level canvas-pixel integration test exists for this change (or for any prior
  sauce-visual change in this codebase) — see §7 for why, and why the Review Playthrough is the
  intended complementary proof for this exact class of change in this project.
- A dough shrunk small enough that `SAUCE_TARGET_RADIUS` (40) itself exceeds the dough's own
  silhouette in some direction is an edge case this PR does not specifically re-tune for (the
  ideal-target ring would then partly sit outside the player's own smaller dough); this was true
  before this PR as well (the ideal target ring was never dough-shape-aware, and D3A's own
  `DOUGH_SHAPE_MIN_RADIUS` of 10 already permits a dough this small) and is unrelated to the
  render-boundary fix here.

## 11. Human Feel — what to confirm

- Does sauce visibly following the dough's own stretched/shrunk shape (rather than a fixed
  circle) read as "the sauce is on my pizza" clearly, or does it need a stronger visual cue where
  it crosses the old guide ring?
- Is the faint dot-marker treatment for sauce that misses the dough silhouette *entirely* (as
  opposed to landing on a stretched-but-still-on-dough area) still clear enough as "this missed
  the pizza," now that "landed on the pizza, past the ideal ring" reads as full sauce instead?
- Does painting past the ideal ring onto a genuinely irregular D3A dough feel like an intentional,
  readable consequence of the player's own dough shaping, or does it feel accidental/confusing on
  a real device?

## 12. Recommendation for next phase

Per Issue #37's own M2/Making Game 2.0 sequencing, the next open, ungated item on this track
remains Cheese/Topping drag scope (handed off from Issue #47 Slice C's Finding J, still tracked
under Issue #37's M2 checklist) — unrelated to this PR. Any future Scoring 2.0 work that wants to
evaluate overshoot/unevenness specifically (Phase 3's own forward-looking audit item) can build on
`computeSauceMetrics`'s existing `overflowAmount`/`edgeAmount` fields without a canonical-state
schema change, exactly as the Fresh Audit's §4 already noted — this PR made no change to that
surface, so that option remains exactly as open as it was before.

---

**Final verdict: A. READY FOR HUMAN REVIEW.**
