# TETO POOL-REJUDGE 87 — 「未実装 87 品」の再判定（#780、docs-only）

2026-11-07、基準 `origin/main` = `06cfc066`（#778 取り込み後。監査は `5eade46e` で実施し、`06cfc066` で再実行して行別の結果が**完全一致**することを確認【実測】）。変更は `docs/reports/TETO_POOL-REJUDGE_87_Result.md`・`docs/reports/TETO_DOUGH-KIND_PD1BC_Design-Impact.md`・`docs/reports/data/TETO_POOL-REJUDGE_87_{rows.json,script.py.txt}` の新規 4 ファイルのみ。`src/`・`e2e/`・既存 docs・#772 の成果物と claim には触れていない。再現: `python3 -I docs/reports/data/TETO_POOL-REJUDGE_87_script.py.txt . docs/reports/data/TETO_POOL-REJUDGE_87_rows.json`（標準ライブラリのみ。`.txt` なのは CI の拡張子分類を避けるため）。

凡例: 【実測】コード／データから機械的に確認、【推論】実測からの解釈、【未確認】この環境では確かめていない。**Owner 決定ではなく助言**。

## 0. 結論（先に）

1. **「87」は再構成できた**（母集団としては）: `172 設計行 − 出荷済みレシピに紐づく 85 行 = 87 行`【実測】。90 品の出荷済みのうち 85 品が 172 行のどれかに紐づき、5 品（funghi・napoletana・pepperoni・pizza-bianca・salsiccia）は行を持たない。#780 の「PIZZA DB 版 9 行は別途 Owner 判断」は、85 行のうち出荷済みと構成が食い違う 9 行（`COMPOSITION_CONFLICT_SHIPPED`）が**出荷済み側として数えられている**ことと整合する【実測＋推論】。
2. **「Wave A 46 / B 26 / C 15」と「判断不要 9 品」は再現できず UNVERIFIED**。repo（main・#772 ブランチ・#773 の 2 ブランチ）と #772・#773・#577・#780 のコメントに定義も ID も無い。9 件を作らず、6 件などへの置換もしていない（§2）。
3. **87 品に「Owner 判断不要で今すぐ実装可（FULL）」は 0 件**【実測】（静的ゲート）。内訳は §3。これは #772 S2 の「既存食材だけで足せるレシピはほぼ残っていない」と矛盾しない（S2 は 39 行、本書は 87 行全体を同じ方法で見直した）。
4. 87 とは別に、**Sept の Phase-2「証拠が揃った 87 行」（`EVIDENCE_READY_TARGET`）という同じ数の別集合**がある。こちらは今 **61 行が出荷済み、26 行が未出荷**【実測】。#780 の 87 をこちらだと読むと、61 行を二重に未実装と数えることになる。数が偶然一致しているので注意。
5. 古いスナップショット `TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json`（`e0397ae`）は出荷済みを 49 行しか認識しておらず、**36 行を未実装と数えている**【実測】（late catalog の 8 品と、その後の B8〜B18 を含まない）。

## 1. 87 の出所 — 定義ごとの数値【実測】

| 定義 | 数 | 本書の判定 |
|---|---|---|
| A: 172 − 出荷済みに紐づく行（85） | **87** | **採用**。#780 の「本番 90 品／172 行／87」と整合 |
| B: Phase-2（Sept、#190）`EVIDENCE_READY_TARGET`（= matrix の READY 67 + READY_WITH_REVIEW 19 + ALREADY_SHIPPED 1） | 87 | 別集合。うち出荷済み 61、未出荷 26。A と重なるのは未出荷の 26 行のみ |
| C: 172 − 本番レシピ数 90 | 82 | 不採用。行を持たない出荷済み 5 品を引いてしまう |
| D: 出荷済みと構成が食い違う 9 行を未実装に戻した場合 | 96 | 参考（#780 の「別途 Owner 判断」の 9 行） |
| E: 古い POST-W1 JSON の `runtimeRecipeId == null` | 123（= 172 − 49） | 不採用（古い） |

- **ID 単位の根拠**: 除外した 85 行は `rows.json` の `summary.linksDetail`（evidenceId → 出荷済みレシピ id と規則）、残る 87 行は `rows`。入力の出典は `origin/main` `06cfc066` の `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行）、`src/data/{recipes,lateCatalog,discoveryCatalog,ingredients}.ts`（出荷済み 90 品・97 食材・target id）、`docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`（Sept の 87）。
- 紐づけの規則（`script.py.txt`）: L1 = `RECIPE_DISCOVERY_TARGET_IDS`／`LATE_DISCOVERY_TARGET_IDS` の target id が evidenceId と一致（74 行）、L2 = Phase-2 の `shippedRecipesCountedAsEvidenceRow`（1 行）、L3 = matrix の `canonicalCandidateId`／`correspondsToExistingCatalogId`（10 行。margherita・marinara・fugazza・bismarck・capricciosa・quattro-formaggi・meat-lovers・breakfast-pizza・genovese・pinsa-romana）。1 レシピに 2 行が紐づくことは無い【実測】。二重計上は無い（紐づいた 85 行は 87 の外）。
- 87 行の内訳: Phase-2 の READY 側 26 行（matrix 状態 READY 14 + READY_WITH_REVIEW 12）、`BLOCKED_PRODUCT_DECISION` 61 行。
- 本番の食材数 97（`catalogLedger.test.ts` の `ingredients: 97` と一致）、レシピ 90（通常 82 + late 8、`PINSA_PRODUCTION`／`LATE_CATALOG_PRODUCTION` は共に true）【実測】。

## 2. Wave A/B/C と「判断不要 9 品」について — **UNVERIFIED**（Owner 追記 2026-11-07 6691497411 に従う）

- **Wave A 46／B 26／C 15、「判断不要 9 品」「判断待ち 37 品」は、repo と GitHub のどこからも再現できなかった（UNVERIFIED）。9 件の ID は本書では作らない。** 本書の分類を「承認済みの実行可能バッチ」と読まないこと。
- 出所の手がかりは #780 本文の文面だけ（A 46 = 9 + 37 と読める【推論】）。定義・ID 一覧・元の表の commit／path は見つかっていない。足りない出所情報: Wave の定義、9 件の ID、Wave 別の件数の算出元。
- 参考（置き換えではない）: 本書の静的ゲートで「matrix が READY／READY_WITH_REVIEW かつ重複ゲートを通る」行は 8 行（piadina・pizza-fritta・poutine・burrata-pizza・pesto-noci・pesto-burrata・peking-duck・manakish）。crudaiola は Batch 19 Prep の D2 で Owner が Jaccard 例外を承認済みで、足すと 9 になるが、**これは偶然の件数一致の可能性があり、Owner の 9 とは別物かもしれない。Batch 19（#774）は既に Owner GO と別の T1 claim があり、この集合に依存させない**。
- 87 の母集団そのものは ID 単位で再現できている（§1）。ただし「Owner が 87 をこの定義で数えたか」は未確認。

## 3. 分類件数表（87 行、実装済みと二重計上なし）【実測・静的】

分類の順序は **Owner 判断 > 工程依存 > 新食材数**。「Owner 判断待ち」は、matrix のブロッカー、静的重複ゲート（同一／部分集合／上位集合、または Jaccard > 0.4。Batch 19 Audit §4）、レビュー項目（出典不一致・調理済み複合食材）のいずれかがある行。

| 区分 | 件数 | うち Sept の READY 側（26） | うち BLOCKED 側（61） |
|---|---|---|---|
| FULL（Owner 判断不要で今すぐ実装可） | **0** | 0 | 0 |
| 新食材 1 つで可 | **2** | 2（burrata-pizza・pesto-burrata） | 0 |
| 新食材 2 つ以上 | **1** | 1（pesto-noci: honey・walnut） | 0 |
| 工程依存 | **3** | 3（piadina・pizza-fritta・poutine） | 0 |
| Owner 判断待ち | **81** | 20 | 61 |
| 計 | 87 | 26 | 61 |

**Owner 判断が「通った場合に残るもの」**（`afterDecisionClass`。ブロッカーと重複を無視した下限）:

| 判断後の区分 | 件数 |
|---|---|
| FULL | 11（うち 9 行は未解決食材／ソース未特定のため、判断後に新食材が増えうる【未確認】） |
| 新食材 1 つ | 15 |
| 新食材 2 つ以上 | 18 |
| 工程依存 | 43 |

**Owner 判断待ち 81 行の主因**（1 行 1 因）: ソース未特定 21、構成が別の候補と衝突 13、`MECHANIC_INTERPRETATION` 11、未解決食材 11、上位集合 5、Jaccard > 0.4 の例外 6、同一集合で生地軸だけ違う 5、部分集合 2、証拠欠落 2、範囲の問い 2、発見規則の衝突 1、レビュー項目（調理済み複合食材 1・出典不一致 1）。

**実質の見立て【推論】:**
- crudaiola は Jaccard 0.429 で本書の静的ゲートでは「例外要」だが、**Batch 19 Prep の D2 で Owner が例外を承認済み**。よって burrata 系 3 品（pesto-burrata・crudaiola・burrata-pizza）は「新食材 1（burrata）」で、#774（Batch 19）の GO と前提（#748 claim 解放・ハーブ配線 merge）待ち。burrata-pizza は crudaiola の 5 件目の近傍で別判断（S2 §2）。
- pesto-noci（honey + walnut）は B20-A の仕様どおり新食材 2・レシピ 1。walnut の SVG は #777 で未配線。
- 工程依存 3 行の依存先は §5。

## 4. 行別一覧

列: 判定＝§3 の区分、判断後＝Owner 判断が通った後の区分、未対応工程＝本番で未出荷／ゲート OFF の工程（`(2層)`は出荷済みの 2 層ソース機構で足りる印）、新食材＝本番 97 種に無い id、最大 Jaccard＝出荷済み 90 品との最大値（静的近似）。全項目（identity set、出典状態、ブロッカー型など）は `docs/reports/data/TETO_POOL-REJUDGE_87_rows.json`。

### 4.1 Sept の READY 側でまだ未出荷の 26 行
| evidenceId | 判定 | 判断後 | 未対応工程 | 新食材 | 最大Jaccard（出荷済み） | 重複ゲート | Owner判断の主因 |
|---|---|---|---|---|---|---|---|
| `quattro-stagioni-pizzadb` | Owner判断待ち | 工程 | ZONED | 0 | 0.714 capricciosa | 上位集合禁止 | SUPERSET_OF_SHIPPED_FORBIDDEN |
| `sfincione-pizzadb` | Owner判断待ち | FULL | -(2層) | 0 | 0.6 fugazza | 上位集合禁止 | SUPERSET_OF_SHIPPED_FORBIDDEN |
| `trenton-tomato-pie-pizzadb` | Owner判断待ち | 工程 | STEP_ORDER | 0 | 0.667 salsiccia | 部分集合禁止 | SUBSET_OF_SHIPPED_FORBIDDEN |
| `ny-style-pizzadb` | Owner判断待ち | 工程 | DOUGH | 0 | 0.667 salsiccia | 部分集合禁止 | SUBSET_OF_SHIPPED_FORBIDDEN |
| `fugazzeta-rellena` | Owner判断待ち | 工程 | DOUGH,ENCLOSE | 0 | 0.429 pizza-portuguesa | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
| `scacciata-ragusana-pizzadb-p4` | Owner判断待ち | 工程 | ENCLOSE | caciocavallo | 0.5 salsiccia | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
| `argentine-napolitana-pizzadb-p1` | Owner判断待ち | 工程 | DOUGH | 0 | 0.6 chilean-napolitana | 上位集合禁止 | SUPERSET_OF_SHIPPED_FORBIDDEN |
| `cauliflower-crust-pizza-pizzadb-p2` | Owner判断待ち | 工程 | DOUGH | 0 | 1.0 margherita | 同一集合(軸差) | IDENTICAL_SET_AXIS_SEPARATED |
| `chicago-stuffed-pizza-pizzadb-p3` | Owner判断待ち | 工程 | DOUGH,ENCLOSE | 0 | 1.0 salsiccia | 同一集合(軸差) | IDENTICAL_SET_AXIS_SEPARATED |
| `new-england-bar-pizza-pizzadb-p6` | Owner判断待ち | 工程 | DOUGH,PAN | 0 | 1.0 pepperoni | 同一集合(軸差) | IDENTICAL_SET_AXIS_SEPARATED |
| `piadina-romagnola-pizzadb-p7` | 工程依存 | 工程 | DOUGH | 0 | 0.4 rucola-e-grana | NONE |  |
| `pizza-salad-pizzadb-p7` | Owner判断待ち | 新2+ | -(2層) | cucumber,lettuce,yogurt-sauce | 0.429 bambino | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
| `pizza-alla-crudaiola-pizzadb-p8` | Owner判断待ち | 新1 | -(2層) | burrata | 0.429 pinsa-romana | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
| `pizza-al-taglio-romana-pizzadb-p9` | Owner判断待ち | 工程 | DOUGH,PAN,SHAPE | 0 | 1.0 margherita | 同一集合(軸差) | IDENTICAL_SET_AXIS_SEPARATED |
| `pizza-fritta-pizzadb-p9` | 工程依存 | 工程 | FRY | 0 | 0.4 salsiccia | NONE |  |
| `fathead-pizza-keto-pizzadb-p9` | Owner判断待ち | 工程 | DOUGH | 0 | 1.0 pepperoni | 同一集合(軸差) | IDENTICAL_SET_AXIS_SEPARATED |
| `poutine-pizza-pizzadb-p10` | 工程依存 | 工程 | DOUGH | cheese-curd,french-fries,gravy-sauce | 0.167 salsiccia-e-friarielli | NONE |  |
| `burrata-pizza-pizzadb-p10` | 新食材1 | 新1 | -(2層) | burrata | 0.4 margherita | NONE |  |
| `pesto-noci-pizzadb-p12` | 新食材2+ | 新2+ | -(2層) | honey,walnut | 0.167 genovese | NONE |  |
| `pesto-burrata-pizzadb-p12` | 新食材1 | 新1 | -(2層) | burrata | 0.333 pesto-trapanese | NONE |  |
| `hot-honey-pepperoni-pizzadb-p12` | Owner判断待ち | 新1 | -(2層) | honey | 0.75 pepperoni | 上位集合禁止 | SUPERSET_OF_SHIPPED_FORBIDDEN |
| `peking-duck-pizza` | Owner判断待ち | 新2+ | - | cucumber,peking-duck,sweet-bean-sauce | 0.25 sichuan-eggplant-pizza | NONE | review:PREPARED_COMPOSITE_INGREDIENT |
| `manakish` | Owner判断待ち | 工程 | DOUGH | halloumi,zaatar | 0.25 pizza-bianca | NONE | review:SOURCE_INCONSISTENCY |
| `yakiniku-pizza` | Owner判断待ち | 工程 | PREP | yakiniku-sauce | 0.5 rendang-pizza | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
| `montreal-style-pizza-pizzadb-p13` | Owner判断待ち | 工程 | DOUGH,PAN | 0 | 0.75 pepperoni | 上位集合禁止 | SUPERSET_OF_SHIPPED_FORBIDDEN |
| `tsukimi-pizza-pizzadb-p14` | Owner判断待ち | FULL | - | 0 | 0.6 breakfast-pizza | J>0.4 | JACCARD_OVER_0.4_EXCEPTION |
### 4.2 BLOCKED 側の 61 行（すべて Owner 判断待ち）
| evidenceId | 判定 | 判断後 | 未対応工程 | 新食材 | 最大Jaccard（出荷済み） | 重複ゲート | Owner判断の主因 |
|---|---|---|---|---|---|---|---|
| `apple-cinnamon-dessert-pizzadb` | Owner判断待ち | 新2+ | - | apple,walnut | 0.143 pesto-salmone | NONE | BASE_SAUCE_UNSPECIFIED |
| `calzone-pizzadb` | Owner判断待ち | 工程 | ENCLOSE | 0 | 0.5 calabresa-argentina | J>0.4 | COMPOSITION_CONFLICT_CANDIDATE |
| `greek-style-pizzadb` | Owner判断待ち | 工程 | DOUGH,PAN | 0 | 0.5 calabresa-argentina | J>0.4 | COMPOSITION_CONFLICT_CANDIDATE |
| `chicago-deep-dish-pizzadb` | Owner判断待ち | 工程 | STEP_ORDER,PAN | 0 | 0.75 salsiccia | 部分集合禁止 | COMPOSITION_CONFLICT_CANDIDATE |
| `siciliana-pizzadb` | Owner判断待ち | 工程 | DOUGH,PAN,SHAPE | 0 | 0.6 tonno-e-cipolla | J>0.4 | COMPOSITION_CONFLICT_CANDIDATE |
| `taco-pizza-pizzadb` | Owner判断待ち | 新2+ | - | cheddar,ground-beef,lettuce,salsa,tortilla-chips | 0.125 chilean-napolitana | NONE | MECHANIC_INTERPRETATION |
| `buffalo-chicken-pizzadb` | Owner判断待ち | 新2+ | -(2層) | blue-cheese-dressing,buffalo-sauce | 0.333 pesto-pollo | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `pizza-baiana` | Owner判断待ち | FULL | - | 0 | 0.6 spanish-chorizo-pizza | J>0.4 | UNRESOLVED_INGREDIENT |
| `pizza-a-caballo` | Owner判断待ち | 工程 | DOUGH,ENCLOSE | 0 | 0.6 calabresa-argentina | 部分集合禁止 | EVIDENCE_GAP |
| `pizza-de-cancha` | Owner判断待ち | 工程 | DOUGH(2層) | 0 | 0.5 marinara | J>0.4 | UNRESOLVED_INGREDIENT |
| `swedish-kebab-pizza-pizzadb-p4` | Owner判断待ち | 新2+ | - | kebab-sauce,lettuce | 0.2 salsiccia-e-friarielli | NONE | BASE_SAUCE_UNSPECIFIED |
| `speck-e-brie-pizzadb-p4` | Owner判断待ち | 新2+ | - | brie,walnut | 0.333 prosciutto-funghi | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `smore-dessert-pizza-pizzadb-p4` | Owner判断待ち | 新2+ | - | chocolate,graham-cracker,marshmallow | 0.0 yuzu-shrimp-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `st-louis-style-pizza-pizzadb-p4` | Owner判断待ち | 工程 | DOUGH | 0 | 0.333 pepperoni | 部分集合禁止 | UNRESOLVED_INGREDIENT |
| `thai-chicken-pizza-pizzadb-p4` | Owner判断待ち | 新1 | - | peanut-sauce | 0.5 bbq-chicken-pizza | J>0.4 | UNRESOLVED_INGREDIENT |
| `eel-pizza-pizzadb-p1` | Owner判断待ち | 工程 | LATE-mid | eel,sansho-pepper | 0.286 sichuan-eggplant-pizza | NONE | MECHANIC_INTERPRETATION |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | Owner判断待ち | 新1 | - | cumin | 0.333 curry-pizza-japan | NONE | BASE_SAUCE_UNSPECIFIED |
| `old-forge-style-pizza-pizzadb-p1` | Owner判断待ち | 工程 | DOUGH,PAN,SHAPE | 0 | 0.333 fugazza | 部分集合禁止 | UNRESOLVED_INGREDIENT |
| `okonomiyaki-style-pizza-pizzadb-p1` | Owner判断待ち | 新2+ | -(2層) | bonito-flakes,cabbage,okonomiyaki-sauce | 0.143 porchetta-pizza | NONE | UNRESOLVED_INGREDIENT |
| `caponata-pizza-pizzadb-p2` | Owner判断待ち | FULL | - | 0 | 0.4 palmito-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `keema-pizza-pizzadb-p2` | Owner判断待ち | FULL | - | 0 | 0.5 tonno-e-cipolla | 部分集合禁止 | BASE_SAUCE_UNSPECIFIED |
| `kimchi-pizza-pizzadb-p2` | Owner判断待ち | 工程 | PREP | kimchi | 0.4 porchetta-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `quad-cities-style-pizza-pizzadb-p2` | Owner判断待ち | 工程 | DOUGH | 0 | 0.333 salsiccia-e-friarielli | 部分集合禁止 | UNRESOLVED_INGREDIENT |
| `colorado-mountain-pie-pizzadb-p3` | Owner判断待ち | 工程 | DOUGH | 0 | 0.333 salsiccia-e-friarielli | 部分集合禁止 | EVIDENCE_GAP |
| `chicken-tikka-pizza-pizzadb-p5` | Owner判断待ち | 新1 | - | chicken-tikka | 0.5 spanish-chorizo-pizza | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `diavola-pizza-pizzadb-p5` | Owner判断待ち | 新1 | - | spicy-salami | 0.25 salsiccia-e-friarielli | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `detroit-style-pizza-pizzadb-p5` | Owner判断待ち | 工程 | DOUGH,PAN,SHAPE | brick-cheese | 0.5 pepperoni | J>0.4 | COMPOSITION_CONFLICT_CANDIDATE |
| `turkish-pide-pizzadb-p5` | Owner判断待ち | 工程 | DOUGH,SHAPE | 0 | 0.25 chilean-napolitana | NONE | UNRESOLVED_INGREDIENT |
| `nashville-hot-chicken-pizza-pizzadb-p6` | Owner判断待ち | 新1 | - | honey | 0.333 pesto-pollo | NONE | BASE_SAUCE_UNSPECIFIED |
| `nutella-dessert-pizza-pizzadb-p6` | Owner判断待ち | 新2+ | - | banana,nutella-spread,powdered-sugar | 0.0 yuzu-shrimp-pizza | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `banh-mi-pizza-pizzadb-p6` | Owner判断待ち | 新2+ | - | carrot,daikon,liver-pate | 0.25 hawaiian | NONE | BASE_SAUCE_UNSPECIFIED |
| `buffalo-cauliflower-pizza-pizzadb-p6` | Owner判断待ち | 新2+ | - | blue-cheese-dressing,cauliflower | 0.2 salsiccia-e-friarielli | NONE | BASE_SAUCE_UNSPECIFIED |
| `palmitos-salsa-golf-pizzadb-p7` | Owner判断待ち | 工程 | DOUGH | 0 | 0.429 capricciosa | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `pizza-asparagi-limone-pizzadb-p8` | Owner判断待ち | 新1 | - | asparagus | 0.429 quattro-formaggi | J>0.4 | MECHANIC_INTERPRETATION |
| `pizza-carciofi-salad-pizzadb-p8` | Owner判断待ち | 工程 | DOUGH | celery | 0.375 spinach-artichoke-pizza | NONE | MECHANIC_INTERPRETATION |
| `pizza-finocchi-salad-pizzadb-p8` | Owner判断待ち | 新2+ | - | fennel,orange | 0.286 palmito-pizza | NONE | MECHANIC_INTERPRETATION |
| `pizza-cavolo-carote-pizzadb-p8` | Owner判断待ち | 新2+ | - | carrot,red-cabbage,sunflower-seeds | 0.25 shirasu-pizza | NONE | MECHANIC_INTERPRETATION |
| `pizza-zucchine-menta-pizzadb-p8` | Owner判断待ち | FULL | - | 0 | 0.429 pizza-bianca-ricotta | J>0.4 | MECHANIC_INTERPRETATION |
| `pizza-cicoria-limone-pizzadb-p8` | Owner判断待ち | 工程 | DOUGH | chicory,pecorino | 0.286 vongole | NONE | MECHANIC_INTERPRETATION |
| `pizza-puntarelle-pizzadb-p8` | Owner判断待ち | 工程 | DOUGH | puntarelle | 0.286 shirasu-pizza | NONE | MECHANIC_INTERPRETATION |
| `pizza-radicchio-noci-pizzadb-p8` | Owner判断待ち | 新2+ | -(2層) | balsamic-vinegar,radicchio,walnut | 0.286 pizza-bianca-ricotta | NONE | MECHANIC_INTERPRETATION |
| `pizza-chilena-pizzadb-p8` | Owner判断待ち | FULL | - | 0 | 0.667 pizza-portuguesa | 部分集合禁止 | UNRESOLVED_INGREDIENT |
| `pizza-romana-pizzadb-p9` | Owner判断待ち | 工程 | DOUGH | 0 | 0.8 napoletana | 上位集合禁止 | COMPOSITION_CONFLICT_CANDIDATE |
| `philly-cheesesteak-pizza-pizzadb-p9` | Owner判断待ち | FULL | - | 0 | 0.75 nigerian-suya-pizza | 部分集合禁止 | UNRESOLVED_INGREDIENT |
| `feteer-meshaltet-pizzadb-p10` | Owner判断待ち | 工程 | MSPREAD,LAMINATE | condensed-milk,honey,melted-butter | 0.0 yuzu-shrimp-pizza | NONE | SCOPE_QUESTION |
| `focaccia-genovese-pizzadb-p10` | Owner判断待ち | 工程 | DOUGH | rock-salt | 0.667 pizza-bianca | 上位集合禁止 | SCOPE_QUESTION |
| `fugazzetta-pizzadb-p10` | Owner判断待ち | 工程 | DOUGH | 0 | 0.5 fugazza | J>0.4 | DISCOVERY_COLLISION |
| `fruit-dessert-pizza-pizzadb-p11` | Owner判断待ち | 工程 | DOUGH | blueberry,kiwi,strawberry | 0.143 pesto-salmone | NONE | BASE_SAUCE_UNSPECIFIED |
| `bulgogi-pizza-pizzadb-p11` | Owner判断待ち | FULL | - | 0 | 0.6 rendang-pizza | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `frutti-di-mare-pizzadb-p11` | Owner判断待ち | 新1 | - | squid | 0.5 pescatore | J>0.4 | COMPOSITION_CONFLICT_CANDIDATE |
| `peruvian-aji-amarillo-pizzadb-p12` | Owner判断待ち | 新1 | - | aji-amarillo | 0.4 palmito-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `natto-pizza` | Owner判断待ち | 工程 | LATE-mid | natto,okra | 0.25 tarako-cream-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `mentaiko-mochi-pizza` | Owner判断待ち | 新2+ | - | mentaiko,mochi | 0.25 tarako-cream-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `pizza-de-lomo-saltado` | Owner判断待ち | 工程 | PREP,LATE-mid | french-fries | 0.5 rendang-pizza | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `lahmacun` | Owner判断待ち | 工程 | DOUGH(2層) | 0 | 0.2 chilean-napolitana | NONE | MECHANIC_INTERPRETATION |
| `mexican-elote-pizza-pizzadb-p13` | Owner判断待ち | 新2+ | - | chili-powder,cotija,lime | 0.25 potato-mayo-pizza | NONE | BASE_SAUCE_UNSPECIFIED |
| `nduja-pizza-pizzadb-p14` | Owner判断待ち | 新1 | - | honey | 0.5 salsiccia-e-friarielli | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `black-truffle-pizza-pizzadb-p14` | Owner判断待ち | 新1 | - | truffle | 0.333 spinach-artichoke-pizza | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `teriyaki-chicken-pizza-pizzadb-p14` | Owner判断待ち | FULL | - | 0 | 0.333 curry-pizza-japan | NONE | COMPOSITION_CONFLICT_CANDIDATE |
| `south-african-boerewors-pizzadb-p14` | Owner判断待ち | 新1 | - | chutney | 0.6 spanish-chorizo-pizza | J>0.4 | BASE_SAUCE_UNSPECIFIED |
| `hokkaido-cheese-pizza-pizzadb-p15` | Owner判断待ち | FULL | - | 0 | 0.6 potato-mayo-pizza | 部分集合禁止 | UNRESOLVED_INGREDIENT |
## 5. 工程依存の依存先【実測（コード）＋推論】

| 工程 | 本番での状態 | 依存先 | 影響する行（87 のうち） |
|---|---|---|---|
| DOUGH_VARIANT | 2 種のみ（standard／Pinsa）。3 種目以降は未出荷 | #577 PD-1a（PR #775、open）→ PD-1b/c → PD-2（チップ UI、`GameScreen.tsx` が HOT、#738 の merge 後）→ PD-3（データ。#773 の J-4／J-5） | 31 行（`TETO_DOUGH-KIND_PD1BC_Design-Impact.md` §6） |
| MULTI_SPREAD_LAYER | 2 層は出荷済み（grandma-pizza、#521）。3 層・非ソース層は未出荷 | 3 層目の機構（設計のみ） | 13 行中 12 行は 2 層で機構あり、3 層の 1 行が未対応 |
| PAN_BAKE | 四角天板（tray）のみ出荷済み。他の天板は無し | #532／#540 系の設計 | 8 行 |
| LATE_ADDITION | post_bake は出荷済み。mid_bake は無し | 設計のみ | mid_bake 3 行 |
| PREP_STEP | 実装済みだが `PREP_EXPERIENCE_PRODUCTION = false` | Owner の本番 ON 承認 | 3 行 |
| FRY_COOK | `FRY_EXPERIENCE_PRODUCTION = false` | #749 F1〜F3 と Owner の本番 ON | 1 行（pizza-fritta） |
| ENCLOSE／LAMINATE／ZONED／STEP_ORDER／DOUGH_SHAPE_TARGET | 無し | 設計のみ（#780 の workstream D） | ENCLOSE 5、SHAPE 5、STEP_ORDER 2、ZONED 1、LAMINATE 1 |

## 6. 重複リスク（Jaccard）の要点【実測・静的】

方法は #772 の `TETO_CONTENT-POOL_jaccard.py` と同じ（requiredIngredients の id 集合、個数無視、ソースも材料）。#772 が測った 16 候補の値は再測定せず、本書は同じ規則を 87 行全体に広げただけ。**ゲーム本体の Jaccard テスト・Research ラベル・Hint 5.0 の実測ではない**（実装 PR で確定）。
- 禁止（部分集合／上位集合）: 部分集合 12、上位集合 7（生地軸などで分けられる行を含む。`axisSeparable` が真かつ禁止の行は 10 行で、Owner の例外判断で救える可能性がある【推論】）。
- 同一集合だが生地軸だけ違う（cauliflower・fathead・chicago-stuffed・new-england-bar・pizza-al-taglio）は、Pinsa のハモンセラーノと同じ副作用（標準生地で同じ食材を作ると別識別）を生地ごとに Owner が許容するかの問題（#577 D-F4）。
- Jaccard > 0.4 の例外要（禁止にも生地軸差にも当たらない行）: 23 行。最大 Jaccard が 0.4 超の行は全体で 43 行。#772 S2 の「原則認めない」推奨は維持するのが安全。

## 7. Owner 判断表（まとめて・各に推奨つき）

| ID | 論点 | 推奨 |
|---|---|---|
| Q-1 | **Wave A/B/C と「判断不要 9／判断待ち 37」の定義・ID 一覧・出所（commit／path）**の提示（本書は UNVERIFIED のまま） | 提示されるまで Wave 別の約束をしない。9 件を本書の 8＋1 で代用しない |
| Q-2 | #780 の「87」の定義を「172 − 出荷済み紐づき 85」と記録してよいか。Sept の Phase-2 の 87 とは別集合であることを #780 に 1 行追記 | 記録する |
| Q-3 | 出荷済みと構成が食い違う 9 行を、出荷済みとして数えるか（現状どおり）、未実装に戻すか | 出荷済みのまま数え、別論点として #190 の A／B 判断に残す |
| Q-4 | **FULL が 0 件**であることを受けて、次の拡張の優先を「burrata（#774）→ B20-A（honey・walnut）→ DOUGH_VARIANT（piadina から）」とするか | その順（S2・Rev 5 と一致）。新食材なしの水増しはしない |
| Q-5 | 静的重複ゲートの扱い: Jaccard > 0.4 の例外 23 行をどう扱うか | 原則認めない。crudaiola（承認済み）と、zucchine 相当の個別例外のみ個別に検討 |
| Q-6 | ソース未特定（21 行）の方針: 新ソースを足すか、NO_SAUCE か。bulgogi・teriyaki・philly 等 | #772 S2 §3 の 9 件調査を正とし、teriyaki のみ先に判断 |
| Q-7 | 暫定仕様（原典 pizzadb.jp 未確認）での実装を、今後の各バッチでも OD-B9-17 パターンで包括承認するか | 包括承認し、各 Result に「暫定」を明記。87 行の原典は全て未確認 |
| Q-8 | PD-1b／PD-1c の GO 時期（PR #775 の merge 後）と、同時実装枠 2 件の運用 | PD-1b・PD-1c は #775 の merge 後に別 PR で、枠に余裕があるとき。詳細は Design-Impact §8 |
| Q-9 | 本書の結果を #780 に反映する方法 | 本 PR の URL を #780 にコメントで 1 件貼る。Issue 本文の数値は Owner が編集 |

## 8. 限界・未確認【未確認】

- 原典 pizzadb.jp は全 87 行で未確認（`sourceOrigin`: 比較表のみ 76、個別ページ中継 11。中継分もこの環境では再確認していない）。
- Jaccard・重複ゲートは静的近似。Research ラベル（cohort 文字）・Hint 5.0・DH4 は実測していない。
- 未解決食材の行（ひき肉・唐辛子など）の `afterDecisionClass` は新食材数が下限。
- 本番の工程サポート表（`script.py.txt` の `SUPPORT`）は手書きで、監査時点のコードを読んだもの。再実行時は見直すこと。
- PR #775 のマージ状態、#774 の GO、#748 claim の解放は本書の時点の GitHub 状態を読んだだけ。
- アプリ実行・テスト実行・HV はしていない（docs-only）。

## 9. #772 の claim との関係

#772（`session_013m8Cb6…`、`TETO_CONTENT-POOL_*`）の claim・ブランチ・成果物は編集していない。#772 の `jaccard.py` の方法と S2 の測定は読み取り専用で再利用し、同じ測定（16 候補）は繰り返していない。#772 に追加成果物が出た場合はそちらを優先する。
