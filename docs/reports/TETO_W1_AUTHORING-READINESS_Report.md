# W1 Authoring Readiness Report（PR-4b / brazilian-calabresa を除く、残りの recipe 群）

- 日付: 2026-10-01
- **audited main: `52d14f9ef085b2c3c81e4e11e3f555ecc17a1e57`**（Merge PR #327 = Discovery 3.0 PR-4a、2026-10-01 12:21 +0900）
- 種別: **docs-only の Authoring Readiness Audit。** production コード（`src/**` / `e2e/**`）・PR・merge・deploy は一切していない。
- 触っていないもの: PR-4b / brazilian-calabresa の実装、#217 / #218 / #219 / #220 / #221、#295、旧 Progression PR。
- Human Verification: **不要**（production から見える変更なし。`TETO_HUMAN-VERIFICATION-POLICY.md` の対象外）。
- 値の格付けの原則: evidence が足りない値を authority にしない。placeholder を production 値にしない。既存 recipe からの類推だけの値は AUTHORITY にしない。

---

## 0. 最初に確認してほしいこと — 「W1 remaining」の定義が文書間で食い違っている

**この audit の対象選定は、Owner の判断を変えずに、最も整合する読み方を採った。Owner が別の集合を意図していたなら、§1.3 の表を差し替えれば足りる。**

| 文書 | 「W1」「残り」の意味 | main での状態 |
|---|---|---|
| #220（`e49dab96`、open）+ `TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md` | **W1 = 10 recipe**（new-haven-apizza / hawaiian / parmigiana-pizza / bambino / pizza-portuguesa / puttanesca-pizza / pesto-caprese / pesto-tonno / pesto-patate / melanzane-pizza） | **10 件とも main に出荷済み**（`recipes.ts` = 25 件、W1 ladder step 1〜24） |
| #220 の W2（11 件） | jamon-serrano-pizza / pesto-gamberi / pesto-pollo / pesto-vegetariana / ratatouille-pizza ほか 6 件 | 未実装。ただし #220 は 2026-09-24 の古い台帳で、後の Owner 決定（下の W2-A）と一部食い違う |
| `claude/wave2-runtime-recipe-design-os06j1`（`2bc40e41f3`）の **W2-A pack**（Owner 決定 OD-W2-1..9 と A1〜A8、2026-09-27） | 9 recipe = **brazilian-calabresa** + 8 件 | 未実装（その branch は PR なし・未 merge） |
| Discovery 3.0（`docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`、audit branch `43974a2102`） | brazilian-calabresa = 「post-W1 の最初の branching validation」。ladder を進めない（OD-D3-17 O3） | PR-4b = NO-GO（OD-D3-24 未決） |

結論:

- #220 の意味での **W1 の残りは 0 件**。W1 は完了している。
- brazilian-calabresa は #220 では W3、W2-A pack では 9 件の 1 件目。Discovery 3.0 が「Calabresa の次に追加する recipe 群」として指せる、実在する authority pack は **W2-A pack の残り 8 件**だけ。
- よって本 report の対象 = **W2-A pack の、brazilian-calabresa を除く 8 件**:
  `vongole` / `flammkuchen` / `pesto-gamberi` / `pesto-pollo` / `ratatouille-pizza` / `pesto-vegetariana` / `prosciutto-funghi` / `jamon-serrano-pizza`。
- #220 の W2（11 件）は別集合。W2-A の 8 件のうち #220 でも W2 にいるのは 5 件（jamon / gamberi / pollo / vegetariana / ratatouille）。vongole と flammkuchen は #220 では W4（`SAUCELESS_RECIPE_CONTRACT` / `UNSUPPORTED_SAUCE_ID_CONTRACT`）、prosciutto-funghi は W3。W2-A の Owner 決定（OD-W2-7）は vongole を olive-oil の PAINT_TEMPORARY、flammkuchen を新しい白ソース profile として扱うことで、#220 の W4 判定を上書きしている。**どちらが優先かは Owner の確認事項（OD-R1）。**

---

## 1. Fresh Gate

### 1.1 main の実測（`52d14f9`）

| 項目 | 実測 |
|---|---|
| RECIPES | **25**（15 + W1 10）。brazilian-calabresa は未追加（`grep` 0 件） |
| 材料カタログ | **29**（starter 3: tomato-sauce / mozzarella / basil、finite 26）。W2-A の 8 材料（prosciutto-crudo / fromage-blanc-sauce / arugula / shrimp / chicken / parsley / bell-pepper / zucchini）は**未登録** |
| `DISCOVERY_LADDER` | 24 step（凍結）。`POST_W1_APPENDED_STEPS = []`（LAD-1 の append 口は main にある） |
| 価格 tier | T1 1–5 / T2 6–14 / T3 15–29（100/50）/ **T4 30+（120/60、まだ誰も使っていない）** |
| `RECIPE_SAUCE_PROFILES` | `Record<RecipeId, …>`、`ingredientId` は `tomato-sauce \| pesto \| olive-oil` の closed union |
| `RECIPE_HINT_ROLES` | `Record<RecipeId, RecipeHintRoles>`（25 件）。key-free marker（`KeyFreeHintRoles`）は PR-3 #324 で型・builder が main に入ったが、**production に key-free recipe は 0 件** |
| `ladderCredit` | PR-2 #323 で main。`false` を明示した recipe だけ ladder count を進めない。省略 = 進める |
| CUT | `CUT_ELIGIBLE_RECIPE_IDS`（allowlist、25 件中 24 件。New Haven のみ対象外）。**#295（open）は `cookingProfiles.ts` / `cookingProfiles.tabGate.test.ts` / `GameScreen.tsx` / `postBakeView*.ts` を変更する**（GitHub の PR files で確認） |
| Lunch Rush | `missionOrderRecipeIds` = 発見済み ∩ 材料 OWNED（在庫は見ない）。`cookableMissionRecipeIds` はさらに在庫で絞る |
| Dinner | `DINNER_MISSIONS` は `populationId: "w1-25"` の 2 件（dm-a / dm-b）。target を id で明示する定義で、新 recipe は自動では入らない |
| reference ring | `PIECE_RING_POSITIONS` 8 slot。9 個以上は RT-01 の multi-ring。**W2-A の 8 件は全部 ≤ 8 個で、W2-A branch が使った legacy ring 座標と main の座標は同一**（目視で照合） |

### 1.2 参照した authority と、その状態

| authority | SHA / 状態 | 扱い |
|---|---|---|
| #220 Content Readiness（`e49dab96bd`、open） | W1 10 / W2 11 / W3 45 / W4 80。W1 は出荷済み | 参照のみ。W2-A とは一部食い違う（§0） |
| W1 I5b Fresh Audit（main の docs） | W1 の authoring 手順（R-MC / R-BT / RT-01 literal / CUT / Mito 台詞の Owner 承認フロー） | 手順の precedent |
| Wave 2 W2-A pack（`2bc40e41f3`、**未 merge・PR なし**） | OD-W2-1..9、A1〜A8 = APPROVED_OWNER、`tools/wave2-w2a/w2a_authoring_candidates.json`、W2-A1（8 材料の catalog-only 実装 commit） | **値の正本（Owner 決定の記録）。ただし main に無く、Discovery 3.0 以前のもの** |
| W2-A Hint 5.0 roles（`ab31da33a5`、docs のみ） | OD-W2-H5-ROLE-1 / SUB-1（9 件の explicit key / sub 順） | Owner 承認済みだが OD-D3-19 と競合（§4 OD-R3） |
| Discovery 3.0 OD（`43974a2102`）+ PR-4b Owner Decision Brief | OD-D3-17（ladderCredit は recipe ごと）/ 19（新 recipe は key-free）/ 21 / 22（CUT）/ 24（Calabresa の quantity・bake・placement 未決） | Calabresa の取り扱い。**8 件にも同じ論点が及ぶ** |
| PR-4a Result（main） | pool > 1 の test 基盤。26 件目 dry-run の失敗内訳 | §6 の e2e / test 影響の根拠 |

### 1.3 W2-A の 8 件を main へ持ってこれるか（read-only の trial merge）

`git merge-tree`（working tree を変えない plumbing）で `origin/main` と W2-A branch を merge した結果:
**conflict は 1 ファイル**（`src/logic/discovery/testSupport/deductionInversion.ts`）、他は auto-merge。W2-A1 の 8 材料は main へ**機械的には**載せられる。ただし branch の base は `7bb0116`（main より 211 commit 古い）で、Discovery 3.0 / Hint 5.0 production ON / RT-01 / #222 Completion Gate の Q factor より前に校正された値を含む（§3 の格付けに反映）。

---

## 2. 一覧（8 件）

| # | recipe id | 表示名 | 新材料 | 必要な ladder step / 章 | CUT | cheese | 変更の種類（実装が解けた場合） | 現在の gate |
|---|---|---|---|---|---|---|---|---|
| 1 | `prosciutto-funghi` | プロシュットフンギ | prosciutto-crudo | step 25 / 第3章 | あり | mozzarella | DATA + AUTHORING | BLOCKED BY OTHER PR（W2-A1）/ #295 / OWNER DECISION |
| 2 | `flammkuchen` | タルトフランベ | fromage-blanc-sauce | step 26 / 第3章 | **なし** | なし | DATA + AUTHORING（白ソースの Human Visual 付き） | BLOCKED（W2-A1）/ OWNER DECISION |
| 3 | `jamon-serrano-pizza` | ハモンセラーノピザ | arugula, prosciutto-crudo | step 27 / 第3章 | あり | mozzarella | DATA + AUTHORING | BLOCKED（W2-A1）/ #295 / OWNER DECISION |
| 4 | `pesto-gamberi` | ペストガンベリピザ | shrimp | step 28 / 第3章 | あり | なし | DATA + AUTHORING | BLOCKED（W2-A1）/ #295 / OWNER DECISION |
| 5 | `pesto-pollo` | ペストポッロピザ | chicken | step 29 / 第3章 | あり | mozzarella | DATA + AUTHORING | BLOCKED（W2-A1）/ #295 / OWNER DECISION |
| 6 | `vongole` | ヴォンゴレピザ | parsley | step 30 / **第4章（T4 初使用）** | **なし** | なし | DATA + AUTHORING | BLOCKED（W2-A1）/ OWNER DECISION |
| 7 | `ratatouille-pizza` | ラタトゥイユピザ | bell-pepper, zucchini | step 31 / 第4章 | あり | なし | DATA + AUTHORING | BLOCKED（W2-A1）/ #295 / OWNER DECISION |
| 8 | `pesto-vegetariana` | ペストベジタリアーナピザ | （#7 と同じ。**自前の step なし**） | step 31 / 第4章 | あり | mozzarella | DATA + AUTHORING（#7 と同 step の branching 候補） | BLOCKED（W2-A1）/ #295 / OWNER DECISION |

**どの recipe も DATA-ONLY ではない**: 各 recipe が最低でも次を必要とする — recipe 行、sauce profile、reference fixture（RT-01 literal）、discovery target id、Mito の注文台詞、Hint roles（または key-free）、ladder 追加、test の更新。**NEW MECHANIC REQUIRED は 0**（sauce-less・multi-spread・late-add・DOUGH_VARIANT のいずれも必要としない。§5）。

### 格付けの定義

| 格付け | 条件 |
|---|---|
| AUTHORITY | その値そのものに対する Owner の明示承認が記録されている。†= 記録が**未 merge の W2-A branch にだけ**ある（main の docs に写してから使う。かつ Discovery 3.0 以前の承認なので、main での再承認を OD-R2 で求める） |
| STRONG CANDIDATE | Owner 承認済みの authoring rule（R-MC / R-BT / R-REF）を、同系統の出荷済み recipe に機械的に適用した値。recipe 個別の承認はない |
| WEAK CANDIDATE | 類似 recipe / catalog 値からの類推。rule の条件（同 base + 同 primary）を満たさない |
| UNKNOWN | 根拠なし |

R-BT（bakeTarget）の条件は「同じ base + 同じ主役 topping の出荷済み recipe がある」場合のみ STRONG。W2-A gate は pesto-gamberi / jamon も DERIVED と書いたが、条件を厳密に読むと満たさないので、**本 report では WEAK に下げた**（理由は各行）。

---

## 3. quantity / bake / placement

### 3.1 quantity（minCount）と pack 上限

pack = 10 × k、k = その材料の既存 recipe での最大 minCount（`materialK`）。**既存 pack 上限を超える minCount は、他 recipe の pack を変える**（W1 の ham 1→3 が前例）。表の「既存 k」は main の実測値。W2-A の 8 件は**すべて既存 k 以内**で、既存 pack の変更は 0。

| recipe | 材料 × minCount（役割） | 既存 k（main）/ 新材料の k（W2-A 内） | 格付け |
|---|---|---|---|
| prosciutto-funghi | tomato-sauce 1（sauce）/ mozzarella 2（cheese）/ **prosciutto-crudo 2** / **mushroom 3**（topping） | mushroom 3 ✓ / crudo は新（W2-A 内の最大 = jamon の 3 → k=3） | prosciutto-crudo 2・mushroom 3 = **AUTHORITY†（A1）**。sauce 1・mozzarella 2 = STRONG（R-MC） |
| flammkuchen | fromage-blanc-sauce 1（sauce）/ **bacon 3** / **onion 2** | bacon 3 ✓ / onion 4 ✓ / fromage-blanc は新（k=1） | bacon 3・onion 2 = **AUTHORITY†（A1）**。sauce 1 = STRONG |
| jamon-serrano-pizza | tomato-sauce 1 / mozzarella 2 / prosciutto-crudo 3 / arugula 2 | 新材料のみ（crudo k=3、arugula k=2） | 全部 STRONG（R-MC。A1 の対象外） |
| pesto-gamberi | pesto 1 / shrimp 3 / fresh-tomato 2 / garlic 2 | pesto 1 ✓ / fresh-tomato 3 ✓ / garlic 3 ✓ / shrimp は新（k=3） | 全部 STRONG |
| pesto-pollo | pesto 1 / mozzarella 2 / chicken 3 / fresh-tomato 2 | fresh-tomato 3 ✓ / chicken は新（k=3） | 全部 STRONG |
| vongole | olive-oil 1 / clam 3 / garlic 2 / parsley 2 | olive-oil 1 ✓ / clam 3 ✓ / garlic 3 ✓ / parsley は新（k=2） | 全部 STRONG |
| ratatouille-pizza | tomato-sauce 1 / **eggplant 2 / zucchini 2 / bell-pepper 2** / oregano 1 | eggplant 3 ✓ / oregano 2 ✓ / zucchini・bell-pepper は新（k=2） | eggplant・zucchini・bell-pepper = **AUTHORITY†（A1）**。sauce 1・oregano 1 = STRONG |
| pesto-vegetariana | pesto 1 / mozzarella 2 / **zucchini 2 / bell-pepper 2 / eggplant 2** | eggplant 3 ✓ / zucchini・bell-pepper は新（k=2） | 3 材料 = **AUTHORITY†（A1）**。pesto 1・mozzarella 2 = STRONG |

- 新材料の k は W2-A の recipe 群の最大 minCount から決まる（crudo 3 / arugula 2 / shrimp 3 / chicken 3 / parsley 2 / bell-pepper 2 / zucchini 2 / fromage-blanc 1）。Owner が minCount を上げると、その材料の pack が変わる。
- **この表の minCount は、Completion Gate の partial-quantity（#222 の Q factor、`minCount = positions.length`）で校正された値ではない。** W2-A の校正（harness の Scoring / ★）は 2026-09-27 時点の main のもの。main で再実行するまで「期待 ★」は参考値。

### 3.2 bakeTarget

| recipe | 窓 | 根拠 | 格付け |
|---|---|---|---|
| prosciutto-funghi | 58–78 | catalog funghi（= runtime funghi）58–78 vs catalog prosciutto 55–75 の 2 案から Owner が選択（A2） | **AUTHORITY†** |
| flammkuchen | 56–76 | 白ソースの類似 recipe なし。breakfast-pizza（bacon）56–76 を Owner が選択（A2、代替は fugazza 63–83） | **AUTHORITY†** |
| pesto-pollo | 50–70 | pesto-caprese（同 pesto + mozzarella + fresh-tomato）。Owner が選択（A2） | **AUTHORITY†** |
| pesto-vegetariana | 50–70 | pesto-caprese 50–70 vs pesto-patate 58–78（代替）から Owner が選択（A2） | **AUTHORITY†** |
| vongole | 62–82 | new-haven-apizza（olive-oil base + clam 主役）= R-BT の条件を満たす | STRONG |
| ratatouille-pizza | 58–78 | melanzane-pizza（tomato base + eggplant 主役）= 条件を満たす | STRONG |
| pesto-gamberi | 50–70 | pesto-tonno（pesto base だが主役は tuna。shrimp ではない）。「seafood 同系」の類推 | **WEAK**（条件の「同 primary」を満たさない） |
| jamon-serrano-pizza | 55–75 | catalog の `prosciutto`（crudo e rucola）の bakeProfile。ただしその catalog 組成には parmigiano があり、jamon は parmigiano なし | **WEAK**（組成が違う） |

**帰結（既知）:** bake の窓は INCOMPLETE の助言に出さない（OD-D3-23）ので、窓が狭い・外れていると、正しい構成でも説明なしで「登録されない」。窓の再確認は Owner 判断（OD-R2）。

### 3.3 placement（reference fixture）

W2-A branch の値は authored ではなく **RT-01 の `assignReferenceSlots` に sauce → mozzarella → evidence 順の材料と minCount を渡した出力**（R-REF）。landing は葉物（arugula / parsley）が LIGHT_LEAF、他は HEAVY_SQUASH、tolerance 8/22。

| recipe | piece 数 | layout | 内訳（W2-A branch の候補。minCount が変われば変わる） | 格付け |
|---|---|---|---|---|
| prosciutto-funghi | 7 | legacy ring | mozzarella 2 / crudo 2 / mushroom 3 | STRONG |
| flammkuchen | 5 | legacy ring | bacon 3 / onion 2 | STRONG |
| jamon-serrano-pizza | 7 | legacy ring | mozzarella 2 / crudo 3 / arugula 2（LIGHT_LEAF） | STRONG |
| pesto-gamberi | 7 | legacy ring | shrimp 3 / fresh-tomato 2 / garlic 2 | STRONG |
| pesto-pollo | 7 | legacy ring | mozzarella 2 / chicken 3 / fresh-tomato 2 | STRONG |
| vongole | 7 | legacy ring | clam 3 / garlic 2 / parsley 2（LIGHT_LEAF） | STRONG |
| ratatouille-pizza | 7 | legacy ring | eggplant 2 / zucchini 2 / bell-pepper 2 / oregano 1 | STRONG |
| pesto-vegetariana | 8（ring 満杯） | legacy ring | mozzarella 2 / zucchini 2 / bell-pepper 2 / eggplant 2 | STRONG |

- **AUTHORITY の placement は 0 件。** recipe 個別の承認がない。W1 の前例は「設計案 → 人間 review → 承認された数値をそのまま literal で実装」（I5b-2 の `w1ReferenceFixtures`）。PR-4b brief §B-7 も「placeholder の ring 配置は採用しない、実装側が候補を出し Owner が承認」。**同じ手順を踏む前提で STRONG に留める。**
- 8 件とも 8 個以内なので RT-01 の multi-ring は不要（W1 の 3 件のような新しい layout 検証なし）。
- 順序依存: 座標は「evidence の材料順」と minCount の組で決まる。minCount を Owner が変えれば全 fixture を作り直す。

---

## 4. recipe ごとの詳細

### 4.1 共通の事実（8 件すべて）

- 生地の形: すべて round / open-round（PIZZA DB の dough evidence に非円形の記載なし）。
- late topping: **なし**（要求なし）。生ハム・ルッコラは catalog の finishing tag では焼成後だが、**OD-W2-7(e) で「焼く前」に確定**（OD-TAX-6: timing は identity ではない）。late-add の mechanic は不要。リアリティと引き換えの決定なので §7 に注記。
- shape requirement: なし。sauce-less: なし（8 件とも sauce あり。vongole は olive-oil、flammkuchen は fromage-blanc）。multi-spread: なし（spread layer は各 1 層）。
- thin / crispy 等の特殊生地: **機構として必要なものなし。** jamon は「薄めの生地」（`class: standard, variant: thin`）。DOUGH_VARIANT は不要。ただし jamon の identity は pinsa-romana（DOUGH_VARIANT が必要な別 recipe）と同一なので、jamon を採用すると **pinsa-romana は DOUGH_VARIANT が入るまで追加できない**（P0-COLL-4、OD-W2-7 で承認済みの留保）。
- Discovery の collision: **自前で再検証**（main の 25 件の `requiredIngredients` と W2-A 8 件）: exact 一致 **0**、nested は `funghi ⊂ prosciutto-funghi` の **1 組**、1 材料差も同じ 1 組（funghi ↔ prosciutto-funghi）。W2-A branch の記録と一致。
- baseRewardPitz: 既存の慣例は全 100。W2-A pack は値を指定していない → **UNKNOWN**（OD-R5）。
- unlockCondition / mysteryLock: W2-A pack は指定していない。W1 の OD-I5B-2（star gate なし）は W1 の 10 件についての決定 → **UNKNOWN**（OD-R5）。
- 説明文（description）: A3 で 9 件承認済み（AUTHORITY†）。表示名は evidence のまま（A4）。最長は「ペストベジタリアーナピザ」12 文字で、現行最長（12）と同じ。
- Mito の注文台詞: **W2-A pack に無い → UNKNOWN。** `recipes.test` が「1 recipe に 1 order」を要求し、注文が無い recipe は Pizza Select から開始できない。W1 では OD-I5B-1 で Owner が 10 件の文言を承認した。同じ承認が要る（OD-R5）。

### 4.2 Hint rung 構成（2 通りを併記。どちらを採るかは Owner）

OD-W2-H5-ROLE-1 / SUB-1（Owner 承認済み・未実装）の explicit roles と、OD-D3-19（Migration A: 新 recipe は key-free）が**同じ 8 件に対して食い違う**。rung 数は `buildHint5Ladder` / key-free の規則（`recipeHintRoles.ts` の doc comment、OD-D3-21）から数えた値で、実装テストでの確認は未実施。

| recipe | authored（ROLE-1）: key / sub 順 | authored の rung（cheese 無しでも CHEESE rung は出る = 空の「なし」答え） | key-free の rung（存在するものだけ） |
|---|---|---|---|
| prosciutto-funghi | mushroom / [prosciutto-crudo] | SAUCE, CHEESE, KEY, STRUCTURE, SUB×1 = 5 | SAUCE, CHEESE, STRUCTURE, SUB×2 = 5 |
| flammkuchen | bacon / [onion] | SAUCE, CHEESE(空), KEY, STRUCTURE, SUB×1 = 5 | SAUCE, STRUCTURE, SUB×2 = 4 |
| jamon-serrano-pizza | prosciutto-crudo / [arugula] | 5 | SAUCE, CHEESE, STRUCTURE, SUB×2 = 5 |
| pesto-gamberi | shrimp / [fresh-tomato, garlic] | CHEESE(空) を含め 6 | SAUCE, STRUCTURE, SUB×3 = 5 |
| pesto-pollo | chicken / [fresh-tomato] | 5 | SAUCE, CHEESE, STRUCTURE, SUB×2 = 5 |
| vongole | clam / [garlic, parsley] | CHEESE(空) を含め 6 | SAUCE, STRUCTURE, SUB×3 = 5 |
| ratatouille-pizza | eggplant / [zucchini, bell-pepper, oregano] | CHEESE(空) を含め 7 | SAUCE, STRUCTURE, SUB×4 = 6 |
| pesto-vegetariana | eggplant / [zucchini, bell-pepper] | 6 | SAUCE, CHEESE, STRUCTURE, SUB×3 = 6 |

- OD-D3-19 は「廃止するのは Hint 5.0 の `hintKeyToppingId` / KEY_TOPPING という概念」「新 recipe に空の rung を出さない」。authored の cheese 無し 5 件（flammkuchen / gamberi / vongole / ratatouille ＋ calabresa）で出る「空の CHEESE rung」は、OD-D3-19 と**向きが逆**。
- ROLE-1 の「key + sub = recipe の topping 全件をちょうど 1 回ずつ」「C1-P」は gate で 9/9 PASS 済み（`ab31da33a5`）。key-free を採ってもこの roles は不要になるだけで、壊れはしない。
- taxonomy watch: garlic（vongole / gamberi の sub）と black-olive は sub のみ。8 件の topping は W2-A1 が与える 7 family 行（OD-W2-5）で全件 family を持つ。

### 4.3 recipe 別の表（残りの要求項目）

| recipe | KEY_TOPPING（ROLE-1） | SUB_TOPPING（ROLE-1 の順） | key-free か | cooking profile | CUT / 根拠 | Discovery | Lunch Rush | Shop / progression への影響 |
|---|---|---|---|---|---|---|---|---|
| prosciutto-funghi | mushroom | prosciutto-crudo | **未決**（OD-R3）。authored 案が承認済み | DOUGH→SAUCE→CHEESE→TOPPING→CUT | あり（ナポリ生地）。allowlist 追加は #295 と衝突 | DISCOVERABLE。funghi と nested（test T-1〜T-8 が必要） | 発見後に pool 入り | step 25 = prosciutto-crudo（T3 100/50）。**W1 全 25 件を発見して初めて解放**（count ≥ 25） |
| flammkuchen | bacon | onion | 未決 | DOUGH→SAUCE→TOPPING | **なし**（dough evidence なし = OD-W2-4、New Haven と同じ） | DISCOVERABLE | 同上 | step 26 = fromage-blanc-sauce（T3）。**finite な sauce が Shop に並ぶ最初の例** |
| jamon-serrano-pizza | prosciutto-crudo | arugula | 未決 | DOUGH→SAUCE→CHEESE→TOPPING→CUT | あり（薄め生地）。#295 と衝突 | DISCOVERABLE。pinsa-romana を将来ブロック | 同上 | step 27 = arugula（T3）。crudo は step 25 で解放済み |
| pesto-gamberi | shrimp | fresh-tomato, garlic | 未決 | DOUGH→SAUCE→TOPPING→CUT（cheese なし） | あり（ナポリ生地）。#295 | DISCOVERABLE | 同上 | step 28 = shrimp（T3） |
| pesto-pollo | chicken | fresh-tomato | 未決 | DOUGH→SAUCE→CHEESE→TOPPING→CUT | あり。#295 | DISCOVERABLE | 同上 | step 29 = chicken（T3 の最後、29） |
| vongole | clam | garlic, parsley | 未決 | DOUGH→SAUCE→TOPPING | **なし**（dough evidence なし） | DISCOVERABLE | 同上 | step 30 = parsley。**T4（120/60）と第4章の初出**。ladder 上の最初の「章の増加」 |
| ratatouille-pizza | eggplant | zucchini, bell-pepper, oregano | 未決 | DOUGH→SAUCE→TOPPING→CUT（cheese なし） | あり。#295 | DISCOVERABLE。step 31 の key recipe（vegetariana と同時に作れるようになる） | 同上 | step 31 = bell-pepper + zucchini（T4）。2 材料同時解放（通知は 2 材料） |
| pesto-vegetariana | eggplant | zucchini, bell-pepper | 未決 | DOUGH→SAUCE→CHEESE→TOPPING→CUT | あり。#295 | DISCOVERABLE。**ratatouille と同じ step で pool = 2 になる**（branching の 2 例目）。ladderCredit は recipe ごとの決定（OD-R4） | 同上 | **自前の step なし**（materials は ratatouille の step 31 で足りる） |

- evidence strength（PIZZA DB の根拠）: **HIGH** = vongole / flammkuchen / pesto-gamberi / pesto-pollo / ratatouille-pizza / pesto-vegetariana / jamon-serrano-pizza。**MEDIUM** = prosciutto-funghi（Phase-1 `READY_WITH_REVIEW`、catalog-only の `prosciutto-e-funghi` と材料集合が同じ。OD-W2-7 で `prosciutto-funghi` として採用済み）。いずれも比較表サンプル（`comparison_table_sample`）由来で、quantity / bake / placement の evidence は PIZZA DB に存在しない（recipe の game-balance 値は authoring）。
- Lunch Rush: 発見後に pool 入りするのは全件同じ（`unlockCondition` なし）。注文は材料が OWNED なら出る（在庫 0 の recipe が注文されうる、既存の制約）。**ranking の ruleset は変えない**（式・gate・時間は不変）。Mito の注文台詞（UNKNOWN）以外に Lunch Rush 固有の作業なし。参加可否そのものは PR-4b brief §B-3（参加 / 除外）の Owner 判断に従う。
- Dinner: **mission 定義は変わらない**（`w1-25`、target 明示）。detection は `RECIPE_DISCOVERY_CATALOG` 全体で composition から同定するため、8 件は「target 外 recipe」として Stage A で自分の bake window と CUT 有無を採用する。影響は 2 点だけ: (1) `dinnerResultDetection` の bake window 数など件数 pin の更新、(2) funghi が target の dm-a / dm-b で、funghi + prosciutto-crudo の盛りが「NO_MATCH」から「prosciutto-funghi（target 外）」に変わる（prosciutto-crudo は step 25 = W1 全発見後でないと持てないので、dm-a / dm-b の通常動線への影響は小さい）。

---

## 5. 変更の種類の分類

| 分類 | 件数 | 内訳 |
|---|---|---|
| **DATA-ONLY** | **0** | 該当なし（どの recipe も reference fixture・Mito 台詞・ladder 追加などの authoring を伴う） |
| **DATA + AUTHORING** | **8** | 全件。実装が解けた場合の変更の種類 |
| **NEW MECHANIC REQUIRED** | **0** | sauce-less / multi-spread / late-add / DOUGH_VARIANT / 新 cut 機構はどれも不要。flammkuchen の白ソースは「新 sauce profile の追加」（型の widening は W2-A1 が持つ）で、新しい操作ではない。**white-on-dough の視認性は 390×844 の Human Visual が必要**（A5 の条件付き承認） |
| **BLOCKED BY OTHER PR** | **8** | 全件が W2-A1（8 材料 + 専用 visual 2 件 + taxonomy 7 行 + `RecipeSauceProfile` の union 拡張）を前提にする。W2-A1 は**未 merge の branch 上の commit で、PR すら無い**。さらに CUT 対象 6 件（prosciutto-funghi / jamon / gamberi / pollo / ratatouille / vegetariana）は `cookingProfiles.ts` の allowlist 編集で **#295 と衝突** |
| **OWNER DECISION REQUIRED** | **8** | 全件（§6）。値のほとんどは承認済みだが、(a) Discovery 3.0 以前の承認で main に記録が無い、(b) key-free 方針との競合、(c) 注文台詞が未承認、(d) ladderCredit が recipe ごとの決定、のため |

---

## 6. 横断の依存と Owner Decision

### 6.1 Owner Decision が必要な項目（私は選んでいない。選択肢と推奨だけ）

| ID | 内容 | 選択肢（推奨が先頭） |
|---|---|---|
| **OD-R1** | 対象集合の確認: 「W1 remaining」= W2-A pack の 8 件でよいか。#220 の W2（11 件）とは別集合 | (a) W2-A pack の 8 件（本 report）/ (b) #220 の W2 の 11 件 / (c) 別の集合 |
| **OD-R2** | W2-A の承認（A1〜A8、OD-W2-1〜9、ROLE-1 / SUB-1）は未 merge branch にあり、Discovery 3.0 以前。main の docs に写して**再承認**するか。特に bake の WEAK 2 件（gamberi 50–70 / jamon 55–75）と placement 全件 | (a) 1 回の docs PR で台帳を main に写し、WEAK / STRONG の値を一括再承認 / (b) 1 recipe ずつ承認 |
| **OD-R3** | Hint の方式: 承認済みの explicit roles（ROLE-1）か、OD-D3-19 の key-free か（cheese 無し 4 件は「空の CHEESE rung」の有無が変わる） | (a) 新 recipe は key-free（OD-D3-19 と整合、roles 不要）/ (b) ROLE-1 の authored roles / (c) recipe ごと |
| **OD-R4** | ladderCredit（OD-D3-17 O3）: 7 件の key recipe は step 25〜31 を開けるので credit が必要。**pesto-vegetariana は自前の step を持たず ratatouille と同 step で branching になる。** credit の有無は recipe ごとの決定 | vegetariana: credit あり（W2-A gate の softlock 解析が前提としていた形）/ なし（branching 2 例目として扱う）。他 7 件は credit あり |
| **OD-R5** | 未指定の値: (a) Mito の注文台詞 8 件（W1 の OD-I5B-1 と同じ承認）、(b) baseRewardPitz（慣例 100）、(c) unlockCondition / star gate の有無（W1 は「なし」） | 台詞は draft を別途提示して承認。(b)(c) は W1 に揃える案が自然 |
| **OD-R6** | PR-4b の共通判断（pool > 1 の auto-target、Dex 🎨 カード、Lunch Rush 参加、CUT 方針）は、この 8 件にもそのまま及ぶ。**PR-4b の回答を 8 件の既定にするか** | PR-4b brief §B-1,2,3,9 の回答を継承（二重に聞かない） |
| **OD-R7** | 追加を 1 recipe ずつにするか、同 step の 2 件（ratatouille + vegetariana）を 1 PR にするか | 1 recipe ずつ（vegetariana は ratatouille の後） |

### 6.2 quantity 未確定（AUTHORITY でないもの）

- **全 recipe に STRONG が混ざる。** AUTHORITY† は flammkuchen / ratatouille / vegetariana / prosciutto-funghi の主役 topping だけ。
- 完全に STRONG のみ（recipe 個別の承認なし）: vongole / pesto-gamberi / pesto-pollo / jamon-serrano-pizza。
- sauce 1・mozzarella 2・oregano 1（ratatouille）は全 recipe で rule 由来の STRONG。UNKNOWN は 0 件。

### 6.3 bake 未確定

- WEAK: pesto-gamberi（50–70）、jamon-serrano-pizza（55–75）。
- STRONG: vongole（62–82）、ratatouille-pizza（58–78）。
- AUTHORITY†: prosciutto-funghi / flammkuchen / pesto-pollo / pesto-vegetariana。
- UNKNOWN: 0 件。

### 6.4 placement 未確定

- **8 件すべて STRONG（AUTHORITY 0）**。minCount が変わると作り直し。

### 6.5 CUT / #295 依存

- #295 と衝突する `cookingProfiles.ts` の allowlist 追加を伴う: **6 件**（prosciutto-funghi / jamon-serrano-pizza / pesto-gamberi / pesto-pollo / ratatouille-pizza / pesto-vegetariana）。
- CUT なし（allowlist に載せない）: **vongole / flammkuchen**（#295 と無関係、OD-W2-4）。
- CUT 追加は PR-4b でも「最後の別 commit、#295 の状況次第」と整理されている。同じ扱いにするのが整合的。`cookingProfiles.test` の step 表と tab 数（#295 の 6-tab gate）も #295 の状態に依存する。

---

## 7. 実装順序の候補（Owner が採用する recipe を変えない前提）

### 7.1 先に必要な、recipe ではない slice（順序固定）

| 順 | slice | 内容 | 依存 |
|---|---|---|---|
| 0a | Owner decision の一括回答 | OD-R1〜R7 | — |
| 0b | docs: W2-A の台帳・candidates を main に写す | docs / tools のみ。再承認の記録 | OD-R2 |
| 0c | **W2-A1 を main に載せる**（8 材料 + 専用 visual + taxonomy + union 拡張。gameplay 変更なし、Shop に出ない） | trial merge で conflict 1 ファイル。HV は「見えない変更」なので不要（W2-A1 の方針と同じ） | 0b |
| 0d | PR-4b（Calabresa）の HV 通過 | pool = 2 の最初の実例を production で確認 | — |

### 7.2 recipe を 1 件ずつ追加する場合

**案 A（推奨）: ladder の設計順（step 25 → 31）。** W2-A gate が softlock 0 / unreachable 0 を検証した順。1 recipe を足すと、その recipe の新材料だけが次の step として append される（`POST_W1_APPENDED_STEPS`）。

1. `prosciutto-funghi`（step 25。新材料 1、nested の funghi で matcher の強い test が先に取れる）
2. `flammkuchen`（step 26。CUT なし = #295 に依存しない。白ソースの HV）
3. `jamon-serrano-pizza`（step 27）
4. `pesto-gamberi`（step 28）
5. `pesto-pollo`（step 29）
6. `vongole`（step 30。**T4・第4章が初めて現れる** = chapter UI の確認を含める）
7. `ratatouille-pizza`（step 31。2 材料同時の通知）
8. `pesto-vegetariana`（step 31 と同 step。自前の step なし。branching）

**案 B（#295 が長引く場合）: CUT 非依存を先に。** `flammkuchen` → `vongole`（どちらも CUT なし）。ただし ladder が「fromage-blanc が step 25、parsley が step 26」になり、W2-A gate の verified 設計（25〜31）から変わる → **softlock / 章 / 価格の再検証が必要**。Owner が許容するときだけ。

- どの案でも、各 recipe の追加は main への merge = 即公開（`deploy.yml`）。**recipe 1 件 = 1 PR、`TETO_HUMAN-VERIFICATION-POLICY.md` の HV（390×844 動画 + before/after screenshot）が DoD。**
- 各 PR に含めるもの: recipe 行 / sauce profile / reference literal / ORDERS / discovery target / ladder 1 step / （CUT の場合 allowlist）/ Hint（OD-R3 の結果）/ 件数 pin（`N/26 → N/27` など）の更新。

---

## 8. 回答（依頼された 16 項目）

1. **audited main SHA:** `52d14f9ef085b2c3c81e4e11e3f555ecc17a1e57`
2. **対象 recipe:** `prosciutto-funghi` / `flammkuchen` / `jamon-serrano-pizza` / `pesto-gamberi` / `pesto-pollo` / `vongole` / `ratatouille-pizza` / `pesto-vegetariana`（W2-A pack の 8 件。**#220 の W1 の残りは 0 件** = 出荷済み。§0 参照）
3. **DATA-ONLY:** 0 件
4. **DATA + AUTHORING:** 8 件
5. **NEW MECHANIC REQUIRED:** 0 件
6. **BLOCKED:** 8 件（W2-A1 が未 merge・PR なし）。うち 6 件は #295 とも衝突
7. **Owner Decision:** OD-R1〜R7（§6.1）。8 件すべてに最低 1 つが及ぶ
8. **quantity 未確定:** AUTHORITY でないもの = vongole / pesto-gamberi / pesto-pollo / jamon-serrano-pizza は全 STRONG、他 4 件も sauce / mozzarella / oregano は STRONG（主役 topping は AUTHORITY†）。UNKNOWN は 0。既存 pack の超過は 0
9. **bake 未確定:** WEAK = pesto-gamberi, jamon-serrano-pizza。STRONG = vongole, ratatouille-pizza。AUTHORITY† = 他 4 件
10. **placement 未確定:** 8 件すべて STRONG（AUTHORITY 0）
11. **CUT / #295 依存:** 6 件（prosciutto-funghi / jamon / gamberi / pollo / ratatouille / vegetariana）。vongole / flammkuchen は CUT なしで非依存
12. **Lunch Rush:** ruleset 不変。発見後に pool 入り（在庫は見ない）。Mito 台詞 8 件が UNKNOWN（Owner 承認が要る）。参加可否は PR-4b の回答に従う
13. **Dinner:** mission 定義（`w1-25`、dm-a / dm-b）は不変。8 件は target 外 recipe として扱われる。件数 pin の更新と、funghi ⊂ prosciutto-funghi の matcher test（T-1〜T-8）が必要
14. **Calabresa の HV 後すぐ実装できる recipe:** **0 件。** 8 件とも W2-A1 の新材料を要する（Calabresa だけが W1 材料のみで作れる recipe だった）。HV 後にまず必要なのは recipe ではなく、0b → 0c の slice
15. **推奨実装順序:** §7.2 案 A（prosciutto-funghi → flammkuchen → jamon → gamberi → pollo → vongole → ratatouille → vegetariana）。案 B は設計外の入れ替えで、再検証が要る
16. **W1 全体を Preview で実機確認できるまでの残 blocker:**
    - Owner Decision OD-R1〜R7 の回答
    - W2-A の台帳を main へ写す docs PR（再承認）
    - W2-A1 の main への port（conflict 1 ファイル、未 PR）
    - PR-4b（Calabresa）の HV と、その共通判断（pool > 1 の auto-target、Dex 🎨、Lunch Rush 参加）
    - 各 recipe の reference literal（RT-01）と Scoring / Completion の golden を、**現在の main（#222 の Q factor、Hint 5.0 ON、key-free）で再校正**（W2-A の harness 値は 2026-09-27 時点）
    - Mito 台詞 8 件の承認
    - Hint 方式（OD-R3）と、DH4 の audit（`dh4_2_topping_count_audit.py` は 25-recipe pin）の再実行
    - #295（CUT allowlist の 6 件）
    - flammkuchen の白ソースの Human Visual（A5 の条件）
    - 件数 pin / e2e の更新（Dex pill `/N`、Pizza Select の枚数、RT-01 harness の枚数。PR-4a の dry-run が 15 spec / 29 失敗の機械的な pin を確認済み）
    - 390×844 / 360×800 の HV 動画（repo には commit しない）と screenshot（`docs/reports/screenshots/<task-name>/`）
    - T4・第4章の初出（vongole）の Pizza Select / Shop 表示確認、tray の topping 5 ページ化（A7 で承認済み）
    - Preview deploy

---

## 9. この audit の限界（正直な記録）

- 実装テストは走らせていない（`node_modules` 無し、docs-only の指示）。collision の再検証は main の `recipes.ts` と W2-A candidates の材料集合を Python で照合したもの（exact 0、nested / d=1 は funghi の 1 組）。
- Hint の rung 数は規則（doc comment）から数えた値で、`buildHint5Ladder` の実行結果ではない。
- W2-A の Scoring / ★ / Completion の「期待値」は branch の harness 値の転記で、main では再実行していない（格付けに使っていない）。
- bake の WEAK 判定（gamberi / jamon）は私の読み方で、W2-A gate の「DERIVED」ラベルと異なる。理由は各行に記した。Owner が rule を緩く読むなら STRONG に戻る。
- 「W1 remaining」の解釈（§0）は私の推定。誤っていれば OD-R1 で差し替える。
