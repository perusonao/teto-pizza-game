# Topping Visuals 2.0 / #825 — parmigiano SPRINKLE Pilot（配置後の散布表現）

撮影: 本ブランチのローカル `npm run dev`、Chromium（headless、実ポインター入力、DPR 2）。比較の左は **8dfb99e**（#874 の現行 SVG）を別 worktree で同じ操作・同じ倍率で撮影。**WebKit・実機 iPhone Safari では未撮影**（Owner の実機 HV が必要）。

| ファイル | 内容 |
|---|---|
| `board_8dfb99e-vs-sprinkle_three_<viewport>.png` | Owner が実機で置いた 3 か所のタップ（上・左下・右下）。左＝8dfb99e（3 か所が同じ輪状の模様）／右＝散布。上段＝配置直後、下段＝焼成（ジャスト）後の RESULT |
| `board_8dfb99e-vs-sprinkle_rim_<viewport>.png` | 外周付近の 4 タップ（上・右・左上・下）。散布がピザの外にはみ出さないことの確認 |
| `sprinkle_<case>_<viewport>_2-placed.png` / `_3-result-baked.png` | 散布版の原画像（配置直後／焼成後の RESULT） |

未取得: 焼きすぎ、CUT、Dex・Reference 見本（コードは `surface="selection"` で不変・テストで固定）、WebKit、実機。比較ボードは実撮影画像の切り抜き（派生物）。
