# #394 — 失敗時の証拠（DOM・待機箇所・スクリーンショット）を CI 成果物に残す Result

Status: **実装・Chromium での自動検証まで完了。WebKit での出力は PR の CI と以後の失敗時にのみ確認できる。merge は行わない（Owner 判断）。**
基準 `main` `5d54bf2`（#752）。変更は **e2e のみ**（`src/`・workflow・`playwright.config.ts`・`scripts/ci/`・timeout・retry・skip・assertion は不変）。Steam #738 / Batch 18 / Fry のコードには触れていない。
重複確認: open PR のうち e2e に触れるのは #746（`e2e/drizzle-lab.spec.ts` のみ）。#394 の他の claim・PR は無く、ファイルは重ならない。

## 1. 何が足りなかったか
- WebKit は `trace: off`。失敗時に残るのはスクリーンショットと `error-context.md`（ARIA）だけで、**失敗した瞬間の DOM（クラス名・結果パネルの状態）** と、**どの操作・locator を待っていたか** は成果物から読めなかった（ページが閉じた場合はスクリーンショットも無い）。
- artifact の blob はこの環境から取得できないことがあり、ジョブログに要点が無いと読めない。

## 2. 追加したもの（失敗したテストだけ）
| 内容 | 場所 |
|---|---|
| `failure-evidence.json`: project / viewport / url / ページ生存 / 残り予算 / 実行中の watched 呼び出し / エラーごとの spec 側スタック（= 待機箇所）と `Call log:`（待っていた locator・操作） / DOM 要約（`.app-frame` 数、`result-panel*` のクラス、dialog、フォーカス、本文冒頭） | `test-results/<test>/`（既存の "Upload failure artifacts" が回収。workflow 不変） |
| `failure-dom.html`: `outerHTML`（200 KB で打ち切り） | 同上 |
| `[diag] failure-evidence ...` のブロック（待機箇所・call log・ページ状態・DOM 要約） | ジョブログ（artifact が読めなくても見える） |
| スクリーンショット | 既存の `screenshot: "only-on-failure"`（不変） |

実装: `e2e/support/failureEvidence.ts`（`test.extend` の auto fixture。teardown で `status !== expectedStatus` のときだけ動く）。読み取りは全て 3 秒で打ち切り、例外は握りつぶす。通常（成功）時は何も書かず、待たない。`TETO_E2E_DIAG=0` で停止。
適用範囲（import を `./support/failureEvidence` の `test` に変更するだけ）: #394 に事例のある 6 spec — `discovery3-oracle-neutralization` / `lunch-rush-r8-restore` / `sauce-oil-over-519` / `cooking-tray-family-expanded` / `expansion-batch7a` / `discovery-hint-sheet`。他の spec へは同じ 1 行で広げられる。

## 3. やっていないこと（禁止事項の遵守）
trace の常時取得・video・timeout 延長・retry 増加・skip・全テストの繰り返し・assertion/Gate の変更は **無し**。`diag.ts` には読み取り専用の `inFlightLabels()` を 1 つ追加しただけ。

## 4. 検証
| 検証 | 結果 |
|---|---|
| 合成ページの回帰 `e2e/failure-evidence.spec.ts`（7 本 × 2 viewport） | 14/14 pass: DOM・待機箇所・call log の取得、閉じたページ（1.5 秒以内、待機箇所は残る）、応答しないページ（3 秒で打ち切り）、attach 失敗が漏れない、`TETO_E2E_DIAG=0`、成功扱いでは動かない判定 |
| 実フィクスチャの失敗実行（使い捨て spec、削除済み） | 失敗時のみ `failure-evidence.json` / `failure-dom.html` / スクリーンショットが `test-results/` に出る。成功テストは何も出ない |
| 既存診断 `gestures-diag.spec.ts` | 36/36 pass（変更なし） |
| import を差し替えた spec | `discovery3-oracle-neutralization`（390）9/9 pass 含む 24 pass / 22 skip（既存の viewport skip）。`--list` の対象テストは差し替え前後で同一（新規は上記 7 本のみ） |
| `tsc -b` / `oxlint` | エラー 0、新規警告 0 |
| WebKit | この環境では実行不可。PR の CI で確認 |

## 5. 残る不確実性
- WebKit 本番で実際にどう出るかは、失敗が再発するまで未確認。成功時に何も出ないことは PR の CI（0 行）で確認する。
- `page` が閉じた失敗では DOM は取れない（待機箇所・call log・実行中の呼び出しのみ）。
- 原因の特定ではない。再発時に「半描画か、待機の取りこぼしか」を切り分ける材料を残すだけ。
