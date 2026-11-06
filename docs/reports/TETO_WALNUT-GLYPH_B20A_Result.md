# Batch 20-A — walnut（くるみ）専用 SVG Result Report（未配線）

対象: `pesto-noci` レシピで使う walnut の小サイズ描画の**準備**。base main `ed159e9`。Refs #417 #774（B19 とは無関係）。

## 範囲
- 新規のみ: `src/components/walnutGlyph/{WalnutGlyph.tsx,walnutPalette.ts,WalnutGlyph.test.tsx}`、本 Report、`docs/reports/screenshots/walnut-glyph/`。
- **どこからも import しない（未配線）**。`ingredients.ts` / `recipes.ts` / `IngredientGlyph.tsx` / `App.css` / lateCatalog / 保存 / 採点 / Research は不変。既存の walnut 描画実装は事前確認でなし（`src` に `walnut` の出現 0）。
- 色・形は **PROVISIONAL**（Owner 未承認）。原典・id・個数・窓は本 PR の対象外。

## 実装
`WalnutGlyph({ state: "raw" | "baked" })`。64×64 viewBox・1em・`aria-hidden`・id/gradient なし（複数同居可）。くるみの実（2 葉＋中央の溝）と小さな欠片 1 つ。生と焼成後は**同一シルエット**で色のみ違い（配線 PR が焼き加減で差し替え可能）。暗い外線（生 #5a3a1a / 焼成 #3a2009）でチーズ・生地上でも輪郭を保つ。

## サイズ別の視認性（画像: `docs/reports/screenshots/walnut-glyph/walnut-comparison-color-vs-gray.png`、左カラー／右グレー、5 背景 × 4 サイズ）
| サイズ | 所見 |
|---|---|
| 17.6px | 主体の「二葉の実」は輪郭で判別可。**欠片と中の溝は潰れ気味**（主体の識別は可、細部は不可）。 |
| 26px | 主体・溝・欠片が判別可。 |
| 33.6px | 良好。 |
| 64px | 良好（折り目・ハイライトが明瞭）。 |

## 背景別コントラスト（WCAG 輝度比、近似背景色での計算）
外線/背景: 生 6.2（生地）・3.8（焼成生地）・8.5（生チーズ）・5.5（焼成チーズ）、焼成後 9.2・5.6・12.6・8.1。
**塗り/背景は弱い**: 生くるみ × 焼成チーズ = **1.10**、生 × 焼成生地 1.31（色だけでは分離しない。外線で成立）。焼成後 × 焼成チーズは 2.38（グレースケールでも暗い塊として読める）。
グレースケール: 生は明るい中間灰、焼成後は暗灰で、焼成チーズ（中間灰）上でも明暗差が出る。生 × 焼成チーズは塗りが同明度に近く、外線のみで読む（要 Owner 判断: 配線時に生を焼成チーズ上で使うなら外線を維持）。

## テスト
- `WalnutGlyph.test.tsx` 7 件: 構造（1em/64box/aria-hidden/data 属性）、既定 raw、id・gradient なし、生/焼成が同一形状、焼成が生より暗い・階調順、外線コントラスト > 4（焼成チーズ色・淡い生地）、**未配線（他モジュールが import していない）**。
- `IngredientGlyph.test.tsx` を含め 218 件 pass。`tsc -b` clean、`oxlint` clean。フルスイート／CI は PR 側で確認。

## Human Verification
ゲーム内の見た目・操作は**変化なし**（未配線）。ゲーム画面を撮る動画は対象外とし、Policy §9 の静的画像（上記）のみ。動画: 該当なし（Video Verification: N/A）。配線 PR で HV を行う。

## 次の行動（別 PR・Owner 判断）
配線（`pieceVisual` 追加と寸法クラス）は herb 4 種の配線 PR（#417 の claim）との merge 順を決めた後。PROVISIONAL の色・形の採否も Owner 判断。
