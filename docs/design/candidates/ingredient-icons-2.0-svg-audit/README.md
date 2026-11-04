# Ingredient Icons 2.0 — 実寸識別性監査の候補 SVG（Issue #417 / #733 / #739）

**比較用アセット。採用済みではない。** 本番の `IngredientGlyph.tsx` / `ingredients.ts` / `App.css` は変更していない。採用は Owner の承認が必要（Style Lock v2 §1c / §11.4）。
報告: [`docs/reports/TETO_INGREDIENT-ICON-2.0_SVG-DISCRIMINATION-AUDIT_Result.md`](../../../reports/TETO_INGREDIENT-ICON-2.0_SVG-DISCRIMINATION-AUDIT_Result.md)

| ファイル | 内容 | 位置づけ |
|---|---|---|
| `beef-a-current-ribbons.svg` | main の `beef-slices`（描画済み DOM から抽出） | 比較の基準（before） |
| `beef-b-chunks.svg` | 焼き色のついた角切り 2 塊 | **採用候補** |
| `beef-c-steak.svg` | グリル跡つきの厚切り | 不採用（丸い暗赤が sausage / pepperoni 系と衝突しうる） |
| `green-pepper-h-half.svg` | ヘタ付きの縦半割（淡い空洞と種） | **採用候補**（承認済み GP-A2 の置換になるため Owner 判断） |
| `green-pepper-d-pieces.svg` | 角切り 3 片 | 不採用（青ねぎの輪の房と衝突） |
| `ref-okra.svg` / `ref-green-beans.svg` | オクラ / さやいんげんの**比較専用**の簡易絵 | ゲームに存在しない食材。ゲームへ入れない |

仕様: 64×64、透明背景、線幅 2.4、接地影、`id` / gradient / `<defs>` / `url(#` なし（機械確認済み）。
