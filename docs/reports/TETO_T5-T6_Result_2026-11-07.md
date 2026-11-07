# T5・T6 Result Report（docs-only、Refs #780 #773）

2026-11-07、main `06cfc06`、branch `claude/teto-pizza-t5-t6-r9qup3`。**docs のみ・新規ファイル 3 本。`src/`・`e2e/`・CSS・golden・既存 docs は未変更。実装・merge・Production ON・共有 Preview 更新なし。**

## 状況（四項目）

- **完了:** 開始確認（CLAUDE.md、PROJECT_HANDOFF の startup checklist、SESSION-OPERATIONS、最新 main、open PR／Issue／claim）。T5・T6 の claim 投稿（別 Issue・別名前空間）。T5・T6 の調査書。
- **未完了:** Research ラベルの再測定（B19 merge 後が必要）。T6 の操作感の検証（実装・実機が前提）。
- **ブロッカー:** なし（docs-only）。T5 の実装は B19（#774、T1）の merge と Owner の B20 GO 待ち。
- **次の行動:** 下記 Owner 判断（まとめて 1 回）。

## 出力ファイル（claim ごとに分離）

| タスク | claim | 出力 |
|---|---|---|
| T5 | #780 コメント 6701869854、`docs/reports/TETO_NEXT-RECIPE_T5_*` | `docs/reports/TETO_NEXT-RECIPE_T5_Honey-Walnut-PestoNoci_2026-11-07.md` |
| T6 | #773 コメント 6701870673、`docs/reports/TETO_COOKING-OP_T6_*` | `docs/reports/TETO_COOKING-OP_T6_New-Process-Design_2026-11-07.md` |
| 報告 | ― | 本書 |

## 既存 claim・PR の確認（侵害なし）

T1（#774 Batch 19: `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`IngredientGlyph.tsx`・`App.css`・golden ほか）／T2（#780: `TETO_POOL-REJUDGE_87_*`・`TETO_DOUGH-KIND_PD1BC_*`）／#772（`TETO_CONTENT-POOL_*`）／#417／#579・#746・#776／#577・#775／#726・#738／#749 のファイルと名前空間に触れていない。#772 と #773 の先行成果物は読み取りのみ。なお #774 では T1 の担当が複数回入れ替わっている（最新の Owner 決定は新担当 `session_016YrGhysskJ41tUDUZwM9gL`）。本作業は T1 に影響しない。

## 実装可能な候補

| 候補 | 内容 | 状態 |
|---|---|---|
| **B20-A（T5）** | honey＋walnut（新食材 2）＋ `pesto-noci-pizza`。新工程なし。Jaccard 最大 0.167（genovese）、同一／部分／上位集合／1 材料差 0、例外なし【main で再測定】 | B19 merge 後に着手可。walnut SVG は #777 で完了（未配線） |
| **FOLD＋SEAL「包む」（T6）** | calzone 等の折って閉じる工程。step は `MakingStep` に予約済み（配線 0）。F0 決定表 → F1 純粋ロジック → F2 Lab → F3 実機 HV の順 | F0 は Owner 判断待ち。F1 は既存 claim と干渉しない |

不可／保留: hot-honey-pepperoni（pepperoni の上位集合）、nduja（salsiccia の上位集合寄り）、nashville・apple-cinnamon・speck-e-brie・radicchio-noci（Owner 判断待ち）、feteer（LAMINATE）、T6 の B 耳に詰める・D 窯で回すは次点。

## Owner 判断（まとめて、推奨つき）

T5（詳細は T5 §7）
1. B20-A を B19 の次に実装するか → **GO（B19 merge 後）**
2. honey は焼成前の第 2 ソース層か後乗せか → 焼成前
3. mozzarella を足すか → 足さない
4. walnut の Hint 5.0 family → 実装時に測定して決める（暫定 `spice`）
5. 非正準順のラベル変化の承認方法 → 実装 PR の正式測定後に 1 件ずつ

T6（詳細は T6 §7）
6. 次の新工程に「包む（FOLD＋SEAL）」を選ぶか → **選ぶ（F0〜F3 まで）**
7. 目的は新しい遊びかレシピ数か → 新しい遊び（初版で出るのは calzone 1 行）
8. 閉じ不足の扱い → 見た目のみで開始
9. calzone の構成 → F0 で決める（原典未確認、暫定）
10. F2 用の共有 Preview 更新 → 都度 Owner 承認（本作業では申請しない）

## 検証状況

docs-only のため HV・動画・スクリーンショットは対象外（HV Policy §2）。テスト・build は未実行。数値はそれぞれ【実測】【先行】【推論】【未確認】でラベル付けした。未確認事項: 原典（pizzadb.jp）の個別ページ、B19 後の Research ラベル、T6 の操作感。
