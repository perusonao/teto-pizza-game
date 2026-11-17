# T26 nduja-dollops 専用 SVG（未配線）— Result Report

日付: 2026-11-17 · Issue #866 (Refs #780) · 基準 main `319b1841` · claim `session_016YrGi2SmE8roWvekegLhNH:nduja-svg`（#866 `6949507648`）
性質: 独立した未配線 SVG のみ。T26 `apply`・catalog・recipes・ingredients・scoring・inventory・runtime への配線はしていない。Draft PR は結果報告の後。

## 視覚契約（Owner D2/D3、2026-11-17）
| 場面 | 見た目 | 実装 |
|---|---|---|
| トレイ（`variant="selection"`、既定） | 小さな別々のかたまり **3 つ** の群 | `NDUJA_SELECTION_DOLLOPS`（3 要素、箱どうしの隙間 ≥ 2 をテストで固定） |
| ピザ上（`variant="placed"`） | **1 ピース = かたまり 1 つ**（中央、トレイの 1.5 倍超の大きさ） | `NDUJA_PLACED_DOLLOPS`（1 要素） |
| 色 | 基準 `#a13517`（Owner 承認） | palette の `fill`。outline `#3a1107`、light `#d9703f`、detail `#6f1f0e`（暫定） |
| サイズ `s` | 食材側の値（`sizeClass`）。SVG は 64x64 / 1em で呼び出し側のスケールに従う | 食材登録は T26 `apply` |

各かたまりは `<path data-dollop>` 1 本。既存のグリフ規約（64x64 / 1em / aria-hidden / id・gradient・clipPath・url() なし）に従う。既存の `variant`（selection/placed）の仕組みを使うので `IngredientGlyph.tsx` の配線時に追加の分岐は要らない。

## 変更ファイル（claim 範囲内の 3 + docs）
- `src/components/stagedGlyphs/StagedGlyphs.tsx` — `Nduja` コンポーネントを追加し `STAGED_GLYPH_COMPONENTS` に登録。
- `src/components/stagedGlyphs/stagedGlyphPalette.ts` — `nduja-dollops` のパレット、`nduja → nduja-dollops` の対応、配置定数（コンポーネント以外のファイルに置き fast-refresh lint を避けた）。
- `src/components/stagedGlyphs/StagedGlyphs.test.tsx` — 総数 19→20、nduja 専用 6 テスト（3/1 の契約、64x64 契約、分離ギャップ、中央配置と大きさ、`#a13517` と対応、未配線）。
- `docs/reports/TETO_T26_NDUJA-DOLLOPS_Result.md`、`docs/reports/screenshots/t26-nduja-dollops/{nduja-dollops.png,INDEX.md}`（新規）。

触っていない: `ingredients.ts`・`recipes.ts`・catalog・scoring・inventory・runtime・`IngredientGlyph.tsx`・`DedicatedIngredientVisual` の型。未配線は「`IngredientGlyph.tsx`／`ingredients.ts`／`lateCatalog.ts`／`recipes.ts` に `nduja-dollops` が現れない」テストで固定。

## 検証
| 項目 | 結果 |
|---|---|
| `npx vitest run src/components/stagedGlyphs` | 1 file / 69 tests PASS |
| `npx vitest run src/components`（既存描画への影響） | 100 files / 2058 tests PASS |
| `npx tsc -b` | クリーン |
| `npx oxlint src/components/stagedGlyphs` | 警告 0（最初の 4 警告は修正済み） |
| 既存 19 グリフ × 2 variant の SVG マークアップ（変更前 HEAD と変更後） | **38/38 完全一致**（esbuild で両版を描画して比較） |
| スクリーンショット | `screenshots/t26-nduja-dollops/nduja-dollops.png`（実寸・6x・近い色の既存グリフとの比較） |

## 所見・未確認
- 実寸の tray chip（26px）では 3 つの小塊が小さく見える（描画は明瞭だが、各塊は約 7px）。**iPhone HV で判読性を確認する必要がある**（配線後。今は主張しない）。
- 形・配色は PROVISIONAL（Owner 判断どおり HV まで確定しない）。
- 配線時（T26 `apply`）に必要: `DedicatedIngredientVisual` への追加、`IngredientGlyph.tsx` の分岐、`StagedGlyphs.test.tsx` の WIRED 一覧への追加（現在は「未配線」テストが id の不在を要求している）。
