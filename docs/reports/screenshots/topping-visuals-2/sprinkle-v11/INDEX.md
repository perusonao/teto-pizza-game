# sprinkle-v11 — F3 を基準にした削り片の形状候補（輪郭・厚み・長さ）の効果測定（PR #875、docs-only、描画コードは未変更）

Chromium・DPR 2・390×844・同じ seed／タップ位置。**基準 = #875 の現在の head（F3）と同じ描画**（配置時の画素差 0 を確認）。各候補は F3 に**ノブ 1 つ**だけを足した計測用の差し替え（リポジトリには入れていない使い捨てのパッチ。乱数は別の流れで引くので、配置・種類・角度・片数は F3 と同一）。実機 iPhone Safari の代用ではない。

候補: **F3 now**｜S1 頂点 13（A1）｜S2 先細り（A2）｜S3 反り（A3）｜T1 影のずれ×0.5（B2）｜L1 長さの上限（C1）｜L2 長さの偏り（C2）。※ B1（木目線・芯なし）は V10 の `board_v10*`／V9 の F2 を参照（視認率の測定は V10 の T2）。

| ファイル | 内容 |
|---|---|
| `board_v11_zoom_central_placed.jpg` | 配置時・中央 3 タップの拡大（2 倍）。7 候補 |
| `board_v11_zoom_central_result.jpg`／`board_v11_zoom_white_result.jpg` | 焼成後・中央／白地（モッツァレラ 9 個）の拡大（2 倍） |
| `board_v11_zoom_rim_placed.jpg` | 外周 4 か所・配置時 |
| `board_v11_full_{central_placed,spread_placed,white_result}.jpg` | 皿全体の並置（7 候補） |
| `board_v11_cut_{cuts,result}.jpg` | CUT（クアトロ フォルマッジ、3 本切り後・RESULT。F3｜S1｜L2｜T1） |
| `contrast_v11_390x844.json` | 画素の測定（基準＝パルミジャーノなしの同じ画面との差。赤地／白地の ΔE・視認率・面積・輪郭比） |
| `shape_metrics_v11.json` | 形の指標（3,000 id。長さ/幅・長方形らしさ・中央部の幅の均一さ・輪郭の凹凸・凹み角・長さ・影のずれ÷幅） |
| `webkit_ci_failures_2026-11.json` | `sauce-gauge-489` の調査で集めた WebKit CI の失敗ジョブ一覧（25 件・14 run） |

注意: 焼成後の画面は、パルミジャーノがあると同じ条件でも画素が完全には再現しない（集計値の揺れは ΔE ±0.1・割合 ±1pt）。
