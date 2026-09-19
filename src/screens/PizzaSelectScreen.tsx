import { useState } from "react";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import type { DexState } from "../state/dex";
import {
  clampPagerIndex,
  pagerIndicatorKind,
  recipeCardState,
  type RecipeCardState,
} from "../state/pizzaSelect";
import { starLabel } from "../logic/scoring";
import { PizzaThumbnail } from "../components/PizzaThumbnail";

/**
 * Pizza Select (Issue #39 PS1/PS2, rebuilt as a single-screen pager by Issue #88 UX-4).
 * Reached from HOME's 「ピザを作る」 CTA, replacing the old direct HOME -> GAME/ORDER hop -- the
 * player now explicitly picks a recipe here before FREE Making starts. Purely presentational,
 * same "thin view over App-owned state" contract as HomeScreen/GameScreen: every card's
 * COMPLETED/NEW/LOCKED state is derived at render time from `dex`/`ownedIngredientIds`/
 * `recipes` (see ../state/pizzaSelect.ts) -- nothing here is hard-coded or stored separately
 * from Dex/progression's own truth.
 *
 * Issue #88: replaces the old scrolling `pizza-select-grid` of all 7 cards with a single
 * recipe shown at a time (`currentIndex`, clamped at both ends -- never wraps) plus 前へ/次へ
 * paging, sized to fit 390x844 without vertical scroll. `recipeCardState`'s own
 * COMPLETED/NEW/LOCKED branches (including フガッサ's `mysteryLock` "？？？" treatment) are
 * reused completely unchanged -- this is a layout change, not a data-model change, and the
 * pager's own chrome (the position indicator) is index-only and never reads a locked recipe's
 * name/ingredients. `recipes` defaults to the full production `RECIPES` array but is a plain
 * prop so a future Chapter/Tier entry point can hand the pager a filtered `visibleRecipes`
 * subset without this component changing at all (Issue #88's "Chapter-ready" requirement).
 *
 * Lunch Rush is not reachable from here -- HOME's own「ランチラッシュ」card still routes there
 * directly (see App.tsx's `handleStartLunchRush`), unaffected by this screen.
 */

interface PizzaSelectScreenProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  onSelectRecipe: (recipeId: RecipeId) => void;
  onBack: () => void;
  /** Defaults to the full production catalog; overridable so a future Chapter/Tier filter (or
   *  a test exercising a larger mocked catalog) can hand the pager a different set without any
   *  change to this component -- see Issue #88's Chapter-ready requirement. */
  recipes?: readonly Recipe[];
}

function cardStatusLabel(card: RecipeCardState): string {
  switch (card.kind) {
    case "COMPLETED":
      return `最高評価${card.bestStars}つ星、BEST ${Math.round(card.bestScore)}`;
    case "NEW":
      return "未挑戦";
    case "LOCKED":
      return "未解放";
  }
}

function cardAriaLabel(card: RecipeCardState): string {
  const name = card.kind === "LOCKED" && card.mystery ? "？？？" : card.recipe.nameJa;
  return `${name}、${cardStatusLabel(card)}`;
}

function RecipeDetailPanel({ card }: { card: RecipeCardState }) {
  const isLocked = card.kind === "LOCKED";
  const displayName = isLocked && card.mystery ? "？？？" : card.recipe.nameJa;

  return (
    <div
      className={`pizza-select-card${isLocked ? " pizza-select-card--locked" : ""}`}
      aria-label={cardAriaLabel(card)}
    >
      {card.kind === "NEW" && <span className="pizza-select-card__badge">NEW</span>}

      {isLocked ? (
        <span className="pizza-select-card__lock-silhouette" aria-hidden="true">
          <span className="pizza-select-card__lock-icon">{"\u{1F512}"}</span>
        </span>
      ) : (
        <PizzaThumbnail recipe={card.recipe} />
      )}

      <p className={isLocked ? "pizza-select-card__lock-label" : "pizza-select-card__name"}>
        {displayName}
      </p>

      {card.kind === "COMPLETED" && (
        <div className="pizza-select-card__mastery">
          <span className="pizza-select-card__stars">{starLabel(card.bestStars)}</span>
          <span className="pizza-select-card__best">BEST {Math.round(card.bestScore)}</span>
        </div>
      )}

      {card.kind === "NEW" && <p className="pizza-select-card__status">未挑戦</p>}

      {isLocked && card.unlockHint && (
        <p className="pizza-select-card__unlock-hint">{card.unlockHint}</p>
      )}
    </div>
  );
}

function PositionIndicator({ total, index }: { total: number; index: number }) {
  if (pagerIndicatorKind(total) === "dots") {
    return (
      <div className="pizza-select-dots" aria-label={`${index + 1} / ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`pizza-select-dot${i === index ? " pizza-select-dot--active" : ""}`}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="pizza-select-counter" aria-label={`${index + 1} / ${total}`}>
      {index + 1} / {total}
    </div>
  );
}

export function PizzaSelectScreen({
  dex,
  ownedIngredientIds,
  onSelectRecipe,
  onBack,
  recipes = RECIPES,
}: PizzaSelectScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const index = clampPagerIndex(currentIndex, recipes.length);
  const recipe = recipes[index];
  const card = recipeCardState(recipe, dex, ownedIngredientIds);
  const isLocked = card.kind === "LOCKED";
  const atStart = index <= 0;
  const atEnd = index >= recipes.length - 1;

  const goPrev = () => setCurrentIndex((i) => clampPagerIndex(i - 1, recipes.length));
  const goNext = () => setCurrentIndex((i) => clampPagerIndex(i + 1, recipes.length));

  return (
    <div className="pizza-select-screen">
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onBack}>
          {"\u{1F3E0}"} ホーム
        </button>
        <h1 className="app-header__title">作るピザを選ぼう！</h1>
      </header>

      <div className="pizza-select-pager">
        <RecipeDetailPanel card={card} />

        <div className="pizza-select-nav">
          <button
            type="button"
            className="pizza-select-nav-button pizza-select-nav-button--prev"
            aria-label="前のレシピ"
            onClick={goPrev}
            disabled={atStart}
          >
            {"←"} 前へ
          </button>
          <PositionIndicator total={recipes.length} index={index} />
          <button
            type="button"
            className="pizza-select-nav-button pizza-select-nav-button--next"
            aria-label="次のレシピ"
            onClick={goNext}
            disabled={atEnd}
          >
            次へ {"→"}
          </button>
        </div>

        <button
          type="button"
          className="cta-button cta-button--primary pizza-select-cta"
          disabled={isLocked}
          aria-disabled={isLocked}
          onClick={() => {
            if (!isLocked) onSelectRecipe(recipe.id);
          }}
        >
          {"\u{1F355}"} このピザを作る！
        </button>
      </div>
    </div>
  );
}
