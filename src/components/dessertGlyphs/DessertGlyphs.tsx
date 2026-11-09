/**
 * Batch 23 (dessert recipes: apple-cinnamon-dessert / smore-dessert-pizza / nutella-dessert-pizza): dedicated glyphs for apple, banana, chocolate, graham-cracker, marshmallow and powdered-sugar.
 * UNWIRED -- nothing imports this file yet; `ingredients.ts`, `recipes.ts`, `IngredientGlyph.tsx` and `App.css` are untouched. A later wiring PR decides how each is registered (`pieceVisual`).
 * Shapes are PROVISIONAL (not Owner-approved). Each renders at 1em in a 64x64 box, is decorative (`aria-hidden`) and uses no ids / gradients / CSS classes beyond the shared `ingredient-glyph` pair,
 * so any number can share a page and no stylesheet edit is needed. The silhouettes are deliberately different from each other: round fan slice (apple), crescent rounds (banana), square bars (chocolate),
 * perforated tan rectangle (graham-cracker), two soft cylinders (marshmallow), a scatter of tiny dots (powdered-sugar).
 */
import type { ReactElement } from "react";
import { DESSERT_PALETTE, type DessertGlyphId } from "./dessertPalette";

type Body = (p: (typeof DESSERT_PALETTE)[DessertGlyphId]) => ReactElement;

const BODIES: Record<DessertGlyphId, Body> = {
  // A thin apple wedge seen from the side: red skin arc, pale flesh, a seed.
  apple: (p) => (
    <>
      <path d="M8 22 C20 8 44 8 56 22 C50 44 36 54 32 54 C28 54 14 44 8 22Z" fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 24 C24 15 40 15 50 24 C46 40 36 48 32 48 C28 48 18 40 14 24Z" fill={p.light} />
      <path d="M32 24 L32 40" stroke={p.mark} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="32" cy="33" rx="2.6" ry="4" fill={p.mark} />
    </>
  ),
  // Two overlapping banana rounds with a pale centre and a dark seed dot.
  banana: (p) => (
    <>
      <circle cx="24" cy="30" r="17" fill={p.fill} stroke={p.outline} strokeWidth="3" />
      <circle cx="24" cy="30" r="10" fill={p.light} />
      <circle cx="24" cy="30" r="2.4" fill={p.mark} />
      <circle cx="42" cy="38" r="15" fill={p.fill} stroke={p.outline} strokeWidth="3" />
      <circle cx="42" cy="38" r="8.5" fill={p.light} />
      <circle cx="42" cy="38" r="2.2" fill={p.mark} />
    </>
  ),
  // Two chocolate bar pieces with a 2x2 grid of squares.
  chocolate: (p) => (
    <>
      <rect x="6" y="14" width="34" height="30" rx="4" fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M23 14 V44 M6 29 H40" stroke={p.mark} strokeWidth="2.6" />
      <path d="M10 18 H20 M27 18 H36" stroke={p.light} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="34" y="34" width="24" height="20" rx="3" fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M46 34 V54" stroke={p.mark} strokeWidth="2.4" />
    </>
  ),
  // A tan rectangle with a row of pin holes and a broken corner piece.
  "graham-cracker": (p) => (
    <>
      <path d="M8 16 H44 L52 24 V50 H8Z" fill={p.fill} stroke={p.outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 20 H42 L48 26" fill="none" stroke={p.light} strokeWidth="2.4" strokeLinecap="round" />
      <g fill={p.mark}>
        <circle cx="16" cy="32" r="2" /><circle cx="26" cy="32" r="2" /><circle cx="36" cy="32" r="2" /><circle cx="46" cy="32" r="2" />
        <circle cx="16" cy="42" r="2" /><circle cx="26" cy="42" r="2" /><circle cx="36" cy="42" r="2" /><circle cx="46" cy="42" r="2" />
      </g>
    </>
  ),
  // Two soft white cylinders seen from above with a pink shadow.
  marshmallow: (p) => (
    <>
      <rect x="6" y="12" width="30" height="26" rx="12" fill={p.fill} stroke={p.outline} strokeWidth="3" />
      <path d="M12 20 Q20 15 30 19" fill="none" stroke={p.light} strokeWidth="3" strokeLinecap="round" />
      <path d="M10 32 Q21 36 33 31" fill="none" stroke={p.mark} strokeWidth="2.6" strokeLinecap="round" />
      <rect x="26" y="30" width="30" height="24" rx="11" fill={p.fill} stroke={p.outline} strokeWidth="3" />
      <path d="M32 38 Q40 33 51 37" fill="none" stroke={p.light} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 48 Q41 52 53 47" fill="none" stroke={p.mark} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // A dusting: many small outlined dots (white on pale dough needs the outline).
  "powdered-sugar": (p) => (
    <g fill={p.fill} stroke={p.outline} strokeWidth="2">
      {[
        [14, 16, 5], [30, 12, 4], [46, 18, 5], [22, 30, 4.5], [40, 32, 5], [54, 36, 4], [12, 44, 4.5], [28, 50, 5], [46, 52, 4.5], [34, 22, 3],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  ),
};

export const DESSERT_GLYPH_IDS = Object.keys(BODIES) as DessertGlyphId[];

export function DessertGlyph({ id }: { id: DessertGlyphId }) {
  const body = BODIES[id](DESSERT_PALETTE[id]);
  return (
    <svg
      className="ingredient-glyph"
      data-ingredient-visual={`${id}-dessert`}
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
