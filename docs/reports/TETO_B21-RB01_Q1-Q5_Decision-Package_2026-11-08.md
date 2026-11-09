# B21 / RB-01（taco-pizza・okonomiyaki-style-pizza）Q-1〜Q-5 一括提示（#780、docs-only）

2026-11-08 / 基準 `origin/main` = `348b1e4`。**Owner の承認を求める資料であり、実装・昇格はしていない。** 数値は `src/data/staged/**` の golden とテスト（`npx vitest run src/data/staged`: 9 ファイル 30 件合格、本日 348b1e4 で実行）から。原典 pizzadb.jp は**未確認**（全値が暫定）。

## 0. 先に: 再確認で分かった注意点【実測】
1. **注文文（order）が候補データに無い。** late レシピは各々 `order-<id>` の行（依頼者 mito の台詞）を持つ（`lateCatalog.ts` `ALL_LATE_ORDERS`）。昇格には 2 行の文面が要る → Q-3 に提案を追加。
2. **`recipeSauceProfiles.ts` の `ingredientId` はリテラル union。** `okonomiyaki-sauce` を追加する型変更が要る（HOT 関連の編集）。
3. **late の互換下限 `LATE_ENTITLEMENT_FLOORS` に 6 食材の固定値が要る**（下記 Q-3）。
4. 到達条件: ラダー step 79／80 は**クレジット済み発見数 79／80 以上のプレイヤーだけ**が新食材を買える（現在のクレジット済みレシピは 81）。

## Q-1 置き場所（late カタログ）
| 項目 | 変更前 | 変更後 |
|---|---|---|
| taco-pizza | 未出荷 | late カタログ（POST_BAKE の lettuce・tortilla-chips を持つため。通常カタログのレシピは late 専用食材を要求できず、late のレシピは POST_BAKE が必須） |
| okonomiyaki-style-pizza | 未出荷 | late カタログ（late 専用の `nori` を POST_BAKE で使うため） |
| 代案 | — | nori を通常食材へ昇格（B18 の cilantro の前例）→ 通常カタログ化。変更が `ingredients.ts`/`discoveryLadder.ts` に広がる |
推奨: late。変更が late の表だけで済む。

## Q-2 既存レシピへの影響（Research 文字）
正準順（ラダー順）では出荷済みレシピの文字変化は **0**。非正準順（B18/B19 と同じシナリオ）では **出荷済み 17 レシピ**の文字が変わる。ID ごとの承認が要る（`__golden__/firstTrain.research.json`）。記法 `前->後`（`-->` は文字なし→付与）:

| 出荷済みレシピ | 変化 | | 出荷済みレシピ | 変化 |
|---|---|---|---|---|
| baingan-bharta-pizza | -->A | | pizza-alla-crudaiola | -->A |
| california-style-pizza | -->A | | pizza-feta-eliniki | B->C, C->D |
| chilean-napolitana | -->A | | porchetta-pizza | -->B, B->C |
| cuban-pizza | -->B, A->B | | potato-mayo-pizza | -->B |
| goulash-pizza | -->A | | reina-pepiada-pizza | -->A |
| nigerian-suya-pizza | -->A | | rendang-pizza | -->A |
| pesto-burrata-pizza | B->C, C->D | | tarako-cream-pizza | -->A |
| pesto-caprese | -->A | | veggie-supreme-pizza | -->A |
| wasabi-beef-pizza | -->B, B->C | | | |
Hint 5.0: 2 品とも key-free（SAUCE／CHEESE／STRUCTURE／SUB_CLASS の段）。出荷済みの ladder への影響なし（テスト合格）。重複ゲート: 出荷済み・2 品どうしとも 0 件。保存: 昇格後に新 ID の図鑑・所持・在庫が読み込みで保持され、既存保存は不変。

## Q-3 データ（暫定、原典未確認）
**食材 6 種**（すべて T4: 1 パック 120 Pitz／補充 60 Pitz。到達 step 79 または 80）

| id | 名称 | 区分／配置 | 色 | 代替表示（一意・G18 合格） | 大きさ | family | step／下限 |
|---|---|---|---|---|---|---|---|
| cheddar | チェダーチーズ | cheese／scatter | #f2a33a | 🔶 | （チーズは既存の個別サイズ） | — | 79／79 |
| lettuce | レタス | topping／scatter | #9fd36b | 🪴 | m | vegetable | 79／79 |
| tortilla-chips | トルティーヤチップス | topping／scatter | #e8c25a | 🔺 | m | other | 79／79 |
| okonomiyaki-sauce | お好み焼きソース | sauce／spread | #5a3420 | 🍶 | — | — | 80／80 |
| cabbage | キャベツ | topping／scatter | #c9e3a3 | 🥬 | s | vegetable | 80／80 |
| bonito-flakes | かつお節 | topping／scatter | #c98f5a | 🪶 | xs | seafood | 80／80 |
専用 SVG は無い（絵文字がそのまま描画される）。SVG は #417 線で別途（B21 分は別 session が claim 済み、#780 コメント 6724929630）。

**レシピ 2 品**（bake 58–78、報酬 100 Pitz、Lunch Rush なし、CUT なし、ladder クレジットあり、Hint key-free）

| レシピ | ソース（PAINT） | 具材と数量 | 後乗せ（POST_BAKE） | 工程 |
|---|---|---|---|---|
| taco-pizza（タコピザ） | tomato-sauce 1（原典の salsa を既存で代用、I-1） | cheddar 2／beef 3（ground-beef を既存で代用）／fresh-tomato 2 | lettuce 2、tortilla-chips 2 | 生地→ソース→チーズ→具材→焼成→仕上げ |
| okonomiyaki-style-pizza（お好み焼き風ピザ） | okonomiyaki-sauce 1（新 profile） | cabbage 3／pork 3／mayo 1／bonito-flakes 2（チーズなし＝原典行に無いため足さない） | nori 1（「青のり」） | 生地→ソース→具材→焼成→仕上げ |
注: キャベツは料理の中で焼くので後乗せにしない（D-5「固有調理法が優先」）。

**注文文（提案・要承認）:** `order-taco-pizza`「タコピザ、ザクザクしておいしそう！食べてみたいな！」／`order-okonomiyaki-style-pizza`「お好み焼き風ピザ、ソースとかつお節がおいしそう！食べてみたいな！」（依頼者 mito）。

**描画（変更後）:** ピザ上は、トッピングが絵文字ピース、チーズ（cheddar）が既存のチーズ形状、ソースが PAINT（色 #5a3420）。後乗せ 3 種（lettuce・tortilla-chips・nori）は焼成後の仕上げ段で置く。実画面での見え方は**未確認**（HV で確認）。

## Q-4 編集対象（昇格 PR の変更面）と変更前後
| ファイル | 変更前 | 変更後 |
|---|---|---|
| `lateCatalog.ts` | late レシピ 8・late 食材 12・late step 7・注文 8 | late レシピ 10・late 食材 18・late step 9（step 79, 80）・注文 10。`LATE_TAXONOMY_ROWS`+4、`LATE_TOPPING_SIZE_CLASS`+4、`LATE_DISCOVERY_TARGET_IDS`+2（`taco-pizza-pizzadb`／`okonomiyaki-style-pizza-pizzadb-p1`）、`LATE_ENTITLEMENT_FLOORS`+6 |
| `recipeHintRoles.ts` | — | key-free 2 行 |
| `recipeSauceProfiles.ts` | union に okonomiyaki-sauce 無し | union 拡張＋PAINT profile 1 行（taco は既存の tomato-sauce） |
| `referencePizza.ts` | — | 2 つの Reference レイアウト（RT-01 規則で導出） |
| `catalogLedger.test.ts` | recipes 93／credited 81／ingredients 100／toppings 69／ladderSteps 78 | **95／83／106／73／80**（スラック 1 は不変） |
| golden | — | lateCatalog.offSurface・hint5 ladders（追記のみ）・recipeBatchManifest。staged の期待値追従は T-FX |
| `recipes.ts` | — | 型付き表が新 ID を要する場合のみ |
| e2e | — | 390×844 で Guided と Free Cooking を各 1 本 |
HOT 編集は Catalog Integrator 1 名のみ。他の HOT 編集 PR は現在なし。

## Q-5 次候補
| 候補 | 状態（今回の再確認） |
|---|---|
| pizza-finocchi-salad（orange 後乗せ）・pizza-cavolo-carote（lemon・red-cabbage 後乗せ） | 準備可。昇格前に Q-2 と同じ測定が要る |
| speck-e-brie（→`speck-e-brie`） | ID 改名後に準備可（通常カタログ、新 step） |
| black-truffle-pizza | **truffle の形（スライス／オイル）の決定待ち** |
| pizza-radicchio-noci | **balsamic-vinegar の扱い待ち**（olive-oil＋balsamic の 2 層ソース＝新 profile、または後がけ） |
| buffalo-chicken | **準備可ではない**: buffalo-sauce を焼成後に置く必要があるが FINISH はトッピング専用 → DRIZZLE／後乗せソース待ち（M7） |
推奨: Q-1〜Q-4 を承認し、Q-5 は上の 3 品（finocchi・cavolo・speck）から測定を始める。
