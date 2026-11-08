# buffalo-chicken-pizza 案 B（late カタログ・焼成後の点状ソース）の設計（docs-only、Refs #780）

2026-11-08、main `4ba05597`。**設計のみ。** `src/`・HOT ファイル・`src/data/staged/**`・golden は未変更。B20-A（#790）は別セッションが claim 保持中のため、B20-A 完了まで HOT ファイルには着手しない。本番昇格・Production ON・共有 Preview 更新なし。HV 対象外（docs-only）。
ラベル: 【実測】= main のコードで確認済み（前回の Result 参照）、【推論】、【未確認】。

## 1. 位置づけ
Owner 判断: 案 B を設計対象として採用。Research の 4 品 34 ID は未承認のまま。実装・昇格は B20-A の後、別途承認。

## 2. 設計（暫定。数量・色・名前は GAMEPLAY ASSUMPTION、原典未確認）
| 項目 | 内容 |
|---|---|
| 配置 | late カタログ（`lateCatalog.ts`）。late レシピは POST_BAKE 要求が必須【実測】 |
| id | `buffalo-chicken-pizza`（旧 staged `buffalo-chicken-pizzadb`。出荷履歴なし、衝突なし【実測】）。evidence ID は `buffalo-chicken-pizzadb` を保持 |
| 材料 | chicken 2（焼成前 topping）／gorgonzola 3／mozzarella 3（焼成前 cheese）／**buffalo-sauce 2（POST_BAKE の点状）**。焼成前のソースなし（ソースなしの出荷済み 22 品が前例）。重複ゲート: 前回の測定でヒットなし（buffalo-cauliflower-pizza と Jaccard 0.40、閾値は >0.4 で非該当） |
| buffalo-sauce | late 専用の素材。**category は topping**（POST_BAKE は topping のみ許可）、placement `scatter`（FINISH で置く点）。sauce の category は使わない。`unlockCondition` は late の他素材と同じ（星条件なし） |
| 工程 | DOUGH → CHEESE → TOPPING → BAKE → FINISH（buffalo-sauce の点）。新しい仕組みは不要。`deriveCoreSteps` は pre-bake にソースが無ければ SAUCE 工程を出さない【実測】 |
| ladder | late の末尾に 1 step `[buffalo-sauce]`、key `buffalo-chicken-pizza` |
| Hint 5.0 | buffalo-sauce の family と size class の行が必要（案: family `spice`、size `s`。Owner 判断）。SAUCE の梯子段が無いレシピなので、梯子は CHEESE／STRUCTURE／SUB_CLASS から始まる見込み【推論・要測定】 |
| アイコン | 専用 SVG: 橙赤（`#d9481c`）の光る点状のたまり 3〜4 個。代替表示 🍷（全カタログで一意、確認済み）。SVG の配線は HOT（`IngredientGlyph.tsx`・`App.css`）で B20-A の後 |
| 注意 | 出典の「ソース」を topping に分類する点が唯一の方針判断（焼成後というタイミングは出典どおり保つ）。DRIZZLE（#776）が本番化されたら、液体表現へ移行する案 C が残る |

## 3. Research
ID の集合は ladder の位置に依存しない（Research は ID 集合から決まる）ため、変わる既存 ID は前回の 8 件（bbq-chicken-pizza／curry-pizza-japan／frango-catupiry／jamaican-jerk-chicken-pizza／pesto-noci-pizza／pesto-pollo／quattro-formaggi／reina-pepiada-pizza）と同じ見込み【推論】。ただし遷移の文字列は late 末尾に置くため前回（普通 step 72）と変わり得る。**再測定が必要。未承認。** 4 品全体の 34 ID も未承認。

## 4. 実装前の確認事項
validateLateCatalog（本番の関数）、late の `LATE_DISCOVERY_TARGET_IDS`・`LATE_ORDERS`、Hint 5.0 の golden、保存安全性、390×844／360×800 の 1 画面 UX（FINISH の点の置きやすさ）、実機 HV（UI 変更のため）。

## 5. Owner 判断の記録（2026-11-08）
- buffalo-sauce: family=`spice`、size class=`s` を暫定採用（案 B 向け）。**実装は HOLD。**
- B20-A の実装は Draft PR #792 に一本化（実装担当 `session_016YrGi2mqx12Yxf3c5WuVLh`）。`session_016YrGi1AJW3sF49Uzak3yaN` は重複 claim の整理対象で、新たな実装は行わない。
- main WebKit run 42455506474: 初回 failure は 390x844 shard 2/3 の `expansion-grandma.spec.ts:138`（E-AC2、240 秒タイムアウト、`Page closed`）。同じ SHA の attempt 2 は 255 件合格・全ジョブ success。**間欠的な事象として記録**。追加の再実行・コード変更・テストの変更は不要（Owner 確認済み）。
