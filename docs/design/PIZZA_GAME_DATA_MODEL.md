# PIZZA GAME Data Model

Status: Draft v1.0
前提ドキュメント: `PIZZA_GAME_SSOT.md`

データとUIを分離するため、ゲームデータ（食材・レシピ・注文・セリフ）はすべて `src/data` 配下に
TypeScriptの型付きデータとして定義する。UIコンポーネントはこれらのデータを参照するのみで、
食材やレシピを追加する際にコンポーネント側の変更を最小限にする。

## 1. Ingredient（食材）

```ts
type IngredientCategory = "sauce" | "cheese" | "topping";

interface Ingredient {
  id: string;            // "tomato-sauce" など一意なID
  category: IngredientCategory;
  nameJa: string;        // "トマトソース"
  color: string;         // プレースホルダー描画用の代表色
  emoji: string;         // Phase1の簡易ビジュアル（アイコン代わり）
  placement: "spread" | "scatter"; // sauceはspread(全体塗り)、他はscatter(個別配置)
}
```

Phase 1 で実データを持つのは以下3件のみ（モックアップにある他の食材はデータ定義のみ将来拡張用に
追加してもよいが、Phase1のUIで選択可能にするのはマルゲリータに必要な3件で十分）。

| id | category | nameJa | placement |
|---|---|---|---|
| tomato-sauce | sauce | トマトソース | spread |
| mozzarella | cheese | モッツァレラ | scatter |
| basil | topping | バジル | scatter |

## 2. Recipe（レシピ）

```ts
interface RecipeRequirement {
  ingredientId: string;
  minCount: number; // scatter系: 最低配置個数。spread系: 1（塗られていれば可）
}

interface Recipe {
  id: string;             // "margherita"
  nameJa: string;         // "マルゲリータ"
  description: string;    // 図鑑用の説明文（独自文章。PIZZA DB由来の文章は使用しない）
  requiredIngredients: RecipeRequirement[];
  bakeTarget: { start: number; end: number }; // 0-100のゲージ上の目標レンジ（perfectゾーン）
}
```

Phase 1 のレシピデータ:

```ts
{
  id: "margherita",
  nameJa: "マルゲリータ",
  description: "トマトソース・モッツァレラ・バジルだけで作る、いちばんシンプルで奥が深いピザ。",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 3 },
    { ingredientId: "basil", minCount: 2 },
  ],
  bakeTarget: { start: 60, end: 80 },
}
```

## 3. Order（注文）

```ts
interface Order {
  id: string;
  recipeId: string;      // 参照するRecipe.id
  requestedBy: "mito";   // Phase1は固定
  lineJa: string;        // ミトのセリフ
}
```

Phase 1 は `orders.ts` に1件（マルゲリータ注文）のみ定義。将来注文をランダム抽選する際も
このOrder配列から選ぶ形にすれば実装を変えずに拡張できる。

## 4. Dialogue（キャラクターセリフ）

```ts
type Speaker = "teto" | "mito" | "blue";

interface DialogueLine {
  speaker: Speaker;
  key: string;      // "order.mito.margherita" のような識別子
  textJa: string;
}
```

フェーズ・状況ごとのセリフ一覧を `dialogue.ts` にまとめる。UIは `key` を指定して該当セリフを取得する。

## 5. PlacedIngredient（プレイヤーが配置した食材の実行時状態）

```ts
interface PlacedTopping {
  ingredientId: string;
  x: number; // 0-100 (%) ピザ円内の相対座標
  y: number; // 0-100 (%)
}

interface PizzaState {
  sauceIds: string[];          // 塗られたソースのID（spread系。Phase1は0 or 1件）
  toppings: PlacedTopping[];   // scatter系食材の配置一覧（cheese/topping問わず）
  bakeResult: number | null;   // BAKE確定時のゲージ位置(0-100)。未確定はnull
}
```

これは「セーブすべきデータ」ではなく、1回のプレイ中だけ保持するランタイム状態。DBやlocalStorageへの
永続化は行わない（図鑑の「発見済みレシピ一覧」のみ、Phase1ではメモリ上に保持すれば十分。永続化が
必要になった場合はPhase2以降でlocalStorage導入を検討する）。

## 6. スコアリングロジック（データ駆動）

`src/logic/scoring.ts` に純粋関数として実装し、UIから独立させる。

```ts
interface ScoreBreakdown {
  matchScore: number;      // 0-100: 注文一致度
  ingredientScore: number; // 0-100: 材料の正しさ（過不足）
  bakeScore: number;       // 0-100: 焼き加減
  total: number;           // 3項目の平均
  stars: 1 | 2 | 3;
}

function scorePizza(recipe: Recipe, pizza: PizzaState): ScoreBreakdown
```

判定ルール（Phase1実装方針）:

- **matchScore**: レシピの `requiredIngredients` に含まれる各食材IDについて、`minCount` 以上
  配置されていれば満たすとみなす。必須食材の充足率（満たした数 / 必須食材種類数）× 100。
- **ingredientScore**: 配置した食材のうち、レシピに存在しない食材（余分な食材）の割合をペナルティにする。
  `100 - (余分に使った食材の種類数 / 使用した食材の種類数) × 100`（余分がなければ100）。
- **bakeScore**: `bakeResult` が `bakeTarget` の範囲内なら100。範囲外の場合は目標レンジの中心からの
  距離に応じて減点（線形減衰、0未満にはしない）。
- **total**: 3項目の単純平均。
- **stars**: total >= 90 → 3, total >= 60 → 2, それ以外 → 1。

## 7. 図鑑（Recipe Dex）状態

```ts
interface DexState {
  discoveredRecipeIds: string[]; // 一度でも規定スコア以上で完成させたレシピのID一覧
}
```

Phase1では「初めてマルゲリータを完成させた瞬間」に `discoveredRecipeIds` に `"margherita"` が
追加される。完成の閾値は「stars >= 1（=一度でも焼き上げてブルーの採点を受けたら図鑑に載る）」とし、
低評価でも心理的ハードルを上げすぎない設計にする（採点自体は正直に表示する）。

## 8. 拡張性の指針

- 新しい食材を追加する場合: `ingredients.ts` に1エントリ追加するだけでトレイに表示される。
- 新しいレシピを追加する場合: `recipes.ts` に1エントリ追加するだけで判定ロジックはそのまま動く。
- 新しい注文を追加する場合: `orders.ts` に1エントリ追加し、注文選択ロジック（Phase1は固定選択、
  将来はランダム抽選）を変更するだけでよい。
- UIコンポーネント（PizzaCanvas, IngredientTray, BakeGauge, ResultPanel など）はレシピ数・食材数に
  依存しないよう、常に配列をmapして描画する。
