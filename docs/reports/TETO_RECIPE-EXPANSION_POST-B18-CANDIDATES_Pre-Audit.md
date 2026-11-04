# Recipe Expansion — Batch 18（#748）の次に追加できるレシピ候補の事前監査（docs-only）

基準 `origin/main` = `c69cb2b`（#750、2026-11-04）。Batch 18 の WIP（`origin/claude/teto-pizza-game-content-9ctr2x` = `ce58363`）は **読み取りのみ**で、ブランチ・claim・Issue #748 には何も書いていない。
範囲: 調査と設計のみ。`src/` `e2e/` `PROJECT_HANDOFF.md` は未変更（新規ファイルは本書と `docs/reports/data/` の 2 つだけ）。PR・merge・共有 Preview・Production の変更なし。
UI/UX/gameplay の変更ではない audit-only のため、HV 動画・スクリーンショットは対象外（`PROJECT_HANDOFF.md` 「Audit-only tasks are exempt」）。
**原典 pizzadb.jp には到達できなかった**（`curl https://pizzadb.jp/` → CONNECT 403、過去の `thisSessionsOwnFetchStatus` = `EGRESS_BLOCKED` と同じ）。以下の「原典」はすべて repo 内の 172 証跡行（Owner 中継、2026-09-22、独立再取得なし）であり、**原典は未確認**。

再現: `python3 docs/reports/data/TETO_RECIPE-EXPANSION_POST-B18-CANDIDATES_measure.py.txt`（リポジトリ直下で実行、標準ライブラリのみ、読み取り専用）→ 出力は `docs/reports/data/TETO_RECIPE-EXPANSION_POST-B18-CANDIDATES_MEASUREMENTS.json`。

## 0. 結論

1. **新食材 0・新工程 0 で、識別基準（部分集合・上位集合・1 材料差なし、Jaccard < 0.4）を満たす未実装候補は残っていない。** #748 を除く未実装 82 行のうち、新食材 0 の行は 27 行あるが、工程が足りない 21 行を除いた 6 行（bulgogi / caponata / hokkaido-cheese / philly-cheesesteak / zucchine-menta / tsukimi）はすべて、Owner の HOLD・除外、既存レシピとの部分集合・完全一致、または機序未決のいずれかで外れる（§3）。次の Batch は **新食材 1 種を足す形が最小**。
2. **推奨順（難度は §6 の定義）**

| 順 | 候補 | 新食材 | 難度 | 一言 |
|---|---|---|---|---|
| 1 | `jerusalem-mixed-grill-pizza` エルサレムミックスグリルピザ | `cumin` 1（topping / spice） | **S〜M** | Jaccard 最大 0.33（ソース無し）／0.29（tahini 代用）。部分集合・上位集合・1 材料差なし。Owner 判断は「ソース欄『その他』の読み」が中心 |
| 2 | `frutti-di-mare-pizza` フルッティディマーレ | `squid` 1（topping / seafood） | **M** | ソースは tomato-sauce で曖昧さなし。ただし pescatore と Jaccard **0.50**（0.4 基準超え → 例外承認が要る）。命名クラスタ |
| 3 | `nashville-hot-chicken-pizza` ナッシュビルホットチキンピザ | `honey` 1 | **M〜L** | Jaccard 0.33。ただし「ホットソース」に当たる既存ソースが無く、honey の形（散布か、かけるか）が #579 DRIZZLE と絡む。honey は未実装 5 行が共有 |

   待機（着手を勧めない）: `chicken-tikka`（cilantro cohort を増やす、Jaccard 0.50）、`thai-chicken`（peanut-sauce＋唐辛子の 2 新食材、0.50）、`peking-duck`（証跡は最強だが新食材 3）。
3. **Batch 18 が #748 で止まっている**（bbq-chicken-pizza の Research ラベル変更の Owner 承認待ち）。次 Batch は ladder step・golden・`recipes.ts` を同じく動かす **hot file の直列作業**になるため、B18 の決着前に実装へ入らない（§7）。
4. 経験則の訂正: 「複数ソース（MULTI_SPREAD）は未実装機構」とされてきたが、`grandma-pizza`（tomato-sauce＋olive-oil の 2 ソース）が **main の `recipes.ts` に既にある**。一方 PR #540 は Draft / HOLD のままで、Hint の承認は grandma 限定（OD-544-3）。burrata 系 3 行を再開できるかは Owner の確認事項（§8-8）。

## 1. 事前確認

| 項目 | 結果 |
|---|---|
| CLAUDE.md / PROJECT_HANDOFF | 読了。`PROJECT_HANDOFF.md` は 2026-09-18 付の古い冒頭＋「New-session startup checklist」。最新状態は fresh GitHub と各 Batch の Result を優先（checklist 3） |
| main | `c69cb2b`（#750 cooking-fry F1）。直近のレシピ追加は #743（B17 goulash、通常 step 68） |
| 通常レシピ / late | 80 / 8（`recipes.ts` と `lateCatalog.ts` の `requiredIngredients` を抽出。`pinsa-romana` は late 側に含まれる）。計 88。食材 id 97 |
| #748（B18） | open。baingan-bharta（credited）＋ reina-pepiada（非 credit）＋ cilantro の通常昇格、通常 step 69。claim は `claude/teto-pizza-game-content-9ctr2x`、期限 2026-11-18。files に `recipes.ts` `ingredients.ts` `lateCatalog.ts` `discoveryLadder.ts` `referencePizza.ts` `ingredientTaxonomy.ts` `toppingSizeClass.ts` `__golden__/**` を含む |
| B18 WIP の状態 | 実装・単体検証は完了、**bbq-chicken の Research ラベル変更で停止・PR 未作成**（`TETO_EXPANSION-BATCH-18_Result.md` §4）。案 A（推奨）= `acceptedLetterShifts` を承認 |
| open PR | #751（icons docs）・#747（Steam HV 手順書）・#746（DRIZZLE Lab）・#738（Steam S3）ほか古い docs / HOLD 群。**レシピ・食材データを触る PR は #748 の WIP のみ**。#738 / #746 / #751 / #747 とは本書の新規ファイルが重ならない |
| open Issue | レシピ追加系は #748 のみ。`jerusalem` / `frutti` / `nashville` / `tikka` を扱う Issue・PR は無い（#706 / #707 / #708 / #736 / #741 は出荷済みの Batch。#706 の caponata のみ Owner 除外で未出荷） |
| 既存の同種文書 | `NEXT-BATCH(-2)_Fresh-Audit`・`NEXT-CANDIDATES-3_Reselection`・B12 Result §1（除外リスト）・B18 Design-Audit §12（次の候補）。本書はこれらの**除外理由を再導出せず引用**し、B13〜B18 で状況が変わった点（ソース代用の前例、grandma の出荷、cilantro cohort、honey の共有数）だけを更新する |

## 2. 絞り込み（172 → 候補）

| 段 | 件数 | 方法 |
|---|---|---|
| 172 マトリクス行 | 172 | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（`RUNTIME-SNAPSHOT.json` は 61 レシピ時点で古く**使わない**） |
| 実装済みと照合できた行 | 79 | 行の `canonicalCandidateId` が実装 id と一致、または識別集合が実装レシピと完全一致 |
| 未照合 | 93 | |
| − 出荷済みレシピの PIZZA DB 版（`COMPOSITION_CONFLICT_SHIPPED`） | −9 | capricciosa / quattro-formaggi / margherita / bismarck / breakfast / pesto-genovese / marinara / meat-lovers / fugazza。カタログ id で出荷済み（`recipes.ts` に PIZZA DB 版の別 id は無い） |
| − claim 中（#748） | −2 | baingan-bharta / venezuelan-reina-pepiada |
| **候補** | **82** | |
| うち現行フローで表現可（`requiredCapabilities` 空） | **30** | §3 |
| うち追加機構が要る | 52 | §4 |

実装済み側で行に対応しない 11 件（marinara・quattro-formaggi・genovese・bismarck・funghi・fugazza・napoletana・pizza-bianca・breakfast-pizza・capricciosa・meat-lovers）は、172 マトリクス以前のカタログ由来で、上の 9 件はその PIZZA DB 版。**2026-11-04 の B18 Design-Audit §0 が指摘した「識別集合の完全一致だけで照合すると、ソース欄が未確定の行を見落とす」問題は、`canonicalCandidateId` でも照合して避けた。**

## 3. 現行フローで表現できる 30 行（全件）

新食材は `ingredients.ts` + `lateCatalog.ts` の 97 id に無いマトリクス id の数。未解決トークンは、`relatedIds` が 1 つのものだけそのまま写像（`keema` の ひき肉 → ground-beef など）。Jaccard は 88 実装＋#748 の 2 件（Owner 決定の代用ソース込み）に対する最大値。

| 新 | 行 | 最大 J（最近傍） | 判定・理由 |
|---|---|---|---|
| 0 | bulgogi | 0.60（rendang / suya） | **除外**: Owner HOLD（2026-10-28）。ソース未確定 |
| 0 | caponata | 0.40（palmito）／tomato-sauce 付きなら 0.50（melanzane） | **除外**: #706 で Owner が除外。どの読みでも 0.4 以上。ソース未確定 |
| 0 | tsukimi | 0.60（breakfast / aussie）、1 材料入替が 2 件 | **除外**: DH4 gate 抵触で HOLD（OD-B9-8、gate 緩和禁止） |
| 0 | hokkaido-cheese | 0.80（potato-mayo）、**部分集合** | **除外**: チーズ→mozzarella と読むと potato-mayo-pizza の部分集合 |
| 0 | philly-cheesesteak | **1.00（nigerian-suya と完全一致）** | **除外**: チーズソース→mozzarella と読むと suya と同一集合 |
| 0 | pizza-zucchine-menta | 0.43 | **除外**: 「生」の機序解釈が未決（MECHANIC_INTERPRETATION） |
| 1 | **jerusalem-mixed-grill** | **0.33**（curry-pizza-japan） | **候補 1** |
| 1 | **frutti-di-mare** | 0.50（pescatore） | **候補 2**（例外承認が前提） |
| 1 | **nashville-hot-chicken** | 0.33（pesto-pollo ほか） | **候補 3** |
| 1 | chicken-tikka | 0.50（baingan 予定）／curry 代用 | 待機（§5.4） |
| 1 | nduja | 0.50、1 材料入替が 2 件（salsiccia 系） | 除外: 識別基準抵触、ソース未確定 |
| 1 | peruvian-aji-amarillo | 0.40（palmito） | 除外: 新食材 `aji-amarillo`＋ソース未確定＋基準ちょうど |
| 1 | pizza-asparagi-limone | 0.43 | 除外: 「生」の機序解釈が未決 |
| 1 | pizza-baiana | 0.50 | 除外: 唐辛子が未解決＋基準超え |
| 1 | pizza-chilena | 0.57（portuguesa）、bismarck の上位集合 | 除外: ひき肉未解決＋上位集合 |
| 1 | south-african-boerewors | 0.60（chorizo / kielbasa） | 除外: chutney＋ソース未確定＋基準超え |
| 2 | apple-cinnamon-dessert / buffalo-cauliflower / diavola / keema / mentaiko-mochi / finocchi-salad / speck-e-brie / swedish-kebab / thai-chicken | 0.14〜0.43 | 新食材 2（keema は ひき肉・唐辛子が未解決で、ひき肉を beef とすると rendang / suya の部分集合）。多くはソース未確定か機序未決 |
| 3 | banh-mi / mexican-elote / peking-duck / pizza-cavolo-carote | 0.25 | 新食材 3 |
| 5 | taco-pizza | 0.12 | 新食材 5＋機序未決 |

## 4. 追加機構が要る 52 行（概要）

必要機構の延べ数: DOUGH_VARIANT 26 / MULTI_SPREAD_LAYER 13 / LATE_ADDITION 9 / PAN_BAKE 6 / ENCLOSE 4 / DOUGH_SHAPE_TARGET 4 / PREP_STEP 3 / STEP_ORDER 2 / FRY_COOK 1 / ZONED_PLACEMENT 1 / LAMINATE 1。全行の一覧は JSON の `candidates[]`。

| 機構 | 現状（docs / main の記述。本番での露出は未検証） | 次 Batch での扱い |
|---|---|---|
| MULTI_SPREAD_LAYER（13） | `grandma-pizza` が main の `recipes.ts` にある（2 ソース、`panShape: "square"`）。**PR #540 は Draft / HOLD のまま、Hint の SAUCE rung 全ソース表示の承認は grandma 限定**（OD-544-3）。burrata 系 3 行（burrata-pizza 0.40 / pesto-burrata 0.33 / crudaiola 0.43）は新食材 `burrata` 1 種で 3 レシピ分 | 新工程ではないが **Owner の再開判断が要る**（§8-8）。丸い生地で 2 ソースを出す前例はまだ無い |
| LATE_ADDITION（9） | FINISH＋late catalog は本番 ON（`LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` = true）。液体（honey / buffalo）は #579 DRIZZLE が前提 | hot-honey-pepperoni は DRIZZLE 待ち（かつ pepperoni の上位集合）。black-truffle・teriyaki・eel・natto・nutella・smore も新食材かソース未確定 |
| FRY_COOK（1: pizza-fritta） | #749 F1 は純ロジックのみ（未配線・本番 OFF） | 対象外 |
| DOUGH_VARIANT / PAN_BAKE / DOUGH_SHAPE_TARGET / ENCLOSE / LAMINATE / ZONED / STEP_ORDER / PREP_STEP | Pinsa（生地種別）と grandma（四角パン）以外は未実装。PREP は牛肉炒め（#696）のみ検討中 | 新しい調理法・機構を勝手に足さない制約により対象外 |

## 5. 候補の詳細

### 5.0 共通の測定方法・前提

- 識別集合 = `requiredIngredients` の ingredientId（ソース含む）。完全一致・部分集合・上位集合・1 材料差（対称差 1）・1 材料入替（同数で対称差 2）・Jaccard を **88 実装＋#748 の 2 件**に対して測定。基準は B15〜B18 が使う「全体の Jaccard 0.4」（`expansionBatch17.test.ts` の `>= 0.4` は不合格扱い。例外は B15 / B16 / B18 でレシピ限りに承認された先例あり、最大 0.60）。
- 食材の新規性はマトリクスの id と repo の 97 id の差。別名寄せ（例: walnut と almond）は適用していないため、**新食材数は上限寄り**。
- 個数・焼成窓・説明文・投入時機・ソースの読みはすべて **GAMEPLAY ASSUMPTION**（原典に無い）。確認済み = 「172 証跡行にその材料・ソース欄・出身・生地メモが載っている」ことだけ（中継、corroboration は後述）。
- **gate（DH4 / Hint 5.0 / privacy / Research 文字）は実行していない**（`node_modules` が無く、scratch コピーでの実測は実装時の作業）。影響欄は B16〜B18 の実測値からの**推定**で、実測ではないと明記する。

### 5.1 候補 1: `jerusalem-mixed-grill-pizza`（エルサレムミックスグリルピザ）

**原典で確認済み（172 証跡行 `jerusalem-mixed-grill-pizza-pizzadb-p1`、比較表 p1、corroboration **0**、`comparison_table_sample`）**: 出身 イスラエル / エルサレム、生地「薄め」、食材 鶏肉 / 玉ねぎ / クミン / パセリ、ソース欄「その他」。個別ページは**未取得**。
**暫定（GAMEPLAY ASSUMPTION）**: 個数、焼成窓、全材料を焼成前、チーズなし、ソースの読み、`cumin` の色・字形・サイズ・family、説明文、名前。

| 項目 | 内容 |
|---|---|
| 仕様案 | chicken 3 / onion 2 / cumin 2 / parsley 1（非ソース 8 ピース＝8 スロット）＋ソース 1（読みは Owner 決定）。bake 58–78、`lunchRush:false`、CUT なし、key-free Hint、credited |
| 新食材 | `cumin` 1。topping（scatter）、family `spice`（paprika-powder / mayo / cinnamon と同じ。`other` は使わない = OD-DH4-2-9 に触れない）、size は `s` 想定、専用 SVG（paprika-powder-pile の文法を流用、Icons 2.0 の style-lock に従う） |
| 測定（ソース無し） | `{chicken, cumin, onion, parsley}`: 完全一致 0／部分集合 0／上位集合 0／1 材料差 0／1 入替 0。最近傍 curry-pizza-japan **0.33**、bbq-chicken 0.29、fugazza 0.17 |
| 測定（tahini 代用） | `{chicken, cumin, onion, parsley, tahini}`: 同 0。最近傍 eggplant-tahini **0.29**、curry-pizza-japan 0.29 |
| 測定（mozzarella を足す＝原典に無い） | 最近傍 curry-pizza-japan **0.43**（基準超え）→ **足さない** |
| 重大な注意 | **ソース無し＋チーズ無しだと、現行 88 レシピに前例が無い**（measure で確認: sauce 0 のレシピ 22 件はすべてチーズ有り、チーズ無しのレシピ 15 件〔marinara・vongole・goulash・flammkuchen ほか〕はすべてソース有り。ソースもチーズも無いレシピは 0 件）。NO_SAUCE 例外（potato-mayo・suya に続く 3 件目）にしても、「ソースもチーズも無い」流れのエンジン・Hint 5.0 の分類（チーズ無し = sauce のみ分類、B17 §2）が通るかは**未検証**。実装前に scratch 検証が必須 |
| 推奨するソースの読み | **(a) tahini 代用**（既存の PAINT、中東の連想、新ソース 0。B16 梅肉・B17 sour-cream・B18 curry-ketchup と同型の「レシピ限りの代用」）。(b) NO_SAUCE は上の理由で非推奨。(c) 保留も可 |
| ladder | 通常の次 step（B18 が先に入れば **70**、credited、T4、星ゲートなし、key = `jerusalem-mixed-grill-pizza`）。1–69 は凍結。late の導出番号は +1（B18 後の 70–76 → 71–77）、`LATE_ENTITLEMENT_FLOORS` は不変 |
| Research | 新 step の唯一の新材料が cumin → 単独 cohort・文字なし `？？？ピザ（クミン）` の見込み（B16 / B17 と同型）。**ただし B18 が示したとおり、文字は「所持順で最後に入手した有限素材」で決まり、ladder 順の検査だけでは不十分**。cumin は他の未実装行にも使われない（マトリクス内で 1 行のみ）ので、cumin 最後の順序では衝突しないが、parsley / chicken / onion が最後の順序での既存レシピの文字の動きは**実測が要る**（全 prefix＋ランダム購入順＋entitlement floor 順） |
| Hint 5.0 | key-free 母集団 +1。tahini 代用なら sauce のみ分類で `hint5.ladders55.json` は挿入のみ（B17: +202 行・削除 0 と同型の見込み）、`alphaFamilyOnly` は +1 行の見込み |
| DH4 | 新 family は作らない（spice）。`other` 禁止の gate に触れない見込み。実測要 |
| 解禁順 | 他レシピの解禁を取り上げない（ledger は union）。cumin は step 70 でのみ解禁（floor なし） |
| 難度 | **S〜M**: 新食材 1（SVG 1）、新工程 0、Jaccard 例外 0。Owner 決定が通れば B17 とほぼ同規模 |

### 5.2 候補 2: `frutti-di-mare-pizza`（フルッティディマーレ）

**確認済み（172 証跡行 `frutti-di-mare-pizzadb-p11`、比較表 p11、corroboration 0）**: イタリア各地、ナポリピッツァ生地、食材 エビ / イカ / ムール貝 / アサリ。ソース欄「トマトソース」（マトリクスは `family_derived`＝食材欄に tomato-sauce は無く、ソース欄から導出）。
**暫定**: 個数・窓・全て焼成前・チーズなし（食材欄に無い。vongole 前例）・`squid` の見た目・名前。

| 項目 | 内容 |
|---|---|
| 仕様案 | tomato-sauce 1 / shrimp 2 / squid 2 / clam 2 / mussel 2（非ソース 8）。bake 58–78、credited |
| 新食材 | `squid` 1（seafood、専用 SVG＝輪切りのイカの形。shrimp-curl / clam-valve と取り違えない形） |
| 測定 | `{clam, mussel, shrimp, squid, tomato-sauce}`: 完全一致 0／部分集合 0／上位集合 0／1 材料差 0。最近傍 **pescatore 0.50**（tomato-sauce・clam・mussel・shrimp を共有、pescatore は garlic・parsley、本候補は squid）、次点 0.14 |
| ブロッカー | マトリクスの `COMPOSITION_CONFLICT_CANDIDATE`（pescatore と命名クラスタ）。B12 Result は「frutti-di-mare は pescatore と命名クラスタ、識別が難しい」として除外済み。**0.4 基準を満たさない**ため、B16（0.60）と同様の「このレシピ限りの例外」承認が要る |
| 周辺 | 蒸し実験（#726 / #738、あさり・ムール貝、本番 OFF）が将来有効になると、clam＋mussel を使うレシピの HV 面が増える。今は Preview/DEV 限定で干渉しない |
| ladder / Research | 次 step の唯一の新材料 squid → 単独 cohort・`？？？ピザ（イカ）` の見込み。shared 素材（clam / mussel / shrimp）の既存 cohort への影響は実測要 |
| 難度 | **M**: 新食材 1、新工程 0、ソース曖昧さ 0、ただし Jaccard 例外承認と識別（見た目・名前）に手間 |

### 5.3 候補 3: `nashville-hot-chicken-pizza`（ナッシュビルホットチキンピザ）

**確認済み（172 証跡行 `nashville-hot-chicken-pizza-pizzadb-p6`、比較表 p6、corroboration 0）**: アメリカ / ナッシュビル、生地「薄めの生地」、食材 チキン / ピクルス / モッツァレラ / 蜂蜜、ソース欄「ホットソース」（種類不明＝`BASE_SAUCE_UNSPECIFIED`）。
**暫定**: 全て、特に **honey の形**（散布のなぞり置き＝mayo 型／ソース PAINT／焼成後のかけ＝DRIZZLE）、ホットソースの読み、個数。

| 項目 | 内容 |
|---|---|
| 測定（honey = topping、NO_SAUCE） | `{chicken, honey, mozzarella, pickles}`: 全て 0。最近傍 **0.33**（pesto-pollo / jamaican-jerk / frango-catupiry） |
| ブロッカー | (1) 「ホットソース」に当たる既存ソースが**無い**（doubanjiang・curry-ketchup は別物）。代用不能 → NO_SAUCE のレシピ限り例外（potato-mayo・suya に続く 3 件目）か、新ソース（新食材 2）。(2) honey の形が #579 DRIZZLE（焼成後の液体）と絡む。散布で出すと、後で DRIZZLE が入ったとき意味が変わる。(3) honey の色は curry-ketchup `#d9892b`（ΔE 要測定）と近くなりやすい |
| honey の共有 | 未実装 5 行（nashville / nduja / pesto-noci / hot-honey-pepperoni / feteer）が共有。nduja は salsiccia 系と 0.50・1 入替、hot-honey-pepperoni は **pepperoni の上位集合（0.75、1 材料差）**で、現行基準では出せない。実際に出せるのは nashville と pesto-noci（honey＋walnut＋gorgonzola＋pesto、最大 0.17、walnut も新食材） |
| Research | honey が複数レシピの共有素材になるため、後続で cohort 文字が付く（先行レシピが文字を取る可能性＝`acceptedLetterShifts`）。B18 の cilantro と同型の将来コスト |
| 難度 | **M〜L**: 新食材 1 だが Owner 決定が 3 つ（ソース読み・honey の形・色） |

### 5.4 待機候補

| 候補 | 理由 |
|---|---|
| chicken-tikka（新食材 `chicken-tikka`） | ソース欄「カレー」は curry-ketchup 代用で足りる。ただし (1) cilantro を使う → **B18 で cilantro cohort が 3 件（reina / bbq / baingan）になり、4 件目を足す**。B18 の文字変更の承認後でないと測れない。(2) Jaccard 0.50（baingan 予定）。(3) `chicken` に寄せると curry-pizza-japan の上位集合（0.67）になるため別食材が必須だが、`chicken` との区別が遊び上ややこしい（PREPARED_COMPOSITE 要確認） |
| thai-chicken | peanut-sauce（新ソース）＋赤唐辛子（未解決）の 2 つ、かつ cilantro cohort、bbq-chicken と 0.50 |
| peking-duck | 個別ページ証跡（`individual_profile_page`、唯一）で `READY_WITH_REVIEW`・ブロッカー 0・最大 0.25 と**最も安全**だが、新食材 3（`peking-duck`・`cucumber`・`sweet-bean-sauce`）で step の材料 3 種。cuban-pizza（B10 の 3 材料 step）規模の大型 Batch |

## 6. 難度の定義と全体比較

難度 = S（新食材 0〜1・工程 0・例外 0）／M（新食材 1・例外または Owner 決定 1〜2）／L（新食材 2 以上、または Owner 決定 3 以上、または既存機構の再解釈）。

| 候補 | 新食材 | 新ソース | 例外承認 | Owner 決定 | 最大 J | 部分/上位/1 差 | B18 依存 | 難度 |
|---|---|---|---|---|---|---|---|---|
| jerusalem（tahini 代用） | 1 | 0 | 0 | 1（読み） | 0.29 | なし | step 番号のみ | S〜M |
| frutti-di-mare | 1 | 0 | 1（0.50） | 1 | 0.50 | なし | step 番号のみ | M |
| nashville | 1 | 0〜1 | 0〜1 | 3 | 0.33 | なし | step 番号のみ | M〜L |
| chicken-tikka | 1 | 0 | 1（0.50） | 2 | 0.50 | なし | **cilantro cohort** | M〜L |
| peking-duck | 3 | 1 | 0 | 2 | 0.25 | なし | step 番号のみ | L |

## 7. B18 との順序・衝突

- B19 以降の候補は **`discoveryLadder.ts`・`recipes.ts`・`ingredients.ts`・`__golden__/**`・`catalogLedger` 系の件数 pin** を B18 と共有する。B18 の claim（2026-11-18 まで）と重なるため、**B18 の merge 後に着手**するか、B18 が止まる場合は Owner が順序を決める。
- step 番号: B18 → 69（cilantro）、次 Batch → 70。先に出すと B18 の step 69 と衝突して**B18 側の pin を書き換える**ことになる。
- B18 の判断（案 A の承認／B 取り下げ）次第で、cilantro が ordinary か late かが変わり、cilantro を使う chicken-tikka / thai-chicken の前提が変わる。**jerusalem・frutti・nashville は cilantro を使わないので B18 の結論に影響されない**（step 番号の割当のみ）。
- 検出の盲点（B18 の発見）: 既存の検証器は ladder 順しか測らないため、**所持順（entitlement floor が付与する順）での Research 文字の動き**を新レシピごとに実測する必要がある。本書の「文字なし」見込みは推定。

## 8. Owner が判断すべき事項

1. **次 Batch の第一候補**を jerusalem にするか（本書の推奨）。B18 の決着（案 A）を先にするか。
2. **jerusalem のソース欄「その他」の読み**: (a) tahini 代用（推奨）／(b) NO_SAUCE（ソース無し＋チーズ無しの前例が無く、エンジン検証が必要。3 件目の NO_SAUCE 例外）／(c) 保留。レシピ限りの決定であること（一般則にしない）。
3. **`cumin` の新規追加**（topping・family `spice`・size `s`・専用 SVG・色・絵文字の重複回避 G18）を許可するか。
4. **frutti-di-mare**: Jaccard 0.50（pescatore）の例外を、B16（0.60）の先例にならってレシピ限りで承認するか。`squid` の追加可否。
5. **nashville / honey**: ホットソースの読み（NO_SAUCE 例外か新ソースか）、honey の形（散布＝mayo 型か、DRIZZLE 待ちか）。honey を入れる時点で、後続（pesto-noci ほか）の cohort 文字コストを許容するか。
6. **原典確認**: 候補の個別ページ（jerusalem・frutti・nashville）を Owner が共有するか、`pizzadb.jp` をこの環境のネットワーク許可に追加するか。現状は全て「比較表の 1 行（中継）」のみで、投入時機（焼成前か後か）も未確認。
7. **cilantro 系（chicken-tikka・thai-chicken）は B18 の cohort 判断が済むまで着手しない**方針でよいか。
8. **grandma-pizza の状態確認**: main の `recipes.ts` に存在するが PR #540 は Draft / HOLD。本番に出ているか、burrata 系（新食材 `burrata` 1 種で 3 行）を再開するなら Hint 承認（OD-544-3）の範囲を広げるか。
9. peking-duck を「新食材 3 の大型 Batch」として将来許可するか（証跡は最強）。

## 9. 限界・未実施

- gate（DH4 / Hint 5.0 / privacy / matcher）と Research 文字は**未実行**。実装前の scratch 測定（B17 と同じ使い捨てコピー）が必要。
- 抽出は正規表現で、TS の型解釈はしていない。通常レシピ 80＋late 8＝88 は B18 Design-Audit（80＋7 late）と late の数え方が 1 違う（`pinsa-romana` を含めた）。
- 新食材数は別名寄せなし。未解決トークンの写像は `relatedIds` が 1 つのときのみ。
- 候補の仕様案（個数・窓）は設計の目安で、Owner 承認前の確定ではない。
- 原典 pizzadb.jp は到達不可（403）。確認済みと書いたものは「repo 内の証跡行にある」の意味であり、サイトでの再確認ではない。

## 10. 実施しなかったこと

`src/`・`e2e/`・`PROJECT_HANDOFF.md`・golden の変更、レシピ・食材・ソースのランタイム追加、新しい調理法の追加、#748 のブランチ・claim・Issue の変更、PR 作成、merge、共有 Preview 更新、Production 変更、HV 動画・スクリーンショット（audit-only のため対象外）、pizzadb.jp の取得。
