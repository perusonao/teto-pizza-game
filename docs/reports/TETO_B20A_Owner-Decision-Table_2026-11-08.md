# Batch 20-A — Owner Decision Table（実装前・docs-only、Refs #780 #417）

2026-11-08、`origin/main` `4ba05597`（PR #789 の merge。カタログ・HOT ファイルは `44460cbf` と同一）。**実装していない。HOT ファイルも `src/` も変更していない。merge・Production ON・共有 Preview 更新なし。** 「推奨」は助言で、Owner 決定ではない。
ラベル: 【実測】= 今回 main のコードで測定（再現用: `docs/reports/data/TETO_B20A-DECISION-20261108_*`）、【記録】= GitHub／repo の記録、【推論】、【未確認】。

---

## 0. 要約と、先に確認してほしい食い違い

1. **B20-A の正式な対象は「新食材 2（honey・walnut）＋新レシピ 1（`pesto-noci-pizza`）」。「新レシピ 10 品」ではない**【記録】Owner コメント #780 6703581170・6706077215。指示の「B20-A の 10 レシピ」は、新レシピとしては **再現できなかった**。
2. repo／GitHub で再現できる「10」は 1 つだけ: **`pesto-noci-pizza` を足すと、Research の文字が非正準順で変わる既存レシピが 10 品**【実測】（§4）。Owner は ID ごとの承認を求めている【記録】ので、この 10 品を「10 品の承認表」として載せた。指示の「10 品」がこれを指すなら、そのまま承認表になる。**別の 10 品（例: 「判断不要の 9 品」＋ 1）を指しているなら、ID を教えてほしい**。#780 の Owner 追記（6691497411・6705255833）で、「9 品」は ID が実在せず **UNVERIFIED・推測禁止** のまま【記録】。ここでも作っていない。
3. 開始条件だった **#783（Batch 19）は merge 済み**（`44460cbf`）。Owner が求めた「最新 main での再測定」を本書で実施した。**重複ゲート・Research（正準順）・Hint・保存の 4 項目はすべてクリーン。例外は不要。**
4. Owner 判断は **9 件**（包括 4＋個別 5）。**推奨は全件「推奨どおり承認」の一括 1 回**（§6 の文面）。判断不要は 6 件。

---

## 1. Fresh Audit

| 項目 | 状態 |
|---|---|
| main | `4ba05597`（#789 merge。#783 Batch 19 は `44460cbf`、#778 ハーブ配線は `06cfc066`、#777 walnut SVG は `5eade46e`） |
| 現行カタログ【実測】 | recipes 92（Pinsa 開）、ordinary ladder は step 70 まで（B19）、全 ladder 77 step。`honey`・`walnut`・`pesto-noci-pizza` の id は `src/` に無い（`walnutGlyph/` と staged の予約表のみ）。staged の予約: `src/data/staged/stagedCatalog.ts` が `pesto-noci-pizza`／`honey`／`walnut` を「B20-A」として予約 |
| B20-A の Owner 記録 | 条件付き GO は「計画のみ」。実装は #783 merge 後・新 claim・最新 main での再測定が条件。honey は焼成前の第 2 層、mozzarella は足さない、walnut family は暫定 `spice` は**候補で最終承認ではない**。非正準順のラベル変化は ID ごとの Owner 承認、正準順の変化は停止条件【記録】 |
| B20-A の claim・Issue・PR | **B20 用の Issue・claim・branch・PR は存在しない**。T5 の claim（#780、`TETO_NEXT-RECIPE_T5_*`）は docs 完了済みで、F2 の claim 更新に同居（実装範囲ではない）【記録】 |
| open PR との重なり | HOT カタログ群（`ingredients.ts`・`recipes.ts`・`discoveryLadder.ts` ほか）・`IngredientGlyph.tsx`・`App.css` を変更する open PR はない。#775（doughKind）・#776（DRIZZLE）・#738（STEAM）・#781（docs）・#782（eggplant 未配線、`src/components/` 新規のみ）・#785（fold-seal）は重ならない【記録】 |
| 別セッションとの調整点 | `src/data/staged/**` は T-FX の claim（#780 6711787241、〜11/21）。B20-A の merge 後、staged の in-flight 予約と what-if golden の基準が変わる（§7 の調整項目） |

### PR #789（最新の確認）
| 項目 | 結果 |
|---|---|
| 状態 | **merge 済み**（2026-11-08T06:37:22Z、Owner。merge commit `4ba05597`）。HEAD `671f4e0` |
| CI（HEAD `671f4e0`） | 11/11 成功（build、classify、layout-chromium、Layout Contract Gate、WebKit 6 shard、WebKit Gate） |
| Codex | HEAD `671f4e0` で完了、指摘 0 件（レシート「Didn't find any major issues」） |
| 未解決スレッド | 0 件 |
| #789 の B20-A への影響 | 本番カタログは不変（dist は main と一致）。#789 は「昇格 PR は B20-A の後」と記録済み（Q-4）。B20-A は #789 の昇格列車（taco・okonomiyaki ほか）の**前提**で、順序は B20-A → PT-1a【記録】 |

---

## 2. B20-A の仕様（暫定。すべて GAMEPLAY ASSUMPTION・原典の個別ページ未確認）

出所: 172 行マトリクス行 `pesto-noci-pizzadb-p12`（ペストノーチピザ、PIZZA DB p12、具材: ゴルゴンゾーラ・蜂蜜・くるみ、基本ソースはバジル系＝pesto、要求能力 MULTI_SPREAD_LAYER、状態 READY）【記録】。実装仕様の先行案: `TETO_CONTENT-POOL_B20A_Implementation-Spec.md`（#772 ブランチ）。

| 項目 | 内容 |
|---|---|
| 新レシピ（1） | id `pesto-noci-pizza`／名 ペスト・ノーチピザ（暫定）／材料 pesto 1（主ソース・PAINT）・honey 1（第 2 ソース層）・gorgonzola 2・walnut 3／焼成窓 58–78（汎用）／`ladderCredit: true`／lunchRush なし／CUT なし |
| 新食材（2） | **honey**（はちみつ、sauce、`spread`、焼成前の第 2 層、絵は不要）、**walnut**（くるみ、topping、`scatter`、size `s` 案、専用 SVG は #777 で作成済み・未配線） |
| 既存食材 | pesto（sauce・spread）、gorgonzola（cheese・scatter、size m）— 追加作業なし |
| 工程 | **新工程なし**。SAUCE（pesto）→ SAUCE（honey）→ CHEESE → TOPPING → BAKE、すべて焼成前。FINISH・prep・steam・sear・fry・drizzle は使わない |
| ladder | ordinary step **71**（honey＋walnut の 2 素材で 1 step、key は `pesto-noci-pizza`）【推論: B19 の step 70 の次】。既存 step 1–70 は凍結。late の導出番号は +1、`LATE_ENTITLEMENT_FLOORS` は不変（B19 と同じ扱い）【推論】 |
| 変更が必要な HOT | `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`referencePizza.ts`・`orders.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`IngredientGlyph.tsx`・`App.css`・golden（B19 の変更ファイル一覧と同型） |
| 新食材・新工程の依存 | 新工程 0。新食材 2（honey は絵不要、walnut は #777 の配線のみ）。DRIZZLE（#579）・FRY・Pinsa には依存しない |

---

## 3. 各ゲートの確認結果（main `4ba05597`、`pesto-noci-pizza` ＝ 原典どおりの組成 A）

| ゲート | 結果【実測】 | 判定 |
|---|---|---|
| 重複ゲート | 母集団 92。最大 Jaccard **0.167**（近傍 genovese、次点 pesto-系 0.143）。同一・部分集合・上位集合・1 材料差 **0 件**。例外不要（基準 0.4） | クリーン |
| Research（正準順） | 既存ラベルの変化 **0 件**（停止条件は発動しない） | クリーン |
| Research（非正準順） | 既存 **10 品**の文字が変わり得る（§4）。文字の喪失（`->-`）は 0。正準順の変化と合わせて「文字の変化のみ」 | **ID ごとの承認が必要**（Owner 記録） |
| Hint 5.0 | key-free の対象になる（rung: SAUCE, CHEESE, STRUCTURE, SUB_CLASS）。**出荷済み 91 品の ladder は golden と一致（差分 0）** | クリーン |
| 保存安全性 | id の衝突なし【実測: `src/` 走査】。新 id は既存の保存に存在しない（Dex は未発見の行として追加、在庫・購入は未購入）。永続化コードの変更なし。`persistence.batch20` を B18・B19 と同じ方式で追加する前提【推論・未実測】 | クリーン（実装時にテストで固定） |
| 新工程 | なし | — |
| 変形 B（mozzarella を足す） | 最大 Jaccard 0.333、ゲート該当 0、Research 非正準順 10 品（A と同一集合）、Hint 同形 | 同じくクリーン（ただし原典に無い材料） |
| walnut の family | `spice`（暫定）と `other`（出荷済みのナッツ almond・pine-nuts と同じ）で、Hint の rung 形・golden 差分 0 は同一 | **どちらも通る**。先例は `other`（§5 I-4） |

---

## 4. 「10 品」の内訳 — Research の文字が非正準順で変わり得る既存 10 品（ID ごとの承認対象）

`pesto-noci-pizza` の追加で、取得順によって Research の cohort 文字が変わる既存レシピ。**正準（ladder）順では 0**。変化は表示ラベルの派生値のみ（`？？？ピザ（○○）` の文字）。保存・Dex・採点・在庫・ID は不変。`-->X` は「文字なし → X」、`B->C` は「B → C」。

| # | ID | 名 | 材料 | 変化（観測した範囲） | 種別 |
|---|---|---|---|---|---|
| 1 | `genovese` | ジェノベーゼ | pesto 1・mozzarella 2・cherry-tomato 3 | `-->B`・`B->C`・`A->B`・`C->D`（4 パターン） | 文字なし→付与＋ずれ |
| 2 | `pesto-burrata-pizza` | ペスト・ブッラータピザ（B19） | pesto 1・olive-oil 1・burrata 2・fresh-tomato 2 | `B->C`・`C->D` | ずれのみ |
| 3 | `pesto-caprese` | ペストカプレーゼピザ | pesto 1・mozzarella 2・fresh-tomato 3・basil 2 | `-->A` | 付与のみ |
| 4 | `pesto-patate` | ペストパターテピザ | pesto 1・mozzarella 2・potato 3・bacon 2 | `-->B`・`B->C` | 付与＋ずれ |
| 5 | `pesto-pollo` | ペストポッロピザ | pesto 1・mozzarella 2・fresh-tomato 2・chicken 3 | `B->C`・`C->D` | ずれのみ |
| 6 | `pesto-salmone` | ペストサーモン | pesto 1・salmon 3・cream-cheese 2・lemon 2 | `-->B`・`B->C` | 付与＋ずれ |
| 7 | `pesto-tonno` | ペストトンノピザ | pesto 1・tuna 3・black-olive 2・onion 2 | `-->A` | 付与のみ |
| 8 | `pesto-trapanese` | ペストトラパネーゼピザ | pesto 1・fresh-tomato 2・garlic 2・almond 3 | `C->D`・`B->C` | ずれのみ |
| 9 | `pesto-vegetariana` | ペストベジタリアーナピザ | pesto 1・mozzarella 2・eggplant 2・zucchini 2・bell-pepper 2 | `-->A` | 付与のみ |
| 10 | `quattro-formaggi` | クアトロ フォルマッジ | olive-oil 1・mozzarella 2・gorgonzola 2・parmigiano 2・fontina 2 | `-->A` | 付与のみ |

- 先行調査（#772・T5）の 9 品は #1・#3〜#10 と同じ。#2 `pesto-burrata-pizza` は B19 の出荷で新しく加わった【実測】。
- 先例: B18 は 39 品を「測定済みの固定集合」として一括承認（OD-B18-4）、B19 は 20 品を ID ごとに承認（PR #783 コメント 6704906797）。どちらも「承認範囲は測定した文字変化のみ・未列挙の ID が出たら停止」。

---

## 5. Owner Decision Table

### 区分 A: 判断不要（6 件。ルールで決まり、Owner の追加判断なし）

| # | 事項 | 根拠 |
|---|---|---|
| A-1 | 重複ゲート: 例外なしで通る（Jaccard 0.167、同一・部分・上位・1 材料差 0） | §3。基準 0.4 を下回る |
| A-2 | Research 正準順の変化 0（停止条件なし） | §3。変化があれば停止（Owner 記録） |
| A-3 | Hint 5.0: 対象になり、出荷済み 91 品の ladder は不変 | §3 |
| A-4 | 新しい調理工程は不要（すべて焼成前） | §2 |
| A-5 | 保存・ID: 衝突なし、永続化コード変更なし、`persistence.batch20` を B18・B19 方式で追加 | §3 |
| A-6 | 開始条件の #783 merge は充足。順序は B19 → B20-A → PT-1a（昇格列車） | §1 |

### 区分 B: 包括判断可能（4 件。1 回の承認でまとめて決められる）

| # | 事項 | 推奨 | 影響 |
|---|---|---|---|
| **B-1** | **§4 の 10 品の Research 非正準順ラベル変化を「測定済みの固定集合」として承認**（ID ごと列挙済み。承認範囲は文字の変化のみ、追加の ID・文字の喪失・文字以外の変化・Research アルゴリズムの変更は対象外で、出たら停止して再判断） | **承認** | 承認しない → B20-A は HOLD。承認 → 実装 PR のテストでこの 10 品を固定（B19 と同形）。正準順の変化 0 の不変条件は別途維持 |
| **B-2** | 暫定の数値・名前（個数 pesto 1／honey 1／gorgonzola 2／walnut 3、焼成窓 58–78、価格・補充数、色、`pesto-noci-pizza`／ペスト・ノーチピザ）を GAMEPLAY ASSUMPTION として一括承認し、HV 後に調整 | **承認（暫定）** | B16〜B19 と同じ扱い。承認しない場合、個数・窓・価格を個別に決める必要がある |
| **B-3** | 原典（pizzadb.jp の個別ページ）は未確認のまま、「暫定仕様・原典未確認」のラベルで出荷（172 マトリクス 1 行が根拠） | **承認（ラベル付き）** | B18・B19 と同じ。原典確認が先なら実装を待つ |
| **B-4** | walnut の SVG は #777 の色・形（PROVISIONAL）をそのまま配線（ハーブ群と同じ 1.2em の共有規則に追加、必要なら実寸 HV 後に調整）。生くるみ × 焼成チーズは塗りの差が小さく、外線で読む設計（#777 Result）を維持 | **承認（PROVISIONAL）** | 配線 PR を分けずに B20-A の PR に含める想定（I-5）。見え方の最終採否は実機 HV |

### 区分 C: 個別判断必須（5 件）

| # | 論点 | 選択肢 | 推奨 | 影響 |
|---|---|---|---|---|
| **I-1** | **B20-A の実装を開始してよいか**（#783 merge 済み・最新 main での再測定済みを受けた最終 GO。Owner 記録は「conditional／HOLD until #783 merge と再測定」） | GO／継続 HOLD | **GO（新 claim・新 Issue を取得してから）** | GO で実装 1 PR を開始。HOLD の間は PT-1a（#789 の昇格列車）も始められない |
| **I-2** | honey の置き方 | (a) 焼成前の第 2 ソース層（spread）／(b) 後乗せ（DRIZZLE） | **(a)**。(b) は DRIZZLE（#579）が本番 OFF で、B20-A が工程の判断に縛られる。原典は spread 層の記載 | (a) は B19（pesto＋olive-oil）と同型で新工程なし。(b) は B20-A を DRIZZLE の完成まで HOLD |
| **I-3** | mozzarella を足すか | 足さない（原典どおり）／足す（変形 B） | **足さない**。変形 B も重複・Research・Hint はクリーンだが、原典に無い材料。B19 D7 と同方針 | どちらでも測定結果は同じクリーン。足すと Research の影響集合は不変だが Jaccard は 0.333 に上がる |
| **I-4** | walnut の Hint family | `spice`（Owner の暫定案）／`other`（出荷済みのナッツ almond・pine-nuts と同じ）／新 `nut` | **`other`**。ナッツの先例が 2 品とも `other`、`spice` は capers など。Hint の形・出荷済み ladder への影響は `spice` と `other` で**同一**（測定済み）。新 `nut` は family 追加で分類ゲートが増える | `other` を採ると既存の分類と一貫。`spice` でも通るが先例と不一致（staged の what-if も `spice` で、整合は T-FX 側の調整） |
| **I-5** | PR の分け方 | 食材＋レシピ＋walnut 配線を 1 PR／食材 PR とレシピ PR を分割 | **1 PR**。ordinary step は key レシピを持つ構造（step 66〜70 はすべて `keyRecipeId` 付き）で、食材だけの step は作れない見込み【推論: 実装時に `discoveryLadder.test.ts` の不変条件で確認】。B13〜B19 も 1 PR | 1 PR ならレビュー・CI・HV が 1 回。分割は ladder 不変条件に反する可能性 |

判断件数: **Owner 判断 9 件**（B-1〜B-4、I-1〜I-5）／判断不要 6 件。B-1 は 10 ID を含むが 1 回の承認で足りる設計。

---

## 6. 推奨する一括判断（Owner がそのままコメントできる文面案）

> B20-A（honey・walnut・pesto-noci-pizza）を GO。条件: 新 claim・新 Issue を取ること、既存 step 1–70 を凍結すること、ほかの HOT claim と重ならないこと。
> B-1: §4 の 10 品（genovese・pesto-burrata-pizza・pesto-caprese・pesto-patate・pesto-pollo・pesto-salmone・pesto-tonno・pesto-trapanese・pesto-vegetariana・quattro-formaggi）の Research 非正準順ラベル変化を、文字の変化のみに限って承認。正準順の変化 0 を維持し、追加 ID・文字の喪失・文字以外の変化が出たら停止して再判断。
> B-2〜B-4: 暫定数値・名前・原典未確認ラベル・walnut の PROVISIONAL 配線を承認（HV 後に調整）。
> I-2: honey は焼成前の第 2 層。I-3: mozzarella は足さない。I-4: walnut の family は `other`。I-5: 1 PR。
> merge・Production ON・共有 Preview 更新は別途承認。

---

## 7. 並行可能な作業と最短の実装順

### 承認前でも並行できる（HOT・`src/` に触れない）
| 作業 | 内容 | 注意 |
|---|---|---|
| P-1 | B20 用の HV 手順・iPhone 実機チェック項目の docs（B19 の HV 手順を流用） | 新規 docs のみ |
| P-2 | #781（87 行の再判定）・#782（eggplant 未配線）・#785（fold-seal）のレビュー | B20-A と無関係 |

### 承認後に並行できる
| 作業 | 内容 | 依存 |
|---|---|---|
| Q-1 | 本体 PR（食材 2・レシピ 1・walnut 配線・golden・テスト） | HOT をすべて担当 1 セッションが持つ。**これ自体は並行不可（直列）** |
| Q-2 | E2E・HV seed・Preview の準備（`e2e/b20.spec.ts`、`src/preview/**` の B20 用） | 本体 PR の id・step が確定してから。B19 の seed 方式を流用 |
| Q-3 | staged 側の調整（in-flight 予約 `pesto-noci-pizza`／`honey`／`walnut` の解除、what-if golden の再基準化、walnut の family を `other` に揃える） | **T-FX の claim（`src/data/staged/**`）の担当に依頼**。B20-A の merge 後。本セッションは編集しない |

### 最短の実装順
1. Owner が §6 の一括判断を出す（I-1 GO を含む）。
2. B20 用の Issue 起票・claim（HOT 一式。#780 の他の claim と重ならないことを確認）。
3. 本体 1 PR: ordinary step 71、honey・walnut の行と size class・family `other`、walnut の `pieceVisual` 配線、`pesto-noci-pizza`、Reference／sauce profile／hint roles、`expansionBatch20.test.ts`（§4 の 10 品を固定）、`persistence.batch20.test.ts`、golden の追従。全 Vitest・tsc・build・CI（WebKit 全 shard）・Codex。
4. Owner の iPhone Safari HV（トレイの「はちみつ」「くるみ」の幅を 360×800 で、walnut の 26px の見え方）。
5. Owner の merge 判断。
6. staged の再基準化（Q-3）→ PT-1a（taco・okonomiyaki ほか、#789 の Q-1〜Q-5 の判断後）。

---

## 8. 未確認・限界

- 原典の個別ページ（pizzadb.jp p12）は未確認。個数・窓・価格・色・名前はすべて暫定。
- 測定は静的な what-if（本番の `researchLetterChangesAcrossOrders`・`buildHint5Ladder` を module mock で `honey`／`walnut`／`pesto-noci-pizza` を足して実行）。**実装 PR で正式な Research 監査・Hint 5.0・golden を再実行する**。保存の読み込み・移行のテストは未実行。
- 「判断不要の 9 品」「新レシピ 10 品」の ID は repo／GitHub に無く、**再現できていない**（§0）。
- テストは本書のための測定のみ（全 Vitest は実装 PR）。UI・ゲーム挙動を変えていないため HV 動画は対象外（HV Policy §2）。
