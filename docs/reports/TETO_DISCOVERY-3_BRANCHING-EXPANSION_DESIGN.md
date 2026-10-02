# Discovery 3.0 — Branching Expansion Design（DESIGN / AUDIT ONLY）

**種別:** 設計・監査のみ（docs/data only）。production code・recipe・ingredient・ladder・save schema は未変更。PR / Issue 未作成。**No.28 は選ばない。candidate は選ばない・順位付けしない・推奨しない。** `ladderCredit` / `lunchRush` は全 candidate で **UNDECIDED**。R6 / IP-2 へは進まない。

| 項目 | 値 |
|---|---|
| 基準 `origin/main` | `544db65b73e85ae927820b41653cc670afdb1403`（fresh fetch で一致を確認。PR #343 merge 済み） |
| production | 27 recipes / 30 ingredients / 25 ladder steps（step 25 = `chicken` → `pesto-pollo`）。non-credit は `brazilian-calabresa` のみ |
| 機械可読 companion | `docs/reports/data/TETO_DISCOVERY-3_BRANCHING-EXPANSION.json`（35 candidate・26 slot probe・5 combo・hint 互換結果） |
| 再利用した既存成果物（再監査なし） | ① 172 readiness: `TETO_DISCOVERY-3_172-RECIPE_READINESS.json`（`origin/claude/discovery-3-172-recipe-readiness-audit` @ `cceedce`、**main 未取り込み**）② Unlock/Discovery 監査: `TETO_DISCOVERY-3_UNLOCK-DISCOVERY-EXPERIENCE_FRESH_AUDIT.md`（`origin/claude/teto-discovery-3-audit-uzr1za` @ `84e5091`、**main 未取り込み**。指定パス `docs/reports/…` は main には存在しない） |

## 0. 方法と前提

- production authority を **read-only** で実行した（`recipeDiscoveryState` = DISCOVERABLE 述語、`selectHintTarget`、`resolveShopEntitlement`、`countsTowardLadder`、`buildInspectorModel`）。使い捨て Vitest harness は commit していない。
- 追加 recipe の「もしも」は **合成 recipe**（identity set だけが本物の candidate 由来、個数・bakeTarget は無関係）を `recipes` 引数 / population に注入して評価した。production の `RECIPES` は変更していない。
- **Pool の定義:** 「その step の材料を購入した直後（entitled な材料は全部買った状態）」に DISCOVERABLE な未発見 recipe の集合。購入前（材料が Shop にあるが未購入）の窓は別掲（§2）。
- **A / B / C の定義（本タスクの指定どおり）:** A = 通常候補 1 件。B = **以前から発見可能だが、まだ発見していない recipe** が残っているため複数候補（そのstepで新しく解禁されたものだけなら 1 件）。C = そのstepで **新しく** 複数 recipe が同時に DISCOVERABLE。判定は「購入前後の差分」（同じ Dex のまま、そのstepの解除だけを外した状態との比較）で機械的に行った。
- **State U / D:** U = calabresa 未発見、D = calabresa 発見済み。プレイヤー視点の言い方では、U は「step 12 から作れる recipe を 1 つ見つけずに残している」状態。
- 172 母集団は再収集していない。材料集合は readiness JSON の `requiredIngredients`（matrix authority）を、現在の production 30 ingredient id と照合した。

## 1. STEP 1 — Latest-main GAP CHECK

**結論: material difference なし。**

| 確認項目 | 既存監査（#343 途中 HEAD `6d370c0` / 当時 main `82d8235`） | 最新 main `544db65` の production authority | 差分 |
|---|---|---|---|
| recipes / ingredients / ladder | 27 / （29→30）/ 25（#343 側） | **27 / 30 / 25** | なし（#343 が merge され main 化しただけ） |
| step 25 | `chicken` → `pesto-pollo` | `{ingredientIds:["chicken"], keyRecipeId:"pesto-pollo"}` | なし |
| step 1–24 | 凍結（byte-identical） | 凍結（`W1_FIXED_STEP_COUNT=24`、`POST_W1_APPENDED_STEPS=[chicken]`） | なし |
| non-credit | calabresa のみ | calabresa のみ（`ladderCredit:false`・`lunchRush:false`）。pesto-pollo は credited・`lunchRush:false` | なし |
| Inspector 分類 | step 12 = C、13–25 = `OPEN_POOL_POSSIBLE` | multi = [12]、OPEN_POOL = [12]、OPEN_POOL_POSSIBLE = [13…25] | なし |

step 25 の 4 通り（production predicate での再確認。既存監査 §5 と完全一致）:

| | chicken 購入前 | chicken 購入後 |
|---|---|---|
| calabresa 未発見 (U) | pool = {calabresa} → `TARGET:brazilian-calabresa` | pool = {calabresa, pesto-pollo} → `OPEN_POOL` |
| calabresa 発見済み (D) | pool = {} → `SHOP_NEW` | pool = {pesto-pollo} → `TARGET:pesto-pollo` |

非 material な注記（結論は変えない）: (a) 既存監査 md は main に無く別 branch にある。(b) 既存監査は #343 未 merge 前提の文言（「with #343」）だが、事実は main に取り込まれた。(c) 既存監査 §3「step 12 は calabresa を購入前に発見できない唯一の step」は、step 12 購入前の pool が空（`SHOP_NEW`）になる事実として今回も成立。

## 2. STEP 2 — Step 1〜25 の A / B / C map

条件: Dex は「margherita + step 1…s-1 の key recipe」（= ladder 順の到達直後）。購入後 pool で判定。

| step | 新材料 | key recipe | U（calabresa 未発見）pool | U 型 | D（発見済み）pool | D 型 | 購入前 hint（U / D） |
|---|---|---|---|---|---|---|---|
| 1 | egg | bismarck | bismarck (1) | A | bismarck (1) | A | SHOP_NEW / SHOP_NEW |
| 2 | bacon | breakfast-pizza | breakfast-pizza (1) | A | breakfast-pizza (1) | A | SHOP_NEW / SHOP_NEW |
| 3 | mushroom | funghi | funghi (1) | A | funghi (1) | A | SHOP_NEW / SHOP_NEW |
| 4 | eggplant | melanzane-pizza | melanzane-pizza (1) | A | melanzane-pizza (1) | A | SHOP_NEW / SHOP_NEW |
| 5 | parmigiano | parmigiana-pizza | parmigiana-pizza (1) | A | parmigiana-pizza (1) | A | SHOP_NEW / SHOP_NEW |
| 6 | pepperoni | pepperoni | pepperoni (1) | A | pepperoni (1) | A | SHOP_NEW / SHOP_NEW |
| 7 | sausage | salsiccia | salsiccia (1) | A | salsiccia (1) | A | SHOP_NEW / SHOP_NEW |
| 8 | ham | meat-lovers | meat-lovers (1) | A | meat-lovers (1) | A | SHOP_NEW / SHOP_NEW |
| 9 | corn | bambino | bambino (1) | A | bambino (1) | A | SHOP_NEW / SHOP_NEW |
| 10 | pineapple | hawaiian | hawaiian (1) | A | hawaiian (1) | A | SHOP_NEW / SHOP_NEW |
| 11 | black-olive+oregano | capricciosa | capricciosa (1) | A | capricciosa (1) | A | SHOP_NEW / SHOP_NEW |
| 12 | onion | pizza-portuguesa | pizza-portuguesa + calabresa (2) | C | pizza-portuguesa + calabresa (2) | C | SHOP_NEW / SHOP_NEW |
| 13 | olive-oil | fugazza | fugazza + calabresa (2) | B | fugazza (1) | A | TARGET:calabresa / SHOP_NEW |
| 14 | garlic | marinara | marinara + calabresa (2) | B | marinara (1) | A | TARGET:calabresa / SHOP_NEW |
| 15 | anchovy | napoletana | napoletana + calabresa (2) | B | napoletana (1) | A | TARGET:calabresa / SHOP_NEW |
| 16 | tuna | tonno-e-cipolla | tonno-e-cipolla + calabresa (2) | B | tonno-e-cipolla (1) | A | TARGET:calabresa / SHOP_NEW |
| 17 | pesto | pesto-tonno | pesto-tonno + calabresa (2) | B | pesto-tonno (1) | A | TARGET:calabresa / SHOP_NEW |
| 18 | cherry-tomato | genovese | genovese + calabresa (2) | B | genovese (1) | A | TARGET:calabresa / SHOP_NEW |
| 19 | clam | new-haven-apizza | new-haven-apizza + calabresa (2) | B | new-haven-apizza (1) | A | TARGET:calabresa / SHOP_NEW |
| 20 | fresh-tomato | pesto-caprese | pesto-caprese + calabresa (2) | B | pesto-caprese (1) | A | TARGET:calabresa / SHOP_NEW |
| 21 | potato | pesto-patate | pesto-patate + calabresa (2) | B | pesto-patate (1) | A | TARGET:calabresa / SHOP_NEW |
| 22 | rosemary | pizza-bianca | pizza-bianca + calabresa (2) | B | pizza-bianca (1) | A | TARGET:calabresa / SHOP_NEW |
| 23 | capers | puttanesca-pizza | puttanesca-pizza + calabresa (2) | B | puttanesca-pizza (1) | A | TARGET:calabresa / SHOP_NEW |
| 24 | fontina+gorgonzola | quattro-formaggi | quattro-formaggi + calabresa (2) | B | quattro-formaggi (1) | A | TARGET:calabresa / SHOP_NEW |
| 25 | chicken | pesto-pollo | calabresa + pesto-pollo (2) | B | pesto-pollo (1) | A | TARGET:calabresa / SHOP_NEW |

- **A（step 1–11）:** 材料を買うたびに作れるようになる recipe がちょうど 1 つ。発見順に依存しない。
- **C（step 12 のみ）:** `onion` で pizza-portuguesa と calabresa が **同時に** 新規 DISCOVERABLE。どちらも以前は作れなかったので、プレイヤーの履歴に関係なく 2 件（history-independent）。
- **B（step 13–25）:** pool 2 件のうち 1 件（calabresa）は「step 12 から作れたのに、まだ発見していない recipe」。calabresa を発見済みのプレイヤー（D）では 13–25 は **A に戻る**。calabresa は `ladderCredit:false` なので、発見しても ladder は進まない（key recipe を見つけた分だけ進む既存構造は不変）。
- **分類が発見順で変わる箇所:** step 13–25 のみ（U=B / D=A）。step 1–12 は発見順で変わらない。ladder 到達の構造上、calabresa 以外に「以前から発見可能だが未発見」の recipe は存在し得ない（既存監査 §1.4 と同じ）。
- **購入前の窓（既存の性質）:** U では step 13/24/25 などで、key recipe がまだ `KNOWN_BUT_MISSING_MATERIAL` のため pool = {calabresa} 単独 → hint が `TARGET:calabresa` を自動選択する。D では pool 空 → `SHOP_NEW`。この「購入前は単独 target になる」性質は追加 recipe があっても同じ規則で働く（§5）。
- 最大 pool = 2（step 12–25 の U）。pool ≥ 3 は現在どの step にも無い。

## 3. STEP 3 — 現在の 30 ingredient だけで材料集合を満たせる未実装 recipe（candidate 一覧・選定なし）

### 3.1 母集団の絞り込み（172 readiness JSON の再利用）

| 段階 | 件数 |
|---|---|
| 172 行のうち、identity set の全 ingredient が現行 30 ingredient に含まれる行 | 48 |
| うち既に production（12 行 + 今回 No.27 の `pesto-pollo-pizzadb-p12`） | 13 |
| **candidate（未実装・材料は現行 30 だけで足りる）** | **35** |
| candidate の readiness 主分類（既存 audit の E > D > 材料 tier 規則） | D = 19 / E = 12 / A = 4 |
| mechanic・authority・collision のいずれの blocker も無い行 | **1**（`aussie-pizzadb`。ただし no-sauce の特殊条件あり） |

- 「材料が足りる」ことと「入れられる」ことは別: 35 件のうち 34 件は mechanic 依存（D）・authority 不足（E）・identity 衝突のいずれかを持つ。表 3.3 に全件を残してある（除外はしていない）。
- readiness JSON は当時 main（26 recipes / 29 ingredients）基準。差分は `chicken` が production 材料になった点だけで、これにより `curry-pizza-japan-pizzadb-p2`（`chicken` のみ不足だった行）が材料 tier B → 現行 30 で充足に変わり、`pesto-pollo` 行は production 入りした。
- 「earliest DISCOVERABLE step」は ladder 上の材料 step の最大値（starter のみなら 0）。production の `recipeKeyStep` と同じ定義。`unresolvedTokens` を持つ行は identity set が不完全（下限値）。

step ごとの candidate 数（**candidate が 0 件の step も事実として残す**）:

| earliest step | 0 | 1–5 | 6 | 7 | 8 | 9–10 | 11 | 12 | 13 | 14 | 15 | 16–19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| candidate 数 | 6 | 0 | 4 | 2 | 1 | 0 | 1 | 8 | 1 | 3 | 2 | 0 | 2 | 1 | 0 | 2 | 1 | 1 |

### 3.2 材料・identity 表（全 35 件、earliest step 昇順）

| row id | 名称 | 必要 ingredient（identity set） | sauce / base | 最後に解除される材料 | earliest step | その step の key recipe | Dex 章 |
|---|---|---|---|---|---|---|---|
| `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | basil, mozzarella, tomato-sauce | tomato-sauce | （starter のみ） | 0 | —（開始時） | 第1章 |
| `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | mozzarella | sauce 材料なし（family_derived） | （starter のみ） | 0 | —（開始時） | 第1章 |
| `ny-style-pizzadb` | ニューヨークスタイルピザ（PIZZA DB版） | mozzarella, tomato-sauce | tomato-sauce | （starter のみ） | 0 | —（開始時） | 第1章 |
| `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | basil, mozzarella, tomato-sauce | tomato-sauce | （starter のみ） | 0 | —（開始時） | 第1章 |
| `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | mozzarella ※不完全 | sauce 材料なし（family_derived） | （starter のみ） | 0 | —（開始時） | 第1章 |
| `trenton-tomato-pie-pizzadb` | トレントントマトパイ | mozzarella, tomato-sauce | tomato-sauce | （starter のみ） | 0 | —（開始時） | 第1章 |
| `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | mozzarella, pepperoni, tomato-sauce | tomato-sauce | pepperoni | 6 | pepperoni | 第2章 |
| `montreal-style-pizza-pizzadb-p13` | モントリオールスタイルピザ | mozzarella, mushroom, pepperoni, tomato-sauce | tomato-sauce | pepperoni | 6 | pepperoni | 第2章 |
| `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | mozzarella, pepperoni, tomato-sauce | tomato-sauce | pepperoni | 6 | pepperoni | 第2章 |
| `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | pepperoni ※不完全 | sauce 材料なし（family_derived） | pepperoni | 6 | pepperoni | 第2章 |
| `chicago-deep-dish-pizzadb` | シカゴディープディッシュ（PIZZA DB版） | mozzarella, pepperoni, sausage, tomato-sauce | tomato-sauce | sausage | 7 | salsiccia | 第2章 |
| `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | mozzarella, sausage, tomato-sauce | tomato-sauce | sausage | 7 | salsiccia | 第2章 |
| `bismarck-pizza-pizzadb-p7` | ビスマルク | egg, ham, mozzarella, mushroom, tomato-sauce | tomato-sauce | ham | 8 | meat-lovers | 第2章 |
| `pizza-a-caballo` | ピッツァ・ア・カバージョ | black-olive, mozzarella, oregano | sauce 材料なし（none） | black-olive+oregano | 11 | capricciosa | 第2章 |
| `aussie-pizzadb` | オージーピザ | bacon, egg, mozzarella, onion | sauce 材料なし（none） | onion | 12 | pizza-portuguesa | 第2章 |
| `fugazza-pizzadb-p10` | フガザ | mozzarella, onion, oregano | sauce 材料なし（none） | onion | 12 | pizza-portuguesa | 第2章 |
| `fugazzeta-rellena` | フガゼッタ・レジェーナ | ham, mozzarella, onion, oregano | sauce 材料なし（none） | onion | 12 | pizza-portuguesa | 第2章 |
| `fugazzetta-pizzadb-p10` | フガゼッタ | mozzarella, onion, oregano | sauce 材料なし（none） | onion | 12 | pizza-portuguesa | 第2章 |
| `keema-pizza-pizzadb-p2` | キーマピザ | mozzarella, onion ※不完全 | sauce 材料なし（unspecified） | onion | 12 | pizza-portuguesa | 第2章 |
| `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | onion ※不完全 | sauce 材料なし（family_derived） | onion | 12 | pizza-portuguesa | 第2章 |
| `pizza-baiana` | ピッツァ・バイアーナ | egg, mozzarella, onion, sausage ※不完全 | sauce 材料なし（family_derived） | onion | 12 | pizza-portuguesa | 第2章 |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | black-olive, egg, mozzarella, onion ※不完全 | sauce 材料なし（family_derived） | onion | 12 | pizza-portuguesa | 第2章 |
| `margherita-pizzadb-row` | マルゲリータ | basil, mozzarella, olive-oil, tomato-sauce | olive-oil+tomato-sauce | olive-oil | 13 | fugazza | 第2章 |
| `grandma-pizza-pizzadb` | グランマピザ | garlic, mozzarella, olive-oil, tomato-sauce | olive-oil+tomato-sauce | garlic | 14 | marinara | 第2章 |
| `marinara-pizza-pizzadb-p13` | マリナーラ | garlic, olive-oil, oregano, tomato-sauce | olive-oil+tomato-sauce | garlic | 14 | marinara | 第2章 |
| `pizza-de-cancha` | ピッツァ・デ・カンチャ | garlic, olive-oil, oregano ※不完全 | olive-oil | garlic | 14 | marinara | 第2章 |
| `sfincione-pizzadb` | スフィンチョーネ | anchovy, olive-oil, onion, oregano, tomato-sauce | olive-oil+tomato-sauce | anchovy | 15 | napoletana | 第3章 |
| `siciliana-pizzadb` | シチリアンピザ（PIZZA DB版） | anchovy, mozzarella, onion, tomato-sauce | tomato-sauce | anchovy | 15 | napoletana | 第3章 |
| `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | fresh-tomato, garlic, mozzarella, oregano, parmigiano | sauce 材料なし（none） | fresh-tomato | 20 | pesto-caprese | 第3章 |
| `chilean-napolitana-pizzadb` | チリアンナポリターナ | fresh-tomato, mozzarella, oregano | sauce 材料なし（none） | fresh-tomato | 20 | pesto-caprese | 第3章 |
| `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | bacon, corn, potato ※不完全 | sauce 材料なし（none） | potato | 21 | pesto-patate | 第3章 |
| `caponata-pizza-pizzadb-p2` | カポナータピザ | black-olive, capers, eggplant, mozzarella ※不完全 | sauce 材料なし（unspecified） | capers | 23 | puttanesca-pizza | 第3章 |
| `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | anchovy, capers, mozzarella, oregano, tomato-sauce | tomato-sauce | capers | 23 | puttanesca-pizza | 第3章 |
| `quattro-formaggi-pizzadb` | クアトロフォルマッジ（PIZZA DB版） | fontina, gorgonzola, mozzarella, parmigiano | sauce 材料なし（none） | fontina+gorgonzola | 24 | quattro-formaggi | 第3章 |
| `curry-pizza-japan-pizzadb-p2` | カレーピザ | chicken, mozzarella, onion ※不完全 | sauce 材料なし（listed_unresolved） | chicken | 25 | pesto-pollo | 第3章 |

### 3.3 追加した場合の step 変化（全 35 件、`ladderCredit` は両値で同結果の項目のみ。差は §6）

型の書式 = 「追加前 → 追加後」（数字は pool 件数、`C` はそのstepで新規 2 件以上）。「未発見のまま残る step 数」= その candidate を発見しないとき、pool に載り続ける step 数（k〜25）。「複数候補 step 数」= pool が 2 件以上になる step の総数（calabresa 発見済み D / 未発見 U、candidate は未発見）。現状（追加なし）の複数候補 step 数は D = 1、U = 14。

| row id | earliest step | U の変化 | D の変化 | 未発見のまま残る step 数 | 複数候補 step 数（D / U） |
|---|---|---|---|---|---|
| `cauliflower-crust-pizza-pizzadb-p2` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `colorado-mountain-pie-pizzadb-p3` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `ny-style-pizzadb` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `pizza-al-taglio-romana-pizzadb-p9` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `quad-cities-style-pizza-pizzadb-p2` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `trenton-tomato-pie-pizzadb` | 0 | A1->B2 | A1->B2 | 開始〜25（開始 pool = margherita + candidate） | 25 / 25 |
| `fathead-pizza-keto-pizzadb-p9` | 6 | A1->C2 | A1->C2 | 6〜25（20） | 20 / 20 |
| `montreal-style-pizza-pizzadb-p13` | 6 | A1->C2 | A1->C2 | 6〜25（20） | 20 / 20 |
| `new-england-bar-pizza-pizzadb-p6` | 6 | A1->C2 | A1->C2 | 6〜25（20） | 20 / 20 |
| `st-louis-style-pizza-pizzadb-p4` | 6 | A1->C2 | A1->C2 | 6〜25（20） | 20 / 20 |
| `chicago-deep-dish-pizzadb` | 7 | A1->C2 | A1->C2 | 7〜25（19） | 19 / 19 |
| `chicago-stuffed-pizza-pizzadb-p3` | 7 | A1->C2 | A1->C2 | 7〜25（19） | 19 / 19 |
| `bismarck-pizza-pizzadb-p7` | 8 | A1->C2 | A1->C2 | 8〜25（18） | 18 / 18 |
| `pizza-a-caballo` | 11 | A1->C2 | A1->C2 | 11〜25（15） | 15 / 15 |
| `aussie-pizzadb` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `fugazza-pizzadb-p10` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `fugazzeta-rellena` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `fugazzetta-pizzadb-p10` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `keema-pizza-pizzadb-p2` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `old-forge-style-pizza-pizzadb-p1` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `pizza-baiana` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `pizza-chilena-pizzadb-p8` | 12 | C2->C3 | C2->C3 | 12〜25（14） | 14 / 14 |
| `margherita-pizzadb-row` | 13 | B2->C3 | A1->C2 | 13〜25（13） | 14 / 14 |
| `grandma-pizza-pizzadb` | 14 | B2->C3 | A1->C2 | 14〜25（12） | 13 / 14 |
| `marinara-pizza-pizzadb-p13` | 14 | B2->C3 | A1->C2 | 14〜25（12） | 13 / 14 |
| `pizza-de-cancha` | 14 | B2->C3 | A1->C2 | 14〜25（12） | 13 / 14 |
| `sfincione-pizzadb` | 15 | B2->C3 | A1->C2 | 15〜25（11） | 12 / 14 |
| `siciliana-pizzadb` | 15 | B2->C3 | A1->C2 | 15〜25（11） | 12 / 14 |
| `argentine-napolitana-pizzadb-p1` | 20 | B2->C3 | A1->C2 | 20〜25（6） | 7 / 14 |
| `chilean-napolitana-pizzadb` | 20 | B2->C3 | A1->C2 | 20〜25（6） | 7 / 14 |
| `hokkaido-cheese-pizza-pizzadb-p15` | 21 | B2->C3 | A1->C2 | 21〜25（5） | 6 / 14 |
| `caponata-pizza-pizzadb-p2` | 23 | B2->C3 | A1->C2 | 23〜25（3） | 4 / 14 |
| `pizza-romana-pizzadb-p9` | 23 | B2->C3 | A1->C2 | 23〜25（3） | 4 / 14 |
| `quattro-formaggi-pizzadb` | 24 | B2->C3 | A1->C2 | 24〜25（2） | 3 / 14 |
| `curry-pizza-japan-pizzadb-p2` | 25 | B2->C3 | A1->C2 | 25〜25（1） | 2 / 14 |

- 見方: `A1->C2` は「1 件だった step が、新しく 2 件同時に DISCOVERABLE になる step に変わる」（A→C）。`B2->C3` は「calabresa が残る pool 2 件の step が、新規 2 件 + 持ち越し 1 件になる」（B→C）。`C2->C3`（step 12）は C のまま 3 件に増える。
- earliest step が 0 の 6 件は **開始時から** margherita と同時に作れる（start pool = {margherita, candidate}）。onboarding の「最初に見つける 1 枚」が 1 件でなくなる（`discoveryProgressionModel` も「最初の 1 枚は finite 材料なしの recipe」を前提）。

### 3.4 条件・blocker 表（mechanic / authority / naming・identity / 特殊条件）

readiness の用語: mechanic = 現行調理手順で表せない capability への依存、authority = PIZZA DB 由来の identity 材料の完全性、`SAME_SET_AS_PRODUCTION` = identity set が production recipe と完全一致、`NAMING_CLUSTER` = 名称の近い別系統。

| row id | 主分類 | mechanic dependency | authority completeness | naming / identity 衝突 | 特殊条件（no-sauce・thin・late topping 等） |
|---|---|---|---|---|---|
| `cauliflower-crust-pizza-pizzadb-p2` | D | DOUGH_VARIANT | MODERATE_WITH_CAVEATS | MATRIX_COLLISION_LEDGER:P0-COLL-2, SAME_SET_AS_PRODUCTION:margherita, SAME_SET_AS_ROWS:pizza-al-taglio-romana-pizzadb-p9 | 生地 variant: material-cauliflower |
| `colorado-mountain-pie-pizzadb-p3` | E | DOUGH_VARIANT | INCOMPLETE — EVIDENCE_GAP; PLACEHOLDER_TOPPING(お好みの具材) | — | sauce 材料なし; 生地 variant: honey-thick; key-free Hint 要確認 |
| `ny-style-pizzadb` | D | DOUGH_VARIANT | STRONG | MATRIX_COLLISION_LEDGER:P0-COLL-1, SAME_SET_AS_ROWS:trenton-tomato-pie-pizzadb | thin 生地記述 |
| `pizza-al-taglio-romana-pizzadb-p9` | D | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | MODERATE_WITH_CAVEATS | MATRIX_COLLISION_LEDGER:P0-COLL-2, SAME_SET_AS_PRODUCTION:margherita, SAME_SET_AS_ROWS:cauliflower-crust-pizza-pizzadb-p2 | 生地 variant: long-ferment |
| `quad-cities-style-pizza-pizzadb-p2` | E | DOUGH_VARIANT | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: スパイシーソーセージ | — | sauce 材料なし; thin 生地記述; 生地 variant: malt-thin-crisp; key-free Hint 要確認 |
| `trenton-tomato-pie-pizzadb` | D | STEP_ORDER | STRONG | MATRIX_COLLISION_LEDGER:P0-COLL-1, SAME_SET_AS_ROWS:ny-style-pizzadb | — |
| `fathead-pizza-keto-pizzadb-p9` | D | DOUGH_VARIANT | MODERATE_WITH_CAVEATS | MATRIX_COLLISION_LEDGER:P0-COLL-3, SAME_SET_AS_PRODUCTION:pepperoni, SAME_SET_AS_ROWS:new-england-bar-pizza-pizzadb-p6 | 生地 variant: material-keto-mozzarella-almond |
| `montreal-style-pizza-pizzadb-p13` | D | DOUGH_VARIANT, PAN_BAKE | MODERATE_WITH_CAVEATS | — | 生地 variant: thick |
| `new-england-bar-pizza-pizzadb-p6` | D | DOUGH_VARIANT, PAN_BAKE | MODERATE_WITH_CAVEATS | MATRIX_COLLISION_LEDGER:P0-COLL-3, SAME_SET_AS_PRODUCTION:pepperoni, SAME_SET_AS_ROWS:fathead-pizza-keto-pizzadb-p9 | thin 生地記述; 生地 variant: thin-crisp |
| `st-louis-style-pizza-pizzadb-p4` | E | DOUGH_VARIANT | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: プロヴェルチーズ | — | sauce 材料なし; cheese なし; thin 生地記述; 生地 variant: yeastless-cracker-thin; key-free Hint 要確認 |
| `chicago-deep-dish-pizzadb` | D | PAN_BAKE, STEP_ORDER | STRONG | COMPOSITION_CONFLICT_CANDIDATE, NAMING_CLUSTER:NC-7-chicago | — |
| `chicago-stuffed-pizza-pizzadb-p3` | D | DOUGH_VARIANT, ENCLOSE | MODERATE_WITH_CAVEATS | NAMING_CLUSTER:NC-7-chicago, SAME_SET_AS_PRODUCTION:salsiccia | 生地 variant: thick |
| `bismarck-pizza-pizzadb-p7` | A | — | MODERATE_WITH_CAVEATS | COMPOSITION_CONFLICT_SHIPPED | — |
| `pizza-a-caballo` | E | DOUGH_VARIANT, ENCLOSE | INCOMPLETE — EVIDENCE_GAP | — | sauce 材料なし; 生地 variant: thick-fluffy; key-free Hint 要確認 |
| `aussie-pizzadb` | A | — | STRONG | — | sauce 材料なし |
| `fugazza-pizzadb-p10` | D | DOUGH_VARIANT | MODERATE | COMPOSITION_CONFLICT_SHIPPED, DISCOVERY_COLLISION, MATRIX_COLLISION_LEDGER:P0-COLL-5, SAME_SET_AS_ROWS:fugazzetta-pizzadb-p10 | sauce 材料なし; 生地 variant: thick-fluffy |
| `fugazzeta-rellena` | D | DOUGH_VARIANT, ENCLOSE | STRONG | — | sauce 材料なし; 生地 variant: thick-fluffy |
| `fugazzetta-pizzadb-p10` | D | DOUGH_VARIANT | MODERATE | COMPOSITION_CONFLICT_CANDIDATE, DISCOVERY_COLLISION, MATRIX_COLLISION_LEDGER:P0-COLL-5, SAME_SET_AS_ROWS:fugazza-pizzadb-p10 | sauce 材料なし; 生地 variant: thick-fluffy |
| `keema-pizza-pizzadb-p2` | E | — | INCOMPLETE — SAUCE_BASE_UNSPECIFIED; UNRESOLVED_INGREDIENT; 曖昧 token: ひき肉,青唐辛子 | — | sauce 材料なし; thin 生地記述; key-free Hint 要確認 |
| `old-forge-style-pizza-pizzadb-p1` | E | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: チーズ | — | sauce 材料なし; cheese なし; 生地 variant: medium-thick; key-free Hint 要確認 |
| `pizza-baiana` | E | — | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: 唐辛子 | — | sauce 材料なし; thin 生地記述; key-free Hint 要確認 |
| `pizza-chilena-pizzadb-p8` | E | — | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: ひき肉 | — | sauce 材料なし; thin 生地記述; key-free Hint 要確認 |
| `margherita-pizzadb-row` | D | MULTI_SPREAD_LAYER | MODERATE_WITH_CAVEATS | COMPOSITION_CONFLICT_SHIPPED | thin 生地記述 |
| `grandma-pizza-pizzadb` | D | MULTI_SPREAD_LAYER | STRONG | — | — |
| `marinara-pizza-pizzadb-p13` | D | MULTI_SPREAD_LAYER | MODERATE_WITH_CAVEATS | COMPOSITION_CONFLICT_SHIPPED | cheese なし |
| `pizza-de-cancha` | E | DOUGH_VARIANT, MULTI_SPREAD_LAYER | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: 唐辛子 | — | cheese なし; 生地 variant: thick-fluffy; key-free Hint 要確認 |
| `sfincione-pizzadb` | D | MULTI_SPREAD_LAYER | MODERATE_WITH_CAVEATS | NAMING_CLUSTER:NC-3-sicilian | cheese なし |
| `siciliana-pizzadb` | D | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | STRONG | COMPOSITION_CONFLICT_CANDIDATE, NAMING_CLUSTER:NC-3-sicilian | — |
| `argentine-napolitana-pizzadb-p1` | D | DOUGH_VARIANT | MODERATE_WITH_CAVEATS | NAMING_CLUSTER:NC-1-napoletana | sauce 材料なし; 生地 variant: thick-fluffy |
| `chilean-napolitana-pizzadb` | A | — | STRONG | NAMING_CLUSTER:NC-1-napoletana | sauce 材料なし |
| `hokkaido-cheese-pizza-pizzadb-p15` | E | — | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: チーズ | — | sauce 材料なし; cheese なし; thin 生地記述; key-free Hint 要確認 |
| `caponata-pizza-pizzadb-p2` | E | — | INCOMPLETE — SAUCE_BASE_UNSPECIFIED | — | sauce 材料なし; key-free Hint 要確認 |
| `pizza-romana-pizzadb-p9` | D | DOUGH_VARIANT | MODERATE_WITH_CAVEATS | COMPOSITION_CONFLICT_CANDIDATE | thin 生地記述; 生地 variant: roman-thin-crisp |
| `quattro-formaggi-pizzadb` | A | — | STRONG | COMPOSITION_CONFLICT_SHIPPED | sauce 材料なし |
| `curry-pizza-japan-pizzadb-p2` | E | — | INCOMPLETE — UNRESOLVED_INGREDIENT; 曖昧 token: カレーソース | — | sauce 材料なし; thin 生地記述; key-free Hint 要確認 |

- 主分類 A = 材料のみ（blocker なし。ただし secondary に identity 衝突を持つ行あり）、D = mechanic 依存、E = authority 不完全。**ここでは採否の判断をしていない**（「入れられる」ではなく「材料が足りる」ことの一覧）。
- no-sauce 行（sauce 材料なしの行）は `RECIPE_SAUCE_PROFILES` が「sauce なし」を持たない total Record のため、エンジン経路が未実証（readiness の `keyFreeNotes`）。calabresa が証明したのは「cheese なし」までで、「sauce なし」は未証明。
- production への接点（実装フェーズの確認項目。今回は変更しない）: `RECIPES` / `RECIPE_DISCOVERY_TARGET_IDS`（`Record<RecipeId,…>` で型が強制）/ `recipeHintRoles` / `recipeSauceProfiles` / `cookingProfiles` / Lunch Rush（`lunchRush` フラグ）。No.27 の vertical slice Result が実績。

## 4. STEP 4 — Discovery branching coverage（事実比較。最良・推奨・順位付けはしない）

### 4.1 指標の定義

- **新規 C step:** candidate の earliest step が、現在 C でない step に新しく C を作るか。C は「そのstepで新規 DISCOVERABLE が 2 件以上」なので、**プレイヤーの発見履歴に依存しない**（candidate は earliest step より前には作れない = 持ち越しにならない）。calabresa を発見済みでも C になる。
- **複数候補が続く step 数（candidate 未発見の間）:** earliest step〜25。ただし `ladderCredit:false` の場合のみ。candidate を発見すると次の step から pool は candidate 分だけ減る（§6）。
- **calabresa 発見済み（D）でも複数候補になるか:** step k では C のため必ずなる。k 以降は candidate が未発見の間だけ B。

### 4.2 step 位置（slot）別の coverage — 構造 probe（`tomato-sauce + mozzarella + その step の材料` だけの合成 recipe）

追加 recipe 1 件を step k に置いた場合の事実。現状は D の複数候補 step = 1（step 12）、U = 14。

| k | 追加前 U→後 U | 追加前 D→後 D | 新規に C になる step | 複数候補 step 数 D / U（未発見の間） | candidate を発見した後（`ladderCredit:false`, D）の複数候補 step 数 | 同（`ladderCredit:true`, D）| この k の candidate 数 |
|---|---|---|---|---|---|---|---|
| 0 | A1→B2 | A1→B2 | なし（開始 pool が 2 件） | 25 / 25 | 1 | 25 | 6 |
| 1 | A1→C2 | A1→C2 | 1 | 25 / 25 | 2 | 25 | 0 |
| 2 | A1→C2 | A1→C2 | 2 | 24 / 24 | 2 | 24 | 0 |
| 3 | A1→C2 | A1→C2 | 3 | 23 / 23 | 2 | 23 | 0 |
| 4 | A1→C2 | A1→C2 | 4 | 22 / 22 | 2 | 22 | 0 |
| 5 | A1→C2 | A1→C2 | 5 | 21 / 21 | 2 | 21 | 0 |
| 6 | A1→C2 | A1→C2 | 6 | 20 / 20 | 2 | 20 | 4 |
| 7 | A1→C2 | A1→C2 | 7 | 19 / 19 | 2 | 19 | 2 |
| 8 | A1→C2 | A1→C2 | 8 | 18 / 18 | 2 | 18 | 1 |
| 9 | A1→C2 | A1→C2 | 9 | 17 / 17 | 2 | 17 | 0 |
| 10 | A1→C2 | A1→C2 | 10 | 16 / 16 | 2 | 16 | 0 |
| 11 | A1→C2 | A1→C2 | 11 | 15 / 15 | 2 | 15 | 1 |
| 12 | C2→C3 | C2→C3 | なし（step 12 は既に C。2→3 件） | 14 / 14 | 1 | 14 | 8 |
| 13 | B2→C3 | A1→C2 | 13 | 14 / 14 | 2 | 14 | 1 |
| 14 | B2→C3 | A1→C2 | 14 | 13 / 14 | 2 | 13 | 3 |
| 15 | B2→C3 | A1→C2 | 15 | 12 / 14 | 2 | 12 | 2 |
| 16 | B2→C3 | A1→C2 | 16 | 11 / 14 | 2 | 11 | 0 |
| 17 | B2→C3 | A1→C2 | 17 | 10 / 14 | 2 | 10 | 0 |
| 18 | B2→C3 | A1→C2 | 18 | 9 / 14 | 2 | 9 | 0 |
| 19 | B2→C3 | A1→C2 | 19 | 8 / 14 | 2 | 8 | 0 |
| 20 | B2→C3 | A1→C2 | 20 | 7 / 14 | 2 | 7 | 2 |
| 21 | B2→C3 | A1→C2 | 21 | 6 / 14 | 2 | 6 | 1 |
| 22 | B2→C3 | A1→C2 | 22 | 5 / 14 | 2 | 5 | 0 |
| 23 | B2→C3 | A1→C2 | 23 | 4 / 14 | 2 | 4 | 2 |
| 24 | B2→C3 | A1→C2 | 24 | 3 / 14 | 2 | 3 | 1 |
| 25 | B2→C3 | A1→C2 | 25 | 2 / 14 | 2 | 2 | 1 |

読み取り（事実のみ）:
- step 1–11（現在 A）に置くと、その step が **A→C**。U/D どちらでも同じ。
- step 12 に置くと C のまま 2→3 件。新しい C step は増えない。
- step 13–25 に置くと、U では **B→C**（2→3 件）、D では **A→C**（1→2 件）。
- 置いた k が小さいほど、candidate 未発見の間に複数候補が続く step が長い（k=1: 25 step、k=12: 14 step、k=25: 2 step）。
- `ladderCredit:false` で candidate を発見すると、複数候補は「k と step 12」の 2 step だけに戻る（k=12 は 1 step）。`ladderCredit:true` では発見しても **複数候補が戻らない**（§6）。
- candidate が存在しない step（1–5, 9–10, 16–19, 22）は、現在の 35 件では埋められない。

### 4.3 複数追加の組み合わせ（構造 probe。選定ではなく挙動の検証）

`ladderCredit:false`、複数候補 step の集合を示す。数字 = pool 件数。

| 追加位置 k | D・全部未発見 | D・全部発見後 | U・全部未発見 |
|---|---|---|---|
| 3,9,15,21 | 1-2:A1 3:C2 4-8:B2 9:C3 10-11:B3 12:C4 13-14:B3 15:C4 16-20:B4 21:C5 22-25:B5 | 1-2:A1 3:C2 4-8:A1 9:C2 10-11:A1 12:C2 13-14:A1 15:C2 16-20:A1 21:C2 22-25:A1 | 1-2:A1 3:C2 4-8:B2 9:C3 10-11:B3 12:C4 13-14:B4 15:C5 16-20:B5 21:C6 22-25:B6 |
| 12,12,12 | 1-11:A1 12:C5 13-25:B4 | 1-11:A1 12:C5 13-25:A1 | 1-11:A1 12:C5 13-25:B5 |
| 25,25 | 1-11:A1 12:C2 13-24:A1 25:C3 | 1-11:A1 12:C2 13-24:A1 25:C3 | 1-11:A1 12:C2 13-24:B2 25:C4 |
| 7,15,20 | 1-6:A1 7:C2 8-11:B2 12:C3 13-14:B2 15:C3 16-19:B3 20:C4 21-25:B4 | 1-6:A1 7:C2 8-11:A1 12:C2 13-14:A1 15:C2 16-19:A1 20:C2 21-25:A1 | 1-6:A1 7:C2 8-11:B2 12:C3 13-14:B3 15:C4 16-19:B4 20:C5 21-25:B5 |
| 5,12,19,25 | 1-4:A1 5:C2 6-11:B2 12:C4 13-18:B3 19:C4 20-24:B4 25:C5 | 1-4:A1 5:C2 6-11:A1 12:C3 13-18:A1 19:C2 20-24:A1 25:C2 | 1-4:A1 5:C2 6-11:B2 12:C4 13-18:B4 19:C5 20-24:B5 25:C6 |

- 同じ step に重ねる（12,12,12 / 25,25）と C の件数が増える（step 12 は 2→5 件）。C step の数は増えない。
- 別々の step に置く（3,9,15,21 など）と C step の数が増え、発見前は B が連なる。全部発見すると、各 C step を除いて A に戻る。
- `ladderCredit:true` の同条件は §6 を参照。

## 5. STEP 5 — Hint / Notebook / Pantry・Search の互換性（新仕様は設計しない）

| 項目 | 確認結果（pool 2 / 3 / 4 / 5 件で確認） | 根拠 |
|---|---|---|
| candidate identity leak | **なし。** `selectHintTarget` は pool ≥ 2 で pin/sticky が無ければ `{"kind":"OPEN_POOL"}` のみを返す（recipe id なし）。pool 2・3・4・5 の全てで同一の戻り値。pin は pool > 1 のとき選べず（OD-4b-A-2）、sticky（購入・開示済み target）だけが `TARGET` を保つ | harness 実測（step 12 に合成 recipe 0〜3 件を追加）。`hintTarget.ts` D-1 |
| candidate count leak | **なし（表示上）。** `HintSheet` の OPEN_POOL は固定文言（`openPoolCopy.ts`）で件数を持たない。Dex は 2 件以上の DISCOVERABLE を 1 枚の aggregated card に畳み、件数も slot も DOM に出さない（`aggregateUnknown`）。**潜在リスク（現状は未表示）:** `PizzaSelectView.prompt` は `{kind:"DISCOVERABLE", count}` と件数を **view model に保持** しているが、`PromptCard` は件数を描画しない。pool が 3 件以上でも描画は変わらない | `DexOverlay.tsx` L123、`PizzaSelectScreen.tsx` PromptCard |
| exact distance / similarity / Near-Far | **復活しない。** Near/Far Neutralization Phase 1 で `resultNearMiss` は pool・距離・tie-break を読まず、ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH には 1 種の `NEUTRAL` 文言のみ。旧 `nearMiss.ts` は production caller なし（test で pin）。pool 件数が増えても入力に pool が無いので影響しない | `resultNearMiss.ts`、Near-Far Phase 1 Result |
| correct ingredient count | **なし。** 正解材料数を返す経路は無い（Hint 5.0 は target があるときの rung のみ。OPEN_POOL では `hint5LadderActive` が false = target なし） | `discoveryHint.ts` `hint5LadderActive` |
| Trial Notebook N1/N2 | **影響なし。** notebook は「プレイヤー自身の試行」だけを保存し recipe id / target / pool / distance / feedback を持たない（`feedback:null` 固定）。N2 diff はプレイヤーの 2 combination だけを入力にする。pool 件数に依存しない | `trialNotebook.ts` ヘッダ、N2 Result |
| Pantry / Search | **影響なし。** `IngredientPantry` と検索 alias は recipe / discovery / hint 情報を持たない（所持材料の探索のみ）。OPEN_POOL からの導線も固定文言＋既存の食材庫起動のみ（IP-1） | `ingredientSearchAliases.ts` ヘッダ、IP-1 Result |

注意点（既存の性質で、追加 recipe によって増減するもの）:
1. **購入前の単独 target:** 材料が Shop にあり未購入の間は key recipe が `KNOWN_BUT_MISSING_MATERIAL` のため、pool が 1 件に見える窓がある（現状 U の step 13–25 で calabresa、D で空）。追加 recipe（既存材料のみ）は購入前から DISCOVERABLE なので、U/D を問わずこの窓で pool に常駐する。pool が 1 件のときは自動 `TARGET`、2 件以上なら `OPEN_POOL`（同じ規則）。
2. **「新材料が唯一の手がかり」の希薄化:** 現在の step 13–25 の pool は calabresa と key recipe が材料を共有しない（step 25: chicken だけが手がかり）。既存材料だけの追加 recipe は新材料に依存しないため、そのstepの新材料は key recipe を指し続け、追加 recipe は別経路（試行の組み合わせ）で見つかる。これは仕様ではなく挙動の記述。
3. **既存セーブ:** `ladderCredit` / 追加 recipe は save schema を変えないが、すでに step k より先にいるプレイヤーは追加 recipe が **最初から pool に載る**（B 型）。
4. **経済 sim の注意:** `hint5EconomySim` / `discoveryHintEconomySim`（test-support）は OPEN_POOL で pool から 1 件を選ぶ。production の挙動ではないが、追加後は sim 側の pick 規則が結果を変える。

## 6. STEP 6 — `ladderCredit: false` と `true` の差（採用は未決定）

production の規則: step s は **credited な発見数 ≥ s** で到達（`discoveredRecipeCount(dex, countsTowardLadder)` → `resolveMaterialUnlocks`）。到達済み step の材料は Shop に出て、全部買うと key recipe が DISCOVERABLE になる。

### 6.1 差のまとめ

| | `ladderCredit:false`（calabresa 型） | `ladderCredit:true`（pesto-pollo 型。既定） |
|---|---|---|
| 発見しても次 step を直接進めるか | **進めない** | **進める**（count +1） |
| candidate を未発見の間 | pool に常駐（B）。ladder の到達タイミングは追加前と同一 | 同じ（未発見なら §4 と pool 件数は同一） |
| candidate を発見した後 | **pool から外れ、A に戻る**（step k の C を除く） | 発見で count が 1 つ先行し、**以後 step 25 まで pool が 2 件のまま**（B が戻らない）。key recipe を見つける前に次 step の材料が出るため、「直前 step の key recipe が未発見のまま残る」 |
| 「key recipe 未発見のまま次 step へ進める」 | 不可（key recipe を見つけるしかない） | 可。credited 追加 1 件につき最大 1 step ぶんの先行 |
| step 25 到達時の credited 未発見数 | 1（pesto-pollo）＋ non-credit 側 | 2（追加 1 件ごとに +1）。ladder は 25 step のまま |
| Shop の「次の材料」ヒント | 変化なし | `nextMaterialHint(discoveredRecipeCount(dex, countsTowardLadder), …)` が 1 発見ぶん早く進む |
| `ladderCredit` の保存 | 保存されない（`Recipe` の静的 data） | 同じ |

### 6.2 実測（step 25 までの pool 件数。数字 = 購入直後の pool 件数、型は A/B/C）

構造 probe を k に置き、D（calabresa 発見済み）で candidate を **できるだけ早く** 発見した場合:
- k=3: 未発見のまま = `1-2:A1 3:C2 4-11:B2 12:C3 13-25:B2`／`false` で発見 = `1-2:A1 3:C2 4-11:A1 12:C2 13-25:A1`／`true` で発見 = `1-2:A1 3:C2 4-11:B2 12:C3 13-25:B2`
- k=7: 未発見のまま = `1-6:A1 7:C2 8-11:B2 12:C3 13-25:B2`／`false` で発見 = `1-6:A1 7:C2 8-11:A1 12:C2 13-25:A1`／`true` で発見 = `1-6:A1 7:C2 8-11:B2 12:C3 13-25:B2`
- k=12: 未発見のまま = `1-11:A1 12:C3 13-25:B2`／`false` で発見 = `1-11:A1 12:C3 13-25:A1`／`true` で発見 = `1-11:A1 12:C3 13-25:B2`
- k=20: 未発見のまま = `1-11:A1 12:C2 13-19:A1 20:C2 21-25:B2`／`false` で発見 = `1-11:A1 12:C2 13-19:A1 20:C2 21-25:A1`／`true` で発見 = `1-11:A1 12:C2 13-19:A1 20:C2 21-25:B2`
- k=25: 未発見のまま = `1-11:A1 12:C2 13-24:A1 25:C2`／`false` で発見 = `1-11:A1 12:C2 13-24:A1 25:C2`／`true` で発見 = `1-11:A1 12:C2 13-24:A1 25:C2`

- `true` で発見した後に pool に残る 1 件は candidate ではなく **ladder の key recipe**（直前 step の key recipe が未発見のまま、次 step の key recipe が出る）。k=25 は ladder の終端なので先行の効果が現れない（`true` でも `false` でも同じ）。
- `true` で発見した場合の pool が `B2` のまま続くのは、**買い物と発見のペース** の仮定（entitled な材料を毎回すぐ買う）による。購入を遅らせれば pool は小さく見える（購入前窓。§5 注意 1）。
- `false` は「発見すれば元の一本道に戻る」、`true` は「発見しても分岐が戻らず、ladder が 1 step 先行する」。どちらを採るかは **未決定**。

## 7. STEP 7 — Design options（最終案は選ばない。No.28 candidate も決めない）

| | Option A: 一本道を維持 | Option B: 一部の step だけ C 型を増やす | Option C: 複数の過去 step へ既存材料 recipe を追加 |
|---|---|---|---|
| 内容 | 追加なし。calabresa 依存の B（13–25）と step 12 の C のみ | candidate を 1〜少数、特定の step k に置く | 複数の k（過去 step）に分散して置く（同 step に重ねる案も含む） |
| C step | {12} のみ（1/25） | {12} ∪ {k…}（追加ごとに +1、k=12 は件数増のみ） | 追加位置の数だけ増える（例: 3,9,15,21 → {3,9,12,15,21}） |
| D（calabresa 発見済み）の複数候補 step | 1（step 12） | candidate 未発見の間 k〜25、発見すれば k と 12 だけ（`false`）| 追加位置ごとに連なる |
| A のまま残る step | 1–11, 13–25（D） | 追加位置次第 | 少ない |
| 既存材料 candidate の充足 | 不要 | 35 件中、位置が合う件数は §3.1 の表（k=6:4, 7:2, 8:1, 11:1, 12:8, 13:1, 14:3, 15:2, 20:2, 21:1, 23:2, 24:1, 25:1。k=0:6） | 同左を複数組み合わせる。1–5・9–10・16–19・22 に置ける candidate は現在 0 |
| ladder / schema | 変更なし | **変更なし**（既存材料のみなら append-only で step は増えない。`discoveryLadder.appendOnly.test.ts` が `SYN_ALL_W1`（= aussie の材料集合）で pin 済み） | 同左 |
| `ladderCredit` | — | false / true は §6 の差（未決定） | 同左。`true` を複数積むと先行が累積（credited 1 件につき +1 step ぶん） |
| 注意（事実） | 単一経路の step 数は増えない | k=0 は開始 pool が 2 件になり onboarding に影響。no-sauce 行は engine 経路が未実証 | Dex 章の総数（第1〜3章）・hint の経済・テスト fixture が複数箇所で変わる |

3 案とも **採用していない**。どの k に何件置くか・`ladderCredit`・Lunch Rush 参加・identity 衝突（`SAME_SET_AS_PRODUCTION` / naming cluster）の扱いは Owner 判断。

## 8. 未決定 / 本書がしなかったこと

- No.28 candidate の選定、ranking、推奨、スコアリング。
- `ladderCredit` / `lunchRush` の決定、Hint / Notebook 新仕様、recipe・ingredient・ladder の変更、PR / Issue。
- 172 母集団の再監査（既存 readiness を再利用。ただし readiness JSON は main 未取り込みの branch 上にある）。
- full Vitest / E2E / WebKit / build / Codex review / Human Verification / screenshots / Preview（docs/audit task のため不要と指示された）。

**STOP:** 上記 7 項目を報告したので停止する。R6 / IP-2 へは進まない。

