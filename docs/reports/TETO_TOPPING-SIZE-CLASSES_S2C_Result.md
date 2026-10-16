# Topping Size Classes 1.0 — S2c Result (Issue #479)

Base: `main` `7ce7307` + the S2b-2 comparison report on this branch. Implements the Owner decisions after `TETO_TOPPING-SIZE-CLASSES_S2B2_Final-Compare.md`.

## Changed
- **Production multipliers = set B** (`xs 0.7 / s 0.85 / m 1 / l 1.15 / xl 1.3`): `TOPPING_RANK_SCALE` in `src/data/toppingSizeClass.ts` (was all 1). Same wiring as S2a (`--piece-rank-scale` on on-pizza pieces only): PizzaStage whole / cut-half spans and Reference wrappers. Tray chips, drag preview, inventory, hint chips and thumbnails stay unscaled.
- **mozzarella is exempt** (`TOPPING_RANK_SCALE_EXEMPT_IDS`): its rank scale is 1 in production and in every Preview candidate, so the Canvas box stays 70 px and the bake melt / `cheesePoolReachPercent` input are byte-identical. Its class stays `l` (data). This also applies to A / B in the Preview (A / B no longer enlarge mozzarella).
- **Candidate C (Preview / DEV only, unconfirmed)**: `?toppingScale=c` = B x per-id correction, defined in `src/preview/toppingScalePreview.ts` (`TOPPING_FIT_CANDIDATE_C`): black-olive 0.85, jalapeno 0.85, pepperoni 0.9, salami 0.9, bacon 1.1, spinach 1.1, arugula 1.1. Values are rounded to 3 places (black-olive / jalapeno = 0.722, bacon = 1.265, spinach / arugula = 1.43). `?toppingScale=b` is now identical to production; badge `SIZE C` added. The corrections are not in `toppingSizeClass.ts` and not in the production bundle (new marker `topping-fit-candidate-c-v1` added to the real-build gate `toppingScalePreview.gate.test.ts`).
- Capture spec `e2e/topping-size-final-compare.spec.ts` now runs A / B / C over 11 recipes.

## Not changed
mozzarella size / melt, scoring, save, economy, CUT (`TOPPING_REACH`, S3), `MIN_TOPPING_DISTANCE`, tray / drag preview sizes, shared Preview, production deploy. CUT reach for large / xl pieces (S3) and apparent-size confirmation after the #503 SVG glyphs are separate tasks.

## Tests
Full vitest 8187 passed (2 skipped), typecheck clean. Updated: `toppingSizeClass.test.ts` (B values, exemption, fit multiplication), `pieceRankScale.test.tsx` (production values per piece / wrapper), `pieceRankScale.preview.test.tsx` (A / B / C on the stage, mozzarella box 70 px under every candidate, M1 fallback), `toppingScalePreview.test.ts` (a / b / c resolution, C values, B = production for every scatter id, no leakage of C into production), `toppingScalePreview.gate.test.ts` (C marker absent from production, present in Preview).

## Comparison images (390x844 and 360x800, PREPARE, Reference coordinates)
`docs/reports/screenshots/topping-size-s2c/<recipe>-iphone-<viewport>.png` = A | B (production) | C; per-piece boxes and overlaps in `metrics/`. 11 recipes: margherita, capricciosa, pizza-portuguesa, meat-lovers, jamon-serrano-pizza, puttanesca-pizza, quattro-formaggi, breakfast-pizza, calabresa-argentina, jalapeno-popper-pizza, spinach-artichoke-pizza. No piece leaves the dough, no horizontal overflow, and no non-mozzarella pair overlaps by 30% or more in any mode (the remaining box overlaps involve mozzarella's transparent Canvas padding, unchanged by this slice). The "before" (all 1.0) images are in `topping-size-s2b1/` and `topping-size-final/`.

## For the iPhone check (Owner)
Open a Preview with `?toppingScale=c` (B = no query) and compare B vs C on Apple Color Emoji: black-olive / jalapeno vs mushroom, pepperoni / salami vs ham, bacon vs mushroom, spinach / arugula vs basil; 360x800 capricciosa / puttanesca legibility of oregano, capers, corn at xs 0.7; mozzarella unchanged; BAKE / CUT / RESULT views (not captured here: PREPARE only). Whether C's values become production is decided after that.

## Human Verification
The 390x844 video is delivered directly to the Owner (not committed). Screenshots are above.
