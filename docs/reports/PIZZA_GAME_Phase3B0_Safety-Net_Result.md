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
}

export type RecipeId = (typeof RECIPES)[number]["id"];

export const RECIPES = [
  { id: "margherita" as const, ... },
  { id: "marinara" as const, ... },
  { id: "quattro-formaggi" as const, ... },
];

export function getRecipe(id: RecipeId): Recipe | undefined { ... }
```

- `RecipeId` は `RECIPES` 配列の `id` フィールド（各 `as const` でリテラル化）から
  型レベルで導出した union。手書きの ID リストを別途持たないため、
  recipe 追加/削除時に自動で追従する。
- `src/data/orders.ts` の `Order.recipeId` を `string` → `RecipeId` に変更。
- 存在しない `recipeId` を `ORDERS` に書くと `tsc -b` がコンパイルエラーで検出する
  （下記で実証済み）。

### 検証手順（実施後、必ず元に戻す）

`src/data/orders.ts` の `quattro-formaggi` order の `recipeId` を
`"quattro-formaggi-typo"` に一時変更して `npx tsc -b` を実行:

```
src/data/orders.ts(25,5): error TS2820: Type '"quattro-formaggi-typo"' is not
assignable to type '"margherita" | "marinara" | "quattro-formaggi"'.
Did you mean '"quattro-formaggi"'?
```

→ 期待通り検出。変更は直後に元へ戻し、`npm run build` がクリーンに通ることを再確認済み。

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

- Commit SHA: (このレポートをコミットするコミットのSHA。git log 参照)
- PR URL: (作成後に追記)
- PR is left **unmerged** as instructed.
