# S3 — ハーブ 4 種の未配線 SVG・モック・テスト（#417、R2 決定の先行作業）

2026-11-06。**配線していない**。`ingredients.ts`・`App.css`・`IngredientGlyph.tsx` ほか #748 の claim 対象・既存ファイルは**無変更**。claim は #417 に投稿（6688256290、新規ファイルのみ）。

## 成果物（すべて新規）

| ファイル | 内容 |
|---|---|
| `src/components/herbGlyphs/herbGlyphs.tsx` | `RosemarySprigs`（B）・`OreganoPile`（B）・`SpinachLeaves`（A2）・`ArtichokeQuarter`（A2）。64×64 のインライン SVG を JSX に**そのまま変換**（出典は `claude/herb-icons-compare-docs-8auzii` `c9351e4` の候補 SVG）。id・グラデーション・外部参照なし |
| `src/components/herbGlyphs/herbGlyphs.test.tsx` | 7 テスト: 純粋インライン（`id=`／`url(`／`<image`／`<script`／`href` なし）、輪郭線あり・影 opacity .15、4 種がすべて異なる、承認 id（`rosemary-b`／`oregano-b`／`spinach-a2`／`artichoke-a2`）、**他のどのファイルからも import されていない**ことの構造テスト |
| `docs/design/candidates/ingredient-icons-2.0-herbs-impl/*.svg` | 上の 4 枚の SVG 原本（参照用） |
| `docs/reports/screenshots/herb-glyphs/herb4-unwired-mock-before-after.png` | 現行（絵文字）と新 SVG の比較: トレイ 26px／ピザ上 1.2em／64px／グレースケール（Chromium、DPR2。**実機 HV ではない**） |

## 検証

- `vitest src/components/herbGlyphs`: 7/7 pass。`tsc -b`: エラーなし。全 Vitest・build・E2E は未実行（未配線で他に影響しないため。配線 PR で実施）。
- モックの所見（実寸、Chromium）: ローズマリー・ほうれん草は 26px でも形が識別できる。**オレガノ（乾燥フレークの山）は 26px で緑の塊にしか見えず**、グレースケールでは輪郭が弱い。アーティチョークは中央の淡い断面が識別点。R2 レポートが指摘したとおり**ほうれん草・オレガノのグレースケール視認性は実寸 HV で確認が要る**（不足なら A3 または中間色の再検討＝新しい Owner 判断）。

## 配線 PR（#748 の claim 解放後）の内容 — 今は不可

1. `ingredients.ts`：4 食材の行に `pieceVisual`（`DedicatedIngredientVisual` に 4 つの id を追加）。
2. `IngredientGlyph.tsx`：`VISUAL_VIEWBOX`（64×64）と描画の分岐に `herbGlyphs` を接続。
3. `App.css`：1.2em の個別規則（既存ハーブ群と同じ補正、占有 1em）。
4. 識別テスト（#733 方式）、Tray／Shop／Dex／Research／Hint／RESULT の before/after、390×844 の動画（repo に commit しない）。
5. `B19` の burrata との `IngredientGlyph.tsx`・`ingredients.ts` の merge 順は Owner 判断（ハーブ先を推奨）。

## 触れていないもの

保存・採点・id・emoji・family・サイズクラス・Research・ladder、Production、共有 Preview。
