# main の WebKit E2E 間欠失敗の記録（2026-11-09、docs-only、Refs #780・#394・#680・#562）

2026-11-09 に main への push で `E2E WebKit (Cooking UI 1-Screen)` が **attempt 1 で失敗し、同じコミットの再実行（attempt 2）で成功**した事例を記録する。Owner の依頼は「flake 2 件」だったが、実測では**本日の main で 4 件**あった（うち 1 件は既存の #680 と同じテスト）。**原因は確定していない**。下の「仮説」は確認すべき点であり、結論ではない。**テストの skip・タイムアウトの延長・assertion の弱化はしない**（#680 の扱いと同じ）。コード・テスト・CI 設定は変更していない。

凡例: 【実測】Actions のログ・テストコードの読取り、【未確認】測っていない。

## 1. 4 件の事実【実測】
| # | run（attempt 1 の job） | 対象コミット／変更の性質 | project・shard | テスト | 失敗の形 | 再実行の結果 |
|---|---|---|---|---|---|---|
| 1 | 42602225667（job 129109384550、10:38–10:55 UTC） | main `e74383b4`＝#799（B21、late カタログのデータ） | webkit-360x800 shard 3/3 | `e2e/square-dough-corners.spec.ts:221`「#536 C: a cancelled gesture never takes an announced step back」 | **assertion**: `expect(tested, "a stroke that crosses the coverage bar was found").toBe(true)` が false（257 行）。タイムアウトではない | attempt 2 で成功 |
| 2 | 42638507110（job 129233214187、14:50–15:10 UTC） | main `35a97228`＝#798（docs とデザート SVG の未配線） | webkit-390x844 shard 2/3 | `e2e/lunch-rush-r8-restore.spec.ts:154`（G-6、HOME を押して離脱） | **30 秒のタイムアウト**: `locator.click` が `getByRole('button', {name:/ホーム/})` の "waiting for element to be visible, enabled and stable" で止まる（164 行） | attempt 2 で成功 |
| 3 | 42646794971（job 129262287370、15:39–15:54 UTC） | main `1d5f5a1e`＝#776（DRIZZLE D1、未配線の純粋ロジック） | webkit-390x844 shard 1/3 | `e2e/cooking-prep.spec.ts:479`「early / overdone: nothing is kept until you choose …」 | **30 秒のタイムアウト**: `getByTestId('cooking-prep-use').click()`（503 行）が "element is not enabled"（`aria-disabled="true"`）を 50 回以上繰り返して終了 | attempt 2 で成功 |
| 4 | 42652010863（job 129280828692、16:12–16:26 UTC） | main `719428e0`＝#800（tortilla-chips の SVG 配線） | webkit-360x800 shard 2/3 | `e2e/gestures-helper.spec.ts:153`「paintSauceRing does not wait for a dough box that never holds still …」 | **teardown のタイムアウト**: `Tearing down "context" exceeded the test timeout of 30000ms` → `browserContext.close: Test ended.`。同 shard の他 247 件は成功 | その job のみ再実行（attempt 2）で成功 |

- **#2 は #680 と同じテスト**（G-6）。#680 は `lunch-rush-r8-restore.spec.ts:147`（現在は 154 行に移動）を追っている。再現は 390×844 shard 2/3 で、#680 の観測と一致する。**本記録の新規は #1・#3・#4**。#2 は #680 の観測を 1 件増やす（#680 への追記は Owner の判断。本書では Issue を編集していない）。
- 4 件とも、**失敗したコミットの変更はこれらのテストの経路に触れていない**: #798 は docs と未配線の SVG、#776 は未配線の純粋ロジック、#799 は late カタログのデータ、#800 は tortilla-chips の SVG 配線。ただし「変更と無関係」は再実行で通ったことからの推論であり、**原因の特定ではない**。
- 4 件とも **WebKit のみ**（Chromium の layout ジョブは成功）。失敗した shard の実行時間は約 14〜20 分（#1 は 15.7 分、#3 は 14.0 分、#4 は 13.6 分、#2 は約 20 分）。
- `WebKit Gate` は shard が 1 つでも失敗すると失敗する（本日の 4 件とも Gate が失敗し、再実行で解消）。

## 2. 発生箇所と再現条件（わかっている範囲）【実測＋未確認】
### #1 square-dough-corners.spec.ts:221（webkit-360x800）
- テストは 4 つの角をなぞった後、13 本の横線（`rows` 配列）を順に引き、「指を下ろしたまま被覆率が 0.95 以上かつ確定済みの STEP が 1」になる線を**探す**。1 本も見つからないと 257 行の assertion で落ちる。
- 失敗は**タイムアウトではなく探索の不成立**。`liveCoverage >= 0.95 && committedStep === "1"` が 13 本すべてで偽だった（被覆率が足りなかった、または準備の 4 つの角で既に STEP 2 に進んでいた）のどちらかだが、**どちらかは未確認**。
- 失敗時の添付: スクリーンショット `test-failed-1.png` と `error-context.md`（artifact 名は `playwright-webkit-test-results-<project>-shard<N>-attempt1` の形。#4 のログで確認した命名から類推した名前: `…-webkit-360x800-shard3-attempt1`）。**未確認**: 失敗時の被覆率と STEP の値は本書では見ていない。
- 再現条件: WebKit CI のみで観測（ローカルでは WebKit を動かせないため未確認）。1 回の attempt 1 で発生し、attempt 2 は成功。

### #2 lunch-rush-r8-restore.spec.ts:154（webkit-390x844）— #680 と同一
- #680 の記述どおり。HOME のクリックが「visible, enabled and stable」で 30 秒止まる。#680 の調査項目 1〜6 が未了。

### #3 cooking-prep.spec.ts:479（webkit-390x844）
- テストは `page.clock`（仮想時計）で時間を進める（`runFor(1000)`・`runFor(300)`・`runFor(6000)`・`runFor(300)`）。「これで使う」は焼き加減を判定してから 300 ms 後に有効になる（`data-armed`）。
- 失敗は、**最後の `runFor(300)` の後も「これで使う」が無効（`aria-disabled="true"`）のまま**で、30 秒クリックを待って終了した。仮想時計を進めても無効のままだった理由は**未確認**。
- 失敗時の添付: スクリーンショットと `error-context.md`（同じ命名の `…-webkit-390x844-shard1-attempt1`）。**未確認**: 失敗時の `data-armed`・`data-grade` の値。

### #4 gestures-helper.spec.ts:153（webkit-360x800）
- このテストは `test.setTimeout(30_000)` を指定し、ダミーの CSS アニメーション（`[data-pizza-drop-target]` を 7 ms 周期で無限に往復させる）をページに足して `paintSauceRing` を実行する。
- 失敗は、テスト本体ではなく**終了時の `browserContext.close`** が 30 秒に収まらなかった形（ログ上、本体の assertion の失敗は無い）。ブラウザのログには、約 7 秒おきに WebKit の MiniBrowser の `automation is not allowed in the context` の警告と、GPU ドライバの警告（`ZINK: vkCreateInstance failed`）が繰り返されている。
- 再現条件: 360×800 の shard 2/3（247 件通過）。同じ spec ファイルの他のテストは通過。

## 3. 既存 Issue との関係【実測】
- **#680**: `lunch-rush-r8-restore.spec.ts` G-6 の間欠失敗。#2 が該当。#1・#3・#4 は**別のテスト**で、別の shard や別の viewport（#680 は 390×844 shard 2/3 のみ観測）。本書は #680 と**別に**記録する。
- **#394**（WebKit cooking E2E の間欠失敗の総括）／**#562**（別 spec の 30 秒タイムアウト）: 失敗の形（30 秒のタイムアウト、teardown）が近い。#1・#3・#4 を #394 に集約するか、個別 Issue にするかは Owner の判断（#680 の調査項目 6 と同じ論点）。
- #4 の teardown のタイムアウトは、#680 の観測 3（`Target page, context or browser has been closed`）と同じ「ブラウザが閉じる処理に時間がかかる」形に見えるが、**同一原因かは未確認**。

## 4. 仮説（確認すべき点。結論ではない）
1. **#1**: 被覆率の計算が、WebKit で `mouse.move(..., {steps: 6})` のイベントを一部取りこぼした状態（CPU 負荷）で 0.95 に届かない。または準備の 4 つの角で被覆率が閾値に近く、既に STEP 2 に進む。→ 失敗時の `data-coverage`・`data-step` を `error-context.md` で確認。
2. **#3**: 仮想時計（`page.clock`）で進めた時間と、ページの `requestAnimationFrame`／タイマーの進みが、WebKit の負荷下でずれ、`data-armed` が true にならない。→ 失敗時の DOM（`data-armed`・`data-grade`）を確認。
3. **#4**: 7 ms 周期の無限アニメーションが残ったまま `context.close` が走り、WebKit が再描画で詰まる。または CI ランナーの GPU 周辺（ZINK の警告）の負荷。→ アニメーションを止めた状態で閉じると再現しなくなるかを確認（**テスト側の衛生の改善であり、タイムアウトの延長ではない**）。
4. 共通: 失敗が長い shard の後半で起きている（実行時間が 14 分以上）。shard 内の位置・実行時間との関係を、過去の失敗 run と並べて確認する（#680 の調査項目 3・5 と同じ）。

## 5. 次の手順の案（T-FX の判断・承認が必要。本書では実施していない）
1. artifact（`playwright-webkit-test-results-…-attempt1`、`playwright-webkit-report-…`）を**保持期限（14 日、2026-11-23 頃）の前に**保存して、#1・#3 の失敗時の状態を確認する。
2. 過去の WebKit 失敗 run（#394・#562・#680 の run 一覧）に、今回の 3 つの spec が出ていないかを照合する。
3. 上の仮説 3 は、**アニメーションを止める**など、タイムアウトを延ばさない方法で検証できるかを T-FX が判断する。
4. 当面は失敗した job の再実行を **1 回まで**とし、再失敗したら停止して報告する（#680 の扱いと同じ）。

## 6. 本日の記録として残す点
- 本日 main の WebKit 失敗は 4 件。いずれも同じコミットの再実行で成功し、merge・Deploy には影響しなかった（Deploy to GitHub Pages は 4 件とも success）。
- Owner の指示（skip・タイムアウト延長の禁止）に従い、テスト・CI の設定は変更していない。

## 7. 追記（2026-11-10 Owner 指示）: 5 件目 — PR #807 のブランチ（main ではない）【実測】
2026-11-09 22:15 UTC、PR #807（B22 実装、Draft）の HEAD `c54e9fae`（**コメントのみの変更**）で、WebKit の 1 job が失敗し、**失敗した job の 1 回の再実行で成功**した。**原因は確定していない。** 上の 4 件は main の push、これは PR ブランチ（`pull_request` の run）である点が違う。

| # | run（attempt 1 の job） | 対象 | project・shard | テスト | 失敗の形 | 再実行の結果 |
|---|---|---|---|---|---|---|
| 5 | 42707456770（job 129468082967、21:58–22:15 UTC） | #807 の HEAD `c54e9fae`（B22 の食材・レシピ。コメントのみの追加コミット） | webkit-360x800 shard 3/3（208 件成功・51 skip・1 失敗、15.6 分） | `e2e/sauce-edge-475.spec.ts:124`「sauce heatmap edge (Issue #475 Slice 1) › the same pixels carry SAUCE -> BAKE -> CUT -> RESULT (continuity and determinism)」 | **テストの 60 秒タイムアウト**: `Error: mouse.move: Protocol error (Input.dispatchMouseEvent): Page closed`（同 spec の `drag` ヘルパー 52 行、127 行の呼出し） | `rerun_failed_jobs` で job 129479366217 が成功（22:19–22:35 UTC）。WebKit Gate・全 11 check が成功 |

- **別のテスト・別の形**: #1〜#4 のどれとも違うテスト。#4（teardown のタイムアウト）と同じ「ページ／コンテキストが閉じる側の問題」に見えるが（`Page closed`）、**同一原因かは未確認**。#394（WebKit cooking E2E の間欠失敗の総括）・#562（30 秒のタイムアウト）と「WebKit の間欠失敗」という点で近い。
- **B22 との関係**: B22 はこのテストの経路（sauce の描画・`sauce-edge-475.spec.ts`）に触れていない。同じ spec は B22 の実装コミット `867ebeb8` の CI（11/11）で成功している。「変更と無関係」は再実行で通ったことからの推論で、**原因の特定ではない**。
- **未確認**: 失敗時の artifact（`playwright-webkit-test-results-webkit-360x800-shard3-attempt1`、保持期限 14 日＝2026-11-23 頃）の内容。同 spec の過去の失敗履歴。ドラッグを 60 秒かけて打つ `drag` ヘルパー（`mouse.move` の間に `waitForTimeout`）が WebKit の負荷下でどこまで遅れるか。
- **扱い**: テストの skip・タイムアウトの延長・assertion の弱化はしていない（Owner の指示どおり）。PR では失敗した job を **1 回だけ**再実行し、再失敗したら停止して報告する方針。
- 集計: 2026-11-09 の WebKit 間欠失敗は main 4 件＋PR ブランチ 1 件＝**計 5 件**（うち 1 件は #680 と同じテスト）。5 件とも同じコミットの再実行で解消した。
- §5 の手順 1（artifact の保存）は #1〜#5 の全てが対象。#5 の artifact も期限前に保存する。
