# Content Pool S2 Result — 候補プール再構築・9 レシピ個別調査・chili-oil／ground-beef 判定（#772、docs-only）

main `3a41bb6`、2026-11-06。変更は `docs/reports/TETO_CONTENT-POOL_*` と `docs/reports/data/TETO_CONTENT-POOL_*` の新規ファイルのみ。再現: `python3 docs/reports/data/TETO_CONTENT-POOL_jaccard.py .`（結果 `TETO_CONTENT-POOL_jaccard.json`、matrix 候補は `..._jaccard_matrix-candidates.json`）。
**方法と限界:** `recipes.ts`＋`lateCatalog.ts` の既存 90 レシピの `requiredIngredients` の **id 集合**（個数無視・ソースも材料として数える）と、172 マトリクスの `canonicalIngredientIds`＋`spreadLayers`（ASCII の id のみ）を比べた**静的な近似**。ゲーム本体の検証（Jaccard テスト・Research ラベル・Hint）ではなく、**実装 PR で実測して確定**する。「禁止」は Batch 19 Audit §4 の規則（同一／部分集合／上位集合は不可、Jaccard 0.4 超は個別の Owner 例外）による。

## 1. 最重要の発見 — 「既存食材だけで足せるレシピ」はほぼ残っていない

マトリクスの未出荷行（別名補正後）で、**同一・部分集合・上位集合に当たらず、かつ Jaccard ≤ 0.4** のものは **39 行**。うち**新食材 0** は 6 行だけで、**調理工程の追加も要らないのは caponata（#706、ソース未特定で HOLD）の 1 行のみ**:

| 新食材 0 の 6 行 | 追加で要るもの |
|---|---|
| caponata-pizza（Jaccard 0.40） | ソース未特定（#706 の NO_SAUCE 例外の Owner 判断） |
| piadina-romagnola（0.40、READY） | DOUGH_VARIANT 3 値目（#577 の設計 Gate は G5〜G8 が HOLD） |
| pizza-fritta（0.40、READY） | FRY_COOK（#749 Phase 2、別 Owner Gate） |
| turkish-pide（0.25） | DOUGH_VARIANT＋`ひき肉`・`チーズ` の未解決 |
| lahmacun（0.33） | DOUGH_VARIANT＋MULTI_SPREAD＋`ひき肉`・解釈未確定 |
| teriyaki-chicken-pizza（0.33） | ソース未特定＋mayo・nori が後乗せ（late 本番 OFF）＝焼成前にする解釈の Owner 判断 |

Rev 1／Rev 2 の「A1 約 5 件」は**訂正**します（静的に重複と判定）:

| 旧 A1 候補 | 判定 | 根拠（既存レシピ） |
|---|---|---|
| bianca | **禁止（同一）** | `pizza-bianca-ricotta` と同一集合（かつ `pizza-bianca` を内包） |
| mentaiko-cream-pizza | **出荷済み** | `tarako-cream-pizza` と同一集合 |
| sfincione | **禁止（上位集合）** | `fugazza` を内包（0.60） |
| trenton-tomato-pie | **禁止（部分集合）** | `margherita`・`bismarck` ほか 23 件に内包される |
| tsukimi-pizza | **例外が要る** | `breakfast-pizza`・`aussie` と 0.60 |
| quattro-stagioni | **禁止（上位集合）** | `funghi` を内包（`capricciosa` と 0.71） |

**含意:** 20 レシピのほとんどは「新食材」か「新工程（生地バリエーション・FRY・late）」が先に要る。「既存食材だけ」の水増しは、重複を出荷することになるため行わない。

## 2. 静的ゲートを通った 39 行（新食材・工程別）

新食材と工程の列は「その行を足すために**他に必要なもの**」。ブロッカーは matrix の `blockers`。

| 区分 | レシピ | 必要な新食材 | 工程 | ブロッカー |
|---|---|---|---|---|
| **READY・新食材 1・工程なし** | pesto-burrata／pizza-alla-crudaiola（matrix 名 `pizza-alla-crudaiola`）／burrata-pizza | burrata | なし | なし（#774、burrata-pizza は crudaiola の近傍 5 件目で別判断） |
| READY・新食材 2・工程なし | pesto-noci | honey, walnut | なし | なし |
| READY・新食材 3・工程なし | peking-duck-pizza | cucumber, peking-duck, sweet-bean-sauce | なし | なし（READY_WITH_REVIEW） |
| 新食材 2 | speck-e-brie（brie, walnut） | | なし | COMPOSITION_CONFLICT（DIVERGENT） |
| 新食材 1 | nashville-hot-chicken（honey）、jerusalem-mixed-grill（cumin）、peruvian-aji-amarillo（aji-amarillo）、black-truffle（truffle・late） | | なし／late | ソース未特定ほか |
| DOUGH_VARIANT | piadina（0）、manakish（halloumi, zaatar／READY）、poutine（cheese-curd, french-fries, gravy／READY）、turkish-pide（0）、lahmacun（0）、pizza-carciofi-salad（celery）、pizza-cicoria-limone（chicory, pecorino）、pizza-puntarelle（puntarelle）、fruit-dessert（berries×3） | | 生地 3 値目 | 一部 READY |
| late（本番 OFF） | teriyaki（0）、buffalo-chicken、smore、eel、natto、nutella、truffle | 各 1〜3 | late 後乗せ | ソース未特定・構成競合 |
| FRY | pizza-fritta | 0 | FRY_COOK | なし（READY） |
| PREP「炒め」 | kimchi | kimchi | PREP_STEP | ソース未特定 |
| その他 | taco（5）、okonomiyaki（3）、banh-mi（3）、salad 系 3、apple-cinnamon、buffalo-cauliflower、mexican-elote、mentaiko-mochi、swedish-kebab、feteer（LAMINATE）ほか | 多数 | | BLOCKED |

**READY で最少の依存のもの:** burrata 系 3、pesto-noci（honey＋walnut）、manakish、piadina、pizza-fritta、poutine、peking-duck。

## 3. ソース未特定ほか 9 レシピの個別調査

構成は matrix、重複は §上記の静的測定（新食材は「新 id」として加えた場合）。**判定の語:** 禁止＝規則上追加できない／例外＝Owner が Jaccard 例外を承認すれば可／可（要判断）＝規則上は可でソース等の判断が要る。

| # | レシピ | 根拠（matrix の原典語） | 候補ソース | 静的測定（最大 Jaccard・禁止） | 判定 | Research ラベルへの影響の見立て |
|---|---|---|---|---|---|---|
| 1 | bulgogi-pizza | 甘辛だれ（`BASE_SAUCE_UNSPECIFIED`） | 新ソース（PAINT）or NO_SAUCE | 0.60（NO_SAUCE）／0.50（新ソース）vs `rendang-pizza`・`nigerian-suya-pizza`。禁止なし | **例外**（B18 の 0.43 より大きい） | 新ソースなら新ラベル 1。beef・onion 系の cohort letter が動く恐れ（実測要） |
| 2 | teriyaki-chicken-pizza | 甘辛だれ・mayo・nori が後乗せ（`catalog_design_tag`）、構成競合 INDETERMINATE | 新ソース or NO_SAUCE、後乗せ→焼成前 | 0.29（新ソース）／0.33（NO_SAUCE）vs `curry-pizza-japan`。禁止なし | **可（要判断）。9 件中で唯一クリーン** | mayo（B13）・nori（late）は既存。late 開閉の両方で実測 |
| 3 | keema-pizza | カレー（ソース未特定）、`ひき肉`・`青唐辛子` 未解決 | curry-ketchup（B18 の代用）＋ground-beef | beef 代用は `rendang-pizza` と**同一**。ground-beef 新 id で 0.60（rendang・curry-pizza-japan）、chili-oil も足して 0.50 | **例外（大）**。beef 代用は禁止 | baingan と同系統（curry-ketchup）。例外が連続する |
| 4 | philly-cheesesteak-pizza | チーズソース（`mozzarella` に曖昧） | cheese-sauce を新ソース、またはチーズ層で NO_SAUCE | beef・green-pepper・onion・mozzarella は `nigerian-suya-pizza` と**同一**（0.75、1 材料差） | **禁止**（新ソース id で区別できれば例外） | 区別は新ソース 1 点のみ＝ラベルが脆い |
| 5 | pizza-chilena | ひき肉（ground-beef 未登録） | ground-beef（新）or beef | `bismarck` を内包（上位集合）、`pizza-portuguesa` と 0.71–0.83 | **禁止** | — |
| 6 | pizza-baiana | 唐辛子（chili-oil に曖昧） | chili-oil（新）／省く | `bismarck`・`salsiccia` を内包（上位集合）。chili-oil を足しても同じ | **禁止** | — |
| 7 | pizza-de-cancha | 唐辛子、DOUGH_VARIANT＋MULTI_SPREAD | chili-oil＋生地 | `marinara` を内包（上位集合、1 材料差）。chili-oil を足しても内包 | **禁止** | — |
| 8 | hokkaido-cheese-pizza | `チーズ` 未解決 | mozzarella | `potato-mayo-pizza` に内包（部分集合、0.80） | **禁止** | — |
| 9 | pizza-zucchine-menta | LATE_ADDITION が `repo_inference` のみ | 全食材を焼成前 | `pizza-bianca-ricotta`・`eggplant-ricotta-pizza` と 0.429（対称差 4）。禁止なし | **例外**（crudaiola と同型の 0.429） | lemon・mint・zucchini は既存。late 解釈を誤らないこと（原典が弱い） |

**9 件の合計:** クリーンに追加できる見込み **1（teriyaki）**／Owner の例外が要る **4（bulgogi・keema・philly・zucchine）**／規則上追加できない **4（chilena・baiana・de-cancha・hokkaido）**。

### chili-oil・ground-beef を新食材にする必要性

| 食材 | 解決するレシピ | 判定 |
|---|---|---|
| **chili-oil** | baiana・de-cancha（どちらも**入れても禁止**）、keema（ground-beef も要り例外 0.50）、diavola（spicy-salami も要り 0.50） | **今は不要**。足しても追加可能なレシピが 0 |
| **ground-beef** | chilena（禁止）、keema（例外 0.60）、taco（新食材 5）、lahmacun・turkish-pide（DOUGH_VARIANT 後） | **今は不要**。keema 1 件が大きな例外付きで解けるだけ。DOUGH_VARIANT が決まった後に再評価 |

→ **8 種の新食材の枠に chili-oil・ground-beef は入れない**。

## 4. 新食材 8 種の再ランキング（静的ゲート通過の READY 行で評価）

| 順位 | 食材 | 通過行で解放（他の不足が無い）されるレシピ | 注記 |
|---|---|---|---|
| 1 | burrata | pesto-burrata・crudaiola（＋burrata-pizza は別判断） | #774（承認済み） |
| 2 | honey ＋ walnut | pesto-noci（2 食材セット）。honey 単独で nashville（ソース未特定） | 2 食材で READY 1。**食材 2 に対し効率は低い** |
| 3 | brie | speck-e-brie（walnut 併用。構成競合の解消が要る） | |
| 4 | halloumi ＋ zaatar | manakish（DOUGH_VARIANT 要） | 生地が先 |
| 5 | cheese-curd・french-fries・gravy-sauce | poutine（DOUGH_VARIANT 要・3 食材） | 効率低 |
| 6 | cucumber・peking-duck・sweet-bean-sauce | peking-duck（READY_WITH_REVIEW・3 食材） | 効率低 |
| 7 | kimchi | kimchi（PREP_STEP 要） | 工程が先 |
| 8 | truffle | black-truffle（late・構成競合） | 工程が先 |

**正直な評価:** 8 食材・20 レシピのうち、**確実に実装可能なのは burrata 1 食材＋2 レシピだけ**。残りの食材 7・レシピ約 18 は、**DOUGH_VARIANT（生地 3 値目）・late・FRY・PREP のいずれかの工程が先に決まる**か、Owner の例外承認が要る。したがって **新工程（S6、#773）の決定が食材・レシピ数の上限を決める**。

## 5. Batch 20 Prep（既存食材のみ）への結論

**Batch 20 を「既存食材のみ」で組むことはできない**（クリーンなのは caponata 1 件、かつ #706 HOLD、teriyaki は Owner 判断付き）。Batch 20 の候補は次に差し替える提案:
- **B20 案 A（最小）:** teriyaki-chicken-pizza（新ソース or NO_SAUCE の Owner 判断後）＋ caponata（#706 の解除後）＝新食材 0〜1、レシピ 2。
- **B20 案 B:** honey＋walnut＋pesto-noci（新食材 2・レシピ 1）。
- いずれも Owner が選ぶ。S1 は B19 の後に着手。

## 6. Owner 判断（本書で新規に生じたもの）

| # | 判断 | 推奨 |
|---|---|---|
| 1 | 「既存食材だけで足せる」の前提を捨て、新食材・新工程と一体で計画する | 承認（本書の数値による） |
| 2 | chili-oil・ground-beef は 8 種に含めない | 承認 |
| 3 | 9 件のうち teriyaki を B20 候補にするか／ソース（新ソース or NO_SAUCE）と後乗せ解釈 | 要判断 |
| 4 | Jaccard 例外（bulgogi 0.5–0.6、keema 0.5–0.6、zucchine 0.429、tsukimi 0.60）を認めるか | **原則認めない**（B17／B18 の「1 レシピ限り」より大きい）。zucchine のみ crudaiola と同型として検討 |
| 5 | #706 caponata の HOLD 解除 | Owner 判断（FRY 技法バリアントの docs 調査が前提だった） |

## 7. 限界

静的測定のため、(a) matrix の `canonicalIngredientIds` が欠ける行、(b) 出荷済み id の別名、(c) minCount・Research ラベル・Hint を反映しない。**実装 PR の前に、実コードの Jaccard テスト・`researchLabelAudit`・Hint 5.0 で再測定する。** 原典（pizzadb.jp）は未確認。
