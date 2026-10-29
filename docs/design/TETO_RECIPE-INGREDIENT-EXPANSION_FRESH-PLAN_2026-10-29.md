# TETO レシピ・食材拡張 — Fresh Expansion Plan（docs-only、READ-ONLY 調査）

Status: **調査と計画のみ。Owner 承認前に実装・Issue・PR は作らない。** `src/**`・`e2e/**`・CSS・設定・保存データ・Dex・在庫・採点・本番フラグ・Preview / Production は変更していない。Monitor は作っていない。
この文書の「推奨」は助言であり、Owner Decision ではない。未決は §13 に列挙し、推測で確定していない。
HV: docs-only のため不要（`TETO_HUMAN-VERIFICATION-POLICY.md`、audit-only は Preview・動画の対象外）。

## 0. 基準と範囲

| 項目 | 値 |
|---|---|
| 基準 `main` | **`ffff081c0136df43113a81c170343d24d968ed1f`**（#695 Cooking Prep Phase 1 PR-B、2026-10-29 17:19:49 +0900）。調査開始時と終了時の 2 回 `git fetch` で同一 |
| 調査日時 | 2026-10-29 20:56 JST |
| 作業ブランチ | `claude/teto-pizza-expansion-plan-509mh8`（main と同一から開始。docs 1 ファイルのみ追加） |
| 数え方の正 | **コード（`RECIPES` / `INGREDIENTS` を実行して取得）**と GitHub の現況。過去のハンドオフ・過去の監査値は使っていない |
| 再利用した資料 | 172 matrix（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）、`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`、`TETO_STATE-SYNC_2026-10-26.md`、B10 / B11 の Owner 決定・Result、`TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` |
| 重複回避 | matrix の行データは複製せず、§4・付録 A に**現行コードとの差分（分類）だけ**を置く |

> **重要な前提（原典の限界）.** matrix の各行は pizzadb.jp の比較表に由来し、原典の個別ページは多くが未確認（PR #612: 45 件は原典未確認）。B10 / B11 のレシピは Owner 承認の「GAMEPLAY ASSUMPTION（暫定仕様）」として出荷されている。本書の候補も同じ扱いで、原典の事実とは断定しない。

## 1. Fresh State（確認した事実）

### 1.1 運用ルール

- `CLAUDE.md`: UI/UX/ゲームプレイ変更は HV 方針（390×844 の動画を Owner へ直接、前後スクショを `docs/reports/screenshots/<task>/` へ）が DoD。今回は docs-only で対象外。
- `TETO_SESSION-OPERATIONS_1.0.md`: claim は Issue / PR コメントの任意予約（ブロックしない）。HOT ファイル（`recipes.ts`・`gameReducer.ts`・`PROJECT_HANDOFF.md` ほか）の重複は先に merge する側が優先。新規 Issue / PR / merge / Preview / Production は Owner 承認が必要。
- `docs/PROJECT_HANDOFF.md` は冒頭が 2026-09-18 のまま（約 1142 行）。起動チェックリストの「GitHub の現況を正とする」に従い、**本書は現況を正とした**。

### 1.2 GitHub

| 種別 | 結果 |
|---|---|
| open PR | 30 件。#697（Cooking Prep Phase 1B）以外の 29 件は docs / 古い機能 PR で、**2026-10-29 に更新されたのは #697 のみ**（次に新しいのは 10-24 の #651） |
| #697 | HEAD `8ba2b5b901a79255fd396c755c69b1df2ac59f85`（既知値と**一致**）、base `ffff081`、`mergeable_state: clean`、非 draft、50 ファイル（`src/logic/prep/**`、`CookingPrep*`、`PizzaStage.tsx`、`GameScreen.tsx`、`App.tsx`、`gameReducer.ts`、`e2e/cooking-prep.spec.ts`、`docs/reports/TETO_COOKING-PREP_PHASE1B_*`、仕様書の改訂、スクショ）。**`src/data/**` は 1 ファイルも触らない** |
| open Issue | 100 件。関連: #696（Prep 1B 管理）、#611（TQ-2 / BBQ / Cooking Prep の umbrella）、#578（新ソース。出荷済みが大半）、#527（Batch 8 計画。frango / spanish-chorizo は出荷済みで見出しが古い）、#561（星ゲート。下記）、#604 / #579 / #608（後乗せ・仕上げソース）、#577（Dough Kind）、#521 / #532–#538 / #540（Multi-Sauce・Square Dough、グランマ出荷後の残り）、#675（トレイ UX）、#417 / #438 / #623（アイコン 2.0）、#668 / #664 / #617 / #560（保存保護）、#422（図鑑の匿名ロック枠） |
| Duplicate Gate | open の PR / Issue に「Expansion 計画」の重複なし（`expansion batch` 検索 0 件）。`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` は**調理法**の計画（#573 時点、スコープが別）。本書は**レシピ・食材**の選定で重ならない |

### 1.3 現在の実装状態（コードから）

| 項目 | 値 | 根拠 |
|---|---|---|
| レシピ | **80**（Pinsa OFF 時 79）。うち late catalog 8（ikura / yuzu-shrimp / eggplant-dengaku / eggplant-tahini / bbq-chicken / wasabi-beef / tarako-cream / pinsa） | `RECIPES` 実行、`catalogLedger.test.ts` |
| ladder に数えるレシピ（credited） | 73 | `catalogLedger.test.ts` |
| 食材 | **92** = ソース 13 / チーズ 13 / トッピング 66 | `INGREDIENTS` 実行 |
| 棚（family） | sauce 13 / cheese 13 / meat 12 / seafood 11 / vegetable 24 / fruit 3 / herb 9 / spice 4 / other 3 | `catalogLedger.test.ts` |
| ladder | 70 step、章 [6, 12, 18, 44]（第 4 章が 63%） | 同上 |
| Lunch Rush プール | 25（全 80 のうち。B10 / B11 の新規は全て `lunchRush:false`） | 同上 |
| 星ゲート余裕 | `ACCEPTED_MIN_SLACK = 1`（credited 73 − ladder 70 − 星ゲート直接 2 = 1）。**ゲートや step を足すと検出テストが落ちる** | `ladderReachability.starGate.test.ts` |
| 技法（Technique） | `no-sauce` / `tray` / `dough-pinsa-romana` / `late-addition` の 4 | `techniques.ts` |
| 本番スイッチ | `LATE_CATALOG_PRODUCTION` `FREE_COOK_FINISH_PRODUCTION` `PINSA_PRODUCTION` = true、**`PREP_EXPERIENCE_PRODUCTION` = false**、`HAND_ENFORCEMENT_PRODUCTION` = false | 各 `*Gate.ts` |
| Cooking Prep | PR-A（#694）・PR-B（#695）は main。**牛肉の「炒める」のみ・本番 OFF**（`?cookPrep=on` の Preview / DEV のみ）。`PREP_TARGET_INGREDIENT_IDS = ["beef"]`。1B（タイミングゲーム）は #697 で未 merge。`preparedLook` は transient で、保存・採点・在庫・Dex・識別に出ない | `prepIngredients.ts`、#697 本文 |
| チーズ描画 | モッツァレラのみ Canvas（`CHEESE_CANVAS_DEFAULT_ON = true`、#486）。他のチーズは `scatter` の CSS / emoji、専用 `pieceVisual` は feta・ricotta のみ | `cheeseRenderMode.ts`、`ingredients.ts` |
| ソース描画 | 全て同一の field-based PAINT。色駆動（olive-oil だけ特例）。**新しい塗り操作は無い** | `recipeSauceProfiles.ts`、前回監査 §1.1 |
| 専用ピース描画（`pieceVisual`） | トッピング 66 中 **23**（beef・porcini・mussel・salmon-roe・cilantro など直近に集中）。残り 43 は emoji / 汎用 | `INGREDIENTS` 実行 |

### 1.4 利用の偏り（バランス判断の入力）

| 指標 | 値 |
|---|---|
| mozzarella を使うレシピ | **58 / 80（72.5%）** |
| tomato-sauce | 29、onion 17、olive-oil 11、garlic 10、oregano 10、black-olive 10、pesto 9、**eggplant 9** |
| **ちょうど 1 レシピでしか使われない食材** | **50 / 92**（未使用は 0） |

## 2. 数え方の定義（過去の監査値との関係）

過去値（候補 172、実装 55/61・未実装 122、優先 19、新食材約 21 ＋ソース約 6）は**定義が確認できず、今の値と比較できない**ため再計算した。母数と意味を固定する。

| 集計 | 値 | 意味 |
|---|---|---|
| matrix の行（母数） | **172** | pizzadb.jp 由来の証跡行。ゲームのレシピ数とは別物 |
| ① 出荷済みと 1:1 対応する行 | **71** | evidence id / candidate id が現行レシピ id に一致（別名 3 件: bbq-chicken、bianca→pizza-bianca-ricotta、mentaiko-cream→tarako-cream-pizza）。うち 5 行は matrix の材料と出荷の材料が異なる（capricciosa・quattro-formaggi・margherita・fugazza・breakfast、`COMPOSITION_CONFLICT_SHIPPED`） |
| ② 名前が出荷済みと衝突する行 | **4** | bismarck-p7・pesto-genovese・marinara-p13・meat-lovers-p13。新規候補ではなく、出荷版との差の判断対象 |
| ③ **真の未出荷候補** | **97** | 本書の分類対象 |
| 現行レシピ 80 の内訳 | 71（行と対応）＋ **9（行と 1:1 に対応しない原型・独自）** | marinara・genovese・bismarck・funghi・napoletana・pizza-bianca・meat-lovers・pepperoni・salsiccia。同一材料集合の別名行（cauliflower-crust など 5 行）は出荷扱いにせず、DOUGH_VARIANT 候補として③に残した |

検算: 71 + 4 + 97 = **172** ✓ ／ ③の分類（§3）14 + 10 + 25 + 30 + 18 = **97** ✓ ／ 証跡状態 READY 14 + REVIEW 12 + BLOCKED 71 = **97** ✓。

## 3. レシピ候補の分類（97 件）

**分類は技術依存の主分類（互いに排他）。証跡状態は別軸**（matrix の `productDecisionStatus`: READY / REVIEW=READY_WITH_REVIEW / BLOCKED=BLOCKED_PRODUCT_DECISION）。優先順位は ⑥ → ④ → ③ → ② → ① の順に最初に当たったものを採用。

| 主分類 | 規則 | 件数 | READY | REVIEW | BLOCKED |
|---|---|---|---|---|---|
| ① 既存食材だけ | 不足食材なし、構造 / 工程 capability なし | **14** | 1 | 1 | 12 |
| ② 新食材（トッピング）が必要 | ソース・チーズ以外の不足食材あり | **10** | 0 | 0 | 10 |
| ③ 新ソース / チーズが必要 | 不足がソース系 / チーズ系を含む | **25** | 5 | 2 | 18 |
| ④ 新しい調理工程が必要 | `PREP_STEP` / `LATE_ADDITION` / `DOUGH_VARIANT`（Pinsa は出荷済みの 1 種のみ） | **30** | 3 | 5 | 22 |
| ⑥ 既存仕様では再現困難 | `ENCLOSE` / `LAMINATE` / `FRY_COOK` / `ZONED_PLACEMENT` / `STEP_ORDER` / `DOUGH_SHAPE_TARGET` / `PAN_BAKE` | **18** | 5 | 4 | 9 |
| 合計 | | **97** | 14 | 12 | 71 |

- **⑤ 描画品質が先に必要**は独立の列にせず、③ のうち**白〜クリーム系で既存と見分けにくい新ソース / チーズ**（mayo・yogurt-sauce・blue-cheese-dressing・sour-cream・burrata・brie・cheese-curd・ricotta-salata・cotija・condensed-milk 等を含む行）に**フラグ ⑤** を付けた。**13 件**。ヒューリスティックであり、実際の判定は実装時の HV（§5.1 の ΔE 参照）。
- `MULTI_SPREAD_LAYER` は**エンジンが出荷済み**（B1/B2/S1/S2、grandma-pizza・pescatore の前例）なので工程扱いにしていない（データ追加のみ）。`LATE_ADDITION` は**トッピング種別の後乗せは出荷済み**（late catalog）。**ソース・チーズの後乗せは未対応**（`PLACE_TOPPING` の FINISH は topping 限定、#579 / #604）。
- 一覧は付録 A。

### 3.1 BLOCKED の内訳（71 件、複数該当あり）

| blocker | 行数 | 意味 | 解消できる主体 |
|---|---|---|---|
| `BASE_SAUCE_UNSPECIFIED` | 31 | 証跡にソースの記載なし | **Owner 判断**（B10 の curry-ketchup のように GAMEPLAY ASSUMPTION を承認） |
| `UNRESOLVED_INGREDIENT` | 19 | 「ひき肉」(5)・「唐辛子」(5+2)・「チーズ」(3+1)・「ホワイトソース」等の曖昧語 | Owner 判断 / 原典確認 |
| `COMPOSITION_CONFLICT_CANDIDATE` | 16 | 他候補・出荷版と材料集合が衝突 | Owner 判断 |
| `MECHANIC_INTERPRETATION` | 11 | 生・サラダ系などタイミング解釈が割れる | Owner 判断 / 原典確認 |
| `EVIDENCE_GAP` / `SCOPE_QUESTION` / `DISCOVERY_COLLISION` | 2 / 2 / 1 | 証跡不足・範囲・識別衝突 | 個別 |

**最重要の発見:** 「既存食材だけ（①）かつ READY」は **月見ピザ 1 件のみ**で、これは DH4 により**実装保留中**（OD-B9-8 / OD-B9-12、§12）。つまり**証跡上クリーンに出せる Stage 1 の候補はほぼ枯渇**している。Stage 1 を続けるには、B10 / B11 と同じ「Owner 承認の GAMEPLAY ASSUMPTION」が前提になる（O-1）。

### 3.2 「新しい要素が 1 つだけ」で出せる候補（BLOCKED なし・工程なし）

不足が**ちょうど 1 品目**かつ READY / REVIEW かつ工程 capability なし: **ブラータ（3 レシピ）とはちみつ（1 レシピ）だけ**。

| 新要素 | レシピ | 備考 |
|---|---|---|
| burrata（チーズ） | burrata-pizza・pizza-alla-crudaiola・pesto-burrata | いずれも READY。`MULTI_SPREAD_LAYER`（出荷済みエンジン） |
| honey | hot-honey-pepperoni（REVIEW） | matrix は honey を tomato-sauce に次ぐ**2 層目のスプレッド**として記録し、「焼成後の垂らし」(`LATE_ADDITION`) は **repo 内の推論（`repo_inference`、原典未確認）**。焼成前の PAINT で出すなら既存エンジンで足りる。垂らす表現を望むなら #579 を待つ（O-5） |

## 4. 食材・ソース・チーズの候補（不足 78 品目 ＋ 曖昧語）

97 候補が必要とする**現行に無い食材は 78 品目**（ソース系 20 / チーズ系 10 / トッピング系 48）。加えて曖昧語（牛ひき肉・唐辛子・汎用チーズ）が 19 行にある。単独で複数行に効くのは次のとおり。

| 食材 | 使われる候補行 | 証跡状態 |
|---|---|---|
| mayo | 6 | 全て BLOCKED（ソース不明の行） |
| honey | 5 | READY 1 / REVIEW 1 / BLOCKED 3 |
| 牛ひき肉（ひき肉） | 6（taco + 曖昧語 5） | 曖昧語は BLOCKED |
| 唐辛子（赤 / 青） | 7（曖昧語） | BLOCKED |
| walnut | 4 | 混在 |
| lettuce・burrata | 各 3 | burrata は全 READY |
| cucumber・french-fries・cinnamon・carrot・blue-cheese-dressing | 各 2 | 混在 |
| 残り（約 60 品目） | 各 1 | — |

### 4.1 食材の評価（§4 の評価観点）

| 食材 | 使えるレシピ数 | 見分けやすさ（トレイ / 完成時） | 調理前後の変化 | 新しい操作 | 描画負荷 | 既存への影響 |
|---|---|---|---|---|---|---|
| **burrata**（チーズ） | 3 | 白い丸い塊。mozzarella（Canvas）・ricotta（`ricotta-mound`）・cream-cheese と**白で近い**ため形（丸い球＋裂け目）で分ける必要 | 焼くと中心がとろけて広がる（Canvas プールの別パラメータ案） | なし（scatter 配置） | 中（専用 SVG ＋ 描画パラメータ。モッツァレラ Canvas は mozzarella 専用で、他チーズへの拡張は未着手） | cheese 棚 13→14。既存レシピに無影響 |
| **牛ひき肉** | 6（曖昧語含む） | 小さな粒の集まり。beef（薄切りリボン）・sausage と区別できる形が必要 | 生→炒め色（Prep の対象にしやすい） | なし（Prep と組むと「炒める」を再利用） | 中（粒状ピース SVG） | meat 棚 12→13 |
| **lettuce / cucumber** | 3 / 2 | 緑の葉 / 薄切り輪。herb（shiso・arugula・mint）と**緑で近い** | 生のまま（焼かない）— 焼成前に置くとしおれる表現が要る | 後乗せ（FINISH）が前提になる可能性 | 中 | vegetable 棚 24→26 |
| **honey** | 5 | 琥珀色の液体。curry-ketchup（ΔE 11.9）・mustard（16.0）と近い | 焼成後の艶 | 焼成前 PAINT なら不要。**垂らす（DRIZZLE）**表現は未実装（#579） | 小（色）／大（垂らし操作） | sauce 棚 13→14 |
| **walnut** | 4 | 茶色の割れた粒。almond・pine-nuts と同じ `other` 棚（3 品）に入り、**DH4 の「その他は到達不能」(OD-DH4-2-9) に影響**しうる | 焼くと濃くなる | なし | 小 | `other` 家族の扱い（O-9） |
| **mayo / yogurt-sauce / blue-cheese-dressing** | 6 / 1 / 2 | **白で fromage-blanc-sauce（ΔE 7.1 / 4.2 / 5.1）と区別不能**。色だけでは別ソースに見えない | 焼成後に垂らす（mayo）か、塗り（yogurt） | mayo は DRIZZLE が必要 | 大（質感の差を作る必要） | 既存ソースの識別が悪化 |
| **yakiniku-sauce / sweet-bean-sauce / okonomiyaki-sauce / gravy** | 各 1 | 茶〜黒褐色。bbq-sauce（ΔE 5.2 / 10.4）・soy-sauce（7.2）・miso に近い | — | なし | 大（暗色の既存 4 種と見分けにくい） | ソース棚が「茶」に偏る |
| chili（赤唐辛子） | 7（曖昧語） | 小さな赤いスライス。tomato 系・pepperoni に紛れる | — | なし | 小 | 曖昧語の解決が先（O-4） |

色差は CIE76 ΔE を私が仮色で計算した**参考値**（本番の色ではない）。既存ソース同士の最小は pesto–yuzu-kosho 17.5、bbq–soy 23.4。新ソースをそれ以下に置くと棚の識別が悪化する。

## 5. ソース・チーズの拡張（独立調査）

### 5.1 ソース

- **現在 13 種**（tomato・olive-oil・pesto・fromage-blanc・doubanjiang・curry-ketchup・mustard・yuzu-kosho・miso・tahini・bbq・soy・fresh-cream）。全て PAINT（色駆動）。olive-oil だけ `PAINT_TEMPORARY` 系の特例（焼成で油色が変わる）。
- **未実装候補（上位）:** yogurt-sauce・yakiniku-sauce・sweet-bean-sauce（READY / REVIEW の各 1 行）、honey・mayo（複数行）、buffalo-sauce・okonomiyaki-sauce・peanut-sauce・gravy-sauce・salsa・kebab-sauce・blue-cheese-dressing（各 1 行、多くが BLOCKED）。
- **味・色・質感の差:** 現行は「色」しか差がない。**液体（honey・mayo・dressing）は“垂らす”質感が本質**で、PAINT のまま色だけ足すと既存と区別できない。ここが最大の設計上の分岐。
- **塗る操作の違いを足す必要性:** 焼成前に塗るものは**不要**（PAINT で足りる。B10 / New Sauces U1〜U3 の前例）。**焼成後に垂らす表現（mayo・buffalo・dressing・teriyaki、望むなら honey）は DRIZZLE 相当が必要**で、これは #579 / #604 / #611 の領域（Stage 3）。honey は matrix 上は 2 層目のスプレッドなので、焼成前 PAINT という選択肢が残る。
- **再利用性:** 1 行にしか出ないソースが大半（yogurt・yakiniku・sweet-bean・peanut…）。**複数行に効くのは mayo（6、全 BLOCKED）と honey（5）だけ**。1 行専用ソースは「ソース 1 種 ＝ レシピ 1 件」の対になり、棚が増えるだけで体験の広がりは小さい。
- **複雑化の抑制案:** 焼成前 PAINT のソースは**レシピと同時に 1 種ずつ**（B10 の方式）。液体の後乗せは**共通基盤（DRIZZLE）を 1 回作ってから**まとめて入れる。

### 5.2 チーズ

- **現在 13 種**（mozzarella・gorgonzola・parmigiano・fontina・cashew・grana-padano・cream-cheese・catupiry・feta・ricotta・goat・paneer・swiss）。モッツァレラのみ Canvas の溶けた表現（#486 default-on）。feta・ricotta は専用 `pieceVisual`。他は emoji / CSS で、**加熱前後の差は“色の焼き込み”程度**。
- **未実装候補:** burrata（3 行、全 READY）、cheddar・brie・brick-cheese・caciocavallo・cheese-curd・cotija・halloumi・pecorino・ricotta-salata（各 1 行）。曖昧語「チーズ」が 3 行（old-forge・turkish pide・北海道チーズ）、プロヴォローネ 1 行。
- **溶け方・焼き色・配置の差:** burrata は「中心がとろけて外側が残る」、halloumi は「溶けず焼き目がつく」、cheese-curd は「半溶け」、brie は「白カビの皮」。**これらはモッツァレラ Canvas（`cheesePool.ts`）の別パラメータ化が必要**で、既存の Cheese Pool は mozzarella 専用の描画関数。拡張は**独立した設計 Gate**（#421 / #486 の系譜）を要する。
- **依存:** Cheese Pool の汎用化を**しない**なら、burrata は「白い丸い塊（`pieceVisual`）＋焼成の色変化のみ」で出せる（feta / ricotta と同じ方式）。見た目の魅力は下がるが、既存システムの複雑化は最小。**どちらにするかは Owner 判断**（O-6）。

## 6. 優先度スコア

### 6.1 方法

6 軸を 5 段階で評価し、指定の重みで加重する（新しさ 25 / 見た目 20 / 再利用 20 / 実装負荷の小ささ 15 / 互換 10 / 解禁相性 10）。**同点は、依存が少なく短期で遊べる状態にできる方を上位**（依存数の昇順、次に Stage の昇順）。

**アンカー（主観を減らすため固定）:**

| 軸 | 5 | 3 | 1 |
|---|---|---|---|
| 新しさ | 新しい操作・体験が加わる | 既存体験の変形 | 既存と同じ |
| 見た目 | 完成時に一目で違う | 色 / 形が少し違う | 既存と区別不能 |
| 再利用（③の未出荷行数） | 6 行以上 | 2〜3 行 | 0（既存のみ）※1 行は 2、4〜5 行は 4 |
| 実装負荷の小ささ | データのみ | 専用 SVG ＋色 | 構造変更 |
| 互換 | HOT ファイル・golden に触れない | ledger / golden の更新のみ | 識別軸・採点・保存に触れる |
| 解禁相性 | 追記 step 1 つで自然 | ladder の位置調整 | 星ゲート / 保存と衝突 |

**代替重みも計算した:** 均等重み（各 1/6）と、実装安全重視（新しさ 15 / 見た目 10 / 再利用 15 / 負荷 30 / 互換 20 / 解禁 10）。順位が大きく動く候補は注記する。**重みの偏りの所見:** 新しさ＋見た目で 45% を占めるため、**構造系（calzone: 8 位、quattro-stagioni）が上位に出やすい**。実装安全重視では bulgogi・sfincione・crudaiola が上がり、calzone は 16 位に下がる。

### 6.2 レシピ（20 候補）

「Stage」列は既定の割当（hot-honey は O-5 次第で 2、pizza-salad は O-7 次第で 2 または見送り）。「依存」は同点処理用の依存数。

| 順位 | id | 名称 | Stage | 依存 | 新しさ | 見た目 | 再利用 | 負荷小 | 互換 | 解禁 | 加重 | 均等重み順位 | 実装重視順位 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `pizza-salad` | ピザサラダ | 2 | 2 | 5 | 5 | 3 | 2 | 3 | 3 | **3.75** | 7 | 8 |
| 2 | `burrata-pizza` | ブラータピザ | 2 | 1 | 3 | 5 | 3 | 3 | 4 | 4 | **3.60** | 1 | 6 |
| 3 | `piadina-romagnola` | ピアディーナ・ロマニョーラ | 3 | 2 | 4 | 4 | 5 | 2 | 2 | 3 | **3.60** | 10 | 11 |
| 4 | `pizza-alla-crudaiola` | ピッツァ・アッラ・クルダイオーラ | 2 | 1 | 3 | 4 | 3 | 4 | 4 | 4 | **3.55** | 2 | 3 |
| 5 | `yakiniku-pizza` | 焼肉ピザ | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 4 | **3.55** | 8 | 7 |
| 6 | `keema-pizza` | キーマピザ | 1 | 1 | 3 | 3 | 5 | 3 | 4 | 3 | **3.50** | 4 | 5 |
| 7 | `hot-honey-pepperoni` | ホットハニーペパロニピザ | 3 | 2 | 4 | 4 | 4 | 2 | 3 | 3 | **3.50** | 9 | 10 |
| 8 | `calzone` | カルツォーネ（ENCLOSE系） | 4 | 4 | 5 | 5 | 4 | 1 | 1 | 2 | **3.50** | 15 | 16 |
| 9 | `manakish` | マナキーシュ | 3 | 3 | 4 | 4 | 5 | 1 | 2 | 2 | **3.35** | 13 | 15 |
| 10 | `sfincione` | スフィンチョーネ | 1 | 0 | 3 | 3 | 2 | 5 | 4 | 4 | **3.30** | 3 | 2 |
| 11 | `pesto-burrata` | ペストブラータピザ | 2 | 1 | 2 | 4 | 3 | 4 | 4 | 4 | **3.30** | 6 | 4 |
| 12 | `teriyaki-chicken` | 照り焼きチキンピザ | 3 | 3 | 3 | 3 | 5 | 2 | 3 | 3 | **3.25** | 11 | 12 |
| 13 | `bulgogi-pizza` | プルコギピザ | 1 | 1 | 2 | 3 | 2 | 5 | 5 | 4 | **3.15** | 5 | 1 |
| 14 | `pesto-noci` | ペストノーチピザ | 2 | 2 | 3 | 3 | 4 | 2 | 3 | 3 | **3.05** | 12 | 13 |
| 15 | `kimchi-pizza` | キムチピザ | 3 | 3 | 3 | 4 | 3 | 2 | 3 | 3 | **3.05** | 14 | 14 |
| 16 | `peking-duck-pizza` | 北京ダックピザ | 2 | 3 | 4 | 4 | 2 | 1 | 3 | 3 | **2.95** | 17 | 17 |
| 17 | `quattro-stagioni` | クアトロスタジオーニ | 4 | 3 | 5 | 5 | 1 | 1 | 1 | 2 | **2.90** | 18 | 20 |
| 18 | `pizza-fritta` | ピッツァフリッタ | 4 | 4 | 5 | 4 | 2 | 1 | 1 | 2 | **2.90** | 20 | 19 |
| 19 | `tsukimi-pizza` | 月見ピザ（DH4保留中） | 1 | 2 | 2 | 4 | 1 | 5 | 3 | 2 | **2.75** | 16 | 9 |
| 20 | `trenton-tomato-pie` | トレントントマトパイ | 4 | 3 | 4 | 3 | 2 | 2 | 1 | 3 | **2.70** | 19 | 18 |

### 6.3 食材（17 候補）

| 順位 | id | 名称 | Stage | 依存 | 新しさ | 見た目 | 再利用 | 負荷小 | 互換 | 解禁 | 加重 | 均等重み順位 | 実装重視順位 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `burrata` | ブラータ（チーズ） | 2 | 1 | 4 | 5 | 3 | 3 | 4 | 4 | **3.85** | 1 | 1 |
| 2 | `ground-beef` | 牛ひき肉 | 1 | 2 | 4 | 3 | 5 | 3 | 3 | 3 | **3.65** | 2 | 2 |
| 3 | `lettuce` | レタス | 2 | 2 | 4 | 4 | 3 | 3 | 3 | 3 | **3.45** | 4 | 6 |
| 4 | `dessert-cluster` | デザート系（りんご/シナモン/チョコ等） | 4 | 4 | 5 | 4 | 4 | 1 | 2 | 2 | **3.40** | 13 | 17 |
| 5 | `cucumber` | きゅうり | 2 | 2 | 3 | 4 | 3 | 4 | 3 | 3 | **3.35** | 5 | 4 |
| 6 | `chili` | 唐辛子（赤） | 1 | 2 | 2 | 3 | 5 | 4 | 3 | 3 | **3.30** | 3 | 3 |
| 7 | `honey` | はちみつ（液体） | 3 | 2 | 4 | 3 | 4 | 2 | 3 | 3 | **3.30** | 7 | 13 |
| 8 | `french-fries` | フライドポテト | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | **3.20** | 8 | 8 |
| 9 | `walnut` | くるみ | 1 | 1 | 2 | 3 | 4 | 4 | 3 | 3 | **3.10** | 6 | 5 |
| 10 | `brie` | ブリー | 2 | 2 | 3 | 4 | 2 | 3 | 3 | 3 | **3.00** | 12 | 14 |
| 11 | `mayo` | マヨネーズ | 2 | 1 | 2 | 2 | 5 | 3 | 3 | 3 | **2.95** | 9 | 9 |
| 12 | `yogurt-sauce` | ヨーグルトソース | 2 | 1 | 3 | 3 | 2 | 3 | 3 | 3 | **2.80** | 14 | 15 |
| 13 | `cheddar` | チェダー | 2 | 1 | 2 | 3 | 2 | 4 | 4 | 3 | **2.80** | 10 | 7 |
| 14 | `squid` | いか | 1 | 2 | 2 | 3 | 2 | 3 | 4 | 4 | **2.75** | 11 | 12 |
| 15 | `sweet-bean-sauce` | 甜麺醤 | 2 | 2 | 3 | 2 | 2 | 4 | 3 | 3 | **2.75** | 15 | 10 |
| 16 | `yakiniku-sauce` | 焼肉のたれ | 3 | 2 | 3 | 2 | 2 | 4 | 3 | 3 | **2.75** | 16 | 11 |
| 17 | `halloumi` | ハルーミ | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 2 | **2.70** | 17 | 16 |

> **読み方の注意.** 加重スコアは「何を先にやるか」の材料であって、そのまま実装順ではない。たとえば `pizza-salad` は 1 位だが、3 つの新材料（cucumber・lettuce・yogurt-sauce）が同時に要り、**matrix にはレタス・きゅうりの投入時機の記載がなく**（tomato-sauce ＋ yogurt-sauce の 2 層とだけ記録）、生で使う食材を焼成前に置くか後に置くかは**私の推論で未確定**（O-7）。均等重みでは 7 位、実装安全重視では 8 位。逆に burrata は全ての重みで 1〜6 位に残り、**重みに対して頑健**。

## 7. 推奨 TOP10

### 7.1 レシピ TOP10（加重スコア順。§6.2 の上位 10 件）

| 順位 | レシピ | 加重 | 主分類 / 証跡 | 一言の根拠 | 先に必要なもの |
|---|---|---|---|---|---|
| 1 | pizza-salad | 3.75 | ③⑤ / READY | 生野菜＋ヨーグルトのまったく別の“見た目”。ただし 3 新材料で、投入時機は未確定 | yogurt-sauce・cucumber・lettuce、投入時機の Owner 判断（O-7） |
| 2 | **burrata-pizza** | 3.60 | ③ / READY | 白い球が主役の完成形。**新要素 1 つ・全重みで頑健** | burrata |
| 3 | piadina-romagnola | 3.60 | ④ / READY | ノンソースの薄い平焼き。Dough Kind の 2 つ目で**20 行が前進** | `DoughKind` の一般化（型は 2 値の閉じた union）、Anti-Oracle の再計算 |
| 4 | **pizza-alla-crudaiola** | 3.55 | ③ / READY | 生トマト＋ルッコラ＋burrata。burrata の 2 例目で具材の見せ場が違う | burrata（#2 の後） |
| 5 | yakiniku-pizza | 3.55 | ④ / READY | 牛を炒める Prep の最初の受益者 | yakiniku-sauce（暗色で bbq と近い）、#697 の完了 |
| 6 | **keema-pizza** | 3.50 | ① / BLOCKED | ひき肉という新しい“粒”の見た目。**既存ソース（curry-ketchup）で出せる** | ground-beef、Owner のソース仮定（O-1）、曖昧語の解決（O-4） |
| 7 | hot-honey-pepperoni | 3.50 | ③ / REVIEW | 艶のある甘辛。honey は 5 行に効く | honey。**焼成前 PAINT なら Stage 2 に前倒し可**、垂らす表現なら #579 待ち（O-5） |
| 8 | calzone（ENCLOSE 系） | 3.50 | ⑥ / BLOCKED | 包む体験は最大の新しさ。**だが構造変更（負荷 1・互換 1）** | ENCLOSE の設計 Gate。**実装安全重視では 16 位** |
| 9 | manakish | 3.35 | ④ / REVIEW | 平焼き第 2 弾。piadina と同じ基盤 | Dough Kind 一般化＋ halloumi・zaatar、原典の不整合（`SOURCE_INCONSISTENCY`） |
| 10 | sfincione | 3.30 | ① / REVIEW | **依存ゼロ**。tomato＋olive-oil の 2 層（出荷済みエンジン） | なし（同点の pesto-burrata より依存が少ないので上位） |

「実行順」の推奨は §8 の Stage 計画に従う（スコア順ではなく依存順）。**ここで飛ばしている候補:** tsukimi（DH4 保留）、bulgogi（13 位。ただし実装安全重視では 1 位。Stage 1 の候補として §8）。

### 7.2 食材 TOP10（加重スコア順）

| 順位 | 食材 | 加重 | 区分 | 根拠 |
|---|---|---|---|---|
| 1 | **burrata** | 3.85 | チーズ | 3 レシピ・全 READY・全重みで 1 位。白い球で完成時の存在感が大きい |
| 2 | **牛ひき肉** | 3.65 | 肉 | 6 行に効き（曖昧語含む）、Prep（炒める）と相性が良い。`beef` とは粒状で区別 |
| 3 | lettuce | 3.45 | 野菜 | サラダ系の核。生のまま使う前提 |
| 4 | デザート系（apple・cinnamon・chocolate ほか） | 3.40 | 新 family | 4 行（apple-cinnamon・nutella・smore・fruit）。**単一食材ではなく群**。新しい棚が必要で負荷 1（Stage 4） |
| 5 | cucumber | 3.35 | 野菜 | pizza-salad と peking-duck |
| 6 | 唐辛子（赤） | 3.30 | 野菜 / 香辛 | 7 行に効くが**曖昧語で `chili-oil` 候補と割れている**（O-4） |
| 7 | honey | 3.30 | ソース（液体） | 5 行に効く。垂らす操作が前提 |
| 8 | french-fries | 3.20 | 野菜 | poutine・lomo-saltado |
| 9 | walnut | 3.10 | other | 4 行。`other` 棚への影響（O-9） |
| 10 | brie | 3.00 | チーズ | 1 行（speck-e-brie、BLOCKED） |

**「新規食材を増やす」だけで終わらせないための所見:** 既存 92 のうち 50 が 1 レシピ専用。新食材は**最低 2 レシピで使える**ものを優先（burrata・ground-beef・lettuce・honey・walnut）。1 行専用のソース（yakiniku・sweet-bean・okonomiyaki…）は、そのレシピを出す時に同時に足す。

## 8. 段階的拡張計画

**原則:** 各 Stage は**独立して遊べる**。Stage をまたぐ依存は「前の Stage が出ていなくても壊れない」形で切る。新規レシピは credited（新材料を持ち、ladder に 1 step 追加）か non-credit（既存材料のみで step を増やさない）かを明示する。**星ゲートは追加しない**（slack=1、§1.3）。新規は全て `lunchRush:false`、CUT なし、窓 58–78、報酬 100（B10 / B11 の運用）を初期案とする。

### Stage 1 — 既存システムで追加できるもの（目安: レシピ 2〜3、新食材 1）

| 項目 | 内容 |
|---|---|
| レシピ | **sfincione**（REVIEW、依存なし）。以降は **Owner の仮定承認が前提**: **bulgogi-pizza**（beef・onion・white-sesame・mozzarella。ソースは soy-sauce を仮定）、**keema-pizza**（ground-beef・onion・mozzarella。ソースは curry-ketchup を仮定、青唐辛子は省くか chili を足すか要判断） |
| 食材 | ground-beef（トッピング、meat。粒状の専用 `pieceVisual` ＋ emoji の G18 一意性）。ソース・チーズは追加なし |
| 必要な工程 | なし（`MULTI_SPREAD_LAYER` は出荷済み）。ground-beef の「炒め」は Prep 側の別件で、**この Stage では未対応でよい**（`PREP_TARGET_INGREDIENT_IDS` は beef のみ。prep は識別に使わない仕様） |
| 依存 Issue / PR | #611（umbrella・B11 の運用）、#561（星ゲート余裕=1）、#623 / #438（アイコン 2.0）。**#697 とは独立**（`src/data/**` を触らない） |
| 想定変更ファイル | `src/data/recipes.ts`・`ingredients.ts`・`recipeSauceProfiles.ts`・`discoveryLadder.ts`（step 追記）・`referencePizza.ts`・`ingredientTaxonomy.ts`（family）・専用 SVG、`catalogLedger.test.ts` と pin 群、golden（`hint5.ladders55.json`＝挿入のみ、`hint5.alphaFamilyOnly.json`＝既存値が動く、DH4 audit JSON は再生成物） |
| テスト計画 | B11 S1 と同じ: `tsc -b`・oxlint・build・全 Vitest（**Pinsa ON / OFF の両方**）・`e2e/b12-s1.spec.ts`（390×844 と 360×800）・Research cohort 文字ドリフト 0（全 prefix ＋ランダム購入順 40 通り）・旧ビルドで新 save を開いて再保存しても新食材 / Dex が落ちない（#674 の前例）・late 床（`LATE_ENTITLEMENT_FLOORS`）が後退しない |
| iPhone Safari HV | ground-beef がトレイで beef・sausage と見分けられるか／配置後 20px 級で粒に見えるか／Shop の NEW 表示 → 購入 → Research ラベルに漏えいなし → 調理 → NEW DISCOVERY → Dex／横スクロールなし |
| リスク | 仮定ソースが原典と違う（暫定表示が必要）。bulgogi / keema は既存の beef・curry 系と**材料が近く“少し変えただけ”に見える**（新しさ軸が 2〜3 点の理由） |
| 完了条件 | 全ゲート GREEN、Owner の実機 HV 判定、`catalogLedger` 更新（recipes 83 / ingredients 93 / ladder 71 前後）。**本番反映は B10 / B11 同様、公開承認とは別** |

### Stage 2 — 新しいソース・チーズ（目安: レシピ 2〜4、新食材 1〜4）

| 項目 | 内容 |
|---|---|
| レシピ | **burrata-pizza**、**pizza-alla-crudaiola**（pesto-burrata は burrata-pizza との差がソースのみで“少し変えただけ”のため見送り推奨。2 つとも tomato＋olive-oil の 2 層で、grandma / sfincione と同じ出荷済みエンジン）。条件付き: **pizza-salad**（O-7）、**hot-honey-pepperoni**（O-5 で PAINT 可の場合。tomato＋honey の 2 層） |
| 食材 | **burrata**（チーズ）。条件付き: yogurt-sauce・cucumber・lettuce（pizza-salad）、honey（hot-honey） |
| ソース / チーズの描画 | burrata は 2 案: **(a) 専用 `pieceVisual` ＋色変化のみ**（feta / ricotta 方式、複雑化なし）／**(b) Cheese Pool の別パラメータ化**（魅力は上がるが `cheesePool.ts` の汎用化が要り別 Gate）。**初回は (a) を推奨**し、(b) は Owner が望む場合に別 Issue |
| 必要な工程 | なし（焼成前に配置） |
| 依存 | #486（Canvas mozzarella、出荷済み）、#421 系 |
| 想定変更ファイル | Stage 1 と同じ ＋ チーズ専用 SVG。`cheesePool.ts` は (a) なら変更なし |
| テスト計画 | Stage 1 ＋ burrata の白が mozzarella Canvas・ricotta・cream-cheese と 20px / グレースケールで識別できること（アイコン比較シートの方式） |
| iPhone HV | トレイで burrata が 4 種の白チーズと見分けられるか／焼成前後で変化が分かるか／完成写真で主役になっているか |
| リスク | 白チーズが 5 種になり識別が悪化（ΔE 実測が必要）。pizza-salad は生野菜の扱いが未確定 |
| 完了条件 | Stage 1 と同じ ＋ 白チーズ識別の HV PASS |

### Stage 3 — 新調理法と連動するもの（**別セッションの設計完了後**）

| 連動先 | 候補 | 状態 |
|---|---|---|
| 「炒める」(Cooking Prep Phase 1、#695 / **#697**) | yakiniku-pizza（＋yakiniku-sauce）、ground-beef の炒め対応、kimchi-pizza | #697 は未 merge・実機 HV 未完了・本番 OFF。**待つ** |
| 後乗せソース（DRIZZLE、#579 / #604 / #611） | teriyaki-chicken（mayo）、buffalo-chicken（buffalo-sauce・blue-cheese-dressing）。honey 系（hot-honey・pesto-noci）は垂らす表現を望む場合のみ | 未設計。FINISH は topping 限定 |
| Dough Kind 第 2 種（#577） | piadina-romagnola、manakish（その後 NY・fathead・cauliflower 等の同材料別生地） | `DoughKind` は 2 値の閉じた union。一般化の設計が要る |
| **別セッションの新調理法**（ソーセージ・ポルチーニの焼く／エビの茹でる／玉ねぎのあめ色炒め／共通基盤） | **172 の未出荷候補で、これらに依存する行は 0** | 下記 §9 |

Stage 3 の完了条件・テスト・HV は、連動先の設計が確定するまで**確定できない**（推測で埋めない）。確定時に各連動先ごとの小 Stage（3a 炒める、3b 後乗せソース、3c 生地）に分ける。

### Stage 4 — 複雑な調理工程・高難度

| 構造 | 該当行 | 備考 |
|---|---|---|
| `ZONED_PLACEMENT` | quattro-stagioni（READY・既存食材のみ） | 4 分割の配置。Reference・採点・識別が円 8 スロット前提で影響大 |
| `STEP_ORDER` | trenton-tomato-pie、chicago-deep-dish | チーズ先・ソース後の逆順。`layerOrder` 識別軸が FIXED_BY_FLOW |
| `ENCLOSE` | calzone・fugazzeta-rellena・scacciata・pizza-a-caballo・chicago-stuffed（5） | 包む体験。最大の新しさだが構造変更 |
| `PAN_BAKE` / `DOUGH_SHAPE_TARGET` | greek・siciliana・detroit・old-forge・montreal・new-england-bar・al-taglio・turkish-pide | Square Dough（#532〜#538）基盤の延長 |
| `FRY_COOK` / `LAMINATE` | pizza-fritta / feteer-meshaltet | 各 1 行 |
| デザート群 | apple-cinnamon・nutella・smore・fruit | 新 family と後乗せ（mid_bake 含む）が絡む |

各構造は**個別の設計 Gate が先**。Stage 4 は「何件出すか」ではなく「どの構造を作る価値があるか」の Owner 判断（O-11）が先で、現時点で計画の粒度に落とさない。

## 9. 新調理法との依存関係

別セッションが検討中の「焼く（ソーセージ・ポルチーニ）」「茹でる（エビ）」「あめ色炒め（玉ねぎ）」「共通基盤」を、**本書では実装・設計していない**。依存として記録する。

1. **172 の未出荷候補でこれらに依存する行は 0。** matrix で `PREP_STEP` を要求する未出荷行は kimchi・yakiniku・lomo-saltado の 3 行で、いずれも「炒める／水切り」（牛・キムチ）。焼く・茹でる・あめ色炒めは**証跡に現れない**。
2. したがってこれらの新調理法は**新レシピを増やすのではなく、出荷済みレシピの体験を変える**:

| 調理法 | 影響する出荷済みレシピ |
|---|---|
| ソーセージを焼く | 8（salsiccia・meat-lovers・brazilian-calabresa・full-english・polish-kielbasa・salsiccia-e-friarielli・spanish-chorizo・boscaiola） |
| ポルチーニを焼く | 2（boscaiola・porcini-pizza） |
| エビを茹でる | 3（pesto-gamberi・pescatore・yuzu-shrimp） |
| 玉ねぎのあめ色炒め | **17**（fugazza・tonno-e-cipolla・pizza-portuguesa・pesto-tonno・brazilian-calabresa・aussie・veggie-supreme・bacalhau・polish-kielbasa・pizza-moscow・spanish-chorizo・flammkuchen・curry-pizza-japan・rendang・tandoori-paneer・bbq-chicken・wasabi-beef） |

3. 現行 Prep の仕様（#697）は**識別・採点・保存に影響しない**（`preparedLook` は transient）。同じ方針が新調理法にも適用されるなら、**これらは新レシピの前提にならず、拡張計画と独立に進められる**。ただし玉ねぎは 17 レシピに効くため、**共通基盤の設計が出るまで、玉ねぎ・ソーセージ・ポルチーニ・エビを使う新レシピを Stage 1〜2 に入れない**（本書の Stage 1〜2 の候補はいずれも該当しない。bulgogi / keema の onion を除く — onion はあめ色炒めが“任意の見た目”である限り影響しない。必須化されるなら要再確認）。
4. 調理法が未完成のため、これらを必要とする**新規レシピ候補は挙げていない**（挙げられるのは出荷済みの強化のみ）。

## 10. PR #697 との競合分析

| 観点 | 結果 |
|---|---|
| 現在の状態 | HEAD `8ba2b5b9…`（既知と一致）、`clean`、50 ファイル。**本書は #697 のブランチにも他セッションのブランチにも触れていない** |
| ファイル重複 | 本書の変更は新規 1 ファイル `docs/design/TETO_RECIPE-INGREDIENT-EXPANSION_FRESH-PLAN_2026-10-29.md` のみ。#697 の docs は `docs/reports/TETO_COOKING-PREP_PHASE1B_*` と仕様書の改訂で**重ならない** |
| 将来の重複（Stage 1〜2） | 想定変更ファイルは `src/data/**` と専用 SVG が中心。#697 の変更は `src/logic/prep/**`・`CookingPrep*`・`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`gameReducer.ts`。**`src/data/**` は重ならない**。HOT の `gameReducer.ts` / `GameScreen.tsx` は Stage 1〜2 で触らない |
| 将来の重複（Stage 3） | ground-beef を Prep 対象にする変更は `src/data/prepIngredients.ts`（PR-A の claim 範囲）と `PREP_TARGET_INGREDIENT_IDS`。**#697 の merge と実機 HV の後**に行う |
| 古い open PR | #478（`GameScreen.tsx`）・#468（`PizzaStage.tsx`）は既に main と競合。#697 本文の記載どおり。拡張 PR は触らない |
| 結論 | **干渉なし**（現時点・計画上）。実装着手時に最新の open PR / claim を再確認する |

## 11. ゲームバランス・保存データのリスク

| 観点 | 調査結果 | 評価 |
|---|---|---|
| 序盤にレシピが増えすぎないか | 新規は全て ladder の**末尾**（第 4 章＝44/70 step）に追記。第 1〜3 章（36 step）は不変 | 序盤は安全。**第 4 章が長くなりすぎる**（現在 63%）。+3〜6 step ごとに章の見直しを |
| 特定食材ばかり使われないか | mozzarella 58/80、tomato 29、onion 17、eggplant 9。50/92 が単独使用 | eggplant・mozzarella のみの変種（caponata・baingan-bharta 等）は**優先しない**。新食材は 2 レシピ以上で使えるものを選ぶ |
| 食材トレイが長くなりすぎないか | 92 食材、vegetable 棚 24。#675（75 食材時の UX 実測）は open のままで、現在は 92 | Stage ごとに **+6 食材以内**を目安にし、vegetable 棚が 30 を超える前に #675 の測定を先行 |
| レシピ推理のヒントが不足しないか | Hint 5.0（サブ分類ラダー）は全サブトッピングに family を要求。B11 では `alphaFamilyOnly` の既存値が動いた（ikura 70→98 等）。DH4 は「その他は到達不能」(OD-DH4-2-9) | 新食材には family が必須。walnut を `other` に入れると DH4 の制約に影響（O-9）。**各 Stage の PR で golden の挿入のみ / 既存値変化を区別して記録** |
| 同時解禁時の表示や報酬 | ladder は REC-04 規則（1 材料 step を先、id 昇順の同点処理）。non-credit は兄弟 step に乗る（B11 の porcini-pizza） | 矛盾なし。**同一 step に 2 レシピを載せる場合は key を明示** |
| Lunch Rush の難易度 | プール 25/80。新規は `lunchRush:false` が既定運用 | 新規を `false` のままなら**難易度は不変**。プールへ入れる判断は別（O-10） |
| 既存セーブからの移行 | schema v2、ladder 追記専用、新食材は ledger に無ければ未所持。late 床（`LATE_ENTITLEMENT_FLOORS`）が通常 step 追加でずれうる | 追記のみなら自然移行。**旧ビルドで新 save を開いて再保存するケース**をテストで固定（#674 の前例）。#668（Dex raw エントリ保持）は**未実装の既存リスク**で、拡張が増やす |
| 星ゲート | slack=1。ゲート追加は検出テストが失敗 | **星ゲートは付けない**。credited は専用 step を持たせる |
| 保存まわりの open Issue | #560 / #617 / #664 / #668（保存保護・pendingRound・Dex raw） | 本書は触れない。拡張の PR は新規 save フィールドを作らない |

## 12. 既存の保留事項との関係

- **tsukimi-pizza**: 唯一の「① かつ READY」だが、DH4 の `その他` 到達不能制約で**実装保留**（OD-B9-8 / OD-B9-12。gate 緩和と egg の family 変更は禁止）。本書は解除を推奨しない。Stage 1 の数を押し上げる誘惑があるが、**Owner の保留判断を維持**。
- **pescatore**: matrix は tomato＋olive-oil、出荷は olive-oil 省略（B11 の Owner 承認例外）。matrix と出荷のずれは「② 出荷との衝突」と同種の扱い。
- **FINISH / 後乗せ**: 出荷済み 8 late レシピは topping 後乗せのみ。ソース・チーズの後乗せ（#579）は未着手。

## 13. Owner 判断が必要な事項

| # | 判断 | 推奨 / 影響 |
|---|---|---|
| **O-1** | 証跡 BLOCKED（特に `BASE_SAUCE_UNSPECIFIED` 31 行）に対し、B10 / B11 と同様の「GAMEPLAY ASSUMPTION」例外を許すか。許す場合のソース仮定（bulgogi=soy-sauce、keema=curry-ketchup）を承認するか | 許さないと Stage 1 は sfincione（1 件）のみ |
| O-2 | Stage 1 の範囲（sfincione のみ／＋bulgogi・keema／＋ground-beef） | 推奨: sfincione ＋ keema ＋ ground-beef（新しい見た目を 1 つ持つ）。bulgogi は“変種”感が強く後回し可 |
| O-3 | 新規レシピの公開方式（通常 ladder 追記／non-credit） | B10 / B11 の方式を踏襲 |
| O-4 | 曖昧語の正規化: 「ひき肉」→ground-beef、「唐辛子」→chili（`chili-oil` と割れている）、「チーズ」→mozzarella か | keema / lahmacun / old-forge 等に効く |
| O-5 | honey は焼成前の PAINT（matrix の 2 層目スプレッド）で出してよいか／垂らす操作（#579）を待つか | 「仕上げの垂らし」は repo 推論で原典未確認。PAINT でよければ hot-honey は Stage 2。待つなら Stage 3 |
| O-6 | burrata の描画: (a) 専用 `pieceVisual`＋色変化のみ／(b) Cheese Pool の汎用化 | 推奨 (a)。(b) は別 Issue |
| O-7 | pizza-salad の生野菜（レタス・きゅうり）の投入時機（matrix に記載なし、焼成前か後かは未確定）と、3 新材料の同時導入を許すか | 未決なら Stage 2 から外す |
| O-8 | 新食材の family: ground-beef=meat、lettuce / cucumber=vegetable、burrata=cheese、yogurt-sauce=sauce（L1 のみの暫定） | B10 / B11 と同様に暫定承認 |
| O-9 | walnut を `other`（egg・almond・pine-nuts）に入れるか、nut 系の新 family にするか。DH4 の OD-DH4-2-9 との整合 | 新 family は影響大。当面 walnut は見送り推奨 |
| O-10 | 新規の Lunch Rush 参加（既定 false のまま維持するか） | 維持推奨 |
| O-11 | Stage 4 のどの構造を作る価値があるか（ZONED・ENCLOSE・STEP_ORDER・デザート） | 現時点では計画しない |
| O-12 | Dough Kind を 2 値から一般化してよいか（piadina / manakish の前提） | Stage 3c の入口 |
| O-13 | Stage 開始の GitHub 運用: 各 Stage の Issue 化と claim（下記案） | 承認前は何も作らない |

### Issue 案（**作成していない**。Owner 承認後に起票）

**案 A: `Expansion Batch 12 S1: sfincione + ground-beef 系（既存システムのみ、本番 OFF 相当の暫定仕様）`**
- 目的: 新調理法に依存しない最小の 1 バッチで、新しい見た目（粒状の ground-beef）と tomato＋olive-oil 2 層の sfincione を追加する。
- 受け入れ条件: §8 Stage 1 の「完了条件」「テスト計画」を満たす／全ゲート GREEN（Pinsa ON/OFF）／`catalogLedger` 更新／星ゲート追加なし／`lunchRush:false`／保存形式不変／Owner の実機 HV 判定。
- 依存: #611（umbrella）、#561（slack=1）、Owner 決定 O-1・O-2・O-4・O-8。#697 には依存しない。

**案 B: `Expansion Batch 12 S2: burrata（新チーズ）+ burrata-pizza / pizza-alla-crudaiola`**
- 目的: 新しいチーズ 1 種で 2 レシピを足す。見た目の魅力を優先。
- 受け入れ条件: §8 Stage 2。白チーズ 5 種の識別 HV、O-6 の方式、pizza-salad は含めない。
- 依存: Owner 決定 O-6・O-8。

**案 C（Stage 3 の入口）: `Expansion 3: 新調理法との連動計画（Prep 炒める・後乗せソース・Dough Kind）`**
- 目的: 連動先の設計完了後に Stage 3 を小 Stage に分割する計画 Issue。実装なし。
- 依存: #697 の merge と実機 HV、別セッションの調理法設計、#579 / #577。

## 14. 検証した内容と限界

- **集計の再計算:** `RECIPES` / `INGREDIENTS` を実行して取得（80 / 92）。matrix JSON を現行 id・材料集合と突き合わせ、71 / 4 / 97 に分けた（§2 の検算が一致）。分類・証跡状態・不足食材は同じスクリプトで機械的に出力し、付録 A に全 97 行を載せた。**スクリプトはリポジトリに入れていない**（docs-only）。再現は matrix JSON ＋ `src/data` の実行で可能。
- **スコア:** 加重和は表の整数から機械計算（手計算ではない）。アンカーは §6.1 に固定。評価値は私の判断で、Owner の見立てと違えば表の整数を差し替えて再計算できる。
- **限界:** (1) matrix の材料集合は“ソース family 由来”を含まない場合があり（例: tomato-sauce 省略）、材料の差分判定は id レベル。(2) ⑤（描画先行）はヒューリスティック。(3) 色差は仮色の CIE76 ΔE で、実描画（焼成後・縮小時）の見え方は未測定。(4) 原典は未確認。(5) コードは実行・テストしていない（実装なし）。(6) 過去の監査値（55/61・122・19・約 21）は定義不明で再現できなかった。

## 付録 A. 未出荷候補 97 件の分類（READY → REVIEW → BLOCKED の順）

分類記号: ①既存のみ ②新食材 ③新ソース/チーズ ④新工程 ⑥再現困難 ／ ⑤ = 描画先行フラグ（③に付与）。

| # | evidence id | 名称 | 分類 | 証跡 | 不足食材（現行に無い） | 必要 capability | blocker |
|---|---|---|---|---|---|---|---|
| 1 | `tsukimi-pizza-pizzadb-p14` | 月見ピザ | ① | READY | — | — | — |
| 2 | `sfincione-pizzadb` | スフィンチョーネ | ① | REVIEW | — | MULTI_SPREAD_LAYER | — |
| 3 | `caponata-pizza-pizzadb-p2` | カポナータピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 4 | `keema-pizza-pizzadb-p2` | キーマピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT |
| 5 | `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 6 | `supreme-pizzadb` | スプリームピザ | ① | BLOCKED | — | — | COMPOSITION_CONFLICT_CANDIDATE |
| 7 | `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 8 | `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 9 | `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | ① | BLOCKED | — | — | MECHANIC_INTERPRETATION |
| 10 | `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 11 | `pizza-baiana` | ピッツァ・バイアーナ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 12 | `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 13 | `bulgogi-pizza-pizzadb-p11` | プルコギピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 14 | `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 15 | `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | ② | BLOCKED | apple, cinnamon, walnut | — | BASE_SAUCE_UNSPECIFIED |
| 16 | `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | ② | BLOCKED | cumin | — | BASE_SAUCE_UNSPECIFIED |
| 17 | `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | ② | BLOCKED | chicken-tikka | — | BASE_SAUCE_UNSPECIFIED |
| 18 | `diavola-pizza-pizzadb-p5` | ディアボラ | ② | BLOCKED | spicy-salami | — | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT |
| 19 | `banh-mi-pizza-pizzadb-p6` | バインミーピザ | ② | BLOCKED | carrot, daikon, liver-pate | — | BASE_SAUCE_UNSPECIFIED |
| 20 | `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | ② | BLOCKED | asparagus | — | MECHANIC_INTERPRETATION |
| 21 | `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | ② | BLOCKED | fennel, orange | — | MECHANIC_INTERPRETATION |
| 22 | `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | ② | BLOCKED | carrot, red-cabbage, sunflower-seeds | — | MECHANIC_INTERPRETATION |
| 23 | `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | ② | BLOCKED | squid | — | COMPOSITION_CONFLICT_CANDIDATE |
| 24 | `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | ② | BLOCKED | cinnamon | — | UNRESOLVED_INGREDIENT |
| 25 | `pizza-salad-pizzadb-p7` | ピザサラダ | ③⑤ | READY | cucumber, lettuce, yogurt-sauce | MULTI_SPREAD_LAYER | — |
| 26 | `pizza-alla-crudaiola-pizzadb-p8` | ピッツァ・アッラ・クルダイオーラ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 27 | `burrata-pizza-pizzadb-p10` | ブラータピザ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 28 | `pesto-noci-pizzadb-p12` | ペストノーチピザ | ③ | READY | honey, walnut | MULTI_SPREAD_LAYER | — |
| 29 | `pesto-burrata-pizzadb-p12` | ペストブラータピザ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 30 | `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | ③ | REVIEW | honey | MULTI_SPREAD_LAYER | — |
| 31 | `peking-duck-pizza` | 北京ダックピザ | ③ | REVIEW | cucumber, peking-duck, sweet-bean-sauce | — | — |
| 32 | `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | ③⑤ | BLOCKED | bonito-flakes, cabbage, mayo, okonomiyaki-sauce | MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT |
| 33 | `potato-mayo-pizza-pizzadb-p3` | じゃがマヨピザ | ③⑤ | BLOCKED | mayo | — | BASE_SAUCE_UNSPECIFIED |
| 34 | `goulash-pizza-pizzadb-p3` | グヤーシュピザ | ③⑤ | BLOCKED | sour-cream | — | BASE_SAUCE_UNSPECIFIED |
| 35 | `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | ③ | BLOCKED | kebab-sauce, lettuce | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT |
| 36 | `speck-e-brie-pizzadb-p4` | スペックエブリー | ③⑤ | BLOCKED | brie, walnut | — | COMPOSITION_CONFLICT_CANDIDATE |
| 37 | `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | ③ | BLOCKED | peanut-sauce | — | UNRESOLVED_INGREDIENT |
| 38 | `taco-pizza-pizzadb` | タコピザ | ③ | BLOCKED | cheddar, ground-beef, lettuce, salsa, tortilla-chips | — | MECHANIC_INTERPRETATION |
| 39 | `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | ③ | BLOCKED | honey | — | BASE_SAUCE_UNSPECIFIED |
| 40 | `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | ③⑤ | BLOCKED | blue-cheese-dressing, cauliflower | — | BASE_SAUCE_UNSPECIFIED |
| 41 | `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | ③⑤ | BLOCKED | ricotta-salata | — | COMPOSITION_CONFLICT_CANDIDATE |
| 42 | `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | ③ | BLOCKED | balsamic-vinegar, radicchio, walnut | MULTI_SPREAD_LAYER | MECHANIC_INTERPRETATION |
| 43 | `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | ③⑤ | BLOCKED | mayo | — | BASE_SAUCE_UNSPECIFIED |
| 44 | `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | ③ | BLOCKED | aji-amarillo | — | BASE_SAUCE_UNSPECIFIED |
| 45 | `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | ③⑤ | BLOCKED | chili-powder, cotija, lime, mayo | — | BASE_SAUCE_UNSPECIFIED |
| 46 | `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | ③ | BLOCKED | honey | — | BASE_SAUCE_UNSPECIFIED |
| 47 | `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | ③ | BLOCKED | chutney | — | BASE_SAUCE_UNSPECIFIED |
| 48 | `mentaiko-mochi-pizza` | 明太子もちピザ | ③⑤ | BLOCKED | mayo, mentaiko, mochi | — | BASE_SAUCE_UNSPECIFIED |
| 49 | `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | ③ | BLOCKED | umeboshi-paste | — | BASE_SAUCE_UNSPECIFIED |
| 50 | `piadina-romagnola-pizzadb-p7` | ピアディーナ・ロマニョーラ | ④ | READY | — | DOUGH_VARIANT | — |
| 51 | `poutine-pizza-pizzadb-p10` | プーティンピザ | ④ | READY | cheese-curd, french-fries, gravy-sauce | DOUGH_VARIANT | — |
| 52 | `yakiniku-pizza` | 焼肉ピザ | ④ | READY | yakiniku-sauce | PREP_STEP | — |
| 53 | `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 54 | `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 55 | `ny-style-pizzadb` | ニューヨークスタイルピザ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 56 | `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 57 | `manakish` | マナキーシュ | ④ | REVIEW | halloumi, zaatar | DOUGH_VARIANT | — |
| 58 | `eel-pizza-pizzadb-p1` | うなぎピザ | ④ | BLOCKED | eel, sansho-pepper | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED, MECHANIC_INTERPRETATION |
| 59 | `kimchi-pizza-pizzadb-p2` | キムチピザ | ④ | BLOCKED | kimchi | PREP_STEP | BASE_SAUCE_UNSPECIFIED |
| 60 | `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | ④ | BLOCKED | — | DOUGH_VARIANT | UNRESOLVED_INGREDIENT |
| 61 | `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | ④ | BLOCKED | — | DOUGH_VARIANT | EVIDENCE_GAP |
| 62 | `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | ④ | BLOCKED | chocolate, graham-cracker, marshmallow | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 63 | `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | ④ | BLOCKED | — | DOUGH_VARIANT | UNRESOLVED_INGREDIENT |
| 64 | `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | ④ | BLOCKED | banana, nutella-spread, powdered-sugar | LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT |
| 65 | `buffalo-chicken-pizzadb` | バッファローチキンピザ | ④ | BLOCKED | blue-cheese-dressing, buffalo-sauce | MULTI_SPREAD_LAYER, LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE |
| 66 | `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | ④ | BLOCKED | — | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED |
| 67 | `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | ④ | BLOCKED | celery | DOUGH_VARIANT | MECHANIC_INTERPRETATION |
| 68 | `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | ④ | BLOCKED | chicory, pecorino | DOUGH_VARIANT | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT |
| 69 | `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | ④ | BLOCKED | puntarelle | DOUGH_VARIANT | MECHANIC_INTERPRETATION |
| 70 | `pizza-de-cancha` | ピッツァ・デ・カンチャ | ④ | BLOCKED | — | DOUGH_VARIANT, MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT |
| 71 | `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | ④ | BLOCKED | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE |
| 72 | `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | ④ | BLOCKED | rock-salt | DOUGH_VARIANT | SCOPE_QUESTION |
| 73 | `fugazzetta-pizzadb-p10` | フガゼッタ | ④ | BLOCKED | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE, DISCOVERY_COLLISION |
| 74 | `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | ④ | BLOCKED | blueberry, kiwi, strawberry | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED |
| 75 | `lahmacun` | ラフマジュン | ④ | BLOCKED | — | DOUGH_VARIANT, MULTI_SPREAD_LAYER | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT |
| 76 | `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | ④ | BLOCKED | french-fries | PREP_STEP, LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 77 | `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | ④ | BLOCKED | mayo | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED, COMPOSITION_CONFLICT_CANDIDATE |
| 78 | `natto-pizza` | 納豆ピザ | ④ | BLOCKED | natto, okra | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 79 | `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | ④ | BLOCKED | truffle | LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE |
| 80 | `quattro-stagioni-pizzadb` | クアトロスタジオーニ | ⑥ | READY | — | ZONED_PLACEMENT | — |
| 81 | `scacciata-ragusana-pizzadb-p4` | スカッチャラグザーナ | ⑥ | READY | caciocavallo | ENCLOSE | — |
| 82 | `pizza-fritta-pizzadb-p9` | ピッツァフリッタ | ⑥ | READY | — | FRY_COOK | — |
| 83 | `fugazzeta-rellena` | フガゼッタ・レジェーナ | ⑥ | READY | — | DOUGH_VARIANT, ENCLOSE | — |
| 84 | `montreal-style-pizza-pizzadb-p13` | モントリオールスタイルピザ | ⑥ | READY | — | DOUGH_VARIANT, PAN_BAKE | — |
| 85 | `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | ⑥ | REVIEW | — | DOUGH_VARIANT, ENCLOSE | — |
| 86 | `trenton-tomato-pie-pizzadb` | トレントントマトパイ | ⑥ | REVIEW | — | STEP_ORDER | — |
| 87 | `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | ⑥ | REVIEW | — | DOUGH_VARIANT, PAN_BAKE | — |
| 88 | `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | ⑥ | REVIEW | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | — |
| 89 | `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT |
| 90 | `calzone-pizzadb` | カルツォーネ | ⑥ | BLOCKED | — | ENCLOSE | COMPOSITION_CONFLICT_CANDIDATE |
| 91 | `greek-style-pizzadb` | グリークスタイルピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| 92 | `chicago-deep-dish-pizzadb` | シカゴディープディッシュ | ⑥ | BLOCKED | — | STEP_ORDER, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| 93 | `siciliana-pizzadb` | シチリアンピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE |
| 94 | `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | ⑥ | BLOCKED | brick-cheese | DOUGH_VARIANT, LATE_ADDITION, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE |
| 95 | `turkish-pide-pizzadb-p5` | トルコピデ | ⑥ | BLOCKED | — | DOUGH_VARIANT, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT |
| 96 | `pizza-a-caballo` | ピッツァ・ア・カバージョ | ⑥ | BLOCKED | — | DOUGH_VARIANT, ENCLOSE | EVIDENCE_GAP |
| 97 | `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | ⑥ | BLOCKED | condensed-milk, honey, melted-butter | MULTI_SPREAD_LAYER, LAMINATE | BASE_SAUCE_UNSPECIFIED, SCOPE_QUESTION, UNRESOLVED_INGREDIENT |

## 付録 B. 用語

- READY / REVIEW / BLOCKED: matrix の `productDecisionStatus`（READY / READY_WITH_REVIEW / BLOCKED_PRODUCT_DECISION）。
- credited: ladder に数えられるレシピ（`ladderCredit` が false でない）。non-credit は兄弟の step に乗り、新 step を増やさない。
- GAMEPLAY ASSUMPTION: 原典未確認のまま Owner が承認した暫定仕様。
- DH4: Discovery Hint 4.0（演繹ヒント）。OD-DH4-2-9 は「その他」家族を到達不能に保つ決定。
