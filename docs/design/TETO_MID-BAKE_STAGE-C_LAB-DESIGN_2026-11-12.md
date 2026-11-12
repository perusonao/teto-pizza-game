# MID_BAKE 段階C — 独立 Lab の設計と非HOT 領域の実装準備

Issue #795 ／ 作成: 2026-11-12 ／ 基準 `main` `4314ca2` ／ **今回は docs-only（コードは書かない）**
claim: Issue #795 コメント 6823595041（`:stage-c`、`docs/design/TETO_MID-BAKE_STAGE-C_*` のみ）
Owner 判断: Q1・Q2・Q3・Q5・Q13 は GO。Q1 の停止タイムアウト 6 秒は **Lab 検証用の暫定値**（Production 仕様として固定しない）

## 1. Lab の目的

HOT ファイル（`gameReducer.ts`・`GameScreen.tsx`・`PizzaStage.tsx`・`App.css`）に触れずに、次を iPhone Safari で検証する。

1. 窓の入口で針を止める挙動（案 P）の手触り。
2. タップで 1 個ずつ追加する操作（Q3）の成功率。
3. 代替操作が同じ `ADD` に落ちること（入力元で結果が変わらない）。
4. 通常 BAKE が変わらないこと（回帰）。

Lab は FRY Lab（#749）と同じ位置づけ: 独立した Preview/DEV 限定の画面。**本番バンドルに opt-in 名が残らない**ことを条件にする。

## 2. 構成（案）

| 部品 | 役割 | 置き場（新規のみ） |
|---|---|---|
| 針の時計 | BAKE と同じ線形 0→100、窓の入口で停止、再開 | `src/logic/midBake/labClock.ts`（純粋。`bakeProgress.ts` の定数を import するだけで変更しない） |
| 停止ポリシー | 追加が揃う／「とじる」／タイムアウト（暫定 6 秒）で再開 | 同上 |
| Lab 画面 | 針、止まった表示、トレイの別枠、タップ追加、「とじる」、結果表示 | `src/components/midBakeLab/**` |
| 入口 | `?cookMidBakeHv=1`（DEV/Preview のみ、使い捨てのメモリ内セーブ） | `src/preview/midBakeLab*.ts` ＋ `src/main.tsx` への数行（FRY Lab 等と同じ追加箇所） |
| ログ | 窓の実時間、追加回数、成功／取り逃し、誤タップを画面外に出力（HV の記録用） | `src/components/midBakeLab/**` |

- **時計の扱い**: エンジンの `now` には BAKE の時計（積算した経過秒）を渡す。壁時計は使わない（`BAKE_MAX_FRAME_DT_S` によるフレーム上限のため）。停止中は `now` が不変で、`now === lastAt` の ADD は有効（エンジンの契約）。
- **ゲート**: `MID_BAKE_EXPERIENCE_PRODUCTION` は `false` のまま。Lab 用の opt-in は PREP／FRY と同じ構造（静的ゲート）で足し、本番ビルドでは除去される。ゲート追加のテストは `midBakeGate` の隣に置く。
- **エンジンの変更は不要の見込み。** 停止・再開は統合側の時計で表現できる。窓は「止まっている間だけ追加を提示」するので、再開後に ADD を提示しなければエンジンの窓判定は安全網にとどまる。

## 3. 操作の設計（Q3・Q5）

- 準備: Lab では PREPARE 相当の別枠を最初から用意する（natto 2 個）。実ゲームの別枠 UI は段階 D。
- 追加: トレイのチップをタップ → 1 個追加（`ADD`）。必須個数で打ち止め（超過は no-op）。
- 代替操作: 同じ `ADD` を出す別のボタン（折りたたみ。#784 の方針）。結果は同一。Lab では代替操作の UI は最小限の確認用に限る（実装の承認は #784 側の別判断）。
- 停止中の取り出し: 誤タップ防止のため無効化（判断表 D1 の推奨）。
- ドラッグ: 初期スコープ外（#478 の後）。

## 4. HV 計画（Lab 用、判断表 §4 の具体化）

- ラウンド A（通常操作）／B（代替操作。VoiceOver・外付けキーボードは別セッション）／C（回帰）。
- 暫定の合格基準（**Lab 用の暫定値、Production 仕様として固定しない**）: 自然な操作 10 回のうち 8 回以上が代替操作なしで必須個数に到達、誤って取り出す事故 0 回、通常 BAKE の回帰なし。
- 記録: 窓の実時間（動画）、追加回数、成功／取り逃し、停止の印象。合否の言葉は Owner のもの。
- 入口の作成・Preview の更新は別途 Owner 承認。共有 Preview の手動更新は行わない。

## 5. 非HOT 領域の実装準備（実装は別 claim）

次の claim を、実装を始める直前に別途取得する。

| 作業 | 範囲 | 競合確認 |
|---|---|---|
| C-1 時計・停止ポリシー | `src/logic/midBake/labClock*.ts`（純粋＋テスト） | `src/logic/midBake/**` は現在 claim なし |
| C-2 Lab 画面 | `src/components/midBakeLab/**`、`src/preview/midBakeLab*` | 新規ディレクトリ。`src/main.tsx` は #738・#746・FRY Lab が追加する場所（数行。後から merge する側が取り込む） |
| C-3 E2E | `e2e/mid-bake-lab*.spec.ts` | `e2e/support/**` は HOT のため触れない（既存ヘルパーを読むだけ） |

実装の開始条件: この設計への Owner の確認、`main` と open PR の再確認（特に `src/main.tsx`）、上記 claim の取得。

## 6. 触らないもの

HOT ファイル、catalog、golden、PREP／FRY の実装（FRY の純粋ロジックは import せず、`requiredState` の値だけを使う）、本番ゲート、共有 Preview。
