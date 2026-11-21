import { createElement, type ComponentType, type ReactElement } from "react";
import { ParmigianoSprinkle } from "./ParmigianoSprinkle";
import { SPRINKLE_BOX_PX } from "./sprinkleLayout";

/**
 * Topping Visuals 2.0 (Issue #824): the PLACED-only drawings, looked up by ingredient id. This is a separate registry on purpose (Owner D1): it
 * leaves `Ingredient`, `ingredients.ts` and the selection glyphs (`IngredientGlyph`) untouched, so the tray chip, drag preview, inventory, Dex
 * thumbnail and Reference keep their current look. Only IngredientPieceVisual with `surface="placed"` reads it.
 *
 * Strict guards (Owner D6): an ingredient is added here only by an Owner-approved PR; `eggplant` in particular must never gain a `pieceVisual`
 * through this file (a registered drawing is not a catalogue `pieceVisual`, so nothing downstream changes for any other cooking method).
 * PR-1 registers parmigiano only.
 */
const PLACED_VISUALS: ReadonlyMap<string, ComponentType> = new Map<string, ComponentType>([["parmigiano", ParmigianoSprinkle]]);

/** The placed drawing for an ingredient id as an element, or `null` when none is registered (the caller then draws its usual representation). */
export function renderPlacedVisual(ingredientId: string): ReactElement | null {
  const Visual = PLACED_VISUALS.get(ingredientId);
  return Visual ? createElement(Visual) : null;
}

export function placedVisualIds(): readonly string[] {
  return [...PLACED_VISUALS.keys()];
}

/**
 * The size of the placed box in CSS px for a registered drawing that needs more room than the default 28px glyph box (a wide sprinkle). `undefined` = keep the default.
 * IngredientPieceVisual sets it as `--cheese-glyph-size` on the piece's wrapper, only on the placed surface.
 */
const PLACED_BOX_PX: ReadonlyMap<string, number> = new Map<string, number>([["parmigiano", SPRINKLE_BOX_PX]]);

export function placedBoxPx(ingredientId: string): number | undefined {
  return PLACED_BOX_PX.get(ingredientId);
}

