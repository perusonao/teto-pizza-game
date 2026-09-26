import tetoImg from "../assets/characters/teto.webp";
import mitoImg from "../assets/characters/mito.webp";
import blueImg from "../assets/characters/blue.webp";
import { RECIPES } from "../data/recipes";
import type { DexState } from "../state/dex";
import { homeBubbleJa } from "../state/homeBubble";

/**
 * HOME screen (Issue #24, visual pass Issue #39 PS3). The app's landing screen and
 * navigation hub -- "テトのピザ屋さん", a warm wood/brick pizzeria storefront -- with a primary
 * CTA into Pizza Select, a secondary CTA into Lunch Rush, and sub navigation into the game's
 * other existing features (Dex, Shop). Purely presentational -- every number shown here
 * (Pitz, Dex progress) comes from `GameState`/`persistence.ts` via props, never hard-coded,
 * and every action is a callback into App.tsx, which owns all real state/reducers. This keeps
 * HOME and GAME (./GameScreen.tsx) as two thin views over one shared App-level state, not two
 * copies of game logic. The hero shows all three official character portraits already used
 * elsewhere in the game (Teto/Mito/Blue, `../assets/characters/*.webp`) -- no generated or
 * substitute artwork.
 *
 * HOME Weekly Ranking route: the sub-navigation grid's 4th card was "実績" (Achievements,
 * disabled/"近日公開" -- no backing mission/stat system exists in this codebase yet, see Issue
 * #24). It's swapped here for "🏆 ランキング" (opens the same `WeeklyRankingOverlay` Lunch Rush
 * RESULT's "ランキングを見る" already opens, via `onOpenRanking`), keeping this grid's existing
 * 2x2 layout intact rather than growing it to a 5th, orphaned card. This is a UI-only swap --
 * Achievements' own feature/spec is untouched and simply not surfaced in this grid slot for
 * now; it returns once it has real content instead of a permanent placeholder. "設定"
 * (Settings) opens `SettingsOverlay` (Issue #89 Reset 1A) -- its first and, today, only content
 * is Full Game Reset.
 */

interface HomeScreenProps {
  pitzBalance: number;
  dex: DexState;
  /** Inventory Screen: read-only "how many ingredients do I currently own" sub-label -- the
   *  same `ownedIngredientIds` SSOT already threaded through GAME (see GameState), never a
   *  separately-maintained count. */
  ownedIngredientCount: number;
  totalIngredientCount: number;
  onStartFreePlay: () => void;
  /** Progression 2.0 Phase 3-2 (Issue #194): starts a free-cook round directly -- no recipe
   *  selection, every OWNED ingredient offered. Optional so existing test call sites compile; the
   *  button only renders when it is wired. */
  onStartFreeCook?: () => void;
  onStartLunchRush: () => void;
  /** Progression 2.0 Phase 3-3 (Issue #198): true before the player's first-ever discovery --
   *  Lunch Rush needs at least one discovered recipe to pick orders from that mean anything, so
   *  it stays closed (disabled, with an explanatory line) until then. Defaults to `false` so
   *  existing test call sites that predate this phase keep their exact pre-Phase-3-3 rendering. */
  lunchRushLocked?: boolean;
  onOpenDex: () => void;
  onOpenShop: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  /** HOME Weekly Ranking route (Issue #87 Firebase Ranking 1.0 Phase 2A follow-up): opens the
   *  same `WeeklyRankingOverlay` App.tsx already mounts for Lunch Rush RESULT's own "ランキング
   *  を見る" button (`isRankingOpen`/`setRankingOpen`) -- HOME just gets a second entry point
   *  into that one piece of state, never a second ranking UI or fetch path. */
  onOpenRanking: () => void;
  /** Progression 2.0 W1 Discovery 2.0 (W1-e): derived, never persisted. NEW materials waiting in
   *  the Shop (unlocked, not bought yet) -> a "NEW n" badge on the Shop card. */
  newShopMaterialCount?: number;
  /** A recipe was discovered this round (transient `justDiscovered`) -> "NEW" on the Dex card. */
  dexHasNew?: boolean;
  /** Undiscovered recipes cookable with what the player owns right now (DISCOVERABLE). */
  discoverableCount?: number;
}

export function HomeScreen({
  pitzBalance,
  dex,
  ownedIngredientCount,
  totalIngredientCount,
  onStartFreePlay,
  onStartFreeCook,
  onStartLunchRush,
  lunchRushLocked = false,
  onOpenDex,
  onOpenShop,
  onOpenInventory,
  onOpenSettings,
  onOpenRanking,
  newShopMaterialCount = 0,
  dexHasNew = false,
  discoverableCount = 0,
}: HomeScreenProps) {
  const totalRecipes = RECIPES.length;
  const discoveredCount = dex.filter((e) => e.discovered).length;

  return (
    <div className="home-screen">
      <header className="app-header app-header--shop-sign">
        <h1 className="app-header__title">{"\u{1F355}"} テトのピザ屋さん</h1>
        <div className="app-header__actions">
          <span className="app-header__pitz" aria-label={`Pitz残高 ${pitzBalance}`}>
            {"\u{1FA99}"} {pitzBalance}
          </span>
          <span
            className="app-header__dex-pill"
            aria-label={`レシピ図鑑 発見数 ${discoveredCount} / ${totalRecipes}`}
          >
            {"\u{1F451}"} レシピ {discoveredCount}/{totalRecipes}
          </span>
          <button
            type="button"
            className="app-header__settings-button"
            onClick={onOpenSettings}
            aria-label="設定"
          >
            {"\u{2699}\u{FE0F}"}
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero__oven-glow" aria-hidden="true" />
        <div className="home-hero__bubble">
          {homeBubbleJa({ lunchRushLocked, newShopMaterialCount, discoverableCount })}
        </div>
        <div className="home-hero__cast">
          <img className="home-hero__sidekick home-hero__sidekick--mito" src={mitoImg} alt="ミト" />
          <img className="home-hero__teto" src={tetoImg} alt="テト" />
          <img className="home-hero__sidekick home-hero__sidekick--blue" src={blueImg} alt="ブルー" />
        </div>
      </section>

      <div className="home-cta-row">
        {/* Progression 2.0 Phase 3-3 (Issue #198, Recipe Select design option C) + W1 I5b-4: the
            HOME CTAs always keep the same 2+1 skeleton -- 「ピザを作る」 / 「ランチラッシュ」 on the top
            row, a full-width フリークッキング row below -- in the same DOM order (focus/reading
            order = visual order). Before the player's first-ever discovery only the *emphasis*
            moves: フリークッキング (the actual discovery path) takes the primary styling as
            「フリークッキングで探す」, 「ピザを作る」 demotes to secondary but never disappears (it
            still opens Pizza Select, whose margherita card routes back into Free Cooking, see
            PizzaSelectScreen), and ランチラッシュ stays disabled. The earlier fresh-save layout put
            all three in one row, where each label wrapped into a 5-7 line pill at 390/360px. */}
        <button
          type="button"
          className={
            lunchRushLocked && onStartFreeCook
              ? "cta-button cta-button--secondary cta-button--home-secondary"
              : "cta-button cta-button--primary cta-button--home"
          }
          onClick={onStartFreePlay}
        >
          {"\u{1F355}"} ピザを作る
        </button>
        <button
          type="button"
          className="cta-button cta-button--secondary cta-button--home-secondary"
          onClick={onStartLunchRush}
          disabled={lunchRushLocked}
          aria-disabled={lunchRushLocked}
        >
          {"\u{23F1}\u{FE0F}"} ランチラッシュ
        </button>
        {onStartFreeCook &&
          (lunchRushLocked ? (
            <button
              type="button"
              className="cta-button cta-button--primary cta-button--home cta-button--free-cook cta-button--free-cook-lead"
              onClick={onStartFreeCook}
            >
              {"\u{1F3A8}"} フリークッキングで探す
            </button>
          ) : (
            <button
              type="button"
              className="cta-button cta-button--secondary cta-button--home-secondary cta-button--free-cook"
              onClick={onStartFreeCook}
            >
              {"\u{1F3A8}"} フリークッキング
            </button>
          ))}
        {lunchRushLocked && (
          <p className="home-lunch-rush-hint">
            {"\u{1F512}"} まず1枚ピザを発見しよう
          </p>
        )}
      </div>

      <section className="home-menu" aria-label="メニュー">
        <button type="button" className="home-menu__card" onClick={onOpenDex}>
          <span className="home-menu__icon">{"\u{1F4D6}"}</span>
          <span className="home-menu__label">
            ピザ図鑑
            {dexHasNew && <span className="home-menu__badge">NEW</span>}
          </span>
          <span className="home-menu__sub">
            発見 {discoveredCount}/{totalRecipes}
          </span>
        </button>
        <button type="button" className="home-menu__card" onClick={onOpenShop}>
          <span className="home-menu__icon">{"\u{1F3EA}"}</span>
          <span className="home-menu__label">
            ショップ
            {newShopMaterialCount > 0 && <span className="home-menu__badge">NEW {newShopMaterialCount}</span>}
          </span>
          <span className="home-menu__sub">所持 Pitz {pitzBalance}</span>
        </button>
        <button type="button" className="home-menu__card" onClick={onOpenInventory}>
          <span className="home-menu__icon">{"\u{1F9FA}"}</span>
          <span className="home-menu__label">材料</span>
          <span className="home-menu__sub">
            所持 {ownedIngredientCount}/{totalIngredientCount}種
          </span>
        </button>
        <button type="button" className="home-menu__card" onClick={onOpenRanking}>
          <span className="home-menu__icon">{"\u{1F3C6}"}</span>
          <span className="home-menu__label">ランキング</span>
          <span className="home-menu__sub">週間ランキング</span>
        </button>
      </section>

      <footer className="home-footer">
        <p className="home-footer__message">{"\u{1F43E}"} いいピザは、いい一日をつくる！</p>
      </footer>
    </div>
  );
}
