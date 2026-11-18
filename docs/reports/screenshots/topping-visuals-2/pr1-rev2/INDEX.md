# Topping Visuals 2.0 PR-1 rev.2 — 配置後パルミジャーノの視覚改善（Issue #824、Owner HV の P2 指示 comment 6985715042）

撮影: PR-1 ブランチ（rev.2）のローカル `npm run dev`、Chromium（headless、実ポインター入力、DPR 2）。**WebKit・実機 iPhone Safari では未撮影**（Owner の実機 HV が必要）。
PR-0 の before・rev.1（HEAD d218864）と**同じ操作・同じセーブ構成・同じ倍率**（Free Cook、mozzarella 2 + parmigiano 2、焼成はジャスト、配置直後は着地アニメ後 0.9 秒待機）。

| ファイル | 内容 |
|---|---|
| `parmigiano_<viewport>_1-selection-tray.png` | 選択トレイ（**chip は不変**） |
| `parmigiano_<viewport>_2-placed.png` | 配置直後（rev.2） |
| `parmigiano_<viewport>_3-result-baked.png` | 焼成（ジャスト）後の RESULT（rev.2） |
| `board_<viewport>_before-vs-rev1-vs-rev2.png` | 変更前（main の板）／rev.1／rev.2 の同倍率の切り抜き（実画像の派生物） |
| `closeup_390x844_before-vs-rev1-vs-rev2.png` | 1 ピースの 5 倍拡大の比較（DPR 2 の 90px 角、派生物） |

未取得: 焼きすぎ、Dex・Reference 見本（コードは `surface="selection"` で不変・テストで固定）、CUT、WebKit、実機。
