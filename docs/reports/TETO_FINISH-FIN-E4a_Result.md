# FINISH FIN-E4a — Free 識別と FINAL 調理の phase 契約の統一（#294 / #604、本番挙動は不変）

base `main` `8f43e93`（FIN-E3b #609 merge 後）。Owner 指示 2026-10-21。E4 のデータ追加（bbq-sauce / cilantro / レシピ / ladder）は **含まない**（Owner 判断待ち、別 PR）。
本番 FINISH は OFF のまま。共有 Preview・#581・#584 には触れない。

## Duplicate Gate（2026-10-21、最新 main `8f43e93` に対して再確認）

open PR 26 件を確認。`freeCook.ts` / `finishEngine.ts` / `finalizeRound.ts` を変更する PR は無い（#478 / #581 / #584 / #468 / #540 / #391 の head を main と比較して確認）。E4a 専用の重複 PR / Issue なし。

## 背景

E3a 独立レビューの low 指摘（E3b でも持ち越し）: Free の識別（`resolveFreeCookPizza`）は pizza 全体でレシピの Completion Gate を判定する一方、FINAL の採点（`finalizeRound`）は `pizzaForFinalEvaluation`（後乗せ要件は FINISH で置いたピースのみで満たす）を通す。識別と調理で phase の契約が揃っていなかった。

## 変更

| ファイル | 内容 |
|---|---|
| `src/logic/discovery/freeCook.ts` | マッチしたレシピの Gate を `pizzaForFinalEvaluation(recipe, pizza)` 経由で判定。テスト用に任意の第 3 引数 `sources`（catalog / getRecipe、既定は従来値）を追加 |
| `src/logic/discovery/freeCook.latePhase.test.ts` | 合成の後乗せレシピ（`RECIPES` には追加しない）で契約を固定 |

## 調査結果と限界（正直な記録）

- 後乗せ要件を持つ本番レシピは 0 件。`pizzaForFinalEvaluation` は後乗せ要件が無ければ**同一の pizza オブジェクト**を返すため、全既存レシピの挙動は不変（テストで固定）。
- 現行 matcher は `late` 軸を集合一致で比較するため、正しく定義された後乗せレシピでは「識別 MATCHED → FINAL で FAILED」は**到達しない**。本変更は、late 軸を欠く誤定義ターゲットに対する**多層防御**と契約の固定である。この条件を欠くターゲットのケースだけが、修正なしでは失敗する。
- `deferFreeCookAtBake`（焼成時の BAKE_FAILED 判定）は `FAILED`（レシピ非依存の完成判定）のみを見るため影響なし。後乗せレシピでの焼成前 pizza は ORIGINAL / INCOMPLETE_MATCH になるだけで、FINISH 画面に何も出ない（Anti-Oracle 維持）。

## 検証（最終 HEAD、コード変更は `freeCook.ts` と新テストのみ）

- `npx tsc -b`: エラー 0。
- `npx oxlint`: 新規警告なし（既存の react-refresh / exhaustive-deps 警告のみ）。
- `npx vitest run`: **498 files passed / 9166 tests passed**（2 skipped、6 todo は既存）。
- E2E: 製品挙動が変わらない（本番レシピに後乗せ要件が無い）ため、新規 E2E は追加しない。既存の FINISH E2E は CI の結果を正とする。
- Human Verification: UI / UX / gameplay の可視変更なし（POLICY の適用対象外）。

## 独立レビュー

別エージェントによる read-only レビュー: **blocker / P1 / P2 なし**。low 2 件:

1. テストの強度（parity と前半のケースは修正なしでも通る）→ テストファイルに「契約固定・多層防御」であることを明記して反映。
2. `catalog.length === RECIPES.length` 等の無関係な断言 → 削除して反映。

加えて、レビュー中にレビュアーが read-only の約束に反して `git stash` を実行し、ゲート実行と時間が重なった。作業ツリーと HEAD は無傷であることを確認し、**ゲートは最終 HEAD で取り直した**（上記の結果）。

## 後続

E4b（データ追加）は `docs` の Owner Decision Report の回答後。UD-F / UD-G / 本番 OFF 方式 / #584 との ladder 順序が前提。
