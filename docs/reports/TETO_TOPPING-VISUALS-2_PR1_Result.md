# Topping Visuals 2.0 — PR-1 Result（parmigiano の配置後ビジュアル、Issue #824）

状態: **実装済み・ローカル検証済み（§3、§4 の既存テスト追従を含む）。** Draft/HOLD。merge・Production ON・共有 Preview 更新は未承認。
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
| **全 Vitest**（§4 の追従後に再実行） | **683 files passed・3 skipped（686）／12,749 tests passed・20 skipped・2 todo、失敗 0**。（追従前の初回は 2 件失敗: ① 私の新規 architecture テストが `fryIngredients` を import していた → 修正、② `IngredientGlyph.test.tsx` の 1 件 → §4 で追従） |
| E2E（Chromium、390×844・360×800） | 新規 `topping-visuals-parmigiano` と既存 `finished-pizza-visual-2.0` 計 12 passed。**WebKit はローカルに無く CI で確認（未確認）** |
| golden | 変更なし。Reference の回帰（`rt01ReferenceRegression` ほか）は無修正で通過 |

新規テストの要点: `selection` の出力が従来の markup と文字列一致、登録なしの食材（mozzarella / feta / basil / cucumber / egg / eggplant）は両 surface で同一、`PizzaVisualPieces`（Reference 境界）と `PizzaThumbnail` は parmigiano を CSS の板で描く、`IngredientPieceVisual` の直接呼び出し 7 件の `surface` を固定、registry は parmigiano のみ・eggplant は `pieceVisual` なし。

## 4. 既存テストの新行追従（解決済み）
`src/components/IngredientGlyph.test.tsx` の「`pieceVisual` のない cheese は pizza 上で CSS の板」という一般テストは、既定 surface（`placed`）で parmigiano が SVG になる PR-1 の意図（Owner Q2）と矛盾した。ファイルは #815 の claim 範囲（`6793893838`）だったため、期限まで編集せず停止して報告し、Owner の方針 A（期限後に追従）で進めた。
- **claim の確認（2026-11-18 00:10 UTC）**: #780 の保有者 `session_016YrGi26v8m72wRWfP6p2E3` の最新記録は `6793893838`（期限 2026-11-18T00:00:00Z）のみ。#780（67 コメント）・#815・#866 に release・更新・再取得の記録なし。**正式な release ではなく、期限後の非 live 判定**。保有者の claim は編集・解除していない。ほかの live claim・open PR と `IngredientGlyph.test.tsx` の重なりなし（#781 の差分は古い base による drift で、同ファイルを実際には変更していない）。
- **修正（新行追従のみ、期待値は緩めていない）**: 一般テストの対象から `placedVisualIds()` の食材を除外（それ以外の legacy cheese は従来どおり CSS の板を要求）。除外した食材は別テストで、`surface="selection"` では従来の CSS の板（SVG なし・`--glyph` なし）、placed（既定）では `.pizza-cheese--glyph` ラッパー内の SVG（bake の class / filter はラッパーに残る）を検証。

## 5. claim・Owner Gate（正確な記録）
- PR-1 claim: #824 `6948262972`（期限 11-24）。編集前の確認は **手動**（#780 全コメントからの claim 抽出、Issue #726 / #866 / #867 / #870 / #848 / #825 / #417 / #749 の確認、open PR 53 件の本文 claim と base..head 差分の照合）。
- **Owner Gate スクリプト（`scripts/ops/owner-gate.mjs`）は read-only token が無く GitHub API が 401 を返し、実行できなかった。** 上の手動監査はスクリプトの成功ではなく、スクリプト実行の代替としても扱わない（Owner Gate の判定は未取得）。

## 6. 残り
実機 iPhone Safari HV（Owner）、PR 専用 Preview の公開（Owner の別承認）、WebKit CI、Codex 独立レビュー、Owner Gate スクリプトの結果（token が無く未取得、§5）。

## 7. rev.2 — Owner iPhone Safari HV（P2）に基づく配置後 SVG の視覚改善
Owner の HV（HEAD `d2188645`、[comment 6985715042](https://github.com/perusonao/teto-pizza-game/pull/874#issuecomment-6985715042)）: 配置・焼成後とも「鮮やかな黄色い結び目・塊」に見え、薄く削ったチーズに見えない（P2／HOLD）。指示: **配置後 SVG の視覚表現のみ**を、薄く平たい不規則な削り片（アイボリー〜淡いクリーム、控えめな陰影）を数片散らし、向き・大きさを自然に変える。選択アイコン・採点・保存・レシピ・在庫・Fry・他食材・操作は変更しない。

**変更（見た目のみ）**
- `ParmigianoShavings.tsx`: 重ならない 6 片の削り片（長さ 10〜27、全厚は長さの 1/3 以下、向き -48°〜38°、輪郭がそれぞれ異なる）＋ 角のある小さな欠片 3。塗りは低彩度のアイボリー／クリーム（`#f8f0d8` `#f3e8c6` `#f6ecd0`、下面 `#dccb9b`）、細い暖かいグレーの輪郭 `#c9b88a`、上縁に淡いハイライト。rev.1 の鮮やかな黄色（`#f3dc8a` 等）と、重なった曲線の「結び目」構成を廃止。幾何は純粋関数でモジュール読み込み時に 1 度だけ計算（乱数なし）。
- 新規 `parmigianoShavingsData.ts`（形状データ。コンポーネントファイルがコンポーネントのみを export する lint 規則のため分離）。
- 新規 `ParmigianoShavings.test.tsx`（SVG 専用の回帰テスト 7 件）: 64×64・1em・aria-hidden・id/gradient/defs なし／削り片 5〜8 片で各 3 パス／**薄さ（全厚 ≤ 長さの 1/3）**／**散らばり（中心間距離 ≥ 9、最長 ≥ 最短の 1.8 倍、向きの幅 ≥ 60°、輪郭の歪みがすべて異なる）**／viewBox 内に収まる／**塗りが低彩度（HSV 彩度 ≤ 0.30・明度 ≥ 0.85）、輪郭の彩度 ≤ 0.35**／rev.1 の黄色が残っていない。
- 変更していない: `IngredientPieceVisual`・registry・`surface` の呼び出し 5 件、`PizzaStage.tsx`・`App.css`・`ingredients.ts`・採点・保存・レシピ・在庫・Fry・他食材・操作（振りかける操作は #825 の範囲）。

**変更前後の同倍率画像**（Chromium、DPR 2、同じ操作・同じセーブ構成）: `docs/reports/screenshots/topping-visuals-2/pr1-rev2/`
- `board_390x844_…`・`board_360x800_…`（変更前の板／rev.1／rev.2 の同倍率の切り抜き）、`closeup_390x844_…`（1 ピースの 5 倍拡大）、rev.2 の 6 枚（選択トレイ／配置直後／焼成後 RESULT、両 viewport）。
- 所見（正直な評価）: **拡大すると、rev.2 は重ならない薄い削り片が散らばっており、結び目や塊には見えない。配置直後・焼成後（ジャスト）とも同様**。ただしピザ全体の等倍（約 20 CSS px）では小さく淡く、ソース上の「白っぽい小さな欠片」に見える。薄いチーズ片として読めるか・mozzarella（溶けた白い塊）との識別・淡い色のコントラストは**実機 iPhone の HV 判断**（Chromium の画像は代用にならない）。調整の余地: 足跡サイズ（`--cheese-glyph-size`）・輪郭の濃さ。いずれも HV の結果を見てから。
- 焼きすぎ・Dex・Reference 見本・CUT・WebKit・実機は未撮影。

**テスト（ローカル、rev.2）**: `tsc -b` エラーなし／`oxlint` 警告なし／focused（placedVisuals・`IngredientPieceVisual`・architecture・`PizzaVisualPieces`・`IngredientGlyph`・fry architecture）6 files・286 tests passed／E2E（Chromium、390×844・360×800: `topping-visuals-parmigiano` と `finished-pizza-visual-2.0`）12 passed。全 Vitest・CI・WebKit・独立レビュー・PR 専用 Preview の結果は PR #874 のコメントに記録。

