# #394 Phase 2 / PR 2 — 実行時間分析（D4）Result

Status: **実装・自己検証（`--self-test` 67/67、`test-webkit-ci.sh` 154/154、実 Playwright の JSON での実効 timeout の実測）まで完了。CI での実際の出力は、この PR の run と以後の main push で確認する。merge は Owner 承認待ち。**
Branch `claude/issue-394-p2-timing-evidence` / 基準 `main` `5bb18403`（#742）。変更は **`scripts/ci/webkit-shard-evidence.mjs` のみ**（+ 本書）。workflow YAML・`webkit-gate.sh`・`test-webkit-ci.sh`・`e2e/`・`src/` は変更なし（open の #219 が workflow と `webkit-gate.sh` / `test-webkit-ci.sh` を変更しているため、競合させない）。
PR 1（#744、E2E 診断 D1〜D3）とは**ファイルが重ならず、依存しない**。根拠: `docs/reports/TETO_CI_WEBKIT_394_PHASE2_Fresh-Audit_Result.md`（PR 1 に同梱。この PR は参照するだけ）。Batch 17 / PR #743 と Steam S3 / PR #738 には触れていない。

## 1. 何を足したか

| 項目 | 内容 |
|---|---|
| 収集（`collect`） | 各テストの `durationMs`・`timeoutMs`（実効）・`workerIndex`・`startTime` を `executed[key]` に**追加で**記録（`timingOf`）。値が有限の数でなければ入れない（推測しない） |
| 集計（`timingReport`） | shard ごと（テスト数・テスト時間の合計・開始〜終了の実時間・worker 数・最長テスト）、project ごとの偏り（max / mean）、timeout の使用率が高い順の上位 10 件。**shard は最新の attempt のみ**（`verify` と同じ規則） |
| 出力 | `verify` の判定と `Classification:` の**後ろ**に、表で出力（ジョブログと、Gate が step summary に出す内容に入る）。`timing --dir DIR [--top N]` は、ダウンロードした evidence を手元で分析する用 |
| Gate | **合否・終了コード・`Classification:` 行は不変**（集計は判定の後に実行し、失敗しても `Test timing: unavailable` の 1 行のみ） |

## 2. timeout の明示的な上書きの扱い（正しいこと）

- Playwright の JSON の `tests[].timeout` は、worker が終了時に報告する `testInfo.timeout` で上書きされた**実効値**（`playwright/lib/runner/dispatcher.js` の `test.timeout = params.timeout`）。ソースの走査は不要で、誤判定もしない（前回の調査では、ソースの `setTimeout` を走査して推定したため、main に無い spec を既定 30 秒扱いで誤判定しかけた）。
- **実測**（Playwright 1.56.1、Chromium、使い捨ての spec の JSON、2026-11-04）:

| 設定 | JSON の `timeout` |
|---|---|
| 設定なし | 30000 |
| テスト本体内の `test.setTimeout(77_000)` | 77000 |
| テスト本体内の `test.slow()` | 90000 |
| テスト本体内の `test.setTimeout(20_000)` → `test.slow()` | 60000 |
| `test.describe.configure({ timeout: 55_000 })` | 55000 |
| 上記 describe の中で、本体内の `test.setTimeout(66_000)` | 66000 |
| describe 本体内の `test.setTimeout(45_000)` | 45000 |
| `test.skip()` されたテスト | 30000（status `skipped`。集計から除外） |
- 「既定」は、その run で最も多い実効 timeout（最頻値）とし、それ以外は `override` と表示する。上書きされたテストを既定の 30 秒で測らない（例: 480 秒の枠で 40 秒かかったテストは使用率 8% で、LOW ではない）。
- 使用率が 80% 以上のテストに `LOW` を付ける。根拠: 2026-11-03 の run で、同じテストが runner により **中央値 1.46 倍**（p90 は 1.67 倍）遅くなった。

## 3. 検証

| 検証 | 結果 |
|---|---|
| `node scripts/ci/webkit-shard-evidence.mjs --self-test` | **67/67**（既存 55 + 新規 12）。新規: 収集される 4 項目、**実効 timeout の上書き**（既定と別の値で測る）、480 秒の上書きが LOW にならない、skipped と timeout なしの扱い、shard の偏り（max / mean）、**最新 attempt のみ**、旧 evidence（timing なし）は「no timing data」で verify に影響なし、**不正な値は無視され throw せず verify も不変**、**`verify` の結果（ok・classification・problems・rows・totals）が timing の有無で同一（合格・失敗の両方）**、整形、**CLI の `verify` の終了コード・`Classification:` 行が判定どおり（timing は判定の後ろ、合格・失敗、timing の有無の 4 通り）**、**実 Playwright の JSON の値（上の実測）** |
| `bash scripts/ci/test-webkit-ci.sh`（Gate・evidence・install の既存シナリオ） | **154/154 passed**（Gate の判定ロジックは不変） |
| 実 Playwright の JSON での通し | `collect` → `timingReport` → `formatTimingReport` が、実測の 8 件を正しく処理（実効 timeout 30 / 77 / 90 / 60 / 30 / 55 / 66 / 45 秒） |
| evidence の追加フィールド | 既存の `verify` は `status` / `expectedStatus` のみを参照。追加分は 1 テストあたり約 80 バイト（239 件で約 20 KB）の見込み（artifact は 14 日保持） |
| WebKit / CI | PR の CI と main push で確認（Gate は、この変更で判定が変わらないことを self-test で確認済み） |

## 4. 読み方（CI のジョブログ / step summary の末尾）

```
### Test timing (informational -- never part of the Gate verdict)
| project | shard | attempt | tests timed | sum of test times | wall ... | workers | longest test |
Shard balance (sum of test times, max / mean per project): ...
Timeout margin: N of M timed tests carry an effective timeout (default 30.0 s; any other value is an explicit override ...). K used at least 80% of it. Highest use first:
| use of timeout | duration | effective timeout | margin | project / shard | test |
```
- `LOW`: 枠の 80% 以上を使ったテスト。runner が遅い日（約 1.5 倍）に落ち得る。
- 「Shard balance」: 同じ run の中での偏り（max / mean）。1 run の値では偏りの方向は決まらない（run 41750149341 では 390×844 は shard 1 が最重、360×800 は shard 2・3 が同程度）。**5 run 以上蓄積してから判断**（Fresh Audit §5.3）。

## 5. 残る不確実性

- 集計が実際の CI の出力でどう見えるかは、この PR の run で確認する（evidence artifact の追加フィールドの取り込みを含む）。
- shard の偏りと失敗率の関係は、分母（同じ shard の実行回数）がまだ無い。
- `wall`（開始〜終了）は、worker の起動時間などの shard ジョブの前後は含まない。ジョブ全体の所要は workflow の API から別に読む。
- shard の再構成、G-5 / G-6 の分割、timeout・retry・skip の変更は、今回の範囲外（行っていない）。
