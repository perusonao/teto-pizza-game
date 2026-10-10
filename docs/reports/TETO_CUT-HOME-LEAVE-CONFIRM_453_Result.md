# Result Report — Guided CUT 中のホーム退出確認（Issue #453）

Base: main `db04247`。

## 変更
- `src/App.tsx`: `isRoundInProgress()` の FREE 分岐に `POST_BAKE` を追加。`handleGoHome()` の確認 OK 後のリセット（`PLAY_AGAIN`）にも `POST_BAKE` を追加。
- `src/App.test.tsx`: Guided（ビスマルク）で CUT まで進め、キャンセルで CUT に残る／OK で HOME → 次ラウンドが新規になることを検証（修正前は fail を確認）。
- `e2e/cut-home-leave-confirm.spec.ts`: マルゲリータで同じ流れを 390×844 / 360×800 で検証。

## 変更していないもの
Dinner、Lunch Rush、保存形式（`persistence.ts`）、reducer、Cooking Steps の新機能（FINISH など）、CUT 省略（#256 / #320）。

## 検証
- Vitest 全体: 372 ファイル pass、`HintSheet.test.tsx` の anti-spoiler sweep が 1 回だけ fail。単体再実行では修正あり・なしとも 33/33 pass（全体実行時のみの不安定、本変更と無関係と判断）。
- `tsc -b` クリーン。oxlint は既存 warning のみ。
- Playwright Chromium: 新 spec が 390×844 / 360×800 で pass。修正を外すと 390×844 で fail（確認ダイアログ 0 回）。
- WebKit は CI に委ねる（ローカル未実行）。

## Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）
- 動画（390×844、MP4/H.264、変換元は Playwright WebM）: ユーザーへ直接提出。repo には含めない。
- スクリーンショット: `docs/reports/screenshots/cut-home-leave-confirm/{before,after}/`
  - `after`: CUT 中 → キャンセルで残る → OK で HOME → 次ラウンドは新規。
  - `before`: 修正前は確認が出ないため、E2E が途中で fail し 1 枚のみ。
- 動画は E2E の自動操作で、各状態の保持時間は短い。
- Owner HV 承認前の merge は不可。
