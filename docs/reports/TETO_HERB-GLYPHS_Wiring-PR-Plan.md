# ハーブ 4 種 配線 PR — 作成準備（#417、R2 決定）

2026-11-06。**PR は未作成。本ブランチでは `ingredients.ts` を編集していない**（#748 の claim 対象）。差分は使い捨て worktree で作成・検証し、`TETO_HERB-GLYPHS_wiring.patch.txt` に保存した（適用はしていない）。

## 1. 開始条件

- [ ] #748 の claim 解放（`src/data/ingredients.ts` を含むため）
- [ ] 本 PR 用の新 claim（#417、files: `src/data/ingredients.ts`・`src/components/IngredientGlyph.tsx`・`src/components/IngredientGlyph.test.tsx`・`src/App.css`・`src/components/herbGlyphs/**`・`docs/reports/screenshots/herb-wiring/**`・Result）。`App.css` は HOT（`scripts/ops/hot-files.json`）→ 他の open PR の `App.css` 変更を確認し、merge 順を claim に書く
- [ ] Owner の実装 GO（R2 §2.2 の 3）。オレガノは **B を配線**（承認済み）。B2 は未配線の候補のまま残し、実寸 HV で B2 が選ばれたら 1 行の差し替え（`<OreganoPile />` → `<OreganoPileB2 />`）

## 2. 差分の内容（patch、5 ファイル、+32 −3）

| ファイル | 変更 |
|---|---|
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に `rosemary-sprigs`・`oregano-flakes`・`spinach-leaves`・`artichoke-quarter` を追加。4 食材の行に `pieceVisual` を 1 行ずつ（id・emoji・色・family・サイズクラス・価格は不変） |
| `src/components/IngredientGlyph.tsx` | `herbGlyphs` を import、`VISUAL_VIEWBOX`（64×64）4 行、描画の分岐 4 行 |
| `src/App.css` | 既存の 1.2em グループ（shiso／cilantro などと同じ、占有 1em）に 4 クラスを追加 |
| `src/components/IngredientGlyph.test.tsx` | `DEDICATED` の一覧に 4 つ追加 |
| `src/components/herbGlyphs/herbGlyphs.test.tsx` | 「どこからも import されない」→「`IngredientGlyph.tsx` だけから import される」に変更 |

## 3. 使い捨て worktree での検証（本ブランチ `8617274`＋patch）

`tsc -b` エラーなし。全 Vitest は §5（**8 件失敗。すべて意図した描画変更を検出する固定テスト**）。E2E・WebKit・build は PR の CI で行う。

## 4. PR の HV（HV ポリシー）

- before（main）／after の画像: トレイ（26px）、ピザ上、焼成後、RESULT、ショップ、図鑑、ヒント表示。390×844 と 360×800。グレースケールの見え方（ほうれん草・オレガノ）。
- 390×844 の動画（repo に commit しない）。
- **オレガノ B と B2 の実寸比較**は、PR の Preview ではなく比較画像（`oregano-b-vs-b2-26px.png`）と実機の Owner 確認で行う（共有 Preview は更新しない）。

## 5. 全 Vitest の結果（使い捨て worktree、patch 適用後）

**623 files 中 3 files 失敗／11,563 tests 中 8 件失敗、11,540 pass、13 skip。** 失敗はいずれも「描画・カタログの中身を固定するテスト」が、意図した変更（4 食材に絵が付いた）を検出したもの。**patch はこの 8 件の基準値の更新をまだ含まない**。PR では次の 3 点を、変更理由のコメント付きで更新する（テストの意味は弱めない）。

| テスト | 失敗 | PR での対応（前例） |
|---|---|---|
| `src/data/lateCatalog.offGolden.test.ts`「ingredients の先頭 N 件が不変」 | ingredients の prefix digest が変化 | `src/data/__golden__/lateCatalog.offSurface.json` の ingredients digest を再生成し、テスト冒頭の「意図的に再生成した」記録に 1 行追加（**arugula の `pieceVisual` 追加時と同じ前例**）。#748 の claim 対象（`src/logic/discovery/__golden__/**`）とは別ディレクトリ |
| `src/components/IngredientGlyph.test.tsx`（2 件） | 「dedicated visual を宣言する食材の一覧」と「RESULT の材料リストの文字列」 | `HERB_DEDICATED`（4 食材）を追加して `ALL_DEDICATED` に含める。RESULT の行は「SVG＋名前」の扱いになる（既存の dedicated と同じ） |
| `src/logic/rt01ReferenceRegression.test.tsx`（5 件） | marinara・fugazza・napoletana・pizza-bianca・capricciosa のピザ選択サムネイルの HTML が変化（🍃／🌱 → SVG） | `PIZZA_THUMBNAIL_HTML_BASELINE` の 5 件を更新。差分は該当ピースの絵だけ（配置・回転・ソース色は不変）であることを PR 本文に明記 |

**影響を受けるレシピの目視確認**（HV の対象に追加）: oregano・rosemary・artichoke・spinach を使う既存レシピ（少なくとも上の 5 件のサムネイル）。
