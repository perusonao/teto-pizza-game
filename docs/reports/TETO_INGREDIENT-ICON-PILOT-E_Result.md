# Ingredient Icons 2.0 Pilot E — Result Report（green-pepper / bell-pepper / pineapple の専用 SVG）

Status: **実装完了（描画のみ）。Owner の iPhone 実機 HV と承認の前は merge しない。共有 Preview・Production は更新していない。** 基準 `main` `167cf74`（#716 merge 済み）。Issue #715、親 #417、決定の追跡 #712。

## 1. 内容

| ingredient id | `pieceVisual` | SVG | 補正（暫定） |
|---|---|---|---|
| `green-pepper` ピーマン | `green-pepper-strips` | GP-A2（緑の細切り 3 本） | 1.45em、margin −0.225em |
| `bell-pepper` パプリカ | `bell-pepper-quarter` | BP-B2（赤の四つ割り） | 1.65em、margin −0.325em。**トレイ chip だけ 1.35em、margin −0.175em** |
| `pineapple` パイナップル | `pineapple-wedges` | PA-A2（くさび形 2 枚） | 1.45em、margin −0.225em |
| `chicken` | 変更なし | ドラムスティック（§1b A 維持） | — |

- 描画のみ。食材 id・`emoji`・`color`・`category`・`placement`・size class（3 食材とも `m`）・在庫・Dex・Research・Hint・解禁順・経済・採点・保存（schema v2、`pieceVisual` は保存されない）に差分なし。
- SVG は候補 SVG の子要素をそのまま JSX 化（接地影も移植、`id` / gradient / `<defs>` / `url(#` なし）。参照 SVG へは byte-for-byte で昇格（`docs/design/references/ingredient-icons-2.0/{green-pepper,bell-pepper,pineapple}.svg`、README 更新）。
- `emoji`（🌶️ / 🫑 / 🍍）は残る（テキストフォールバックのみ。G18 に影響なし）。

## 2. 変更ファイル

`src/data/ingredients.ts`（型 +3、3 行に `pieceVisual`、コメント更新）/ `src/components/IngredientGlyph.tsx`（`VISUAL_VIEWBOX` +3、分岐 +3、3 コンポーネントをファイル末尾へ追記）/ `src/App.css`（末尾に独立ブロック）/ `src/components/IngredientGlyph.test.tsx`・`src/data/ingredients.test.ts`（意図的な pin 更新と Pilot E の契約テスト）/ `src/data/__golden__/lateCatalog.offSurface.json` と `lateCatalog.offGolden.test.ts`（経緯コメント）/ 新規 `e2e/pilot-e-ingredient-icons.spec.ts` / 参照 SVG 3 点と README / 画像 `docs/reports/screenshots/ingredient-visual-pilot-e/`。

**触っていないもの:** `IngredientTray.tsx`、`IngredientPieceVisual.tsx`、`PizzaStage.tsx`、`bakeVisual.ts`、`toppingSizeClass.ts`、`PROJECT_HANDOFF.md`、Style Lock V2 §11（§11.8 により docs-only の別 PR で状態更新する。下記 §8）。

## 3. ゴールデン

`lateCatalog.offSurface.json` の ingredients prefix digest（先頭 66 件）を意図的に再生成した。再生成の前後で先頭 66 件の canonical JSON を出力して diff を取り、**差分は 3 件の `"pieceVisual"` の追加のみ**であることを確認した。

- 旧 `fff4401a…6e24` → 新 `9d51832c…856d`
- `mayo`（#716）は 66 件の外（末尾追加）で prefix に影響しない。

## 4. サイズ・視認性の確認

**条件:** 実装済みの CSS で実描画（Chromium、DPR 3 の比較シート／ DPR 1 の E2E）。WebKit・iPhone 実機は未実施（CI と Owner）。

**トレイ chip（390×844 / 360×800、before と after を同一シナリオで実測）**

| | 390×844 | 360×800 |
|---|---|---|
| chip 寸法（3 食材とも、before / after） | 118×64 / 118×64（**同一**） | 108×64 / 108×64（**同一**） |
| chicken（未変更の基準）の chip | 118×64 | 108×64 |
| タップ領域の高さ | 64px（≥ 44） | 64px（≥ 44） |
| glyph の寸法 | green-pepper・pineapple 37.7px、bell-pepper 35.1px | 同左 |
| glyph が chip の外にはみ出すか | しない（上端の余白 0.2〜1.5px、下 26px 以上） | 同左 |

- bell-pepper を chip でも 1.65em（≒ 42.9px）にすると、chip の 26px 固定の icon box から上下に約 8.4px ずつはみ出し、上端が chip を約 2px 超える計算になる（実測の余白 1.5px は 1.35em の値）。そのため chip 専用の縮小規則（1.35em）を実装に含めた。E2E は「glyph が chip 内に収まる」「chip 寸法が chicken と ±1px」を恒常的に検査する。
- 横スクロールなし（トレイ・ピザ上・RESULT）、console error 0。

**20 / 24 / 28 / 32px × 背景（トレイ・焼成前の生地・焼成後の生地・グレースケール）の比較シート**

- ピーマン: 3 本の水平な細切りとして 20px でも読める。青ねぎ（小さな輪切り）、ピクルス（斜めの円筒）、ハラペーニョ（緑の四角）とは形が別。
- パプリカ: 20px で小さいが、ヘタの緑と断面の淡い内側が出て「赤い実の断面」と読める。ペパロニ（単色の赤い丸）とは断面の内側で別。トマト（`tomato-slice`、輪切りで放射状）とも形は別。グレースケールでも輪郭と内側の明暗が残る。
- パイナップル: くさび形 2 枚と放射状の筋が 20px でも読め、果肉として見える。フェタ（白〜灰の角）、コーン（細長い粒の束）、カシュー（オレンジの三角）とは色と形が別。

比較シート: `docs/reports/screenshots/ingredient-visual-pilot-e/pilot-e-size-sheet-*.png`（対象 4 行を切り出したもの）。**これは実装者による静止画の確認で、Owner の実機 HV の代わりではない。**

## 5. 検証

- `tsc -b`: error なし。`oxlint`: 新規の警告なし（既存 3 件のみ）。
- focused: `IngredientGlyph.test.tsx` / `ingredients.test.ts` / `lateCatalog.offGolden.test.ts` 264 passed。
- 全 Vitest（最後に 1 回）: Pinsa ON は 573 files passed・1 skipped、10863 tests passed・0 failed。Pinsa OFF（`TETO_PINSA_OFF=1`）は 573 files passed・1 skipped、10855 tests passed・0 failed。`vite build` は成功。
- Chromium E2E `pilot-e-ingredient-icons`（iphone-390x844 / iphone-360x800）: 2/2 passed。chip の SVG、ピザ上の 2 個ずつ、RESULT の一覧、chip 寸法、glyph の収まり、横スクロールなしを検査。
- WebKit: ローカルに WebKit がないため未実施。CI の WebKit 6 shard と Gate で確認する。
- Pinsa: `pinsa-romana` は 3 食材を使わないので、アイコンは Pinsa の ON / OFF で変わらない（件数 pin も動かない）。

## 6. 影響レシピ（最新 main の再集計）

green-pepper 3（veggie-supreme-pizza / tandoori-paneer-pizza / jamaican-jerk-chicken-pizza）、bell-pepper 5（pesto-vegetariana / ratatouille-pizza / spanish-chorizo-pizza / supreme-pizza / vegan-cashew-cheese-pizza）、pineapple 3（hawaiian / pizza-overload / jamaican-jerk-chicken-pizza）。絵が変わるだけで、採点・必要材料・配置は不変。

## 7. 未確認・Owner の実機 HV で見てほしい点

1. **パイナップル:** 葉つきの絵文字より離れて見たとき、果肉として識別できるか（トレイ chip・ピザ上・RESULT）。フェタ・コーン・フォンティーナ・カシューとの取り違え。
2. **パプリカ:** 20〜24px の読みやすさ。ピーマン・ペパロニ・トマトとの区別。**ピザ上は 1.65em のまま、トレイ chip は 1.35em** という出し分けが妥当か（縮小前の初稿 BP-B に戻す選択肢は Owner 判断）。
3. **ピーマン:** 青ねぎ・ハラペーニョ・パクチー・大葉・ピクルスと形で区別できるか。
4. 補正値（1.45 / 1.65 / 1.35em）の妥当性、チップ・タップ領域、Shop の NEW 行、Dex、Research、Hint / Notebook。
5. **焼け過ぎ（heat 2.0）:** brightness 0.78 / saturate 0.8 / sepia 0.2 の掛かった見え方は未確認（黄・緑の濁り）。
6. 焼成後の表現は本 Pilot の範囲外（#421 / #468 の方針確認まで保留）。

## 8. 後続

- Style Lock V2 §11 の状態更新（実装済み・補正値の確定）は §11.8 に従い docs-only の別 PR。補正値は Owner の実機 HV 後に確定してから記す。
- iPhone Safari の HV 手順は Issue #715 の「iPhone 実機 HV」節のとおり。390×844 の動画は Owner へ直接提出する（リポジトリには含めない）。
