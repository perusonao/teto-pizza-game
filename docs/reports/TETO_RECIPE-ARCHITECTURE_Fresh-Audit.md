# Recipe Architecture / Original Pizza / Recipe-specific Cooking Steps — Fresh Audit

- 種別: **設計・監査のみ（docs-only）**。production code、既存 PR の branch、Issue の状態は変更していない。
- 監査基準: `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`（2026-09-24 に `git fetch` で再確認）
- 前提の Owner Decision: Issue #215 に記録（OD-1 G1 / OD-2 Q 0.5 / OD-3 excess 0.15 / OD-4 LR-A / OD-4b LR excess 0.15 / OD-5 D-A）
  - <https://github.com/perusonao/teto-pizza-game/issues/215#issuecomment-5814618436>
- 基本原則（owner）: **「材料がそろえば発見。量や仕上がりが良ければ★が上がる。」**
  将来は「材料と必要な作り方がそろえば発見。量や仕上がりが良ければ★が上がる。」へ拡張する。

---

## 0. 結論（先に）

| # | 問い | 回答 | 一言の根拠 |
|---|---|---|---|
| A | 今の architecture のまま 100+ recipes へ拡張できるか | **CONDITIONAL** | discovery の identity 軸（11 次元）、`CookingProfile`、`POST_BAKE` はすでにある。ただし 1 recipe の追加に **production 6〜7 ファイル + 「15」を固定したテスト 9 ファイル**が要る。そのうち 3 箇所（order、Reference、CUT allowlist）は、書き忘れても型エラーにならない。さらに Reference Pizza の手書き（§9）と、8 スロットのお手本リング（§10.3）が、W1 の時点で上限に当たる |
| B | Cooking Step Engine は必要か | **YES** | 172 行中 66 行が capability を必須とする（PARTIAL 55 + NOT_REPRESENTABLE 16 の大部分）。ただし「新しい engine を作る」のではない。今ある `CookingProfile` / `POST_BAKE` / `MakingStep` の予約値 / `signature.ts` の 11 次元に、**mechanic registry** と **cooking trace** を足す（§4） |
| C | Original Pizza を今から architecture に入れるべきか | **YES** | Free Cooking にはすでに `ORIGINAL` の結果（スコアなし、Dex なし）がある。工程を identity に入れるときに 3 つの状態（FAILED / OFFICIAL / ORIGINAL）を型で分けておかないと、後から直すのが高くつく（§6） |
| D | My Recipe を今実装する必要があるか | **NO** | save schema v3、Lunch Rush の ranking の公平性、id の名前空間の設計が要る。今は「後で保存できる形」で Original Pizza の trace を残すことだけ決める（§7） |
| E | W1 を今の architecture のまま先に実装してよいか | **CONDITIONAL** | 条件: (1) #220 と #221 の W1 の集合の食い違いを直す（§10.1）、(2) >8 個の具材の recipe のお手本の問題を直す（§10.3）、(3) #215 の実装と 3-4C の merge の後。推奨は B 案（新しい Recipe Definition の Vertical Slice）|
| F | 最初の Recipe Architecture Vertical Slice | **Pizza Portuguesa + Pesto Tonno** | 新しい ingredient 0、mechanic 0。Portuguesa（具材 10 個）が生成 Reference の >8 個の場合を、Pesto Tonno（pesto、チーズなし）が sauce base と CHEESE を飛ばす工程を検証する。REC-06 / REC-09（オリーブ → black-olive）の確認が前提 |
| G | 最初の Cooking Step mechanic | **LATE_ADDITION（`post_bake` のみ）** | 今ある `POST_BAKE` の phase（CUT で 15 recipe すべてが使っている）と、予約済みの `FINISH` を使える。操作は TOPPING と同じ。再利用できる行が 4 候補の中で最も多い（必須 12 + 候補 11）。rollback も registry から 1 行消すだけ（§11）|
| H | Phase A1 を Recipe Architecture より先に実装してよいか | **CONDITIONAL** | 「Phase A1」という名前は repo と PR に定義がない。ここでは **#215 Owner Decision の実装（G1 / Q / excess / LR-A / D-A）**と読む。その読みなら先に実装してよい（むしろ前提になる）。ただし #215 の guardrail どおり 3-4C の merge の後。もし「W1 の slice A（Aussie）」の意味なら **NO**（ソースのない recipe の契約が今の runtime にない。§10.1）|
| I | 次に作るべき Issue | **新しい Issue が 1 件要る** | 「Recipe Architecture 1.0」。既存の #182（content）、#176（Scoring 3.0 / 動的な工程）、#37（Making Game 2.0）、#215（Completion Gate）はどれもこの範囲を持っていない（§1.3）|
| J | Blocker / Owner Decision | §15 | W1 の集合の食い違い、REC-06/09、Original Pizza の報酬、Free Cooking で工程をどう見せるか、完全一致のルールの確認 |

---

## 1. GitHub / main baseline

### 1.1 状態（2026-09-24 に GitHub から取得）

| 対象 | 状態 | HEAD | 今回の確認 |
|---|---|---|---|
| `main` | — | `dff233c042d2df6ee1c3a92f2d2419830aa05460` | 前回と同じ |
| PR #218（Completion Gate partial-quantity Fresh Audit） | OPEN / 未 merge | `5105771d37577ad353e869ea35295a4ea18bbce9` | reviewed HEAD と同じ。A. PASS を引き継ぐ |
| PR #220（Content Readiness / Implementation Wave） | OPEN / 未 merge | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | reviewed HEAD と同じ。A. PASS を引き継ぐ |
| PR #221（W1 content authoring fresh audit） | OPEN / 未 merge / clean | `279b6b17188ed3572b27c1ba91b2c4983723ddc0` | Codex の review が上限で止まっている（最後の依頼に返答なし）。§10.1 に食い違いがある |
| PR #206（3-4B save forward-compat） | OPEN / 未 merge | `edfca8b…` | 未知の recipe / ingredient のデータを残す。新しい recipe を出した版を rollback したときの Dex を守るので、W1 の前提になる（§7.4）|
| PR #214 / #211 / #213 / #217 / #209 / #208 / #219 | OPEN | — | この監査の範囲外（参照だけ）|
| Issue #182 | OPEN | — | 172 recipes の content、ingredient、mechanic 依存、PR の分け方 |
| Issue #215 | OPEN | — | Owner Decision OD-1〜OD-5（+4b）を記録済み。close していない |

### 1.2 関連する既存の設計

| 文書 | 使い方 |
|---|---|
| `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` | Phase 0 の工程設計。§4「Step か Modifier か」の判定、§7 の `CookingProfile` Map 案（C 案）、§8 の `POST_BAKE`。**すでに実装済み**の部分と、予約だけの部分がある（§4.1）|
| `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` + `data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（PR #189 merged） | 11 capability、実装順（DOUGH_VARIANT → MULTI_SPREAD_LAYER → LATE_ADDITION）、collision |
| `src/logic/discovery/signature.ts` / `matcher.ts`（Phase 3-1） | identity の 11 次元と「完全一致」のルールは **すでに runtime にある** |
| PR #218 の Fresh Audit | DS-A（`minCount` = 理想量のまま）、G1、Q、LR-A、D-A |

### 1.3 Duplicate Gate

GitHub の検索（`recipe architecture` / `cooking step` / `original pizza` / `my recipe`）で 33 件がヒットした。関係するものを確認した。

| Issue | 範囲 | この監査の範囲を持っているか |
|---|---|---|
| #182 | 172 recipes の content と progression | 持っていない。content の母集団と実装の分け方だけ。architecture の変更はない |
| #176 | Gameplay UX / Scoring 3.0。項目 4「Dynamic/skippable cooking steps」 | 一部だけ。PR-A で `deriveCoreSteps` として実装済み（ingredient の分類から工程を省く）。mechanic、identity、Original Pizza は持っていない |
| #37 / #33 | Making Game 2.0 / 生地 | 操作の質の話。recipe の identity は持っていない |
| #215 | Completion Gate の数量 | quantity を Completion / Quality に置くことを決めた。この監査の前提 |
| #129 | Player Profile / クラウドセーブ | My Recipe のクラウド保存は将来ここにつながる。今は持っていない |

→ **「Recipe Definition の一元化 + 生成 Reference + mechanic registry + Original Pizza の 3 状態」を管理する Issue はない。** 新しい Issue が 1 件要る（§14）。このセッションでは作っていない（依頼の範囲は document と commit まで）。

---

## 2. Recipe lifecycle dependency map（main `dff233c`）

### 2.1 流れと、読むファイル

```
Recipe 登録   src/data/recipes.ts (RECIPES, as const → RecipeId)
   │          ├─ recipeSauceProfiles.ts   Record<RecipeId,…>   ← 書き忘れると型エラー
   │          ├─ discoveryCatalog.ts      Record<RecipeId,…>   ← 書き忘れると型エラー
   │          ├─ referencePizza.ts        Map（手書き）        ← 書き忘れても型エラーにならない
   │          ├─ orders.ts                ORDERS[]             ← 書き忘れても型エラーにならない
   │          ├─ cookingProfiles.ts       CUT allowlist        ← 書き忘れても型エラーにならない
   │          └─ hints.ts                 Record<string,…>     ← fallback あり（任意）
   ▼
Recipe Select  state/pizzaSelect.ts, screens/PizzaSelectScreen.tsx（RECIPES の順、progression.ts の unlock）
   ▼          gameReducer.startPreparingRecipe → findOrderForRecipe（order がないと null で何も起きない）
調理          gameReducer: cookingProfile = getCookingProfile(id)
   │          （DOUGH → [SAUCE] → [CHEESE] → [TOPPING] は requiredIngredients の分類から、CUT は allowlist から）
   │          PLACE_TOPPING は ingredient の分類 × makingStep で制限。在庫は canPlaceIngredient
   ▼
BAKE           START_BAKE → CONFIRM_BAKE（1 回だけ）
   ▼
Completion     logic/completionGate.ts（minCount、sauce の量、bake の幅）
Scoring        logic/scoringV2（Reference 必須。ない場合は available:false）
Discovery      Free Cooking だけ: discovery/freeCook.ts → signature.ts → matcher.ts（完全一致）
   ▼
POST_BAKE      CUT（15 recipe すべて）→ RESULT
Result         components/ResultPanel.tsx（ORIGINAL のカードあり）
Dex            REGISTER_TO_DEX → state/dex.ts, discoveryRegistration.ts（BEST、Pitz）
Inventory      state/inventory.ts consumePizzaInventory（置いた個数）、starterStock.ts（minCount × 10）
Shop           ingredients.ts の pricePitz / unlockCondition
Lunch Rush     mission/lunchRush.ts（available ∩ discovered の order）、shared/lunchRushScoring.ts
               ranking の record は recipeId: string。Cloud Function は recipe の一覧を検証しない
Save           state/persistence.ts schemaVersion 2。Dex は isKnownRecipeId で未知の id を捨てる（#206 で変わる予定）
```

### 2.2 「recipe を 1 件足すと何ファイル要るか」（新しい ingredient なし、mechanic なし）

| # | ファイル | 必須か | 書き忘れたとき |
|---|---|---|---|
| 1 | `src/data/recipes.ts` | 必須 | — |
| 2 | `src/data/recipeSauceProfiles.ts` | 必須（ソースは `tomato-sauce` / `pesto` / `olive-oil` のどれか） | 型エラー |
| 3 | `src/data/discoveryCatalog.ts`（target id） | 必須 | 型エラー |
| 4 | `src/data/referencePizza.ts`（具材の位置を手書き。約 40〜60 行） | 実質必須 | **型エラーにならない**。Scoring 2.0 が `available:false` になり、スコア、★、Pitz が出ない。`referencePizza.test.ts` の「全 recipe に Reference がある」で気付く |
| 5 | `src/data/orders.ts` | 実質必須 | **型エラーにならない**。`startPreparingRecipe` が null を返し、選んでも始まらない。Lunch Rush の注文にも出ない |
| 6 | `src/data/cookingProfiles.ts`（CUT allowlist） | 任意（仕様上は必要） | 型エラーにならない。CUT がない recipe になる |
| 7 | `src/data/hints.ts` | 任意 | 汎用の fallback の文になる |
| + | `src/data/ingredients.ts` | 新しい ingredient があるときだけ | — |
| テスト | 「15」を固定した 9 ファイル（`recipes.test.ts`, `recipeSauceProfiles.test.ts`, `pizzaSelect.test.ts`, `gameReducer.inventoryConsumption.test.ts`, `completionGate.test.ts`, `scoringV2.test.ts`, `efficiency.test.ts`, `economySimulation.test.ts`, `PizzaSelectScreen.test.tsx`） | 必須（数を直す） | テストが落ちる |

→ **production 5 ファイル（実質必須）+ 任意 2 + テスト 9 ＝ 約 14〜16 ファイル**。
このうち #4〜#6 の 3 つは、書き忘れても型が教えてくれない。100+ recipes にするとき一番危ないのはここ。

### 2.3 自動で導かれているもの（良い点。このまま残す）

- `RecipeId`（`as const` から）、`starterStock`（minCount × 10）、`playerReference`（requiredIngredients から生成）、`efficiency` の閾値、`economySimulation`、discovery の target の `items` / `sauceBase`（`requiredIngredients` から）、`deriveCoreSteps`（ingredient の分類から）、Reference のソースの目標値（`computeMechanicalSauceReference`）。

---

## 3. Recipe Identity と Completion / Quality の分離

### 3.1 今の runtime はすでに半分できている

`signature.ts` の file header が、すでにこの分離を書いている:

> Not identity: CUT lines, the dough-stretch radii themselves, piece positions/counts, sauce deposit amounts and the bake value. Those are quality/completion inputs.

`RuntimeSignature.ingredientCounts` は「**Not identity**」と明記されている。matcher は `ingredientSet`（種類）+ `sauceBase` + 11 の identity 次元だけを見る。

### 3.2 分離の表（OD-1〜OD-5 を反映）

| 軸 | 何か | 今どこで判定するか | 分離後 |
|---|---|---|---|
| ingredient の種類（ソースを含む） | **Identity** | matcher（完全一致） | 変えない |
| sauce base（どれがソースか） | **Identity** | matcher（`sauceBase`） | `spreadLayers`（MULTI_SPREAD_LAYER）に広げる |
| 必要な作り方（mechanic） | **Identity** | `signature.ts` の 11 次元。今は FIXED_BY_FLOW か UNAVAILABLE | cooking trace から OBSERVED にする（§4、§5）|
| quantity（個数） | Completion / Quality | Completion Gate（minCount）+ Scoring 2.0 | OD-1: 0 個だけ FAILED。OD-2/3: Q 0.5 / 過剰 0.15。**identity に戻さない** |
| placement | Quality | Scoring 2.0 Pieces | 変えない（ZONED_PLACEMENT の zone だけは identity。§4.3）|
| sauce coverage / 量 | Completion（最低限）+ Quality | Completion Gate + Scoring 2.0 Sauce | 変えない |
| dough の質 | Quality（将来 D3B） | なし | 変えない |
| bake | Completion（幅）+ Quality | Completion Gate + Bake component | 変えない |
| cut | Quality | CUT の評価（total とは別） | 変えない（#176 の判断次第）|
| 工程の質（FINISH の置き方、ENCLOSE のとじ方） | Quality | なし | mechanic registry の `quality` から（§4）|

### 3.3 判定: 分離できる（条件付き）

- **できる**: 今の matcher と signature は、個数を identity に入れていない。OD-5（D-A）と矛盾しない。
- **条件 1**: Recipe mode の Completion Gate（`evaluatePizzaCompletion`）と Free Cooking の「MATCHED なら recipe の gate を通す」は、#215 の実装で G1 になる。そうすると `INCOMPLETE_MATCH` は数量では起きなくなり、sauce / bake の失敗だけで起きる。
- **条件 2**: mechanic を identity にするには、「工程をしたか」を記録する **cooking trace** が要る（今の `PizzaState` には、ソースと具材の最終状態しかない。順序やタイミングが残らない）。
- **条件 3**: `requiredIngredients[].minCount` は、DS-A のとおり「理想量（Quality の目標）」として残す。「identity に使う集合」と「理想量」は、同じ配列から導いているが、意味は別だと型のコメントに書く。

---

## 4. Cooking Step Engine

### 4.1 今の固定フロー（main で確認）

| 要素 | 状態 |
|---|---|
| `GamePhase` | `ORDER → PREPARE → BAKE → POST_BAKE → RESULT → DISCOVERED` |
| PREPARE の工程 | `deriveCoreSteps(recipe)`: DOUGH は常に。SAUCE / CHEESE / TOPPING は `requiredIngredients` の分類があるときだけ（#176 PR-A）|
| POST_BAKE の工程 | CUT（15 recipe すべて、allowlist）|
| `MakingStep` の予約値 | `FOLD` / `SEAL` / `EDGE_FILL` / `FINISH`。型だけ。reducer の case、UI、profile はない |
| 順序 | `nextStepWithin` で一方向。**CHEESE は SAUCE の後**という順が PLACE_TOPPING の分類の制限で固定される |
| Free Cooking | `FREE_COOK_RECIPE`（requiredIngredients が空）→ `getCookingProfile` は `DEFAULT_COOKING_PROFILE`（DOUGH / SAUCE / CHEESE / TOPPING、CUT なし）|
| identity の 11 次元 | `signature.ts` の `RUNTIME_DIMENSION_OBSERVATION`: 9 つが FIXED_BY_FLOW、2 つ（zones、shape）が UNAVAILABLE。`RUNTIME_SUPPORTED_CAPABILITIES = []` |

概念上のフロー `DOUGH → SAUCE → TOPPING → BAKE → CUT` は、コードでは `DOUGH → SAUCE → CHEESE → TOPPING →(BAKE)→ CUT`。

### 4.2 提案するモデル: Recipe の `cookingSteps: [...]` ではなく「mechanic の要求」から工程を導く

`cookingSteps: Step[]` を recipe に直接書く案（Phase 0 の A 案）は採らない。理由:

1. 工程の**順序と位置は mechanic の性質**で、recipe ごとに書くと 100+ recipe でずれる（Phase 0 §7 と同じ結論）。
2. 同じ mechanic を持つ recipe が 12 あると、同じ工程の列を 12 回書くことになる。
3. Free Cooking には recipe がない。工程を recipe に書くと、Free Cooking で「包む」ことができなくなり、Calzone を発見できない。

**提案: 3 つの層**

```ts
// (1) Recipe Definition（data）— recipe は「何が必要か」だけを書く
interface MechanicRequirement {
  capability: CapabilityId;            // PR #189 の 11 の名前をそのまま使う
  params?: MechanicParams;             // 例: { mode: "post_bake", ingredientIds: ["cilantro"] }
  role?: "IDENTITY" | "QUALITY";       // STEP_ORDER などで使う（§5.3）。既定は IDENTITY
}

// (2) Mechanic Registry（code。mechanic ごとに 1 つ。recipe ごとの if 文は書かない）
interface MechanicDefinition {
  capability: CapabilityId;
  kind: "STEP" | "MODIFIER" | "PARAMETER";            // Phase 0 §4 の判定をそのまま型にする
  contributeSteps?(p): StepContribution[];            // { step: "FINISH", phase: "POST_BAKE", before: "CUT" }
  modifyStep?: { step: MakingStep; config(p): StepConfig };
  targetIdentity(p): Partial<IdentityDimensions>;     // recipe 側: signature.ts の 11 次元のどれか
  observeIdentity(trace: CookingTrace): Partial<IdentityDimensions>;  // runtime 側
  completion?(trace): CompletionFailureDetail | null; // 工程が「始めたのに終わっていない」
  quality?(trace, p): QualityComponent;               // 工程の質（任意、Scoring 2.0 の別 component）
  disablesCut?: boolean;                              // ENCLOSE など
  freeCook: "ALWAYS" | "WHEN_UNLOCKED" | "NEVER";     // Free Cooking で出すか（OD-R2）
}

// (3) Cooking Trace（runtime。PizzaState に追加する、追記だけのログ）
interface CookingTraceEntry {
  step: MakingStep;           // どの工程を confirm したか
  seq: number;                // 何番目に confirm したか（順序）
  phase: "PREPARE" | "POST_BAKE";
  ingredientIds: string[];    // その工程で増えたもの
  params?: Record<string, unknown>;  // dough の種類、pan、fold の結果など
}
```

**導出**:

- `getCookingProfile(recipe)` = `deriveCoreSteps(recipe)`（今のまま）+ 各 `MechanicRequirement` の `contributeSteps` + CUT（`disablesCut` がなければ）。
- discovery の target = `items` / `sauceBase`（今のまま）+ `capabilities` = 要求の capability + `identityDimensions` = 既定値に `targetIdentity` を重ねたもの。
- `signatureOfPizza(pizza)` = 今の ingredientSet / sauceBase + 各 mechanic の `observeIdentity(trace)` を OBSERVED で重ねる。
- `RUNTIME_SUPPORTED_CAPABILITIES` = registry にある capability。
- Free Cooking の profile = DEFAULT + `freeCook: "ALWAYS"`（または解放済み）の mechanic の工程（**任意**の工程として）。

**今あるものとの対応**（作り直さない。足すだけ）:

| 今あるもの | 使い方 |
|---|---|
| `CookingProfile` / `getCookingProfile` | 導出の出口。15 recipe では結果が変わらない |
| `COOKING_PROFILE_OVERRIDES`（空） | recipe ごとの例外（8 切れなど）|
| `POST_BAKE` / `postBakeSteps` / `isPostBakeStep` | FINISH / CUT |
| `MakingStep` の予約値 | FOLD / SEAL / FINISH |
| `signature.ts` の 11 次元 / matcher | identity の比較。**変更は observe を足すだけ** |
| `MakingStepTabs`（steps / postSteps） | 工程のタブ。導出された profile をそのまま描く |

### 4.3 #220 / PR #189 の 11 mechanic の対応

| capability | kind | 工程の位置 | identity の次元（`signature.ts`） | 観測に要るもの | completion（未完成） | quality | CUT | 操作 / UI | 費用 |
|---|---|---|---|---|---|---|---|---|---|
| `LATE_ADDITION` | STEP | `FINISH`、POST_BAKE、CUT の前（`mid_bake` は短い再 BAKE） | `late: [[mode, ids]]` | trace の FINISH の ingredient | なし（FINISH で何も置かない = identity が違うだけ）| FINISH の配置（Pieces と同じ）| そのまま | TOPPING と同じドラッグ。タブ 1 つ | M |
| `STEP_ORDER` | MODIFIER（順序の制約）| SAUCE / CHEESE の順を入れ替えられる | `layerOrder` | trace の `seq` | なし | role=QUALITY の順序だけ | そのまま | 工程の順番を選べる UI が要る。PizzaStage の描画の重なり順 | S（データ）/ M（UI）|
| `MULTI_SPREAD_LAYER` | MODIFIER（SAUCE）| SAUCE の中で 2 層目 / ドリズル | `spreadLayers` | `sauceIds` を「置き換え」から「重ねる」へ | 層の最低量 | 層ごとの Sauce | そのまま | SAUCE の中でソースを切り替える | M |
| `PREP_STEP` | STEP | TOPPING の前（`PREP`）| `prep: [[mode, ids]]` | trace の PREP | 始めて終わらない = FAILED | 炒め具合 | そのまま | 新しいミニ操作 | M |
| `ENCLOSE` | STEP | PREPARE の最後（`FOLD` → `SEAL`）| `enclosure` | trace の FOLD / SEAL | FOLD して SEAL しない = FAILED（未完成）| とじ目の質 | **無効** | 新しい操作 2 つ、折った形の描画 | L |
| `PAN_BAKE` | PARAMETER（DOUGH / BAKE）| DOUGH で型を選ぶ | `pan` | trace の DOUGH の params | なし | bake の曲線が変わる | 形による | DOUGH の中で選ぶ | M |
| `DOUGH_VARIANT` | PARAMETER（DOUGH）| DOUGH で生地を選ぶ | `dough` | trace の DOUGH の params | なし | 生地の質（D3B）| そのまま | DOUGH の中で選ぶ | S |
| `DOUGH_SHAPE_TARGET` | MODIFIER（DOUGH + CUT）| DOUGH の目標の形 | `shape` | `doughShape` の分類ルール（今は UNAVAILABLE）| なし | 形の近さ | 形に合わせた CUT | 目標の形の表示 | L |
| `ZONED_PLACEMENT` | MODIFIER（SAUCE / TOPPING）| 領域を分ける | `zones` | 位置の zone の分類ルール（今は UNAVAILABLE）| なし | 領域ごとの配置 | そのまま | 領域の線の表示 | M |
| `FRY_COOK` | STEP（BAKE の代わり）| BAKE → FRY | `cook` | trace の cook method | 揚げ過ぎなど | 揚げ具合 | 形による | BAKE の画面の別版 | L |
| `LAMINATE` | STEP | DOUGH の後、TOPPING の前 | `laminate` | trace の LAMINATE | 始めて終わらない = FAILED | 層の数 | 形による | 新しい操作 | L |

**recipe ごとの if 文を増やさないための約束**:

- reducer は `makingStep` と `MechanicDefinition` だけを見る。`recipe.id === "calzone"` のような分岐を書かない（data 以外のコードに recipe id の文字列がないことを test で検査できる。今の例外は `margherita` の 4 箇所だけ。§13）。
- mechanic の効果は、recipe のデータ（`MechanicRequirement`）→ registry → 導出、の一方向だけ。

---

## 5. Official Recipe Discovery

### 5.1 判定の式

```
Official(recipe) ⇔
     ingredientSet(pizza) == items(recipe)          （種類。今のまま。個数は見ない = OD-5）
  ∧  sauceBase(pizza)     == sauceBase(recipe)
  ∧  ∀ 次元 d: observed(pizza, d) == target(recipe, d)    （作り方）
  ∧  recipe の capability がすべて runtime にある
  ∧  cooking completion（§6）が PASS
```

→ matcher.ts の `candidateAssumptions` は、すでにこの形になっている。変えるのは **observe（FIXED_BY_FLOW → OBSERVED）** だけ。

### 5.2 Calzone の例

| プレイヤーの操作 | ingredientSet | enclosure | 結果 |
|---|---|---|---|
| tomato, mozzarella, ricotta, salami をのせて FOLD → SEAL | 一致 | `fold` | **Calzone を発見** |
| 同じ材料で FOLD しない | 一致 | `null` | Calzone ではない。同じ集合の平らな公式 recipe がなければ **Original Pizza** |
| 同じ材料で FOLD したが SEAL しない | 一致 | —（未完成）| **FAILED**（料理として終わっていない。§6）|
| salami を 1 個だけにして FOLD → SEAL | 一致 | `fold` | **Calzone を発見**。★は Q で下がる（OD-1 / OD-2 / OD-5）|
| olive を足して FOLD → SEAL | 不一致 | `fold` | Original Pizza（包んだオリジナル）|

### 5.3 STEP_ORDER: 「identity の順序」と「quality だけの順序」

- `MechanicRequirement.role`: `"IDENTITY"`（既定）か `"QUALITY"`。
  - **IDENTITY**: `targetIdentity` が `layerOrder: "cheese-before-sauce"` を返す。違う順序なら別の料理（Trenton Tomato Pie と NY の違い。PR #189 P0-COLL-1）。
  - **QUALITY**: identity には入れない。`quality()` が順序の違いを減点するだけ（例: 仕上げのハーブを焼く前に置いた）。
- 決め方: PR #189 の matrix で `requiredCapabilities` に `STEP_ORDER` がある行（2 行）だけが IDENTITY。profile のテキストや推測だけの行（`candidateCapabilities`）は QUALITY か、何もしない。**証拠のない順序で discovery を落とさない。**
- 同じ区別を LATE_ADDITION にも使える: バジルを焼いた後にのせるのが「上手」なだけなら QUALITY、焼いた後にのせることが料理の定義なら IDENTITY。

### 5.4 今の Free Cooking の経路との整合

`resolveFreeCookPizza` の順序（1. recipe に関係ない完成の判定 → 2. matcher → 3. 一致した recipe の gate）はそのまま使える。変えるのは:

- 1 に「cooking completion」（始めた工程が終わっているか）を足す（§6）。
- 3 は #215 の実装で G1 になる（数量で `INCOMPLETE_MATCH` にならない）。

---

## 6. Original Pizza

### 6.1 今の runtime（main）

| 結果 | 条件 | スコア | Dex | Pitz |
|---|---|---|---|---|
| FAILED | Free Cooking の完成判定: 何ものっていない / 生 / 焦げ（`evaluateFreeCookCompletion`）| なし | なし | なし |
| MATCHED | 一致して、その recipe の gate が PASS | あり | あり | あり |
| ORIGINAL | 一致なし / AMBIGUOUS / INCOMPLETE_MATCH | **なし** | なし | なし |

`ResultPanel` には「🎨 オリジナルピザ完成！」のカードがある。**Original Pizza はすでに「失敗ではない完成」として存在している。**

### 6.2 3 つの状態の定義（提案）

```
Cooking completed?  ──NO──▶ FAILED    （料理として終わっていない）
      │ YES
Official Recipe Matcher
      ├─ UNIQUE_MATCH ─▶ OFFICIAL   （その recipe として Completion / Quality を評価）
      └─ NO_MATCH / AMBIGUOUS ─▶ ORIGINAL （完成しているが、公式 recipe ではない）
```

**FAILED（cooking completion）の条件**は、recipe に関係なく決める:

1. 何ものっていない（今と同じ）
2. bake が汎用の幅の外（生、焦げ。今と同じ）
3. **始めた structural な工程が終わっていない**（FOLD して SEAL していない、PREP を始めて終えていない）← mechanic registry の `completion()`
4. POST_BAKE の必須の工程（CUT の本数）が足りない（今は CTA が押せないので起きない）

**FAILED にしないもの**:

- 公式 recipe と種類が違う → ORIGINAL
- 工程をしなかった（FOLD しない、FINISH しない）→ identity が違うだけ。ORIGINAL か、別の OFFICIAL
- 数量が足りない → OFFICIAL のまま Q で下げる（OD-1 / OD-2）

**Recipe mode（注文がある）の場合**: 注文の recipe と identity が違う（例: Calzone の注文で包まなかった）は、今の Completion Gate の `MISSING_REQUIRED_INGREDIENT` と同じ扱いで FAILED にする（「注文と違う」）。Lunch Rush は LR-A のとおり。**「料理として未完成」と「注文と違う」を、failure reason で分ける**（`STEP_INCOMPLETE` と `ORDER_MISMATCH`）。

### 6.3 `INCOMPLETE_MATCH` のこれから

#215 の実装後は、数量では起きない。残るのは「種類は一致したが、その recipe の sauce の最低量 / bake の幅に届かない」だけ。表示は今のまま（ORIGINAL + 惜しい、の一言）でよい。

### 6.4 Original Pizza のスコアと報酬（Owner Decision が要る: OD-R1）

- 今はスコアなし。**recipe に関係ない Quality**（bake、sauce の広がり、配置の均一さ、生地）は、生成 Reference（§9 の D 案）があれば計算できる。
- ★ / Pitz を出すかは経済の判断（#38 / #217 の範囲）。**この監査では決めない。**architecture としては「ORIGINAL にも `qualityResult?` を持てる型」にしておく。

---

## 7. My Recipe（監査だけ。実装しない）

### 7.1 保存する候補のデータ

| データ | 由来 | 用途 |
|---|---|---|
| `id` | `my:<uuid>`（**`RecipeId` の名前空間と分ける**）| Dex / 注文 |
| `name` | プレイヤーの入力（`displayNameValidation.ts` と同じ種類の検証）| 表示 |
| dough / pan / shape | trace の DOUGH の params | identity |
| sauce（層） | `sauceIds` / `spreadLayers` | identity |
| ingredients（種類） | `ingredientSet` | identity |
| quantities | 実際に置いた個数 | 理想量（Quality の目標）|
| cookingSteps / step order | cooking trace | identity + quality |
| placement profile | 置いた位置（正規化した座標）| **そのまま Scoring 2.0 の Reference になる**（自分のお手本）|
| bake target | 焼いた値の周り（幅は汎用） | Completion / Quality |
| cut target | 切れ数 | Quality |

→ **Original Pizza の結果（signature + trace + 位置 + bake）を残しておけば、My Recipe は後から作れる。**今やることは「RESULT で ORIGINAL の trace を捨てない型」にすることだけ。

### 7.2 Free Cooking → Original → My Recipe → Menu → Lunch Rush の評価

| 段階 | 可能か | 条件 / リスク |
|---|---|---|
| Free Cooking → Original | 可能（今ある）| — |
| Original → Save as My Recipe | 可能 | save schema v3（§7.3）|
| My Recipe → Menu（Recipe Select） | 可能 | `PizzaSelectScreen` は `recipes` を props で受ける。`Recipe` 型の代わりに「OFFICIAL か MY」の union が要る |
| My Recipe → Recipe mode で作る | 可能 | 生成 Reference（§9）か、保存した位置を Reference にする |
| My Recipe → **Lunch Rush の注文** | **条件付き** | ranking の公平性: 自分で作った簡単な recipe（具材 1 種）で点を稼げる。**ranked の Lunch Rush には入れない**か、ruleset を bump する。Owner Decision（将来）|

### 7.3 save schema / migration のリスク

| リスク | 内容 | 対策 |
|---|---|---|
| 未知の id を捨てる | 今の `sanitizeDex` は `isKnownRecipeId` で未知の id を捨てる | `my:` の id は別の配列（`myRecipes`）に置く。Dex には入れないか、Dex の id を `RecipeId | MyRecipeId` にして sanitizer を分ける |
| downgrade | 新しい版で保存 → 古い版で開くと消える | PR #206（3-4B forward-compat）が先に要る |
| ingredient の改名 | canonicalization（PR #189）で id が変わると My Recipe が壊れる | ingredient の alias の表を残し、load 時に置き換える |
| 公式 recipe と同じ identity | 後で公式 recipe を足すと My Recipe と重なる | 公式が勝つ。My Recipe は「公式 ○○ と同じ」と表示して残す |
| 容量 | 位置の配列が大きい | 1 件 < 2KB、上限 N 件（例 30）|
| クラウド | #129 と一緒に | 今は local だけ |

### 7.4 判定

**今は実装しない。**architecture の約束だけ決める: `MyRecipeId` を `RecipeId` と分ける / ORIGINAL の trace を捨てない / #206 を先に入れる。

---

## 8. Recipe Collision

### 8.1 対象の集合（PR #189 の matrix と #221 の authoring）

| recipe | identity の集合（ソースを含む）|
|---|---|
| Margherita（出荷済み） | tomato-sauce, mozzarella, basil |
| Melanzane | tomato-sauce, mozzarella, basil, **eggplant** |
| Parmigiana | tomato-sauce, mozzarella, basil, eggplant, **parmigiano** |
| Hawaiian | tomato-sauce, mozzarella, ham, **pineapple** |
| Bambino | tomato-sauce, mozzarella, ham, **corn** |

Margherita ⊂ Melanzane ⊂ Parmigiana（真の部分集合の鎖）。Hawaiian と Bambino は兄弟（共通部分が 3、違いが 1 つずつ）。

### 8.2 matcher の比較

| プレイヤーの pizza | A: most-specific（含まれる最大の recipe） | B: exact identity（今）| C: weighted（似ている度合い） |
|---|---|---|---|
| tomato, mozz, basil | Margherita | Margherita | Margherita |
| + eggplant | Melanzane | Melanzane | Melanzane |
| + eggplant + parmigiano | Parmigiana | Parmigiana | Parmigiana |
| + eggplant + parmigiano + oregano | **Parmigiana**（余計な物を無視）| **Original** | Parmigiana か Original（閾値次第）|
| tomato, mozz, basil, oregano | **Margherita** | **Original** | Margherita（近い）|
| tomato, mozz, ham, pineapple, corn | **AMBIGUOUS**（Hawaiian と Bambino が同じ大きさ）| **Original** | 同点 → 決まらない |
| tomato, mozz, ham | 一致なし | Original | Hawaiian / Bambino のどちらかに近い |

| 評価軸 | A | B | C | D: B + 近い recipe のヒント |
|---|---|---|---|---|
| 説明できるか | 中（「余計な物は無視」）| **高**（「材料がそろえば」）| 低（隠れた点数）| **高** |
| Original Pizza の余地 | **ほぼ消える**（どんな superset も公式になる）| 残る | 閾値次第 | 残る |
| 基本原則との一致 | 「そろえば発見」を「含めば発見」に広げてしまう | 一致 | 一致しない（「だいたい」で発見）| 一致 |
| 決定的か | 同点がある | **常に決まる**（catalog の一意性を test で守る）| 同点がある | 常に決まる |
| 100+ recipes | 鎖と兄弟が増えるほど AMBIGUOUS が増える | 集合が一意なら衝突しない | 閾値の調整が要る | B と同じ |
| 今のコード | 変更が大きい | **今のまま**（Phase-2 §2.3 ルール 1）| 新規 | B + 表示だけ |

### 8.3 推奨: **D（B の完全一致 + ORIGINAL の結果に「近い recipe」のヒント）**

- discovery は **B の完全一致だけ**（今の matcher のまま）。
- ORIGINAL の Result に、集合の距離で一番近い公式 recipe を「ヒント」として出してよい（例: 「マルゲリータに何か足したね」）。**discovery にはしない。**Free Cooking の onboarding のヒント（#198）と同じ位置づけ。
- ヒントは、まだ発見していない recipe の**名前を出さない**（`mysteryLock` / 3-3 の onboarding の規則に合わせる）。

### 8.4 Original Pizza に落ちる条件（まとめ）

1. どの公式 recipe とも ingredient の種類が一致しない（多い、少ない、違う）
2. 種類は一致するが、sauce base が違う（同じ材料を違う役割で使った）
3. 種類は一致するが、identity の次元（作り方）が違う（包まなかった、順序が違う）
4. 公式 recipe の capability が runtime にない（まだ作れない料理）
5. AMBIGUOUS（BLOCKED の target と同じ signature、fugazza / fugazzetta など）
6. 種類は一致するが、その recipe の sauce の最低量 / bake の幅に届かない（`INCOMPLETE_MATCH`、#215 後は数量では起きない）

### 8.5 100+ recipes での守り方

- **catalog の一意性の test**: ELIGIBLE な target の `(items, sauceBase, identityDimensions)` がすべて違う。`discoveryCatalog.test.ts` の「all runtime signatures are unique」がすでにあり、`RECIPE_DISCOVERY_CATALOG` から導いているので、そのまま全件に効く。mechanic を入れたら、signature の key に identity の次元が入っていることを確認する。
- **部分集合の鎖の test**: 鎖（Margherita ⊂ Melanzane ⊂ Parmigiana）と兄弟（Hawaiian / Bambino）を fixture にして、上の表を固定する。

---

## 9. Reference Pizza の scalability

### 9.1 今の状態

- `referencePizza.ts` 973 行で 15 recipe。1 recipe あたり約 40〜60 行（具材の位置を手で書く）。
- ソースの目標値はすでに生成（`computeMechanicalSauceReference`）。**手書きは具材の位置だけ。**
- `playerReference.ts`（お手本の表示）は、すでに `requiredIngredients` から**生成**（8 スロットのリング `PIECE_RING_POSITIONS`）。Scoring 2.0 とは意図して分けている（Issue #47）。
- Scoring 2.0 は Reference がないと `available:false`（スコアなし）。

### 9.2 比較

| 案 | 内容 | 100+ での作業 | Scoring V2 互換 | リスク |
|---|---|---|---|---|
| A. recipe ごとに手書き | 今のまま | 約 5,000〜7,000 行。レビューも同じ量 | 完全 | 書き忘れで型エラーが出ない。具材 >8 の配置は毎回考える |
| B. ingredient の配置テンプレート | 具材ごとに landing / 半径 / 大きさ | 具材の数（169）だけ | 高 | 位置そのものは決まらない |
| C. recipe の archetype テンプレート | 「均一に散らす」「中央に卵」「リング」など数種 | archetype 数種 + recipe ごとに 1 語 | 高 | archetype に合わない recipe がある |
| **D. 生成 + override** | C + B で位置を生成。既存 15 は override として今の値を残す | **ほぼ 0**（override は必要なときだけ） | **15 recipe のスコアは byte 単位で同じ**（override が今の値）| 生成の位置が「到達可能」かを test で守る必要がある |

### 9.3 推奨: D（C + B の上に）

```
getReferencePizza(recipe) =
  REFERENCE_OVERRIDES.get(recipe.id)       // 既存 15 recipe（今の値そのまま）
  ?? generateReferencePizza(recipe)        // 新しい recipe
generateReferencePizza:
  sauce      = computeMechanicalSauceReference(recipe.id)          // 今のまま
  positions  = archetype(recipe).layout(Σ 理想量)                   // 例: 均一な散らし（N 点、ふちを残す）
  groups     = 具材ごとに、理想量の点を交互に割り当て
  matching / interaction = ingredient のテンプレート（HEAVY_SQUASH / LIGHT_LEAF、半径）
```

- **互換性**: `SCORING_V2_RULESET_VERSION` を上げる必要がない（既存 15 は override で同じ値）。新しい recipe は最初から生成の値。
- **到達可能の test**（全 recipe、`it.each`）: 生成した Reference どおりに置いたピザが Scoring 2.0 で ≥ 90（★5）、具材どうしが `MIN_TOPPING_DISTANCE`（9）より近くない、全点が生地の中。
- **authoring の費用**: 新しい recipe は 0 行（archetype を 1 語選ぶだけ）。特別な形の recipe（中央に卵 = bismarck 型）は archetype か override。
- お手本の表示（`playerReference.ts`）は、Issue #47 のとおり Scoring とは分けたままでよい。**ただし 8 スロットのリングは上限がある**（§10.3）。同じ layout の生成関数を使えば、表示と採点が同じ位置になる（Issue #47 の「採点の位置を表示に出さない」という方針と矛盾するかを owner に確認する。技術的には選べる）。

---

## 10. W1 との統合

### 10.1 【発見】#220 と #221 の W1 の集合が一致しない

| | #220（`first10CandidateSet`、HEAD `e49dab9`）| #221（W1 authoring、HEAD `279b6b1`）|
|---|---|---|
| 両方にある | Pizza Portuguesa, Pesto Tonno, Parmigiana, Melanzane, Puttanesca | 同じ |
| #220 だけ | New Haven Apizza, Hawaiian, Bambino, Pesto Caprese, Pesto Patate | — |
| #221 だけ | — | **Aussie, Bacalhau, Full English, Polish Kielbasa, Tsukimi** |
| 新しい ingredient | 7（capers, clam, corn, eggplant, fresh-tomato, pineapple, potato）| 6（baked-beans, capers, eggplant, green-onion, salt-cod, sauerkraut）|

- #221 だけにある 5 件は、#220 の行ではすべて `sauce_base_status = none`（ソースなし）。**#220 は `SAUCELESS_RECIPE_CONTRACT` として W4 に置いている**（例: `aussie-pizzadb … W4 … RUNTIME_CONTRACT_CHANGE_REQUIRED … SAUCELESS_RECIPE_CONTRACT`）。
- #221 は「current mechanics: all 10 FULL」「Aussie READY」としているが、今の runtime では:
  - `RECIPE_SAUCE_PROFILES` は `Record<RecipeId, …>` で、ソースのない recipe を書けない
  - `ReferencePizza.sauce` は必須（ソースなしの Reference を書けない）
  - Scoring 2.0 の Sauce の重みは 52/100。ソースがないと Sauce の component が 0 に近くなる
- → **#221 の Aussie の READY は、今の runtime では成り立たない。** #221 の sourceRefs には「PR #220 (OPEN)」があるが、集合を引き継いでいない。
- この監査では #221 の branch を変更しない。**W1 の実装の前に、#220 と #221 のどちらを SSOT にするか決める必要がある**（§15 の B-1）。

### 10.2 Pizza Portuguesa / Pesto Tonno（両方の W1 にある。新しい ingredient 0）

| | Pizza Portuguesa | Pesto Tonno |
|---|---|---|
| 集合（#221） | tomato-sauce, mozzarella×2, ham×3, egg×1, onion×2, black-olive×2 | pesto, tuna×3, black-olive×2, onion×2 |
| 具材の合計（ソース以外）| **10** | 7 |
| 近い出荷済み | capricciosa（Jaccard 0.5）| tonno-e-cipolla（0.33）|
| mechanic | なし | なし（チーズなし → CHEESE の工程を省く。`deriveCoreSteps` で対応済み）|
| 根拠の確認 | REC-06（オリーブ → black-olive）| REC-09（同じ）|

### 10.3 【発見】具材が 8 個を超える recipe は、お手本の表示（8 スロット）に入らない

- `playerReference.ts` は `PIECE_RING_POSITIONS`（8 点）を `slot % 8` で回す。15 recipe の最大は 8（quattro-formaggi / capricciosa / meat-lovers）。
- `playerReference.test.ts:45` は「同じ recipe の駒が同じスロットに重ならない」ことを検査している。
- #221 の W1: Portuguesa 10、Full English 10、Parmigiana 9、Puttanesca 9 → **このテストが落ちる**（お手本の表示で駒が重なる）。
- → A 案（今の architecture で先に追加）でも、この問題は避けられない。§9 の生成 layout で直すのが自然。

### 10.4 A / B / C の比較

| 案 | 内容 | Portuguesa + Pesto Tonno の作業 | リスク | 後で移すときの費用 |
|---|---|---|---|---|
| A. 今の architecture で先に追加 | 7 ファイル + テスト 9 ファイル。Reference を手書き。8 スロットを直す | recipe ごとに約 14 ファイル | 中: 書き忘れで型エラーが出ない場所が 3 つ。8 スロットの修正が別に要る | 高: W1 の 10 件すべてを後で移す |
| **B. 新しい architecture の Vertical Slice** | PR 1: Recipe Definition の一元化（15 recipe の結果は変えない）+ 生成 Reference + 数を固定しないテスト。PR 2: 2 recipe を定義 1 件ずつで追加 | PR 2 は recipe ごとに約 1 ファイル（+ テストの数の snapshot）| **低**: PR 1 は「15 recipe の出力が byte 単位で同じ」を test で証明できる。PR 2 は小さい。mechanic は関係しない | 0 |
| C. foundation の後に追加 | B の PR 1 を全部終えてから W1 | B と同じ | 低 | 0 |

**判定: B が最小リスク。**

- B と C の違いは「foundation の完成を待つか」だけ。B は foundation の**最初の消費者**として 2 recipe を使うので、「1 recipe = 1 定義」が本当に成り立つかを早く確かめられる。
- A は短く見えるが、>8 個の問題と 3 つの静かな必須ファイルを W1 の 10 件で 10 回踏む。
- 順序の制約: foundation（`recipes.ts` / `referencePizza.ts` / `discoveryCatalog.ts` を触る）は 3-4C（#214 系）と衝突しうるので、**3-4C の merge の後**。#206（3-4B）は先に要る（新しい recipe の Dex を rollback で失わないため）。

---

## 11. 最初の Cooking Step の Vertical Slice

### 11.1 比較（LATE_ADDITION / STEP_ORDER / ENCLOSE / PAN_BAKE）

| 評価軸 | LATE_ADDITION（post_bake） | STEP_ORDER | ENCLOSE | PAN_BAKE |
|---|---|---|---|---|
| implementation size | **M**（FINISH の reducer case、trace、observe）| S（データ）+ M（順番を選ぶ UI）| **L**（FOLD / SEAL の 2 操作、折った形の描画）| M（DOUGH の選択 + bake の曲線）|
| architecture impact | **小**: `POST_BAKE` はすでに動いている（15 recipe の CUT）。`FINISH` は予約済み | **中〜大**: 「一方向の固定順」という不変条件を崩す。PLACE_TOPPING の分類 × 工程の制限を変える | 大: CUT を無効にする分岐、描画、隠れた具材の採点 | 中: 形（DOUGH_SHAPE_TARGET）と一緒でないと 8 行中 7 行が使えない |
| touch interaction | **TOPPING のドラッグと同じ** | 同じ操作。順番の選び方が新しい | 新しい操作 2 つ | 選ぶだけ |
| UI | タブ 1 つ（仕上げ）| 工程の順を選ぶ UI | タブ 2 つ + 折った形 | DOUGH の中の選択 |
| scoring | FINISH の配置（Pieces の再利用）。焼いていない見た目 | 順序の quality | とじ目の質、中の具材は見えない | bake の曲線を変える |
| discovery | `late` の次元を OBSERVED にする | `layerOrder` | `enclosure` | `pan` |
| save | なし | なし | なし | なし |
| Lunch Rush | 工程が 1 つ増える（時間）。ranking の ruleset は変えない | 同じ | 同じ（時間の増え方が大きい）| 同じ |
| E2E | 1 spec（POST_BAKE の既存 helper を使える）| 1 spec | 2 spec | 1 spec |
| WebKit | 既存のドラッグの helper | 同じ | 新しいジェスチャーの検証 | 少ない |
| Human Verification | 要（新しいタブ）| 要 | 要（大きい）| 要 |
| 再利用できる行 | **必須 12（これだけで 9）+ 候補 11** | 2（これだけで 1）| 5（これだけで 2）| 8（これだけで 0）|
| rollback | registry から 1 行消す。POST_BAKE は CUT のために残る | UI の変更を戻す | 大きい | 中 |
| 最初の公式 recipe | BBQ Chicken（READY、blocker なし。新しい ingredient 3: bbq-sauce、chicken、cilantro）| Trenton Tomato Pie（新しい ingredient 0、READY_WITH_REVIEW）| Calzone（COMPOSITION_CONFLICT で BLOCKED）| なし（形と一緒）|

### 11.2 判定: **LATE_ADDITION（`post_bake` モードだけ）**

- STEP_ORDER は content の費用が 0（Trenton）という利点があるが、**「一方向の固定順」と「分類 × 工程の制限」という reducer の不変条件を崩す**。最初の slice で最も避けたい種類の変更。
- LATE_ADDITION は既存の `POST_BAKE` と CUT の経路をそのまま使える。`mid_bake`（再 BAKE）は 2 つ目の slice に分ける。
- **分け方**:
  - R2a: mechanic registry + cooking trace + `FINISH` の reducer case + `late` の observe。Free Cooking に「仕上げ」を任意の工程として出す（OD-R2）。**公式 recipe は足さない**（test だけの target で discovery を確認）。
  - R2b: 最初の公式 recipe。BBQ Chicken は新しい ingredient が 3 つで、bbq-sauce は `RecipeSauceProfile.ingredientId` の閉じた union（`UNSUPPORTED_SAUCE_ID_CONTRACT`）を広げる必要がある。**どの recipe を最初にするかは owner の判断**（OD-R4）。
- 注意: FINISH の具材は焼けていない見た目にする（`bakeVisual` の対象から外す）。CUT は FINISH の後（Phase 0 §1.1 の FINISH → CUT）。

---

## 12. Mobile UI（390×844 / 360×800）

実機の測定はしていない（設計だけ）。今の実装と既存の Human Verification の報告から評価した。**実装のときに 390×844 / 360×800 の screenshot と video で確認する**（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）。

| 画面 | 今 | 100+ recipes / 工程が増えたときの課題 | 提案 |
|---|---|---|---|
| Recipe Select | 1 画面の pager（#88）、セクションは配列の位置から | 100+ で pager が長い | カテゴリ（ソース系統）と「発見済み / 未発見」のフィルタ。recipe の定義に `category` を持たせる |
| Free Cooking | 持っている材料をすべて出す tray（ページング）| 工程が増えると「いつ何ができるか」が分からない | 任意の工程は常に出さない。**BAKE の後に「仕上げる？ / このまま完成」の 1 枚のシート**を出す（解放済みのときだけ）|
| Cooking Step navigation | `MakingStepTabs`: 生地 / ソース / チーズ / 具材 / 焼く / カット（最大 6）| FINISH が加わると 7。360px では 1 タブ約 47px（16px の余白を引いた 328px ÷ 7）で、「仕上げ」「折りたたみ」が窮屈 | **recipe に要らない工程は出さない**（今の `deriveCoreSteps` の方針を mechanic に広げる）。POST_BAKE の工程は「焼いた後」の区切りで出す。ラベルが長いもの（折りたたみ）は短く（たたむ）|
| Result | 1 画面（#180）、ORIGINAL のカードあり | Original に Quality を出すと行が増える | ORIGINAL は「作り方の要約（包んだ / 仕上げた）」1 行 + 近い recipe のヒント 1 行まで |
| Dex | `RECIPES` を全件出す | 100+ で長い。My Recipe を混ぜると分かりにくい | 公式とオリジナルをタブで分ける。検索 / フィルタ |
| Original Pizza Result | 🎨 のカード、材料の一覧 | trace を出すと長い | 材料のアイコン列 + 工程のアイコン（🔥 / 🌿仕上げ / 🥟包む）|

---

## 13. Test Architecture（100+ recipes で recipe ごとの大きな E2E にしない）

| 層 | 何を | recipe ごとか | 書き方 |
|---|---|---|---|
| Data contract | 全 recipe の定義が正しい: ingredient が存在する / ソースの profile がある（またはソースなしと明示）/ discovery の target が一意 / capability が registry にある（なければ未公開）/ CUT の可否 / 具材の合計がお手本の layout に入る | 全件（`it.each(REGISTRY)`）| **「15」を固定しない。**代わりに recipe の id の一覧を snapshot にして、消えたり増えたりしたら差分で気付く |
| Recipe matcher | 完全一致、部分集合の鎖、兄弟、sauce base の役割、identity の次元、BLOCKED → AMBIGUOUS | fixture（鎖・兄弟）+ catalog 全件の一意性 | 表の形の test |
| Cooking step engine | mechanic ごとに: 工程の導出、reducer の遷移、trace、observe、completion（未完成）| **mechanic ごと** | registry の各 entry に 1 つの test file |
| Scoring | component ごと + archetype ごとの golden（生成 Reference の到達可能）+ ruleset の version | archetype ごと + 全件の到達可能（軽い）| unit |
| Discovery | `resolveFreeCookPizza` の結果の種類ごと（FAILED / OFFICIAL / ORIGINAL / AMBIGUOUS / INCOMPLETE）| 種類ごと | unit |
| Save compatibility | v1 / v2 の fixture、未知の id（#206）、My Recipe（将来 v3）| schema ごと | unit |
| Representative E2E（Chromium） | 標準の recipe 1、Free Cooking の発見 1、Original 1、mechanic ごとに 1、Lunch Rush 1 | **mechanic / 経路ごと** | 390×844 と 360×800 |
| WebKit | 上と同じ代表のセット（#207 の shard）| 同じ | — |
| Human Replay | mechanic を入れるとき、UI を変えるとき。content の wave では新しい ingredient の見た目の spot check（screenshot）| mechanic ごと | policy のとおり |

**「recipe ごとの if 文がない」ことの検査**: `src/state/**`、`src/logic/**`、`src/mission/**`、`src/shared/**`、`src/components/**`、`src/screens/**`、`src/App.tsx`（test を除く）に、recipe id の文字列が出てこないことを確認する test。main で数えた今の例外は 4 箇所で、すべて `margherita`: `state/starterStock.ts:27`（Starter Grant の対象外）、`logic/economySimulation.ts:212,218`、`App.tsx:802`。これらは明示の allowlist にする。`src/data/**` は recipe のデータなので対象外。

---

## 14. 推奨の順序と、次の Issue

### 14.1 順序

```
#206 (3-4B) → 3-4C（#214 系）→ #215 の実装（OD-1〜5。= この監査の「Phase A1」の読み）
                                  │
                                  ▼
R0  Recipe Definition の一元化（15 recipe の出力は同じ）+ 生成 Reference（override に既存 15）
    + 数を固定しないテスト + 「静かな必須」をなくす（order / Reference / CUT を定義から導く）
R1  Vertical Slice: Pizza Portuguesa + Pesto Tonno（REC-06 / REC-09 の確認の後）
R1+ 残りの W1（#220 / #221 の集合を決めた後）
R2a mechanic registry + cooking trace + LATE_ADDITION（post_bake）+ Original の 3 状態の型
R2b 最初の LATE_ADDITION の公式 recipe（OD-R4）
R3  DOUGH_VARIANT → MULTI_SPREAD_LAYER（PR #189 の順）… 構造的なもの（ENCLOSE / PAN_BAKE / 形）は後
（My Recipe は R3 以降。save v3）
```

### 14.2 次に作る Issue（新規 1 件。まだ作っていない）

- 題: **Recipe Architecture 1.0: Recipe Definition registry / generated Reference / mechanic registry / Original Pizza 3-state**
- 範囲: R0 / R1 / R2a（R2b 以降は content なので #182 の子）
- 親: #182（content）と #176（工程）の両方から参照
- 受け入れ: 15 recipe の Scoring / Completion / Discovery / CUT / 工程の出力が byte 単位で同じ。recipe の追加が 1 定義で済む。recipe id の文字列の検査。

---

## 15. Blocker / Owner Decision（残っているものだけ）

### Blocker

| ID | 内容 | 止めるもの | 解消の方法 |
|---|---|---|---|
| **B-1** | #220 と #221 の W1 の集合が違う。#221 の 5 件（Aussie ほか）はソースなしで、今の runtime では表現できない（§10.1）| W1 の実装すべて | #221 で集合を #220 に合わせるか、#220 の W4 の判定を見直すか。どちらを SSOT にするか決める |
| **B-2** | REC-06 / REC-09（オリーブ → black-olive）の根拠 | R1（Portuguesa / Pesto Tonno）| #221 の ledger の確認 |
| **B-3** | 具材 >8 の recipe でお手本の表示（8 スロット）が重なる（§10.3）| 具材 >8 の W1 recipe（Portuguesa、Parmigiana、Puttanesca、Full English）| R0 の生成 layout |
| **B-4** | 実装の順序: 3-4C の merge と #206 | #215 の実装、R0 | 既存の guardrail どおり |

### Owner Decision（新しいもの）

| ID | 判断 | 推奨 | いつまでに |
|---|---|---|---|
| **OD-R1** | Original Pizza に Quality / ★ / Pitz を出すか | 今は出さない。型だけ用意する（§6.4）| R2a の前（出さないなら判断は不要）|
| **OD-R2** | Free Cooking で任意の工程（仕上げ、包む）をどう出すか: 常に出す / 解放したら出す | **解放したら出す**（progression の報酬にする。最初は FINISH だけ）| R2a の前 |
| **OD-R3** | discovery の完全一致の確認: 余計な具材を 1 つ足したら Original（Phase-2 §2.3 のルール 1 のまま）| **B の完全一致 + 近い recipe のヒント（D）**（§8.3）| R1 の前（今のルールのままなら確認だけ）|
| **OD-R4** | 最初の LATE_ADDITION の公式 recipe | BBQ Chicken（READY、blocker なし。ただし新しい ingredient 3 とソースの union の拡張）| R2b の前 |

※ Issue #215 の OD-1〜OD-5（+4b）は決定済み。この監査では変えていない。

---

## 付録 A. 確認したもの / していないもの

- 確認: `main` `dff233c` のソース（`recipes.ts`, `cookingProfiles.ts`, `discoveryCatalog.ts`, `discovery/*`, `completionGate.ts`, `scoringV2/index.ts`, `referencePizza.ts`, `recipeSauceProfiles.ts`, `playerReference.ts`, `pizzaReferenceLayout.ts`, `orders.ts`, `freeCook.ts`, `gameReducer.ts` の工程 / BAKE / Dex の case, `pizzaState.ts`, `persistence.ts`, `mission/lunchRush.ts`, `shared/lunchRushScoring.ts`, `makingStepLabels.ts`, `hints.ts`, `DexOverlay.tsx`, `pizzaSelect.ts`）、PR #189 の 172 行の matrix の JSON、PR #220 の `WAVES.json` / `MATRIX.csv`、PR #221 の authoring の文書、PR #218 の Fresh Audit。
- 数値の出し方: recipe の具材の合計は `recipes.ts` の `minCount`（ソース以外）を足した。W1 の具材の合計は #221 の authoring の表から。capability の数は matrix の `requiredCapabilities` を数えた。
- していない: production code の変更、テストの実行（docs だけの変更なので Vitest / Playwright は対象外）、実機の screenshot / video（設計だけ。実装のときに撮る）、既存 PR の branch の変更、Issue の作成。
