# FINISH FIN-B — FINISH の食材トレイと dock（タップ配置・後乗せ在庫ゲート、本番では不活性、#294）

base `main` `30da9b3`（FIN-A #600 merge 後）。Owner 承認: FIN-B のみ。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` の「`RECIPES` に FINISH なし」「Free Cooking / Lunch Rush / Dinner は FINISH を持たない・走らせない」は無変更）。
FIN-C（↩ と完成ボタン）/ FIN-D / FIN-E は含めない。#478 / #468 / #584 / #581 / #295 は変更なし。#518 は close しない。共有 Preview は更新していない。レシピ・食材・save schema は無変更。

## Owner 決定との対応

| Owner 決定 | 実装 |
|---|---|
| ガイド FINISH のトレイは後乗せ要件の食材のみ | `finishTrayIngredients(recipe, owned)`（`prepareDock.ts`）: `applicationPhase === "POST_BAKE"` かつ所持かつ scatter の topping のみ。焼成前の食材・チーズ・ソースは出ない。ファミリー絞り込み・ページャなし |
| 所持数と配置可能数を正しく表示 | 有限在庫の食材は `あと{配置可能}/{所持}`（所持 = 焼成後の在庫、配置可能 = 所持 − FINISH で置いた数）。常備品は従来どおり（`常備` / `∞`）。chip は `canPlacePostBakeIngredient` で無効化 |
| タップ配置を優先、新しいドラッグ操作なし | 食材を選ぶ → ピザをタップ → 既存の `PLACE_TOPPING`（reducer の FINISH 分岐、`stage: "post"`）。`physicalDragEnabled` は渡さない |
| FINISH の全消しなし | 「やり直す」なし |
| FIN-C の ↩・完成は対象外 | 下部バーは「ヒント」のみ。↩ / 次へ / 完成 はなし（テストで不在を固定） |
| #478 は変更せず | `IngredientTray` は `finish` prop を足しただけ（既定 false で従来描画と同一） |

## 変更

| ファイル | 内容 |
|---|---|
| `src/logic/prepareDock.ts` | `finishTrayIngredients` を追加 |
| `src/components/IngredientTray.tsx` | optional `finish` prop。母集団を `finishTrayIngredients` に、在庫ゲートを `canPlacePostBakeIngredient` に、バッジを `あと n/m` に切り替え、ファミリー行を出さない。`finish` なしの描画は無変更 |
| `src/screens/GameScreen.tsx` | FINISH に `prepare-dock`（`finish-dock`）+ `IngredientTray finish` + 「ヒント」バーを表示。stage は FINISH で compact（PREPARE と同じ）。CUT の roomy は無変更。`isFinishStep` のときだけ新しい DOM が出る |
| `src/state/gameReducer.ts` | `SHOW_HINT` が FINISH では `buildFinishHintLine(recipe, pizza, true)` を返す（他のステップ・ラウンドは無変更） |
| `src/state/finishD2Inert.test.ts` | 利用者リストに `gameReducer.ts -> finishHint` を追加（他の見張りは無変更） |
| `src/screens/GameScreen.finish.test.tsx` | FIN-A の「roomy / トレイなし」を compact / ヒントのみに更新。FIN-B 5 件追加（後述） |
| `src/state/gameReducer.finishPreBakeLock.test.ts`（新規） | FINISH 中に焼成前の piece・ソース・生地が変わらないこと、`SHOW_HINT` の整合 |
| `e2e/harness/finish-screen.{html,tsx}` | harness を実 reducer + App と同じ選択 / タップ配線で状態を持たせた（`stock=` `late=` を追加。アプリ build には入らない） |
| `e2e/finish-tray-finb.spec.ts`（新規）/ `e2e/finish-screen-fina.spec.ts`（更新） | 後述 |
| `tools/finishTrayFinB{Shots,Video}.mjs` | 撮影ドライバ（dev のみ） |
| `docs/reports/screenshots/fin-b-finish-tray/` | after（390×844 / 360×800 × 6 場面）。before は FIN-A の `fin-a-finish-screen/`（トレイなし・roomy） |

## compact / roomy の再測定

FINISH にトレイを出すため stage を roomy（CUT 寸法）から compact（PREPARE 寸法、pizza cap `min(76vw, 290px)`）に変更。dock の高さは `--dock-other-rows`（1 行 or 2 行）で確保。CUT は roomy のまま。

| viewport | 状態 | 結果（e2e 実測） |
|---|---|---|
| 390×844 / 360×800 | トレイ 1 / 2 / 3 chip | stage 下端 ≤ dock 上端、tray 下端 ≤ 下部バー上端、バー下端 ≤ viewport、ページスクロールなし、pizza 幅 > viewport の 60%、chip 高 ≥ 44px かつ viewport 内 |

## 既存画面の不変

| 確認 | 結果 |
|---|---|
| `IngredientTray` は `finish` false で従来と同一（既存の tray / 在庫 / ページャ / ファミリー系 vitest を無変更で実行） | PASS |
| CUT の stage は roomy のまま（`roomyStage` は CUT で従来式と同値） | PASS |
| 既存 e2e（cut-skip-failed-bake / post-layer-d22a / dynamic-cooking-steps / making-step-tabs-cs4a / undo-placement-449 / cooking-tray-family-row-stable / viewport-1screen、両 viewport） | 下記「検証」 |
| Free Cooking / Lunch Rush / Dinner で FINISH・トレイ・ヒントバーが出ない | vitest + e2e（FIN-A の spec を維持） PASS |

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | PASS |
| oxlint | 新規警告なし（harness の only-export-components は既存 harness と同じ既存パターン） |
| vitest 全体 | 490 files / 9066 tests PASS（2 skipped, 6 todo は既存）。初回の全体実行で `finishD2Inert.test.ts` の利用者リスト 1 件が落ち（`gameReducer.ts -> finishHint` の追加漏れ）、リストを更新して当該ファイルが PASS。その後の全体再実行は未実施 |
| FIN-B vitest（`GameScreen.finish.test.tsx` 12 件 + `gameReducer.finishPreBakeLock.test.ts` 11 件） | PASS |
| FIN-A + FIN-B の e2e（`finish-screen-fina` / `finish-tray-finb`、390×844 と 360×800） | 各 viewport 15 件 PASS |
| 既存 e2e（上表の 7 spec、両 viewport） | 147 PASS / 19 skipped（既存の skip） / 0 failed |
| 実 WebKit | 未確認（Chromium のみ）。CI の WebKit shard で確認する |

## 実 WebKit

このセッションは Chromium のみ。CI の WebKit shard に任せる（FIN-A と同じ扱い）。

## 範囲外（Owner 決定どおり）

↩ と完成ボタン（FIN-C）、完了 → RESULT の貫通 E2E（FIN-D）、FINISH 本番有効化、共有 Preview の更新、#518 の close、#478 の変更。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `fin-b-finish-tray-390.mp4`（H.264） | 390×844 | 30.9 s | 338 KB | PASS |
| `fin-b-finish-tray-360.mp4`（H.264） | 360×800 | 31.9 s | 321 KB | PASS |

Download: セッション内直接提出（commit しない。Policy §6）。ffprobe で codec / 解像度 / 長さ、ffmpeg で最後までのデコードを確認。

確認できること（字幕つき）: トレイに後乗せ食材のみ（あと 3/3）→ 選択 → タップで後乗せ配置（2/3 → 1/3 → 0/3）→ 0 で選択不可・在庫超過のタップで増えない → ヒントボタンで「あと 2 個」→ 後乗せ 3 種のトレイ → 生焼けでも後乗せは変色しない → Lunch Rush / Dinner / Free Cooking では出ない。

Video Verification: PASS
