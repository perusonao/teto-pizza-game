# Ingredient Icons 2.0 — ハーブ 4 種の配線 Result（#417、R2 決定）

2026-11-06。branch `claude/herb-glyphs-wiring-417`（base: main `ed159e9`）。**merge・Production ON・共有 Preview 更新はしていない。**

## 1. 結論

ローズマリー・オレガノ・ほうれん草・アーティチョークの 4 食材が、共有していた絵文字（🌱／🍃）の代わりに専用 SVG で描かれるようになった。Owner の R2 決定（2026-11-06）どおり **rosemary B／oregano B／spinach A2／artichoke A2、1.2em（占有 1em）**。オレガノの改善案 B2 は未配線の比較候補として保持（`OreganoPileB2`）。**描画だけの変更**で、id・emoji・色・family・サイズクラス・価格・採点・保存・Research・ladder は不変。

## 2. 前提と claim

- #748 の claim は release 済み（コメント 6689217829）。
- 本 PR の claim: #417 コメント 6689297059（files は §3 の変更ファイル）。
- HOT ファイル `src/App.css`: #764 の claim（PR #765 は merge 済み、期限 11-12）と open PR #468・#34 が `App.css` を変更しているが、本 PR の変更は `.ingredient-glyph--*` の 1.2em グループへの 4 セレクタ追加のみで、ハンクは重ならない。本 PR は #765・#760 を含む main を基準にしている。

## 3. 変更ファイル

| ファイル | 変更 |
|---|---|
| `src/components/herbGlyphs/herbGlyphs.tsx` | **新規**。4 つの描画（R2 で承認済みの候補 SVG を JSX にそのまま変換。出典 `claude/herb-icons-compare-docs-8auzii` `c9351e4`）＋オレガノ B2 候補（未使用） |
| `src/components/herbGlyphs/herbGlyphs.test.tsx` | **新規**。純粋インライン（id／url(／image／script／href なし）、5 種の相違、承認 id、B2 の形、**`IngredientGlyph.tsx` だけから import される**こと |
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に 4 つの id（`rosemary-sprigs`・`oregano-flakes`・`spinach-leaves`・`artichoke-quarter`）、4 食材の行に `pieceVisual` 1 行ずつ |
| `src/components/IngredientGlyph.tsx` | import、`VISUAL_VIEWBOX` 4 行（64×64）、描画の分岐 4 行 |
| `src/App.css` | 既存の 1.2em グループ（shiso／cilantro など）に 4 セレクタを追加 |
| `src/components/IngredientGlyph.test.tsx` | `DEDICATED` 一覧に 4 つ、`HERB_DEDICATED` を `ALL_DEDICATED` に追加 |
| `src/data/__golden__/lateCatalog.offSurface.json`・`src/data/lateCatalog.offGolden.test.ts` | ingredients の prefix digest を再生成（§4）、再生成の記録を 1 行追加 |
| `src/logic/rt01ReferenceRegression.test.tsx` | サムネイルの比較で、ハーブの SVG を元の絵文字へ戻してから基準と比べる（§4、ソーセージの前例と同じ）。**基準データ `rt01ReferenceBaseline.ts` は変更していない** |
| `e2e/herb-glyphs-417.spec.ts` | **新規**。ピザ選択のサムネイル、Free Cooking のチップ・ピース・グレースケール・焼成後 RESULT・材料リスト、横はみ出しなし |
| `docs/design/candidates/ingredient-icons-2.0-herbs-impl/*.svg` | 実装した SVG の原本 5 枚（B2 を含む） |
| `docs/reports/screenshots/herb-wiring/` | before／after の画像（§6） |

## 4. 失敗した 8 件の個別確認（パッチ適用直後の全 Vitest）

| # | テスト | 原因 | 対応 | 根拠 |
|---|---|---|---|---|
| 1 | `lateCatalog.offGolden.test.ts`「ingredients の先頭 66 件が不変」 | 先頭 66 件に含まれる oregano・rosemary・artichoke・spinach に `pieceVisual` が付いた | digest を再生成、テスト冒頭の再生成記録に 1 行追加 | **検証: 4 食材の `pieceVisual` だけを取り除くと、旧 digest `9d51832c…` と完全に一致**。それ以外の差は無い。arugula・shrimp・Pilot D・Pilot E と同じ前例 |
| 2 | `IngredientGlyph.test.tsx`「dedicated visual を宣言する食材の一覧」 | 期待値の一覧に 4 食材が無い | `HERB_DEDICATED` を追加 | 意図した変更 |
| 3 | `IngredientGlyph.test.tsx`「RESULT の材料リストの文字列」 | 同じ一覧の件数を参照 | 2 と同じ修正で解消 | 同上 |
| 4〜8 | `rt01ReferenceRegression.test.tsx` marinara・fugazza・napoletana・pizza-bianca・capricciosa のサムネイル | 各サムネイルのハーブのピースが絵文字から SVG に変わった | 比較前に 4 種の SVG を元の絵文字（🌱／🍃）へ戻す 1 行を追加（**Pilot A のソーセージと同じ方法**）。基準データは「再生成禁止」と明記されているので変更しない | **実画像で前後比較（§6）**: ピースの位置・回転・ソース色・カードの配置は不変で、ピースの中の絵だけが変わる。置換後の markup は基準と完全一致 |

## 5. テスト結果

| 項目 | 結果 |
|---|---|
| `tsc -b` | エラーなし |
| oxlint（`src`・新しい E2E） | 新規の警告なし（既存の `CheesePoolCanvas.tsx`・`GameScreen.tsx` の警告のみ） |
| `npm run build` | 成功 |
| 全 Vitest | **失敗 0**（§5.1） |
| Chromium E2E `e2e/herb-glyphs-417.spec.ts`（iphone-390x844・iphone-360x800） | **4/4 pass** |
| WebKit E2E（webkit-390x844・webkit-360x800） | **この環境に WebKit が無いため未実行**。PR の CI（WebKit 6 shard、本 spec を含む）で確認する |

### 5.1 全 Vitest

**623 files（622 pass・1 skip）／11,563 tests（11,548 pass・13 skip・2 todo）、失敗 0。** パッチ適用直後は 8 件失敗（§4）、対応後は 0。

## 6. 画像の前後比較（`docs/reports/screenshots/herb-wiring/`）

before = main `ed159e9`、after = 本 branch。同じ save・同じ操作。390×844 と 360×800。

| 画像 | 確認できること |
|---|---|
| `before-/after-01-pizza-select-*` | ピザ選択のサムネイル。マリナーラ・フガッサのオレガノが 🍃 → SVG（位置不変） |
| `before-/after-02-topped-*` | 具材工程。4 種の 2 ピースずつ。before は 🌱 と 🍃 が 2 種ずつ重複して見分けにくい／after は 4 種が別の形。トレイのチップ（アーティチョーク・ほうれん草）も SVG |
| `before-/after-03-topped-grayscale-*` | グレースケール。after は形で見分けられる |
| `before-/after-04-baked-result-*` | 焼成後の RESULT と「使った材料」のリスト（SVG＋名前） |
| `oregano-b-vs-b2-26px.png` | オレガノ B（採用）と B2（候補）の 26px 比較（Chromium のモック） |

所見: 4 種とも 1.2em で表示崩れ・横はみ出し無し。オレガノ B はピザ上で小さめ（B2 との比較は Owner の実機確認で）。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `herb417_HV_390x844.mp4`（H.264） | 390×844 | 45.9 s | 707 KB | PASS |

Download: セッション内で直接提出（repo には commit しない）。Chromium（iphone-390x844 プロジェクト）、**実機 iPhone Safari ではない**。

Video Verification: PASS（ffprobe: h264・390×844・45.9 s・706,924 bytes。コンタクトシートで全工程を目視確認）

この動画で確認すること:
- ピザ選択で、オレガノ・ローズマリー・ほうれん草・アーティチョークを使う既存レシピのサムネイルが SVG で描かれている（各 2.5 秒保持）
- Free Cooking の具材工程で、4 種のチップを選んで生地に 2 個ずつ置く（チップとピースが SVG）
- グレースケールでも 4 種を形で見分けられる
- 焼く → RESULT の焼き上がりと「使った材料」のリスト

## 7. 残る Gate

| Gate | 状態 |
|---|---|
| CI（build・layout・WebKit 6 shard・WebKit Gate） | PR 作成後に確認 |
| Codex レビュー | PR 作成後に依頼・確認 |
| Owner の iPhone Safari 実機 HV（R2 D4: 実寸の確認。ほうれん草・オレガノのグレースケールの見え方、オレガノ B と B2 の選択） | 未 |
| merge | Owner 承認待ち |
| 後続 | B19（#774）はこの PR の merge 後に開始（Owner 方針） |
