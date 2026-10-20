# Square-Pan Dough D2-b1 — 焼成オーバーレイの四角対応 Result

Issue #537 / Epic #532。状態: **Preview / DEV 限定で到達可能・本番では不活性**。iPhone Safari の Human Verification は **未実施**（Owner 実機が必要）。

## 変更
- `src/components/square/squarePanStage.css`（追記のみ）: `.pizza-dough--square-pan` 配下で `.pizza-bake-overlay`（sheen / char）・`.pizza-char-spots` を天板の箱（dough の border box、6% inset、角 3.41%）に、`.pizza-perfect-glow` を天板より 3% はみ出す角丸四角にする。円の gradient はそのまま使うので、四隅が最も焼ける。
- `src/components/square/squarePanStage.test.ts`: 上記セレクタがすべて `.pizza-dough--square-pan` に限定されること、clip の値が天板 geometry と一致することを固定。
- `e2e/square-pizza-bake-d2b1.spec.ts`（新規）: 両 viewport。
- 触れていないもの: `App.css`（#518 の filter、既存の丸いオーバーレイ）、`PizzaStage.tsx`、reducer・採点・保存形式、CUT（四角は無効のまま。#429 / #467 に触れない）、Recipe Select / Dex 等。

## 検証（ローカル Chromium 390×844 / 360×800。WebKit はローカルに無く CI で確認）
- `npm run build` 通過。`oxlint` の警告は `CheesePoolCanvas.tsx` の既存分のみ。
- 全 Vitest: 477 files passed / 8941 tests passed（skip・todo は既存）。
- 新規 E2E 6/6: 
  - char 状態で、オーバーレイの箱 = dough の border box、clip `inset(6%`、角丸 0（円でない）。
  - **CSS filter 後の実画面ピクセル**: 同一フレームをオーバーレイ表示／非表示で撮り、四隅（8% / 92%）は差 30 超（焼けている）、天板外 7 点は差 6 以下（はみ出さない）。
  - RESULT: perfect glow が `inset(3%` の四角、dough は正方形、幅は丸いピザの RESULT 縮尺 `min(58vw,196px)` と一致（±1.5px）、`.pizza-dough-square` と同じ箱、横スクロールなし、CUT ボタンなし。
  - 丸いピザの回帰: BAKE の 3 レイヤーが padding box・`border-radius:50%`・clip なしのまま。
- 既存 E2E（square-pizza-cooking-d2a2、square-dough-visual、bake-one-way、sauce-oil-over-519）両 viewport で 40/40 通過。
- 変更前の同 spec は四角 2 件が想定どおり失敗（丸い回帰は通過）。

## スクリーンショット
`docs/reports/screenshots/square-dough-d2b1/{before,after}/`（390×844・360×800: BAKE char、RESULT perfect、丸い BAKE char）。動画は repo に含めない。

## #468 との関係
#468 の変更ファイルは `App.css`・`PizzaStage.tsx`・`bakeVisual.ts` ほか。本変更は `squarePanStage.css`・テスト・E2E のみで **ファイルが重複しない**。#468 が触れる `.pizza-cheese--mozzarella` とセレクタも交わらない（焼成表現の上書きなし）。`git merge-tree` は shallow clone のため実行できず、ファイル集合の突き合わせによる判断。

## 未実施・限界
- iPhone Safari 実機 HV（Owner）。WebKit CI（間欠失敗 #529 / #531 はマスクしない）。
- perfect glow の見え方は 700ms の一回限りで、静止画では確認しづらい。動画で確認する。

## 次: D2-b2
四角い生地の灰色のえぐれ（描画のみで改善。判定・採点・保存形式は不変）、自分が調理したピザに限った四角サムネイル、Anti-Oracle sweep。
