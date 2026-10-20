# TETO 調理法・調理工程の拡張 — Fresh Audit と実装計画（docs-only）

Status: **調査と計画のみ。実装は Owner 承認後。** `src/**`・`e2e/**`・CSS・レシピ／食材データ・テストは変更していない。
この文書の「推奨」は助言であり、Owner Decision ではない。未回答の判断は §9 に列挙し、推測で確定していない。

| 項目 | 値 |
|---|---|
| 監査対象 `main` | `c98d957`（#573 Square Dough D2-a2）。`git fetch origin main` で確認済み |
| 作業ブランチ | `claude/teto-pizza-cooking-expansion-j8rou5`（docs 1 ファイルのみ） |
| 実在レシピ数 | `RECIPE_SAUCE_PROFILES` のキー 60（うち no-sauce 16）。食材 64、`category: "sauce"` は 3（tomato-sauce / olive-oil / pesto） |
| 172 証跡 | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（Issue #188 時点の生成物。**shipped 数は古い**。mechanic の数は有効） |
| 触れていないもの | Square Dough D2-b（焼成オーバーレイ・char・glow・RESULT 仕上げ・サムネイル）、共有 Preview、既存の進行中 PR（#478 / #540 / #574 ほか）、#527 |
| HV | docs-only のため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2「原則不要」） |

> 「D2-b」は Square Dough D2-a2 Result の定義（焼成オーバーレイ等）と解釈した。FINISH D2-2（#518）は別物で、本書は参照するだけで触れない。

---

## 0. 要約

1. **複数ソースはエンジンがすでに対応済み**（B1/B2/S1/S2 が main）。残るのは「どのレシピを足すか」と、グランマ経由の Square Dough 依存だけ。新しい UI 操作は不要。
2. **後乗せ（POST_BAKE）は engine と pure 層まで main にあるが、画面は未接続**（本番では不活性）。**ただし FINISH は topping 専用**で、後乗せのソース・チーズは今の engine で置けない。
3. **新ソース 4 種は、ソース自体の追加は小さい**（食材 1 件＋色＋ladder）。難しいのは使い方で、味噌・タヒニ・柚子は「焼成前に塗る」か「焼成後にかける」かの証跡がなく、判断が要る。
4. **生地の種類（Pinsa / Piadina / Manakish）は新しい識別軸（`dough`）が現状ゼロ**。`dough` は `FIXED_BY_FLOW`。UI の先例として ○/□ 切替（PanSwitch, F4-b）が使えるが、そのまま流用できるのは「生地選択」までで、見た目と採点の設計は新規。
5. **ZONED は対象が証跡で 1〜3 行しかなく、効果が最小で難度は高い**（Reference・採点・識別の 3 点が円 8 スロット前提）。最後でよい。
6. **推奨順:** 複数ソース（内容追加のみ、Square Dough 待ち）→ 生地の種類（データ＋選択 UI）→ 新ソース（焼成前に塗るもの）→ POST_BAKE（#518 と D2-2 の後）→ ZONED。依存関係は §8。

---

## 1. 現状（実コードで確認した事実）

### 1.1 工程と識別の仕組み

| 項目 | 現状 | 根拠 |
|---|---|---|
| 工程の導出 | `deriveCoreSteps(recipe)` が `requiredIngredients` のカテゴリから `DOUGH → SAUCE → CHEESE → TOPPING` を決める。`applicationPhase: "POST_BAKE"` の要件は FINISH を足す（category の工程は足さない） | `src/data/cookingProfiles.ts` |
| タブ上限 | 6（`MAX_VISIBLE_COOKING_TABS`、OD-CS-9(a)）。7 タブが要るレシピは CS-4 が先 | 同上 |
| ソースの profile | `RecipeSauceProfile.ingredientId` は `"tomato-sauce" \| "pesto" \| "olive-oil"` のリテラル union。`interaction` は `PAINT` / `PAINT_TEMPORARY` のみ。`null` = no-sauce | `src/data/recipeSauceProfiles.ts` |
| ソースの操作 | すべて同一の field-based paint。olive-oil の DRIZZLE は TODO コメントのまま | 同上 |
| 識別 11 軸 | `dough` `pan` `layerOrder` `zones` `late` `prep` `enclosure` `shape` `cook` `laminate` `spreadLayers`。**OBSERVED は `pan` だけ**（F1）。`dough` / `layerOrder` / `late` / `prep` / `enclosure` / `cook` / `laminate` / `spreadLayers` は `FIXED_BY_FLOW`、`zones` / `shape` は `UNAVAILABLE` | `src/logic/discovery/signature.ts` |
| 技法 | `TechniqueId = "no-sauce" \| "tray"` の 2 つ | `src/data/techniques.ts` |
| 生地の選択 | ○/□ 切替 `SELECT_PAN`（F4-b）。表示条件は PREPARE ∧ DOUGH ∧ Free Cooking/Research ∧ 導出 affordance 開 ∧ レシピ自身が四角でない | `docs/reports/TETO_SQUARE-DOUGH_F4b_Dough-Selection-UI_Result.md` |
| 配置 | `PLACE_TOPPING` は tap（自動位置）とトレイからのドラッグ（`pieceDrag.ts`）。座標は dough-percent。`findOpenSpot` が重なりを押し出す（`MIN_TOPPING_DISTANCE` = 9） | `src/state/gameReducer.ts:1017` |
| 採点と位置 | Scoring 2.0 の Pieces 成分は Reference の `positions`（円 8 スロット `PIECE_RING_POSITIONS` が基準）と照合。**識別は presence-only で位置を使わない** | `src/logic/pizzaReferenceLayout.ts`, `signature.ts` doc |

### 1.2 後乗せ（FINISH）の到達点

| 層 | 状態 |
|---|---|
| D1a/D1b（pure 層・reducer・在庫・Undo・失敗時スキップ） | main。fixture のみで検証。`RECIPES` に後乗せ要件は 0 件（テストで固定） |
| D2-0 / D2-1（選択・描画の seam、`PostBakePiece`） | main。本番プロファイルに FINISH を含めない見張り `finishD2Inert.test.ts` が有効 |
| D2-2（FINISH を画面に出す） | **#518 が必須前提**（`.pizza-dough` の焼成 `filter` が後乗せ piece にかかる問題。案 A: D2-2 の前に分離）。未着手 |
| `PLACE_TOPPING` の FINISH 時 | **`placingIngredient.category !== "topping"` なら拒否**。後乗せのソース・チーズは置けない |
| Owner 決定済み | OD-CS-3=A（要件側 `applicationPhase`）、OD-CS-11=A（既存 Pieces/Recipe で採点）、OD-CS-7=A（焼成失敗時は FINISH スキップ）、UD-E（後乗せレシピのみ表示）、UD-B（Free は常設タブ）、UD-I（Dinner / Lunch Rush は当面除外）、最初の対象は BBQ チキン、タップ操作を先に実装（#478 非依存） |
| 未決 | OD-CS-12..19、UD-D / F / G（有効化 P4a/P4b の前） |

### 1.3 複数ソースの到達点

main に入っているもの: B1（種類別 ledger、追記式 `sauceDeposits`）、B2（run 単位の重ね塗り描画）、S1（#524: 油の重なり係数）、S2（#525: `buildHintLine` が全ソース要件を見る）、`multiSauce.guards.test.ts`（合成 2 ソースレシピのガード）。
未実装は S3（グランマピザ）だけで、**Owner 決定により Square Dough（#532）の A〜D・F 完了後**。丸い grandma-pizza の先行公開は禁止（#540 は Draft HOLD のまま）。

---

## 2. 新ソース（Flammkuchen / 味噌 / タヒニ / 柚子）

### 2.1 172 証跡での使われ方

| 候補 | 証跡 id | 食材欄（matrix の canonical） | 生地 | matrix 状態 |
|---|---|---|---|---|
| Flammkuchen（タルトフランベ） | `flammkuchen-pizzadb` | bacon, **fromage-blanc-sauce**, onion | 記録なし | READY（blocker 0） |
| 味噌 | `eggplant-dengaku-pizza-pizzadb-p6`（ナス田楽ピザ） | eggplant, **miso-sauce**, mozzarella, white-sesame | thin | READY |
| タヒニ | `eggplant-tahini-pizza-pizzadb-p5` | eggplant, parsley, pomegranate, **tahini** | thin | READY |
| 柚子 | `yuzu-shrimp-pizza`（柚子えびピザ） | mozzarella, shiso, shrimp, **yuzu-kosho** | thin | READY |

4 件とも、ソース候補は食材欄に明記されている（matrix 上 `sauceBase.status = listed`、未解決 token 0、blocker 0）。
マスタ（`ingredient_master_catalog.json` / `pizza_master_catalog.json`）と `src/data/ingredients.ts` には **4 つとも未収録**なので、食材の新規追加が要る（fromage-blanc-sauce / miso-sauce / tahini / yuzu-kosho は matrix 側の canonical 候補 id で、本番 id ではない）。
注意: 「柚子」は食材欄では**柚子胡椒**（`yuzu-kosho`）であり、柚子果汁ではない。tahini と yuzu-kosho は sauce 扱いか topping 扱いかも証跡に無い（matrix は `sauceFamily` からソース層を導出している）。

### 2.2 既存実装で可能な範囲

- ソース食材を足す作業は **データのみ**で足りる見込み: `ingredients.ts` に `category: "sauce"` ＋ `placement: "spread"` ＋ 色、`RECIPE_SAUCE_PROFILES` に `PAINT`、ladder に追記、アイコン。reducer（`COMMIT_SAUCE_DISPENSE` は `category === "sauce"` で判定）、完成判定、Research rows、在庫、Hint 5.0 SAUCE rung は種類に依存しない（Multi-Sauce Audit §3 で確認済み）。
- 描画は run ごとに `colorOf(ingredientId)` で色を引く。**ただし olive-oil だけ特別扱い**（`bakeOilHex`、`SAUCE_OIL_OVERLAP_ALPHA_FACTOR`、CSS の `--oil` フィルタ）が散在している。新しい透明系・油系のソースを足すなら同じ種類の特例が増える。

### 2.3 新規 UI 操作の必要性

| ソース | 焼成前に塗る | 焼成後にかける |
|---|---|---|
| トマト系の延長（Flammkuchen の白いベース、味噌ダレ） | **不要**（既存 PAINT） | — |
| タヒニ・柚子 | 不要 | **FINISH が topping 専用なので、今の engine では置けない**。ソースの後乗せは新規（`PLACE_TOPPING` の category 制限、描画、DRIZZLE 操作） |

### 2.4 reducer・scoring・schema への影響

| 層 | 影響 |
|---|---|
| `Ingredient`（schema） | 追加のみ。新フィールド不要 |
| `RecipeSauceProfile` | `ingredientId` の literal union を拡張（型の変更。`satisfies Record<RecipeId, …>` で全レシピが再検査される） |
| reducer | 焼成前に塗るなら無変更。後乗せソースは `PLACE_TOPPING` の FINISH 分岐とストック関数（`canPlacePostBakeIngredient`）の拡張が必要 |
| Scoring 2.0 | 主ソースは Reference の amount/coverage、副ソースは presence（Owner 方針）。`computeMechanicalSauceReference` が主ソースから導出するので、新ソースが**主**になる場合は Reference の承認済みターゲット（`isApprovedSauceTarget`）の再確認が必要 |
| Discovery / Hint | `sauceBase` は配列の完全一致で変更不要。DH4 privacy gate・Hint 5.0 gate・件数固定テスト・golden が増加に応じて更新対象（Multi-Sauce の許可リスト方式に倣う） |
| 経済 | ladder は追記専用・順序固定。ladder 末尾は着手時に再確認（Expansion Batch 8 / #527 が同じ領域） |

### 2.5 操作方法の候補

- **A（推奨）: 既存 PAINT。** 焼成前に塗る。味噌ダレ、Flammkuchen のベース、タヒニがここに入る。追加操作なし。
- B: PAINT_TEMPORARY（焼成で色が変わる油系）。油系の薄い塗りの表現が必要なら。
- C: DRIZZLE（線状にかける）。olive-oil の TODO と同根。**新ジェスチャーなので別 Issue**にして POST_BAKE と同時に設計するのが妥当。

### 2.6 難易度と依存

| 項目 | 難易度 | 依存 |
|---|---|---|
| 焼成前の PAINT ソース 1 種＋対象レシピ 1 件 | **小〜中**（内容追加。食材アイコン 2.0 の運用に従う） | 新食材の sauce/topping 区分の Owner 判断（§2.7）、ladder 末尾の確認、#527 との調整 |
| 後乗せソース（タヒニ・柚子胡椒の仕上げ） | **大** | #518 → FINISH D2-2 →「FINISH のソース対応」（新規）。Multi-Sauce Audit の Owner 判断 9 が「FINISH が液体に対応するまで保留」を示唆 |

### 2.7 Owner 判断が要ること（本書では決めない）

1. 4 つのソースを「焼成前に塗る」扱いにしてよいか（証跡に timing の記録なし）。
2. 柚子は証跡どおり柚子胡椒（`yuzu-kosho`）でよいか。fromage-blanc-sauce / miso-sauce / tahini / yuzu-kosho を sauce と topping のどちらにするか。
3. （参考）matrix の他の BASE_SAUCE_UNSPECIFIED 33 行（汎用 family のみで具体ソース無し）は今回の 4 件とは別で、本書では扱わない。
4. 新ソース導入の件数と ladder の位置。

---

## 3. 生地の種類（Pinsa / Piadina / Manakish）

### 3.1 証跡

| 生地 | 証跡 id | doughStyle（証跡原文） | 分類 | 備考 |
|---|---|---|---|---|
| Pinsa | `pinsa-romana-pizzadb-p9` | 小麦・米・大豆をブレンドした長時間発酵生地 | `material-multigrain-long-ferment` | トマトソース。**ジャモンセラーノ（jamon-serrano）と食材集合が衝突**し、生地だけが違い（P0-COLL-4） |
| Piadina | `piadina-romagnola-pizzadb-p7` | 薄い無発酵の平焼き生地 | `flatbread-unleavened` | ノンソース |
| Manakish | `manakish` | ピタパンに似た柔らかいフラットブレッド | `flatbread-pita-soft` | オリーブオイル。source inconsistency の review item あり |

matrix 全体では `DOUGH_VARIANT` を必須とする行が **33**（単独で解放できる行が 20）。非構造的で、matrix の推奨順の 1 位。

### 3.2 既存実装で可能な範囲

- **識別軸の `dough` は全レシピで `"standard"` 固定（`FIXED_BY_FLOW`）。** 生地の種類を識別に使うには、`OBSERVED` 化（`pan` が F1 でやったのと同じ手順）が必要。
- 生地そのものの物理は D3A（`doughShape` の 8 点放射配列）で、種類ごとのパラメータ（厚み・伸び・耳）は無い。
- **形状は丸のまま使える。** Piadina / Manakish も丸い平焼きなので、Square Dough の形状基盤は不要（pide / Detroit 等の非円形は別枠）。

### 3.3 新規 UI 操作の必要性

最小構成は **生地の選択（どの生地を使うか）だけ**で、伸ばす操作は既存 D3A をそのまま使う。選択 UI の先例は ○/□ 切替（`PanSwitch`、DOUGH 工程のみ、DOUGH を出ると固定、「やり直す」で破棄、非永続）。

### 3.4 reducer・scoring・schema への影響

| 層 | 影響 |
|---|---|
| `PizzaState` | `pan?` と同形の任意フィールド（例: `dough?`）。**非永続、save スキーマ変更なし**の方針を踏襲できる |
| `Recipe` | `panShape?` と同形の任意フィールド（例: `doughKind?`）。省略 = 標準。**既存レシピ identity を変えない** |
| 識別 | `signature.ts` の `dough` を OBSERVED へ。matcher は「対象が非既定値なら一致」の規則が既にあるので、**既存 target は変わらない** |
| Technique | `pan: "tray"` は Technique 化された（発見は how）。生地の種類を Technique にするか、素材の差として Recipe 側に置くかは**Owner 判断**。matrix は「合成・フラットブレッドの別は識別するが、プレイヤーのジェスチャーは変わらない」と記録 |
| 採点 | 生地種類ごとの目標形状・厚みを採点に入れるかは別問題。**最初は識別のみで採点は変えない**のが安全（Scoring 2.0 authority・ranking 互換を守る） |
| 経済 | 生地の種類を「所持品」にするか（食材扱い）、無料の選択にするか。ladder / Shop / 在庫に影響するので Owner 判断 |
| Hint / Anti-Oracle | 生地選択の UI が出ること自体が識別情報になりうる（PanSwitch は affordance 導出・Guided 非表示で対応）。同じ扱いが要る。DH4 sweep の `GATE_STATES` に dough の状態を足して再実行 |

### 3.5 操作方法の候補

- **A（推奨）: DOUGH 工程の選択チップ**（PanSwitch の拡張。表示条件を affordance で導出、Guided では出さない）。
- B: 生地を「食材」として扱い、トレイから選ぶ（所持品・ladder と自然に繋がるが、PREPARE のトレイに新カテゴリが増える）。
- C: レシピ指定のみ（Guided では選ばせず、Research / Free Cooking だけで選べる）。識別の漏洩は最小だが、発見のきっかけが弱い。

### 3.6 難易度と依存

| 項目 | 難易度 | 依存 |
|---|---|---|
| `dough` 軸の OBSERVED 化＋選択 UI＋3 レシピ追加 | **中** | F4-b の `PanSwitch` / `effectivePan` の再利用（main）。Pinsa のみ jamon-serrano との衝突解消が目的なので先に入れる価値が高い |
| Piadina の「ノンソース」 | 小 | TQ-1D（no-sauce）済み。ただし Technique との組み合わせは Anti-Oracle の再計算が必要 |
| 生地ごとの見た目・採点 | 大（任意） | D2-b（焼成見た目）が終わってから。**本書では扱わない** |

---

## 4. 焼成後トッピング（POST_BAKE / FINISH）

### 4.1 証跡

matrix の `LATE_ADDITION` 必須は **12 行**（mode: post_bake 8 / mid_bake 3 / 未解決 1）。うち FINISH だけで足りるのは post_bake（BBQ チキン、スモア、わさび牛、ヌテラ、黒トリュフ、バッファロー、デトロイト、照り焼き）。**mid_bake（納豆・たらこ・フライドポテト）は「焼成途中」で、FINISH とは別の工程**（matrix は mode 違いとして同一 capability に束ねたが、再焼成が必要）。

### 4.2 既存実装で可能な範囲

- 可能: **topping 種別の後乗せ**（BBQ チキンのパクチー、わさび、パウダーシュガーなど）。engine は main、UI は未接続。
- 不可: **ソース・チーズの後乗せ**（`PLACE_TOPPING` が FINISH では topping のみ許可）。バッファローソース、ドレッシング、マヨ、はちみつ、タヒニ、柚子はここに入る。
- 不可: **mid_bake**。

### 4.3 新規 UI 操作の必要性

| 区分 | 操作 |
|---|---|
| topping の後乗せ | **新規 UI は FINISH タブ 1 つ**（D2-1/D2-2）。操作は既存のタップ配置（Owner 決定: タップ先行、#478 非依存） |
| 後乗せのソース | 新規（DRIZZLE か、タップ配置の拡張）。§2 のとおり別 Issue |
| FREE の常設タブ | UD-B で決定済み（6 タブ、P4b まで本番無効） |

### 4.4 reducer・scoring・schema への影響

| 層 | 影響 |
|---|---|
| Recipe schema | `applicationPhase?: "POST_BAKE"` は main に存在。変更不要 |
| reducer | D1b 済み。ソース後乗せには `PLACE_TOPPING` の category 制限緩和＋在庫関数の拡張＋ `sauceIds` との関係整理が必要 |
| Scoring | OD-CS-11=A（既存 Pieces / Recipe 成分、配点・ruleset 不変）。**#495**（POST_BAKE 要件を除いた暫定スコアの評価）が未決 |
| 描画 | **#518（焼成フィルター分離）が D2-2 の必須前提**。raw / perfect / burnt の 3 状態で検証 |
| 識別 | `late` 軸は `FIXED_BY_FLOW`。OBSERVED 化は P4b |
| 失敗 | OD-CS-7=A（焼成失敗時は FINISH スキップ） |
| 除外 | Dinner / Lunch Rush は当面除外（UD-I） |

### 4.5 操作方法の候補

- A（決定済み）: FINISH タブでのタップ配置。
- B: 仕上げソースの「かける」（DRIZZLE）。新ジェスチャー、別 Issue。
- C: mid_bake は「焼成中に具材を追加」。BAKE 画面に新操作が要り、焼成 3 秒の制約と衝突する。別設計。

### 4.6 難易度と依存

| 項目 | 難易度 | 依存 |
|---|---|---|
| FINISH 画面（topping のみ） | **中〜大**（HV 必須） | #518 → D2-2 → UD-D/F/G の回答 → P4b（有効化は TQ-2） |
| ソースの後乗せ | **大** | 上記 ＋ ソース後乗せ設計（新規） |
| mid_bake | **大** | 未設計。本書の範囲外とする |

---

## 5. 複数ソース（MULTI_SAUCE）

### 5.1 証跡

matrix の `MULTI_SPREAD_LAYER` 必須は **17 行**（候補のみ 10）。**独立した 2 種の土台ソース（トマト＋ペスト等）を示す行は 0**。大半は「土台＋オリーブオイル／はちみつ／マヨ／ドレッシング」。

### 5.2 既存実装で可能な範囲

**ほぼ全部が main にある**（§1.3）。2 ソースの塗り分け、完成判定（主ソースは量、副ソースは使用の有無）、ヒント、発見、Research、在庫が動く。実在レシピに 2 ソース要件があるものは 0。

### 5.3 新規 UI 操作の必要性

**不要。** 既存の SAUCE 工程で 2 種を順に塗る。Hint 5.0 の SAUCE 段は両ソースを示す（OD-544-3 で `grandma-pizza` に限定して承認）。

### 5.4 reducer・scoring・schema への影響

| 層 | 影響 |
|---|---|
| reducer / scoring / schema | **無変更** |
| データ | `recipes.ts` に行、`recipeSauceProfiles.ts` に主ソースの profile |
| ゲート | DH4 / Hint 5.0 の許可リスト（`PAN_TRAY_RECIPE_IDS` の共有定数化＝OD-544-1）、件数固定テスト、golden 再生成、marinara の A/B 表示変更（OD-544-6）、Anti-Oracle §15 の再計算（OD-544-8、E の Final Gate 前に必須・未実施） |

### 5.5 操作方法

既存の PAINT（主ソース）と PAINT_TEMPORARY（油）。DRIZZLE への置き換えは §2.5 と同じ別件。

### 5.6 難易度と依存

| 項目 | 難易度 | 依存 |
|---|---|---|
| グランマピザ（S3 = E） | **中**（ゲート・テスト更新が主） | **Square Dough B → C → D、F（F4 を含む）の完了**、Design Lock §8-1（pizzadb.jp 原典確認、**未完了で E をブロック**）、F4（#538）の OD-544-7（G2 共通文言の timing parity） |
| スフィンチョーネ | 小〜中 | Owner が「根拠確認まで保留」。異種 2 ソースは後続課題 |
| ペスト＋油系（ペストブラータ、ペストノーチ等） | 小〜中 | burrata / honey / walnut のアイコン作業（#503 後）。はちみつは新しい sauce 級食材 |

**本書の結論: 複数ソースで新規に決めることはほぼ無い。Owner 側の未決（原典確認）と Square Dough の完了待ち。**

---

## 6. エリア別の具材配置（ZONED）

### 6.1 証跡

matrix の `ZONED_PLACEMENT` 必須は **1 行**（`quattro-stagioni-pizzadb` の quadrant）。候補のみが 2 行（`capricciosa` / `bismarck` の「卵を中央」、repo inference で BLOCKED_PRODUCT_DECISION）。**最も対象が少ない capability**。

### 6.2 既存実装で可能な範囲

- 位置は dough-percent 座標で保存され、タップ・ドラッグで自由に置ける。**「クアトロスタジオーニの 4 区画に 1 種ずつ」を人が作ることはできる**が、ゲームはそれを識別も採点もしない。
- 識別の `zones` 軸は `UNAVAILABLE`（「位置はあるが zone 分類の規則がない」）。matcher は非既定値の target を一致させない。
- Reference は円 8 スロットのリング前提（`PIECE_RING_POSITIONS`）。区画ごとの Reference は無い。

### 6.3 新規 UI 操作の必要性

| 案 | 内容 | 新規 UI |
|---|---|---|
| A（推奨・最小） | **操作は変えず、判定だけ追加**: 既存の配置位置から zone（四分割・中央）を分類し、`zones` 軸を OBSERVED 化 | **不要**（Reference の見せ方だけ新規） |
| B | 区画ガイド（グリッド・境界線）を TOPPING 工程で見せる | 新規。ただし**ガイドが識別情報を漏らす**ため、Guided と Research で出し分けの方針が要る |
| C | 区画ごとの食材選択（区画をタップ → 食材を選ぶ） | 新規。トレイの操作モデルが変わる。優先度低 |

### 6.4 reducer・scoring・schema への影響

| 層 | 影響 |
|---|---|
| reducer | 無変更で済む（A 案）。配置は既に座標を持つ |
| 識別 | `zones` の分類関数（pure）と、**どの程度ずれたら別区画とみなすか**の閾値規則が新規。presence-only の識別原則（位置・個数は identity ではない）の**例外**になるので Owner 判断 |
| Scoring | 区画ごとの Reference と照合する新 Pieces 評価が必要（現行は円 8 スロット）。配点・ruleset 互換との整合が要る |
| Reference / サムネ | 見本の描画（プレイヤー参照、サムネイル、Pizza Select）が区画対応になる。`pizzaReferenceLayout.ts` の 8 スロット前提を壊さないこと（byte-identical を維持する既存方針） |
| 四角天板 | Square Dough の `PanGeometry` とも整合する必要（`contains` / `findOpenSpotOnPan`） |

### 6.5 難易度と依存

**中〜大。効果が最小。** 依存: `pan` / `dough` 軸と同じ手順での識別軸 OBSERVED 化、Reference と採点の拡張。他の 4 項目のどれにも依存されない。**最後でよい。**

---

## 7. 操作統一（ドラッグ）の扱い

Owner 方針: 食材ごとに操作を変えるのは許容。ドラッグの全面統一は低優先度。

- #478（全 scatter 材料のトレイドラッグ統一、Draft、実機 HV 前）は **FINISH の必須条件ではない**（Owner 決定 2026-10-16）。本書の計画も #478 に依存させない。
- 上の 5 項目で**新規ジェスチャーが要るのは DRIZZLE（ソースの仕上げ）と mid_bake だけ**。残りは既存のタップ、ドラッグ、PAINT、選択チップで足りる。
- 食材別操作（PLACE / SCATTER / SLICE / DRIZZLE）の整理は #476 の領域。**本書は #476 / #478 に触れない。** DRIZZLE を作る時点で #476 の Owner Decision Gate に載せる。

---

## 8. 推奨実装順と依存関係

| 順 | 項目 | 何をするか | 難易度 | 先に必要なもの | 新規 UI | HV |
|---|---|---|---|---|---|---|
| 0 | （待ち） | Square Dough B・C・D・F、pizzadb.jp 原典確認（Owner 側）。**本書では進めない** | — | — | — | — |
| 1 | 複数ソース: グランマピザ（S3 = E） | データ追加＋ゲート更新。エンジンは完成済み | 中 | 順 0、Design Lock §8-1、OD-544-1/2/6/8 | なし | あり |
| 2 | 生地の種類: `dough` 軸の OBSERVED 化＋選択チップ＋Pinsa | `PanSwitch` の流用、jamon-serrano との衝突解消 | 中 | F4-b の `effectivePan` 系（main） | 選択チップ | あり |
| 3 | 生地の種類: Piadina / Manakish | データ追加。Piadina は no-sauce と組み合わせる | 小〜中 | 順 2、Anti-Oracle の再計算 | なし | 軽微 |
| 4 | 新ソース（焼成前に塗るもの）: 味噌ダレ、Flammkuchen のベース、タヒニ | 食材＋ladder＋レシピ。Owner の timing 判断を先に | 小〜中 | §2.7 の判断、ladder 末尾の確認、#527 との調整 | なし | あり |
| 5 | POST_BAKE（topping のみ）: BBQ チキン | #518 → D2-2 → TQ-2 の P4a/P4b | 中〜大 | #518、UD-D/F/G、`finishD2Inert` の解除条件 | FINISH タブ | **必須** |
| 6 | ソースの後乗せ（タヒニ・柚子胡椒の仕上げ、DRIZZLE） | FINISH のソース対応と新ジェスチャー | 大 | 順 5、#476 の Decision Gate | DRIZZLE | 必須 |
| 7 | ZONED | `zones` 軸の OBSERVED 化＋区画 Reference | 中〜大 | 順 2 の手順の知見 | A 案はなし | あり |
| — | mid_bake | 範囲外。別設計 | 大 | — | 焼成中の操作 | — |

**この順の理由:**

- 1 は**コードの変更が最も少ない**が、Owner と Square Dough の待ちが長い。待っている間に 2〜4 を進められる。
- 2 は 33 行を動かし、**既存の衝突（jamon-serrano / pinsa）を実際に解消**できる唯一の項目。先例（F1 / F4-b）があり、手順が確立している。
- 4 は新規 UI がなく単体で価値が出る。ただし timing の Owner 判断が前提。
- 5 は engine 済みだが、**#518 の解消と 3 つの未決（UD-D/F/G）が前提**で、有効化は TQ-2。
- 6・7 は新規ジェスチャーか新規採点が要る。対象行が少ない。

**競合の注意:** `App.css` / `GameScreen.tsx` / `recipes.ts` / `gameReducer.ts` / `persistence.ts` は hot file（`scripts/ops/hot-files.json`）。着手時は `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` の claim を投稿し、#478 / #540 / #574 / 進行中の Square Dough PR との重複を確認する。

---

## 9. Owner 判断が必要な事項（未回答のまま）

| # | 判断 | 関係項目 |
|---|---|---|
| Q1 | 新ソース（味噌・タヒニ・柚子・Flammkuchen のベース）を「焼成前に塗る」扱いにしてよいか。証跡に timing の記録がない | §2 |
| Q2 | 柚子は柚子胡椒でよいか。4 つの新食材を sauce と topping のどちらにするか | §2 |
| Q3 | 生地の種類は Technique（how）か、素材の差（what）か。無料の選択か、所持品か | §3 |
| Q4 | 生地の種類は識別のみで、見た目・採点は D2-b の後に回してよいか | §3 |
| Q5 | ソースの後乗せ（DRIZZLE）を FINISH の範囲に入れるか、別 Issue にするか | §2 / §4 / §7 |
| Q6 | ZONED を実装するか。presence-only 識別の例外（位置を identity にする）を許すか | §6 |
| Q7 | 実装を開始してよいか、どの項目からか（本書の推奨順で承認するか） | §8 |
| 既存の未決 | Design Lock §8-1（pizzadb.jp 原典確認）、OD-CS-12..19、UD-D / F / G、#495 | — |

---

## 10. 次のアクション（承認待ち）

1. この docs を Owner が確認し、Q1〜Q7 に回答する。
2. 回答後、項目ごとに専用 Issue ／ PR を分けて起票する（重複 Issue は作らない。既存の #521 / #294 / #476 / #527 に紐づける）。
3. 実装開始は Owner 承認後。それまで、既存の進行中 PR、共有 Preview、Square Dough D2-b には触れない。

## 11. 参照

- `docs/PROJECT_HANDOFF.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
- `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` ／ `…_ROWS.md` ／ `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（JSON が正）
- `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`、`docs/design/TETO_COOKING-STEPS-2.0_AUTHORITY-INDEX.md`
- `docs/decisions/TETO_COOKING-STEPS-2.0_FINISH-ENGINE_OWNER-DECISIONS.md`、`docs/decisions/TETO_FINISH-D2_OWNER-DECISION-TABLE.md`
- `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`、`docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`
- `docs/reports/TETO_MULTI-SAUCE-RECIPES_Fresh-Audit-and-Plan.md` ／ `…_Design-Lock.md`、`docs/reports/TETO_SQUARE-DOUGH_*`（Design Lock Addendum、F4b Result 等）
- Issue: #294、#465、#476、#478（PR）、#495、#518、#521、#527、#532、#538
