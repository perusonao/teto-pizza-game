# Square Dough D2-a2 — 四角い天板の調理工程 DOUGH〜RESULT（Issue #537 / Epic #532）

Base: `origin/main` `ce5c6a1`（#566 F4-b は未 merge・OPEN のまま。#566 の変更行には触れていない）。
状態: **Preview / DEV 限定で到達可能・本番では不活性**（天板を要求するレシピは 0 件、F4-b の ○/□ も本番では閉）。iPhone Safari の Human Verification は **未実施**（Owner 実機が必要）。

## 範囲（Owner 決定 2026-10-19 に従う）
- 決定 1: 四角版 Merged / Overflow は丸と同等の機能を維持し、**コードを複製せず共通化**した。
- 決定 3: 採点領域の変更（D4）は含まない。`computeSauceMetrics` / Scoring 2.0 / reducer は変更なし。
- 決定 4: 未発見レシピの形状を公開しない。四角になるのは `pizza.pan === "tray"` または Preview の `?pan=square` だけで、Recipe Select / Dex / Hint / Research の描画は変更なし。
- 決定 5: 丸いピザの描画・入力・採点は不変（下記の検証）。
- D2-b（焼成オーバーレイ・char・glow・RESULT 仕上げ・サムネイル）は含まない。`App.css` の #518 対象 filter（`.pizza-dough--raw/--perfect/--burnt`）は変更なし。

## 変更
| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | 自分の `recipe` / `pizza` から `effectivePanShape` で天板を導出（GameScreen の変更は不要）。ポインタ判定 5 箇所を `getPanGeometry(...).contains/clamp` 経由に。四角では丸い生地層を出さず、DOUGH 後は天板の面 `.pizza-dough-square` を全工程で表示。見本ガイドは `SquareTargetGuide`、チーズ pool は天板の縁でクリップ。 |
| `src/logic/pan/sauceSurface.ts`（新規） | ソース canvas が「どの面か」を問う唯一の場所。丸は既存の `buildSauceDisplayPixels` / `insideDoughShapeFraction` をそのまま呼び、四角は D1-a の `buildSquareSauceDisplayPixels` / `insidePanFraction`。 |
| `SauceHeatmapCanvas` / `SauceMergedCanvas`（heatmap・overflow）/ `OverflowMarkerCanvas` | `pan` prop を追加（四角のときだけ渡す）。レイヤー計画・重なり減衰・オイル表現・canvas 予算・失敗時フォールバックは共通のまま。 |
| `src/App.tsx` | `resolvePhysicalDrop` を `resolvePieceDropForPan`（D1-b で用意済み）へ。 |
| `src/App.css` | `.square-dough-layer` を border box に揃える 1 行（下記）。 |
| `src/components/square/squarePanStage.css` | 追記のみ: `.pizza-dough-square`、`.pizza-cheese-pool-clip`。 |

### 実測で見つけた不整合と修正（要確認）
DOUGH の四角い層（`SquareDoughLayer`）は `inset:0`（padding box）で、天板は 237.6px（390×844）。一方、SAUCE 以降のソース・配置・ガイドの座標は border box 基準（6%〜94% = 255.2px）。このままだと「次へ」で天板が約 7% 大きく見える。D2-a2 では層を border box に揃えた（`inset: calc(-1 * var(--dough-border-width))`）。**C（#558）で HV 済みの DOUGH 画面の寸法が約 7% 大きくなる**ため、Owner の確認対象。戻す場合は plate 側を padding box に寄せることになるが、ソースが天板の縁を越えて見える。

### 「丸いピザが四角い天板の下に見える」
原因（Fresh Audit の推定どおり）: DOUGH 中も丸い `.pizza-dough-shape` が描かれ続け、SAUCE 以降は天板ごと丸に戻っていた。四角では丸い層とクラスを出さず、plate に置き換えた。before / after: `docs/reports/screenshots/square-dough-d2a2/`。

## 検証（Chromium 390×844 / 360×800。WebKit は CI）
- `tsc -b` クリーン。`npm run build` 成功。oxlint 警告は変更前と同数（7）、変更ファイルは 0。
- 全 Vitest: **475 files / 8922 tests PASS**（新規 18: `PizzaStage.squarePan` 13、`sauceSurface` 5）。変異検査で、`pan` を常に round にする／`squarePan` を常に false にする変異を検出することを確認。
- 丸いピザの不変: `PizzaStage.sauceRender.golden`（canvas props の記録）が無修正で通る（丸のときは `pan` prop を渡さない）。`sauceDisplay.test` の構造テスト（画面に描くラスタライザの呼び出し元は 2 つの canvas だけ）は、呼び出しが `buildPanSauceDisplayPixels` 経由になった分だけ追随（意図は同じ。丸の分岐が `buildSauceDisplayPixels` そのものであることも固定）。
- 新規 E2E `e2e/square-pizza-cooking-d2a2.spec.ts`（両 viewport 通過）: 天板が DOUGH〜RESULT で同じ大きさ・位置／丸い層が出ない／四隅までソースが届く（heatmap の画素 alpha>40）／天板の外は alpha 0／`clip-path: inset(6%…)`／四隅にチーズ・具材を置ける・縁の外は置けない／CUT なし／RESULT で正方形／横スクロールなし。丸いピザの回帰（丸い層・丸いガイド・半径 48 超は対象外）。
- 既存 E2E（square-dough-b/corners/touch/visual/diag、sauce-*、result-scale、cutting、finished-pizza、making-ui、cheese-pool-cut ほか）: 並列 3 での 1 回目は 174 passed / 3 failed（`dough-size-status-474` ×2 は `mouse.move` の 30 秒 timeout、`sauce-layers-b2:250` は描画回数 6 > 5）。**同じ 2 spec を単独（workers=1）で 2 回実行して両 viewport とも 20/20 通過**。負荷時の揺れと推定するが、原因は未確定。CI の結果で再確認する。
- 実行条件・未実施: WebKit はローカルに無く CI 確認。iPhone Safari HV は未実施。

## 未解決・Owner 判断
1. 上記の `SquareDoughLayer` の border box 化（DOUGH の天板が約 7% 大きくなる）。
2. 焼成オーバーレイ・斑点・glow は丸い形のまま（D2-b）。RESULT / BAKE の見た目は仕上げ前。
3. 四角のソース指標・採点は丸のまま（D4）。
4. HV は #566（F4-b）の merge 後に ○/□ 切替込みで行うのが自然。それまでは `?pan=square&squareStart=lumpy`（Preview/DEV）。
5. `src/components/square/SquareSauceCanvas.tsx`（D2-a1）は共通化により使われていない。削除は別判断。

## #566 との関係
`GameScreen.tsx` は変更していない。#566 が `PizzaStage` に触れていないため、競合は想定していない（`App.tsx` は #566 と別の行）。F4-b で □ を選ぶと `pizza.pan="tray"` になり、本 PR の `PizzaStage` が自動的に四角として描く。
