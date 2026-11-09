# 重複レシピ 26 品・例外判断 22 品の全量収録の扱い（#780、docs-only・提案）

2026-11-08 / 基準 `origin/main` = `348b1e4`。**1 品も除外しない。** 48 品すべてが台帳に残り、バッチ（RB-xx）を持つ。本書の「扱い」は Owner への提案で、どれも適用していない。既存の Owner 規則（R-2 部分集合・上位集合は原則不採用、R-3 同一集合は生地軸のみ、R-4 Jaccard>0.4 は個別例外、D-1 一括除外の禁止）は変更せず、その**内側で全量に到達する道筋**を整理した。再現: `python3 -I docs/reports/data/TETO_DUP-FULL-INCLUSION_gen.py.txt <repo> <out>`（結果は `TETO_DUP-FULL-INCLUSION_table.csv`／`_summary.json`）。

## 1. 件数【実測】

| 区分 | 件数 | 扱い | 意味 |
|---|---|---|---|
| 出荷済みと同一／部分集合／上位集合（26） | 20 | **X1 工程差で識別軸を分離** | 証跡のある工程差（生地・天板・包む・工程順・ゾーン・後乗せ）があり、その工程が出荷されれば識別が分かれる |
| | 6 | **X3 工程差なし** | sfincione・pizza-baiana・keema-pizza・pizza-chilena・philly-cheesesteak-pizza・hokkaido-cheese-pizza。Owner が 3 択（下）から選ぶ |
| 1 材料差または Jaccard>0.4（22） | 22 | **X2 品ごとの例外承認** | R-4 のとおり個別例外。D-1 資料（出荷済みとの重なり・工程差）を使って回答できる |

## 2. 扱いの定義（提案）

- **X1 工程差で分離（20 品）。** 追加の判断は少ない: ①その工程トラック（M1〜M6）の出荷、②同一集合（IDENTICAL）の場合は R-3「生地が見て分かる別技法のときだけ」の承認。**待つ対象は工程であって、レシピの除外ではない。** 該当: cauliflower・fathead・chicago-stuffed・new-england-bar・al-taglio-romana（同一）、ny-style・st-louis・quad-cities・colorado・old-forge・trenton・pizza-a-caballo・chicago-deep-dish・pizza-de-cancha・argentine-napolitana・focaccia・pizza-romana・montreal・quattro-stagioni・hot-honey-pepperoni（後乗せ）。
- **X2 品ごとの例外（22 品）。** 部分集合・上位集合は含まない。Owner は D-1 の資料を見て ID ごとに「許可／原典に沿った区別要素の追加を指示」を返す。
- **X3 工程差なし（6 品）。** 工程差が無いので、次の **3 択から Owner が 1 つ選ぶ**（品ごとでも一括でもよい）:
  - **a) VARIANT（収録の定義）:** 出荷済みレシピの名前付きバリエーション（別名・PIZZA DB 版）として図鑑に収録する。新しい識別は作らず、「収録済み」と数える。**「収録」の定義を Owner が確定する必要がある**（実装は図鑑の別名表示で、識別ロジックは変えない。設計が要る【未確認】）。
  - **b) DISTINGUISH（材料の区別）:** 原典で証跡のある任意の付け合わせを足して集合を変える。マトリクス行との構成差が出るので Owner 承認が要る（D-4「PIZZA DB 版を暫定基準」に近い扱い）。
  - **c) NEW-AXIS（新しい識別軸）:** 量の帯や順序など、新しい識別次元を設計する。最も重い。a・b で足りない場合のみ。

| X3 の品 | 重なる出荷済み（種別） | 推奨の入口 |
|---|---|---|
| sfincione | fugazza（上位集合） | b：原典のパン粉等の区別要素の有無を D-2 の原典調査で確認 |
| pizza-baiana | bismarck・salsiccia（上位集合） | b：同上 |
| keema-pizza | aussie・bacalhau（部分集合） | b：カレー系の区別要素を原典で確認 |
| pizza-chilena | bismarck（上位集合）・pizza-portuguesa（部分集合） | a か b |
| philly-cheesesteak-pizza | nigerian-suya-pizza（部分集合） | b |
| hokkaido-cheese-pizza | potato-mayo-pizza（部分集合） | b |

（推奨は助言であって決定ではない。原典 pizzadb.jp は全行未確認のため、区別要素の有無は原典調査（D-2）の結果で変わる。）

## 3. 全量収録までの順序（除外なし）

1. **今すぐ判断できるもの:** X2 の 22 品（D-1 の資料が準備済み）。RB-06・RB-07 ほか。
2. **工程の出荷を待つもの:** X1 の 20 品（M1〜M6 の各トラック。RB-10〜RB-17）。待っている間も台帳・バッチ・Research 影響の測定対象として維持する。
3. **Owner の 3 択が要るもの:** X3 の 6 品（RB-04〜RB-09 の各バッチに散在）。
4. D-6（Research 文字変更の承認）は上と独立に、重複区分に関係なく ID ごとに必要（昇格停止 26 品）。

## 4. 全件表

| 区分 | 扱い | レシピ | 重なる出荷済み（種別・Jaccard） | 工程差 | D-1 根拠 | バッチ | Owner が決めること |
|---|---|---|---|---|---|---|---|
| FORBIDDEN | X1 | `argentine-napolitana` | chilean-napolitana:SUPERSET(0.6) | DOUGH_VARIANT | (not in D-1 dossier) | RB-10 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `cauliflower-crust-pizza` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:IDENTICAL(1); melanzane-pizza:SUBSET(0.75); parmigiana-pizza:SUBSET(0.6); pepperoni:ONE_DIFF(0.5); salsiccia:ONE_DIFF(0.5) | DOUGH_VARIANT | (not in D-1 dossier) | RB-10 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `chicago-deep-dish-pizzadb` | meat-lovers:SUBSET(0.667); pepperoni:SUPERSET(0.75); salsiccia:SUPERSET(0.75) | PAN_PROFILE+STEP_ORDER | PROCESS_DIFFERENCE_AVAILABLE | RB-17 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `chicago-stuffed-pizza` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:ONE_DIFF(0.5); meat-lovers:SUBSET(0.5); pepperoni:ONE_DIFF(0.5); salsiccia:IDENTICAL(1); salsiccia-e-friarielli:ONE_DIFF(0.5) | DOUGH_VARIANT+ENCLOSE | PROCESS_DIFFERENCE_AVAILABLE | RB-14 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `colorado-mountain-pie` | bambino:SUBSET(0.5); bismarck:SUBSET(0.667); breakfast-pizza:SUBSET(0.5); calabresa-argentina:SUBSET(0.4); capricciosa:SUBSET(0.333); funghi:SUBSET(0.667); grandma-pizza:SUBSET(0.5); hawaiian:SUBSET(0.5); jamon-serrano-pizza:SUBSET(0.5); margherita:SUBSET(0.667); meat-lovers:SUBSET(0.333); melanzane-pizza:SUBSET(0.5); napoletana:SUBSET(0.5); parmigiana-pizza:SUBSET(0.4); pepperoni:SUBSET(0.667); pescatore:SUBSET(0.286); pinsa-romana:SUBSET(0.5); pizza-alla-crudaiola:SUBSET(0.333); pizza-overload:SUBSET(0.333); pizza-portuguesa:SUBSET(0.333); prosciutto-funghi:SUBSET(0.5); salsiccia:SUBSET(0.667); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286) | DOUGH_VARIANT | (not in D-1 dossier) | RB-10 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `fathead-pizza-keto` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:ONE_DIFF(0.5); meat-lovers:SUBSET(0.5); pepperoni:IDENTICAL(1); salsiccia:ONE_DIFF(0.5) | DOUGH_VARIANT | (not in D-1 dossier) | RB-10 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `focaccia-genovese` | pizza-bianca:SUPERSET(0.667) | DOUGH_VARIANT | (not in D-1 dossier) | RB-10 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `hot-honey-pepperoni` | meat-lovers:JACCARD_GT_0_4(0.429); pepperoni:SUPERSET(0.75) | late:post_bake | PROCESS_DIFFERENCE_AVAILABLE | RB-06 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `montreal-style-pizza` | capricciosa:JACCARD_GT_0_4(0.429); funghi:SUPERSET(0.75); meat-lovers:JACCARD_GT_0_4(0.429); pepperoni:SUPERSET(0.75); prosciutto-funghi:ONE_DIFF(0.6) | DOUGH_VARIANT+PAN_PROFILE | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `new-england-bar-pizza` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:ONE_DIFF(0.5); meat-lovers:SUBSET(0.5); pepperoni:IDENTICAL(1); salsiccia:ONE_DIFF(0.5) | DOUGH_VARIANT+PAN_PROFILE | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `ny-style` | bambino:SUBSET(0.5); bismarck:SUBSET(0.667); breakfast-pizza:SUBSET(0.5); calabresa-argentina:SUBSET(0.4); capricciosa:SUBSET(0.333); funghi:SUBSET(0.667); grandma-pizza:SUBSET(0.5); hawaiian:SUBSET(0.5); jamon-serrano-pizza:SUBSET(0.5); margherita:SUBSET(0.667); meat-lovers:SUBSET(0.333); melanzane-pizza:SUBSET(0.5); napoletana:SUBSET(0.5); parmigiana-pizza:SUBSET(0.4); pepperoni:SUBSET(0.667); pescatore:SUBSET(0.286); pinsa-romana:SUBSET(0.5); pizza-alla-crudaiola:SUBSET(0.333); pizza-overload:SUBSET(0.333); pizza-portuguesa:SUBSET(0.333); prosciutto-funghi:SUBSET(0.5); salsiccia:SUBSET(0.667); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286) | DOUGH_VARIANT | (not in D-1 dossier) | RB-11 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `old-forge-style-pizza` | brazilian-calabresa:SUBSET(0.4); pizza-portuguesa:SUBSET(0.333); supreme-pizza:SUBSET(0.286); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286) | DOUGH_SHAPE_TARGET+DOUGH_VARIANT | (not in D-1 dossier) | RB-15 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `pizza-a-caballo` | calabresa-argentina:SUBSET(0.6); capricciosa:SUBSET(0.5); chilean-napolitana:ONE_DIFF(0.5); palmito-pizza:ONE_DIFF(0.5) | DOUGH_VARIANT+ENCLOSE | PROCESS_DIFFERENCE_AVAILABLE | RB-14 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `pizza-al-taglio-romana` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:IDENTICAL(1); melanzane-pizza:SUBSET(0.75); parmigiana-pizza:SUBSET(0.6); pepperoni:ONE_DIFF(0.5); salsiccia:ONE_DIFF(0.5) | DOUGH_SHAPE_TARGET+DOUGH_VARIANT | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `pizza-de-cancha` | grandma-pizza:ONE_DIFF(0.6); marinara:SUPERSET(0.75) | DOUGH_VARIANT | PROCESS_DIFFERENCE_AVAILABLE | RB-12 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `pizza-romana` | calabresa-argentina:JACCARD_GT_0_4(0.429); napoletana:SUPERSET(0.8); puttanesca-pizza:JACCARD_GT_0_4(0.429) | DOUGH_VARIANT | PROCESS_DIFFERENCE_AVAILABLE | RB-12 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `quad-cities-style-pizza` | bambino:SUBSET(0.5); bismarck:SUBSET(0.667); breakfast-pizza:SUBSET(0.5); calabresa-argentina:SUBSET(0.4); capricciosa:SUBSET(0.333); funghi:SUBSET(0.667); grandma-pizza:SUBSET(0.5); hawaiian:SUBSET(0.5); jamon-serrano-pizza:SUBSET(0.5); margherita:SUBSET(0.667); meat-lovers:SUBSET(0.333); melanzane-pizza:SUBSET(0.5); napoletana:SUBSET(0.5); parmigiana-pizza:SUBSET(0.4); pepperoni:SUBSET(0.667); pescatore:SUBSET(0.286); pinsa-romana:SUBSET(0.5); pizza-alla-crudaiola:SUBSET(0.333); pizza-overload:SUBSET(0.333); pizza-portuguesa:SUBSET(0.333); prosciutto-funghi:SUBSET(0.5); salsiccia:SUBSET(0.667); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286) | DOUGH_VARIANT | (not in D-1 dossier) | RB-12 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `quattro-stagioni` | bambino:JACCARD_GT_0_4(0.429); capricciosa:ONE_DIFF(0.714); funghi:SUPERSET(0.5); hawaiian:JACCARD_GT_0_4(0.429); pizza-portuguesa:JACCARD_GT_0_4(0.5); prosciutto-funghi:JACCARD_GT_0_4(0.429); veggie-supreme-pizza:JACCARD_GT_0_4(0.444) | ZONED | PROCESS_DIFFERENCE_AVAILABLE | RB-17 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `st-louis-style-pizza` | meat-lovers:SUBSET(0.333); pepperoni:SUBSET(0.667); supreme-pizza:SUBSET(0.286) | DOUGH_VARIANT | (not in D-1 dossier) | RB-12 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| FORBIDDEN | X1 | `trenton-tomato-pie` | bambino:SUBSET(0.5); bismarck:SUBSET(0.667); breakfast-pizza:SUBSET(0.5); calabresa-argentina:SUBSET(0.4); capricciosa:SUBSET(0.333); funghi:SUBSET(0.667); grandma-pizza:SUBSET(0.5); hawaiian:SUBSET(0.5); jamon-serrano-pizza:SUBSET(0.5); margherita:SUBSET(0.667); meat-lovers:SUBSET(0.333); melanzane-pizza:SUBSET(0.5); napoletana:SUBSET(0.5); parmigiana-pizza:SUBSET(0.4); pepperoni:SUBSET(0.667); pescatore:SUBSET(0.286); pinsa-romana:SUBSET(0.5); pizza-alla-crudaiola:SUBSET(0.333); pizza-overload:SUBSET(0.333); pizza-portuguesa:SUBSET(0.333); prosciutto-funghi:SUBSET(0.5); salsiccia:SUBSET(0.667); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286) | STEP_ORDER | PROCESS_DIFFERENCE_AVAILABLE | RB-17 | R-3 approval of the axis (IDENTICAL cases) + mechanic ships |
| EXCEPTION | X2 | `bulgogi-pizza` | nigerian-suya-pizza:ONE_DIFF(0.6); rendang-pizza:ONE_DIFF(0.6); wasabi-beef-pizza:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-08 | per-ID exception (D-1) |
| EXCEPTION | X2 | `burrata-pizza` | pizza-alla-crudaiola:JACCARD_GT_0_4(0.429) | - | NO_PROCESS_DIFFERENCE | RB-08 | per-ID exception (D-1) |
| EXCEPTION | X2 | `calzone-pizzadb` | calabresa-argentina:JACCARD_GT_0_4(0.5) | ENCLOSE | PROCESS_DIFFERENCE_AVAILABLE | RB-14 | per-ID exception (D-1) |
| EXCEPTION | X2 | `chicken-tikka-pizza` | bbq-chicken-pizza:JACCARD_GT_0_4(0.429); spanish-chorizo-pizza:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-06 | per-ID exception (D-1) |
| EXCEPTION | X2 | `detroit-style-pizza` | pepperoni:ONE_DIFF(0.5) | DOUGH_SHAPE_TARGET+DOUGH_VARIANT+PAN_PROFILE+late:post_bake | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | per-ID exception (D-1) |
| EXCEPTION | X2 | `diavola-pizza` | bismarck:ONE_DIFF(0.5); funghi:ONE_DIFF(0.5); margherita:ONE_DIFF(0.5); pepperoni:ONE_DIFF(0.5); salsiccia:ONE_DIFF(0.5) | - | NO_PROCESS_DIFFERENCE | RB-06 | per-ID exception (D-1) |
| EXCEPTION | X2 | `frutti-di-mare-pizzadb` | pescatore:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-06 | per-ID exception (D-1) |
| EXCEPTION | X2 | `fugazzeta-rellena` | capricciosa:JACCARD_GT_0_4(0.429); pizza-portuguesa:JACCARD_GT_0_4(0.429) | DOUGH_VARIANT+ENCLOSE | PROCESS_DIFFERENCE_AVAILABLE | RB-14 | per-ID exception (D-1) |
| EXCEPTION | X2 | `fugazzetta` | chilean-napolitana:ONE_DIFF(0.5); fugazza:ONE_DIFF(0.5) | DOUGH_VARIANT | PROCESS_DIFFERENCE_AVAILABLE | RB-10 | per-ID exception (D-1) |
| EXCEPTION | X2 | `greek-style-pizzadb` | calabresa-argentina:JACCARD_GT_0_4(0.5); capricciosa:JACCARD_GT_0_4(0.429); pizza-portuguesa:JACCARD_GT_0_4(0.429) | DOUGH_VARIANT+PAN_PROFILE | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | per-ID exception (D-1) |
| EXCEPTION | X2 | `nduja-pizza` | salsiccia:ONE_DIFF(0.5); salsiccia-e-friarielli:ONE_DIFF(0.5) | - | NO_PROCESS_DIFFERENCE | RB-06 | per-ID exception (D-1) |
| EXCEPTION | X2 | `palmitos-salsa-golf` | capricciosa:JACCARD_GT_0_4(0.429) | DOUGH_VARIANT | PROCESS_DIFFERENCE_AVAILABLE | RB-11 | per-ID exception (D-1) |
| EXCEPTION | X2 | `pizza-asparagi-limone` | quattro-formaggi:JACCARD_GT_0_4(0.429) | late:post_bake | NO_PROCESS_DIFFERENCE | RB-07 | per-ID exception (D-1) |
| EXCEPTION | X2 | `pizza-de-lomo-saltado` | nigerian-suya-pizza:JACCARD_GT_0_4(0.5); rendang-pizza:JACCARD_GT_0_4(0.5); wasabi-beef-pizza:JACCARD_GT_0_4(0.429) | MID_BAKE+PREP+late:mid_bake | PROCESS_DIFFERENCE_AVAILABLE | RB-16 | per-ID exception (D-1) |
| EXCEPTION | X2 | `pizza-salad` | bambino:JACCARD_GT_0_4(0.429) | - | NO_PROCESS_DIFFERENCE | RB-07 | per-ID exception (D-1) |
| EXCEPTION | X2 | `pizza-zucchine-menta` | eggplant-ricotta-pizza:JACCARD_GT_0_4(0.429); pizza-bianca-ricotta:JACCARD_GT_0_4(0.429) | late:post_bake | NO_PROCESS_DIFFERENCE | RB-09 | per-ID exception (D-1) |
| EXCEPTION | X2 | `scacciata-ragusana` | salsiccia:ONE_DIFF(0.5) | ENCLOSE | PROCESS_DIFFERENCE_AVAILABLE | RB-14 | per-ID exception (D-1) |
| EXCEPTION | X2 | `siciliana-pizzadb` | napoletana:ONE_DIFF(0.6); pizza-portuguesa:JACCARD_GT_0_4(0.429); tonno-e-cipolla:ONE_DIFF(0.6) | DOUGH_SHAPE_TARGET+DOUGH_VARIANT+PAN_PROFILE | PROCESS_DIFFERENCE_AVAILABLE | RB-15 | per-ID exception (D-1) |
| EXCEPTION | X2 | `south-african-boerewors` | polish-kielbasa:ONE_DIFF(0.6); spanish-chorizo-pizza:ONE_DIFF(0.6) | - | NO_PROCESS_DIFFERENCE | RB-07 | per-ID exception (D-1) |
| EXCEPTION | X2 | `thai-chicken-pizza` | bbq-chicken-pizza:JACCARD_GT_0_4(0.5); reina-pepiada-pizza:JACCARD_GT_0_4(0.429) | - | NO_PROCESS_DIFFERENCE | RB-07 | per-ID exception (D-1) |
| EXCEPTION | X2 | `tsukimi-pizza` | aussie:ONE_DIFF(0.6); breakfast-pizza:ONE_DIFF(0.6); full-english-pizza:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-09 | per-ID exception (D-1) |
| EXCEPTION | X2 | `yakiniku-pizza` | nigerian-suya-pizza:JACCARD_GT_0_4(0.5); rendang-pizza:JACCARD_GT_0_4(0.5); wasabi-beef-pizza:JACCARD_GT_0_4(0.429) | PREP | PROCESS_DIFFERENCE_AVAILABLE | RB-13 | per-ID exception (D-1) |
| FORBIDDEN | X3 | `hokkaido-cheese-pizza` | potato-mayo-pizza:SUBSET(0.6) | - | NO_PROCESS_DIFFERENCE | RB-08 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |
| FORBIDDEN | X3 | `keema-pizza` | aussie:SUBSET(0.5); bacalhau:SUBSET(0.5); baingan-bharta-pizza:SUBSET(0.333); bbq-chicken-pizza:SUBSET(0.4); curry-pizza-japan:SUBSET(0.5); nigerian-suya-pizza:SUBSET(0.5); pizza-moscow:SUBSET(0.4); pizza-portuguesa:SUBSET(0.333); polish-kielbasa:SUBSET(0.5); rendang-pizza:SUBSET(0.5); spanish-chorizo-pizza:SUBSET(0.5); tandoori-paneer-pizza:SUBSET(0.4); tonno-e-cipolla:SUBSET(0.5); veggie-supreme-pizza:SUBSET(0.286); wasabi-beef-pizza:SUBSET(0.4) | - | NO_PROCESS_DIFFERENCE | RB-06 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |
| FORBIDDEN | X3 | `philly-cheesesteak-pizza` | nigerian-suya-pizza:SUBSET(0.75) | - | NO_PROCESS_DIFFERENCE | RB-07 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |
| FORBIDDEN | X3 | `pizza-baiana` | aussie:JACCARD_GT_0_4(0.5); bismarck:SUPERSET(0.6); brazilian-calabresa:JACCARD_GT_0_4(0.429); breakfast-pizza:JACCARD_GT_0_4(0.5); full-english-pizza:JACCARD_GT_0_4(0.429); pizza-portuguesa:JACCARD_GT_0_4(0.571); polish-kielbasa:JACCARD_GT_0_4(0.5); salsiccia:SUPERSET(0.6); spanish-chorizo-pizza:JACCARD_GT_0_4(0.5); tonno-e-cipolla:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-08 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |
| FORBIDDEN | X3 | `pizza-chilena` | aussie:JACCARD_GT_0_4(0.5); bacalhau:JACCARD_GT_0_4(0.5); bismarck:SUPERSET(0.6); brazilian-calabresa:JACCARD_GT_0_4(0.429); breakfast-pizza:JACCARD_GT_0_4(0.5); calabresa-argentina:JACCARD_GT_0_4(0.429); pizza-portuguesa:SUBSET(0.833); tonno-e-cipolla:JACCARD_GT_0_4(0.5); veggie-supreme-pizza:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-09 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |
| FORBIDDEN | X3 | `sfincione` | brazilian-calabresa:JACCARD_GT_0_4(0.429); fugazza:SUPERSET(0.6); napoletana:JACCARD_GT_0_4(0.5) | - | NO_PROCESS_DIFFERENCE | RB-09 | pick ONE of VARIANT / DISTINGUISH / NEW-AXIS (D-DUP-1) |


## 5. Owner 判断（D-DUP-1 の分解）

| ID | 論点 | 推奨 |
|---|---|---|
| D-DUP-1a | X1 の 20 品を「工程の出荷を待って収録」とすること（IDENTICAL の 5 品は R-3 の承認が別途要る） | 承認 |
| D-DUP-1b | X2 の 22 品の ID ごとの回答 | D-1 の資料に沿って回答 |
| D-DUP-1c | X3 の 6 品の 3 択（a／b／c） | b を基本、原典調査で区別要素が無ければ a |
| D-DUP-1d | 「収録」の定義（a を採る場合、バリエーション収録を 177 の分母に数えるか） | 数える（除外ではなく収録なので） |
