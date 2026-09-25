# Progression 2.0 W1 — REC-01〜REC-03 Resolution Fresh Audit

> **2026-09-25 更新（Owner Decision を記録）**: Q1〜Q4 に対する owner の決定を記録し、checker で再計算した。下の「Owner Decision の記録と再計算」が現在の状態。そのあとの「決定前の監査」の節は、決定の前に提示した内容の記録として残してある。

## 結論（Owner Decision 反映後）

| REC | 判定 | 根拠 |
|---|---|---|
| **REC-01** | **RESOLVED**（10/10） | Q1 = APPROVED WITH ONE NORMALIZATION による Human sign-off。Hawaiian の bakeTarget は catalog の 60–80。New Haven は「アメリカ・」を削除した説明文で sign-off。Q2 = KEEP AUTHORED COUNTS（9 / 10 / 9 を維持） |
| **REC-02** | **RESOLVED**（10/10） | Q3: standard round dough の evidence がある 9 件を CUT 対象（6 切れ）。New Haven は CUT なし |
| **REC-03** | **RESOLVED**（10/10） | Q4: Design/Authority Gate は Issue #215 OD-1〜OD-5 で RESOLVED。Implementation Gate（#222 相当の Completion Gate）は production 統合の前提として残す |

- W1 の readiness は **READY 0 / REVIEW 10 / BLOCKED 0**（実 authority から再計算）。W1 は READY にしていない。
- REC とは別に残る dependency: REC-04（10 件）、RT-01（ledger 行 + 実装、3 件）、MD-01（10 件）、REC-03 の Implementation Gate（10 件）、CUT allowlist の実装（9 件）、新 ingredient の実装（slice B、8 件）。
- `src/**` / `e2e/**` / `.github/**`、PR #220 / #221 / #222 は変更していない。W1 recipe、7 ingredient、`referencePizza.ts`、CUT allowlist、Hawaiian の production data はどれも追加・変更していない（checker の `productionGuard` で確認）。PR は作っていない。

## Owner Decision の記録と再計算

記録は `docs/reports/data/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_AUDIT.json` の `ownerDecisions`（`sourceClass: OWNER_DECISION_RECORD`、2026-09-25）。

| ID | 決定 | 内容 |
|---|---|---|
| **Q1 / REC-01** | **APPROVED WITH ONE NORMALIZATION** | 10 件の description / quantities / bake target を #221 の値で承認する。例外は 2 つ。Hawaiian の bakeTarget は既存の production authoring rule（catalog に bakeProfile があればそのまま使う）に合わせて **60–80**。New Haven は PIZZA DB で裏付けのない「アメリカ」の表現を外してから sign-off する |
| **Q2** | **KEEP AUTHORED COUNTS** | Parmigiana 9 / Pizza Portuguesa 10 / Puttanesca 9 を維持し、8 以下に減らさない。3 件は RT-01 の runtime / reference infrastructure に依存させる（RT-01-OD-1 = Candidate B multi-ring は承認済み。`745fbd7` で確認）。RT-01 の実装が終わるまで production recipe として接続しない |
| **Q3 / REC-02** | **APPROVED** | PIZZA DB に standard round dough の根拠がある 9 件を CUT 対象とする（cutSlices = 6）。New Haven Apizza は dough evidence がないので CUT 対象にしない。design matrix の default の round を external evidence として扱わない。dough evidence が後で加われば、別の authority update で CUT を追加できる |
| **Q4 / REC-03** | **APPROVED** | Issue #215 に記録済みの OD-1〜OD-5 を authority として REC-03 を閉じる。#222 の main merge は決定の成立条件にしない。production 実装では #222 相当の Completion Gate が main / 統合対象にあることを dependency とする（Design/Authority Gate と Implementation Gate を分ける） |
| **MD-01** | **IMPLEMENTATION DEPENDENCY として記録** | Owner Decision ではなく AUTHORING / IMPLEMENTATION REQUIREMENT。W1 の 10 件すべてで、production 登録の前に `src/data/referencePizza.ts` の Scoring 2.0 reference fixture が必要。fallback で score / ★ のない recipe を production に入れない。RT-01 の 3 件は、承認済み multi-ring placement の出力をもとに fixture を作る。今は実装しない |

### 確定した値

| 項目 | 値 |
|---|---|
| Hawaiian の bake target | **60–80**（authority: `data/recipes/pizza_master_catalog.json` の bakeProfile。#221 の 58–78 は採用しない） |
| New Haven の description | **オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたニューヘイブン風の一枚。**（「アメリカ・」だけを削除。「ニューヘイブン」は PIZZA DB の nameJa で裏付けがある。56 文字で production の範囲 39〜56 に収まる） |
| CUT 対象（6 切れ） | Hawaiian、Parmigiana Pizza、Bambino、Pizza Portuguesa、Puttanesca、Pesto Caprese、Pesto Tonno、Pesto Patate、Melanzane Pizza |
| New Haven の CUT | **CUT なし**（dough evidence なし。default の round では PASS させない） |
| 9 / 10 / 9 | 維持（Parmigiana 9、Portuguesa 10、Puttanesca 9）。checker が #221 の値との一致を確認 |
| その他 | description / quantity / bake target は #221 の authored values のまま |

### Human sign-off と evidence の区別

- 10 件の sign-off は `HUMAN_SIGNOFF`（`countsAsExternalEvidence: false`、signedBy owner、2026-09-25、basis Q1）。PIZZA DB evidence の層（量・焼き・説明文・CUT を持たない）は変えていない。
- 承認後の値（`final`）の source class は `OWNER_DECISION_RECORD`。PIZZA DB evidence としては記録しない。
- Hawaiian の 60–80 の出どころは社内 catalog（`INTERNAL_CATALOG`）で、外部 evidence ではない。

### 再計算した readiness

readiness の規則: open な ledger 行も実装 dependency もなければ READY、current mechanic で表せなければ BLOCKED、それ以外は REVIEW。

| recipe | open な ledger 行 | 実装 dependency | readiness |
|---|---|---|---|
| New Haven Apizza | REC-04 | MD-01, REC-03-IMPL-GATE, SLICE-B-INGREDIENTS（clam） | REVIEW |
| Hawaiian | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（pineapple） | REVIEW |
| Parmigiana Pizza | RT-01, REC-04 | MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（eggplant） | REVIEW |
| Bambino | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（corn） | REVIEW |
| Pizza Portuguesa | RT-01, REC-04 | MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL | REVIEW |
| Puttanesca | RT-01, REC-04 | MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（capers） | REVIEW |
| Pesto Caprese | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（fresh-tomato） | REVIEW |
| Pesto Tonno | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL | REVIEW |
| Pesto Patate | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（potato） | REVIEW |
| Melanzane Pizza | REC-04 | MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS（eggplant） | REVIEW |

**READY 0 / REVIEW 10 / BLOCKED 0**。ledger 行は `3fc02a0` の ledger の open refs から REC-01〜03 を除いたもの。MD-01 と実装系の項目は REC 行に混ぜず、`implementationDependencies` に分けてある。

---

# 決定前の監査（Owner Decision の前に提示した内容）

## 決定前の結論（記録）

- 決定前は REC-01 / REC-02 / REC-03 とも NOT READY で、Owner に 4 問（Q1〜Q4）を出した。MD-01 はこの段階で見つけた。

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

### Human が見るもの（REC-01、決定前）

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

## Owner Decision の選択肢（決定前に提示したもの）

決定の結果は上の「Owner Decision の記録と再計算」を参照（Q1 = A に New Haven の文言修正を加えたもの、Q2 = A、Q3 = A、Q4 = A）。

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


## Human Review Pack

Owner Decision を反映した後の値。決定前の候補値と違う箇所は、その欄に #221 の値を併記した。

<!-- BEGIN GENERATED: HUMAN REVIEW PACK (tools/progression2_w1_rec_resolution_audit.py) -->

### ニューヘイブンアピッツァ（`new-haven-apizza`）

| 項目 | 内容 |
|---|---|
| Recipe | オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたニューヘイブン風の一枚。（Q1 で「アメリカ・」を削除。#221: オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたアメリカ・ニューヘイブン風の一枚。） |
| Evidence | PIZZA DB `new-haven-apizza-pizzadb`（comparison_table_sample）: ニューヘイブンアピッツァ / 生地 記載なし / ソース オイル / origin 記載なし。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | オリーブオイル（olive-oil）、パルミジャーノ（parmigiano）、あさり（clam）、にんにく（garlic） |
| Quantity | olive-oil×1 / parmigiano×2 / clam×3 / garlic×2（ソース以外 7 個） |
| Bake target | 62–82（#221 の値を承認） |
| CUT | CUT なし（Q3）。生地の evidence がない（design matrix の round は default なので根拠にしない） |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1 (after the approved normalization)、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — EVIDENCE_INSUFFICIENT → CUT なし（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, SLICE-B-INGREDIENTS |

### ハワイアンピザ（`hawaiian`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハムとパイナップル、モッツァレラを合わせた、甘みと塩気のバランスが楽しい一枚。 |
| Evidence | PIZZA DB `hawaiian-pizzadb-row`（individual_profile_page）: ハワイアンピザ / 生地 薄めの生地 / ソース トマトソース / origin カナダ / オンタリオ州。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、パイナップル（pineapple） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×2 / pineapple×3（ソース以外 7 個） |
| Bake target | 60–80（Q1: catalog の値を採用。#221 は 58–78） |
| CUT | CUT 対象（6 切れ）。生地 薄めの生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1 (after the approved normalization)、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### パルミジャーナピザ（`parmigiana-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにナス、モッツァレラ、パルミジャーノ、バジルを合わせた南イタリア風の一枚。 |
| Evidence | PIZZA DB `parmigiana-pizza-pizzadb-p7`（comparison_table_sample）: パルミジャーナピザ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / 南イタリア。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ナス（eggplant）、パルミジャーノ（parmigiano）、バジル（basil） |
| Quantity | tomato-sauce×1 / mozzarella×2 / eggplant×3 / parmigiano×2 / basil×2（ソース以外 9 個）。Q2: 減らさない。RT-01（RT-01-OD-1 Candidate B）の実装が前提 |
| Bake target | 58–78（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: RT-01, REC-04 / 実装: MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### バンビーノ（`bambino`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハム、コーン、モッツァレラをのせた、やさしい甘みで親しみやすい一枚。 |
| Evidence | PIZZA DB `bambino-pizzadb-p7`（comparison_table_sample）: バンビーノ / 生地 ピッツァ生地 / ソース トマトソース / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、コーン（corn） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×2 / corn×3（ソース以外 7 個） |
| Bake target | 56–76（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### ピッツァ・ポルトゲーザ（`pizza-portuguesa`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにハム、卵、たまねぎ、ブラックオリーブ、モッツァレラを重ねたブラジル定番の一枚。 |
| Evidence | PIZZA DB `pizza-portuguesa-pizzadb-p9`（comparison_table_sample）: ピッツァ・ポルトゲーザ / 生地 薄めの生地 / ソース トマトソース / origin ブラジル / サンパウロ。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ハム（ham）、たまご（egg）、たまねぎ（onion）、ブラックオリーブ（black-olive） |
| Quantity | tomato-sauce×1 / mozzarella×2 / ham×3 / egg×1 / onion×2 / black-olive×2（ソース以外 10 個）。Q2: 減らさない。RT-01（RT-01-OD-1 Candidate B）の実装が前提 |
| Bake target | 58–78（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 薄めの生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: RT-01, REC-04 / 実装: MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL |

### プッタネスカ（`puttanesca-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにアンチョビ、ブラックオリーブ、ケッパー、にんにくを効かせた、塩味と香りの強い一枚。 |
| Evidence | PIZZA DB `puttanesca-pizza-pizzadb-p10`（comparison_table_sample）: プッタネスカ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / ナポリ。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、アンチョビ（anchovy）、ブラックオリーブ（black-olive）、ケッパー（capers）、にんにく（garlic） |
| Quantity | tomato-sauce×1 / anchovy×3 / black-olive×2 / capers×2 / garlic×2（ソース以外 9 個）。Q2: 減らさない。RT-01（RT-01-OD-1 Candidate B）の実装が前提 |
| Bake target | 50–70（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: RT-01, REC-04 / 実装: MD-01, RT-01-IMPL, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### ペストカプレーゼピザ（`pesto-caprese`）

| 項目 | 内容 |
|---|---|
| Recipe | ジェノベーゼソースにトマト、モッツァレラ、バジルを重ねた、カプレーゼ仕立ての爽やかな一枚。 |
| Evidence | PIZZA DB `pesto-caprese-pizzadb-p11`（comparison_table_sample）: ペストカプレーゼピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、モッツァレラ（mozzarella）、トマト（fresh-tomato）、バジル（basil） |
| Quantity | pesto×1 / mozzarella×2 / fresh-tomato×3 / basil×2（ソース以外 7 個） |
| Bake target | 50–70（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### ペストトンノピザ（`pesto-tonno`）

| 項目 | 内容 |
|---|---|
| Recipe | 香り高いジェノベーゼソースに、ツナ、ブラックオリーブ、たまねぎを合わせた爽やかな一枚。 |
| Evidence | PIZZA DB `pesto-tonno-pizzadb-p12`（comparison_table_sample）: ペストトンノピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、ツナ（tuna）、ブラックオリーブ（black-olive）、たまねぎ（onion） |
| Quantity | pesto×1 / tuna×3 / black-olive×2 / onion×2（ソース以外 7 個） |
| Bake target | 50–70（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL |

### ペストパターテピザ（`pesto-patate`）

| 項目 | 内容 |
|---|---|
| Recipe | ジェノベーゼソースにじゃがいも、ベーコン、モッツァレラを合わせた、ほくほくと香ばしい一枚。 |
| Evidence | PIZZA DB `pesto-patate-pizzadb-p12`（comparison_table_sample）: ペストパターテピザ / 生地 ナポリピッツァ生地 / ソース バジル / origin イタリア / 各地。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | ジェノベーゼソース（pesto）、モッツァレラ（mozzarella）、じゃがいも（potato）、ベーコン（bacon） |
| Quantity | pesto×1 / mozzarella×2 / potato×3 / bacon×2（ソース以外 7 個） |
| Bake target | 58–78（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

### メランザーネピザ（`melanzane-pizza`）

| 項目 | 内容 |
|---|---|
| Recipe | トマトソースにナス、モッツァレラ、バジルを合わせた、素朴で香り豊かな南イタリア風ピザ。 |
| Evidence | PIZZA DB `melanzane-pizza-pizzadb-p13`（comparison_table_sample）: メランザーネピザ / 生地 ナポリピッツァ生地 / ソース トマトソース / origin イタリア / 南部。量・焼き・説明文・CUT は PIZZA DB に含まれない |
| Ingredients | トマトソース（tomato-sauce）、モッツァレラ（mozzarella）、ナス（eggplant）、バジル（basil） |
| Quantity | tomato-sauce×1 / mozzarella×2 / eggplant×3 / basil×2（ソース以外 7 個） |
| Bake target | 58–78（#221 の値を承認） |
| CUT | CUT 対象（6 切れ）。生地 ナポリピッツァ生地 |
| REC-01 status | **RESOLVED** — Human sign-off SIGNED（Q1、外部 evidence ではない） |
| REC-02 status | **RESOLVED** — CUT_CANDIDATE → CUT 対象（Q3。allowlist の変更は実装時） |
| REC-03 status | **RESOLVED** — Design/Authority Gate: Issue #215 OD-1〜5。Implementation Gate: #222 相当が必要 |
| Readiness | **REVIEW** — ledger: REC-04 / 実装: MD-01, REC-03-IMPL-GATE, CUT-ALLOWLIST-IMPL, SLICE-B-INGREDIENTS |

<!-- END GENERATED: HUMAN REVIEW PACK -->

## Verification

- `python3 tools/progression2_w1_rec_resolution_audit.py --check`: PASS。入力 21 個（RT-01-OD-1 の記録 `745fbd7` を追加）の sha256 を `tools/progression2_w1_rec_resolution_audit.pins.json` で固定し、JSON と、この report の Review Pack が byte 単位で再生成できることを確認する。確認する invariant:
  - W1 が 10 件あり、#220 の authority・#221 の matrix・`3fc02a0` の ledger・この audit の recipe 集合が一致する。#220 / #221 の remote tip が pin と一致する
  - `3fc02a0` の ledger が記録した #221 / #220 の hash と実際の入力が一致する（provenance chain）
  - 記録する Owner Decision は Q1〜Q4 だけで、どれも source / 日付 / 場所を持つ。RT-01-OD-1 の承認文が pin した commit にある
  - REC-01: Human sign-off は `HUMAN_SIGNOFF` / `countsAsExternalEvidence: false`。signer と日付と Q1 があるときだけ RESOLVED。承認後の値は地名がすべて PIZZA DB で裏付けられ、必須の具材をすべて書いている。Hawaiian 以外の bakeTarget、New Haven 以外の description、全 recipe の quantity は #221 から変わっていない。catalog に値がある recipe は catalog の bakeTarget を使う
  - Q2: 9 / 10 / 9 は減っていない。8 を超える recipe には RT-01-IMPL の dependency がある
  - REC-02: CUT を有効にするのは、明示的な dough evidence のある CUT_CANDIDATE だけ（default の round では有効にしない）。cutSlices は 6。allowlist は変更していない
  - REC-03: Q4 と Design Gate があるときだけ RESOLVED。Implementation Gate（#222 相当）は REQUIRED のまま残る
  - MD-01: `REFERENCE_PIZZAS` にない recipe すべてで、REC 行ではなく実装 dependency として残る
  - REC-04 は open のまま。readiness は per-recipe の dependency と summary が一致し、READY にしない
  - production guard: W1 の id が `recipes.ts`・CUT allowlist・`REFERENCE_PIZZAS` のどれにも入っていない
  - PIZZA DB の provenance を変えていない。`completionGate.ts` は CUT を読まない
- `--self-test`: 31 種類の mutation をすべて検出する（例: New Haven の CUT を default の round で有効にする、Hawaiian を 58–78 に戻す、Portuguesa を 8 個に減らす、RT-01 / MD-01 / Implementation Gate の dependency を消す、sign-off を evidence 扱いにする、W1 を READY にする、Owner Decision を追加で作る）。
- 既存の checker（`validate_recipe_catalog.py`、`progression2_evidence_invariants.py`、`progression2_mechanic_matrix.py --check`）も PASS。
- docs / tooling だけの変更なので、Full Chromium / WebKit と Human Verification の動画は対象外（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）。

## 成果物

- `docs/reports/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_FRESH-AUDIT.md`（この report）
- `docs/reports/data/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_AUDIT.json`（machine-readable companion）
- `tools/progression2_w1_rec_resolution_audit.py`（read-only の generator / checker）と `tools/progression2_w1_rec_resolution_audit.pins.json`

実行の前に authority を fetch する:

```
git fetch origin codex/content-readiness-fresh-audit codex/w1-authoring-fresh-audit claude/w1-ingredient-visual-preview-mt4uxw claude/rt-01-pizza-piece-capacity-1ncicd
python3 tools/progression2_w1_rec_resolution_audit.py --check
```
