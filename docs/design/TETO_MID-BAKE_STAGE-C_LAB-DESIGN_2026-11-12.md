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

- **時計の扱い**: エンジンの `now` には BAKE の時計（積算した能動時間）を**ミリ秒**で渡す（`labClockEngineNow` は `elapsedMs`。エンジンの `totalBakeMs` と同じ単位で、秒を渡すと進捗が 1/1000 になり窓が開かない）。壁時計は使わない（`BAKE_MAX_FRAME_DT_S` によるフレーム上限のため）。停止中は `now` が不変で、`now === lastAt` の ADD は有効（エンジンの契約）。
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

## 7. C-2／C-3 の HOT 競合確認と入口設計（2026-11-12 追記）

### 7.1 競合の確認結果（`main` `4314ca2`、open PR のファイル一覧）

| ファイル | 触る open PR | 備考 |
|---|---|---|
| `src/main.tsx` | **#738**（蒸す S3、+3 行: `activateCookSteamHv`）、**#746**（DRIZZLE Lab）、予定の FRY Lab | `hot-files.json` の HOT には入っていないが、複数の入口が追記する共有箇所。追記は同じ領域で、後から merge する側が取り込む |
| `src/App.tsx`・`src/components/PizzaStage.tsx`・`src/screens/GameScreen.tsx` | **#738** ほか | HOT。C-2／C-3 は触らない設計にする |
| `src/logic/midBake/**` | なし（旧 Codex 側 claim は release 済み、C-1 は #829 の別 claim） | — |

#738 のファイル一覧は 2 ページ（100 件超）を読んだ。**他の open PR の一覧は全件は読んでいない**ため、着手直前に再確認する。

### 7.2 入口の方式（案）

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| **(a) 独立画面（推奨）** | `main.tsx` の既存の `?dev=postlayer` と同じ形で、`?dev=midbake`（仮称）を静的な DEV/Preview ゲートの背後に置き、`import('./dev/…')` で Lab 画面だけを描く。`App`・実セーブ・`GameScreen` を読まない | HOT に触れない。実セーブに触れない。`main.tsx` への追記は 1 条件＋1 動的 import。Q9 の在庫検証は `inventory.ts` の純粋関数をメモリ上で使えば足りる | 通常 BAKE の回帰（ラウンド C）は実ゲーム側で別に確認する必要がある。`main.tsx` の追記は #738／#746 と同じ箇所のため merge 順の調整が要る |
| (b) cook\*Hv 型 | 使い捨てのメモリ保存＋starter で実ゲームの PREPARE→BAKE に入る | 実ゲームに近い | `App.tsx`・`GameScreen.tsx`（HOT）の変更が要る。#738 と直接競合 |

**推奨は (a)。** Lab の目的（窓の手触り・タップ追加・代替操作・在庫）は実ゲーム画面を必要としない。実ゲームでの確認は段階 D の後。
入口の名前（`?dev=midbake` か `?midBakeLab=1`）は Owner の希望に合わせる。

### 7.3 着手前の条件

1. 入口方式 (a)／(b) の Owner 確認。
2. `src/main.tsx` を触る open PR（#738・#746 ほか）の最新状態と merge 順の再確認。claim には「どの PR が先に merge されるか」を書く。
3. C-3（E2E）は `e2e/support/**`（HOT）を読むだけにして変更しない。`playwright.config.ts`（HOT）も変更しない。新しい spec が既存の設定で拾われるかを確認してから書く。
4. 新しい claim（C-2: `src/components/midBakeLab/**`・`src/dev/…`・`src/main.tsx`、C-3: `e2e/mid-bake-lab*.spec.ts`）。
