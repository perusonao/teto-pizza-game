# Issue #421 — モッツァレラ輪郭 第2試作の追加調整（外周の白さ・ぼかし低減）Result

- ブランチ: `claude/issue-421-mozzarella-outline-proto2`（基準 HEAD `2bdc4de` の上）。#468 ブランチ・共有 Preview は未変更。PR 作成・Ready 化・merge・deploy はしていません。
- 状態: **試作。評価は Owner の目視（実機）待ち**。テスト成功を採用の根拠にしていません。

## 1. 調整の内容（`bakeVisual.ts` の羽化スカートの値のみ。構造・層数は不変）
| 項目 | 2bdc4de | 調整後 |
|---|---|---|
| 近い 4 層の不透明度 | ≤0.30 | ≤0.20 |
| 近い 4 層のぼかし | 1.6〜2.2px | 1.4〜1.9px |
| 遠い 2 層の不透明度 / ぼかし / 到達 | ≤0.24 / 2.4px / 4.2〜6.8px | ≤0.14 / 2.2px / 3.6〜5.6px |
| スカートの色 | クリーム (236,222,194) / (232,214,184) | ややピーチ寄り (232,208,176) / (228,200,166)（ソース上で白く浮きにくい） |
| 本体の縁の不透明度 | 0.72 | 0.60（スカートの強さと比を保ち、段差を作らない） |
- 変更していないもの: 焦げ目、アニメーション、採点、焼成時間、CUT、保存、経済、DOM、生の見た目。

## 2. 外周の明るい画素（測定方法を統一）
- 方法: 同一の撮影スペック（`e2e/mozzarella-outline-proto-capture.spec.ts`、Chromium・DPR 3・同じ配置・同じ針位置）が各ピースの矩形を JSON で出力し、ピース外周 1〜7px の帯（矩形に内接する楕円の外側）の輝度 170 超の画素の割合を算出。M1・2bdc4de・調整後を同じスクリプトで測定。bbox ベースの近似値（傾向の比較用）。
| 段階 | M1 | 2bdc4de | 調整後 |
|---|---|---|---|
| 390×844 適正焼成（基準 0.14） | 0.14 | 0.24 | **0.15** |
| 360×800 適正焼成（基準 0.08） | 0.08 | 0.18 | **0.09** |
| 390×844 溶け始め | 0.29 | 0.32 | 0.28 |
| 360×800 溶け始め | 0.23 | 0.27 | 0.23 |
| 深い / 焼き過ぎ（両） | 0.01〜0.02 / 0.00 | 0.02〜0.03 / 0.00 | 0.01 / 0.00 |
- 適正焼成は M1 とほぼ同水準（差 +0.01）に。溶け始めは M1 と同程度。

## 3. 見た目（Chromium のみ）
比較画像（左 M1 / 中 2bdc4de / 右 調整後）: `docs/reports/screenshots/mozzarella-outline-proto2b-421/compare3b-<viewport>-<段階>-closeup.png`、`compare3b-*-6-cut-stage.png`、`compare3b-*-7-result-stage.png`（390×844 / 360×800、溶け始め・適正・焼き過ぎ・CUT・RESULT）。
- 維持できた点: 中心の乳白色から外周の薄いクリームへの連続（二重輪郭・シート感・大きな丸い張り出し・白い輪は出ていない）。ピースごとの方向差。RESULT / CUT でピース同士が接触・融合して見えない。
- 変わった点: 外周の白いにじみが減り、輪郭がやや締まった。
- 残る違和感: 広がりの不規則さは 2bdc4de より控えめ（舌が薄く短い）。M1 と並べると「縁の柔らかい楕円」という印象は残る。溶け始めは M1 同様、淡い輪郭が出る。焦げは従来の斑点のまま。

## 4. 描画コスト（Chromium トレース、ソフトウェアラスタ、iPhone ではない）
- 方法: `e2e/mozzarella-outline-proto-perf.spec.ts`。焼成中に偽の時計を 16ms × 150 フレーム進め（針 0→約 80）、チーズの style が毎フレーム変わる状態で `Paint` / `PrePaint` / `Layerize` / `RasterTask` の合計時間を取得。各版 3 回の中央値。ページ全体の値で、チーズ単体ではない。
| 版 | box-shadow 層数 | Paint+PrePaint+Layerize+Raster（390×844） | 同（360×800） |
|---|---|---|---|
| M1 | 10 | 1238 ms（1225〜1439） | 1226 ms（1219〜1277） |
| 2bdc4de | 11 | 1324 ms（1287〜1352） | 1325 ms（1079〜1400） |
| 調整後 | 11 | 1491 ms（1315〜1517） | 1423 ms（1120〜1575） |
- 解釈: 調整後は M1 より約 +15〜20%（150 フレームで +0.2 秒、1 フレームあたり約 +1.3ms）。ただし版間のばらつき（min〜max）が重なっており、有意な差かは断定できない。主因は RasterTask（ぼかしを持つ box-shadow が 1 層増え、ぼかし半径も M1 の 1px から 1.4〜2.2px）。実機（iPhone）の GPU ラスタでの値は未計測。調整（アルファ低下）は描画コストを下げない（ぼかし半径は 2bdc4de とほぼ同じ）。

## 5. WebKit
- run 38249436268（`2bdc4de`、手動 Full、deploy なし）: **failure**。success: classify、layout-chromium、Layout Contract Gate、webkit-390×844 shard 1/2・2/2、webkit-360×800 shard 1/2。**failure: webkit-360×800 shard 2/2（→ WebKit Gate）**。
  - 失敗は 1 件のみ: `e2e/sauce-edge-475.spec.ts:124`「the same pixels carry SAUCE -> BAKE -> CUT -> RESULT」が `Test timeout of 60000ms exceeded`（168 passed / 1 failed / 14 skipped）。同 spec の他 4 件は 7〜9 秒で通過。
  - `mozzarella-melt-421`（2 件）は同 shard で通過（42.0 秒・47.5 秒。WebKit は Chromium より遅い）。
  - 失敗テストは #480 の追加で、モッツァレラの配置・BAKE・CUT・RESULT を通る（60 秒の固定上限）。main の WebKit run 38241941356（`279ed48`）は success。**この試作の描画が WebKit で重いことが原因か、runner 負荷による偶発かは、この run だけでは判別できません**（未確定）。

## 6. 検証（調整後の HEAD）
| 項目 | 結果 |
|---|---|
| `tsc -b` / `npm run build` | 通過 |
| oxlint | 本変更ファイルに指摘なし（既存 3 warning のみ） |
| Vitest 全件 | 390 files / 7165 passed / 1 skipped |
| e2e `mozzarella-melt-421` + 関連 e2e（Chromium 2 viewport） | 51 passed / 1 skipped |
| WebKit | 上記（2bdc4de）。調整後 HEAD の再検証は別途 |
