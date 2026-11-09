# B21/B22 新食材 SVG 13 種の先行制作（未配線）Result（#417 サブレーン、P-2）

2026-11-08 / main `348b1e4`。Owner P-2 承認（新食材 SVG の未配線での先行制作）。claim: #417 コメント 6724929630（`src/components/stagedGlyphs/**` ほか新規パスのみ）。**配線・merge・Production ON・共有 Preview 更新はしていない。色・形は PROVISIONAL**（iPhone HV 前に確定扱いにしない）。

## 成果【実測】
- 13 種: B21 = cheddar-cubes・lettuce-leaf・tortilla-chip-triangles・cabbage-shreds・bonito-flake-curls、B22 = fennel-slices・orange-slices・carrot-rounds・red-cabbage-shreds・sunflower-kernels・radicchio-leaf・truffle-shavings・brie-wedge。ソース 3 種（okonomiyaki-sauce・balsamic-vinegar・buffalo-sauce）はチップ面の判断なので対象外。
- 規約: 64×64・1em・`aria-hidden`・id／グラデーション／clipPath／url() なし（walnut #777 と同じ）。`ingredient-glyph--<visual>` と `data-ingredient-visual`。`IngredientGlyph.tsx`・`App.css`・`ingredients.ts`・`walnutGlyph/**`・`eggplantGlyph/**` は未編集。
- ファイル: `src/components/stagedGlyphs/{stagedGlyphPalette.ts,StagedGlyphs.tsx,StagedGlyphs.test.tsx}`（新規 3）、`docs/reports/screenshots/staged-glyphs-b21-b22/contact-sheet.png`（生地／焼きチーズ／トマト地 × 17.6・26・33.6・64px）。
- テスト: 新規 42 件合格（各グリフの構造・id なし・外形線が最も暗く焼きチーズ／生地に対しコントラスト > 3・visual id が既存と衝突しない・配線されていないこと）。`tsc -b` エラー 0、`oxlint` 警告 0（コンポーネント以外の export を外した）。staged 9 ファイル 30 件も合格（本セッションで再実行）。全 Vitest・CI は未実行（PR 未作成）。

## 既知の弱点（HV で見てもらう点・確定扱いにしない）
1. 17.6px（トレイ最小）で sunflower-kernels は細く、`bonito-flake-curls` は豆に見えやすい。
2. `lettuce-leaf` はキャベツ玉に近い見た目で、`cabbage-shreds` との区別は形（葉／細切り）頼み。
3. 焼きチーズ（`#e8c15a`）上で `cheddar-cubes`・`orange-slices`・`carrot-rounds` は色相が近い。外形線の濃さで分離している。
4. `tortilla-chip-triangles` のパレット色（`#e3b955`）が Q-3 のフォールバック色（`#e8c25a`）と少し違う。
5. 焼き状態（raw／baked）の 2 状態は未作成（walnut は 2 状態）。必要なら配線 PR の前に追加。

## 次
Q-3 の承認後、配線は S1 の列車 PR（B21／B22）か #417 の配線 PR で行う。B23〜B26 の SVG は列車の 1〜2 本先を S2 が制作する（各列車の宿主が決まってから）。
