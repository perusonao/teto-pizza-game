# Result Report — #457 初回プレイUX Phase A: 発見後の図鑑導線

Base: `main` `e0397ae`. Parent: #47. Audit source: 初回プレイUX Fresh Audit (P2-1 / P2-2).

## 変更
- **発見リザルト（NEW PIZZA）**: 主CTA（「🔎 次のピザを研究する」/「🛒 新しい食材を見る」）は不変。Dex 登録行に副導線「📖 図鑑を見る」を併置（`ResultPanel.tsx`）。主CTAが既に「図鑑を見る」のときは重複させない。Dex はリザルトの上に重ねるオーバーレイなので、閉じると同じリザルトへ戻る。
- **図鑑フッター**: 「次のピザを作る」/「もう一枚作る」→「閉じる」（実動作＝`onClose` のみ）。ヘッダーの「閉じる」と同名にならないよう `aria-label="図鑑を閉じる"`（表示ラベルを含む）。
- テスト更新: 旧「主CTAは1つ（Dex リンクなし）」を固定していた `ResultPanel.test` / `ResultPanel.research.test` / `e2e/discovery3-pool2-production` と、フッター名を固定していた `378.stockBlockedResearch.test`。Playwright の `name: "閉じる"`（部分一致）が曖昧になる4 spec に `exact: true`。
- 新規 E2E: `e2e/discovery-result-dex-link-457.spec.ts`。

## 変更していないもの
初回生地ガイド、やり直し確認、ホーム主CTA（別PR）。Anti-Oracle Contract 2.1（Dex の表示情報量・匿名性）、発見・保存（schema）・Pitz 経済・採点は不変（`src/state` / `src/logic` の差分なし）。

## 検証
- `tsc -b` clean / `oxlint` 新規警告なし（既存警告のみ）。
- Vitest: `src/App* src/screens src/components` ほか関連 99 files / 1446 tests pass。
- Chromium E2E（iphone-390x844 / iphone-360x800）: 新規 spec + 関連 41 + 28 pass、`layout-contract`（layout-chromium）12 pass。
- 新規 E2E の実測: 「図鑑を見る」「新しい食材を見る」「閉じる(footer)」が両 viewport で高さ ≥ 44px・viewport 内、横オーバーフローなし。Dex を開閉してもリザルト本文が同一、save の margherita は `timesMade: 1`（再登録なし）。

## Human Verification
- Video（repository には commit しない）: `artifacts/review/dex-link-457_390x844.mp4` — 390×844, H.264, 37.1s, 602,511 bytes。内容: 初回発見 → リザルト（主CTA + 副導線）→ 「図鑑を見る」→ Dex（マルゲリータ NEW）→ 最下部の「閉じる」→ 同じリザルトへ復帰 → ヘッダー「閉じる」でも復帰 → 「新しい食材を見る」→ Shop → ホーム → ピザ図鑑（回帰）。
- Video Verification: PASS（ffprobe で codec/解像度/長さ確認、フレーム抽出で対象操作を目視確認）。
- Screenshots: `docs/reports/screenshots/dex-link-457/{before,after}-{390,360}-{1-result,2-dex-open,3-dex-footer}.png`（before は main、Dex はホーム経由で開いたもの）。
