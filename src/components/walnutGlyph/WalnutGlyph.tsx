/**
 * Batch 20-A (pesto-noci): dedicated walnut (くるみ) glyph. UNWIRED — nothing imports this file
 * yet; `ingredients.ts`, `recipes.ts`, `IngredientGlyph.tsx` and `App.css` are untouched. A later
 * wiring PR decides how it is registered (`pieceVisual`).
 *
 * Two bake states of the same drawing (same silhouette, so a wiring PR can swap by bake level):
 * - `raw`: pale tan kernel (reads against baked cheese / dough).
 * - `baked`: toasted golden-brown kernel (stays separable from baked cheese by hue AND a dark outline).
 *
 * Renders at 1em like every other `IngredientGlyph` art, so the caller's font-size sets the size
 * (17.6 / 26 / 33.6 / 64 px are the sizes checked in the Result Report). No ids / gradients / CSS
 * classes needed: any number can share a page, and no stylesheet edit is required.
 * Decorative (`aria-hidden`), like the other glyphs.
 */

import { WALNUT_PALETTE, type WalnutState } from "./walnutPalette";

/** A walnut kernel: two lobes with a central groove (the classic "brain" silhouette). 64x64 box. */
const KERNEL = "M12 32 C9 19 22 10 31 15 C40 8 55 14 53 28 C59 37 50 51 38 48 C32 55 19 53 17 45 C9 44 8 37 12 32Z";
/** Light upper half (highlight) clipped by shape, kept as its own path so it needs no clipPath id. */
const KERNEL_LIGHT = "M14 30 C12 20 23 13 31 17 C39 11 52 16 50 27 C45 24 40 23 35 25 C31 21 22 22 14 30Z";
/** Central groove + side wrinkles. */
const FOLDS = "M31.5 16 C29 25 34 31 30.5 41 M19 25 C24 27 25 31 21 36 M45 22 C40 26 42 31 46 35 M25 44 C29 41 32 45 36 44";
/** A second, smaller broken piece so a scatter reads as "pieces", not one big nut. */
const PIECE = "M40 44 C38 38 46 34 52 38 C56 42 52 50 46 50 C43 51 41 48 40 44Z";
const PIECE_FOLD = "M44 39 C43 44 47 46 49 49";

export function WalnutGlyph({ state = "raw" }: { state?: WalnutState }) {
  const p = WALNUT_PALETTE[state];
  return (
    <svg
      className="ingredient-glyph ingredient-glyph--walnut-kernel"
      data-ingredient-visual="walnut-kernel"
      data-walnut-state={state}
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(-2 -4) scale(.98)">
        <path d={KERNEL} fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
        <path d={KERNEL_LIGHT} fill={p.light} />
        <path d={FOLDS} fill="none" stroke={p.fold} strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g transform="translate(4 8)">
        <path d={PIECE} fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
        <path d={PIECE_FOLD} fill="none" stroke={p.fold} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
