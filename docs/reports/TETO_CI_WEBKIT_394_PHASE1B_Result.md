# #394 Phase 1b — handPick の check-then-act 競合と cooking-sear-hv の実時間依存（Result）

Status: **実装・自動検証（Chromium、両 viewport）まで完了。WebKit の効果は PR の CI（と以後の main push）でのみ確認できる。merge は Owner 承認待ち。**
Branch `claude/issue-394-phase1-handpick-sear` / 基準 `main` `d927878`（#740）。変更は **テストコードのみ**（本番コード・timeout・retry・skip は変更なし）。#738 と Batch 17 には触れていない。
根拠の Fresh Audit: 2026-11-03 の #394 Result Report（main push run 41656667776 ほか）。

## 1. Duplicate Gate

- open の Issue / PR を `handPick` / `chipOnTrayOrPin` / `cooking-sear-hv` / `cookSearHv` で検索: Issue は #394（本件の親）と #724（sear の Phase 1）のみ。open PR で同じ対象を変更するものは無い。
- #738（steam S3）の e2e 変更は `e2e/cooking-steam.spec.ts` のみ。本件のファイルと重ならない。
- `e2e/support/handPick.ts` の最終変更は #669 以前で、10/23 以降に check-then-act を直す PR は無い（#394 の 11/03 の記録で「helper の修正は Owner 判断で別対応」）。

## 2. 失敗機構（修正前）

### 2.1 `handPick.ts`: check と act の間の再描画（型 C）
`chipOnTrayOrPin` は `while (await prev.isVisible() && await prev.isEnabled()) await prev.click()`（次ページ側も同型）。`isEnabled()` と `click()` の間に 2 回のプロトコル往復があり、その間にトレイが再描画されて（1 ページ目へ戻る・並べ替え等）ボタンが disabled になると、Playwright の `click()` は「enabled」を **テスト timeout まで待ち続ける**。2026-11-03 の PR #734 では WebKit 360×800 の 2 shard が 300 秒 timeout（`element is not enabled` を 541 回）。29 spec が使う helper のため、落ちるテストが毎回変わる。
- 再現: 本 PR の回帰テスト（§4）で決定的に再現した。旧 helper では 2 本が `locator.click` の「visible, enabled and stable」待ちで 15 秒の timeout（RED）。

### 2.2 `cooking-sear-hv.spec.ts`: 実時間の長押し（型 D）
旧テストは `mouse.down()` → `waitForTimeout(1600)`（実時間）→ `mouse.up()`。焼き目の判定は保持時間 / 3000ms で、0.3〜0.62 が「こんがり」（900〜1860ms）、0.62〜0.9 が「しっかり」。**1600ms から境界まで 260ms しか余裕が無く**、runner が 260ms 以上止まると「しっかり焼き目」になる（main run 41656667776 の `cooking-sear-hv.spec.ts:74` の観測と一致）。
- 再現: 旧ロジックに実時間 2.5 秒の停止を足した一時 spec（未コミット）で `Expected: "こんがり焼き目"` が失敗（RED、Chromium）。

## 3. 修正

| 対象 | 修正 |
|---|---|
| `e2e/support/handPick.ts` | `pressPager`: ページャの押下を **1 回の browser task** で行う（connected・非 disabled・中心の最上位要素が自分自身、の 3 条件を同じ瞬間に確認して `click()`）。条件を満たさなければ何も押さず、呼び出し側のループが止まる。押した後は `.ingredient-page-nav__label`（「n / m」）が変わるまで `expect.poll` で待つ（状態信号による同期）。Playwright の click と同じ「他の要素に覆われていない」検査を残しているため、オーバーレイ下のページャは従来どおり失敗する。timeout の延長・retry・skip なし |
| `e2e/cooking-sear-hv.spec.ts` | 仮想時計（`page.clock`）で長押しを行う。Playwright の clock は `performance.now()` とタイマーに加え `event.timeStamp` も偽装する（Chromium で実測: down=1004 / up=2604、差 1600）。アプリは保持時間を `event.timeStamp` で測るため、保持時間は仮想時計の `runFor` と完全に一致し、runner の実時間の停止の影響を受けない。仮想時計は `pauseVirtualClock` で止め、リリース後は `SEAR_DONE_MS` / `SEAR_GUARD_MS`（アプリの定数）分だけ仮想時間を進める。`enterBakeAtZero` は、時計が既に止まっている場合は再 install しない |

「既存の WebKit テストを弱めない」: 断言（`こんがり焼き目`、`data-full-ms`、`cooking-sear-done`、RESULT 到達）はすべて残した。旧テストが暗黙に頼っていた「実時間 1.6 秒」を、仮想時間 1600ms に置き換えただけ。

## 4. 回帰テスト（追加 6 本）

`e2e/gestures-helper.spec.ts`（実ゲームを使わない合成 3 ページトレイ。実際のページャのマークアップを再現）:
1. 前のページへ戻る途中にトレイが 1 ページ目へ飛ぶ（旧 helper は disabled な「前のページ」で停止）。
2. 次のページへ進む途中にトレイが最終ページへ飛ぶ（同上）。
3. 中間ページのチップは押して見つかる。どのページにも無いチップは従来どおり失敗する（検査を弱めていない）。

`e2e/cooking-sear-hv.spec.ts`:
4. 仮想 1600ms の保持の直前に実時間 2.5 秒止めても「こんがり」のまま。
5. 仮想 1850ms は「こんがり」、6. 仮想 1870ms は「しっかり」（境界 1860ms の両側。期待値は `searLookOf(searAmountAt(...))` と一致することも断言）。

## 5. 検証

| 検証 | 結果 |
|---|---|
| handPick 回帰（旧 helper） | **RED**: 2 本が `locator.click` の待ちで 15 秒 timeout、3 本目（対照）は通過 |
| handPick 回帰（新 helper）、390×844 / 360×800、`--repeat-each=5` | **30/30 passed** |
| sear の旧ロジック + 実時間 2.5 秒停止 | **RED**: `Expected: "こんがり焼き目"` |
| `cooking-sear-hv.spec.ts`（新）、両 viewport、`--repeat-each=3` | **42/42 passed** |
| 関連 E2E 一式（handPick を使う 29 spec + cooking-sear ×3 + gestures-helper）、Chromium 両 viewport、4 workers | **188 passed / 8 skipped / 0 failed**（7.5 分）。skip は `cooking-sear-pill-position.spec.ts` の、この 2 project に該当しない viewport の既存の skip で、本 PR の変更ではない |
| `tsc -b` / `oxlint` / `npm run build` | exit 0 / exit 0（既存の warning のみ、新規なし）/ exit 0 |
| 全 Vitest | **未実行**（`src/` を変更していないため。`e2e/` は Vitest の対象外） |
| WebKit E2E | PR の CI で確認 |

本環境は Playwright 既定の chromium の版が合わないため、一時 config（未コミット、削除済み）で `/opt/pw-browsers/chromium` を使用した。

## 6. 残る不確実性

- **WebKit では本環境で動かせず未確認。** `event.timeStamp` の偽装は Playwright の clock の共通スクリプトによるため WebKit でも同じはずだが、実証は PR の CI のみ。
- handPick の機構は、WebKit の失敗ログとコード読み、合成ページでの決定的再現による。WebKit は `trace: off` のため、11/03 の失敗が実際にこの経路だったことの直接の証明（trace）は無い。
- 1 回の CI 成功は原因解消の証明にならない。#394 は open のまま、再発を追跡する。
- 型 B（`Page closed` / 30 秒 timeout 系: `making-ui-1screen:424`、G-6 #680 ほか）は本 PR の範囲外で、P2 の測定が先。
- `pressPager` の「押した後にラベルが変わらなければ 5 秒で失敗」は新しい失敗経路。ページが変わらない押下は旧 helper でも次の `chip.isVisible()` を無駄に繰り返すだけだったため、悪化ではなく早い失敗にしたもの。
- `.ingredient-page-nav__label` に依存する。ページャの DOM を変える変更では、この helper の追従が要る（回帰テストが検出する）。
