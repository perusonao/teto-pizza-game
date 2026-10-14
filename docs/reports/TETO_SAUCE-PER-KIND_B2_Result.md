# Sauce per-kind ledger — B2 (layered painting) Result

Issue line: #489. Design: B1 / B2 / B3 detailed design. **B2 only** — B3 (per-kind gauge) is NOT started; PR #494 is on HOLD and
untouched; nothing is deployed; the multi-sauce feature is not published (B2 is not publishable on its own). Base: `main` `fca018e`
(B1 squash, #498). Drawing-only change: score / inventory / Research / Dex / Dinner / Completion Gate logic is untouched.

## What B2 does
- **Per-kind layers.** `sauceLayersOf` (`src/state/sauceLayers.ts`) groups B1's deposits per owner (`ownerOf`, first-use order = bottom
  layer first; the pending stroke joins its kind's layer). It returns `null` unless **two or more kinds have deposits**, so every
  single-source pizza renders through the historical single-heatmap JSX, byte for byte.
- **Rendering.** One `SauceHeatmapCanvas` per layer (own deposits, own colour, class `pizza-sauce-heatmap--kind-<id>`), then one
  `OverflowMarkerCanvas` per layer (own colour). The olive-oil class applies to the oil layer only. The full-pizza `.pizza-sauce-oil-sheen` is not drawn on layered pizzas (it is unmasked and would gloss the other sauces' areas — Codex P2); single-oil pizzas are unchanged.
  After a switch, earlier kinds keep colour and painted positions; switching back adds to the first kind's layer.
- **Overlap.** Plain alpha stacking (CSS unchanged — `App.css` untouched); later layers sit on earlier ones.
- Only change outside new files: `ownerOf` in `sauceLedger.ts` is now `export`ed.

## Single-source compatibility (the acceptance condition)
`PizzaStage.sauceRender.golden.test.tsx` + `__golden__/sauceRender.singleSource.json` (15 scenarios: empty, one-shot, field per sauce,
overflow, raw/perfect/burnt, cut, pending, wrong sauce) was committed **before** the render change (daa70ef) and is unedited: 15/15 pass.
Existing PizzaStage tests (152) pass unchanged. Browser regression `sauce-edge-475` + `tq-1d-no-sauce` pass at 390×844 and 360×800 (18/18).

## Verification
- tsc clean; oxlint: only pre-existing warnings; full Vitest 410 files / 7942 tests pass; build OK.
- New: `sauceLayers.test.ts` (unit), `PizzaStage.sauceLayers.test.tsx` (probe: order, colours, transparency props, cut copies, single
  no sheen), `e2e/sauce-layers-b2.spec.ts` (pixels via getImageData, layout unchanged, scrollWidth ≤ viewport, three kinds persist to
  CHEESE) — pass at 390×844 and 360×800.
- Mutation check: `>= 2` → `>= 1` fails 16 tests; reversed layer order fails 4 tests.

## Human Verification
Screenshots: `docs/reports/screenshots/sauce-layers-b2/` (two sauces, alpha as shipped; multiply = injected comparison only, both
viewports). Video (390×844, 23.6 s: tomato left → switch to pesto right → back to tomato across → next step) is delivered to the Owner
directly, not committed.

## Owner decision pending
- **O4 overlap look:** alpha stacking (shipped) vs multiply (darker overlap; comparison screenshots only).
- Deviations from the design doc: overflow markers are per kind (own colour) rather than pooled; a one-shot kind with no deposits has no
  layer; `ownerOf` exported from the B1 file.
