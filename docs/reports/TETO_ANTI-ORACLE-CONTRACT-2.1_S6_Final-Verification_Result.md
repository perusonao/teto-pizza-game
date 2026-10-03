# Anti-Oracle Contract 2.1 — S6 Final Verification Result

Branch `claude/contract-2-1-s1-v1xfna`, base main `425a206`. Slices S1–S5.1 are done; Owner HV and Re-HV (Preview `6fde5a1`) passed.
Production flag `RESEARCH_IDENTIFY_ENABLED` default is **false** (unchanged). No save schema / migration change.

## Evidence
- `e2e/contract-2-1-final.spec.ts` (new): 9 real-gameplay flows × 2 viewports (390×844, 360×800), Chromium: typical ○/×/✓, real-gameplay maximum
  (sauce 1 + 4 cheeses + 3 toppings = **8 chips**; the "10 chips" figure is not reachable in Production because a pizza carries one sauce),
  topping over-cap, all-known, Hint-bought-before-cooking, retry, last stock, NEW PIZZA boundary, flag OFF.
  Each result asserts: no horizontal overflow, chips inside the panel, over-cap note unclipped, retry / notebook / recipe-select CTAs reachable,
  no CTA overlapping the panel / used list, last paragraph above the action bar, forbidden-wording + hidden-identity scan over text and aria,
  Notebook rows (only newly disclosed ○/×, no known ✓, no over-cap toppings, no absence wording).
- Screenshots: `docs/reports/screenshots/contract-2-1-s6/` (typical, max rows, over-cap, all-known, notebook, NEW PIZZA; both viewports).

## One layout defect found and fixed (S6 minimal fix)
The Research ORIGINAL action bar stacks three buttons and measures **168px** at both viewports, but the shared
`--result-action-bar-reserve` is 130px (sized for a two-button bar). When the card scrolled (e.g. the 8-chip case) the last paragraph sat under the bar
(390×844: 11px, 360×800: 80px). Fix: `.result-panel--research { --result-action-bar-reserve: 176px }` (bar 168 + 8 slack), applied only to the Research ORIGINAL card.
The new "last paragraph above the first CTA" assertion fails without the fix and passes with it.
This also applies to Production's Research ORIGINAL card (layout-only: extra bottom scroll space; no DOM / copy change).

## Results
- Full Vitest: 320 files, 5922 passed, 1 skipped. `tsc -b` clean. Lint: only the 2 existing warnings in `scoringV2.noSauceProfile.test.ts`.
- Chromium (both iphone projects): contract-2-1-final, research target / result / rows, progression2 ladder (CTA ≥ 44px), layout-contract, No.27 pesto-pollo: 50 passed.
