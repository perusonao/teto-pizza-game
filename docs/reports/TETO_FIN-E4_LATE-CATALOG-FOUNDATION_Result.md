# FIN-E4 共通基盤 — 後乗せカタログの単一合流点（データなし）

Issue #611 / #294 / #604。基準 main `78a4a0f`。Owner 方針（2026-10-21）: 本番 OFF は **案 1（ビルド時定数によるカタログ除外）**、共通基盤は独立 PR、FIN-E4b（BBQ）と #584 の再設計は基盤の後。

## 1. なぜ必要か

後乗せ（`applicationPhase: "POST_BAKE"`）の要件は、FINISH が走らないと満たせない。本番は FINISH OFF なので、後乗せレシピが `RECIPES` にあると **発見できず進行も止まる**。#584 のいくら・大葉に `POST_BAKE` を付けただけの実験（使い捨ての worktree、2026-10-21、リポジトリには残していない）では全 Vitest で 23 件が失敗し、うち 8 件（`discoveryHint.walk`、ヒント経済シミュレーション 4、`hint5Economy.sim`、`researchAttempt.sim` / `.replayAudit`）が「Dex 26/28 に到達できず行き詰まる」進行不能だった。したがって後乗せの内容は、レシピ・食材・ladder・発見カタログのすべてで、**ビルド時定数が `true` のときだけ**存在しなければならない。

## 2. 設計

`src/data/lateCatalog.ts` が唯一の合流点（データは空）。

| 項目 | 内容 |
|---|---|
| 切替 | `LATE_CATALOG_PRODUCTION = false`（リテラル）。合流とガードは関数呼び出しを経由するため、バンドルのデッドコード除去には**依存しない**（本番 OFF の保証は「データが同一」であり、バンドルのバイト同一ではない）。`lateCatalogEnabled()` が読む。ON にするのは別の Owner 判断（E5、FINISH 本番スイッチと同時） |
| 内容 | `LATE_RECIPES` / `LATE_INGREDIENTS` / `LATE_LADDER_STEPS` / `LATE_DISCOVERY_TARGET_IDS`。すべて空 |
| 合流 | `mergeLate(base, late, enabled)`。OFF（または late が空）は **base 配列そのもの**を返す（同一オブジェクト）。ON は `[...base, ...late]` |
| `RECIPES` | 既存配列を `BASE_RECIPES` に改名し、`RECIPES = mergeLate(BASE_RECIPES, LATE_RECIPES, enabled)`。型は `readonly [...Base, ...Late]` なので、late が空の間 `RecipeId` は不変 |
| `INGREDIENTS` | 同様（`BASE_INGREDIENTS`） |
| `DISCOVERY_LADDER` | 通常の追記 step の**後ろ**に late step を追記。late step の番号は常に「通常 ladder の長さ + k」。OFF の ladder は ON の ladder の厳密な前置部分（追記専用） |
| 発見カタログ | target id は通常レシピ（`Record<BaseRecipeId,string>`）か `LATE_DISCOVERY_TARGET_IDS` から。`discoveryIdentityOf(recipe)` が `POST_BAKE` 要件から `identityDimensions.late` と `capabilities: ["LATE_ADDITION"]` を**導出**する（手書きしない）。通常レシピは従来と同じ `DEFAULT_IDENTITY_DIMENSIONS` / `[]` |
| ガード | `validateLateCatalog`: id の一意、late レシピは `POST_BAKE` を持ち `lunchRush:false`、late 食材は `unlockCondition` あり（Starter にならない）、late step の key レシピ・素材が存在、同一レシピを key にする step の重複なし、late レシピが key になる step の存在（到達可能）、late 食材が step に載っていること（入手可能）、必須食材の実在、target id の過不足と重複なし。検査の入口は `discoveryCatalog.ts` 1 か所（ゲームのモジュールグラフには必ず入る）。ON のときモジュール読込時に検査し、違反ならビルド/起動が失敗する（プレイヤーに届かない） |
| 派生 | 保存の既知 id、Shop、Research cohort、在庫、ヒントはいずれも `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` から導出されているため、この 3 つ（と発見カタログ）の合流だけで全体に反映される。データ PR は、型で強制されるレシピ単位の表（`recipeSauceProfiles`、`recipeHintRoles`）に加えて、ここに late の項目を足せばよい |

## 3. 本番 OFF がバイト同一であることの保証

- **golden**（正規化 JSON は object のキー順を無視する。キー順も含めた同一性は別途確認した: 4 面（recipes / ingredients / ladder / 発見 target）の**キー順を保持した** `JSON.stringify` の SHA-256 が main と基盤ブランチで一致。発見 target のキー順は基盤の途中で一度変わり、元の順に戻した）`src/data/__golden__/lateCatalog.offSurface.json` + `lateCatalog.offGolden.test.ts`）: レシピ・食材・ladder step・発見 target・target id の **先頭 N 件の正規化 JSON の SHA-256**。値は基盤を足す**前の** main（`78a4a0f`）で生成し、基盤ブランチで同一であることを確認した（両者の JSON が一致）。先頭 N 件の digest にしたのは、カタログが追記専用で、通常の追加バッチが golden を触らずに済み、かつ既存の編集・並べ替え・削除は検出できるため。
- 負の対照: レシピ 1 件の `baseRewardPitz` を変える／ladder の 2 step を入れ替えると、golden の該当テストが落ちる（確認済み、元に戻した）。
- 「late が漏れない」テスト: late の id が `RECIPES` / `INGREDIENTS` / ladder に無く、どのレシピにも `POST_BAKE` が無い。
- `mergeLate(base, late, false) === base`（同一参照）を単体テストで固定。

## 4. ON / OFF の検証（合成の late 内容を差し込んだモジュール単位のテスト）

`src/data/lateCatalog.test.ts`。実カタログは空なので、`vi.doMock("./lateCatalog")` で合成の late レシピ・食材・step・target id を差し込み、実モジュールを再評価して比較する。
- レシピ: ON = OFF + late（既存の順序・内容は不変）。食材: late は Starter にならない。
- ladder: ON は OFF の厳密な前置、late step の番号 = OFF の長さ + 1、`validateAppendOnlyExtension` / `validateDiscoveryLadder` が空、late 素材は ON のときだけ入手可能（`obtainableIngredientIds`、`ingredientUnlockStep`）。
- 発見: 通常 target は不変。late target は `late` 軸と `LATE_ADDITION` を宣言し、技法 `late-addition` を要求するのは late target だけ。
- プロファイル: late レシピだけが `FINISH` を持つ。
- ON で不正な late 内容（`lunchRush` 未指定）は読込時に例外。
- **セーブ互換（テストしたのは Dex のみ）**: ON で作ったセーブ（late の Dex 記録つき）を OFF ビルドが開いてもクラッシュせず、late の記録は見えない。OFF が通常の Dex 更新を書き込んでも late の記録は保存領域に残り（既存の forward-compat merge）、ON で開き直すと復元され、OFF で行った変更も保たれる。`persistence.ts` のコードは所持食材・在庫・ヒント購入/事実・top-level キーの未知 id も同様に持ち越すが、これらは**テストしていない**（データ PR で `persistProgress` 経由のテストを足す）。注意: OFF の間は late の Dex 記録が発見数・ladder に数えられないため、ON のユーザーの late step の権利は OFF では見えない（保存領域からは失われない）。
- OFF なのに late の内容がソースに存在する場合でも、4 面のカタログが OFF の結果と完全に一致するテスト（Production の漏れ検査。合成内容で実効性がある）。
- 検証ツール: FIN-E1 の `validateCatalogTables` / `validateFinishCatalog` を「late を足した全カタログ」に対して実行するテスト（late が空の間は自明に通る。データ PR を拘束する）。

## 5. 範囲外 / データ PR への引き継ぎ

- この PR にデータはない。FIN-E4b（BBQ）と #584 の再設計は、この上で別 PR として追加する。
- データ PR の merge 条件は `docs/design/TETO_FIN-E2_LATE-AXIS_DESIGN.md` §8 の 1〜6（Hint 5.0 gate・privacy sweep の再実行、STRUCTURE 件数、時機を示すカテゴリ名の禁止、Research/Notebook/Hint に時機が出ないこと、技法 affordance の導出、UD-F/UD-G の Owner 決定）。UD-F / UD-G は未決定。
- 本番 ON（`LATE_CATALOG_PRODUCTION = true` と FINISH 本番スイッチ）は E5。共有 Preview は本番と origin を共有するため、ON ビルドを Preview に載せる場合の扱いは E5 で決める。この PR は Preview に触れない。
- 型の注記: late 用の id は型（`RecipeId`）には OFF でも含まれるが、実行時には ON のときだけ存在する。`Record<RecipeId, …>` の表は late の項目をデータ PR が足す。

## 5b. 既知の限界（E5 の前に決める）と、データ PR のチェックリスト

- **ON カタログは通常バッチをまたいで安定しない**: late の項目は通常の項目の**後ろ**に付くため、late の ladder step 番号（と `RECIPES` / `INGREDIENTS` 内の位置）は「通常の長さ + k」で、通常バッチが追記されるたびにずれる。本番は late を見ないので影響しないが、ON ビルドで作ったセーブの「step N」の権利や順序に影響しうる。ON にする前に、(a) ON の間は通常バッチを止める、または (b) late の step に予約した安定番号の範囲を与える、のどちらかを Owner が決める。
- **型と実行時の差**: late が非空になると `RecipeId` は OFF でも late の id を含み、`getRecipe(id)` は OFF で late の id を受けて `undefined` を返す。`Record<RecipeId, …>` の表には、実行時に OFF では使われない late の行が載る。表のキー集合が `RECIPES` の id と等しいことを前提にするテスト（`Object.keys(table)` と `RECIPES` の比較）は、データ PR で OFF/ON の扱いを確認すること。`INGREDIENTS` は合流後の型を `Ingredient[]` にキャストしている。
- データ PR のチェックリスト: late の項目（レシピ・食材・step・target id）を `lateCatalog.ts` に足す／`recipeSauceProfiles`・`recipeHintRoles` などの型強制の表に行を足す／所持食材・在庫・ヒント事実の保存互換テストを足す／FIN-E2 設計書 §8 の 1〜6。

## 6. 変更ファイル

`src/data/lateCatalog.ts`（新規）、`src/data/recipes.ts` / `ingredients.ts` / `discoveryLadder.ts` / `discoveryCatalog.ts`（合流の配線のみ）、テスト 2 本と golden 1 つ、本書、設計書の追記（E5 の OFF 方式の決定）。
