# Issue #474 Phase A-0 + A-1 — DOUGH 状態表示 Result

- 基準: `main` `6b86798`。ブランチ `claude/dough-shaping-phase0-audit-q3o7ma`。
- 範囲: A-0（純関数）と A-1（「次へ」が無効な理由の1行表示）。A-2 / A-3 / B（耳・焼き色）は含まない。

## 変更
- `src/logic/doughFeedback.ts`（新規）: `doughSizeStatus(shape)` → `SMALL | READY | LARGE`、文言 `DOUGH_SIZE_STATUS_TEXT`。完了判定は既存の `isDoughShapeComplete` を読むだけで、しきい値（0.75）は不変。LARGE は平均半径が理想（48）を超えた時。
- `src/App.tsx`: 既存の `pendingDoughShape ?? 確定済み形状` から状態を導出して `GameScreen` へ渡す（表示専用）。
- `src/screens/GameScreen.tsx`: PREPARE dock 内（DOUGH の空き領域）に固定高 20px の `role="status"` / `aria-live="polite"` の1行。無効な「次へ」に `aria-describedby`。`doughShapeComplete` が false の時は props に関わらず必ず SMALL（CTA と矛盾しない）。
- `src/App.css`: `.dough-status-readout`（20px 固定、dock 上端に固定、1行・折り返しなし）。
- 変更していないもの: `hints.ts`、`doughShape.ts`（`applyStretchPoint` / 範囲 / しきい値）、reducer、scoring、`cut/*`、pizza state、保存、経済。

## 文言（#474 Phase 1 の3案をそのまま採用。数値・採点表現なし）
- SMALL: もう少し大きく伸ばそう
- READY: いい大きさ！「次へ」で進めよう
- LARGE: 大きめでもOK。縮めて整えてもいいよ

## 検証（ローカル・Chromium。WebKit / iPhone 実機は未検証）
- `npx tsc -b` 通過 / `npm run build` 通過 / 変更ファイルの oxlint 指摘なし（既存警告のみ）。
- `npx vitest run`: 384 files / 7023 passed, 1 skipped。新規: `doughFeedback.test.ts`（7）、`GameScreen.doughStatus.test.tsx`（5）。
- 新規 e2e `e2e/dough-size-status-474.spec.ts`（390×844 / 360×800 の各2件）: SMALL → READY → LARGE → 縮めて SMALL に戻る、その間 生地と「次へ」の位置が不変、1行が画面内かつ生地と CTA の間、横オーバーフローなし、SAUCE では表示されない。
- 既存 e2e（iphone-390x844 / iphone-360x800 / layout-chromium）: stage-size-stability, viewport-1screen, making-ui-1screen, layout-contract（LC-S 含む）, layout-invariants-lb, family-layout-contract, result-1screen-2.0, pizza-cutting-phase4b, cut-regions-427 を実行し 94 passed / 11 skipped / 失敗 0。

## スクリーンショット
`docs/reports/screenshots/dough-size-status-474/`（before = main、after = 本ブランチ。390×844 / 360×800、初期 / 途中 / READY / LARGE）。

## 残課題
- A-2（方向の弧ハイライトと不要リング整理）、A-3（押下を r≤50）は別 PR。LARGE の e2e は現状 r≤48 の押下制約のため、内側から外へ引く操作で到達している（A-3 で見直す）。
- iPhone 実機 HV と WebKit CI の確認が必要。動画は直接提出（リポジトリ外）。
- B（耳の描画・焼き色）は #421 / #468 の方針確定後に再監査。
