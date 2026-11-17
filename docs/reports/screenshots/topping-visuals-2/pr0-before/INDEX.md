# Topping Visuals 2.0 PR-0 — 現状（before）画像の一覧（Issue #824）

撮影対象: main `a5583622292ff6203b8c979f4c410389dbc05d15` の `npm run dev`（ローカル、`TETO_TEST_HOOKS=1`）。
ブラウザ: Chromium（headless、Playwright の実ポインター入力）、`deviceScaleFactor: 2`。**WebKit・実機 iPhone Safari・共有 Preview・Production では撮影していない。**
状態: Free Cook の通常操作。使い捨てセーブ（ブラウザコンテキスト内のみ）で対象食材 + mozzarella / basil / tomato-sauce を所持。焼成は「ジャスト」。
詳細・計測・設計: `../../../TETO_TOPPING-VISUALS-2_PR0_Baseline-and-Design.md`。

命名: `<食材ID>_<viewport>_<状態>.png`

| 状態 | 内容 |
|---|---|
| `1-selection-tray` | 選択トレイ（parmigiano はチーズ工程、他は具材工程）。**選択アイコンの現状** |
| `2-placed` | 配置直後（最後の 1 ピースは着地アニメーション中で半透明） |
| `3-result-baked` | 焼成（ジャスト）後の RESULT |

食材ID: `parmigiano`（Pilot 1）、`cucumber`（Pilot 2）、`egg`・`eggplant`（バックログの証跡）。viewport: `390x844`（主）・`360x800`（副）。

| ファイル | 内容 |
|---|---|
| `board_390x844_crops-of-real-captures.png` / `board_360x800_…` | 上の実画像（`2-placed` と `3-result-baked`）の切り抜きを並べた**派生物**。別撮影ではない |

未取得（代替画像で埋めていない）: Dex / 図鑑、Reference 見本、CUT、焼成中・焼きすぎ・生焼け、実レシピ上の画像、WebKit、実機。
