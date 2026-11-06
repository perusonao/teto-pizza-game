# Expansion Batch 18 — baingan-bharta / reina-pepiada + cilantro（設計・影響調査、docs-only）

基準 `origin/main` = `0016222`（#743、2026-11-04）。範囲: 調査と設計のみ。`src/` `e2e/` 変更なし、実装・Issue 作成・PR 作成・claim 投稿なし。
原典 pizzadb.jp は未確認（172 マトリクス行のみが根拠）。以下の個数・色・工程タイミングはすべて GAMEPLAY ASSUMPTION。

## 0. 前回報告の訂正（重要）

| 前回の記述 | 事実（main `0016222`） |
|---|---|
| tandoori-paneer / rendang を「未実装・次点」 | **実装済み**（Batch 10 PR-1。`recipes.ts` に `tandoori-paneer-pizza`、`rendang-pizza`。カレー系は既存 `curry-ketchup` を代用）。マトリクス照合が識別集合の完全一致だけで、ソース欄が未確定の行を見落としていた。**両方とも対象外** |
| 「cilantro は新食材」 | **既存**。`lateCatalog.ts` の late 専用素材（#611 / PR #679、herb / `xs` / 専用 SVG `cilantro-leaf`、`LATE_ENTITLEMENT_FLOORS` = 66、BBQ チキンの後乗せ）。`LATE_CATALOG_PRODUCTION = true`、`FREE_COOK_FINISH_PRODUCTION = true` で現在有効 |
| 「ソース未確定 → NO_SAUCE が必要」 | 既存の代用前例で **NO_SAUCE を避けられる**（§4） |

照合方法の修正: 識別集合の一致に加え、matrix id と recipe id の名前一致も使うと、実装済み 10 件（bbq-chicken・curry-pizza-japan・tandoori-paneer・rendang・eggplant-dengaku/tahini・yuzu-shrimp・wasabi-beef・moussaka・ume-shiso）を除外できる。未実装の FULL 行は 29 件。baingan-bharta と reina-pepiada は未実装で、`recipes.ts` / `lateCatalog.ts` に id も近接集合も無い。

## 1. Fresh Audit

- main に #711（`c21ace8`）・#709（`c914b59`）・#716（`167cf74`）あり。ordinary ladder の最後は step 68（goulash + sour-cream、#743）。
- #708 は open のままだが実装済み（Owner が close 判断）。
- open PR で本バッチと衝突するもの: なし（§3）。Issue / PR の全文検索（baingan / pepiada / バインガン / レイナ / パクチー）は #611・#679（BBQ）と Icons #712・#715・#718 のみ。**重複する Issue / PR なし**。

## 2. Duplicate Gate（現在の全レシピ 80 件 + late 7 件に対して）

| 候補（代用ソース込みの識別集合） | 完全一致 | 部分集合 / 上位集合 | 1 材料差 |
|---|---|---|---|
| baingan: curry-ketchup, mozzarella, eggplant, fresh-tomato, onion, cilantro | なし | なし | なし |
| reina: fromage-blanc-sauce, mozzarella, chicken, avocado, mayo, cilantro | なし | なし | なし |
| （NO_SAUCE にした場合の集合も同様に近接なし） | | | |

近接の注意: curry-ketchup を使う既存 3 件（curry-pizza-japan / tandoori-paneer / rendang）とは、baingan は材料の過半が異なる。HOLD（月見・ブラータ・ホットハニー・Pinsa・生地・後乗せ・下ごしらえ・複数ソース）に該当しない。reina の 2 層 spread（白ソース + mayo）は MULTI_SPREAD_LAYER の candidate だが、本設計は「ソース 1 + mayo をトッピング」に落とすため複数ソース機構を使わない。

## 3. cilantro の調査（本バッチの中心論点）

### 3.1 現状
- 定義: `lateCatalog.ts` の `LATE_INGREDIENTS`（`topping` / `scatter` / `bakeRoastResistant: true` / `#6cae3e` / `pieceVisual: "cilantro-leaf"`）、`LATE_TAXONOMY_ROWS`（herb）、`LATE_TOPPING_SIZE_CLASS`（xs）、`LATE_LADDER_STEPS`（`["bbq-sauce","cilantro"]`、key bbq-chicken-pizza、Research cohort key = cilantro）、`LATE_ENTITLEMENT_FLOORS`（66）。
- 描画: `IngredientGlyph.tsx` に `CilantroLeaf` が既にある（Owner Final Design Gate 2026-10-27 承認済み）。新規アートは不要。
- 在庫 / ショップ / 解禁 / 保存: id は `cilantro` で保存済みの在庫・図鑑・entitlement ledger に既に乗りうる。ledger は union で再ロックしない。

### 3.2 ordinary レシピから使う方法の比較

| 案 | 内容 | 判定 |
|---|---|---|
| R0 | 何もせず ordinary レシピが late 専用 `cilantro` を参照 | **不可**。ordinary データが late 専用 id を参照すると、late OFF ビルド（`lateCatalog.offGolden` / 各 OFF テスト）で未知素材になる。late の設計原則（base は late を知らない）にも反する |
| L | baingan / reina を late レシピにする | **不可**。late レシピは POST_BAKE 要件が必須で、credited なら late step に「新素材」が要る（新素材なし）。ladderCredit:false は late 専用素材を要求できない（`validateLateCatalog`） |
| G | `validateLateCatalog` を緩める | 非推奨。ガードの意味を弱める（Owner 判断の領域） |
| **P（推奨）** | **cilantro を late から ordinary へ昇格**: ordinary step 69 = `[cilantro]`（T4・星ゲートなし） | 可。id 不変のため保存互換あり。下記の影響を伴う |

### 3.3 昇格 P の影響（実装前に測定が必要な点を含む）
1. データ移動: `LATE_INGREDIENTS` → `BASE_INGREDIENTS`、`LATE_TAXONOMY_ROWS` → `ingredientTaxonomy.ts`、`LATE_TOPPING_SIZE_CLASS` → `toppingSizeClass.ts`。見た目・色・size・family は不変。
2. BBQ の late step: `["bbq-sauce","cilantro"]` → `["bbq-sauce"]`。**cohort key が cilantro → bbq-sauce に変わる**。bbq-chicken は FINISH 有効なら実プレイで見える late レシピなので、Research cohort ラベルの移動を `researchCohortLetter` 系テストで測定し、既存ラベルが動くなら Owner 承認（acceptedLetterShifts）が必要。**これが最大の未知数**。
3. BBQ レシピ自体（cilantro は POST_BAKE のまま）は不変。昇格後は BBQ の cilantro 2 個を ordinary 在庫からも賄える。
4. `LATE_ENTITLEMENT_FLOORS` の cilantro: 66 は固定のまま残す（floor は早く付与する方向にしか働かず、再ロックしない）。`expansionBatch11.s1.test` が floors を `toEqual` で固定しているため、削除する場合はテスト更新と Owner 承認が必要。**残す方を推奨**（既存 assertion を弱めない）。
5. 解禁順: cilantro は現行の late step（ordinary 長 + 6）より早い通常 step 69 で到達可能になる（早まる方向のみ）。late の導出番号は +1（bbq step など。実装時に再計算）。
6. 在庫 / ショップ: 既存の価格帯 T4（120 / 60 Pitz）に揃える。保存済みの在庫・BEST・Dex は id が同一で影響なし。

## 4. 2 レシピの設計案（すべて暫定・原典未確認）

### 4.1 baingan-bharta-pizza（バインガンバルタピザ）— ordinary step 69 の key（credited）
- matrix 行: `baingan-bharta-pizza-pizzadb-p6`。食材 = ナス / 玉ねぎ / トマト / モッツァレラ / コリアンダー。ソース欄「カレー」（種類不明、`BASE_SAUCE_UNSPECIFIED`）。FULL、薄め生地、工程は標準（sauce → cheese → topping → bake）、CUT は任意。
- **ソース**: 既存 `curry-ketchup` を代用（tandoori-paneer / rendang / curry-pizza-japan と同じ前例、Batch 10 D-B3）。NO_SAUCE にしない。
- 構成案（非ソース 8 ピース = 8 スロットのリング）: curry-ketchup 1（PAINT）/ mozzarella 2 / eggplant 2 / fresh-tomato 1 / onion 1 / cilantro 2。cilantro を最後に置き、Rule W の reserved 材料と legacy Hint 2.0 H4 の抜き出し材料を一致させる（moussaka と同じ順序: sauce, cheese, toppings）。
- 焼成窓 58–78（generic Free Cooking 窓）、報酬 100、`lunchRush:false`、CUT なし、key-free Hint、`ladderCredit:true`。
- cilantro は焼成前の TOPPING に置く（xs・`bakeRoastResistant` で焼いても形が残る）。後乗せにするかは原典未確認で Owner 判断（後乗せなら FINISH 依存で ordinary 経路から外れ、本バッチの前提が崩れる）。

### 4.2 reina-pepiada-pizza（ベネズエラレイナペピアーダピザ）— 非 credit
- matrix 行: `venezuelan-reina-pepiada-pizzadb-p12`。食材 = チキン / アボカド / マヨネーズ / モッツァレラ / コリアンダー。ソース欄「ホワイトソース」（曖昧）、spread 層 = 白ソース + mayo（MULTI_SPREAD_LAYER は candidate・要確認）。
- **ソース**: 既存 `fromage-blanc-sauce` を白ソースの代用（moussaka-style-pizza の前例。Owner が「そのレシピ限り」で決めた方式）。mayo は既存のトッピング（絞り出し 1 ピース、#716）として載せる。NO_SAUCE にしない。
- 構成案: fromage-blanc-sauce 1（PAINT）/ mozzarella 2 / chicken 2 / avocado 1 / mayo 1 / cilantro 2（非ソース 8）。cilantro を最後に。
- `ladderCredit:false`（step 69 の key は baingan。cilantro 以外の新素材がないため、credited にするには別の key step が要る）。supreme-pizza の非 credit 前例。`lunchRush:false`、CUT なし、key-free。
- 推奨の key 割当: baingan を key にする（構成が単純、curry 前例あり、2 層 spread を持たない）。

### 4.3 NO_SAUCE の暫定適用（レシピごとの根拠と影響）
代用案が Owner に承認されれば **NO_SAUCE は不要**。承認されない場合のフォールバックのみ:

| レシピ | 根拠 | 欠点 | 影響 |
|---|---|---|---|
| baingan | ソース欄「カレー」は種類不明 | 「カレー系」というソース情報を捨てる。#708 より根拠が弱い（#708 はソース欄自体が未記載で、材料に mayo があった） | `noSauceRecipeIds()` に追加、Hint 許可リスト・DH4 audit・`alphaFamilyOnly` golden が動く。NO_SAUCE 例外が 1 件増える |
| reina | mayo が白い層の役割を担う解釈が可能 | 白ソースと mayo の 2 層という原典情報を単純化 | 同上 |

## 5. 採点・保存・在庫・解禁への影響

- 採点: `referencePizza.ts` に 8 点リングを 2 件追加するだけ。既存 Reference・重み・Scoring 2.0 は不変。
- 保存: schema v2 のまま、新 id の追加のみ。旧版で再保存しても落ちないことを `persistence.batch18` で固定する。cilantro は id 同一のため既存の在庫・図鑑・entitlement ledger はそのまま。
- 在庫 / ショップ: cilantro の価格帯は T4 に揃える（昇格により BASE 側の ingredient が 1 件増える。late ON の合計は不変）。
- 解禁: ordinary step 68 までは凍結。step 69 = `[cilantro]`、key = baingan（credited）。late の導出番号が +1。`LATE_ENTITLEMENT_FLOORS` は不変。
- 図鑑 / 章: baingan は credited で章に入る（導出表示）。reina は非 credit。
- Hint 5.0: ladder golden は挿入のみ。カレー系・白ソース系は `sauce` 家族を既存の curry-ketchup / fromage-blanc に寄せるため、sauce 件数は不変。`alphaFamilyOnly` は herb 家族の人数が動く可能性（実装時に測定）。
- Lunch Rush: 2 レシピとも `lunchRush:false`、プール 25 は不変。

## 6. Steam #738 / DRIZZLE #746 / #747 との干渉

| PR | 触るファイル | 本バッチと重なるか |
|---|---|---|
| #738 Steam S3 | `App.tsx`, `main.tsx`, `GameScreen.tsx`, `PizzaStage.tsx`, `src/logic/steam/*`, `src/preview/*`, `SteamLayer*`, `Steam.css`, e2e/docs | **なし**（本バッチは `src/data/*`・`src/logic/discovery/__golden__`・テスト・docs のみ）。蒸し対象は貝類で、cilantro / eggplant / chicken / avocado / mayo は蒸し材料でない |
| #746 DRIZZLE Lab | `main.tsx`, `devtoolsAccess.test.ts`, `src/preview/*`, docs/e2e | **なし** |
| #747 Steam 手順書 | docs のみ | なし。`PROJECT_HANDOFF.md` の addendum 追記だけは、他の docs PR と文面衝突しうる（機械的に解消可） |

干渉は実質なし。どちらも本番 OFF の実験機能で、レシピ追加と独立。

## 7. 実装可能な最小バッチ

| 項目 | 値 |
|---|---|
| 新食材 | **0 個**（cilantro は既存を ordinary へ昇格。新 id なし） |
| 新レシピ | **2 件**（baingan-bharta-pizza = credited / reina-pepiada-pizza = 非 credit） |
| 新 ordinary step | 1（step 69 = `[cilantro]`） |
| 必要な調理工程 | **新工程なし**（通常の SAUCE → CHEESE → TOPPING → BAKE。FINISH・後乗せ・下ごしらえ・複数ソース・生地を使わない） |
| さらに小さい形 | baingan のみ（1 レシピ + 昇格）。reina は昇格済み cilantro の上に載る独立した小 PR にできる |

## 8. Owner 判断事項（実装開始前に必要）

1. **cilantro の昇格（案 P）を承認するか**。R0 / L / G は不可または非推奨。承認する場合、BBQ の late step の cohort key が bbq-sauce に変わる点（§3.3-2）を許容するか。Research ラベルが動く場合の `acceptedLetterShifts` も承認が要る。
2. baingan のソース = `curry-ketchup` 代用（NO_SAUCE にしない）でよいか。
3. reina のソース = `fromage-blanc-sauce` 代用 + mayo トッピング（NO_SAUCE にしない）でよいか。
4. 代用を認めない場合のみ: レシピごとの NO_SAUCE 例外（§4.3）。
5. key 割当: baingan を credited key、reina を非 credit としてよいか（逆も可）。
6. cilantro を焼成前の TOPPING に置く（後乗せにしない）でよいか。
7. 名前: 「ベネズエラレイナペピアーダピザ」をそのまま使うか短縮するか。構成の個数は暫定で、Preview HV で確認する。
8. #708 を close するか、Issue をバッチ単位（#18 相当）で新規作成するか（重複なし、Owner 承認後に作成）。
9. `lateCatalog.ts` のコメント（Production は false）と値（`true`）の食い違いの扱い（B17 Result §8-6 の持ち越し）。late が実プレイで有効かどうかは Research ラベル影響の重大度に直結する。

## 9. 実装予定ファイル（承認後）

- データ: `src/data/recipes.ts`, `ingredients.ts`（cilantro 昇格）, `lateCatalog.ts`（cilantro 削除・BBQ step を `["bbq-sauce"]` に・コメント更新、floors は残す）, `ingredientTaxonomy.ts`, `toppingSizeClass.ts`, `discoveryLadder.ts`（step 69 追記）, `discoveryCatalog.ts`, `recipeSauceProfiles.ts`, `recipeHintRoles.ts`, `referencePizza.ts`, `src/logic/catalog/testSupport/recipeBatchManifest.ts`
- golden / audit JSON: `hint5.ladders55.json`（挿入のみ）, `hint5.alphaFamilyOnly.json`, DH4 audit JSON（再生成）
- テスト（新規）: `expansionBatch18.test.ts`, `persistence.batch18.test.ts`, `researchCohortLetter.batch18.test.ts`
- テスト（追従、assertion を弱めない）: `catalogLedger.test.ts`, `recipeChapters.test.ts`, `lateCatalog.bbq.test.ts` / `late4` / `offGolden`, `expansionBatch11.s1.test.ts`（floors は不変のまま通す）, `discoveryCatalog.test.ts` の `*_PHASE2_BLOCKED_OWNER_APPROVED` と `matcher.test.ts` の `ownerApproved`（baingan / reina の BLOCKED_PRODUCT_DECISION 行を moussaka と同様に追記）
- docs: `docs/reports/TETO_EXPANSION-BATCH-18_Result.md`, `docs/decisions/TETO_EXPANSION-BATCH-18_OWNER-DECISIONS.md`, `PROJECT_HANDOFF.md` addendum, `docs/reports/screenshots/b18/`

## 10. テスト計画

1. 全 Vitest を Pinsa ON / OFF（`TETO_PINSA_OFF=1`）の両方。typecheck / lint / build。
2. 昇格の安全確認（実装の最初に scratch で測定）: late OFF ビルドで BBQ が従来どおり消えること、late ON で全レシピが到達可能なこと、Research cohort ラベルの差分（既存ラベルが動くか）、`hint5` golden が挿入のみか、DH4 audit。
3. 保存互換: 旧版 save（cilantro 在庫あり / BBQ discovered / なし）の読み込みと再保存、undo 在庫、entitlement ledger の union。
4. 新規レシピ: 識別（Duplicate Gate）、8 点リング採点、Rule W / H4 の一致、Hint の許可リスト、ladder step 69 の凍結テスト（1–68 不変）、late 導出番号 +1。
5. E2E: Chromium の関連 spec、WebKit は CI。390×844 / 360×800 でトレイの cilantro チップ・Shop の NEW 行・調理中・焼成後・焼き過ぎ・RESULT、cilantro と parsley / basil / shiso の識別。Human Verification の動画は Owner へ直接（repo に commit しない）。
6. skip / retry / timeout 延長 / assertion 緩和による通過は禁止。

## 11. 推奨実装順

1. Owner 判断 §8-1〜§8-6 の回答（特に cilantro 昇格と cohort 影響の許容）。
2. 最新 main から再計算（step 番号・件数 pin）、Issue 作成と claim 投稿（重複なしを再確認）。
3. scratch 測定（§10-2）。ラベルが動く場合は Owner に差分を提示してから進める。
4. PR-A: cilantro 昇格 + step 69 + baingan（credited）。
5. PR-B（小さい別 PR、または同一 PR）: reina（非 credit）。
6. CI（Pinsa ON/OFF、WebKit Gate）と最新 HEAD の Codex レビュー、Owner HV。merge・共有 Preview 更新・Production は Owner 承認後。

## 12. 次の候補（本バッチ後）

cilantro が ordinary になると、chicken-tikka（新素材 `chicken-tikka` 1 のみ、ソース未確定）、thai-chicken（`peanut-sauce`、未解決食材あり）が 1 種の新素材で届く。banh-mi は新素材 4 種で見送り。honey 系（nashville / nduja）はホットハニーの HOLD を確認してから。caponata は #706 で Owner が除外済みで、再開は Owner 判断。
