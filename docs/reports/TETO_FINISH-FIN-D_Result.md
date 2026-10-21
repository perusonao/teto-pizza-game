# FINISH FIN-D — 焼成 → FINISH → RESULT の統合検証（本番では不活性、#294）

base `main` `7c0af3b`（FIN-C #602 merge 後）。Owner 指示: FIN-D のみ。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` は無変更）。
FIN-E の実装・本番有効化、共有 Preview 更新、#518 close、新レシピ・新食材、#478 / #581 / #584 等の変更は行っていない。reducer・`finishEngine`・在庫ロジック・save schema・レシピは無変更。

## Duplicate Gate

- open PR 24 件を再確認（#587 / #584 / #581 / #540 / #478 / #468 …）。FINISH の統合検証・FINISH ヒント文言・`finish-screen` ハーネスを触る PR・Issue・claim なし。Issue 検索（FIN-D / FINISH）も、関連は #294 / #518 / #495 / #579 / #463 のみで FIN-D 自体の重複なし。
- 変更ファイルは FINISH 専用（`finishHint.ts`、e2e ハーネス/spec、新規 test）。HOT ファイル（`GameScreen.tsx` / `App.css` / `gameReducer.ts`）は触らない → #478 / #468 / #584 / #581 と競合しない。

## 監査結果（読み取り + 実測）

| 項目 | 結果 |
|---|---|
| 状態遷移 | `CONFIRM_BAKE`（焼成範囲内）→ `POST_BAKE/FINISH`（`bakeValue` を保持）→ `CONFIRM_MAKING_STEP` → RESULT（または CUT）。焼成失敗は FINISH を飛ばして RESULT（OD-CS-7）。Lunch Rush / Dinner / Free Cooking は FINISH に入らない |
| 在庫消費 | 焼成前の piece は `CONFIRM_BAKE` で、後乗せ piece は FINISH を離れる FINAL で、各 1 回。FINISH 中の配置・Undo は在庫に触れない（e2e: 配置後も在庫 3 のまま → 完成後 1） |
| 最終スコア | FINAL は FINISH を離れる遷移の 1 回だけ。同じ遷移で `bakeValue` を null にするため 2 回目は no-op。実 Reference を持つレシピ（margherita の basil を後乗せ化した test 変種）で、FINAL のスコア = 単発評価のスコア、暫定スコアより高い、後乗せ 0 個は FAILED、を確認 |
| Undo | 後乗せの直近 1 個のみ。連続 Undo は 0 個で止まり、焼成前 piece は不変。再配置後の完成で消費は残った配置数ぶん |
| 完成 | 二重押下は reducer のガードで no-op（`dblclick` で在庫・Dex・Pitz が 1 回） |
| 在庫不足 | 在庫 1 で 2 個目は置けず、消費は 1 個。完了ゲートは「各食材 1 個以上」（`recipe` ポリシー）なので 1 個で PASS、`minCount` は Scoring 2.0 の品質側（既存契約どおり。バグではない） |
| 調理時間 | 計測時間（`completedMs`）は `START_BAKE` で確定し、FINISH の滞在は `perStepElapsedMs.FINISH` のみ。RESULT で `activeStep` が閉じる（CUT と同じ既存契約。FINISH 15 s でも `completedMs` 20 s のまま） |

## 発見と修正（1 件・最小）

**FINISH のヒントが存在しないボタンを案内していた。** `READY_FINISH_HINT` / `NO_LATE_FINISH_HINT` が「「次へ」で進もう」と言うが、FINISH のバーのボタンは「完成」（FIN-A の既知事項「FIN-C で解消」が未解消のまま）。両文言を「「完成」で進もう」に変更し、`finishHint.test.ts` を更新、e2e でヒントが「完成」を案内し「次へ」ボタンが無いことを固定。Free Cooking の `FREE_COOK_FINISH_HINT`（FINISH UI を持たず到達しない）は変更していない。

## 追加・変更

| ファイル | 内容 |
|---|---|
| `src/state/gameReducer.finishFlow.test.ts`（新規 8 件） | PREPARE → BAKE → FINISH → RESULT → DISCOVERED の通し（正常 / 後乗せ 0 個 / 連続 Undo・再配置 / 在庫不足 / 焼成失敗 / 計測時間 / 既存全レシピが FINISH に入らない / 実 Reference での最終スコア・Dex・Pitz 1 回）。`finalPatch` の `score` を外すと最終スコアのテストが落ちることを確認 |
| `e2e/harness/finish-screen.{tsx}` | `?start=bake`（BAKE から開始）、`window.__confirmBake(value)`（決定的な焼成）、`window.__actions()`（dispatch の記録）を追加。既存クエリの挙動は無変更 |
| `e2e/finish-flow-find.spec.ts`（新規 8 件 × 2 viewport） | 実 `GameScreen` + 実 reducer で、BAKE の実ボタン表示 → FINISH → RESULT。正常完成（連打）/ 後乗せ 0 個 FAILED / 連続 Undo・再配置 / 在庫不足 / 焼成失敗は FINISH を飛ばす / CUT 付き / ヒント文言 |
| `src/data/finishHint.ts` + test | 上記の文言修正 |
| `tools/finishFlowFinD{Shots,Video}.mjs` | 撮影ドライバ（dev のみ） |
| `docs/reports/screenshots/fin-d-finish-e2e/` | 390×844 / 360×800 × 6 場面（BAKE / FINISH 空 / 後乗せ 2 / RESULT 成功 / RESULT 後乗せ 0 個 FAILED / 焼成失敗で FINISH を飛ばす）。FINISH 画面は新規のため before なし。文言修正の before は FIN-C の `fin-c-finish-undo-complete/`（「次へ」表記） |

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | PASS |
| oxlint | 新規警告なし（既存警告のみ） |
| vitest 全体 | 492 files PASS / 1 skipped、9082 tests PASS（2 skipped, 6 todo は既存）。FIN-C 時点（9074）から +8（`gameReducer.finishFlow.test.ts`）。`finishHint.test.ts` は期待文言のみ更新 |
| FINISH の e2e（`finish-flow-find` / `finish-bar-finc` / `finish-screen-fina` / `finish-tray-finb`、両 viewport） | FIN-D 7 件時点で 4 spec 計 60 PASS、ヒント文言の 1 件を足した最終の `finish-flow-find` は 16 PASS（8 件 × 2 viewport） |
| 既存 e2e 回帰（cut-skip-failed-bake / dinner-mission / dynamic-cooking-steps / free-cooking-phase3-2 / lunch-rush-material-shortage / lunch-rush-result-ranking-phase4 / making-step-tabs-cs4a / post-layer-d22a / square-pizza-bake-d2b1 / square-pizza-cooking-d2a2 / undo-placement-449 / viewport-1screen / bake-free-just-520、両 viewport） | 187 PASS / 3 skipped（既存） / 0 failed。丸いピザ・四角いピザ・CUT・Free・Lunch Rush・Dinner を含む |
| 実 WebKit | 未確認（このセッションは Chromium のみ）。required CI の WebKit shard で確認 |

注: 初回の全体 vitest は e2e と同時に走らせたため 5 件が 5 秒 timeout（負荷由来）、2 件は文言修正の途中状態との競合で失敗した。単独で再実行して全 PASS。

## 本番有効化に進めるかの判断材料

- **進めてよい点**: 通し（焼成 → FINISH → RESULT）で在庫消費・最終スコア・Dex / Pitz がそれぞれ 1 回、Undo / 再配置 / 二重完成 / 在庫不足 / 後乗せ 0 個 / 焼成失敗がすべて想定どおり。既存レシピ・既存モードの回帰なし。調理時間の契約は CUT と同じで不変。
- **残存リスク（Owner 判断が必要）**:
  1. FINISH を使う実レシピが `RECIPES` にまだ無い（`finishD2Inert` が固定）。本番有効化の前に、後乗せ要件を持つ最初の実レシピと、その Reference pizza（後乗せ食材を含む）・Hint・難易度が別途必要。Result 画面の実表示（★・Pitz・点数）は fixture が Reference を持たないため 0 点 / +20 Pitz と出る（スクリーンショット 4）。実レシピでの確認は FIN-E の範囲。
  2. 後乗せ 0 個の「完成」は確認ダイアログなしで FAILED（Owner 決定どおり）。誤タップの救済は無い。UX として許容するかは Owner 判断。
  3. 実 WebKit / 実機は未確認。
  4. Issue #495（後乗せ要件を除いた暫定スコアの評価）は未着手: FINISH 中の暫定スコアは画面に出ないため現状は無害だが、将来ライブ表示する場合は再検討が必要。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `fin-d-finish-e2e-390.mp4`（H.264） | 390×844 | 67.2 s | 917 KB | PASS |
| `fin-d-finish-e2e-360.mp4`（H.264） | 360×800 | 66.0 s | 877 KB | PASS |

Download: セッション内直接提出（commit しない。Policy §6。`artifacts/review/` は gitignore 済み）。ffprobe で codec / 解像度 / 長さ、ffmpeg で最後までのデコード、代表フレームの目視で確認。

確認できること（字幕つき）:
- 正常完成: BAKE → 取り出す → FINISH（在庫まだ減らない）→ 後乗せ 2 個 → 完成（連打）→ RESULT（成功）。
- 後乗せ 0 個: 確認なしで RESULT（失敗）、在庫は減らない。
- 連続 Undo 3 回 → 後乗せ 0 個で ↩ 無効 → 再配置 → 完成。
- 在庫 1: 2 個目は置けない・選択解除。
- 焼成失敗（生焼け）: FINISH を飛ばして RESULT（失敗）。
- CUT 付き: 完成 → CUT。Lunch Rush / Dinner / Free Cooking では FINISH 画面が出ない。

Video Verification: PASS

## Final Gate（PR 作成時点）

required CI（WebKit shard 含む）・Codex レビュー・独立レビュー・未解決スレッド・mergeability は PR 作成後に確認して別途報告する。merge は Owner の明示承認を待つ。
