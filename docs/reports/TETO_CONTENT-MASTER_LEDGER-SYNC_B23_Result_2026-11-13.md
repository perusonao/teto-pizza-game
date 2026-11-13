# 全量台帳の B23 同期（Result Report、docs のみ）

- 日付: 2026-11-13 / Issue: #780 / 基準: main `3bed288`（#833 merge 直後。カタログ・ladder は B23-b 後の状態から不変）
- 範囲: 台帳 10 ファイルの再生成と生成器 `gen.py.txt` の更新（本書を含む docs のみ）。`src/**`・`e2e/**`・`tools/**`・HOT・golden・staged は未編集
- Owner 判断（2026-11-13）: B23 台帳同期は docs-only の独立 PR として進めてよい／台帳には Production 104 レシピ・122 食材、staged 73 レシピ・47 食材、nduja reserved 1 件を正確に反映する／`tools/train-kit/targets.json` の notes 訂正は #833 の claim 保有者に依頼する（別セッションから直接編集しない）

## 1. 台帳の内訳（生成器の出力、`verification.json` の checks 全 PASS・FAIL 0）

| ライン | Production（出荷済み） | staged | reserved | 合計 | 残り | 進捗率 |
|---|---:|---:|---:|---:|---:|---:|
| レシピ | **104** | **73** | 0 | 177 | 73 | 58.8%（104/177） |
| 食材 | **122** | **47** | **1（nduja）** | 170 | 48 | 71.8%（122/170） |
| 調理法／工程候補 | 実装済み 7（部分実装 7） | — | — | 27 | 20 | 25.9%（7/27）。部分実装を含めると 51.9%（14/27） |

- レシピ 177 の内訳: SHIPPED 104／WAITS_MECHANIC 44／STOP_D6_RESEARCH 10／NEEDS_D1_EXCEPTION_JUDGEMENT 10／NEEDS_D2_SOURCE_RESEARCH 8／NEEDS_OWNER_DECISION 1【`recipes.csv` の state 集計】
- 食材 170 の内訳: SHIPPED 122／CANDIDATE_ACTIVE 41／CANDIDATE_ALIASED_PROVISIONAL 5／CANDIDATE_MERGED_PROVISIONAL 1／**RESERVED_OWNER_APPROVED 1（nduja）**【`ingredients.csv`】
- 調理法: IMPLEMENTED 7／PARTIAL 7／UNIMPLEMENTED 4／HOLD 1／ADOPTION_UNDECIDED 6／DUPLICATE 2＝27【`progress` の出力。本 PR では methods の行は変えていない。#840（PAN_PROFILE）・#841（STEP_ORDER）は Draft で未 merge のため状態は不変】
- 追加数（Issue #780 作成時 2026-11-07 のスナップショット 90 レシピ／97 食材 → 現在）: レシピ **+14**、食材 **+25**。直近の列車は B23-a（+1 レシピ・+1 食材）、B23-b（+2 レシピ・+5 食材。`nutella-spread` は `chocolate` に統合）

## 2. 今回の変更

1. **基準の更新**: 台帳の基準 main を `4c275c2b`（レシピ 101／食材 116）から `3bed288`（104／122）へ。B23 着地の 3 品（`apple-cinnamon-dessert`、`nutella-dessert-pizza`、`smore-dessert-pizza`）が SHIPPED。
2. **`nutella-spread` の統合**: `chocolate` への統合として扱う（独立食材ではない）。生成器に `MERGED_I = {"nutella-spread": "chocolate"}` を追加し、「統合された候補は出荷・staged のどちらにも独立して存在しない」「統合先は出荷済み」を検査する。matrix の行 `nutella-dessert-pizza-pizzadb-p6` は出荷済み `nutella-dessert-pizza` に対応づけた（`matrix-map.json`）。
3. **nduja（170 番目）の予約**: 生成器に `RESERVED_I`（Owner 確定・未登録）を追加し、台帳の食材に `RESERVED_OWNER_APPROVED` の 1 行として載せた（使うレシピ `nduja-pizza`、最初に要る列車 T26-R1、「staged に追加しない・T26 の実装 PR で登録」と明記）。新しい検査: ① staged の食材数＝170−出荷済み−予約＝47、② 予約食材は出荷済みにも staged にも存在しない（**staged への未承認の追加を機械的に拒否**）。**`src/data/staged/**` は編集していない。**
4. **固定値の更新**: ① 「staged の食材＝170−122＝48」は「−予約 1＝47」に。② 食材の総数検査は「出荷済み＋staged＋予約＝170」に。③ 「plan の 73 候補＝staged＋出荷済み」は「＋統合（nutella-spread）」を許容し、nduja が plan に無いことも検査する。これらは「Owner の更新対象」とされていた固定値で、**Owner の 2026-11-13 判断（件数の正確な反映）に基づく**。
5. **照合先の変更**: `catalogLedger.test.ts` は #833 で導出式になり、件数の固定値が無くなった。生成器の「パース結果の照合」は、同じ独立した 2 つの記録（`frozenBaseline.json`＋`src/trainKit/landed/*.json`）の合計（101+3＝104、116+6＝122）と比べる形にした。カタログ自身とは比べない。
6. **再現性**: 生成器を再実行し、出力が commit 済みのファイルと**バイト単位で一致**することを確認した。

## 3. 範囲外にしたもの

- `tools/train-kit/targets.json` の notes（「空いた枠を squid に割り当てた」→ 170 番目は nduja）の訂正は、#833（merge 済み）の claim 保有者 `session_016YrGi37Ao1hchMZc25Zvtn` の領域。**別セッションの私は編集しない**。保有者への依頼を #780 に記載する（§5）。`progress` コマンドの notes 表示が古いままになる点だけが残る。
- methods の行（FRY の F2 前拡張〔#839〕、PAN_PROFILE〔#840〕、STEP_ORDER〔#841〕）の更新は、それらの merge 状態と Owner の採用判断に依存するため、本 PR では変えない。

## 4. 検証

- 生成器: `python3 -I docs/reports/data/TETO_CONTENT-MASTER_gen.py.txt . <out>` → checks 全 PASS（FAIL 0）。再実行で出力一致。
- `node tools/train-kit/cli.mjs progress`（この変更の作業ツリー上で実行）: 「Master ledger generator … all checks PASS」。進捗表は食材 122／staged 47／目標 170／残 48／`unplanned` 1（＝staged 行が無い目標枠 1 件、すなわち予約の nduja）、レシピ 104／73／177／73／0、調理法 7／20／27／20／0。`targets.json` の notes には「squid が枠を埋めた」という古い記述が残る（§3、保有者に依頼）。

## 5. 次の依存条件

| 項目 | 条件 |
|---|---|
| 本 PR の merge | Owner の判断（Draft・docs のみ）。CI と独立レビューの結果を PR に記録 |
| `targets.json` の notes 訂正 | #833 の claim 保有者へ依頼（#780 に記載）。保有者が対応しない場合は Owner の指示 |
| T24 の HOT 実装 | ① #833 merge 後の **main の Gate 成功**（main `3bed288` の push 後 CI／WebKit が成功）、② T24 の新規 HOT claim、③ preflight の再実行（43 ID・正準 0） |
| nduja の staged 追加 | **しない**（Owner が明示する場合のみ）。登録は T26 の実装 |
