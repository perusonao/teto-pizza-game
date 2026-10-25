# Save P1-1 (#664): 保持された pendingRound の「退避→確認→破棄」— Result Report

- 日付: 2026-10-25 / 基準 main: `a54098350af7c4c2ca33db415487bcec4cabfb42`
- Issue: #664（Refs #560 / #617）。Owner 承認: 設計（2026-10-25）。
- 種別: UI 追加（HOME の保持通知にボタン＋確認ダイアログ）。ゲーム進行・採点・保存形式は変更なし。

## 1. 何を変えたか
保持された journal（`unknown-version` / `corrupt` / `unresolvable` / `oversize`）は削除されず、枠を埋めて `occupied` を起こします。これにより FINISH 本番 ON 下のフリー／リサーチ全焼成と、CUT／FINISH 付きのガイド付き調理が止まっていました（P1-1）。HOME の通知から、保存全体を退避してから journal だけを破棄できるようにしました。

| ファイル | 内容 |
|---|---|
| `src/state/heldJournalDiscard.ts`（新規） | `inspectHeldJournal`（読み取りのみ）、`discardHeldJournal`（退避→検証→除去→検証） |
| `src/state/saveQuarantine.ts` | `QuarantineKind` に `"held-journal"` を追加（型と検証のみ。挙動は不変） |
| `src/state/roundNoticeCopy.ts` | ダイアログ・失敗・完了の文言。保持通知の復旧文言を更新 |
| `src/components/RoundSaveNotices.tsx` | ボタンと `HeldJournalDiscardDialog` |
| `src/App.tsx` | `held` を state 化、ハンドラ、ダイアログ描画（最小） |
| `src/App.css` | ダイアログの `max-height` と縦スクロール（短い画面用） |

変更していないもの: `writeSave`、`commitProgress`、`journalMayChange`、`readStoredPendingRound`、`schemaVersion`、通常の保存処理、reducer、Dinner、Lunch Rush、R4/R5。

## 2. 動作（`discardHeldJournal`）
1. 保存テキスト R を読む。PR-3 のセッション（`stale-save` / `load-failed`）、読める保存か、journal が**今も held** で、**ダイアログに見せたものと同一**か（reason と canonical JSON）を確認。`pending` / `settled` / なしは拒否（`not-held`）。
2. R の**全文**を `<保存キー>.held-journal.quarantine-v1.first|latest` にコピーし、読み戻して一致を確認（既存 `quarantineRaw`）。`first` は維持。`latest` の置換は、ユーザーが確認した場合のみ（`replace-not-confirmed`）。
3. 書く直前にもう一度保存を読み、R と違えば中止（`stale-during-discard`）。
4. R をパース→`pendingRound` キーだけ削除→再直列化して `setItem`（サニタイザ・マイグレーション・マージは通さない）。読み戻して一致を確認し、`noteSaveWritten`。
5. 失敗時に保存へ R を書き戻す処理は**ない**（別タブの保存を上書きしないため）。退避は残る（再実行は duplicate 扱い）。

退避できない（容量・書き込み失敗・読み戻し不一致・256K 文字超）場合は何も破棄しません。

## 3. UI・誤操作防止
- ボタンは HOME の保持通知にのみ表示。ラウンド中は開けない。ダイアログは保存を新しく読んで作る（起動時のメモリ値は使わない）。
- 初期フォーカスは「キャンセル」、外側タップでは閉じない。実行ボタンはすべてのチェックが入るまで無効、実行中は無効。
- `unknown-version` / `unresolvable`: 赤字の強い警告（対応版で開けば自動完了できる／登録されない）＋「完了できた可能性」のチェックを追加。`latest` を置き換える場合は第3のチェック。

## 4. 保証と限界
- journal 以外の保存値が不変であることをテストで固定（deep-equal、キー順、未知トップレベル、Dinner 記録、`researchExclusions`、golden 7 世代、他キー、保存自身の quarantine キー）。
- 再直列化のため、**値は同一だが JSON の空白・数値の書式は正規化される場合がある**。バイト単位の完全一致は退避コピー側で保証。
- localStorage は compare-and-swap を持たない。手順3の再読み込みと手順4の `setItem` は別呼び出しで、その間に別タブが書いた場合は**この操作では検出できない**（次の書き込みで PR-3 のガードが検出する）。完全な競合防止は保証しない。
- 復元 UI は含まない。退避の復旧は開発者による手動。

## 5. テスト結果
| 区分 | 結果 |
|---|---|
| `heldJournalDiscard.test.ts`（33） | PASS。4 reason、golden 7 世代、容量不足／脱落／読み戻し不一致、256K 超、`setItem` 例外→再実行、読み戻し不一致で書き戻さない、別タブ（stale-save／stale-during-discard）、退避枠（first 維持・latest 要確認・失敗時復元）、`pending`／`settled`／なし／読めない保存／load-failed の拒否、二重操作、`occupied` 解消後の CUT 焼成 |
| ミューテーション 5 本（退避検証なし／held 以外も除去／書く直前の再読なし／書き戻し／置換確認なし） | すべてテストが失敗＝検出 |
| `App.heldJournalDiscard.test.tsx`（4） | PASS |
| Vitest 全体 | 528 ファイル PASS・9732 テスト PASS（13 skipped、4 todo）。`tsc -b`、`npm run lint`（既存警告のみ）、`npm run build` OK |
| Chromium E2E（`held-journal-discard.spec.ts` 6 本 × 2 viewport） | 12/12 PASS |
| 既存回帰（Chromium 390×844＋360×800）: `r8-pending-round`、`lunch-rush-r8-restore`、`lunch-rush-material-shortage`、`save-protection-pr2/pr3` | 50/50 PASS（上記と合わせて） |
| WebKit | このコンテナでは未実行（CI の WebKit shard が判定） |
| 実機 HV | **未実施**（Owner 待ち。§6） |

## 6. Owner HV 手順（隔離 Artifact）
Artifact「Held Journal HV Bench」（URL は PR 本文）は、このブランチのビルドを別 origin で動かします。**本番・共有 Preview・実データには触れません**（Artifact の localStorage は専用）。
1. ベンチでシナリオを選ぶ → 「ゲームを開く」。ホームに保持通知とボタンが出る。
2. 「この記録を退避して破棄…」→ ダイアログ（`unknown-version` は強い警告とチェック2つ）。キャンセルで何も変わらないことを、ベンチの「更新して表示」で確認。
3. チェックして実行 → 通知が消え「調理の記録を破棄しました」。ベンチで、`pendingRound: なし`、退避 first に「journal を含む」、pitz / onion / 図鑑が不変なことを確認。
4. ピザを作る（CUT のあるレシピ、フリー調理の FINISH）→ 焼けること。再読み込みしても通知が戻らない。
5. 「退避の書き込みを失敗させる」を ON → 実行すると「何も破棄していません」、ベンチで `pendingRound: あり`。
6. 「退避が2枠埋まっている」→ 第3のチェック（最新の置き換え）が出る。
7. 動画（390×844、人が追える速度）を Owner 自身が撮影・確認。前後スクリーンショットは `docs/reports/screenshots/p1-1-held-journal-discard/`（before は main）。

## 7. 既知の限界・未確認
- 実 iOS の容量超過・実機の強制終了は未確認（自動テストは模擬）。
- WebKit はコンテナ外の CI で初回確認。
- 保持通知の「他タブ」は、ダイアログ表示後の別タブ更新を `stale-save` で拒否するが、検出と書き込みの間の競合は残る（§4）。
