# FINISH R8 — J-B（pendingRound）実装 結果報告（Issue #617）

- 状態: **merge 済み（PR #618、`83f4b55`）・実機 HV 未了**。本番 FINISH は OFF のまま。共有 Preview は更新していません。実機 HV の準備と手順は `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md`（実施 0 項目）。以下は実装時点の記録で、Owner 条件付き承認（2026-10-22）への対応は本書の該当節を参照
- 前提: PR #616（Save Protection PR-3）merge 済み `376416c`。設計根拠は `TETO_FINISH-R8_ATOMICITY_Fresh-Audit.md`／`..._Design-Verification.md`／`..._Final-Safety-Verification.md`。**これらは `main` に未取り込み**で、ブランチ `claude/finish-r8-atomicity-audit-adt3gx`（先頭 `be431703`）にのみある（取り込みは別判断）
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
| E2E（390×844／360×800 Chromium）: Guided CUT の中でリロード／HOME／確定、Free+FINISH 中のリロード（ゲート OFF で再開）、保存失敗 | `e2e/r8-pending-round.spec.ts`（`test()` 7 本 × 2 プロジェクト＝**14 実行**。初版の「12件」は執筆時点の件数で、最終ではない） |

## 3. 既知の例外・制限（仕様として記録）

1. **Lunch Rush 初回退出の返却**（Owner 判断）: 焼成結果を見てから提供せずに退出すると、そのピザの在庫が戻る。提供済みの分は戻らない。`pendingRound.lunchRush.test.ts` で固定。
2. **Guided で必須の仕上げ工程中に中断**: FINISH 前の journal は「焼成時点の評価」で完了する（仕上げ材料なしの評価）。FINAL 評価だと必須材料不足で失敗扱いになり「消費のみ」になるため。FINISH 中の配置は保存しない（範囲外）。出荷済みレシピに必須 FINISH のものはまだない。
3. **journal 枠は1つ**: 確認前の `settled` や保持中の journal がある間は、CUT/FINISH 付きの焼成は `occupied` で止まる（HOME で確認すれば解除）。保持中の journal は自動では消えない。
4. HOME 離脱の完了を保存できなかった場合: **ラウンドに留まり**（HOME に戻らず）理由を表示する。再度 HOME を押すか再読み込みで完了する（別コンテキストのレビュー指摘で、離脱させると journal が残ったまま次の焼成が `occupied` で止まるため修正）。
5. 書込は成功したが読み戻しが例外になる極稀なケースは失敗扱いになり、同一ページでの再試行は `stale-save` で止まる（再読み込みで journal が完了し、整合は保たれる）。未対応の既知の制限。
6. localStorage に CAS はないため、読み取り→書込の間の他タブ書込は PR-3 と同じ限界（次の書込で検出）。

### Owner 条件付き承認（2026-10-22）への対応
1. **Guided FINISH 中断**: 焼成時点の評価で登録し、通知に「仕上げ前に中断したため仕上げなしで登録（未完成のピザ）」を表示（journal `finishPending`／要約 `unfinishedFinish`）。FINISH 確定後は付かない。**必須 FINISH のレシピ追加時（E4/E5）に再検証する**（本項を Issue #617 と FIN-E5 の前提に残す）。
2. **journal は暫定1枠**。`settled` は HOME の「確認した」で削除できる（E2E で確認）。
3. **読み戻し例外**: 既知の制限として §3-5 に記録。再読み込みで復旧するテスト（`pendingRound.journal.test.ts`「a write that lands but cannot be read back」）が PASS。
4. **解決不能 journal**: 自動削除しない。通知に原因別の「復旧:」手順と、遊べる範囲（CUT など仕上げ工程付き以外は従来どおり）を明示（E2E・`roundNoticeCopy.test.ts`）。

## 4. 検証

- 既存の「App.tsx のソース文字列を検査する」配線／アーキテクチャテスト5件の許可リストを更新（スナップショット構築が `roundCommit.ts`、起動時の構築が `startup.ts` に移ったため）。意図（書き手が限定されること）は維持。
- `tsc -b`、`oxlint`（既存警告のみ）、`vite build` 通過。
- Vitest 全体: 503 ファイル・9279 テスト通過（修正前の最終実行）。Chromium E2E: R8 は 7 本×2 プロジェクト＝14 実行（初版は 12 件と記載していた）と既存の関連 spec 36件が通過。別コンテキストのレビュー（Codex は使えないため代替）: 重大な指摘なし、中程度1件（上記4）を修正、保持 journal 時の案内文を修正。**WebKit はこのコンテナにないためローカル未実行**（CI の webkit-* プロジェクトで要確認）。

## 5. Human Verification（実機項目）

動画（390×844、commit しない）は Owner へ直接提出する運用だった（受領は未確認。所在不明のため再撮影せず、**実機 HV の証跡には数えない**）。スクリーンショットは `docs/reports/screenshots/pending-round-r8/`。
実機で確認してほしい項目: ① CUT 中にアプリを強制終了→再起動で通知が出て図鑑登録・在庫が戻らない、② 保存失敗（ストレージ満杯／プライベートブラウズ）の表示、③ HOME 離脱ダイアログ文言、④ 通知の「確認した」後の再起動で通知が消える、⑤ Lunch Rush 結果画面でのリロード／HOME。

**補足（初版の不足）：** 上記①〜⑤には、保存失敗の種類ごとの確認（`quota`／`unavailable`／`dropped`／`mismatch`／`oversize`／`occupied`／`stale-save`／`load-failed`）、二重登録防止（通知未確認での反復強制終了・連打）、複数タブの競合、解決不能 journal の復旧文言が含まれていなかった。これらは `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` の §5・§5.1 に項目化した。**実機 HV はすべて未実施で、PASS ではない。** Lunch Rush にはブラウザの自動テストがなく、Chromium／WebKit E2E の追加は別 Issue・別 PR（本書の範囲外）。
