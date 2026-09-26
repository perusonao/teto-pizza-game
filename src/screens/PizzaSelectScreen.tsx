import { useState, type CSSProperties } from "react";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import { buildPizzaSelectView, type DiscoveredRecipeCard, type PizzaSelectPrompt } from "../state/pizzaSelect";
import { starLabel } from "../logic/scoring";
import { PizzaThumbnail } from "../components/PizzaThumbnail";

/**
 * Pizza Select (Issue #39 PS1/PS2; sectioned browse grid + focused detail by Recipe Select 2.0A --
 * see docs/design/TETO_RECIPE-SELECT_2.0.md).
 *
 * Progression 2.0 W1 Discovery 2.0 (W1-a3 / W1-c; OD-DISC-1 = A′, OD-DISC-3, OD-DISC-5,
 * OD-DISC-9 -- docs/reports/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_FRESH-DESIGN.md §5.2): this is
 * the "cook a pizza you know" screen.
 * - Only DISCOVERED recipes are cards: name, finished preview, ★ / BEST and the guided CTA.
 * - Undiscovered recipes never appear -- no name, preview, ingredients, lock hint or card; each
 *   chapter heading only counts them ("発見 x/m", L1). New pizzas are found in Free Cooking.
 * - At most one anonymous prompt card on top points to Free Cooking (something is discoverable
 *   with what the player owns, or Dex 0) or to the Shop (a needed material is waiting there).
 * - Chapters are the canonical 6 / 9 / 10 partition (../state/recipeChapters.ts).
 * - The EP1 chain is not read: no "○○を1枚完成させると解禁" hints, no LOCKED cards.
 * - A discovered recipe whose finite material is out of stock stays visible, with its guided CTA
 *   disabled and a Shop link (F-15: ownership is not cookability; App/reducer enforce it too).
 * The grid stays mounted (only hidden) while a card's detail is open, so its scroll position
 * survives a round trip.
 */

interface PizzaSelectScreenProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  /** Shop ledger and stock -- the discovery state and cookability are derived from them. */
  unlockedForShopIngredientIds?: readonly string[];
  inventory?: InventoryState;
  onSelectRecipe: (recipeId: RecipeId) => void;
  onBack: () => void;
  /** Opens Free Cooking directly (App.tsx's `handleStartFreeCook`) -- the discovery path. */
  onGoFreeCook?: () => void;
  /** Opens the Shop overlay (the SHOP prompt card, and an out-of-stock recipe's detail). */
  onOpenShop?: () => void;
  /** The recipe discovered this very round, badged NEW (transient). */
  newlyDiscoveredId?: string | null;
  /** Defaults to the full production catalog; overridable for tests. */
  recipes?: readonly Recipe[];
}

function cardAriaLabel(card: DiscoveredRecipeCard): string {
  const status = `最高評価${card.bestStars}つ星、BEST ${Math.round(card.bestScore)}`;
  return `${card.recipe.nameJa}、${status}${card.cookable ? "" : "、材料が足りません"}`;
}

/** Shared between the compact grid card and the focused detail panel. */
function CardStatusContent({ card }: { card: DiscoveredRecipeCard }) {
  return (
    <>
      <div className="pizza-select-card__mastery">
        <span className="pizza-select-card__stars">{starLabel(card.bestStars)}</span>
        <span className="pizza-select-card__best">BEST {Math.round(card.bestScore)}</span>
      </div>
      {!card.cookable && <p className="pizza-select-card__unlock-hint">{"\u{1F3EA}"} 材料が足りません</p>}
    </>
  );
}

function RecipeGridCard({ card, onSelect }: { card: DiscoveredRecipeCard; onSelect: () => void }) {
  const displayName = card.recipe.nameJa;
  return (
    <button
      type="button"
      className={`pizza-select-grid-card${card.cookable ? "" : " pizza-select-grid-card--locked"}`}
      aria-label={cardAriaLabel(card)}
      onClick={onSelect}
    >
      {card.isNew && <span className="pizza-select-card__badge">NEW</span>}
      <PizzaThumbnail recipe={card.recipe} />
      {/* W1 I5b-4: names run up to 12 full-width chars; `--name-chars` lets the compact card shrink
          the font just enough to keep one line (see `.pizza-select-grid-card` in App.css). Only a
          discovered recipe's own, displayed name ever reaches it (NF-7). */}
      <p className="pizza-select-card__name" style={{ "--name-chars": [...displayName].length } as CSSProperties}>
        {displayName}
      </p>
      <CardStatusContent card={card} />
    </button>
  );
}

/** The one anonymous prompt card (L1): never a recipe's name, preview or ingredients. */
function PromptCard({
  prompt,
  onGoFreeCook,
  onOpenShop,
}: {
  prompt: Exclude<PizzaSelectPrompt, null>;
  onGoFreeCook?: () => void;
  onOpenShop?: () => void;
}) {
  const toShop = prompt.kind === "SHOP";
  const message =
    prompt.kind === "FIRST_DISCOVERY"
      ? "まずはフリークッキングで1枚目のピザを見つけよう！"
      : prompt.kind === "DISCOVERABLE"
        ? "まだ見つけていないピザが、今の材料で作れるかも！"
        : "ショップに新しい材料が入荷しているよ！";
  return (
    <div className={`pizza-select-prompt${toShop ? " pizza-select-prompt--shop" : ""}`}>
      <p className="pizza-select-prompt__message">
        {toShop ? "\u{1F3EA}" : "\u{1F3A8}"} {message}
      </p>
      <button
        type="button"
        className="cta-button cta-button--primary pizza-select-prompt__cta"
        onClick={toShop ? onOpenShop : onGoFreeCook}
      >
        {toShop ? <>{"\u{1F6D2}"} ショップを見る</> : <>{"\u{1F3A8}"} フリークッキングで探す</>}
      </button>
    </div>
  );
}

function RecipeDetail({
  card,
  onBackToGrid,
  onSelectRecipe,
  onOpenShop,
}: {
  card: DiscoveredRecipeCard;
  onBackToGrid: () => void;
  onSelectRecipe: () => void;
  onOpenShop?: () => void;
}) {
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

      <div
        className={`pizza-select-card${card.cookable ? "" : " pizza-select-card--locked"}`}
        aria-label={cardAriaLabel(card)}
      >
        {card.isNew && <span className="pizza-select-card__badge">NEW</span>}
        <PizzaThumbnail recipe={card.recipe} />
        <p className="pizza-select-card__name">{card.recipe.nameJa}</p>
        <CardStatusContent card={card} />
        {!card.cookable && onOpenShop && (
          <button type="button" className="cta-button cta-button--secondary pizza-select-detail__shop" onClick={onOpenShop}>
            {"\u{1F6D2}"} ショップで補充する
          </button>
        )}
      </div>

      <button
        type="button"
        className="cta-button cta-button--primary pizza-select-cta"
        disabled={!card.cookable}
        aria-disabled={!card.cookable}
        onClick={() => {
          if (card.cookable) onSelectRecipe();
        }}
      >
        {"\u{1F355}"} このピザを作る！
      </button>
    </div>
  );
}

export function PizzaSelectScreen({
  dex,
  ownedIngredientIds,
  unlockedForShopIngredientIds = [],
  inventory = {},
  onSelectRecipe,
  onBack,
  onGoFreeCook,
  onOpenShop,
  newlyDiscoveredId = null,
  recipes = RECIPES,
}: PizzaSelectScreenProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<RecipeId | null>(null);
  const view = buildPizzaSelectView(
    { dex, ownedIngredientIds, unlockedForShopIngredientIds, inventory },
    recipes,
    newlyDiscoveredId,
  );
  const cards = view.chapters.flatMap((c) => c.cards);
  const selected = cards.find((c) => c.recipe.id === selectedRecipeId) ?? null;

  return (
    <div className="pizza-select-screen">
      <header className="app-header">
        <button type="button" className="app-header__home-button" onClick={onBack}>
          {"\u{1F3E0}"} ホーム
        </button>
        <h1 className="app-header__title">作るピザを選ぼう！</h1>
      </header>

      <div className="pizza-select-body" style={selected ? { display: "none" } : undefined}>
        {view.prompt && <PromptCard prompt={view.prompt} onGoFreeCook={onGoFreeCook} onOpenShop={onOpenShop} />}
        {view.chapters.map((chapter) => (
          <section className="pizza-select-section" key={chapter.chapter}>
            <h2 className="pizza-select-section__title">
              {chapter.titleJa}
              <span className="pizza-select-section__count">
                発見 {chapter.discovered}/{chapter.total}
              </span>
            </h2>
            {chapter.cards.length > 0 && (
              <div className="pizza-select-grid">
                {chapter.cards.map((card) => (
                  <RecipeGridCard
                    key={card.recipe.id}
                    card={card}
                    onSelect={() => setSelectedRecipeId(card.recipe.id)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {selected && (
        <RecipeDetail
          card={selected}
          onBackToGrid={() => setSelectedRecipeId(null)}
          onSelectRecipe={() => onSelectRecipe(selected.recipe.id)}
          onOpenShop={onOpenShop}
        />
      )}
    </div>
  );
}
