# M7（焼成後のソース・液体）— 保存互換・二重消費の防止・在庫不足時の原子的拒否の検証（#780、docs-only・検証のみ）

2026-11-10 / 基準 main `d3d4ec05`。Owner 指示: 「M7 #804 の設計を継続し、保存互換・二重消費防止・在庫不足時の原子的拒否を検証する」。**コード・テスト・golden・HOT は変更していない。** M7 の実装・本番 ON・共有 Preview の更新はしない。凡例: 【実測】コードの読取りと実行、【設計案】本書の提案、【未確認】測っていない。関連: `TETO_M7_POSTBAKE-SAUCE_DESIGN_2026-11-09.md`、`TETO_M7_HONEY-TEST-DESIGN_2026-11-09.md`（T-1〜T-6）、`TETO_M7_ALLOWLIST-NO-DOUBLE-APPLY_DESIGN_2026-11-09.md`。

## 1. 結論（先に）
**現在の在庫の仕組みは、焼成後の液体（honey などの spread 形）をそのまま扱えない。** M7 を既存の FINISH 経路に載せるだけだと、(a) 液体は「置けない」と拒否される（`placement` が scatter でない）か、(b) 拒否を外すと**消費されずに使える**（消費関数は散らす後乗せの駒だけを数える）。DRIZZLE D1 の純粋ロジックは在庫に接続していないので、**原子的拒否と二重消費の防止は D2 以降の設計で初めて成立する**。今回の検証で、D2 が満たすべき条件とテストを具体化した（§4）。

## 2. 現在の仕組み【実測：`src/state/inventory.ts`・`gameReducer.ts`】
| 論点 | 現状 |
|---|---|
| 置く前の在庫判定 | `canPlaceIngredient`（焼成前）・`canPlacePostBakeIngredient`（FINISH）が、置く**前に**在庫を判定し、不足なら置かずに「rejected」を返す。在庫そのものは減らさない（`gameReducer.ts` 1115〜1135 行付近）。**拒否は状態を変えない**（`placement` の通知だけ） |
| 消費のタイミング | 在庫の消費は `CONFIRM_BAKE` の `consumePizzaInventory`（焼成前の駒とソース）と、FINISH を出る遷移の `consumePostBakeInventory`（FINISH で置いた駒だけ）の 2 回に分かれる。`CONFIRM_BAKE` は exactly-once のガードがある（1525〜1531 行付近） |
| 二重計上の回避 | FINISH の在庫は「焼成後の残り」で、数えるのは FINISH の駒（`isPostBakePiece`）だけ。焼成前後の両方で使う食材を二重に数えない（`canPlacePostBakeIngredient` の注記） |
| **液体の扱い** | `canPlacePostBakeIngredient` は `ingredient.placement !== "scatter"` なら**常に false**（`inventory.ts` 166 行付近）。`consumePostBakeInventory` は `isPostBakePiece` の駒だけを数える（`pizza.toppings` の駒）。**液体は `pizza.toppings` にも `isPostBakePiece` にも現れない**（D1 の `PostBakeLiquid` は別の型で、`src/` の他の場所から参照されていない【実測：`src/` で `liquids`／`PostBakeLiquid` の文字列が D1 の外に現れるのは `finishCatalogGuards.test.ts` と `recipeBatchValidator.ts` のみ。その用法が D1 の型への参照かは未確認で、reducer・在庫・保存には現れない】） |
| DRIZZLE D1 | 純粋ロジック（`postBakeLiquid.ts`・`sanitize.ts`・`trail.ts`）。reducer・journal・在庫・採点・識別・UI・保存に**接続していない**。許可リストは `["olive-oil"]` のみ（`POST_BAKE_LIQUID_INGREDIENT_IDS`）。D1 の 4 本＋在庫関連のテスト 7 ファイル・110 件が成功【実測】 |

## 3. 3 つの検証項目
### 3.1 保存互換
- D1 の `sanitize` は保存用に 1 筋 24 点以内（`PERSIST_MAX_POINTS_PER_STROKE`）・液体 4 本以内（`PERSIST_MAX_LIQUIDS`）に間引き、敵対的な入力（長さが変わる Proxy・`1e20` の長さ・往復する軌跡）に対して冪等・有限であることをテストしている【実測：`sanitize.test.ts`】。
- **未接続のため、保存データには何も書かれない**。M7 の接続（D2〜D5）で `liquids` が保存に入ると、旧ビルドは未知のフィールドを読む。保存の `CURRENT_SCHEMA_VERSION`（2）を上げずに済ませるには、旧ビルドが未知の液体を**落としても壊れず、保存領域には残る**ことが要る【設計案；既知フィールドの外を保存領域に残す性質（`extractForwardCompatExtras`）は D-ING-1 R1 のテスト設計 SAVE-2 が確認項目としているが、まだ実測しておらず、`pizza` 内の新フィールドに同じ性質が成り立つかも未確認】。
- 条件: ① 旧ビルドで読み込める（クラッシュしない）、② 未知の液体は落とされても保存領域に残る（ロールバック保護）、③ journal（保留中のラウンド）の新フィールドも同様、④ `CURRENT_SCHEMA_VERSION` は据え置き。

### 3.2 二重消費の防止
- 同じ食材を PAINT 経路（焼成前のソース層）と液体経路（焼成後）で**同時に消費しない**ことは、T-4 が定める。実測した事実: honey は `recipeSauceProfiles` に行が無く「存在で採点」され、現在 honey を焼成前の要件に持つレシピ（pesto-noci-pizza）がある。hot-honey-pepperoni が honey を焼成後の要件に持つと、**同じ honey が 2 レシピで別の工程**になる【T-2】。
- **消費は 1 回の調理で 1 経路だけ**にするため、液体の消費は既存の exactly-once の枠（`CONFIRM_BAKE` は焼成前、FINISH を出る遷移は焼成後）に**乗せる**のが最小の変更【設計案】。別の消費点を作ると、`CONFIRM_BAKE` のガードで守られている exactly-once が液体だけ外れる。
- **現状では二重消費は起きない**（液体が在庫に接続していない）。リスクは**接続時**に生じる。

### 3.3 在庫不足時の原子的拒否
- 既存の拒否は「置く前に判定し、不足なら状態を変えず rejected」で原子的【実測】。
- 液体に同じ性質を持たせるには、**液体専用の判定**（`canApplyPostBakeLiquid`）が要る。既存の `canPlacePostBakeIngredient` は scatter 専用で液体を常に拒否する【実測】ため、**そのまま流用できない**。
- 原子的であるための条件【設計案】: ① 判定は在庫・pizza・journal のどれも書き換えず、不足なら `rejected` だけを返す、② 判定と記録は 1 回の reducer 遷移で行い、「在庫は減ったが液体は記録されない」「液体は記録されたが在庫は減らない」の中間状態を作らない、③ 消費は FINISH を出る遷移で 1 回（Undo では巻き戻る: 既存の `undoStock` と同じ性質）。

## 4. D2 以降のテスト（案。実装は D2 以降・Owner 承認後）
| ID | テスト | 今できるか |
|---|---|---|
| M7-V1 | 液体は `pizza.toppings` を増やさず、`consumePostBakeInventory` が液体を数えない現状の固定（ベースライン） | **今できる**（テストのみ・HOT なし）が、本書は書かない（コード変更を伴うため Owner の指示を待つ） |
| M7-V2 | 在庫不足の液体は拒否され、`inventory`・`pizza`・`journal` が**同一参照**のまま（原子的拒否） | D2 の後 |
| M7-V3 | 在庫が十分な液体を 1 回適用 → FINISH を出る遷移で**ちょうど 1 回**だけ消費 | D2 の後 |
| M7-V4 | 同じ食材を使う別々のレシピを個別に検証する。pesto-noci-pizza は焼成前（PAINT）のラウンドで honey を 1 回だけ消費し、hot-honey-pepperoni は焼成後（液体）のラウンドで honey を 1 回だけ消費する。各レシピ・各ラウンドの消費経路は 1 つ、消費回数は 1 回であり、二重計上しない | D2 の後（honey を使うレシピが 2 つになった時点） |
| M7-V5 | Undo／リロード／journal の復元で、液体と在庫が整合し、二重に消費も復活もしない | D2〜D3 の後 |
| M7-V6 | 旧ビルドで新しい保存を読む（ロールバック）とクラッシュせず、液体が保存領域に残る | D3 の後 |
| M7-V7 | `CURRENT_SCHEMA_VERSION` が 2 のまま | D3 の後（定数のピン） |

## 5. Owner 判断（推奨つき）
| 論点 | 選択肢 | 推奨 |
|---|---|---|
| 液体の在庫の接続方法 | (a) 既存の FINISH の枠（exactly-once）に液体専用の判定・消費を足す／(b) 液体用に別の消費点を作る | **(a)**（exactly-once のガードを再利用でき、Undo の既存性質を保てる） |
| M7-V1（ベースラインのテスト）を今書くか | 書く（テストのみ・HOT なし）／D2 と一緒に | D2 と一緒（今は M7 の完成条件が D2 以降にあるため） |
| honey を焼成前の要件に持つ既存レシピ（pesto-noci-pizza）と M7 の共存 | M7-V4 で別工程として扱う／M7 の対象から honey を外す | 別工程として扱う（Owner 決定済みの初号機は honey） |
**停止条件**: 在庫が負になる／原子的拒否で中間状態が残る／exactly-once が破れる／`CURRENT_SCHEMA_VERSION` を上げる必要が出る場合は停止して報告する。
