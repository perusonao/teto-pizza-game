import tetoImg from "../assets/characters/teto.webp";
import mitoImg from "../assets/characters/mito.webp";
import blueImg from "../assets/characters/blue.webp";
import { RECIPES } from "../data/recipes";
import type { DexState } from "../state/dex";

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
  onStartLunchRush: () => void;
  onOpenDex: () => void;
  onOpenShop: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  /** HOME Weekly Ranking route (Issue #87 Firebase Ranking 1.0 Phase 2A follow-up): opens the
   *  same `WeeklyRankingOverlay` App.tsx already mounts for Lunch Rush RESULT's own "ランキング
   *  を見る" button (`isRankingOpen`/`setRankingOpen`) -- HOME just gets a second entry point
   *  into that one piece of state, never a second ranking UI or fetch path. */
  onOpenRanking: () => void;
}

export function HomeScreen({
  pitzBalance,
  dex,
  ownedIngredientCount,
  totalIngredientCount,
  onStartFreePlay,
  onStartLunchRush,
  onOpenDex,
  onOpenShop,
  onOpenInventory,
  onOpenSettings,
  onOpenRanking,
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
        <div className="home-hero__bubble">今日はどんなピザを作ろう？</div>
        <div className="home-hero__cast">
          <img className="home-hero__sidekick home-hero__sidekick--mito" src={mitoImg} alt="ミト" />
          <img className="home-hero__teto" src={tetoImg} alt="テト" />
          <img className="home-hero__sidekick home-hero__sidekick--blue" src={blueImg} alt="ブルー" />
        </div>
      </section>

      <div className="home-cta-row">
        <button type="button" className="cta-button cta-button--primary cta-button--home" onClick={onStartFreePlay}>
          {"\u{1F355}"} ピザを作る
        </button>
        <button
          type="button"
          className="cta-button cta-button--secondary cta-button--home-secondary"
          onClick={onStartLunchRush}
        >
          {"\u{23F1}\u{FE0F}"} ランチラッシュ
        </button>
      </div>

      <section className="home-menu" aria-label="メニュー">
        <button type="button" className="home-menu__card" onClick={onOpenDex}>
          <span className="home-menu__icon">{"\u{1F4D6}"}</span>
          <span className="home-menu__label">ピザ図鑑</span>
          <span className="home-menu__sub">
            発見 {discoveredCount}/{totalRecipes}
          </span>
        </button>
        <button type="button" className="home-menu__card" onClick={onOpenShop}>
          <span className="home-menu__icon">{"\u{1F3EA}"}</span>
          <span className="home-menu__label">ショップ</span>
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
