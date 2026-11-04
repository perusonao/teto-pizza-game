# Expansion Batch 18 — Result（途中停止: Owner 承認待ち 1 件、Issue #748）

基準 `origin/main` = `0016222`（#743）。**状態: 実装・単体検証までは完了。ただし Research ラベルの既存レシピ 1 件（bbq-chicken-pizza）への影響が測定で見つかったため、Owner 指示（既存データの意味が変わる場合は停止）に従い、PR は作成していません。** 共有 Preview・Production・merge は未実施。設計は `docs/reports/TETO_EXPANSION-BATCH-18_Design-Audit.md`。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）
原典 pizzadb.jp は未確認。根拠は 172 マトリクスの 2 行（`baingan-bharta-pizza-pizzadb-p6` / `venezuelan-reina-pepiada-pizzadb-p12`、どちらも `BASE_SAUCE_UNSPECIFIED` のまま）。個数・焼成窓 58–78・cilantro を焼成前に置くこと・代用ソースはすべて暫定。Owner 決定（2026-11-04）: curry-ketchup / fromage-blanc-sauce は**レシピ限りの代用**で NO_SAUCE 例外は使わない。

## 1. 内容
| 項目 | 内容 |
|---|---|
| `cilantro` | late 専用 → 通常素材へ昇格（**id・色 `#6cae3e`・絵・family herb・size xs・T4 / k=2 は不変**、新 id なし）。通常 step 69、星ゲートなし。`LATE_ENTITLEMENT_FLOORS.cilantro = 66` は意図的に維持（floor は早く付与する方向にしか働かず、再ロックしない） |
| `baingan-bharta-pizza`（バインガンバルタピザ） | credited・step 69 の key。curry-ketchup 1（PAINT）/ mozzarella 2 / eggplant 2 / fresh-tomato 1 / onion 1 / cilantro 2（非ソース 8）、全て焼成前、CUT なし、bake 58–78、key-free |
| `reina-pepiada-pizza`（ベネズエラレイナペピアーダピザ） | **非 credit**（`ladderCredit:false`）。fromage-blanc-sauce 1（PAINT）/ mozzarella 2 / chicken 2 / avocado 1 / mayo 1 / cilantro 2（非ソース 8）、全て焼成前、CUT なし、key-free |
| BBQ の後乗せ step | `["bbq-sauce","cilantro"]` → `["bbq-sauce"]`（BBQ レシピ自体・後乗せの cilantro は不変） |
| `lateCatalog.ts` コメント | 「Production は false」→ 実際は E5（#654、2026-10-24）以降 `true`（FINISH も `true`）と訂正（Owner 承認済み） |

## 2. 件数・step（最新 main `0016222` 基準で再計算）
| | 前 | 後 |
|---|---|---|
| レシピ（Pinsa 開／閉） | 88／87 | **90／89** |
| credited | 78 | **79** |
| 食材 id | 97 | 97（cilantro は late ON ビルドで既に数えていた。late OFF の base では +1） |
| toppings | 68 | 68 |
| 通常 step | 68 | **69**（step 1–68 は凍結・一致を確認） |
| 全 step | 75 | **76** |
| late の導出番号 | 69–75 | **70–76**（+1。floor は不変） |
| 章サイズ | 6/12/19/51 | 6/12/19/**53** |
| Lunch Rush プール | 25 | 25 |

## 3. scratch 測定（昇格前後、`ladder` 順の測定器で比較）
| 観点 | 結果 |
|---|---|
| ladder step 1–68 | **完全一致** |
| late step | 番号が +1（69–75 → 70–76）、BBQ step は `bbq-sauce` 単独へ |
| floor | `LATE_ENTITLEMENT_FLOORS` **不変**（cilantro / bbq-sauce とも 66） |
| 解禁タイミング（credited 数） | mayo 65 / **cilantro 66 / bbq-sauce 66** / sour-cream 68 — **昇格前後で同一**（floor により cilantro は従来どおり 66 で付与される。step 69 は名目上の key 位置で、実際の付与は変わらない） |
| 既存の文字付き cohort | ladder 順の全 prefix で**移動なし**（既存テスト群 + 新テスト） |
| 新 cohort | cilantro で baingan / reina が文字付き（A/B）になる（新規 2 件） |
| 既存セーブ・Dex・在庫 | id 不変のため影響なし（`persistence.batch18.test.ts`: 旧順序・在庫 7・bbq の Dex エントリがバイト単位で保存） |
| **bbq-chicken-pizza の Research ラベル** | **変化あり（下記 §4）** |

## 4. 停止理由: bbq-chicken-pizza のラベル（Owner 判断が要る）
Research の匿名ラベルは「所持順で最後に入手した有限素材」で決まる（`researchEntry.ts`）。cilantro を 2 つの通常レシピも使うようになったため:
1. **ladder 順（正準）**: cilantro(69) が bbq-sauce(74) より先 → bbq の解禁素材は bbq-sauce。**文字は付かない**が、ラベル文字列が「？？？ピザ（パクチー）」→「？？？ピザ（バーベキューソース）」に変わる。
2. **bbq-sauce を先、cilantro を後に入手した順序**（entitlement floor が付与する順 = 現行セーブで最も典型的）: bbq の解禁素材は cilantro のまま。cilantro cohort が {reina, bbq-chicken, baingan} の 3 件になり、**bbq-chicken-pizza に文字が付く（「？？？ピザ（パクチー）」→「？？？ピザ B（パクチー）」、reina A / bbq B / baingan C）**。この順序で他の既存レシピの文字は**一切動かない**（実測、21 件一致）。影響は「bbq-chicken を未発見のまま、この順序で両素材を持つセーブ」の Research 表示のみ。ラベルは保存されず（`persistence.batch18.test.ts` で確認）、保存データ・採点・在庫は変わらない。
3. 既存の検証器（`validateBatchManifest` と各 cohort テスト）は ladder 順しか測らないため、2 は既存の枠組みでは検出されなかった（新テストで測定・固定）。

**これは「既存の Research cohort の意味の変更」に当たると判断し、PR を作らず停止しました。** 実装は完了済みで、`PENDING OWNER APPROVAL` として新テストに測定値を固定してあります（`acceptedLetterShifts` は承認がないため宣言していません）。

### 安全な代替案
| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 上記のシフトを Owner が明示承認し、`B18_BATCH.acceptedLetterShifts = { "bbq-chicken-pizza": "-->B" }` を宣言 | 先例あり（B12 veggie-supreme → B、B12b spanish-chorizo → B、B15 rendang → B）。実装・テストは完了済みで、承認後すぐ PR 化できる |
| B | cilantro を通常素材にせず、BBQ だけに残す（レシピ 2 品は保留） | 既存データ不変。ただし Owner 判断（昇格）を取り消すことになり、両レシピは別の新素材が要る |
| C | 研究ラベルの規則を変更（post-bake 素材を解禁素材から除外） | 既存全 late レシピのラベル規則を変える。範囲が広く非推奨 |
| D | 別の通常素材をレシピに使う | 原典の「コリアンダー」から外れる |

## 5. 変更ファイル（`src/` 中心、UI・reducer・保存・CSS は変更なし）
データ: `recipes.ts`（+2）/ `ingredients.ts`（cilantro 昇格）/ `lateCatalog.ts`（cilantro 削除・BBQ step・コメント訂正）/ `ingredientTaxonomy.ts` / `toppingSizeClass.ts` / `discoveryLadder.ts`（step 69）/ `discoveryCatalog.ts` / `recipeHintRoles.ts` / `recipeSauceProfiles.ts` / `orders.ts` / `referencePizza.ts`（8 点リング 2 件、cilantro は `LIGHT_LEAF`）。テスト基盤: `recipeBatchManifest.ts`（`B18_BATCH`、BBQ の key を bbq-sauce に）。golden: `hint5.ladders55.json`（**挿入のみ**、+606 / 削除 0）、`hint5.alphaFamilyOnly.json`（新 2 件の追加と late 4 件の値の更新（ikura・yuzu・tahini・tarako））。新規テスト: `expansionBatch18.test.ts`（37）、`persistence.batch18.test.ts`（6）。既存テストの追従は件数 pin・step 番号 +1・昇格に伴う late の期待値の移動・non-credit 一覧への追記のみで、assertion の意味は弱めていない（`discoveryLadder` の「最新 step だけ導出」は先例どおり凍結 prefix を 68 に延長。理由: cilantro は 2 レシピを開くため REC-04 の tie-break で sour-cream より前に並び、凍結済みの step 68 を入れ替えてしまう）。

## 6. 検証（実行した範囲）
- Vitest 全体（Pinsa ON）: 609 ファイル / 11,392 テスト pass（昇格前の基準は 609 / 11,366）。
- typecheck（`tsc -b`）クリーン、`oxlint` は既存の 3 警告のみ（本変更のファイル外）、`vite build` 成功。
- **未実施**: Pinsa OFF 全 Vitest、Chromium E2E、WebKit 390×844 / 360×800、iPhone HV、CI、Codex レビュー（承認前に PR を作らないため）。

## 7. 実施しなかったこと
PR 作成、CI / Codex、共有 Preview 更新、Production ON、merge、#738 Steam / #746 DRIZZLE のコード変更、未承認の調理工程の追加。

## 8. Owner 判断
1. §4 の案（A 推奨）。
2. cilantro の floor（66）を維持したため、baingan / reina は step 69 の名目より早い credited 66 から発見できる（実質は従来の cilantro の付与時期のまま）。厳密に step 69 で付与したい場合は floor の見直しが要る（既存の floor 固定テストと再ロック防止の観点で非推奨）。
3. baingan-bharta-pizza は rendang-pizza / curry-pizza-japan と Jaccard 0.43（0.4 基準超え。curry-ketchup 代用が原因、集合の同一・部分集合・上位集合はなし）。B16 先例のように「このレシピ限りの例外」として承認するか。
4. 共有 Preview の更新・iPhone Safari HV は、案の確定後。
