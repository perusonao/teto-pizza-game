# #394 Phase 2 / PR 1 — E2E 診断（D1〜D3）Result

Status: **実装・自動検証（合成ページ、既存 spec、Chromium 両 viewport）まで完了。WebKit での挙動は PR の CI と以後の main push でのみ確認できる。merge は Owner 承認待ち。**
Branch `claude/issue-394-p2-e2e-diag` / 基準 `main` `5bb18403`（#742）。変更は **e2e のみ**（本番コード `src/`・workflow・timeout・retry・skip・assertion は変更なし）。PR 2（D4、`scripts/ci/webkit-shard-evidence.mjs`）とは**ファイルが重ならず、依存しない**。Batch 17 / PR #743 と Steam S3 / PR #738 には触れていない。
根拠: `docs/reports/TETO_CI_WEBKIT_394_PHASE2_Fresh-Audit_Result.md`（本 PR に同梱）。

## 1. 何を足したか

| # | 内容 | ファイル |
|---|---|---|
| D1 | 診断部品（新規）: watchdog `watched()`、ページ生存確認 `probeMainThread()`、残り予算、ポインタ記録 `installPointerTrace()` / `readPointerTrace()`、CUT の確定確認 `reportCutCommit()`、`reloadApp()` / `reloadPage()`、`observePageLifecycle()` | `e2e/support/diag.ts` |
| D2 | `page.mouse.move / down / up` を、操作名つきの診断付き呼び出し（`diagMouse`）に置き換え（`tap` / `squeeze` / `squeeze-path` / `dough` / `drag` / `cut` / `cut <角度>°`）。CUT は、ポインタ記録の開始と、3 本（または 1 本）の確定数の確認を追加 | `e2e/gestures.ts` |
| D3 | `reloadApp(page, label)`（`page.reload()` + `waitForSelector(".app-frame")` と同一の 2 呼び出し）。まず `lunch-rush-r8-restore`（4 箇所）・`dinner-settlement-dm4-3`（1 箇所）に、`cooking-prep` は `reloadPage`（reload のみ、直後の待ちは従来のまま） | 該当 3 spec |
| 検証 | 合成ページの回帰テスト 18 本（Codex の指摘への対応で 12 → 18） | `e2e/gestures-diag.spec.ts` |

## 2. 診断専用であることの保証（通常時の挙動を変えない）

- **結果・例外・timeout を素通し**: 包んだ呼び出しの戻り値と reject はそのまま。watchdog は読むだけ（タイマー、`page.isClosed()`、境界つきの `page.evaluate` 1 回。その結果は例外も含めて握りつぶす）。タイマーは `unref`。
- **通常時は無音**: 行が出るのは、(a) 呼び出しが 8 秒（`TETO_E2E_DIAG_PENDING_MS`）を超えて未完了、(b) 3 秒（`TETO_E2E_DIAG_SLOW_MS`）以上かかって完了、(c) renderer の crash、(d) 呼び出しの最中にページが閉じた、(e) CUT の線が想定数だけ確定しなかった、のときだけ。`TETO_E2E_DIAG=0` で全て止まる。
- **待ちを挿入しない**: 通常経路に sleep・追加 timeout・retry・skip・assertion は無い。CUT の確認は、増分が揃っていれば 1 回の読み取りで即終了（遅れた React の反映のためだけ、揃わないときに最大 1 秒待つ。それは診断のためで、テストの成否は変えない）。
- **ポインタ記録**: capture 段階・passive のリスナーで、イベントを止めない。CUT のヘルパでのみ開始。
- 出力先は stderr（`[diag] ...`）= CI のジョブログ（artifact が読めない環境でも読める）。

## 3. 読み方（`[diag]` の行）

| 行 | 意味 | 見る点 |
|---|---|---|
| `<gesture> mouse.up: still pending after 8.0s (page closed: false; main thread answered in 23ms; test budget left 12.3s)` | 入力呼び出しが戻らない。ページは生きていて main thread は応答している | プロトコル側の停止（`Input.dispatchMouseEvent` 型）の疑い |
| `... main thread silent for 2000ms` | ページが応答しない | renderer の停止 |
| `... page closed: true` / `page closed while N call(s) were pending: ...` | 呼び出しの最中にページが閉じた | どの呼び出しか（label） |
| `<label>: took 3.4s (test budget left ...)` | 戻ったが遅い | 枠の消費（G-5 / G-6 型）か、個別の停止か |
| `<label>: page.reload: ...` と `<label>: waitForSelector(.app-frame): ...` | reload の 2 呼び出しのどちらが遅いか | 応答停止か枠の消費か（残り予算で判断） |
| `cutThreeLines: 0 of 3 cut line(s) committed (marks 0 -> 0; ...) Last pointer events:` + 直近 20 イベント | `mouse.up` は成功したが線が登録されない | `down` 後の `move` の届き方、`pointercancel` の有無（アプリは `g.dragging && g.cutPath` のときだけ線を確定する） |
- 残り予算は、テストの開始時刻を Playwright 1.56 の内部値（`_startWallTime`）から読む。無い場合は最初の診断呼び出しからの経過で数えるので、残りを多めに見積もる（`~` を付けて表示）。

## 4. 検証

| 検証 | 結果 |
|---|---|
| 合成ページの回帰（`gestures-diag.spec.ts`、Chromium 390×844 / 360×800） | **36/36 passed**（18 本 × 2）: 健全時は無音・同じ戻り値・同じ reject、`TETO_E2E_DIAG=0`、停止の報告と再報告（最大 3 回）と遅い完了の 1 回の記録、ページ状態の 3 判別（応答 / 沈黙 / 閉じている）、閉じるページの命名と通常終了時の無音、reload の健全時の無音と停止時の報告、**CUT: 旧ヘルパ本体との逐イベント比較で同一**（`pointerdown` / `pointermove` / `pointerup` の型と座標）と、ページが線を捨てたときの 1 行の報告 |
| 既存 spec（影響確認） | `gestures-helper` / `lunch-rush-r8-restore` / `dinner-settlement-dm4-3` / `cooking-prep` / `pizza-cutting-phase4b` / `cut-home-leave-confirm` / `making-ui-1screen` / `finished-pizza-visual-2.0` / `dynamic-cooking-steps`（両 viewport、4 workers）: 114 passed / 12 skipped / 6 failed。**失敗はすべて 30 秒枠の spec**（G-4/5/6 と `making-ui-1screen:424`）で、この sandbox は過負荷（通過した G 系の所要の中央値が 29 秒、CI の健全時は約 16〜18 秒） |
| 切り分け（基準 `5bb18403` と同一の e2e で、同じ spec・同じ条件・同じ回数） | 基準: 34 passed / 10 failed、PR 1: 33 passed / 11 failed。**同じテスト（G-4/5/6）が両方で落ち**、通過したテストの所要の中央値は 29.1 秒と 29.2 秒。残りの 1 件の差は 30 秒枠の境界でのばらつき |
| 低負荷での所要の比較（1 worker、390×844、各 4 回、全件 pass） | G-1: 基準 平均 11.35 秒 / PR 1 10.95 秒。CUT を含む `pizza-cutting-phase4b` Scenario A: 11.03 秒 / 10.82 秒。**診断のオーバーヘッドは検出されない**。健全時の `[diag]` は両方 0 行 |
| `[diag]` が実際に出た例（過負荷の sandbox） | `lunch-rush-r8: page.reload: took 3.1s (test budget left 2.8s)` ほか。reload は応答しているが遅く、残り予算がほぼ無い = **「応答停止」ではなく「枠の消費」** であることが、この診断で読み取れた |
| 型 / lint | e2e の 6 ファイルを `tsc --strict` で確認（エラー 0）、`oxlint` は警告 0、`tsc -b` エラー 0 |
| WebKit | **この環境では実行できない**。PR の CI（6 shard）で確認する |

## 4.1 Codex レビュー（`4b69b13`、P2 が 2 件）への対応

| 指摘 | 確認 | 対応 |
|---|---|---|
| ライフサイクル監視が `reloadApp()` にしか付かず、mouse だけの spec では、ページが閉じても行が出ない | **実在**（`diagMouse` / `watched` は `observePageLifecycle` を呼んでいなかった） | `watched()` の入口で `observePageLifecycle(page)` を呼ぶ（ページごとに 1 回、観察のみ）。イベント非対応のページ代役でも壊れないよう防御。テスト: `watched` だけで「呼び出しの最中に閉じたページ」が命名される、通常終了時の close は無音、crash がその場で出る、イベント非対応の代役でも動く |
| CUT の診断の読み取り（`cutMarkCount`・`readPointerTrace`・`installPointerTrace`）に上限が無く、`mouse.up()` の後にページが応答しないと、診断が test の予算まで待つ | **実在**（`COMMIT_POLL_LIMIT_MS` は sleep だけを制限していた） | 3 つの読み取りを `bounded()` に通し、最大 2 秒（`TETO_E2E_DIAG_READ_MS`）で打ち切る（reject と無応答は「読めなかった」）。`reportCutCommit` は、読めなければ `the page did not answer a diagnostic read after the gesture` の 1 行を出して戻る（停止の説明になる）。テスト: 応答しないページで 3 つの読み取りが上限内に戻る、reject するページ、`reportCutCommit` が上限内に戻って 1 行出す、カウントだけ答えるページ |

## 5. 残る不確実性

- WebKit 本番で `[diag]` が実際にどう出るかは、停止が再発するまで分からない（診断は、再発したときに止まった位置を残すためのもの）。
- 診断呼び出しの追加（タイマーと microtask の分）による影響は、Chromium の低負荷で検出限界以下だったが、WebKit では未測定。
- `page.waitForTimeout` を使う CUT の確定確認（最大 1 秒）は、`page.clock` を導入済みの状態でも Node 側の実時間で動く。fake clock のテストでの影響は、既存 spec の通過で確認した範囲のみ。
- `reloadApp` の導入は 3 spec のみ。reload は 58 箇所・38 spec にあり、必要に応じて広げる。
- G-5 / G-6 の分割、shard の再構成、timeout・retry・skip の変更は、今回の範囲外（行っていない）。
