# Recipe Discovery 3.0 — Fresh Audit

- **種別:** 設計監査のみ（docs / data / tools）。`src/**` の変更ゼロ。PR なし・merge なし。
- **Audited main SHA:** `5c8190ff8e0e094baab6e563e06e1a11c16c4a57`（`origin/main`、2026-10-01 02:57:43 +0900、PR #275 merge）。この SHA を fetch し直して確認した。
- **作業ブランチ:** `claude/recipe-discovery-3-audit-t823yu`（main と同一 SHA から開始。追加物は本レポート・`tools/discovery3_fresh_audit.py`・`docs/reports/data/TETO_DISCOVERY-3_FRESH-AUDIT_DATA.json` のみ）。
- **Human Verification Policy:** 非該当（UI / UX / gameplay を変更しない）。スクリーンショット・動画なし。
- **再現:** `python3 tools/discovery3_fresh_audit.py`（要 `numpy`、約 3 分、固定 seed）。数値はすべて production の `src/data/*.ts` と 172 行 matrix をテキストとして読み、そこから計算した。手書きの数値は無い。

## 0. Fresh Gate

| 項目 | 結果 |
|---|---|
| `origin/main` | `5c8190f`（上記）。ローカル HEAD = `origin/main`。working tree clean（`git status` 差分 0）。 |
| 設計用ブランチ | `origin/claude/recipe-discovery-3-audit-t823yu` は main と同一 SHA。Discovery 3.0 専用の既存 branch / PR / Issue は無い。 |
| open PR（22 件）のうち関連 | #296（172 Taxonomy/HCG authority pack, docs）・#293（Hint 5.0 taxonomy coverage audit, docs）・#295（Post-W1 Cooking Steps 設計 + CS-1a）・#272（Large Catalog 旧実装、porting source として凍結）・#319（LC-R6-b Preview 活用基盤）・#255（DH4 172 taxonomy audit）。**どれも main の authority ではない**（未 merge）。 |
| open Issue（30 件）のうち関連 | #292 Hint 5.0、#294 Post-W1 Cooking Steps、#253 Hint 4.0、#238 Hint 3.0、#216/#182 Progression 2.0、#320 構成失敗の CUT 省略。 |
| Hint 5.0 | **production ON**（`HINT5_LADDER_PRODUCTION_DEFAULT = true`、H5-6 = PR #300）。SAUCE / CHEESE / KEY_TOPPING 各 10、STRUCTURE 5、SUB_CLASS 各 5 Pitz。SAUCE rung は RESERVED（無ソース = Technique `no-sauce`、TQ-1D）。 |
| Hint 3.0 / 4.0 | 3.0 の選択式・Rule W は Hint 5.0 が置き換え済み。DH4 の 構成 / 特徴 は production 5/5 Pitz（#290）だが、Hint 5.0 flag ON で「材料 / 構成 / 特徴」購入は RETIRE。 |
| Near-miss（P2） | production 稼働。`SAUCE_ONLY / ADD_ONE / REMOVE_ONE / CLOSE / FAR` を FREE Cooking の ORIGINAL に **0 Pitz** で表示（`src/state/resultNearMiss.ts`）。 |
| Trial Notebook | P1（fingerprint）・P3-1（純モデル）・P3-3a（state 配線 #316）・P3-3b（RESULT の重複通知 #317）まで main。**Notebook の一覧 UI（P3-3c）・Dex 導線（P3-4）・永続化（P3-2）は未着手。** session-only。 |
| Dex | `DISCOVERABLE` の枠は「？？？」カード + 「💡 ヒントを見る」（Dex カードが hint target を pin）。 |
| matcher | `matchDiscovery`: **材料集合 + sauceBase の完全一致**、ingredients-only fallback なし、量は identity ではない（Issue #215 OD-5）。0/1/多 = ORIGINAL / UNIQUE / AMBIGUOUS。 |
| Discovery Ladder | LAD-1（#268）で W1 の 24 step を **凍結**、追加は末尾のみ。step `s` は **Dex 発見数 ≥ s** で到達（★は無関係、OD-REC04-1）。`POST_W1_APPENDED_STEPS` は空。 |
| material entitlement / Shop | ladder が entitlement を与え、Shop が販売。1 パック = 10 プレイ = `10 × k` 在庫、価格 T1 60 / T2 80 / T3 100 / T4 120 Pitz（`materialShop.ts`）。entitled でも未購入なら `KNOWN_BUT_MISSING_MATERIAL`。 |
| Large Catalog | LC-R3（#305）pantry 殻、LC-R5-b（#310）検索が main。hand / pin / #197 は休眠実装（flag false、R5-c〜e-h）。**capacity 9 vs 12 は未決**（R6 Human Feel で決める）。 |
| Cooking Steps / Technique | `cookingProfiles.ts` は材料カテゴリから step を導出（sauce / cheese が無いレシピはその step を省く）。CUT は 25 中 24 レシピが対象（`new-haven-apizza` だけ生地の evidence が無く対象外）。Technique は TQ-1A/1B/1C が main、**production レシピで technique を要求するものは 0（TQ-1C は inert）**。TQ-1D（Aussie）は未着手。post-bake / multi-spread / late-add は main に実装なし（#295 は open）。 |
| production recipes | 25（W1 の 15 + 10）。sauce は tomato-sauce 17 / olive-oil 4 / pesto 4。 |
| ingredient taxonomy | `ingredientTaxonomy.ts` = topping 22 個に 7 family。runtime 材料は 29（starter 3 + 26）。`ingredient_master_catalog.json` は 62 材料（category は sauce 10 / cheese 10 / topping 42）。 |
| 172 authority | main に `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行）と `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` がある。taxonomy/HCG authority pack（#296）は未 merge。 |

**古い設計書の扱い:** `PROJECT_HANDOFF.md` の前半は 15 レシピ時代の記述を含む。数値・挙動は production code とこの SHA の fetch 結果を優先した。`trialNotebook.ts` の冒頭コメントは「production から import されない」のままだが、現在は `gameReducer.ts` / `trialRecord.ts` が import している（ゲートテストの allowlist はそれを反映済み。コメントだけが古い）。

## 1. 現行 25 レシピの Discovery 構造（実データから再計算）

前提: starter = `tomato-sauce / mozzarella / basil`。発見数が `s` に達すると step `s` の食材が entitlement になる。「発見数 = s」のとき、プレイヤーは margherita + step 1..s-1 の key recipe を発見済みと置く（標準経路）。ladder は `W1_25_DISCOVERY_LADDER`（24 step）を `discoveryLadder.ts` から読んだ。

| step | 新しく解放される食材 | 直前までの食材数 | step後に新しく makeable | 新規 | 既に makeable だった未発見 | 未発見の探索可能 (pool) |
|---:|---|---:|---|---:|---:|---:|
| 0 | (starter) basil, mozzarella, tomato-sauce | 0 | margherita | 1 | 0 | 0 (margherita = Dex-0 onboarding) |
| 1 | egg | 3 | bismarck | 1 | 0 | 1 |
| 2 | bacon | 4 | breakfast-pizza | 1 | 0 | 1 |
| 3 | mushroom | 5 | funghi | 1 | 0 | 1 |
| 4 | eggplant | 6 | melanzane-pizza | 1 | 0 | 1 |
| 5 | parmigiano | 7 | parmigiana-pizza | 1 | 0 | 1 |
| 6 | pepperoni | 8 | pepperoni | 1 | 0 | 1 |
| 7 | sausage | 9 | salsiccia | 1 | 0 | 1 |
| 8 | ham | 10 | meat-lovers | 1 | 0 | 1 |
| 9 | corn | 11 | bambino | 1 | 0 | 1 |
| 10 | pineapple | 12 | hawaiian | 1 | 0 | 1 |
| 11 | black-olive, oregano | 13 | capricciosa | 1 | 0 | 1 |
| 12 | onion | 15 | pizza-portuguesa | 1 | 0 | 1 |
| 13 | olive-oil | 16 | fugazza | 1 | 0 | 1 |
| 14 | garlic | 17 | marinara | 1 | 0 | 1 |
| 15 | anchovy | 18 | napoletana | 1 | 0 | 1 |
| 16 | tuna | 19 | tonno-e-cipolla | 1 | 0 | 1 |
| 17 | pesto | 20 | pesto-tonno | 1 | 0 | 1 |
| 18 | cherry-tomato | 21 | genovese | 1 | 0 | 1 |
| 19 | clam | 22 | new-haven-apizza | 1 | 0 | 1 |
| 20 | fresh-tomato | 23 | pesto-caprese | 1 | 0 | 1 |
| 21 | potato | 24 | pesto-patate | 1 | 0 | 1 |
| 22 | rosemary | 25 | pizza-bianca | 1 | 0 | 1 |
| 23 | capers | 26 | puttanesca-pizza | 1 | 0 | 1 |
| 24 | fontina, gorgonzola | 27 | quattro-formaggi | 1 | 0 | 1 |

**結論:**

- 24 step **すべて** 「新規 1 / 既存の未発見 0 / pool 1」。`steps_with_new_count = {1: 24}`、`max_pool = 1`。
- 「1 つの食材解放で複数の未知レシピが同時に新しく makeable になる」ケースは、現行 25 レシピには **存在しない**。
- pool が常に 1 になるのは標準経路に限らない。発見したレシピはすべて makeable なので、step `s` 解放後の makeable は `s + 1`、発見は `s`、未発見は必ず `1`（鳩ノ巣）。どの順に発見しても同じ。

### 一本道の理由（データ構造から）

1. **ladder の生成規則が一本道を作る。** REC-04 の key-recipe rule は「まだ makeable でないレシピを最低 1 つ完成させる最小の食材集合」を各 step に置く。makeable が step ごとにちょうど 1 増える。
2. **データ側にも分岐が無い（網羅検証）。** 「食材 1 つずつ解放」の ladder を全探索した（`single_step_feasibility`）。softlock 規則（step k の前に k 個以上 makeable）を満たす遷移は 262 通りで、そのすべてが新規ちょうど 1。実行可能な連鎖は 10 個目で途切れ、26 食材すべてを 1 個ずつ解放する ladder はそもそも存在しない（実 ladder も 2 食材 step を 2 つ使う: black-olive + oregano、fontina + gorgonzola）。
3. **`validateLadderProgression` が空振り step を禁じる。** `SOFTLOCK` = step `s` の前に makeable が `s` 未満、`KEY_RECIPE` = 新規完成が無い step。
4. **count 駆動の entitlement。** 「どのレシピを発見したか」ではなく「何個発見したか」で解放されるため、余分なレシピは ladder を **早く進める**（§2 と §8 で再び出る）。

## 2. Branching Discovery の設計

「1 discovery → 材料解放 → 未知 2〜4 レシピ」を仮に **tuning 候補**（固定仕様ではない）として分析した。

### 2.1 既存 25 レシピだけで枝分かれを作れるか

| 方法 | 結果 |
|---|---|
| 食材 1 個ずつの step（今の形）のまま並べ替え | **不可**。上記の全探索で 262 遷移すべて新規 1。ham は 5 レシピで使われる hub だが、他の食材が揃うまで待てない（softlock）。 |
| 2 食材まとめ（パッケージ）step を許す | **可**。`branching_ladder_example_25_recipes`（seed 付き山登り、説明用）: 19 step、うち **12 step が 2 レシピ同時**、pool は 1〜6。ただし **空振り step が 7 つ**（解放しても新規 0）。「材料を買ったのに何も増えない」step が必要になる。 |
| 解放パッケージが開ける数（starter 状態、≤3 食材） | 2 レシピ以上を開けるパッケージは 315 通り。すべて **独立した 1 食材レシピの束**（egg + mushroom = bismarck と funghi）。hub ではなく bundle。 |

つまり 25 レシピの食材グラフは **疎** で、自然な hub による分岐は作れず、作れるのは束ね分岐だけ。しかも W1 の 24 step は LAD-1 で凍結されている。束ね分岐は凍結 ladder の差し替えを意味する。

### 2.2 hub になる食材

`hub_ranking`（使用レシピ数、starter を除く）: **ham 5**（bambino / capricciosa / hawaiian / meat-lovers / portuguesa）、black-olive / olive-oil / onion / oregano / pesto 各 4、bacon / egg / garlic / parmigiano 各 3。ham・onion・black-olive は既に複数レシピが待っているが、**最後に欠ける食材が別々**なので同時には開かない。

部分集合の関係にあるレシピ対（`subset_recipe_pairs`、これが「兄弟」分岐の種）: margherita ⊂ melanzane（+eggplant）、bismarck ⊂ breakfast（+bacon）、melanzane ⊂ parmigiana（+parmigiano）、funghi ⊂ capricciosa、salsiccia/pepperoni ⊂ meat-lovers など 8 対。現行 ladder は両方を別 step に置くため、同時には開かない。

### 2.3 新レシピを足すと何が起きるか（凍結 ladder のまま）

**全食材が既に ladder 内にあるレシピ（reuse-only）を足すと、ladder を触らずに分岐が生まれる。** 例: onion（step 12）が pizza-portuguesa と同時に brazilian-calabresa を開ける（§8）。

- 副作用: ladder は発見数駆動なので、余分な発見は **次の step を早める**。25 レシピ + reuse-only 3 件（brazilian-calabresa、aussie、chilean-napolitana。後 2 件はソースなしで TQ-1D が前提）の「全部発見するプレイヤー」は 17 round で 28 発見に届く（25 のみなら 25 round。`greedy_pace_*`）。経済（Pitz・在庫）への影響は Owner 判断と別シミュレーションが要る。
- ladder 差し替えが必要なのは、新食材を使うレシピ（追記 step）と、空振り step を許さない束ね分岐だけ。

### 2.4 推奨される枝分かれの作り方（候補）

1. **reuse-only の兄弟レシピを足す**（追加 step 不要、pool が自然に 2 になる）。
2. **新食材を hub にする**（例: bell-pepper + zucchini で 3 レシピ、§8）。2 段階で 1 → 2 と開くのが自然。
3. 束ね step / 空振り step は最後の手段（ladder 凍結の解除が要る）。

## 3. Hint model のゼロベース再監査

### 3.1 前提: 「近い / 遠い」と key-topping に頼らない

現行 Hint 5.0 は SAUCE → CHEESE → KEY_TOPPING → STRUCTURE → SUB_CLASS の固定線形 ladder。`hintKeyToppingId` はレシピごとの authored 値で、ゲームが「主役」を定義している。ここでは次の 2 つの世界で測った。

- **closed world（25 レシピから選ぶ）**: 候補レシピが何件残るか。
- **open world（プレイヤーの視点）**: プレイヤーは 25 件のリストを知らない。持っている食材（owned）だけで作れる **材料レベルの組合せが何通り残るか**（`room`）。sauce は「無し」も 1 通りに数える。

### 3.2 closed world: ヒント段階ごとの残り候補数（25 レシピ平均）

| 段階 | 現行 Hint 5.0 | 新案（key 無し） |
|---|---:|---:|
| Hint 0 | 25 | 25 |
| ソース（sauce/base） | 12.84 | 12.84 |
| チーズ（名前 / なし） | 8.68 | 8.68 |
| KEY_TOPPING（名前） | **1.16** | — |
| トッピング種類数 | — | 3.32 |
| STRUCTURE（総数） | 1.08 | — |
| 材料の手がかり 1（family×数） | — | 1.60 |
| 材料の手がかり 2 | — | 1.16 |
| 材料の手がかり 3 以降 | 1.00 | 1.08 |
| 最終 | 25/25 が一意 | 23/25 が一意（salsiccia と pepperoni が残る: 同じソース・チーズ・種類数・meat×1） |

現行 ladder は **KEY_TOPPING を名指しした時点で closed world ではほぼ答え**になる（平均 1.16）。key を置かない新案は同じ情報量に届くまでに family の手がかり 2 段が要る。

### 3.3 open world: 「全部開けると答えそのもの」か「推理の余地が残る」か

各レシピが **自分の key step の時点の owned 集合**でヒントを全部開いた後に残る材料レベルの組合せ数（`open_world_profile_room_at_key_step`）:

| ヒント構成 | 残り組合せ 最小 / 中央値 / p90 / 最大 | 答えそのもの（残り = 1）| 残り ≤ 4 |
|---|---|---:|---:|
| ヒント無し | 8 / 65,536 / 16,777,216 / 268,435,456 | 0 | 0 |
| sauce + cheese + 種類数 | 1 / 45 / 495 / 7,315 | 2 | 5 |
| **構造のみ（種類数 + family 構成、sauce/cheese は名指ししない）** | 4 / 64 / 336 / 1,536 | 0 | 4 |
| **sauce + cheese + 種類数 + family 構成（新案 P-B）** | 1 / 4 / 32 / 96 | **6** | 14 |
| P-B + key-topping を名指し（= 現行 Hint 5.0 の全 rung） | 1 / 2 / 10 / 32 | **12**（25 中 48%）| 20 |

- **現行 Hint 5.0 は全 rung を買うと 25 件中 12 件で「答えそのもの」**になる（margherita, bismarck, funghi, breakfast, meat-lovers, melanzane, parmigiana, pepperoni, salsiccia, pizza-bianca, genovese, quattro-formaggi）。
- key を外した P-B は 6 件（margherita, bismarck, funghi, breakfast, meat-lovers, quattro-formaggi）。
- 「答えそのもの」になる原因は 2 種類ある。(a) 序盤は owned が少なくて代替が無い（margherita は owned 3 で組合せ 4 通り）。(b) family が飽和する（meat-lovers は owned の肉 4 種すべてを使うため meat×4 で 1 通り）。step の早さだけでは決まらない。
- 最大は puttanesca の 96 通り（step 23、owned 27）。全部開けても 2 桁の推理が残る。

**区別の提案（指標）:** 「全ヒント後の残り組合せ R」を測る。R = 1 を *giveaway*、R ≥ 2 を *deduction remains* と呼ぶ。序盤チュートリアル帯（step 0〜5 程度）を除き R ≥ 2 を gate にする案が考えられる（Owner 判断、§12）。

### 3.4 候補ヒント要素の評価

| 要素 | 情報量・性質 | 所見 |
|---|---|---|
| sauce / base | 名指しで 25 → 約 13（tomato 17 / olive-oil 4 / pesto 4） | 単独ではゆるい。multi-spread 時は「2 層」の扱いが要る。 |
| cheese | 名指しで約 13 → 約 9。`none` は 5/25（2.32 bit）と強い | 「なし」は名指しより圧倒的に強い情報。価格が同じなら「なし」は割安。 |
| トッピング種類数 | 約 9 → 3.3。最も効く **構造ヒント** | 単独で giveaway にならない。 |
| family 構成（肉×1 野菜×1 …） | 3.3 → 1.6 → 1.2。open world では残り中央値 4 | 既存 7 family（`ingredientTaxonomy.ts`）がそのまま使える。**新 taxonomy 不要**。family 名に食材名を含めない、絵文字が食材絵文字と被らない制約（H5-INV-2）は維持できる。 |
| technique（無ソース等） | production 0 件。172 行では 30〜44 行 | 名指しは H5-INV-4 が禁止。ヒントとしては「レシピに technique がある」自体が漏洩。TQ-1D まで扱わない。 |

### 3.5 ヒントの見せ方（構造の提案）

固定線形 ladder（SAUCE → CHEESE → KEY → STRUCTURE → SUB）は、ヒントを **fact の集合**として扱う案（メニュー式）と比べて次の差がある。

| | 線形 ladder（現行） | fact メニュー |
|---|---|---|
| 購入前の漏洩 | 全ターゲット同一表示（FREE LEAK 無し） | スロットを全レシピ同一にすれば同じ |
| 戦略性 | なし（順番固定） | プレイヤーが買う fact 種別を選ぶ |
| 存在しない要素 | 「なし」を有料回答（P4-CHEESE / P4b） | スロットの中身が「なし」になる |
| 新要素（multi-spread 等）の追加 | rung を増やす（順番も決める） | スロットを足すだけ |

どちらが良いかは Owner 判断（§12）。ここでは、ladder の段数・順番をスキーマにすると 172 規模の拡張で破綻しやすい、という点だけを所見にする。

## 4. Sauce / Cheese を固定前提にしない — 母集団の実数

| 母集団 | 件数 | sauceなし | cheeseなし | toppingなし | multi-spread（2 層以上） | late-add | 備考 |
|---|---:|---:|---:|---:|---:|---:|---|
| production 25 | 25 | **0**（無ソースは Technique `no-sauce`、TQ-1D 予約） | 5（fugazza, marinara, pesto-tonno, pizza-bianca, puttanesca） | 1（quattro-formaggi） | 0 | 0 | チーズ複数 2（parmigiana, quattro）。sauce は tomato 17 / olive-oil 4 / pesto 4 |
| 172 行 matrix（全件） | 172 | `sauceBase.status = none` **44**（25.6%）。うちオイル等の層あり 14、**層ゼロ 30**（17.4%） | 31（18.0%） | 5 | **26**（2 層 25 + 3 層 1） | 必須 12 / 候補込み 23 | sauce 未特定 33 行。ソースなし かつ チーズなし 3 |
| ingredient 確定 120 行 | 120 | none 41（層ゼロ 29） | 16 | 3 | 13 | 必須 6 / 候補込み 15 | |
| 決定可能（READY 系）86 行 | 86 | none 26（層ゼロ 22） | 11 | 2 | 9 | 必須 3 / 候補込み 4 | |

- 区分の根拠: sauce 系 id は matrix の `spreadLayerIngredientIds` と master の sauce、cheese は master の cheese と名前で判定した。62 材料の master に無い id（約 117 個）は名前判定であり、`incomplete`（材料未確定）の 52 行は分母の不確かさが大きい。全件の数字は目安。
- **ソースなしは例外ではない**（172 行の 18〜26%）。固定 6 段階（sauce → cheese → …）をスキーマにしてはならない。

### 「存在しない要素」をヒントでどう扱うか

| 方式 | 漏洩 | 所見 |
|---|---|---|
| 「なし」を有料の回答として出す（Hint 5.0 の P4-CHEESE / P4b） | cheese なし = 2.32 bit、topping なし = 4.64 bit。名指し（mozzarella = 0.40 bit）より圧倒的に強い | 購入前は全レシピ同一の見た目を保てる。価格が同じだと「なし」が割安になる。 |
| その rung / スロットを省略する | 省略された事実そのものが漏洩（購入前に見えれば破綻） | FREE LEAK 違反。購入後にだけ省くなら、画面の項目数が答えになる。 |
| 無償で「なし」を先に見せる | cheese なし 2.32 bit を無料で渡す | 避ける。 |
| 情報量に応じて価格を変える | — | 「なし」= 高価にする案。価格設計は別途。 |

無ソースは Technique `no-sauce` と直結するため、P4-SAUCE は TQ-1D まで予約（H5-INV-4）のままで矛盾しない。

## 5. Trial Notebook の役割

### 5.1 現状（main）

- `src/logic/discovery/trialNotebook.ts`（純）+ `src/state/trialRecord.ts`（adapter）。**session-only**、save には入らない。
- 1 行 = `{ #n, retryCount, combination{sauceBase, ingredientSet}, feedback{kind: string, textJa} | null }`。表示履歴 50 件 / identity 索引 2,000 件。
- 記録対象は FREE の **ORIGINAL と AMBIGUOUS だけ**（INCOMPLETE_MATCH / FAILED / NEW / KNOWN は記録しない）。
- 画面に出ているのは RESULT の重複通知「📓 前にも同じ材料の組み合わせで作ったよ（試作#n）」だけ。**一覧 UI（P3-3c）は無い**ので、プレイヤーは実験ノートとしてはまだ使えない。
- 保存しないもの: 使用量・焼き・ソース量・technique・hint・試作時点のゲームの事実。identity は `sauceBase + ingredientSet` のみで、量は identity ではない（matcher と一致）。

### 5.2 「次の試作を考える実験ノート」にできるか

**できる。ただし増やすのは player 自身のデータから導く派生表示だけにする。** 案:

| 案 | 内容 | 漏洩 |
|---|---|---|
| N1 | 試作の差分（前回比「＋チーズ / −ベーコン」）。2 つの fingerprint だけから計算 | なし（player 自身の操作の差） |
| N2 | **ヒント整合表示**: 試作 × 所有済みヒントの照合（「種類数 3 のヒントに対し 4 種で作った」）。所有済み fact と試作だけの関数 | なし（すでに持っている情報） |
| N3 | 使った材料の family 構成を並べる（肉×1 …） | なし（自分の試作の分類） |
| N4 | 「未試作の近傍」の提示 | 探索空間のサイズを示唆しうる。要検討 |
| N5 | 使用量 | identity ではなく、discovery の推理に寄与しない。保存は任意 |

- **ノートの `feedback.kind` は `string` で、近い/遠いに依存しない。** P2 の表示を別の事実に置き換えてもノートのスキーマは変えなくてよい。
- ただし現在は P2 の「かなり近づいてるよ」等の文言を **そのまま**保存する。Owner の方針（曖昧な距離表現を保存しない）に従うなら、P2 を置き換えるか、ノートに保存する feedback を別物にする判断が要る（§12）。
- 複数の未知レシピが同時に探索可能な場合、ヒント整合（N2）は **どの target のヒントか**を選ぶ必要がある（ヒントは target ごと）。試作自体は target に依存しない。

### 5.3 「正解材料 4/5」型の一致数表示

§6 の実測どおり、総当たりを大幅に強める（§6）。ノートに保存しない以前に、そもそも出さない方向を推奨する。

## 6. Attempt Feedback — 比較と総当たり耐性

### 6.1 測り方

`feedback_sim`（`tools/discovery3_fresh_audit.py`）: 探索空間 = {ソース無し or owned の 1 種} × {owned チーズの任意部分集合} × {owned トッピング 4 個まで}。ladder の step 6 / 12 / 18 / 24 の owned で、その時点で makeable な **全レシピを 1 つずつ target にして**、ソルバーが正解の組合せを焼くまでの試行回数を数えた。ソルバーは「これまでのフィードバックすべてと矛盾しない組合せから一様に 1 つ選ぶ」中立な基準（情報量最大化ソルバーなら B / A2 はさらに速い）。上限 400 試行で打ち切り。**E は解析値**（フィードバック無しの消去法 = (N+1)/2）。

- **A** = 現行 P2（ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR）
- **A2** = 正確な距離 d
- **B** = 材料の一致数（正解材料 k / n）
- **C** = 部分一致フラグ（ソース / チーズ / トッピング集合 / family 構成 の各一致）
- **D** = 構成数の一致だけ
- **E** = ヒント + ノートのみ（1 回ごとの事実なし）

### 6.2 結果（平均試行回数。括弧内は探索空間）

step 24（owned 29、全 25 レシピが target）:

| ヒント | 空間 | E | A（現行 P2） | A2 | B | C | D |
|---|---:|---:|---:|---:|---:|---:|---:|
| ヒントなし（H0） | 582,976 | 291,489 | ≥375（上限打切り） | 11.0 | 10.8 | 131.7 | 283.3 |
| H3: sauce + cheese + 種類数 | 231 | 116.0 | 24.9 | 8.7 | 11.2 | 35.1 | 126.8 |
| H4: + family 構成 | 12 | 6.5 | 4.4 | 3.6 | 3.6 | 12.0 | 19.6 |

step 12（owned 16、13 レシピ）: H0 の空間 8,744 → A 59.4 / B 8.2 / E 4,372。H3 の空間 78 → A 7.9 / B 7.1 / C 13.6 / E 39.5。step 18・6 は `feedback_sim` 参照。

### 6.3 比較

| 方式 | 推理しやすさ | 答え漏洩 | 総当たり耐性 | 初心者の分かりやすさ | 172 規模への拡張 |
|---|---|---|---|---|---|
| A near/far（現行 P2） | 「あと 1 つ」だけ勾配が取れる。FAR は勾配なし | d=1 で 1 食材差が確定。**ADD/REMOVE の向きが exact 近傍 oracle** | 中〜弱（step 24 H3 で 25 回。H0 では打切り） | 高い（文言が自然） | 空間が増えるほど d=1 の価値が上がる |
| A2 / B 正確な距離・一致数 | 最も推理しやすい（Mastermind） | 高い | **崩壊**（空間が 58 万でも約 11 回） | 高い | 空間が増えても回数がほぼ増えない |
| C 部分一致フラグ | 「ソースは合い、トッピングが違う」と言える | 中（sauce / cheese はヒントで既知なら重複） | 中（H3 で 35 回） | 中 | family 種類が増えると安定 |
| D 構成数だけ | ほぼ手がかりにならない | 低 | H3 で E とほぼ同じ（127 回） | 高い | 変化なし |
| E ヒント + ノートのみ | ノートとヒント次第 | なし | 最強（H3 で 116 回、H4 で約 7 回） | ヒント依存 | 空間が増えても変わらない |
| F ヒント整合表示（N2）+ 上記 | 矛盾する試作を避けられる | なし | E と同等 | 高い | 良い |

**所見（まだ仕様は決めない）:**

1. **B / A2 は deduction を潰す。** 探索空間の大きさによらず約 10 回。172 規模でも同じ。採用しない方向を推奨。
2. **現行 P2 は無料で強い oracle。** ヒント無しでも d=1 の向きで食材 1 個の差分が取れる。ヒント購入（10/10/10/5/5 Pitz）の価値を食っている可能性がある。
3. **INCOMPLETE_MATCH は無料の一致 oracle になりうる（コード読みのみ、ブラウザ再現は未実施）。** 材料集合が正解で Completion Gate に落ちた場合だけ「図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。」が出る（`originalResultCopy.ts`）。ソース量が `SAUCE_MIN_RATIO` 未満で落ちるので、意図的にソースを薄く塗れば **組合せが正解かどうかを 0 Pitz で判定できる**（`completionGate.ts` の `checkSauceQuantity`、`freeCook.ts` の INCOMPLETE 分岐）。識別性は B を超える（正誤が 1 bit で確定）。これは §12 の独立した Owner 判断。
4. 最も効くのは、**試作ごとの事実ではなくヒントの質**（H3 → H4 で 116 → 6.5 回）。

## 7. Unknown Recipe Target の必要性

| 案 | 内容 | 現行との整合 | 所見 |
|---|---|---|---|
| A | 探索対象を選んでから作る | 不整合。FREE Cooking は recipe-free（`FREE_COOK_RECIPE` sentinel、`START_FREE_COOK`）で、matcher が完成品から自動判定する。target を選ぶには target 用の Completion Gate と Dinner/注文 gate（`policy: "order"`）の切り分けが要る | 選択問題化しやすい。「？？？A/B/C」の区別は名前無しの idx だけで、プレイヤーにとって意味がない |
| B | FREE で自由に作り、matcher が自動発見 | 現行そのもの。Phase 3-1 で「選択したレシピ以外の未発見レシピにも exact match すれば書き込む」が既にある | pool が 2〜4 になっても成立する |
| C | 併用 | **hint target の pin は既に存在**（Dex の「？？？」カードが `pinnedRecipeId`、自動は `recipeKeyStep` 昇順 → 種類数 → 宣言順、sticky）。つまり現行は「調理は B、ヒントの対象だけ選べる」の C-lite | 足すとしたら調理時の target 選択ではなく、ヒントとノートの「どの？？？についての話か」 |

- 現行コンテンツでは pool が常に 1 なので、target 選択は **そもそも必要がない**（§1）。
- 枝分かれ後も **B を維持し、ヒント対象の選択（Dex pin）だけを target 概念として残す**のが最も整合する。候補レシピ名を出さず、選択問題にもならない。
- ヒントは target ごと（`ing:` / `h5:` / `cls:` facts）なので、N2（整合表示）は「いま見ているヒント対象」に対してだけ計算する。

## 8. Recipe Expansion との接続 — 代表 recipe pack 案

**実装しない。** 172 行 matrix の READY / FULL の行から、検証したい性質ごとに選んだ（`pack_dv1`）。identity の衝突は pack 内・production 25 との間で 0 件。

| レシピ（matrix id） | 材料（identity set） | 性質 | 新食材 | status |
|---|---|---|---|---|
| **brazilian-calabresa**（`brazilian-calabresa-pizzadb-p10`） | tomato-sauce, sausage, onion, black-olive, oregano | **チーズなし**、種類数 4、family は capricciosa と同じ 肉1・野菜2・ハーブ1（ソース・種類数も同じで **チーズだけが違う**）。onion（step 12）で portuguesa と同時に開く | 0 | READY_WITH_REVIEW（naming cluster NC-4） |
| **aussie**（`aussie-pizzadb`） | bacon, egg, mozzarella, onion | **ソースなし**（TQ-1D の technique レシピ）、種類数 3。breakfast-pizza と材料が近い。onion で開く | 0 | READY |
| **chilean-napolitana**（`chilean-napolitana-pizzadb`） | fresh-tomato, mozzarella, oregano | **ソースなし、spread 層ゼロ**、材料 3 個。fresh-tomato（step 20）で pesto-caprese と同時に開き、family 構成が同じ（野菜1・ハーブ1）。ソースだけで区別 | 0 | READY_WITH_REVIEW（NC-1） |
| **hot-honey-pepperoni**（`hot-honey-pepperoni-pizzadb-p12`） | tomato-sauce, honey, mozzarella, pepperoni | **multi-spread**（tomato + honey）。pepperoni ⊂ これ（部分集合ペア）。late-add は候補（蜂蜜を焼成後にかける解釈を確認） | honey | READY_WITH_REVIEW、PARTIAL（MULTI_SPREAD_LAYER 必須） |
| **spanish-chorizo**（`spanish-chorizo-pizza-pizzadb-p4`） | bell-pepper, mozzarella, onion, sausage | ソースなし。**bell-pepper 1 つで開く** | bell-pepper | READY |
| **ratatouille**（`ratatouille-pizza-pizzadb-p13`） | bell-pepper, eggplant, oregano, tomato-sauce, zucchini | チーズなし、野菜×3 + ハーブ | bell-pepper, zucchini | READY |
| **pesto-vegetariana**（`pesto-vegetariana-pizzadb-p12`） | bell-pepper, eggplant, mozzarella, pesto, zucchini | 野菜×3 のみ。ratatouille と family 構成が近い（ハーブの有無） | bell-pepper, zucchini | READY |
| （任意）bbq-chicken | bbq-sauce, chicken, cilantro, mozzarella, onion | **late-add 必須**（cilantro を焼成後）。新食材 3 で重い | 3 | READY、PARTIAL |

被覆（要求）との対応:

| 要求 | 担当 |
|---|---|
| 共通食材から複数レシピへ枝分かれ | onion → portuguesa + calabresa (+ aussie)、fresh-tomato → pesto-caprese + chilean、bell-pepper → spanish-chorizo、zucchini → ratatouille + pesto-vegetariana |
| sauceなし | aussie, chilean-napolitana, spanish-chorizo |
| cheeseなし | brazilian-calabresa, ratatouille |
| ingredient category が似ている | calabresa ↔ capricciosa（family 同じ・チーズ違い）、chilean ↔ pesto-caprese（family 同じ・ソース違い）、ratatouille ↔ pesto-vegetariana |
| 材料数が違う | 3（chilean）〜 5（calabresa、ratatouille、pesto-vegetariana） |
| 将来の late-add / multi-spread | hot-honey-pepperoni（multi-spread 必須、late-add 候補）、任意で bbq-chicken |
| 新食材 | honey, bell-pepper, zucchini |
| 既存食材の再利用 | calabresa, aussie, chilean（新食材 0） |

**ヒントの検証力（closed world 32 件 = 25 + pack 7）:**

- 種類数 + family だけでは 14 件が一意（7 グループ: calabresa と capricciosa、chilean と pesto-caprese 等が重なる）。
- sauce + cheese + 種類数 では 11 件が一意（aussie と spanish-chorizo が重なる）。
- sauce + cheese + 種類数 + family では **30/32 が一意**（salsiccia と pepperoni だけ残る、既存）。

**凍結 ladder での開き方:** reuse-only の 3 件は ladder を変えずに開く。「全部発見する」プレイヤーの pool は round 13〜15 で 3、round 16 で 4。pack は 4〜7 件目のヒント・ノート検証の対象（ソースなし / チーズなし / 同 family）を与える。

**実装前の注意（事実）:**

- aussie と chilean は **ソースなし**。Hint 5.0 の SAUCE rung は予約済み、`deductionProduction.gate.test.ts` は TQ-1D で意図的に落ちる契約。ソースなしを出すなら TQ-1D が先。
- 各レシピは `RECIPE_HINT_ROLES`（`Record<RecipeId, …>` なので型エラーで気づく）、`getReferencePizza` 参照、`RECIPE_DISCOVERY_TARGET_IDS`、`RECIPE_SAUCE_PROFILES` が要る。key topping を置かない新ヒント案なら `RECIPE_HINT_ROLES` は不要になる。
- multi-spread / late-add は main に機構が無い（#295 open）。hot-honey は機構の後。

## 9. 最終成果物の対応（要求 1〜13）

| # | 要求 | 位置 |
|---|---|---|
| 1 | audited main SHA | 冒頭 |
| 2 | 現行 25 の Discovery 構造 | §1 |
| 3 | 各 unlock で新しく makeable になる数 | §1 の表（全 step 1） |
| 4 | 一本道の箇所 | §1（24 step すべて） |
| 5 | Branching 候補 | §2 |
| 6 | Hint 候補と候補削減 | §3 |
| 7 | no-sauce / no-cheese / special-step | §4 |
| 8 | Trial Notebook 案 | §5 |
| 9 | Attempt Feedback 比較 | §6 |
| 10 | Unknown Target A/B/C | §7 |
| 11 | Recipe Expansion 接続 | §8 |
| 12 | 未決 Owner Decisions | §10 |
| 13 | 最小実装スライス順 | §11 |

## 10. 未決 Owner Decisions

| ID | 決めること | 推奨（仮） |
|---|---|---|
| OD-D3-1 | Hint の構造: 固定線形 ladder を続けるか、fact メニュー（スロット集合）にするか | メニュー。拡張（multi-spread 等）でスキーマを変えなくて済む |
| OD-D3-2 | key-topping の廃止（Hint 5.0 の KEY_TOPPING rung を外すか） | 廃止。全 rung で 25 中 12 が giveaway |
| OD-D3-3 | giveaway の扱い: 全ヒント後の残り R ≥ 2 を gate にするか。チュートリアル帯の範囲 | R ≥ 2、帯は step 0〜5 |
| OD-D3-4 | 「なし」の情報価格: 名指しと同額か | 要シミュレーション。同額だと割安 |
| OD-D3-5 | ladder 方針: W1 凍結のまま reuse-only で分岐するか、束ね step / 空振り step で新 ladder にするか。余分な発見が ladder を早めることの可否 | 凍結のまま reuse-only |
| OD-D3-6 | pool の目標（2〜4 は tuning 候補。上限・空振り step の可否） | 2〜3 から |
| OD-D3-7 | 試作フィードバック: P2 near/far を残すか、置き換えるか（A / C / E / F）。B / A2 は不採用 | E + F（整合表示）を基準に、C を補助の候補 |
| OD-D3-8 | INCOMPLETE_MATCH の文言・条件（一致 oracle の封じ方） | 文言を中立にする or 記録を無くす方向で別判断 |
| OD-D3-9 | Notebook: 一覧 UI（P3-3c）の場所、永続化（session-only のまま / save）、N1〜N5 のうち何を出すか、P2 文言の保存をやめるか | N1 + N2。永続化は後 |
| OD-D3-10 | Unknown Target: B（自由に作る）+ hint 対象の pin で確定するか | B + pin |
| OD-D3-11 | pack DV-1 の採否。新食材 honey / bell-pepper / zucchini の追加。naming cluster（NC-1 / NC-4）の review。hot-honey の late-add 解釈 | 採用（reuse-only 3 件から） |
| OD-D3-12 | Technique 手がかり: TQ-1D（no-sauce）の時期。ソースなしレシピを pack に入れる時期 | TQ-1D の後 |
| OD-D3-13 | Large Catalog の hand capacity（9 / 12）。FREE の見える探索空間を縮めるので、フィードバックの強さの判断に影響する | R6 Human Feel の結果を待つ |
| OD-D3-14 | ヒント価格（10/10/10/5/5）の再設計。ヒントの質が総当たり耐性を支配する（§6） | OD-D3-1 の後 |

## 11. 推奨する最小実装スライス順

最後に、次のループを成立させるために最小限必要なもの:

> 新レシピを 1 つ発見 → 新しい探索可能性が開く → 複数の未知レシピを試作 → Hint / Notebook から推理 → 新レシピ発見

| 必要なもの | 現状 | 最小の足し方 |
|---|---|---|
| 1. 分岐する content（pool ≥ 2） | **無い**（pool は常に 1） | **reuse-only レシピを 1 件（brazilian-calabresa）**。新食材 0、ladder step 追加 0。onion（step 12）で portuguesa と同時に開く。ソースは tomato、チーズなしで portuguesa と対比できる |
| 2. 未知レシピごとに違う手がかり | ヒントは per-target（Dex pin）。複数 target 状態は未検証 | 新レシピ用の hint 役割データ（key 廃止案なら不要）と、2 target 状態の E2E |
| 3. 試作を見返す | Notebook は記録のみ、一覧 UI なし | P3-3c（一覧）。session-only でよい |
| 4. 推理を助ける | P2 near/far（強い oracle）のみ | 最小は現行のまま。OD-D3-7 / OD-D3-8 の決定後に置き換え |
| 5. 発見が次につながる | 発見 → 材料解放は稼働（count 駆動） | 追加不要。ただし余分な発見は ladder を早めるので pace を測る |

**スライス順（推奨）:**

1. **S0 — Owner 決定（docs）:** OD-D3-1〜3、5〜8、10 を先に。ここが決まるまで実装を分岐させない。
2. **S1 — 計測ゲート（テスト・tools）:** ladder の pool 表、全ヒント後の残り R、近傍 oracle、INCOMPLETE_MATCH の probe を CI に固定。本 audit の数値が回帰しないようにする。
3. **S2 — 最小分岐 content（data）:** brazilian-calabresa を追加（Reference fixture、hint / discovery catalog、Dex）。pool = 2 のテストを足す。**Recipe Expansion の 1 slice。**
4. **S3 — feedback の穴を塞ぐ:** INCOMPLETE_MATCH の oracle（OD-D3-8）。
5. **S4 — Notebook 一覧（P3-3c）と N1 / N2。**
6. **S5 — Hint v6（メニュー式・key 無し）の純ロジックを flag 裏に。**
7. **S6 — 2 つ目の分岐（新食材 hub: bell-pepper → zucchini）と、TQ-1D 後にソースなし（aussie / chilean）。**

S0〜S2 だけで、上のループの最初の完全な 1 周（2 つの未知レシピが開く → 試作 → ヒントとノート → 発見）を production で検証できる。

## 付録: 計測の限界

- `feedback_sim` のソルバーは一様ランダムの中立基準。情報量最大化の戦略ならフィードバックありの方式はさらに速い。上限 400 で打ち切った値（A の H0 など）は下限。
- 探索空間は「owned トッピング 4 個まで」「ソース 1 種か無し」。実プレイの試作には時間と在庫（1 パック = 10 プレイ分）の制約があり、これが総当たりの別の歯止めになる。この audit では Pitz・時間のコストは測っていない。
- 172 行の census は材料未確定の 52 行を含む。cheese / sauce の分類は master 62 材料 + 名前判定。
- Hint の closed world は 25（または 32）レシピ固定。open world はプレイヤーが持っている食材だけを数えている。
- 全ヒント後の「残り R」は、各レシピの **自分の key step** の owned 集合で測った。後の step ほど owned が増え、R は大きくなる。
- INCOMPLETE_MATCH の oracle はコードの経路読み（`freeCook.ts` / `completionGate.ts` / `originalResultCopy.ts`）で、実機再現は行っていない。
