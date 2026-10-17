/**
 * Square-Pan Dough A (Issue #534, Epic #532): the pan shape a recipe is cooked on.
 *
 * `round` is the only shape any recipe uses today and is the default; `square` is the reusable second shape (initial application is
 * `grandma-pizza` only, and that recipe is added by Epic #532's step E, not here). No recipe sets the field in this slice, so the square
 * branch is unreachable from the game.
 *
 * This file has no imports on purpose: `Recipe` (./recipes.ts) imports the type, and the shape geometry (../logic/pan/*) imports this file.
 */
export type PanShape = "round" | "square";

export const DEFAULT_PAN_SHAPE: PanShape = "round";

/** The recipe's pan shape; an absent field (every recipe today) or an unknown recipe is `round`. */
export function resolvePanShape(recipe: { panShape?: PanShape } | null | undefined): PanShape {
  return recipe?.panShape ?? DEFAULT_PAN_SHAPE;
}
