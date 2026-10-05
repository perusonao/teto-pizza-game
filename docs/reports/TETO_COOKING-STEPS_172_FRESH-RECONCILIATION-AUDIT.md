# TETO Cooking Steps / 172 Recipes — Fresh Reconciliation Audit（READ-ONLY / docs-only）

| 項目 | 値 |
|---|---|
| **Audited `origin/main` SHA** | `9e7484b39fd81c31e8b84a18c6b961f5f3bc24a8`（2026-10-06 00:55 JST、#404 DEV State Editor）。`git fetch` 直後に確認。ローカル HEAD と一致 |
| 性質 | docs-only の audit。`src/**`、e2e、CSS、runtime、save、tooling の変更なし。実装・Issue・PR は作っていない |
| PR #401 | **未接触。** branch、HEAD、working tree、ファイルとも変更なし。merge / push / CI rerun / Preview deploy もしていない（open PR 一覧の `head.ref` を読んだだけ） |
| Human Verification | 不要（UI / UX / gameplay の変更なし。docs-only の audit は `TETO_HUMAN-VERIFICATION-POLICY.md` の対象外）。動画・screenshot なし |
| 検証の限界 | `node_modules` が無く、Vitest / tsc は実行していない。件数は (a) main のファイルの読取り、(b) PR #295 の read-only classifier を main に対して実行した結果、(c) `recipes.ts` / `ingredients.ts` / `cookingProfiles.ts` の機械的な集計から出した。runtime の挙動検証ではない |

**結論 1 行:** 追加 mechanic なしで **39 recipe（32 → 71）** まで増やせる。ただしその内訳（標準 sauce 10 / 新 sauce 8 / no-sauce 21）はそれぞれ別の前提を持つ。次の Cooking mechanic は、承認済みの順序（CS-1b → CS-2 → TQ-2 late）と recipe 解禁数の証拠（late は 2 recipe、DOUGH_VARIANT は 8、MULTI_SPREAD は 9）が食い違う。**どちらを採るかは Owner Decision に残す。**

---

## 0. 要点（依頼の 10 問への回答）

| # | 問い | 回答 |
|---|---|---|
| 1 | 32 から追加 mechanic なしで安全に何 recipe まで? | **+39 → 71 recipe**。条件: 172 行のうち未出荷 145 行から、mechanic 不要（A / B 区分）かつ authority 不足なし（E 以外）かつ content blocker なし（未解決材料・組成競合なし）のもの。内訳は §5 W0a / W0b / W0c。**「安全」の強さは 3 段階で違う**（W0a が最も強い） |
| 2 | 次に実装すべき Cooking mechanic は? | **承認済み順序:** CS-1b（`finalizeRound` seam）→ CS-2（FINISH engine、inert）→ TQ-2（late 活性化）。**新証拠:** late の解禁は eligible 2 recipe だけ。DOUGH_VARIANT 8、MULTI_SPREAD 9。順序を変えるかは **OD-N4**（§8）。このauditは決めない |
| 3 | CS-1 / TQ-2 / TQ-3 の位置付け | **CS-1a:** 実装済みだが **main に無い**（PR #295 が open。base は `86b48fd` で古い）。**CS-1b:** blocker だった #275 は 2026-09-30 に merged、未着手。**TQ-2 / TQ-3:** 未着手。docs の一行記述だけ（OD Gate §6 後段）。Techniques registry は `no-sauce` の 1 件のみ |
| 4 | NO_SAUCE はどこまで完了? | **mechanic は完了:** TQ-1A〜1D が main（#398 `d144f08`）。Production recipe は `aussie` 1 件。**残り:** 追加 no-sauce recipe は P9 により 1 PR ごとに Hint 5.0 / DH4 privacy の再 audit が要る。no-sauce の定義が資料間で食い違う（§4 C4）。`TQ-1E` は SSOT 上「未着手」のまま |
| 5 | CUT はどこまで Production 化? | **32 recipe 中 24 recipe** が allowlist。6 slice 固定、円形のみ。`cutScore` は Scoring 2.0 の合計外。#256（bake 失敗で CUT を skip）は #275 で merged。**未実装:** shape-aware CUT、CUT scoring の拡張（#288 CUT-S4、main の docs に無い） |
| 6 | late-addition で何 recipe 解禁? | late は 12 行（post_bake 8 / mid_bake 3 / 未解決 1）。**post_bake の engine で解禁できるのは 6 行 → eligible 2**（bbq-chicken、wasabi-beef）。残り 4 行は content blocker 2、authority 不足 2。mid_bake 3 は別 mechanic（MAJOR） |
| 7 | multi-spread で何 recipe? | 必要としている行は 15（未出荷）。**単独で解禁できるのは 14 行 → eligible 9**（content blocker 3、authority 不足 2）。MAJOR 扱い（§4 C3） |
| 8 | shape / pan / piadina で何 recipe? | **pan 8 行・shape 5 行は、単独では 0 行。** どの行も DOUGH_VARIANT など別 mechanic を併せ持つ（matrix も「Unlocked alone = 0」）。DOUGH_VARIANT の後なら pan +4（eligible 2）、shape +5（eligible 1）。**piadina は DOUGH_VARIANT 側（1 行）。** griddle・後乗せ filling は evidence に無い（OD-CS-13） |
| 9 | 順序を変える新証拠は? | **ある**（§4 C5、§5）: (1) late は 2 recipe しか解禁しない。(2) DOUGH_VARIANT は pan / shape / piadina / 3 つの collision の前提。(3) #275 が merged で CS-1b の blocker は解消。(4) no-sauce が TQ-1D で解禁済みなので W0c が mechanic 不要になった。**変更は Owner が決める** |
| 10 | 最も安全な Wave 構成 | §5。**W0（mechanic 不要）→ W1 seam（0 recipe）→ W2 late → W3 dough → W4 multi-spread → …。** 件数ではなく mechanic dependency で構成 |

---

## 1. 既存 authority の特定（捨てずに、どれが生きているかを明示）

| 領域 | Authority | 所在 | 状態 |
|---|---|---|---|
| Cooking Steps の基本設計（`MakingStep` / `CookingProfile` / POST_BAKE / Step Timing） | `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` | main | **生きている**。Phase 1A / 1A-T / 1B（CUT）は実装済み。§19 の 53 recipe matrix・§21 の roadmap は古い（15 recipe 時点） |
| CUT | `docs/design/TETO_PIZZA-CUTTING_1.0.md` + Phase 1〜4B の Result | main | 生きている。Phase 4B が allowlist 方式を決めた |
| 172 recipe の mechanic matrix（11 capability） | `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` + JSON（+ `_ROWS.md`） | main | **evidence 部分は生きている。** `shippedRecipeIds`（15）、`src` 由来の header は古い（Issue #260）。JSON が文章に優先 |
| Techniques（NO_SAUCE / late / multi-spread の分類） | `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`（本書が詳細文書に優先）、OWNER-DECISION-GATE、FINAL-IMPLEMENTATION-GATE | main | 生きている。**SSOT §6 の TQ-1D「PR で最終確認中」は古い**（#398 merged） |
| TQ-1A〜1D の実装記録 | `docs/reports/TETO_TQ-1{A,B,C,D}_*_Result.md` | main | 実装済み。TQ-1D の HV 動画は 390×844 PASS |
| **Post-W1 Cooking Steps の設計・Owner Decision（OD-CS-1/2/9a/20）・172 classification** | `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`、`..._CS-1_PRE-START-GATE.md`、`..._CS-1A_Result.md`、classifier 一式 | **PR #295（open、main に無い）** | **最新の Cooking Steps authority。ただし未 merge。** base `86b48fd`（現 main より 70 commit 古い）。§13 の Owner Decision は文書内にのみ存在 |
| Post-W1 Phase 1 Fresh Audit（元の authority audit） | `TETO_POST-W1_COOKING-STEPS_PHASE1_FRESH-AUDIT.md` | PR #295 に unchanged で import（元は branch `claude/teto-cooking-steps-audit-vyx88k` `0d7b489`） | 設計 doc §1.2 が「4 つの delta」で更新済み。`LATE_ADDITION を Phase 1 として production に出す` は OD-TQ-2 と矛盾するため置換された |
| Research 2.0 | `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md` | main | Phase 0 + 1 は merged（#402）。Phase 2〜4 は承認のみ、未実装 |
| Progression / Expansion の運用 | `PROJECT_HANDOFF.md` addenda、`TETO_EXPANSION-*_Result.md` | main | 生きている。**1 Wave = 1 PR、ladder は append-only（steps 1〜28 凍結）** |
| Hint 5.0 / DH4 privacy tripwire | `hint5Production.gate.test.ts`、`deductionProduction.gate.test.ts` | main（実装・test） | Production で ON。`aussie` だけが sauceless / technique 要求と固定されている |
| 周辺の unmerged authority | #296（172 Taxonomy / HCG）、#293（Hint 5.0 coverage、62 材料 / 172 recipe）、#255（OD-TAX） | open PR | **本 audit では本文を読んでいない**（§7 U5） |

---

## 2. 最新 main の事実

| 項目 | 値 | 根拠 |
|---|---|---|
| Production recipe | **32**（aussie が No.32） | `src/data/recipes.ts`、handoff addendum 4 |
| Ingredient | 34（sauce 3 / topping 27 / cheese 4） | `ingredients.ts`、Wave 2 / TQ-1D の記録 |
| Sauce（paint 対応） | `tomato-sauce` / `olive-oil` / `pesto` の **3 種に限る** | `RecipeSauceProfile.ingredientId` の型。`aussie` は `null` |
| ladder | 28 step（append-only、steps 1〜28 凍結）。credited 30、`ladderCredit:false` 2、`lunchRush:false` 7 | Wave 2 / TQ-1D |
| Tab 数（機械集計） | **6 tab × 18 recipe、5 tab × 9、4 tab × 5**（最大 6） | 材料 category + CUT allowlist から再計算。**tab 上限の test invariant は main に無い**（CS-1a が持つ。PR #295） |
| CUT allowlist | 24 / 32。非 CUT 8 = new-haven-apizza、brazilian-calabresa、pesto-pollo、pesto-gamberi、vongole、pesto-vegetariana、ratatouille-pizza、aussie | `cookingProfiles.ts` |
| `COOKING_PROFILE_OVERRIDES` | 空 | 同上 |
| `GamePhase` / `MakingStep` | `POST_BAKE` あり。`FOLD` / `SEAL` / `EDGE_FILL` / `FINISH` は型だけで gameplay も UI もない（`screens` / `components` に `FINISH` の参照なし） | `gameReducer.ts:126,143` |
| BAKE | 単一 bake window、M3A の Guide fade、Completion Gate の UNDERBAKED / OVERBAKED、bake target は recipe ごと。pan 曲線・split bake・fry は無い | handoff addendum、reducer |
| Techniques | registry は `no-sauce` のみ。save は `discoveredTechniqueIds`（schema bump なし、v2） | `techniques.ts`、SSOT §4 |
| Hint 5.0 | **Production ON**（H5-6）。`aussie` は key-free で SAUCE rung を持たない | `hint5Flag.ts` |
| Research | Phase 1（Cohort Letter）merged。**53 / 172 population の前に Research 識別子の互換を Fresh Gate で再 audit する**と明記 | Research 2.0 OD、handoff addendum 5 |
| Lunch Rush / Dinner | Dinner は START_BAKE で identity を確定（late recipe は識別不能になる）。Lunch Rush は ruleset `lunch-rush-v1` | Post-W1 §1.2 D4、#275 |
| 同じ main の open PR | #401（触らない）、#391、#321、#296、#295、#293 ほか | GitHub |

---

## 3. 古くなった計画（置き換えではなく「どこが古いか」）

| 古くなった記述 | 出所 | 新しい事実 / 置換元 |
|---|---|---|
| shipped = 15 recipe / 22 ingredient、`shippedRecipeIds` が 15 | 172 matrix header、Cooking Steps 1.0 §2.4 / §19 | **32 / 34**。matrix の evidence 行は有効、header は無効（#260） |
| 25 runtime recipe、tab 数 18 / 7 | Post-W1 design §1 | 32 recipe、tab 数 18 / 9 / 5。**ceiling が binding なのは 6 tab の 18 recipe のまま** |
| 「no-sauce は production gate 待ち（TQ-1D）」、`ReferencePizza.sauce` は non-null | Post-W1 §1.2 D2、§3.3 | TQ-1D が #398 で merged。`sauce` は nullable。no-sauce の **mechanic は完了** |
| 「CS-1 は #275 が解決するまで WAIT」 | Post-W1 Pre-start Gate、§11 G-CS-B | #275 は 2026-09-30 merged。**blocker 解消**（ただし CS-1b は rebase が必要） |
| 「Phase 1 = LATE_ADDITION を production content 付きで」 | 元の authority audit | OD-TQ-2 により late は TQ-2（Technique）。**Cooking Steps は engine のみ（OD-CS-1 = A）** |
| 代表 recipe = prosciutto e rucola | 元の authority audit §11 | late の evidence が無い（OD-TQ-12）。**BBQ チキン**（OD-CS-10 の推奨） |
| TQ-1D「PR で最終確認中」、handoff「PR pending Final Gate」 | SSOT §6、handoff addendum 4 | `git log`: #398 `d144f08` が merged |
| 「Wave 2」（material 追跡の W2-A〜D） | Techniques Gate §6（TQ-3 は W2-D と共有基盤） | 名称が衝突: Production の「Expansion Wave 2」（#389）とは別物。**TQ-3 の前提が何かは再確認が要る**（§7 U7） |
| Cooking Steps 1.0 §21 の roadmap（Phase 2A FINISH を最優先、MULTI_SAUCE は modifier） | 1.0 | Post-W1 §5 が置換（seam → FINISH engine → TQ-2）。multi-spread は MAJOR + TQ-3 |

---

## 4. 資料同士の矛盾（authority / newer evidence / conflict）

勝手にどちらかを採用しない。Owner の判断が要るものは §8 に載せる。

| ID | 主題 | 資料 A | 資料 B | 新しい evidence | 扱い |
|---|---|---|---|---|---|
| C1 | late の出荷方法 | 元の authority audit: Phase 1 で production content を出す | OD-TQ-2: late は Technique（TQ-2）。Post-W1 OD-CS-1 = A: Cooking Steps は inert engine まで | — | **解決済み（OD-CS-1 = A）。ただしその Owner Decision は未 merge の #295 にしか無い** |
| C2 | 実装順 | matrix §5（greedy）: DOUGH_VARIANT → MULTI_SPREAD → LATE | Post-W1 §5 / OD Gate §6: seam → FINISH → TQ-2（late）→ TQ-3（multi）。dough は CS-7 で後 | **recipe 解禁数: late 2 / dough 8 / multi 9**（eligible。§5）。dough と multi は late の完了を必要としない | **未解決 → OD-N4** |
| C3 | MULTI_SPREAD の難度 | matrix: M、非 structural | Post-W1: **MAJOR**（multi-entry `sauceIds`、2 層 heatmap、score、reference、Hint G7、technique）。Cooking Steps 1.0 §3.3: modifier | Post-W1 が自分で「audit の small–medium を訂正」と明記 | Post-W1 を採るのが整合的だが、これは未 merge 文書。**OD-N5 の対象** |
| C4 | 「no sauce」の定義 | TQ: `requiredTechniquesOf` = spread layer なし | matrix: 44 行が `none`。**うち 33 行は family 表記「チーズ」から導いた**（明示の「ノンソース」は 10 + 1）。出荷済み quattro-formaggi は olive-oil を使うのに matrix 行は `none`（OD-CS-15）。Wave 2 は vongole の olive-oil を「no-sauce family = olive-oil ではない」と明記。Hint 側 PR #293 K3 も「定義が 2 つ」と記録 | main の `deductionProduction.gate` は「technique 要求は `["aussie"]` のみ」を固定 | **未解決 → OD-N2。W0c の件数（21）はこの定義に依存する** |
| C5 | no-sauce は「DATA_ONLY」か | Post-W1: DATA_ONLY（engine と scoring は TQ-1B で完了） | SSOT P9 / OD-TQ-18: aussie 以外の recipe が technique を要求する PR は Hint 5.0 / DH4 を**再 audit**（gate は意図的に fail する） | TQ-1D の gate は main で `["aussie"]` に固定 | **「mechanic は不要」だが「無条件の data 追加」ではない。** B3 に前提として書く |
| C6 | piadina | Post-W1: SMALL（DOUGH_VARIANT + no-sauce） | OD-TQ-2 C3: piadina = dough（材料）× no-sauce（technique）。griddle / 後乗せ / fold-to-serve は evidence に無い（OD-CS-13） | — | dough の model 決定（OD-CS-12）を待つ。現行 evidence の範囲なら DOUGH_VARIANT で足りる |
| C7 | 「Technique か Mechanic か」: pan / shape / enclose | OD-TQ-2: 後段・未決 | Post-W1 OD-CS-18: defer | — | 未決のまま。**これら 3 つの technique 化は privacy 再 audit を伴う** |
| C8 | DOUGH_VARIANT の model | Post-W1 OD-CS-12: Fresh Audit が先 | matrix §4: data-level の dough base（S 級） | Hint 5.0 に dough rung は無く、dough を材料にすると STRUCTURE 総数が変わる（H9）。#216 / #255 と競合 | **未解決** |
| C9 | 状態表記 | SSOT: TQ-1E 未着手 | TQ-1D Result: HV を同 PR で実施（PASS） | — | 文書の更新漏れ。**どちらが正かは Owner に確認**（U4） |

---

## 5. Wave 構成（mechanic dependency）

### 5.1 前提と数え方

- 母集団: `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` の 172 行（evidence の欠落なし、unique、matrix 検証済み）。
- **出荷済みと対応するのは 27 行。** 残り 145 行が未出荷。**出荷済み 5 recipe（funghi、napoletana、pepperoni、pizza-bianca、salsiccia）は 172 行のどれにも決定的に対応しない**（§7 U1）。以下の「cumulative」は Production recipe 数（= 32 + eligible）で、`172 行カバー数`（= 27 + eligible）は併記する。
- **eligible** = 未出荷 かつ authority 不足（E）でない かつ content blocker（未解決材料 / 組成競合 / collision）が無い行。
- 「追加可能 recipe 数」は **その Wave で新たに eligible になる行数**。content blocker の行と E の行は別列に数える。
- 材料数は `ingredients.canonicalIngredientIds` から、現行 34 材料に無い id を重複排除して数えた。**ladder step 数ではない**（1 step に複数材料が載り得る）ので上限の目安。

### 5.2 区分 A〜E（172 行）

| 区分 | 定義 | 出荷済み（27 行中） | 未出荷（145 行） |
|---|---|---:|---:|
| **A** 現行 mechanic で表現可能 | 既存の sauce / 材料 / CUT allowlist のみ | 17 | 3 |
| **B** data / profile 追加のみ | 新材料、新 sauce、no-sauce、CUT opt-out | 6 | 48 |
| **C** small mechanic extension | DOUGH_VARIANT、STEP_ORDER、ZONED、LATE post_bake | 1 | 18 |
| **D** 新 mechanic | MULTI_SPREAD、PAN、SHAPE、ENCLOSE、PREP、mid_bake、FRY、LAMINATE | 2 | 28 |
| **E** authority 不足 | base sauce 不明 33、mechanic 解釈 11、sauce 未解決 3、scope 2、evidence 欠落 2 | 1 | 48 |

- 出荷済み 27 行のうち C / D / E の 4 行（marinara、margherita ほか）は、OD-CS-15 に従い「出荷済みのまま」。
- E の 48 行を解消した場合の区分: A 2 / **B 29** / C 9 / D 7 / まだ E 1。
- 全 172 行の区分は Appendix。分類は `docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify.py`（PR #295）を main に対して read-only で実行した。**規則は変えていない**（no-sauce と新 sauce は B のまま。実装済みの TQ-1D を反映しても区分は変わらない）。

### 5.3 mechanic ごとの解禁数（未出荷 145 行）

| mechanic（Post-W1 の区分） | 必要とする行 | うち eligible | 単独で足りる行 | 単独 かつ eligible | 備考 |
|---|---:|---:|---:|---:|---|
| DOUGH_VARIANT（C） | 32 | 13 | 19 | 8 | 他 mechanic の前提になる hub |
| MULTI_SPREAD_LAYER（D） | 15 | 9 | 11 | 9 | 10 行が olive-oil を含む |
| LATE_ADDITION post_bake（C） | 8 | 2 | 6 | 2 | eligible = bbq-chicken、wasabi-beef |
| PAN_BAKE（D） | 8 | 3 | 0 | 0 | **単独で 0** |
| ENCLOSE（D） | 5 | 3 | 2 | 1 | |
| DOUGH_SHAPE_TARGET（D） | 5 | 1 | 0 | 0 | **単独で 0**。pide 以外は PAN も要る |
| LATE_ADDITION mid_bake（D） | 3 | 1 | 2 | 1 | |
| PREP_STEP（D） | 3 | 1 | 2 | 1 | |
| STEP_ORDER（C） | 2 | 1 | 1 | 1 | Trenton |
| ZONED_PLACEMENT（C） | 1 | 1 | 1 | 1 | quattro stagioni |
| FRY_COOK（D） | 1 | 1 | 1 | 1 | |
| LAMINATE（D） | 1 | 0 | 0 | 0 | scope 疑問（feteer） |
| LATE_ADDITION 未解決（eel） | 1 | 0 | 1 | 0 | |

複数 mechanic を要する行: 2 つが 13 行、3 つが 3 行、4 つが 1 行。

### 5.4 Wave 一覧

mechanic の並びは**承認済みの順序（C2 の B）を基準**にし、C2 の A（yield 順）はその下の §5.5 で比較する。

| Wave | prerequisite | mechanic | 追加可能（eligible） | cumulative（Production） | 172 行カバー | content blocker / E | 新材料（累計） | Research への影響 | progression への影響 | inventory への影響 | save migration | Owner Decision |
|---|---|---|---:|---:|---:|---|---:|---|---|---|---|---|
| **W0a** 標準 sauce | なし（既存 Expansion Wave の手順） | なし（A / B） | **10** | 42 | 37 | 6 / 15 | 12 | cohort が増える。letter は表示のみで save しない | ladder 追記（steps 1〜28 凍結）。key recipe と slack の再計算 | 材料追加。HAND 12、tray pager | **なし**（v2） | 各 PR の内容承認のみ |
| **W0b** 新 spread sauce | W0a と同じ + **sauce 型の拡張**（`RecipeSauceProfile.ingredientId` は 3 種に閉じている）、sauce の見た目と Reference の target を確認（U3） | なし（B、code 型の拡張を伴う） | **8** | 50 | 45 | 1 / 12 | 31 | 同上。**Hint SAUCE rung は 1 sauce のままなので G7 は通る** | 同上 | 同上 + sauce 材料 | なし | **OD-N6**（新 sauce 材料の方針） |
| **W0c** no-sauce | **OD-N2**（定義）、P9 の Hint 5.0 / DH4 再 audit（1 回にまとめる）。**cumulative 53 を超える前に Research 識別子の Fresh Gate**（OD R2 の明記） | なし（TQ-1D の mechanic を再利用） | **21** | **71** | 66 | 5 / 4 | 50 | **最大の影響。** Technique 発見経路、「ソースなし」の privacy、Notebook。Research Entry pool の兄弟増 | 同上 | 同上（26 材料） | なし（technique 台帳は既存） | OD-N1、OD-N2 |
| **W1** post-bake seam | **#295 の扱い（OD-N5）**。CS-1a の rebase、`finalizeRound` の golden（25 → 32 recipe × FREE / LR / Dinner × bake band） | CS-1b → CS-2（FINISH engine、**inert**）。`applicationPhase` は test fixture のみ | **0** | 71 | 66 | — | — | なし（production 不可視） | なし | なし | なし | OD-CS-3 / 11（既決の OD-CS-1 / 2 / 9a / 20 を ratify） |
| **W2** late post_bake = TQ-2 | W1、TQ-1D ✓、OD-CS-4 / 5 / 6 / 7 / 8 / 10、Hint 再 audit、**HV 必須** | LATE_ADDITION post_bake。FINISH、late 軸 OBSERVED、near-miss DIMENSION | **2** | 73 | 68 | 2 / 2 | 55 | Technique `post-bake`（kebab 例）の privacy。**Dinner は late recipe を除外**（推奨）。Lunch Rush は #224 と一緒に決める | tab を増やす（7 tab 対策は CS-4。OD-CS-9b） | 新材料 5 | **なし**（`discoveredTechniqueIds` に id 追加のみ。schema bump なし） | OD-CS-4〜8 / 10 |
| **W3** dough | **OD-CS-12 の Fresh Audit**（dough = 材料 / DOUGH step の選択 / recipe 固定）、#216、#255 taxonomy、Hint に dough rung が無い問題（H9） | DOUGH_VARIANT。`dough` 軸、collision の分離（pinsa / jamon-serrano ほか） | **8**（piadina を含む） | 81 | 76 | 4 / 7 | 60 | 発見 identity に dough 次元が加わる。**hint の隠れ次元** | dough を材料にすると ladder / shop に影響 | dough を材料にすると inventory に影響 | model 次第（材料なら no / 型の変更が要るなら要確認） | **OD-CS-12** |
| **W4** multi-spread = TQ-3 | W2（OD Gate の順序）、**OD-CS-14**（層の timing / gesture）、Hint の G7 / SAUCE rung 再 audit、新 gesture の Human-Feel | MULTI_SPREAD_LAYER | **9** | 90 | 85 | 3 / 2 | 66 | **SAUCE rung が 2 sauce を示す = identity 漏れ。** G7 は意図的に fail する | 新 gesture | 2 層目の sauce 材料 | なし（想定） | OD-CS-14、OD-H5-P4 |
| **W5** 小さな pre-bake 変種 | 各 mechanic の Fresh Audit | STEP_ORDER（Trenton）、ZONED（quattro stagioni） | **2** | 92 | 87 | 0 / 0 | 66 | 小（layerOrder / zones 軸。zones は現状 UNAVAILABLE） | 小 | 小 | なし | 各 audit |
| **W6** pan | W3（pan 行は全て DOUGH_VARIANT を併せ持つ） | PAN_BAKE | **2**（montreal、new-england-bar） | 94 | 89 | 2 / 0 | 66 | pan 軸は FIXED_BY_FLOW | pan を「道具」にするなら #216 | pan 道具 | 道具化なら要確認 | OD-CS-16 / 18 |
| **W7** shape（+ shape-aware CUT） | W6（pide 以外は PAN も要る）、CUT の円前提の書き換え | DOUGH_SHAPE_TARGET | **1**（al-taglio） | 95 | 90 | 4 / 0 | 66 | shape 軸は UNAVAILABLE | — | — | なし | OD-CS-17 / 18。pide は未解決材料 2 |
| **W8** enclose | W5 以降。FOLD / SEAL / EDGE_FILL（型のみ存在） | ENCLOSE。CUT を無効化、Completion Gate の「封が開いている」failure | **3**（scacciata、chicago-stuffed、fugazzeta-rellena） | 98 | 93 | 1 / 1 | 67 | 食材が見えなくなる（score が読むものを視覚が隠す） | — | — | なし | 各 audit、OD-CS-18 |
| **W9** 残り | 各 Fresh Audit | PREP、mid_bake、FRY（LAMINATE は scope 疑問） | **3** | 101 | 96 | 0 / 3 | 71 | 各 | — | — | なし | 各 audit |
| 合計 | | | **69 eligible** | **101** | 96 | **content blocker 28 / E 48** | 71 | | | | | |

注:
- 「content blocker / E」は、その Wave で解禁される行のうち eligible でない行の数。**W0 以外では「E」は mechanic が揃っても基底 sauce / 解釈の決定が要る行**。
- 全 145 行を数えると: eligible 69 + content blocker 28 + E 48 = 145。残りの 2 行（eel、feteer）は late 未解決と LAMINATE で、どの Wave にも属さない。
- **到達可能な上限:** content blocker を全て解決すれば 129 recipe（= 32 + 97）。E も全て解決すれば 177 recipe（172 行 + 出荷済みの 5 recipe）。**172 recipe という数に届くかは OD-N3**。

### 5.5 順序の比較（C2）

同じ eligible 基準で、mechanic の順序を変えた場合の累計（W0 完了後を 71 とする）。

| 順序 | 1 つ目 | 2 つ目 | 3 つ目 | 3 つ後の cumulative |
|---|---|---|---|---:|
| 承認済み（B: seam → late → dough → multi） | late **+2**（73） | dough +8（81） | multi +9（90） | 90 |
| yield 順（A: matrix §5） | dough **+8**（79） | multi +9（88） | late +2（90） | 90 |

- 3 つ後の合計は同じ（90）。**違うのは「途中で何 recipe を出せるか」と「Owner Decision がいつ要るか」。**
- late は engine の前提（seam）が揃っている唯一の mechanic で、Owner の承認が済んでいる。dough と multi は **OD-CS-12 / OD-CS-14 が先**。つまり承認済み順序は「決定が終わっている順」であり、yield 順は「決定が終わっていない順」。
- どちらも成立する。**このauditは選ばない（OD-N4）。**

---

## 6. 領域ごとの現況（依頼の確認対象）

| 領域 | 現況 | 未実装 | 172 への影響 |
|---|---|---|---|
| CookingProfile | `steps` / `cutConfig` / 未使用の `stepTimeLimits`。材料 category から導出（`deriveCoreSteps`）。override は空 | `applicationPhase`、dough / pan / shape の field | 新 field は profile ではなく recipe 側（OD-CS-3 の推奨） |
| reducer / phases | `POST_BAKE` と forward-only の step walk は実装済み。finalization は CONFIRM_BAKE で 1 回 | FINISH の gameplay、late の再 finalization（OD-CS-2 = B） | CS-1b / CS-2 |
| BAKE | 単一窓、Guide fade、failure 判定、#256 の CUT skip | pan 曲線、split bake、fry | pan 8 / mid_bake 3 / fry 1 |
| CUT | 24 / 32、6 slice 固定、円形 | shape-aware CUT、CUT scoring 拡張（#288） | shape 5 + enclose 5（CUT 無効化） |
| FINISH / post-bake | 型と walk のみ。UI なし | 全部 | late 12 行、drizzle（multi-spread の一部） |
| NO_SAUCE / TQ-1D | 完了（aussie）。no-sauce の privacy と発見経路が稼働 | 追加 recipe の再 audit、定義の統一 | 26 行が W0c |
| TQ-2 late | 未着手 | 全部 | 上記 |
| TQ-3 multi-spread | 未着手 | 全部 | 上記 |
| shape / pan | 未実装。`doughShape.ts` はプレイヤーの手の silhouette（D3A）で、レシピの target 形状ではない | 全部 | W6 / W7 |
| piadina | evidence は 1 行。DOUGH_VARIANT + no-sauce | dough variant | W3 |
| edge / fold / seal | `EDGE_FILL` / `FOLD` / `SEAL` は予約された型のみ | 全部 | W8（5 行）。`stuffed-crust` は 172 行に無い |
| Research / Discovery | Hint 5.0 ON、Cohort Letter、Phase 2〜4 未実装 | ×-ledger、Board、FAILED 開示 | 新 recipe ごとに cohort / hint が増える |
| progression / inventory | ladder append-only、HAND 12、material shop は ladder から導出 | — | 材料 +50 を超える規模は Large Catalog UX の再 audit |

---

## 7. blockers / unknowns

| ID | 内容 | 影響 |
|---|---|---|
| U1 | 出荷済み 5 recipe（funghi、napoletana、pepperoni、pizza-bianca、salsiccia）が 172 行に対応しない。`bianca-pizzadb-row` と `salsiccia-e-friarielli-pizzadb-p3` は名称 cluster の候補だが、対応を決めていない | 「172」の定義。172 行カバー数の算出 |
| U2 | OD-CS-1 / 2 / 9a / 20 は PR #295 の文書内にのみ存在し、main に無い。CS-1a のコードも main に無い | CS-1b の着手条件、authority の正式性 |
| U3 | 新 sauce（bbq、curry-ketchup、tahini、miso、mustard ほか 8 件）を「data のみ」とする分類は、型の拡張・見た目・Reference target の実装を確認していない | W0b の「安全」の強さ |
| U4 | SSOT / handoff の状態表記が古い（TQ-1D、TQ-1E） | 文書整合 |
| U5 | #296（Taxonomy / HCG）、#293、#255 の本文は未読 | 新材料の taxonomy / hint class の要件が漏れている可能性 |
| U6 | #288（CUT-S4）の状態を確認していない | W7 / W2 の CUT 順序 |
| U7 | Techniques Gate の「W2-D と共有基盤化」の W2-D が何かを main の文書で確認できない | TQ-3 の前提 |
| U8 | Vitest / tsc を実行していない。tab 数は機械集計 | runtime 挙動の保証なし |
| U9 | 172 行の content 決定（未解決材料 13 token / 21 行、組成競合 27 件、base sauce 33 行） | eligible を超える到達には必須。**chili（唐辛子ほか）と ひき肉の 2 決定で 9 行**が最も効率的（matrix §7.1） |

**STOP 条件の確認:** #401 との競合なし（docs の新規 1 ファイルのみ）。runtime 変更は不要。authority の矛盾は列挙したが判断不能なものはない（Owner に委ねた）。172 の母集団 source は足りている（U1 は mapping の問題）。

---

## 8. Owner Decision 一覧

**既決（PR #295 内のみ・ratify が要る）:** OD-CS-1 = A、OD-CS-2 = B、OD-CS-9(a)、OD-CS-20。

**この audit が新しく挙げるもの:**

| ID | 決定が要ること | 推奨（助言のみ） |
|---|---|---|
| **OD-N1** | W0 の content を 1 PR あたり何 recipe で出すか、53 を超える前の Research Fresh Gate をどこに置くか | 既存の Expansion Wave 手順（1〜3 recipe / PR）を維持。53 の手前に gate |
| **OD-N2** | no-sauce の定義（「チーズ」family の 33 行を no-sauce と見なすか、olive-oil drizzle を持つか）。追加 no-sauce recipe を許可する条件 | 1 回の再 audit にまとめる。定義が決まるまで W0c は開始しない |
| **OD-N3** | 「172」の意味（172 行 / 172 Production recipe）と、出荷済み 5 recipe の対応 | 対応表を先に作る |
| **OD-N4** | mechanic の順序（承認済み順 vs yield 順） | late の engine（W1）は order に関係なく先。W2 の late と dough / multi の前後だけを決める |
| **OD-N5** | #295 の扱い（rebase して merge するか、decision だけ別 docs PR で main に入れるか） | decision の docs 化を先に |
| **OD-N6** | 新 sauce 材料の方針（型の拡張を許可するか） | 許可。U3 を W0b の最初の slice で検証 |
| **OD-N7** | content 決定の優先順（chili / ひき肉 → base sauce 33 行 → 組成競合） | matrix §7.1 のとおり |

**既存の open（Post-W1 §8）:** OD-CS-3〜8、10〜19。W2 に必要なのは 3 / 4 / 5 / 6 / 7 / 8 / 10 / 11。W3 は 12。W4 は 14。W6〜W8 は 16〜18。

---

## 9. 方法と再現

1. `git fetch origin main` → `9e7484b`。`git status` は clean（branch は main と同一）。
2. 172 行: `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（evidence 由来のフィールドのみ使用）。
3. 分類: PR #295 の `TETO_POST-W1_COOKING-STEPS_classify.py` を `git show` で scratch に取り出し、main のツリーに対して実行した（出力先は scratchpad。repo は変更していない）。出荷済みの突き合わせは `recipes.ts` / `ingredients.ts` の id。
4. blocker・新材料: matrix JSON の `blockers` と `ingredients.canonicalIngredientIds` から、現行 `ingredients.ts` の 34 id との差を数えた。
5. Wave: 各行の `mechanicKeys` から `NO_SAUCE` と `NO_CUT_OR_CUT_UNSPECIFIED`（どちらも実装済み）を除いた集合が、実装済み mechanic の集合に含まれたとき解禁とした。
6. このスクリプトは本 PR に含めない（成果物は本 1 ファイルのみ）。

---

## Appendix. 172 行の区分

区分 A〜E は §5.2 の定義。「E の場合の解消後区分」は、authority 不足を解消した場合の mechanic 区分。


| # | evidence id | 名称 | 区分 | E の場合の解消後区分 | 必要 mechanic | content blocker | 新規材料数 | 状態 |
|---:|---|---|:-:|:-:|---|---|---:|---|
| 1 | `bbq-chicken-pizzadb` | BBQチキンピザ | C |  | LATE_ADDITION:post_bake | — | 2 | READY |
| 2 | `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 4 | BLOCKED_PRODUCT_DECISION |
| 3 | `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ | B |  | — | — | 1 | READY_WITH_REVIEW |
| 4 | `vongole-pizzadb` | ヴォンゴレピザ | B |  | NO_SAUCE | — | 0 | 出荷済 `vongole` |
| 5 | `aussie-pizzadb` | オージーピザ | B |  | NO_SAUCE | — | 0 | 出荷済 `aussie` |
| 6 | `capricciosa-pizzadb` | カプリチョーザ（PIZZA DB版） | B |  | — | COMPOSITION_CONFLICT_SHIPPED | 1 | 出荷済 `capricciosa` |
| 7 | `currywurst-pizzadb` | カリーヴルストピザ | B |  | — | — | 3 | READY |
| 8 | `calzone-pizzadb` | カルツォーネ（PIZZA DB版） | D |  | ENCLOSE, NO_CUT_OR_CUT_UNSPECIFIED | COMPOSITION_CONFLICT_CANDIDATE | 2 | BLOCKED_PRODUCT_DECISION |
| 9 | `quattro-stagioni-pizzadb` | クアトロスタジオーニ（PIZZA DB版） | C |  | ZONED_PLACEMENT | — | 1 | READY |
| 10 | `quattro-formaggi-pizzadb` | クアトロフォルマッジ（PIZZA DB版） | B |  | NO_SAUCE | COMPOSITION_CONFLICT_SHIPPED | 0 | 出荷済 `quattro-formaggi` |
| 11 | `grandma-pizza-pizzadb` | グランマピザ | D |  | MULTI_SPREAD_LAYER | — | 0 | READY |
| 12 | `greek-style-pizzadb` | グリークスタイルピザ（PIZZA DB版） | D |  | DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 13 | `chicago-deep-dish-pizzadb` | シカゴディープディッシュ（PIZZA DB版） | D |  | STEP_ORDER, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE | 0 | BLOCKED_PRODUCT_DECISION |
| 14 | `siciliana-pizzadb` | シチリアンピザ（PIZZA DB版） | D |  | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE | 0 | BLOCKED_PRODUCT_DECISION |
| 15 | `sfincione-pizzadb` | スフィンチョーネ | D |  | MULTI_SPREAD_LAYER | — | 0 | READY_WITH_REVIEW |
| 16 | `supreme-pizzadb` | スプリームピザ | A |  | — | COMPOSITION_CONFLICT_CANDIDATE | 0 | BLOCKED_PRODUCT_DECISION |
| 17 | `taco-pizza-pizzadb` | タコピザ | E | B | — | MECHANIC_INTERPRETATION | 5 | BLOCKED_PRODUCT_DECISION |
| 18 | `flammkuchen-pizzadb` | タルトフランベ | B |  | — | — | 1 | READY |
| 19 | `chilean-napolitana-pizzadb` | チリアンナポリターナ | B |  | NO_SAUCE | — | 0 | READY_WITH_REVIEW |
| 20 | `trenton-tomato-pie-pizzadb` | トレントントマトパイ | C |  | STEP_ORDER | — | 0 | READY_WITH_REVIEW |
| 21 | `tonno-e-cipolla-pizzadb` | トンノエチポッラ（PIZZA DB版） | A |  | — | — | 0 | 出荷済 `tonno-e-cipolla` |
| 22 | `new-haven-apizza-pizzadb` | ニューヘイブンアピッツァ | A |  | — | — | 0 | 出荷済 `new-haven-apizza` |
| 23 | `ny-style-pizzadb` | ニューヨークスタイルピザ（PIZZA DB版） | C |  | DOUGH_VARIANT | — | 0 | READY_WITH_REVIEW |
| 24 | `bacalhau-pizzadb` | バカリャウピザ | B |  | NO_SAUCE | — | 1 | READY |
| 25 | `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | D |  | MULTI_SPREAD_LAYER, LATE_ADDITION:post_bake | COMPOSITION_CONFLICT_CANDIDATE | 2 | BLOCKED_PRODUCT_DECISION |
| 26 | `margherita-pizzadb-row` | マルゲリータ | D |  | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED | 0 | 出荷済 `margherita` |
| 27 | `pizza-baiana` | ピッツァ・バイアーナ | A |  | — | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 28 | `pizza-a-caballo` | ピッツァ・ア・カバージョ | E | D | DOUGH_VARIANT, ENCLOSE, NO_SAUCE, NO_CUT_OR_CUT_UNSPECIFIED | EVIDENCE_GAP | 0 | BLOCKED_PRODUCT_DECISION |
| 29 | `fugazzeta-rellena` | フガゼッタ・レジェーナ | D |  | DOUGH_VARIANT, ENCLOSE, NO_SAUCE, NO_CUT_OR_CUT_UNSPECIFIED | — | 0 | READY |
| 30 | `bianca-pizzadb-row` | ピッツァビアンカ | B |  | NO_SAUCE | — | 1 | READY_WITH_REVIEW |
| 31 | `pizza-de-cancha` | ピッツァ・デ・カンチャ | D |  | DOUGH_VARIANT, MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 32 | `hawaiian-pizzadb-row` | ハワイアンピザ | A |  | — | — | 0 | 出荷済 `hawaiian` |
| 33 | `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | E | B | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT | 2 | BLOCKED_PRODUCT_DECISION |
| 34 | `scacciata-ragusana-pizzadb-p4` | スカッチャラグザーナ | D |  | ENCLOSE, NO_CUT_OR_CUT_UNSPECIFIED | — | 1 | READY |
| 35 | `spanish-chorizo-pizza-pizzadb-p4` | スパニッシュチョリソピザ | B |  | NO_SAUCE | — | 0 | READY |
| 36 | `spinach-artichoke-pizza-pizzadb-p4` | スピナッチアーティチョークピザ | B |  | NO_SAUCE | — | 3 | READY |
| 37 | `speck-e-brie-pizzadb-p4` | スペックエブリー | B |  | NO_SAUCE | COMPOSITION_CONFLICT_CANDIDATE | 3 | BLOCKED_PRODUCT_DECISION |
| 38 | `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | E | C | LATE_ADDITION:post_bake | BASE_SAUCE_UNSPECIFIED | 3 | BLOCKED_PRODUCT_DECISION |
| 39 | `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | C |  | DOUGH_VARIANT | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 40 | `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | B |  | — | UNRESOLVED_INGREDIENT | 2 | BLOCKED_PRODUCT_DECISION |
| 41 | `mentaiko-cream-pizza-pizzadb-p4` | たらこクリームピザ | D |  | LATE_ADDITION:mid_bake | — | 4 | READY |
| 42 | `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | C |  | DOUGH_VARIANT, NO_SAUCE | — | 0 | READY_WITH_REVIEW |
| 43 | `ikura-salmon-pizza-pizzadb-p1` | いくらとサーモンのピザ | B |  | NO_SAUCE | — | 4 | READY |
| 44 | `vegan-cashew-cheese-pizza-pizzadb-p1` | ヴィーガンカシューチーズピザ | B |  | — | — | 1 | READY |
| 45 | `eel-pizza-pizzadb-p1` | うなぎピザ | E | E | LATE_ADDITION:unresolved:mid_bake|post_bake | BASE_SAUCE_UNSPECIFIED, MECHANIC_INTERPRETATION | 3 | BLOCKED_PRODUCT_DECISION |
| 46 | `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 47 | `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | D |  | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 48 | `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | D |  | MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT | 5 | BLOCKED_PRODUCT_DECISION |
| 49 | `caponata-pizza-pizzadb-p2` | カポナータピザ | E | A | — | BASE_SAUCE_UNSPECIFIED | 0 | BLOCKED_PRODUCT_DECISION |
| 50 | `california-style-pizza-pizzadb-p2` | カリフォルニアスタイルピザ | B |  | NO_SAUCE | — | 3 | READY |
| 51 | `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | C |  | DOUGH_VARIANT | — | 0 | READY_WITH_REVIEW |
| 52 | `curry-pizza-japan-pizzadb-p2` | カレーピザ | E | B | — | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 53 | `keema-pizza-pizzadb-p2` | キーマピザ | E | A | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 54 | `kimchi-pizza-pizzadb-p2` | キムチピザ | E | D | PREP_STEP | BASE_SAUCE_UNSPECIFIED | 3 | BLOCKED_PRODUCT_DECISION |
| 55 | `cuban-pizza-pizzadb-p2` | キューバンピザ | B |  | — | — | 4 | READY |
| 56 | `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | C |  | DOUGH_VARIANT | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 57 | `goulash-pizza-pizzadb-p3` | グヤーシュピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 3 | BLOCKED_PRODUCT_DECISION |
| 58 | `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | E | C | DOUGH_VARIANT | EVIDENCE_GAP | 0 | BLOCKED_PRODUCT_DECISION |
| 59 | `salsiccia-e-friarielli-pizzadb-p3` | サルシッチャエフリアリエッリ | B |  | NO_SAUCE | — | 1 | READY |
| 60 | `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | D |  | DOUGH_VARIANT, ENCLOSE, NO_CUT_OR_CUT_UNSPECIFIED | — | 0 | READY_WITH_REVIEW |
| 61 | `potato-mayo-pizza-pizzadb-p3` | じゃがマヨピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 62 | `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 63 | `shirasu-pizza-pizzadb-p3` | しらすピザ | B |  | NO_SAUCE | — | 3 | READY |
| 64 | `tandoori-paneer-pizza-pizzadb-p5` | タンドリーパニールピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 65 | `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 66 | `diavola-pizza-pizzadb-p5` | ディアボラ | B |  | — | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT | 1 | BLOCKED_PRODUCT_DECISION |
| 67 | `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | D |  | DOUGH_VARIANT, LATE_ADDITION:post_bake, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 68 | `turkish-pide-pizzadb-p5` | トルコピデ | D |  | DOUGH_VARIANT, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 69 | `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 70 | `eggplant-tahini-pizza-pizzadb-p5` | ナスとタヒニのピザ | B |  | — | — | 2 | READY |
| 71 | `eggplant-ricotta-pizza-pizzadb-p5` | ナスとリコッタのピザ | B |  | NO_SAUCE | — | 2 | READY |
| 72 | `eggplant-dengaku-pizza-pizzadb-p6` | ナス田楽ピザ | B |  | — | — | 2 | READY |
| 73 | `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 74 | `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | D |  | DOUGH_VARIANT, PAN_BAKE | — | 0 | READY_WITH_REVIEW |
| 75 | `new-zealand-lamb-pizza-pizzadb-p6` | ニュージーランドラムピザ | B |  | NO_SAUCE | — | 2 | READY |
| 76 | `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | C |  | LATE_ADDITION:post_bake | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT | 3 | BLOCKED_PRODUCT_DECISION |
| 77 | `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 78 | `banh-mi-pizza-pizzadb-p6` | バインミーピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 4 | BLOCKED_PRODUCT_DECISION |
| 79 | `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 80 | `baba-ganoush-pizza-pizzadb-p7` | ババガヌーシュピザ | B |  | — | — | 1 | READY |
| 81 | `jamon-serrano-pizza-pizzadb-p7` | ハモンセラーノピザ | B |  | — | — | 2 | READY |
| 82 | `jalapeno-popper-pizza-pizzadb-p7` | ハラペーニョポッパーピザ | B |  | NO_SAUCE | — | 2 | READY |
| 83 | `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | E | C | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 84 | `parmigiana-pizza-pizzadb-p7` | パルミジャーナピザ | A |  | — | — | 0 | 出荷済 `parmigiana-pizza` |
| 85 | `palmito-pizza-pizzadb-p7` | パルミットピザ | B |  | NO_SAUCE | — | 1 | READY |
| 86 | `bambino-pizzadb-p7` | バンビーノ | A |  | — | — | 0 | 出荷済 `bambino` |
| 87 | `piadina-romagnola-pizzadb-p7` | ピアディーナ・ロマニョーラ | C |  | DOUGH_VARIANT, NO_SAUCE | — | 3 | READY |
| 88 | `pizza-overload-pizzadb-p7` | ピザオーバーロード | B |  | — | — | 1 | READY_WITH_REVIEW |
| 89 | `pizza-salad-pizzadb-p7` | ピザサラダ | D |  | MULTI_SPREAD_LAYER | — | 3 | READY |
| 90 | `bismarck-pizza-pizzadb-p7` | ビスマルク | A |  | — | COMPOSITION_CONFLICT_SHIPPED | 0 | 出荷済 `bismarck` |
| 91 | `pizza-alla-crudaiola-pizzadb-p8` | ピッツァ・アッラ・クルダイオーラ | D |  | MULTI_SPREAD_LAYER | — | 2 | READY |
| 92 | `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | E | B | NO_SAUCE | MECHANIC_INTERPRETATION | 2 | BLOCKED_PRODUCT_DECISION |
| 93 | `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | E | C | DOUGH_VARIANT, NO_SAUCE | MECHANIC_INTERPRETATION | 3 | BLOCKED_PRODUCT_DECISION |
| 94 | `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | E | B | NO_SAUCE | MECHANIC_INTERPRETATION | 3 | BLOCKED_PRODUCT_DECISION |
| 95 | `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | E | B | NO_SAUCE | MECHANIC_INTERPRETATION | 4 | BLOCKED_PRODUCT_DECISION |
| 96 | `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | E | B | NO_SAUCE | MECHANIC_INTERPRETATION | 3 | BLOCKED_PRODUCT_DECISION |
| 97 | `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | E | C | DOUGH_VARIANT, NO_SAUCE | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT | 3 | BLOCKED_PRODUCT_DECISION |
| 98 | `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | E | C | DOUGH_VARIANT, NO_SAUCE | MECHANIC_INTERPRETATION | 2 | BLOCKED_PRODUCT_DECISION |
| 99 | `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | E | D | MULTI_SPREAD_LAYER, NO_SAUCE | MECHANIC_INTERPRETATION | 3 | BLOCKED_PRODUCT_DECISION |
| 100 | `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | A |  | — | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 101 | `pizza-portuguesa-pizzadb-p9` | ピッツァ・ポルトゲーザ | A |  | — | — | 0 | 出荷済 `pizza-portuguesa` |
| 102 | `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | C |  | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE | 0 | BLOCKED_PRODUCT_DECISION |
| 103 | `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | B |  | — | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 104 | `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | D |  | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | — | 0 | READY_WITH_REVIEW |
| 105 | `pizza-feta-eliniki-pizzadb-p9` | ピッツァフェッタエッリニキ | B |  | NO_SAUCE | — | 1 | READY |
| 106 | `pizza-fritta-pizzadb-p9` | ピッツァフリッタ | D |  | FRY_COOK, NO_CUT_OR_CUT_UNSPECIFIED | — | 2 | READY |
| 107 | `pizza-moscow-pizzadb-p9` | ピッツァモスクワ | B |  | NO_SAUCE | — | 2 | READY |
| 108 | `pinsa-romana-pizzadb-p9` | ピンサロマーナ | C |  | DOUGH_VARIANT | — | 2 | READY |
| 109 | `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | C |  | DOUGH_VARIANT | — | 0 | READY_WITH_REVIEW |
| 110 | `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | B |  | NO_SAUCE | UNRESOLVED_INGREDIENT | 2 | BLOCKED_PRODUCT_DECISION |
| 111 | `poutine-pizza-pizzadb-p10` | プーティンピザ | C |  | DOUGH_VARIANT | — | 3 | READY |
| 112 | `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | E | D | MULTI_SPREAD_LAYER, LAMINATE, NO_CUT_OR_CUT_UNSPECIFIED | BASE_SAUCE_UNSPECIFIED, SCOPE_QUESTION, UNRESOLVED_INGREDIENT | 3 | BLOCKED_PRODUCT_DECISION |
| 113 | `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | E | C | DOUGH_VARIANT | SCOPE_QUESTION | 1 | BLOCKED_PRODUCT_DECISION |
| 114 | `fugazza-pizzadb-p10` | フガザ | C |  | DOUGH_VARIANT, NO_SAUCE | COMPOSITION_CONFLICT_SHIPPED, DISCOVERY_COLLISION | 0 | 出荷済 `fugazza` |
| 115 | `fugazzetta-pizzadb-p10` | フガゼッタ | C |  | DOUGH_VARIANT, NO_SAUCE | COMPOSITION_CONFLICT_CANDIDATE, DISCOVERY_COLLISION | 0 | BLOCKED_PRODUCT_DECISION |
| 116 | `puttanesca-pizza-pizzadb-p10` | プッタネスカ | A |  | — | — | 0 | 出荷済 `puttanesca-pizza` |
| 117 | `burrata-pizza-pizzadb-p10` | ブラータピザ | D |  | MULTI_SPREAD_LAYER | — | 1 | READY |
| 118 | `brazilian-calabresa-pizzadb-p10` | ブラジリアン・カラブレーザ | A |  | — | — | 0 | 出荷済 `brazilian-calabresa` |
| 119 | `brazilian-catupiry-corn-pizza-pizzadb-p10` | ブラジリアンカトゥピリコーンピザ | B |  | NO_SAUCE | — | 1 | READY |
| 120 | `frango-catupiry-pizzadb-p10` | フランゴ・コン・カトゥピリ | B |  | NO_SAUCE | — | 1 | READY |
| 121 | `full-english-pizza-pizzadb-p10` | フルイングリッシュピザ | B |  | NO_SAUCE | — | 1 | READY |
| 122 | `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | E | C | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED | 4 | BLOCKED_PRODUCT_DECISION |
| 123 | `bulgogi-pizza-pizzadb-p11` | プルコギピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 124 | `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | B |  | — | COMPOSITION_CONFLICT_CANDIDATE | 2 | BLOCKED_PRODUCT_DECISION |
| 125 | `breakfast-pizza-pizzadb-p11` | ブレックファーストピザ | E | B | — | COMPOSITION_CONFLICT_SHIPPED, UNRESOLVED_INGREDIENT | 1 | 出荷済 `breakfast-pizza` |
| 126 | `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ | B |  | — | — | 1 | READY_WITH_REVIEW |
| 127 | `veggie-supreme-pizza-pizzadb-p11` | ベジースプリームピザ | B |  | — | — | 1 | READY |
| 128 | `pescatore-pizzadb-p11` | ペスカトーレ | D |  | MULTI_SPREAD_LAYER | — | 1 | READY_WITH_REVIEW |
| 129 | `pesto-caprese-pizzadb-p11` | ペストカプレーゼピザ | A |  | — | — | 0 | 出荷済 `pesto-caprese` |
| 130 | `pesto-gamberi-pizzadb-p11` | ペストガンベリピザ | A |  | — | — | 0 | 出荷済 `pesto-gamberi` |
| 131 | `pesto-salmone-pizzadb-p11` | ペストサーモンピザ | B |  | — | — | 3 | READY |
| 132 | `pesto-genovese-pizza-pizzadb-p11` | ペストジェノヴェーゼピザ | B |  | — | COMPOSITION_CONFLICT_SHIPPED | 1 | 出荷済 `genovese` |
| 133 | `pesto-trapanese-pizzadb-p11` | ペストトラパネーゼピザ | B |  | — | — | 1 | READY |
| 134 | `pesto-tonno-pizzadb-p12` | ペストトンノピザ | A |  | — | — | 0 | 出荷済 `pesto-tonno` |
| 135 | `pesto-noci-pizzadb-p12` | ペストノーチピザ | D |  | MULTI_SPREAD_LAYER | — | 2 | READY |
| 136 | `pesto-patate-pizzadb-p12` | ペストパターテピザ | A |  | — | — | 0 | 出荷済 `pesto-patate` |
| 137 | `pesto-burrata-pizzadb-p12` | ペストブラータピザ | D |  | MULTI_SPREAD_LAYER | — | 1 | READY |
| 138 | `pesto-vegetariana-pizzadb-p12` | ペストベジタリアーナピザ | A |  | — | — | 0 | 出荷済 `pesto-vegetariana` |
| 139 | `pesto-pollo-pizzadb-p12` | ペストポッロピザ | A |  | — | — | 0 | 出荷済 `pesto-pollo` |
| 140 | `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 3 | BLOCKED_PRODUCT_DECISION |
| 141 | `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 142 | `polish-kielbasa-pizzadb-p12` | ポーリッシュキエルバサピザ | B |  | NO_SAUCE | — | 1 | READY |
| 143 | `boscaiola-pizzadb-p12` | ボスカイオーラ | B |  | NO_SAUCE | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 144 | `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | D |  | MULTI_SPREAD_LAYER | — | 1 | READY_WITH_REVIEW |
| 145 | `porchetta-pizza-pizzadb-p12` | ポルケッタピザ | B |  | NO_SAUCE | — | 1 | READY |
| 146 | `natto-pizza` | 納豆ピザ | E | D | LATE_ADDITION:mid_bake | BASE_SAUCE_UNSPECIFIED | 4 | BLOCKED_PRODUCT_DECISION |
| 147 | `peking-duck-pizza` | 北京ダックピザ | B |  | — | — | 4 | READY_WITH_REVIEW |
| 148 | `mentaiko-mochi-pizza` | 明太子もちピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 5 | BLOCKED_PRODUCT_DECISION |
| 149 | `manakish` | マナキーシュ | C |  | DOUGH_VARIANT | — | 2 | READY_WITH_REVIEW |
| 150 | `yuzu-shrimp-pizza` | 柚子えびピザ | B |  | — | — | 2 | READY |
| 151 | `wasabi-beef-pizza` | わさび牛ピザ | C |  | LATE_ADDITION:post_bake | — | 3 | READY |
| 152 | `sichuan-eggplant-pizza` | 四川風ナスピザ | B |  | — | — | 2 | READY |
| 153 | `yakiniku-pizza` | 焼肉ピザ | D |  | PREP_STEP | — | 3 | READY |
| 154 | `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | E | D | PREP_STEP, LATE_ADDITION:mid_bake | BASE_SAUCE_UNSPECIFIED | 2 | BLOCKED_PRODUCT_DECISION |
| 155 | `lahmacun` | ラフマジュン | E | D | DOUGH_VARIANT, MULTI_SPREAD_LAYER | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |
| 156 | `porcini-pizza-pizzadb-p13` | ポルチーニ茸のピザ | B |  | NO_SAUCE | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 157 | `marinara-pizza-pizzadb-p13` | マリナーラ | D |  | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED | 0 | 出荷済 `marinara` |
| 158 | `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | B |  | — | COMPOSITION_CONFLICT_SHIPPED | 1 | 出荷済 `meat-lovers` |
| 159 | `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | E | B | — | UNRESOLVED_INGREDIENT | 3 | BLOCKED_PRODUCT_DECISION |
| 160 | `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 4 | BLOCKED_PRODUCT_DECISION |
| 161 | `melanzane-pizza-pizzadb-p13` | メランザーネピザ | A |  | — | — | 0 | 出荷済 `melanzane-pizza` |
| 162 | `montreal-style-pizza-pizzadb-p13` | モントリオールスタイルピザ | D |  | DOUGH_VARIANT, PAN_BAKE | — | 0 | READY |
| 163 | `ratatouille-pizza-pizzadb-p13` | ラタトゥイユピザ | A |  | — | — | 0 | 出荷済 `ratatouille-pizza` |
| 164 | `rucola-e-grana-pizzadb-p13` | ルーコラエグラーナピザ | B |  | — | — | 3 | READY |
| 165 | `rendang-pizza-pizzadb-p14` | ルンダンピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 166 | `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 167 | `tsukimi-pizza-pizzadb-p14` | 月見ピザ | B |  | NO_SAUCE | — | 1 | READY |
| 168 | `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | C |  | LATE_ADDITION:post_bake, NO_SAUCE | COMPOSITION_CONFLICT_CANDIDATE | 1 | BLOCKED_PRODUCT_DECISION |
| 169 | `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | E | C | LATE_ADDITION:post_bake | BASE_SAUCE_UNSPECIFIED, COMPOSITION_CONFLICT_CANDIDATE | 2 | BLOCKED_PRODUCT_DECISION |
| 170 | `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 1 | BLOCKED_PRODUCT_DECISION |
| 171 | `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | E | B | — | BASE_SAUCE_UNSPECIFIED | 3 | BLOCKED_PRODUCT_DECISION |
| 172 | `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | B |  | NO_SAUCE | UNRESOLVED_INGREDIENT | 0 | BLOCKED_PRODUCT_DECISION |