# `sauce-gauge-489` の WebKit CI 不安定性 — 読み取り専用の調査（TETO-PARM-02 の付帯調査）

状態: **読み取り専用の調査。コード・テスト・CI 設定は変更していない。テストの skip・retry・timeout 延長・しきい値の緩和もしていない。** パルミジャーノの変更（#875 / `placedVisuals/**`）とは切り離して整理する。GitHub への書き込み（既存 Issue へのコメント、新規 Issue）は未実施。
Owner 依頼: [#875 comment 7118091786](https://github.com/perusonao/teto-pizza-game/pull/875#issuecomment-7118091786)（再現性・原因・既存担当／claim の重複・別 Issue 化の要否）。

## 1. 結論（先に）
1. **パルミジャーノの変更とは無関係。** 失敗したテストは Margherita のソース工程（パルミジャーノなし）で、`sauce-gauge-489` が読むのは `SauceRemainingGauge` と `sauceDispenseController` だけ。直近の失敗 2 回はどちらも `placedVisuals/**` のみを変えたビルドで起きたが、同じ試験は #875 とは別の日付・別の枝（2026-10-19、#566）でも同じ形で落ちている（#570）。
2. **既存 Issue と重複している。新規 Issue は不要。** 同じ症状が **#570**（`:22` のドリフト量 10／上限 8）に、同じファイルの別テストが **#531**（`:68` の 30 秒 timeout）に、包括 Issue **#394**（WebKit E2E の間欠失敗、54 コメント）にある。**担当者（assignee）・claim は 3 件とも無し。ゲージ関連ファイルを触る open PR も無し**（私の #825 claim の範囲は `placedVisuals/**`・テスト・docs で、この件は範囲外）。
3. **原因の本命は、テストが実時間に依存していること**（下記 §4）。通常 5〜8 秒の試験が、CI の遅い瞬間に 4〜7 倍になると、(a) 既定の 30 秒を超えるか、(b) 「`mid` を読んでから `mouse.up()` まで」の遅れが約 200ms を超えて許容 8 を超える。アプリの不具合の証拠は見つかっていない。ただし **WebKit での再現は未実施**（このセッションでは WebKit を動かせない）で、CI 上の遅延が実際に起きたかは**未確認**。
4. **推奨**: 新規 Issue を作らず、新しい 2 件の事例を #570（と #394）に追記する。修正は別担当・別 PR のテストのみの変更（先例: マージ済みの PR #642）。いずれも **Owner の承認が必要**（§6）。

## 2. 事実（実測。run のログ・API より）
### 2.1 失敗の分類（`e2e-webkit.yml` の直近 100 run、2026-11-12〜11-23。attempt 1 で失敗した 14 run・25 ジョブ。`docs/reports/screenshots/topping-visuals-2/sprinkle-v11/webkit_ci_failures_2026-11.json`）
| 分類 | ジョブ数 | 内容 |
|---|---:|---|
| apt の取得タイムアウト（テスト 0 件） | 13 | `playwright install --with-deps webkit` が 360 秒×2 回とも失敗（exit 124）。#643 の既知の型 |
| `sauce-gauge-489.spec.ts:22` | 2 | 下記 |
| `sauce-layers-b2.spec.ts:178` | 2 | 30 秒 timeout、`mouse.move: Page closed`（同じ shard 3/3） |
| `b22.spec.ts`／`b23b.spec.ts`（`codex/t25-content` の 3 run で毎回） | 6 | その PR の枝で**再現的**に失敗。間欠 flake ではない |
| `viewport-1screen.spec.ts:502`、`result-scale-514.spec.ts:52` | 各 1 | 別の単発 |
- **ソース系（`sauce-gauge-489`・`sauce-layers-b2`）の失敗は、100 run 中 4 run（4%）で、4 件とも `webkit` の shard 3/3**。ほかのテストの失敗とは別の集まり。

### 2.2 `sauce-gauge-489.spec.ts:22` の失敗 2 件（どちらも私の WebKit 検証 run）
| run / job | 症状 |
|---|---|
| 45111126268（SHA `74d129b`、attempt 1、job 137483585691、`webkit-390x844 shard 3/3`） | テスト全体が **37.7 秒**で 30 秒 timeout。47 行 `gauge.getAttribute` で `Target page ... closed`（`waiting for locator('.sauce-remaining-gauge')`） |
| 45287364458（SHA `a47222c`、attempt 1、job 138087325735、`webkit-390x844 shard 3/3`） | テスト 9.2 秒。**52 行 `expect(Math.abs(after - mid)).toBeLessThanOrEqual(8)` が Received 10**（#570 と同じ症状） |
- どちらも**失敗ジョブのみを 1 回再実行して成功**（attempt 2）。他のシャード・ビルド・Chromium は成功。

### 2.3 通常の所要時間（余裕の大きさ）
同じ 2 テストが成功した 18 回（9 run の shard 3/3、390×844・360×800）: `sauce-gauge-489:22` は **5.1〜8.1 秒（中央値 5.7）**、`sauce-layers-b2:178` は **5.5〜7.7 秒（中央値 6.0）**。上限 30 秒に対し約 4 倍の余裕がある。失敗した回は、これの **4〜7 倍**（37.7 秒、30 秒超）まで止まっている。

## 3. 既存の Issue・PR・担当（重複の確認）
| 件 | 内容 | 状態 | 担当・claim |
|---|---|---|---|
| **#570** | `sauce-gauge-489.spec.ts:22` がドリフト量 10（上限 8）で失敗（WebKit 360×800、1 件、2026-10-19）。**原因は仮説段階**（タイミング）で、Chromium の限定測定の表（挿入待ち 250ms → drift 10）あり | open | なし（assignee 空、claim コメント 0） |
| **#531** | `sauce-gauge-489.spec.ts:68` が 30 秒 timeout（WebKit 360×800、1 件、2026-10-17）。原因未特定 | open | なし |
| **#394** | WebKit cooking E2E の間欠失敗の包括 Issue（54 コメント）。「新規 Issue は作らず #394 に追記」という運用 | open | なし |
| #643 | WebKit install の apt 取得が低速（360 秒×2 回失敗、テスト未実行） | open | — |
| PR #642（マージ済み） | `sauce-layers-b2` の overlap 測定を実時間でなく stroke の完了条件で行う（テストのみ、閾値・timeout・assertion 不変、Refs #394） | closed/merged | 先例 |
- 本調査の新しい事例は **#570 に未記録**（`:22` の 2 件、とくに 390×844 での再現）。`sauce-layers-b2:178` の 2 件（2026-11-14、2026-11-20）は #394 に未記録の可能性がある（#394 の最終更新は 2026-11-13）。
- ゲージ関連（`sauce-gauge-489.spec.ts`・`SauceRemainingGauge`・`sauceDispenseController`）を触る open PR は **無し**。

## 4. 原因の分析（読み取り。コードとログによる）
**(a) ゲージの減り方は実時間で、速い。** `SAUCE_TICK_MS = 50`、`SAUCE_RATE_PER_TICK = 0.02`（`src/logic/sauceQuantity.ts`）＝**毎秒 40 ポイント**（満タン 2.5 秒）。吐出は `requestAnimationFrame` の実タイムスタンプで進み（`PizzaStage.startDispenseSession`）、フレームが遅れても刻みは落とさず補う（1 回の `step()` で最大 10 刻み＝500ms 分）。
**(b) `:22` の許容 8 ポイントは 200ms 分しかない。** テストは「中央で押下（`mouse.down`）→ `waitForTimeout(1200)` → `mid` を読む → `mouse.up()` → `waitForTimeout(100)` → `after` を読む」で `|after − mid| ≤ 8`。押している間は**減り続ける**ので、`mid` の読み取りから実際の pointerup までが約 200〜250ms を超えると、減少分だけで 9〜10 になる。CI の 10 は約 250ms 相当で、#570 の測定表（挿入待ち 250ms → 10）と一致する。#570 の測定どおり、`after` は pointerup 時点の値と一致しており、「コミットで値が跳ぶ・戻る」現象は見えていない。**ずれは押下中の継続的な減少で説明できる。**
**(c) 30 秒 timeout 型は、準備段階の遅さの累積。** `:22`（V9 の run）では 37.7 秒、`sauce-layers-b2:178`（2 件）でも 30 秒超、いずれも最後は `Page closed` / `Target ... closed`（timeout の後始末でページが閉じた形）。`startFreshMargherita`〜`completeDoughStep` などの準備を含む合計が、遅い瞬間に 30 秒を超えたと読める。**どこで時間を使ったかはログから確定できない**（WebKit は `trace: off`、診断用のステップ別経過時間なし。#531 の「未確認」と同じ）。
**(d) 同じ shard 3/3 に、実時間の「押下→待つ」系のテスト（`sauce-gauge-489`・`sauce-layers-b2`・`sauce-edge-475` など）が集まっている**（#394 の 2026-11-06・11-10 の記録とも整合）。runner の一時的な遅延（CPU の取り合い、WebKit の描画負荷）で、実時間に依存するテストだけが落ちる、という説明が最も素直。**未検証の仮説**で、原因の確定ではない。
**(e) アプリ本体の回帰の証拠はない。** 失敗は特定の変更と対応せず、再実行で通り、通常の所要時間は安定（5〜8 秒）。

## 5. 再現性・未確認
- **WebKit での再現: 未実施**（Playwright の WebKit をこのセッションで入手できない。CI の `workflow_dispatch` を繰り返す方法は実行コスト・Owner の許可の面で行っていない）。
- Chromium では、#570 が限定測定（遅延を挿入）で再現しているが、**CI 上で実際にその遅延が起きたことは未確認**（失敗時のスクリーンショット・trace・`error-context.md` の artifact は未取得。署名付き URL の先がセッションのネットワーク方針で拒否されるため）。
- 頻度: 直近 100 run 中 `:22` は 2 件（2%）、ソース系全体で 4 件（4%）。分母は run 数で、テスト実行ごとの失敗率ではない。直近 24 時間に 2 件が集中した理由（runner の混雑か偶然か）は不明。

## 6. 別 Issue 化の要否と、Owner に判断してほしい点
- **別 Issue 化: 不要**（#570・#531・#394 が既にある）。**新しい事例の追記**を推奨（#570 に `:22` の 2 件、とくに 390×844 での 1 件目とドリフト型の 2 件目。#394 に `sauce-layers-b2:178` の 2 件）。**今回は Owner の依頼が「要否の報告」までなので、コメントは書いていない。** 追記してよいか Owner の判断を求める。
- **修正（テストのみの変更案。いずれも未実施・要承認、skip・retry・timeout 延長・しきい値緩和はしない）**:
  1. `:22`: 最後の assertion を、「`mid` を読んだ後の押下時間」に依存しない形にする。例: pointerup のイベントの瞬間にページ内で `aria-valuenow` を記録し、`after` がその値と等しい（許容 0〜2）ことを見る。**今の許容 8 より厳しい検査**で、「コミットで値が戻らない」という意図を直接確かめる（#570 の測定で `after` は pointerup 時の値と一致している）。
  2. 30 秒 timeout 型（`sauce-layers-b2:178`、`sauce-gauge-489:22/68`）: **PR #642 の方法**（固定 sleep でなく、stroke の完了条件で待つ）を残りのソース系テストへ広げる。
  3. 証拠の取得: WebKit の `trace` を「最初の再試行のときだけ on」にする（CI 設定の変更。実行時間の増加に注意。#394 / #531 の「次のアクション」と同じ）。
  4. apt 取得の失敗（13 件）は別系統（#643）。
- 担当: #394・#570・#531 に担当者がいないため、**誰がこの CI 安定化を担当するか**も Owner の判断。私の claim（#825）の範囲外なので、指示があるまで着手しない。
- プロンプト往復数の見積り: 追記 1 往復、テスト修正（案 1）の PR で約 2〜3 往復（WebKit の CI 検証を含む）。

## 7. 限界
読み取り専用で、CI の再実行・WebKit の再現・artifact の取得はしていない。ログは GitHub Actions のジョブログのみ。原因は仮説（実時間依存）であり、確定ではない。
