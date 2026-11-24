# Vitest 高速化（即効策）Result Report

日付: 2026-11-24 / 状態: ローカルコミットのみ（push・PR・merge なし）

## 1. 事前確認
- 開いている PR（約 50 件）のタイトルと、CI 関連の #219 のファイル（先頭 30 件）を確認。`ci.yml` / `vitest.config.ts` に触れるものは確認できなかった（#219 は `e2e-webkit.yml` のみ）。**Owner Gate の実行・claim の確認はしていない**（Actions 実行権限なし）。
- Draft の他 PR の変更ファイルの網羅確認はしていない。

## 2. フル Vitest が完了しなかった原因（調査 約 20 分）
- 停止ではなく**遅いだけ**。`--reporter=verbose` で 840 秒時点に 12,749 件中 11,695 件が完了（残りは replayAudit 等）。メモリは約 1.4GB/16GB で余裕、CPU は 4 コア飽和。
- 初回に出力が空だったのは、非 TTY のデフォルトレポーターが途中経過を出さず、バックグラウンド上限（30 分）に当たったため。
- 長いテスト（単体テスト時間の累計）: researchAttempt.replayAudit 約 620s（既知値）、researchAttempt.sim 404s / sim.mainOne 399s / sim.sweepFull 306s / sim.sweepOne 88s、deductionGuard.gate 186s、deductionProduction.gate 89s、discoveryHintEconomy.sim 57s、stagedWhatIf.research 42s。これらは #811 の範囲で、本作業では手を付けていない。
- 以上によりフル Vitest の前後比較は不可。**案1（部分計測）に切替**（承認済み）。

## 3. 計測範囲と制約（前後で同一条件）
- 範囲: `src/logic` + `src/data` の `*.test.ts(x)` 288 ファイル（`handOn`/`handOff` と上記の重いファイルを除く）。ファイル一覧を明示列挙して実行。
- 注: vitest v5 のプロジェクト構成では CLI の `--exclude` / `--environment` が効かなかったため、ファイル列挙方式にした（最初の 2 回の試行は無効として破棄）。
- 各 1 回の実測（ノイズは未評価）。環境: 4 vCPU / 16GB。

| | ファイル | テスト | 所要時間（Duration / 壁時計） |
|---|---|---|---|
| 変更前 | 288（287 passed, 1 skipped） | 5,216 passed, 12 skipped | 106.9s / 108s |
| 変更後 | 288（287 passed, 1 skipped） | 5,216 passed, 12 skipped | 76.4s / 78s |

- 件数は不変。短縮は約 29%（範囲内のみ。フル実行・CI 全体の値ではない）。
- 追加で、node 候補 194 ファイルを同条件で比較する予定だったが、CLI の環境指定が無効だったため比較値は採用しない。

## 4. 変更内容
### タスク1・3（コミット 1: `vitest.config.ts`, `tools/nodeEnvTests.txt`）
- `pool: "forks"`、`maxWorkers = min(8, CPU数-1)` を明示（4 vCPU の CI では既定と同じ 3。理由はコメント）。
- node 環境: `tools/nodeEnvTests.txt`（203 ファイルの許可リスト）を `node` プロジェクトで実行し、`default` プロジェクトから除外。新規テストは従来どおり jsdom。
- 選定基準: `src/logic` / `src/data` の `*.test.ts`（`.tsx` は除外）のうち、`window|document|localStorage|sessionStorage|navigator|jsdom|HTMLElement|@testing-library|render(|?raw|.tsx|requestAnimationFrame|Element|Event(|matchMedia|Storage|fireEvent|vi.stubGlobal|globalThis|location|screen|Audio|Image(|canvas|setup` を含まないもの。
- node プロジェクトが実際に `window` なしで動くことをプローブ（`typeof window === "undefined"`）で確認済み（プローブは削除）。
- jsdom に戻したファイル: 範囲内の node 化では**なし**（範囲内の 5,216 件はすべて通過）。ただし、リストの重い 9 ファイル分（sim/gate）は本計測の範囲外で、node での通過は**未検証**。CI のフル実行で確認が必要。
- フラグ変種プロジェクト（hand-on-9/12・hand-off）と `test:pinsa-off` は変更なし。

### タスク2（コミット 2: `.github/workflows/ci.yml`, `scripts/ci/test-ci-docs-only.sh`）
- `vitest` ジョブ（matrix 3 分割、`npx vitest run --shard i/3`、各シャードで checkout SHA 検証・docs-only 判定・docs-only 時のスキップ）と、常に結論を出す `Vitest Gate`（`needs: vitest`、`if: always()`）を追加。
- `build` ジョブは `needs` なしのまま、Vitest ステップだけ外した（シェル系テスト → lint → build の順序は維持）。
- 固定テスト `test-ci-docs-only.sh` の不変条件を更新（`build` から `npm test` を外す・新ジョブの存在確認を追加）。49/49 通過。`test-webkit-ci.sh` 154/154 通過。
- **⚠ 要 Owner 対応: Branch protection に `Vitest Gate` を required check として追加するまで、Vitest の失敗は merge をブロックしない**（`build` は Vitest を含まなくなったため）。追加前に merge しないこと。
- `needs` で `build` を shard に依存させなかった理由: 依存先の失敗で `build` が skipped になり、required check が通過扱いになり得るため。
- 実際の GitHub Actions 上の動作は未検証（YAML 構文のみ確認）。

## 5. シャードの偏り
- `--shard` は相対パスの SHA-1 ハッシュで並べ替え、ファイル数を均等に分ける（各 228 spec）。ファイルの重さは考慮されない。
- 重いテストの割当（ソースの規則から計算した推定値）: shard 1 に replayAudit（約 620s）・sim.mainOne（約 399s）・sim.sweepOne・deductionProduction.gate（累計約 1,196s）、shard 2 に sim・discoveryHintEconomy.sim（約 461s）、shard 3 に sweepFull・deductionGuard.gate・stagedWhatIf.research（約 534s）。
- shard 1 が明確に偏る。壁時計は shard 1 の最長ファイル（replayAudit 約 620s）が下限になる見込み。対処は #811 の範囲のため未実施。

## 6. 残課題
1. 範囲外の重い 9 ファイルの node 環境での通過確認（CI のフル実行）。
2. `Vitest Gate` の branch protection 登録（Owner）。
3. CI 上のシャード別実測時間の取得と、偏りの再評価。
4. フル Vitest の前後比較（CI 実測、または時間制限のない環境で）。
5. Owner Gate・claim の確認（未実施）。

## 7. PR #878 の CI で shard 2/3 が失敗した件（追記 2026-11-24）
### 初回実行（Actions run 45386250448, attempt 1, コミット e929da0）
- shard 1/3 成功（23分15秒）、shard 2/3 **失敗**（13分28秒）、shard 3/3 成功（18分51秒）、Vitest Gate 失敗（shard 2 の失敗を正しく集約）、build / WebKit / Layout Contract 成功。
- shard 2 の集計: 228 ファイル中 2 失敗、4,539 件中 3 失敗（4,532 passed / 4 skipped）。3 件とも**タイムアウト**で、アサーション失敗ではない。

| ファイル | テスト | エラー |
|---|---|---|
| `src/state/gameReducer.deductionHint.test.ts:121` | DH4-2B 構成: every target: a fresh request charges exactly the fixed price (5) once… | Test timed out in 5000ms |
| `src/state/gameReducer.deductionHint.test.ts:149` | DH4-2B 構成: legacy「材料は全部で○種類」owner… | Test timed out in 5000ms |
| `src/state/gameReducer.selectableHint.test.ts:532` | privacy (matrix 33-35) 35 Rule W: the reserved ingredient is never revealed… | Test timed out in 60000ms |

### 切り分け
- **a（node 環境起因）: 除外。** 失敗は `default`（jsdom）プロジェクトで発生し、2 ファイルとも `tools/nodeEnvTests.txt` に含まれない。
- **b（フレーク）寄り。** 根拠: (1) 失敗がすべてタイムアウト（アサーション不一致なし）、(2) 同じ shard で `researchAttempt.sim`（534秒）と `discoveryHintEconomy.sim`（85秒）が同時に走り、4 vCPU を競合していた、(3) ローカル診断でも `gameReducer.selectableHint` の単体テストは約 30 秒かかり、60 秒の上限に近かった（§2）、(4) **同一コミット・同一コードの失敗ジョブ 1 回再実行（attempt 2）で shard 2/3 が成功**（8分50秒）、Vitest Gate も成功。
- **c（今回の変更が原因）: 完全には否定できない。** シャード分割で同時実行されるテストの組み合わせが変わったため、タイムアウトの起きやすさに影響した可能性がある。再実行は 1 回のみで、再現率・頻度は未測定。したがって「フレークと確定」ではなく「フレーク寄り（要継続観察）」とする。
- 補足: 同コミットの shard 2 は attempt 1 が 13分28秒（失敗）、attempt 2 が約 9 分（成功）で、実行時間も大きくぶれた（ランナーの CPU 競合の影響を示唆）。

### 対処
- コード・テスト・設定は**変更していない**（テストの削除・skip・タイムアウト緩和・フラグ変種・branch protection への操作なし）。失敗ジョブの再実行のみ 1 回。
- 再実行後の CI 結果: vitest shard 1/3・2/3・3/3 すべて成功、Vitest Gate 成功、build 成功。

### 残課題（追加）
- 重いテストの偏り（shard 1 / 2）と CPU 競合によるタイムアウトのリスクは、#811（重い sim 系の nightly 分離）と合わせて扱うのが妥当。この PR では未対処。
- 以後の CI で同種のタイムアウトが再発する場合は c を疑い、シャード数・並列度・個別タイムアウトの扱いを Owner と相談する。
