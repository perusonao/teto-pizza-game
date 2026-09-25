import { useState, type CSSProperties } from "react";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import type { DexState } from "../state/dex";
import { buildRecipeSections, recipeCardState, type RecipeCardState } from "../state/pizzaSelect";
import { starLabel } from "../logic/scoring";
import { PizzaThumbnail } from "../components/PizzaThumbnail";

/**
 * Pizza Select (Issue #39 PS1/PS2; single-recipe pager by Issue #88 UX-4; rebuilt as a
 * sectioned browse grid + focused detail by Recipe Select 2.0A --
 * see docs/design/TETO_RECIPE-SELECT_2.0.md).
 *
 * Reached from HOME's 「ピザを作る」 CTA, replacing the old direct HOME -> GAME/ORDER hop -- the
 * player now explicitly picks a recipe here before FREE Making starts. Purely presentational,
 * same "thin view over App-owned state" contract as HomeScreen/GameScreen: every card's
 * COMPLETED/NEW/LOCKED state is derived at render time from `dex`/`ownedIngredientIds`/
 * `recipes` (see ../state/pizzaSelect.ts) -- nothing here is hard-coded or stored separately
 * from Dex/progression's own truth.
 *
 * 2.0A replaces the old "1画面に収め、前へ・次へ" single-recipe pager as the *primary*
 * navigation with a 2-column, section-headed grid (Layout F, docs/design/TETO_RECIPE-SELECT_2.0.md
 * sec. 4/15) -- every recipe is visible at a glance, scrolling to see more, rather than reaching
 * recipe #15 via 14 consecutive taps. Tapping any card (locked or unlocked) opens a focused
 * single-recipe detail/confirm view reusing the old pager panel's own layout, minus its
 * 前へ/次へ chrome, plus a 戻る-to-grid button -- this is the "confirm what I'm about to make"
 * moment sec. 5 of the design doc keeps, not a browsing mechanism. The grid itself stays
 * mounted (only hidden) while a card's detail is open, so returning to it keeps whatever scroll
 * position the player was at, without any extra saved-position state.
 *
 * Lunch Rush is not reachable from here -- HOME's own「ランチラッシュ」card still routes there
 * directly (see App.tsx's `handleStartLunchRush`), unaffected by this screen.
 */

interface PizzaSelectScreenProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  onSelectRecipe: (recipeId: RecipeId) => void;
  onBack: () => void;
  /** Progression 2.0 Phase 3-3 (Issue #198): opens Free Cooking directly (App.tsx's
   *  `handleStartFreeCook`) -- wired to a `preDiscoveryLocked` card's own CTA. Optional so
   *  existing test call sites that predate this phase keep compiling; a locked card's CTA is
   *  simply inert (no-op) if this is omitted. */
  onGoFreeCook?: () => void;
  /** Defaults to the full production catalog; overridable so a future filter (or a test
   *  exercising a larger mocked catalog) can hand the grid a different set without any change
   *  to this component. */
  recipes?: readonly Recipe[];
}

function cardStatusLabel(card: RecipeCardState): string {
  switch (card.kind) {
    case "COMPLETED":
      return `最高評価${card.bestStars}つ星、BEST ${Math.round(card.bestScore)}`;
    case "NEW":
      return card.preDiscoveryLocked ? "フリークッキングで発見しよう" : "未挑戦";
    case "LOCKED":
      return "未解放";
  }
}

function cardAriaLabel(card: RecipeCardState): string {
  const name = card.kind === "LOCKED" && card.mystery ? "？？？" : card.recipe.nameJa;
  return `${name}、${cardStatusLabel(card)}`;
}

/** Shared status/badge content between the compact grid card and the focused detail panel --
 *  kept as one function so the two views can never disagree about what a given card state
 *  shows (Fresh Design sec. 6's "select vs. Dex" content list). */
function CardStatusContent({ card }: { card: RecipeCardState }) {
  return (
    <>
      {card.kind === "COMPLETED" && (
        <div className="pizza-select-card__mastery">
          <span className="pizza-select-card__stars">{starLabel(card.bestStars)}</span>
          <span className="pizza-select-card__best">BEST {Math.round(card.bestScore)}</span>
        </div>
      )}
      {card.kind === "NEW" && card.preDiscoveryLocked && (
        <p className="pizza-select-card__unlock-hint">
          {"\u{1F3A8}"} フリークッキングで発見しよう
        </p>
      )}
      {card.kind === "NEW" && !card.preDiscoveryLocked && (
        <p className="pizza-select-card__status">未挑戦</p>
      )}
      {card.kind === "LOCKED" && card.unlockHint && (
        <p className="pizza-select-card__unlock-hint">{card.unlockHint}</p>
      )}
    </>
  );
}

function RecipeGridCard({ card, onSelect }: { card: RecipeCardState; onSelect: () => void }) {
  const isLocked = card.kind === "LOCKED";
  const displayName = isLocked && card.mystery ? "？？？" : card.recipe.nameJa;

  return (
    <button
      type="button"
      className={`pizza-select-grid-card${isLocked ? " pizza-select-grid-card--locked" : ""}`}
      aria-label={cardAriaLabel(card)}
      onClick={onSelect}
    >
      {card.kind === "NEW" && !card.preDiscoveryLocked && (
        <span className="pizza-select-card__badge">NEW</span>
      )}

      {isLocked ? (
        <span className="pizza-select-card__lock-silhouette" aria-hidden="true">
          <span className="pizza-select-card__lock-icon">{"\u{1F512}"}</span>
        </span>
      ) : (
        <PizzaThumbnail recipe={card.recipe} />
      )}

      {/* W1 I5b-4: names run up to 12 full-width chars; `--name-chars` lets the compact card shrink
          the font just enough to keep one line (see `.pizza-select-grid-card` in App.css). */}
      <p
        className={isLocked ? "pizza-select-card__lock-label" : "pizza-select-card__name"}
        style={{ "--name-chars": [...displayName].length } as CSSProperties}
      >
        {displayName}
      </p>

      <CardStatusContent card={card} />
    </button>
  );
}

function RecipeGrid({
  recipes,
  dex,
  ownedIngredientIds,
  onSelectCard,
  hidden,
}: {
  recipes: readonly Recipe[];
  dex: DexState;
  ownedIngredientIds: readonly string[];
  onSelectCard: (recipeId: RecipeId) => void;
  /** True while the focused detail view is open. Applied as `display: none` on this component's
   *  own scroll container (rather than unmounting it) so its scrollTop survives a round trip
   *  to detail and back (Fresh Design sec. 7). */
  hidden: boolean;
}) {
  const sections = buildRecipeSections(recipes);
  return (
    <div className="pizza-select-body" style={hidden ? { display: "none" } : undefined}>
      {sections.map((section) => (
        <section className="pizza-select-section" key={section.titleJa}>
          <h2 className="pizza-select-section__title">{section.titleJa}</h2>
          <div className="pizza-select-grid">
            {section.recipes.map((recipe) => {
              const card = recipeCardState(recipe, dex, ownedIngredientIds);
              return (
                <RecipeGridCard
                  key={recipe.id}
                  card={card}
                  onSelect={() => onSelectCard(recipe.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecipeDetailPanel({ card }: { card: RecipeCardState }) {
  const isLocked = card.kind === "LOCKED";
  const displayName = isLocked && card.mystery ? "？？？" : card.recipe.nameJa;

  return (
    <div
      className={`pizza-select-card${isLocked ? " pizza-select-card--locked" : ""}`}
      aria-label={cardAriaLabel(card)}
    >
      {card.kind === "NEW" && !card.preDiscoveryLocked && (
        <span className="pizza-select-card__badge">NEW</span>
      )}

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

      <CardStatusContent card={card} />
    </div>
  );
}

function RecipeDetail({
  card,
  onBackToGrid,
  onSelectRecipe,
  onGoFreeCook,
}: {
  card: RecipeCardState;
  onBackToGrid: () => void;
  onSelectRecipe: () => void;
  /** Progression 2.0 Phase 3-3 (Issue #198): only ever called from a `preDiscoveryLocked` NEW
   *  card's own CTA (below) -- Free Cooking is where a pre-first-discovery player actually makes
   *  this pizza. Optional so existing test call sites that predate this phase keep compiling. */
  onGoFreeCook?: () => void;
}) {
  const isLocked = card.kind === "LOCKED";
  const isPreDiscoveryLocked = card.kind === "NEW" && card.preDiscoveryLocked === true;

  return (
    <div className="pizza-select-detail">
      <button
        type="button"
        className="pizza-select-back-button"
        onClick={onBackToGrid}
        aria-label="レシピ一覧に戻る"
      >
        {"←"} 一覧へ戻る
      </button>

      <RecipeDetailPanel card={card} />

      {isPreDiscoveryLocked ? (
        <button
          type="button"
          className="cta-button cta-button--primary pizza-select-cta"
          onClick={onGoFreeCook}
        >
          {"\u{1F3A8}"} フリークッキングで探す
        </button>
      ) : (
        <button
          type="button"
          className="cta-button cta-button--primary pizza-select-cta"
          disabled={isLocked}
          aria-disabled={isLocked}
          onClick={() => {
            if (!isLocked) onSelectRecipe();
          }}
        >
          {"\u{1F355}"} このピザを作る！
        </button>
      )}
    </div>
  );
}

export function PizzaSelectScreen({
  dex,
  ownedIngredientIds,
  onSelectRecipe,
  onBack,
  onGoFreeCook,
  recipes = RECIPES,
}: PizzaSelectScreenProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<RecipeId | null>(null);
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;

  return (
    <div className="pizza-select-screen">
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onBack}>
          {"\u{1F3E0}"} ホーム
        </button>
        <h1 className="app-header__title">作るピザを選ぼう！</h1>
      </header>

      <RecipeGrid
        recipes={recipes}
        dex={dex}
        ownedIngredientIds={ownedIngredientIds}
        onSelectCard={setSelectedRecipeId}
        hidden={selectedRecipe !== null}
      />

      {selectedRecipe && (
        <RecipeDetail
          card={recipeCardState(selectedRecipe, dex, ownedIngredientIds)}
          onBackToGrid={() => setSelectedRecipeId(null)}
          onSelectRecipe={() => onSelectRecipe(selectedRecipe.id)}
          onGoFreeCook={onGoFreeCook}
        />
      )}
    </div>
  );
}
