# 柚子えび / 月見 — 実装前 Audit（docs-only、調査・設計のみ）

基準 `origin/main` = `cea6904`（#642、前回 audit から**変化なし**）、2026-10-23。ブランチ `claude/recipe-expansion-prep-3i9dyz`。
前提レポート: `TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`。第一候補 = 柚子えび、第二候補 = 月見（Owner 指定）。
`src/` `e2e/` workflow は未変更。PR・merge・デプロイ・Preview 更新なし。他セッションのブランチは **PR ref の読み取り fetch のみ**（変更・push なし）。
方法の限界: 依存未導入のためテスト・ladder 導出は未実行。pizzadb.jp には**到達不可**（§4）。

## 1. 事前確認（main / PR / Issue / claim）

| 項目 | 結果 |
|---|---|
| main | `cea6904`。通常レシピ 62・食材 67・ladder 55 step（次は **56**）・credited 58 |
| レシピデータを足す open PR | **無し** |
| #639（P3-a1）| `state/doughSelection.ts`・`gameReducer.ts` ほか。本件と**衝突しない** |
| #640（P3-a2）| `data/lateCatalog.ts`・`data/discoveryCatalog.ts`（+ テスト）。**`discoveryCatalog.ts` が柚子えびの PR と同一ファイル**（別ハンクの見込み。後から入る方が追従） |
| #644 | WebKit CI のみ。無関係 |
| #540 / #584 / #633 / #620 / #612 / #587 | 触らない。#584 は step 55 を使わない決定済み（Archival）。#540 は HOLD |
| Issue #578（New Sauces）| Phase A は #634 で出荷済み。Phase B（本件）用の**新しい claim は未投稿**。既存 claim（session `015U…`、期限 10/27、`ingredients.ts` `recipes.ts` `discoveryLadder.ts` golden を含む）は release の投稿が確認できない → **着手前に release 確認か Phase B claim が必要**（運用 §1: soft reservation） |
| Issue #527 | D4（pizzadb.jp 独立再取得）は未完了のまま |

## 2. 柚子えび（`yuzu-shrimp-pizza`）の監査

### 2.1 証跡（172 evidence 行 149、`TETO_PIZZADB_172_MASTER-EVIDENCE.json`）

| 項目 | 値 |
|---|---|
| 名前 / 出身 | 柚子えびピザ / 日本・各地 |
| 食材欄 | エビ / 柚子胡椒 / モッツァレラチーズ / 大葉 |
| ソース欄 | `その他`（= 下地ソースの指定なし。柚子胡椒は matrix が `sauce_or_condiment` と注記） |
| 生地 | 薄めの生地（標準丸生地） |
| 出どころ | 個別ページ `https://pizzadb.jp/pizzas/yuzu-shrimp/` ＋ 比較表 page 15 で 1 件裏付け。`verifiedAt: 2026-09-22 (relayed, not independently re-fetched)` |
| 個数・焼成窓・**工程タイミング** | **記録なし**（`evidenceGaps: []`、`mechanicIdentityNote: null`） |

最大の未確定: **大葉・柚子胡椒が焼成後かどうか**。同じ大葉は ikura で「焼成後」と中継されて HOLD→後乗せ再設計になった（#584 Archival §1）。柚子えびの工程は repo に無く、「焼成前」は**設計上の仮定**。Owner が実ページで確認するまで、`shirasu`（仕上げにレモン・しらす数分前の中継あり、出荷は焼成前のまま）と同じ「暫定」扱いになる。

### 2.2 レシピ定義（提案・暫定値）

| 項目 | 提案 | 根拠 |
|---|---|---|
| id / 名 | `yuzu-shrimp-pizza` / 柚子えびピザ | matrix id と evidence 名。`shirasu-pizza` と同じ命名 |
| 材料 | yuzu-kosho 1（SAUCE の PAINT）/ mozzarella 2 / shiso 1 / shrimp 3 | **個数は GAMEPLAY CALIBRATION**。非ソース 6 片 ≤ リング 8 |
| 焼成窓 | 58–78（`FREE_COOK_BAKE_TARGET` と同値で中央値を動かさない） | shirasu・flammkuchen の前例 |
| 宣言 | `ladderCredit` あり（credited 58→59）、`lunchRush:false`、CUT なし、Hint = key-free | 前例。CUT 対象外は `EXPECTED_NOT_CUT_ELIGIBLE` |
| 識別集合 | {mozzarella, shiso, shrimp, yuzu-kosho}。**既存 62 件のどれとも不一致**（再計算済み）。部分集合の近縁: `shirasu`（shiso を共有）, `pesto-gamberi`（shrimp を共有）— 完全集合一致ではないので衝突しない | 本書で再計算 |
| 工程 | SAUCE → CHEESE → TOPPING → BAKE（`pesto-*` と同じ「ソース + チーズ」型） | 既存 `deriveCoreSteps` |

### 2.3 新ソース `yuzu-kosho`

| 論点 | 設計 | 状態 |
|---|---|---|
| 種別 | `category: "sauce"`, `placement: "spread"`（既存 PAINT）。topping ではなくソース扱い | 証跡は未決。**matrix の導出とレシピ名の「柚子胡椒＝ペースト」から sauce を提案** → Owner 承認 |
| 表示名 | 柚子胡椒（`nameJa`）。果汁の柚子ではない | 確定的 |
| 色 | **推奨 `#b5c56a`（黄緑）。赤柚子胡椒（`#c8452e` 付近）は不可** | **要 HV**。下記 |
| 描画 | 追加コードなし。`color` だけで描画（`PizzaStage` / `SauceMergedCanvas` は `olive-oil` だけ個別扱い。fromage-blanc と同じ経路） | 確定的（コード確認） |
| アイコン | tray/shop チップは `emoji` フォールバックのみ（fromage-blanc 前例）。専用 SVG は不要。G18 の一意性だけ確認 | emoji は未選定（G18 で既存と重複しないもの） |
| 在庫・価格 | 個別設定なし。T4 tier 規則: 初回 120 Pitz = 10 回分、補充 60。星ゲート無し（案、前例） | Owner の再確認 |
| taxonomy | 付けない（`TOPPING_FAMILY_ROWS` は topping 専用） | `hint5Taxonomy.gate` で確認 |

色の測定（CIE76 の概算、#634 と同じ方法。dough = `#f3d9a4`→`#e2b876` に alpha 合成）:

| 候補 | ΔE vs 生地 (α0.46 / α0.85) | ΔE vs pesto `#6b8e3d`（素の色） | ΔE vs olive-oil | 備考 |
|---|---|---|---|---|
| `#b5c56a` 黄緑（推奨） | 12.9 / 23.3 | 23.3 | 23.5 | 生地上の pesto との差は α0.46 で ΔE ≈ 10.7 と**小さめ** |
| `#9bb15a` | 14.5 / 27.2 | 15.1 | 28.1 | pesto に近い。非推奨 |
| `#c8452e` 赤 | — | 77 | 67 | **tomato `#c73b2e` とほぼ同色**（識別不能）。不可 |

→ 緑系は pesto と重ねたときの見分けが弱い。**実機 HV で薄塗りと重ね塗りを確認**し、不足なら明度を上げる（`#c5d08a` は生地に対して ΔE 8–15 で薄い）。

### 2.4 影響範囲

| 領域 | 影響 |
|---|---|
| ladder | **step 56** `["yuzu-kosho"]`、key = `yuzu-shrimp-pizza`、T4、星ゲート無し。1–55 凍結。`discoveryLadder.appendOnly` / ladder 導出テストの幅を維持（#634 と同じ） |
| Research | コホート = yuzu-kosho（単独 step）→ 文字なし。**既存エントリの文字は動かない**（shrimp(26)・shiso(54) のコホートには合流しない: 最後に解禁する材料が yuzu-kosho だから） |
| 図鑑 | 通常 +1（63）。章 4 は 27→28（導出表示。保存は無影響、#634 §4 と同じ） |
| Hint 5.0 | 永久 key-free。golden は追記専用（`hint5.ladders55.json` 系。#634 は +158 行 / 削除 0 だった。今回の行数は未測定）。`alphaFamilyOnly` に追記。単独ソースなので sauce rung は 1 つ |
| DH4 / Anti-Oracle | audit JSON の `category` 4→5。sweep 再実行。**ソース色が識別情報になる可能性**（pesto と近い緑）→ 色は UI 上の既知情報（塗れば見える）であり未発見レシピの漏えいではないが、Hint/Research の表示に色を使わないことを確認 |
| Shop | step 56 の NEW 行、locked 行の匿名表示の再確認（`materialShop.test` / batch6 の前例） |
| Lunch Rush | プール 25 のまま（opt-out +1 → 38） |
| Pitz / 採点 / 保存 | 変更なし。schema v2 |
| ★ゲート到達性 | 63 レシピ = 一律 ★2 で 126★。goat-cheese 120 は既に到達、spinach 130 は未到達（推定。`ladderReachability.starGate` を再測定） |
| late catalog（OFF）| ikura の late step 番号が 56→57 にずれる（OFF では無影響。E5 前の既知宿題） |

触るファイル（flammkuchen/shirasu の grep から）: `data/` の `recipes` `ingredients` `recipeSauceProfiles`（union に追加 + PAINT 行）`discoveryCatalog` `discoveryLadder` `referencePizza` `recipeHintRoles` `orders`、テスト `recipes.test` `cookingProfiles.test` `discoveryLadder.test` `materialShop.test` `progression.test` `lunchRush.exclusion.test` `researchLabels.batch8a.test` `selectableHint.test` `recipeBatch.validator`、manifest `recipeBatchManifest.ts`、golden `hint5.ladders55.json` `hint5.alphaFamilyOnly.json`、DH4 audit JSON、新規 `*.yuzu.test.ts` と `e2e/new-sauces-b1.spec.ts`。**`ingredientTaxonomy` / `toppingSizeClass` は触らない**（sauce・新 topping 無し）。

## 3. 月見の `green-onion`

### 3.1 証跡
月見ピザ（`tsukimi-pizza-pizzadb-p14`）: 卵 / ベーコン / モッツァレラ / **青ねぎ**、ソース欄 `チーズ`（= NO_SAUCE）、薄めの生地。**比較表のみ**（個別ページ・工程・個数なし、中継 2026-09-22）。canonical id `green-onion` は matrix の候補で、日本語は「青ねぎ」。ねぎ類の種別（青ねぎ / 小ねぎ / 長ねぎ）は証跡上これ以上絞れない。識別集合 {bacon, egg, green-onion, mozzarella} は既存と衝突しない（`breakfast-pizza` は tomato-sauce + mozzarella + egg + bacon で別物）。

### 3.2 family の提案

既存の L1 は vegetable（onion / jalapeno / bell-pepper / green-pepper / arugula）、herb（ハーブ・香味: garlic / parsley / shiso / basil / mint ほか）。

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）`herb`（ハーブ・香味）** | 青ねぎは薬味・飾りで、`garlic` `shiso` `parsley` と同じ「香味」の役割。ラベル「ハーブ・香味」に素直に収まる | 同家族の既存メンバー ≥2 なので k≥2 ガード・近傍ヒントで単独家族にならない。G18（ラベルに食材名を含まない）OK |
| B `vegetable` | `onion` と同家族（「たまねぎ」との混同を避けられる） | 野菜・きのこ家族がさらに膨らみヒントの絞り込み力が下がる。onion/green-onion を家族で区別できない |

`TOPPING_FAMILY_ROWS` に 1 行（`["green-onion", "herb"]`）と OD コメント。L2 は足さない。**Owner の batch-scoped OD が必要**（OD-B8-2 型。#255/#293/#296 は承認しない）。

### 3.3 描画方式の提案
| 項目 | 提案 |
|---|---|
| ピース | 専用 `pieceVisual: "green-onion-slices"`（緑の小口切りの輪＋白い芯）。`DedicatedIngredientVisual` 型に 1 値、`IngredientGlyph.tsx` に 1 描画、参照 SVG を `docs/design/references/ingredient-icons-2.0/` へ（shiso / whitebait の 8b と同じ手順） |
| emoji | 未表示の text fallback。G18 で一意なもの（既存と重複しない） |
| size class | `s`（小口切りは `onion` と同じ小）か `xs`（刻み。`shiso` / `parsley` と同じ）。**`xs` 推奨**（散らす薬味）。Reference 片数・リング上限と合わせて実機で調整 |
| 色 | 緑 `#7fae4a` 前後（basil / shiso / parsley の緑と並べて区別が付くか HV） |
| 名前衝突 | `green-onion` ⊃ `onion`。**訂正（確認済み）**: `selectableHint.test` の漏えい検査は `ing:${id}` / `"${id}"` の完全一致で、`ing:onion` は `ing:green-onion` の部分文字列にならない（#584 の `salmon` ⊂ `salmon-roe` は前方一致）。偽陽性は出ない見込み。詳細は `TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md` §3.2 |

### 3.4 月見のレシピ定義（提案・暫定）
bacon 3 / egg 1 / mozzarella 2 / green-onion 2、NO_SAUCE（sauce profile `null`、CHEESE 工程から）、焼成 58–78、`lunchRush:false`、CUT なし、credited、key-free。卵の配置は中央想定だが `ZONED_PLACEMENT` は要求しない（matrix `candidateCapabilities` 空）。ladder は step 57（柚子えびの次）、key = green-onion。コホートは単独（文字なし）。

## 4. pizzadb.jp の原典確認

**不可。** `curl https://pizzadb.jp/pizzas/` は `CONNECT tunnel failed, response 403`（環境のネットワークポリシー、#527 と同じ）。環境の許可ドメイン追加は `read_documentation environment.network` の手順でユーザー側の設定が必要で、本セッションでは変更していない。
**未確認項目（明記）**:
- 柚子えび: 材料構成の最終一致、個数、焼成窓、**大葉・柚子胡椒の投入タイミング（焼成前/後）**、柚子胡椒が緑/赤どちらか。
- 月見: ねぎの種類、卵の置き方（生/半熟/焼成後）、個数、焼成窓。
- 両方とも「中継（2026-09-22）」の証跡のみで独立再取得なし。実装 PR はすべて「暫定」と明記する前提。

## 5. 最小の実装 PR 分割案

| PR | 内容 | 依存 | 規模 |
|---|---|---|---|
| **PR-0 docs（先行・任意）** | Owner 決定記録（OD-B9: yuzu-kosho の種別/色/星ゲート無し、`green-onion` の family/描画/size class、ladder 56=yuzu・57=tsukimi）。実ページ確認結果を載せる | Owner | 小 |
| **PR-1 柚子えび** | `yuzu-kosho` + `yuzu-shrimp-pizza`（ladder 56、credited 59）。#634 と同型の 1 PR | claim、PR-0 の承認、原典タイミングの確認結果 | M |
| **PR-2 月見** | `green-onion`（専用 SVG・family 1 行・size class）+ `tsukimi-pizza`（NO_SAUCE、ladder 57、credited 60） | PR-1 の merge（ladder・golden を共有）、`green-onion` の OD | M |

これ以上は割らない（ソース導入とトッピング導入を 1 PR に混ぜると、描画ゴールデンと Hint golden の差分の原因が切り分けられなくなる）。各 PR: Vitest（焦点）+ `tsc -b` + oxlint + build、代表 E2E（390×844 / 360×800。WebKit は CI）、HV（動画 390×844 は Owner へ直接、スクショ `docs/reports/screenshots/<task>/`）。**merge は Owner 承認**。
並行できるのは PR-0 と、材料 0 の非 credit 2 件（caponata / jamaican、別 Owner 判断）のみ。`recipes.ts` `discoveryLadder.ts` golden は HOT。

## 6. 実装可能性・未確定事項（要約）

**実装可能性: 高。** 柚子えびは #634（fromage-blanc）と同型で、新しい操作・工程・保存形式の変更が無い。月見は新トッピング導入の手順（8b の shiso/whitebait）に沿う。

**Owner 判断が要る未確定仕様**
1. 柚子えびの工程タイミング（焼成前でよいか。後なら late catalog 側＝別設計で、通常 ladder には入らない）。**最大のリスク。**
2. `yuzu-kosho` を sauce 扱いにしてよいか、色（黄緑案）、星ゲート無し、価格は T4 規則でよいか。
3. 個数・焼成窓・CUT なし（暫定値）。
4. `green-onion` の family（`herb` 推奨）・専用 SVG・size class（`xs` 推奨）。
5. ladder 順（柚子 56 → 月見 57）と #578 claim の扱い。
6. pizzadb.jp の独立再取得（ネットワーク許可 or Owner による貼り付け）。

実施していないこと: コード・テスト・workflow の変更、PR、merge、デプロイ、Preview 更新、他ブランチの変更、`PROJECT_HANDOFF.md`（HOT）の更新。
