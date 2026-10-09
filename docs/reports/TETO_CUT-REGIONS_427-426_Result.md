# CUT regions (#427 / #426) — Result Report (Owner iPhone HV PASS)

Branch `claude/cut-regions-427-426`, base `main` `dfe80d2`. No PR yet; **not merged**. Plan and Owner Decisions:
https://github.com/perusonao/teto-pizza-game/issues/427#issuecomment-6071980595 (Decision 5 = Y, Preview URL query, two-stage HV).

## What changed

| Area | Change |
|---|---|
| `src/logic/cut/regions.ts` (new) | One region computation for evaluation and drawing: the ideal circle as a 720-gon (area error 1.27e-5 = 0.09 u²), one half-plane clip per chord, regions ≤ 1e-6 u² dropped. `isSignificantRegion`: area ≥ 0.1% of the pizza (7.24 u²) **and** width `4·area/perimeter` ≥ 1.0 u. Constants named (`DEFAULT_CUT_SIGNIFICANCE`). |
| `geometry.ts` | `computePieceAreas` returns **all** geometric regions (sum ≈ `CIRCLE_AREA`). The 96×96 sampling grid is gone. |
| `evaluation.ts` / `state.ts` / `gameReducer.ts:1127` | `evaluateCut(lines, config?, shape?)`: only **through** cuts (`isThroughCut(line, shape)`, the same test the drawing uses) split the pizza and feed `completeness` / `centerAccuracy` (Decision 5 = Y); only **significant** regions are pieces (`actualPieceCount` = `pieceAreas.length`, `uniformity`). `completedCutCount` is still every committed line. Duplicate cuts are not filtered (#288). |
| `pieces.ts` (#426) | When every through cut is straight (every cut the game can make) the pieces are the exact regions — **every** region is drawn, however small; the side combination is read at the region's centroid. A curved traced path (no gesture makes one) keeps the old sample grid. `PizzaStage.tsx` unchanged. |
| Preview only | `?cutAreaPct=0.10&cutMinWidth=1.0` (`src/preview/cutThresholdPreview.ts`), read once, only behind `VITE_PREVIEW_MODE`, never saved; `PreviewBadge` shows `· CUT 0.20%/1.5u` when overridden; `CutDebugPanel` shows `全領域 N / 有意 M` and the thresholds. |

Unchanged: CUT gesture, knife, piece rendering, `cutScore` formula and weights, ResultPanel / MissionServePanel wording, scoring / save / economy, `CutEvaluation` type.

## Behaviour (real code)

3 cuts through the centre at 0° / 60°, the third (120°) shifted `d` u:

| d (u) | before (`main`) RESULT | drawn before | now RESULT | now drawn |
|---|---|---|---|---|
| 0 | 6 | 6 | 6 | 6 |
| 0.7–1.05 | **7** | 6 | 6 | 7 |
| 1.5–3.5 | 7 | 7 | **6** | 7 |
| ≥ 3.6 | 7 | 7 | 7 | 7 |

Boundaries (identical for rotations 0/10/20/30/45°): d = 3.5 → 6, 3.75 → 7; parallel gap 0.45 u → no significant strip, 0.55 u → one; shallow crossing 1.15° → thin wedge, 1.3° → real; rim sliver 0.7 u → not a piece, 0.8 u → piece. A stroke stopping > 6 u short of the rim is a groove: no region, no completeness, no centre. Groove-only 3 strokes: 100 → 3.3; 2 through + 1 groove: 68.3 → 61.7. Known, unchanged: duplicate through cut still 68.3 (#288).

## Tests (all on this branch's head)

| Check | Result |
|---|---|
| `tsc -b`, `oxlint` | clean (existing warnings in other files only) |
| vitest, full | 6779 passed / 1 skipped / 0 failed (363 files), includes the new files below |
| `regions.test.ts` (new, 25) | 720-gon area, half-circle difference, sum ≈ CA (< 0.1 u²), order independence, convexity / centroid, boundaries from both sides, d sweep 0–8, speed bound |
| `evaluation.test.ts` (+17) | #427 triangle, 4/8 slices, #426 strips, Decision-5 rows (3.3 / 61.7 / no inflation), stop-short k = 5.5 / 6 / 6.5 / 8, residual duplicate 68.3, shape-based through test |
| `pieces.test.ts` (+10) | #426: gaps 0.25 / 0.5 / 1 / 3 → 3 pieces, 1° wedge → 4, parallel 3 → 4, tiny triangle drawn, `placeTopping` on a tiny piece, drawn − counted = not significant |
| `cutCountParity.test.ts` (new) | 120 seeded arrangements × 6 silhouettes (ideal, shrunk 12 / 20, ellipse, biased, larger 58): evaluation and drawing use the same through set; drawn − counted = not-significant regions |
| `cutThresholdPreview.test.ts` / `PreviewBadge.cut.test.tsx` | parser (ranges, `0x10`, `1e-1`, repeats, NaN, …), per-parameter fallback, read-once, no storage writes, production never reads the query |
| `cutThresholdPreview.gate.test.ts` | real `vite build`s: production bundle has **0** of `cutAreaPct` / `cutMinWidth` / `cut-threshold-preview-v1` / `data-cut-threshold-preview`; Preview bundle has all (positive control) |
| E2E (dev server, 390×844 + 360×800) | new `cut-regions-427.spec.ts` 8/8 (real drags along dough-unit coordinates); related suites (`pizza-cutting-phase4b`, `cut-skip-failed-bake`, `finished-pizza-visual-2.0`, `result-1screen-2.0`, `result-detail-bar-overlap-423`, `viewport-1screen`, `dinner-mission`, `lunch-rush-result-ranking`, `making-ui-1screen`, `original-result-duplicate-notice`): 131 passed / 11 skipped / 0 failed |
| Preview build, coordinate-injected (`tools/cut-preview-hv`) | 30/30 at 390×844 and 360×800: default, `0.05%/0.5u`, `0.20%/1.0u`, invalid, out-of-range, reload back to defaults; the drawn count never moves with the override; nothing stored |

## Human Verification

Stage 1 (automatic, coordinate-injected) — done, table above. Run it again with
`npx playwright test -c tools/cut-preview-hv/playwright.config.ts` (builds the real Preview bundle locally).

Stage 2 — **Owner iPhone HV: PASS** on Preview source `4d88496` (the HEAD that was HV'd; the commit after it is docs only).

| Case | Result on the iPhone |
|---|---|
| Normal 6-way (3 cuts through the centre) | 6等分 · CUT 95 |
| 7-way (third cut clearly off) | 7等分（目標 6等分） · CUT 81 |
| Two close cuts + one crossing cut (#426) | 5等分 · CUT 50; **no right-edge clipping** |
| Stopped stroke (grooves) | 1等分 · CUT 3 |

Scope of this PR beyond `bcee4e5` (the first HV build): `4d88496` adds the straight-only contract (Owner Decision, case B):
`ADD_CUT_LINE` reduces a multi-point `path` to its first and last point (`normalizeCutLine`, `trace.ts`); the input is never mutated; the rim check,
cut limit and scoring are unchanged. The legacy 64-sample grid in `pieces.ts` is kept only for a direct pure call with a curved path; a reducer test
shows the game flow never reaches it (it fails if the normalisation is removed).

### Right-edge clipping seen on `bcee4e5` — cause NOT determined (recorded as such)

On `bcee4e5` the Owner saw the pizza's right end cut off vertically on RESULT after two close cuts + one crossing cut. It did not recur on `4d88496`
(HV above). A WebKit investigation (Playwright WebKit at DPR 2 and 3, 390×844 / 360×800, 5 hand-picked cases + 40 random right-edge-biased cases,
layer-by-layer experiments, canonical vs `main` source) **could not reproduce it**, so the cause is unknown and **no rendering change was made**
(`PizzaStage.tsx` / `App.css` untouched). Region coverage was checked separately (1920 close-pair + crossing configurations: 0% uncovered area).
The automatic missing-area detector had limited sensitivity, so this is "not reproduced", not "ruled out". Investigation branches (not for merge):
`claude/webkit-edge-probe-427`, `claude/webkit-edge-search-427`. No further investigation is planned (Owner decision).

## Risks / not done

- Thresholds (0.1% / 1.0 u) are initial; they are tuned on the device, not by tests. The score step at the 6↔7 boundary (~10 points) remains; making it continuous is #288.
- Regions stay on the ideal circle; irregular dough is #429. `isThroughCut(line, shape)` is shared, so the through set agrees with the drawing for every silhouette.
- Pieces are drawn per region (each copies the pizza layers): up to 16 regions for 5 cuts, as before; a tiny region costs one more copy.
- WebKit CI: a manual run on `4d88496` (run 622) failed twice on one unrelated test, `e2e/cooking-tray-family-expanded.spec.ts:166` (ingredient-tray chip row `scrollLeft`: 341 vs 0 at 390×664, then 1 vs 0 at 390×844); the same spec passed on `f85d160`. It does not touch CUT. The PR run is the authority.
- WebKit: the pointer position may round to whole pixels there; the dev-server E2E uses generous margins (nothing within ~1 u of a boundary).
- Not in scope / untouched: #417, #429, #288 duplicate-line handling, scoring / save / economy.
