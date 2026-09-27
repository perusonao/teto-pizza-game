# Large Catalog UX — Fresh Design（172 recipes / 100+ ingredients）

- 種別: **Fresh Audit + Design（docs / data / tools only）**。`src/**`・`e2e/**`・CSS は一切変更していない。
- 監査対象 `main`: `5a33d855674652ab3483c3cedb8815859e88ce6e`（PR #254 DH4-1 merge）。
- ブランチ: `claude/large-catalog-ux-design-sq8saf`。merge / deploy / 既存PR変更は行っていない。
- 前提人口: runtime **25 recipes / 29 ingredients**（sauce 3 / cheese 4 / topping 22）→ 将来
  **172 recipes / 105 ingredients**（sauce 18 / cheese 16 / topping 71）、参考上限 **179 canonical ids**
  （sauce 31 / cheese 25 / topping 123）。105 / 179 の category・family 内訳は PR #255（172 Taxonomy
  Fresh Audit, OD-TAX-1…9 承認済み・ただし production authority ではない, OD-TAX-7）の PROPOSED 値。
- Human Verification Policy: 本タスクは docs-only の設計であり §2「原則不要」に該当（動画なし）。現行UIの
  **実測スクリーンショット**を監査証拠として `docs/reports/screenshots/large-catalog-ux/` に置いた。

> **Revision（Owner Decision Gate, 2026-09-27）**: Owner 判断用の確定版は
> `docs/reports/TETO_LARGE-CATALOG-UX_Owner-Decision-Gate.md`。本書と食い違う箇所（HC-4 の撤回、
> 手元の優先順・容量、Pizza Select / Dex タイルの列数、Dex 件数の基準、Dinner の追加、slice の順序、
> LC-OD-18 の方式）は Gate 文書が優先する（Gate §12 に差分一覧）。

---

## 0. 結論（Verdict）

**B. READY FOR STAGED IMPLEMENTATION — Owner Decisions 必要（LC-OD-1…18）。**

現行モバイルUIは 25/29 では成立しているが、**「一覧をそのまま並べる」前提の画面はすべて 100+ で破綻する。**
最大の破綻は Free Cooking トレイ（topping 4 → **12 ページ**、最悪 12 タップ／平均 6.4 タップで1材料）と
Recipe Dex（24 → **171 個の匿名 ？？？ カード**、全発見時 **39〜53 画面分**の縦スクロール）。

推奨する骨格は 1 つ:

> **「手元（Counter）」＋「食材庫（Pantry）」の 2 層化。**
> 調理中のトレイは今と同じ 3×2 固定グリッド・ページ送り・ドラッグ（Human Feel 済み資産）を維持し、
> 並ぶのは「今この一枚に使いそうな ≤12 個」だけにする。100 個の全体は、調理入力を止めた
> ボトムシート「食材庫」で family / 検索 / 並べ替え / お気に入り / 最近 から選ぶ。
> 同じ食材庫コンポーネントを Inventory（閲覧）と Shop（補充）でも使い、Dex / Pizza Select は
> 「発見済みはコンパクトに、未発見は章ごとに数とアクションへ畳む」。

この骨格は Discovery Hint（Rule W / k≥2 / 1 hint = 1 fact）、Progression（Discovery Ladder・章）、
Inventory authority（Stock Gate は reducer、Inventory 画面は構造的 read-only）のいずれの判定ロジックも
変えない。追加するのは **表示用の派生ビューと UI 設定**だけで、発見・価格・在庫の正本は既存関数のまま。

---

## 1. 成果物一覧

| 種別 | パス | 内容 |
|---|---|---|
| 本レポート | `docs/reports/TETO_LARGE-CATALOG-UX_Fresh-Design.md` | audit / IA / wireframe / plan / OD / perf |
| 実測データ | `docs/reports/data/TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json` | 現行UIの実測（3 viewport × 10 画面） |
| 投影モデル | `docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json` | 29→105→179 / 25→172 の破綻投影 |
| 計測ツール | `tools/large-catalog-ux/measure.spec.ts` + `playwright.measure.config.ts` | e2e/CI 外の読み取り専用計測 |
| 投影ツール | `tools/large_catalog_ux_scale_model.py`（`--check` あり） | 決定的に JSON を再生成・検証 |
| スクショ | `docs/reports/screenshots/large-catalog-ux/*.png`（30 枚） | 現行UI（before 相当）の監査証拠 |

再現:

```bash
npm ci
npx playwright test -c tools/large-catalog-ux/playwright.measure.config.ts   # 実測 + スクショ
python3 tools/large_catalog_ux_scale_model.py                                # 投影
python3 tools/large_catalog_ux_scale_model.py --check                        # 検証のみ
```

計測 save: 29 材料すべて所持（finite 26 は在庫 9、うち 4 個は在庫 0）、Dex 11 発見（`dex11`）と
Margherita のみ（`dex0`）。Chromium、Desktop Chrome UA、viewport を 360×640 / 360×800 / 390×844 に設定。

---

## 2. 壊してはいけない authority（設計の制約）

| Authority | 正本 | この設計が守ること |
|---|---|---|
| 発見判定 | `logic/discovery/matcher.ts`（exact set、ingredients-only fallback なし） | UI は判定に一切関与しない。**「のせた材料」が余計に1個あるだけで ORIGINAL** になる事実を UI 側で見やすくする（§7.5）のみ |
| 発見状態 | `state/recipeDiscoveryState.ts`（DISCOVERED > DISCOVERABLE > KNOWN_BUT_MISSING_MATERIAL > UNKNOWN） | 表示の集約（数える・畳む）だけ。状態の定義・優先順位は不変 |
| 未発見プライバシー | L1 / P-4 / NF-7（名前・プレビュー・材料・名前長を出さない、UNKNOWN は語らない） | 検索・ソート・フィルタ・最近・お気に入りは **発見済みレシピ / 所持材料の集合の中だけ**で動く |
| Discovery Hint | `selectableHint.ts`（1 hint = 1 positive fact、Rule W reserve 非公開、カテゴリは希望であり枠ではない）、DH4 `deductionHint.ts`（k≥2、家族まで表示 OD-TAX-3/4/5） | トレイ/食材庫は **シートがすでに見せた fact と family だけ**を再掲する。reserve・未購入 fact・「使わない材料」を示すマークは作らない |
| Progression | Discovery Ladder（`data/discoveryLadder.ts`）、章 = 鍵ステップの価格帯（`state/recipeChapters.ts`） | 章の算出は不変。大きすぎる章を**表示上**小分けにする案は OD（LC-OD-9） |
| Inventory | Stock Gate = reducer（`canPlaceIngredient` / `consumePizzaInventory` は CONFIRM_BAKE のみで減算）、`InventoryOverlay` は型で read-only | 在庫表示は `remainingStock` の再利用のみ。閲覧モードは mutation callback を型で受け取らない構造を維持 |
| Shop | `logic/materialShop.ts` の `materialOffer`（価格・数量の唯一の源）、LOCKED は非掲載 | 並べ替え・セクション化のみ。まとめ買いは導入する場合も単品の和と等価（LC-OD-13） |
| レイアウト | DM-3R-0 PREPARE dock 高さ固定、W1 I5b-4b pager 行常時確保、Fix 2（トレイはスクロールしない＝ドラッグと競合させない） | 調理画面のトレイ枠の高さ・位置を**1px も増やさない**（§7.2） |

---

## 3. 実測ベースライン（現行UI）

### 3.1 Free Cooking 調理画面（TOPPING ステップ、29 材料所持）

| viewport | ステージ高 | トレイ（2 行） | pager 行 | チップ | 焼くバー | topping ページ |
|---|---:|---:|---:|---|---:|---|
| 360×640 | **253px** | 122px（y 406） | 28px | 108×58 | 70px | 1 / 4 |
| 360×800 | 401px | 134px | 28px | 108×64 | 70px | 1 / 4 |
| 390×844 | 445px | 134px | 28px | 118×64 | 70px | 1 / 4 |

- どの viewport でも `.game-screen` は 1 画面に収まる（scrollHeight = clientHeight）。
- 360×640 はステージ 253px で**すでに余白ゼロ**。行を 1 本でも足すとステージが縮む。
- ヒントシート: 360×640 で 288px（y 352〜）、390×844 で 351px。**シートはトレイを完全に覆う**
  （スクショ `360x640_hint-sheet.png`）。

### 3.2 一覧系画面（スクロール量）

| 画面 | 360×640 | 360×800 | 390×844 | 行/カード高 |
|---|---|---|---|---|
| Recipe Dex（dex11） | 3632 / 552px（6.6 画面） | 3632 / 712 | 3548 / 756 | 未発見 99px、発見 134〜183px、1 列 |
| Pizza Select（dex11） | 1397 / 584 | 1397 / 744 | 1397 / 788 | 168〜187px、2 列 |
| Shop（26 行） | 2979 / 552（5.4 画面） | 2979 / 712 | 2331 / 756 | 78〜105px、1 列、タブ 4 |
| Inventory（29 個） | 1050 / 552 | 1050 / 712 | 1036 / 756 | 86〜99px、3 列、タブ 4 |

DOM 要素数（390×844）: Dex 263 / Pizza Select 161 / Shop 356。

---

## 4. Scale Failure Audit

凡例 — 重大度: **S1** 遊びが壊れる / **S2** 明確にストレス / **S3** 見た目・効率の劣化。
数値は `TETO_LARGE-CATALOG-UX_SCALE-MODEL.json`。

### 4.1 Free Cooking ingredient tray

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| **F-01** | トレイは「所持している当該カテゴリ全部」を 6 個ずつページ送り。探索の主要操作が**ページめくり**になる | topping 4 ページ、最悪 4 タップ | topping **12 ページ**・最悪 12 / 平均 6.4 タップ。179 では 21 ページ | **S1** |
| F-02 | 並び順は catalog 宣言順固定。最近使った・今回のせた・ヒントで分かった材料が前に来ない | 目視で済む | 同じ材料を毎ラウンド探し直す | S1 |
| F-03 | sauce / cheese にもページが出る（SAUCE 18 → 3 ページ、CHEESE 16 → 3 ページ） | 1 ページ | 各 3 ページ、179 で 6 / 5 | S2 |
| F-04 | ページ送りは ◀▶ のみ。どのページに何があるか予告がない（family も頭文字もない） | 4 ページなら記憶可 | 記憶不能 | S2 |
| F-05 | 在庫 0 の所持材料が**元の位置で**無効表示のまま（EP3 契約） | 目立たない | 12 ページ中に灰色チップが散在 | S3 |
| F-06 | 「今ピザにのっている材料」の一覧がない。exact match なので余計な 1 個が ORIGINAL を生む | ピザを見れば分かる | 100 種から選ぶと取り違え・のせ過ぎを自覚できない | S2 |
| F-07 | 誤ってのせた 1 個を戻す手段が「やり直す（全リセット）」だけ（CUT には `UNDO_CUT_LINE` がある） | 痛みは小さい | 探索のたびに全工程やり直し | S2 |
| F-08 | 検索・お気に入り・最近・family 絞り込みが無い | 不要 | 必須 | S1 |
| F-09 | ページ切替で選択中チップが消えると選択解除（PR #197 P2、正しい安全策） | 影響小 | 12 ページを往復すると選択が頻繁に外れる | S3 |

根本原因: トレイが「**棚（全在庫）**」と「**手元（今使う物）**」を兼ねている。25/29 では棚 = 手元だったが、
100+ では分離が必要（`PIZZA_GAME_Phase4A-1B_Ingredient-Palette-Fixed-Grid_Design.md` §2 の
「countertop loadout」構想と同じ方向で、`MAX_INGREDIENT_PALETTE_SLOTS` を同じ上限として再利用できる）。

### 4.2 Recipe Dex

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| **D-01** | 未発見 1 件 = 1 カード（99px）。**172 個の ？？？ 枠が並ぶだけ** | 24 枠・約 3000px | 171 枠・約 19,200px（25〜35 画面） | **S1** |
| D-02 | 発見済みカードが説明文 + 材料チップ + ★行のフルカード（134〜183px） | 11 枚で 1800px | 全発見で約 29,400px（**39〜53 画面**） | S1 |
| D-03 | DISCOVERABLE の匿名カードが同一文言で複数並ぶ。所持材料が多いと大量発生（計測 save では未発見 14/14 と 24/24 がすべて 🎨＋💡） | 並んでも数枚 | 数十枚の同一 CTA が並ぶ | S2 |
| D-04 | 章 = 価格帯で 3 章（6/9/10）。172 では 1 章が 40 件前後になり得る | 適正 | 章が長すぎて「章」の区切りが機能しない | S2 |
| D-05 | 並べ替え・絞り込み（★、最近発見、お気に入り、伸びしろ）が無い | 不要 | BEST 更新したい 1 枚を探せない | S2 |
| D-06 | 新発見時は `scrollIntoView` で該当カードへ。長大リストでは前後の文脈を失う | OK | 章展開と組み合わせが必要 | S3 |

### 4.3 Pizza Select

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| **P-01** | 発見済みのみ 2 列カード（168〜187px）。検索・フィルタ・並べ替え無し | 約 1400px | 約 16,700px（21〜29 画面） | **S1** |
| P-02 | 「最近作った」「お気に入り」の入口が無い（日常のリプレイ導線がスクロール前提） | 11 枚なら可 | 毎回スクロール | S2 |
| P-03 | 材料不足カードは同じ位置で無効表示。「今作れる」だけに絞れない | 可 | 不可 | S2 |
| P-04 | 章見出しの「発見 x/m」は良い（L1）。ただし章が大きいと見出しまでが遠い | OK | 章ジャンプが必要 | S3 |

### 4.4 Shop

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| **S-01** | NEW → OWNED の 1 列リスト、行 78〜105px、タブは すべて/ソース/チーズ/トッピング の 4 つ | 26 行・約 2,500〜3,000px | **102 行・約 9,200〜10,500px（12〜19 画面）**、トッピングタブだけで 70 行前後 | **S1** |
| S-02 | 補充したい材料（在庫が少ない・最近使う）を探す手段がない | 目視可 | 不可 | S2 |
| S-03 | 行の情報量が多く 2〜3 段（価格・不足額・NEW ヒント行） | 可 | 行高が一覧性を殺す | S3 |

### 4.5 Inventory

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| I-01 | 3 列グリッド + 4 タブ。検索・family・並べ替え無し | 1.5〜2 画面 | 4.7〜6.7 画面、トッピングタブ 3.3〜4.7 画面 | S2 |
| I-02 | Inventory / Shop / トレイで「同じ材料の一覧」を 3 回別実装している | 小 | 3 画面の並び順・分類がずれていく | S2 |

### 4.6 Hint sheet との接続

| ID | 失敗 | 25/29 | 172/105 | 重大度 |
|---|---|---|---|---|
| **H-01** | シートで「トッピングに 🥓ベーコン」と分かっても、トレイ側に印が無い。閉じてから 12 ページを探す | 4 ページ | **ヒント購入の価値が探索の手間に食われる** | **S1** |
| H-02 | DH4-2 の 特徴ヒント（「肉の仲間があるよ」）を受け取っても、トレイに family という概念が無い | 未配線 | family を渡されても行動に変換できない | S2 |
| H-03 | シートがトレイを覆う（計測: 360×640 で sheet top 352 < tray top 406）。シートから直接「使う」操作が無い | 可 | 往復コスト増 | S3 |

### 4.7 横断（指定観点ごとの現状）

| 観点 | 現状 | 100+ での評価 |
|---|---|---|
| category | sauce / cheese / topping の 3 のみ（step と 1:1） | topping 71 に対して粗すぎる |
| horizontal paging | トレイ ◀▶ 6 個/ページ（スワイプなし＝ドラッグ非競合） | 仕組みは正しい。**ページ数**が問題 |
| vertical paging / scroll | Dex / Select / Shop / Inventory は縦スクロールのみ | 20〜50 画面になる |
| search | 無し | 必須（食材庫・Select・Shop） |
| favorites / recently used | 無し（save にも無い） | 必須。永続化は OD |
| recipe-compatible filtering | Guided round はレシピ材料のみ（Issue #159）。Free Cooking は全所持 | 未発見レシピへの「互換」フィルタは**漏洩**になる（§6.4） |
| owned / available / locked | トレイ = OWNED のみ、Shop = NEW + OWNED（LOCKED 非掲載）、Inventory = OWNED | 方針は正しい。維持 |
| stock count | チップ `×N` / `∞`、在庫 0 は無効 | 維持。並び順とフィルタに活かす |
| undiscovered privacy | 名前・材料・プレビュー無し、スロット番号と章内件数のみ | 維持しつつ「枠を並べない」方向へ |
| sort | すべて catalog 宣言順固定 | 必須 |

---

## 5. 設計原則

1. **調理中は「手元」だけ、全体は「食材庫」で。** 調理画面の縦予算（360×640 でステージ 253px）を増やさない。
2. **探索のコストはページめくりではなく判断に使わせる。** 目標: 手元にある材料は ≤2 タップ、任意の所持材料は ≤3 タップ（食材庫を開く → family → 材料）、名前が分かれば 検索で ≤3 操作。
3. **知っていることだけで絞る。** 検索・フィルタ・ソートの母集合は「所持材料」「発見済みレシピ」「シートが見せた fact / family」のみ。
4. **未発見は並べずに数える。** 章ごとの「発見 x/m」と、行動できる状態（🎨 / 🏪）の件数と 1 つの CTA に畳む。
5. **1 つの材料一覧コンポーネント**を Free Cooking（選ぶ）/ Inventory（見る）/ Shop（補充する）で使い分ける。モードは型で分け、Inventory の read-only 保証を保つ。
6. **縦スクロールは一覧画面、横ページは調理トレイ。** 調理トレイにスクロールもスワイプも持ち込まない（Fix 2）。

---

## 6. Information Architecture

### 6.1 オブジェクトと状態（既存の正本を再掲、追加は UI 層のみ）

```
Ingredient
 ├─ lifecycle   : LOCKED | AVAILABLE(Shop NEW) | OWNED              ← 既存（materialShopState / ownedIngredientIds）
 ├─ stock       : UNLIMITED(starter) | n≥1 | 0                      ← 既存（remainingStock）
 ├─ category    : sauce | cheese | topping                          ← 既存（step と 1:1）
 ├─ family(L2)  : meat | seafood | vegetable | fruit | herb | spice | other   ← DH4-1（topping のみ, OD-TAX-2/3）
 ├─ readingJa   : ひらがな読み（検索用、漢字名のみ）                ← 新規 data 候補（LC-OD-15）
 └─ ui prefs    : favorite? / lastUsedRound / useCount / firstOwnedAt ← 新規 UI 状態（LC-OD-5）

Recipe
 ├─ discovery   : DISCOVERED | DISCOVERABLE | KNOWN_BUT_MISSING_MATERIAL | UNKNOWN  ← 既存
 ├─ chapter     : price tier of key step                            ← 既存（recipeChapters）
 ├─ cookable    : 発見済みかつ材料在庫あり                          ← 既存（pizzaSelect）
 ├─ mastery     : bestStars / bestScore / timesMade                 ← 既存（dex）
 └─ ui prefs    : favorite? / lastCookedRound                        ← 新規 UI 状態（LC-OD-5）

HintView（シートが既に表示した情報）
 ├─ revealed facts : ing:<id>（カテゴリ行に並ぶチップ）             ← 既存（HintSheetView）
 └─ family hint    : L2 family（DH4-2 以降）                        ← 既存/予定
```

### 6.2 派生ビュー（すべて pure、状態を持たない）

| 派生ビュー | 入力 | 出力 | 利用画面 |
|---|---|---|---|
| **Pantry**（食材庫） | owned, inventory, category, family, query, sort, prefs | 所持材料の並び（LOCKED/AVAILABLE を含まない） | 食材庫シート / Inventory / Shop(OWNED 部) |
| **Counter**（手元） | step category, pizza（今のせた材料）, revealed facts, picks, prefs | ≤12 件の並び（§7.3 の優先順） | 調理トレイ |
| **DexShelf** | dex, discovery states, chapters, prefs, filter/sort | 章ごとの 発見済みタイル + 未発見の件数/行動 | Recipe Dex |
| **SelectList** | dex, cookable, prefs, query, filter/sort | 発見済みレシピの並び + 最近/お気に入りストリップ | Pizza Select |
| **ShopSections** | shop rows, inventory, prefs | NEW / 在庫少 / すべて（family・検索） | Shop |

### 6.3 画面マップ（変更点のみ）

```
HOME
 ├─ ピザを作る ─→ Pizza Select（検索・絞り込み・最近・お気に入り）─→ Guided round（トレイ=レシピ材料のみ、現状維持）
 ├─ フリークッキング ─→ 調理（トレイ=手元） ⇄ 食材庫シート（選ぶモード）
 │                         ⇅
 │                      ヒントシート（fact チップ → 手元へ / family → 食材庫を family で開く）
 ├─ ピザ図鑑 ─→ Dex（章シェルフ: 発見済みタイル + 未発見は件数と行動）─→ 詳細シート
 ├─ ショップ ─→ NEW入荷 / 在庫が少ない / すべて（食材庫の補充モード）
 └─ 材料 ─→ 食材庫（閲覧モード、read-only）
```

### 6.4 プライバシー境界（検索・フィルタごとの可否）

| 機能 | 母集合 | 可否 | 理由 |
|---|---|---|---|
| 材料検索 | 所持材料 | ✅ | 自分の材料の名前は既知 |
| 材料検索で LOCKED もヒット | 全 105 | ❌ | 未入荷材料の存在・名前を先出しする |
| レシピ検索 | 発見済み | ✅ | NF-7 と同じ（表示済みの名前のみ） |
| 「未発見レシピに使える材料」フィルタ / バッジ | 未発見 | ❌ | どの材料が意味を持つかを直接教える（ヒント販売の迂回路） |
| 「DISCOVERABLE 数」の材料別表示 | 未発見 | ❌ | 同上。k≥2 を経ない漏洩 |
| 「発見済みレシピの材料をまとめて手元へ」（リミックス） | 発見済み | ✅ | 既に Dex に表示している情報 |
| シートが見せた fact を手元に 💡 付きで置く | revealed facts | ✅ | シート表示と同一情報。reserve・未購入 fact は含まれない |
| family ヒントから食材庫を family 絞り込みで開く | 所持 × 表示済み family | ✅ | family は OD-TAX-3 で表示可、絞り込み結果は自分の所持品 |
| 手元に「使わない材料」マーク | 未発見 | ❌ | 負の fact は存在しない（OD-H3-7） |
| 未使用（まだ一度も焼いていない）材料に NEW 印 | 自分の履歴 | ✅ | 自分の行動履歴のみ。near-miss `FAR_KEY_UNUSED`（「新しく入荷した材料は使ってみた？」）と整合 |
| 章ごとの「発見 x/m」 | 未発見の件数 | ✅（現行 L1） | 既に表示している |
| 未発見の名前長・シルエット・材料数 | 未発見 | ❌ | 現行 L1 / NF-7 |

---

## 7. Free Cooking — Counter + Pantry（wireframe specification）

### 7.1 何を「面倒でない探索」とするか

- **判断の単位は材料 1 個ではなく「組み合わせ」**。exact match なので、プレイヤーは「のせる材料セット」を
  考える。UI は ①候補を手元に集め、②今のセットを見せ、③1 個だけ差し替える、を速くする。
- ラウンドのやり直し（「もう一度じゆうに作る」）では**手元をそのまま引き継ぐ**（HintSession の
  ProgressionCarry と同じ扱い）。1 個入れ替えて焼き直す反復が、ページめくり 0 回でできる。

### 7.2 縦予算（調理画面は 1px も増やさない）

現行の pager 行（28px、1 ページ時も不可視で確保されている行）を **「棚バー（shelf bar）」**に置き換える。
高さは同じ 28px、DM-3R-0 の dock 予約計算は「常に 1 行」に単純化される。

| viewport | ステージ | 手元グリッド | 棚バー | 焼くバー | 差分 |
|---|---:|---:|---:|---:|---|
| 360×640 | 253 | 122（2×3, 108×58） | 28 | 70 | ±0 |
| 360×800 | 401 | 134（2×3, 108×64） | 28 | 70 | ±0 |
| 390×844 | 445 | 134（2×3, 118×64） | 28 | 70 | ±0 |

### 7.3 手元（Counter）の中身 — 決定的な優先順

各 PREPARE ステップのカテゴリについて、以下の順で重複なく最大 12 件（2 ページ）:

1. **今のピザにのっている材料**（のせた順）— 追加で置く／確認するため
2. **💡 ヒントで分かった材料**（シートが表示済みの fact、現在のヒント対象のみ）
3. **プレイヤーが食材庫で手元に置いた材料**（picks、置いた順）
4. **⭐ お気に入り**
5. **🕘 最近使った**（直近ラウンド順）
6. **NEW 未使用**（所持したが一度も焼いていない）
7. 余りがあれば catalog 順の所持材料（在庫 >0 のみ）

- 在庫 0 の所持材料は手元に自動では入れない（手動で置いた場合は現行どおり無効表示 `×0`）。
- 所持数が 12 以下のカテゴリ（runtime の sauce 3 / cheese 4 など）は**今と同じ見え方**（全所持を catalog 順）。
  つまり 25/29 の体験は変わらない。手元ロジックは「そのカテゴリの所持数 > 12」のときだけ効く（LC-OD-4）。
- Guided round（Pizza Select から）は現行どおり**レシピ材料のみ**。手元/食材庫は出さない。

### 7.4 Wireframe — 調理 TOPPING（390×844）

```
┌──────────────────────────────────────┐ 0
│ 🏠ホーム                     🪙 999  │
│ ✓生地  ✓ソース  ✓チーズ  [具材]  焼く │
│ 🎨 フリークッキング                   │
│  好きな具をのせて「焼く！」           │ 147
│                                      │
│              ( PIZZA )               │  ← ステージ 445px（不変）
│                                      │
│                                      │ 592
│ ┌────────┐┌────────┐┌────────┐       │ 598
│ │🍄 ● ×9 ││🥓💡 ×9 ││🧅   ×9 │       │  ● = いまのってる
│ │マッシュ ││ベーコン ││たまねぎ │       │  💡 = ヒントで判明
│ └────────┘└────────┘└────────┘       │
│ ┌────────┐┌────────┐┌────────┐       │
│ │🌿⭐  ∞ ││🍍 NEW×9││ ＋      │       │  ＋ = 食材庫を開く（空き枠）
│ │バジル   ││パイン   ││食材庫   │       │
│ └────────┘└────────┘└────────┘       │ 732
│ [🧺 食材庫 71 ▾]   ◀ 1/2 ▶   [🔎]    │ 738–766 棚バー（旧 pager 行）
│ [やり直す] [↶1つ戻す]  [🔥 焼く！] [ヒント] │ 774–844
└──────────────────────────────────────┘
```

360×640 は同じ構成でチップ 108×58（テキスト 1 行 + バッジ 1 個まで）。バッジは右上 1 個（優先 ● > 💡 > ⭐ > NEW）、
在庫表記は現行どおり右下。`↶1つ戻す` は LC-OD-6（採用時のみ。焼くバーの既存幅に収まる小ボタン、
不採用なら現行と同じ 3 ボタン）。

### 7.5 「のせた材料」の可視化

- 手元チップの **●** で「このカテゴリでのせた材料」を示す（追加の行は使わない）。
- 食材庫シートのヘッダに **「のせた材料: 🍅 🧀 🍄 🥓」**（全カテゴリ、タップで該当チップへ）。
- BAKE 前の確認は増やさない（既存フロー維持）。

### 7.6 Wireframe — 食材庫シート（選ぶモード, 360×640）

```
┌──────────────────────────────────────┐
│ (調理画面は暗転・入力停止: isGlobalOverlayOpen) │
├──────────────────────────────────────┤ y≈192（70dvh = 448px）
│ 🧺 食材庫 ─ 具材 71          [閉じる] │ 40
│ のせた材料: 🍅🧀🍄🥓                  │ 20
│ [🔎 なまえでさがす            ]       │ 36
│ [すべて][⭐][🕘][肉][魚介][野菜・きのこ]→│ 32  ← 横スクロールのチップ列（シート内、ドラッグ無し）
│ 並び: 最近 ▾      □在庫ありのみ        │ 24
│ ┌──────┐┌──────┐┌──────┐┌──────┐     │
│ │ 🥓 ✓ ││ 🍖   ││ 🌭   ││ 🥩   │     │  4 列 × 76×64、タップ = 手元に置く/外す(✓)
│ │ベーコン││ ハム  ││ソーセ ││ 牛肉 │     │
│ └──────┘└──────┘└──────┘└──────┘     │
│  …（シート内で縦スクロール）            │  360×640 で約 4 行 = 16 件が一度に見える
│ [ 手元に並べる（3） ]                  │ 48
└──────────────────────────────────────┘
```

- 390×844: シート 590px、約 6 行 = 24 件表示。360×800: 560px、約 5.5 行。
- **family タブ**は topping のみ（DH4-1 の 7 family、表示名は DH4-1 の `labelJa`。`other` の見出し文言は
  OD-TAX-8 に従い「ちょっと変わった材料」等を DH4-2 と共用で決める）。sauce / cheese は family を出さない
  （FR-2 未決、OD-TAX-9）→ 検索・並べ替え・⭐・🕘 のみ。
- **並べ替え**: 最近使った（既定）/ よく使う / 在庫の多い順 / 名前順（読み）/ 手に入れた順。
- タップで ✓ トグル（シートは閉じない）。「手元に並べる」で閉じ、最後に ✓ した材料が選択状態になる
  （＝次のピザタップでそのまま置ける）。1 個だけ欲しい場合は 2 タップ + 閉じる（LC-OD-3）。
- 食材庫からの**ドラッグ配置はしない**（シート内スクロールとドラッグを競合させない）。
- 在庫 0 は末尾・灰色・「ショップで補充」表示（調理中はリンクせず、HOME のショップを案内する文言のみ）。
- LOCKED / Shop NEW（未購入）は表示しない。代わりにシート最下部に 1 行
  「🏪 ショップに新しい材料が n 種類」（件数のみ、名前なし）。

### 7.7 検索

- 対象: 所持材料の `nameJa` と `readingJa`（ひらがな／カタカナ正規化、全角半角・長音無視）。
- 1 文字目から逐次絞り込み。入力中は IME でシートの下半分が隠れるため、**結果は検索欄の直下 2 行**に
  優先表示（最大 8 件）。
- 空入力時は検索 UI を 1 行に畳む。

### 7.8 SAUCE / CHEESE ステップ

- 所持 ≤12 の間は現行と同一。13 以上（105 で sauce 18 / cheese 16）で手元化。
- SAUCE は 1 種しか塗れない前提のラウンドが多いので、手元の既定は「最近 → ⭐ → 💡」で 6 件以内に収まる想定。

---

## 8. Hint sheet との接続

| # | 接続 | 仕様 | authority 確認 |
|---|---|---|---|
| HC-1 | fact → 手元 💡 | シートが**表示済み**の `ing:` fact（free key 含む）を、そのカテゴリのステップの手元優先 2 位に 💡 付きで置く | `HintSheetView` の chips と同じ集合のみ。reserve（Rule W）は view に存在しないので出ようがない |
| HC-2 | シートのチップから直接置く | シートのカテゴリ行チップをタップ →「手元に置く」→ シートを閉じ、そのカテゴリのステップ中なら選択状態 | 追加情報ゼロ（見えているチップの再利用） |
| HC-3 | family ヒント → 食材庫 | DH4-2 の特徴ヒント「肉の仲間があるよ」に「🧺 食材庫で見る」→ 食材庫を topping / 肉 タブで開く | 絞り込み結果は所持品。k≥2 は DH4 側が保証（OD-TAX-4）。**family 内でヒット対象を強調しない** |
| HC-4 | near-miss FAR_KEY_UNUSED | 「新しく入荷した材料は使ってみた？」表示時、次ラウンドの手元で NEW 未使用を優先 6 位→3 位に繰り上げ | 名前は出さない既存文言のまま、並びだけ |
| HC-5 | ヒント対象が変わったとき | 💡 は現在の target の fact のみ。target 切替で 💡 は外れる（picks は残る） | `resolveHintSession` の sticky 規則をそのまま参照 |

禁止: 「💡 あと n 個」「このカテゴリにはもう無い」などの残数表示、reserve の示唆、未購入 fact のぼかし表示。

---

## 9. Recipe Dex（wireframe specification）

### 9.1 構成（390×844）

```
┌──────────────────────────────────────┐
│ レシピ図鑑                    [閉じる] │
│ 🍕 発見 48 / 172   ⭐ 合計★ 131       │  進捗（現行）
│ ┌ これから ───────────────────────┐ │
│ │ 🎨 今の材料で作れそう  6   [💡ヒント] │ │  ← 未発見は「行動できる件数」だけ
│ │ 🏪 ショップの材料で作れそう 3 [ショップ]│ │
│ └──────────────────────────────────┘ │
│ [すべて][⭐][伸びしろ★1-2][最近発見]  並び:No.▾ │ sticky
│ ▼ 第1章  6/6 ✓                        │
│ ┌────┐┌────┐┌────┐                    │  発見済み: 3 列タイル（サムネ+名前+★）
│ │ 🍕 ││ 🍕 ││ 🍕 │                    │  1 タイル ≈ 118×120（360 幅 104×112）
│ │マルゲ││ビスマ││フンギ│                  │
│ │★★★ ││★★☆ ││★★★ │                  │
│ └────┘└────┘└────┘                    │
│ ▶ 第2章  9/14  🎨2                    │  折りたたみ（未発見 5 は数だけ）
│ ▶ 第3章  3/40  🎨4 🏪3                │
│ ▶ 第4章  0/38                          │
└──────────────────────────────────────┘
```

- **未発見枠は並べない**（D-01）。章見出しに `発見 x/m`（現行 L1）と、その章の 🎨 / 🏪 件数だけ。
  UNKNOWN は件数にしか現れない（P-4 をむしろ強化）。
- 章を開いたとき: 発見済みタイル → 最後に 1 行「？？？ × 5（まだ見ぬピザ）」＋章内 🎨 があれば
  「💡 この章のヒント」1 ボタン。**匿名カードを n 枚描かない**（D-03）。
- 「これから」の 💡 は `selectHintTarget` の既存決定順に委ねる（Dex から特定枠を pin する 229-D の
  `fromDex` は「章のヒント」で章内の先頭 DISCOVERABLE を pin する形に置換。LC-OD-11）。
- 発見済みタイルをタップ → 詳細シート（現行カードの中身: 説明・材料・BEST・作成回数・⭐お気に入り・
  「このピザを作る」「材料を手元に置いてフリークッキング（リミックス）」）。
- 新発見時: 該当章を自動展開し、タイルへスクロール + NEW バッジ（現行 W1-d 挙動の置換）。
- **任意のスタンプ帳表示**（LC-OD-8 の選択肢 C）: 章内を 24px の番号スタンプで全枠表示（発見 = 色、未発見 = 無地）。
  172 枠でも約 15 行 × 30px ≈ 450px。コレクション感を残したい場合の代替。

### 9.2 スクロール量の見積もり（390×844）

| 状態 | 現行方式 | 提案 |
|---|---:|---:|
| 発見 48 / 172、章すべて閉 | 約 22,000px | 約 700px（1 画面） |
| 全章開・全発見 | 約 29,400px（38.9 画面） | 58 行 × 132px ≈ 7,700px（10 画面）＋ フィルタで数画面 |

### 9.3 章が大きすぎる問題（D-04）

章の算出（鍵ステップの価格帯）は変えない。表示上、1 章が 12 件を超える場合は章内を**「棚」**
（Ladder の step 範囲で 12 件前後ずつ）に分けて小見出しを付ける案を推奨（LC-OD-9）。
地域・スタイル別の章（「日本のピザ」など）は、未発見の存在を地域単位で示すため別途プライバシー判断が必要。

---

## 10. Pizza Select（wireframe specification）

```
┌──────────────────────────────────────┐
│ 🏠ホーム   作るピザを選ぼう！           │
│ [🔎 ピザの名前           ]            │  発見済みの名前だけ
│ 🕘 最近: [マルゲ][ビスマ][フンギ] →    │  横スクロール 1 行（≤8）
│ [すべて][作れる][⭐][★1-2][材料不足]  並び:章▾ │ sticky
│ ▼ 第1章 発見 6/6                      │
│ ┌────┐┌────┐┌────┐                    │  3 列コンパクト（LC-OD-12）
│ │ 🍕 ││ 🍕 ││ 🍕 │                    │
│ │名前 ││名前 ││名前 │                    │
│ │★★★ ││★★☆ ││🏪  │                    │
│ └────┘└────┘└────┘                    │
│ ▶ 第2章 発見 9/14                      │
└──────────────────────────────────────┘
```

- 既存のプロンプトカード（🎨 / 🏪、匿名、最大 1 枚）は検索欄の上に維持。
- 並び: 章（既定・現行順）/ 最近作った / ★が低い順（伸びしろ）/ 名前順。
- 「作れる」= 現行 `cookable`。材料不足は無効 + 🏪（現行 F-15 契約）。
- 詳細（現行 RecipeDetail）に ⭐ お気に入りトグルを追加。
- 172 全発見でも、フィルタ・章折りたたみ既定で初期描画は 1〜2 画面。

---

## 11. Shop（wireframe specification）

```
┌──────────────────────────────────────┐
│ 🛒 SHOP                       [閉じる] │
│ 🪙 999 Pitz   🔜 あと2つ発見で新しい材料  │
│ ▼ NEW 入荷（3）                        │  常に先頭・既定で開
│   🍍 パイナップル  初回 🪙100 [仕入れる] │  1 行 56px（NEW ヒント文言は見出しに 1 回だけ）
│ ▼ 在庫が少ない（5）                    │  在庫 ≤ 3（LC-OD-13）・⭐/🕘 優先
│   🥓 ベーコン ×1   補充 🪙60 [補充する] │
│ ▶ すべての材料（99）  [🔎][ソース][チーズ][具材▾] │  食材庫の補充モード（family・検索）
└──────────────────────────────────────┘
```

- 価格・数量は `materialOffer` のみ（不変）。LOCKED は非掲載・進捗 1 行（不変）。
- 行を 1 段化（78〜105px → 56px）: 不足額は無効ボタンの下に小さく、NEW の「新しいピザのヒントになるかも」は
  セクション見出しに 1 回。
- 102 行でも既定表示は NEW + 在庫少 のみで 1 画面。
- まとめて補充（在庫少セクション一括）は **単品補充の和と同額・同量**でのみ可（LC-OD-13、既定は見送り）。

---

## 12. Inventory（食材庫・閲覧モード）

- HOME「材料」は食材庫シートと同じ一覧コンポーネントの **閲覧モード**。検索・family・並べ替え・⭐ トグル。
- 構造的 read-only の保証: 閲覧モードの props 型に `onPick` / `onPurchase` / `onRestock` を**持たせない**。
  ⭐ トグルは ownership / inventory ではなく UI 設定への書き込みであり、別 prop `onToggleFavorite` として
  受ける（LC-OD-14 で可否を決める。不可なら ⭐ は食材庫（選ぶモード）と Pizza Select 詳細でのみ）。
- 所持 n/105 種、在庫 0 件数、「ショップに NEW n」の要約行。

---

## 13. 観点別の結論（指定リストへの回答）

| 観点 | 結論 |
|---|---|
| category | step カテゴリは維持。topping のみ L2 family を**表示用の棚**に使う（DH4-1 の 7 family をそのまま、OD-TAX-2/3 準拠）。sauce / cheese の family は FR-2 決定待ち |
| horizontal paging | 調理トレイのみ（◀▶、2 ページ上限の手元）。スワイプは導入しない |
| vertical paging | 食材庫シート・Dex・Select・Shop・Inventory は縦スクロール＋章/セクション折りたたみ。ページ化はしない（一覧画面ではスクロールの方が速い） |
| search | 食材庫（所持材料）/ Pizza Select（発見済み）/ Shop すべて（NEW+OWNED）。Dex は発見済み名のみで任意 |
| favorites | 材料⭐・レシピ⭐。手元優先 4 位、Select / Dex フィルタ。永続化は LC-OD-5 |
| recently used | 材料🕘（手元 5 位、食材庫の既定ソート）、レシピ🕘（Select ストリップ） |
| recipe-compatible filtering | 発見済みレシピの「リミックス」（材料一式を手元へ）と Guided round のみ。未発見への互換フィルタは**作らない**（§6.4） |
| owned / available / locked | トレイ・食材庫 = OWNED のみ。AVAILABLE（Shop NEW）は件数 1 行、LOCKED は Shop 進捗 1 行のみ。変更なし |
| stock count | 表示は現行（`×N` / `∞` / `×0` 無効）。在庫 0 を手元の自動候補から外し、食材庫で末尾、Shop で「在庫が少ない」 |
| undiscovered privacy | 「並べずに数える」。名前・材料・枠位置の追加露出なし。UNKNOWN は件数のみ |
| sort | 食材庫: 最近/よく使う/在庫/名前/入手順。Dex: No./最近発見/★。Select: 章/最近/★低い順/名前。Shop: セクション固定＋すべて内は名前/在庫 |
| 360×640 | 調理画面は行を増やさない（pager 行 → 棚バー）。シートは 70dvh、4 列、1 画面 16 件 |
| 360×800 | 同上、シート 5.5 行 |
| 390×844 | authority。シート 6 行 24 件、Dex 3 列タイル 118px |

---

## 14. Staged implementation plan

各スライスは既存の完了フロー（Fresh Audit → 実装 → tests → CI/WebKit → Preview → HV 動画 → Human Feel → merge）に従う。
UI スライスは Human Verification Policy の対象（390×844 必須、360×800 / 360×640 は該当修正時）。

| Slice | 内容 | 変更範囲 | 検証 | 前提 |
|---|---|---|---|---|
| **LC-0**（本 PR） | 監査・IA・wireframe・OD・計測/投影ツール | docs / data / tools | `--check`、計測 3 viewport | — |
| **LC-1** 純粋層（unwired） | `pantryView`（フィルタ・ソート・検索正規化・family 解決）、`counterView`（§7.3 優先順）、`dexShelfView`（章集約・件数）、`selectListView` | `src/logic/catalog/*.ts` + unit test のみ | プライバシー不変条件テスト: LOCKED 非出現、reserve 非出現、未発見名非出現、UNKNOWN は件数のみ | LC-OD-1/2/4/16 |
| **LC-1b** 規模テスト用 seam | テスト専用の合成カタログ（105 材料 / 172 レシピ）を注入できる入口（本番ビルドでは無効） | test support のみ | 以降の UI スライスを 105/172 でもレイアウト検証 | LC-OD-18 |
| **LC-2** 調理トレイ = 手元 + 棚バー | pager 行を棚バーに置換、手元ロジック配線（所持 ≤12 は現行と同一表示） | IngredientTray / prepareDock / CSS | 既存トレイ系 test・stage-size-stability・layout-contract 全通過、HV 390×844 / 360×640 | LC-1 |
| **LC-3** 食材庫シート（選ぶモード） | シート、family タブ、検索、並べ替え、✓ → 手元 | 新コンポーネント + GameScreen 配線 | input pause（isGlobalOverlayOpen）、シート中ドラッグ不可、HV 3 viewport | LC-2、LC-OD-3/15 |
| **LC-4** ヒント接続 | HC-1 / HC-2 / HC-4（HC-3 は DH4-2 後） | HintSheet / counterView | anti-spoiler（`e2e/support/antiSpoiler.ts`）拡張、reserve 非表示テスト | LC-2、LC-OD-7 |
| **LC-5** 1つ戻す | `UNDO_LAST_PLACEMENT`（FREE のみ、在庫は CONFIRM_BAKE でのみ減算なので在庫不変） | reducer + UI | reducer test、Stock Gate 回帰、HV | LC-OD-6 |
| **LC-6** Dex シェルフ | 章折りたたみ、発見済みタイル + 詳細シート、未発見集約、フィルタ/ソート | DexOverlay | discovery-dex-hint e2e 更新（Dex→ヒント経路）、anti-spoiler、HV | LC-1、LC-OD-8/9/10/11 |
| **LC-7** Pizza Select | 検索・フィルタ・最近ストリップ・3 列 | PizzaSelectScreen | 既存 test、HV | LC-OD-12 |
| **LC-8** Shop / Inventory | セクション化、1 段行、食材庫の補充/閲覧モード | ShopOverlay / InventoryOverlay | 価格・数量は materialOffer のみ（回帰）、read-only 型保証テスト | LC-3、LC-OD-13/14 |
| **LC-9** UI 設定の永続化 | ⭐ / 🕘 / 使用回数を save の任意フィールドへ（forward-compat merge 準拠） | persistence + migration test | 旧 save 読み込み・未知フィールド保持 | LC-OD-5 |

**タイミング**: コンテンツ追加（材料 > 約 40、topping > 24 で 5 ページ目が生じる）より前に LC-1〜LC-3 を入れる。
Dex（LC-6）はレシピ数 > 約 40 より前。Shop / Inventory は材料 > 約 50 より前。それまでは現行 UI で十分成立する。

---

## 15. Owner Decisions（LC-OD-1…18）

| ID | 決めること | 推奨 | 代替 |
|---|---|---|---|
| **LC-OD-1** | Free Cooking の大規模化モデル | **A. 手元（≤12）＋ 食材庫シート** | B. トレイ内に family タブ行を追加（ステージ −32px、360×640 で 221px）／ C. トレイを縦スクロール化（Fix 2 のドラッグ競合が再発） |
| **LC-OD-2** | 棚のラベルに DH4 L2 family を使うか | **topping のみ使う**（ヒントと同じ語彙で HC-3 が成立） | 独自カテゴリ（ヒント語彙とずれる）／ 使わない |
| **LC-OD-3** | 食材庫のタップ挙動 | **✓ トグル + 「手元に並べる」** | タップ即選択して閉じる（単品は速いが組み合わせ探索が遅い） |
| **LC-OD-4** | 手元の容量と発動条件 | **12（2 ページ）、そのカテゴリ所持 > 12 のときだけ手元化** | 6（1 ページ）／ 常時手元化 |
| **LC-OD-5** | ⭐ / 🕘 / 使用回数の永続化 | **まずラウンド間 carry のみ（save 変更なし）→ LC-9 で save 任意フィールド** | 最初から save／ 永続化しない |
| **LC-OD-6** | 「↶1つ戻す」（最後の 1 配置を取り消す） | **採用（FREE のみ）** | 不採用（やり直すのみ）／ Lunch Rush にも |
| **LC-OD-7** | ヒント fact の手元 💡 自動配置 | **採用**（HC-1/2/4）、HC-3 は DH4-2 後 | 印のみ（自動配置しない） |
| **LC-OD-8** | Dex の未発見表現 | **B. 章ごとに件数と行動へ集約** | A. 現行（全枠カード）／ C. スタンプ帳（24px 番号スタンプ全枠） |
| **LC-OD-9** | 大きい章の扱い | **章算出は不変、12 件前後の「棚」小見出しで表示分割** | 価格帯を細分化して章を増やす（Progression SSOT 変更）／ 地域テーマ章 |
| **LC-OD-10** | Dex 発見済みカード | **3 列タイル + 詳細シート** | 現行フルカード（172 で 39〜53 画面） |
| **LC-OD-11** | Dex の 💡 導線 | **「これから」1 つ + 章ごと 1 つ**（章内先頭を pin） | 現行（DISCOVERABLE カードごと） |
| **LC-OD-12** | Pizza Select の列数 | **3 列コンパクト（360 でも）** | 2 列維持 + フィルタのみ |
| **LC-OD-13** | Shop の「在庫が少ない」閾値とまとめ補充 | **閾値 ≤3、まとめ補充は見送り** | まとめ補充あり（単品の和と等価が条件） |
| **LC-OD-14** | Inventory 閲覧モードで ⭐ を切り替えてよいか | **可（`onToggleFavorite` のみ、在庫/所持の mutation は型で不可のまま）** | 不可（閲覧専用を厳守） |
| **LC-OD-15** | 検索用読み `readingJa` を材料データに追加 | **追加（漢字を含む名前のみ、data-only）** | 追加しない（カタカナ名のみ検索可） |
| **LC-OD-16** | 「互換」フィルタの範囲 | **発見済みレシピのリミックスと表示済み fact のみ**（未発見への互換は作らない） | — |
| **LC-OD-17** | 在庫 0 の所持材料 | **手元自動候補から除外、食材庫で末尾・灰色** | 現行位置のまま |
| **LC-OD-18** | 合成 105/172 カタログのテスト seam | **テスト専用で作る**（本番無効） | 実コンテンツ投入まで検証しない |

---

## 16. Performance considerations

| 項目 | 現状 | 172/105 での見積もり | 推奨 |
|---|---|---|---|
| Dex DOM | 263 要素（dex11） | 全カード描画で約 2,200 要素（発見済みカード 1 枚 ≈ 13 要素、172 枚全発見時）＋長大レイアウト | 章折りたたみで**閉じた章は mount しない**。開いた章のみタイル描画 |
| Pizza Select DOM | 161 要素（11 枚、1 枚 ≈ 11 要素 + サムネ） | 約 1,900 要素 | 章折りたたみ＋`PizzaThumbnail` の遅延 mount（IntersectionObserver）。仮想化は不要な規模 |
| Shop DOM | 356（26 行） | 約 1,400 | 既定は NEW + 在庫少のみ描画 |
| `getIngredient` / `getRecipe` | `Array.find` 線形 | recipeDiscoveryState: 172 × 平均 5 材料 × 105 ≈ 9 万比較/描画 | `Map` 索引（pure 層で memo）。描画ごとの全再計算を `useMemo`（dex / owned / inventory 参照）で抑止 |
| `recipeChapterSlot` | 章内 `filter` + `findIndex` を枠ごと | O(R²) ≈ 3 万 | `buildRecipeChapters` の結果から slot を一括算出 |
| 手元 / 食材庫の算出 | `ownedIngredientIds.includes` | 105 × 105 ≈ 1 万 | `Set` 化。ラウンド開始時に 1 回、以降は pizza / picks 変化時のみ |
| 検索 | — | 105 件の部分一致 | 正規化済みキーを事前計算（読み + 名前）。入力ごとに線形走査で十分 |
| PREPARE dock | 最大ページ数から行数を予約 | 常に 2 行 + 棚バー 1 行 | 予約計算は定数化で単純化（DM-3R-0 のジャンプ問題は再発しない） |
| save サイズ | ids + 在庫 | ⭐/🕘/使用回数 追加で数 KB 以内 | 使用回数は上限付き（例: 999）、最近は直近 N=20 |
| 発見判定 | matcher は全 target 比較 | 172 target × 集合比較 | 1 回/焼成で問題なし。UI 側からは呼ばない |
| アニメーション | — | シート開閉 | transform / opacity のみ。調理ステージの再レイアウトを起こさない（シートは fixed） |

---

## 17. 本タスクでしていないこと（Non-goals）

- `src/**` / `e2e/**` / CSS / workflow の変更、merge、deploy、既存 PR（#255 ほか）の変更。
- 発見規則・ヒント価格・Rule W・k≥2・Ladder・章算出・価格・在庫規則の変更提案（すべて不変前提）。
- family 分類の確定（PR #255 の Human Classification Gate, OD-TAX-7 の範囲）。
- Lunch Rush のトレイ（Guided と同じくレシピ材料のみで、規模の影響を受けない）。

## 18. 付録: スクリーンショット索引

`docs/reports/screenshots/large-catalog-ux/<viewport>_<screen>.png`（viewport = 360x640 / 360x800 / 390x844）

| screen | 内容 |
|---|---|
| `free-cook_sauce` / `_cheese` / `_topping` | 29 材料所持の Free Cooking トレイ（topping 1/4 ページ） |
| `hint-sheet` | TOPPING ステップ上のヒントシート（トレイを覆う） |
| `dex_dex11` / `dex_dex0` | Dex（11 発見 / Margherita のみ） |
| `pizza-select_dex11` / `_dex0` | Pizza Select |
| `shop` | Shop（26 行） |
| `inventory` | Inventory（29 個） |
