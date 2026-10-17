# Multi-Sauce S1 — Oil over another sauce (#519) + #502 fallback test — Result

Issue #521 (S1 of S1/S2/S3), fixes the visual part of #519, adds the missing #502 test. Design: `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` §3–4.
Base: `origin/main` `d69e43e`. Not merged, not deployed to Production.

## What changed

| Area | Change |
|---|---|
| `logic/sauceDisplay.ts` | `SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3`, `overlapAlphaFactorFor(kind)` (olive-oil → 0.3, everything else → the existing 0.7). |
| `components/SauceHeatmapCanvas.tsx` | optional `ingredientId` prop; the overlap dimming uses `overlapAlphaFactorFor(ingredientId)`. |
| `components/SauceMergedCanvas.tsx` | the flattened-group raster uses the same factor per run (`run.ingredientId`). |
| `components/PizzaStage.tsx` | passes `ingredientId={layer.ingredientId}` to the own-layer heatmaps (1 line). |

Unchanged: ledger, caps, reducer, scoring, inventory, save, CSS, the oil CSS filter, canvas budget, every one-sauce pizza (the layered path is never taken
and `under` is empty), non-oil layers (still 0.7, Owner Decision on PR #494).

## Root cause (recap)
Data was never lost. The oil canvas's CSS filter (`saturate(2.1) contrast(1.4) …`) makes the pale oil an opaque lime-yellow; at the generic ×0.7 overlap dimming it
still covered the tomato below (tomato → oil: overlap red-green gap 132 → 30). The earlier E2E read canvas pixels, which exclude the CSS filter.

## Value of the factor — measured, not assumed
Chromium 390×844, Free Cooking, tomato painted 22→50 %, oil 42→74 % (same row), **rendered page pixels**. `r−g` at the overlap point (tomato alone there: 132):

| factor | overlap RGB | `r−g` | reading |
|---|---|---|---|
| 0.7 (main) | 215,185,87 | 30 | tomato gone |
| 0.45 (initial candidate) | 213,155,85 | 58 | tomato faint |
| 0.35 | 212,140,81 | 72 | |
| **0.3 (chosen)** | **210,131,81** | **81** | tomato clearly visible, oil reads as a sheen |
| 0.25 | 210,121,76 | 89 | |
| 0.15 | 206,103,70 | 103 | oil almost invisible over the tomato |

The initial 0.45 was not enough (per-pixel dimming acts on alpha before the CSS filter, so it is weaker than the whole-canvas opacity experiment in the design doc).
0.3 is the largest factor that keeps the overlap clearly red (≥ 0.6 of the tomato's own gap) while the oil stays visible; oil alone (not over tomato)
is unchanged: (220,211,104) vs dough (238,208,152). Images: `docs/reports/screenshots/multi-sauce-s1-oil-overlap/` (`before-` main, `after-` 0.3 at 390×844 and 360×800,
`compare-factors-390x844.png` = all candidates side by side).

## Tests added
| Test | Purpose |
|---|---|
| `e2e/sauce-oil-over-519.spec.ts` (390×844 and 360×800) | **rendered-pixel** regression: tomato → oil keeps red in the overlap (nearer the tomato than the oil, `r−g` ≥ 0.55 of the tomato's own, oil alone ≥ 30 from the dough); the same through CHEESE and after the bake take-out on the **RESULT** panel; oil → tomato; tomato / pesto / oil alone each distinct and on the single-heatmap path (2 canvases, no per-kind class). Red-first: against `main` the SAUCE and CHEESE/RESULT checks fail (overlap (215,185,87)). |
| `logic/sauceOverlap.test.ts` | oil factor < generic, > 0.1; other kinds keep 0.7; overlap takes the oil factor, non-overlap byte-identical; composite stays redder; oil as the bottom layer is never dimmed. |
| `components/SauceCanvasFallback.test.tsx` (**#502**) | the merged-heatmap **fallback dots**: a mixed oil + other-sauce group draws the oil dot in `bakeOilHex` and the other sauce unchanged; oil-only and no-oil groups keep raw colours. Negative control: removing the `bakedOil &&` branch from `SauceMergedCanvas.tsx` makes the first test fail. |

## Verification
- `tsc -b` clean; `oxlint`: no new findings (existing `react-refresh` warnings only).
- Existing `sauce-layers-b2`, `sauce-edge-475` E2E: all pass at both viewports (34/34 with the new spec). B2 single-source render golden and the B1 single-source golden: unchanged.
- Full vitest: see PR (CI) — <VITEST_SUMMARY>.

## Owner Human Verification (needed — visual change)
390×844 Preview: Free Cooking / Research, SAUCE step.
1. tomato → olive oil over the same area: the tomato stays visibly red under a soft oil sheen (compare `before-` / `after-`).
2. olive oil → tomato: tomato on top, oil visible at the edge.
3. tomato → pesto (unchanged), tomato alone, pesto alone, oil alone (unchanged).
4. continue to CHEESE, TOPPING, BAKE, RESULT: both layers still visible.
5. judge the value (0.3). If the oil sheen reads too faint over tomato, raise it (0.35 / 0.45 are in `compare-factors-390x844.png`); one constant.
Video (390×844) is delivered directly, not committed.

## #502
After this PR merges and CI is green the missing heatmap-fallback branch is pinned; #502 can then be closed by the Owner. It is **not** closed by this PR text.
