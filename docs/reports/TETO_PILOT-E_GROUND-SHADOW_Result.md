# Pilot E 接地影 — Result Report（Issue #720）

Base: main `d6528a8`（#719）。Owner 判断（2026-11-01）: Fresh Audit の案 1。

## 1. 何を変えたか

`src/App.css` に 1 ブロック（`display: none` の 1 ルール）を追加した。

```css
.ingredient-piece-visual__emoji .ingredient-glyph--green-pepper-strips > g > ellipse:first-child,
.ingredient-piece-visual__emoji .ingredient-glyph--bell-pepper-quarter > g > ellipse:first-child,
.ingredient-piece-visual__emoji .ingredient-glyph--pineapple-wedges > g > ellipse:first-child { display: none; }
```

- **効果:** ピザ上に置かれた green-pepper / bell-pepper / pineapple の、SVG に焼き込まれた接地影の楕円（`cy=57`、`opacity=.15`）だけを隠す。接地影の役割は `.ingredient-piece-visual__emoji` の既存 `drop-shadow(0 2px 2px rgba(0,0,0,.3))`（焼成中は `PizzaStage` の inline `filter` が再合成するもの）が引き継ぐ。
- **変更していないもの:** SVG 本体、`IngredientGlyph.tsx`、`PizzaStage.tsx`、焼成フィルタ（`bakeVisual.ts`）、他の食材の影、サイズ補正（1.45 / 1.65em）。
- **追加テスト:** `src/components/pilotEGroundShadowCss.test.tsx`（6 件）。セレクタが実マークップ上でこの 1 つの楕円だけに一致すること、ルールが 3 グリフだけを名指しすること、素のグリフ（トレイ / Dex / Shop）がスコープ外であることを固定する。

## 2. CSS だけで安全に選択できる根拠

- 楕円は 3 グリフとも、最上位 `<g>` の最初の子（`:scope > g > ellipse:first-child`）。他の楕円（パイナップルやパプリカの種の `ellipse`）は入れ子の `<g>` の中にあるため一致しない。
- スコープは `.ingredient-piece-visual__emoji`。置かれたピース、CUT のピース、RESULT、Reference 表示はすべてこのラッパー内で描かれる（`IngredientPieceVisual.tsx`）。トレイ chip / Inventory / Shop / Dex / ドラッグプレビューは `IngredientGlyph` を直接使うので、このラッパーの外にあり、楕円が残る。
- 実ブラウザの computed style で確認した（`e2e` の一時スペック。§4）: ピース上の 3 グリフの楕円はすべて `display: none`。変更前は `inline`。

## 3. 既知の限界（今回は対象外）

- `PizzaThumbnail`（レシピカード等の小さなピザ）は `.pizza-thumbnail__piece-emoji` 経由で `IngredientGlyph` を直接描くため、楕円が残る。「ピザ上」の範囲に含めるかは Owner の判断が要る。含めるなら同じルールにセレクタを 1 つ足すだけで済む。
- トレイ chip・Dex・Shop は意図どおり変更していない。
- heat 2.0 の黄・緑の濁り、パプリカとトマト（`tomato-slice`）の識別性は**観察のみ**。今回は撮影していない（Style Lock §11.7a の未検証項目のまま）。
- `PieceReliefFilter`（`pieceRelief.ts:16`）の CUT ピース上の二重影は #467 の範囲で、触っていない。

## 4. Before / After（実画面）

- Chromium（Playwright、`deviceScaleFactor` 3）で 390×844 と 360×800。比較対象: main `d6528a8`（before）と本ブランチ（after）。
- 食材ごとに、そのピースを含む実レシピをガイド付きで通した。
  - pineapple: `hawaiian`（焼成前 → 焼成後 → CUT → RESULT）
  - bell-pepper: `pesto-vegetariana`（焼成前 → 焼成後 → RESULT）
  - green-pepper: `veggie-supreme-pizza`（焼成前 → 焼成後 → RESULT）
  - 後ろ 2 つのレシピは CUT 工程がなく、RESULT へ直行する。CUT を通ったのは pineapple だけ。
- 画像: `docs/reports/screenshots/pilot-e-ground-shadow/`（左が before、右が after）。
- 見えた変化: before ではピース下に本体から離れた薄い楕円が残っていた。after では輪郭に沿った小さな影だけになった。CUT ピース上でもパイナップルの接地が同様に改善した。
- computed style の集計（ピース上のグリフ数）:

| レシピ | グリフ | before | after |
|---|---|---|---|
| hawaiian | pineapple-wedges | 10 個すべて `inline` | 10 個すべて `none` |
| pesto-vegetariana | bell-pepper-quarter | 2 個すべて `inline` | 2 個すべて `none` |
| veggie-supreme-pizza | green-pepper-strips | 2 個すべて `inline` | 2 個すべて `none` |

（360×800 も同じ結果。）

## 5. Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `teto-720-pilot-e-ground-shadow-390x844.mp4` | 390×844 | 88.6 s | 1.5 MB | PASS |

- Codec: H.264（yuv420p、30 fps）。Playwright の WebM を ffmpeg で変換した。
- 提出方法: セッション内で Owner へ直接提出（repo には commit しない。HV Policy §6）。
- 確認できること: hawaiian（CUT あり）、pesto-vegetariana、veggie-supreme-pizza を、生地 → ソース → チーズ → 具材 → 焼成 → （CUT）→ RESULT まで通した動画。ピース下の浮いた楕円が消え、本体に沿った影だけが残ること。各状態で 1.5〜3 秒保持している。

Video Verification: PASS（ファイル存在・サイズ > 0・`ffprobe` で codec / 解像度 / 長さを確認・対象操作が映っていることをフレームで確認）。

## 6. 検証

テスト・CI の結果は PR 本文と PR のチェックに記録する。この節は、本ファイルを書いた時点の手元の結果。

- `npx vitest run`: 574 files passed / 1 skipped、10869 tests passed（13 skipped / 2 todo は既存）。新規 6 件を含む。
- `npx tsc -b` / `npm run build`: エラーなし。`npx oxlint`: 本変更のファイルに警告なし。
- 既存の `e2e/pilot-e-ingredient-icons.spec.ts`（トレイ chip のサイズ・タップ領域・グリフが chip 内に収まる・横スクロールなし・RESULT）: Chromium 390×844 / 360×800 で 2 件 passed。トレイの表示は `tray-after-*.png`（楕円は残る）。
- 保存互換: `src/state/**` と保存スキーマは無変更（CSS・テスト・docs のみ）。
- WebKit: ローカルでは起動できない（`webkit-*` は CI が権威）。CI の結果は PR のチェックを参照。

## 7. Owner へのお願い

- iPhone Safari 実機での確認（特に焼成後の見え方）。
- `PizzaThumbnail` を対象に含めるかの判断（§3）。
- merge、共有 Preview / Production の更新は Owner の明示承認まで行わない。
