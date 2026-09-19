import { RECIPES, type RecipeId } from "../data/recipes";
import type { DexState } from "../state/dex";
import { recipeCardState, type RecipeCardState } from "../state/pizzaSelect";
import { starLabel } from "../logic/scoring";
import { PizzaThumbnail } from "../components/PizzaThumbnail";

/**
 * Pizza Select (Issue #39 PS1/PS2). Reached from HOME's 「ピザを作る」 CTA, replacing the old
 * direct HOME -> GAME/ORDER hop -- the player now explicitly picks a recipe here before FREE
 * Making starts. Purely presentational, same "thin view over App-owned state" contract as
 * HomeScreen/GameScreen: every card's COMPLETED/NEW/LOCKED state is derived at render time from
 * `dex`/`ownedIngredientIds`/`RECIPES` (see ../state/pizzaSelect.ts) -- nothing here is
 * hard-coded or stored separately from Dex/progression's own truth.
 *
 * Lunch Rush is not reachable from here -- HOME's own「ランチラッシュ」card still routes there
 * directly (see App.tsx's `handleStartLunchRush`), unaffected by this screen.
 */

interface PizzaSelectScreenProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  onSelectRecipe: (recipeId: RecipeId) => void;
  onBack: () => void;
}

function cardAriaLabel(card: RecipeCardState): string {
  switch (card.kind) {
    case "COMPLETED":
      return `${card.recipe.nameJa}、最高評価${card.bestStars}つ星、BEST ${Math.round(card.bestScore)}`;
    case "NEW":
      return `${card.recipe.nameJa}、未挑戦`;
    case "LOCKED":
      return card.mystery ? "？？？、未解放" : `${card.recipe.nameJa}、未解放`;
  }
}

function RecipeSelectCard({
  card,
  onSelectRecipe,
}: {
  card: RecipeCardState;
  onSelectRecipe: (recipeId: RecipeId) => void;
}) {
  if (card.kind === "LOCKED") {
    return (
      <button
        type="button"
        className="pizza-select-card pizza-select-card--locked"
        disabled
        aria-disabled="true"
        aria-label={cardAriaLabel(card)}
      >
        <span className="pizza-select-card__lock-silhouette" aria-hidden="true">
          <span className="pizza-select-card__lock-icon">{"\u{1F512}"}</span>
        </span>
        <p className="pizza-select-card__lock-label">
          {card.mystery ? "？？？" : card.recipe.nameJa}
        </p>
        {card.unlockHint && <p className="pizza-select-card__unlock-hint">{card.unlockHint}</p>}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="pizza-select-card"
      aria-label={cardAriaLabel(card)}
      onClick={() => onSelectRecipe(card.recipe.id)}
    >
      {card.kind === "NEW" && <span className="pizza-select-card__badge">NEW</span>}
      <PizzaThumbnail recipe={card.recipe} />
      <p className="pizza-select-card__name">{card.recipe.nameJa}</p>
      {card.kind === "COMPLETED" && (
        <div className="pizza-select-card__mastery">
          <span className="pizza-select-card__stars">{starLabel(card.bestStars)}</span>
          <span className="pizza-select-card__best">BEST {Math.round(card.bestScore)}</span>
        </div>
      )}
    </button>
  );
}

export function PizzaSelectScreen({
  dex,
  ownedIngredientIds,
  onSelectRecipe,
  onBack,
}: PizzaSelectScreenProps) {
  return (
    <div className="pizza-select-screen">
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onBack}>
          {"\u{1F3E0}"} ホーム
        </button>
        <h1 className="app-header__title">作るピザを選ぼう！</h1>
      </header>

      <div className="pizza-select-grid" role="list" aria-label="レシピ一覧">
        {RECIPES.map((recipe) => {
          const card = recipeCardState(recipe, dex, ownedIngredientIds);
          return (
            <div key={recipe.id} role="listitem">
              <RecipeSelectCard card={card} onSelectRecipe={onSelectRecipe} />
            </div>
          );
        })}
      </div>

      <footer className="pizza-select-footer">
        <p className="pizza-select-footer__message">
          {"\u{1F355}"} 今日はどのピザに挑戦する？
        </p>
      </footer>
    </div>
  );
}
