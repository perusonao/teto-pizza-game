/**
 * Issue #39 PS3 / Issue #47 Slice B: the single shared ring of dough-percent slot positions
 * used to lay out a recipe's non-sauce pieces deterministically from its own
 * `requiredIngredients` order -- originally authored for `../components/PizzaThumbnail.tsx`
 * (Pizza Select's card preview) and reused as-is by `../data/playerReference.ts` (Issue #47
 * Finding F/H's player-facing Making reference) so both consumers draw from one canonical
 * generated layout table instead of two independently hand-tuned coordinate schemes. Every
 * current recipe's total non-sauce piece count (4-8, see `../data/recipes.ts`) fits within
 * this 8-slot ring with no wraparound collision.
 */
export const PIECE_RING_POSITIONS = [
  { x: 50, y: 24 },
  { x: 73, y: 36 },
  { x: 76, y: 63 },
  { x: 58, y: 79 },
  { x: 38, y: 79 },
  { x: 22, y: 63 },
  { x: 25, y: 36 },
  { x: 50, y: 52 },
] as const;
