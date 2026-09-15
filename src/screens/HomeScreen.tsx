import tetoImg from "../assets/characters/teto.webp";
import { RECIPES } from "../data/recipes";
import type { DexState } from "../state/dex";

/**
 * HOME screen (Issue #24). The app's landing screen and navigation hub: Teto's pizzeria,
 * with a single primary CTA into free play and a 2x2 menu into the game's other existing
 * features (Lunch Rush, Dex, Shop). Purely presentational -- every number shown here (Pitz,
 * Dex progress) comes from `GameState`/`persistence.ts` via props, never hard-coded, and
 * every action is a callback into App.tsx, which owns all real state/reducers. This keeps
 * HOME and GAME (./GameScreen.tsx) as two thin views over one shared App-level state, not two
 * copies of game logic.
 *
 * "実績" (Achievements) has no backing feature yet (no mission/stat system beyond Dex/Lunch
 * Rush/Shop exists in this codebase) -- per Issue #24 it is rendered disabled/"近日公開"
 * rather than inventing fake progress for it. "設定" (Settings) is likewise decorative for
 * the same reason: there is no settings screen to open yet.
 */

interface HomeScreenProps {
  pitzBalance: number;
  dex: DexState;
  onStartFreePlay: () => void;
  onStartLunchRush: () => void;
  onOpenDex: () => void;
  onOpenShop: () => void;
}

export function HomeScreen({
  pitzBalance,
  dex,
  onStartFreePlay,
  onStartLunchRush,
  onOpenDex,
  onOpenShop,
}: HomeScreenProps) {
  const totalRecipes = RECIPES.length;
  const discoveredCount = dex.filter((e) => e.discovered).length;

  return (
    <div className="home-screen">
      <header className="app-header">
        <h1 className="app-header__title">テトのピザ屋さん</h1>
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
            disabled
            aria-disabled="true"
            title="設定は近日公開"
          >
            {"\u{2699}\u{FE0F}"}
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero__bubble">今日はどんなピザを作ろう？</div>
        <img className="home-hero__teto" src={tetoImg} alt="テト" />
      </section>

      <div className="home-cta-row">
        <button type="button" className="cta-button cta-button--primary cta-button--home" onClick={onStartFreePlay}>
          {"\u{1F355}"} ピザを作る
        </button>
      </div>

      <section className="home-menu" aria-label="メニュー">
        <button type="button" className="home-menu__card" onClick={onStartLunchRush}>
          <span className="home-menu__icon">{"\u{23F1}\u{FE0F}"}</span>
          <span className="home-menu__label">ランチラッシュ</span>
          <span className="home-menu__sub">ハイスコアに挑戦！</span>
        </button>
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
        <button
          type="button"
          className="home-menu__card home-menu__card--disabled"
          disabled
          aria-disabled="true"
        >
          <span className="home-menu__icon">{"\u{1F3C5}"}</span>
          <span className="home-menu__label">実績</span>
          <span className="home-menu__sub">近日公開</span>
        </button>
      </section>

      <footer className="home-footer">
        <p className="home-footer__message">{"\u{1F43E}"} いいピザは、いい一日をつくる！</p>
      </footer>
    </div>
  );
}
