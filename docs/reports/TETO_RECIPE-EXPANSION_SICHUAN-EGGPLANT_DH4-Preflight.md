# 四川風ナスピザ — 実装前 DH4 Gate 事前検証（docs-only、リポジトリ外の一時コピーで実測）

基準 `origin/main` = `485c515`（2026-10-23）。`CLAUDE.md` は変更なし。main の差分は docs・CI・test のみで、レシピ・ladder・golden は不変。
範囲: 調査と検証のみ。本体 `src/` `e2e/` workflow は未変更。実装 PR・新 claim・CI 再実行・merge・デプロイなし。DH4 gate は緩和していない。
Owner 判断（2026-10-23）: 月見は保留継続（恒久見送りではない）／OD-DH4-2-9 は改訂しない・`other` family は再分類しない／次の候補 = 四川風ナス／四川風ナスを含む DH4 事前検証を **1 回だけ**承認／原典未確認のまま実装 PR は作らない／step 56 は予約しない。

## 1. 暫定データと 172 マトリクスの照合

`TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` の行 `sichuan-eggplant-pizza` と一致を確認:

| 項目 | マトリクス | 暫定データ |
|---|---|---|
| 食材（canonical） | doubanjiang / eggplant / garlic / green-onion / mozzarella（未解決トークン 0） | 同じ 5 種 |
| 新食材 | `doubanjiang`（taxonomyFlag `sauce_not_topping` = sauce）、`green-onion`（genuinely_new） | sauce 1 + topping 1 |
| ソース層 | 「ホットソース」、status `listed`、base = doubanjiang、spreadLayerCount 1 | doubanjiang 1（SAUCE の PAINT） |
| 生地 / 工程 | 薄めの生地（standard / thin / round）、`standard(sauce->cheese->topping)`、bake、`prep: []`、`postBakeFinish: []` | SAUCE → CHEESE → TOPPING → BAKE |
| 表現可否 | FULL、requiredCapabilities 空、blockers 空、reviewItems 空、READY | 新工程なし |
| 識別集合の衝突 | 既存 62 件のどれとも不一致（再計算済み） | — |

**個数・焼成窓・工程タイミングはマトリクスに無い**（暫定値は GAMEPLAY CALIBRATION）: doubanjiang 1 / mozzarella 2 / eggplant 3 / garlic 1 / green-onion 2（非ソース 8 片）、焼成 58–78。

## 2. 検証方法

1. `origin/main`（`485c515`）を `git archive` でリポジトリ外のスクラッチへ展開、`npm ci --ignore-scripts`。
2. **ベースライン**（無改変）で DH4 / deduction 関連の 7 ファイルを 1 回実行。
3. 同じコピーに四川風ナスを追加（下記）して、同じ 7 ファイルを **1 回**実行。
4. コピーは削除済み。リポジトリ本体は未変更。

追加した最小データ（`description` 等は `scratch`）: `recipes`（5 材料）、`ingredients`（`doubanjiang` = `category:"sauce"`・`placement:"spread"`・色 `#8a2b1c`、`green-onion` = topping・`#7fae4a`）、`ingredientTaxonomy`（`["green-onion","herb"]`）、`toppingSizeClass`（`green-onion: "xs"`）、`discoveryLadder`（末尾に `["doubanjiang","green-onion"]` 1 step、key = 四川風ナス）、`discoveryCatalog` target、`recipeHintRoles`（key-free）、`recipeSauceProfiles`（`doubanjiang` PAINT）、`orders`。`referencePizza`・Shop 表示・アイコンは未追加（DH4 では使わない）。

対象テスト 7 ファイル: `deductionProduction.gate` / `deductionGuard.gate` / `deductionGuard` / `deductionGuard.timing` / `deductionGuard.futureCategory` / `deductionHint` / `deductionRequest`（各 `*.test.ts`、`src/logic/discovery/`）。

## 3. 結果

| | ベースライン（無改変 main） | 四川風ナス追加 |
|---|---|---|
| Test Files | 7 passed | **6 passed / 1 failed** |
| Tests | 114 / 114 passed | **113 / 114**（1 fail） |

### 3.1 DH4 production gate（`deductionProduction.gate.test.ts`）: **14 / 14 pass**
OD-DH4-2-9「その他は到達不能」（`attr:*:other` が答えられない）、独立攻撃者（reserve を 0 状態で特定）、Technique 非漏えい、fail-closed、Pitz 課金の各テストを含め、**すべて合格**。月見（egg を含む）で落ちたテストも合格。

### 3.2 deduction guard 関連: 6 ファイル pass、`deductionGuard.gate.test.ts` が 1 fail
- `deductionGuard.test` / `.timing` / `.futureCategory` / `deductionHint` / `deductionRequest`: すべて pass。
- `deductionGuard.gate.test.ts`: 16 件中 15 pass、**1 fail**:
  - 名前: 「across the synthetic families DH4-2A leaks and the hardened guard never does」
  - 失敗行: `expect(dh42aLeaks).toBe(156)` → **received 123**（行 128）。
  - **失敗した内容の性質**: このテストは (a) 旧 DH4-2A ガードの漏えい件数を数え（`dh42aLeaks`）、(b) 各状態で **hardened ガードが一切漏えいしない**（`expect(leakPriors(HARDENED, …)).toEqual([])`）を検査する。(b) はループ内で全状態を通過してから (a) の件数ピンで落ちている → **hardened ガードの漏えいは 0 のまま**（プライバシー性質は保たれている）。
  - 件数ピン 156 は旧ガードの**測定スナップショット**で、テスト内コメントのとおり、トッピングが増えるたびに再測定されてきた（No.27・Slice 1/3・Batch 1/2/4/5・Batch 6 PR-2・Batch 8b）。合成 family が本番の TOPPINGS から切り出されるため、`green-onion` が TOPPINGS に入ると形が変わる。今回 156 → 123。
  - **ただし**これは gate の「通過条件」ではなくスナップショットだが、**テストの定数を書き換える変更**になる。前例どおり実装 PR で再測定して更新する運用か、Owner が方針を決めるかは §6。**本検証では書き換えていない・緩和していない。**
  - 切り分けの限界: 追加したのは sauce 1 + topping 1 の同時で、1 回しか走らせていないため、件数の変化が `green-onion`（topping）だけに由来するかは未分離（sauce は TOPPINGS に入らないので topping 由来の可能性が高い、は推測）。

### 3.3 対比（月見）
月見入りは production gate 13/14（`attr:group:other` で OD-DH4-2-9 が fail）。四川風ナスは `other` family（egg / almond / pine-nuts）の食材を含まず、同じ gate が 14/14 で通る。

## 4. 検証していないこと（限界）
- 対象は上記 7 ファイルのみ。**Hint 5.0 gate**（`hint5Taxonomy.gate` G18 一意性、`hint5Production`、`hint5Ladder.golden`）、`catalogLedger`・ladder 導出・`recipeChapters`・manifest・Research ラベル・Shop・Lunch Rush 除外・`tsc`・oxlint・build・e2e は**未実行**（実装 PR で必須。件数 pin 系は追加で必ず更新が要る）。
- 暫定データは最小の合成で、Reference・描画・アイコン・Shop 行は無い。
- 色 `#8a2b1c`・個数・焼成窓は仮置き。
- 1 回のみの承認のため、再実行・分離はしていない。権限エラーは出なかった。

## 5. 実装可否と原典確認

### 5.1 実装可否
**DH4 の観点では実装可（阻害なし）**。ただし次が揃うまで実装 PR は作らない（Owner 判断 5 を維持）:
- 原典確認（下記）、新しい実装 claim、Owner の着手 GO。
- `deductionGuard.gate` の件数ピン（156）の扱いの決定（§6）。

### 5.2 原典確認が必要な工程（Owner のページ共有を優先、推測で埋めない）
対象: **`https://pizzadb.jp/pizzas/sichuan-eggplant/`**（個別ページ、出典 URL）、補助 `https://pizzadb.jp/compare/world-pizzas/page/14/`（比較表の裏付け）。pizzadb.jp は本環境から到達不可（403）。証跡は中継 2026-09-22、独立再取得なし。

| # | 確認事項 | 結果次第の扱い |
|---|---|---|
| **Q1** | **青ねぎの投入タイミング**（焼成前 / 焼成後の仕上げ） | 焼成後 → 後乗せ（P3 以降、E5 待ち）で通常 ladder 不可 |
| **Q2** | **豆板醤の使い方**（生地に塗る / 具と炒める） | 炒める → 下ごしらえ（新工程、`PREP_STEP`）で通常 ladder 不可。マトリクスは `prep: []` だが**ページ側の記載は未確認** |
| **Q3** | **ナスの調理**（生で載せるか、事前に焼く・揚げる・炒めるか） | 事前調理が必須なら Q2 と同様に下ごしらえ |
| **Q4** | 材料の一致（ナス / 豆板醤 / にんにく / 青ねぎ / モッツァレラ の過不足）、ソース欄が「ホットソース」のまま | 不一致なら識別集合が変わる → 衝突・Research・ladder を再検証 |
| Q5 | 個数・焼成条件 | 不要（暫定値のまま。OD-B9-4 方針） |
| Q6 | 豆板醤の見た目の色（赤褐色 / 暗赤など） | 実装時の色の根拠。トマト `#c73b2e` に近い色は不可（`#a8321f` は素の色差 ΔE≈10 で不可、`#8a2b1c` は ≈22） |

## 6. 次に必要な Owner 判断
1. **原典（Q1〜Q4、できれば Q6）の共有**。Q1〜Q3 のどれかが「焼成後」「炒める」なら、四川風ナスは通常 ladder に入らない。
2. **`deductionGuard.gate` の件数ピン**: 実装 PR で 156 → 再測定値へ更新する前例運用でよいか（hardened の `toEqual([])` は不変で、プライバシー性質は変わらない）。それとも、更新前に Owner が個別に確認するか。
3. 新しい実装 claim の投稿者と、着手 GO（原典確認後）。
4. 月見は保留継続のまま（解除条件は OD-DH4-2-9 を触らない形で別途検討）。
