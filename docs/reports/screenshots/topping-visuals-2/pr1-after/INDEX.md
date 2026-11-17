# Topping Visuals 2.0 PR-1 — after（parmigiano 配置後ビジュアル、Issue #824）

撮影: PR-1 ブランチ（main `319b1841` + 本変更）のローカル `npm run dev`、Chromium（headless、実ポインター入力、DPR 2）。**WebKit・実機 iPhone Safari・Preview では未撮影**（Owner の実機 HV が必要）。
状態は PR-0 の before（`../pr0-before/`）と同じ操作・同じセーブ構成（Free Cook、mozzarella 2 + parmigiano 2、焼成はジャスト）。配置直後は着地アニメーション後（約 0.9 秒待機）。

| ファイル | 内容 |
|---|---|
| `parmigiano_<viewport>_1-selection-tray.png` | 選択トレイ。**chip は before と同一**（CSS の板） |
| `parmigiano_<viewport>_2-placed.png` | 配置直後（削り片の山） |
| `parmigiano_<viewport>_3-result-baked.png` | 焼成（ジャスト）後の RESULT |
| `compare_390x844_before-vs-after_crops.png` | 390×844 の before（main `a558362`）と after の切り抜き比較（実画像の派生物） |

未取得: Dex・図鑑、Reference 見本（コードは `surface="selection"` で不変・テストで固定）、CUT、焼成中・焼きすぎ、実レシピ上、WebKit、実機。
