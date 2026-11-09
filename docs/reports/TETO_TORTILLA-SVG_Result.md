# tortilla-chips の専用 SVG をトレイ・ピザ上に配線 Result（#780 T-SVG）

2026-11-09 / 基準 main `e74383b4`（#799 merge 後）。Owner 指示（2026-11-09）: 🔺 の視認性改善のため、既存の専用 SVG をピザ上に配線する。claim: #780 コメント 6738179452。**merge・Production ON・共有 Preview 更新はしていない。見た目の変更なので Owner の実機確認と merge 承認を待つ。**

## 変更（最小）
- 既存の `tortilla-chip-triangles`（`src/components/stagedGlyphs/`、#797 で制作・#799 で main に取り込み済み、形・色は PROVISIONAL のまま）を `IngredientGlyph.tsx` 経由で描画。`DedicatedIngredientVisual` に 1 値、`VISUAL_VIEWBOX` に 1 行、描画の分岐に 1 条件、`lateCatalog.ts` の tortilla-chips に `pieceVisual` を 1 つ。新しい絵は作っていない。
- テスト: `IngredientGlyph.test.tsx`・`StagedGlyphs.test.tsx`（配線済みの集合を 3 種に）・`expansionBatch21.test.ts`（`pieceVisual` の固定）を追従。E2E `e2e/b21.spec.ts` は、tortilla-chips のチップ・ピザ上のピース（後乗せを含む）が SVG で描かれることを検査（これまでは絵文字の検査）。
- 変えていないもの: family（`vegetable`）、size class、Hint・Research・保存、他の食材の描画。tortilla-chips の絵文字 🔺 は隠れたフォールバックになる（G18 は維持）。

## 検証（実測）
- 関連 Vitest 2,113 件成功、`tsc -b` エラー 0。Chromium E2E（390×844・360×800）4/4。全 Vitest はローカルで実行（結果は PR に記載）。CI（WebKit 含む）・Codex は PR で確認。
- 比較画像 `docs/reports/screenshots/b21/compare-lettuce-cabbage-tortilla-390x844.png`・`...-360x800.png`（配線後と旧絵文字の並置）。切り出し `compare-parts/`。

## 見た目の所見（390×844、画像から）
- トレイ上: 金色の三角が 2 つ（外形線つき）で、ラベル「トルティーヤチップス」と合わせて読める。旧 🔺 は赤一色の三角。
- ピザ上（赤いソース上）: 金色の三角に濃い茶の外形線があり、赤と明確に分離する（旧 🔺 は赤に溶けていた）。実寸でも 2 枚の三角として読める。ただし 17px 級のトレイ最小サイズでは三角が小さい。
- **要確認（Owner）**: 実機 iPhone での見え方（トレイ・ピザ上・後乗せ）。形・色は PROVISIONAL のため、HV の結果で調整の要否を判断する。
