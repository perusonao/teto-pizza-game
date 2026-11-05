# Expansion Batch 18 — Result（Owner 3 件承認済み・PR検証段階、Issue #748）

基準 `origin/main` = `0016222`（#743）、**2026-11-05 に `d85b957` を merge 済み（競合なし、main 側の変更は fry ロジック・E2E 診断・docs で本バッチとファイルの重なりなし）**。**状態: 実装・単体検証完了。Research ラベルの既存レシピ 1 件への影響を停止・報告後、2026-11-05 に Owner が OD-B18-1〜3 を承認した（Issue #748 コメント 6650593172）。承認に沿った最小限の反映を行い、PRの技術Gateに進む。** 共有 Preview・Production・merge は未実施。設計は `docs/reports/TETO_EXPANSION-BATCH-18_Design-Audit.md`。

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

## 4. Owner承認済み: bbq-chicken-pizza のラベル変更（OD-B18-1）
Research の匿名ラベルは「所持順で最後に入手した有限素材」で決まる（`researchEntry.ts`）。cilantro を 2 つの通常レシピも使うようになったため:
1. **ladder 順（正準）**: cilantro(69) が bbq-sauce(74) より先 → bbq の解禁素材は bbq-sauce。**文字は付かない**が、ラベル文字列が「？？？ピザ（パクチー）」→「？？？ピザ（バーベキューソース）」に変わる。
2. **bbq-sauce を先、cilantro を後に入手した順序**（entitlement floor が付与する順 = 現行セーブで最も典型的）: bbq の解禁素材は cilantro のまま。cilantro cohort が {reina, bbq-chicken, baingan} の 3 件になり、**bbq-chicken-pizza に文字が付く（「？？？ピザ（パクチー）」→「？？？ピザ B（パクチー）」、reina A / bbq B / baingan C）**。この**1 つの順序では**他の既存レシピの文字は動かない（実測、21 件一致）。**ただし他の取得順では他の既存レシピも動く（§11、Codex P2 で判明、未承認）。**影響は「bbq-chicken を未発見のまま、この順序で両素材を持つセーブ」の Research 表示のみ。ラベルは保存されず（`persistence.batch18.test.ts` で確認）、保存データ・採点・在庫は変わらない。
3. 既存の検証器（`validateBatchManifest` と各 cohort テスト）は ladder 順しか測らないため、2 は既存の枠組みでは検出されなかった（新テストで測定・固定）。

**Owner は 2026-11-05 に案 A を明示承認しました。** canonical ladder 順では BBQ の文字シフトが発生しないため、検証器が本来の canonical-only 用に定義する `B18_BATCH.acceptedLetterShifts` に追加すると `ACCEPTED_LETTER_SHIFT_NOT_OBSERVED` で失敗します。検証器の条件は緩和せず、取得順ごとの承認を `B18_APPROVED_ALTERNATE_ORDER_LETTER_SHIFTS = { "bbq-chicken-pizza": "-->B" }` として宣言し、`expansionBatch18.test.ts` に「bbq-sauce → cilantro順でB、その順序では他の既存文字は動かない」を固定しています。保存への書き込みはありません。

### 安全な代替案
| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 上記のシフトを Owner が明示承認し、`B18_BATCH.acceptedLetterShifts = { "bbq-chicken-pizza": "-->B" }` を宣言 | 先例あり（B12 veggie-supreme → B、B12b spanish-chorizo → B、B15 rendang → B）。実装・テストは完了済みで、承認後すぐ PR 化できる |
| B | cilantro を通常素材にせず、BBQ だけに残す（レシピ 2 品は保留） | 既存データ不変。ただし Owner 判断（昇格）を取り消すことになり、両レシピは別の新素材が要る |
| C | 研究ラベルの規則を変更（post-bake 素材を解禁素材から除外） | 既存全 late レシピのラベル規則を変える。範囲が広く非推奨 |
| D | 別の通常素材をレシピに使う | 原典の「コリアンダー」から外れる |

## 5. 変更ファイル（`src/` 中心、UI・reducer・保存・CSS は変更なし）
データ: `recipes.ts`（+2）/ `ingredients.ts`（cilantro 昇格）/ `lateCatalog.ts`（cilantro 削除・BBQ step・コメント訂正）/ `ingredientTaxonomy.ts` / `toppingSizeClass.ts` / `discoveryLadder.ts`（step 69）/ `discoveryCatalog.ts` / `recipeHintRoles.ts` / `recipeSauceProfiles.ts` / `orders.ts` / `referencePizza.ts`（8 点リング 2 件、cilantro は `LIGHT_LEAF`）。テスト基盤: `recipeBatchManifest.ts`（`B18_BATCH`、BBQ の key を bbq-sauce に）。golden: `hint5.ladders55.json`（**挿入のみ**、+606 / 削除 0）、`hint5.alphaFamilyOnly.json`（新 2 件の追加と late 4 件の値の更新（ikura・yuzu・tahini・tarako））。新規テスト: `expansionBatch18.test.ts`（37）、`persistence.batch18.test.ts`（6）。既存テストの追従は件数 pin・step 番号 +1・昇格に伴う late の期待値の移動・non-credit 一覧への追記のみで、assertion の意味は弱めていない（`discoveryLadder` の「最新 step だけ導出」は先例どおり凍結 prefix を 68 に延長。理由: cilantro は 2 レシピを開くため REC-04 の tie-break で sour-cream より前に並び、凍結済みの step 68 を入れ替えてしまう）。

## 6. 検証（実行した範囲、HEAD = `d85b957` merge 後）
| 項目 | 結果 |
|---|---|
| Vitest 全体（Pinsa ON） | **619 ファイル / 11,514 テスト pass**（skip 13・todo 2 は既存） |
| Vitest 全体（Pinsa OFF、`TETO_PINSA_OFF=1`） | **619 ファイル / 11,506 テスト pass**（skip 12・todo 2 は既存） |
| typecheck / lint / build | `tsc -b` クリーン、`oxlint` は既存警告のみ（本変更のファイル外）、`vite build` 成功 |
| E2E 新規 `e2e/b18.spec.ts`（Chromium 390×844 / 360×800） | **6 / 6 pass**。baingan・reina を Shop NEW → 購入 → Research（漏えいなし）→ ソース PAINT → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑まで通しで実行。横スクロールなし、console error なし、保存 schema v2 |
| E2E 既存関連（`new-bbq` / `b16` / `b17` / `batch13-potato-mayo` / `batch14-moussaka` / `late4`、両 viewport） | **24 / 24 pass**。うち `new-bbq.spec.ts` は昇格による期待値の移動（cilantro がこのセーブでは購入済み・BBQ のラベルがバーベキューソース）を追従。これは §4 の (1) そのもので、承認待ちの内容に含まれる |
| WebKit 390×844 / 360×800 | **未実施**（このコンテナに WebKit が無い。PR の CI で実行） |
| iPhone Safari HV・CI・Codex | 未実施（PR 未作成） |

ローカルの Playwright（1.56.1）が同梱 Chromium と版違いのため、`executablePath` だけを差し替えた一時設定で実行した（設定ファイルは commit していない。テスト・タイムアウト・assertion は変更なし）。

### スクリーンショット（`docs/reports/screenshots/b18/`、Chromium・両 viewport）
- 変更後: cilantro の Shop NEW、Research エントリ（baingan「？？？ピザ B（パクチー）」/ reina「？？？ピザ A（パクチー）」）、ソーストレイ・塗布後、具材トレイ・配置後、NEW RECIPE、図鑑。
- §4 の判断用: `b18-before-bbq-label-floor-order-*`（**変更前 = main**、「？？？ピザ（パクチー）」）と `b18-bbq-label-floor-order-*`（**変更後**、「？？？ピザ B（パクチー）」）、`b18-bbq-label-ladder-order-*`（変更後・ladder 順、「？？？ピザ（バーベキューソース）」）。
- 目視での所見: curry-ketchup の塗りは既存色のまま見えている。長いレシピ名「ベネズエラレイナペピアーダピザ」は 360px の NEW RECIPE 画面でも 1 行に収まる。図鑑の章表示は「第4章 53/53」。

## 7. 安全境界
共有 Preview 更新、Production ON、merge、#738 / #746 / #756 / #757（Steam・DRIZZLE）と食材アイコン作業（#753 ほか）のファイル変更、未承認の調理工程追加は行っていません。floor 66は維持し、Jaccard 0.43の例外はバインガンバルタだけです。CI・Codexと実機 HV は別Gateです。

## 8. Owner 判断（3 件とも 2026-11-05 承認、Issue #748 コメント 6650593172）
| # | 判断事項 | 推奨 | 理由 |
|---|---|---|---|
| 1 | **bbq-chicken-pizza の Research ラベル**: bbq-sauce → cilantro の順で持つ未発見セーブで「？？？ピザ（パクチー）」→「？？？ピザ B（パクチー）」、ladder 順では「？？？ピザ（バーベキューソース）」（§4、画面は §6） | **案 A: 明示承認し `B18_BATCH.acceptedLetterShifts = { "bbq-chicken-pizza": "-->B" }` を宣言** | （訂正 2026-11-05: 「他の既存レシピの文字は動かない」は bbq-sauce → cilantro の 1 順序だけの実測だった。他の順序の影響は §11 で未承認） 保存・採点・在庫は不変で、表示のみ。先例（B12 / B12b / B15）と同じ扱い。B〜D はいずれも Owner 決定（昇格・原典の材料）を覆すか、範囲が広い |
| 2 | **cilantro の解禁タイミング**: floor 66 を残したため、cilantro は従来どおり credited 66 で付与され、baingan / reina も 66 から発見できる（step 69 は ladder 上の key 位置） | **floor 66 を維持（現状のまま）** | 既存セーブの解禁は一切変わらない。floor を外すと (a) 再ロック防止の固定テストを崩し、(b) 新規プレイヤーは bbq-sauce（66）→ cilantro（69）の順で必ず入手するため、判断 1 の文字付与が全員に起きる |
| 3 | **baingan-bharta-pizza の類似度**: rendang-pizza / curry-pizza-japan と Jaccard 0.43（基準 0.4 超え）。原因は curry-ketchup の代用（共通 3 = curry-ketchup・mozzarella・onion） | **このレシピ限りの例外として承認**（B16 ume-shiso の 0.60 例外と同じ扱い。全体の 0.4 基準は変えない） | 同一・部分集合・上位集合は無く、発見判定は一意（テストで固定）。代用ソースを変えると Owner 決定に反する |

## 9. 残る技術・Human Gate（承認後）
1. 判断 1 が案 A なら: `B18_BATCH.acceptedLetterShifts` を宣言し、`expansionBatch18.test.ts` の `PENDING OWNER APPROVAL` テストを承認済みの記述に改める。判断 3 は `expansionBatch18.test.ts` の Jaccard テストと `recipes.ts` のコメントに「B18 限りの例外」と記録する。
2. 最新 main を再度 merge し、Pinsa ON / OFF の全 Vitest・typecheck・lint・build・Chromium E2E を再実行。
3. HV 動画（390×844、Owner へ直接送付・commit しない）を撮影。
4. PR を作成（テンプレート準拠、本 Result Report を同梱、claim の `pr` を記入）。
5. CI（WebKit 全シャード・WebKit Gate を含む）と最新 HEAD の Codex レビューを確認し、指摘に対応。
6. Owner の iPhone Safari HV → merge 判断（merge・共有 Preview・Production は Owner 承認が前提）。

## 10. Owner Decision Log（2026-11-05）

- **OD-B18-1 承認:** Research の取得順が bbq-sauce → cilantro の場合のみ既存 BBQ のラベルに `B` を付ける差分を容認。通常 ladder のコホート検証規約を緩めず、取得順別の承認定数と回帰テストで固定する。
- **OD-B18-2 承認:** `LATE_ENTITLEMENT_FLOORS.cilantro = 66` を維持。新2品の nominal key step 69 と、実際に credited 66 から発見可能という差を明示して維持。
- **OD-B18-3 承認:** `baingan-bharta-pizza` の Jaccard 0.43をこの1レシピに限って許容。全体の0.4閾値・同一/部分集合/上位集合禁止・Researchの規則は維持。
- **OD-B18-4 承認（Issue #748 コメント 6651668675）:** §11.4 の監査範囲 39 件に限り、取得順による Research 表示ラベルの文字変化を許容。正準順での変化 0 件、保存・採点・在庫・entitlement・本番の Research 規則は不変（§11.5）。

承認証跡: https://github.com/perusonao/teto-pizza-game/issues/748#issuecomment-6650593172 。
本記録は原典の独立確認を意味しません。WebKit/HV/Production/merge は別のOwner Gateです。

## 11. Codex P2（PR #759）: 取得順による既存ラベルの変化の全数監査 — **OD-B18-4 で承認済み（2026-11-05、この監査範囲に限る）**

### 11.1 指摘と訂正
Codex（HEAD `c23017a`）の指摘のとおり、OD-B18-1 の前提「BBQ 以外の既存レシピの文字は動かない」は **bbq-sauce → cilantro の 1 順序だけで測った結果**で、他の取得順では成り立たない。前提を報告したのは本セッションで、測定が不十分だった。

### 11.2 方法（`src/logic/catalog/testSupport/researchLabelAudit.ts`、本番の `researchCohortLetters` をそのまま使用）
Batch 18 の前（2 品を除いたカタログ）と後（late を含む全カタログ）を、同じ所持順で比較した。所持順は次のとおり。(1) 既存レシピと新レシピの共有素材ごとに、両者の素材だけを持ち共有素材を最後に入手した順。(2) (1) に他の ladder 素材を 1 つずつ足した順。(3) 全 ladder 素材を持ち共有素材を最後に入手した順。(4) 正準の ladder 順の全 prefix。(5) 固定 seed の乱数順 40 通りの全 prefix。予備測定（乱数順 600 通り）でも、影響を受けるレシピの集合は同じだった。

### 11.3 結果
| 観点 | 結果 |
|---|---|
| 正準の ladder 順 | 既存レシピの文字の変化 **0 件**（全 prefix、late を含む） |
| 非正準の順序 | 既存レシピ **39 件**で文字が変わりうる。うち **24 件**は文字なし → 文字ありに変わりうる |
| 承認済み | `bbq-chicken-pizza` の `-->B`（bbq-sauce → cilantro の順）のみ（OD-B18-1） |
| 保存・採点・在庫 | 変化なし。ラベルは保存されず、所持順から毎回導出される |
| 前例（同じ監査を merge 済みのバッチに適用） | B17 goulash-pizza: 18 件（文字なし→ありは 14）、B16 ume-shiso-pizza: 4 件（4）、B15 nigerian-suya-pizza: 19 件（15）。いずれも正準順の変化は 0 件。Research 2.0 の契約「カタログ改訂で既存 cohort に加わると、その cohort の文字は変わりうる」（`researchEntry.ts`）による性質で、B18 固有ではない |

測定値は `B18_APPROVED_AUDITED_ALTERNATE_ORDER_LETTER_CHANGES`（`recipeBatchManifest.ts`、旧名 `..._PENDING_OWNER`）と `expansionBatch18.test.ts` に固定した。範囲が黙って広がらないようにするための固定で、§11.5 の OD-B18-4 で、この範囲に限り承認された。Codex の 2 例も再現テストで固定した。すべての ladder 素材を持つ状態で、mayo を最後に入手すると `potato-mayo-pizza` が文字なし→B、avocado を最後に入手すると `california-style-pizza` が文字なし→B になる。

### 11.4 影響を受ける既存レシピ（39 件）
| 既存レシピ | 変化しうる条件（最後に入手した共有素材） | 変化の例（変更前→変更後、`-` = 文字なし） | 文字なし→文字あり |
|---|---|---|---|
| `aussie` | たまねぎ | -->A | あり |
| `baba-ganoush-pizza` | ナス | K->L, B->C, C->D ほか | — |
| `bacalhau` | たまねぎ | O->P, B->C, C->D ほか | あり |
| `bbq-chicken-pizza` | チキン / パクチー | A->B, -->A, -->B | あり |
| `brazilian-calabresa` | たまねぎ | G->H, -->B, A->B ほか | あり |
| `california-style-pizza` | トマト | C->D, -->B, A->B ほか | あり |
| `chilean-napolitana` | トマト | B->C, E->F, C->D ほか | あり |
| `curry-pizza-japan` | チキン / カレーケチャップ / たまねぎ | B->C, Q->R, C->D ほか | あり |
| `currywurst` | カレーケチャップ | B->C, -->B, A->B | あり |
| `eggplant-dengaku-pizza` | ナス | D->E, B->C, C->D | — |
| `eggplant-ricotta-pizza` | ナス | I->J, B->C, C->D ほか | — |
| `eggplant-tahini-pizza` | ナス | H->I, B->C, C->D ほか | — |
| `flammkuchen` | たまねぎ | I->J, B->C, -->B ほか | あり |
| `frango-catupiry` | チキン | E->F, -->B, C->D ほか | あり |
| `fugazza` | たまねぎ | -->B, A->B, B->C ほか | あり |
| `goulash-pizza` | たまねぎ | L->M, B->C, C->D | — |
| `jamaican-jerk-chicken-pizza` | チキン | B->C, -->B, A->B | あり |
| `melanzane-pizza` | ナス | -->A | あり |
| `moussaka-style-pizza` | ナス / フロマージュブランソース | G->H, B->C, C->D ほか | あり |
| `parmigiana-pizza` | ナス | B->C, J->K, C->D ほか | — |
| `pesto-caprese` | トマト | -->A | あり |
| `pesto-gamberi` | トマト | B->C | — |
| `pesto-pollo` | チキン / トマト | B->C, F->G, C->D ほか | あり |
| `pesto-tonno` | たまねぎ | F->G, A->B, B->C ほか | — |
| `pesto-trapanese` | トマト | D->E, C->D, B->C | — |
| `pesto-vegetariana` | ナス | E->F, B->C, C->D ほか | — |
| `pizza-feta-eliniki` | トマト | H->I, B->C, C->D ほか | — |
| `pizza-moscow` | たまねぎ | T->U, B->C, C->D ほか | — |
| `pizza-portuguesa` | たまねぎ | H->I, -->B, B->C ほか | あり |
| `polish-kielbasa` | たまねぎ | -->A | あり |
| `potato-mayo-pizza` | マヨネーズ | -->B | あり |
| `rendang-pizza` | カレーケチャップ / たまねぎ | A->B, E->F, B->C ほか | あり |
| `sichuan-eggplant-pizza` | ナス | F->G, B->C, C->D ほか | — |
| `spanish-chorizo-pizza` | たまねぎ | R->S, B->C, -->B ほか | あり |
| `supreme-pizza` | たまねぎ | K->L, A->B, B->C | — |
| `tandoori-paneer-pizza` | カレーケチャップ / たまねぎ | M->N, A->B, C->D ほか | あり |
| `tonno-e-cipolla` | たまねぎ | B->C, N->O, -->B ほか | あり |
| `veggie-supreme-pizza` | トマト / たまねぎ | P->Q, G->H, -->B ほか | あり |
| `wasabi-beef-pizza` | たまねぎ | S->T, B->C, C->D ほか | — |

（変化の例は観測された遷移の先頭 3 件。条件の素材は、指定した順序で最後に入手したときに変化が出たもの）

### 11.5 Owner 判断 OD-B18-4（**2026-11-05 案 A を承認**、Issue #748 コメント 6651668675）
| 案 | 内容 | 影響 |
|---|---|---|
| **A（推奨）** | B18 の非正準順の文字変化（上表 39 件）を、Research 2.0 の契約どおりの挙動として承認する。正準順の検証（変化 0）は従来どおり必須とする | 表示だけの変化で、保存・採点・在庫は変わらない。B15〜B17 で既に起きていた変化と同じ種類。実装は追加不要で、測定範囲はテストで固定済み |
| B | Research の文字の振り方を変える（既存メンバーの文字を保ち、新メンバーを後ろに付ける。既存の単独 cohort は文字なしのまま）。別 Issue で設計・承認し、B18 はそれを待つ | 39 件の変化をなくせる。ただし Research 2.0 の規則（OD-R2-1〜4）の変更で、既存の全セーブの表示規則に関わるため、単独の設計 Gate が要る |
| C | B18 を保留する | 変化は起きない。2 品は追加されない |

推奨は A。理由: 正準順での変化はなく、保存データの意味も変わらない。同じ性質の変化は過去のバッチでも未監査のまま起きていた。B は、今後のバッチ全体の方針として別途検討する価値がある。

**承認内容（Owner 記録の要約）**: §11.4 の 39 件（取得順によって変わりうる既存レシピの和集合で、すべてのセーブで同時に 39 件変わるわけではない）の文字変化を、B18 の監査範囲に限って承認する。承認の対象は導出される Research の表示ラベルだけで、保存・発見済みレシピ・採点・在庫・entitlement（floor 66）・レシピの識別・原典の前提・本番の Research 2.0 規則は変えない。正準 ladder 順での既存ラベルの変化は 0 件を維持する（全 prefix、ordinary / late を含む全カタログ、Pinsa ON / OFF）。範囲は固定で、今後のバッチで新たな既存レシピが影響を受ける場合は、改めて監査と Owner Gate が要る。Research 2.0 の文字を安定させる設計（案 B）は、B18 の要件ではなく、別 Issue で検討する。

反映: 定数を `B18_APPROVED_AUDITED_ALTERNATE_ORDER_LETTER_CHANGES` に改名した（39 件の内容は変更なし）。テストの名称・コメントと e2e の名称を、承認済みの表現に改めた。正準順の検証（変化 0）と、前後比較・正準順の記録の回帰テストはそのまま残している。

**PR #759 は Draft のまま。iPhone Safari HV と Owner の最終 merge 承認まで merge しない。Production ON と共有 Preview の更新も行わない。**
