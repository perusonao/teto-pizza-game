# 次期レシピ・新工程 優先度表 — BBQチキン vs DRIZZLE ほか（#611 / #579 / #577 / 172品 matrix、docs-only）

Status: **調査と整理のみ。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。merge・deploy・CI 再実行・Monitor 作成なし。新規 Issue は作らず、**#611 に claim** した（2026-10-26）。
基準 `main` = `28f04f4`（食材 73 / レシピ 68）。PR #673（U3、食材 75、Owner HV 待ち・merge 禁止）と #674（#668 の Dex 生エントリ保持）は open。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**
読んだもの: #611（本文 + コメント）、#579、#577 / `TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`、`TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md`、`TETO_STATE-SYNC_2026-10-26.md`、`TETO_NEW-SAUCES-U3_FINAL-DESIGN-GATE_2026-10-26.md`、#604 / #608 の claim コメント、172 品 matrix（`TETO_RECIPE_172_MECHANIC-MATRIX.md` と JSON `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）、`src/data/lateCatalog.ts`。

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
| 4 | **DRIZZLE（ソース後乗せ、#579）** | 新工程（FINISH の液体対応） | 設計論点の整理のみ。前提 #518 → D2-2a は結果文書あり（D2-2 の完了状況は未確認） | 恩恵を受ける行が少なく、しかも BLOCKED（§4）。#495（Scoring）・OD-CS-11 との整合が未決 | **XL（複数 PR）** | まず docs-only の「液体後乗せの価値監査」 |
| 5 | **ピアディーナ**（#577 の 3 値目） | 生地種別の一般化 | 設計 Gate 判定 HOLD（G5 Anti-Oracle・G6 保存互換・G7 工程・G8 原典） | Owner 設計判断 4 件 | M〜L | Owner 決定（G5〜G8） |
| 6 | **月見** | 通常カタログ | **実装保留**（OD-B9-8 / 12。DH4 の「その他は到達不能」を緩めない） | Owner 方針の変更が要る（OD-DH4-2-9 の改訂 / `other` の再分類 / 構成変更） | M | Owner 判断のみ。エンジニアリングでは解けない |

**順位の根拠（要約）:** 1〜3 は**新機構が不要**で、出荷済みの late catalog / 通常カタログの型に乗る。DRIZZLE は機構の新規実装が要るのに、それで解禁される行が現時点で少ない（§4）。ピアディーナと月見は技術ではなく Owner の設計・方針判断待ちで、準備を進めても着手できない。

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

### 4.2 解禁される行の見積もり（matrix、近似）

| 行 | 後乗せの対象 | 状態 |
|---|---|---|
| buffalo-chicken（PIZZA DB 版） | buffalo-sauce（post_bake） | BLOCKED（構成の衝突候補 DIVERGENT、`MULTI_SPREAD_LAYER` も要る） |
| teriyaki-chicken | mayo（post_bake）+ nori | BLOCKED（基底ソース未特定、構成の衝突候補） |
| hot-honey-pepperoni、pesto-noci、burrata 系、crudaiola | はちみつ・オリーブ油（仕上げ） | matrix では `MULTI_SPREAD_LAYER` のみ要とされ、仕上げの時機は**未特定**。READY / READY_WITH_REVIEW だが DRIZZLE が必須かは不明 |

→ **確実に DRIZZLE が必要で、かつ他のブロッカーが無い行は、今のところ確認できない。** 機構を作る投資に対して、すぐに出荷できるレシピが見えていない。

### 4.3 BBQチキン vs DRIZZLE（比較）

| 観点 | BBQチキン | DRIZZLE |
|---|---|---|
| 新機構 | **不要**（late catalog・FINISH は本番 ON） | 必要（FINISH の液体対応、ジェスチャー、描画、採点整合） |
| 出荷できるレシピ | **1**（確実） | 現時点で 0（BLOCKED の 2 行 + 不確定の数行） |
| 規模 | L | XL（複数 PR、Design Gate から） |
| 依存 | #673 merge、Owner 回答、原典の扱い | #518/D2-2、#495、OD-CS-11、設計判断 5 件 |
| 戻しやすさ | late catalog は本番 ON のため merge = 即公開（#673 と同じ運用）。ladder は追記専用 | エンジン変更で影響が広い（Scoring / Hint / Research / save への波及を要監査） |
| 前提の確からしさ | 原典未確認だが、U2・U3 の前例あり | 論点の多くが未決 |

**助言:** BBQ を先に。DRIZZLE は、**docs-only の「液体後乗せの価値監査」**（どの行が本当に液体の後乗せを要するか、行単位の再確認と、はちみつ・オリーブ油の仕上げが `MULTI_SPREAD_LAYER` の範囲で足りるか）を先に行い、価値が見えてから設計 Gate に進む。

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

## 8. Owner 決定事項

| ID | 決定 | 選択肢 |
|---|---|---|
| OD-NR-1 | 次の late catalog 候補は BBQ でよいか | BBQ（推奨）/ わさび牛 / 別候補 / 通常カタログ（カリーヴルスト）を先に |
| OD-NR-2 | 原典未確認での進め方（#611 コメントの「原典確認まで先行しない」と OD-B9-11 / 17 の暫定仕様方針の適用） | 暫定仕様で実装前監査・実装 / 原典確認後 |
| OD-NR-3 | #611 の D-1（数値）・D-4（cilantro-leaf SVG を同梱するか）・D-6（リング上限と FINISH ピース。実測後に再提示） | 各回答 |
| OD-NR-4 | DRIZZLE の扱い | 価値監査（C-2）を先に行う（推奨）/ 設計 Gate を先に / 見送り |
| OD-NR-5 | #579 の前提（#518 → D2-2 の完了、#495 の Scoring 方針）の確認 | Owner / 実装セッションが確認 |
| OD-NR-6 | ピアディーナ（#577）の G5〜G8 | 別途（`TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md` §5〜8 の質問） |
| OD-NR-7 | 月見の保留（OD-B9-8 / 12）を引き続き維持するか | 維持（現行方針）/ 解除方針を決める |
| OD-NR-8 | ベースソース未特定 33 行の扱い（matrix §10 の最大レバー） | 別 Issue で決定 |
| OD-NR-9 | 古い Issue・claim の整理（#604・#608 のクローズ可否、#611 の失効済み claim の release） | Owner 判断 |
| OD-NR-10 | BBQ 実装の着手時期（#673 の merge 後） | 待つ（推奨）/ #673 の head 上で先行 |

## 9. 干渉しない範囲（確認）

- 本ブランチが触れるのは `docs/design/TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md` のみ。`recipes.ts`・`lateCatalog.ts`・`ingredients.ts`・ladder・golden・`PROJECT_HANDOFF.md` には触れない。
- #673（U3）・#674（#668）の変更ファイルには触れない。
