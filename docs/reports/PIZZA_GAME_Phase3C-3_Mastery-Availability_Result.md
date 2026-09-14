# Phase 3C-3: Mastery / Ingredient Availability / Recipe Availability — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第6・7・10章）/
`docs/reports/PIZZA_GAME_Phase3C-1_Quality-DexBEST_Result.md` /
`docs/reports/PIZZA_GAME_Phase3C-2_Persistence_Result.md`

## Base / Branch / Commit

- Base SHA: `4882cd3ea342690f005caf73a99bde437632ebbc`（origin/main, 期待値と一致）
- Branch: `claude/pizza-phase-3c-3-mastery-r3e6nz`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope（今回やったこと / やらなかったこと）

指示どおり、次の3点のみ実装した:

- Mastery（Dex BESTからのpure derived `totalStars`）
- Ingredient state（`LOCKED` / `AVAILABLE_TO_BUY` / `OWNED`）のdata-driven derivation
- Recipe availability（必須食材が全てOWNEDかどうかからのderivation）とorder selectionへの
  availability filter適用

今回やっていない（指示どおり、非スコープ）:

- Pitz獲得・Shop購入UI・Mission・Lunch Rush
- Recipe #7（サラミ）・新規食材の実データ追加
- 素材消費・在庫・経営要素

## Changed files

```
src/data/ingredients.ts        (+26)   IngredientUnlockCondition型・unlockCondition?フィールド・
                                        STARTER_INGREDIENT_IDS export
src/data/orders.ts             (+23/-4) NextOrderOptions.availableRecipeIds・availableOrders
                                        （空プールへの安全なfallback）
src/data/orders.test.ts        (新規)  availability filterの単体テスト（6件）
src/logic/mastery.ts           (新規)  totalStars(dex) pure関数
src/logic/mastery.test.ts      (新規)  totalStarsの単体テスト（5件）
src/state/progression.ts       (新規)  ingredientState / isRecipeAvailable / availableRecipeIds
                                        pure関数群
src/state/progression.test.ts  (新規)  上記の単体テスト（9件）
src/state/persistence.ts       (+46/-13) sanitizeOwnedIngredientIdsがStarter Setを
                                        無条件backfillするように変更、コメント更新
src/state/persistence.test.ts  (+54)   Starter Set backfillの単体テスト（6件）
src/state/gameReducer.ts       (+37/-8) GameState.ownedIngredientIds追加、
                                        nextOrderState/createInitialGameStateがそれを受け取り
                                        availableRecipeIdsを算出してgetNextOrderへ渡す
src/state/gameReducer.test.ts  (+43)   ownedIngredientIdsのhydration・availability filterの
                                        統合テスト（5件）
src/App.tsx                    (+10/-4) loadSave().ownedIngredientIdsをcreateInitialGameState
                                        に渡す
src/components/DexOverlay.tsx  (+17/-5) 「⭐ 合計★ N」のMastery合計表示を追加
src/App.css                    (+18/-3) 上記表示のスタイル・progress行の再構成
docs/reports/PIZZA_GAME_Phase3C-3_Mastery-Availability_Result.md (新規) 本レポート
```

Recipe availabilityの判定に使う `Recipe.requiredIngredients` / `RECIPES` は無変更。既存6レシピ・
既存13食材のデータそのもの（`src/data/recipes.ts` / `src/data/ingredients.ts` の実体）にも変更なし
（`ingredients.ts` に型定義とderived exportを追加しただけで、13件のオブジェクトリテラル自体は
一切書き換えていない）。

## Mastery definition

`src/logic/mastery.ts` の `totalStars(dex: DexState): number` のみを実装した:

```ts
export function totalStars(dex: DexState): number {
  return dex.reduce((sum, entry) => sum + (entry.discovered ? entry.bestStars : 0), 0);
}
```

- 発見済み各レシピのDex BEST `bestStars` の合計。未発見レシピ（エントリが無い、または
  `discovered: false`）は0として扱われる。
- `timesMade` は一切参照しない（何度作ってもBESTが変わらなければtotalStarsは変わらない）。
- **保存しない**。呼び出し側（`DexOverlay` の合計★表示、`src/state/progression.ts` の
  `ingredientState`）は毎回 `dex` から計算し直す。`GameState` / `PersistentSaveV1` に
  `totalStars` 用のフィールドは追加していない。
- `discoveredCount` / `fiveStarCount` 等の追加ヘルパーは、実際に使う箇所が無かったため
  **追加しなかった**（指示の「必要なものだけ」を遵守）。`DexOverlay` の発見数表示は
  既存の `dex.filter((e) => e.discovered).length` をそのまま利用している。

**注記（SSOTとの差分）**: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` 第7章の原案は
「レシピ別に★4以上で作った回数」をMasteryとして定義しているが、本フェーズの実際の指示
（本チケット）は「Dex BESTの合計★（`totalStars`）」を明示的に要求しており、それに従った。
将来のUnlock condition設計（3C-4以降のShop実装時）は、このズレを踏まえて
「レシピ別カウンター方式に変更するか」「本フェーズのtotalStars方式を正式なMastery定義として
SSOTを更新するか」を判断する必要がある（Known issues参照）。

## Starter Set handling

- 既存6レシピ・既存13食材のデータは一切変更していない。
- `INGREDIENTS` 配列13件はいずれも `unlockCondition` を持たない（=starter）ため、
  `ingredientState()` は常に `OWNED` を返す。
- `RECIPES` 配列6件はいずれも必須食材が全てstarter食材のみのため、`isRecipeAvailable()` は
  常に `true` を返す → 既存6レシピは今回の変更で一切lockされない。
- 390×844実機確認で実際に6/6コンプリートできることを確認済み（後述）。

## Ingredient state model

`src/state/progression.ts`:

```ts
export type IngredientState = "LOCKED" | "AVAILABLE_TO_BUY" | "OWNED";

export function ingredientState(
  ingredient: Ingredient,
  ownedIngredientIds: readonly string[],
  totalStars: number,
): IngredientState {
  if (ownedIngredientIds.includes(ingredient.id)) return "OWNED";
  if (!ingredient.unlockCondition) return "OWNED"; // starterは常にOWNED（安全弁）
  return totalStars >= ingredient.unlockCondition.minTotalStars ? "AVAILABLE_TO_BUY" : "LOCKED";
}
```

- **canonical**: `ownedIngredientIds`（persistenceに保存される唯一の食材関連canonical
  data）。
- **derived**: `LOCKED` / `AVAILABLE_TO_BUY` はこの関数を呼ぶたびに`ownedIngredientIds`と
  `totalStars`から計算される。保存されるフィールドはどこにも無い。
- starter食材（`unlockCondition` 無し）は、たとえ `ownedIngredientIds` に含まれていなくても
  常に `OWNED` を返す **安全弁**にしてある。実際の永続化層（`sanitizeOwnedIngredientIds`）が
  Starter Setを無条件backfillするため通常この分岐に到達することは無いはずだが、
  「将来ownedIngredientIdsを直接組み立てる別の呼び出し元が出てきても、starter食材だけは
  絶対にLOCKEDにならない」という二重の保証にしている。

現在13食材はいずれも `unlockCondition` を持たないため、この関数は本フェーズの実データに
対しては常に `OWNED` を返す。テストでは本番データに一切手を加えず、テストファイル内だけで
定義した架空のmock ingredient（`unlockCondition: { minTotalStars: 10 }`）でLOCKED /
AVAILABLE_TO_BUY / OWNEDの3遷移を検証した（`src/state/progression.test.ts`）。

## Unlock condition model

```ts
export interface IngredientUnlockCondition {
  minTotalStars: number;
}
```

- `Ingredient.unlockCondition?: IngredientUnlockCondition` として `src/data/ingredients.ts`
  に追加。指示どおり `totalStars >= N` という単一のflatな形にとどめ、条件タイプの
  タグ付きunion・ルールエンジンは作っていない。
- 将来 `salami` 等を追加する際は、`INGREDIENTS` 配列に
  `{ id: "salami", ..., unlockCondition: { minTotalStars: 12 } }` のようなエントリを
  1件足すだけで良い設計（`STARTER_INGREDIENT_IDS` は `unlockCondition` の有無から自動的に
  再計算されるため、他のコードを触る必要が無い）。
- 今回はRecipe #7・salami等の実データは一切追加していない（指示どおり非スコープ）。

## Canonical vs derived data（境界）

| 種別 | 内容 | 置き場所 |
|---|---|---|
| **Canonical（保存）** | `dex`（Dex BEST + timesMade）/ `ownedIngredientIds` | `PersistentSaveV1`（`persistence.ts`）、ランタイムでは `GameState.dex` / `GameState.ownedIngredientIds` |
| **Derived（都度計算・非保存）** | `totalStars` | `logic/mastery.ts` |
| **Derived（都度計算・非保存）** | `IngredientState`（LOCKED/AVAILABLE_TO_BUY/OWNED） | `state/progression.ts` の `ingredientState` |
| **Derived（都度計算・非保存）** | Recipe availability | `state/progression.ts` の `isRecipeAvailable` / `availableRecipeIds` |

`recipeUnlocked` のような専用boolean state、`ingredientLockedIds` のような専用配列は
どこにも追加していない。Reducer (`GameState`) に保存したのは `ownedIngredientIds` 1個のみ
（`dex` は既存）。

## Persistence compatibility

`src/state/persistence.ts` の `PersistentSaveV1` 自体のフィールド構成・
`schemaVersion` は**変更していない**（Phase 3C-2時点で既に `ownedIngredientIds: string[]`
フィールドが予約済みだったため、今回はスキーマ形状の変更が不要だった）。

変更したのは読み込み時のsanitize処理のみ:

```ts
function sanitizeOwnedIngredientIds(raw: unknown): string[] {
  const validKnownIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && KNOWN_INGREDIENT_IDS.includes(id))
    : [];
  return Array.from(new Set([...STARTER_INGREDIENT_IDS, ...validKnownIds]));
}
```

- Phase 3C-2時点の実装は「`ownedIngredientIds` が配列でなければ全13食材、配列なら
  その中身をそのまま（フィルタのみ）」という挙動だった。これだと理論上
  `ownedIngredientIds: []`（空配列、`Array.isArray` は true）が保存されていた場合に
  starter食材を失う経路が存在した。
- 今回、常に `STARTER_INGREDIENT_IDS` を無条件で和集合に加える形に変更し、
  「fresh save」「Phase 3C-2形式のsave（何が入っていても）」「未知のingredient idが
  混ざったsave」のいずれでも、Starter Set 13食材だけは絶対に失われないことを保証した。
- **schemaVersionはbumpしていない**（`1` のまま）。データ形状（フィールド名・型）は
  一切変わっておらず、既存v1 saveの読み込み結果がより安全になっただけであるため、
  バージョン変更は不要と判断した。
- 書き込み側（`persistDex`）は無変更。今回のフェーズには購入フローが無いため、
  `ownedIngredientIds` へ非デフォルト値を書き込む経路はまだ存在しない
  （常にStarter Set 13件のまま保存され続ける）。

## Recipe availability

```ts
export function isRecipeAvailable(recipe: Recipe, ownedIngredientIds: readonly string[]): boolean {
  const owned = new Set(ownedIngredientIds);
  return recipe.requiredIngredients.every((req) => owned.has(req.ingredientId));
}
```

専用のレシピ別boolean stateは持たず、`requiredIngredients` と `ownedIngredientIds` からの
純粋な導出のみ。現在6レシピは全てstarter食材のみを要求するため常に `true`。

## Order filtering

`src/data/orders.ts` の `getNextOrder` に `availableRecipeIds?: string[]` オプションを追加。

```ts
function availableOrders(availableRecipeIds: string[] | undefined): Order[] {
  if (!availableRecipeIds) return ORDERS;
  const filtered = ORDERS.filter((o) => availableRecipeIds.includes(o.recipeId));
  return filtered.length > 0 ? filtered : ORDERS;
}
```

- `gameReducer.ts` の `nextOrderState` が `availableRecipeIds(state.ownedIngredientIds)`
  （`progression.ts`）を計算し、`dex`（未発見優先用）と一緒に `getNextOrder` へ渡す。
- 未発見優先ルールは変更なし: availableなプール内でまず未発見を優先し、無ければavailable
  プール全体から選ぶ、という既存ロジックの前段に「available filter」を追加した形。
- **安全なfallback**: `availableRecipeIds` が空配列（またはORDERSと一致するものが無い）の
  場合、`availableOrders` は全ORDERSにフォールバックする。これにより「利用可能なレシピが
  0件」という異常事態でも `pickRandom` が空配列を渡されてクラッシュすることは無い。
  現在の実データでは実際にこの状態には到達しない（Starter Setは常にOWNED backfillされる
  ため）が、将来の購入フロー実装時に備えた防御的設計として組み込んだ。
- `preferFirst`（初回起動時のマルゲリータ優先）も同じ `availableOrders` プールに対して
  行うよう統一。マルゲリータはstarterレシピなので実質的な挙動は変わらない。

## Tests

`npm test`:

```
 Test Files  8 passed (8)
      Tests  91 passed (91)
```

既存59テスト（Phase 3C-1/3C-2分）は無変更のまま全てpass。新規32テストの内訳:

### `src/logic/mastery.test.ts`（5件）

- empty Dex → totalStars 0
- 複数レシピのBEST★の合計になる
- undiscoveredエントリ（`discovered: false`）は無視される
- BEST更新でtotalStarsが変わる
- timesMadeはtotalStarsに影響しない

### `src/state/progression.test.ts`（9件）

- `ingredientState`:
  - fresh player（ownedIngredientIds空）で既存13食材全てがOWNED
  - starter食材はownedIngredientIdsに無くてもLOCKEDにならない（常にOWNED）
  - mock future ingredientがしきい値未満でLOCKED
  - mock future ingredientがしきい値以上でAVAILABLE_TO_BUY
  - mock future ingredientがownedIngredientIdsにあればOWNED（totalStarsに関わらず）
- `isRecipeAvailable`:
  - 現在6レシピ全てがStarter Setのみでavailable
  - 必須食材が欠けているとfalse
  - 必須食材が全て揃うとtrue
- `availableRecipeIds`:
  - fresh playerで現在6レシピ全てのidが返る
  - 特定食材が無いと、それを必要とするレシピが除外される

### `src/data/orders.test.ts`（6件）

- availableRecipeIds外のレシピは絶対に選ばれない
- available subset内でも未発見優先が機能する
- availableRecipeIdsが空でもクラッシュせず全ORDERSにフォールバックする
- availableRecipeIdsが実在しないIDのみでも同様にフォールバックする
- preferFirstはavailable subset内でマルゲリータを優先する
- availableRecipeIds省略時は全レシピが対象になる（後方互換）

### `src/state/persistence.test.ts`（追加6件）

- fresh saveは既存13食材全てをOWNED
- `ownedIngredientIds: []` の既存save（Phase 3C-2形式）でも全13食材が復元される
- 一部の食材だけ欠けたリストでもStarter Set全体にbackfillされる
- 未知のingredient idは除外されつつStarter Setは維持される
- 既にvalidなownedIngredientIdsリストはそのままroundtripする
- 壊れた/未知schemaVersionのsaveでもStarter Set全体にフォールバックする

### `src/state/gameReducer.test.ts`（追加5件）

- 未指定時、ownedIngredientIdsはStarter Set全体がデフォルトになる
- hydrateされたownedIngredientIdsが初期stateにそのまま反映される
- 全13食材OWNEDなら60ラウンド以内に現在6レシピ全てに到達できる
- 必須食材が足りないレシピは絶対に選ばれない（margherita以外選ばれ続けない検証）
- PLAY_AGAINをまたいでownedIngredientIdsが引き継がれる

## 390×844 mobile verification (Playwright / Chromium)

`/opt/pw-browsers/chromium` を使い、390×844のビューポートで `npm run dev` 起動中のアプリを
実際に操作して確認（screenshot取得・console/page error監視・`scrollWidth <= clientWidth`に
よるoverflow判定つき、全チェックで自動アサーション）。

1. **Fresh session, 6/6完走**: 新規セッションで最大12ラウンドまで自動プレイし、6レシピ
   （マルゲリータ・ビスマルク・ジェノベーゼ・マリナーラ・フンギ・クアトロ フォルマッジ）を
   6ラウンドで完走。`order selection` が今回追加したavailability filterを経由しても、
   既存の未発見優先ロジックにより毎回別レシピが選ばれ、6/6が問題なく完走できることを確認。
2. **Dexコンプリート表示**: `🏆 6 / 6` `コンプリート！` に加え、今回追加した
   `⭐ 合計★ 30`（全レシピ★5でクリアしたため6×5=30）が正しく表示されることを確認
   （screenshot: `3-dex-complete.png`）。
3. **リロード後の永続化**: ページreload後、`ピザを作る！`（ORDER開始）から始まり
   （途中roundは非復元）、Dexを開くと `🏆 6/6` と `合計★ 30` がそのまま保持されていることを
   確認（screenshot: `4-dex-after-reload.png`）。
4. **Starter backfill safety netの実機確認**: `localStorage` に
   `ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"]` という3食材だけの
   意図的に制限されたsaveを設定してreload → それでも最大14ラウンド以内に現在6レシピ
   全てが順番に注文されることを確認（`sanitizeOwnedIngredientIds` のStarter Set
   無条件backfillが実機でも機能していることの証拠。screenshot:
   `5-restricted-save-still-all-6-recipes.png`）。
5. **壊れたJSON saveでも起動**: `localStorage.setItem('teto-pizza-save-v1', '{bad json')` の
   状態からreloadしても `ピザを作る！` ボタンが表示され正常起動することを確認。
6. 全シナリオを通して **console/page error 0件**、**横方向overflowなし**
   （`document.documentElement.scrollWidth <= clientWidth`）を確認。

```
=== SUMMARY ===
console/page errors: none
overflow findings: none
ALL CHECKS PASSED
```

### 「future locked recipe → orderに出ない」の自動確認について

指示のとおり「可能なら」の対応として検討したが、本フェーズは新規食材・新規レシピの実データ
追加そのものが非スコープ（salami禁止・Recipe #7禁止）であり、現在の13食材は全てstarter
（`unlockCondition`無し）でLOCKEDになり得ない。そのため、本番データだけを使って
「実際にLOCKEDなレシピがブラウザ上で注文候補から除外される」状態を作ることは、
非スコープの食材追加をしない限り原理的に再現できない。

この振る舞い自体（未availableなレシピが選ばれないこと、availableRecipeIdsが空でも
安全にフォールバックすること）は、`src/data/orders.test.ts` と
`src/state/gameReducer.test.ts`（テストファイル内だけで定義したmock ingredient/制限された
ownedIngredientIds配列を使用）で単体・統合の両レベルで厳密に検証済み。ブラウザでの
E2E確認としては、代わりに「Starter Setは制限されたsaveからでも常にavailableであり続ける」
という逆方向の保証（上記シナリオ4）を実機で確認した。

## Regression results

- `npm run lint`（oxlint）: ✅ pass, exit code 0
- `npm test`（vitest）: ✅ 91/91 pass（既存59 + 新規32）
- `npm run build`（`tsc -b && vite build`）: ✅ pass
- `git diff --check`: ✅ no whitespace errors
- 実機確認（390×844, Chromium）: console/page error 0件、overflowなし、6/6完走・
  Dex永続化・Mastery表示・Starter backfill safety netいずれも確認済み（上記参照）

## Known issues

- **Resolved before merge**: Progression SSOT updated to the canonical `totalStars`
  definition（`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` v1.1）。旧P1「本フェーズの
  `totalStars` ベースのMastery定義がSSOT第7章の『レシピ別★4以上達成回数』案と矛盾する」は、
  SSOT第2・7・12・14・16章を `totalStars` 方式に合わせて更新し解消した（詳細は次節
  「Merge Gate修正: SSOT整合」を参照）。production code（`src/logic/mastery.ts` /
  `src/state/progression.ts`）は元々この新しい正式仕様と一致していたため無変更。
- P2: `ingredientState` / `isRecipeAvailable` / `availableRecipeIds` はいずれも
  現在の実データに対しては常に固定値（OWNED / true / 全6レシピ）を返す「まだ実際には
  分岐しない」コードパスである。実際に分岐するのは将来食材が追加されてから
  （3C-4以降）であり、本フェーズ単体では実プレイ上の見た目の変化はDexの
  「合計★」表示のみ。
  設計・テストは将来の分岐に備えて先行整備した。
- P2: `DexOverlay` の「合計★」表示は本フェーズで追加した唯一のUI変更であり、
  Shop・LOCKED食材一覧などは意図的に追加していない（指示どおり最小限）。
- P2: `orders.ts` の空プールfallback（`availableOrders`）は現在の実データでは
  到達しないコードパス（Starter Setは常にavailableなため）。将来、購入フロー実装時に
  実際に空になり得るケース（理論上は無いはずだが）が出てこないか、3C-4実装時に
  再確認が必要。
- Pitz・Shop UI・Mission・Lunch Rush・Recipe #7・salami・素材消費/在庫は
  本フェーズの非スコープであり、未実装（意図通り）。

## Merge Gate修正: SSOT整合（追加commit）

PR #17 レビューで指摘されたP1（本フェーズのMastery実装 `totalStars` と
`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` 第7章旧案「レシピ別★4以上達成回数」との
不一致）を、SSOT側を実装に合わせて更新することで解消した。production codeの変更は
**無し**（`src/logic/mastery.ts` / `src/state/progression.ts` は元々このPRの最初のcommit
時点から `totalStars` 方式で実装されており、今回のcommitはSSOT文書のみを更新した）。

### SSOT変更内容（`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md` v1.0 → v1.1）

- **第2章（用語定義）**: Mastery の定義を「レシピを高品質で作った回数」から
  「全レシピの Dex BEST ★ の合計（`totalStars`）、derived・非永続化」に更新。
- **第6章**: LOCKED→AVAILABLE_TO_BUYの遷移図に `totalStars` / `minTotalStars` の
  用語を明示。
- **第7章（Mastery → Shop availability）**: 全面改訂。
  - Mastery を `totalStars`（全レシピのDex BEST★合計）として正式定義し、
    「レシピ別カウンター」案を廃止。
  - `unlockCondition: { minTotalStars: N }` という、レシピへの個別紐付けを持たない
    全レシピ共通のしきい値判定であることを明記。
  - 合計★方式を採用する理由（理解しやすさ／全レシピへの寄与／★5を狙う意味／Dex BESTとの
    相性）を簡潔に追記。
  - 「作る→Dex BEST更新→totalStars増加→unlock condition達成→AVAILABLE_TO_BUY→
    Mission→Pitz→Shop購入→OWNED→recipe available」という基本ループと、
    「★は入荷条件、Pitzは購入手段、★だけではOWNEDにならない」という役割分離を明文化。
- **第12章（#7サラミ提案）**: 「マルゲリータのMastery ★4以上×3回」という旧案の紐付け
  カウンター表現を削除し、`unlockCondition: { minTotalStars: N }` ベースの表現に更新
  （具体的なNやsalami実装自体は本PRでは追加していない、対象外のまま）。
- **第14章（Persistence）**: 永続化データ一覧から「Masteryカウンター（レシピ別）」を削除し、
  「`totalStars` は derived のため永続化しない」ことを明記。スキーマ例からも
  `masteryByRecipeId` を削除。
- **第16章（Roadmap）**: 3C-4/3C-5の説明文からレシピ別Mastery/Ingredient State関連の
  古い表現を除去し、実際の実装順序（3C-1〜3C-3で先行実装済み）を簡潔な注記として追加。
- **改訂履歴**: v1.1エントリを追加し、本更新の経緯と参照先（本レポート）を記録。

### Design intent（SSOTに記載した採用理由、要約）

合計★（`totalStars`）方式を正式仕様とした理由:

- プレイヤーに理解しやすい（「あと★2で入荷」と一言で進捗を示せる）
- 全レシピの上達がProgressionにまんべんなく寄与する（1レシピの周回作業にならない）
- ★5を狙う意味が最後まで残る
- Dex BESTとの相性がよく、新しい保存領域を増やさずに済む

### 役割分離（今後のPhase 3C-4以降が守るべき境界として明文化）

- ★（`totalStars`）: 食材の入荷条件（`LOCKED` → `AVAILABLE_TO_BUY`）にのみ使う
- Pitz: 購入手段（`AVAILABLE_TO_BUY` → `OWNED`）
- ★だけで食材が `OWNED` になることはない（入荷と購入は常に別ステップ）

### Production code側の確認結果

`src/logic/mastery.ts` の `totalStars(dex)` と `src/state/progression.ts` の
`ingredientState()`（`unlockCondition.minTotalStars` を参照）は、更新後のSSOT第7章と
完全に一致することを確認した。**不要なrefactorは行わず、production codeは無変更**。

### Verification（この追加commit時点）

```
$ npm run lint    # oxlint: pass, exit code 0
$ npm test        # vitest: 91/91 pass（既存件数のまま、production code無変更のため回帰なし）
$ npm run build   # tsc -b && vite build: pass
$ git diff --check
```

いずれもグリーン。production codeを変更していないため、テスト件数・内容ともに前回commit
（0cce513）から変化なし。

## Final Verdict

**A. READY TO MERGE**

- スコープ（Mastery計算・Ingredient progression state・Recipe availability・order
  selection availability filter・persistenceとの整合）を逸脱していない
- 既存6レシピ・既存13食材・既存ゲームループ（ORDER→PREPARE→BAKE→RESULT→DISCOVERED）を
  破壊していない（実機で6/6完走を確認済み）
- Starter Setは今回の変更によって一切lockされない（データ上・safety net両方で保証、
  実機でも制限されたsaveから確認済み）
- Canonical（`dex` / `ownedIngredientIds`）とderived（`totalStars` /
  `IngredientState` / recipe availability）の境界を守り、重複state・rule engineは
  作っていない
- schemaVersionをbumpせずに互換性を確保（Phase 3C-2 saveの安全な移行を実機・単体両方で
  確認済み）
- lint / test / build すべてグリーン（91/91テスト）
- 390×844実機確認で指定項目（6/6完走・Dex BEST/Mastery永続化・reload後のORDER開始・
  Starter backfill safety net・console/page error 0件・overflowなし）を確認済み
- P0: 0件 / P1: 0件（Mastery定義のSSOT不一致は本追加commitでSSOT側を更新し解消済み）。
  残るKnown issuesはいずれもP2（ブロッカーなし）
