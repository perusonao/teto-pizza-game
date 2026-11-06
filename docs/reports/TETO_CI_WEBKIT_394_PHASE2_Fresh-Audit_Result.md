# #394 Phase 2 (P2) Fresh Audit — 診断追加の最小実装案と検証計画（Result、読み取りのみ）

Status: **Fresh Audit（読み取り専用の調査）の記録。** 調査時点ではコード・設定・CI の変更、push、PR、merge、CI の再実行をしていない。この文書は、Phase 2 の PR 1（D1〜D3）に同梱して保存する（PR 2 = D4 は別 PR で、この文書に依存しない）。Batch 17（PR #743）と PR #738 には触れていない（#743 の CI ログと artifact 一覧は読み取りのみ）。
基準: main `5bb18403`（#742、#394 Phase 1b）、調査日 2026-11-04（UTC）。run 41750149341 は 01:12Z に完了（§1.1）。

## 0. 要約

| 項目 | 結論 |
|---|---|
| main の WebKit run 41750149341（`5bb18403`） | **completed / success**（00:53:19Z 開始、01:12:22Z 完了）。6 shard・`Layout Contract Gate`・`WebKit Gate` がすべて success。失敗なし（§1.1） |
| Phase 1b（handPick / sear）の再発 | **この run では再発なし**（失敗 0 件）。ただし **1 run の成功は解消の証明にならない**。修正前のコードでは、Batch 17 の PR の CI（`23e72e5`、#742 を含まない）で handPick の競合が実際に再発していた（§1.2） |
| G-6 の失敗の原因 | **`page.reload` の応答停止ではなく、30 秒枠の消費**と読める（§3.1）。同じテストが健全な実行では 18 秒、失敗時は 30.7 秒（1.69 倍） |
| 実行時間の集計 | **追加実装なしで可能**（ジョブログの `list` reporter 行）。ただし timeout はソースから推定するしかない。**evidence に `durationMs` / `timeoutMs` を足す**のが最小の恒久策（§4） |
| shard の偏り | **構造的に存在する**（テスト数で等分、時間は等分でない）が、**run 間のぶれ（同じ shard で 1.46 倍）のほうが大きい**（§5） |
| artifact | **一覧は取れる。本体は取れない**（blob のホストがネットワーク許可に無く 403）。ジョブログは取れる（§6） |
| 診断追加の最小案 | e2e 側のみ・通常時は無音・assertion / timeout 不変（§7）。**Owner 承認が必要**（コード変更のため） |

## 1. main WebKit run 41750149341 と Phase 1b の再発

### 1.1 最終結果（run の状態）
- run: https://github.com/perusonao/teto-pizza-game/actions/runs/41750149341（`E2E WebKit (Cooking UI 1-Screen)`、event push、head `5bb18403e01c01ccde203dfdde8e441af8a8bb2a`、attempt 1）。**completed / success**（開始 00:53:19Z、完了 01:12:22Z）。
- ジョブ: `classify`・`layout-chromium`・`Layout Contract Gate`・WebKit 6 shard・`WebKit Gate` がすべて success。失敗した shard・spec・行番号は **無い**。
- WebKit shard のテスト実行 step の所要（開始 → 完了）:

| viewport | shard 1 | shard 2 | shard 3 |
|---|---|---|---|
| 360×800 | 11.3 分 | 14.7 分 | 14.4 分 |
| 390×844 | 16.6 分 | 14.8 分 | 10.3 分 |

### 1.2 Phase 1b の再発判定の基準（事前に固定する）
| 対象 | 再発とみなす兆候 | 再発でない |
|---|---|---|
| handPick（型 C） | `locator.click` の timeout（`waiting for element to be visible, enabled and stable` / `element is not enabled` の繰り返し）が `handPick.ts` を指す。または新しい失敗経路 `pressPager` の「押した後 5 秒でラベルが変わらない」 | 他の spec・他の機構の失敗 |
| sear（型 D） | `cooking-sear-hv.spec.ts` の `こんがり焼き目` の期待値違い（`data-full-ms` が境界を越える） | 同 spec の別の失敗（仮想時計の外） |
- **修正前の対照（既に起きた再発）**: Batch 17 の PR #743（head `23e72e5`、**#742 を含まない**）の初回 CI（run 41688599134、2026-11-03）で、`webkit-390x844 shard 1/3` の `e2e/batch14-moussaka.spec.ts:81` が、`handPick.ts:13`（旧 `await prev.click()`）の `Test timeout of 300000ms exceeded`（「前のページ」が `element is not enabled` を 547 回繰り返す）で失敗した。Phase 1b が直した型 C と同じ機構で、**修正前のコードでは WebKit で現に再発していた**。失敗 job の再実行（1 回）で成功。
- 同じ run の `shard 2/3` は `lunch-rush-r8-restore.spec.ts:147`（G-6、#680 の対象）が 30 秒枠で失敗（§3.1）。再実行で成功。
- **#742 以降のコードでの再発の有無**: run 41750149341（#742 を含む main）は**失敗 0 件**で、handPick（`handPick.ts` / `pressPager`）と `cooking-sear-hv` に該当する失敗は無い。**再発なし（1 run）**。1 回の成功は原因解消の証明にならないので、Phase 1b の方針どおり #394 は open のまま追跡する（分母は §5.3 の測定で蓄積）。

### 1.3 #394 に記録すべき内容（案。投稿はしていない）
1. main run 41750149341 の結果（completed / success、6 shard・Gate すべて success）と、Phase 1b の再発判定（再発なし・1 run）。
2. 修正前の対照: PR #743 の run 41688599134 の 2 件（上の §1.2、`handPick.ts:13` と G-6）。どちらも再実行 1 回で成功し、全 11 チェックが success。
3. 本書の定量結果: 同一 shard で同一テストが attempt 間で **中央値 1.46 倍**遅い（§3.2）。G-5 / G-6 は 30 秒枠の消費（§3.1）。shard の偏り（§5）。artifact は本体取得不可・一覧可（§6）。
4. 次の段階（P2）の提案: §7（診断の最小実装案）と §8（検証計画）。timeout の延長・retry・skip・Gate の緩和は引き続き行わない。

## 2. CUT の `mouse.move / down / up` の診断方法

### 2.1 現状（コード読み）
- CUT のジェスチャは `e2e/gestures.ts` の `cutThreeLines` / `cutThroughCentre`: 開始点で `waitUntilDoughReady`（interactive・visible・箱・`elementFromPoint` の命中）→ `mouse.move` → `mouse.down` → `mouse.move(…, { steps: 5 })` → `mouse.up`（0° / 60° / 120° の 3 本）。**終点側の命中確認はしていない**。
- アプリ側（`src/components/PizzaStage.tsx` の `handlePointerUp`、CUT 分岐）は、**`g.dragging && g.cutPath` のときだけ**線を確定する（ドラッグ意図の閾値を越え、`pointermove` で `cutPath` が作られていること）。押しただけ・短すぎる線は黙って捨てる。つまり「`mouse.up` が成功しても、線が登録されない」失敗経路がある（`pointermove` が届かない・`pointerId` が合わない・`pointercancel` で状態が捨てられる、など）。
- 既知の別型（ページ応答停止）: `mouse.move/up: Protocol error (Input.dispatchMouseEvent): Page closed` が過去に 2 件（#394 の記録、2026-10-23。`sauce-oil-over-519:156` の 180 秒枠・`gestures-helper:121` の 120 秒枠、いずれもソースを塗る操作の最中・WebKit 390×844）。**CUT での同型は今回の調査範囲では記録に見つからなかった**（CUT は run #879 / PR #585 の記録に言及があるが、本書では内容を再確認していない）。

### 2.2 診断の方法（最小）
目的は「どこで止まったか（プロトコル呼び出し / ページ応答 / アプリが状態を捨てた）」を、**通常時は無音で、失敗・遅延時だけ**ジョブログに残すこと。
1. **各 `page.mouse.*` 呼び出しの Node 側計時と watchdog**: 呼び出しの前に `setTimeout(8s)` を張り、時間内に戻らなければ stderr に `[diag] mouse.move pending 8s (label, point, step)` を出し、同時に **ページの生存確認**（`page.isClosed()`、`Promise.race([page.evaluate(() => performance.now()), 2s])` の往復時間）を取る。戻れば timer を解除（挙動不変）。
2. **ポインタイベントの記録（ページ側）**: capture 段階のリスナーで `pointerdown / move / up / cancel` の `performance.now()`・`pointerId`・`clientX/Y`・`target.className`・`isTrusted` をリングバッファ（200 件）に記録。**遅延・失敗の検出時だけ**末尾 20 件を `[diag] pointer-trace` で出す。CUT では、線ごとに「`down` 後の `move` が何件届いたか」「`up` 時に `cancel` が無いか」が分かる。
3. **確定の確認**: `up` の直後に、CUT の確定数（DOM の確定済み線の数）が 1 増えたかを読み、増えなければ `[diag] cut line not committed (moves=n, cancel=…)` を出す（失敗させない。assertion は既存のまま）。
4. 本番コードは変更しない（アプリ側のログ追加は不要。上の 1〜3 で足りる）。

## 3. `page.reload` の応答停止と timeout 余裕

### 3.1 G-5 / G-6（`lunch-rush-r8-restore.spec.ts`）は「応答停止」ではなく「30 秒枠の消費」と読める
- G-6（`:147`）の失敗は `page.waitForSelector(".app-frame")`（`:167`、`page.reload()` の直後）の `Test timeout of 30000ms exceeded`。**呼び出しログには `locator resolved to visible <div class="app-frame">` が出ている**（＝要素は見えていた。reload は応答した）。
- 同じ shard の実測（`list` reporter の所要時間）:

| テスト | attempt 1（遅い run） | attempt 2（健全な run） | 比 |
|---|---|---|---|
| G-1 `:90` | 13.5 秒 | — | — |
| G-4 `:108` | 16.2 秒 | — | — |
| G-5 `:127` | 27.0 秒 | 16.5 秒 | 1.64 |
| **G-6 `:147`** | **30.7 秒（失敗）** | 18.2 秒 | **1.69** |

- G-5 / G-6 は 1 テストで 2 回の bake（`bakeToServePanel` ×2）を行い、既定の 30 秒枠（この spec に `setTimeout` は無い）に対し、**健全でも 16〜18 秒（余裕 1.65〜1.8 倍）**。遅い runner（下の 1.46 倍の中央値、1.67 倍の p90）では枠を使い切る。**止まった呼び出し（reload / waitForSelector）は、枠が尽きた時点で実行中だっただけ**（`page closed` 系の teardown と同じ読み。#394 の 2026-10-17 の `discovery-hint-sheet:393` の予算切れ調査と同型）。
- したがって、**「`page.reload` の応答停止」の仮説は G-6 には不要**。ただし**他のテストで reload が本当に止まる事例が無い**とは言えない（過去の `Page closed` 2 件は reload ではないが、応答停止型の機構は実在する）。切り分けは §3.3 の診断で行う。

### 3.2 run 間の速度差（実測）
- Batch 17 の PR の run 41688599134 の `webkit-390x844 shard 2/3`: **attempt 1（失敗した run）と attempt 2（再実行）の同一テスト 168 本**で、所要時間の **中央値の比 1.46、平均 1.46、p90 1.67**。テスト時間の合計は 31.9 分 → 22.0 分（共通 168 本）。ジョブ全体は約 22 分 → 17 分。
- つまり**コード不変でも、runner の速度で全テストが一様に約 1.5 倍遅くなる**ことがある。30 秒枠のテストは、健全時 20.5 秒を超えると、この速度差で落ち得る。

### 3.3 `page.reload` の診断方法（最小）
- **共通ヘルパ `reloadApp(page)`**（現状は `page.reload()` + `waitForSelector(".app-frame")` が **58 箇所**・38 spec にある）。挙動は同一のまま、次を計る: `reload` の所要、`.app-frame` が見えるまでの所要、直前までのテスト経過と**残り予算**（`testInfo.timeout - 経過`）。**所要が 5 秒超、または残り予算が 10 秒未満のときだけ** `[diag] reload …` を stderr に出す。
- `page.on("crash" | "close" | "pageerror")` と、`console` の error、`requestfailed` を、reload の前後だけ監視（既に `layoutContract.ts` の `Trail`（PR #458）に同種の機構があり、流用できる）。
- 停止が疑われるときの追加: §2.2 の watchdog（8 秒・生存確認）を reload にも適用。
- まず導入する場所: `lunch-rush-r8-restore`（G-1〜G-6）、`dinner-settlement-dm4-3`、`cooking-prep`。他は後で。

## 4. テストごとの実行時間と timeout 余裕の集計方法

### 4.1 追加実装なしでできる集計（本書で実施）
- ジョブログの `list` reporter 行（`✓ N [webkit-…] › spec:line:col › title (12.3s)`）を、`get_job_logs` で取得して集計する。**skip のテストは所要が出ない**（239 本中、約 4〜43 本）。
- 6 shard + 失敗 attempt 1 の合計 **1,341 件のテスト実行**を集計した。余裕（枠 − 所要）が **5 秒未満は 6 件のみ**で、すべて `lunch-rush-r8-restore` と `discovery-near-miss-result`。
- 健全な実行（attempt 2 など）の **既定 30 秒枠の spec 内（462 件。Batch 17 の spec を除く）で、18 秒以上は 8 件**（上位は `lunch-rush-r8-restore:169`=28.8 秒、`:147`=25.9 秒、`discovery-hint-sheet:278`=19.4 秒、`pizza-cutting-phase4b:119`=19.4 秒、`making-ui-1screen:399`=18.8 秒、`canvas-mozzarella-optin-486:132`=18.3 秒）。遅い runner（1.46 倍）で落ち得るのは **20.5 秒以上**。
- 限界: (1) `timeout` は**ソースの `test.setTimeout` の走査で推定**した（`main` のソースに無い spec は既定扱いになり、誤判定する。今回も Batch 17 の spec を一度だけ誤って既定枠扱いしかけた）。(2) ジョブログの取得は tail のみ（取得 API に行数・文字数の上限）。(3) 1 回の run 数組では分布が決まらない。

### 4.2 恒久策（最小）
- `scripts/ci/webkit-shard-evidence.mjs` の `collect` が、Playwright の JSON から各テストの **`durationMs`・`timeoutMs`（JSON の `tests[].timeout`、Playwright 1.56.1 の json reporter が出力）・`workerIndex`・`startTime`** を `executed[key]` に**追加で**記録する（evidence の既存フィールド・判定は不変。`verify` は `status` / `expectedStatus` だけを見る）。
- **ゲートの判定には使わず**、(a) 余裕（`1 − duration/timeout`）が小さい上位 10 件、(b) shard ごとのテスト時間の合計、(c) 失敗テストの所要と枠を出す。出力先は 2 つ: **(1) 各 shard の `Record shard evidence` step の標準出力（= その shard のジョブログ。`get_job_logs` で読める）**、(2) `verify` の出力（全 shard の表）。(2) は `webkit-gate.sh` が **step summary（Actions の画面）にだけ**書き、ジョブログには書かない（PR #745 の CI で確認。調査時点では (2) をジョブログと誤認していた）。workflow の YAML は変更不要。
- 現状の evidence は `status` / `expectedStatus` のみ（70 KB）。**JSON の結果ファイル自体（`RESULTS_JSON`）は artifact に上げていない**（`../webkit-results.json`、リポジトリ外）。HTML レポートの artifact には所要が入っているが、取得できる環境が要る（§6）。

## 5. WebKit shard 2/3 の負荷偏りの検証方法

### 5.1 偏りの機構（コード読み）
- Playwright の shard は、**テスト数で連続割当**（`filterForShard`: 717 本 → 239 / 239 / 239、`fullyParallel` のため 1 テストが 1 group）。**時間は考慮されない**。割当はファイルの並び（`discovery-…` から `pizza-cutting-…` までが shard 2 など）に依存し、重い spec（`discovery*`・`dinner*`・`expansion*`・`lunch-rush*`・`original-result*`）が中ほどに集まる。

### 5.2 実測（run 41688599134 の健全な attempt。テスト時間の合計＝2 worker の合計）

| viewport | shard 1 | shard 2 | shard 3 | 最大 / 平均 |
|---|---|---|---|---|
| 360×800 | 24.4 分 | **34.8 分** | 21.5 分 | 1.29 |
| 390×844 | 29.7 分 | 26.9 分（attempt 1 は 39.0 分） | 20.1 分 | 1.16 |

- ジョブ全体の所要（同 run のチェック）: 360 は shard 1 = 15.1 分 / **shard 2 = 20.3 分** / shard 3 = 13.9 分。390 は shard 3 = 13.4 分、shard 2（attempt 1）≈ 22 分。
- 結論: **360×800 では shard 2 が構造的に重い**（平均の 1.29 倍）。390×844 では shard 1 / 2 が同程度。**ただし同じ shard の run 間のぶれ（1.46 倍）のほうが偏り（1.16〜1.29 倍）より大きい**ため、「shard 2 だから落ちる」とは言えない。
- #394 の過去記録の shard 言及（失敗以外の言及を含み、分母なしの弱い指標）は、390×844 shard 2/3 が最多（15 回）。**分母（同 shard の実行回数）が無いため、偏りと失敗率の関係は未確定**（#394 の既存の方針「分母も集計」と同じ）。

### 5.2.1 追加の 1 run（main `5bb18403`、run 41750149341、全 shard success）
- テスト実行 step の所要: 360 は 11.3 / 14.7 / 14.4 分（最大 / 平均 = 1.09）、390 は 16.6 / 14.8 / 10.3 分（最大 / 平均 = 1.19）。**この run では shard 2 が最重ではない**（390 は shard 1 が最重、360 は shard 2 と 3 が同程度）。run 41688599134 の 360 shard 2（20.3 分）は遅い runner の影響を含む。**「shard 2 が構造的に重い」は 1 run では支持されず**、偏りの方向は run により変わる（§5.1 の連続割当は偏りの余地を作るが、どの shard が最重かは runner の速度にも左右される）。

### 5.3 検証の方法
1. §4.2 の evidence で、**main push の run を 5 回以上**、shard ごとの合計・ジョブ所要・失敗の有無を蓄積する（分母）。
2. 試算（本書で実施）: spec ファイルを単位に 3 つへ最長順に割り当てると、360×800 は 26.9 / 26.9 / 26.9 分（最大 34.8 → 26.9、−23%）、390×844 は 25.6 ×3（最大 29.7 → 25.6、−14%）。**ただし、これは 30 秒枠の失敗には直接効かない**（枠は 1 テストごと）。
3. 実装の選択肢（**今は提案のみ**）: (a) shard 数 3 → 4、(b) 時間で均した静的な spec リスト（evidence の「全テストがちょうど 1 回実行された」判定は同じ形で維持できる）、(c) 何もしない。まず 1. の測定が先。

## 6. GitHub Actions artifact の取得可能性

| 取得対象 | 結果 |
|---|---|
| artifact の**一覧**（`list_workflow_run_artifacts`） | **可**。PR #743 の run で 20 件（名前・サイズ・期限・digest）。保持期間 14 日 |
| artifact の**ダウンロード URL の発行**（`download_workflow_run_artifact`） | **可**（署名付き URL が出る） |
| artifact の**本体の取得** | **不可**: `productionresultssa6.blob.core.windows.net` への接続がこの環境のネットワークポリシーで **403**（プロキシのログに `connect_rejected`）。過去の記録（`error-context.md` が未確認）と同じ |
| **ジョブログ**（`get_job_logs`） | **可**。tail 指定（1 行が長く、数千行で 6〜9 万文字）。`list` reporter の所要・失敗の call log が読める |
- 取得に必要な設定（Owner）: 環境のネットワークポリシーに、blob のホスト（`productionresultssa*.blob.core.windows.net` 系。ホスト名は run により変わる）を許可する。または、診断を**ジョブログに出す**設計にする（§7。許可なしで読める）。
- artifact の中身（現状）: `webkit-evidence-…`（status のみ・約 70 KB）、`playwright-webkit-report-…`（HTML、2〜8 MB、所要とエラーを含む）、`playwright-webkit-test-results-…-attemptN`（失敗時のみ、約 0.3 MB、スクリーンショットと `error-context.md`。WebKit は `trace: off` で trace なし）。

## 7. 診断追加の最小実装案（未実装・Owner 承認が必要）

原則: **assertion・timeout・retry・skip・Gate は変更しない。通常時は無音。診断はジョブログに出す（artifact に依存しない）。**

| # | 変更 | ファイル | 通常時の影響 |
|---|---|---|---|
| D1 | `e2e/support/diag.ts`（新規）: watchdog（8 秒）、生存確認、残り予算の計算、ポインタ記録、`[diag]` 出力 | 新規 | なし（呼ばれた時だけ） |
| D2 | `gestures.ts` の `tapDoughPercent` / `completeDoughStep` / `cutThreeLines` / `cutThroughCentre` / `squeezeDough*` / `physicalDragToDough` の `page.mouse.*` を D1 の計時で包む（挙動不変） | `e2e/gestures.ts` | 同期の timer 設定・解除のみ |
| D3 | `reloadApp(page)`（新規、D1 を使用）。まず `lunch-rush-r8-restore` / `dinner-settlement-dm4-3` / `cooking-prep` の reload を置換 | `e2e/support/`・該当 3 spec | 挙動不変 |
| D4 | evidence に `durationMs` / `timeoutMs` / `workerIndex` / `startTime` を追加、`verify` が余裕上位・shard 合計をログに出す | `scripts/ci/webkit-shard-evidence.mjs`（+ self-test） | Gate の判定は不変 |
| D5 | （任意）`lunch-rush-r8-restore` G-5 / G-6 の 2 回 bake を、**テストの分割**で枠に余裕を持たせる（`discovery-hint-sheet` #530 と同型）。**timeout の延長ではない**。別 PR・別判断 | 該当 spec | 検査内容は維持 |

- D1〜D4 は本番コード（`src/`）に触れない。D4 は CI スクリプトのみ（workflow YAML は不変）。
- 実装は小さく 2 PR に分ける案: (1) D1〜D3（e2e のみ）、(2) D4（CI スクリプト）。D5 は G-5 / G-6 の再発状況を見て判断。

## 8. 検証計画

| 段階 | 内容 | 合格条件 |
|---|---|---|
| V1 | D1 の単体: 合成ページ（`gestures-helper.spec.ts` と同形）で、(a) 注入した 9 秒の遅延で `[diag]` が出る、(b) 通常時は stderr が空、(c) watchdog が呼び出しの結果を変えない | 3 本とも想定どおり |
| V2 | D2 / D3 を入れたテストの Chromium 両 viewport、`--repeat-each=5` | 失敗 0、通常時の `[diag]` 0 行 |
| V3 | CDP の CPU throttle（`Emulation.setCPUThrottlingRate`、4 倍）で G-5 / G-6 を実行 | 残り予算の `[diag]` が出る（誘発）。throttle なしでは出ない |
| V4 | ローカルで `node scripts/ci/webkit-shard-evidence.mjs --self-test` と `scripts/ci/test-webkit-ci.sh`（D4）。追加フィールドが `verify` の判定を変えないこと（既存の negative テストが全て同じ結果） | 全 pass、判定不変 |
| V5 | PR の CI: WebKit 6 shard が green、ジョブログに `[diag]` が 0 行（健全時）、evidence の追加フィールドが出る | green、0 行 |
| V6 | main push 後の 5 run: shard ごとの合計・上位余裕・`[diag]` の件数を蓄積（§5.3） | 分母の確定 |
| 判定の原則 | 1 回の green は解消の証明にしない。**WebKit はこの環境で動かせない**ので、WebKit の効果は CI のみで確認。`[diag]` が出たら、止まった呼び出し・ページの生存・残り予算で §3.1 の型（枠の消費 / 応答停止）を分ける | |

## 9. PR の分割と依存関係（Owner 指示）
- **PR 1（E2E 診断、D1〜D3）**: `e2e/support/diag.ts`（新規）、`e2e/gestures.ts`（`page.mouse.*` の計時）、`e2e/support/reload.ts`（新規）と、`reload` を使う 3 spec（`lunch-rush-r8-restore` / `dinner-settlement-dm4-3` / `cooking-prep`）、合成ページの検証 spec、本書。
- **PR 2（実行時間分析、D4）**: `scripts/ci/webkit-shard-evidence.mjs`（+ その self-test）のみ。workflow YAML・`webkit-gate.sh`・`test-webkit-ci.sh` には触れない（open の #219 がそれらを変更しているため競合させない）。
- 2 つの PR は**ファイルが重ならず、互いに依存しない**（どちらを先に merge してもよい）。本書は PR 1 に同梱し、PR 2 は本書を参照するだけ（PR 2 が先に merge されても、参照先の欠如はドキュメント上の注記に留まる）。
- 今回は行わない: timeout の延長・retry・skip の追加、G-5 / G-6 の分割（D5）、shard の再構成、Gate の合否条件の変更。

## 9.1 Owner 判断が要る点（調査時点のもの。1〜3 は D1〜D4 の実装として承認済み。4・5 は引き続き未判断）
1. D1〜D4 の実装を承認するか（2 PR の分割案、D5 は後回し）。
2. artifact の本体を読めるようにするか（ネットワーク許可に blob ホストを追加）、または診断をジョブログ中心にするか（本案はこちらで足りる）。
3. shard の再構成（4 shard / 時間で均した静的リスト）を、測定（§5.3 の 5 run）の後に判断してよいか。
4. G-5 / G-6 の分割（D5）を別 PR として進めるか。
5. #394 への追記（§1.3）を投稿してよいか（本書は投稿していない）。

## 10. 実施しなかったこと
コード・設定・CI の変更、push、PR 作成・merge、CI の再実行、Issue / PR へのコメント、artifact 本体の取得（不可）、Batch 17 / PR #738 の変更。Playwright の WebKit はこの環境に無く、WebKit の再現・計測は行っていない。
