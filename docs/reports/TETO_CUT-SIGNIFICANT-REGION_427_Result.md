# #427 / #426 — CUT significant-region scoring (Result Report, pre-HV)

Branch `claude/cut-significant-region-scoring-uacgea`. Product source SHA on Preview: **`dece8cce740442e9093390100e6b2dd5f701ed02`**.
Status: **waiting for Owner iPhone Human Verification.** Not merged, not deployed to Production, no PR.

## What changed
- `src/logic/cut/regions.ts` (new): one convex-region computation (720-gon circle clipped by each straight cut). Every geometric region is returned; a region counts as a piece only if area >= 0.1% of the circle **and** width (4·area/perimeter) >= 1.0 u. Constants are named (`SIGNIFICANT_REGION_AREA_FRACTION`, `SIGNIFICANT_REGION_MIN_WIDTH`).
- `geometry.ts`: `computePieceAreas` delegates to it (all regions, sum ≈ `CIRCLE_AREA`). `pieces.ts`: the 64-grid is gone; every region is drawn, keyed by its centroid.
- `evaluation.ts` / `state.ts` / `gameReducer.ts`: `evaluateCut(lines, config, shape)`; only through cuts (`isThroughCut(line, shape)`, same test as the renderer) split the pizza, raise `completeness` or enter `centerAccuracy`. `completedCutCount` is still every committed line. Duplicate lines are not excluded (#288).
- `ADD_CUT_LINE` reduces a multi-point `path` to its first and last point (Owner Decision: straight cuts only; input never mutated; rim check and cut limit unchanged). `CutLine.path` / `trace.ts` docs updated.
- Preview only (`VITE_PREVIEW_MODE`): `?cutAreaPct=` (0.02–0.50, default 0.10) and `?cutMinWidth=` (0.2–2.0, default 1.0), strict `^\d+(\.\d+)?$`, an invalid value falls back per parameter, read once, never saved. `PreviewBadge` shows `· CUT 0.50%/2.0u` while overridden. `PizzaStage.tsx` is untouched.

## Tests
| Check | Result |
|---|---|
| Full Vitest | 363 files, 6833 passed, 1 skipped |
| typecheck / build | PASS. lint: only pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| Production dist contains `cutAreaPct` / `cutMinWidth` | **0 files** (Preview build: 1 file, the positive control). Also gated by `cutThresholdPreview.bundle.gate.test.ts` |
| Chromium E2E 390×844 + 360×800 | new spec 10/10; existing CUT/result/visual specs passed (skips are viewport-specific by design) |
| WebKit | **not run here** (no WebKit executable in this environment, not installed on purpose). CI `e2e-webkit.yml` is the authority |

## The cases (Preview-mode build of dece8cc, 390×844, automated pointer drags at exact dough coordinates)
| Case | Pieces drawn | RESULT |
|---|---|---|
| 6-way (0°/60°/120° through the centre) | 6 | 6等分 |
| 7-way (third line 6 u off centre) | 7 | 7等分（目標 6等分） |
| Tiny region (third line 1 u off centre) | 7 (the sliver is drawn) | 6等分 (the sliver does not count) |
| Stopped stroke (2 through + 1 stopped 20 u short) | 4 | 4等分（目標 6等分） |
| 3 stopped strokes only | 0 pieces (grooves) | 1等分 |
| Override `?cutAreaPct=0.50&cutMinWidth=2.0`, 7-way | 7 | 6等分, badge `CUT 0.50%/2.0u` |

Before (main `dfe80d2`): tiny region drew 6 and said 7; stopped stroke drew 4 and said 6; three grooves said 6等分.
Screenshots: `docs/reports/screenshots/cut-significant-region-427/{before,after}/` (390×844 and 360×800; `cut-*` = CUT step, `result-*` = RESULT).

## Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| hv-427-A-six-seven-micro.mp4 | 390×844 | 46.8 s | 0.95 MB | PASS |
| hv-427-B-groove-override.mp4 | 390×844 | 30.5 s | 0.63 MB | PASS |

H.264, decoded end to end with ffmpeg. Download: delivered directly in the session (not committed). Recorded against a **local build with the exact Preview settings** (`VITE_PREVIEW_MODE=1`, base `/teto-pizza-game-preview/`, source dece8cc), because this environment's network policy blocks `perusonao.github.io`.

Video Verification: PASS

## Preview
`deploy-from-source.yml` run 106 (ref `dece8cce…`, success) → preview commit `884b277` → `pages.yml` run 106 on `884b277` (success).
URL: https://perusonao.github.io/teto-pizza-game-preview/ (live availability could not be checked from this environment). The Preview save key is separate from Production's.

## What the Owner should check on iPhone
Add `?cutAreaPct=…&cutMinWidth=…` to the Preview URL to compare thresholds in the same session.
1. Three cuts through the centre, five times: always 6 pieces and 6等分.
2. Third cut shifted by less than a finger width: looks like 6, says 6等分 (a hairline seventh sliver may be drawn).
3. Third cut clearly off (a triangle about 12 px a side or more): looks like 7, says 7等分.
4. Two cuts very close together: the thin band is drawn; RESULT does not contradict what you see.
5. A stroke that stops well short of the rim: a groove only, not counted as a split.
6. Note whether the ~10-point CUT score step near the threshold feels right (for #288).

Known / out of scope: duplicate-line padding (#288), curved-path scoring (#288), irregular-dough regions (#429).
