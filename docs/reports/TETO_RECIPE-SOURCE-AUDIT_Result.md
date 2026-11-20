# レシピ原典監査 第 1 回 — 未確認対象の整理（原典確認は未完了）

> **位置付け**: 本書は「原典を確認した結果」ではなく、「どの行が原典未確認か」を整理した第 1 回の成果物。45 件の原典確認は**完了していない**（独立確認済みの一次資料 0 件）。確認の完了・マトリクスの訂正は後続の回で行う。

Docs-only。`src/**`・レシピ・PR #584・共有 Preview は変更していない。マトリクス／master evidence／classification／runtime snapshot も**変更していない**（理由は §5）。
監査基準 main: `78a4a0f`。データ: `docs/reports/data/TETO_RECIPE-SOURCE-AUDIT_45-ROWS.json`。

## 1. 結論（先に）
| 項目 | 結果 |
|---|---|
| pizzadb.jp への到達 | **不可**（プロキシ CONNECT 403 / WebFetch ENOTFOUND）。個別ページの独立確認は **0 件** |
| 比較表のみで分類された出荷済みレシピ | **45 件**（全件「未確認」） |
| うち確認優先度 HIGH（仕上げ系素材を含む・仮説） | 25 件 |
| ikura-salmon-pizza の食い違い | **記録**（§3）。マトリクスは変更せず |
| 整合性検証（マトリクス／JSON／snapshot／src） | 12/12 PASS（§5）。`--check` / `--check-runtime` も PASS |

## 1.1 証跡の区分（一次資料と中継の区別）
| 区分 | 定義 | 件数 |
|---|---|---|
| A. 独立確認済みの一次資料 | Claude Code または Owner が pizzadb.jp の個別ページを自ら取得し、原文を記録 | **0** |
| B. 中継証跡 | ChatGPT が 2026-10-20 に取得し、Owner 経由で Claude Code が受領（PR #584 コメント／PR #587）。短い引用以外は要約。独立再取得なし | ikura-salmon・shirasu-pizza の 2 レシピのみ（部分的） |
| C. 比較表のみ | 比較表の材料リスト。工程・タイミングの情報なし | 45 件（shirasu-pizza を含む。B と重なる） |
| D. 未確認 | 上記のいずれでも工程が分かっていない | 45 件の全件（B の 2 件も、工程全体としては未確認） |

B は A ではない。B の引用が正しければ食い違いが生じる、という条件付きの記録に留める。

## 2. 45 件の定義と状態
- 定義: runtime snapshot の出荷済み 61 件のうち、マトリクスの `canonicalCandidateId` で証跡行に対応し、`phase0.evidenceOrigin == comparison_table_sample` の行（46 件中、`hawaiian` のみ個別ページ由来で除外）。残り 15 件は catalog 由来で PIZZA DB 行に未対応（本監査の対象外）。
- 現状の事実: 45 件すべて、マトリクスの `postBakeFinish` は空、ゲーム側も全材料が焼成前（`applicationPhase` を持つ RECIPES は 0）。
- 焼成前後の材料・調理工程・必要機構は **全件「未確認」**。推測での変更・分類替えはしていない。
- `verifyPriority: HIGH` は「現実の調理で仕上げ（焼成後）に載せられやすい素材が材料に含まれる」という**確認順序の仮説**であり、原典の根拠ではない。

### 2.1 HIGH（25 件）— 先に個別ページを確認
| recipe | 名称 | 比較表の材料 | マトリクス分類 | 仕上げ系素材（仮説） |
|---|---|---|---|---|
| `aussie` | オージーピザ | bacon, egg, mozzarella, onion | DATA_ONLY | egg |
| `baba-ganoush-pizza` | ババガヌーシュピザ | eggplant, olive-oil, parsley, pine-nuts | CURRENT_ENGINE | olive-oil, parsley |
| `brazilian-calabresa` | ブラジリアン・カラブレーザ | black-olive, onion, oregano, sausage | CURRENT_ENGINE | oregano |
| `calabresa-argentina` | アルゼンチン風カラブレーサ | black-olive, mozzarella, oregano, salami, tomato-sauce | CURRENT_ENGINE | oregano |
| `california-style-pizza` | カリフォルニアスタイルピザ | arugula, avocado, fresh-tomato, goat-cheese | DATA_ONLY | arugula |
| `chilean-napolitana` | チリアンナポリターナ | fresh-tomato, mozzarella, oregano | DATA_ONLY | oregano |
| `eggplant-ricotta-pizza` | ナスとリコッタのピザ | eggplant, mint, olive-oil, ricotta | DATA_ONLY | olive-oil |
| `frango-catupiry` | フランゴ・コン・カトゥピリ | catupiry, chicken, mozzarella, oregano | DATA_ONLY | oregano |
| `full-english-pizza` | フルイングリッシュピザ | bacon, baked-beans, egg, mozzarella, sausage | DATA_ONLY | egg |
| `jamon-serrano-pizza` | ハモンセラーノピザ | arugula, mozzarella, prosciutto-crudo | CURRENT_ENGINE | arugula, prosciutto-crudo |
| `melanzane-pizza` | メランザーネピザ | basil, eggplant, mozzarella | CURRENT_ENGINE | basil |
| `new-haven-apizza` | ニューヘイブンアピッツァ | clam, garlic, olive-oil, parmigiano | CURRENT_ENGINE | olive-oil, parmigiano |
| `new-zealand-lamb-pizza` | ニュージーランドラムピザ | lamb, mozzarella, rosemary, sweet-potato | DATA_ONLY | rosemary |
| `parmigiana-pizza` | パルミジャーナピザ | basil, eggplant, mozzarella, parmigiano | CURRENT_ENGINE | basil, parmigiano |
| `pesto-caprese` | ペストカプレーゼピザ | basil, fresh-tomato, mozzarella | CURRENT_ENGINE | basil |
| `pesto-salmone` | ペストサーモンピザ | cream-cheese, lemon, salmon | CURRENT_ENGINE | lemon |
| `pizza-feta-eliniki` | ピッツァフェッタエッリニキ | black-olive, feta, fresh-tomato, olive-oil, oregano | DATA_ONLY | olive-oil, oregano |
| `pizza-portuguesa` | ピッツァ・ポルトゲーザ | black-olive, egg, ham, mozzarella, onion | CURRENT_ENGINE | egg |
| `porchetta-pizza` | ポルケッタピザ | mozzarella, pork, rosemary | DATA_ONLY | rosemary |
| `prosciutto-funghi` | プロシュットフンギ | mozzarella, mushroom, prosciutto-crudo | CURRENT_ENGINE | prosciutto-crudo |
| `ratatouille-pizza` | ラタトゥイユピザ | bell-pepper, eggplant, oregano, zucchini | CURRENT_ENGINE | oregano |
| `rucola-e-grana` | ルーコラエグラーナピザ | arugula, grana-padano, prosciutto-crudo | CURRENT_ENGINE | arugula, prosciutto-crudo |
| `shirasu-pizza` | しらすピザ | lemon, mozzarella, shiso, whitebait | DATA_ONLY | lemon, shiso |
| `spinach-artichoke-pizza` | スピナッチアーティチョークピザ | artichoke, cream-cheese, mozzarella, parmigiano, spinach | DATA_ONLY | parmigiano |
| `vongole` | ヴォンゴレピザ | clam, garlic, olive-oil, parsley | DATA_ONLY | olive-oil, parsley |

### 2.2 NORMAL（20 件）
| recipe | 名称 | 比較表の材料 | マトリクス分類 | 仕上げ系素材（仮説） |
|---|---|---|---|---|
| `bacalhau` | バカリャウピザ | black-olive, mozzarella, onion, salt-cod | DATA_ONLY | — |
| `bambino` | バンビーノ | corn, ham, mozzarella | CURRENT_ENGINE | — |
| `brazilian-catupiry-corn-pizza` | ブラジリアンカトゥピリコーンピザ | catupiry, corn, mozzarella | DATA_ONLY | — |
| `jalapeno-popper-pizza` | ハラペーニョポッパーピザ | bacon, cream-cheese, jalapeno, mozzarella | DATA_ONLY | — |
| `palmito-pizza` | パルミットピザ | black-olive, mozzarella, palm-heart | DATA_ONLY | — |
| `pesto-gamberi` | ペストガンベリピザ | fresh-tomato, garlic, shrimp | CURRENT_ENGINE | — |
| `pesto-patate` | ペストパターテピザ | bacon, mozzarella, potato | CURRENT_ENGINE | — |
| `pesto-pollo` | ペストポッロピザ | chicken, fresh-tomato, mozzarella | CURRENT_ENGINE | — |
| `pesto-tonno` | ペストトンノピザ | black-olive, onion, tuna | CURRENT_ENGINE | — |
| `pesto-trapanese` | ペストトラパネーゼピザ | almond, fresh-tomato, garlic | CURRENT_ENGINE | — |
| `pesto-vegetariana` | ペストベジタリアーナピザ | bell-pepper, eggplant, mozzarella, zucchini | CURRENT_ENGINE | — |
| `pizza-moscow` | ピッツァモスクワ | mozzarella, onion, salmon, sardine, tuna | DATA_ONLY | — |
| `pizza-overload` | ピザオーバーロード | bacon, ham, hot-dog, mozzarella, pineapple | CURRENT_ENGINE | — |
| `polish-kielbasa` | ポーリッシュキエルバサピザ | mozzarella, onion, sauerkraut, sausage | DATA_ONLY | — |
| `puttanesca-pizza` | プッタネスカ | anchovy, black-olive, capers, garlic | CURRENT_ENGINE | — |
| `salsiccia-e-friarielli` | サルシッチャエフリアリエッリ | friarielli, mozzarella, sausage | DATA_ONLY | — |
| `spanish-chorizo-pizza` | スパニッシュチョリソピザ | bell-pepper, mozzarella, onion, sausage | DATA_ONLY | — |
| `tonno-e-cipolla` | トンノエチポッラ（PIZZA DB版） | mozzarella, onion, tomato-sauce, tuna | CURRENT_ENGINE | — |
| `vegan-cashew-cheese-pizza` | ヴィーガンカシューチーズピザ | bell-pepper, cashew-cheese, zucchini | CURRENT_ENGINE | — |
| `veggie-supreme-pizza` | ベジースプリームピザ | black-olive, fresh-tomato, green-pepper, mozzarella, mushroom, onion | CURRENT_ENGINE | — |

## 3. ikura-salmon-pizza の後乗せ分類の食い違い（区分 B: 中継証跡）
| | 内容 |
|---|---|
| マトリクス | `DATA_ONLY` / `NO_SAUCE`、`postBakeFinish: []`、`FULL`、`READY`（全 4 材料が焼成前扱い） |
| 中継された原典（ChatGPT 取得、2026-10-20、PR #584 コメントと PR #587） | 引用「いくらと大葉は焼成後に載せ」。サーモンは「載せて焼く」と「別に加熱」の両記載（要約）。クリームチーズの時機は明記なし |
| 食い違い | 引用が正しければ salmon-roe・shiso は焼成後 → `LATE_ADDITION:post_bake`（classRules 上 `SMALL_ENGINE`）。マトリクスの `DATA_ONLY`／空の後乗せとは不一致。PR #584 の全材料焼成前の実装とも不一致 |
| 状態 | **食い違いを記録。マトリクスは未変更**。根拠は ChatGPT 経由の中継 1 件で、独立再取得がない |
| 必要な確認 | `https://pizzadb.jp/pizzas/ikura-salmon/` の全文（サーモンの方式、クリームチーズ、分量、焼成時間） |

shirasu-pizza（45 件の 1 つ、区分 B）にも PR #587 に中継の部分証跡（レモン「仕上げに絞る」、しらす「仕上げ数分前」、大葉は指定なし）があるが、同じく独立確認がなく、出荷済みレシピは変更しない。

## 4. 未確認件数と必要な確認先
- 未確認: **45 / 45**（＋ ikura-salmon の全文確認 1 件）。
- 確認先: 各レシピの個別ページ `https://pizzadb.jp/pizzas/<slug>/`（slug は比較表 `https://pizzadb.jp/compare/world-pizzas/` のリンクから特定。repo に slug の記録なし）。
- 到達できる環境（Owner の端末 / ChatGPT 等）で、HIGH の 25 件から、各ページの「焼成前／焼成後の材料」「工程」を原文引用つきで取得する。取得者・日付・独立確認の有無を行ごとに記録する（#587 の `sourceTimingEvidence` 形式が流用可能）。

## 5. 整合性検証と、データを変更しなかった理由
実施した検証（すべて PASS）: マトリクス／master evidence／classification が各 172 行・ID 集合一致、snapshot の出荷 61 件が `src/data/recipes.ts` の id と完全一致、classification の照合済み出荷 id が snapshot の部分集合、`applicationPhase` を使う RECIPES が 0、比較表のみの出荷行が 45、監査行がマトリクス行に 1 対 1、45 件の `postBakeFinish` が空、ikura-salmon が main 未出荷かつマトリクス上 DATA_ONLY／後乗せなし。加えて `tools/progression2_mechanic_matrix.py --check` と `--check-runtime` が main で PASS（#587 の記載にあった `--check` の FAIL は、その基準 main `5997157` 時点のもので、現 main では再現しない）。

マトリクス類を変更しなかった理由: (1) 生成物で入力は master evidence、(2) 訂正根拠が未検証の中継 1 件、(3) PR #587 が同じ master evidence を変更中で競合する。訂正は #587 の取り込みと原典の独立確認の後に、生成器で再生成するのが安全。

## 5.1 PR #587 との関係（2026-10-21 確認）
- ファイル: #587 は `TETO_PIZZADB_172_MASTER-EVIDENCE.json`（変更）と `TETO_PIZZADB_TIMING-EVIDENCE_shirasu-ikura.md`（新規）。本 PR は新規 2 ファイルのみで**競合なし**。#587 の base は旧 main `5997157`、本 PR の base は `78a4a0f`。
- 証拠: 同一の ChatGPT 取得（2026-10-20）を指し、引用「いくらと大葉は焼成後に載せ」、shirasu の 2 引用、独立確認なしの扱いは**一致し矛盾なし**。差は #584 コメントの「サーモンは加熱して使う」と #587 の「両方式」の言い回しのみで、どちらも要約。
- 双方を取り込んだ状態（ローカル検証、未 push）: マトリクス `--check`・`--check-runtime`・deadlock `--check`・invariants 4/4 すべて PASS。ikura-salmon のマトリクス行は #587 取り込み後も `DATA_ONLY`／後乗せなしのまま（`sourceTimingEvidence` はマトリクスに反映されない）。
- #587 を先に取り込んでも本 PR の内容は変更不要。本書が「#587 を取り込む前提」と読める箇所はなく、#587 の`--check` FAIL 記載は旧 main 時点のものと注記済み。

## 6. 次のアクション（Owner 判断）
1. HIGH 25 件の個別ページ確認（到達できる環境で）。
2. #587 を先にレビュー／merge するか。マトリクスの ikura-salmon 訂正（`LATE_ADDITION:post_bake`）はその後の別 PR。
3. #584 は保留のまま（本監査は変更していない）。
