# Topping Size Classes 1.0 — S2b-1 Result (Issue #479)

Slice S2b-1 only: a Preview / DEV comparison switch for multiplier sets A and B. Base: `main` `4b7efdb` (includes S2a #505). **Production multipliers are unchanged: every class is 1.0.** The final multipliers are decided after Owner HV (S2c).

## Changed
- `src/preview/toppingScalePreview.ts` (new) — `?toppingScale=a|b` (exactly one `a` or `b`; absent, `off`, repeated, upper case or anything else = no override). `activeToppingRankScale(id)` is the only consumer-facing function; its override branch is behind the static `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`, so a production `vite build` drops the query name, the marker and the `window.location` read (pinned by `toppingScalePreview.gate.test.ts`, real production and Preview builds). Read once per page load; never saved.
- `src/data/toppingSizeClass.ts` — `toppingRankScale(id, set = TOPPING_RANK_SCALE)`; the A / B candidate values are the S1 ones, untouched.
- `PizzaStage.tsx`, `PizzaVisualPieces.tsx` — call `activeToppingRankScale`; the Canvas mozzarella box is `Math.round(CHEESE_RENDER_MODE.sizePx * rankScale)` (70 -> A 88 [87.5], B 81 [80.5], off 70).
- `PreviewBadge.tsx` — `· SIZE A` / `· SIZE B` (display only), so an HV video shows which set it recorded.
- Tests: `toppingScalePreview.test.ts`, `toppingScalePreview.gate.test.ts`, `pieceRankScale.preview.test.tsx`, `pieceRankScale.test.tsx` (boundary list), `e2e/topping-size-s2b1-compare.spec.ts` (capture only; skipped unless `TOPPING_SCALE_CAPTURE_DIR` is set).

## Canvas mozzarella
Only the CSS box changes. The bitmap grid (64 by default) and the canvas `width`/`height` attributes are untouched, so the drawing ratio (square) and the pool shape are unchanged; the box is a whole px. No new bitmap resolution is chosen: the bitmap was already upscaled (64 px grid shown at 70 CSS px, DPR 2-3), so at 88 / 81 px it is upscaled a little more. Moving the larger boxes to the 96 grid is a possible S2b-2 item for Owner HV to judge, not done here.

## Not changed
Placement animation / wrapper transform, CUT (`TOPPING_REACH`), scoring, save, `MIN_TOPPING_DISTANCE`, tray chip (26px), drag preview (30px), inventory, hint chips, `PizzaThumbnail`: untouched (S2a boundary tests still pass). No fit correction. No production default change.

## Measured on-screen sizes (Chromium, dev server, `?toppingScale=` off / a / b; same at 390x844 and 360x800)
Box of the inner piece element, px (emoji box is the 28px font's line box):

| ingredient (class) | off | A | B |
|---|---|---|---|
| corn (xs) | 34.9 | 21.0 (x0.6) | 24.5 (x0.7) |
| black-olive (s) | 34.9 | 28.0 (x0.8) | 29.7 (x0.85) |
| mushroom (m) | 34.9 | 34.9 (x1) | 34.9 (x1) |
| mozzarella (l, Canvas box) | 70 | 88 (x1.25) | 81 (x1.15) |
| bacon (l) | 34.9 | 43.7 (x1.25) | 40.2 (x1.15) |
| basil (xl) | 36.7 | 55.1 (x1.5) | 47.8 (x1.3) |

Images and JSON: `docs/reports/screenshots/topping-size-s2b1/` (`compare-390x844.png`, `compare-360x800.png`: off | A | B; per-mode PNG + JSON). Placement-state only (PREPARE, Free Cooking); BAKE / CUT / RESULT with the switch is not captured here.

## Observations for the Owner (not decisions)
- black-olive stays visually heavy beside mushroom even at A (the geometric-emoji fill issue from the Fresh Audit): the multiplier alone does not fix it; fit correction is S4.
- The Canvas mozzarella's raw lump is only about 0.4 of its box, so before the bake it still reads smaller than bacon / basil at the same class; the finished pool is about 0.66 of the box (A: about 58 px).
- At A the xl basil (55 px) is about twice the minimum piece spacing (about 25 px): overlap with neighbours is likely in dense placements. Not measured on a dense pizza here.

## #503 (Ingredient Icons 2.0 Pilot A)
Still open and unmerged (head `ca5f1c3`), so none of its SVG glyphs (sausage / hot-dog / feta / ricotta) are in `main` or in these captures; none of the six pilot ingredients is a #503 ingredient. When it merges, sausage / hot-dog draw as 1em SVGs (the multiplier applies through the font-size) with a different fill ratio than their emoji, so their comparison and any fit correction must be re-measured after #503. #503 is not touched.

## Human Verification
Applies from this slice for the comparison itself (the Owner compares A / B on a Preview). This PR changes no production pixel, and no shared Preview was updated.
