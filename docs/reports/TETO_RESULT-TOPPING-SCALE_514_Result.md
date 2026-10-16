# RESULT の食材縮尺 — Preview 比較スイッチ（Issue #514、親 #479）

Base: `main` `f254a66`（S3 #511 マージ後）。**本番の既定は 1.0（現行）のまま。** Owner が iPhone で縮尺を決めるまで本番値は変えない。

## 変更
- `src/preview/resultScalePreview.ts`（新規）: RESULT 専用の縮尺を一か所で管理。
  - `RESULT_TOPPING_SCALE = 1`（本番）。本番を動かすのは、Owner の実機判断後にこの定数を書き換える変更だけ。
  - `?resultScale=0.65 | 0.75 | 0.85 | 1.0`（Preview / DEV 限定。ホワイトリスト。他の値・重複・未指定は無視）。`import.meta.env.DEV || VITE_PREVIEW_MODE` の静的判定の内側にあるため、本番バンドルにはクエリ名もマーカーも入らない（`resultScalePreview.gate.test.ts` が実ビルドで確認）。
  - `toppingPhaseScale(id, resultCompact)`: RESULT のピザ上だけ上記の倍率、それ以外とモッツァレラは 1。
- `PizzaStage`: 倍率が 1 でないときだけ、ピースの span に `--piece-phase-scale` を設定する（1 のときは変数を出さない＝本番の DOM は不変）。S3 の `toppingFootprintRadiusPercent` にも `rankScale × phaseScale` を渡す（同じ倍率で絵とコピーの範囲が連動する）。
- `App.css`: 絵文字の font-size と `.pizza-cheese` の 2 つの transform に `var(--piece-phase-scale, 1)` を掛ける。
- `PreviewBadge`: 比較中は `· RESULT x0.75` を表示。
- モッツァレラ Canvas（`sizePx`）、`cheesePoolReachPercent`、CUT 画面、Reference、採点・保存・CUT 評価は変更していない。

## 検証
- 単体: `resultScalePreview.test.ts`（値の解決、1 回読み、バッジ、モッツァレラ・CUT 画面で 1）、`PizzaStage.resultScale.test.tsx`（本番で変数なし、スイッチで変数あり、CUT 画面とモッツァレラは対象外、直線・22.5° 斜め・0/60/120° の 3 本・細い楔形（20°）で 1.0 / 0.85 / 0.75 / 0.65 のコピー数が正確な交差判定と一致し、縮小で増えないこと）、`pieceRankScale.test.tsx`（CSS の式）。
- バンドル: `resultScalePreview.gate.test.ts`（本番にクエリ名・マーカーなし、Preview にはあり）。
- 実ゲーム e2e（`e2e/result-scale-514.spec.ts`、390×844 / 360×800）: 0.75 で RESULT の食材の font-size がちょうど 0.75 倍、CUT 画面の食材・モッツァレラ Canvas・RESULT の生地の幅は不変、切れた部分のコピーが残る。不正な値では本番と同じ。

## 比較画像（実ゲーム、`?resultScale=` を実際に付けて取得。左から 1.0 / 0.85 / 0.75 / 0.65、上段マルゲリータ・下段カプリチョーザ）
- `docs/reports/screenshots/result-scale-514/iphone-390x844-result-scale_compare.jpg`
- `docs/reports/screenshots/result-scale-514/iphone-360x800-result-scale_compare.jpg`

## 残るリスク
- Noto の絵文字で取得。iPhone の Apple Color Emoji は大きさが違うため、実機で判断する。
- SVG（#503 の hot-dog / sausage など）は絵文字と同じ font-size に乗るので同じ倍率で縮むが、描画元ごとの見かけの大きさの補正は #503 マージ後に再測定する。
- 本番値を 1 以外にするのは Owner の実機判断後（別の 1 行変更）。
- Reference とサムネイルは対象外（別の `--piece-scale`）。
