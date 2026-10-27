# ブッラータ — 焼成後（FINISH）のチーズ対応: 独立した設計課題と再利用性の評価（docs-only）

Status: **調査と整理のみ。runtime は実装していない**（`src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更）。実装・PR 作成・merge・Monitor 作成・Issue/PR へのコメント・claim 投稿はしていない。新規 Issue は作っていない（Owner の指示があれば起票する）。
基準 `main` = `08cd46d`。姉妹資料: `TETO_WASABI-BEEF_FINAL-DESIGN-GATE_2026-10-27.md`、`TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md`。
**Owner 決定（2026-10-27）:** ブッラータは**焼成後 FINISH 対応を優先して調査する。ただし共通機構としての再利用性を評価する。** ホットハニーと #579 DRIZZLE は HOLD。
**原典（pizzadb.jp）は未確認で、本セッションは到達していない。ブッラータを「焼成後にのせる」ことは、一般的な調理の知識に基づく GAMEPLAY ASSUMPTION であり、172 品 matrix にその記録はない。事実として断定しない。「推定」は測定値ではない。**
**「推奨」「評価」は助言であり Owner Decision ではない。**

## 1. 課題の定義

ブッラータは `category: "cheese"` の新食材になる。現在の FINISH（焼成後の仕上げ）は **`topping` カテゴリの `scatter` 食材だけ**を受ける。したがって、ブッラータを焼成後に置くには、FINISH がチーズを受けられるようにする必要がある。これは**ブッラータ 1 件の問題ではなく、「FINISH のチーズ対応」という共通機構の問題**として扱う。

## 2. 現状（コードで確認したこと）

| 箇所 | 現状 | 変更が要るか |
|---|---|---|
| `src/state/gameReducer.ts`（`PLACE_TOPPING` の FINISH 分岐） | `placingIngredient.category !== "topping"` なら拒否。チーズ・ソースは置けない | **要** |
| `src/state/inventory.ts`（`canPlacePostBakeIngredient`） | `ingredient.placement !== "scatter"` なら不可。**カテゴリは見ない**。出荷済みの 11 種のチーズはすべて `placement: "scatter"` | 不要（カテゴリ非依存） |
| `src/state/undoPlacement.ts`（FINISH の Undo） | FINISH で取り消せるのは `getIngredient(...).category === "topping"` の後乗せ piece だけ | **要** |
| `src/logic/prepareDock.ts`（`finishTrayIngredients`） | Guided は recipe の `POST_BAKE` 材料のうち所持品。**Free Cooking / Research は所持している `scatter` の `topping` をすべて並べる**（tray が狭いと「どれが後乗せ可能か」を名指しするため、OD-TQ-16 / UD-B）。`ingredientsByCategory("topping")` で絞っている | **要**（チーズを含めるか。§4） |
| `src/data/cookingProfiles.ts`（`deriveCoreSteps`） | `POST_BAKE` の要件は**カテゴリごとの step を足さず FINISH だけ**を足す。ブッラータだけをチーズとして `POST_BAKE` にしても CHEESE step は出ない | 不要（既に整合） |
| `src/components/PostBakePiece.tsx` / `IngredientPieceVisual.tsx` | 後乗せ piece は焼成前の経路（bake の溶け・広がり）を通らず、`IngredientPieceVisual` で描く。`pieceVisual` を持つチーズ（feta・ricotta）は SVG を同じ wrapper に描く | ほぼ不要（`pieceVisual` を持つチーズなら描ける。`ricotta-mound` が前例） |
| `src/logic/discovery/signature.ts`（`late` 軸） | 後乗せ piece の食材 id の集合。カテゴリ非依存 | 不要 |
| `src/logic/catalog/testSupport/recipeBatchValidator.ts:181` と `finishCatalogGuards.test.ts:104-109` | **`LATE_NOT_TOPPING`: late の食材が `topping` かつ `scatter` でなければ違反**。late のチーズ・ソースは違反とするテストがある | **要**（意図した契約変更。Owner 承認が要る） |
| `src/state/gameReducer.finish.test.ts:85` | 「takes toppings only: cheese, sauce, … are refused」 | **要**（同上） |
| Hint（`hintSteps.ts`）の `COUNT_CHEESE` | `ingredients.some(category === "cheese")` で「チーズを使うみたい / 使わないみたい」を出す。BASE 段は全ソース + 全チーズ | カテゴリが `cheese` のまま `POST_BAKE` になる分には文面は正しい（次節 O1 との比較） |
| Scoring 2.0（`src/logic/scoringV2`） | チーズ専用の分岐は無い（`cheese` を直接参照しない） | 不要（**読んだ範囲。採点への影響は未実測**） |
| Reference | `stage: "post"` の piece を `requiredIngredients` の順に同じリングで配置 | 不要 |

## 3. 選択肢

| 案 | 内容 | 長所 | 短所・リスク |
|---|---|---|---|
| **O0** | ブッラータを出さない | 変更なし | 候補を使えない |
| **O1** | ブッラータを `topping` カテゴリにする（FINISH は無変更） | データのみ | **family が要る**（topping は family 行を持つ。該当は `other` しかなく、`other` は OD-DH4-2-9 で「到達不能」を維持する契約。月見が保留されている理由と同じ構造で、DH4 gate に触れる可能性が高い）。チーズの棚・Hint の BASE 段・`COUNT_CHEESE`（チーズを使うのに「使わないみたい」と出るおそれ）が実態とずれる。**非推奨** |
| **O2** | **FINISH がチーズ（`scatter`）を受けるようにする（共通機構）** | 本来のカテゴリのまま焼成後に置ける。出荷済みのチーズ 11 種が将来の仕上げに使える | 契約変更（下記）。Free Cooking の識別空間が広がる。再利用の証拠が薄い（§5） |
| **O3** | ブッラータを焼成前のチーズ（CHEESE step）にする。`pieceVisual`（ricotta-mound の前例）で個性を出す | 機構の変更なし。データ + 2 ソース対応のみ | 「焼成後にのせる」感は出ない（焼成の溶け・広がりの変換を受ける）。**焼成後が本来の姿という仮定自体が未確認** |

## 4. O2 の設計（共通機構として）

### 4.1 変更の最小形（提案）
FINISH が受ける条件を「`topping` カテゴリ」から「**`scatter` の `topping` または `cheese`**」に広げる（ソース・液体は引き続き不可。液体は #579、HOLD）。触る箇所は §2 の「要」の 4 つ（reducer の FINISH 分岐、FINISH の Undo、`finishTrayIngredients`、`LATE_NOT_TOPPING` と対応テスト）。**コード行数は小さい（推定 数十行）が、検証の範囲は広い。**

### 4.2 論点（Owner 判断を含む）

| 論点 | 内容 |
|---|---|
| Free Cooking の tray | Free / Research の FINISH tray は「所持している `scatter` の `topping` をすべて並べる」（後乗せ可能な食材を名指ししないため）。チーズを受けるなら、**所持しているチーズもすべて並べる**必要がある（ブッラータだけを並べると、後乗せ可能なチーズが漏れる）。最大 11 種 + ブッラータ = 12 個の chip が加わり、tray のページ数が増える（#675 の 75 食材 UX 調査と関係） |
| 識別空間 | 任意のチーズを焼成後に置けるようになり、`late` 軸（`["POST_BAKE", ids]`）の組合せが増える。既存レシピの識別（焼成前のチーズ）は変わらないが、**焼成後にモッツァレラを置いたピザは別の識別になる**（ORIGINAL）。Research / Hint 5.0 / DH4 の privacy sweep の再実施が要る |
| 技法「後乗せ」の発見 | Free Cooking で「焼成後にチーズを置いた」ピザが、使用経路で技法を発見する条件に入るか（現状は topping の後乗せが対象） |
| 採点・Reference | チーズの後乗せ piece の Reference 配置（`stage: "post"`）、`pizzaForFinalEvaluation` のフィルタ、在庫消費（FINISH のみ）。**チーズに固有の分岐は読んだ範囲では無い。実測は未実施** |
| 見た目 | 後乗せ piece は焼成のフィルター・溶けを受けない（D2-2a）。**ブッラータは「焼成後にのせた白いボール」として描ける**が、mozzarella（白）との混同、`pieceVisual`（ricotta-mound 型）の SVG が要る |
| 契約テストの変更 | `gameReducer.finish.test.ts:85`、`finishCatalogGuards.test.ts:104-109`、`recipeBatchValidator.ts:181` は「FINISH はトッピングだけ」を固定している。**弱めるのではなく、意図した契約変更として Owner が承認し、チーズを許す新しい肯定テストと、ソース・液体が引き続き拒否される否定テストを維持する** |
| Anti-Oracle | tray が後乗せ可能な食材を名指ししない原則（OD-TQ-16）を、チーズを含めても守る |

## 5. 共通機構としての再利用性の評価

| 観点 | 結果 |
|---|---|
| **matrix に「焼成後のチーズ」の記録がある行** | **0 行**（`postBakeFinish` の食材 18 件の内訳: 粒状 topping 等 14、ソース・液体 4、チーズ 0） |
| ブッラータの行（burrata-pizza・pesto-burrata・pizza-alla-crudaiola） | 3 行とも READY だが、**焼成後の記録は無い**（本資料の「焼成後」は一般知識に基づく仮定）。**3 行とも `MULTI_SPREAD_LAYER`（ソース 2 層: トマト or ペスト + オリーブ油）を要する** |
| 既存のチーズが将来使える可能性 | parmigiano・grana-padano・ricotta・feta・goat-cheese などは焼成後の仕上げとして現実にはありうるが、**matrix に根拠のある行は無い**（潜在的・未証拠） |
| 再利用先の数（証拠のあるもの） | **0**（ブッラータ 3 行は仮定に依存） |
| 他の共通機構との関係 | 液体の後乗せ（#579、HOLD）とは別問題だが、FINISH のカテゴリ制限という同じ制約に当たる。同時に設計すれば `LATE_NOT_TOPPING` の再設計を 1 回にまとめられる |

**評価（助言）:** FINISH のチーズ対応は**コードは小さいが、契約テスト・Free Cooking の識別空間・privacy sweep に波及する**。一方で**再利用の証拠は現時点で 0**。ブッラータ 3 行の「焼成後」は未確認の仮定で、さらに 3 行とも **2 層ソース（`MULTI_SPREAD_LAYER`）が別のブロッカー**として残る。すなわち **FINISH のチーズ対応だけではブッラータを出せない**。

### 5.1 2 層ソース（ブッラータの別ブロッカー）
- 2 ソース必須のレシピは `grandma-pizza`（角形・天板）の 1 件だけ（`MULTI_SAUCE_RECIPE_IDS`）。丸形の 2 ソースは #540（Draft・HOLD、Square Dough の完了待ち）。
- 2 ソースの経路自体は出荷済みだが、**丸形で `olive-oil`（`PAINT_TEMPORARY`）と `tomato-sauce` / `pesto` を併用して Research・Hint・DH4 の契約を通るか**は本セッションでは未確認（許可リストへの追加と gate の再実行が要る、とコメントされている）。**測定が必要**。
- 原典どおりでなく、オリーブ油を省いた 1 層（例: トマト + ブッラータ + バジル）に簡約すれば 2 層ソースは不要になるが、matrix の `spreadLayers` から離れる（GAMEPLAY ASSUMPTION）。

## 6. 推奨（助言）と、次にできること

1. **ブッラータのために FINISH のチーズ対応をいま作らない。** 再利用の証拠が 0 で、ブッラータ自体が別のブロッカー（2 層ソース）を残すため。**設計は本書で保持し、起票・実装は Owner の指示を待つ。**
2. 再開の条件（提案）: (a) 焼成後のチーズを要する行が **2 件以上**、原典または Owner の共有で確認される、または (b) Owner が「焼成後のチーズ」という体験そのものに価値を置く。
3. ブッラータを早く出したい場合は **O3（焼成前・`pieceVisual` の盛り）+ 2 層ソースの測定**が先。FINISH の変更を伴わない。ただし「焼成後が本来の姿」という前提は仮定のままで、原典が確認されたら再分類する（OD-B9-16 の考え方）。
4. **次の docs-only の調査（Owner の指示があれば）:** (i) 丸形 2 層ソース（オリーブ油 + トマト / ペスト）が Research・Hint・DH4 の契約を通るかの実測計画、(ii) FINISH のカテゴリ制限を固定しているテストと検査の全数調査（本資料は 3 か所を特定。他にもありうる）、(iii) Free Cooking の FINISH tray にチーズを加えた場合の chip 数・ページ数、(iv) ブッラータ `pieceVisual` の SVG 比較（ricotta-mound・mozzarella との識別）。

## 7. Owner に決めてほしいこと

| ID | 質問 | 助言 |
|---|---|---|
| D-BU1 | ブッラータのために FINISH のチーズ対応（O2）を今は作らず、設計の保持だけにしてよいか | はい |
| D-BU2 | 再開の条件（§6-2）でよいか | はい |
| D-BU3 | ブッラータを先に出すなら、O3（焼成前）を許容するか（「焼成後」は未確認の仮定） | O3 は 2 層ソースの測定後に判断 |
| D-BU4 | §6-4 の追加調査（docs-only）を進めてよいか | Owner の指示で |
| D-BU5 | O2 を将来作る場合、契約テストの変更（`LATE_NOT_TOPPING` ほか）を意図した契約変更として承認する枠組みでよいか | はい（弱めずに肯定・否定の両テストを維持） |

## 8. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、Issue/PR へのコメント・クローズ。
