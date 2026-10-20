# FINISH FIN-A — GameScreen の FINISH 画面接続（仕上げタブ・ステージレイアウト・ヒント、本番では不活性、#294）

base `main` `d00bb33`（F-3 #599 merge 後）。Owner 承認: FIN-A のみ。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` の「`RECIPES` に FINISH なし」「Free Cooking / Lunch Rush / Dinner は FINISH を持たない・走らせない」は無変更）。
FIN-B（トレイ）/ FIN-C（↩ と完成ボタン）/ FIN-D は含めない。#478 / #468 / #584 / #581 / #295 は変更なし。#518 は close しない。共有 Preview は更新していない。

## Duplicate Gate

- open PR 全件の一覧を再確認。GameScreen / `postBakeView` / `finishHint` を FINISH 画面のために触る PR・Issue・claim なし（#478 は `GameScreen.tsx` / `IngredientTray.tsx` を触るが、トレイ配線で FIN-A の変更箇所と別。#468 は `PizzaStage` / `App.css`、#584 は `App.css`、#581 は無関係）。
- Issue 検索（FIN-A / FINISH 画面 / 仕上げタブ）で重複なし。本 PR は `App.css` / `PizzaStage.tsx` / `IngredientTray.tsx` / reducer に触れない。

## 変更

| ファイル | 内容 |
|---|---|
| `src/screens/GameScreen.tsx` | 唯一の POST_BAKE 描画判定を `renderedPostBakeStep` から `selectPostBakeStep(phase, step, finishStepAvailable(state, profile.steps))` に切り替え。`isFinishStep` を追加。FINISH では既存の `postBakeStepRendered` の全分岐（cooking layout / roomy stage / 仕上げタブ列 / stage interactive）が有効になる。FINISH 専用の order-card 行（recipe 名 + `buildFinishHintLine(recipe, pizza)`）を追加。タブ列の `nextReady` は FINISH 中 false（FIN-C まで完了操作がないので、FINISH の次のタブから round を進められない） |
| `src/state/finishD2Inert.test.ts` | 「D2-0 ヘルパーの利用者」を `PizzaStage -> pieceBakeClass` に加え `GameScreen -> finishHint / selectPostBakeStep / finishStepAvailable` に更新（他は未使用のまま固定）。他の見張りは無変更 |
| `src/screens/GameScreen.finish.test.tsx`（新規 7 件） | fixture（`finishFixture`、`RECIPES` 外）で: 仕上げタブが active、cooking layout + roomy stage、ヒント（名指し → 「仕上げはここまで！」）、後乗せレイヤー、FIN-B/C の部品が**ない**こと（tray / `prepare-bake-bar` / 1つ戻す / やり直す / 次へ・焼く！・完成）、CUT タブが（cut 線が足りていても）押せないこと、Lunch Rush・Dinner・Free Cooking では FINISH 画面が出ないこと |
| `e2e/harness/finish-screen.{html,tsx}`（新規・テスト用） | 実 `GameScreen` を fixture レシピ + 実 reducer（CONFIRM_BAKE → FINISH、PLACE_TOPPING）で FINISH に置くハーネス（`?bake=&post=&cut=&round=`）。アプリ build には入らない |
| `e2e/finish-screen-fina.spec.ts`（新規 9 件 × 2 viewport） | 実ブラウザ: 仕上げタブ active、ヒント行がステージの上、roomy な stage、dough が stage 内、ページスクロールなし、タブが viewport 内、3 焼成状態、FIN-B/C 部品なし、ヒント追従、CUT タブ lock、他ラウンドで非表示 |
| `tools/finishScreenFinA{Shots,Video}.mjs` | スクショ・動画の撮影ドライバ（dev のみ） |
| `docs/reports/screenshots/fin-a-finish-screen/` | 390×844 / 360×800 × 5 場面（焼成 3 状態、後乗せ 0 / 3、CUT 付き）。FINISH は新規画面のため before はなく、既存画面の不変は下表の DOM 比較で示す |

reducer / `finishEngine` / `cookingProfiles` / `PizzaStage` / `IngredientTray` / CSS / レシピ / save は無変更。

## 既存レシピ・既存モードの表示不変

| 確認 | 結果 |
|---|---|
| 実 `GameScreen` の描画 HTML を main（`d00bb33`）と本ブランチで比較（margherita / marinara / aussie / quattro-formaggi × BAKE・PREPARE 各ステップ・焼成後（CUT / RESULT）、Free Cooking の ORDER / PREPARE、計 26 画面） | **バイト同一**（比較用の一時テストは commit していない） |
| `finishD2Inert.test.ts`（全 `RECIPES` × Guided / Lunch Rush / Dinner / Free Cooking で FINISH が選ばれない） | PASS |
| 既存 e2e（CUT 4 spec・post-layer・dynamic-cooking-steps・making-step-tabs・undo-placement・viewport-1screen・finished-pizza-visual、両 viewport） | 148 PASS / 4 skipped（既存） |

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | PASS |
| oxlint | 新規警告なし（既存警告のみ） |
| vitest 全体 | 490 files / 9051 tests PASS（2 skipped, 6 todo は既存） |
| FIN-A の e2e（390×844 / 360×800） | 18 PASS |
| ミューテーション確認 | 「FINISH 中は次タブを進めない」を外すとテストが落ちる（cut 線を足した状態で確認） |
| 実 WebKit | 未確認（このセッションは Chromium）。CI の WebKit shard に任せる |

## 既知の事項（Owner 確認不要・FIN-B/C で解消）

- FINISH のヒント（D2-0 の `buildFinishHintLine`、文言は無変更）は「「次へ」で進もう」と言うが、FIN-A には完成ボタンがない。FIN-C で「次へ」が出るまで、この画面は fixture / Preview ハーネス専用（本番では到達しない）。
- FINISH にはトレイがないため、盤面を roomy にしている（CUT と同じ寸法）。FIN-B でトレイを出すときに stage の compact / roomy を再決定する。
- FINISH 画面には「見本」ボタンがない（CUT 行と同じ最小構成）。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `fin-a-finish-screen-390.mp4`（H.264） | 390×844 | 27.8 s | 389 KB | PASS |
| `fin-a-finish-screen-360.mp4`（H.264） | 360×800 | 27.6 s | 350 KB | PASS |

Download: セッション内直接提出（commit しない。Policy §6）。ffprobe で codec / 解像度 / 長さ、ffmpeg で最後までのデコードを確認。

確認できること（各場面 約 2.4 秒、下部に字幕）:
- 仕上げタブが active で、ヒントが後乗せ食材（パセリ）を名指しする（後乗せ 0 個）。
- 後乗せ 1 個 → 3 個でヒントが「仕上げはここまで！」に変わる。
- 生焼け / ジャスト / 焦げでも、後乗せのパセリは焼成フィルターで変色しない（#518 の分離）。
- FINISH の次の「カット」タブは押せない。
- Lunch Rush / Dinner / Free Cooking では FINISH を持つプロファイルでも仕上げ画面が出ない。

Video Verification: PASS

## 範囲外（Owner 決定どおり）

トレイ（FIN-B、ガイドは後乗せ要件の食材のみ）、↩ と完成ボタン（FIN-C、後乗せ 0 個は確認なしで FAILED、全消しなし）、完了 → RESULT の貫通 E2E（FIN-D）、FINISH 本番有効化（BBQ・新食材・技法）、共有 Preview の更新、#518 の close。
