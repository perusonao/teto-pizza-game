# T7 — 既存食材アイコンの視認性・サイズ・焼成前後の監査（Result Report）

Status: **調査のみ（docs-only）。`src/`・`e2e/`・CSS・golden・既存 docs・HOT ファイルは未変更。実装・PR・merge・Production ON・共有 Preview 更新なし。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06`（2026-11-07）/ Issue 置き場 #417（claim: #417 コメント 6703658614）。
姉妹書: `TETO_COOK-OPS_T9_Operation-Audit_2026-11-07.md`（T9。claim・ファイルとも別）。

## 0. 方法と限界（先に）

- **既存成果物を再利用し、二重に測り直していない**（SESSION-OPERATIONS §8-1）: `TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md`（2026-10-22）、`TETO_ISSUE-733_ICONS_Result.md`、`TETO_ISSUE-739_ICONS_Result.md`、Style Lock V2、#751 の Fry visual-state addendum（`TETO_INGREDIENT-VISUAL-FRY-VISUAL_Integration-Addendum_2026-11-05.md`、draft PR のブランチ上）。本書はそれ以降の **main の差分**と、まだ誰も一覧にしていない横断事項だけを扱う。
- 区分: 【実測】= 今回 main のコード／CSS／データを読んで確認、【引用】= 既存 Result の数値をそのまま使用、【推論】= 数値から導いた見立て、【未確認】= 実機・実描画が無いもの。
- **画面のスクリーンショットは今回取っていない**（`node_modules` 未使用・実描画なし）。サイズは CSS の乗算式からの**算出値**で、実機の見え方ではない。iPhone Safari（Apple Color Emoji 含む）は全て【未確認】。

## 1. 重複確認（結論: 重複なし）

| 既存の作業 | 範囲 | T7 との関係 |
|---|---|---|
| #417 / PR #782（eggplant 輪切り A 案、未配線） / PR #751（Fry visual-state addendum、draft、docs） | SVG の新規・Fry 中の見た目 | 本書は**新しい SVG を設計しない**。#751 の「焼成前後（Fry）」は引用のみ |
| #733・#739・#758・#771 | beef／ピーマン／梅肉／しらす／大葉／ピーマン 1.45em の個別補正 | 個別食材は引用。**横断の優先順位づけ**が本書の差分 |
| #770 | Style Lock V2 への反映（docs、Owner 判断待ち） | 本書は Style Lock を変更しない |
| T1 #774（Batch 19）・T2 #780・T5/T6 #773・#772 | レシピ／工程の設計 | ファイル・名前空間とも別（`TETO_ICON-AUDIT_T7_*`） |
| open PR 全件（2026-11-07 時点の一覧）の変更ファイル | — | `TETO_ICON-AUDIT_T7_*` と衝突するものなし。HOT ファイルは触らない |

claim は #417 に 1 本（`files: docs/reports/TETO_ICON-AUDIT_T7_*`）。他セッションの claim は変更・解除していない。

## 2. 現状（main `06cfc06`）【実測】

- 材料 85 種のうち `pieceVisual`（専用 SVG）あり **33**、絵文字／CSS のみ **52**。
  - 絵文字のみ 52 のうち **ソース 7**（tomato-sauce, olive-oil, pesto, fromage-blanc-sauce, doubanjiang, curry-ketchup, mustard）、**チーズ 10**（mozzarella は Canvas、gorgonzola/parmigiano/fontina は専用 CSS、cashew-cheese/grana-padano/catupiry/goat-cheese/paneer/swiss-cheese は汎用円または CSS）、**トッピング 35**。
  - トッピング 34: basil, garlic, cherry-tomato, egg, mushroom, onion, pepperoni, anchovy, tuna, bacon, ham, black-olive, corn, eggplant, potato, chicken, parsley, zucchini, almond, pine-nuts, prosciutto-crudo, salami, lemon, salt-cod, baked-beans, palm-heart, sauerkraut, pork, friarielli, jalapeno, sardine, avocado, mint, lamb, sweet-potato。
- 2026-10-22 の Fresh Audit 時点（4＋2 種）から SVG は大きく増えた。**Fresh Audit の「salmon／cream-cheese が未実装」「実装は 4 種」は古い**（今は両方 `ingredient-glyph--salmon-fillet` ／ `--cream-cheese-block` が CSS に存在）。
- 表示サイズの式【実測】（`App.css:795-801`）: ピース font-size = `28px × --piece-scale × --piece-rank-scale × --piece-phase-scale`。rank は 0.7／0.85／1／1.15／1.3、RESULT は 0.75。SVG は `1em` 箱で、**個別補正は CSS の食材別クラス**（`App.css:822-917`、`8303-8386`）で足す方式。

## 3. サイズ・視認性の監査

### 3.1 算出表（28px 基準・箱の大きさ）【推論】

| 場面 | 式 | xs（×0.7） | s（×0.85） | m（×1） | l（×1.15） |
|---|---|---|---|---|---|
| ピザ上（焼成前後） | 28 × rank | 19.6 | 23.8 | 28 | 32.2 |
| RESULT（×0.75） | 28 × rank × 0.75 | **14.7** | **17.9** | 21 | 24.2 |
| 同＋グリフ補正 1.2em（8b 系） | 上 × 1.2 | 17.6 | 21.5 | — | — |
| 同＋shiso 1.35em（#758） | 〃 | 19.8（RESULT 約 14.7×1.35） | — | — | — |

- RESULT の xs は箱で 15〜20px。**20px 未満は識別根拠の共通基準がまだ無い**【未確認】（Fresh Audit の M4／M10 と同じ。#758 の 1.35em で shiso は改善済みだが、他の xs は未対応）。
- xs 食材（corn, capers, oregano, rosemary, parsley, shiso, mint）のうち、SVG 化済みは shiso／capers／oregano／rosemary。**corn・parsley・mint は絵文字のまま ×0.7×0.75 で ≒14.7px**。Apple Color Emoji は実質の描画面積が絵文字ごとに異なる（Fresh Audit M6、【未確認】）。

### 3.2 補正の「方式の乱立」【実測】

個別補正が `App.css` の 12 以上のセレクタに分散（`822-917`、`8303-8386`）。値は 1.1〜1.5em と食材ごとに違い、`.ingredient-chip` 内の専用上書き（arugula, bell-pepper）が点在。意図の記録は各 Result に分散し、**一覧表（食材×場面×実効 px）は存在しない**。次の補正 PR が HOT の `App.css` で衝突しやすい。→ 改善候補 I-5。

### 3.3 場面ごとの穴【実測／引用】

| 場面 | 状態 | 備考 |
|---|---|---|
| トレイ（26px）・在庫・Shop・Dex | SVG 33 種は `IngredientGlyph` 経由。専用チップ上書きは arugula／bell-pepper のみ | 梅肉は 26px でペースト＋梅の花が読めるか【未確認】（#739 Result §6-1） |
| ピザ上 | 絵文字 28px／SVG 箱 | pieceVisual あり＝チーズも SVG（ラッパー内） |
| CUT | `toppingFootprint.ts`（#479 S3）。見た目と当たり範囲は別計算 | SVG 充填率が絵文字と違う分の再確認は未了（Fresh Audit M5） |
| RESULT | ×0.75。mozzarella は免除 | 上記 3.1 |
| サムネイル | 同じ描画経路 | 実寸は更に小さい（未計測） |
| 結果チップ | #771: ピーマン glyph 1.45em がラベルに近い（箱の張り出し約 2.7px）。見た目は未確認 | P3・要実機 |

## 4. 焼成前後の見え方

### 4.1 仕組み【実測】（`bakeVisual.ts:223-263`、`PizzaStage.tsx:1066-1080`）

- 全トッピング共通の **フィルタ曲線**: heat 0→0.8 は無変化、1.0（ちょうど）で brightness 0.97／sepia 0.08、1.6 で 0.90／0.14、2.0（黒焦げ）で brightness 0.78／saturate 0.80／sepia 0.20。
- `bakeRoastResistant: true`（緑ハーブ）は緩い曲線（2.0 でも 0.90／sepia 0.06）。対象は **ingredients.ts 内で 8 件**。
- チーズは別系（`cheeseVisualFrame`、mozzarella は Canvas の溶解）。ソースは焼成前のレイヤで、このフィルタ対象外。
- フィルタは `filter` のみ。**形・色相は変わらない**。SVG 食材も同じ 1 本の曲線。

### 4.2 見立て【推論】

1. **焼成前→ちょうど（heat 0→1）の変化は最大でも brightness −3%／sepia 8%** で、ほぼ見えない。プレイヤーは「焼く前と同じ具材」を見る。これは意図（具材で焼き加減を判断させない）の可能性が高く、Owner の既存方針（Bake 5 段階は**生地**で見せる）と矛盾しない。**T7 では変更提案しない**。
2. **濃色の具材（black-olive, beef, sausage, bacon 焼き面）は 0.78 でも差が小さく、黒焦げ段階で具材が「消える」より「汚れる」**。逆に **淡色の SVG（whitebait, cream-cheese, ricotta, feta, 大葉）は sepia で黄ばんで生地色と近づく**（M7 のいくら橙 on 橙と同型）。具体的な数値は未計測【未確認】。
3. **SVG は輪郭線の色も一緒に暗くなる**ため、黒焦げ段階の輪郭コントラストが下がる（しらすは #739 で輪郭を `#2e2a1d` に濃くした）。焼成後の同一食材の見え方は #739 の HV 動画範囲でしか確認されていない（#739 Result §6-2）。
4. **Fry の一時状態（friedLook）は #751 の addendum で別系統**（`--fry-bright/sat/sepia/sheen`）。**焼成曲線との合成は未決**。T7 の範囲外として引用のみ。

## 5. 改善の優先順位

優先度は「プレイヤーの誤認／判読不能の起こりやすさ」×「変更の小ささ・安全性」。**全て描画のみ（Save／採点／レシピ／Research authority 無影響）が前提**。

| 順位 | ID | 内容 | 根拠 | 規模・リスク | 依存 |
|---|---|---|---|---|---|
| **P1** | I-1 | **実機計測の一括実施（コード変更なし）**: SVG 33 種＋絵文字の xs を、390×844／360×800 の RESULT・焼成後・黒焦げで 1 枚の contact sheet にして Owner が iPhone で判定 | 3.1 の 20px 未満問題と 4.2 の見立てが全て【未確認】。先に実測しないと I-2〜I-4 は当て推量 | 小（dev サーバー＋ Playwright。HV 動画は Owner へ直接） | なし |
| P2 | I-2 | **xs 絵文字 3 種（corn／parsley／mint）の SVG 化または xs の再分類** | 箱 14.7px（RESULT）。xs で SVG 未対応は実質この 3 種 | 中。SVG なら Style Lock 外の新デザインで Owner 判断が要る。再分類は `toppingSizeClass.ts` 網羅テストに影響 | I-1 の結果 |
| P3 | I-3 | **淡色 SVG の焼成後コントラスト補正案**（whitebait／cream-cheese／feta／ricotta／shiso）。`toppingVisualFrame` に食材別の係数を足すか、輪郭色を焼成に連動させない | 4.2-2／3。焼成曲線は共通 1 本のため、淡色が生地に溶ける懸念 | 中。`bakeVisual.ts`＋ golden 影響の可能性（要事前確認） | I-1。#751（Fry）の曲線設計と衝突しないか確認 |
| P4 | I-4 | **#771 ピーマン 1.45em の実機確認のみ** | 既存 Issue。見た目は未確認 | 極小 | 実機 |
| P5 | I-5 | **補正の一覧表（食材×場面×実効 px）を docs 化し、`App.css` の食材別セレクタを 1 つの `--glyph-scale` 変数方式にまとめる設計メモ** | 3.2。HOT ファイルでの衝突予防 | 設計メモ＝小。実装は HOT 触るため別 claim | #770 の Style Lock 反映と整合 |
| 保留 | — | チーズ系の SVG 化（Pilot B/C）、mozzarella Canvas 分離、Apple 絵文字の全面置換 | Owner 判断待ち（Fresh Audit §4／§8 のまま）。本書は触らない | — | — |

「ソース 7 種の絵文字（🍅 など）」は SVG 化の優先度を**上げない**: ソースは塗り（PAINT）で表示され、アイコンは主にトレイ／在庫に出る。トレイの識別（色のみで足りる）は #554 等の別件。

## 6. 検証・受け入れ条件（I-1 を実施する場合）

HV Policy に従う: 390×844 動画（Owner へ直接・commit しない）＋ before／after スクショ（`docs/reports/screenshots/<task-name>/`）＋ Result Report。360×800 も確認。共有 Preview は Owner 承認なしに更新しない（ローカルの dev サーバーで足りる）。

## 7. Owner 判断事項（T7）

| # | 判断 | 推奨 |
|---|---|---|
| T7-O1 | I-1（実機計測のみ、コード変更なし）を先に実施してよいか | **はい**。以降の判断材料になる |
| T7-O2 | xs 絵文字 3 種（corn／parsley／mint）を SVG 化するか、xs の ×0.7 を緩めるか | I-1 の結果後に判断（今は決めない） |
| T7-O3 | 焼成曲線を食材別に分ける方針を認めるか（現状は共通＋ハーブのみ） | I-1 後。#751 の Fry 曲線と同時に決める |
| T7-O4 | 補正値の一覧表を docs（本書の別ファイル）に作ってよいか。Style Lock 変更は #770 に任せる | 作る（新規ファイルのみ） |

## 8. 次の行動

1. Owner が T7-O1 を承認 → 計測用 claim を新規に取り（`src/` 不要）、contact sheet を作成。
2. その結果で I-2／I-3 の Owner 判断表を作る。
3. 実装は全て別 claim・別 PR。HOT ファイル（`App.css`）を触る場合は、先行 PR を明記。

---
_調査のみ。数値は算出値で、実機の見え方ではない。_
