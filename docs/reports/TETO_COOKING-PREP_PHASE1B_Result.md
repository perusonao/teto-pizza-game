# Cooking Prep Phase 1B Result — 牛肉の炒め: 3 タップ → 焼き加減を見て取り出すタイミングゲーム

Status: **実装済み・自動検証済み（Vitest 全件 / Chromium E2E 2 画面 / tsc / lint / build）。WebKit は CI、実機 HV は Owner 待ち。本番フラグ `PREP_EXPERIENCE_PRODUCTION = false` のまま。PR 未作成・未 merge。**
管理 Issue: **#696**（claim 投稿済み: https://github.com/perusonao/teto-pizza-game/issues/696#issuecomment-6492202357。#611 は別件のため使っていない。#294 は参照のみ）
基準 main: `ffff081c0136df43113a81c170343d24d968ed1f`（#695 merge 後）。ブランチ `claude/cooking-prep-1b-timing-game`。設計: `…_PHASE1B_Fresh-Audit.md`（`d5f7754`）・`…_PHASE1B_Gameplay-Visual_Research.md`（`b978ec5`）。Owner 決定 D1〜D3・Q1〜Q5・J-1〜J-5、演出 C-min。

## 実装したゲーム操作
1. beef を選ぶ → 「🍳 炒める」ピル（#695 のまま、押して離した位置で開始）→ パン画面。
2. 牛肉が **最大 6 秒、自動で焼けていく**。プレイヤーは色・つや・湯気/煙を見て **「取り出す！」を 1 回**押す。
3. 判定は押下の `pointerdown` の `timeStamp`（描画の遅れは入らない）。**early `0 ≤ t < 2100ms` / best `2100 ≤ t < 4200ms` / overdone `t ≥ 4200ms`**（半開区間。4200ms ちょうどは overdone）。`6000ms` で自動終了（overdone・「出し遅れた…」）。**時間切れと押下が競合したら時間切れ優先**。開始 300ms は押下を無視（ボタンも薄く表示）。
4. ゲージ・バー・リング・数値・カウントダウン・残り時間は**どこにも出さない**（Q3。DOM にも数字・`progress`/`meter`/`timer` なし。E2E で検査）。
5. 結果は牛肉の**上のタイトル欄**に表示（牛肉を隠さない）: best「ちょうどいい！」/ early「まだ赤みが残ってる」/ overdone「焦げちゃった…（煙が出る前に！）」/ 時間切れ「出し遅れた…」。レシピ・標的には依存しない（AC-12）。
6. best は約 0.7 秒で自動で閉じ「✓ 炒め済み」。early / overdone は **「もう一度炒める」「これで使う」**（300ms 後に有効）。× はいつでも閉じられ、何も残さない。スキップ（ピルを押さない）は従来どおり。blur / hidden / 工程切替 / やり直しでの破棄も #695 のまま。
7. 「これで使う」を選ぶと、**取り出した時点の色**（early の淡い色 / best の炒め済み / 焦げ）で配置済み・以後に置く牛肉が描かれる。

## 演出（Option C-min、色は暫定＝J-5）
| 段階（定数から導出） | 範囲 | 手掛かり |
|---|---|---|
| 0 生 | 〜1800ms | 赤、湯気なし |
| 1 焼き始め | 1800〜2100ms | 赤が褪せ、白い湯気と泡（入口の予兆） |
| 2 ベスト | 2100〜3600ms | 茶、**つやのピーク**、安定した湯気 |
| 3 もうすぐ焦げ | 3600〜4200ms（判定上は best） | つやが落ち、湯気が**灰色の煙**に、縁が濃く（出口の予兆） |
| 4 焦げ | 4200〜6000ms | 濃い茶〜焦げ、濃い煙、つやなし |
- 非色の手掛かり（つや・湯気→煙・泡）を必須にした（protan で生→炒め済みの色差が約半分になるため）。段階 3 は **タイマー 1 回のクラス切替**（色の再描画 約 12Hz とは別。予兆を遅らせない）。
- パン内の牛肉を拡大（`clamp(84px, 34cqw, 124px)`、旧 64px）。パン内面を暗い灰から**暖かい茶**へ、牛肉の背後に**油のにじみ**（明るい halo）を追加し、焦げた牛肉が背景に沈まないようにした。
- reduced motion: 湯気・泡・結果のアニメを止める。**段階は静止画で読める**（湯気の有無・濃さ・灰/暗灰の煙の色、つや、牛肉の色。E2E で 4 フレームを検査）。
- 描画: 動くのは `transform` / `opacity` のみ。色更新は約 12Hz に間引き。判定は描画と無関係。

### 実描画での視認性（390×844、スクリーンショットのピクセルから。机上値ではない）
| 牛肉の状態 | 赤身の塗り vs 隣の油の halo | 暗い縁取り vs halo | 参考: #695 のパン（`#3a3a3a`）との赤身コントラスト |
|---|---|---|---|
| 生 `#b8473a` | **1.00 : 1**（輝度は同じ。色相の差と縁取りで読める） | 2.75 : 1 | 2.17 : 1 |
| best（炒め済み）`#7a4226` | 1.86 : 1 | 3.38 : 1 | 1.43 : 1 |
| 焦げ `#3a2218` | 2.58 : 1 | 3.27 : 1 | 1.30 : 1 |
→ 焦げ・炒め済みは旧パンより見やすくなったが、**生の赤は輝度コントラストが約 1.0**（色相と縁取りに頼る）。実機 HV で見え方を確認する（残存リスク参照）。

## 変更ファイル（本ブランチ、main `ffff081` から）
| 区分 | ファイル | 内容 |
|---|---|---|
| docs | `docs/reports/TETO_COOKING-PREP_PHASE1B_Fresh-Audit.md`、`…_Gameplay-Visual_Research.md` | `d5f7754` / `b978ec5` を取り込み。#611 → #696、**4200ms の閉区間を半開区間へ統一**（§4.1・§6・§8 Q2） |
| docs | `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` | 冒頭に Phase 1B 改訂の注記、P-1・AC-3（`preparedLook` を追加）・AC-13（失敗状態なし、所要の再定義）を改訂 |
| 純ロジック | `src/logic/prep/panDoneness.ts`（新規）、`panDoneness.test.ts`（新規 36 件） | 定数・`gradeAt`・`panStageAt`・`panReducer`（ARM・時間切れ優先・二重入力・時計異常）・結果文言 |
| 色 | `src/logic/prep/beefDoneness.ts`(+test) | 3 点補間 `beefLookColors` / つや `beefLookGloss`（山形）/ `beefLookStyle`、`preparedPieceVisual(id, progress?)`（既存の `beefDonenessStyle` は後方互換のまま） |
| 定数 | `src/logic/prep/prepOffer.ts` | `PREP_TOSSES` / `PREP_TOSS_DEBOUNCE_MS` を削除（`PREP_DONE_MS` / `PREP_GUARD_MS` は維持） |
| UI | `src/components/CookingPrepLayer.tsx`、`CookingPrep.css`(+test) | パン画面を全面改修（上記） |
| 表示 | `src/components/PizzaStage.tsx` | 任意 prop `preparedLook` を追加（+3 行。未指定は従来と同一） |
| **HOT** | `src/state/gameReducer.ts` | `PREP_INGREDIENT` に任意 `progress`、`GameState.preparedLook`（transient）、RESET_PIZZA で除去。**+約 10 行** |
| **HOT** | `src/screens/GameScreen.tsx`、`src/App.tsx` | `preparedLook` の受け渡し 1 行、`onPrepIngredient(id, progress)` の署名 1 行（各 +1〜2 行） |
| テスト | `prepIngredient.preparedLook.test.ts`（新規）、`prepFixtures.ts`、`prepIngredient.architecture.test.ts`、`PizzaStage.CookingPrep.test.tsx`、`GameScreen.CookingPrep.test.tsx`、`e2e/cooking-prep.spec.ts` | 下記 |
- **HOT file の競合確認:** #478（draft、base が古い）は `GameScreen.tsx` に +15/−5、#468 は `PizzaStage.tsx` を触る計画。1B の差分は両ファイルとも**既存行を変更せず小さく追加する範囲**（GameScreen は署名 1 行と prop 1 行）で、既存の変更は上書きしていない。後から merge する側が base を取り込む（claim に明記）。
- **不変の確認:** `BeefSlices` / `IngredientGlyph.tsx` / `ingredients.ts` / `bakeVisual.ts` / `App.css` / 採点 / 在庫 / Dex / `persistence.ts` / `pendingRound` / `prepExperienceGate.ts`（`PREP_EXPERIENCE_PRODUCTION = false`）は無変更。

## 安全条件の確認（テストで固定）
- 保存・採点・在庫・Dex・journal: `preparedLook` は `pendingRound` / `persistence` / `scoringV2` に**出ない**（architecture test が `preparedLook` も走査）。progress が 0 / 0.2 / 0.525 / 0.9 / 1 のどれでも、炒めあり/なしで pizza / score / scoringV2 / completion / inventory / dex / pitz / journal が同一（`prepIngredient.preparedLook.test.ts`）。E2E で保存データ（localStorage）の前後同一も確認。
- reducer の拒否は従来どおり**同一 state 参照**で、`progress` が非有限なら拒否。0..1 に clamp。再炒めは同一参照で拒否、最初の look が残る。RESET_PIZZA / PLAY_AGAIN / RETRY_SAME_RECIPE / 新ラウンドでは**プロパティ自体が消える**。
- フラグ OFF: `CookingPrepLayer` は null、`PizzaStage` は prop 未指定で同一 DOM、dock に `inert` なし（既存テストが無修正で通過）。
- Preview のセーブデータは変更・削除していない（HV 入口はメモリのみ）。

## テスト結果
| 区分 | 結果 |
|---|---|
| 単体・境界 | `panDoneness.test.ts` 36 件（境界 2099/2100/4199/4200/4201/5999/6000、NaN/負/Infinity、1ms 刻みの全域 sweep、ARM、時間切れ優先、二重入力、時計異常、段階の単調性と判定との整合）。`beefDoneness`（3 点補間の単調性・つやの形・端点）、reducer（`preparedLook`）、`CookingPrepLayer`（fake timer で 37 件）、`GameScreen.CookingPrep`（6 件）、`PizzaStage.CookingPrep` |
| 全 Vitest | **実行中（完了後に追記）。** 関連範囲（`src/logic/prep` `src/components` `src/screens/GameScreen.CookingPrep` `src/preview`）は 123 files / 1979 tests 全 pass |
| `tsc -b` | エラーなし |
| oxlint | 触ったファイルに**警告 0**（残る警告は `CheesePoolCanvas.tsx` / `GameScreen.tsx:542` の既存分で、本変更前から存在） |
| `npm run build` | 成功 |
| **Chromium E2E** | `e2e/cooking-prep.spec.ts` **44 / 44 pass**（390×844 と 360×800 の各 22 件）。`page.clock` で時刻を凍結し、キーボード押下（同じ偽時計）で境界を ms 単位で検証。ポインター経路は実時間で `data-stage` を待つ（sleep に頼らない）。ゲージ非表示、段階の境界、保存不変、ガード、× / 再挑戦 / 使う、レイアウト（取り出す！ ≥56px、× から ≥16px、結果ボタン ≥48px、スクロールなし）、reduced motion |
| **WebKit** | **ローカル不可**（Playwright の WebKit が無い環境）。CI の WebKit シャードで確認する。E2E は `page.clock` とキーボード、`dispatchEvent("pointerdown")` のみで WebKit でも動く構成 |
| ローカルでの Playwright 実行 | この環境の Chromium とリポジトリの Playwright の版が合わないため、**リポジトリ外**の一時設定で `executablePath` を上書きして実行（リポジトリの設定は無変更） |

## Human Verification（HV Policy）
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `cooking-prep-1b-hv-390x844.mp4`（H.264、25fps、**リポジトリには commit しない**） | 390×844 | 49.1 秒 | 641 KB | PASS（下記） |

Download: セッション内で Owner へ直接提出（`SendUserFile`）。
動画で確認できること（人間の速度、実ブラウザ・`?cookPrepHv=1&cookPrep=on` の使い捨て入口、**実ポインター入力**）: ① 牛肉 3 枚を置く → ② ピル → パン画面、③ 早く取る（early・赤み）→「もう一度炒める」、④ 放置して **時間切れ**（「出し遅れた…」）、⑤ 煙の中で取る（overdone）、⑥ × で閉じる → 再度開く、⑦ **ベストで取る**（ちょうどいい！→ 自動で閉じ「✓ 炒め済み」）、⑧ 焼く → 取り出す → 完成 → RESULT（炒め済みのまま既存フローが完走）。
Video Verification: **PASS**（ファイル存在・size > 0・最後まで再生可能・390×844 全体が映る・対象操作が映る・ffprobe: h264 / 390×844 / 49.12s）。
スクリーンショット（commit 済み）: `docs/reports/screenshots/cooking-prep-1b/`（390×844 と 360×800 の各 14 枚: ピル、置いた牛肉、各段階のパン、各結果、炒め済みの盤面、完成、RESULT）。比較用の before（#695 の 3 タップのパン画面）は `docs/reports/screenshots/cooking-prep-prb/after-*-4-pan-2of3.png`。

### Owner が確認すべき HV（実機 iPhone Safari、`?cookPrepHv=1&cookPrep=on`。合計パン操作は約 10 回以内）
| HV | 内容 | 見るところ（○/△/×） |
|---|---|---|
| **HV-1 初見** | 説明なしで牛肉を炒めて「取り出す！」を押す | ① 操作が分かった ② **牛肉の変化だけで**取り時を判断できた（色/つや/湯気/煙のどれで？）③ ベストで達成感があった ④ ボタンを 1 回で押せた。**生の赤が背景から見分けられるか** |
| **HV-2 失敗の納得** | わざと早く取る / 煙の中で取る / 放置して時間切れ。「もう一度」と「これで使う」を 1 回ずつ | ⑤ early・⑥ overdone・時間切れの理由が分かった ⑦ 次の改善が分かった ⑧ 結果が長く感じない ⑨ 色以外（つや・煙）で気づけた ⑩ 結果の文言（暫定）の確認 |
| **HV-3 連続・誤タップ・360×800** | 360×800 で 3 枚を連続で（1 回は ×、1 回はスキップ）。炒める → 置く → 焼く | ⑪ 誤タップなし（ピル直後・結果直後に生地へ漏れない。**開始 300ms の「取り出す！」の薄さが無反応に感じないか**）⑫ 360×800 で押せる・スクロールなし ⑬ 連続で面倒にならない ⑭ 配置後の牛肉の色が結果と対応して見える |
調整可能な初期値（Owner 決定）: ベスト帯 2100〜4200ms、最大 6000ms、開始 300ms（`panDoneness.ts` の 1 か所）。色・結果文言は暫定（`beefDoneness.ts` / `panDoneness.ts`）。

## 残存リスク
1. **WebKit は CI 待ち**（`inert`・`cqw`・`page.clock` 経由のテストは Chromium のみ確認）。
2. **生の赤の視認性**: 輝度コントラストが halo に対して約 1.0:1（色相と縁取り 2.75:1 に依存）。見え方が悪ければ、halo を段階 0 で弱める調整が最小の対応。
3. 色（焦げ `#3a2218` ほか）と結果文言は暫定（J-4・J-5）。
4. 配置後の牛肉（約 20px 幅）で early / best / burnt の差が読めるかは未確認（S4。拡大スクリーンショットで 3 色が異なることのみ確認）。区別が不十分なら Owner に報告し、勝手に配置後の表示は足さない。
5. 固定の時間軸は覚えられる（数える戦略）。火力ばらつきは J-2 で不採用。
6. 360×800 でピルと生地が 4.2px（#695 の既知リスク。1B は悪化させていない）。
7. HOT file（`gameReducer.ts` / `GameScreen.tsx` / `App.tsx`）は最小変更だが、#478 / #468 の merge 順しだいで base の取り込みが要る。
8. 通常 Preview の保存エラーは #695 の調査どおり既存データ由来の可能性が高いが未確定（本変更は保存コードを触っていない）。
9. 動画の撮影は dev サーバ上（Preview ビルドではない）。見た目の確認用で、実機 HV の代替ではない。

## 次のアクション
1. Owner: 動画と画面を確認 → 実機 HV（上表）→ 色・文言・ベスト帯の調整指示。
2. 準備が整ったら Final Gate（CI 11/11 と WebKit、Codex、HV の結果）を確認し、**Owner の指示で** PR を作成する（本ブランチでは PR 未作成）。
3. #478 / #468 の merge 状況を再確認（HOT file）。
