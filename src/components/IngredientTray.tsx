import type { CSSProperties } from "react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  ingredientsByCategory,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";

interface IngredientTrayProps {
  activeCategory: IngredientCategory;
  onChangeCategory: (category: IngredientCategory) => void;
  selectedIngredientId: string | null;
  onSelectIngredient: (ingredient: Ingredient) => void;
  /** Canonical OWNED ingredient ids (src/state/gameReducer.ts's `GameState.ownedIngredientIds`).
   *  A LOCKED/AVAILABLE_TO_BUY ingredient (Phase 3C-6+, e.g. `onion` before purchase) is never
   *  offered here -- Shop is where the player learns it exists ("🔒 あと★N" / buy button), not
   *  PREPARE. This is the primary ownership boundary; gameReducer's APPLY_SAUCE/PLACE_TOPPING
   *  enforce the same rule independently as a defense-in-depth backstop. */
  ownedIngredientIds: readonly string[];
}

export function IngredientTray({
  activeCategory,
  onChangeCategory,
  selectedIngredientId,
  onSelectIngredient,
  ownedIngredientIds,
}: IngredientTrayProps) {
  const items = ingredientsByCategory(activeCategory).filter((i) =>
    ownedIngredientIds.includes(i.id),
  );

  return (
    <div className="ingredient-panel">
      <div className="category-tabs">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-tab category-tab--${category} ${
              activeCategory === category ? "category-tab--active" : ""
            }`}
            onClick={() => onChangeCategory(category)}
          >
            {CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>
      <div className="ingredient-tray">
        {items.map((ingredient) => (
          <button
            key={ingredient.id}
            type="button"
            className={`ingredient-chip ${
              selectedIngredientId === ingredient.id ? "ingredient-chip--selected" : ""
            }`}
            onClick={() => onSelectIngredient(ingredient)}
          >
            {ingredient.category === "cheese" ? (
              <span className="ingredient-chip__cheese-slot">
                <span
                  className={`pizza-cheese pizza-cheese--${ingredient.id}`}
                  style={{ "--cheese-color": ingredient.color } as CSSProperties}
                />
              </span>
            ) : (
              <span className="ingredient-chip__emoji">{ingredient.emoji}</span>
            )}
            <span className="ingredient-chip__name">{ingredient.nameJa}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
