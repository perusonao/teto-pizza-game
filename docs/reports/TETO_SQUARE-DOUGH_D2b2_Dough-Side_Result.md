# Square-Pan Dough D2-b2 — 四角い生地の灰色のえぐれ・側面の描画 Result

Issue #537 / Epic #532。状態: **Preview / DEV 限定で到達可能・本番では不活性**。iPhone Safari の Human Verification は **未実施**（Owner 実機が必要）。
**#576 の perfect glow も実機では未確認**（自動テストは箱・clip の幾何だけを見ており、約 0.7 秒の見え方は動画でしか確認できない）。HV は PASS と記録しない。

## 監査（最新 main `e19247c` から）
| 項目 | 結果 |
|---|---|
| 灰色のえぐれの原因 | STEP 1 で生地は厚み `SQUARE_COVER_MIN_THICKNESS` 以上のセルだけ描かれ、未充填の部分は `.square-dough-layer__pan`（平坦な `#7a7f86`）がそのまま見える。生地の縁に影も側面も無いため「生地が欠けた穴」に見える。#558 の既存仕様で #566 起因ではない（#537 コメント）。 |
| 側面 | DOUGH 中の生地の縁に厚みの手がかりなし。「次へ」後の `.pizza-dough-square`（板）は clip で自分の inset 影が切れ、縁が無い（D2-a2 の `box-shadow: inset 0 0 14px` は clip の外）。 |
| 焼き上がり後 | BAKE / RESULT は D2-b1（#576）で四角に揃った。板の色・オーバーレイは変更なし。 |
| サムネイル | **プレイヤー自身が調理したピザを小さく出す画面は現状に存在しない**（RESULT はステージ自体で既に四角）。Recipe Select（`PizzaThumbnail`）と見本（`ReferenceThumbnail`）はレシピ側で、未発見の間は形状中立でなければならない（Anti-Oracle）。よって **四角サムネイルの呼び出し元は追加していない**（`SquareThumbnailBase` は未使用のまま）。新しい画面を作る判断は Owner に残す。 |
| 既存 PR / claim | 重なる open PR なし（#468 は `App.css` / `PizzaStage.tsx` / `bakeVisual.ts`、#478 は `GameScreen` / `pieceDrag`、#540 は HOLD）。#537 に有効な claim なし。#536 は Issue のみ（PR なし）で、案内の部品（`SquareDoughGuide` / `SquareDoughGauge` / `SquareDoughLayer`）は触れていない。 |

## 変更（描画のみ）
- `src/logic/pan/squareDoughSheet.ts`（新規）: 天板の床（左上が明るく右下が暗い・壁際が暗い）、生地が床に落とす影（右下へ）、生地の縁の側面（光に向く縁は明るく、背く縁は暗く）を合成した **不透明な 128×128** を返す。生地の厚み・被覆マスク・生地自身のピクセルは `squareDoughRaster.ts` のまま。輪郭の小さな谷（16×16 グリッド由来の丸い凸凹の継ぎ目）だけを最大約 2px 埋める（生地のピクセルは減らさない）。
- `src/components/SquareDoughCanvas.tsx`: 描画関数を上記に差し替え（2 行）。
- `src/components/square/squarePanStage.css`（追記のみ）: `.pizza-dough--square-pan::after`（天板の壁: 上・左壁の影、下・右壁の薄い光。天板の箱 6%〜94%、`pointer-events:none`、`filter` なし）。
- 触れていないもの: 採点・完成判定・保存形式・CUT・reducer、`App.css`（#518 の filter）、`PizzaStage.tsx`、モッツァレラの見た目（#468 と分離）、`SquareDoughLayer.tsx`、#536 の案内 UI。
- 既存テストの更新（意図の維持）: `e2e/square-dough-corners.spec.ts` の 2 本は「canvas の alpha が 0 = 生地なし」を使っていた。canvas が天板全体（不透明）になったので「色が暖色か（R−B>30）」で生地の有無を見る形にした（確認したい内容は同じ）。

## 検証（ローカル Chromium 390×844 / 360×800。WebKit はローカルに無く CI で確認）
- `npm run build` 通過。oxlint の警告は既存分のみ。
- 単体（新規 `squareDoughSheet.test.ts` 8 件）: 不透明・空の天板は床・生地は縁以外で元と同じ色・元の生地ピクセルを減らさない・谷の埋めは生地に接する範囲だけ・影は右下が濃く左上より濃い・縁は光に向く側が明るい・NaN/∞ でも有効・決定的で速い。変異検査: 影なし／光の向き反転／透明化はそれぞれ検出（谷の埋めの「置換」変異は実質等価で検出されない）。
- 単体（新規 `squareNeutral.test.tsx`）: 全レシピの Recipe Select サムネイルに square / 天板 / tray 等が出ない。`SquareThumbnailBase` の呼び出し元が無いこと、新ラスタライザの呼び出し元が canvas だけであること。
- E2E（新規 `e2e/square-pizza-dough-side-d2b2.spec.ts`、両 viewport 8/8）: ball 開始で四隅へドラッグ → 隅の間の空きは不透明な灰色の床で上・左が明るく下・右が暗い／`data-corners=4`・`data-coverage`（0.7〜0.8、辺に沿ったなぞりで 0.9 超・STEP 2）は従来どおり／「次へ」後の壁は天板の箱 6%〜94%・`pointer-events:none`・四隅のソースは届く／RESULT で正方形・CUT なし／丸いピザに壁も canvas もない。変更前は同 spec が失敗することを確認済み。
- 既存 E2E（square-pizza-bake-d2b1、square-pizza-cooking-d2a2、square-dough-corners / visual / b / touch）両 viewport で通過。
- 全 Vitest: 結果は PR 本文に記載。

## スクリーンショット
`docs/reports/screenshots/square-dough-d2b2/{before,after}/`（390×844・360×800）: `1-start`、`2-corners`（四隅まで引いた直後）、`3-sides`（辺に沿って引いた後。スリットが残る状態）、`4-sauce-empty`（「次へ」後の天板の壁）、`4-sauce-corners`（after のみ）、`5-result`。
STEP 1 の画面で生地の縁に白い光が見えるのは B2 の既存の「変わった所」ハイライトで、本変更ではない（時間で消える）。

## 限界・未確認
- 実機 Safari では未確認。canvas の拡大縮小・影の見え方は実機で確かめるまで確証がない。
- 床・影・縁の強さは暫定値（定数は `squareDoughSheet.ts` の冒頭に集約）。強さの最終判断は Owner の実機 HV。
- STEP 1 の途中で未充填の部分が残ること自体は仕様（完成判定は不変）。見え方だけを変えた。
- SVG のフォールバック（canvas 失敗時）と Preview の lumpy 開始（SVG セル）の見た目は変えていない。
- 四角サムネイルは上記の理由で未導入。導入するなら、どの画面（プレイヤー自身のピザ）かを Owner が決めてから。
