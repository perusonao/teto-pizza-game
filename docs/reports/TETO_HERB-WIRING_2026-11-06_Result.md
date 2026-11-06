# ハーブ 4 種のアイコン配線 — Result Report（#417、描画のみ）

**種類:** 実装 PR（UI の描画変更）。rosemary B／oregano B／spinach A2／artichoke A2 を `IngredientGlyph.tsx` に実装し、4 食材に `pieceVisual` を付ける。サイズは 1.2em（既存のハーブ群と同じ補正、占有 1em）。**PROVISIONAL**（Owner R2 の D4: 実装後に実寸の HV）。
**ブランチ:** `claude/teto-pizza-herb-svg-0ze45t`（base `ed159e9` = main）。独立 worktree で作業。
**根拠:** Owner R2 決定（`docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md` §1 D1〜D4、§3 PR A）、#417、前回の準備レポート `docs/reports/TETO_ICONS-PREP_2026-11-06_Result.md`。

## 1. Fresh Audit と claim

| 項目 | 状態（2026-11-06） |
|---|---|
| #748 | claim は release 済み（コメント 6689217829）。#759 は merge 済み。main は `ed159e9` のまま |
| #417 の既存 claim | `session_013m8Cb6ytubmsQ6BE4u2aec`（6688256290、`src/components/herbGlyphs/**` ほか、〜11/20）は**未変更・未編集**。本 PR は `herbGlyphs/**` を作らず触れない |
| 配線の担当 | **本 PR に一本化**。claim `6689299948`（`session_016YrGi1AJW3sF49Uzak3yaN`、`ingredients.ts`・`IngredientGlyph.tsx`・同 test・`App.css`・golden 1 件・本レポートと画像、〜11/13）を #417 に投稿 |
| 他の PR との重なり | open PR #738（PizzaStage 系）、#775（#577 PD-1a、`src/logic/dough/doughKind*` のみ）とファイルの重なりなし |
| 描画の置き場所 | 既存の慣例（全グリフが `IngredientGlyph.tsx` 内）に合わせ、`herbGlyphs.tsx` は使わず 4 つの描画関数を `IngredientGlyph.tsx` の末尾へ。SVG 原本は R2 の候補（`claude/herb-icons-compare-docs-8auzii` `c9351e4`）を JSX に機械変換（別セッションの `83c066f` の変換と同じ内容） |

## 2. 変更ファイル

| ファイル | 変更 |
|---|---|
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に 4 つ（`rosemary-sprigs`／`oregano-pile`／`spinach-leaves`／`artichoke-quarter`）。4 食材の行に `pieceVisual` のみ追加（id・emoji・color・category・placement・サイズクラスは不変） |
| `src/components/IngredientGlyph.tsx` | `VISUAL_VIEWBOX`（64×64）、描画の分岐、4 つの描画関数（SVG の機械変換、id・gradient・defs なし） |
| `src/App.css` | 既存のハーブ群の共有 1.2em ルール（cilantro-leaf ほか）に 4 クラスを追加。新しい規則・新しい寸法は作らない |
| `src/components/IngredientGlyph.test.tsx` | `HERB4_DEDICATED` を `ALL_DEDICATED` へ。識別テスト（#733 方式）を追加: 宣言とアイデンティティ、グリフ／駒の両方で SVG（64×64・id／gradient／defs なし・絵文字を出さない）、宣言から描く（id に依存しない）、4 種＋バジル／パセリ／ミント／パクチー／大葉／ルッコラの全てが異なる、`App.css` の 1.2em 規則に 4 クラスが入っていること |
| `src/data/__golden__/lateCatalog.offSurface.json` | **`ingredients.sha256` のみ** `9d51832c…` → `01424e9e…`。根拠は §3 |
| `src/data/lateCatalog.offGolden.test.ts` | golden 再生成の理由をコメント履歴に 1 行追記（検証内容は変更しない） |
| `src/logic/rt01ReferenceRegression.test.tsx` | Pizza Select サムネイルの凍結 HTML の比較で、4 つの SVG を絵文字に戻してから比較（sausage の既存の扱いと同じ方式。他のマークアップ変更は引き続き失敗する） |
| `docs/reports/…`、`docs/reports/screenshots/herb-wiring/` | 本レポート、before／after 画像、撮影スペックの控え |

食材 ID・`emoji`・`color`・family・サイズクラス・採点・Research・保存・レシピ・ladder・Batch 19・eggplant／burrata は変更していない。`src/components/prepGlyphs/**`（前回の未配線コンポーネント）は**保持するが配線しない**。

## 3. 失敗したテストの個別検証と golden

配線で次の 2 系統が失敗した。いずれも意図した描画変更の結果で、他は変えていない。

1. **`lateCatalog.offGolden.test.ts`（食材行のダイジェスト）**: 先頭 66 件の食材行に `pieceVisual` が付いたため。**4 行の `pieceVisual` を除くと旧ダイジェスト `9d51832c…` を再現する**ことを一時テストで確認（変わった行は rosemary／oregano／spinach／artichoke の 4 件だけ）。過去の #701・#718 と同じ作法で、`ingredients.sha256` だけを更新。recipes／ladderSteps／discoveryTargets の golden は無変更。
2. **`rt01ReferenceRegression.test.tsx`（Pizza Select サムネイルの凍結 HTML、5 件: fugazza／napoletana／pizza-bianca／capricciosa ほか）**: 15 レシピの凍結ベースラインが絵文字を含むため。**ベースライン本体は変更せず**、サムネイル比較側で 4 つの SVG を絵文字に戻す（sausage の既存方式）。

## 4. 検証

| 検査 | 結果 |
|---|---|
| `tsc -b` | エラーなし |
| `npm run build`（tsc ＋ vite build） | 成功（チャンクサイズの既存警告のみ） |
| `oxlint` | 既存の警告のみ。本変更に起因する警告・エラーなし |
| `vitest run`（全体） | RESULT_FULL_VITEST |
| 配線前の個別: `IngredientGlyph.test.tsx` | 221 件 pass（新規の識別テスト含む） |
| `rt01ReferenceRegression.test.tsx` | 32 件 pass |
| `lateCatalog.offGolden.test.ts` | 7 件 pass |
| Chromium E2E（390×844・360×800、撮影スペック） | 2/2 pass（before／after とも）。実画面は §5 |
| **WebKit（関連 shard）** | **ローカルでは実行できない**（このコンテナに WebKit がない）。PR の CI（WebKit E2E の全 shard）の結果を HEAD 単位で記録する。§7 |

## 5. 変更前後の実画面（Chromium、390×844・360×800）

`docs/reports/screenshots/herb-wiring/`（`herb-wiring-before-after-390x844.png`／`…-360x800.png` が一覧、個別の before-／after- 画像も同ディレクトリ）。全 5 場面: トレイ（ハーブ系 p1・野菜系 p4）、ピザ上（生）、焼成後（FINISH）、RESULT。条件は同一の保存・同一の操作（撮影スペック `docs/reports/data/TETO_HERB-WIRING-20261106_capture.spec.ts.txt`、`before` は本変更前の main、`after` は配線後）。

## 6. 視認性の懸念（Chromium の目視。**iPhone Safari 実機は未確認**）

- **ローズマリー B（ピザ上）**: 赤いソースの上で暗い緑灰の小さな塊に見え、ハーブらしさ・枝の形が読みにくい（トレイ 26px では枝が読める）。以前の明るい緑の絵文字より**目立たない**。
- **オレガノ B（ピザ上・RESULT）**: 小さい緑の三角の山。RESULT のリスト内（17.6px 相当）では塊としてしか見えない。前回の指標でも面積が最小。
- **ほうれん草 A2・アーティチョーク A2**: ピザ上でも形が読める（葉 2 枚＋白い葉脈／淡い断面）。焼成後も輪郭が残る。
- **共通**: 新しい 4 種は絵文字より暗く落ち着いた色で、明るい緑のバジル・ミント・パセリ（絵文字のまま）と並ぶとトーンが揃っていない。D4 の実寸 HV（トレイ 26px、ピザ上、焼成後、RESULT、グレースケール）で判断する項目。不足なら 1.35em（大葉・しらすと同じ方式）や色の調整が候補になるが、**それは新しい Owner 判断**で、本 PR では行っていない。

## 7. CI と Codex

PR 作成後に追記（HEAD、各 check の結果、Codex の指摘）。

## 8. 触れていないもの・残り

- merge、Production ON、共有 Preview の更新、他セッションの claim の変更、既存 PR への push、Batch 19（burrata・pesto-burrata・crudaiola）の先行実装はしていない。
- iPhone Safari の実機 HV（Owner）、390×844 の HV 動画（repo に含めない。納品は別）は未実施。**Chromium の確認を実機 HV の合格として記録しない。**
- `herbGlyphs/**`（別セッション）は本 PR の merge 後に不要になる。扱いはその claim の保有者と Owner が決める。
- ブランチには前回の準備コミット（`prepGlyphs/**`、レポート、画像）が含まれる。これらは未配線・docs で、本 PR の挙動に影響しない（配線の差分は §2 の表）。
