# B22 Owner 決定表（6 レシピ・10 食材）— HOT 編集の開始条件（#780、docs-only）

2026-11-09 / 基準 main `719428e0`。出典: B22 準備書（PR #801、`TETO_EXPANSION-BATCH-22_Prep_2026-11-09.md`）、M7 設計（本ブランチ）。**本書は決定表で、どの項目も Owner 承認までは確定扱いにしない。HOT ファイルは編集していない。** 凡例: 【実測】、【推論】、【未確認】。

## 0. 開始条件の現状
| 条件 | 状態 |
|---|---|
| #800（tortilla-chips の SVG 配線）の merge | **完了**（`719428e0`、HV 3/3 PASS、Deploy・WebKit E2E 成功）。HOT の直列待ちは解消 |
| #776（DRIZZLE D1）の merge | 完了（`1d5f5a1e`）。B22 の buffalo-sauce は PAINT で、M7 の許可リストと無関係 |
| HOT の claim 競合 | #780 に 11/09 11:13 以降の新規 claim なし。open PR で HOT を触るものなし（T-B22 の claim 6738640959 は docs のみ）【実測、#780 の最新コメント】 |
| **Owner の仕様承認** | **未了。下の B22-1〜B22-12 が残る。承認後に HOT 編集を開始する**（1 PR、全 Vitest・CI・Codex・iPhone HV） |

## 1. 決定表（推奨つき）
| ID | 論点 | 選択肢・提案内容 | 推奨 |
|---|---|---|---|
| **B22-1** | **6 レシピの材料構成・数量**（提案は準備書 §2、数量は staged の暫定値） | finocchi-salad: black-olive 2・fennel 2・mint 2・mozzarella 3・olive-oil 1／orange 2 後乗せ。cavolo-carote: carrot 2・mozzarella 3・olive-oil 1・sunflower-seeds 2／lemon 2・red-cabbage 2 後乗せ。radicchio-noci: mozzarella 3・olive-oil 1・balsamic 1・walnut 2／radicchio 2 後乗せ。black-truffle: mozzarella 3・parmigiano 3／truffle 2 後乗せ。speck-e-brie: brie 3・mozzarella 3・prosciutto-crudo 2・walnut 2。buffalo-chicken: buffalo-sauce 1・chicken 2・gorgonzola 3・mozzarella 3 | 提案どおり承認（全値は原典未確認の GAMEPLAY ASSUMPTION と明記） |
| **B22-2** | **置き場所**（late／通常） | late: finocchi・cavolo・radicchio・black-truffle（後乗せあり）。**通常**: speck-e-brie・buffalo-chicken → 新しい通常 step 72・73、late の導出 step 番号が +2（B19／B20-A と同じ、`LATE_ENTITLEMENT_FLOORS` は不変） | 承認 |
| **B22-3** | **buffalo-chicken の工程** | **承認済み（M7-d）**: 焼成前の PAINT、通常カタログ、buffalo-sauce は M7 許可リストに追加しない。残る判断は色（赤橙、tomato-sauce と dE ≥ 25 を実装時に測る）と絵文字 🦬 | 色・絵文字のみ承認 |
| **B22-4** | **balsamic-vinegar（radicchio-noci の第 2 ソース）** | A: 焼成前の第 2 ソース層（honey の前例、新機構なし）／B: 後乗せトッピング扱い（新しい絵・サイズが要る）／C: DRIZZLE 本番化まで保留 | **A**（色は暗い茶、dE を実装時に測る【未確認】、絵文字 🏺） |
| **B22-5** | **truffle** | 薄切りの不規則な形（基本案、既存 SVG `truffle-shavings`）。family は `vegetable`（staged の暫定行）か `spice` か、size `xs`、後乗せ | 形は基本案で確定、family は Hint 5.0／DH4-PROD の測定結果で決める（`other` は OD-DH4-2-9 で不可） |
| **B22-6** | **食材 10 種の family／size** | fennel veg/s・orange fruit/s・carrot veg/s・red-cabbage veg/s・sunflower-seeds **spice**/xs・radicchio veg/m・brie なし/l（mozzarella・feta・cheddar と同じ）・buffalo-sauce/balsamic ソース | 承認 |
| **B22-7** | **絵文字**（SVG のある 8 種は表示されない） | SVG 無しの buffalo-sauce（🦬）・balsamic-vinegar（🏺）は絵文字がチップにそのまま見える（#799 の cheddar 等と同じ扱い）。G18（Hint family 記号と非重複）は実装時にテストで検査 | 候補を承認し、実機 HV で見た目を確認 |
| **B22-8** | **SVG の配線** | 8 種（fennel・orange・carrot・red-cabbage・sunflower-seeds・radicchio・truffle・brie）は B22 の列車 PR で `IngredientGlyph.tsx` に配線（色・形は PROVISIONAL のまま）。buffalo-sauce・balsamic は SVG なし | 承認 |
| **B22-9** | **Research の非正準順の変化**（ID ごとの承認） | 正準順の既存文字変化は 0 の見込み（decisions golden）。**非正準順の変化は実装時に測り、記載外の変化は停止**。測定後に ID・変化の一覧を Owner に提示して個別承認（B19／B20-A／B21 と同じ手続き） | 手続きの承認（個別の ID は測定後） |
| **B22-10** | **NO_SAUCE 2 品**（black-truffle・speck-e-brie） | TQ-1D の Technique 機構と DH4-PROD ゲートの再監査を実装時に実施（NO_SAUCE 集合は sauce-profile 権威から導出）。black-truffle は late の後乗せ Technique とも重なる。**ゲートは弱めない** | 承認（再監査が失敗したら停止して報告） |
| **B22-11** | **ID 改名 2 件**（D-4） | `speck-e-brie-pizzadb`→`speck-e-brie`、`buffalo-chicken-pizzadb`→`buffalo-chicken`（衝突なし・参照なしを staged で検証済み） | 承認 |
| **B22-12** | **再利用食材** | blue-cheese-dressing→gorgonzola（I-1）。重複 Gate は 6 品とも該当 0（B21 反映後の staged 測定） | 承認 |

## 2. 承認後の手順（HOT 編集の開始）
1. Owner が B22-1〜12（推奨どおりなら 1 回）を決める。
2. #780 に T-B22 の claim を更新（HOT 編集開始、範囲は準備書 §8）。**HOT の同時編集は 1 session**。
3. B22 を 1 PR で実装（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts` ほか、golden、`b22HvSeeds.ts`、E2E）。全 Vitest・tsc・CI・Codex、Research の ID 別一覧（B22-9）を Owner に提示、iPhone 実機 HV。
4. B22 の merge 後: D-ING-1 R1（`discoveryLadder.ts` の同じ HOT、Owner 承認済みの順序）→ M7（honey 初号機、T-1〜T-6）。M7 の完成には D2 以降が必要。
**停止条件:** claim 競合／Research の記載外の変化／重複 Gate 該当／NO_SAUCE・late の再監査失敗／保存互換性の問題／スラック < 1。**含めない:** merge・Production ON・共有 Preview 更新・B23 以降。

## 3. 件数（B22 の見込み）【推論】
食材 +10（106→116）、レシピ +6（95→101）、調理法 +0。進捗は B22 の merge 後に再測定する（現在 main: 食材 106／170、レシピ 95／177、調理法 7／27）。
