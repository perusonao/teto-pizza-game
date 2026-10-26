# 次期レシピ・新工程 優先度表 — BBQチキン vs DRIZZLE ほか（#611 / #579 / #577 / 172品 matrix、docs-only）

Status: **調査と整理のみ。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。merge・deploy・CI 再実行・Monitor 作成なし。新規 Issue は作らず、**#611 に claim** した（2026-10-26）。
基準 `main` = `28f04f4`（食材 73 / レシピ 68）。PR #673（U3、食材 75、Owner HV 待ち・merge 禁止）と #674（#668 の Dex 生エントリ保持）は open。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**
読んだもの: #611（本文 + コメント）、#579、#577 / `TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`、`TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md`、`TETO_STATE-SYNC_2026-10-26.md`、`TETO_NEW-SAUCES-U3_FINAL-DESIGN-GATE_2026-10-26.md`、#604 / #608 の claim コメント、172 品 matrix（`TETO_RECIPE_172_MECHANIC-MATRIX.md` と JSON `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）、`src/data/lateCatalog.ts`。

## Owner 方針（2026-10-26 反映）

Owner は本表を受けて次を決めた（Issue #611 に記録）。**実装の開始ではない。**

- **BBQチキンを次のレシピ実装候補にする**（着手は #673 の merge 後と §11 の Owner 回答後）。§10 に「原典未確認と暫定仕様の扱い」、§11 に D-1 / D-4 / D-6 の選択肢を整理した。
- **DRIZZLE（#579）は docs-only の価値監査を準備する**（§12。監査の実施・結論は含まない）。
- **ピアディーナ（#577）・月見は HOLD 継続**（§13）。
- **#604 / #608 の完了条件と claim 状態を確認する**（§14）。

**訂正（本表の初版の §4.2）:** 初版は「DRIZZLE で解禁される行は少なく、確実に必要で他のブロッカーが無い行は確認できない」と書いたが、matrix を `postBakeFinish` 全体で再走査すると、**はちみつの後乗せ（hot-honey-pepperoni、READY_WITH_REVIEW）が 1 行、オリーブ油の後乗せを持つサラダ系（p8 の 8 行、いずれも BLOCKED、根拠は `repo_inference`）がある**。価値は初版より大きい可能性があり、**順位 4（DRIZZLE）の判断は価値監査の結果を待つ**（順位そのものは据え置き: 機構の新規実装が要り、確実な行が 1 行のため）。

## 0. 方法と限界

- **matrix の件数は近似。** 172 行を `recipes.ts` / `lateCatalog.ts` の id と「`-pizzadb(-pN)` を除いた id・`canonicalCandidateId`」で機械的に突き合わせた（57 行が出荷済みと推定、115 行が未出荷）。matrix の JSON は古い基準で、id が一致しない出荷済みレシピが混ざる可能性がある。**行単位の判定は実装前に Owner / 実装セッションが再確認する。**
- 実装規模は **#673（50 ファイル、+996/−88、食材 2 + レシピ 1 + SVG 1）との類推**による見積もり。測定値ではない。
- **原典（pizzadb.jp）には到達していない。** 食材・投入時機・個数は matrix と既存の決定記録の引用で、全て暫定。
- 他セッションの claim は、読んだ範囲（#611 / #604 / #608 / #668）だけを確認した。全 Issue の claim は網羅していない。

## 1. 優先度表（結論）

| 順位 | 候補 | 種別 | 状態 | 主なブロッカー | 規模（類推） | 先行条件 |
|---|---|---|---|---|---|---|
| **1** | **BBQチキン**（matrix 行 1、`LATE_ADDITION` のみ） | late catalog のデータ追加 | 機構は出荷済み（late catalog と FINISH は本番 ON） | #611 の Owner 回答（§3）、原典の扱い（§3.3）、**#673 の merge 後**（`lateCatalog.ts`・ladder・golden を共有） | **L**（#673 と同型: 食材 2 + SVG 1 + レシピ 1 + 件数 pin） | #673 merge、Owner D-1・D-4・D-6 |
| 2 | **わさび牛**（`LATE_ADDITION` のみ、READY） | late catalog のデータ追加 | 同上 | 食材 3（beef、soy-sauce、wasabi）が全て新規。投入時機は matrix のみ（原典未確認） | L〜XL | #673 merge、BBQ の後（同じ late 枠の連続） |
| 3 | **カリーヴルスト**（機構なし、READY） | 通常カタログのデータ追加 | 新機構不要 | 新食材 3（curry-ketchup、paprika-powder、wurstel）、通常 ladder は追記専用 | L | Owner 判断（食材・価格・ladder 位置） |
| 4 | **DRIZZLE（ソース後乗せ、#579）** | 新工程（FINISH の液体対応） | 設計論点の整理のみ。前提 #518 → D2-2a は結果文書あり（D2-2 の完了状況は未確認） | 確実な行は 1 行（根拠が推定）で、他は BLOCKED だが十数行が解釈・他機構の確定次第（§4.2、価値は §12 で確認）。#495（Scoring）・OD-CS-11 との整合が未決 | **XL（複数 PR）** | まず docs-only の「液体後乗せの価値監査」 |
| 5 | **ピアディーナ**（#577 の 3 値目） | 生地種別の一般化 | 設計 Gate 判定 HOLD（G5 Anti-Oracle・G6 保存互換・G7 工程・G8 原典） | Owner 設計判断 4 件 | M〜L | Owner 決定（G5〜G8） |
| 6 | **月見** | 通常カタログ | **実装保留**（OD-B9-8 / 12。DH4 の「その他は到達不能」を緩めない） | Owner 方針の変更が要る（OD-DH4-2-9 の改訂 / `other` の再分類 / 構成変更） | M | Owner 判断のみ。エンジニアリングでは解けない |

**順位の根拠（要約）:** 1〜3 は**新機構が不要**で、出荷済みの late catalog / 通常カタログの型に乗る。DRIZZLE は機構の新規実装が要るのに、確実に解禁される行が現時点で 1 行（根拠が推定）で、他は BLOCKED（§4.2。価値は §12 の監査で確認）。ピアディーナと月見は技術ではなく Owner の設計・方針判断待ちで、準備を進めても着手できない。

## 2. 依存関係と競合

```
#673（U3、Owner HV 待ち・merge 禁止）
  └─▶ BBQチキン / わさび牛（late catalog の続き。lateCatalog.ts・ladder・LATE_ENTITLEMENT_FLOORS・goldens を共有）
#674（#668、persistence.ts）  ── 無関係（BBQ・DRIZZLE のどちらとも）
#518 → FINISH D2-2 ─▶ DRIZZLE（#579）  ※ #495（Scoring）・OD-CS-11 と整合させる
#577 Dough Kind ─▶ ピアディーナ  ※ pendingRound の dough が旧ビルドで処理不能（G6）。#664/#666 の保持ジャーナルと関係
```

- **#673 との共有ファイル（BBQ の実装時に衝突する）:** `src/data/lateCatalog.ts`（late step と floor の追記）、`ingredients.ts`、`IngredientGlyph.tsx`、`App.css`（1.2em の補正グループ）、Hint 5.0 の golden（追記専用）、`deductionGuard.gate.test.ts` の件数 pin。**BBQ は #673 の merge 後に、#673 を取り込んでから着手する**のが安全（後から着手する側が追従）。
- **古い claim（要確認）:** #611 に別セッションの claim（`late-catalog-foundation`、`recipes.ts`・`lateCatalog*.test.ts` 等、期限 2026-10-28）が残る。基盤は merge 済みのため実質完了と推定するが、**BBQ の実装前に release / 失効を確認する。** #604（期限 10/24〜25）・#608（期限 10/26）の claim は期限切れ。
- **Issue の整理候補（Owner 判断）:** #604（TQ-2）・#608（FIN-E3b）は、対応する PR（#606・#607 は claim コメントで merge 済みと確認、#609 の merge 状況は未確認）と、E5 での本番 ON（state-sync §1）から、残作業が無ければクローズ可能と推定する。**閉じてよいかは未検証。**

## 3. BBQチキン — 詳細

### 3.1 内容（#611 §1 の具体案。#621 のコメントで一部 supersede）

- 材料: bbq-sauce（新・ソース、`PAINT`、色駆動で専用 SVG 不要）/ mozzarella / onion / chicken / **cilantro**（新・topping、herb 族、焼成後 = `POST_BAKE`、専用 SVG `cilantro-leaf` を推奨）。matrix 行 1 は `READY`・`LATE_ADDITION` のみ。
- 数値案（暫定）: mozzarella 2 / onion 1 / chicken 3 / cilantro 2（FINISH）= 非ソース 8、bbq-sauce 1。焼成窓 58–78、`baseRewardPitz: 100`、T4、星ゲートなし、`lunchRush: false`、CUT なし、key-free。
- **supersede 済みの記述（#611 のコメント）:** ladder の絶対 step 番号（56）は使わない（late 枠の相対順序、番号は導出）。`ladderCredit` の数値（58→59）も通常枠 57 のまま。ikura が late 枠の先頭になった。

### 3.2 規模と作業の中身（#673 からの類推）

食材 2（`ingredients.ts`、taxonomy、price / shop）、SVG 1（cilantro-leaf、Style Lock v2 の手順）、レシピ 1（`lateCatalog.ts`、Reference、sauce profile、hint role）、ladder の late step 追記と `LATE_ENTITLEMENT_FLOORS`、技法 allow-list、Hint 5.0 golden（追記）、`deductionGuard.gate` の件数 pin の原因分解（OD-B9-15 の方式）、Research コホートの鍵、E2E、HV（390×844 動画 + 前後スクリーンショット）。**「リング上限が FINISH ピースを数えるか」は要実測（D-6）。**

### 3.3 ブロッカー

| # | ブロッカー | 状態 |
|---|---|---|
| B1 | #611 の Owner 回答 D-1（数値）、D-4（`cilantro-leaf` を含めるか）、D-6（8 スロットと FINISH ピース）。D-2・D-3 は #621 で supersede、D-5 は #621 で技法名・説明・なぞかけが確定 | **未回答** |
| B2 | 原典の個別ページ確認。#611 のコメント（2026-10-22）は「原典確認まで先行しない」。一方 OD-B9-11 / 17 と U2・U3 の実績は「**暫定仕様（原典未確認）で実装前監査・実装を進めてよい**」 | **どちらを BBQ に適用するか Owner 判断** |
| B3 | #673 の merge（共有ファイル、§2） | Owner HV 待ち |
| B4 | 古い claim の失効確認（§2） | 要確認 |
| B5 | 新しい late step のゲート: Hint 5.0 gate・privacy sweep・STRUCTURE 件数・Research / Notebook 非漏洩（`TETO_FIN-E2_LATE-AXIS_DESIGN.md` §8） | 実装 PR の条件 |

## 4. DRIZZLE（#579）— 詳細

### 4.1 何を要するか（#579 の論点を現状に照らして）

- FINISH は topping 専用（`PLACE_TOPPING` の FINISH 分岐が `category !== "topping"` を拒否）。液体・ペーストを置けない。`sauceIds` との関係、`canPlacePostBakeIngredient`、操作（タップ配置の拡張か新ジェスチャー DRIZZLE か）、描画（液体の表現）、採点（OD-CS-11=A、#495 未決）、識別（`late` 軸は `FIXED_BY_FLOW`、OBSERVED 化は P4b と同時）の 5 論点が全て未決。
- 前提の #518（後乗せ piece と焼成フィルターの分離）は D2-2a の Result 文書があり分離が入っているとみられるが、**完了状況は本調査で確認していない。**
- U2（白ごま）・U3（ザクロ）は後乗せの**粒状 topping**として扱われ、後乗せの「液体ソース」はまだ未実装のまま。

### 4.2 解禁される行の見積もり（matrix、近似。2026-10-26 に `postBakeFinish` 全体を再走査して訂正）

| 群 | 行 | 後乗せの対象 | 状態 / 根拠の強さ |
|---|---|---|---|
| はちみつ | hot-honey-pepperoni | honey（post_bake） | **READY_WITH_REVIEW**、根拠 `repo_inference`（原典の文言ではなく推定）。必要機構は `MULTI_SPREAD_LAYER` とされるが、後乗せの液体が要る |
| 液体ソース | buffalo-chicken（PIZZA DB 版） | buffalo-sauce（post_bake） | BLOCKED（構成の衝突候補 DIVERGENT、`MULTI_SPREAD_LAYER` も要る）、根拠 `catalog_design_tag` |
| 〃 | teriyaki-chicken | mayo + nori（post_bake） | BLOCKED（基底ソース未特定、構成の衝突候補） |
| 〃 | detroit-style | tomato-sauce（post_bake） | BLOCKED（`DOUGH_VARIANT` + `PAN_BAKE` + `DOUGH_SHAPE_TARGET` も要る） |
| オリーブ油のサラダ系（p8） | asparagi-limone、carciofi、finocchi、cavolo-carote、zucchine-menta、cicoria-limone、puntarelle、radicchio-noci（8 行） | post_bake の中身は未特定（olive-oil が材料に含まれる） | いずれも BLOCKED（`MECHANIC_INTERPRETATION`: LATE_ADDITION の解釈）、根拠 `repo_inference`。うち 4 行は `DOUGH_VARIANT` / `MULTI_SPREAD_LAYER` も要る |
| オリーブ油の仕上げ（時機不明） | crudaiola、burrata、pesto-burrata、pescatore、sfincione など | olive-oil | matrix は `MULTI_SPREAD_LAYER` のみ要とし、仕上げの時機は**未特定**。DRIZZLE が必須かは不明 |

→ **確実に DRIZZLE が必要で、他のブロッカーが無い行は、現時点で 1 行（hot-honey、しかも根拠が推定）。** ただし、サラダ系 8 行と液体ソース 3 行が、解釈の確定（Owner 判断）や他機構の完了で解禁されうる。機構を作る投資の価値は、§12 の価値監査で行ごとに確認してから判断する。

### 4.3 BBQチキン vs DRIZZLE（比較）

| 観点 | BBQチキン | DRIZZLE |
|---|---|---|
| 新機構 | **不要**（late catalog・FINISH は本番 ON） | 必要（FINISH の液体対応、ジェスチャー、描画、採点整合） |
| 出荷できるレシピ | **1**（確実） | 確実なのは 1 行（hot-honey、根拠が推定）。BLOCKED の十数行が解釈・他機構の確定次第 |
| 規模 | L | XL（複数 PR、Design Gate から） |
| 依存 | #673 merge、Owner 回答、原典の扱い | #518/D2-2、#495、OD-CS-11、設計判断 5 件 |
| 戻しやすさ | late catalog は本番 ON のため merge = 即公開（#673 と同じ運用）。ladder は追記専用 | エンジン変更で影響が広い（Scoring / Hint / Research / save への波及を要監査） |
| 前提の確からしさ | 原典未確認だが、U2・U3 の前例あり | 論点の多くが未決 |

**助言（Owner 方針で確定）:** BBQ を先に。DRIZZLE は、**docs-only の価値監査**（§12）を先に行い、価値が見えてから設計 Gate に進む。

## 5. その他の候補（matrix、近似）

未出荷と推定される 115 行のうち、READY / READY_WITH_REVIEW は 34 行（READY 20、READY_WITH_REVIEW 14）。必要機構別（READY + REVIEW の件数 / 全件）:

| 必要機構 | READY+REVIEW / 全件 | 備考 |
|---|---|---|
| なし | 6 / 52 | 例: カリーヴルスト、キューバン、北京ダック（要 review）。**新機構なしで出せる唯一の群**。ただし多くが新食材 3 前後 |
| `DOUGH_VARIANT` | 7 / 18 | ピアディーナ（#577）が最初。一般化（G5〜G8）が終われば NY スタイル、マナキーシュ、ファットヘッドなどに広がる可能性。**Owner の設計判断が前提** |
| `MULTI_SPREAD_LAYER` | 8 / 12 | 複数ソースの engine は既に出荷（Sauce B1/B2）。残りは行ごとの内容判断 |
| `LATE_ADDITION` | 3 / 9 | BBQ、わさび牛、たらこクリーム（`mid_bake` = 後乗せとは別の投入時機。要設計） |
| `ENCLOSE`・`PREP_STEP`・`PAN_BAKE` 系 | 各 1〜2 | 構造的な新機構。Square-Pan（Epic #532、PR #540/#581）が PAN_BAKE に近い |
| ブロッカー別（全未出荷） | `BASE_SAUCE_UNSPECIFIED` 33、`UNRESOLVED_INGREDIENT` 23、`COMPOSITION_CONFLICT_CANDIDATE` 18 | **ベースソースの選択（33 行）が最大の Owner 判断**（matrix §10 の指摘と一致） |

注: `bianca-pizzadb-row` は出荷済み `pizza-bianca-ricotta` と材料が一致する重複（state-sync §4）。`tsukimi-pizza` は READY と表示されるが Owner 保留（§1 の順位 6）。`eggplant-tahini-pizza` は #673 で出荷予定。

## 6. 新工程の順序（matrix §5 を現状に照らして）

| 順 | 機構 | 現状 |
|---|---|---|
| 1 | DOUGH_VARIANT | Pinsa で最初の値を出荷。**3 値目（ピアディーナ）の一般化が HOLD** |
| 2 | MULTI_SPREAD_LAYER | 複数ソース engine は出荷済み。グランマ（#521 / #540）は Square-Pan 待ちで HOLD |
| 3 | LATE_ADDITION | 出荷済み（ikura / 柚子えび / ナス田楽 + #673 のタヒニ）。**次は BBQ / わさび牛** |
| — | DRIZZLE（液体の後乗せ） | matrix の機構名ではなく #579 の論点。matrix §5 の順序には含まれない |
| 4〜 | ENCLOSE / PREP_STEP / PAN_BAKE / DOUGH_SHAPE_TARGET … | 各 1〜8 行。Square-Pan が PAN_BAKE の先行 |

## 7. 提案: 並行して独立に進められる作業

| 作業 | 内容 | 競合 |
|---|---|---|
| **C-1** BBQ の実装前 Final Design Gate（docs-only） | #611 の D-1・D-4・D-6 を実測（リング上限と FINISH ピース）で埋め、B2 の方針を Owner に確認する材料を揃える。#673 U3 の Final Design Gate の型 | なし（docs-only） |
| **C-2** 液体後乗せの価値監査（docs-only） | §4.2 の行ごとに「液体の仕上げが必要か」を再確認し、DRIZZLE の要否を判断する | なし |
| **C-3** Owner 向けの質問票（Issue コメント） | §8 の決定事項 | なし |

実装（BBQ のデータ PR）は、#673 の merge と §8 の OD-NR-1〜3 の回答後。

## 8. Owner 決定事項（2026-10-26 更新）

| ID | 決定 | 状態 |
|---|---|---|
| OD-NR-1 | 次の late catalog 候補 | **BBQチキンに決定**（候補。着手は #673 merge 後と OD-NR-3 の回答後） |
| OD-NR-2 | 原典未確認での進め方 | **「暫定仕様として扱う」方針を §10 に整理。BBQ に適用してよいかの確認が残る** |
| OD-NR-3 | #611 の D-1・D-4・D-6 | **選択肢を §11 に整理。回答待ち**（D-6 はコードの根拠で選択肢を絞った） |
| OD-NR-4 | DRIZZLE の扱い | **docs-only 価値監査の準備（§12）。実施は別途の指示** |
| OD-NR-5 | #579 の前提（#518 → D2-2、#495） | 未回答（§12 の監査の入力に含める） |
| OD-NR-6 | ピアディーナ（#577） | **HOLD 継続**（§13） |
| OD-NR-7 | 月見 | **HOLD 継続**（§13） |
| OD-NR-8 | ベースソース未特定 33 行 | 未回答（別 Issue） |
| OD-NR-9 | #604 / #608 のクローズ可否、#611 の失効 claim | **状態を §14 に確認。クローズ判断は未回答** |
| OD-NR-10 | BBQ 実装の着手時期 | #673 の merge 後（Owner の方針に沿う）。未確定: #673 の merge 時期 |

## 10. BBQチキン — 原典未確認と暫定仕様の扱い

### 10.1 二つの記録の食い違い

| 記録 | 内容 |
|---|---|
| #611 のコメント（2026-10-22） | BBQ は「原典（個別ページ）の確認まで先行しない」 |
| OD-B9-11 / 17（2026-10-23、Batch 9 決定記録） | 原典確認は Owner からのページ内容共有を優先し、**未確認事項は推測で埋めない**。原典確認待ちで準備を止めず、**暫定仕様で実装前監査を行う（仮定であり、原典確認の代替ではない）** |
| U2・U3 の実績（#669 出荷済み、#673 open） | 「暫定仕様・原典未確認」「GAMEPLAY ASSUMPTION」と明記して実装・PR まで進め、HV 前提で merge 禁止 |

後の決定（OD-B9-11 / 17、U2・U3）が、古い #611 のコメントより優先されると読める。**BBQ にも同じ扱いを適用してよいか、Owner が確認する**（OD-NR-2）。

### 10.2 暫定仕様として扱う場合のルール（U2・U3 の型）

1. PR タイトル・本文・Result に「**暫定仕様・原典未確認**」「**GAMEPLAY ASSUMPTION**」を明記する。原典のページ・数値を根拠として書かない。
2. レシピの説明文（`description`）・Dex・RESULT に、原典の記述を断定する文を書かない。
3. Reference のスロット割り当ては「ゲーム内の較正」であって原典の権威ではない（既存コメントの定型句を使う）。
4. **未確認項目の一覧**を Result に載せる（下記）。Owner が原典ページを共有したら、数値・時機だけを差し替える小さな PR で追随できるように、データ定数を 1 か所に集める。
5. **merge = 即公開**（late catalog は本番 ON）なので、Owner の実機 HV と最終承認まで merge しない（#673 と同じ運用）。

### 10.3 BBQ の未確認項目（暫定のまま実装する場合、Result に残す）

| # | 項目 | matrix / 決定記録の状態 |
|---|---|---|
| Q1 | 材料の最終一致（bbq-sauce / chicken / cilantro / mozzarella / onion） | matrix は `phase0b_sample_canonical`（比較表の標本）。個別ページ未確認 |
| Q2 | **cilantro が焼成後**であること | matrix の `postBakeFinish` は `catalog_design_tag`（**設計上のタグであって原典の文言ではない**。ikura は `source_profile_text`）。根拠が ikura より弱い |
| Q3 | 個数（mozzarella 2 / onion 1 / chicken 3 / cilantro 2） | #611 の具体案（暫定） |
| Q4 | 生地・焼成窓（58–78） | matrix の dough は `unknown`。窓は U1〜U3 と同じ汎用値 |
| Q5 | チキンの下ごしらえの有無（`PREP_STEP` 不要の前提） | matrix は `LATE_ADDITION` のみ要。下ごしらえは未記録 |

Q2 は特に、**「焼成後」を間違えるとレシピの識別軸（late）が変わる**（Dex・Hint・Research の `late` 軸）。暫定で進める場合も、Q2 だけは Owner が明示承認する、という運用が安全。

## 11. BBQチキン — D-1 / D-4 / D-6 の選択肢

#611 §5 の回答待ち項目のうち、D-2・D-3 は #621 のコメントで supersede 済み、D-5 は #621 で技法名・Dex 説明・なぞかけが確定済み。残るのは D-1・D-4・D-6。

### D-1 数値（#611 §1。supersede 済みの記述は除く）

| 項目 | 案 A（#611 の具体案どおり） | 案 B（余裕を持たせる） | 備考 |
|---|---|---|---|
| ピース数 | mozzarella 2 / onion 1 / chicken 3 / cilantro 2（FINISH）= 非ソース 8、bbq-sauce 1 | chicken 2（非ソース 7） | ikura も 8 で出荷済み。ring は §D-6 のとおり 8 が上限ではない |
| 焼成窓 | 58–78 | 同左 | U1〜U3 と同じ |
| 報酬 | `baseRewardPitz: 100` | 同左 | 全レシピ共通 |
| ティア・価格 | T4（パック 120 / 補充 60） | 同左 | 素材個別価格なし（`materialShop.ts`） |
| 星ゲート | なし | 同左 | 新しい星ゲートは `ACCEPTED_MIN_SLACK`（slack 1）の監査対象。late 枠が slack に与える影響は、実装 PR で #561 の検出テストを確認 |
| 他 | `lunchRush: false`、CUT なし、key-free、`ladderCredit: true`、cohort の鍵 = cilantro、ladder の late step は**導出**（絶対番号に固定しない） | 同左 | #621 のコメントで確定した規則 |

→ **Owner は「案 A でよい」または案 B / 個別の修正を 1 回答で選べる。**

### D-4 cilantro 専用 SVG（`cilantro-leaf`）

| 案 | 内容 | 前例・注意 |
|---|---|---|
| (a) **同じ PR に SVG を含める**（#611 の推奨） | shiso-leaf、sesame-seeds、pomegranate-aril の型。参照アート `docs/design/references/ingredient-icons-2.0/cilantro.svg` を先に docs で用意し、Style Lock v2 の追記は別の docs-only PR（U3 の運用） | Style Lock の「#423 完了まで Production 実装禁止」は解除済み（2026-10-08、PR #430）。PR が大きくなる（#673 は 50 ファイル） |
| (b) emoji で先に出荷し、SVG は後続 PR | PR を小さくできる | herb 系の葉の emoji は識別しにくい（#611）。G18（ヒントのクラス記号との一意性）を通す emoji の選定が要る。後で見た目が変わる |
| (c) emoji のみ（SVG なし） | 最小 | (b) と同じ識別の問題が恒久化する |

### D-6 8 スロットのリングと FINISH ピースの関係 — **コードの根拠で絞り込み済み**

- `getReferenceSlots(n)` は **n ≤ 8 でリング、n ≥ 9 で複数リングを生成**する（`pizzaReferenceLayout.ts`、RT-01）。**8 は上限ではない。**
- 前例: `IKURA_SALMON_PIZZA_REFERENCE`（非ソース 8 = cream-cheese 2 / salmon 3 / shiso 1 / salmon-roe 2。shiso と salmon-roe は後乗せ）は、**後乗せのピースも `requiredIngredients` の順に同じリングを連続して使う**。
- よって BBQ の 8（cilantro 2 を含む）はそのまま収まる。別の「FINISH 用の枠」は要らない見込み。

| 案 | 内容 |
|---|---|
| (a) 現行どおり 8 ピース（推奨。前例どおり） | Reference は ikura と同じ型。cilantro のスロットは末尾の 2 つ |
| (b) 7 ピース（chicken 2） | D-1 案 B と同じ。余裕を持たせる場合 |

「実測後に再提示」だった D-6 のうち、リング上限の解釈はコードで確定した。**画面上の混み具合の実測は、実装 PR の E2E（390×844 / 360×800）で行う**（ikura の 8 ピースと同条件）。

## 12. DRIZZLE（#579）— docs-only 価値監査の準備

目的: DRIZZLE（FINISH の液体・ペースト対応）という機構投資が、**どの行を実際に解禁するか**を、実装前に行単位で確認する。**この節は準備（手順と入力）であり、監査の実施・結論ではない。**

### 12.1 入力

- 172 品 matrix JSON（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）の `postBakeFinish`、`mechanicEvidence`、`ingredients`、`blockers`、`requiredCapabilities`、`productDecisionStatus`。
- 出荷済みの突き合わせ（§0 のとおり近似。監査では `recipes.ts` / `lateCatalog.ts` と行単位で再確認する）。
- #579 の論点 5 件、#518 → D2-2a の Result（`docs/reports/TETO_FINISH-D2-2A_Result.md`）、#495、OD-CS-11、`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` §4。

### 12.2 対象行（予備の走査、権威ではない）

| 群 | 行数（近似） | 備考 |
|---|---|---|
| はちみつ（hot-honey-pepperoni） | 1 | READY_WITH_REVIEW、根拠 `repo_inference` |
| 液体ソース（buffalo、teriyaki、detroit） | 3 | BLOCKED |
| オリーブ油のサラダ系（p8） | 8 | BLOCKED（`MECHANIC_INTERPRETATION`） |
| オリーブ油 / はちみつ / マヨの仕上げ（時機未特定） | 十数行 | 後乗せかどうかの特定から |

### 12.3 手順

1. 各行を次に分類する: **L0** 固体のトッピングの後乗せ（DRIZZLE 不要、既存の POST_BAKE で足りる）／**L1** 液体・ペーストの後乗せが必須／**L2** 後乗せか焼成前かが未特定（原典・Owner 判断）／**L3** 他の理由で BLOCKED（DRIZZLE の有無に関係なく出荷不可）。
2. L1 の行について、**他のブロッカーを除いたときに出荷できるか**（材料・ベースソース・構成の衝突・他の機構）を確認する。
3. 代替案の評価: 液体を**焼成前の PAINT 工程のソース**として扱う、または**粒状トッピングとして近似**する（U2 の白ごま・U3 のザクロの型）ことで足りる行はないか。DRIZZLE が不要になる行を除外する。
4. 機構コストの見積もり: #579 の 5 論点（FINISH の対象、操作、描画、採点、識別）を、`PLACE_TOPPING` の category 制限・在庫関数・`sauceIds` との関係・Reference の `DRIZZLE` 型（`referencePizza.ts` に型だけある）まで読んで、必要な変更の範囲と Anti-Oracle への影響（late 軸）を書く。
5. 出力: 行ごとの分類表、L1 かつ他ブロッカーなしの行数、代替案で足りる行数、機構コストの粗い見積もり、Owner への質問。

### 12.4 判定の目安（Owner が確認）

- **設計 Gate に進む:** 他のブロッカーを除いて DRIZZLE が必須の行が一定数以上（目安: 3 行以上。Owner が閾値を決める）、かつ代替案で足りない。
- **見送り:** L1 がほぼ BLOCKED のまま、または代替案で足りる。
- **保留:** L2 が多く、原典・Owner 判断が先に要る。

### 12.5 禁止・境界

docs-only。runtime・`recipes.ts`・`lateCatalog.ts`・ladder・golden は変更しない。#673 / #674 に触れない。原典サイトには到達できないため、原典は matrix の引用のみ。

## 13. HOLD 継続（ピアディーナ・月見）

| 項目 | 状態 | 解除に要るもの（Owner 判断。本表では進めない） |
|---|---|---|
| **ピアディーナ（#577）** | 設計 Gate 総合 HOLD（G5 Anti-Oracle のチップ UI、G6 保存互換 `pendingRound` の dough、G7 工程、G8 原典） | `TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md` の質問への回答。本表は**追加の準備をしない** |
| **月見** | 実装保留（OD-B9-8 / 12、DH4 の「その他は到達不能」を緩めない） | OD-DH4-2-9 の改訂 / `other` の再分類 / 構成変更のいずれか（現行方針の範囲外）。本表は**追加の準備をしない** |

どちらも、BBQ の実装・DRIZZLE の価値監査の**前提にも妨げにもならない**（共有ファイルが無い。ただし月見は `deductionProduction.gate`、ピアディーナは `pendingRound` で、同じ領域の変更は競合しうる）。

## 14. #604 / #608 — 完了条件と claim 状態（確認結果）

確認日 2026-10-26。確認した事実のみ。**クローズの判断は Owner。本調査では Issue を変更していない。**

### #608（FIN-E3b）

| 完了条件（Issue の「範囲」1〜6） | 状態 |
|---|---|
| 1〜3 Free トレイ・空トレイ文言・6 タブ | PR **#609 merge 済み**（2026-10-21、Owner が merge） |
| 4 焼成 → FINISH → 完成の E2E（Chromium / WebKit） | #609 に Chromium 20/20 PASS の記載。**WebKit は CI 結果を正とする、と PR に記載（結果そのものは本調査では未確認）** |
| 5・6 失敗時スキップ、在庫二重消費、漏えい、回帰 | #609 のテストに記載（merge 済み） |
| 範囲外とされた「実機 HV（PR の品質確認後に別途 Owner 承認）」 | **実機 HV は未了**。E5（#654、2026-10-24 merge、本番 ON）の実機計測は Owner の iPhone で、R8 は未達・O-12 未了（#621、state-sync §3）。UI の HV は #609 では Owner 承認後の別枠だった |

**判断材料:** コード上の完了条件は満たされ、本番も ON。**残るのは実機 HV の記録のみで、これは #621（AC-8 / O-12 / R8）と state-sync に別途記録がある**ため、#608 自体に追加作業は見当たらない。クローズ可否は Owner（実機 HV の PASS を #608 に紐づけて閉じるか、#621 で追跡して閉じるか）。

### #604（TQ-2）

| 完了条件（Issue の「内容」と「順序」） | 状態 |
|---|---|
| E2 識別と技法（`late` 軸、`late-addition`、near-miss） | PR **#606 merge 済み**（2026-10-21） |
| E3 Free Cooking 仕上げタブ | #607（E3a）・#609（E3b）merge 済み |
| **E4 データ（bbq-sauce / cilantro / ladder / レシピ / Reference / アイコン）** | **一部のみ**: ikura（#627）・柚子えび（#662）・ナス田楽（#669）・#673 のタヒニが late catalog に出荷済み・予定。**Issue が literal に挙げている bbq-sauce / cilantro / BBQ のデータは未出荷** |
| E5 有効化 + 実機 HV | #654 **merge 済み**（2026-10-24、本番 ON）。実機 HV は一部未達（R8 等） |
| 未決定: UD-G（技法名・なぞかけ・Dex 文言） | #621 で確定（#611 のコメント） |
| 未決定: UD-F（新素材の価格・星条件、E4） | BBQ の D-1 で扱う（§11） |
| 未決定: 有効化 OFF ゲートの方式 | 案 1（ビルド時定数）で実装済み |

**判断材料:** E2〜E3・E5 は完了、**E4 の BBQ が残る**。この Issue をクローズする場合は、「BBQ は #611 で追跡する」と明記して閉じるのが整合的（BBQ を #604 の範囲外に出す）。BBQ が出荷されるまで開けておく選択もある。クローズ可否は Owner。

### claim の状態

| Issue | claim（session / ブランチ） | 期限 | 状態 |
|---|---|---|---|
| #604 | `session_01C3raD…`（`fin-e2-tq2-prep`）、`session_01Pdtegc…`（E3a） | 2026-10-24 / 10-25 | **失効**。対応する PR（#606・#607）は merge 済み |
| #608 | `session_01Pdtegc…`（E3b、PR 609） | 2026-10-26 | **失効**。#609 merge 済み |
| #611 | `session_019hxep…`（`late-catalog-foundation`、`recipes.ts`・`lateCatalog*.test.ts` ほか） | 2026-10-28 | **期限内だが実質完了と推定**: 後乗せ基盤は #621（ikura）・#654 の出荷で稼働している。**この claim の PR 番号は記載がなく、基盤 PR（#615）の merge 状態は個別に確認していない**。BBQ の実装前に、`recipes.ts` / `lateCatalog.ts` の HOT 重複として再確認し、必要なら Owner が失効を宣言する |
| #611 | `session_01E7dMx…`（本セッション、Task C、docs のみ） | 2026-11-02 | 有効 |

## 15. 干渉しない範囲（確認）

- 本ブランチが触れるのは `docs/design/TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md` のみ（Issue のクローズ・コメント投稿は別途 Owner の指示で行う範囲だけ）。`recipes.ts`・`lateCatalog.ts`・`ingredients.ts`・ladder・golden・`PROJECT_HANDOFF.md` には触れない。
- #673（U3）・#674（#668）の変更ファイルには触れない。
