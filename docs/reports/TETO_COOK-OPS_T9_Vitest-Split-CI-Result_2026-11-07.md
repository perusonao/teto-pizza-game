# T9 — Draft PR #786（researchAttempt.sim 4 分割）の CI・Codex 結果と、分割前後の CI 実行時間の比較

Status: **Result Report（docs-only）。PR #786 は Draft・merge は Owner 承認待ち。**ゲーム本体・`replayAudit`・CI ワークフロー・`vitest.config.ts` は変更なし。Production ON・共有 Preview 更新なし。
PR: https://github.com/perusonao/teto-pizza-game/pull/786（base main `06cfc06`、head `claude/t9-sim-split-vitest`、**HEAD `ccfbbdebf410a948d12926d3963b0b967ff698e2`**）。
根拠: Owner 決定 #784 コメント 6708018673。前書: `TETO_COOK-OPS_T9_Vitest-Split-Result_2026-11-07.md`（サンドボックスの実測）。

## 0. 結論（先に）

1. **CI は全て成功**（現在の HEAD `ccfbbde`）: `CI`（`build` ジョブ: Lint・Vitest・Build）と `E2E WebKit (Cooking UI 1-Screen)` が **success**。
2. **Codex レビュー**: 同じ HEAD `ccfbbde` で **「Didn't find any major issues」**（指摘 0、未解決スレッド 0）。受領は 14:19:39 UTC。
3. **CI の Vitest ステップ: 分割後 16 分 22 秒（982 秒）**。分割前の同種の run（main 相当のコード）は **19 分 37 秒（#785）・26 分 25 秒（#783）**。最も比較しやすい #785（main ＋純粋ロジック 9 ファイルのみ）と比べて **約 195 秒（約 17%）短縮**。ジョブ全体は **18 分 19 秒**（#785 は 21 分 42 秒）。
4. **サンドボックスの短縮（sim のみ 51%）に比べ、CI の全体の短縮は小さい（約 17%）**。理由: CI では sim の分割後、**別のファイルが支配要因になる**（`replayAudit` 376 秒・1 テスト、ほか）。Owner 決定どおり `replayAudit` の分割と 3 ワーカー向けの再分割は HOLD のまま。

## 1. HEAD・変更差分・claim の確認（PR 作成時）

| 項目 | 確認 |
|---|---|
| main | `06cfc06`（不変。PR 作成前に fetch して確認） |
| ブランチ HEAD | `ccfbbdebf410a948d12926d3963b0b967ff698e2`（`1e6f9689`＋互換ヘルパー 1 コミット） |
| 変更差分（`origin/main..HEAD`） | **5 ファイルのみ**: M `researchAttempt.sim.test.ts`、A `…sim.mainOne.test.ts`・`…sim.sweepFull.test.ts`・`…sim.sweepOne.test.ts`、A `tools/mergeResearchAttemptSimOut.mjs`。ゲーム本体・`replayAudit`・ワークフロー・`vitest.config.ts` は差分なし |
| claim | #784 の統合 claim（コメント 6706450380。`src/logic/researchAttempt.sim*.test.ts`）の範囲内 |
| 他 PR との重なり | 同名テストを触る open PR なし（#783 は共有ヘルパー `testSupport/researchAttemptSim.ts` のみ。本 PR は触れない） |

## 2. 117 テストの同一性と JSON 互換（PR 前の確認）

- 117→117、フルネームと結果が一致（117／117 通過）。生成は元ファイルの文字列を切り出して組み立て、再結合が元と完全一致であることを表明。
- JSON: 4 つの出力を `tools/mergeResearchAttemptSimOut.mjs` で結合すると、**分割前の単一ファイルとバイト一致**（`cmp`）。部品が欠ければ非 0 で終了し何も書かない。
- 下流の調査: `RESEARCH_ATTEMPT_SIM_OUT` を読むのは当該テストのみ（`.github`・`scripts`・`tools`・`package.json` に参照なし）。手作業の利用は Gate C のレポート（`TETO_CONTRACT-2.1_ACTIVATION-GATE-C_Result.md`）のみ。
- **Gate C の担当への通知**: #784（コメント 6708056491）と #363（コメント 6708057057）に投稿。Gate C の追跡 Issue／担当は repo 上に見つからなかった（**Owner 経由の周知を依頼**）。

## 3. CI の結果（HEAD `ccfbbde`）

| チェック | 結果 | 備考 |
|---|---|---|
| `CI`／`build`（run 42380826952、run_number 1335） | **success** | 14:16:34→14:34:53（18 分 19 秒） |
| `E2E WebKit (Cooking UI 1-Screen)`（run 42380827060） | **success** | 14:16:32→14:35:52 頃（ゲームに変更がないため既存のゲートの通過確認） |
| Codex レビュー | **指摘なし**（`has_unresolved_findings: false`、`status: completed`、コミット `ccfbbde`） | 14:19:38 完了 |
| 未解決のレビュースレッド | 0 | |
| マージ状態 | **未確認**（Draft。merge は Owner 承認待ち） | |

## 4. 分割前後の CI 実行時間の比較

`ci.yml` の `build` ジョブ（`ubuntu-latest`）。Vitest ステップの開始〜終了（GitHub Actions のステップ記録）:

| run（PR・HEAD） | コードの内容 | Vitest ステップ | ジョブ全体 |
|---|---|---|---|
| **#785**（run 42361526504、`fdcc21a`）**分割前** | main ＋純粋ロジック 9 ファイル（foldSeal）。**sim は 1 ファイル** | **19 分 37 秒**（1,177 秒） | 21 分 42 秒 |
| **#783**（run 42359065491、`abb3da5`）**分割前** | main ＋ Batch 19（recipe 追加）。sim は 1 ファイル。sim が読むカタログが増えている | **26 分 25 秒**（1,585 秒） | 28 分 34 秒 |
| **#786**（run 42380826952、`ccfbbde`）**分割後** | main ＋ sim 4 分割＋ヘルパー | **16 分 22 秒**（982 秒） | **18 分 19 秒** |

- **比較の妥当性**: 最も近いのは #785（main と同等のカタログ）。**#786 − #785 = −195 秒（−16.6%）**、ジョブ全体で −203 秒。#783 は recipe が増えて sim が重くなっている（Batch 19）ので、分割前の上限側の参考。
- **揺れ**: 同じコードでも CI の runner の差で ±数分の揺れがある（分割前の 2 回が 19.6 分と 26.4 分。内容の差も含む）。**分割後は 1 回だけの観測**。短縮の見積もりは**幅を持って読む**（−17% は 1 サンプルの比較）。
- **サンドボックスとの差**: サンドボックスの sim 単体は 1,293→634 秒（−51%）、Pinsa 閉の全件は 1,124 秒（分割前の標準全件 1,601 秒に対して約 −30%、ただし構成と競合が違う参考値）。CI の全件は**分割前 1,177 秒→分割後 982 秒**で、**短縮幅はサンドボックスより小さい**。CI の runner は CPU 4 でワーカー 3 の可能性が高く（同じ構成）、**sim を分割した後に残るクリティカルパス**（`replayAudit` 376 秒＋他の重いファイル）が全体を支配する。
- 追加の短縮（`replayAudit` の分割・3 ワーカー向けの均衡）は **Owner 決定で HOLD**。本結果が、その判断の材料。

## 5. 未実行・未確認

| 項目 | 状態 |
|---|---|
| CI の Pinsa 閉（`test:pinsa-off`）の実行 | CI には無い（ローカルのみ。サンドボックスで 627 ファイル・11,546 通過・0 失敗） |
| 分割後の CI の複数回の計測 | 1 回のみ（揺れの評価は不十分） |
| 同じ main のコードでの分割前の CI の直接比較（同一 PR 内の before／after） | **なし**（別 PR の run との比較）。厳密にやるなら、同じ内容で sim だけを元に戻した run が要る（行っていない） |
| マージ可否・ブランチ保護のチェック | 未確認（Draft） |
| 実機 | 該当なし |

## 6. 推奨する次工程と Owner 判断事項

1. **PR #786 を Ready にして merge してよいか**（Owner 承認待ち。CI・Codex は HEAD `ccfbbde` で成功）。
2. **`replayAudit` の分割を解除するか**（次の支配要因。376 秒・1 テスト）。CI の短縮を更に 5 分前後伸ばせる見込み（算術）。
3. **3 ワーカー向けの均衡（3 ファイル化／6 ファイル化）**: CI の実測（982 秒）が出たので判断可能。現在 4 ファイル（424／395／243／238 秒）で、sweep 2 本が長い。
4. **CI の `timeout-minutes`・`--shard`**: 現在 18〜26 分で上限に遠い。分割後の CI の複数回の実測を取ってから、という前提でよいか。
5. Gate C の担当への周知（Owner 経由）。

---
_CI・Codex は HEAD `ccfbbde` で成功・指摘なし。CI の短縮は 1 サンプルで約 17%。merge は Owner 承認待ち。_
