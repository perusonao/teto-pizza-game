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
}

export function IngredientTray({
  activeCategory,
  onChangeCategory,
  selectedIngredientId,
  onSelectIngredient,
}: IngredientTrayProps) {
  const items = ingredientsByCategory(activeCategory);

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
              <span className="ingredient-chip__disc-slot">
                <span
                  className={`pizza-cheese pizza-cheese--${ingredient.id}`}
                  style={{ "--cheese-color": ingredient.color } as CSSProperties}
                />
              </span>
            ) : ingredient.id === "salami" ? (
              <span className="ingredient-chip__disc-slot">
                <span
                  className="pizza-topping-disc pizza-topping-disc--salami"
                  style={{ "--topping-color": ingredient.color } as CSSProperties}
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
