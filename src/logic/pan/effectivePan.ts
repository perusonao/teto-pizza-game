/**
 * Square Dough F4-a (Issue #538, Epic #532): the one function that says which pan a round is cooked in once the player can
 * choose it (F4-b adds the ○/□ switch and the action that sets `PizzaState.pan`; nothing calls this yet).
 *
 * Order: the Preview / DEV override and the recipe's own pan (`activePanShape`, unchanged) -- then the player's explicit tray
 * (`PizzaState.pan === "tray"`, Square Dough F1) -- else round. Only the explicit value counts: `squareDough` is never read,
 * so a dough grid alone cannot make a round square (the same rule `signatureOfPizza` follows for the identity axis).
 *
 * With no `pan` on the pizza (every shipped pizza today) the result is exactly `activePanShape(recipe)`.
 */
import type { Recipe } from "../../data/recipes";
import { activePanShape } from "../../preview/panShapePreview";
import type { PanShape } from "./panShape";

export function effectivePanShape(
  recipe: Recipe | null | undefined,
  pizza: { readonly pan?: string | null } | null | undefined,
): PanShape {
  if (activePanShape(recipe) === "square") return "square";
  return pizza?.pan === "tray" ? "square" : "round";
}
