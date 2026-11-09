# B23 デザート 6 種 専用 SVG Result Report（未配線・PROVISIONAL、Refs #417 #780）

2026-11-09 / base main `348b1e4`。Owner 承認（2026-11-09）: 競合しないデザート 6 種の専用 SVG を未配線で制作してよい。#417 に claim 投稿済み（6729791686）。別 session の claim（B21／B22 の 13 種、6724929630）とは対象・パスとも重ならない。

## 範囲
- 新規のみ: `src/components/dessertGlyphs/{DessertGlyphs.tsx,dessertPalette.ts,DessertGlyphs.test.tsx}`、本書、`docs/reports/screenshots/dessert-glyphs/dessert-comparison.png`。
- **どこからも import しない（未配線）**。`ingredients.ts`／`IngredientGlyph.tsx`／`App.css`／カタログ／保存／採点／Research は不変。配線（`pieceVisual` と寸法クラス）は別 PR・Owner 判断。
- 形・色は **PROVISIONAL**（Owner 未承認）。

## 内容
apple（赤い皮の薄切りくさび）／banana（重なる輪切り 2 枚）／chocolate（板チョコ 2 片）／graham-cracker（穴つきの角丸長方形）／marshmallow（白い柔らかい円柱 2 つ）／powdered-sugar（小さな輪郭つきの粒の散らし）。64×64・1em・`aria-hidden`・id／gradient なし。シルエットは互いに異なる（テストで固定）。

## 視認性（`dessert-comparison.png`: 6 種 × 背景 4（生地・焼成チーズ・焼成生地・白）× サイズ 4（17.6／26／33.6／64px））
- 17.6px: apple・chocolate・graham-cracker・banana は主体が判別できる。marshmallow は 2 つの塊までは読める。**powdered-sugar は粒が潰れて「点の集まり」になる**（粉は元々小さい食材。配線時にサイズ補正が要る）。
- 26px 以上: 6 種とも判別できる。
- 輪郭は各配色で最も暗い色で、焼成チーズ（#e8c15a）・生地（#f1dcae）に対し WCAG 比 3 超（テストで固定、marshmallow・powdered-sugar は輪郭を濃くして達成）。
- 気づき: apple の薄切りは小サイズで盾のように見える。Owner の好みで別案（丸い輪切り）に差し替え可。

## テスト
`DessertGlyphs.test.tsx` 6 件合格（構造、id・gradient なし、シルエット相異、輪郭コントラスト、**未配線の固定**）。`tsc -b` 合格。HV: ゲーム内の見た目は変化なし（未配線）。動画は対象外。

## 次（別承認）
配線 PR（B23 の宿主レシピ apple-cinnamon-dessert・smore-dessert-pizza・nutella-dessert-pizza は D-1／D-2 待ちのため、配線も宿主の列車に合わせる）。
