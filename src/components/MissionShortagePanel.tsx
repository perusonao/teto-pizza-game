import { getIngredient } from "../data/ingredients";
import type { IngredientShortage } from "../state/recipeDiscoveryState";
import { IngredientGlyph } from "./IngredientGlyph";

interface MissionShortagePanelProps {
  /** `recipeStockShortage(state.recipe, state)` -- never empty while this panel is shown. */
  shortages: readonly IngredientShortage[];
  onSkip: () => void;
}

/**
 * Issue #212 (H-R): the Lunch Rush ORDER screen for an order the player cannot make with the
 * stock they have. It replaces 「ピザを作る！」 (the reducer would refuse BEGIN_PREPARE anyway) with
 * what is missing -- each short material as `have/need` -- and the one way forward, skipping the
 * order. Skipping costs nothing but the seconds already on the clock; the recipe is then SOLD OUT
 * for the rest of the run. Restocking happens in the Shop after the run.
 */
export function MissionShortagePanel({ shortages, onSkip }: MissionShortagePanelProps) {
  return (
    <section className="mission-shortage-panel" aria-labelledby="mission-shortage-title">
      <h2 id="mission-shortage-title" className="mission-shortage-panel__title">
        {"⚠️"} 材料が足りません
      </h2>
      <ul className="mission-shortage-panel__list" aria-label="足りない材料">
        {shortages.map(({ ingredientId, need, have }) => {
          const ingredient = getIngredient(ingredientId);
          const name = ingredient?.nameJa ?? ingredientId;
          return (
            <li
              key={ingredientId}
              className="mission-shortage-panel__item"
              data-ingredient-id={ingredientId}
              aria-label={`${name} 在庫${have} 必要${need}`}
            >
              <span className="mission-shortage-panel__glyph" aria-hidden="true">
                {ingredient ? <IngredientGlyph ingredient={ingredient} /> : "?"}
              </span>
              <span className="mission-shortage-panel__name">{name}</span>
              <span className="mission-shortage-panel__count">
                <strong>{have}</strong>/{need}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mission-shortage-panel__note">補充はランチラッシュのあとでショップへ</p>
      <button type="button" className="cta-button cta-button--primary" onClick={onSkip}>
        この注文をスキップ
      </button>
    </section>
  );
}
