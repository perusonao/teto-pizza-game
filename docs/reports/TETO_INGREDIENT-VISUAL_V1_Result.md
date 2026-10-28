# Ingredient Visual V1 — Result Report（ピクルス / ヴルステル / パプリカパウダー）

Status: **Owner 画像 HV 合格（2026-10-28）。3 SVG を参照へ昇格し、Style Lock §1e を追記済み。merge は Owner の最終承認待ち。Safari 実機での動作確認は未実施。** 基準 main `76745be3`（#679 merge 後）。ブランチ `claude/teto-pizza-pr679-final-gate-0i6r63`（セッション指定ブランチ。PR は未作成）。
親資料: `TETO_INGREDIENT-VISUAL_B10-Fresh-Audit.md`、`TETO_INGREDIENT-VISUAL_V1_Prep-Result.md`、`TETO_INGREDIENT-VISUAL_V1_Coordination-Result.md`（ブランチ `claude/teto-pizza-visual-audit-g7wntq`）。
Owner 判断（2026-10-27）: SVG 3 点は**暫定採用**、最終採用は 390×844 / 360×800 の実画面 HV。牛肉 SVG は PR-2 の担当（本 PR では扱わない）。

## 変更（描画のみ）
| ファイル | 内容 |
|---|---|
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に `pickle-slices` / `wurstel-links` / `paprika-powder-pile`（`hot-dog-slices` の直後）。`pickles` / `wurstel` / `paprika-powder` に `pieceVisual` を 1 行ずつ追加し、コメントを更新。`id`・`nameJa`・`emoji`（テキストフォールバック）・`color`・`placement`・`category`・`unlockCondition` は不変 |
| `src/components/IngredientGlyph.tsx` | 3 visual の viewBox（64×64）・JSX 連鎖・コンポーネント（Audit の候補 SVG を移植。`id` / gradient / `<defs>` なし）。`HotDogSlices` の後、shiso の前に配置（PR-2 が末尾に追記しても衝突しない位置） |
| `src/App.css` | サイズ補正を**独立ルール 1 つ**（3 visual、1.2em / margin -0.1em）。既存の補正セレクタ群には足していない |
| `src/components/IngredientGlyph.test.tsx` | `V1_DEDICATED` を `ALL_DEDICATED` に追加。新 describe（宣言・identity 不変、glyph / 置いたピースの両方で SVG・emoji 非表示・`id=` / `url(#` なし、既存のソーセージ / ホットドッグとの区別） |
| `docs/reports/screenshots/ingredient-visual-v1/` | before / after（390 / 360 × トレイ・調理中・焼成後）、近接食材との比較 |

**変更していないもの:** 食材 ID、採点、在庫、DH4（`discoveryCatalog` / hint5 golden / DH4 監査 JSON / 件数 pin）、レシピ定義（`recipes.ts` / `referencePizza.ts` / `recipeSauceProfiles.ts` / `lateCatalog.ts`）、ladder・floors、`toppingSizeClass`、セーブ形式。
`src/data/__golden__/lateCatalog.offSurface.json` は**再生成不要**だった（digest は凍結済みの先頭 N 件の prefix で、Batch 10 の 3 食材は範囲外。`lateCatalog.offGolden.test.ts` は無変更で通過。Prep-Result の見込み「再生成」は不要になった）。

## 実画面の確認（Chromium、deviceScaleFactor 2、Free Cooking、同じ配置・同じ焼き時間）
- 390×844 / 360×800 の 2 viewport × トレイ・調理中・焼成後。before（main の絵文字 🍈 🌯 🟧）と after を並べた画像を `docs/reports/screenshots/ingredient-visual-v1/` に置いた。
- **サイズ補正は 1 回だけ**: 補正なしの最初の after は、絵文字より一回り小さく、特にパプリカパウダーが小さかった。そのため 3 visual に 1.2em の独立ルールを入れ、撮り直した（比較画像は補正後の after）。
- 見え方: ピクルス = 緑の小さなガーキンと波刃の輪切り（🥒 ズッキーニより小さく、メロン風の 🍈 とは別物）。ヴルステル = 切れ目入りの淡橙のソーセージ 2 本（ホットドッグ = ピンクの輪、ソーセージ = 暗いサラミと取り違えにくい）。パプリカパウダー = 赤い粉の小山。いずれもトレイのチップの大きさは隣（いくら・白ごま・ザクロ）と揃う。
- 焼成後の FINISH 画面でも輪郭が残る（赤いソース・焼けた生地の上）。**最終的な判断は iPhone 実機の HV。**

## 検証
- `tsc -b` エラー 0。`oxlint` エラー 0（警告は既存）。
- `vitest run src/components src/data src/logic/catalog`: 149 files / 2,649 tests passed。
- `TETO_PINSA_OFF=1`: `IngredientGlyph.test.tsx` / `ingredients.test.ts` / `lateCatalog.offGolden.test.ts` が 218 passed。
- フル Vitest・全 e2e は CI に任せた（ローカルでは重複実行しない）。
- MP4（390×844、H.264）は Owner へ直接提出し、リポジトリには含めない。

## HV の判定基準（Prep-Result §5 のとおり）
1. ピクルスが果物に見えない。2. ヴルステルが別料理に見えない（ホットドッグ・サラミ・ズッキーニと取り違えない）。3. パプリカパウダーが、生地と焼成後の橙の上で 360×800 でも輪郭が残る。**HV 不合格の SVG は採用しない**（Owner 判断）。

## Owner 画像 HV の結果（2026-10-28、390×844 焼成後の比較画像）
A ピクルス **PASS** / B ヴルステル **PASS** / C パプリカパウダー **PASS**。現行 SVG を採用、サイズ補正 1.2em を維持、追加の描画修正なし。360×800 は既存の撮影結果を維持。**Safari 実機での動作確認は未実施。**
昇格: `pickles.svg` / `wurstel.svg` / `paprika-powder.svg` を `docs/design/references/ingredient-icons-2.0/` へ、Style Lock v2 §1e を追記。

## 残り（更新後）
- Owner の最終承認と merge（それまで merge しない）。Safari 実機での動作確認は未実施。
- PR 作成と merge は Owner 承認後。PR-2（Line C）は、この PR の merge 後に取り込む（beef の `beef-slices` は PR-2 側）。
