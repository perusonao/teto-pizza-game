# 柚子胡椒ソース色の変更（PR-1）— Result Report

Refs #578（New Sauces）。描画改善の一部（エビのむきエビ化は別 PR-2）。

## 変更
- `yuzu-kosho` の `ingredient.color` を `#b5c56a` → `#a3ad52`（黄みオリーブ）に変更（`src/data/lateCatalog.ts`）。
- 理由: 現行色は明るい黄緑の広いペーストに見えた。Owner が比較試作（現行 / A `#a3ad52` / B `#8f9a3f` / C `#bcbf6e`）から案Aを採用（2026-10-25）。
- 変更していないもの: 共通の opacity（0.85）、CSS フィルタ（`App.css`）、Canvas 描画経路、採点・判定・材料ID・レシピ・セーブ形式。
- 色を固定していたテスト（`lateCatalog.yuzu.test.ts`）・e2e コメント・関連文書を更新。`docs/reports/TETO_RECIPE-EXPANSION_YUZU-TSUKIMI_Pre-Implementation-Audit.md` と U0 Gate は当時の記録として未変更。

## 影響
- 色は ingredient ごとに独立。ジェノベーゼ（`#6b8e3d`）・トマト等のソースは不変。
- 見た目が変わる箇所: ソース層（平塗り・塗りヒートマップ）、Pizza Select / 見本サムネイル。共通フィルタ（生焼け saturate 1.18 / 焼成後 hue-rotate -6deg）は不変のため、焼成前後の挙動は従来どおり。

## 検証
- vitest（`src/data/lateCatalog*`）6 files / 100 tests PASS。
- 実ゲーム e2e（`e2e/new-sauces-u1.spec.ts`、390×844 / 360×800）: ショップ→塗り→焼成→FINISH→NEW DISCOVERY→Dex まで完走しスクリーンショット取得。末尾の `expect(errors).toEqual([])` が `404 (Not Found)` のコンソールエラーで失敗するが、**origin/main でも同一に失敗**（サンドボックスのネットワーク起因。色変更とは無関係）。
- ジェノベーゼとの識別: 比較シート（スクラッチ）で A は `#6b8e3d` と明確に区別できることを確認。実機での薄塗り・重ね塗りは HV 項目。

## スクリーンショット
`docs/reports/screenshots/yuzu-kosho-color-pr1/`（`before/` `after/`、各 viewport の `before-after-<viewport>.png`: 上段=before、下段=after、左から sauce-painted / topped / baked(finish) / new-recipe）。390×844 と 360×800 のレイアウト崩れなし。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| yuzu-kosho-color-pr1-390x844.webm | 390×844 | 36.2s | 1.5MB (VP8) | PASS |

Download: セッション内直接提出（repository 未 commit）。WebM（MP4 化ツールの代わりに Playwright 標準出力をそのまま使用）。

Video Verification: PASS

この動画で確認すること:
- 柚子胡椒の塗り色が、広い黄緑ペーストではなく落ち着いたオリーブ系に見えるか。
- 生焼け→焼成後で色が自然に変化するか。
- ジェノベーゼ（緑）と見分けられるか（実機で薄塗り・重ね塗りも）。
- 生地・モッツァレラ・エビ・大葉と並べて読みやすいか。

## iPhone HV 手順
1. ショップで柚子胡椒を購入（または保有済みデータ）→ 柚子えびピザを作る。
2. SAUCE で柚子胡椒を塗る。トマト/ジェノベーゼを別ラウンドで塗って色を比較。
3. 焼成前後・完成サムネイル・図鑑で色を確認。
4. 色が不適なら Owner が B `#8f9a3f` / C `#bcbf6e` へ切替（1行変更）。

## 残リスク
- 色は実機 HV まで暫定（従来どおり）。
- 実 e2e の末尾 404 はサンドボックス起因で main と同一（CI での挙動は CI に従う）。
