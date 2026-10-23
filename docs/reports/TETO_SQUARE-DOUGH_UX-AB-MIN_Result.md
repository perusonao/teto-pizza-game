# Square Dough UX AB-min — 四隅 4/4・STEP 1 未完了の案内 Result（#536 / Epic #532）

状態: **Preview / DEV 限定で到達可能・本番では不活性**（四角の round は Production に無い）。**iPhone Safari 実機 HV は未実施（Owner 実機が必要。PASS ではない）。**
設計: `docs/design/TETO_SQUARE-DOUGH_UX-CLARITY_FRESH-AUDIT-DESIGN.md`（Owner Decision 1〜8 に従う）。STEP 2 は別設計 `docs/design/TETO_SQUARE-DOUGH_STEP2-SEPARATION_DESIGN.md`（docs-only、判定・難易度は未変更）。

## 変更
- 新規 `src/logic/pan/squareDoughGaps.ts`: 未被覆セルと、最大 3 か所の「隙間」（8 近傍の連結成分、大きい順）を**生地から導出**。矢印は「隙間の中のセル（重心に最も近い）」へ、「生地の上で 14% 以上離れた点」から。保存しない。
- 新規 `src/components/square/SquareGapGuideMarks.tsx` + `squareGapGuide.css`: 未被覆セルを淡く着色し、隙間へ破線矢印。`SquareDoughLayer` の 0..100 overlay に描くので**レイアウトに影響しない**。CSS は専用ファイル（D2-b1 の `squarePanStage.css`、D2-b2 の描画領域と同じ hunk を触らない）。
- `SquareDoughLayer.tsx`（配線のみ）: 条件は「コミット済み STEP が 1 かつ 4 隅到達」。指が下りている間は軌跡に譲る（既存の隅矢印と同じ）。隅の ✓ は STEP 1 の間は**輪郭リング**（`--reached-pending`、`data-pending`）、STEP 2 になってから従来の塗りつぶし。
- `SquareDoughGuide.tsx`: 同じ条件で既存の目標文を「すき間をうめよう（ひろがり 75.5%）」に、「次へ」下の行を「天板いっぱいに広がったら、つぎは「厚みを整える」」に**差し替え**（行は増やさない）。1〜3 隅は従来の文言。

## 触れていないもの
判定（`squareDoughProgress.ts`）・閾値（85 / 95 / 60%）・採点・Pitz・Reference・保存形式・reducer・ジェスチャ・`squareDoughView.ts`・`SquareTargetGuide`（流用なし）・丸い生地・SAUCE・CUT・RESULT。

## D2-b2 / 他タスクとの衝突確認（実装前）
open PR は #576（D2-b1）のみ関連で、変更は `squarePanStage.css`・そのテスト・E2E（`SquareDoughLayer` / `Guide` / `View` / gauge と重複なし）。D2-b2 のブランチは未作成。`claude/issue-537-square-pizza-cooking` は `panPlacement`・reducer のみ。→ 新規ファイル中心にして共有ファイルの変更を数行の配線に限定。D2-b2 の描画（灰色のえぐれ）を並行編集していない。

## 検証（ローカル Chromium。WebKit はローカルに無く CI で確認）
- `tsc -b` 通過、`oxlint` は既存の `CheesePoolCanvas.tsx` の警告のみ、`npm run build` 通過。
- 全 Vitest: **479 files passed / 8956 tests passed**（skip 2・todo 6 は既存）。新規: `squareDoughGaps.test.ts` 11、`SquareDoughGuide.test.tsx` +3、`SquareDoughLayer.gapGuide.test.tsx` 3。
- 新規 E2E `e2e/square-dough-gap-guide.spec.ts`（390×844 / 360×800 各 5 件、10/10）:
  - **四隅 4 本で STEP 1 未完了を固定**: corners=4・step=1・coverage<0.95・complete=false・「次へ」無効・ゲージは coverage / 目標 95%。目標文「すき間をうめよう（ひろがり x.x%）」、隅矢印 0 本、隙間矢印 1〜3 本、4 つの ✓ は `data-pending=true`。
  - **レイアウト不変**: STEP 帯・目標文・ゲージ・「次へ」行・天板の各 box、「次へ」下端、スクロール量が開始時と同一。矢印は天板の箱の内側。`SquareTargetGuide` の複製なし。
  - **矢印どおりに伸ばすと STEP 1 が終わる**: 最大 14 本のストロークで STEP 2（ひろがり ≥ 0.95、ガイド消失、✓ が塗りつぶし）。
  - 指が下りている間は軌跡に譲り、離すと戻る。4 隅未満は従来どおり。丸い生地に四角レイヤー・ガイドなし。
- 回帰 E2E（iphone 2 project）: `square-dough-*`（b / corners / touch / visual / diag / gap-guide）・`pan-switch-f4b`・`square-pizza-cooking-d2a2`（DOUGH→RESULT）・`sauce-edge-475`・`sauce-layers-b2`・`result-scale-514`・`cut-regions-427`: **148 passed / 2 skipped**。
- 実装前の実測（監査）: 四隅 4 本 → ひろがり 75.5%、矢印 0 本。実装後: 隙間 3 か所へ矢印、目標文が状態と一致。

## スクリーンショット
`docs/reports/screenshots/square-dough-gap-guide/{before,after}/`（390×844・360×800: 四隅 4/4 の停止状態、after は STEP 1 完了後）。動画は repo に含めず Owner へ直接提出（390×844、Playwright 録画）。

## 限界・未実施
- **iPhone Safari 実機 HV（Owner）**。「わかりづらい」が解消したかは実機でのみ判断。着色の濃さ（淡め）・矢印の本数（最大 3）は初期値。
- WebKit は CI で確認（間欠失敗 #394 / #529 / #531 はマスクしない）。
- 共有 Preview は**更新していない**（Owner 承認事項）。
- 既存の指摘: `SquareTargetGuide`（SAUCE 用）は四角の DOUGH 中も DOM にマウントされる（`PizzaStage.tsx:1549`、#321 の既知クラス）。本変更の範囲外。
