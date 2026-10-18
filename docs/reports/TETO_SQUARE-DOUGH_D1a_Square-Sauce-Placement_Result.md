# Square-Pan Dough D1-a — square sauce / placement / display primitives — Result

Issue #537 (D) under Epic #532. Base: `origin/main` `3c3c2da` (A #541 and F1 #547 merged). **Not merged, not deployed, shared Preview untouched.**
No player-visible change; Human Verification not applicable (`TETO_HUMAN-VERIFICATION-POLICY.md` §2: nothing visible or behavioural changes).

## State of the neighbours (checked 2026-10-18)

| Slice | State | Effect on D |
|---|---|---|
| A #534 | merged (#541) | `PanGeometry` / `SQUARE_PAN_GEOMETRY` / `squareDough` are the shape data D1-a builds on. |
| F1 #538 | merged (#547) | `PizzaState.pan?` exists; nothing reads it for geometry yet. |
| B1 #545 / B2 #546 | open PRs | Touch `gameReducer.ts`, `pizzaState.ts`, `PizzaStage.tsx`, `App.css`, `App.tsx`, `GameScreen.tsx`. **D1-a touches none of these.** |
| F2 #548 | open PR | Techniques only. No overlap. |
| C #536 | not started | D1-a does not depend on its completion predicate or UI. |
| #518 | open Issue, no PR | Owns the bake `filter` block of `.pizza-dough` / `PizzaStage.tsx`. D1-a does not touch them. |

## What changed

New, all in `src/logic/pan/` and imported by nothing but their tests (Production inert):

| File | Role |
|---|---|
| `squareSauce.ts` | `squareOverlapFraction` / `insidePanFraction` / `insideSquareTargetFraction` (continuous, conserving, like `circleOverlapFraction`); `isSquareSauceCellVisible`; `computeSquareSauceMetrics` (same `SauceMetrics` shape as the round `computeSauceMetrics`, measured against the square pan and `SQUARE_PAN_GEOMETRY.targetArea` — not the round `SAUCE_TARGET_RADIUS`). |
| `squareSauceDisplay.ts` | `buildSquareSauceDisplayPixels` / `squarePanMask`: the round display rasterizer's Gaussian + alpha curve + crust taper, masked to the square pan (anti-aliased over one pixel). Constants are imported, not copied. |
| `panPlacement.ts` | `resolveGeometryPieceDrop` and `findOpenSpotOnPan`: the cheese / topping drop rule and spot search through a `PanGeometry`. |
| tests | `squareSauce.test.ts`, `squareSauceDisplay.test.ts`, `panPlacement.test.ts` (round-parity probes included). |

Shared file touched: `src/logic/sauceField.ts` — **three `export` keywords only** (`COVERAGE_THRESHOLD`, `DEPOSIT_FOOTPRINT_RADIUS`, `computeEvenness`), no behaviour change. No open PR edits this file.

## Why the round pizza cannot change
- No existing function is rewired; the round code paths still call `isInsideDough`, `clampToDough`, `resolvePieceDrop`, `findOpenSpot`, `computeSauceMetrics`, `buildSauceDisplayPixels`.
- `findOpenSpotOnPan(ROUND_PAN_GEOMETRY, …)` equals `findOpenSpot` on a probe grid; `resolveGeometryPieceDrop(ROUND_PAN_GEOMETRY, …)` equals `resolvePieceDrop` on a ~5,000-point grid (away from the exact grace boundary, where the clamp's 1e-9 inset differs by construction); the square rasterizer equals the round one (≤ 2/255 alpha) for a central dab, which pins the shared constants.
- Full suite: 442 files / 8408 tests pass, `tsc -b` clean, oxlint no new findings. No existing test edited, so every golden is its own proof.

## Findings for the next slices
- Square sauce grid: 14 × 14 = 196 on-pan cells (outer ring centres lie outside the 44 half side); the corner cells (1,1)…(14,14) are painted.
- The round `isCellVisible` (`isCellInsideDough`) would leave the corner cell bare — the new square test is the fix, asserted.
- Cheese pool, bake colour / char spots, RESULT scale and thumbnails are **CSS / component work (D2)** and stay out of this PR.

## Proposed split of the rest of D (each PR single-green, small)
1. **D1-a (this PR)** — pure primitives, inert.
2. **D1-b** — reducer routing (`APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` / `PLACE_TOPPING` read `PanGeometry` from `state.pan`; CUT disabled when square; score/metrics call the square functions). Conflicts with B1 (#545) in `gameReducer.ts` / `pizzaState.ts` → **start after B1 merges** (or rebase onto it).
3. **D2-a** — sauce canvas / heatmap, cheese pool, topping clamp in `PizzaStage.tsx` (branch-only addition). After B2 (#546) merges; avoid the bake `filter` block.
4. **D2-b** — bake colour / char / RESULT (scale 0.75) / thumbnails CSS. After #518 lands or without touching its blocks. HV required (390×844 video + before/after, 360×800).

## Not done / out of scope
No C completion predicate, no B2 operation UI, no Scoring 2.0 / hint / matcher change, no save-schema change, no CUT change.
