# Expansion Batch 10 / PR-1 (通常 5 レシピ) — Owner 決定の記録

Status: **Owner の正式判断を repo に記録する docs**（2026-10-27）。承認は ChatGPT 上で行われ、repo に記録が無かったため、本セッションで転記する。
参照した設計資料（branch `claude/teto-pizza-fresh-audit-wboqxo`、基準 main `08cd46d`）:
`docs/design/TETO_B10_PRE-IMPLEMENTATION-AUDIT_2026-10-27.md`、`docs/design/TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md`（第 3 版）。
原典（pizzadb.jp）は未確認。matrix の記述を原典の事実として断定しない。以下の数値・工程は **GAMEPLAY ASSUMPTION / 暫定仕様**。

## 1. Owner 承認済み（確定）

| 項目 | 決定 |
|---|---|
| PR-1 の対象 | `currywurst` / `curry-pizza-japan` / `rendang-pizza` / `tandoori-paneer-pizza` / `cuban-pizza`（通常 5 件、1 PR） |
| `curry-ketchup` | **新規ソース**（category `sauce`、PAINT）。表示名「カレーケチャップ」。暫定色 `#d9892b`（実機 HV で確定） |
| `mustard` | `sauce` |
| `pickles` | `vegetable`（topping family） |
| `nori` | `vegetable`（**PR-2 向け**。PR-1 では実装しない） |
| 5 件の属性 | すべて `lunchRush: false`、CUT なし |
| Contract 2.1 §15 の再計算 | **PR-1 の Final Gate までに実施** |
| 公開ゲート | **専用ゲートは新設しない**（G-0）。既存の CI・Codex レビュー・HV は維持 |
| merge | **Owner の最終承認なしで merge しない** |
| 担当の分離 | #679（BBQ）・#684 のブランチには触れない |

## 2. 設計資料から確定できる仕様（レシピ別）

材料集合は 172 matrix の `canonicalIngredientIds`、ladder 構成と解禁コストは B10 計画 第 3 版 §「第 3 版の構成」による。

| レシピ id | matrix の材料 | ソース | ladder step（材料 → key） | 解禁コスト |
|---|---|---|---|---|
| curry-pizza-japan | curry-ketchup（※）, chicken, mozzarella, onion | curry-ketchup | `[curry-ketchup]` | 120 |
| rendang-pizza | curry-ketchup（※）, beef, mozzarella, onion | curry-ketchup | `[beef]`（beef の導入役） | 120 |
| currywurst | curry-ketchup, wurstel, mozzarella, paprika-powder | curry-ketchup | `[paprika-powder, wurstel]` | 240 |
| tandoori-paneer-pizza | curry-ketchup（※）, paneer, green-pepper, onion, mozzarella | curry-ketchup | `[paneer]` | 120 |
| cuban-pizza | mustard, pork, ham, pickles, swiss-cheese | mustard | `[mustard, pickles, swiss-cheese]` | 360（暫定承認 E-2） |

※ `curry-pizza-japan` だけが matrix に「カレーソース」の列挙を持つ。`rendang` と `tandoori-paneer` の基底ソースは matrix 上 **未特定**で、curry-ketchup を当てはめるのは **GAMEPLAY ASSUMPTION（D-B3）**。
ladder は step 57〜61 に追記する（既存 step 1〜56 は凍結）。**順序は B10 計画の提案（currywurst → tandoori）ではなく、既存の REC-04 規則（`buildAppendOnlyLadder`、1 材料の step を先）が導く順**とした: 57 `[curry-ketchup]` curry-pizza-japan → 58 `[beef]` rendang-pizza → 59 `[paneer]` tandoori-paneer-pizza → 60 `[paprika-powder, wurstel]` currywurst → 61 `[mustard, pickles, swiss-cheese]` cuban-pizza。解禁コストは各 step で同じ（120 / 120 / 120 / 240 / 360）で、依存（curry-ketchup が最初）も満たす。既存テスト（`discoveryLadder.test.ts` / `discoveryLadder.appendOnly.test.ts`）が規則との一致を検査するため、順序の差し替えは規則側の例外化が必要になり、行わなかった。Owner が計画どおりの順を望む場合は別途指示（規則の例外が要る）。

PIZZA DB evidence id: `curry-pizza-japan-pizzadb-p2` / `rendang-pizza-pizzadb-p14` / `currywurst-pizzadb` / `tandoori-paneer-pizza-pizzadb-p5` / `cuban-pizza-pizzadb-p2`。

## 3. 資料から確定できない事項（推測で埋めず、暫定値として明記する）

| 項目 | 扱い |
|---|---|
| 各材料の個数・配置（8 ピースのリング割り当て） | **GAMEPLAY CALIBRATION**。既存レシピ（#649 など）と同じ「合計 8 ピース」規則で置く暫定値。原典の個数ではない |
| 焼成窓 | 汎用の暫定値 `58–78`（#649 と同じ）。原典のタイミングは未確認 |
| `baseRewardPitz` | 既存の通常レシピと同じ 100 |
| 新材料の emoji・色（`curry-ketchup` 以外） | 暫定（emoji は G18 を通る未使用の字形）。専用 SVG は無し。実機 HV で確認し、見た目の改善は別課題 |
| `mustard` の色 | 資料の例 `#d4b020`（ΔE を計算した仮の値）を暫定採用。HV で `curry-ketchup` との見分けを確認 |
| 材料の `nameJa`（`curry-ketchup` 以外） | 暫定（牛肉・ヴルステル・パプリカパウダー・パニール・マスタード・ピクルス・スイスチーズ）。Owner 確認事項 |
| 吹き出し（order）の文言・レシピ説明文 | 暫定の文言 |
| toppingSizeClass | 暫定（HV で確認） |
| 工程 | 下ごしらえ・後乗せなし。ルンダンの煮込み等は **未モデル化**（資料も記録なし） |
| 新材料の topping family（beef / wurstel = meat、paprika-powder = spice） | 監査 §4.3 の「参考」提案（L1 のみ）を暫定採用。Owner の承認項目（pickles / nori / mustard）には含まれない。G1「ちょうど 1 family」を満たすために必要。Owner 確認事項 |
| mustard と curry-ketchup の色が近い（ΔE 27.4） | HV で確認。結果次第で色を再調整（Owner） |

## 4. 実装時に守る条件（資料より）

- Pinsa ON/OFF 両方で全 Vitest を実行し、結果を PR に記録（OFF は CI で走らない）。
- 旧ビルドで新 save を開いて再保存しても B10 の食材・Dex が落ちないことをテストで固定（#674 の前例）。
- 既存の late 材料の解禁が後退しない（通常 step +5 による late 導出番号のずれ。`LATE_ENTITLEMENT_FLOORS`）。
- Research cohort letter: 既存 recipe の文字を動かさない（`acceptedLetterShifts` は空）。全 cohort 一括の INV-B7 検査と cohort 構成の確認を追加。
- golden（`hint5.ladders55.json`、`hint5.alphaFamilyOnly.json`、DH4 監査 JSON）は生成物として再生成し、既存エントリが byte 同一であることを差分で確認。
- `deductionGuard.gate` の件数 pin は材料別に原因分解し、privacy assertion は緩和しない。

## 5. 残る Owner 事項（PR-1 の範囲外または HV 後）

- 色（curry-ketchup・mustard）、字形、`nameJa` の最終確認（実機 HV）。
- PR-2（late 4 件）の前提 D-B1 / D-B4 / D-B5、公開ゲートの選択。
- goulash・suya は HOLD のまま（構成外）。
