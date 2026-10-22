# FINISH R8 — J-B（pendingRound）実装 結果報告（Issue #617）

- 状態: **実装済み・Owner 承認待ち**（merge・共有 Preview 更新・本番 FINISH 有効化はしていません）
- 前提: PR #616（Save Protection PR-3）merge 済み `376416c`。設計根拠は `TETO_FINISH-R8_ATOMICITY_*.md`（ブランチ `claude/finish-r8-atomicity-audit-adt3gx`）
- ブランチ: `claude/issue-617-finish-r8-x2qavm`。`src/data/**`（#615）・#584 は変更していません

## 1. 仕様（実装した内容）

| 項目 | 実装 |
|---|---|
| 保存形式 | トップレベル任意キー `pendingRound`（`schemaVersion` 2 のまま）。`pendingRound` のないセーブは従来とバイト同一（既存 golden 無修正） |
| 焼成確定（CUT/FINISH あり） | 消費後在庫＋`pending` journal を**同一 `setItem`**。`commitProgress`（読み戻し一致確認）が `ok` のときだけ dispatch |
| 焼成確定（CUT/FINISH なし） | journal を作らず、消費＋登録を1回の保存で確定 |
| 保存失敗 | `failed(quota/unavailable/dropped/mismatch/oversize/occupied)`、保護による拒否 `blocked(stale-save/load-failed…)`。**BAKE のまま止め**、理由を表示。「保存せず続行」なし |
| journal 上限 | 64 KB（UTF-8 バイト数）。超過は書かずに停止 |
| 起動時／HOME 離脱 | 同じ純関数 `settlePendingRound`。在庫は変更しない、効率ボーナスなし。Dex／Pitz／素材／技法と `settled`＋要約を**1回の保存**で書く |
| 通知 | `settled` を確認まで保持（確認で journal 削除）。HOME に表示 |
| FINISH→CUT | FINISH 確定時に journal を `finished` 付きで再書込（FINISH 材料の消費と同一書込） |
| 解決不能 journal | 削除せず原文保持し通知（未知版／破損／未知の材料・レシピ／上限超過）。保持中は journal の要る焼成を止める |
| Lunch Rush L-1 | 提供受理まで消費を保存しない（保存は焼成前在庫＋差分）。提供以外の退出は**メモリも**焼成前に戻す。RESTOCK と合成可。Dinner 不変 |

主なファイル: `state/pendingRound.ts`（型・読み取り）、`state/pendingRoundSettle.ts`、`state/roundCommit.ts`（焼成／工程／HOME／確認の同期コミット）、`state/startup.ts`、`state/persistence.ts`（`commitProgress`、journal 書込）、`state/gameReducer.ts`（`pendingRound`、`unservedConsumption`、`ADOPT_STATE`）、`App.tsx`、`components/RoundSaveNotices.tsx`、`state/roundNoticeCopy.ts`。

## 2. 受け入れ条件の対応

| 条件 | テスト |
|---|---|
| 行列（Guided 非CUT／CUT×2／FINISH／FINISH+CUT／Free+FINISH／Research × 焼成直後・工程中・確定直前・確定直後）で「消費⇔登録」 | `pendingRound.matrix.test.ts` |
| パリティ（手動で最後まで進めた結果と一致） | 同上、`pendingRound.journal.test.ts` |
| 冪等・再起動／保存失敗の反復で二重登録なし・`settled` 再実行拒否 | `pendingRound.journal.test.ts` |
| 登録結果と journal 状態が同一 `setItem` | 同上（書込回数と内容を検査） |
| 読み戻し・容量・無効化・サイズ超過・保護拒否で停止 | 同上 |
| 旧ビルド／複数タブ／解決不能 journal の保持 | 同上 |
| Guided FINISH→CUT の途中状態 | `pendingRound.matrix.test.ts` |
| HOME 離脱＝再起動の結果一致 | 同上 |
| Lunch Rush L-1（既知の例外を含む） | `pendingRound.lunchRush.test.ts` |
| E2E（390×844／360×800 Chromium）: Guided CUT の中でリロード／HOME／確定、Free+FINISH 中のリロード（ゲート OFF で再開）、保存失敗 | `e2e/r8-pending-round.spec.ts`（12件） |

## 3. 既知の例外・制限（仕様として記録）

1. **Lunch Rush 初回退出の返却**（Owner 判断）: 焼成結果を見てから提供せずに退出すると、そのピザの在庫が戻る。提供済みの分は戻らない。`pendingRound.lunchRush.test.ts` で固定。
2. **Guided で必須の仕上げ工程中に中断**: FINISH 前の journal は「焼成時点の評価」で完了する（仕上げ材料なしの評価）。FINAL 評価だと必須材料不足で失敗扱いになり「消費のみ」になるため。FINISH 中の配置は保存しない（範囲外）。出荷済みレシピに必須 FINISH のものはまだない。
3. **journal 枠は1つ**: 確認前の `settled` や保持中の journal がある間は、CUT/FINISH 付きの焼成は `occupied` で止まる（HOME で確認すれば解除）。保持中の journal は自動では消えない。
4. HOME 離脱の完了を保存できなかった場合: **ラウンドに留まり**（HOME に戻らず）理由を表示する。再度 HOME を押すか再読み込みで完了する（別コンテキストのレビュー指摘で、離脱させると journal が残ったまま次の焼成が `occupied` で止まるため修正）。
5. 書込は成功したが読み戻しが例外になる極稀なケースは失敗扱いになり、同一ページでの再試行は `stale-save` で止まる（再読み込みで journal が完了し、整合は保たれる）。未対応の既知の制限。
6. localStorage に CAS はないため、読み取り→書込の間の他タブ書込は PR-3 と同じ限界（次の書込で検出）。

## 4. 検証

- 既存の「App.tsx のソース文字列を検査する」配線／アーキテクチャテスト5件の許可リストを更新（スナップショット構築が `roundCommit.ts`、起動時の構築が `startup.ts` に移ったため）。意図（書き手が限定されること）は維持。
- `tsc -b`、`oxlint`（既存警告のみ）、`vite build` 通過。
- Vitest 全体: 503 ファイル・9279 テスト通過（修正前の最終実行）。Chromium E2E: R8 12件（390×844／360×800）と既存の関連 spec 36件が通過。別コンテキストのレビュー（Codex は使えないため代替）: 重大な指摘なし、中程度1件（上記4）を修正、保持 journal 時の案内文を修正。**WebKit はこのコンテナにないためローカル未実行**（CI の webkit-* プロジェクトで要確認）。

## 5. Human Verification（実機項目）

動画（390×844、commit しない）は Owner へ直接提出。前後スクリーンショットは `docs/reports/screenshots/pending-round-r8/`。
実機で確認してほしい項目: ① CUT 中にアプリを強制終了→再起動で通知が出て図鑑登録・在庫が戻らない、② 保存失敗（ストレージ満杯／プライベートブラウズ）の表示、③ HOME 離脱ダイアログ文言、④ 通知の「確認した」後の再起動で通知が消える、⑤ Lunch Rush 結果画面でのリロード／HOME。
