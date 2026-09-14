# Phase 3B-1 Recipe Expansion — Result

## Base / Branch

- Base SHA: `cf77063c3a02c253e4fbe4c91740af53bc3e0121` (origin/main, confirmed current at session start; Phase 3B-0 Safety Net)
- Branch: `claude/pizza-phase-3b1-recipes-sj4gk4`

## 0. 実装前の料理妥当性確認

既存 `src/data/recipes.ts` / `src/data/ingredients.ts` のデータ構造（Recipe = sauce 1種 +
cheese/topping の `minCount` 集合 + `bakeTarget`）を確認した上で、3レシピの構成を以下のように決定。
ゲーム上の差別化のためだけに不自然な組み合わせは作らず、各レシピとも実在するピザの構成を
「新ingredient予算（pesto / cherry-tomato / egg / mushroom、新cheeseなし）」の範囲内で
素直に表現した。大幅な再設計は行っていない。

- **Genovese**: 実在の「ピザ・アル・ペースト（ジェノベーゼソースのピザ）」は
  ジェノベーゼソース + モッツァレラ + チェリートマトが定番の組み合わせ。今回もそのまま採用。
  ソース/チーズ/トッピングいずれも不自然な点はない。
- **Funghi**: 実在の「ピザ・アイ・フンギ」はトマトソース + モッツァレラ + マッシュルームが基本形。
  タスク指示通り、既存Quattroとの差別化のためだけにgorgonzolaを無理に入れることはしなかった
  （gorgonzolaを足す必然性がなく、料理として不自然になるため）。
- **Bismarck**: 実在の「ピッツァ・ビスマルク」はトマトソース + モッツァレラ + ハム + 卵が伝統的構成。
  ただし今回の新ingredient予算に「ハム」は含まれていないため、卵を主役に据えた
  トマトソース + モッツァレラ + 卵の構成に調整した。ハムを省いたことで伝統形そのものではなくなるが、
  「卵入りピザ」というBismarckの核（中央に卵を割り落として焼く）は保持しており、
  Margherita（トマト+モッツァレラ+バジル）と卵の有無で明確に区別できるため、料理として不自然にはならない
  と判断した。ハム追加は本Phaseのスコープ外（新topping 1種追加は許容予算超過）として見送った。

## 1. 新 Ingredients

`src/data/ingredients.ts` に4件追加。既存の `Ingredient` 型・描画方式（`color` / `emoji` /
`placement`）をそのまま使用し、engine変更は行っていない。

| id | category | nameJa | placement | color | emoji |
|---|---|---|---|---|---|
| `pesto` | sauce | ジェノベーゼソース | spread | `#6b8e3d` | 🌿 |
| `cherry-tomato` | topping | チェリートマト | scatter | `#e2412f` | 🍅 |
| `egg` | topping | たまご | scatter | `#f2c94c` | 🥚 |
| `mushroom` | topping | マッシュルーム | scatter | `#b08968` | 🍄 |

- `pesto` は既存 sauce (`tomato-sauce` / `olive-oil`) と同じ `placement: "spread"` にしたことで、
  追加のpainting engineなしで既存Sauce Paintingがそのまま緑色のトレイル/spreadとして機能する
  （`PizzaStage.tsx` の sauce layer は `sauceIngredient.color` を背景色にするだけの汎用実装で、
  oilのような特殊扱いは必要なかった）。
- 新cheeseは追加していない（指示通り）。
- 390×844 Chromiumでの視認性はブラウザ確認セクションのスクリーンショットで確認済み。

## 2. Genovese

- `pesto` を primary sauce として `RECIPES` に登録。既存Sauce Paintingで緑色の軌跡・spreadが
  自然に見えることをスクリーンショットで確認（`genovese-1-sauce.png` / `genovese-2-complete.png`）。
- 追加のpainting engineは実装していない。

## 3. Bismarck

- `egg` を通常の topping（`placement: "scatter"`）として登録。現行 `findOpenSpot` /
  placement engine の範囲内でそのまま動作し、特殊なcenter-lock機構は追加していない。
- 中央配置の印象は Mito hint（「まんなかに卵をのせたら〜」）でプレイヤーを誘導する形とし、
  engine側の強制はしていない（指示通り）。
- `bakeTarget: { start: 55, end: 75 }` とし、既存3レシピ（60-80 / 45-65 / 65-85）とバランスを取った。

## 4. Funghi

- `mushroom` を通常の topping として登録。gorgonzolaは使わず、
  トマトソース + モッツァレラ + マッシュルームというシンプルで自然な構成にした。

## 新3レシピ データ

| recipe | sauce | cheese | toppings | bakeTarget |
|---|---|---|---|---|
| `genovese` ジェノベーゼ | pesto ×1 | mozzarella ×2 | cherry-tomato ×3 | 50–70 |
| `bismarck` ビスマルク | tomato-sauce ×1 | mozzarella ×3 | egg ×1 | 55–75 |
| `funghi` フンギ | tomato-sauce ×1 | mozzarella ×2 | mushroom ×3 | 58–78 |

## 5. Orders

`src/data/orders.ts` に3件（`order-genovese` / `order-bismarck` / `order-funghi`）を追加。
`getNextOrder` の selection algorithm（undiscovered-priority + `avoidRepeat`）は無変更。

Playwright（390×844, Chromium）で同一セッション中に実測:

1. 初回は必ず Margherita（`preferFirst`）。
2. 2〜6回目でMarinara / Quattro Formaggi / Genovese / Bismarck / Funghiが重複なく登場
   （undiscovered-priorityが6レシピでも正しく機能）。
3. 6/6発見後の7回目は再び undiscovered pool が空になり random pool から選出
   （実測: Bismarckが再度選ばれ、即時repeatを避ける `avoidRepeat` もこの回では
   pool全体がexcludeRecipeId以外に候補を持てたため正常に機能）。

selection algorithm自体のコード変更は行っていない。

## 6. Mito hints

`src/data/hints.ts` の `RECIPE_HINTS` に `genovese` / `bismarck` / `funghi` を追加。
既存の `empty` / `emptyHint` / `missing` / `ready` 構造をそのまま使用し、
`buildHintLine` のロジック（sauce未使用時はambient/explicit hint、以降は不足ingredientごとの
hint）は無変更。各ヒントは短く「次に何をするか」が分かる内容にした
（例: bismarckの `missing.egg` = 「まんなかに卵をのせたら、ビスマルクらしくなるよ！」）。
大規模dialogue system変更はしていない。

## 7. Scoring / Completion

`src/logic/scoring.ts` / `src/logic/bake.ts` は無変更。3レシピとも
`scorePizza` の既存ロジック（`countUsedIngredient` によるcategory非依存の汎用カウント）が
そのまま正しく動作することをブラウザ確認で実測（後述、全レシピ★3達成）。
データだけで表現できない問題は発生しなかったため、engine/scoring側の修正は行っていない。

## 8. Dex

`DexOverlay.tsx` / `App.tsx` は無変更（`RECIPES` を汎用的にmapしているため6件でもそのまま表示）。
ブラウザ確認で6レシピ全件がDexに表示され、6/6発見後は `dex-card--locked` が0件になることを確認。
X/6 progress UI・richer NEW・hidden category hint・6/6 completion presentationは
指示通り今回実装していない（Phase 3B-2スコープ）。

## Engine changes

**NO.** `src/data/*.ts` の4ファイルのみ変更（ingredients / recipes / orders / hints）。
コンポーネント（`PizzaStage.tsx` / `IngredientTray.tsx` / `DexOverlay.tsx` / `App.tsx`）、
`gameReducer.ts`、`scoring.ts`、`bake.ts`、CSSは一切変更していない。
`RecipeId` safety net（`RECIPES` の `as const` 配列由来のunion）と generic cheese fallback は
無変更のまま維持されている。

## Regression確認

- Phase 3A Sauce Painting: pestoが既存メカニズムのまま緑色で塗れることを確認（変更なし）。
- FTU Hotfix: 初回プレイが常にMargherita、PREPAREが常にrecipeのprimary sauce選択済みで開始
  （`findPrimarySauceId`、無変更）されることを確認。
- generic cheese fallback: 既存4チーズの専用CSSは無変更、新cheese追加なしのため今回未使用だが
  壊れていないことをコード上確認（`App.css` 無変更）。
- RecipeId integrity: `npm run build`（`tsc -b`含む）が新6レシピ・新6 orderの構成でpassすることで
  compile-time checkが維持されていることを確認。
- 既存3レシピ（Margherita / Marinara / Quattro Formaggi）: データ値は無変更。ブラウザ確認で
  従来通り注文・作成・★3達成できることを実測。
- bake raw/perfect/burnt: `funghi` を意図的に短い焼き時間（400ms固定wait）で取り出し、
  raw（生焼け, ★2, bakeScore 64）を正しく分類・表示することを確認（`genovese-4-result.png`）。
- scoring: 全6レシピで `matchScore` / `ingredientScore` = 100 を実測（正しいingredientで完成可能）。
- NEW semantics: `justDiscovered` ベースの表示は無変更、実測で新規発見時のみ表示されることを確認。
- undiscovered-priority selection: 上記セクション5参照。

## 9. Browser 確認（390×844, Playwright headless Chromium）

Vite dev server (`npm run dev`) 上で、Playwright（`chromium.launch({ executablePath:
"/opt/pw-browsers/chromium" })`, viewport 390×844）を用いて2本のスクリプトで確認:

**スクリプト1（機能フロー・同一セッション6/6発見）**

1. 初回プレイがMargherita → PREPARE → 各ingredientをtap/drag配置 → BAKE → RESULT → Dex登録。
2. 「もう一度作る」を6回連続実行し、Marinara / Quattro Formaggi / Genovese / Bismarck / Funghi が
   重複なく（undiscovered-priority）順に出現することを確認。
3. Genoveseはpestoをmouse down→move→up によるdrag（Sauce Painting）で塗布。
4. Bismarckはeggをtopping placementで中央付近に配置。
5. Funghiはmushroomをtopping placementで3箇所に配置。
6. 各レシピとも正しいingredientで完成 → BAKE → RESULT到達、全6レシピで★3を実測。
7. 6/6発見後、Dexを開いて `dex-card` 総数6・`dex-card--locked` 0件を確認。
8. 6/6発見後も「もう一度作る」で7回目の注文（Bismarckが再選出）へ正常に進めることを確認。
9. `console` error / `pageerror` を全ラウンドで監視: **0件**。
10. `document.documentElement.scrollWidth`（390） === `clientWidth`（390）で
    **horizontal overflowなし**を確認。

**スクリプト2（新3レシピの視覚確認・スクリーンショット）**

Genovese / Bismarck / Funghi それぞれについて、sauce塗布直後・材料配置完了・BAKE中・RESULTの
4段階でスクリーンショットを撮影し、目視で確認:

- Genovese: ジェノベーゼソースが緑色で塗られ、モッツァレラ(白)とチェリートマト(赤)が
  既存Margherita等とは明確に異なる見た目になっている。
- Bismarck: トマトソース上にモッツァレラ3個と卵🥚が中央付近に配置され、
  既存pizzaとは異なる中心配置の印象を確認。
- Funghi: トマトソース上にモッツァレラとマッシュルーム🍄3個が視認可能に配置。
- Dexオーバーレイでも新3レシピの説明文・ingredientアイコンが正しく表示されることを確認。

## P0 / P1 / P2

- P0: なし
- P1: なし
- P2: Bismarckの伝統的構成（ハム）を新ingredient予算の都合で省略した点（セクション0で理由記載、
  ゲームプレイ上の機能に問題はない）。

## Checks

- `npm run build`（`tsc -b && vite build`）: ✅ pass
- `npm run lint`（oxlint）: ✅ pass, exit code 0
- `git diff --check`: ✅ no whitespace errors
- 新しいtest frameworkの追加: なし（指示通り）

## Changed files

- `src/data/ingredients.ts`
- `src/data/recipes.ts`
- `src/data/orders.ts`
- `src/data/hints.ts`
- `docs/reports/PIZZA_GAME_Phase3B1_Recipe-Expansion_Result.md`（本レポート）

## Scope

今回追加していないもの（指示通り）: Dex Progression redesign、category UI、
character dialogue rotation、Blue recipe-specific evaluation expansion、audio、haptics、
persistence、economy、shop management、backend。

過去のlocal-only design/audit/report/screenshotsの誤commitはなし（本レポートと
`src/data/*.ts` の変更のみをcommit対象とした）。

## Commit / PR

- Commit SHA: （コミット後に記載）
- PR URL: （PR作成後に記載）
- PRは**未マージ**のまま残す。
