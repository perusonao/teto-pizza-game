# Topping Visuals 2.0 — PR-1 Result（parmigiano の配置後ビジュアル、Issue #824）

状態: **実装済み・ローカル検証済み。ただし既存テスト 1 件が意図した変更と矛盾し、Owner 判断待ち（§4）。** Draft/HOLD。merge・Production ON・共有 Preview 更新は未承認。
基準 main `319b1841b838ea170b7b5ff3a1f566d3ed9b3615`。設計: `TETO_TOPPING-VISUALS-2_PR0_Baseline-and-Design.md`、Owner 判断ロック（#824 `6935605085`）、claim（#824 `6948262972`）。

## 1. 変更

| 区分 | ファイル | 内容 |
|---|---|---|
| 新規 | `src/components/placedVisuals/ParmigianoShavings.tsx` | 配置専用 SVG（薄くカールした削り片 7 片 + 粒、64×64・1em・aria-hidden・`id`/gradient/`defs`/url なし、PROVISIONAL） |
| 新規 | `src/components/placedVisuals/registry.ts` | id 引きの registry（parmigiano のみ）。`ingredients.ts` / `Ingredient` 型は不変 |
| 変更 | `src/components/IngredientPieceVisual.tsx` | `surface?: "placed" \| "selection"`（既定 `placed`）。placed かつ登録ありのときだけ既存のラッパー（`.pizza-cheese.pizza-cheese--parmigiano.pizza-cheese--glyph`）の中に SVG。登録なし・`selection` は従来と同一のコードパス。catalogue の `pieceVisual` は上書きしない |
| 変更（各 1 行 `surface="selection"`） | `IngredientTray.tsx`（chip・ドラッグプレビュー）、`InventoryOverlay.tsx`、`PizzaThumbnail.tsx`、`PizzaVisualPieces.tsx`（Reference の共有境界） | 選択アイコン・Reference・Dex を維持 |
| 新規テスト | `IngredientPieceVisual.architecture.test.ts`、`PizzaVisualPieces.test.tsx`、`e2e/topping-visuals-parmigiano.spec.ts`、`IngredientPieceVisual.test.tsx` に追加 | §3 |

**変更していない**: `PizzaStage.tsx`、`App.css`、`ingredients.ts`、`recipes.ts`、`IngredientGlyph.tsx`、`toppingSizeClass.ts`、`bakeVisual.ts`、採点・保存・レシピデータ、golden。焼成は既存の `cheeseStyle`（`--bake-melt-scale` + filter）をそのまま利用（新しい焼成処理・調理法なし）。cucumber / egg / eggplant は含まない。

## 2. 見た目（スクリーンショット）
`docs/reports/screenshots/topping-visuals-2/pr1-after/`（Chromium、390×844・360×800、選択トレイ / 配置直後 / 焼成後 RESULT、`INDEX.md`、before 比較ボード）。before は `pr0-before/`。
- chip は before と同一（CSS の板）。ピザ上は「板」ではなく、黄色い削り片の小さな山になった。
- **正直な所見**: 390×844 でのピザ上の大きさは約 15〜20 CSS px で小さく、実機で「削り片」と読めるか・mozzarella / ricotta-salata / truffle と区別できるかは **Owner の実機 HV 判断**（形・色は PROVISIONAL）。調整の余地: SVG の単純化、足跡サイズ（`--cheese-glyph-size`、`IngredientPieceVisual` 内の style 指定で `App.css` 不要）。いずれも HV の結果を見てから。
- 未取得: Dex・図鑑、Reference 見本、CUT、焼成中・焼きすぎ、実レシピ、WebKit、実機。

## 3. テスト（ローカル）
| 区分 | 結果 |
|---|---|
| `tsc -b` | エラーなし |
| `oxlint`（変更ファイル） | 新規警告 0（初版の `react/static-components` 警告は registry が要素を返す形に直して解消） |
| `npm run build` | 成功 |
| focused（`IngredientPieceVisual` / architecture / `PizzaVisualPieces` / fry architecture / `ReferencePreview` / `PlayerReferencePreview` / `rt01ReferenceRegression` / `IngredientTray.palette` / `InventoryOverlay`） | 9 files・126 tests passed |
| **全 Vitest** | 686 files 中 681 passed、**2 failed**: ① `fry.architecture.test.ts`（私の新規 architecture テストが `fryIngredients` を import していた → 修正済み、再実行で通過）、② `IngredientGlyph.test.tsx` の 1 件（§4、未解決）。それ以外 12,737 tests passed |
| E2E（Chromium、390×844・360×800） | 新規 `topping-visuals-parmigiano` と既存 `finished-pizza-visual-2.0` 計 12 passed。**WebKit はローカルに無く CI で確認（未確認）** |
| golden | 変更なし。Reference の回帰（`rt01ReferenceRegression` ほか）は無修正で通過 |

新規テストの要点: `selection` の出力が従来の markup と文字列一致、登録なしの食材（mozzarella / feta / basil / cucumber / egg / eggplant）は両 surface で同一、`PizzaVisualPieces`（Reference 境界）と `PizzaThumbnail` は parmigiano を CSS の板で描く、`IngredientPieceVisual` の直接呼び出し 7 件の `surface` を固定、registry は parmigiano のみ・eggplant は `pieceVisual` なし。

## 4. 未解決（停止して報告）
`src/components/IngredientGlyph.test.tsx` の「every cheese without a pieceVisual (mozzarella included) is still the CSS shape on the pizza」が失敗する。このテストは `pieceVisual` を持たない全 cheese を **既定 surface（= placed）** で描き CSS の板であることを要求するため、parmigiano を placed で SVG にする PR-1 の意図（Owner Q2: 既定 `placed`）と直接矛盾する。
- 必要な修正は 1 箇所の新行追従（対象から `placedVisualIds()` の食材を除外し、それらは `surface="selection"` で CSS の板であることを確認する）。ただし**ファイルは #815 の有効な claim 範囲**（`6793893838`、保有者の release 記録なし、期限 11-18 00:00 UTC）。第三者の claim は編集・解除しないため、本 PR では編集していない。
- 期待値を緩めて通すことはしていない。

## 5. 残り
実機 iPhone Safari HV（Owner）、PR 専用 Preview の公開（Owner の別承認）、WebKit CI、Codex 独立レビュー、上記 §4 の判断。
