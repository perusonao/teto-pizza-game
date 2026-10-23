# Recipe Expansion — Next Batch 2 Fresh Audit（セッション C、調査・設計のみ / docs-only）

基準 `origin/main` = `cea6904`（#642）、2026-10-23。ブランチ `claude/recipe-expansion-prep-3i9dyz`。
範囲: 調査と設計だけ。`src/`・`e2e/`・workflow は変更していない。PR 作成・merge・Preview/本番デプロイはしていない。他セッションのブランチ（#577 系 / #578 / #584 / #540 / #633 / #639 / #640）には触れていない（PR 一覧の読み取りのみ）。
方法の限界: `node_modules` が無くテスト・ladder 導出は未実行。`pizzadb.jp` には到達できず、原典は 172 matrix（リポジトリ内の証跡行）のみ。個数・焼成窓はすべて **GAMEPLAY CALIBRATION（暫定）**。以下の数は `src/data/*.ts` と
`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` から、**現行 main（通常レシピ 62・食材 67・ladder 55 step）に対して再計算**した（matrix 自身の `newContentIngredientIds` / `shippedRecipeIds` は 15 レシピ時点で古い）。

## 1. 現状（main `cea6904`）

| 項目 | 値 | 出どころ |
|---|---|---|
| 通常レシピ | **62**（最後 = `flammkuchen`、No.62） | `recipes.ts` `BASE_RECIPES` |
| 食材 | **67**（sauce 4: tomato / pesto / olive-oil / fromage-blanc-sauce） | `ingredients.ts` |
| ladder | **55 step**、次の通常 step は **56**。credited 58 | `discoveryLadder.ts`、`TETO_NEW-SAUCES-A_Result.md` |
| 章 | 6 / 11 / 18 / 27（章 4 = step 30 以降の T4 全体） | 同 Result §1 |
| 後乗せ（late catalog） | `ikura-salmon-pizza` / `salmon-roe` のみ。**本番 OFF**（`LATE_CATALOG_PRODUCTION=false`）。番号は「通常 ladder 長 + 1」で導出 | `lateCatalog.ts` |
| 172 のうち | 出荷済み/同集合 54 行、未出荷 118 行 | 本書 §2 の再計算 |
| 進行中の PR | #639 / #640（Pinsa 基盤 P3-a1/a2、データ無し）、#540（grandma、Draft/HOLD）、#633（docs draft）、#620（新工程の audit）。**レシピデータを足す open PR は無い** | PR 一覧 |
| claim | #578 に Flammkuchen 単独の claim（session `015Uh6…`、期限 10/27、`ingredients.ts` / `recipes.ts` / `discoveryLadder.ts` / golden を含む）。#634 は merge 済みだが release の投稿は未確認 | Issue #578 |

## 2. 抽出結果（172 → 現行フローで追加できるもの）

再計算の条件: ① 識別集合（食材 id の集合）が出荷済み 62 件のどれとも一致しない、② `currentFlowRepresentability = FULL`（新工程不要）、③ 未解決トークン無し、④ ハード blocker が無い（`BASE_SAUCE_UNSPECIFIED` だけは別枠で分離）。

| 区分 | 件数 | 備考 |
|---|---|---|
| 未出荷（識別集合が新しい） | 118 | |
| うち FULL かつ blocker 無し・新食材 ≥1 | **8** | currywurst / cuban / eggplant-tahini / eggplant-dengaku / peking-duck / yuzu-shrimp / sichuan-eggplant / tsukimi |
| FULL・`BASE_SAUCE_UNSPECIFIED` のみが blocker | **22**（うち新食材 0 は 2 件: caponata / jamaican-jerk） | Owner が「ソース不明 = チーズ下地（NO_SAUCE）」を決めれば前進できる枠 |
| **新食材 0 で、blocker 無しに今すぐ足せるもの** | **0** | 前回 audit の 3 件（chilean / chorizo / frango）は Batch 8a で出荷済み。ゼロ食材枠は尽きた |
| PARTIAL / NOT_REPRESENTABLE | 新工程が要る → §6（P3 以降） | |
| COMPOSITION_CONFLICT 等 | 85 行 BLOCKED の大半（出荷済みレシピの別版: capricciosa / bismarck / quattro-formaggi / meat-lovers 等は **同名別版で追加対象ではない**） | 見送り |

要点: **次の追加は必ず「新しい材料 1〜2 個」を伴う**。材料の種別は、(a) 既存 PAINT で塗る新ソース、(b) 新トッピング（L1 family と専用アイコンが要る）、(c) 食材 0 だが Owner 判断待ち、の 3 系統。

## 3. 推奨する追加候補（優先順位つき・8 件）

共通: 通常 ladder（焼成前のみ）、丸い標準生地、CUT なし、`lunchRush:false`、permanently key-free、`ladderCredit` は材料を足す回は credited。個数・焼成窓（既定 58–78）は暫定。難易度 = S 小 / M 中 / L 大（既存 Batch の作業量との相対）。

| 優先 | レシピ（matrix id） | 識別集合 | 新食材 | 既存の再利用 | 難易度 | 依存 |
|---|---|---|---|---|---|---|
| **1** | 柚子えびピザ `yuzu-shrimp-pizza` | mozzarella / shiso / shrimp / yuzu-kosho | **`yuzu-kosho`（新ソース 1）** | shiso(54)・shrimp(26)・mozzarella。設計書 §10.2 は shiso を「新規」と数えていたが、**8b で出荷済みのため新規は 1 のみ** | **M**（#634 と同型。色の決定 + 描画ゴールデンの追記） | #578 Phase B。Owner: 色、価格は T4 計算、星ゲート無し案 |
| **2** | 月見ピザ `tsukimi-pizza-pizzadb-p14` | bacon / egg / green-onion / mozzarella | **`green-onion`（新トッピング 1）** | bacon(2)・egg(1)・mozzarella。NO_SAUCE（チーズ下地） | **M**（ソース無しだが L1 family・専用アイコン・size class が要る） | Owner: `green-onion` の L1（vegetable か herb）と描画。**3 と 8 の前提** |
| **3** | 四川風ナスピザ `sichuan-eggplant-pizza` | doubanjiang / eggplant / garlic / green-onion / mozzarella | **`doubanjiang`（新ソース 1）**（`green-onion` は 2 で導入済みが前提） | eggplant(4)・garlic(8)・mozzarella。トレイ 5 種 | M | 2 の後。Owner: 色 |
| **4** | ナス田楽ピザ `eggplant-dengaku-pizza-pizzadb-p6` | eggplant / miso-sauce / mozzarella / white-sesame | **`miso-sauce`（新ソース）+ `white-sesame`（新トッピング）**＝新 2 | eggplant(4)・mozzarella | M〜L（1 step に 2 材料。8b の shiso+whitebait と同形） | `white-sesame` は焼肉・プルコギ系の前提にもなる。Owner: L1（spice 系か other） |
| **5** | ナスとタヒニのピザ `eggplant-tahini-pizza-pizzadb-p5` | eggplant / parsley / pomegranate / tahini | **`tahini`（新ソース）+ `pomegranate`（新トッピング、fruit）**＝新 2 | eggplant(4)・parsley(27)。チーズ無し（既存の SAUCE → TOPPING のみ。Flammkuchen と同様） | M〜L | Owner: ザクロの描画 |
| **6** | カポナータピザ `caponata-pizza-pizzadb-p2` | black-olive / capers / eggplant / mozzarella | **0** | black-olive(7)・capers(23)・eggplant(4) | **S**（Batch 8a 型: 非 credit・材料 0） | **Owner 判断**: `BASE_SAUCE_UNSPECIFIED` を NO_SAUCE として扱うか。原典未確認 |
| **7** | ジャマイカンジャークチキン `jamaican-jerk-chicken-pizza-pizzadb-p3` | chicken / green-pepper / mozzarella / pineapple | **0** | chicken(25)・green-pepper(32)・pineapple(10) | **S** | 6 と同じ判断。名前が「ジャーク」なのに調味が無い点の説明文方針 |
| **8** | 梅しそピザ `ume-shiso-pizza-pizzadb-p14` | mozzarella / shiso / umeboshi-paste / whitebait | **`umeboshi-paste`（1。ソースか topping かが未決）** | shiso・whitebait（8b）= 全部既存 | M | `BASE_SAUCE_UNSPECIFIED`（6/7 と同じ判断）+ 材料の種別。**予備枠** |

候補の外（今回は推さない）: `peking-duck-pizza`（新 4・PREPARED_COMPOSITE）、`currywurst`（新 3: curry-ketchup / paprika-powder / wurstel）、`cuban-pizza`（新 3: mustard / pickles / swiss-cheese）。
**第 2 波の材料候補（Owner が `BASE_SAUCE_UNSPECIFIED` を決めた後）**: `beef` 1 つで `rendang` と `nigerian-suya` の 2 レシピ、`cilantro` で `baingan-bharta`（+ chicken-tikka）、`cumin` / `paneer` / `aji-amarillo` で各 1 レシピ。`beef` は費用対効果が最大だが、どちらも原典未確認かつ「チーズ下地」の解釈が重い。

### 推奨追加順序（PR 単位）

1. **PR-A: yuzu-shrimp**（ソース 1・新トッピング 0。#634 の手順で最小のリスク。設計書の「miso → yuzu → tahini」は、shiso が出荷された現在は **yuzu → …** が最小に逆転した）。ladder step 56、credited 58→59。
2. **PR-B: tsukimi + green-onion**（トッピング導入の検証。L1/アイコンの OD を伴う）。step 57。
3. **PR-C: sichuan-eggplant + doubanjiang**（B の後。ソース 1）。step 58。
4. **PR-D: eggplant-dengaku（miso + white-sesame）**、**PR-E: eggplant-tahini（tahini + pomegranate）**（各 1 step・2 材料）。
5. **PR-F（Owner 判断が済んだ場合のみ）: caponata + jamaican-jerk の非 credit 2 件**（材料 0・ladder 不変・章 +2。独立に前後どこへでも入れられるので、**Owner の BASE_SAUCE 判断が先に出れば PR-A と並行**可）。
6. 梅しそは予備。

各 PR は直列（`recipes.ts` / `discoveryLadder.ts` / hint5 golden は HOT で、追記だけでも並行 PR 同士で衝突する）。1 PR = 1 step = 1〜2 レシピに保つ。

## 4. 必要食材のまとめ

| 追加する材料 | 種別 | 初出レシピ | その材料で解禁される他の候補 | 必要な作業 |
|---|---|---|---|---|
| `yuzu-kosho` | sauce（PAINT） | yuzu-shrimp | なし | `color`、`RecipeSauceProfile` の union 追加、描画 golden、アイコン（トレイ用）。taxonomy family は付けない（sauce は topping 専用表の外） |
| `green-onion` | topping | tsukimi | sichuan, peking-duck, eel, kimchi, natto, tsukimi（計 6） | L1 family OD、`pieceVisual` 専用 SVG、size class、G18 グリフ一意性 |
| `doubanjiang` | sauce | sichuan | なし | 同 sauce |
| `miso-sauce` | sauce | dengaku | なし | 同 sauce |
| `white-sesame` | topping | dengaku | bulgogi, yakiniku（計 3） | 同 topping |
| `tahini` | sauce | tahini | なし | 同 sauce |
| `pomegranate` | topping | tahini | なし | 同 topping（fruit） |
| （0 件）caponata / jamaican-jerk | — | — | — | データ行のみ（recipes / discoveryCatalog / referencePizza / hint role / orders / sauce profile = null） |

材料 1 つあたり: `ingredients.ts` 行、`TOPPING_FAMILY_ROWS`（topping のみ）、`toppingSizeClass.ts`、ladder 追記、`materialShop` の NEW 行と locked 行の表示、Hint 5.0 golden の追記、DH4 audit JSON の件数、ショップ/トレイのチップ画像。価格・補充は T4 の tier 計算（個別設定なし）。

## 5. 図鑑・ヒント・Research・経済への影響

| 領域 | 影響 | 根拠 |
|---|---|---|
| 図鑑（Dex） | レシピ +N。章 4 は 27 → 27+N（章が「クリア済み」の保存は無く、表示は Dex から導出。既存セーブのデータは消えず、27/27 の人は 27/28 表示になる）。非 credit の 2 件（caponata / jamaican）は章 3 側に入る見込み（要導出） | `TETO_NEW-SAUCES-A_Result.md` §4 |
| 保存形式 | schema v2 のまま（Dex id の追加のみ）。ladder は台帳が和集合で再ロックしない | 同 |
| Hint 5.0 | 新レシピは永久 key-free。golden は**追記専用**（#634 で +158 行 / 削除 0）。単独ソースのレシピは sauce rung が 1 つ。新ソースは topping family を持たない | 同 §3 |
| DH4 / Anti-Oracle | 全再実行が必須。DH4 audit JSON の `category` が sauce 追加ごとに +1（3→4 の前例）。新トッピングは L1 family 行を足すので `hint5Taxonomy.gate`（G18 一意性）の再検査 | `TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md` §10.5 NS-5 |
| Research のコホート文字 | コホートは「最後に解禁した材料」。新材料は単独 step ならコホートも単独 = 文字なし。**材料 0 の 2 件は既存コホートに合流して文字が付く**: caponata → capers(step 23)＝`puttanesca-pizza` の組、jamaican → green-pepper(step 32)＝`veggie-supreme-pizza` の組。Batch 8a と同じく Owner 承認と「文字が決定的」の E2E が要る | 本書で再導出（`researchEntry.ts` のコホート定義 + ladder 順） |
| ladder / 経済 | 材料を足す回は ladder +1 step・credited +1。材料 0 の 2 件は非 credit で ladder を動かさない | Batch 7a/8a の前例 |
| ★ゲート到達性 | 通常レシピ数が増えると `ladderReachability.starGate` の基準が動く（#634 では 62 レシピ = 一律 ★2 で 124★ が goat-cheese の 120★ を超えた）。同じ計算で 65 レシピ = 130★ は spinach の 130★ に届く **（推定。実測は各 PR で必須）** | 同 Result §3 |
| Lunch Rush | `lunchRush:false` を付けるのでプール 25 のまま | 前例 |
| late catalog（本番 OFF） | 通常 step を足すたびに ikura の late step 番号がずれる（OFF では無影響）。E5 前に「番号の固定 or 通常バッチ停止」を決める既知の宿題 | `lateCatalog.ts` KNOWN LIMIT、`TETO_PR584_BATCH8C_Archival.md` §3 |
| Shop / アイコン | 新ソースはトレイ用の専用アイコンが要る（Style Lock v2）。色は実機 HV で確定（`#fffdf8` の前例は「暫定」） | #634 |
| 人手検証 | UI/ゲームプレイ変更なので `TETO_HUMAN-VERIFICATION-POLICY.md` に従い、390×844 動画（Owner へ直接）+ before/after スクショ | CLAUDE.md |

## 6. 新しい調理工程が必要 → P3 以降に分類

| 区分 | 必要な能力 | 対象（matrix 件数） | 前提・状態 |
|---|---|---|---|
| **P3 = Pinsa（生地の種類）** | `DOUGH_VARIANT`（`doughKind`）+ ルッコラ後乗せ | `pinsa-romana`（食材は `jamon-serrano-pizza` と同集合 → 生地軸で区別）。**食材 0** | P3-a1 #639 / P3-a2 #640 が open、**P3-b（データ本体）は HOLD**（原典確認）。ON は E5（FINISH + late catalog の本番化、AC-8・Q-5・iPhone HV）と同時 |
| 生地バリエーション（P3 の次） | `DOUGH_VARIANT`（33 行が要求） | `piadina-romagnola`（arugula / cream-cheese / prosciutto-crudo = **食材 0**）、`ny-style`、`argentine-napolitana`（食材 0）、`manakish`（新 2）、`poutine`（新 3） | Pinsa の運用確認後（設計書 §11.4）。ny-style は trenton と同集合で `STEP_ORDER` も絡む |
| 後乗せ | `LATE_ADDITION`（13 行） | `bbq-chicken`（cilantro 後乗せ）、`mentaiko-cream`、`wasabi-beef`、`hot-honey-pepperoni`、ikura（実装済み・OFF） | E5 待ち。FINISH の本番 OFF が続く限り本番に出せない |
| 複数ソース | `MULTI_SPREAD_LAYER`（17 行） | `grandma-pizza`（#540、Draft/HOLD、Square Dough 待ち）、`sfincione`、`burrata-pizza`、`pescatore`、`pesto-noci`、`pesto-burrata`、`pizza-alla-crudaiola`、`pizza-salad`、`potato-mayo` ほか | #540 が最初。`burrata` / `mussel` / `honey` 等の新材料も同時に要る |
| 配置領域 | `ZONED_PLACEMENT`（1 行） | `quattro-stagioni` | Owner 決定で将来フェーズ |
| 工程順 | `STEP_ORDER`（2） | `trenton-tomato-pie`（チーズ → ソース） | 新工程 |
| 下ごしらえ | `PREP_STEP`（3） | `yakiniku`（牛を炒める）ほか | 新工程 |
| 天板・包む・揚げる・折る・生地形状 | `PAN_BAKE`（8）、`ENCLOSE`（5）、`FRY_COOK`（1）、`LAMINATE`（1）、`DOUGH_SHAPE_TARGET`（5） | montreal / detroit / calzone 類 / `pizza-fritta` / fugazzeta-rellena ほか | 大きな別 Epic。Square Dough（#532）との重複に注意 |

## 7. Owner に確認したい点

1. **Q1（最重要）`BASE_SAUCE_UNSPECIFIED`（22 行が FULL で止まっている）を「ソース不明 = チーズ下地・NO_SAUCE」として扱ってよいか**。可なら caponata / jamaican-jerk（材料 0）が即時に候補になり、`beef` 1 つで rendang / suya の 2 件、`cilantro` / `cumin` / `paneer` 等が続く。不可なら §3 の 1〜5 だけを進める。
2. **Q2** `green-onion` / `white-sesame` / `pomegranate` の L1 family と描画方針（OD-B8-2 型の batch-scoped OD）。
3. **Q3** 新ソース 4 種（yuzu-kosho / miso / doubanjiang / tahini）の色と、各レシピの星ゲート（無し案が前例）。
4. **Q4** 順序: 設計書の「味噌 → 柚子胡椒 → tahini」を「柚子胡椒 → … 」へ入れ替えてよいか（shiso 出荷済みの再計算結果）。
5. **Q5** #578 claim（session `015U…`）を release／更新してから Phase B を始める運用でよいか。
6. **Q6** pizzadb.jp の独立再取得（#527 D4）が未完了のまま、構成を matrix 証跡に基づく「暫定」として実装前に進めてよいか（前例: 8a/8b/#634 は暫定で進行）。

## 8. 実装 PR の共通チェックリスト（要約）

前回 audit §7 と `TETO_NEW-SAUCES-A_Result.md` に倣う: G0 ladder 導出（1..N-1 凍結）→ データ表（`recipes` / `recipeSauceProfiles` / `discoveryCatalog` / `referencePizza` / `recipeHintRoles` / `orders` / manifest）→ `catalogLedger.test.ts` と件数 pin → `hint5` golden 追記 → `ladderReachability.starGate` 再測定 → DH4 / G7 / G17 / G18 → 代表 E2E（390×844 / 360×800、WebKit は CI）→ HV（動画 + スクショ）。**既存アサーションは削除・緩和しない。**

## 9. 実施しなかったこと

コード・テスト・workflow の変更、PR、merge、デプロイ、Preview 更新、他セッションのブランチ操作、pizzadb.jp の再取得、テスト実行（依存未導入）。`docs/PROJECT_HANDOFF.md`（HOT）は更新していない。
