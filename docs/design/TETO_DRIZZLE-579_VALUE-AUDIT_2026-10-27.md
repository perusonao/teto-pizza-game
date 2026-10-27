# DRIZZLE（#579）— docs-only 価値監査（第 1 回、行ごとの分類）

Status: **監査の実施結果（第 1 回）。runtime・`recipes.ts`・`lateCatalog.ts`・ladder・golden は変更していない。** merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `9761d03`（#673 merge 後、食材 75）。入力: 172 品 matrix JSON（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）と `recipes.ts` / `lateCatalog.ts` の id。分類スクリプト: `tools/drizzle-value-audit/classify.py`、出力: `tools/drizzle-value-audit/classification.json`。
準備資料: `TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md` §12。**「評価」「推奨」は助言であり Owner Decision ではない。**

## 0. Owner 指示（2026-10-27）と範囲

DRIZZLE の docs-only 価値監査を開始する。#518・D2-2・#495 との依存関係を確認し、172 品 matrix から**実際に解禁可能な候補**を抽出し、**READY_WITH_REVIEW と BLOCKED を分離**して実装価値を評価する。

限界（正直な記録）:
- **matrix の記述は原典の文言ではなく、設計用の記録**（`postBakeFinish` の根拠の強さは `source_profile_text`（原典の記述に近い）/ `catalog_design_tag`（設計上のタグ）/ `repo_inference`（推定）の 3 段階）。原典サイトには到達していない。
- 出荷済みの突き合わせは id の機械的な一致（§1 の近似）。行単位の確認は実装前にやり直す。
- 「液体・ペースト」の集合（`classify.py` の `LIQUID`）は本監査で**明示した仮定**で、変えれば結果も変わる。

## 1. 依存関係の確認

| 依存 | 確認した事実 | 状態 |
|---|---|---|
| **#518**（後乗せ piece を焼成フィルターから分離） | D2-2a（後乗せ専用レイヤーを `.pizza-dough` の外へ。raw / perfect / burnt で後乗せ piece の画素が `none` とバイト一致、`TETO_FINISH-D2-2A_Result.md`）、D2-2b（動画 HV と原因調査）、D2-2c F-1〜F-3（CUT・roomy・カット後の描画。Result 3 件）が揃い、FINISH 本体も本番 ON（E5、#654）。**Issue #518 自体は open のまま**（各 Result に「#518 は close しない」の記載） | **技術的には充足**。Issue のクローズは Owner 判断 |
| **D2-2**（FINISH の画面） | FIN-A〜D（FINISH 画面・トレイ・Undo・統合検証）、E2〜E3b、E5 が merge 済み。late catalog の出荷済みレシピ（ikura、柚子えび、ナス田楽、タヒニ、ピンサ）は**粒状の後乗せ topping** で動作 | **充足**（ただし液体は未対応。下の「FINISH の category 制限」） |
| **FINISH の液体対応**（#579 の論点 1） | `PLACE_TOPPING` の FINISH 分岐は `category !== "topping"` を拒否する（`gameReducer.ts:1077` で main `9761d03` に対して確認）。ソース・チーズの後乗せは置けない | **未対応**（DRIZZLE の本体） |
| **#495**（後乗せ要件を除いた暫定スコア） | Issue の着手条件は「暫定スコアを UI に出す設計が決まった時、または本番レシピで後乗せを有効化する時（P4b）」。E5 で後乗せは本番 ON になった。ただし暫定スコアは「焼成失敗で FINISH をスキップするラウンド」だけに出る値で、FINAL が置き換える。**DRIZZLE の前提ではない**（後乗せ Reference group の検証は現行の late レシピと同じ経路） | **DRIZZLE の前提ではない**。Issue の扱い（条件が満たされたか）は Owner 判断 |
| **#476**（食材別操作 PLACE / SCATTER / SLICE / DRIZZLE） | `TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` が「DRIZZLE を作る時点で #476 の Owner Decision Gate に載せる」と記載 | **DRIZZLE の設計前に #476 の Gate が必要** |
| **#521 Owner 判断 9** | 「はちみつ / マヨ / ドレッシングは FINISH が液体に対応するまで保留」 | DRIZZLE が無い間、液体ソース系の行は保留のまま |
| **OD-CS-11 = A** | 後乗せの採点は既存の Pieces / Recipe 成分（配点 52/16/12/20 不変）。`lunch-rush-v1` 不変 | DRIZZLE が採点を変えないことが条件 |
| #579 の論点 2〜5（操作、描画、採点、識別） | 5 論点とも未決。識別は `late` 軸（`FIXED_BY_FLOW`、OBSERVED 化は P4b と同時）のまま | 未決 |

**#579 が動機とした事例は、すでに別の経路で出荷されている:** #579 の本文が挙げた「タヒニ・柚子胡椒の仕上げ」は、柚子胡椒（U1）・味噌（U2）・タヒニ（U3）が**焼成前の PAINT ソース**として、白ごま（U2）・ザクロ（U3）が**焼成後の粒状 topping** として出荷された。つまり、動機の中心だった 2 種はソースの後乗せ（DRIZZLE）を使わずに解決している。

## 2. 分類の結果（未出荷と推定される 44 行）

分類（結果を見る前に定義）: **L1** 後乗せの記録が液体・ペーストを名指し／**L2** 後乗せの記録はあるが材料が未特定で、行に油・はちみつ・マヨの材料がある／**L2b** 油・はちみつ・マヨの材料があるが後乗せの記録が無い（時機が不明）／**L0** 後乗せの記録が固形のみ（既存の POST_BAKE topping で足りる。DRIZZLE ではない）。

| 分類 | 行数（READY / READY_WITH_REVIEW / BLOCKED） |
|---|---|
| L1 | 5（1 / 1 / 3） |
| L2 | 8（0 / 0 / 8） |
| L2b | 21（4 / 4 / 13） |
| L0（DRIZZLE 不要） | 10（2 / 0 / 8） |

## 3. READY / READY_WITH_REVIEW と BLOCKED の分離

### 3.1 L1（液体・ペーストの後乗せが記録されている）

**READY（1 行）**

| 行 | 名称 | 後乗せの記録（時機:材料[根拠の強さ]） | 他の必要機構 | 他のブロッカー | 時機の解釈が未決 |
|---|---|---|---|---|---|
| `wasabi-beef-pizza` | わさび牛ピザ | post_bake:wasabi[source_profile_text] | — | — | — |

- wasabi は**ペーストを少量のせる**もので、焼成後の粒状 topping（U2 の白ごま、U3 のザクロの型）で近似できる可能性が高い。「かける」動作が必須かは Owner 判断。根拠は `source_profile_text`（原典に近い記述）で、L1 では唯一強い。
- この行は、材料（beef、soy-sauce、wasabi）が 3 種とも新規で、**DRIZZLE を作らなくても出荷候補**（`LATE_ADDITION` のみ）。

**READY_WITH_REVIEW（1 行）**

| 行 | 名称 | 後乗せの記録（時機:材料[根拠の強さ]） | 他の必要機構 | 他のブロッカー | 時機の解釈が未決 |
|---|---|---|---|---|---|
| `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | post_bake:honey[repo_inference] | MULTI_SPREAD_LAYER | — | — |

- 根拠は `repo_inference`（推定）。他の必要機構として `MULTI_SPREAD_LAYER`（複数ソースの Recipe profile の一般化。#521 / #540 の Draft・HOLD）が要る。

**BLOCKED（3 行）**

| 行 | 名称 | 後乗せの記録（時機:材料[根拠の強さ]） | 他の必要機構 | 他のブロッカー | 時機の解釈が未決 |
|---|---|---|---|---|---|
| `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | post_bake:buffalo-sauce[catalog_design_tag] | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_CANDIDATE:COMP:buffalo-chicken-piz | — |
| `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | post_bake:tomato-sauce[catalog_design_tag] | DOUGH_VARIANT,PAN_BAKE,DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE:COMP:detroit-style-pizza | — |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | post_bake:mayo/nori[catalog_design_tag] | — | BASE_SAUCE_UNSPECIFIED:甘辛だれ; COMPOSITION_CONFLICT_CANDIDATE:COMP:teriyaki-chicken-pi | — |

- 3 行とも、DRIZZLE とは別の理由（構成の衝突、基底ソース未特定、他の機構）で出荷できない。DRIZZLE を作っても**これだけでは解禁されない**。

### 3.2 L2（後乗せの記録はあるが材料が未特定。オリーブ油が候補）— すべて BLOCKED

| 行 | 名称 | 後乗せの記録（時機:材料[根拠の強さ]） | 他の必要機構 | 他のブロッカー | 時機の解釈が未決 |
|---|---|---|---|---|---|
| `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | post_bake:(未特定)[repo_inference] | — | — | あり |
| `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | post_bake:(未特定)[repo_inference] | DOUGH_VARIANT | — | あり |
| `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | post_bake:(未特定)[repo_inference] | — | — | あり |
| `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | post_bake:(未特定)[repo_inference] | — | — | あり |
| `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | post_bake:(未特定)[repo_inference] | — | — | あり |
| `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | post_bake:(未特定)[repo_inference] | DOUGH_VARIANT | UNRESOLVED_INGREDIENT:唐辛子 | あり |
| `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | post_bake:(未特定)[repo_inference] | DOUGH_VARIANT | — | あり |
| `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | post_bake:(未特定)[repo_inference] | MULTI_SPREAD_LAYER | — | あり |

- いずれも「サラダ系（生野菜を焼成後にのせる）」の行とみられ、**後乗せの中身は野菜（固形）である可能性が高い**。オリーブ油の仕上げは添えるだけで、DRIZZLE が必須とは言えない。時機の解釈（`MECHANIC_INTERPRETATION`: LATE_ADDITION）が Owner 判断待ちで、根拠は `repo_inference`（推定）。
- 他の機構・ブロッカーが無い行は 4 行（asparagi-limone、finocchi、cavolo-carote、zucchine-menta）。

### 3.3 L2b（油・はちみつ・マヨの材料はあるが、後乗せの記録が無い）— 21 行

- **READY:** pizza-alla-crudaiola-pizzadb-p8（olive-oil）, burrata-pizza-pizzadb-p10（olive-oil）, pesto-noci-pizzadb-p12（honey）, pesto-burrata-pizzadb-p12（olive-oil）
- **READY_WITH_REVIEW:** sfincione-pizzadb（olive-oil）, bianca-pizzadb-row（olive-oil）, pescatore-pizzadb-p11（olive-oil）, manakish（olive-oil）
- **BLOCKED:** margherita-pizzadb-row（olive-oil）, pizza-de-cancha（olive-oil）, okonomiyaki-style-pizza-pizzadb-p1（mayo）, potato-mayo-pizza-pizzadb-p3（mayo）, nashville-hot-chicken-pizza-pizzadb-p6（honey）, feteer-meshaltet-pizzadb-p10（honey）, focaccia-genovese-pizzadb-p10（olive-oil）, venezuelan-reina-pepiada-pizzadb-p12（mayo）, boscaiola-pizzadb-p12（olive-oil）, mentaiko-mochi-pizza（mayo）, marinara-pizza-pizzadb-p13（olive-oil）, mexican-elote-pizza-pizzadb-p13（mayo）, nduja-pizza-pizzadb-p14（honey）

後乗せの時機の記録が**無い**ので、DRIZZLE が必要かどうかを matrix からは判断できない（原典の確認が要る）。多くは焼成前の油塗り（既存の PAINT_TEMPORARY / olive-oil の経路）か、記録されていない仕上げ。**なお `bianca-pizzadb-row` は出荷済み `pizza-bianca-ricotta` と材料が一致する重複で、候補ではない**（state-sync §4）。

## 4. 実装価値の評価（助言）

| 観点 | 結果 |
|---|---|
| DRIZZLE **だけ**が足りない行（他の機構・ブロッカー無し）で、後乗せの液体が**強い根拠**で記録されている | **1 行**（wasabi-beef。ただしペースト = 粒状 topping で近似できる可能性が高く、DRIZZLE 不要の見込み） |
| 同、**弱い根拠**（`repo_inference` / `catalog_design_tag`） | L2 の 4 行（後乗せの中身は固形とみられる）。L1 の hot-honey は `MULTI_SPREAD_LAYER` も要る |
| DRIZZLE が必須で、**他のブロッカーを除いても**代替（焼成前 PAINT / 粒状 topping）では足りない行 | **0 行**（確認できた範囲） |
| #579 の動機の事例 | 別経路で出荷済み（§1） |
| 機構のコスト | XL（FINISH の category 制限、操作、描画、採点整合、識別の 5 論点。#476 の Gate が前提） |
| 解禁する行数の上限（楽観） | L1 の 5 行 + L2 の 8 行 = 13 行だが、いずれも他の決定（構成、基底ソース、時機の解釈、`MULTI_SPREAD_LAYER`）が先に要る |

**評価: 現時点では、DRIZZLE を実装する価値は確認できない。** 準備資料 §12.4 の目安（Owner が閾値を決める。仮に「DRIZZLE が必須で他のブロッカーが無く、代替で足りない行が 3 行以上」）に対して、確認できた行は 0。**推奨は「保留（機構は作らない）」**。再開の条件は、①原典の共有で L2b / L2 の行に液体の後乗せが確認され、代替では足りないと判断されたとき、②Owner が液体の後乗せを必須とする行（例: hot-honey、buffalo）を優先して構成・基底ソースの決定を進めたとき。

## 5. 次にできること（Owner の選択）

1. **保留を確定し、#579 に結果を記録する**（機構は作らない）。
2. **wasabi-beef を粒状 topping 前提で late catalog の次候補に加える**（BBQ の後。#611 の枠。DRIZZLE 不要）。
3. 原典のページを Owner が共有できる範囲で、L2b の READY / READY_WITH_REVIEW 行（§3.3 に挙げた READY / READY_WITH_REVIEW の行と、L1 の hot-honey）の仕上げの時機を確認する。**未確認事項は推測で埋めない**（OD-B9-11）。
4. #476 の Owner Decision Gate に DRIZZLE を載せるかの判断（本監査では載せない）。

## 6. 干渉しない範囲（確認）

本ブランチが追加したのは `docs/design/` の本書と `tools/drizzle-value-audit/`（分類スクリプトと出力）のみ。`recipes.ts`・`lateCatalog.ts`・ladder・golden・runtime は変更していない。#674 とは重ならない。
