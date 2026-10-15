# Sauce Remaining Gauge — Phase 2 (PizzaStage wiring) Result

Issue #489 · builds on PR #493 (Phase 1: `sauceRemainingFraction` + `SauceRemainingGauge`, merge `2db1a52`).

## What changed
- `PizzaStage` renders `SauceRemainingGauge` while `makingStep === "SAUCE"` (and `interactive`, not `resultCompact`).
- Remaining = `1 − (consumed + pending) / SAUCE_MAX_QUANTITY`, where `consumed` = the current sauce's canonical
  deposits + the usage of every sauce replaced by a switch (`advanceSauceCarry`). Pending is `pendingTotalRef`.
- Placement: `.pizza-stage__sauce-gauge`, absolutely positioned in the stage's right gutter (`right: 4px`, vertically
  centred), `pointer-events: none`. Out of flow → pizza size/centre, hit area and pointer math are unchanged.
- No reducer / save / scoring / inventory / props change. No numeric text, animation or haptics (Owner plan, #489 comment).

## Conflict check (before implementing)
- #487 (Canvas cheese) and #468 (mozzarella melt) touch `PizzaStage.tsx` only in imports and around the cheese/bake render
  (lines ~956 and ~1191). Phase 2 edits the SAUCE-derived block (~1047), the final JSX tail and one import line: no
  overlapping hunks expected; a trivial import-line merge is the worst case. #468 also edits `App.css` (different region).
- #478 (tray drag, draft) does not touch `PizzaStage.tsx` / `App.css`.
- No other open PR or branch implements the gauge wiring.

## Verification
- Vitest: `PizzaStage.sauceGauge.test.tsx` (9 tests: full / committed / empty, absent on DOUGH/CHEESE/TOPPING/CUT and result stage,
  outside the dough hit area).
- E2E `e2e/sauce-gauge-489.spec.ts` at 390×844 and 360×800: gauge right of the pizza, inside the viewport, ≤14×96px,
  not hit-testable, drains while holding and keeps its value after commit, pizza box identical, gone after leaving SAUCE.
- Screenshots: `docs/reports/screenshots/sauce-gauge-phase2/` (before / after-full / after-drained per viewport).
- Human Verification video (390×844) is delivered directly to the Owner per policy and is NOT committed; it has not been
  recorded in this cloud session — **Owner iPhone HV pending**.

## Not done (by instruction)
No merge, no deploy, no shared Preview replacement.

## Rebase onto B1 / B2 (main `d0da093`) — the cumulative-carry logic is superseded
`main` gained B1 (#498, per-kind ledger) and B2 (#500, layered painting) after this PR was cut. B1 keeps the whole deposit history on a
switch and caps each kind at 100% (`SAUCE_MAX_QUANTITY`) plus a provisional pizza-wide 200% (`SAUCE_TOTAL_MAX_QUANTITY`); the B1 Result
already recorded that "#494's accumulate-across-switch logic is superseded by the ledger". Merging as-is would have made the gauge
disagree with the real cap, so this branch (merge of `main` into the PR head) replaces it:

- Removed: `advanceSauceCarry` / `SauceCarryState`, the `sauceCarry` render-time state and `committedTotalRef` in `PizzaStage`
  (main's `pizzaRef` + `sauceHeadroom` cap is kept as-is).
- Gauge = the dispenser's own number: `sauceGaugeUsed(pizza, activeKind) = SAUCE_MAX_QUANTITY − sauceHeadroom(pizza, activeKind, 0)`,
  plus the in-progress stroke (`pendingTotalRef`). `min(kind's own 100%, pizza-wide total)` — whichever binds — so gauge and cap cannot disagree.
- Behaviour with several sauces: a sauce not yet used starts at its own full bottle; switching back shows that sauce's remaining bottle
  (no refill); a drained sauce stays at 0% for its own kind while another kind still has its bottle. One-sauce pizzas are unchanged.
- This supersedes the earlier "one bottle across switches" Owner Decision wording on this PR (it predates B1's per-kind design).
  The pizza-wide 200% value is B1's provisional constant and is untouched.
- Tests: `sauceGaugeUsed` unit tests; `PizzaStage.sauceGauge.perKind.test.tsx` (replaces `…sauceCumulative.test.tsx`); a multi-sauce case in
  `PizzaStage.sauceGauge.test.tsx`; E2E multi-sauce case in `e2e/sauce-gauge-489.spec.ts`.
- B2 single-source rendering golden: only the two scenarios that press the dough on the SAUCE step (`tomatoPending`,
  `firstStrokePending`) changed hash — they now contain the gauge element; heatmap / overflow canvas counts and every other scenario are unchanged.
  Regenerated on purpose (`UPDATE_SAUCE_B2_GOLDEN=1`).

## Owner HV feedback (iPhone Safari) and the follow-up (Owner Decision, PR #494)
HV found: the single red gauge did not say which sauce it showed; a tomato stroke laid after a pesto stroke was invisible ("tomato cannot be painted /
is overwritten"); and an empty sauce could not be told from the pizza-wide limit. Fresh Audit: the gauge always equalled the dispenser's headroom (same
`sauceHeadroom`); the "overwritten" look was B2 layering **by sauce kind in first-use order**, so later tomato strokes joined the bottom tomato layer, under the pesto.
Confirmed spec (unchanged): each sauce has its own independent 100%; switching back does not refill; the provisional pizza-wide 200% stays; the gauge shows the
selected sauce's real usable remainder.

Changes (rendering and gauge only -- remaining-quantity maths, reducer, scoring, Completion Gate, inventory, save are untouched):
- **Chronological runs.** `sauceLayersOf` now splits the (already time-ordered, append-only) deposit log into runs of consecutive same-kind deposits; later runs are
  painted over earlier ones. Tomato -> pesto -> tomato is three layers, the last on top. The committed runs are memoized (`sauceRunsOf`) and `layersWithPending`
  rebuilds only the top run per tick, so earlier canvases are not redrawn while painting. Fewer than two kinds still returns `null` -> the unchanged single heatmap
  (B2 single-source golden: only the two scenarios that press the dough on SAUCE changed hash, because the gauge element's inline colour style is in their DOM; canvas
  counts unchanged). Supersedes B2's "first-use order, switching back adds to the first layer" (B2 Result above); alpha stacking / O4 (multiply) is unchanged and still pending.
- **Gauge colour.** The fill uses the selected sauce's colour (`--sauce-gauge-color`; tomato `#c73b2e`, pesto `#6b8e3d`, olive oil `#e9d9a0`).
- **Contrast.** Darker track (`rgba(60,40,20,.2)`), firmer 1.5px outline, and a 1px inner outline on the fill, so pale olive oil stays visible on the cream stage.
- **Empty vs pizza-wide limit.** `sauceGaugeDetail` returns `usable` (= headroom / one bottle) and `capBlocked` (the part of the kind's own bottle the 200% cap keeps back).
  An empty sauce shows an empty bar (as before); when the pizza-wide cap binds the blocked part is a quiet diagonal hatch above the fill (`data-limit="total"`, `aria-valuetext`).
  With one or two sauce kinds the cap (2.0) cannot bind before the kinds' own 100%, so the hatch appears from the third kind on.
- **Not reachable today:** a multi-sauce pizza in CUT -- Guided margherita offers only its own sauce, Free Cooking has no CUT. Cut rendering is covered by a component test
  (every run is drawn once per piece, same order: 4 pieces x 3 runs = 12 heatmaps + 12 overflow markers).

Verification: tsc / oxlint clean; Vitest (new: runs order, memo identity, pending-run, cut copies, gauge colour / hatch, `sauceGaugeDetail` = dispenser headroom incl. pending);
Chromium E2E at 390x844 and 360x800 (`sauce-gauge-489`, `sauce-layers-b2` incl. "tomato painted after pesto shows over it", `sauce-edge-475`, `tq-1d-no-sauce`).
Render cost (360x800, 4x CPU throttle, 9 runs / 18 canvases vs 1 run / 2 canvases): frame median 16.7 ms both, p95 16.7 ms vs 33.4 ms (the single-run sample includes warm-up), max 16.8 ms vs 83 ms --
no regression, so no further optimization. Rasterizing 150 deposits is 0.57 ms in one canvas, 0.36 ms for a 50-deposit top run.

## Overlap dimming (Owner Decision: option B, PR #494)

Alpha stacking made the earlier sauce (e.g. tomato) look "swallowed" under a later one (alpha cap 0.93; the data was never lost). Option B, as decided:

- Only the **upper run's** opacity is scaled where it overlaps the layers below: `alpha *= 1 - 0.3 * cover`, `cover = min(1, underAlpha / (255 * 0.93))`. Smooth at soft edges; colour untouched; alpha stacking kept; no multiply.
- Single-sauce pizzas and non-overlapping strokes are byte-identical (`under` is empty → no change; B2 single-source golden unchanged).
- `SauceLayer.under` = all deposits of earlier runs (memoized with the runs; the pending top run keeps its `under`). `SauceHeatmapCanvas` rasterizes the under-alpha plane once (`useMemo`). Overflow markers are not dimmed.
- Not changed: B1/B2 ledger, remaining maths, cap rules, reducer, scoring, inventory, save format.

Composite over dough at the overlap centre (before → after): 2 layers (tomato→pesto) (113,137,60) → (141,116,58); 3 layers (+olive oil) (225,212,153) → (201,181,124). The lower sauces stay visible through the top one.

Comparison images (left BEFORE e193d95, right AFTER; rows: 2 layers, 3 layers): `docs/reports/screenshots/sauce-overlap-dim/compare-390x844.png`, `compare-360x800.png`.

Verification: `tsc -b` clean, oxlint no new findings, Vitest 8053 passed (2 skipped), related Chromium e2e (sauce-edge-475, tq-1d-no-sauce, sauce-gauge-489, sauce-layers-b2) 18/18 at 390×844 and 360×800. Performance (CDP CPU 4x, 12 alternating runs T/P/O): before median 16.7 ms / p95 33.4 ms; after median 16.7 ms / p95 33.3 ms at both viewports — no regression.

## Codex P2: a commit no longer repaints every earlier run (option A, Owner decision)

Codex P2 (PR #494): one canvas pair per run, and every run repainted. Measured on e037a50: a new run repainted **R + 3** canvases (6 runs: 9 draws, 12: 15, 25: 28), because `sauceRunsOf` rebuilt every run and its `under` list on each commit, so every canvas saw new props. The longest a pizza can get is 100 runs (total cap 2.0 / 0.02 per tick; 99 reached in the browser at 1x).

Fix (display only; no change to B1/B2, the ledger, reducer, scoring, inventory or save format, no limit on switching): `sauceRunsOf(pizza, previous)` returns every run that did not change as the SAME object (its `deposits` and `under` included); only the run a commit extended or added is rebuilt, and a pizza whose deposits were restamped (single -> multi sauce) or shortened (undo) rebuilds what changed. PizzaStage keeps the previous runs in a ref. Result in value is identical with or without `previous`; the drawing, the chronological layers, the overlap dimming and the single-sauce path are unchanged.

| | before | after |
|---|---|---|
| draws for a new-run commit (6 / 12 / 25 runs) | 9 / 15 / 28 | **3 / 3 / 3** |
| draws for a 400 ms top-run extension | 15 / 20 / 32 | 9 / 9 / 7-8 |
| long tasks while building ~99 runs (1x) | 27-30, 1.7-1.8 s | 1-3, 0.14-0.23 s |
| pointerup to 2 frames, 3 new-run commits at CPU 4x (12 / 25 / 50 runs, 390 / 360) | 116-125 / 196-236 / 186-340 ms | 78-92 / 95-110 / 138-140 ms |

Not changed by A: the canvas count (2 per run), memory (about +1.2 MB of renderer memory per run: 12 runs +13 MB, 50 runs +57 MB, 99 runs +106-128 MB) and DOM size. At 99 runs a commit still takes about 230 ms (360x800, 1x), which is browser work on ~200 filtered canvases, not script; bounding the canvas count is option B (prototype and comparison only; not adopted).

Tests: `sauceRunsOf` reuse (same objects for unchanged runs, extension, undo, restamp, changed earlier run); component test that earlier layers receive the very same `deposits` / `under` objects across commits (fails without the fix); e2e (390x844 / 360x800) that a 13th run commit draws at most 5 canvases and a top-run extension at most 14.

## Codex P2: a fixed sauce-canvas budget and a safe failure path (option B, Owner decision)

A cuts the repaint work but not the canvases (two per run, up to 100 runs). Option B (Owner decision) bounds them: **a pizza never carries more than 24 sauce canvases**, however many runs it has and however the sauces alternate. No change to the game rules, the remaining quantity, the ledger, the reducer, scoring or the save format; chronological layering, overlap dimming and the single-sauce drawing are kept.

- **Own layers.** The newest `SAUCE_OWN_LAYERS` = 8 runs keep a heatmap and an overflow canvas of their own, exactly as before (a pizza with 8 runs or fewer draws exactly as it did).
- **Merged groups.** Every older run is flattened, in order, into at most `SAUCE_MERGED_GROUPS_MAX` = 4 shared canvas pairs (`planSauceLayers`, `SauceMergedCanvas`). Each run's raster is built as its own canvas would build it (own colour, own overlap dimming against everything under it), then stacked with the same source-over blend the browser uses between canvases (`compositeOver`); a group that only grew at its end stacks just the new run (rasters are cached per run object, which A made stable). The one difference from separate canvases is that the CSS blur is applied once to the flattened group.
- **Olive oil.** Oil carries its own CSS filter (saturate / contrast / brightness / glow), which cannot be applied to a canvas that also holds other sauce. So consecutive older runs are grouped by "oil or not", and an oil group is an oil canvas. If the oil/other alternation needs more than 4 groups, the OLDEST groups are folded into one plain group and their oil runs get the oil colour look baked into their pixels (`bakeOliveOilLook`: saturate 2.1, contrast 1.4, brightness 0.82; no glow, no bake-state variant). That approximation applies only to the oldest, buried runs of a pizza that alternates oil more than the budget allows; any other history is drawn exactly.
- **Canvas failure.** A 2D context refused after a working probe (canvas memory budget), or a draw that throws, now shows that layer as one soft dot per deposit in the sauce's colour (`SauceDotsFallback`, same box / blur / bake tint as the canvas; at most 100 dots per pizza) instead of nothing, so spent sauce is never invisible; the overflow markers of a failed canvas are simply left out. Every canvas draw is wrapped in try/catch, and the sauce layers sit in an error boundary (`SauceLayersBoundary`, no DOM of its own) that falls back to the same dots, so an exception can no longer unmount the app (white screen). A platform with no 2D support at all (a test DOM) draws nothing, exactly as before.

Measured (Chromium; 390x844 and 360x800 give the same picture, 390 / 360 where two numbers are shown), A = 68900dc, B = this change:

| runs | canvases A / B | DOM nodes A / B | renderer memory A / B | commit, CPU 4x, median A / B |
|---|---|---|---|---|
| 12 | 24 / 18 | 406 / 376 | +5 / +5 MB | 91 / 88 vs 70 / 85 ms |
| 25 | 50 / 18 | 536 / 376 | +18 / +3 MB | 107 / 111 vs 60 / 64 ms |
| 50 | 100 / 18 | 786 / 376 | +46 / +4 MB | 152 / 206 vs 100 / 68 ms |
| 90 | 180 / 18 | 1186 / 376 | +91 / +5 MB | 212 / 175 vs 49 / 65 ms |
| 99 | 198 / 18 | 1277 / 377 | +128 / +6 MB | (cap reached) |
| 50, oil alternating | 100 / 24 | 786 / 406 | +48 / +8 MB | 176 / 157 vs 98 / 82 ms |
| 99, oil alternating | 198 / 24 | 1277 / 407 | +125 / +10 MB | (cap reached) |

(Order in the last column: 390 A / 360 A vs 390 B / 360 B.) At CPU 1x a commit is about 40-60 ms with B at every run count, against 90-180 ms for A at 25-50 runs; with oil alternating at 50 runs it is 75-88 ms with B (the oil canvases carry the heavier glow filter) against 260-300 ms with A.

Look (same deposit log rendered by A and by B, 390x844 and 360x800; `docs/reports/screenshots/sauce-canvas-budget/`): 12 / 25 / 50 runs differ by at most 9 of 255 levels (mean <= 0.53; the difference x8 image shows only faint edge speckle). Oil mixed in (25 runs, every 5th oil): max 26, 2.4% of pixels above 8 levels. Worst case, oil alternating for 40 runs (the folded, baked path): mean 2.2, 14% of pixels above 8 levels, 1.6% above 24 (max 33), visible only as a slightly different oil yellow where old oil lies under newer sauce.

- **Cut pieces.** Every cut piece draws its own copy of the sauce, so the bound has to hold for the whole cut pizza (Codex P2 follow-ups). The piece count is bounded by the cut rules: the reducer accepts at most `requiredCutCount + 2` cuts, 6 for the 8-slice order, and n straight lines make at most n(n+1)/2 + 1 pieces, so **at most 22 pieces** (the real geometry reaches exactly 22 with six cuts, not 8; random arrangements never exceed the formula). A cut pizza's sauce is final, so a piece flattens every run (no own layers): up to 8 pieces use at most two groups (oil / other sauce) = 4 canvases a piece, **at most 32 in all**; more than 8 pieces use one group (oil baked in when mixed) = 2 canvases a piece, **at most 44 in all** (`SAUCE_CUT_CANVAS_MAX`). The uncut pizza is unchanged. (Multi-sauce + CUT is not reachable in the current product; this bounds it for when it is.)
- **Overflow markers of a mixed oil group.** A group that mixes oil with other sauce is a plain canvas, so its heatmap bakes the oil look into the oil pixels, but its overflow markers were drawn in the raw pale oil swatch (the oil CSS filter that gives an oil canvas' dots their contrast is not there). The markers of a mixed group now use the same transform (`bakeOilHex`, one shared formula with `bakeOliveOilLook`), and the overflow canvas redraws when a group turns mixed. The oil glow halo is not reproduced on the markers (colour only), as for the heatmap.

Tests: `planSauceLayers` (cover every run once and in order for 6 run counts x 4 histories, bound on groups and canvases, oil grouping, fold, stable keys); `compositeOver` / `bakeOliveOilLook`; the merged canvas against the runs' own rasters stacked in order (and incremental == from scratch); failure handling with a stubbed 2D context (refused, throwing, no 2D at all, boundary); component tests at 8 / 12 / 100 runs including 100 alternating oil (<= 24 canvases, oldest oil baked); e2e (390x844 / 360x800): 40 alternating tomato/oil strokes stay <= 24 canvases and every heatmap is painted, a refused context and a throwing `drawImage` leave the app up with the layer shown as dots and the tray working.

## Human Verification
The two videos recorded for the earlier cumulative design (A margherita, B switch) no longer describe the behaviour and are **withdrawn**.
Re-recording at 390×844 for the per-kind design (single sauce drain → switch to a fresh sauce shows full → switch back shows the remainder
→ drain to 0%) is **pending**; videos are delivered to the Owner directly and not committed (policy §6). Owner iPhone HV is also pending.
Screenshots (committed): `screenshots/sauce-gauge-phase2/` (single-sauce flow, unchanged by the rebase).
