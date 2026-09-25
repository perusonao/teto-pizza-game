# Progression 2.0 W1 — REC-01〜REC-03 Resolution Fresh Audit

## 結論

| REC | 判定 | 残っているもの |
|---|---|---|
| **REC-01** | **NOT READY** | 10 件すべてで Human の content sign-off が PENDING（機械では解決できない）。sign-off の前に決めるルールが 2 つある（Q1 / Q2） |
| **REC-02** | **NOT READY** | W1 の id は 1 件も `CUT_ELIGIBLE_RECIPE_IDS` に入っていない。CUT 候補 9 / evidence 不足 1（New Haven）/ mechanic 不足 0 / CUT なし 0。Q3 で決まる |
| **REC-03** | **NOT READY** | 3 つの軸（CUT / minCount / bake）はすべて互換。REC-03 が待っていた #218 の判断は Issue #215 の Owner Decision として記録済み。閉じる根拠をどちらにするか（Q4）だけが残る |

- W1 の readiness は変わらず **READY 0 / REVIEW 10 / BLOCKED 0**（REC-04 は範囲外で open のまま）。
- 新しく見つかった dependency: **MD-01 — Scoring 2.0 Reference entry**（`src/data/referencePizza.ts`）。10 件すべてに必要だが、#221 の ledger にも change map の `likelyFiles` にも入っていない。
- Owner に聞くのは **4 問**（Q1〜Q4）。どれも「ルール」を 1 回決めれば、10 recipe 分の回答になる。この audit では、どの Owner Decision も CONFIRMED にしていない。
- `src/**` / `e2e/**` / `.github/**`、PR #220 / #221 / #222 は変更していない。PR は作っていない。

## 開始時に確認した GitHub の状態（2026-09-25）

| 対象 | 状態 |
|---|---|
| main | `1e53baa88f390bf6d8f52647e7c65cc279eb2567`（`dff233c` から変わったのは CI だけで、`src/` / `data/` / `docs/design/` / `docs/reports/data/` に差分はない） |
| PR #220（W1 authority） | OPEN、HEAD `e49dab96bd9b26dc0f520349cf09d1160c3519f5`。remote tip = pin |
| PR #221（W1 authoring） | OPEN、HEAD `070afc0827f382bec8bc813d62e7fafe663a0991`、Codex Final Gate PASS、READY 0 / REVIEW 10 / BLOCKED 0。remote tip = pin |
| W1 Visual Evidence Sync | `3fc02a06c197967c5989e0b0c1f88a0a546e2d2c`（branch `claude/w1-ingredient-visual-preview-mt4uxw`）。7/7 HUMAN_PASS。branch の tip は Production Visual P1 の作業で先に進んでいるが、`3fc02a0` はその祖先のまま |
| PR #222（Completion Gate G1 + Q の runtime） | OPEN、HEAD `81a850c`、**未 merge** |
| Issue #215 | OPEN。Owner Decision OD-1〜OD-5（2026-09-24）と OD-LR-RANKING を記録済み |

## REC の定義（現在の ledger から取得）

定義は PR #221 `070afc0` の `TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json` から、そのまま写した。Visual Evidence Sync（`3fc02a0`）の ledger でも、3 つとも `UNCHANGED` / `stillOpen: true` のまま。

| id | field | status | detail（原文） |
|---|---|---|---|
| REC-01 | description/minCount/bakeTarget | AUTHORING_REQUIRED | Values are original game-authoring candidates, not claims from external evidence. Human content sign-off remains required before production. |
| REC-02 | cutRequirement | AUTHORING_REQUIRED | All ten fit the current round-six-slice mechanic, but future production must explicitly opt each ID into the allowlist. |
| REC-03 | completionGate | OWNER_DECISION_REQUIRED | Record compatibility only. Do not decide whether CUT/minCount/bake thresholds gate completion before #218. |

したがって「resolved」の条件は次のとおり。

- **REC-01**: 10 recipe の description / minCount / bakeTarget に Human の content sign-off が付くこと。
- **REC-02**: 各 id について、CUT の allowlist に入れるかどうかを明示的に決めること（`cookingProfiles.ts` のコメントにある「人が形を確認したうえで追加する」手順）。
- **REC-03**: #218 の判断が出たうえで、CUT / minCount / bake が完成判定にどう効くかと W1 の値が互換であることを記録すること。

## 証拠の層（混ぜない）

| class | 出どころ | この audit での扱い |
|---|---|---|
| PIZZA_DB_EVIDENCE | `TETO_PIZZADB_172_MASTER-EVIDENCE.json` | 構成・生地・ソース・origin だけ。**量・焼き・説明文・CUT の情報は持っていない**（checker が固定） |
| GAME_DESIGN_MATRIX | `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` | 生地の class / shape、cutServe を導出した値 |
| INTERNAL_CATALOG | `data/recipes/pizza_master_catalog.json` | 社内の設計データ（`game_design_candidate`）。外部 evidence ではない |
| PRODUCTION_CONVENTION | `src/**` を read-only で測った値 | 量・焼き幅・説明文の長さの慣例、CUT allowlist、Reference map |
| GAME_AUTHORING_CANDIDATE | #221 の候補 | 候補であって evidence ではない |
| OWNER_DECISION_RECORD | Issue #215 の owner コメント | 引用するだけで、決め直さない |
| MERGED_SSOT | Cooking Steps 1.0 §6 / §11、Pizza Cutting 1.0 §7 | CUT は完成判定に使わない（score のみ） |
| HUMAN_SIGNOFF | この Review Pack への回答 | **外部 evidence として扱わない**（`countsAsExternalEvidence: false`、checker が固定） |

## REC-01 — description / quantity / bake target

### 機械で確認できたこと（10 件すべて）

| チェック | 基準（production から測定） | 結果 |
|---|---|---|
| 説明文に必須の具材がすべて出てくる | ingredient の nameJa（egg は production の Bismarck と同じ「卵」も可） | 10/10 |
| 説明文が Owner Decision と整合する | OD-OLIVE / OD-PARM / fresh-tomato の文言チェック（`3fc02a0`） | 10/10 CONSISTENT |
| 説明文の長さ | production は 39〜56 文字 | 9/10。**New Haven は 61 文字** |
| 地名が PIZZA DB で裏付けられる | origin / nameJa | 9/10。**New Haven の「アメリカ」は PIZZA DB の origin が null** |
| ingredient の集合が #220 と同じ | `identityIngredientIds` | 10/10 |
| minCount が production の範囲内 | sauce 1 / cheese 2–3 / topping 1–4 | 10/10 |
| 具材の種類数がパレットに入る | `MAX_INGREDIENT_PALETTE_SLOTS` = 6 | 10/10 |
| ソース以外の個数が reference ring に入る | `PIECE_RING_POSITIONS` = 8 | 7/10（Parmigiana 9 / Portuguesa 10 / Puttanesca 9 = RT-01） |
| 焼きの幅 | production は 15 件すべて 20 | 10/10 |
| 焼きの開始値 | production は 45〜65 | 10/10 |
| catalog の bakeProfile との一致 | catalog に値があれば verbatim で使う（Batch 1A / 1B-B の前例） | 9 件は catalog に値なし。**Hawaiian は CONFLICT**（catalog 60–80、#221 58–78） |
| Scoring 2.0 Reference entry | `REFERENCE_PIZZAS` | 0/10 → **MD-01** |

### 量の authority（どこが正か）

- `minCount` は 1 つの authored 値で、そこから次のものが決まる: player reference の位置（`getPlayerReferencePizza` が minCount から導出）、Scoring Reference の `positions.length`（#222 の test は scatter の minCount と一致することを固定する）、Lunch Rush の注文数（OD-4 LR-A）、G1 の下限（OD-1: 0 個だけが FAILED）。
- PIZZA DB に量の情報はない。#221 の値は「sauce 1 / cheese 2 / 主役 3 / 脇役 2 / 卵 1」という production の慣例どおりに作られた候補で、機械チェックの範囲内。
- 8 個を超える 3 件について、「減らさない」は `3fc02a0` の `heldConstraints`（作業上の制約）であり、**Owner Decision としてはどこにも記録されていない**。production の前例（Capricciosa / Meat Lovers）は ring に合わせて 8 個に減らしている。→ **Q2**。

### MD-01 — Scoring 2.0 Reference entry（新しく見つかった dependency）

- `computeScoringV2` は Reference がない recipe で `available: false` を返す（totalScore も ★ もない）。Completion Gate の `checkSauceQuantity` も Reference がないと飛ばされる。
- `referencePizza.test.ts` は「RECIPES のすべてに Reference がある」ことを要求する。recipe を追加すると、その entry がないかぎり test が落ちる。
- entry の `pieceGroups` の位置は、recipe ごとに手で作ってレビューした配置で、minCount からは導出できない。
- #221 の ledger にも change map（slice A / C の `likelyFiles`）にもない。Owner に聞く質問ではなく、実装 slice に加える authoring 作業。#221 を変える判断は Owner に任せる（この audit では変更しない）。

### Human が見るもの（REC-01）

機械で確認できない部分は **「10 件の文章と数値をまとめて承認するかどうか」の 1 回** に絞った。個別に見てほしい点は次の 3 つだけ。

1. Hawaiian の焼き目標（Q1 の選択肢で決まる）
2. New Haven の説明文（61 文字、「アメリカ」は PIZZA DB で裏付けがない）。Q1 で C を選ぶ場合に直す候補
3. 8 個を超える 3 件の量（Q2）

## REC-02 — CUT

production の方針（`src/data/cookingProfiles.ts`）:

- CUT は opt-in の allowlist（`CUT_ELIGIBLE_RECIPE_IDS`）。id や名前から推測しない。allowlist にない recipe は CUT を持たない。
- 入れる条件: 丸い 1 枚、1 回焼き、既存の円形 CUT の形（ideal circle）に合うこと。非円形（calzone / 四角 / 舟形など）は、人が形を確認するまで入れない。
- production の 15 件は全部入っているが、これは 15 件を 1 件ずつ確認した結果。「全部の pizza を CUT する」という規則ではない。
- CUT は完成判定に使わない（Cooking Steps 1.0 §6 / §11、Pizza Cutting 1.0 §7。`completionGate.ts` は CUT を読まない）。入れるかどうかは score と工程だけに影響する。

| 分類 | 件数 | recipe | 根拠 |
|---|---|---|---|
| CUT 候補（6 切れ） | 9 | Hawaiian、Parmigiana、Bambino、Portuguesa、Puttanesca、Pesto Caprese、Pesto Tonno、Pesto Patate、Melanzane | PIZZA DB の生地が standard（ナポリピッツァ生地 / 薄めの生地 / ピッツァ生地）で丸い 1 枚。mechanic の要件なし |
| evidence 不足 | 1 | New Haven Apizza | PIZZA DB の生地が `null`。design matrix の shape `round` は、生地が不明なときの **default** で、evidence ではない |
| mechanic 不足 | 0 | — | 非円形・包む・パン焼きの要件を持つ W1 はない |
| CUT なし | 0 | — | evidence で CUT なしが決まる W1 はない |

→ **Q3**（CUT の default rule と New Haven の扱い）。

## REC-03 — Completion Gate との互換性

| 軸 | authority | W1 との互換性 |
|---|---|---|
| CUT | merged SSOT: 完成判定に使わない（score のみ）。Issue #215 の原則でも CUT は Quality | 互換（どの W1 でも CUT が FAILED の原因にならない） |
| minCount | Issue #215 OD-1 = G1（0 個だけ FAILED）、OD-4 = LR-A（Lunch Rush は注文数が必要）、OD-5 = D-A（quantity は Recipe Identity ではない）。runtime は #222（OPEN） | 互換（全具材 minCount ≥ 1。Lunch Rush の注文数 = minCount） |
| bake | main の `checkBake`（範囲 ± 幅 × 0.5）。#215 の OD は bake を変えていない | 互換（10 件とも幅 20 → 判定範囲は target ± 10） |

REC-03 の detail は「#218 の前に決めない」だった。#218 は reviewed 済みで、その選択肢への Owner Decision が Issue #215 に記録されている。残っているのは、REC-03 を **記録された仕様（Issue #215 OD）で閉じるか、#222 が main に入ってから閉じるか** だけ。→ **Q4**。

## Owner Decision（4 問）

この audit では、どれも `PROPOSED_NOT_CONFIRMED` のまま。

**Q1. REC-01 のまとめての承認（description / minCount / bakeTarget）**
- A（推奨）: #221 の 10 件を承認する。Hawaiian の焼き目標は catalog の前例に合わせて 60–80 にする
- B: #221 の 10 件をそのまま承認する（Hawaiian は 58–78）
- C: まだ承認しない（直す点を挙げる。たとえば New Haven の説明文）

**Q2. 8 個を超える 3 件の量（Parmigiana 9 / Portuguesa 10 / Puttanesca 9）**
- A: 量はそのまま。3 件は RT-01（runtime slice E）が終わるまで待つ
- B: ソース以外を 8 個以下に減らす（Capricciosa / Meat Lovers と同じ前例）。3 件は RT-01 を待たなくてよくなる
- 推奨なし（前例は B、これまでの audit の方針は A。ゲームの手触りの判断になる）

**Q3. CUT の default rule**
- A（推奨）: CUT 候補の 9 件を 6 切れで allowlist に入れる。New Haven は生地の evidence が出るまで CUT なし
- B: 10 件すべて入れる（New Haven の生地不明を「普通の丸い pizza」とみなす）
- C: W1 はまだ 1 件も入れない

**Q4. REC-03 を閉じる根拠**
- A（推奨）: 記録済みの Issue #215 Owner Decision で閉じる（runtime は #222 が後から追う）
- B: #222 が main に merge されてから閉じる

Q1〜Q4 に答えると、REC-01〜03 は 10 件すべてで閉じられる。そのあとも W1 の READY に残るのは REC-04（Progression）、RT-01（Q2 = A の場合）、MD-01 の authoring。

## Human Review Pack

各 recipe の「Question」は、その recipe に固有の論点だけを書いた。共通の論点（Q1 のまとめての承認、Q3、Q4）は上の 4 問に含まれている。

<!-- BEGIN GENERATED: HUMAN REVIEW PACK (tools/progression2_w1_rec_resolution_audit.py) -->

### ニューヘイブンアピッツァ（`new-haven-apizza`）

| 項目 | 内容 |
|---|---|
| Recipe | オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたアメリカ・ニューヘイブン風の一枚。 |
| Evidence | PIZZA DB `new-haven-apizza-pizzadb`（comparison_table_sample）: ニューヘイブンアピッツァ / 生地 記載なし / ソース オイル / origin 記載なし。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | オリーブオイル（olive-oil）、パルミジャーノ（parmigiano）、あさり（clam）、にんにく（garlic） |
| Quantity | olive-oil×1 / parmigiano×2 / clam×3 / garlic×2（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 62–82（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | evidence不足。生地 記載なし → shape round（default）。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: descriptionLengthWithinProductionRange, regionClaimsSupported, scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — EVIDENCE_INSUFFICIENT（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 52–92） |
| Question | Q3（New Haven に CUT を入れるか）; Q1 に含めて確認: 説明文が 61 文字（production は 39〜56 文字）; Q1 に含めて確認: 説明文の「アメリカ」は PIZZA DB の origin にない |

### ハワイアンピザ（`hawaiian`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハムとパイナップル、モッツァレラを合わせた、甘みと塩気のバランスが楽しい一枚。 |
| Evidence | PIZZA DB `hawaiian-pizzadb-row`（individual_profile_page）: ハワイアンピザ / 生地 薄めの生地 / ソース トマトソース / origin カナダ / オンタリオ州。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、パイナップル（pineapple） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×2 / pineapple×3（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 58–78（幅 20）。catalog: CONFLICT 60–80 |
| CUT | CUT候補（6切れ）。生地 薄めの生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 48–88） |
| Question | Q1（Hawaiian の焼き目標: catalog 60–80 か #221 58–78 か） |

### パルミジャーナピザ（`parmigiana-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにナス、モッツァレラ、パルミジャーノ、バジルを合わせた南イタリア風の一枚。 |
| Evidence | PIZZA DB `parmigiana-pizza-pizzadb-p7`（comparison_table_sample）: パルミジャーナピザ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / 南イタリア。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ナス（eggplant）、パルミジャーノ（parmigiano）、バジル（basil） |
| Quantity | tomato-sauce×1 / mozzarella×2 / eggplant×3 / parmigiano×2 / basil×2（ソース以外 9 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 58–78（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: nonSaucePiecesFitReferenceRing, scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 48–88） |
| Question | Q2（8個を超える具材数をそのまま残すか、8個以下に減らすか） |

### バンビーノ（`bambino`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハム、コーン、モッツァレラをのせた、やさしい甘みで親しみやすい一枚。 |
| Evidence | PIZZA DB `bambino-pizzadb-p7`（comparison_table_sample）: バンビーノ / 生地 ピッツァ生地 / ソース トマトソース / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、コーン（corn） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×2 / corn×3（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 56–76（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 46–86） |
| Question | 共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし） |

### ピッツァ・ポルトゲーザ（`pizza-portuguesa`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハム、卵、たまねぎ、ブラックオリーブ、モッツァレラを重ねたブラジル定番の一枚。 |
| Evidence | PIZZA DB `pizza-portuguesa-pizzadb-p9`（comparison_table_sample）: ピッツァ・ポルトゲーザ / 生地 薄めの生地 / ソース トマトソース / origin ブラジル / サンパウロ。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、たまご（egg）、たまねぎ（onion）、ブラックオリーブ（black-olive） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×3 / egg×1 / onion×2 / black-olive×2（ソース以外 10 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 58–78（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 薄めの生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: nonSaucePiecesFitReferenceRing, scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 48–88） |
| Question | Q2（8個を超える具材数をそのまま残すか、8個以下に減らすか） |

### プッタネスカ（`puttanesca-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにアンチョビ、ブラックオリーブ、ケッパー、にんにくを効かせた、塩味と香りの強い一枚。 |
| Evidence | PIZZA DB `puttanesca-pizza-pizzadb-p10`（comparison_table_sample）: プッタネスカ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / ナポリ。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、アンチョビ（anchovy）、ブラックオリーブ（black-olive）、ケッパー（capers）、にんにく（garlic） |
| Quantity | tomato-sauce×1 / anchovy×3 / black-olive×2 / capers×2 / garlic×2（ソース以外 9 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 50–70（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: nonSaucePiecesFitReferenceRing, scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 40–80） |
| Question | Q2（8個を超える具材数をそのまま残すか、8個以下に減らすか） |

### ペストカプレーゼピザ（`pesto-caprese`）

| 項目 | 内容 |
|---|---|
| Recipe | ジェノベーゼソースにトマト、モッツァレラ、バジルを重ねた、カプレーゼ仕立ての爽やかな一枚。 |
| Evidence | PIZZA DB `pesto-caprese-pizzadb-p11`（comparison_table_sample）: ペストカプレーゼピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、モッツァレラ（mozzarella）、トマト（fresh-tomato）、バジル（basil） |
| Quantity | pesto×1 / mozzarella×2 / fresh-tomato×3 / basil×2（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 50–70（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 40–80） |
| Question | 共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし） |

### ペストトンノピザ（`pesto-tonno`）

| 項目 | 内容 |
|---|---|
| Recipe | 香り高いジェノベーゼソースに、ツナ、ブラックオリーブ、たまねぎを合わせた爽やかな一枚。 |
| Evidence | PIZZA DB `pesto-tonno-pizzadb-p12`（comparison_table_sample）: ペストトンノピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、ツナ（tuna）、ブラックオリーブ（black-olive）、たまねぎ（onion） |
| Quantity | pesto×1 / tuna×3 / black-olive×2 / onion×2（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 50–70（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 40–80） |
| Question | 共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし） |

### ペストパターテピザ（`pesto-patate`）

| 項目 | 内容 |
|---|---|
| Recipe | ジェノベーゼソースにじゃがいも、ベーコン、モッツァレラを合わせた、ほくほくと香ばしい一枚。 |
| Evidence | PIZZA DB `pesto-patate-pizzadb-p12`（comparison_table_sample）: ペストパターテピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、モッツァレラ（mozzarella）、じゃがいも（potato）、ベーコン（bacon） |
| Quantity | pesto×1 / mozzarella×2 / potato×3 / bacon×2（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 58–78（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 48–88） |
| Question | 共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし） |

### メランザーネピザ（`melanzane-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにナス、モッツァレラ、バジルを合わせた、素朴で香り豊かな南イタリア風ピザ。 |
| Evidence | PIZZA DB `melanzane-pizza-pizzadb-p13`（comparison_table_sample）: メランザーネピザ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / 南部。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ナス（eggplant）、バジル（basil） |
| Quantity | tomato-sauce×1 / mozzarella×2 / eggplant×3 / basil×2（ソース以外 7 個 / ring 8）。#221 の game authoring candidate |
| Bake target | 58–78（幅 20）。catalog: NO_CATALOG_VALUE |
| CUT | CUT候補（6切れ）。生地 ナポリピッツァ生地 → shape round。CUT は score のみで完成判定に使わない |
| REC-01 status | **NOT_READY** — 機械チェックの不合格: scoringReferenceEntryExists。Human sign-off: PENDING |
| REC-02 status | **NOT_READY** — CUT_CANDIDATE（production allowlist 未登録） |
| REC-03 status | **NOT_READY** — 互換性: OK（全具材 minCount ≥ 1、焼きの判定範囲 48–88） |
| Question | 共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし） |

<!-- END GENERATED: HUMAN REVIEW PACK -->

## Verification

- `python3 tools/progression2_w1_rec_resolution_audit.py --check`: 入力 20 個の sha256 を `tools/progression2_w1_rec_resolution_audit.pins.json` で固定し、JSON と、この report の Review Pack が byte 単位で再生成できることを確認する。確認する invariant:
  - W1 が 10 件あり、#220 の authority・#221 の matrix・`3fc02a0` の ledger・この audit の recipe 集合が一致する
  - #220 / #221 の remote tip が pin と一致する（動いたら FAIL）。`3fc02a0` が branch の祖先である
  - `3fc02a0` の ledger が記録した #221 のファイル hash と #220 の blob hash が、実際の入力と一致する（provenance chain）
  - REC-01〜03 の定義が #221 の ledger から来ていて、`3fc02a0` で UNCHANGED のまま
  - MD-01: `REFERENCE_PIZZAS` にない recipe を検出し、#221 の change map が `referencePizza.ts` を含まないことを確認する
  - PIZZA DB の provenance: 量・焼き・説明文・CUT を持たない。#221 の候補を evidence として扱わない
  - Human sign-off: `HUMAN_SIGNOFF` で `countsAsExternalEvidence: false`。PENDING の間は REC-01 が READY にならない
  - REC-02 は allowlist に明示的に入るまで READY にならない。default の shape を CUT 候補にしない
  - REC-03 は Q4 が確定するまで READY にならない。Owner Decision を CONFIRMED にしない。質問は 2〜4 問
  - `completionGate.ts` が CUT を読まず、merged SSOT が CUT を score のみとしている
- `--self-test`: 16 種類の mutation をすべて検出する。
- 既存の checker（`validate_recipe_catalog.py`、`progression2_evidence_invariants.py`）も PASS。
- docs / tooling だけの変更なので、Full Chromium / WebKit と Human Verification の動画は対象外（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）。

## 成果物

- `docs/reports/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_FRESH-AUDIT.md`（この report）
- `docs/reports/data/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_AUDIT.json`（machine-readable companion）
- `tools/progression2_w1_rec_resolution_audit.py`（read-only の generator / checker）と `tools/progression2_w1_rec_resolution_audit.pins.json`

実行の前に authority を fetch する:

```
git fetch origin codex/content-readiness-fresh-audit codex/w1-authoring-fresh-audit claude/w1-ingredient-visual-preview-mt4uxw
python3 tools/progression2_w1_rec_resolution_audit.py --check
```
