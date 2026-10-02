# Discovery 3.0 Step 14 — Grandma Pizza Multi-Spread Decision Audit（DECISION SUPPORT / DOCS ONLY）

**種別:** 判断材料のみ。production code / recipe / ingredient / ladder / save schema は未変更。Issue / PR 未作成。**No.28 は確定しない。Grandma は採用しない。ランキング・点数付け・推奨なし。** R6 / IP-2 へは進まない。

| 項目 | 値 |
|---|---|
| audited `origin/main` | `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（fresh fetch で一致） |
| 参照（read-only） | First C-Step Shortlist `7df9419`（`claude/discovery-3-first-c-step-shortlist-j4a3th`）／Branch Placement Audit `db956ee`（`claude/discovery-3-branch-placement-audit-07ck26`） |
| 再利用した既存 authority | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行 matrix）、`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`（source audit）。**172 件の再監査・新規 web/source 調査はしていない** |
| 再実行したもの | なし（production 述語・テスト・build は未実行）。以下の production 記述は `origin/main` のソース読み取りのみ。件数は matrix JSON と `src/` の静的集計 |
| companion data | `docs/reports/data/TETO_DISCOVERY-3_GRANDMA-MULTI-SPREAD_DECISION-AUDIT.json` |

件数は全て **audit 内部値**。player-facing に candidate 数を出す提案ではない（#345 契約維持）。

## 0. Provisional direction との整合

OD-FIRST-C-STEP（Step 14 を第一実装候補として検討）と矛盾する既存 authority は見つからなかった。ただし C 案の検討（§6）に効く事実が 1 つある: **Step 14 の candidate 3 件（grandma / marinara-pizza-p13 / pizza-de-cancha）は 3 件とも 172 matrix 上 `MULTI_SPREAD_LAYER` を要求する**。Step 14 で multi-spread を使わない既存 candidate は無い。

---

## 1. STEP 1 — Source authority（Grandma Pizza）

172 matrix の `grandma-pizza-pizzadb` 行と master evidence の `recipeRows[10]` のみ使用。

### 1.1 source が述べていること（SOURCE FACT）

| 項目 | 値 | 出典 |
|---|---|---|
| 名称 | グランマピザ | master evidence |
| ingredientsCanonical | tomato-sauce, mozzarella, garlic, olive-oil（4 件、全て既存 30 材料、新規材料 0、unresolved 0） | `evidenceOrigin: comparison_table_sample`、`sourceUrl: pizzadb.jp/compare/world-pizzas/`（page 3）、`corroborationCount: 1` |
| sauceFamily | トマトソース | 同上 |
| mechanicIdentityNote / requiresMechanicIdentity | `baseline` / `false` | 同上 |
| evidenceStrength（matrix） | STRONG、blockers なし、productDecisionStatus = READY | matrix |
| 衝突 | production 27 recipe と equal / subset / superset の関係なし。matrix の collision ledger にも出ない | matrix + `src/data/recipes.ts` の集合比較 |

### 1.2 source が述べていないこと（matrix が補った値 = REPO DERIVATION）

| 項目 | matrix の値 | 実際の根拠 |
|---|---|---|
| sauce / base | `baseIngredientId: tomato-sauce`、`status: listed` | **sauceFamily ラベル「トマトソース」からの導出**（`rule: family label names the existing tomato-sauce`）。source が「base はこれ」と書いたわけではない |
| olive-oil | `spreadLayers: [olive-oil, tomato-sauce]`、`spreadLayerCount: 2` | **repo 側 taxonomy**（`spreadLayerIngredientIds` の 31 id に olive-oil / tomato-sauce が含まれる）を ingredient list に当てた結果。`mechanicEvidence.strength = source_ingredient_field`（= ingredient 欄由来）。**olive-oil が「塗る層」か「垂らす」か「生地に刷く」か、tomato-sauce との順序・量は source に無い**。`[olive-oil, tomato-sauce]` の並びは list 順で、層順の主張ではない |
| MULTI_SPREAD_LAYER の gesture | matrix の `mergeRationale`: 「evidence は gesture を区別しない」 | matrix 自身が gesture 未決を明記。production の `recipeSauceProfiles.ts` は olive-oil を `PAINT_TEMPORARY` とし、`TODO: olive-oil -> DRIZZLE candidate`・「true DRIZZLE は later interaction family」と記す |
| layerOrder | `standard(sauce->cheese->topping)` | default 値。**evidence ではない**（`mechanicEvidence` は MULTI_SPREAD 1 件のみ） |
| dough / pan / bake | `dough.class: unknown`、`doughStyle: null`、`pan: null`、`cookingProfile.method: bake` | source 欄が空。`prep` / `postBakeFinish` も空 |
| cheese / toppings | mozzarella / garlic | ingredient list のとおり。**個数は source に無い** |

### 1.3 未解決 authority（要注意の食い違い）

- `TETO_PIZZADB_172_MASTER-REPORT.md` §4 の prose は Grandma を「square-pan / thick-crispy-bottom family（Detroit / old-forge / Grandma / St. Louis / Quad Cities）」に**列挙**しているが、**行レベルの evidence は doughStyle null・pan null**で、matrix も PAN_BAKE / DOUGH_VARIANT を Grandma に要求していない（`requiredCapabilities = [MULTI_SPREAD_LAYER]` のみ）。prose は設計メモ、行 evidence は欠落、という関係で、どちらが正かは本 audit では決められない。**Owner が Grandma の pan を identity とみなすなら、MULTI_SPREAD とは別に PAN_BAKE が増える**（shortlist §3.1 の montreal と同じ blocker）。
- 2 層とみなす根拠は ingredient list 1 件（`corroborationCount: 1`、comparison table sample）のみ。

### 1.4 Source fact / Gameplay calibration の区分

| 項目 | 区分 | 備考 |
|---|---|---|
| ingredient 集合 {garlic, mozzarella, olive-oil, tomato-sauce} | **SOURCE FACT** | identity の根拠 |
| sauceFamily = トマトソース | **SOURCE FACT** | base の導出元 |
| 「olive-oil + tomato-sauce = 2 spread 層」 | **REPO DERIVATION**（source は ingredient list まで） | A の mechanic 要否はここに依存 |
| 層順・olive-oil の gesture（paint / drizzle / brush） | **未決（source に無い）** → 実装すれば **GAMEPLAY CALIBRATION / design decision** | |
| mozzarella / garlic の `minCount`、sauce 量（shared fixture）、`bakeTarget` | **GAMEPLAY CALIBRATION** | calabresa(D-6)/pesto-pollo(No.27) と同じ扱い |
| `ladderCredit: false`、`lunchRush`、`RECIPE_HINT_ROLES`（key topping = garlic か）、reference layout | **GAMEPLAY CALIBRATION / Owner** | |
| 形（square pan）・dough | **未解決 authority**（§1.3） | |

---

## 2. STEP 2 — Production sauce architecture（`origin/main`）

### 2.1 すでに複数 sauce を想定している箇所（変更が小さい／不要）

| 箇所 | 状態 |
|---|---|
| `PizzaState.sauceIds: string[]`（`src/state/pizzaState.ts:54`） | 型は配列 |
| `signatureOfPizza`（`signature.ts:131-148`）、`RuntimeSignature.sauceBase` | 配列・sorted unique。`spreadLayers` 次元だけ `FIXED_BY_FLOW`（"one sauce per pizza"） |
| `RECIPE_DISCOVERY_CATALOG.sauceBase`（`discoveryCatalog.ts:62-69`） | requiredIngredients の category=sauce を全て集める＝**Grandma を両 ingredient で書くと sauceBase が 2 要素になる** |
| matcher（`matcher.ts:104`） | sorted 配列の完全一致。2 要素でも比較自体は動く |
| attempt fingerprint `fp1:`（`attemptFingerprint.ts`） | `[sauceBase[], ingredientSet[]]`。複数 sauce 可。次元追加は additive で version 1 のまま（同ファイル doc） |
| Trial Notebook（`trialNotebook.ts` / `trialNotebookDiff.ts` / `TrialNotebookSheet.tsx`） | `sauceBase` を配列で保持・chips 表示・before/after 比較 |
| `consumePizzaInventory`（`inventory.ts:107-146`） | 「将来の multi-sauce pizza は sauce ごと 1 unit」と明記、`sauceIds` を全件 loop |
| `deductionGuard.ts` の doc | 「multi-spread recipe は H に真の reserve を保つ」＝設計上は想定済み |
| persistence | `persistence.ts` に live `PizzaState` / `sauceIds` は無い（保存対象は ledger 類）。attempt の記録は上記 fingerprint |

### 2.2 single-base を前提にしている箇所（変更が必要になる）

| 層 | 箇所 | 前提 |
|---|---|---|
| **sauce profile** | `RECIPE_SAUCE_PROFILES: Record<RecipeId, RecipeSauceProfile>`、`ingredientId` 1 つ（`recipeSauceProfiles.ts:13-19`）、27 件総 Record | recipe あたり sauce 1 件 |
| **sauce 塗布 (reducer)** | `APPLY_SAUCE` は `sauceIds: [action.ingredientId]` で**置換**（`gameReducer.ts:856`）、`COMMIT_SAUCE_DISPENSE` も `[id]` で置換し `isFreshApplication = sauceIds[0] !== id`（:900-916）。`sauceOrigin` / `sauceToken` / `sauceDeposits` は**層ごとでなく 1 組** | 「新 sauce は旧を置換」。2 層目を足す経路が無い |
| 塗布 UI | `PizzaStage.tsx:909` `sauceIds[0]` のみ描画、`isOilSauce` は単一 id の CSS 分岐（:911,1132-1174）。keyboard painter 非対応は既存制約（:895-905） | 描画・heatmap・oil sheen が 1 層 |
| **matcher/signature** | `RUNTIME_SUPPORTED_CAPABILITIES = []`（`signature.ts:87`）。`MULTI_SPREAD_LAYER` を要求する target は `match しない`（規則 2） | capability 未サポート。production-only target（calabresa 型）は capability を外して default 次元で書く |
| **reference pizza** | `ReferencePizza.sauce: ReferenceSauce`（単数、`ingredientId` 1）。`computeMechanicalSauceReference(recipeId)` は profile の 1 id から作る（`referencePizza.ts:166-175`） | reference が 1 sauce |
| **scoring** | `scoringV2/index.ts` の `isApprovedSauceTarget`（sauce id→target の map、**1 recipe 1 target**）、`invalidReferenceValueReason`、`sauceComponent.ts`（quantity/coverage/evenness/edge の単一成分）、`types.ts`、`boundary.ts`、`referenceScoring.ts`、`sauceEvaluation.ts`、`SauceMetricsPanel.tsx`。`toLegacyScoreBreakdown` | sauce 成分 = 1 本の deposit log から 1 つ |
| **completion gate** | `checkSauceQuantity`（`completionGate.ts:165-181`）＝ reference の sauce 1 id が required かつ使用済みのときのみ判定、`INSUFFICIENT_SAUCE` は `ingredientId` 1 つ | 量判定が 1 sauce |
| **execution advice** | `executionAdvice.ts` は `sauceDeposits` 単一ストリームの薄さを判定（generic 基準は margherita） | |
| **Hint 1/2/3** | `hints.ts:157-175`: `recipe.requiredIngredients.find(category==="sauce")`（**最初の 1 件**）で「ソースを塗ろう」判定。`hintSteps.ts:92` `ingredients.find(category==="sauce")` も最初の 1 件 | 2 つ目の sauce が hint に出ない／出す仕様が未定義 |
| **Hint 5.0** | SAUCE 先頭 rung（`hint5Ladder.ts:201-217`）は `inCategory("sauce")` を全て subject にする（2 件になる）。`hint5Production.gate.test.ts:312` の **Cooking Techniques tripwire** は `rungs[0].subjectIds.length !== 1` の recipe があると**意図的に失敗**し、「TQ-1D（または recipe PR）が Hint 5.0 privacy を再 audit し OD-H5-P4 を決めてから出荷」と要求する。`deductionProduction.gate.test.ts` も「production recipe は全て sauce 1 件」前提を記し、DH4 sweep の再実行を要求 | gate テストが single-sauce を契約化している |
| **Pizza Select** | `PizzaThumbnail.tsx:35`、`playerReference.ts:49`、`ReferenceThumbnail` / `ReferencePreview` / `PlayerReferencePreview` / `DinnerGameUi` が**最初の sauce 1 件**から描画 | 2 層目が一覧・参考図に出ない |
| **discovery predicate** | `recipeDiscoveryState` 等は recipe の ingredient 集合の可用性で判定（sauce 数に依存しない）。ただし `freeCook.ts`・`resultNearMiss`・`nearMiss.ts`（sauceBase 差 1 軸 `ADD/REMOVE/CHANGE`）は**1 sauce の pizza** を想定した文言/距離 | |
| **orders / Lunch Rush / Dinner Mission** | `orders.ts`・`pizzaSelect.ts`・`dinnerMission.ts` に sauce 直接依存なし（recipe 経由） | ほぼ影響なし（ただし Dinner の result 検出は completion gate 経由） |
| **ingredient category** | `olive-oil` は `category: "sauce"`、`placement: "spread"`。`PLACE_TOPPING` は `category === "sauce"` を拒否（`gameReducer.ts:945`）。olive-oil を sauce として使う shipped recipe は 4 件（quattro-formaggi / fugazza / pizza-bianca / new-haven-apizza） | 「oil を topping として置く」経路は現状存在しない（§4.2） |
| **既存 save** | live pizza は保存されない。ledger 類（Dex・hint 購入・ownership 等）は recipe id / ingredient id キー | 変更面は小さい見込み（§5） |

### 2.3 multi-spread 正式導入の変更面（列挙）

1. **data**: `RecipeSauceProfile` を layer 配列へ（`Record<RecipeId,…>` 27 件の移行 or optional 追加）、`PizzaState` の sauce 状態（`sauceOrigin/Token/Deposits`）を層別化、`ReferenceSauce` を layer 配列化。
2. **reducer/action**: `APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` の「置換」を「層追加 or 置換」へ。層の取り消し・順序・SAUCE ステップ内の完了条件。
3. **UI/rendering**: PizzaStage の 1 層描画、oil 専用分岐、heatmap、tray の SAUCE ステップで 2 sauce を選ぶ導線、keyboard、Reference/Thumbnail/PlayerReference/SauceMetricsPanel。
4. **matcher/discovery**: `MULTI_SPREAD_LAYER` を `RUNTIME_SUPPORTED_CAPABILITIES` に追加すると、同 capability を要求する Phase-2 target も match 可能になる（baseline テスト影響）。`spreadLayers` 次元の観測化（順序を identity にするか）。near-miss の sauce 軸（ADD/REMOVE/CHANGE）の 2 sauce 時の意味。
5. **scoring/gate**: sauce 成分の多重化、承認済み target の map、parity fixture（`scoreParity.*.json`）、`checkSauceQuantity`、execution advice。
6. **Hint/Notebook**: Hint 1–3 の「最初の sauce」、**Hint 5.0 SAUCE rung の privacy 再 audit と OD-H5-P4**、DH4 sweep 再実行、tripwire テストの扱い。Notebook は大半が配列対応済み。

---

## 3. STEP 3 — Catalog reuse（172 matrix）

`requiredCapabilities` に `MULTI_SPREAD_LAYER` を持つ行 **17 件**、`candidateCapabilities` のみ **10 件**（matrix `capabilityStats`）。matrix は 17 件中 **13 件を MULTI_SPREAD 単独で解除可能**（`rowsUnlockedAlone`）としている。以下は「Grandma と同じ mechanic（2 つの spread 型 layer、追加 capability 不要）で本当に扱えるか」で区別した。

### 3.1 要求 17 件

| 区分 | 件数 | recipe | Grandma と同じ mechanic で扱えるか |
|---|---|---|---|
| **a. oil + tomato、現 30 材料のみ、他 capability なし** | 4 | grandma（READY）、sfincione（READY_WITH_REVIEW）、margherita-row（COMPOSITION_CONFLICT_SHIPPED）、marinara-p13（COMPOSITION_CONFLICT_SHIPPED） | **同じ mechanic で扱える**。ただし grandma 以外は別 blocker（命名/composition conflict）が残る。sfincione は shortlist 側で naming cluster（NC-3）を別 blocker に計上 |
| **b. oil/pesto/tomato + 新規 content 材料が必要（他 capability なし、blocker なし）** | 4 | burrata-pizza（burrata）、pizza-alla-crudaiola（arugula, burrata）、pesto-burrata（burrata）、pescatore（mussel, parsley, shrimp） | mechanic は同じだが**材料追加が前提**（Grandma と違い「材料追加不要」にならない） |
| **c. sauce + 別種の新 spread 材料** | 3 | pesto-noci（pesto+honey）、pizza-salad（tomato+yogurt-sauce）、okonomiyaki（mayo+okonomiyaki-sauce／UNRESOLVED あり） | 2 層という構造は同じだが、**新しい sauce 系材料＋その描画**が必要。honey/mayo の「gesture」は未決 |
| **d. 後載せ（LATE_ADDITION）が絡む** | 3 | hot-honey-pepperoni（honey は post_bake と repo_inference）、buffalo-chicken（LATE 必須）、radicchio-noci（base なし・balsamic+oil、LATE candidate） | **同じ mechanic では足りない**（staged/late が別 capability） |
| **e. 他 capability / 別機構** | 3 | pizza-de-cancha（DOUGH_VARIANT＋UNRESOLVED）、lahmacun（DOUGH_VARIANT、spread は肉ペースト 1 層）、feteer-meshaltet（LAMINATE、base 未指定） | **同じ mechanic では扱えない** |

合計 4+4+3+3+3 = 17。

### 3.2 candidate-only 10 件

`BASE_SAUCE_UNSPECIFIED` の行群（nashville / buffalo-cauliflower / nduja / potato-mayo / reina-pepiada / mentaiko-mochi / mexican-elote / teriyaki-chicken / boerewors / swedish-kebab）。matrix の根拠は `repo_inference`（「base が未指定で、listed の spread 材料が base 自体でなければ 2 層目になる」）で、**base 確定後に 1 層で足りる可能性が高く、source 上 2 層とは言えない**。全件 mayo / honey / chutney / kebab-sauce 等の新規材料を要する。→ 同じ mechanic で扱えるかは**未確定**。

### 3.3 現 30 材料で実際に再利用できる数（要約）

- Grandma と同条件（oil + tomato、30 材料内、他 capability なし）: **grandma を含め 4 件**（うち blocker なし 1、他は命名/composition 判断が残る 3）。
- 「Grandma が 2 つ目」になる再利用は材料追加なしでは **sfincione / margherita-row / marinara-p13 の 3 件**で、いずれも別 Owner 判断を伴う。
- 材料追加（burrata 等）を伴えば最大で b+c の 7 件が機構としては同じ土台に乗り得る。
- **Step 14 に限る**と: Step 14 の candidate 3 件はすべて MULTI（grandma / marinara-p13 / pizza-de-cancha）。

---

## 4. STEP 4 — Simplification consequences（B: Grandma-only 簡略化）

### 4.1 「技術的に可能」な表現（現 architecture で確認したもの）

| 表現 | identity set | 現 architecture で成立するか | source 忠実性 |
|---|---|---|---|
| **S1: tomato-sauce を単一 base、olive-oil を持たない** | {garlic, mozzarella, tomato-sauce} | **成立する**。shipped 27 recipe と equal / subset / superset なし。172 行にも同一集合なし（ny-style / trenton は {mozzarella, tomato-sauce} の部分集合だが未 shipped） | **source の 4 材料のうち 1 つ（olive-oil）を落とす**。sauceFamily（トマト）とは整合 |
| **S2: olive-oil を単一 base、tomato-sauce を持たない** | {garlic, mozzarella, olive-oil} | 成立する（衝突なし）。oil base の前例あり（quattro-formaggi / fugazza / pizza-bianca / new-haven） | **sauceFamily「トマトソース」と矛盾**。source の base と別物になる |
| **S3: 4 材料を requiredIngredients に残しつつ base は tomato のみ** | 4 材料 | **成立しない**。catalog は category=sauce を全て `sauceBase` に入れ（`discoveryCatalog.ts:62`）、プレイヤーは `sauceIds` に 1 件しか持てず、Completion Gate は olive-oil の `minCount` を要求する → **到達不能 target**（`nearMiss.ts` の「unreachable」扱い） | — |
| **S4: olive-oil を ingredient/topping として置く、tomato を base にする** | 4 材料 | **現状は成立しない**。olive-oil は `category: "sauce"`（`ingredients.ts:123-124`）で、`PLACE_TOPPING` は sauce category を拒否。category を変えると shipped 4 recipe（上記）と shelf/hint/scoring の `category==="sauce"` 判定が全て動く＝Grandma 局所の変更ではない。別 id の oil topping を足すなら**材料追加**（OD-FIRST-C-STEP の「ingredient 追加不要」から外れる） | 4 材料が揃う点では最も source に近いが、層構造は失う |

→ 「olive-oil を ingredient として残して tomato-sauce だけ base」は**現 architecture では実現できない**（S3/S4）。可能なのは S1（oil を落とす）か S2（tomato を落とす）。

### 4.2 差分の整理（S1 を例に、S2 は括弧）

| 観点 | 差 |
|---|---|
| **recipe identity** | identity 集合が source の 4 → 3（S1）。`identityDimensions` の `spreadLayers` / `baseSauce` のうち spreadLayers を捨てる。matrix 上 PARTIAL（`loses evidenced dimension(s): MULTI_SPREAD_LAYER`）のまま。S2 は base が source と食い違う |
| **matcher** | 4 材料の superset（oil を足した pizza）は S1 の target と match しない。oil と tomato は同時に持てないため、oil 付き pizza は構造上作れず matcher 面の実害は小さい。S1 でプレイヤーが oil base で garlic+mozzarella を作ると `sauceBase` 差 1 の near-miss（CHANGE）になる |
| **Hint** | Hint 1–3 の「最初の sauce」は tomato-sauce に一意 → 既存コードのまま動く。Hint 5.0 SAUCE rung も 1 件で、**TQ-1D tripwire / OD-H5-P4 再 audit は不要**。S1 は olive-oil が hint から消える |
| **player inference** | Step 13 で olive-oil を入手済みのプレイヤーには、「oil を使うはずなのに要らない」という逆向きの推理誘導は無い（S1 は oil を要求しない）が、**oil を加えた試行が hint 的に一切報われない**。S2 は tomato を主役とするトマト族の推理と食い違う |
| **source fidelity** | S1/S2 とも source 集合を変える。「トマトソース家系の Grandma」を oil なしで出すと、oil 付き版の別 recipe（margherita-row 等）との関係が将来崩れ得る（下記） |
| **future migration** | 後で multi-spread(A)を入れて Grandma を 4 材料へ戻す場合: Dex は recipe id キーなので発見済み状態は保てる一方、**identity 集合が変わる＝S1 の組み合わせでは達成扱いにならなくなる**。Trial Notebook の保存済み fingerprint（組み合わせ記録）は変わらず残るが、「Grandma を作った組み合わせ」の意味が変わる。別 id で新規追加にすると recipe id の追加（`KNOWN_RECIPE_IDS`）と Dex 件数/ladder 影響が出る。※これらは静的読解による見立てで、挙動は未実測 |

**注意:** S1 の「技術的に成立」は source-authoritative を意味しない。S1 は **matrix が READY と判定した identity（4 材料）から意図的に外れた authoring** で、Owner の明示判断が要る（shortlist §3.3 の (b) と同じ）。

### 4.3 他の oil+tomato 行へは簡略化が通用するか

| 行 | oil を落とした集合 | shipped との関係 |
|---|---|---|
| grandma | {garlic, mozzarella, tomato-sauce} | 衝突なし（S1 成立） |
| sfincione | {anchovy, onion, oregano, tomato-sauce} | 衝突なし |
| margherita-row | {basil, mozzarella, tomato-sauce} | **shipped margherita と同一集合**（簡略化すると identity 重複） |
| marinara-p13 | {garlic, oregano, tomato-sauce} | **shipped marinara と同一集合**（同上） |

→ margherita-row / marinara-p13 は簡略化では成立せず、**multi-spread(A) でしか独立 recipe になれない**。Grandma と sfincione は簡略化でも成立する。

---

## 5. STEP 5 — Full mechanic consequences（A: 最小 vertical slice）

前提: Grandma 1 recipe を 2 層（olive-oil + tomato-sauce）で成立させる最小構成。層の gesture（oil を paint にするか drizzle にするか）と順序の identity 化は **source に無く、Owner/設計判断を要する**（§1.2）。以下は「最小」を「olive-oil も既存 PAINT 系 gesture で 1 層として塗る」と置いた場合。

| 領域 | 必要な変更 |
|---|---|
| data model | `RecipeSauceProfile` に layer 配列（または `secondary` を追加し 27 件は後方互換）。`PizzaState` の sauce 状態を層別化（`sauceDeposits` に ingredient id を付ける等）。`ReferenceSauce` を layer 配列化。`spreadLayers` 次元の観測化 |
| reducer / action | `APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` に「層を足す」意味論、置換の条件、取り消し、SAUCE ステップの完了条件、`isFreshApplication` の再定義、stock gate（`canPlaceIngredient`）の整合 |
| UI interaction | SAUCE ステップで 2 sauce を選ぶ導線、2 回目の塗りの扱い、tray 表示、keyboard の扱い |
| rendering | PizzaStage の層別描画（oil 専用分岐の一般化）、heatmap/metrics、Reference/Thumbnail/PlayerReference/Pizza Select の 2 層表示 |
| matcher | `MULTI_SPREAD_LAYER` の supported 化 or Grandma を capability なし(default 次元)の production-only target として書く（calabresa/pesto-pollo 型）。後者なら matcher 本体は触らず catalog の `sauceBase` 2 要素で動く（signature は既に配列）が、**spreadLayers 次元は FIXED_BY_FLOW のまま**になり、層の順序は identity 外 |
| scoring | sauce 成分を層ごと or 合算に（`sauceComponent` / `isApprovedSauceTarget` / `invalidReferenceValueReason` / boundary / legacy breakdown）。**27 recipe の既存 parity fixture を byte-identical に保つ必要**。新 `scoreParity.*.json` |
| completion gate | `checkSauceQuantity` を層別に（`INSUFFICIENT_SAUCE` の `ingredientId`）、`executionAdvice` |
| Hint | Hint 1–3（最初の sauce 依存）、**Hint 5.0 SAUCE rung は 2 件になり tripwire が落ちる＝privacy 再 audit と OD-H5-P4 の決定が前提**、DH4 sweep（hypothesis/partition）の再実行 |
| Notebook | 配列対応済みのため小。2 sauce attempt の表示・diff の確認 |
| save | **save v2 の schema 変更は不要の見込み**: live pizza は保存されず、fingerprint は配列で次元追加が additive（version 1 のまま）、recipe/ingredient の ledger は id キー。ただし新 recipe id 追加は他 recipe 追加と同じ扱い（`KNOWN_RECIPE_IDS`）。実装時にテストで確認が必要（本 audit では未実行） |
| tests | `sauceIds` / `sauceDeposits` / `ReferenceSauce` / profile を参照する**テスト・testSupport 約 68 ファイル**（静的 grep）に影響し得る。production 側の single-sauce 接点は **28 ファイル**（grep）。recipe 追加に伴う件数更新は No.27 と同種（No.27 は変更 99 ファイル・うち src 61。ただし chicken の材料追加を含む） |
| E2E | 塗り 2 回の導線、Pizza Select/Reference 表示、Hint/Notebook、ladder 件数（e2e は 46 ファイル） |
| mobile HV | 390×844 で SAUCE ステップの 2 層操作・参考図・Hint・結果画面。UI/UX/gameplay 変更のため `TETO_HUMAN-VERIFICATION-POLICY.md` に従う（動画＋before/after screenshot） |
| economy / shop / ladder | 変更なし（材料追加なし） |

最小の A が「production-only target で capability を外す」場合、**mechanic（2 層を塗る操作・採点・参考図）は実装するが discovery matcher の supported capability 化は避ける**という切り分けが可能。これを採るか否かは Owner 判断。

---

## 6. STEP 6 — Option comparison（順位・点数なし）

| 比較項目 | A. Full multi-spread | B. Grandma-only 簡略化 | C. Step 14 candidate 再検討 |
|---|---|---|---|
| source fidelity | ingredient 集合は source 通り 4 材料。層順・gesture は source に無く design 判断 | S1: 集合が 3 材料（oil 脱落）／S2: base が source と食い違う。matrix は PARTIAL | candidate 次第。Step 14 の既存 candidate は 3 件とも MULTI 要求（§0）。他 Step の候補は別 blocker（下記） |
| production code surface | 大（§2.3・§5）。single-sauce 接点 28 ファイル＋テスト約 68 | 小。recipe data / 総 Record / reference / fixture 等 No.27 同型。sauce 機構は無変更 | candidate による。簡略化なら B 同等、mechanic 実装なら A 同等 |
| new mechanic | 有（2 層を塗る操作・採点・参考図） | 無 | 候補次第 |
| future recipe reuse | 現 30 材料で 3 件（sfincione / margherita-row / marinara-p13）、材料追加を伴えば最大 +7 件。margherita-row / marinara-p13 は**簡略化では成立せず A でしか独立しない** | 再利用先なし。sfincione には同じ簡略化が通用（衝突なし）、margherita-row / marinara-p13 には通用しない | 再利用は候補次第 |
| Discovery-specific complexity | Hint 5.0 privacy 再 audit・OD-H5-P4・tripwire・DH4 sweep 再実行が前提。matcher は production-only target 型なら最小 | 追加なし（tripwire 通過、Hint 1–5 は既存経路） | 候補次第 |
| save migration | 不要の見込み（要テスト確認） | 不要。ただし将来 A へ移行する場合は identity 変更の扱いが発生（§4.2） | 不要の見込み |
| test / HV scope | 大: 採点 fixture・Hint 全層・E2E・390×844 HV（SAUCE 操作） | 中: No.27 同型の recipe 追加 + HV（Pizza Select/Hint/Notebook） | 候補次第。mechanic なしなら B 同等 |
| unresolved authority | 層順・oil の gesture・pan（§1.3）・個数/bake calibration | 同左の calibration＋「oil を落としてよいか」の Owner 承認 | 候補ごと（下表） |

### C の前提（Step 14 に載せられる別 candidate の事実）

- **Step 14 の candidate は grandma / marinara-pizza-p13 / pizza-de-cancha の 3 件で、3 件とも MULTI_SPREAD**。pizza-de-cancha は DOUGH_VARIANT＋UNRESOLVED_INGREDIENT も持ち、marinara-p13 は shipped marinara と同名/集合重複で簡略化不可。→ Step 14 に multi-spread を使わない既存 candidate は無い。
- Step 14 に別 candidate を成立させる経路は、現 authority の範囲では (i) OD-FIRST-C-STEP の前提を動かす（Step 6 の montreal＝MECH、Step 8 の bismarck-p7＝命名判断のみ。ただし最初の OPEN_POOL が Step 12 から前倒しになる）、(ii) 「ingredient 追加不要」を外して材料込みの candidate を ladder に載せる（ladder 再設計＝別 Decision）、(iii) 172 matrix に無い production-only recipe を新設する（source authority 外）。いずれも Owner の前提変更を伴う。
- Step 15 以降の sauce-bearing candidate も MULTI（sfincione ほか）または DOUGH/PAN 系で、no-sauce candidate は OD-BRANCH-3 で除外済み。

---

## 7. STEP 7 — Owner Decision

### OD-GRANDMA-SPREAD

Step 14 の Grandma Pizza の olive-oil + tomato-sauce multi-spread をどうするか。

- **A.** multi-spread を正式 mechanic として作る
- **B.** Grandma を single-base へ簡略化する（S1: tomato のみ／S2: oil のみ。olive-oil を ingredient/topping に残す形は現 architecture で不可）
- **C.** Grandma を今回見送り、Step 14 candidate を再検討する（前提変更が要る）

| 判断材料 | A | B | C |
|---|---|---|---|
| source の 4 材料を保つ | 保つ（層順/gesture は新規設計） | 保てない（S1: oil 脱落、S2: base 不一致） | 候補次第 |
| 新 mechanic | 有 | 無 | 候補次第 |
| 変更面 | 大（28 ファイル＋テスト約 68、採点・Hint 5.0 gate を含む） | 小（No.27 同型 recipe 追加） | 候補次第 |
| Hint 5.0 privacy 再 audit / OD-H5-P4 | **必要** | 不要 | 候補次第 |
| 再利用 | 現 30 材料で +3、材料追加で最大 +7。margherita-row / marinara-p13 は A でのみ独立 | 再利用なし（sfincione には同簡略化が通用） | — |
| 将来の移行 | — | A へ移ると identity が変わる | — |
| Step 12 体験・save | 不変 / 不要の見込み | 不変 / 不要 | 前提次第で Step 12 前倒しの可能性 |
| 未解決 authority | 層順・oil gesture・pan・calibration | oil を落とす承認・pan・calibration | 候補ごと |

**Owner が決めるのは 1 点:** 「Grandma の identity に olive-oil + tomato-sauce の 2 層（source の 4 材料）を含めることを、新 mechanic のコストを払ってでも必須とするか」。Yes → A、No で Grandma を維持 → B、No で Grandma 自体を避ける → C。

---

## 8. 本書がしなかったこと / 限界

- Grandma の採用、No.28 の確定、推奨、ranking、`ladderCredit` / `lunchRush` / 個数 / bake window の確定、実装、Issue / PR、R6 / IP-2。
- 172 件の再監査、新規 web/source 調査、production 述語・テストの実行。件数は `src/` の静的 grep と matrix JSON からの集計で、grep の範囲は `sauceIds|sauceDeposits|ReferenceSauce|getRecipeSauceProfile|RECIPE_SAUCE_PROFILES|sauceOrigin|sauceToken` に限る（網羅的な影響調査ではない）。
- 「save v2 変更不要」「identity 変更の移行影響」は静的読解による見立てで、実装時の検証が必要。
- full Vitest / E2E / WebKit / build / HV / screenshots / Preview は docs-only のため未実施。一時 script は commit していない。
