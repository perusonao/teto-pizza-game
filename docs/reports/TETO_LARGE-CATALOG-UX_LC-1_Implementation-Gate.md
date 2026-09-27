# Large Catalog UX — LC-1 / LC-1b Implementation Gate

- 種別: Implementation Gate（この文書の判定が A のとき LC-1 / LC-1b の実装を開始する）。
- Authority:
  - `docs/reports/TETO_LARGE-CATALOG-UX_Owner-Decision-Gate.md` §17（Owner Authority 2026-09-27）
  - `docs/reports/data/TETO_LARGE-CATALOG-UX_OWNER-DECISIONS.json`
- ブランチ: `claude/large-catalog-ux-design-sq8saf`（`origin/main` を merge 済み）。

## 0. 判定

**A. READY — LC-1 / LC-1b を実装してよい。**

- 対象は pure module・テスト専用の fixture・テストだけ。
- production の UI・CSS・reducer・save・Dinner・Hint / DH4 には配線しない。

## 1. Fresh GitHub state

| 項目 | 値 |
|---|---|
| current `main` | `51e0923`（PR #252 Dinner DM-3R-2 merge）。Owner Decision Gate の監査時から変化なし |
| Open PR（関連確認） | #259 DM-4-1、#255 172 Taxonomy、#243 DM-3、#221、#220、#218 ほか。**どれも catalog / working set / pantry を扱っていない** |

## 2. Duplicate Gate

| 検索語 | Open Issue / PR | Closed の関連（重複ではない） |
|---|---|---|
| Large Catalog UX / catalog search / filter | なし | PR #90（Ingredient Economy & UI Scalability 監査、docs）、PR #111（Shop のカテゴリ filter） |
| ingredient working set / pantry | なし | Issue #86 / PR #95（トレイの 6 個ページ送り。本件はその上の層） |
| inventory 一覧 | なし | PR #96（Inventory Screen） |
| large-scale fixtures | なし | —（既存の scalability test は 30 / 62 材料の単発確認のみ） |
| undo / 1つ戻す | なし | — |

**結論: 重複なし。** LC-1 / 1b は専用 Issue を新規作成する。LC-X（1つ戻す）も独立 Issue として新規作成する。

## 3. LC-1 API（`src/logic/catalog/`）

すべて pure。production から import されない（boundary test で保証）。

```ts
// catalogTypes.ts
type CatalogCategory = "sauce" | "cheese" | "topping";
interface CatalogIngredient {            // 材料の表示用記述子。レシピ情報を持たない
  id: string; category: CatalogCategory; nameJa: string; readingJa?: string;
  family: AttributeFamilyId | null;       // DH4-1 taxonomy（topping のみ、OD-TAX-2/3）
  catalogIndex: number;                   // 安定順序の唯一の基準
}
type StockValue = number | "UNLIMITED";
interface OwnershipView { ownedIds: readonly string[]; stock: (id: string) => StockValue }

// catalogSource.ts  —  runtime の材料データ → CatalogIngredient[]（ingredients + taxonomy だけを読む）
runtimeCatalog(): readonly CatalogIngredient[]

// catalogText.ts
normalizeForSearch(text: string): string           // ひらがな化・NFKC・長音 / 中黒 / 空白を除去
matchesSearch(item: CatalogIngredient, query: string): boolean

// catalogQuery.ts  —  Pantry / Inventory / Shop が共有する query（UI には未接続）
interface CatalogQuery {
  category?: CatalogCategory;
  families?: readonly AttributeFamilyId[];          // 開示済み粒度の filter（hintDisclosure から）
  text?: string;
  only?: { favorites?: boolean; recent?: boolean; inStock?: boolean };
  sort?: "catalog" | "recent" | "reading" | "stock";
}
queryCatalog(catalog, ownership, usage, query): readonly CatalogIngredient[]   // OWNED のみ
familyCounts(catalog, ownership, category): ReadonlyMap<AttributeFamilyId, number>  // 所持 × family のみ

// usageSignals.ts  —  session 内の favorite / recent / newly-owned（LC-OD-5: save しない）
interface UsageSession { favorites: readonly string[]; recent: readonly string[]; newlyOwned: readonly string[] }
emptyUsageSession(); toggleFavorite(s, id); recordUse(s, ids, cap?); recordNewlyOwned(s, id, cap?)

// hintDisclosure.ts  —  ヒントシートが「表示した」情報だけを受け取る境界
interface DisclosedHints { namedIngredientIds: readonly string[]; attributeFactIds: readonly string[] }
disclosedHintsFromSheetView(view: HintSheetView): DisclosedHints   // 表示済み chip / named step のみ
libraryFilterForAttribute(factId: string): LibraryFilter            // family→[family], group→group の全 family,
                                                                    // category→category, existence/不正→なし

// workingSet.ts
interface WorkingSetInput {
  category: CatalogCategory; capacity: number;       // LC-OD-4: 9 / 12 未決 → 引数
  catalog: readonly CatalogIngredient[]; ownership: OwnershipView;
  placedIds: readonly string[];                      // 今のピザにのっている（配置順）
  pinnedIds: readonly string[];                      // 食材庫で ✓（操作順）
  disclosedHints: DisclosedHints;                    // hintDisclosure の出力だけ
  usage: UsageSession;
}
interface WorkingSetItem { id: string; source: "placed" | "pinned" | "hint" | "favorite" | "recent" | "new" | "fill" }
interface WorkingSet { active: boolean; items: readonly WorkingSetItem[]; overflowIds: readonly string[] }
selectWorkingSet(input): WorkingSet
// active=false（そのカテゴリの所持数 ≤ capacity）: 現行トレイと同一（所持を catalog 順、在庫 0 を含む）
// active=true: placed > pinned > hint > favorite > recent > new > fill（fill は catalog 順・在庫 >0）
//   自動の source（hint 以降）は在庫 0 を除外（LC-OD-17）。重複は上位の source を採用。capacity で打ち切る。

// dexActionSummary.ts  —  LC-OD-8b（所持基準）。在庫は引数に存在しない
interface DexSummaryRecipe { discovered: boolean; requiredIngredientIds: readonly string[] }
interface EntitlementView { ownedIds: readonly string[]; shopEntitledIds: readonly string[]; starterIds: readonly string[] }
summarizeChapter(recipes, entitlement): { discovered; total; explore; shop }
// explore = 未発見のうち必要材料をすべて所持 or starter、shop = すべて entitled で一部未所持
```

## 4. Privacy boundary

| # | 境界 | 実現方法 |
|---|---|---|
| B-1 | working set / query / text / usage は**レシピを知らない** | `src/logic/catalog/*`（dexActionSummary を除く）は `data/ingredients`・`data/ingredientTaxonomy`・同一ディレクトリ内のファイルだけを import してよい。**import 静的検査テスト**で、`recipes` / `discovery/*` / `state/*` / `mission/*` の import を失敗にする |
| B-2 | 入力型にレシピ・target・matcher・near-miss・reserve・Dinner target のフィールドが無い | 型。加えて、余分なキー（`targetRecipeId`・`dinnerTargetRecipeIds` など）を付けても出力が変わらないことを adversarial test で確認 |
| B-3 | ヒントは**表示済み**のものだけ | 入口は `DisclosedHints`。`disclosedHintsFromSheetView` は `HintSheetView` の `rows[].revealed`（SELECTABLE）と `steps[].namedIngredientId`（TARGET）しか読まない。`buildSelectableHintModel` は import しない |
| B-4 | family ヒントは回答の粒度より細かくしない | `libraryFilterForAttribute`: group は group の**全 family**、category はカテゴリ全体、existence はなし。reserve を引数に取らない |
| B-5 | Dex 集計は在庫で変わらない | `dexActionSummary` の引数に在庫が存在しない。既存の `recipeDiscoveryState`（在庫基準）と並べ、在庫を 0 にしても summary が不変で、既存関数側は変わる（= 漏洩が解消される）ことをテストで示す |
| B-6 | production は変わらない | `src/logic/catalog/` を import する production ファイルが 0 であることを boundary test で確認。既存の `trayIngredientsFor` とは inactive 時に同値であることだけを検証する |

## 5. LC-1b fixture（`src/logic/catalog/testSupport/largeCatalogFixtures.ts`）

- `runtimeFixture()`:
  - 実データ 29 材料 / 25 レシピ（`INGREDIENTS` / `RECIPES` / `buildRecipeChapters`）。
  - テスト専用ファイルで、production は import しない。
- `syntheticCatalog(spec)`:
  - 決定的（seed 付き mulberry32）に合成材料を作る。id は `fx-<category>-<nnn>`。
  - family は PR #255 の PROPOSED 比率で割り当てる。
- `syntheticRecipes(spec, catalog)`:
  - 章の大きさ・topping 数の分布（172 matrix: 0:5 / 1:30 / 2:50 / 3:62 / 4:19 / 5:5 / 6:1）・cheese 数の分布から、決定的に合成レシピを作る。
- population:

| fixture id | 材料（sauce / cheese / topping） | レシピ（章） |
|---|---|---|
| `runtime-29x25` | 実データ 29（3 / 4 / 22） | 実データ 25（6 / 9 / 10） |
| `w2a-37x34` | 37（3 / 4 / 30、worst）※mixed 3 / 7 / 27 も用意 | 34（6 / 9 / 19） |
| `mid-40x34` | 40（3 / 7 / 30） | 34 |
| `catalog-62x101` | 62（10 / 10 / 42） | 101（23 / 37 / 30 / 11） |
| `progression-105x101` | 105（18 / 16 / 71） | 101 |
| `full-105x172` | 105 | 172（39 / 63 / 51 / 19） |
| `stress-179x172` | 179（31 / 25 / 123） | 172 |

- 値は `tools/large_catalog_ux_scale_model.py` の `FIXTURE_INGREDIENT_SPLITS` / `CHAPTER_SIZES` と一致させる（fixture test で固定）。

## 6. Test / mutant matrix

| 種類 | 内容 |
|---|---|
| unit | 各関数の正常系・境界（capacity 1、所持 0、重複 id、未知 id、`__proto__` などの敵対的 id） |
| property（決定的な擬似乱数で 200 ケース） | ①入力順を並べ替えても出力は同一（stable ordering）、②出力 ⊆ 所持材料、③件数 ≤ capacity（active 時）、④ placed は capacity 内で必ず先頭群、⑤同一入力は常に同一出力 |
| adversarial / privacy | P-1 在庫の増減で Dex 集計が不変、P-2 hidden recipe identity（余分なキー・レシピ変更）で working set が不変、P-3 未開示の hint fact（view に無い fact）で不変、P-4 family 回答より細かく絞らない、P-5 group 回答で reserve の family だけを開かない（group の全 family）、P-6 Dinner target を渡しても自動投入しない、P-7 import 静的検査 |
| scale / perf | 全 fixture で決定性（2 回の実行が deep-equal）、`stress-179x172` で 1 回あたり < 50ms（CI の余裕を見た上限） |
| production equivalence | inactive の working set は、runtime catalog で `trayIngredientsFor(category, { freeCook: true })` と同じ id 列になる |
| **mutation** | `tools/large-catalog-ux/mutation-check.mjs` が、下表の mutant を 1 つずつ source に適用して catalog のテストを実行し、**全 mutant が kill される**ことを確認する（CI 外の手動ゲート、結果は Result Report に記録） |

| mutant | 内容 | kill する test |
|---|---|---|
| M1 answer-leak | `workingSet.ts` が `RECIPES` を import し、未発見レシピの材料を hint source に混ぜる | P-7（import）+ P-2 |
| M2 matcher-leak | `discovery/matcher` を import する | P-7 |
| M3 undisclosed-fact | `disclosedHintsFromSheetView` が chip 以外（全 ingredient）を named に入れる | P-3 |
| M4 group→family | group 回答で group の先頭 family だけを返す | P-5 |
| M5 finer-than-disclosed | family 回答で subfamily 相当の 1 材料に絞る（family の最初の 1 件だけ） | P-4 |
| M6 stock-in-dex | `summarizeChapter` が在庫 0 を未所持として扱う | P-1 |
| M7 dinner-seed | working set が入力の余分なキー（`dinnerTargetRecipeIds`）を読む | P-6 |
| M8 unstable-order | fill を id 順ではなく入力順にする | property ① |
| M9 priority-swap | hint を pinned より上にする | unit（優先順） |
| M10 capacity-off-by-one | `<= capacity` を `< capacity` にする | property ③ + unit |
| M11 zero-stock-auto | 自動 source に在庫 0 を許す | unit（LC-OD-17） |
| M12 inactive-divergence | inactive 時に在庫 0 を除外する | production equivalence |

## 7. W2-A blocker 再判定

- main は Owner Decision Gate 時点から変化していない（`51e0923`）。W2-A の定義も GitHub 上に存在しない。
- 判定は Gate と同じ **C. LC-1 / 1b only required before W2-A**。
- LC-2 / 3 は、どれかのカテゴリの所持が 30 を超える wave の前に必須。
- 根拠: W2-A worst（topping 30）でトレイは 5 ページ（最悪 5 タップ、平均 3.0）、stage は不変。
  - 現行 e2e（free-cooking の TOPPING paging、layout-contract の TOPPING p2）の範囲内に収まる。
  - LC-1b の `w2a-37x34` / `mid-40x34` fixture により、次の閾値（topping > 30）が計測可能になる。

## 8. LC-X（1つ戻す）duplicate 結果

重複 Issue / PR はなかった。独立 Issue として新規作成する（本文は Owner Decision Gate §8 の監査結果）。今回は実装しない。

## 9. 実装対象ファイル

| 新規 | 内容 |
|---|---|
| `src/logic/catalog/catalogTypes.ts` | 型 |
| `src/logic/catalog/catalogSource.ts` | runtime の材料データ → descriptor |
| `src/logic/catalog/catalogText.ts` | 検索の正規化 |
| `src/logic/catalog/catalogQuery.ts` | filter / sort / family の件数 |
| `src/logic/catalog/usageSignals.ts` | session の favorite / recent / new |
| `src/logic/catalog/hintDisclosure.ts` | 表示済みヒントの境界 |
| `src/logic/catalog/workingSet.ts` | working set |
| `src/logic/catalog/dexActionSummary.ts` | 所持基準の Dex 集計 |
| `src/logic/catalog/testSupport/largeCatalogFixtures.ts` | LC-1b fixture（テスト専用） |
| `src/logic/catalog/*.test.ts` | unit / property / privacy / scale / boundary |
| `tools/large-catalog-ux/mutation-check.mjs` | mutation gate |
| docs | Gate、Result Report、Owner Decisions JSON、handoff 追記 |

既存ファイルの変更: **なし**（src の既存ファイル、e2e、CSS、workflow はどれも触らない）。

## 10. Rollback

- 新規ディレクトリ `src/logic/catalog/` と tool を削除するだけで完全に元に戻る。
- production からの import が 0 なので、実行時の挙動にも bundle にも影響しない（tree-shaking 以前に、参照がない）。

## 11. Owner Decision 残件

| ID | 残件 | 決める時期 |
|---|---|---|
| LC-OD-4 | 手元の容量（9 / 12） | LC-2 の 4 viewport 比較と Human Feel |
| LC-OD-3 / 13 / 15 | 食材庫の複数選択の感触、在庫が少ないの閾値、`readingJa` の data | LC-3 / LC-8 |
| LC-OD-8b の production 反映 | 所持基準の Dex 表示への切替 | LC-5（それまで既存の挙動は変えない） |
| LC-OD-9 / 10 / 11 | 棚の小見出し・タイル・章ごとのヒント CTA | LC-5 |
| LC-OD-14 | Inventory でのお気に入り切替 | LC-7 |
| LC-9 | 永続化の再判断 | LC-2〜8 の後 |
