import type { CSSProperties } from "react";
import type { Ingredient } from "../data/ingredients";
import { IngredientGlyph } from "./IngredientGlyph";

interface IngredientPieceVisualProps {
  ingredient: Ingredient;
  /** Extra class(es) appended to the rendered piece -- e.g. PizzaStage's bake `meltClass`. */
  className?: string;
  /** Extra inline style merged onto the rendered piece -- e.g. PizzaStage's continuous bake
   *  melt/toast/char transform+filter for cheese, or its dedicated topping roast-tint filter
   *  for every other ingredient (see ../logic/bakeVisual.ts's `cheeseVisualFrame`/
   *  `toppingVisualFrame` and PizzaStage.tsx's own `cheeseStyle`/`toppingPieceStyle`). Applied
   *  as-is on whichever branch below actually renders. */
  style?: CSSProperties;
}

/**
 * Issue #32 Phase 1: the single physical-piece renderer for a placed ingredient, shared by
 * every context that draws one (player pizza toppings, the ingredient tray chip/drag-preview,
 * and the Margherita Reference popover) so they can never independently drift into different
 * representations of the same ingredient (e.g. Reference's old standalone 🧀 emoji vs. the
 * player's physical CSS mozzarella). A "cheese" ingredient renders the shared `.pizza-cheese`
 * physical shape (or, when it declares a `pieceVisual`, that SVG inside the same wrapper); every other
 * ingredient renders its emoji / dedicated glyph.
 */
export function IngredientPieceVisual({ ingredient, className, style }: IngredientPieceVisualProps) {
  const isCheese = ingredient.category === "cheese";

  // A cheese WITHOUT a dedicated `pieceVisual` (un-migrated, mozzarella included) keeps its CSS physical shape.
  if (isCheese && !ingredient.pieceVisual) {
    return (
      <span
        className={["pizza-cheese", `pizza-cheese--${ingredient.id}`, className]
          .filter(Boolean)
          .join(" ")}
        style={{ "--cheese-color": ingredient.color, ...style } as CSSProperties}
      />
    );
  }

  // Ingredient Icons 2.0 (#438): a cheese WITH a `pieceVisual` (feta / ricotta) draws its SVG on the pizza too, so the shape the tray shows is the shape
  // that is placed. The `.pizza-cheese` / `.pizza-cheese--<id>` wrapper stays (bake melt transform + filter, size-class / RESULT scale, selectors); the
  // `--glyph` modifier only drops the CSS cheese's own background / ring and sizes the box for the SVG.
  return (
    <span
      className={(isCheese
        ? ["pizza-cheese", `pizza-cheese--${ingredient.id}`, "pizza-cheese--glyph", className]
        : ["ingredient-piece-visual__emoji", className]
      )
        .filter(Boolean)
        .join(" ")}
      style={isCheese ? ({ "--cheese-color": ingredient.color, ...style } as CSSProperties) : style}
    >
      <IngredientGlyph ingredient={ingredient} />
    </span>
  );
}
