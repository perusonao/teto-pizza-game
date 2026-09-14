# Phase 3B-0 Safety Net — Result

## Base / Branch

- Base SHA: `4a5663d8be84fcc3329031f7c46575c31356a2bd` (origin/main, confirmed current at session start)
- Branch: `claude/phase-3b0-safety-net-h0dscr`

## 1. Generic cheese visual fallback

`src/App.css` の `.pizza-cheese` base class に fallback スタイルを追加:

```css
.pizza-cheese {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--cheese-color, #f0d9a0);
  box-shadow: 0 2px 3px rgba(30, 16, 4, 0.3), 0 0 0 1.5px rgba(255, 255, 255, 0.8);
  transition: transform 0.3s ease, filter 0.3s ease;
}
```

- `--cheese-color` は `IngredientTray.tsx` / `PizzaStage.tsx` の cheese `<span>` に
  `style={{ "--cheese-color": ingredient.color }}` としてインラインで渡す。
  既存の `sauceIngredient.color` / `activeIngredient.color` の使い方と同じ自然な形。
- 既存4チーズ (`mozzarella` / `gorgonzola` / `parmigiano` / `fontina`) は
  専用の `.pizza-cheese--<id>` ルールが `width/height/background/box-shadow` を
  明示的に上書きするため、セレクタ詳細度により fallback は効かない
  （見た目は変更なし、後述のリグレッション確認で検証済み）。
- 専用CSSを持たない新cheeseは、`ingredient.color` を背景色とした丸い円として
  最低限視認可能になる。

## 2. RECIPES ↔ ORDERS compile-time integrity

`src/data/recipes.ts`:

```ts
export interface Recipe {
  id: RecipeId;
  ...
  requiredIngredients: readonly RecipeRequirement[];
  ...
}

export const RECIPES = [
  { id: "margherita", ... },
  { id: "marinara", ... },
  { id: "quattro-formaggi", ... },
] as const;

export type RecipeId = (typeof RECIPES)[number]["id"];

export function getRecipe(id: RecipeId): Recipe | undefined { ... }
```

- `RecipeId` は `RECIPES` 配列の `id` フィールドから型レベルで導出した union。
  手書きの ID リストを別途持たないため、recipe 追加/削除時に自動で追従する。
- `src/data/orders.ts` の `Order.recipeId` を `string` → `RecipeId` に変更。
- 存在しない `recipeId` を `ORDERS` に書くと `tsc -b` がコンパイルエラーで検出する
  （下記で実証済み）。

### Codex P2レビュー対応（PR #10 review thread）

初回実装は各 recipe の `id` へ個別に `id: "margherita" as const` を付ける方式だった。
Codexの指摘: 将来 recipe 追加時に1件でも `as const` を付け忘れると、その要素の
`id` が `string` へ widen し、`RecipeId`（union全体）も `string` へ widen して
`Order.recipeId` の compile-time integrity check が静かに無効化される、というもの。

対応として、`as const` を **配列全体（`RECIPES` 末尾）に1箇所だけ** 付与する方式に変更。
配列リテラル全体を `as const` にすることで、各要素の `id` は個別の注釈なしに
自動で string literal 型として保持される。これに伴い、`as const` は
`requiredIngredients` などネスト配列も `readonly` にするため、
`Recipe.requiredIngredients` の型を `RecipeRequirement[]` → `readonly RecipeRequirement[]`
に変更（既存の利用箇所は `.map` / `.find` / `.filter` のみで書き込みなし。
`scoring.ts` / `hints.ts` / `DexOverlay.tsx` / `App.tsx` で読み取り専用利用のみ確認済み）。

手書きの `RecipeId` 一覧やヘルパー型・factory関数は追加していない
（`RECIPES` 自体から `(typeof RECIPES)[number]["id"]` で導出する方式を維持）。

### 検証手順（実施後、必ず元に戻す）

1. `src/data/orders.ts` の `quattro-formaggi` order の `recipeId` を
   `"quattro-formaggi-typo"` に一時変更して `npx tsc -b` を実行:

   ```
   src/data/orders.ts(25,5): error TS2820: Type '"quattro-formaggi-typo"' is not
   assignable to type '"margherita" | "marinara" | "quattro-formaggi"'.
   Did you mean '"quattro-formaggi"'?
   ```

   → 期待通り検出。

2. Codexの指摘シナリオを再現するため、`RECIPES` に **`as const` を付けない**
   4件目の recipe (`id: "verify-temp-no-as-const"`) を一時追加した状態で、
   上記1の invalid `recipeId` テストを再実行:

   ```
   src/data/orders.ts(25,5): error TS2820: Type '"quattro-formaggi-typo"' is not
   assignable to type '"margherita" | "marinara" | "quattro-formaggi" |
   "verify-temp-no-as-const"'. Did you mean '"quattro-formaggi"'?
   ```

   → `RecipeId` が `"verify-temp-no-as-const"` を含む4つのリテラル union のままで、
   `string` へ widen していないことを確認（widen していれば invalid な
   `recipeId` はエラーにならないはず）。

3. 両方の一時変更（`orders.ts` の typo、`recipes.ts` の検証用recipe）を元に戻し、
   `npm run build` / `npm run lint` / `git diff --check` がクリーンに通ることを再確認。

新しい test framework やランタイムバリデーションは導入していない（純粋に型レベルの対応）。

## Regression（既存3 recipes）

- Margherita / Marinara / Quattro Formaggi のデータ（`RECIPES` / `ORDERS`）は
  値として無変更（`id` に `as const` を付けただけ）。
- ブラウザ確認で既存4チーズ（モッツァレラ/ゴルゴンゾーラ/パルミジャーノ/フォンティーナ）の
  見た目が変更前と同一であることを確認（下記スクリーンショット参照）。
- Phase 3A Sauce Painting / FTU Hotfix 関連ファイルは今回未変更。

## Browser 確認（390×844, Playwright + Chromium）

1. ORDER → PREPARE 遷移、チーズタブを開いて既存4チーズが従来通り表示されることを確認。
2. 一時的に `src/data/ingredients.ts` へ検証用チーズ (`temp-fallback-test-cheese`,
   color `#4287f5`) を追加し、
   - トレイ上で fallback（青い円）として視認できることを確認
   - 実際にピザ生地の上へ配置しても fallback として描画されることを確認
   その後 `git diff` で当該追加を完全に取り消し済み（`git status` clean を確認）。
3. 大規模 Playwright 監査は実施していない（今回のスコープ通り）。

## P0 / P1 / P2

- P0: なし
- P1: なし
- P2: なし（既知の2問題はいずれも本Safety Netで対応済み）

## Checks

- `npm run build`: ✅ pass (`tsc -b && vite build`)
- `npm run lint` (oxlint): ✅ pass, exit code 0
- `git diff --check`: ✅ no whitespace errors

## Changed files

- `src/App.css`
- `src/components/IngredientTray.tsx`
- `src/components/PizzaStage.tsx`
- `src/data/orders.ts`
- `src/data/recipes.ts`
- `docs/reports/PIZZA_GAME_Phase3B0_Safety-Net_Result.md` (this report)

## Scope

今回追加していないもの（意図通り）: Genovese / Bismarck / Funghi 等の新recipe、
新ingredient、Dex変更、dialogue拡張、scoring変更、Sauce Painting変更、
persistence、management、新test infrastructure。

## Commit / PR

- Initial commit SHA: `aae8226d3cac88cbb9c24750a62aad0d4bea2945`
- Codex P2 fix commit SHA: (このコミット。git log 参照)
- PR URL: https://github.com/perusonao/teto-pizza-game/pull/10
- PR is left **unmerged** as instructed.
