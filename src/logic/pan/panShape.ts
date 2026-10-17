/**
 * Square-Pan Dough A (Issue #534, Epic #532): which pan a recipe's dough is shaped and baked in.
 *
 * Authority: docs/reports/TETO_SQUARE-DOUGH_Design-Lock-Addendum.md (D1: reusable design, first used by
 * `grandma-pizza` only). `"round"` is every shipped recipe today and the default, so an absent
 * `Recipe.panShape` means exactly the pre-existing round pizza. Pure data, no DOM, no React, no timing.
 *
 * Inert in Production: no `RECIPES` entry sets the field yet (pinned by panShape.test.ts); the first
 * recipe to do so is #521 (E), after D and F.
 */

export type PanShape = "round" | "square";

export const PAN_SHAPES: readonly PanShape[] = ["round", "square"];

/** Every shipped recipe, and what an absent `Recipe.panShape` resolves to. */
export const DEFAULT_PAN_SHAPE: PanShape = "round";

export function isPanShape(value: unknown): value is PanShape {
  return value === "round" || value === "square";
}

/**
 * The single place a recipe's pan is resolved. An absent or unrecognised value (never produced by typed data, but
 * possible from a future build's data) resolves to the default round pan, never to a thrown error or a guess.
 */
export function resolvePanShape(source: object | null | undefined): PanShape {
  // `object`, not `{ panShape?: PanShape }`: a recipe literal that never mentions the field (every shipped one) is
  // exactly the case this exists for, and TypeScript rejects it as a "weak type" with no overlap.
  const value = (source as { readonly panShape?: unknown } | null | undefined)?.panShape;
  return isPanShape(value) ? value : DEFAULT_PAN_SHAPE;
}
