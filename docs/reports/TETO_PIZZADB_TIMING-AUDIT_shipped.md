# PIZZA DB 個別ページ工程監査 — 出荷済みレシピ（docs-only）

作成: 2026-10-21 / 基準 main `78a4a0f` / 追跡: Issue #611（FIN-E4）、#527
機械可読版: `docs/reports/data/TETO_PIZZADB_TIMING-AUDIT_shipped.json`（監査者が追記する欄つき）

## 1. 何を、なぜ

172 レシピ工程マトリクス（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）の行は、大半が **比較表（`comparison_table_sample`）だけ**を根拠に分類されている。比較表には材料の一覧はあるが、各材料を載せる**時機**（焼成前／焼成後）は載っていない。このため `postBakeFinish`（後乗せ）を取りこぼした行があり得る。

実例: `ikura-salmon-pizza-pizzadb-p1` は比較表だけで「現行フローで表現可能（FULL）」と分類されたが、個別ページ（https://pizzadb.jp/pizzas/ikura-salmon/）には「サーモンは十分に加熱し、いくらと大葉は焼成後に載せる」とある（Owner 確認 2026-10-21）。

## 2. 訂正した行（1 件）

| 行 | 訂正前 | 訂正後 | 根拠 |
|---|---|---|---|
| `ikura-salmon-pizza-pizzadb-p1` | `postBakeFinish: []` / FULL / `requiredCapabilities: []` | `postBakeFinish: [post_bake: salmon-roe, shiso]`（`source_profile_text`）/ PARTIAL / `LATE_ADDITION` 必要 | 個別ページ（Owner 確認 2026-10-21）。サーモンは加熱（後乗せではない）、クリームチーズの時機は記載なし |

訂正は `tools/progression2_mechanic_matrix.py` の `ROW_MECHANIC_EVIDENCE` に 1 エントリ追加し、生成物（`TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md` / candidate matrix JSON）を再生成した。`--check` と `--check-runtime` は通る。集計の変化: FULL 101→100、PARTIAL 55→56、`LATE_ADDITION` 必要行 12→13（単独で解禁される行 9→10、`post_bake` モード 8→9）、能力不要の基準行 106→105。LATE_ADDITION までの累計到達行数（151）は不変。

### 下流の生成物（再生成した）
candidate matrix を入力にする生成物が ikura の変更で古くなるため、各ツールで再生成した（`--check` はいずれも通る）。
- `tools/progression2_phase2_progression.py` → `TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` / `TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md`（`LATE_ADDITION` を要する行が 1 つ増えたため、**設計候補**の解禁順の並びが入れ替わる。本番 ladder ではない）。
- `tools/progression2_phase34_unlocks.py` → `TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json`。同ツールの `TETO_PROGRESSION2_PHASE34_UNLOCKS.md` は **main の時点で既に再生成と不一致**（手書きの「Superseded」注記が生成物に無い）。再生成すると注記が消えるため、この md には ikura 由来の 2 箇所（`LATE_ADDITION` の再利用 3→4、入力 SHA-256）だけを手で反映した。md の既存の不一致は本 PR では直していない（`--check` はこの md で引き続き不一致）。
- `tools/dh4_2_topping_count_audit.py` → `TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json`。
- `tools/rt01_reference_capacity_design.py` → `TETO_RT01_REFERENCE_PIECE_CAPACITY_DESIGN.json`。同ツールの `TETO_RT01_PLACEMENT_COMPARISON.html` は main の時点で既に古い（authored 行数などが現状と不一致）ため、再生成せず据え置いた。

### 注記: 手書きの `TETO_RECIPE_172_MECHANIC-MATRIX.md`
この文書の表（能力ごとの「Rows required」「Unlocked alone」、実装順の累計）は手書きで、生成物ではない。上記の変化を反映していない（例: `LATE_ADDITION` は **12 → 13**、`Unlocked alone` は **9 → 10**）。数値の手書き更新は誤りの元なので、本 PR では**この注記だけ**を置き、表は触らない。正の数値は candidate matrix JSON の `capabilityStats` を参照。

## 3. 監査の範囲と現状（推測で訂正しない）

| 区分 | 件数 | 状態 |
|---|---|---|
| main の出荷済み 61 レシピ | 61 | — |
| うち 172 行の対応あり | 46 | 以下の表 |
| └ 比較表由来（`comparison_table_sample`） | 44 | **要確認**（うち `shirasu-pizza` は #587 に部分証跡あり） |
| └ 個別ページ由来（`individual_profile_page`: `hawaiian`, `pizza-bianca-ricotta`） | 2 | 個別ページ由来のため本監査では再確認せず（後乗せ記述の有無は未走査） |
| 172 行の対応なし（原型 14 + `brazilian-calabresa`） | 15 | 範囲外（PIZZA DB 行が無い） |
| `ikura-salmon-pizza`（#584、HOLD、main 未出荷） | 1 | 上記のとおり訂正済み |

> 数の訂正: 前回の報告で「出荷済み 47 件中 45 件が比較表由来」と述べたが、その集計には #584 ブランチの `ikura-salmon-pizza`（main 未出荷）を含んでいた。main の出荷済みで正しくは **46 行中 44 行**（+ ikura が #584 側）。

**この Claude Code セッションは `pizzadb.jp` に到達できない**（ネットワーク制限）。そのため、訂正した ikura 以外の個別ページは**1 件も取得していない**。表の全行は「要確認」で、分類は変更していない。#587 の証跡（ChatGPT 取得・独立再確認なし）は、`shirasu-pizza` について「大葉の時機は指定なし」「しらすは『仕上げ数分前にのせる』（焼成後とは断定されない）」「レモンは『絞る』動作のみ」という部分情報で、現行分類の変更根拠は無い。

## 4. 監査表（優先度順）

優先度は**ヒューリスティック**（フレッシュハーブ・柑橘・魚卵・生ハム・蜂蜜・粉チーズなど後乗せになりやすい材料を含むか）で、確認の順序づけにだけ使う。原典の根拠ではなく、分類は変えない。

| 優先 | レシピ | 名称 | 材料 | 現行マトリクスの後乗せ | 状態 |
|---|---|---|---|---|---|
| 高 | `baba-ganoush-pizza` | ババガヌーシュピザ | ナス, オリーブオイル, パセリ, 松の実 | — | 要確認 |
| 高 | `california-style-pizza` | カリフォルニアスタイルピザ | ヤギのチーズ, ルッコラ, アボカド, トマト | — | 要確認 |
| 高 | `eggplant-ricotta-pizza` | ナスとリコッタのピザ | ナス, リコッタチーズ, ミント, オリーブオイル | — | 要確認 |
| 高 | `jamon-serrano-pizza` | ハモンセラーノピザ | 生ハム, モッツァレラチーズ, ルッコラ | — | 要確認 |
| 高 | `melanzane-pizza` | メランザーネピザ | ナス, モッツァレラ, バジル | — | 要確認 |
| 高 | `new-haven-apizza` | ニューヘイブンアピッツァ | clam, olive-oil, garlic, parmigiano | — | 要確認 |
| 高 | `parmigiana-pizza` | パルミジャーナピザ | ナス, モッツァレラチーズ, パルミジャーノチーズ, バジル | — | 要確認 |
| 高 | `pesto-caprese` | ペストカプレーゼピザ | モッツァレラチーズ, トマト, バジル | — | 要確認 |
| 高 | `pesto-salmone` | ペストサーモンピザ | サーモン, クリームチーズ, レモン | — | 要確認 |
| 高 | `prosciutto-funghi` | プロシュットフンギ | モッツァレラチーズ, 生ハム, マッシュルーム | — | 要確認 |
| 高 | `rucola-e-grana` | ルーコラエグラーナピザ | 生ハム, ルッコラ, グラナパダーノ | — | 要確認 |
| 高 | `shirasu-pizza` | しらすピザ | しらす, モッツァレラチーズ, 大葉, レモン | — | 要確認（#587 に部分証跡） |
| 高 | `spinach-artichoke-pizza` | スピナッチアーティチョークピザ | ほうれん草, アーティチョーク, クリームチーズ, モッツァレラチーズ, パルミジャーノチーズ | — | 要確認 |
| 高 | `vongole` | ヴォンゴレピザ | clam, garlic, olive-oil, parsley | — | 要確認 |
| 低 | `aussie` | オージーピザ | bacon, egg, mozzarella, onion | — | 要確認 |
| 低 | `bacalhau` | バカリャウピザ | salt-cod, onion, black-olive, mozzarella | — | 要確認 |
| 低 | `bambino` | バンビーノ | モッツァレラチーズ, ハム, コーン | — | 要確認 |
| 低 | `brazilian-catupiry-corn-pizza` | ブラジリアンカトゥピリコーンピザ | カトゥピリチーズ, コーン, モッツァレラチーズ | — | 要確認 |
| 低 | `calabresa-argentina` | アルゼンチン風カラブレーサ | tomato-sauce, mozzarella, salami, black-olive, oregano | — | 要確認 |
| 低 | `chilean-napolitana` | チリアンナポリターナ | fresh-tomato, mozzarella, oregano | — | 要確認 |
| 低 | `frango-catupiry` | フランゴ・コン・カトゥピリ | チキン, カトゥピリチーズ, モッツァレラチーズ, オレガノ | — | 要確認 |
| 低 | `full-english-pizza` | フルイングリッシュピザ | ベーコン, ソーセージ, 卵, ベイクドビーンズ, モッツァレラチーズ | — | 要確認 |
| 低 | `hawaiian` | ハワイアンピザ | モッツァレラチーズ, パイナップル, ハム | — | 個別ページ由来（本監査では再確認せず） |
| 低 | `jalapeno-popper-pizza` | ハラペーニョポッパーピザ | ハラペーニョ, クリームチーズ, ベーコン, モッツァレラチーズ | — | 要確認 |
| 低 | `new-zealand-lamb-pizza` | ニュージーランドラムピザ | ラム肉, さつまいも, モッツァレラチーズ, ローズマリー | — | 要確認 |
| 低 | `palmito-pizza` | パルミットピザ | ヤシの新芽, モッツァレラチーズ, オリーブ | — | 要確認 |
| 低 | `pesto-gamberi` | ペストガンベリピザ | エビ, トマト, にんにく | — | 要確認 |
| 低 | `pesto-patate` | ペストパターテピザ | じゃがいも, ベーコン, モッツァレラチーズ | — | 要確認 |
| 低 | `pesto-pollo` | ペストポッロピザ | チキン, トマト, モッツァレラチーズ | — | 要確認 |
| 低 | `pesto-tonno` | ペストトンノピザ | ツナ, オリーブ, 玉ねぎ | — | 要確認 |
| 低 | `pesto-trapanese` | ペストトラパネーゼピザ | アーモンド, トマト, にんにく | — | 要確認 |
| 低 | `pesto-vegetariana` | ペストベジタリアーナピザ | ズッキーニ, パプリカ, ナス, モッツァレラチーズ | — | 要確認 |
| 低 | `pizza-bianca-ricotta` | ピッツァビアンカ | モッツァレラチーズ, リコッタチーズ, オリーブオイル, ローズマリー | — | 個別ページ由来（本監査では再確認せず） |
| 低 | `pizza-feta-eliniki` | ピッツァフェッタエッリニキ | フェタチーズ, オリーブ, トマト, オレガノ, オリーブオイル | — | 要確認 |
| 低 | `pizza-moscow` | ピッツァモスクワ | サーモン, ツナ, イワシ, 玉ねぎ, モッツァレラチーズ | — | 要確認 |
| 低 | `pizza-overload` | ピザオーバーロード | ホットドッグ, ハム, ベーコン, モッツァレラチーズ, パイナップル | — | 要確認 |
| 低 | `pizza-portuguesa` | ピッツァ・ポルトゲーザ | ハム, 卵, 玉ねぎ, オリーブ, モッツァレラチーズ | — | 要確認 |
| 低 | `polish-kielbasa` | ポーリッシュキエルバサピザ | ソーセージ, ザワークラウト, 玉ねぎ, モッツァレラチーズ | — | 要確認 |
| 低 | `porchetta-pizza` | ポルケッタピザ | 豚肉, モッツァレラチーズ, ローズマリー | — | 要確認 |
| 低 | `puttanesca-pizza` | プッタネスカ | アンチョビ, オリーブ, ケッパー, にんにく | — | 要確認 |
| 低 | `ratatouille-pizza` | ラタトゥイユピザ | ナス, ズッキーニ, パプリカ, オレガノ | — | 要確認 |
| 低 | `salsiccia-e-friarielli` | サルシッチャエフリアリエッリ | ソーセージ, フリアリエッリ, モッツァレラチーズ | — | 要確認 |
| 低 | `spanish-chorizo-pizza` | スパニッシュチョリソピザ | ソーセージ, パプリカ, モッツァレラチーズ, 玉ねぎ | — | 要確認 |
| 低 | `tonno-e-cipolla` | トンノエチポッラ（PIZZA DB版） | tuna, onion, mozzarella, tomato-sauce | — | 要確認 |
| 低 | `vegan-cashew-cheese-pizza` | ヴィーガンカシューチーズピザ | カシューナッツチーズ, ズッキーニ, パプリカ | — | 要確認 |
| 低 | `veggie-supreme-pizza` | ベジースプリームピザ | ピーマン, 玉ねぎ, マッシュルーム, オリーブ, トマト, モッツァレラチーズ | — | 要確認 |

## 5. 監査手順（個別ページ 1 件ごと）

1. 個別ページの URL を特定する（slug は推測しない。比較表のリンクから辿る）。
2. 各材料について、**原文の短い引用**と位置（本文／質問箱など）を記録し、次のいずれかに分類する: `焼成前` / `焼成中` / `焼成後` / `加熱済み（別調理）` / `記載なし`。「仕上げに…」のような動作の記述は、その材料の時機とは同一視せず、そのまま引用する。
3. 結果を JSON の `audit` 欄に記入する（`checkedBy`、`checkedOn`、`independentlyVerified` を必ず埋める。取得者が Owner か、中継（ChatGPT 等）かを区別する）。
4. **焼成後が明記された材料があるときだけ**、`tools/progression2_mechanic_matrix.py` の `ROW_MECHANIC_EVIDENCE` に `ev("LATE_ADDITION", "post_bake", "source_profile_text", <出典>, <引用の要約>, [<材料>])` を追加し、`python3 tools/progression2_mechanic_matrix.py` で再生成、`--check` / `--check-runtime` を通す。「記載なし」は分類を変えない。
5. 出荷済みレシピの分類が変わる場合は、ゲーム側（後乗せ化）を別の Owner 判断にする。本監査はデータの訂正までで、レシピ・ladder・ゲーム挙動は変えない。

## 6. この PR で行わないこと
- コード・レシピ・ladder・UI の変更（docs / tools のみ）。
- #587（`sourceTimingEvidence` の追記）とは別ファイル。重複しない（#587 は `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` を変更）。
- #584 の変更・merge。
