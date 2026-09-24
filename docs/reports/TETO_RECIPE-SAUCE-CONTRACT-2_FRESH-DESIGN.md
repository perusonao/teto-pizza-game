# Recipe Sauce Contract 2.0 — Fresh Design（設計のみ・Owner Decision 未確定）

データ: [`docs/reports/data/TETO_RECIPE-SAUCE-CONTRACT-2_COMPARISON.json`](data/TETO_RECIPE-SAUCE-CONTRACT-2_COMPARISON.json)（172 行の分類・案ごとの判定・dependency map・P0・Owner Decision 項目をすべて収録）

## 0. 結論

- 本書は設計比較である。production 実装・recipe data 変更・sauce ID 追加・Owner Decision の確定は、どれも行っていない。
- 現行の `RecipeSauceProfile` を production で読んでいるのは `src/data/referencePizza.ts:166`（`computeMechanicalSauceReference`）の **1 箇所だけ**。残りの runtime（steps / discovery / tray / hint / thumbnail / inventory）は、sauce を `recipe.requiredIngredients` のうち `Ingredient.category === "sauce"` のものから別途導いている。一方で「pizza に sauce は 1 つ」という前提は reducer・`PizzaState`・描画・Completion Gate・Scoring 2.0・discovery signature のすべてに入っている。
- 172 行を #189 matrix と Evidence Pack で分類した。sauce 構成が 1 通りに確定する行は **117**、未確定は **55**（未確定の行は確定値として数えない）。
- 確定 117 行の内訳: 単一 supported base **57** / 単一 new sauce **15** / 純 sauceless **24** / sauceless + spread 層 **11** / base + 追加層 **10**。
- 候補 contract は 4 案 + 現行 baseline で比較した。確定行のうち、sauce contract の追加 runtime 変更なしに表現できる行数（sauce ID は registry 方式とした場合）:

| 案 | sauce 表現可能（確定） | うち役割保持 | sauceless | 2 層以上 | row 全体で追加 runtime なし（確定） | 未確定行の上限込み |
|---|---:|---:|---:|---:|---:|---:|
| BASELINE（現行） | 57 | 57 | 0 | 0 | 30 | 92 |
| A nullable base | 96 | 96 | 24 | 0 | 58 | 157 |
| B layer[] | 117 | 106 | 35 | 11 | 71 | 172 |
| C base + additional layers | 117 | **117** | 35 | 11 | 71 | 172 |
| D profile 廃止・recipe から導出 | 117 | 106 | 35 | 11 | 71 | 172 |

- B / C / D は表現可能な行数が同じになる。違いは次の 2 点に限られる: (1) 「sauceless + olive-oil 層」の 11 行で役割（base か追加層か）を保持できるか（できるのは C だけ）、(2) scoring・UI・移行の性質。
- 最終案は Owner Decision として確定していない（§10）。

## 1. 基準・入力

| 項目 | 値 |
|---|---|
| audited main | `dff233c042d2df6ee1c3a92f2d2419830aa05460`（`git fetch` 直後の origin/main と一致） |
| PR #220 head | `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（GitHub 上 OPEN / clean、head 一致を確認。変更なし） |
| 172 unresolved roadmap | `d5909ece70b0dc57efadcd17715493ea882daf4f` |
| Content Evidence Resolution Pack | `a1dcf4c8bac86c41208236ef66fc8c0e7fa69fb8` |
| PR #189 mechanic matrix | main 上の `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（+ `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md`） |
| 現行 contract | `src/data/recipeSauceProfiles.ts` / `.test.ts`（main, read-only） |

入力ファイルはそれぞれの commit の git object から読んだ（別 branch の checkout はしていない）。sha256 は JSON の `basis.inputs` にある。

## 2. 現行 contract と dependency map

### 2.1 現行 contract

```ts
// src/data/recipeSauceProfiles.ts（main）
type SauceInteractionKind = "PAINT" | "PAINT_TEMPORARY";
interface RecipeSauceProfile { recipeId; ingredientId: "tomato-sauce" | "pesto" | "olive-oil"; interaction }
const RECIPE_SAUCE_PROFILES: Readonly<Record<RecipeId, RecipeSauceProfile>>   // exhaustive, 15 件
```

test は次の 3 点を固定している: 件数が 15 であること（`:8`）、`profile.ingredientId` が recipe の sauce-category 必須 ingredient と一致すること、`olive-oil ⇔ PAINT_TEMPORARY`（`:20-27`）。

### 2.2 sauce identity の出所は 3 つある

| # | 出所 | 読み手 |
|---|---|---|
| ① | `RecipeSauceProfile` | `referencePizza.ts:166` だけ（→ `ReferencePizza.sauce` → Completion Gate の quantity check / Scoring 2.0 Sauce / Reference 表示） |
| ② | `recipe.requiredIngredients` × `Ingredient.category==="sauce"` | `cookingProfiles.ts:125`（SAUCE step の有無）、`App.tsx:109-113,260`（初期選択）、`discoveryCatalog.ts:46`（`sauceBase`）、`IngredientTray.tsx:141`、`playerReference.ts:41-60`、`PizzaThumbnail.tsx:30-43`、`hints.ts:158-171`、`economySimulation.ts:159-169` |
| ③ | ingredient id / placement literal | `PizzaStage.tsx:250`（`placement==="spread"` → paint）、`id === "olive-oil"` で oil の見た目を切り替える箇所が 4 つ（`PizzaStage.tsx:911`, `ReferencePreview.tsx:114`, `PlayerReferencePreview.tsx:97`, `ReferenceThumbnail.tsx:51`） |

①と②が一致していることは test（`recipeSauceProfiles.test.ts`）でしか保証されていない。

### 2.3 dependency map

| 領域 | 主な箇所 | sauce の出所 | 単一 sauce 前提 | sauceless（現状） | new sauce（現状） | 複数層（現状） |
|---|---|---|---|---|---|---|
| recipe data | `recipeSauceProfiles.ts:15`, `recipes.ts`, `ingredients.ts:23` | ①+② | profile は ingredientId 1 つ | 型として不可 | union 追加 + ingredient 追加 | profile / test が拒否 |
| Reference | `referencePizza.ts:71-86,166` | ① | `ReferencePizza.sauce` は必須で 1 つ | ReferencePizza を作れない | profile が通れば自動 | 層ごとの target なし |
| Free Cooking | `data/freeCook.ts`, `logic/discovery/freeCook.ts:53`, `IngredientTray.tsx:141` | `pizza.sauceIds` | sauce を切り替えると置き換わる | sauceless pizza は完成可能 | 所持 sauce はすべて tray に出る | 2 つ目で 1 つ目が消える |
| matching | `discoveryCatalog.ts:46`, `signature.ts:106,148`, `matcher.ts:104` | ②（profile ではない） | `spreadLayers` は `FIXED_BY_FLOW`「one sauce per pizza」 | `[]==[]` で一致 | ingredient があれば一致 | catalog 側は 2 id を持てるが observed 側は持てない → 一致不能 |
| painting | `gameReducer.ts:604-634,658-690`, `pizzaState.ts:54,63`, `PizzaStage.tsx:250,909-911`, `App.tsx:260` | placement / `sauceIds[0]` | `sauceIds:[id]`、fresh application で deposits を消す。deposit log は 1 本で ingredient tag なし | SAUCE step は省略（`cookingProfiles.ts:125`） | 色は data から。oil の見た目は `olive-oil` literal のときだけ | 不可 |
| scoring | `completionGate.ts:116-150`, `scoringV2/index.ts:48,65-80,94-96`, `sauceComponent.ts:57`, `toLegacyScoreBreakdown.ts`, `recipeComponent.ts:67` | ①（quantity/coverage）+ `sauceIds`（presence/purity） | Sauce component は 1 つで 52/100 固定。ingredient id は見ていない | Reference なし → `available:false` → total 0。dummy sauce Reference でも Sauce=0 → total ≤ 48 | Reference があれば可 | 2 層目は採点されない（deposits が混ざる） |
| finished pizza visual | `PizzaStage.tsx:1129-1175`, `ReferenceThumbnail.tsx:42-51`, `ReferencePreview.tsx:61,114,125`, `PlayerReferencePreview.tsx:51,97,107`, `PizzaThumbnail.tsx:30-43` | `sauceIds[0]` / `reference.sauce` / ② | base 色は 1 つ | thumbnail は fallback。ReferencePreview は sauce 必須 | 色は data、oil の見た目は literal | 先頭層しか描かない |
| Lunch Rush | `mission/lunchRush.ts:88-100`, `gameReducer.ts:192-195`, `App.tsx:522-528` | 独自のものなし（継承） | 継承 | scoring P0 をそのまま継承（mission score に 0 / ≤48 が入る） | 継承 | 継承 |
| persistence | `persistence.ts:137-138`, `dex.ts:13-19`, `inventory.ts:85,107-146` | ingredient id のみ | なし（GameState / pizza は永続化しない） | 影響なし | `INGREDIENTS` から自動で受理 | 影響なし（inventory はすでに「sauce id ごとに 1 unit」） |
| tests / E2E | `recipeSauceProfiles.test.ts:8,20-27`、profile を import する test 6 file、sauce id literal を持つ src test 52 file、sauce を扱う e2e 10 file（`gestures.ts` の seed、`making-ui-1screen` の「recipe の sauce だけ表示」）、#220 tool（union が 3 id であることを assert） | ①+literal | sauceIds 長 1 / 置換 semantics を assert している | — | — | — |

## 3. 172 行の sauce 構成分類

分類の規則（JSON `definitions`）:

- **確定** = #189 matrix の `sauceBase` と Evidence Pack の未解決 item を合わせたとき、sauce 構成が 1 通りしかない行。
- **未確定** = 次の 5 つのいずれかに当たる行。取り得る構成をすべて列挙している:
  - base unspecified（family が「その他」→ T / P / O / sauceless / new、他の family → new。行内の listed spread が base そのものである可能性も含める）
  - base token 未解決（ホワイトソース / カレーソース → new）
  - sauceless 行の唯一の層が未解決 token（チーズソース → sauceless または new base）
  - 唐辛子系 alias（scatter のままか、+chili-oil 層か）
  - composition A/B（catalog の `sauce` を base とする A か、PIZZA DB 行の B か）

| class | 172 行 | W0 を除く 162 行 |
|---|---:|---:|
| S1 単一 supported base（T/P/O） | 57 | 52 |
| S2 単一 new sauce | 15 | 15 |
| S3 純 sauceless（層 0） | 24 | 24 |
| S4 sauceless + spread 層（うち 1 層 10 / 2 層 1） | 11 | 11 |
| S5 base + 追加層 | 10 | 10 |
| S6 未確定 | 55 | 50 |

W0 correspondence 10 行のうち確定は 5 行（capricciosa / tonno-e-cipolla / bismarck / genovese / meat-lovers の PIZZA DB 版。いずれも A/B で sauce が同じ）。margherita / marinara（B で +olive-oil）、quattro-formaggi / fugazza（B で sauceless）、breakfast-pizza（B でホワイトソース）の 5 行は、shipped を keep するかどうかの Owner Decision 次第なので未確定に置いた。

#220 との対応: #220 の `SAUCELESS_RECIPE_CONTRACT` 42 行 = 確定 35 行（S3+S4）+ 未確定 7 行（composition 5 / 唐辛子 1 / チーズソース 1）。production 対応行（quattro-formaggi-pizzadb / fugazza-pizzadb）は #220 の数え方でも別扱いになっている。`UNSUPPORTED_SAUCE_ID_CONTRACT` 18 行 = S2 15 行 + okonomiyaki（S5）+ 未確定 2 行（thai-chicken / buffalo-chicken）。#189 の `MULTI_SPREAD_LAYER` required 17 行のうち、層構成が確定しているのは 11 行。

## 4. 論点別の事実

### 4.1 現行 3 sauce

tomato-sauce は 51 行で base として確定（未確定 8）。pesto は 11 行ですべて確定、うち 2 行は追加層あり。olive-oil は base として確定 4 行、**追加層または sauceless 行の層として確定 17 行**、未確定 5 行。catalog では base 12 件。shipped 3 件（quattro-formaggi / fugazza / pizza-bianca）は olive-oil を base・`PAINT_TEMPORARY` として扱っている。

### 4.2 sauceless

純 sauceless（S3）は確定 24 行（チーズ family 22 / ノンソース 1 / チーズ（トマトソースなし）1）。現行 runtime では SAUCE step の省略・Completion Gate・discovery・thumbnail はすでに sauceless を扱える。扱えないのは Reference / Scoring 2.0 だけ（§8 P0-1）。

### 4.3 unsupported / new sauce

S2 の 15 行は、family label が具体的な sauce を名指ししているか、行内に listed の sauce がある行（bbq-sauce / curry-ketchup / salsa / fromage-blanc-sauce / fresh-cream-sauce / mustard / tahini / miso-sauce / nutella-spread / gravy-sauce / sweet-bean-sauce / yuzu-kosho / soy-sauce / doubanjiang / yakiniku-sauce）。どれも ingredient が 1 件追加されれば、1 層・PAINT で描画・採点できる（sauce component は ingredient id を見ていない）。runtime 側に残る課題は次の 2 つ:

- union が closed であること
- oil の見た目が `olive-oil` literal で判定されていること（chili-oil のように透過したい sauce に効く）

### 4.4 multi-spread-layer

確定 11 行（S5 の 10 行 + radicchio-noci の none + balsamic + olive-oil）。すべて #189 で `MULTI_SPREAD_LAYER` が required になっている。S5 10 行の追加層は olive-oil 6 / honey 2 / yogurt-sauce 1 / mayo 1。radicchio-noci は base なしで balsamic-vinegar + olive-oil の 2 層。hot-honey-pepperoni は `LATE_ADDITION` が candidate（post-bake drizzle の可能性）。

### 4.5 mayo / honey 等は base か追加層か

| spread | base として確定 | 追加層として確定 | 役割未確定 | catalog |
|---|---|---|---|---|
| mayo | 0 | 1（okonomiyaki: base = okonomiyaki-sauce） | 5（ホワイトソース 4 / teriyaki 1） | base 0。potato-bacon / shrimp-mayo / teriyaki-chicken の 3 件ではいずれも finishing |
| honey | 0 | 2（pesto-noci, hot-honey-pepperoni） | 3（nashville / nduja / feteer） | honey-fig で finishing |
| blue-cheese-dressing | 0 | 0 | 2 | — |
| kebab-sauce / chutney / melted-butter | 0 | 0 | 各 1 | — |
| olive-oil | 4 | 17 | 5 | base 12 |

事実として言えるのは次のとおり:

- mayo と honey は、172 行でも catalog でも **base として確定した例が 0**。
- 確定した例と catalog の例は、すべて追加層か finishing。
- 役割未確定の 12 行（Evidence Pack の `LISTED_SPREAD_MAY_BE_BASE` 11 行 + composition A/B が残る buffalo-chicken 1 行）は、「行内の spread が base そのものか、追加層か」が未決定のまま残っている。

これを確定させるのは OD-4 である。

### 4.6 curry / white / hot / tare / dessert

| family | 行 | 確定 | 確定 base | 未確定の取り得る結論（Evidence Pack） |
|---|---:|---:|---|---|
| カレー | 7 | 1 | curry-ketchup | new のみ（6） |
| ホワイトソース | 8 | 2 | fresh-cream-sauce, fromage-blanc-sauce | new のみ。mayo が base の可能性あり |
| ホットソース | 8 | 1 | doubanjiang | new のみ。honey / blue-cheese / kebab が base の可能性あり |
| 甘辛だれ | 8 | 4 | miso / okonomiyaki / sweet-bean / yakiniku | new のみ。mayo / chutney が base の可能性あり |
| デザートソース | 5 | 1 | nutella-spread | new のみ。honey / melted-butter が base の可能性あり |

5 family とも、family label と矛盾しない結論は **supported union の外**（Evidence Pack §3.1）。A〜D のどの案でも ingredient registry 方式なら content だけで足りるが、closed union のままなら 1 id ごとに型変更が要る。family ごとに汎用 id を 1 つ置くか、dish 固有の id にするかは OD-9。

### 4.7 shipped 15 recipe との後方互換

shipped 15 件は 12 件が単一 tomato/pesto、3 件が olive-oil base（`PAINT_TEMPORARY`）で、A〜D のどの案でも機械的に変換できる（15/15）。互換を損なう危険がある箇所は次の 3 つ:

- olive-oil 3 件を「base」のまま残すか（C で base = null + layer にすると、scoring と Reference の byte 一致が崩れる）
- Sauce weight 52 を維持すること
- `sauceReset` / `sauceParity` / `ReferenceTruth` の各 test

これを決めるのが OD-3 / OD-10。

## 5. 候補 contract（型の sketch。src には書いていない）

```ts
// 共通: sauce id = Ingredient registry（category "sauce"）の id（ID policy = REGISTRY）
type SpreadLayer = { ingredientId: string; interaction: "PAINT" | "PAINT_TEMPORARY" /* | "DRIZZLE" 予約 */; timing?: "PRE_BAKE" /* | "POST_BAKE" 予約 */ };

// A. nullable base
interface RecipeSauceProfileA { recipeId; base: SpreadLayer | null }

// B. layer[]（base の役割を持たない、順序付き 0..n）
interface RecipeSauceProfileB { recipeId; layers: readonly SpreadLayer[] }

// C. base + optional additional layers
interface RecipeSauceProfileC { recipeId; base: SpreadLayer | null; additionalLayers: readonly SpreadLayer[] }

// D. profile を廃止し recipe data から導出
//   layers = recipe.requiredIngredients.filter(sauce-category)（配列順）、interaction = Ingredient 側の属性
```

## 6. 比較（事実ベース）

| 観点 | BASELINE | A nullable base | B layer[] | C base + additional | D recipe から導出 |
|---|---|---|---|---|---|
| sauceless | 不可 | 可 | 可（`[]`） | 可（`base:null`） | 可 |
| multi-layer | 不可 | 不可 | 可 | 可 | 可（配列順） |
| sauceless + 層（S4）の役割 | olive-oil を base と読み替えた場合のみ（10 行） | 同左 | データ上は可。ただし olive-oil base と区別できない | **役割を保持したまま可** | データ上は可。ただし先頭が base と導出される |
| 既存 15 recipe 互換 | 現状 | 15/15（profile → base） | 15/15（1 層） | 15/15（base=profile, 層なし） | 15/15（②と一致済み） |
| migration complexity | 0 | S: nullable 化 + Reference / scoring の null 分岐 + test | L: reducer / pizzaState / 描画 / gate / scoring / discovery を N 層化し、base 概念を全消費者から外す | L: B と同じ N 層化。ただし単層の消費者は base だけ読めば現状維持 | M〜L: profile を削除し、referencePizza と test の読み先を変更。多層は B/C と同じ作業 |
| scoring impact | なし | sauceless のとき Sauce 52 をどう扱うか決める必要あり。単層は byte 一致が可能 | 52 の割当先（全層まとめて or 層ごと）が曖昧 | base は現行 Sauce component をそのまま使える。追加層の配点は新規に決める | C と同じ論点だが、役割は配列順の規約に依存 |
| UI impact | なし | SAUCE step の省略は既存機能。Reference の null 表示 | SAUCE step 内の層切替、層ごとの heatmap、Result の層別表示 | B と同じ。追加層だけ別行 / 別 step にする余地あり | B と同じ |
| persistence impact | なし | なし | なし | なし | なし |
| 172 行 coverage（確定 / 上限） | 57 / 92 | 96 / 157 | 117 / 172 | 117 / 172 | 117 / 172 |
| future extensibility | 低 | 低〜中（第 2 層・drizzle・post-bake には別の contract が要る） | 中（層に timing / zone を持たせられるが、base の役割を後付けすることになる） | 高（役割が明示される。timing・interaction・zone を layer に足せる） | 中（per-recipe の interaction や timing を表すには recipe 側に項目追加が要り、結局 C と同じ形になる） |

persistence は全案で影響なし。GameState / pizza は永続化されず、save に入るのは dex（recipeId）・inventory / owned（ingredientId）・missionBest・pitz だけで、新しい sauce id は `INGREDIENTS` から自動で受理される。

## 7. 各案で追加 runtime 変更なしに表現可能になる行数

数え方:

- 「sauce 表現可能（確定）」= 確定行のうち、その案の contract を実装した後、content（recipe / ingredient data）だけで sauce 構成を表せる行。
- 「row 全体で追加 runtime なし」= 上に加えて、その行の `requiredCapabilities` と `candidateCapabilities` がすべて案でカバーされる行。B / C / D がカバーするのは `MULTI_SPREAD_LAYER` だけ。
- 未確定行は確定値に入れず、「全結論で可」と「一部の結論で可」に分けた。

### 7.1 全 172 行

| 指標 | BASELINE | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| sauce 表現可能（確定） | 57 | 96 | 117 | 117 | 117 |
| 　うち役割保持 | 57 | 96 | 106 | 117 | 106 |
| 　Q5 読み替え（olive-oil を base とみなす仮定）で増える分 ※確定に含めない | +10 | +10 | 0 | 0 | 0 |
| 未確定: 全結論で可 | 2 | 33 | 55 | 55 | 55 |
| 未確定: 一部の結論で可 | 23 | 18 | 0 | 0 | 0 |
| どの結論でも不可 | 90 | 25 | 0 | 0 | 0 |
| sauceless 対応（確定、S3+S4） | 0 | 24 | 35 | 35 | 35 |
| 　純 sauceless（S3） | 0 | 24 | 24 | 24 | 24 |
| 　sauceless + 層を役割保持で（S4） | 0 | 0 | 0 | 11 | 0 |
| multi-layer 対応（確定、2 層以上） | 0 | 0 | 11 | 11 | 11 |
| new sauce 単層（確定、S2） | 0 | 15 | 15 | 15 | 15 |
| row 全体で追加 runtime なし（確定） | 30 | 58 | 71 | 71 | 71 |
| 　同上で、非 runtime blocker もない | 29 | 56 | 68 | 68 | 68 |
| 　candidate capability を drop した場合（仮定） | 32 | 61 | 80 | 80 | 80 |
| 参考: closed union のまま（確定） | 57 | 81 | 97 | 97 | 97 |

### 7.2 W0 correspondence を除く 162 行

| 指標 | BASELINE | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| sauce 表現可能（確定） | 52 | 91 | 112 | 112 | 112 |
| row 全体で追加 runtime なし（確定） | 27 | 55 | 68 | 68 | 68 |
| 未確定行を含む上限 | 82 | 147 | 162 | 162 | 162 |

確認: BASELINE の「row 全体で追加 runtime なし」30 行には、#220 の W1 10 行・W2 11 行が全件含まれる。残り 9 行の内訳は W3 6 行と W0 3 行。

B / C / D で sauce が確定しているのに runtime が残る行（row 全体の数から外れる理由）の内訳: DOUGH_VARIANT 26 / PAN_BAKE 8 / LATE_ADDITION 5 / ENCLOSE 5 / DOUGH_SHAPE_TARGET 5 / STEP_ORDER 2 / ZONED_PLACEMENT・FRY_COOK・PREP_STEP 各 1。どれも sauce contract の外にある。

### 7.3 仮定（確定値に含めていないもの）

- Q5 読み替え: sauceless 行の唯一の層（olive-oil）を base とみなす。shipped の慣例と同じ扱いだが、evidence としては未確定。
- 未確定行の結論列挙は Evidence Pack の option matrix に従った。「その他」family の結論が T/P/O になるかどうか、は確定していない。
- new sauce は PAINT で描画・採点できるものとした。DRIZZLE interaction は導入しない前提（OD-8）。
- 追加層の timing（post-bake drizzle）は sauce contract の外（`LATE_ADDITION`）として数えた。

## 8. Migration P0

| ID | 対象案 | 事実 | 必要なこと |
|---|---|---|---|
| P0-1 | A/B/C/D | `ReferencePizza.sauce` が必須（`referencePizza.ts:85`）。Reference なし → `available:false` → total 0。dummy の sauce Reference では Sauce(52)=0 → total ≤ 48。Lunch Rush の qualityTotal もこれを継承する | `ReferencePizza.sauce` を nullable にする。base なし recipe の Sauce weight の方針を決める。shipped 15 件の byte 一致を維持する |
| P0-2 | A/B/C/D | exhaustive な Record + `toHaveLength(15)` + `olive-oil ⇔ PAINT_TEMPORARY`。#220 tool は union が 3 id であることを assert している | contract と test を書き直す（#220 tool の assertion は本タスクの範囲外で、壊れる） |
| P0-3 | A/B/C/D（new id） | union が TS literal。oil の見た目が `id === "olive-oil"`（4 component） | sauce id を ingredient registry 方式にする。oil / 透過の見た目を ingredient 側の属性に移す |
| P0-4 | B/C/D | reducer が `sauceIds:[id]` にし、fresh application で deposits を消す。deposit log が 1 本。描画は `sauceIds[0]`。gate / scoring は ReferenceSauce 1 つ。`signature.spreadLayers` は FIXED_BY_FLOW | 層ごとの deposit log、消さない層切替、層ごとの gate / scoring、N 層の描画、discovery の spreadLayers を OBSERVED にする |
| P0-5 | A/B/C/D | shipped 15 件は Reference / visual / score を test で固定している | 移行が機械的な no-op であることを test で証明する。olive-oil 3 件の扱いは OD-3 / OD-10 |
| P0-6 | D のみ | profile の production reader は 1 箇所だけ。他はすでに②から導いている | interaction や役割を Ingredient 側（全 recipe 共通）に置くか、Recipe 側に置くか決める |

## 9. 172 recipe に対する含意（判断ではなく事実）

- A だけでは確定行のうち **21 行**（S4 11 + S5 10）が表現できない。未確定を含めると、どの結論でも表現できない行が 25 行ある。
- B / C / D は確定 117 行をすべて表現できる。未確定 55 行も、全結論で表現できる。
- B / D は S4 の 11 行で「sauceless + olive-oil」と「olive-oil base」をデータ上区別できない。scoring（base に Sauce 52 をかけるかどうか）と discovery（sauceBase）に役割が効く場合、この 2 つが同じものとして扱われる。
- sauce contract を一般化しても、row 全体で追加 runtime が要らなくなるのは最大 71 行（確定）。残りは dough / pan / enclose などの別の capability が必要な行。

## 10. Owner Decision 項目（本書では確定しない）

| ID | 論点 |
|---|---|
| OD-1 | contract の形: A / B / C / D（またはそれ以外） |
| OD-2 | sauce id の方針: ingredient registry か、closed union を 1 id ずつ拡張するか |
| OD-3 | none 行の olive-oil（vongole / bianca / p8 salad 系など）は base か追加層か。shipped の慣例は base |
| OD-4 | mayo / honey / blue-cheese-dressing / kebab-sauce / chutney / melted-butter は base か追加層か（役割未確定 12 行） |
| OD-5 | sauceless recipe の scoring（Sauce 52 を再配分するか、他の方針か） |
| OD-6 | 追加層の scoring（採点する / presence のみ / 採点しない） |
| OD-7 | post-bake drizzle（honey、olive-oil の仕上げ、teriyaki の mayo）を sauce contract に含めるか、LATE_ADDITION に分けるか |
| OD-8 | new sauce の interaction: PAINT / PAINT_TEMPORARY だけか、DRIZZLE を導入するか |
| OD-9 | family（カレー / ホワイト / ホット / たれ / デザート）の sauce id を汎用 1 つにするか、dish 固有にするか |
| OD-10 | shipped 15 件を byte 一致のまま維持するか、W0 行で PIZZA DB 側（margherita / marinara に +olive-oil、quattro-formaggi / fugazza を sauceless）を採用するか |

## 11. 制約の遵守

- 変更しなかったもの: `src/**`・`e2e/**`・recipe data。
- 追加しなかったもの: sauce ID。
- 確定しなかったもの: Owner Decision。
- 手を付けなかったもの: #189 / #217 / #218 / #220 / #221。
- 作成しなかったもの: PR。
- 実行しなかったもの: Full CI・WebKit。
- 変更したもの: `docs/reports/` の本書と `docs/reports/data/` の JSON だけ。branch `claude/recipe-sauce-contract-design-ccqiko` に commit / push した。
- 本書は docs のみの設計で、UI/UX/gameplay の変更を含まない。そのため Human Verification の対象外。
- 集計は scratchpad の builder script（repo には入れていない）で行った。規則は JSON の `definitions` にすべて書いてあり、同じ入力から再計算すると同一の出力になる。
