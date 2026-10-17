# Topping Size Classes 1.0 — S2a Result (Issue #479)

Slice S2a only: wire `--piece-rank-scale` onto the on-pizza pieces with every multiplier fixed at 1.0. Base: `main` `86f1df5`. **No visual change.**

## Changed
- `src/data/toppingSizeClass.ts` — `TOPPING_RANK_SCALE` (all five classes = 1) and `toppingRankScale(id)`, reading the S1 `toppingSizeClass`. Not one of the A / B candidate sets; S2b replaces these values.
- `src/App.css` — `--piece-rank-scale` (default 1) multiplies, by composition with the existing factors, exactly three rules: `.ingredient-piece-visual__emoji` font-size (covers emoji and the 1em SVG glyphs), `.pizza-cheese` transform, `.pizza-cheese--parmigiano` transform (keeps its `rotate`).
- `src/components/PizzaStage.tsx` — the topping span (whole and cut-half alike) sets the variable; the Canvas mozzarella `sizePx` is multiplied by it (70 × 1 = 70).
- `src/components/PizzaVisualPieces.tsx` — `renderPizzaVisualPieces` wrapper sets it, so ReferenceThumbnail / ReferencePreview / PlayerReferencePreview use the same value as PizzaStage.
- `src/components/pieceRankScale.test.tsx`, `src/data/toppingSizeClass.test.ts` — regression tests.

## Routes covered
Emoji, dedicated SVG glyph (via 1em font-size), M1 CSS cheese, rotated parmigiano, Canvas mozzarella (`sizePx`), cut-half spans, Reference views. The wrapper `.pizza-topping` is never scaled, so the landing `@keyframes`, its `translate(-50%, -50%)`, the bake `filter` (inner element) and CUT clipping are untouched.

## Not changed
Tray chip (26px), drag preview (30px), inventory, hint / shortage chips: none reads or sets the variable (stylesheet and source-boundary tests). `PizzaThumbnail` (Pizza Select card) has its own scale system (its `.pizza-cheese` transform is overridden by `--thumb-piece-scale`) and is left alone; whether it follows the rank is an S2b decision. CUT (`TOPPING_REACH`), scoring, save, `MIN_TOPPING_DISTANCE`, `PlacedTopping`: untouched. No A/B enabling, no `fit` correction, no preview switch (S2b).

## Human Verification
No pixel changes (all multipliers 1.0), so the HV video / screenshots are not required for this slice (CLAUDE.md:見た目/操作が変化しない変更). They apply from S2b.

## Interaction with open PRs
#494 / #503 / #504 / #468 / #478 are not touched. Text-level overlap: #468 edits the `style=` expression near `PizzaStage.tsx` `IngredientPieceVisual` (already conflicting with main) — a different line from the `rankScale` additions here. #494 edits the SAUCE region of `PizzaStage.tsx` and `App.css`, not the topping span or these three rules.
