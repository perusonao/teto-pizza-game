# Ingredient Icons 2.0 — eggplant（ナス）輪切り A 案の未配線コンポーネント Result Report

Refs #417 / #749。base main `5eade46`。**新規ファイルのみ・どこからも import しない（未配線）・色と形は PROVISIONAL（Owner 未承認）。** ハーブ 4 種（rosemary / oregano / spinach / artichoke）、#778・#779・#777（walnutGlyph）の claim 対象は編集していない。

## 範囲
- 新規: `src/components/eggplantGlyph/{EggplantGlyph.tsx,eggplantPalette.ts,EggplantGlyph.test.tsx}`、本 Report、`docs/reports/data/TETO_ICONS-EGGPLANT-UNWIRED_*`（測定 JSON と測定スクリプト）、`docs/reports/screenshots/eggplant-unwired/`。
- 不変: `ingredients.ts`（id・emoji 🍆・color・family・サイズクラス）、`IngredientGlyph.tsx`、`App.css`、golden、採点・保存・Research・ladder、`canFryIngredient`。

## 実装
`EggplantGlyph({ state, outline })`。図形は Style Lock V2 §12 の参照 SVG `references/ingredient-icons-2.0/eggplant.svg`（輪切り 2 枚）と同一座標（テストで円の cx/cy/r を突き合わせ）。64×64 viewBox・1em・`aria-hidden`・id / gradient / filter / url() なし。
- 状態の切替フック: (1) `state` prop（`raw / baked-good / baked-burnt / fried-crisp / fried-over / fried-baked`）が `data-eggplant-state` とフォールバック色を決める。(2) 各部位は `var(--eg-skin, <状態色>)` のように CSS 変数を読む（変数名は設計候補の `eggplant-a-states.css` と同じ: `--eg-skin/line/flesh/rim/core/seed/crust/sheen`）。祖先要素から上書きでき、配線時に bake heat / 揚げ位置から駆動できる。**Fry の 3 状態の値は Fry が HOLD のため PROVISIONAL（フック確認用）。**
- `outline="strong"`（比較用オプション、既定は normal）: 外線 2.4 → 3.4、色を 0.5 倍の暗色。採否は Owner。
- 未配線は test で固定（walnut と同方式）。

## 視認性の実測
方法: Playwright Chromium（1243）、DPR3。背景は近似色: 生地 `#f5e8cc`、焼成生地 `#dba45b`（bakeVisual の heat1 の A/B 中間）、溶けたチーズ `#e8c15a`（walnut 報告と同じ）。eggplant の状態は生地=raw、焼成生地・チーズ=baked-good。「見える面積」= 背景色との RGB 距離 ≥30 の画素（CSS px² に換算）、グレースケール面積 = 輝度差 ≥20/255 の画素、コントラスト = WCAG 輝度比（平均色/背景＝「面」、最暗 15% 画素/背景＝「外線」）。全値: `docs/reports/data/TETO_ICONS-EGGPLANT-UNWIRED_measurements.json`。画像: `docs/reports/screenshots/eggplant-unwired/01〜03`（左カラー／右グレー）、`04`（6 状態）。**実機（iPhone / WebKit）は未実施。**

### 溶けたチーズ上（前回の弱点の場）— 見える面積 px²（カラー / グレー）と 面 / 外線の輝度比
| 案 | 17.6px | 26px | 33.6px | 64px | 面 / 外線 |
|---|---|---|---|---|---|
| 🍆 emoji（現行） | 185 / 180 | 395 / 384 | 660 / 642 | 2397 / 2324 | 2.8 / 4.1 |
| mozzarella 参照 | 119 / 114 | 259 / 253 | 430 / 422 | 1562 / 1547 | 1.2 / 2.2 |
| eggplant normal 1.0em | 160 / **105** | 350 / **222** | 585 / 364 | 2124 / 1291 | 2.3 / 10.2 |
| eggplant strong 1.0em | 166 / 112 | 363 / 236 | 606 / 387 | 2204 / 1380 | 2.7 / 11.4 |
| eggplant normal 1.2em | 230 / 149 | 506 / 316 | 840 / 519 | 3055 / 1851 | 2.4 / 10.2 |
| eggplant strong 1.2em | 240 / 159 | 526 / 338 | 872 / 556 | 3171 / 1978 | 2.7 / 11.4 |
| eggplant normal 1.35em | 292 / 185 | 636 / 396 | 1065 / 658 | 3870 / 2333 | 2.4 / 10.2 |
| eggplant strong 1.35em | 304 / 199 | 661 / 424 | 1105 / 701 | 4009 / 2487 | 2.7 / 11.4 |

### 生地・焼成生地上（要点、17.6px / 64px の見える面積と 面 / 外線）
| 背景 | emoji | mozzarella | eggplant normal 1.0em | eggplant normal 1.2em |
|---|---|---|---|---|
| 生地（raw） | 187 / 2411、3.8 / 5.8 | 110 / 1490、1.2 / 3.1 | 125 / 1544、3.4 / 13.8 | 178 / 2213、3.6 / 13.8 |
| 焼成生地（baked-good） | 184 / 2388、2.2 / 3.1 | 118 / 1558、1.5 / 1.7 | 159 / 2111、**1.9** / 7.7 | 227 / 3043、1.9 / 7.9 |

### 読み取り
- eggplant は外線が濃く、**外線の輝度比は emoji・mozzarella より高い**（チーズ上 10.2 対 4.1 / 2.2）。1.0em の面積は emoji の約 86%（17.6px）〜 89%（64px）で、mozzarella 参照より大きい。
- 弱点は**グレースケール**: チーズ上のグレー面積が emoji の 58%（17.6px で 105 対 180）。身（クリーム）と皮（紫）が焼成チーズと中間灰で近く、外線の輪だけで読む。焼成生地上の「面」の比は 1.9 と低い（外線 7.7 で成立）。
- strong 外線: 面積 +4%、外線比 +11%（10.2 → 11.4）、面の比 2.3 → 2.7。**効果は小さい**（外線は元から十分暗い）。
- 1.2em: 面積 +44%、グレー面積も 105 → 149（17.6px）。1.35em: +83%。ただし 64 枠の占有が約 87% なので 1.2em で約 104%、**1.35em で約 117% と枠外にはみ出し**、隣の食材・ラッパー端に当たる懸念がある。Style Lock §12.2 の起点（1em〜1.05em）からも外れる。

### 推奨（採否は Owner）
1. **サイズ補正 1.2em（`.ingredient-glyph--eggplant-slices` の個別クラス）を第一候補**。salmon / cream-cheese の Pilot D の前例と同じ方式で、チーズ上の面積を emoji 比 1.24 倍にできる。1.35em は不採用推奨（枠外はみ出し）。
2. 外線は **normal のまま**を推奨。strong は 1.2em でも 17.6px のグレー面積が不足と HV で判断された場合の追加手段（コンポーネントは対応済み）。
3. 焦げ（baked-burnt）の生地との差が低めである既知の弱点（設計 Result §4）は本作業で変更していない。

## walnut の弱点への対応案（比較のみ・walnutGlyph は未編集）
弱点: 生くるみ × 焼成チーズの塗り 1.10（#777 Result）。同じ測定方式で、walnut のマークアップを文字列置換しただけの比較（ファイル不変）。溶けたチーズ上の 17.6px / 64px。画像 `05-walnut-mitigation-options.png`。
| 案 | 見える面積（カラー / グレー）17.6px | 面 / 外線（17.6px） | 備考 |
|---|---|---|---|
| 現行 raw | 141 / **73** | 1.87 / 5.94 | グレー面積が現行の半分 |
| raw + 濃く太い外線（#5a3a1a → #2a1508、3 → 4.2） | 152 / 91 | 2.56 / 10.09 | 外線比 +70%。形は不変 |
| raw 1.2em | 202 / 101 | 1.87 / 5.94 | 面積 +43%、面の弱さは不変 |
| raw + 強外線 + 1.2em | 215 / 124 | 2.59 / 10.10 | **最も良い**。面積 +52% |
| baked 現行（参考） | 142 / 142 | 3.54 / 8.78 | 焼成後の色は元から問題なし |
推奨: 焼成チーズ上で生を使う配線なら「外線を濃く太く + 1.2em」。塗りの明度差そのものは色を変えない限り改善しない（raw を暗くすると「生」の見た目でなくなる）。色の変更は Owner 判断。#777 の claim（〜11/13）解除後に別 PR で。

## 第 2 段（配線）で必要な変更（着手しない・#778 merge 後・別 claim・Owner 承認）
- `ingredients.ts` の eggplant に `pieceVisual: "eggplant-slices"`（+1 行）。`IngredientGlyph.tsx` の `DedicatedIngredientVisual` / `VISUAL_VIEWBOX`（"0 0 64 64"）と描画分岐、`App.css` の個別寸法ルール（1.2em 案を採る場合）。
- **Fry の依存**: `canFryIngredient("eggplant")` は `pieceVisual !== undefined` を要求する（`src/data/fryIngredients.ts`）。`pieceVisual` を足した時点で Fry の提供可否が true に切り替わる（休眠が解ける）。`FRY_EXPERIENCE_PRODUCTION = false` は維持し、`fryIngredients.test.ts` など「eggplant は休眠」を固定するテストの更新要否を確認する。
- **golden**: 専用 SVG を足すと、DOM を網羅する golden / ダイジェストを持つテストの再生成が要りうる。#778 と同じファイルを触るため、#778 merge 後の最新 main で再生成すること。**どの golden が対象かは本作業では未確認**（#778 の diff を見てから判断）。
- 状態色の駆動（bake heat / 揚げ位置 → `--eg-*`）は Fry F2/F3 と bake 監査の変数名の統一待ち（§12.3 G2）。ナスでは F1 の `--fry-bright/sat/sepia` を使わない。
- RT-01 比較、実機 HV（390×844 動画 + before/after、24px 識別）は配線 PR で Owner が行う。

## テスト
`EggplantGlyph.test.tsx` 10 件: 構造（1em / 64box / aria-hidden / data 属性）、既定 raw・全 6 状態の属性、2 枚の描画と CSS 変数フック、id・gradient・filter・url() なし、全状態で同一シルエット、参照 SVG との幾何一致・raw 色一致、strong が太く暗い、外線コントラスト（淡い生地・焼成チーズで >4）、未配線。全体の結果は PR 本文を参照。

## Human Verification
ゲーム内の見た目・操作は**変化なし**（未配線）。HV Policy §2 に照らし、動画は対象外（Video Verification: N/A）。静的比較画像を `docs/reports/screenshots/eggplant-unwired/` に commit。実機 HV は配線 PR で Owner が行う。

## 未確認事項
- 実機（iPhone / WebKit）の描画、実ピザ上の合成、色の Owner 承認（PROVISIONAL）。
- 背景色は近似（実際の生地・チーズ色は焼成・ブラウザ描画で変わる）。
- PR #779 の `prepGlyphs.tsx`（EggplantSlices）は branch `claude/teto-pizza-herb-svg-0ze45t` に該当ファイルが無く（`src` に prepGlyphs / EggplantSlices の出現 0）、比較できなかった。PR #751 の Fry 監査 addendum は存在確認のみ。
