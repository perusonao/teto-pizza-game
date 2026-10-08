# Dex・Shop 全件表示（OD-DISPLAY-1 / OD-DISPLAY-2）— 実装計画と受け入れテスト

Status: **docs-only / READ-ONLY**。Production コード・test・save・CSS・SSOT いずれも変更していない。実装は **#418 D2 Pilot の Owner HV PASS まで禁止**（Issue #422 / #420）。
Issue: #422（設計確定 + OD-DISPLAY-2）。整合先: #420（OD-420-1）、Anti-Oracle Contract 2.1（INV-D4 / INV-D7）。
Base: `main` `b9ca1fa`（Batch 5 まで。53 recipe / 57 ingredient / ladder 49 step）。
触れていないもの: #418、既存監査の再実行、PR / merge / deploy / CI / E2E。

> **出典の扱い**: Issue #422 本文（OD-DISPLAY-1/2）と #420（OD-420-1）を Owner Decision の正本とした。リポジトリ内に #422 専用の監査ドキュメントは存在しなかったため、「既存監査」の結論は Issue 本文の記述と現行 `main` のコード読解（ファイルと行は下記）で裏取りしただけで、監査自体はやり直していない。

---

## 0. 決定事項の要約（変更しない）

| # | 決定 | 出典 |
|---|---|---|
| D1 | Dex は既に全 53 枠を表示している。未発見枠に **全種共通の汎用ピザシルエット**を足す。章・No.・発見数・D-2 集約は維持。**発見済みピザ画像の追加は対象外** | OD-DISPLAY-1 |
| D2 | Shop は購入対象の全有限食材（`obtainableIngredientIds` から starter 除外）を **NEW → OWNED → LOCKED** で表示。LOCKED は**カテゴリタブと分離した末尾セクション** | OD-DISPLAY-1 |
| D3 | LOCKED 各行は 🔒・？？？・共通シルエットのみ。実名・実グリフ/emoji・family・価格・パック量・購入ボタン・ingredient ID を DOM/aria/data 属性に出さない。購入ガード維持 | OD-DISPLAY-1 |
| D4 | 個別の発見残数は出さず、集約「あとNつ発見」を維持 | OD-DISPLAY-1 |
| D5 | 該当条件が**両方**あるとき 2 行を**同時表示**（優先順位で隠さない）。⭐行は「対象 Step 到達済み かつ 累計⭐不足」の場合のみ。複数対象は**次に達成可能な最小不足数**を集約表示。個別 LOCKED 行との対応・名前・ID・family・価格は出さない | OD-DISPLAY-2 |
| D6 | #420: goat-cheese = Step50 AND 累計⭐120、spinach = Step51 AND 累計⭐130。⭐は非消費・Dex bestStars 合計から導出。この数値は変更しない | OD-420-1 |
| D7 | 共通化は**ロック枠の表示コンポーネントのみ**。Dex / Shop の状態 authority は分離。save schema 変更なし | OD-DISPLAY-1 |

---

## 1. 現状（`main` の事実）

| 項目 | 現状 | 位置 |
|---|---|---|
| Dex 未発見枠 | `UndiscoveredSlot`: 🔒 + `No.xx ？？？` + タグ文言（`まだ見ぬピザ` / 🎨 / 🏪）+ CTA。画像・SVG なし。root に `data-dex-state`（`UNKNOWN` / `DISCOVERABLE` / `KNOWN_BUT_MISSING_MATERIAL`） | `src/components/DexOverlay.tsx:112-156` |
| Dex D-2 集約 | DISCOVERABLE 未発見が 2 件以上 → 各枠は `UNKNOWN` 表示に潰し、`AggregatedUnknownCard` 1 枚 | `DexOverlay.tsx:196-209,232` |
| Dex 発見数 | `🍕 発見 N / 53`、`あとN種類！`（全件数は既に公開済み） | `DexOverlay.tsx:281-289` |
| Shop 行 | `shopRows` が `NEW`/`OWNED` のみ列挙。**LOCKED は列挙しない**（`materialShopState` の `LOCKED` は未使用） | `ShopOverlay.tsx:61-75`, `materialShop.ts` `materialShopState` |
| Shop 発見数ヒント | `nextMaterialHint(discoveredCount, unlocked)`: `step > count` かつ未 entitle の材料を持つ最小 step。`あと{N}つ発見で新しい材料が入荷` | `materialShop.ts` `nextMaterialHint`, `ShopOverlay.tsx:189-193` |
| Shop タブ | `ShelfTabs` は**表示行（NEW/OWNED）から**導出。LOCKED のみの family はタブ・DOM・文言を持たない | `ShopOverlay.tsx:118-126` |
| Shop 行 DOM | `data-ingredient-id` / `data-shop-state` / `data-stock-state`、`IngredientGlyph`、`FamilyTag`、価格、パック量、ボタン | `ShopOverlay.tsx:222-276` |
| 購入ガード | `materialShopState` が `LOCKED` を返し、reducer 側 transaction が `LOCKED` で fail-closed（`MaterialPurchaseFailureReason` に `LOCKED`） | `materialShop.ts` 購入 transaction |
| 母集団 | `obtainableIngredientIds()` = starter + ladder 材料。現 catalog は 57 ingredient / starter 3 → **purchasable 54 の見込み**（実装時に独立計算、§8-5） | `materialEntitlement.ts:107-110` |
| ⭐ | `totalStars(dex)` = 発見済み recipe の `bestStars` 合計（非保存・導出）。**⭐を解禁条件にする経路は現 ladder に存在しない**（OD-REC04-1。Ingredient の旧 `unlockCondition.minTotalStars` は #420 で再利用しない方針） | `src/logic/mastery.ts:19` |
| #420 食材 | `avocado` / `goat-cheese` / `artichoke` / `spinach` は **catalog にまだ無い**（Batch 6 実装待ち） | `src/data/ingredients.ts`（grep 0 件） |

---

## 2. 表示コンポーネントと authority の境界

```
 ┌──────────────── authority（分離・変更しない／各 PR で最小追加）────────────────┐
 │ Dex : recipeDiscoveryState / buildRecipeChapters / chapterProgress             │
 │ Shop: materialShopState / obtainableIngredientIds / nextMaterialHint           │
 │ ⭐  : totalStars(dex)  ＋（#420 starGate 定義）                                   │
 └─────────────────────────────────────────────────────────────────────────────┘
            │ 出力は「数」「真偽」だけ（id / 名前 / 順序を presentation に渡さない）
            ▼
 ┌──────────── presentation（共通化するのはここだけ）──────────────┐
 │ <AnonymousLockedSlot variant="dex" | "shop" />                    │
 │ <GenericPizzaSilhouette />  （全種同一の静的 SVG）                │
 └──────────────────────────────────────────────────────────────────┘
```

### 2.1 共通部品の契約（PR-A で新設）

- `GenericPizzaSilhouette`: props なし。純静的 SVG（`aria-hidden="true"`、`focusable="false"`、`id` / `<title>` / `<desc>` / `data-*` 無し。`ingredient-glyph--<visual>` のような identity 由来 class 禁止）。1 つの定数 JSX。
- `AnonymousLockedSlot`: **domain 値を一切受け取らない**。受けてよい props は `variant`（`"dex" | "shop"`、見た目の差のみ）、`slotNumberLabel?: string`（Dex の `No.xx`、既存表示のまま）、`children?`（Dex のタグ・CTA を差し込む既存の枠）。`Recipe` / `Ingredient` / `id` / `name` / `category` 型を props に**持たせない**（型でも漏洩経路を閉じる）。
- 共通化しないもの: 状態判定、件数計算、ヒント文言の算出、CTA の出し分け（Dex の `onShowHint` 等は呼び出し側に残す）。

### 2.2 authority ごとの追加（各 PR で最小）

| PR | 追加する authority | 置き場所案 | 入出力 |
|---|---|---|---|
| A | なし（Dex は既存 authority のみ） | — | — |
| B | `lockedShopSlotCount(owned, unlocked, ladder)` | `src/logic/materialShop.ts`（pure） | 入力: id 集合。出力: **number のみ**。`obtainable − starter − (NEW ∪ OWNED)` |
| C | `nextStarGateHint(totalStars, discoveredCount, unlocked, ladder)` | `src/logic/materialShop.ts`（pure）。`starGate` の型・データは #420 側 | 出力: `{ starsNeeded: number } \| null`（step・id を返さない） |

- `ShopOverlay` は `lockedCount` と 2 つのヒントの**数だけ**を受け取って描画する。LOCKED 材料の `Ingredient` オブジェクトを `ShopOverlay` の描画スコープに持ち込まない（`shopRows` は従来どおり NEW/OWNED のみ。LOCKED は件数経路のみ）。
- Dex の「未発見 53−N 枠」は `RECIPES` を既に回している既存経路で足りる。新しい authority 不要。
- `data-dex-state` は**既存仕様どおり維持**（本件で増減させない。Contract 2.1 の既存挙動であり、シルエット追加で新たな識別情報にならないことをテストで固定する）。

---

## 3. PR-A — Dex 汎用シルエット + 共通表示部品

**目的**: 未発見 Dex 枠に全種共通の匿名シルエットを追加する。発見済みカードは無変更。

**変更範囲（実装時）**
1. `GenericPizzaSilhouette` / `AnonymousLockedSlot`（新規コンポーネント + CSS）。
2. `UndiscoveredSlot` / `AggregatedUnknownCard` の外枠を `AnonymousLockedSlot` に置換（`dex-card--locked` / `data-dex-state` / `data-dex-aggregated` / CTA は同一出力を維持）。
3. 技法（`dex-card--technique`）の riddle カードはシルエット対象外（OD-DISPLAY-1 は recipe 枠のみ）。見た目の混在を避けるため、`dex-card--locked` を技法と共用している CSS の分離要否を HV で確認（Owner 判断 O-3）。

**変えない**: 章構成・No.・発見数・`あとN種類！`・D-2 集約・ヒント/研究 CTA・研究カード・発見済みカード・save・`recipeDiscoveryState`。

**受け入れ基準 (AC-A)**
- AC-A1 未発見 recipe 枠の数 = `RECIPES.length − 発見数` で、**全枠が同一のシルエット要素**を 1 つ持つ（outerHTML 同一）。
- AC-A2 シルエットは recipe ごとに差がない（recipe id / 名前 / 章 / 材料数 / 名前文字数に依存しない）。
- AC-A3 発見済みカード・NEW / NEW BEST・scroll-into-view・章カウント表示は無変更。
- AC-A4 D-2 集約（DISCOVERABLE ≥ 2）で枠が `UNKNOWN` 表示に潰れる挙動と、集約カードの有無が従来と同一。
- AC-A5 390×844 / 360×800 で 53 枠スクロール時にレイアウト崩れ・横スクロール・CTA 重なりなし（§5）。

---

## 4. PR-B — Shop LOCKED 全件表示

**依存**: PR-A（共通部品）。

**変更範囲（実装時）**
1. `lockedShopSlotCount` を pure 関数として追加。
2. `ShopOverlay`: 末尾に **タブの外側**の LOCKED セクションを追加。`ShelfTabs` の導出（`listedIngredients`）と `visibleRows` の絞り込みは**変更しない**（LOCKED はフィルタ対象にしない）。
3. 空状態: 現在の `rows.length === 0` →「新しいピザを発見すると、材料が入荷します」は、LOCKED だけが並ぶ状態でも意味が通るか再判断（Owner 判断 O-5）。
4. 既存の集約「あとNつ発見で新しい材料が入荷」は**そのまま**。

**LOCKED セクション仕様（案。Owner 未承認の細部は §7）**
- 全 LOCKED 行は同一 DOM（`AnonymousLockedSlot variant="shop"`）: 🔒 + `？？？` + 共通シルエット。ボタン・価格・パック量・在庫・family・badge なし。
- `data-ingredient-id` / `data-shop-state` / `data-family` / `data-stock-state` は**付けない**。セクション識別は固定属性 1 つ（例 `data-shop-locked-section`、値なし）に限る。
- 行はフォーカス不能・非インタラクティブ（`button` / `tabindex` / `onClick` / `role=button` なし）。
- 件数は `lockedShopSlotCount` の number だけで決まる。DOM 順に catalog 順・ladder 順・family 順の情報を載せない（全行同一なので順序は構造上無情報）。
- 購入ガード: `materialShopState` の `LOCKED` 拒否はそのまま。UI から id が一切出ないため forged 経路は reducer 直叩きのみで、既存の fail-closed テストを維持。

**受け入れ基準 (AC-B)**
- AC-B1 表示行 = NEW + OWNED + LOCKED = `obtainableIngredientIds().length − STARTER 数`（母集団を独立計算、§8-5）。
- AC-B2 並びは NEW → OWNED → LOCKED。LOCKED はタブ選択に関係なく末尾セクションに常時表示。タブ切替で LOCKED 件数・DOM が変化しない。
- AC-B3 LOCKED 行から実名・グリフ・family・価格・パック量・ボタン・ID が DOM/aria/data/class/title/alt に出ない（§6）。
- AC-B4 全 LOCKED 行の outerHTML が完全一致。
- AC-B5 どの材料が LOCKED でも（入れ替えても）LOCKED セクションの HTML は件数以外同一。
- AC-B6 既存の NEW/OWNED 行・購入/補充・フィードバック・Pitz 不足表示・在庫なし表示が無変更。
- AC-B7 購入ガード維持（LOCKED id の `PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT` は state 不変・Pitz 不変）。
- AC-B8 390×844 / 360×800 で、54 行が NEW/OWNED/LOCKED 混在でも一覧が操作可能（§5）。

---

## 5. PR-C — 累計⭐ヒント（#420 統合）

**依存**: PR-B、かつ **#420 Batch 6 の starGate authority（案α: Ladder Step 定義の食材別 starGate）**。starGate が main に無い間は着手不可（本計画は PR-C を「#420 実装 PR と同じゲート」で扱う）。

**ヒント算出（案。純粋関数）**
- 入力: `totalStars(dex)`, `discoveredCount`（ladder 用）, `unlockedForShopIngredientIds`, ladder（starGate 付き）。
- 対象 = 「Step に到達済み（`step <= discoveredCount`）かつ starGate を持ち、未 entitle、`totalStars < requiredStars`」の食材。
- 出力 = 対象の `requiredStars − totalStars` の**最小値**（次に達成可能な最小不足数）。対象 0 件なら `null`。
- Step 未到達の starGate 食材は対象外 → 表示も、存在のにおわせもなし。
- 発見数ヒント（既存 `nextMaterialHint`）は**独立に算出**。starGate 食材の Step が到達済みなら `step > count` を満たさないため発見数ヒントの対象から自然に外れる（二重計上なし）。

**表示（OD-DISPLAY-2）**
- 発見数行「🔜 あとNつ発見で新しい材料が入荷」と ⭐行「⭐あとN個で新しい材料が入荷」は、**独立条件で両方出す**。片方を優先して隠す分岐を作らない。
- 2 行の並び順・アイコン・折返しは Owner 未承認（O-2）。

**例（#420 の値で確認する検算）**

| 状況 | 発見数行 | ⭐行 |
|---|---|---|
| 発見数 49、⭐0 | あと1つ（Step50） | なし（Step50 未到達） |
| 発見数 50、⭐100（goat-cheese 未解禁） | Step51 の avocado/artichoke 側が未 entitle ならあと1つ | あと20個 |
| 発見数 51、⭐100 | 次 Step が無ければなし | あと20個（goat-cheese 120 が spinach 130 より小さい） |
| 発見数 51、⭐120 | なし | あと10個（goat-cheese は解禁、spinach 130 のみ残） |
| 発見数 51、⭐130 | なし | なし |

**受け入れ基準 (AC-C)**
- AC-C1 両条件該当時に 2 行が同時表示される。
- AC-C2 対象 Step 未到達では⭐行が DOM に存在しない（`display:none` の隠し要素も不可）。
- AC-C3 複数対象は最小不足数のみ。個別対応・食材名・ID・family・価格は出ない。
- AC-C4 ⭐は非消費：購入/補充/Pitz で `totalStars` が変わらない。累計到達で解禁され、再ロックしない（既存 save も遡及適用、#420）。
- AC-C5 ⭐のヒント文言に ⭐が現れても、LOCKED 行の匿名性（AC-B3/B4）は不変。
- AC-C6 ⭐が到達不能な値にならないこと（最大⭐ > 130 の実現性）は #420 側の責務として参照のみ（本計画では検証しない）。

---

## 6. 情報漏れ防止テスト計画（DOM / aria / data 属性）

### 6.1 方針
1. **allow-list 方式**: LOCKED 領域の要素・属性・テキストを全列挙し、許可リスト（`class`、`aria-hidden`、固定の `data-*` 1 種）以外が 1 つでもあれば fail。
2. **deny-list 方式**: 全 `INGREDIENTS` / `RECIPES` から生成した禁止語（`id`、`nameJa`、`emoji`、family の `labelJa` / `symbol`、`category` ラベル、価格 `60/80/100/120` と refill `30/40/50/60`、パック量 `10ピザ分` / `（N個）`、`仕入れる` / `補充する` / `NEW` / `在庫`、recipe 名 / `description`）を、LOCKED 領域の `innerHTML`（text・属性値・class・SVG 内部すべて）に対し `not.toContain`。
3. **同一性方式**: 全 LOCKED 行の `outerHTML` の `Set.size === 1`。さらに「LOCKED 集合を入れ替えた 2 つの状態」で LOCKED セクションの HTML が一致（件数が同じ場合）。
4. **アクセシビリティツリー**: `getAllByRole` で LOCKED 領域内に `button` / `link` / `img(name付き)` / `tab` が 0。`aria-label` / `aria-labelledby` / `title` / `alt` は存在しないか、**固定の汎用文言 1 種**のみ。

### 6.2 テストケース

| ID | 対象 | 内容 | 層 |
|---|---|---|---|
| L-1 | Shop | 全 LOCKED 行 outerHTML が同一 | unit (RTL) |
| L-2 | Shop | LOCKED 領域 deny-list 全語がゼロ（全 54 purchasable を「LOCKED にした 1 件」ずつ回して網羅） | unit |
| L-3 | Shop | LOCKED 領域の属性名が許可リスト内。`data-ingredient-id` / `data-shop-state` / `data-family` / `data-stock-state` / `data-ingredient-visual` が 0 | unit |
| L-4 | Shop | 専用 `pieceVisual`（tomato-slice / caper-cluster / clam-valve）を持つ材料が LOCKED のとき `svg.ingredient-glyph*` が 0 | unit |
| L-5 | Shop | LOCKED 領域内の interactive 要素 0、`tabIndex>=0` の要素 0 | unit |
| L-6 | Shop | LOCKED 領域は `ShelfTabs` の選択変更で不変。LOCKED のみの family のタブ・family 文言は従来どおり出ない（`ShelfTabs` が LOCKED から導出されない） | unit |
| L-7 | Shop | LOCKED 件数 = `lockedShopSlotCount`。件数は **number 以外の差分を持たない**（件数以外のテキスト・属性が状態間で同一） | unit |
| L-8 | Shop | `document.body.textContent` 全体の deny-list（LOCKED 材料の名前が NEW/OWNED 行以外に出ない）。NEW/OWNED の名前が LOCKED 領域に出ない | unit |
| L-9 | Shop | `lockedShopSlotCount` / `nextStarGateHint` の戻り値型が number / `{starsNeeded}` のみ（id・step を返さない）— 型テスト + 実行時 `Object.keys` 固定 | unit |
| L-10 | Shop | 購入ガード: 全 LOCKED id で `PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT` が state 参照同一 | reducer |
| L-11 | Dex | 全未発見枠（recipe）のシルエット要素 outerHTML 同一。`No.xx` 以外のテキスト差は `data-dex-state` タグ文言のみ | unit |
| L-12 | Dex | Dex deny-list: 未発見 recipe の `nameJa` / `id` / `description` / 材料名が未発見枠に 0（既存 W1-b 系 oracle を流用） | unit |
| L-13 | Dex | シルエット追加前後で `data-dex-state` の分布・集約カード有無・CTA 出現が不変（53 枠 × 発見数 0..53 の走査、既存 `DexOverlay.discovery.test.tsx` の ladder 走査に相乗り） | unit |
| L-14 | ⭐ | ⭐行は対象 Step 未到達で DOM 0。到達後に⭐不足があるときのみ出る | unit |
| L-15 | ⭐ | ⭐行と発見数行の同時表示（両条件）/ どちらか片方のみ / どちらもなし の 4 通り | unit |
| L-16 | ⭐ | ⭐行の文言は `⭐あとN個で新しい材料が入荷` のみ。食材名・family・価格・Step 番号を含まない | unit |
| L-17 | 横断 | Contract 2.1 INV-D4/D7: LOCKED 追加後も RESULT / Research パネル・Hint の DOM は不変（スナップショット比較。Dex/Shop 以外の画面は無差分） | unit |
| L-18 | 横断 | production ソース walk: `ShopOverlay` / ロック枠コンポーネントが `INGREDIENTS` の LOCKED 要素を描画スコープで参照していない（`import.meta.glob ?raw` の既存パターンで禁止シンボルを検査） | unit |
| L-19 | 画面 | 390×844 / 360×800 で LOCKED 領域の `getBoundingClientRect` に横はみ出しなし、行高が一定 | 手動 HV（自動 E2E は本タスク対象外） |

> E2E（Playwright）は本タスクで実行しない。実装時に追加・更新が必要な既存 spec は §8-3 に列挙のみ。

---

## 7. 画面確認項目

### 7.1 共通（390×844 を authority、360×800 を secondary — HV Policy §3）
- 対象: Dex（未発見が多い初期 save / 中盤 / 終盤 / 全発見）、Shop（NEW のみ / NEW+OWNED / LOCKED のみ / 全 OWNED で LOCKED 0 / Pitz 不足）。
- 確認:
  1. 横スクロールなし、パネルの最大高 `calc(100dvh − …)` 内で本体のみスクロール。ヘッダ・閉じるボタン常時可視。
  2. シルエットが全枠で同一サイズ・同一位置、`No.xx` / `？？？` と重ならない。
  3. 🔒 / ？？？ / シルエットのコントラストが読める（現 `.dex-card--locked { opacity: .6 }` との二重減衰に注意）。
  4. タップ領域: Dex の既存 CTA（ヒントを見る / レシピ発見へ / ショップを見る）が 44px 級で重ならない。LOCKED 行にタップ反応がない（ハイライト・フォーカスリングなし）。
  5. 長い一覧（Dex 53 枠 / Shop 54 行）のスクロール性能と先頭復帰。
  6. 発見直後の Dex 初期スクロール（`.dex-card--new` へ `scrollIntoView`）がシルエット追加で位置ずれしない。

### 7.2 Dex 固有
- D-2 集約カード表示中 / 非表示で、集約カードとシルエット枠の見分け（集約カードは従来どおり別意匠）。
- 技法（調理法）riddle カードとの視覚的区別（O-3）。
- 章見出し `N/M ✓` 表示と枠の間隔。

### 7.3 Shop 固有
- LOCKED セクション見出し（有無は O-1）と NEW/OWNED リストとの境界。
- カテゴリ/family タブ切替で LOCKED セクションが動かない・消えない。
- ヒント 2 行（発見数 + ⭐）が 360px 幅で何行に折り返すか、上部残高/フィードバック表示とのスタック高（PR-C）。
- 購入直後フィードバック（`aria-live`）表示時の LOCKED 位置ジャンプなし。
- LOCKED 件数が 0 / 1 / 約 50 の 3 点。

### 7.4 成果物（`CLAUDE.md` / HV Policy）
- 390×844 の動画（直接提出、repo に commit しない）、before/after スクショを `docs/reports/screenshots/<task-name>/`（PR ごと: `dex-locked-silhouette` / `shop-locked-all` / `shop-star-hint`）、Result Report に `## Human Verification Videos` と `Video Verification: PASS`、Owner HV。

---

## 8. 既存テストで更新が必要な前提

### 8.1 単体 / コンポーネント（具体行は現 `main`）

| ファイル | 前提 | 対応 |
|---|---|---|
| `src/components/ShopOverlay.test.tsx` `describe("rows: LOCKED hidden…")`（L62- 付近、冒頭コメント L15） | 「NEW と OWNED のみ列挙。LOCKED は列挙しない」 | 表題と期待を「NEW/OWNED は実行、LOCKED は匿名行として別セクション」に改定。`data-ingredient-id` 行の集合は NEW/OWNED のみのまま検証（これは維持される） |
| 同 L196-205 `copy` | `document.body.textContent` に `★ / 腕前 / プレゼント / 無料 / 🔒` が**ない**ことを要求 | `🔒` 禁止を削除（LOCKED 領域で 🔒 を許可）。`★` は⭐行追加（PR-C）に備え「LOCKED 領域外・かつ PR-C 前は不在」に限定。`プレゼント/無料` は維持 |
| 同 L156-197 発見数ヒント | `あと1つ発見…` の有無 | 文言・条件は不変。LOCKED 行追加で `getByText` の曖昧一致が増えないか確認 |
| 同 L212-232 "no undiscovered recipe name anywhere in the Shop" | `textContent` / `aria-label` / `title` / `alt` に未発見 recipe 名なし | **維持（そのまま強化テストとして生きる）**。LOCKED 行が加わった状態でも走査が通ること |
| `src/components/ShopOverlay.shelf.test.tsx` L58 `a family that only holds LOCKED materials has no tab, no DOM node and no text` | LOCKED の family は「DOM node も text も無い」 | 「**タブと family 文言**が無い」に範囲を限定。LOCKED 匿名行（family を含まない）は存在してよい。`no DOM node` を `[data-family]` / family ラベルに限定 |
| 同 L101 `nothing outside the entitled set is ever listed under any tab (LOCKED never appears)` | `listedIds()`（`data-ingredient-id`）が entitled の部分集合 | 論理は維持（LOCKED は id を持たない）。題名のみ改定 |
| 同 L114-117 | 全タブ合計 = entitled 集合 | 維持 |
| `src/components/DexOverlay.discovery.test.tsx` L120-122 | `.dex-card--locked` 数 = `RECIPES.length − n`、かつ `.dex-card--locked svg` が **0** | **PR-A で必ず破れる**。`svg` 禁止を「シルエット SVG のみ許可（`.dex-card--locked svg` はすべて同一シルエット）」に改定。`.dex-card__ingredient` が 0 は維持。`.dex-card--locked` は技法 riddle カードも使うため、数の母集団に影響がないか確認 |
| 同 L82 `getAllByText("まだ見ぬピザ")` 件数 | タグ文言の件数 | 維持（文言は変えない） |
| `src/components/DexOverlay.hint.test.tsx` | CTA / 集約 / `data-dex-state` | シルエットが CTA の accessible name を変えないことを確認（変更不要見込み） |
| `src/components/IngredientGlyph.test.tsx` | Shop を含む「全呼出点が `IngredientGlyph` 経由」 | LOCKED 行は glyph を**呼ばない**。呼出点列挙テストが LOCKED を含めて失敗しないか確認 |
| `src/App.globalOverlayShellSizing.test.tsx` L69- | Shop パネルは共有シェル、`:scope > .shop-overlay__list` が無い | LOCKED セクションを `.shop-overlay__body` 直下に置くなら矛盾なし。直下 list を足す設計にしない |
| `src/App.test.tsx` / `App.materialEntitlement.test.tsx` / `App.w1Migration.test.tsx` / `state/w1Activation.test.tsx` / `components/378.stockBlockedResearch.test.tsx` | Shop を開いた際の行数・テキスト検索 | `getByText` / `queryAllBy*` の曖昧一致（`？？？` / `🔒`）と「行数」前提を実装時に grep して洗い出す |
| `src/components/InventoryOverlay*.test.tsx` | Inventory は Shop と独立。`所持 N/M種` は `ingredientCollectionCount` を共有 | **Inventory は本件の対象外**。変更なしを確認 |

### 8.2 ロジック
- `materialShop.test.ts`: `LOCKED` 状態・`nextMaterialHint` は不変。`lockedShopSlotCount` の純関数テストを追加。PR-C で `nextStarGateHint` を追加（starGate は fixture ladder を注入してテスト。**production ladder の step 数・材料数を直書きしない**：Phase 1 方針どおり `catalogDerived.ts` から導出）。
- `catalogLedger.test.ts`: 本件は recipe/ingredient を増やさないため変更不要。#420 Batch 6 側が更新する。

### 8.3 E2E（実行しない。実装 PR で更新が要る spec の洗い出しのみ）
`e2e/ingredient-shelf-shop.spec.ts`、`e2e/progression2-discovery-ladder.spec.ts`、`e2e/layout-contract.spec.ts`、`e2e/research-stock-blocked-378.spec.ts`、`e2e/expansion*.spec.ts`、`e2e/discovery-dex-aggregated.spec.ts`、`e2e/discovery-dex-hint.spec.ts`、`e2e/discovery3-pool2-production.spec.ts`、`e2e/dinner-mission.spec.ts`（`shop-item` / `data-shop-state` / `dex-card--locked` / `まだ見ぬピザ` を参照するもの）。「Shop の行数」「ロック枠 0」を前提にした assert の有無を実装時に確認する。

### 8.4 DOM golden
Production DOM golden は過去に意図的 re-baseline の実績がある（`rebaselineNote*`）。Shop / Dex が golden 対象かを実装時に確認し、対象なら re-baseline は **LOCKED 追加分のみ**であることを項目別に検証する。

### 8.5 母集団の独立計算（実装時の義務）
- AC-B1 の期待値を **ハードコードせず**、`INGREDIENTS.filter(i => i.unlockCondition)` と `materialIdsOfSteps(DISCOVERY_LADDER.steps)` から**テスト内で独立に**計算し、`obtainableIngredientIds` 経由の値と突き合わせる（同じ関数同士の自己照合にしない）。
- 本計画の時点値（`main` `b9ca1fa`）: ingredient 57 − starter 3 = **54**（grep ベースの見込み。確定値ではない）。#420 Batch 6 で avocado / goat-cheese / artichoke / spinach が入ると **58** に増える見込みで、テストは件数に依存しない書き方にする。

---

## 9. 独立性・順序・リスク

- 順序: **PR-A → PR-B → PR-C**。A と B は表示部品を介してのみ結合し、状態 authority は結合しない。PR-C は B と #420 の starGate が前提。各 PR は単独で revert 可能（A を revert しても B は共通部品を失うため、B は A の部品を import する依存を明示）。
- save schema 変更なし・migration なし・新 flag なし・Pitz/価格/ladder 変更なし。
- 主なリスク
  1. LOCKED 件数自体が「残りの未解禁数」を公開する。ただし Owner は全件表示を決定済みで、Dex も既に全件数を出している。個別対応は出さない前提で accepted。
  2. 既存の技法 riddle カードが `dex-card--locked` を共用 → シルエットの CSS が技法カードに波及する恐れ。
  3. ⭐行が「⭐に関する解禁が存在する」ことを示す。Step 到達後に限定することでこれを最小化（OD-DISPLAY-2）。
  4. 通知（load / Lunch Rush 経由の NEW MATERIAL 通知）の二重通知防止は #420 側で詳細確認とされている。本計画では触れず、⭐解禁が `buildMaterialUnlockNotice` を通る際に LOCKED 行表示と整合することだけ PR-C で確認する。

---

## 10. Owner 未承認の UI 判断（実装前に確認が必要）

| ID | 判断事項 | 本計画の暫定案 |
|---|---|---|
| O-1 | LOCKED セクションの**見出し**の有無と文言（例「🔒 まだ入荷していない材料」）。見出しに件数を載せるか | 見出しあり・件数なし（件数は行数で自明） |
| O-2 | ヒント 2 行の**並び順・アイコン・同一ボックスか別ボックスか**（発見数行が先 / ⭐行が先） | 発見数行 → ⭐行、現 `.shop-overlay__progress` と同意匠の 2 ボックス |
| O-3 | Dex 技法（調理法）riddle カードにシルエットを付けるか／`dex-card--locked` を共有し続けるか | 付けない（recipe 枠のみ）。CSS は modifier で分離 |
| O-4 | **シルエットの意匠**（ピザ全体の輪郭 / 切れ目 / サイズ / 色 / Dex と Shop で同一か）。発見済みピザ画像は対象外 | Dex・Shop で同一の円形ピザ輪郭 1 種。Owner 承認が要る。PR-A で Preview 比較 |
| O-5 | Shop が NEW/OWNED 0 件で LOCKED のみのときの空文言（現「新しいピザを発見すると、材料が入荷します」）の扱い | 空文言は維持し LOCKED を下に並べる |
| O-6 | LOCKED の**行高・密度**（54 行の縦長スクロールを許容するか。コンパクト化（複数列・グリッド）は Owner 未承認） | 既存 `.shop-item` と同幅の 1 列・低い行高 |
| O-7 | LOCKED セクションを**常時展開**か折りたたみ可能にするか（折りたたみ状態の保持を含む） | 常時展開（折りたたみは未承認の新 UI） |
| O-8 | LOCKED 行・Dex シルエット枠の **aria 文言**（`aria-hidden` で読み上げ除外 / 固定の汎用ラベル「未解禁の材料」を付ける） | 行は `aria-hidden` ではなく、セクション単位で固定の汎用ラベル 1 つ。要承認 |
| O-9 | ⭐行の文言「⭐あとN個」の**N の単位表記**（OD-DISPLAY-2 の文言をそのまま使用で確定済みか）と、Step 到達直後に⭐が既に足りている場合の即時解禁時の通知 | 文言は Issue 記載のまま。通知は #420 の詳細確認に従う |
| O-10 | PR-C の着手条件：#420 の starGate 実装 PR と**同時**に出すか、先に表示だけ fixture で出すか | #420 starGate 完了後に実装（先行表示は⭐が実在しないため無意味） |

---

## 11. 作業完了の確認（本タスク）

- 変更したファイル: 本書のみ（`docs/reports/`）。
- Production コード / テスト / CSS / SSOT / `docs/PROJECT_HANDOFF.md` は未変更。#418 には触れていない。
- PR・merge・deploy・CI・E2E は実行していない。既存監査の再実行はしていない。
