# W2-A Hint 5.0 Role Authoring Review (Owner Review pack)

**docs/data/tools only。これは DA-1 実装ではなく、authority でもない。**
- 全ての key / sub 順は **CANDIDATE**。Owner が決めるまで何も確定しない。
- 変更なし: `recipeHintRoles.ts`、`src`、e2e、recipe / ingredient production、taxonomy、Hint 5.0 実装、H5-4、TQ、Cooking Steps、progression、Wave 2 実装。merge / PR なし。

| 成果物 | パス |
|---|---|
| Report (this file) | `docs/reports/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.md` |
| Machine-readable | `docs/reports/data/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.json` |
| Generator / checker | `tools/w2a_hint5_role_authoring_review.py` (`--check` は byte drift を検出) |

## 0. 結果 (一覧)

- 対象 **9 recipe**、全件が Owner Review 対象。「主役が 1 つ明確」な recipe も authority 化していない。
- **明確な主役あり: 5** (vongole, jamon-serrano-pizza, brazilian-calabresa, pesto-gamberi, pesto-pollo)。Owner は「確認」するだけでよいが、確認は必要。
- **co-equal で Owner 選択が必要: 4** (flammkuchen, prosciutto-funghi, pesto-vegetariana, ratatouille-pizza)。
- **sub 順の Owner Decision: 5 件** (vongole, brazilian-calabresa, pesto-gamberi, pesto-vegetariana, ratatouille-pizza)。sub が 2 つ以上あり、既存 authoring に順序の根拠がない。
- 残り 4 recipe (flammkuchen, jamon-serrano-pizza, prosciutto-funghi, pesto-pollo) は topping が 2 つだけなので、key が決まれば sub は 1 つで順序は強制される。
- **C1-P conflict: 0**。推奨・候補のどれも sauce / cheese ではなく、推奨 key は herb / spice family ではない。ただし co-equal の 4 recipe では C1-P だけでは key が決まらない (conflict ではなく non-determinative)。
- **P4-CHEESE 対象: 5 recipe** (vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille-pizza)。P4b (key なし) の対象は 0。

## 1. Fresh state と参照した authority

| 項目 | 状態 |
|---|---|
| audited `main` | `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (Merge PR #291)。 |
| Hint 5.0 (#292) | branch `claude/hint-5-0-fresh-audit-cdgm9e`。H5-3 head `1ec4253`、H5-4 Fresh Gate commit `5eadb96`。`recipeHintRoles.ts` は runtime 25 recipe のみ (W2-A id は 0 件)。PR / main 未反映。 |
| DA-1 Preparation Audit | branch `claude/172-da-1-preparation-audit` @ `e829a17`。参照のみ。 |
| 172 Authority Matrix | branch `claude/172-recipe-authority-matrix` @ `79873c0`。参照のみ。 |
| Wave 2 W2-A | branch `claude/wave2-runtime-recipe-design-os06j1` @ `2bc40e4`。OD-W2 ledger と `w2a_authoring_candidates.json` (A1〜A8 は `APPROVED_OWNER`) を **read-only** で参照。PR なし。 |

**C1-P (OD-H5-C1-P, APPROVED):** Hint 5.0 の key topping は、そのレシピを特徴づける主要トッピング。香り付け・添え物より主役となる材料を優先し、sauce / cheese と情報を重複させない。

**authority として使っていないもの:**
- recipe requiredIngredients array order (OD-H5-C1)
- name-match candidates (DA-1 Preparation Audit: guideline only)
- the H5-0 §6.4 tie-break ("NOT Owner authority")
- the W2-A minCount roles (R-MC): quantity authoring, not Hint 5.0 role authority; cited as evidence only

G17 (H5-1) が課す制約は「key は recipe の topping」「sub 順は key 以外の topping を 1 回ずつ」だけで、sub 順の規則は存在しない。この review も規則を作らない。汎用の tie-break rule (172 recipe 向け) も作らない。

### 記法
- 「W2-A A1 の primary」等は W2-A minCount authoring (R-MC) の役割タグで、Hint 5.0 role の authority ではない。Owner 判断の **evidence** として引用する。
- 「sub 順の family label 列」は、sub① から順に何の family label が出るかを機械的に並べたもの。順序を選ぶ根拠ではなく、順序が player に見える情報を変えるかどうかを示す事実。
- sub 順は key が決まって初めて意味を持つので、key を変えた場合の全組合せも JSON (`subOrderByKey`) に載せた。

## 2. 9 recipe 概要

| Recipe | class | sauce | cheese | toppings | 推奨 key (candidate) | 確度 | sub 残り | sub 順の Owner Decision | P4-CHEESE |
|---|---|---|---|---|---|---|---|---|---|
| `vongole` | CLEAR_MAIN | olive-oil | なし | clam×3, garlic×2, parsley×2 | **clam** | high (confirm) | garlic, parsley | 要 (2 通り) | 対象 |
| `flammkuchen` | CO_EQUAL | fromage-blanc-sauce | なし | bacon×3, onion×2 | **bacon** | low (genuine co-equal; Owner choice) | onion | 不要 (強制) | 対象 |
| `jamon-serrano-pizza` | CLEAR_MAIN | tomato-sauce | mozzarella | arugula×2, prosciutto-crudo×3 | **prosciutto-crudo** | high (confirm) | arugula | 不要 (強制) | 対象外 |
| `brazilian-calabresa` | CLEAR_MAIN | tomato-sauce | なし | black-olive×2, onion×2, oregano×1, sausage×3 | **sausage** | high (confirm) | black-olive, onion, oregano | 要 (6 通り) | 対象 |
| `prosciutto-funghi` | CO_EQUAL | tomato-sauce | mozzarella | mushroom×3, prosciutto-crudo×2 | **mushroom** | low (genuine co-equal; Owner choice) | prosciutto-crudo | 不要 (強制) | 対象外 |
| `pesto-gamberi` | CLEAR_MAIN | pesto | なし | fresh-tomato×2, garlic×2, shrimp×3 | **shrimp** | high (confirm) | fresh-tomato, garlic | 要 (2 通り) | 対象 |
| `pesto-vegetariana` | CO_EQUAL | pesto | mozzarella | bell-pepper×2, eggplant×2, zucchini×2 | **eggplant** | low (genuine co-equal; Owner choice) | bell-pepper, zucchini | 要 (2 通り) | 対象外 |
| `pesto-pollo` | CLEAR_MAIN | pesto | mozzarella | chicken×3, fresh-tomato×2 | **chicken** | high (confirm) | fresh-tomato | 不要 (強制) | 対象外 |
| `ratatouille-pizza` | CO_EQUAL | tomato-sauce | なし | bell-pepper×2, eggplant×2, oregano×1, zucchini×2 | **eggplant** | low (genuine co-equal; Owner choice) | bell-pepper, oregano, zucchini | 要 (6 通り) | 対象 |

`jamon-serrano-pizza` は task の `jamon-serrano` と同じ recipe (W2-A authoring の runtime id)。

## 3. Recipe 別 review (A〜M)

### 3.1 `vongole` — ヴォンゴレピザ (CLEAR_MAIN)

**A. recipe**
- evidence id: `vongole-pizzadb`。sauce: olive-oil。cheese: なし。W1 analog: new-haven-apizza。
- description (A3 承認済み): 「オリーブオイルを塗った生地に、あさり、にんにく、パセリをのせて焼き上げた、チーズを使わない魚介の一枚。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `clam` | 3 | seafood | あり | ✔ |
| `garlic` | 2 | herb | あり | ✔ |
| `parsley` | 2 | herb | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `olive-oil` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce; OD-W2-7(a) olive oil as base
- `clam` ×3 (DERIVED_FROM_AUTHORITY): R-MC primary; = new-haven-apizza clam 3
- `garlic` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting; = new-haven-apizza garlic 2
- `parsley` ×2 (DERIVED_FROM_AUTHORITY): R-MC herb baseline
- description 内の登場順 (参照のみ、候補の導出には不使用): clam, garlic, parsley

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `clam` | 推奨 | C1-P main (魚介の主役)。名前 vongole = あさり。W2-A A1 の primary。W1 の new-haven-apizza (olive-oil base, clam 3) と同じ構成で、その runtime key も clam。 |
| `garlic` | alternative | aroma。C1-P は aroma より main を優先するので不採用寄り。 |
| `parsley` | alternative | aroma / garnish。C1-P は aroma・添え物より main を優先するので不採用寄り。 |

**G. garnish / aromatic risk:** garlic / parsley は herb family の aroma。key にすると C1-P に反する。clam はどちらでもない。

**H. sauce / cheese overlap risk:** なし。sauce = olive-oil、cheese = なし。clam は topping で、sauce / cheese の情報と重複しない。

**I. 推奨 key candidate:** `clam` (確度: high (confirm))。**candidate であり authority ではない。**

**J. 残り sub toppings (推奨 key の場合):** `garlic`, `parsley`

**K. sub order candidate (推奨 key の場合)**
- 全 2 通り: [garlic, parsley] / [parsley, garlic]
- family label 列 (sub① → …) の種類: 1 種: herb > herb
- **推奨順序なし** (根拠となる authority がない)。
- alternative key `garlic` の場合: 2 通り (family label 列 2 種)。全組合せは JSON。
- alternative key `parsley` の場合: 2 通り (family label 列 2 種)。全組合せは JSON。

**L. sub order を決める根拠**
- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。
- 事実: sub の family がすべて同じなので、どの順序でも player に見える family label の列は同じ (保存される `cls:<ingredientId>` の id だけが変わる)。

**M. Owner Decision:** key = **必要** (唯一の主役の確認)。sub 順 = **必要**。

### 3.2 `flammkuchen` — タルトフランベ (CO_EQUAL)

**A. recipe**
- evidence id: `flammkuchen-pizzadb`。sauce: fromage-blanc-sauce。cheese: なし。W1 analog: breakfast-pizza / fugazza。
- description (A3 承認済み): 「フロマージュブランを塗った生地に、ベーコンとたまねぎをのせて焼き上げた、アルザス生まれの白い一枚。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `bacon` | 3 | meat | あり | ✔ |
| `onion` | 2 | vegetable | あり | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `fromage-blanc-sauce` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `bacon` ×3 (APPROVED_OWNER): two co-defining toppings (bacon + onion); R-MC has one primary. Candidate bacon 3 / onion 2; alternatives 2/3 or 3/3 -- Owner A1: recommended candidate adopted
- `onion` ×2 (APPROVED_OWNER): see bacon -- Owner A1: recommended candidate adopted
- description 内の登場順 (参照のみ、候補の導出には不使用): bacon, onion

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `bacon` | 推奨 | meat。W2-A A1 は bacon 3 / onion 2 を採用したが、これは minCount であって Hint role の authority ではない。W1 の breakfast-pizza (bacon key, egg sub) が analog。 |
| `onion` | alternative | vegetable。W2-A A1 が bacon と並ぶ co-defining topping と記録。W1 の fugazza は onion key (C1a) で、onion を key にした前例はある。 |

**G. garnish / aromatic risk:** どちらも aroma / garnish ではない (onion は vegetable family で herb / spice ではない)。C1-P はどちらも排除しない。

**H. sauce / cheese overlap risk:** なし。sauce = fromage-blanc-sauce、cheese = なし。

**I. 推奨 key candidate:** `bacon` (確度: low (genuine co-equal; Owner choice))。**candidate であり authority ではない。**
- 弱い推奨。bacon は承認済み minCount が最大 (evidence only)、protein で W1 breakfast-pizza と同型。ただし onion も co-defining と明記されているので、これは Owner 判断。

**J. 残り sub toppings (推奨 key の場合):** `onion`

**K. sub order candidate (推奨 key の場合)**
- 強制: [onion] (topping が 2 つだけなので key が決まれば sub は 1 つ)。
- alternative key `onion` の場合: 強制 [bacon]

**L. sub order を決める根拠**
- key が決まれば sub は 1 つで、順序の根拠は不要。ただし key が Owner 判断なので、sub もそれに従属する。

**M. Owner Decision:** key = **必要** (co-equal から選択)。sub 順 = **不要 (key に従属)**。

### 3.3 `jamon-serrano-pizza` — ハモンセラーノピザ (CLEAR_MAIN)

**A. recipe**
- evidence id: `jamon-serrano-pizza-pizzadb-p7`。sauce: tomato-sauce。cheese: mozzarella。W1 analog: hawaiian (structure)。
- description (A3 承認済み): 「トマトソースとモッツァレラに、生ハムとルッコラを合わせた、スペイン風のシンプルな一枚。」
- 注: runtime id は W2-A authoring では `jamon-serrano-pizza` (PIZZA DB evidence id `jamon-serrano-pizza-pizzadb-p7`)。task の `jamon-serrano` と同じ recipe。pinsa-romana と ingredient set が完全一致 (P0-COLL-4, OD-W2-7: DOUGH_VARIANT で後に分離)。pinsa-romana の role はこの review の対象外。

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `arugula` | 2 | vegetable | **なし (W2-A1 branch のみ)** | ✔ |
| `prosciutto-crudo` | 3 | meat | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `tomato-sauce` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `mozzarella` ×2 (DERIVED_FROM_AUTHORITY): R-MC mozzarella
- `prosciutto-crudo` ×3 (DERIVED_FROM_AUTHORITY): R-MC primary (jamón)
- `arugula` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- description 内の登場順 (参照のみ、候補の導出には不使用): prosciutto-crudo, arugula

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `prosciutto-crudo` | 推奨 | C1-P main (protein)。名前 jamón = 生ハム。W2-A A1 の primary (jamón)。 |
| `arugula` | alternative | leaf の添え物 (supporting)。C1-P は garnish より main を優先するので不採用寄り。 |

**G. garnish / aromatic risk:** arugula は葉物の添え物。key にすると C1-P に反する。prosciutto-crudo は protein main。

**H. sauce / cheese overlap risk:** なし。sauce = tomato-sauce、cheese = mozzarella。key は topping。

**I. 推奨 key candidate:** `prosciutto-crudo` (確度: high (confirm))。**candidate であり authority ではない。**

**J. 残り sub toppings (推奨 key の場合):** `arugula`

**K. sub order candidate (推奨 key の場合)**
- 強制: [arugula] (topping が 2 つだけなので key が決まれば sub は 1 つ)。
- alternative key `arugula` の場合: 強制 [prosciutto-crudo]

**L. sub order を決める根拠**
- key が決まれば sub は 1 つで、順序の根拠は不要。ただし key が Owner 判断なので、sub もそれに従属する。

**M. Owner Decision:** key = **必要** (唯一の主役の確認)。sub 順 = **不要 (key に従属)**。

### 3.4 `brazilian-calabresa` — ブラジリアン・カラブレーザ (CLEAR_MAIN)

**A. recipe**
- evidence id: `brazilian-calabresa-pizzadb-p10`。sauce: tomato-sauce。cheese: なし。W1 analog: salsiccia。
- description (A3 承認済み): 「トマトソースにソーセージ、たまねぎ、ブラックオリーブ、オレガノをのせた、サンパウロ生まれのチーズを使わない一枚。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `black-olive` | 2 | vegetable | あり | ✔ |
| `onion` | 2 | vegetable | あり | ✔ |
| `oregano` | 1 | herb | あり | ✔ |
| `sausage` | 3 | meat | あり | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `tomato-sauce` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `sausage` ×3 (DERIVED_FROM_AUTHORITY): R-MC primary (calabresa = the sausage)
- `onion` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- `black-olive` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- `oregano` ×1 (DERIVED_FROM_AUTHORITY): R-MC oregano accent (napoletana precedent: tomato + protein + oregano 1)
- description 内の登場順 (参照のみ、候補の導出には不使用): sausage, onion, black-olive, oregano

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `sausage` | 推奨 | C1-P main (calabresa = sausage)。W2-A A1 の primary。W1 の salsiccia (sausage key) が analog。 |
| `onion` | alternative | supporting vegetable。W2-A A1 は supporting 扱い。 |
| `black-olive` | alternative | supporting vegetable。W2-A A1 は supporting 扱い。family は HCG watch。 |
| `oregano` | alternative | aroma (accent, minCount 1)。C1-P は aroma を優先しない。 |

**G. garnish / aromatic risk:** oregano は accent の aroma (herb)。key にすると C1-P に反する。onion / black-olive は supporting で main ではない。sausage は main。

**H. sauce / cheese overlap risk:** なし。sauce = tomato-sauce、cheese = なし。

**I. 推奨 key candidate:** `sausage` (確度: high (confirm))。**candidate であり authority ではない。**

**J. 残り sub toppings (推奨 key の場合):** `black-olive`, `onion`, `oregano`

**K. sub order candidate (推奨 key の場合)**
- 全 6 通り: [black-olive, onion, oregano] / [black-olive, oregano, onion] / [onion, black-olive, oregano] / [onion, oregano, black-olive] / [oregano, black-olive, onion] / [oregano, onion, black-olive]
- family label 列 (sub① → …) の種類: 3 種: herb > vegetable > vegetable; vegetable > herb > vegetable; vegetable > vegetable > herb
- **推奨順序なし** (根拠となる authority がない)。
- alternative key `black-olive` の場合: 6 通り (family label 列 6 種)。全組合せは JSON。
- alternative key `onion` の場合: 6 通り (family label 列 6 種)。全組合せは JSON。
- alternative key `oregano` の場合: 6 通り (family label 列 3 種)。全組合せは JSON。

**L. sub order を決める根拠**
- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。
- 事実: 順序によって sub① で見える family label が変わる。

**M. Owner Decision:** key = **必要** (唯一の主役の確認)。sub 順 = **必要**。

### 3.5 `prosciutto-funghi` — プロシュットフンギ (CO_EQUAL)

**A. recipe**
- evidence id: `prosciutto-funghi-pizzadb-p11`。sauce: tomato-sauce。cheese: mozzarella。W1 analog: funghi。
- description (A3 承認済み): 「トマトソースとモッツァレラに、生ハムとマッシュルームを合わせた、イタリア定番の組み合わせの一枚。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `mushroom` | 3 | vegetable | あり | ✔ |
| `prosciutto-crudo` | 2 | meat | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `tomato-sauce` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `mozzarella` ×2 (DERIVED_FROM_AUTHORITY): R-MC mozzarella
- `prosciutto-crudo` ×2 (APPROVED_OWNER): two name-giving toppings. Candidate: prosciutto 2 / mushroom 3 (keeps funghi's mushroom 3, so the recipe reads as funghi + prosciutto); alternative 3/2 -- Owner A1: recommended candidate adopted
- `mushroom` ×3 (APPROVED_OWNER): see prosciutto-crudo -- Owner A1: recommended candidate adopted
- description 内の登場順 (参照のみ、候補の導出には不使用): prosciutto-crudo, mushroom

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `mushroom` | 推奨 | vegetable。W2-A A1: 'two name-giving toppings' で、'keeps funghi's mushroom 3, so the recipe reads as funghi + prosciutto'。承認済み minCount は mushroom 3 (最大)。W1 funghi の key は mushroom。 |
| `prosciutto-crudo` | alternative | meat。名前の先頭 (prosciutto e funghi)。W2-A A1 で minCount 2。jamon-serrano の key 候補と同じ ingredient。 |

**G. garnish / aromatic risk:** どちらも aroma / garnish ではない。C1-P はどちらも排除しない。

**H. sauce / cheese overlap risk:** なし。sauce = tomato-sauce、cheese = mozzarella。

**I. 推奨 key candidate:** `mushroom` (確度: low (genuine co-equal; Owner choice))。**candidate であり authority ではない。**
- 弱い推奨。承認済み authoring は「funghi + prosciutto」と読める形で mushroom 3 を保持している (evidence only)。一方、名前順では prosciutto-crudo が先で、W1 の funghi (key mushroom) との区別も prosciutto-crudo の方が付く。名前順と数量の両基準が食い違うので、これは Owner 判断。
- 補足: key の被り: mushroom は W1 funghi の key と同じ、prosciutto-crudo は jamon-serrano の key 候補と同じ。sauce / cheese rung が先に出るので recipe は区別されるが、どちらを選んでも 1 つの sibling と key が重なる。

**J. 残り sub toppings (推奨 key の場合):** `prosciutto-crudo`

**K. sub order candidate (推奨 key の場合)**
- 強制: [prosciutto-crudo] (topping が 2 つだけなので key が決まれば sub は 1 つ)。
- alternative key `prosciutto-crudo` の場合: 強制 [mushroom]

**L. sub order を決める根拠**
- key が決まれば sub は 1 つで、順序の根拠は不要。ただし key が Owner 判断なので、sub もそれに従属する。

**M. Owner Decision:** key = **必要** (co-equal から選択)。sub 順 = **不要 (key に従属)**。

### 3.6 `pesto-gamberi` — ペストガンベリピザ (CLEAR_MAIN)

**A. recipe**
- evidence id: `pesto-gamberi-pizzadb-p11`。sauce: pesto。cheese: なし。W1 analog: pesto-tonno。
- description (A3 承認済み): 「ジェノベーゼソースにエビ、トマト、にんにくを合わせた、香りの立つ魚介のペストピザ。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `fresh-tomato` | 2 | vegetable | あり | ✔ |
| `garlic` | 2 | herb | あり | ✔ |
| `shrimp` | 3 | seafood | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `pesto` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `shrimp` ×3 (DERIVED_FROM_AUTHORITY): R-MC primary (gamberi)
- `fresh-tomato` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- `garlic` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- description 内の登場順 (参照のみ、候補の導出には不使用): shrimp, fresh-tomato, garlic

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `shrimp` | 推奨 | C1-P main (gamberi = shrimp)。W2-A A1 の primary。W1 の pesto-tonno (pesto base, seafood primary, tuna key) が analog。 |
| `fresh-tomato` | alternative | supporting vegetable。W1 の pesto-caprese は fresh-tomato key だが、あちらは名前の主役 (caprese)。 |
| `garlic` | alternative | aroma。C1-P は aroma を優先しない。family は HCG watch。 |

**G. garnish / aromatic risk:** garlic は aroma (herb)。key にすると C1-P に反する。fresh-tomato は supporting。shrimp は main。

**H. sauce / cheese overlap risk:** なし。sauce = pesto、cheese = なし。key は topping。

**I. 推奨 key candidate:** `shrimp` (確度: high (confirm))。**candidate であり authority ではない。**

**J. 残り sub toppings (推奨 key の場合):** `fresh-tomato`, `garlic`

**K. sub order candidate (推奨 key の場合)**
- 全 2 通り: [fresh-tomato, garlic] / [garlic, fresh-tomato]
- family label 列 (sub① → …) の種類: 2 種: herb > vegetable; vegetable > herb
- **推奨順序なし** (根拠となる authority がない)。
- alternative key `fresh-tomato` の場合: 2 通り (family label 列 2 種)。全組合せは JSON。
- alternative key `garlic` の場合: 2 通り (family label 列 2 種)。全組合せは JSON。

**L. sub order を決める根拠**
- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。
- 事実: 順序によって sub① で見える family label が変わる。

**M. Owner Decision:** key = **必要** (唯一の主役の確認)。sub 順 = **必要**。

### 3.7 `pesto-vegetariana` — ペストベジタリアーナピザ (CO_EQUAL)

**A. recipe**
- evidence id: `pesto-vegetariana-pizzadb-p12`。sauce: pesto。cheese: mozzarella。W1 analog: pesto-caprese / pesto-patate。
- description (A3 承認済み): 「ジェノベーゼソースにズッキーニ、パプリカ、ナス、モッツァレラを合わせた、野菜が主役のペストピザ。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `bell-pepper` | 2 | vegetable | **なし (W2-A1 branch のみ)** | ✔ |
| `eggplant` | 2 | vegetable | あり | ✔ |
| `zucchini` | 2 | vegetable | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `pesto` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `mozzarella` ×2 (DERIVED_FROM_AUTHORITY): R-MC mozzarella
- `zucchini` ×2 (APPROVED_OWNER): three co-equal vegetables. Candidate 2/2/2 (8 pieces) -- Owner A1: recommended candidate adopted
- `bell-pepper` ×2 (APPROVED_OWNER): see zucchini -- Owner A1: recommended candidate adopted
- `eggplant` ×2 (APPROVED_OWNER): see zucchini -- Owner A1: recommended candidate adopted
- description 内の登場順 (参照のみ、候補の導出には不使用): zucchini, bell-pepper, eggplant

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `eggplant` | 推奨 | vegetable。3 つの co-equal vegetable の 1 つ。W1 の melanzane-pizza / parmigiana-pizza の key が eggplant。3 つの中で main の catalog に既にある ingredient (zucchini / bell-pepper は W2-A1 branch のみ)。 |
| `zucchini` | alternative | vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。 |
| `bell-pepper` | alternative | vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。 |

**G. garnish / aromatic risk:** 3 つとも vegetable family で aroma / garnish ではない。C1-P はどれも排除しない。

**H. sauce / cheese overlap risk:** なし。sauce = pesto、cheese = mozzarella。

**I. 推奨 key candidate:** `eggplant` (確度: low (genuine co-equal; Owner choice))。**candidate であり authority ではない。**
- 弱い推奨。3 つは W2-A A1 と description (「野菜が主役」) の両方で co-equal。eggplant は W1 で key になった前例があり、main に既にある ingredient、という 2 点だけが差。一般則ではない。
- 補足: ratatouille-pizza と vegetable 3 種が同じ。両者は sauce rung (pesto / tomato-sauce) で区別されるので、key が同じでも recipe は曖昧にならない。key を分けるかどうかも Owner 判断。

**J. 残り sub toppings (推奨 key の場合):** `bell-pepper`, `zucchini`

**K. sub order candidate (推奨 key の場合)**
- 全 2 通り: [bell-pepper, zucchini] / [zucchini, bell-pepper]
- family label 列 (sub① → …) の種類: 1 種: vegetable > vegetable
- **推奨順序なし** (根拠となる authority がない)。
- alternative key `bell-pepper` の場合: 2 通り (family label 列 1 種)。全組合せは JSON。
- alternative key `zucchini` の場合: 2 通り (family label 列 1 種)。全組合せは JSON。

**L. sub order を決める根拠**
- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。
- 事実: sub の family がすべて同じなので、どの順序でも player に見える family label の列は同じ (保存される `cls:<ingredientId>` の id だけが変わる)。

**M. Owner Decision:** key = **必要** (co-equal から選択)。sub 順 = **必要**。

### 3.8 `pesto-pollo` — ペストポッロピザ (CLEAR_MAIN)

**A. recipe**
- evidence id: `pesto-pollo-pizzadb-p12`。sauce: pesto。cheese: mozzarella。W1 analog: pesto-caprese。
- description (A3 承認済み): 「ジェノベーゼソースにチキン、トマト、モッツァレラを合わせた、食べごたえのあるペストピザ。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `chicken` | 3 | meat | **なし (W2-A1 branch のみ)** | ✔ |
| `fresh-tomato` | 2 | vegetable | あり | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `pesto` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `mozzarella` ×2 (DERIVED_FROM_AUTHORITY): R-MC mozzarella
- `chicken` ×3 (DERIVED_FROM_AUTHORITY): R-MC primary (pollo)
- `fresh-tomato` ×2 (DERIVED_FROM_AUTHORITY): R-MC supporting
- description 内の登場順 (参照のみ、候補の導出には不使用): chicken, fresh-tomato

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `chicken` | 推奨 | C1-P main (pollo = chicken)。W2-A A1 の primary。 |
| `fresh-tomato` | alternative | supporting vegetable。W1 の pesto-caprese は fresh-tomato key だが、あちらは名前の主役。 |

**G. garnish / aromatic risk:** fresh-tomato は supporting で main ではない。chicken は protein main。

**H. sauce / cheese overlap risk:** なし。sauce = pesto、cheese = mozzarella。key は topping。

**I. 推奨 key candidate:** `chicken` (確度: high (confirm))。**candidate であり authority ではない。**

**J. 残り sub toppings (推奨 key の場合):** `fresh-tomato`

**K. sub order candidate (推奨 key の場合)**
- 強制: [fresh-tomato] (topping が 2 つだけなので key が決まれば sub は 1 つ)。
- alternative key `fresh-tomato` の場合: 強制 [chicken]

**L. sub order を決める根拠**
- key が決まれば sub は 1 つで、順序の根拠は不要。ただし key が Owner 判断なので、sub もそれに従属する。

**M. Owner Decision:** key = **必要** (唯一の主役の確認)。sub 順 = **不要 (key に従属)**。

### 3.9 `ratatouille-pizza` — ラタトゥイユピザ (CO_EQUAL)

**A. recipe**
- evidence id: `ratatouille-pizza-pizzadb-p13`。sauce: tomato-sauce。cheese: なし。W1 analog: melanzane-pizza。
- description (A3 承認済み): 「トマトソースにナス、ズッキーニ、パプリカ、オレガノを合わせた、プロヴァンス風の野菜たっぷりの一枚。」

**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)

| topping | minCount | family | main に family row | key candidate |
|---|---:|---|---|---|
| `bell-pepper` | 2 | vegetable | **なし (W2-A1 branch のみ)** | ✔ |
| `eggplant` | 2 | vegetable | あり | ✔ |
| `oregano` | 1 | herb | あり | ✔ |
| `zucchini` | 2 | vegetable | **なし (W2-A1 branch のみ)** | ✔ |

**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)
- `tomato-sauce` ×1 (DERIVED_FROM_AUTHORITY): R-MC sauce
- `eggplant` ×2 (APPROVED_OWNER): three co-equal vegetables, no name-giving primary. Candidate 2/2/2; alternative one of them 3 -- Owner A1: recommended candidate adopted
- `zucchini` ×2 (APPROVED_OWNER): see eggplant -- Owner A1: recommended candidate adopted
- `bell-pepper` ×2 (APPROVED_OWNER): see eggplant -- Owner A1: recommended candidate adopted
- `oregano` ×1 (DERIVED_FROM_AUTHORITY): R-MC oregano accent
- description 内の登場順 (参照のみ、候補の導出には不使用): eggplant, zucchini, bell-pepper, oregano

**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**

| candidate | 位置づけ | 理由 |
|---|---|---|
| `eggplant` | 推奨 | vegetable。3 つの co-equal vegetable の 1 つ。W1 の melanzane-pizza / parmigiana-pizza の key が eggplant。main の catalog に既にある。 |
| `zucchini` | alternative | vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。 |
| `bell-pepper` | alternative | vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。 |
| `oregano` | alternative | accent の aroma (minCount 1)。W2-A A1: 'R-MC oregano accent'。C1-P は aroma を優先しないので不採用寄り。 |

**G. garnish / aromatic risk:** oregano は accent の aroma (herb)。key にすると C1-P に反する。3 つの vegetable は main 側。

**H. sauce / cheese overlap risk:** なし。sauce = tomato-sauce、cheese = なし。

**I. 推奨 key candidate:** `eggplant` (確度: low (genuine co-equal; Owner choice))。**candidate であり authority ではない。**
- 弱い推奨。pesto-vegetariana と同じ理由 (W1 で key になった前例、main に既にある ingredient)。W2-A A1: 'three co-equal vegetables, no name-giving primary'。一般則ではない。
- 補足: key を選ぶと sub は残り 2 vegetable + oregano の 3 つで、順序の組合せは 6 通り。

**J. 残り sub toppings (推奨 key の場合):** `bell-pepper`, `oregano`, `zucchini`

**K. sub order candidate (推奨 key の場合)**
- 全 6 通り: [bell-pepper, oregano, zucchini] / [bell-pepper, zucchini, oregano] / [oregano, bell-pepper, zucchini] / [oregano, zucchini, bell-pepper] / [zucchini, bell-pepper, oregano] / [zucchini, oregano, bell-pepper]
- family label 列 (sub① → …) の種類: 3 種: herb > vegetable > vegetable; vegetable > herb > vegetable; vegetable > vegetable > herb
- **推奨順序なし** (根拠となる authority がない)。
- alternative key `bell-pepper` の場合: 6 通り (family label 列 3 種)。全組合せは JSON。
- alternative key `oregano` の場合: 6 通り (family label 列 1 種)。全組合せは JSON。
- alternative key `zucchini` の場合: 6 通り (family label 列 3 種)。全組合せは JSON。

**L. sub order を決める根拠**
- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。
- 事実: 順序によって sub① で見える family label が変わる。

**M. Owner Decision:** key = **必要** (co-equal から選択)。sub 順 = **必要**。

## 4. co-equal 4 recipe の Owner Decision

W2-A A1 が複数の主役を記録している recipe。どれを key にするか、残りをどの順にするかを Owner が決める。

### `flammkuchen`
- W2-A evidence: `bacon`: two co-defining toppings (bacon + onion); R-MC has one primary. Candidate bacon 3 / onion 2; alternatives 2/3 or 3/3 -- Owner A1: recommended candidate adopted; `onion`: see bacon -- Owner A1: recommended candidate adopted
- 選択肢:
  - key `bacon` ← 推奨 (弱い) → sub: 1 通り [onion]
  - key `onion` → sub: 1 通り [bacon]
- 推奨の理由と限界: 弱い推奨。bacon は承認済み minCount が最大 (evidence only)、protein で W1 breakfast-pizza と同型。ただし onion も co-defining と明記されているので、これは Owner 判断。

### `prosciutto-funghi`
- W2-A evidence: `prosciutto-crudo`: two name-giving toppings. Candidate: prosciutto 2 / mushroom 3 (keeps funghi's mushroom 3, so the recipe reads as funghi + prosciutto); alternative 3/2 -- Owner A1: recommended candidate adopted; `mushroom`: see prosciutto-crudo -- Owner A1: recommended candidate adopted
- 選択肢:
  - key `mushroom` ← 推奨 (弱い) → sub: 1 通り [prosciutto-crudo]
  - key `prosciutto-crudo` → sub: 1 通り [mushroom]
- 推奨の理由と限界: 弱い推奨。承認済み authoring は「funghi + prosciutto」と読める形で mushroom 3 を保持している (evidence only)。一方、名前順では prosciutto-crudo が先で、W1 の funghi (key mushroom) との区別も prosciutto-crudo の方が付く。名前順と数量の両基準が食い違うので、これは Owner 判断。
- 補足: key の被り: mushroom は W1 funghi の key と同じ、prosciutto-crudo は jamon-serrano の key 候補と同じ。sauce / cheese rung が先に出るので recipe は区別されるが、どちらを選んでも 1 つの sibling と key が重なる。

### `pesto-vegetariana`
- W2-A evidence: `zucchini`: three co-equal vegetables. Candidate 2/2/2 (8 pieces) -- Owner A1: recommended candidate adopted; `bell-pepper`: see zucchini -- Owner A1: recommended candidate adopted; `eggplant`: see zucchini -- Owner A1: recommended candidate adopted
- 選択肢:
  - key `bell-pepper` → sub: 2 通り [eggplant, zucchini] / [zucchini, eggplant]
  - key `eggplant` ← 推奨 (弱い) → sub: 2 通り [bell-pepper, zucchini] / [zucchini, bell-pepper]
  - key `zucchini` → sub: 2 通り [bell-pepper, eggplant] / [eggplant, bell-pepper]
- 推奨の理由と限界: 弱い推奨。3 つは W2-A A1 と description (「野菜が主役」) の両方で co-equal。eggplant は W1 で key になった前例があり、main に既にある ingredient、という 2 点だけが差。一般則ではない。
- 補足: ratatouille-pizza と vegetable 3 種が同じ。両者は sauce rung (pesto / tomato-sauce) で区別されるので、key が同じでも recipe は曖昧にならない。key を分けるかどうかも Owner 判断。

### `ratatouille-pizza`
- W2-A evidence: `eggplant`: three co-equal vegetables, no name-giving primary. Candidate 2/2/2; alternative one of them 3 -- Owner A1: recommended candidate adopted; `zucchini`: see eggplant -- Owner A1: recommended candidate adopted; `bell-pepper`: see eggplant -- Owner A1: recommended candidate adopted; `oregano`: R-MC oregano accent
- 選択肢:
  - key `bell-pepper` → sub: 6 通り [eggplant, oregano, zucchini] / [eggplant, zucchini, oregano] / [oregano, eggplant, zucchini] / [oregano, zucchini, eggplant] / [zucchini, eggplant, oregano] / [zucchini, oregano, eggplant]
  - key `eggplant` ← 推奨 (弱い) → sub: 6 通り [bell-pepper, oregano, zucchini] / [bell-pepper, zucchini, oregano] / [oregano, bell-pepper, zucchini] / [oregano, zucchini, bell-pepper] / [zucchini, bell-pepper, oregano] / [zucchini, oregano, bell-pepper]
  - key `oregano` → sub: 6 通り [bell-pepper, eggplant, zucchini] / [bell-pepper, zucchini, eggplant] / [eggplant, bell-pepper, zucchini] / [eggplant, zucchini, bell-pepper] / [zucchini, bell-pepper, eggplant] / [zucchini, eggplant, bell-pepper]
  - key `zucchini` → sub: 6 通り [bell-pepper, eggplant, oregano] / [bell-pepper, oregano, eggplant] / [eggplant, bell-pepper, oregano] / [eggplant, oregano, bell-pepper] / [oregano, bell-pepper, eggplant] / [oregano, eggplant, bell-pepper]
- 推奨の理由と限界: 弱い推奨。pesto-vegetariana と同じ理由 (W1 で key になった前例、main に既にある ingredient)。W2-A A1: 'three co-equal vegetables, no name-giving primary'。一般則ではない。
- 補足: key を選ぶと sub は残り 2 vegetable + oregano の 3 つで、順序の組合せは 6 通り。

## 5. sub order Owner Decision

| Recipe | 推奨 key の場合の sub | 通り数 | family label 列の種類 | 根拠 |
|---|---|---:|---:|---|
| `vongole` | garlic, parsley | 2 | 1 | なし (Owner Decision) |
| `brazilian-calabresa` | black-olive, onion, oregano | 6 | 3 | なし (Owner Decision) |
| `pesto-gamberi` | fresh-tomato, garlic | 2 | 2 | なし (Owner Decision) |
| `pesto-vegetariana` | bell-pepper, zucchini | 2 | 1 | なし (Owner Decision) |
| `ratatouille-pizza` | bell-pepper, oregano, zucchini | 6 | 3 | なし (Owner Decision) |

合計 **5 件**。ここに載らない 4 recipe は、どの key を選んでも sub が 1 つで順序は強制される。

メタな問い (Owner が答えると 5 件が一括で決まりうる): sub 順の **根拠** を Owner がどう決めるか。例えば「承認済み description の登場順を使う」「個別に指定する」など。この review は根拠を提案も採用もしない。description の登場順は各 recipe の節に参照値として載せただけで、どの候補の導出にも使っていない。

## 6. P4-CHEESE との compatibility (確認のみ)

H5-4 のコード・authority は変更しない。OD-H5-P4-CHEESE は **未決**。

| Recipe | cheese | P4-CHEESE | roles への影響 | ladder 合計 (P4-CHEESE 採用時, 参考) |
|---|---|---|---|---:|
| `vongole` | なし | **対象** | なし | 45 |
| `flammkuchen` | なし | **対象** | なし | 40 |
| `jamon-serrano-pizza` | mozzarella | 対象外 | なし | 40 |
| `brazilian-calabresa` | なし | **対象** | なし | 50 |
| `prosciutto-funghi` | mozzarella | 対象外 | なし | 40 |
| `pesto-gamberi` | なし | **対象** | なし | 45 |
| `pesto-vegetariana` | mozzarella | 対象外 | なし | 45 |
| `pesto-pollo` | mozzarella | 対象外 | なし | 40 |
| `ratatouille-pizza` | なし | **対象** | なし | 50 |

- P4-CHEESE 対象 5 recipe: vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille-pizza。
- key / sub は topping だけを参照するので、P4-CHEESE の採否で **変わらない**。採用されれば CHEESE rung は 10 Pitz の「チーズ：なし」になり、採用されなければ `RESERVED_EMPTY_RUNG` のままで、この 5 recipe は Hint 5.0 の target にできない (roles 自体は type gate のためどちらにせよ必要)。
- P4b (「キートッピング：なし」) は対象 0: 9 recipe すべてが 2 つ以上の topping を持つ。
- ladder 合計は sauce 10 + cheese 10 + key 10 + structure 5 + sub 5 × n (H5-4 §3 の式)。価格は rung 種別のみで決まるので、key の選択で変わらない。
- no-sauce / TQ-1D には触れていない: 9 recipe はすべて sauce が 1 つ (`vongole` は olive-oil base) で、Technique を要しない。

## 7. Taxonomy

- **OD-W2-5 (APPROVED, scoped)** の 7 family row を authority として参照した: prosciutto-crudo・chicken → meat、arugula・bell-pepper・zucchini → vegetable、shrimp → seafood、parsley → herb。
- **main には未反映。** これらは W2-A1 branch (`2bc40e4`, PR なし) にだけあり、`origin/main` の `ingredientTaxonomy.ts` には無い (generator が確認)。9 recipe のうち 7 recipe が少なくとも 1 つ使う (使わないのは flammkuchen と brazilian-calabresa): arugula, bell-pepper, chicken, parsley, prosciutto-crudo, shrimp, zucchini。
- 影響: 推奨 key の `prosciutto-crudo` / `chicken` / `shrimp` は W2-A1 が main に入るまで G17 で検証できない。
- **watch (再決定しない):** `garlic` (herb; vongole, pesto-gamberi) と `black-olive` (vegetable; brazilian-calabresa) は production row だが HCG queue で boundary が review 中。どちらも **key candidate ではなく sub のみ**。family が動いても role の割当は変わらず、変わるのは sub の family label だけ (`cls:<ingredientId>` は id 保存で family 移動に耐える、PR #293 F-8)。

## 8. DA-1 Start Gate への影響 (9 件を Owner が authority 化した場合)

DA-1 Preparation Audit §11 の Start Gate を、この 9 件だけ authority 化した仮定で読み替えた。**実際には何も変わっていない。**

| Gate | 現状 | 9 件を authority 化した場合 |
|---|---|---|
| SG-1 fresh check | PASS | 変わらず。main `86b48fd` を再確認すること。 |
| SG-2 scope | OPEN | 変わらず (8 non-W2-A は Authoring Gate なし)。W2-A 9 件だけなら scope を決めやすくなる。 |
| **SG-3 Hint 5.0 roles** | OPEN (0 / 17) | **W2-A 9 件は authority 完了**。17 行では 9 / 17。8 non-W2-A 行は OPEN のまま。 |
| SG-4 P4-CHEESE | OPEN | 変わらず。5 recipe が待つ。 |
| SG-5 / SG-6 family row と W2-A1 の main 反映 | OPEN | 変わらず (implementation state)。 |
| SG-7 / SG-8 / SG-9 | 変わらず | 変わらず。 |

- 9 行の lane: H は解消。**4 行は B0 になる** (jamon-serrano, prosciutto-funghi, pesto-vegetariana, pesto-pollo: cheese がある)。**5 行は B1 のまま** (vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille: lane N = P4-CHEESE 待ち)。
- 「Hint 5.0 と DA-1 の後に merge される方が role を運ぶ」という sequencing (Record<RecipeId> の type gate) は変わらない。承認された role は、その PR が `recipeHintRoles.ts` に書く。この review は書かない。

## 9. Owner に決めてほしいこと (queued, 未決)

| ID (working label) | 内容 | 件数 |
|---|---|---:|
| RK-CONFIRM | 唯一の主役 key の確認: vongole, jamon-serrano-pizza, brazilian-calabresa, pesto-gamberi, pesto-pollo | 5 |
| RK-CHOOSE | co-equal の key の選択: flammkuchen, prosciutto-funghi, pesto-vegetariana, ratatouille-pizza | 4 |
| RS-ORDER | sub 順: vongole, brazilian-calabresa, pesto-gamberi, pesto-vegetariana, ratatouille-pizza | 5 |
| RS-BASIS | (任意) sub 順の根拠を Owner がどう決めるか。この review は提案しない | 1 |

## 10. 非目標 / 変更していないもの

- `recipeHintRoles.ts`、`src`、e2e、recipe / ingredient production、taxonomy、Hint 5.0 実装、H5-4、TQ、Cooking Steps、progression、Wave 2 実装は無変更。DA-1 は未実装。merge / PR なし。
- 汎用の 172 向け tie-break rule は作っていない。H5-0 §6.4 の tie-break も authority として使っていない。
- no-sauce / TQ-1D authority、taxonomy の再決定はしていない。
- UI / gameplay 変更ではないので Human Verification video は不要 (docs / data / tools のみ)。

**STOP。Owner Review 待ち。key / sub は authority として確定していない。**
