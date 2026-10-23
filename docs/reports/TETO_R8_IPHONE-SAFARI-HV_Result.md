# R8 (#617 / PR #618) — iPhone Safari 実機 HV 結果と自動テスト証跡（Result Report）

- 日付: 2026-10-23
- 対象 SHA: `a6c1463226254e6a769842ce3fa678465f7c93a7`（main。R8 本体 `83f4b55` から、R8 の実装・テストファイルに差分なし：`git diff --stat 83f4b55 a6c1463 -- <R8 の src / e2e>` が空）
- 実機の環境: 共有 Preview（`perusonao.github.io/teto-pizza-game-preview/`、PR#618・`a6c1463`、2026-10-23 07:20Z ビルド・Pages デプロイ済み）
- 種別: **テスト追加（e2e のみ）＋ docs のみ**。`src/**`・本番設定・共有 Preview・Firebase は変更していません。UI/UX/gameplay の変更ではないため、HV 動画・before/after 画像は対象外です（`TETO_HUMAN-VERIFICATION-POLICY.md` の適用対象外）。
- 準備資料: `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md`（A〜H の手順。本書の項目 ID はそれに従う）

## 1. 結論（PASS／未確認／FAIL）

「PASS（実機）」は Owner の実機報告があるものだけです。自動テストの PASS は別欄に分けます。実機で一部しか確認できていない項目は、確認できた部分だけを PASS と書き、残りは未確認とします。

| 区分 | 項目 | 判定 | 根拠 |
|---|---|---|---|
| 実機 | B-1 の一部：CUT 中の強制終了→再起動後に **調理結果と図鑑登録が残り、作成回数が 2 回**（二重登録の兆候なし） | **PASS（1 回・Owner 報告）** | §2 |
| 実機 | B-1 の一部：**復旧通知「中断していたピザを完成させました」の表示** | **未確認**（Owner は覚えていない。PASS 扱いにしない） | §2 |
| 実機 | B-1 の一部：所持数が戻らないこと、Pitz・ベスト・★ の反映 | **未確認**（報告なし） | §2 |
| 実機 | B-2（「確認した」→再起動）、D-1（強制終了 3 回）、B-3、C、D-2、D-3、E、F、G、H | **未実施（未確認）** | §2 |
| 自動（WebKit CI） | R8 E2E `r8-pending-round.spec.ts` 7 本 × 2 viewport = 14 実行 | **PASS**（`a6c1463` の run 39901251967） | §3 |
| 自動（Chromium・本セッション） | R8 E2E 14 実行、Lunch Rush 既存 `material-shortage` 6 実行、**新規 Lunch Rush 保存・復元 E2E 6 実行** | **PASS（26/26）** | §4・§6 |
| 自動（Vitest・本セッション） | `pendingRound.*`・`roundNoticeCopy`（5 ファイル） | **PASS（90/90）** | §6 |
| 自動（Vitest・全体） | 対象 SHA での全体実行 | **未確認**（`ci.yml` は PR 時のみ実行。main push では走らない） | §3 |
| CI | `a6c1463` の E2E WebKit run の Gate | **FAIL**（R8 以外の 2 テスト。R8 の 14 実行は通過） | §3・§5 |
| 自動 | Lunch Rush のブラウザ E2E（保存・復元） | **本書で追加し PASS**（以前は 0 本） | §4 |
| 実機・自動とも未確認 | E-5（実容量超過）、`unavailable`／`dropped`／`mismatch`／`oversize` の画面表示、実 iOS の `localStorage` 挙動 | **未確認**（E-5 は禁止のため実施しない） | PREP §5.1 |

**実機 HV の総括：1 項目（B-1 の一部）のみ。HV 全体を PASS と判定できる状態ではありません。**

## 2. Owner 実機確認の記録

Owner 報告（原文の要旨）:

- iPhone Safari の共有 Preview（PR#618・`a6c1463`）で実施
- マルゲリータ 2 回目の CUT 中に Safari を強制終了して再起動
- 再起動後、調理結果と図鑑への登録を確認。図鑑の作成回数は正常に 2 回。二重登録の兆候なし
- 復旧通知の表示は覚えていないため未確認

判定の根拠と限界:

| 観点 | 判定 | 理由・限界 |
|---|---|---|
| CUT 中の強制終了後に図鑑へ登録される | PASS（実機 1 回） | 強制終了前の CUT 中は未登録のはず（`r8-pending-round.spec.ts`「a reload in the middle of CUT」と同じ想定）。再起動後に登録があったことは、journal の完了（`settlePendingRound`）が動いたことと整合する。ただし強制終了前の作成回数・所持数・Pitz は記録がなく、「1 回だけ増えた」ことの直接確認ではない（Owner の「正常に 2 回」という判断に依拠） |
| 二重登録の兆候なし | 1 回の再起動に限り PASS | D-1（通知を確認せず強制終了を 3 回）は未実施。反復での二重登録は未確認 |
| 復旧通知の表示 | **未確認** | 表示された・されなかったの記憶がない。**表示されなかった場合は R8 の通知仕様に反する**可能性があるため、次回の実機 HV で必ず確認する（§7） |
| 端末・iOS・Safari かホーム画面か | 未記録 | PREP §3 E-4 の記録項目。Owner に確認が必要 |
| 画面録画 | 未提出（受領なし） | 必須ではないが、通知の有無を後で確認できなくなった原因でもある |

通知が出なかった可能性を排除できないため、**この結果だけで「R8 の実機復旧は PASS」とは言いません。**

## 3. 対象 SHA の自動テスト・CI 証跡

- E2E WebKit [run 39901251967](https://github.com/perusonao/teto-pizza-game/actions/runs/39901251967)（`a6c1463` の push）：**WebKit Gate failure**。
  - R8 の `r8-pending-round.spec.ts` は両 viewport で **7/7 通過（計 14 実行）**。`r8-hv.spec.ts` は意図的にスキップ。`save-protection-pr2/pr3` も通過。
  - 失敗は R8 以外の 2 件（§5）。layout-chromium、360×800 の 3 shard、390×844 shard 3 は成功。
- Vitest（`ci.yml`）は `pull_request` のみで動く。`a6c1463` 自体の Vitest 全体は CI で観測していない（PR #636 のヘッドは tree が異なる）。R8 のファイルは `83f4b55` から無変更。
- Chromium E2E（`iphone-*`）は CI で実行されない（ローカル手動）。本書の Chromium 結果は §6 の本セッション実行分だけ。
- 以前の報告書（`TETO_FINISH-R8_PENDING-ROUND_Result.md`）にある「Vitest 504 ファイル／9287 テスト通過」は PR #618 時点の記録で、本セッションでは再確認していない。

## 4. Lunch Rush の保存・復元 E2E（調査と追加）

### 4.1 既存のブラウザ E2E（調査結果）

| ファイル | Lunch Rush の何を見るか | 保存・復元は？ |
|---|---|---|
| `lunch-rush-material-shortage.spec.ts`（#212） | 材料不足の注文のスキップ、時計の継続、スキップ後の在庫（egg 0 のまま）、材料が尽きた run の終了 | リロードなし。保存の確認は「egg が 0 のまま」だけ。**保存・復元は見ていない** |
| `lunch-rush-result-ranking-phase4.spec.ts` | 結果画面の統計、週間ランキング行 | `reload()` は DOM 注入の準備用。**保存・復元は見ていない** |
| `layout-contract.spec.ts`（LC-3） | Lunch Rush の画面レイアウト | レイアウトのみ |

Vitest の `pendingRound.lunchRush.test.ts`（9 本）が L-1 の規則を固定していたが、ブラウザ（実 `localStorage`・実リロード）で確かめるテストは 0 本だった。

### 4.2 追加したテスト（最小の 3 本）`e2e/lunch-rush-r8-restore.spec.ts`

Lunch Rush 内で finite な在庫を消費させるため、注文を funghi（マッシュルーム。マルゲリータの材料は無限で消費されず、Lunch Rush の具材パレットにも他の材料は出ない）にしている。

| テスト | 確認すること |
|---|---|
| G-1 | 焼いて提供パネルで止めた時点で、保存のマッシュルーム在庫は焼成前のまま・図鑑は未登録・`pendingRound` なし。リロード後も同じで、「中断したピザ」通知は出ない |
| G-4 | 「次の注文へ」（提供）で在庫の消費と登録が保存される（図鑑が 1→2）。リロードしても消費は戻らず、二重登録もない |
| G-5 | 1 枚提供したあと 2 枚目を焼いて提供前にリロードすると、戻るのは 2 枚目の分だけ。提供済みの分は消費のまま |

- 「アプリ内で提供せず退出（HOME／期限切れ）」＝ G-6（既知の例外）は Vitest のみのまま（最小化のため追加していない）。
- 回帰検出の確認：`gameReducer.ts` の L-1 条件を一時的に外すと G-1 と G-5 が失敗（Expected 9 / Received 6、Expected 6 / Received 3）。G-4 は通過（想定どおり）。その変更は元に戻した（`git status` はテスト追加のみ）。
- WebKit：このコンテナには WebKit がない。CI の WebKit shard での実行は PR 後に確認が必要（未確認）。

## 5. WebKit Gate の R8 以外の失敗 2 件（run 39901251967、`webkit-390x844`）

いずれも **再実行していない**（初回結果を固定）。timeout 延長・retry・skip・Gate 緩和はしていない。同じ run の 360×800 では 2 本とも通過している。

| # | テスト | 症状（ログ） | 既存 Issue | 原因 |
|---|---|---|---|---|
| 1 | `discovery-hint-sheet.spec.ts:278`（Discovery Hint 2.0 sheet「target flow」）shard 1/3、22.1 秒 | `openPanel`（spec:214）で `.hint-sheet__panel` が 5 秒間 `element(s) not found`。`askMaterial` のループ内（spec:328） | **#394（包括 Issue）に重複**。同じ spec の `:280`（1/92、再実行で通過）と `:393`（#530 で分割済み）が記録済み。:278 の今回の症状は :393 の「30 秒 timeout → page closed」とは異なる | **未特定**。仮説（未検証）：`openPanel` の `entry(page).count()` は待たないため、回答直後に「ヒントをもらう」がまだ描画されていないと click を飛ばして panel を待つ形になる。この job は WebKit のインストールが約 11 分かかり（他の job は 30〜40 秒）、runner が遅かった可能性がある |
| 2 | `lunch-rush-material-shortage.spec.ts:82`（#212、スキップ後の run）shard 2/3、35.5 秒 | spec:112 `getByRole("button", { name: "次の注文へ" }).click()` が `waiting for element to be visible, enabled and stable` で止まり、`Target page, context or browser has been closed`。**`test.setTimeout(120_000)` に対し 35.5 秒で終了しており、timeout の teardown ではなく page／context が先に閉じた** | **#394 と #562 の系統（click の actionability 待ちで停止）**。`lunch-rush-material-shortage` の記録は #394・#562 に見当たらない（この spec の初出）。#562 は 30 秒 timeout の teardown 型で、今回は 120 秒の予算内に閉じた点が異なる。#394 の 2026-10-10 追記（LC-3 の `page closed`、51 秒）に近い | **未特定**。lifecycle リスナーがなく、crash の有無は不明。ローカル Chromium 390×844 では同 spec が通過（3 回中 3 回、本セッション）。**R8 の変更（`83f4b55`）とは経路が異なり、R8 起因を示す証拠はない**が、「次の注文へ」は L-1 の提供確定（`MISSION_NEXT_ORDER`）を通るため、再発したら R8 起因でないことを確認する価値がある |

#394 への追記案（記録のみ。**未投稿**。Owner の指示があれば投稿する）：run URL・shard・テスト・症状・再実行なし・R8 の 14 実行は通過・ローカル Chromium は通過。

## 6. 本セッションで実行したテスト

| 実行 | 結果 |
|---|---|
| Playwright Chromium `iphone-390x844` + `iphone-360x800`：`lunch-rush-r8-restore`（新規 3 本）、`r8-pending-round`（7 本）、`lunch-rush-material-shortage`（3 本） | **26 passed / 0 failed**（1.9 分） |
| Vitest：`src/state/pendingRound*`・`roundNoticeCopy`（5 ファイル） | **90 passed** |
| `oxlint e2e/lunch-rush-r8-restore.spec.ts` | 警告なし |
| `tsc --noEmit`（新 spec のみ、strict） | エラーなし |
| 一時的な回帰検証（L-1 を外す） | G-1・G-5 が失敗＝テストが効いている（元に戻して確認済み） |
| 未実施 | Vitest 全体、WebKit、E2E 全体（長時間の再実行を避けるため） |

## 7. 次に必要な実機操作（最小）

E-5・`hv-filler`・全ストレージ削除は行わない。共有 Preview は `a6c1463` のまま（再デプロイ不要）。

1. **通知の確認を最優先**：B-1 をもう一度（CUT 中に強制終了→再起動）。ホームの「中断していたピザを完成させました」通知の有無、図鑑の作成回数、所持数が焼成後の値のままかを控える。画面録画を推奨。
2. 通知を確認せずに強制終了→再起動を 3 回（D-1）→「確認した」→強制終了→再起動で通知が消える（B-2）。ここまでを同じラウンドで実施できる。
3. C-1〜C-3（HOME 離脱ダイアログ）と D-2（連打）を 1 ラウンドで。
4. 2 タブの E-4。
5. Lunch Rush（G-1／G-4）：本書の新規 E2E で自動確認できる部分は実機の優先度を下げてよい。実機は G-1（結果画面でリロード）だけでも可。
6. 端末・iOS・Safari かホーム画面かを記録する。

## 8. Owner 判断が必要な事項

1. 通知を再確認する実機 HV（上記 1〜2）を実施するか。未確認のまま R8 を完了扱いにするかの判断。
2. `lunch-rush-r8-restore.spec.ts` の追加を PR にするか（PR 作成・merge は Owner 承認待ち。CI の WebKit shard での初回結果が未確認）。
3. WebKit Gate の失敗 2 件を #394 に追記するか。`lunch-rush-material-shortage.spec.ts:82` を #562 側に関連付けるか。再実行（失敗 job のみ 1 回）をするか。
4. 実機の範囲（PREP §8 未決 2：ホーム画面追加 H-2、実容量超過 E-5、未知版 journal E-6）。E-5 は今回も禁止のまま。
5. G-6（アプリ内で提供せず退出）をブラウザ E2E に追加するか（現状は Vitest のみ）。
