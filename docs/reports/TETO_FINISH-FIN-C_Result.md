# FINISH FIN-C — FINISH 専用の ↩（Undo）と 完成 ボタン（本番では不活性、#294）

base `main` `bae83fd`（FIN-B #601 merge 後）。Owner 承認: FIN-C のみ。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` は無変更）。
FIN-D / FIN-E は含めない。#478 / #468 / #584 / #581 / #295 は変更なし。#518 は close しない。共有 Preview は更新していない。レシピ・食材・save schema・reducer・`finishEngine`・在庫ロジックは無変更。

## Duplicate Gate

- open PR 全件を再確認。FINISH の Undo / 完成ボタンを扱う PR・Issue・claim なし（Issue 検索も 0 件）。
- 重なりうるもの: #478（draft。`GameScreen.tsx` / `IngredientTray.tsx` のトレイドラッグ）は、本 PR が `IngredientTray` を触らず、`GameScreen` も FINISH 分岐のみのため競合なし（`GameScreen.tsx` は HOT ファイル。先に merge された側へ後発が rebase する）。#468 は `PizzaStage` / `App.css`、#584 は `App.css`（本 PR の CSS は末尾追記 12 行のみ）、#581 は無関係。

## 既存契約の確認（再利用のみ）

| 契約 | 確認結果 |
|---|---|
| `UNDO_LAST_PLACEMENT` | FINISH では `undoablePlacementIndex` が `stage: "post"` かつ topping の直近 1 個だけを返す（D1a）。焼成前 piece・ソース・生地は対象外。在庫は触らない。reducer 無変更で再利用 |
| `CONFIRM_MAKING_STEP`（FINISH を離れる） | FINAL 評価（`finalizeRound`）を 1 回だけ実行し、同じ遷移で `bakeValue` を null にして在庫を消費。後乗せ 0 個は既存の Completion Gate で FAILED。reducer 無変更で再利用 |
| `REGISTER_TO_DEX` | `phase === "RESULT"` ガードで exactly-once（App の `handleConfirmMakingStep` が従来どおり続けて dispatch） |
| 在庫 | 消費は FINAL の 1 回のみ。FINISH 中の配置・Undo は在庫を変えない |

## 変更

| ファイル | 内容 |
|---|---|
| `src/screens/GameScreen.tsx` | FINISH の下部バーを ↩（`UNDO_LAST_PLACEMENT`、`canUndoPlacement` で disabled）/ 完成（`onConfirmMakingStep`）/ ヒント に。「やり直す」「全消し」なし、確認ダイアログなし。完成は同一ステップでの二重押下を ref で破棄（reducer の消費 1 回保証に加えた UI 側の保険）。在庫 0 または FINISH のトレイにない食材が選択されたままなら選択を解除する effect（FIN-B 持ち越し）。後乗せ食材を持たない場合はトレイの代わりに 1 行の説明文を表示 |
| `src/App.css` | `.finish-tray-empty`（説明文のスタイル、末尾追記）。バーは既存の `.prepare-bake-bar--undo` / `.prepare-undo-button`（44×44）を再利用 |
| `src/screens/GameScreen.finish.test.tsx` | FIN-B の「FIN-C 部品なし」を「↩ / 完成 / ヒントのみ・やり直す等なし」に更新。FIN-C 7 件追加 |
| `e2e/harness/finish-screen.tsx` | ↩ と完成を実 reducer に接続（完成は App と同じく `REGISTER_TO_DEX` も）。`owned=none` を追加 |
| `e2e/finish-bar-finc.spec.ts`（新規）/ `e2e/finish-screen-fina.spec.ts`（更新） | 後述 |
| `tools/finishBarFinC{Shots,Video}.mjs` | 撮影ドライバ（dev のみ） |
| `docs/reports/screenshots/fin-c-finish-undo-complete/` | after（390×844 / 360×800 × 7 場面）。before は FIN-B の `fin-b-finish-tray/`（↩ と完成なし） |

## FIN-B 持ち越し: 在庫 0 でも選択状態が残る

- 調査: `IngredientTray` は在庫 0 の chip を disabled にするが、App / GameScreen の `selectedIngredientId` は残り、chip が「選択中かつ無効」の見た目になり、ピザをタップすると reducer の在庫ゲートで弾かれるだけだった（配置が増えることはない = 安全性の問題ではなく表示の不整合）。
- 修正（FIN-C の範囲で安全）: FINISH の間のみ、選択中の食材が「FINISH のトレイにない / 後乗せ在庫なし」になったら `onClearIngredientSelection` を呼ぶ。PREPARE のトレイ・選択ロジックは無変更。Undo で在庫が戻っても自動再選択はしない（再度タップで選ぶ）。
- ミューテーション確認: effect の解除呼び出しを外すと「在庫が尽きたら選択解除」のテストが落ちる。

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | PASS |
| oxlint | 新規警告なし（harness の only-export-components は既存 harness と同じ既存パターン） |
| vitest 全体 | 491 files PASS / 1 skipped、9074 tests PASS（2 skipped, 6 todo は既存）。FIN-C 分は 7 件追加・1 件更新 |
| FIN-C の vitest（`GameScreen.finish.test.tsx` 19 件） | PASS（↩ 初期 disabled / 直近 1 個のみ・連続 Undo・再配置・焼成前不変 / 在庫 0 で選択解除 / 後乗せ 0 個で FAILED・ダイアログなし / 二重押下で在庫 1 回 / 説明文） |
| FINISH の e2e（`finish-bar-finc` / `finish-screen-fina` / `finish-tray-finb`、390×844 と 360×800） | 46 PASS |
| 既存 e2e 回帰（cut-skip-failed-bake / post-layer-d22a / dynamic-cooking-steps / making-step-tabs-cs4a / undo-placement-449 / cooking-tray-family-row-stable / viewport-1screen、両 viewport） | 147 PASS / 19 skipped（FIN-B 時と同数・既存の skip） / 0 failed |
| 既存レシピ・既存モード | 既存 vitest 無変更で PASS。FINISH 分岐は `isFinishStep` のときだけ DOM が出る（Lunch Rush / Dinner / Free Cooking は e2e で非表示を確認） |
| 実 WebKit | 未確認（このセッションは Chromium のみ）。PR の required CI（WebKit shard）で確認する |

### e2e の実測（両 viewport）

↩・完成・ヒントはすべて 高さ・幅 ≥ 44px、viewport 内、横並びで互いに重ならない。トレイ下端 ≤ バー上端、ヒント行下端 ≤ stage 上端、ページスクロールなし（後乗せ 1 / 3 種で測定）。説明文もステージとバーの間に収まる。CUT 付きプロファイルでは完成 → CUT に進み、CUT の表示・操作は変更なし。

## 範囲外（Owner 決定どおり）

FIN-D（完了 → RESULT の貫通 E2E・実レシピ）、FIN-E、FINISH 本番有効化、共有 Preview 更新、#518 close、レシピ・食材・save schema 変更。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `fin-c-finish-undo-complete-390.mp4`（H.264） | 390×844 | 50.1 s | 582 KB | PASS |
| `fin-c-finish-undo-complete-360.mp4`（H.264） | 360×800 | 50.0 s | 543 KB | PASS |

Download: セッション内直接提出（commit しない。Policy §6）。ffprobe で codec / 解像度 / 長さ、ffmpeg で最後までのデコード、代表フレームの目視で確認。

確認できること（字幕つき）:
- FINISH のバーが ↩ / 完成 / ヒント。後乗せ 0 個では ↩ が無効（焼成前の食材は戻せない）。
- 配置 → ↩ で直近の 1 個だけ取り消し → 連続 ↩ → 後乗せ 0 個で無効 → 取り消し後の再配置。
- 在庫 1: 配置すると選択が解除され無効になる。追加タップで増えない。
- 後乗せ食材を持たない場合の説明文。後乗せ 3 種でもトレイ・↩・完成・ヒントが重ならない。
- 後乗せ 0 個で 完成 → 確認なしで RESULT（失敗）。後乗せありで 完成（連打）→ RESULT。
- CUT 付きは 完成 → CUT。Lunch Rush / Dinner / Free Cooking では FINISH 画面が出ない。

Video Verification: PASS

## Final Gate（PR 作成時点）

- required CI（WebKit shard 含む）・独立レビュー・Codex レビュー・未解決スレッド・mergeability は PR 作成後に確認して別途報告する。merge は Owner の明示承認を待つ。
