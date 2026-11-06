# 新食材の描画準備 — ハーブ 4 種の視認性検証・統合差分の整理、eggplant／burrata の未配線コンポーネント（#417、2026-11-06）

**種類:** 未配線の新規ファイル＋docs。`ingredients.ts`・`App.css`・`IngredientGlyph.tsx` ほか既存ファイルは**変更していない**（後述の「配線シミュレーション」は作業ツリー内で試して差分だけ記録し、元に戻した）。merge・Production ON・共有 Preview 更新・既存 PR への push・他セッションの claim 変更はしていない。
**ブランチ／worktree:** `claude/teto-pizza-herb-svg-0ze45t`、独立 worktree `/home/user/wt-herb-prep`（base `ed159e9` = main 最新）。

## 1. Fresh Audit

| 対象 | 状態（2026-11-06 時点） |
|---|---|
| main | `ed159e9`（#753 eggplant A 案の採用記録まで。#759 B18・#760・#761・#765・#769 は merge 済み） |
| #748 | claim（セッション `session_013m8Cb66Bu5f1XXHC2xCiLL`、〜11/19）が**未解放のまま残る**。#759 は merge 済み。claim 解放を求めるコメント（6687040558）に応答なし。`ingredients.ts`・`recipes.ts` ほかを含む |
| #753 | merge 済み。eggplant A 案（輪切り 2 枚）を Style Lock V2 §12 に採用、`eggplant.svg` を参照 SVG に昇格。**デザインのみ・未実装**（`pieceVisual` なし、Fry は HOLD） |
| #417 | Owner R2 決定: rosemary B／oregano B／spinach A2／artichoke A2、burrata C（D1〜D9）。実装は「#748 の claim 解消＋Owner の明示 GO」まで HOLD。**別セッションの claim（6688256290、`session_013m8Cb6ytubmsQ6BE4u2aec`、branch `claude/teto-pizza-parallel-plan-sh894e`、〜11/20）が `src/components/herbGlyphs/**` を押さえ、4 種の未配線 SVG→JSX・7 テスト・モックを実装済み**（`83c066f`、未 PR） |
| open PR | 食材アイコンに触る PR はなし（#738 Steam・#746 DRIZZLE ほかは別領域）。#748 系の PR は merge 済み |
| 判断 | ハーブ 4 種の SVG は上の別セッションと**重複するため作り直さない**（Owner 質問で「重複せず上乗せ」を選択）。本作業は (a) その SVG の小サイズ検証、(b) 統合差分の実証、(c) eggplant／burrata の未配線化 |

## 2. 成果物

| ファイル | 内容 |
|---|---|
| `src/components/prepGlyphs/prepGlyphs.tsx` | `EggplantSlices`（`eggplant.svg` の機械変換、`data-part` 付き）と `BurrataSplit`（burrata C の機械変換）。64×64、id・gradient・defs なし。どこからも import しない |
| `src/components/prepGlyphs/prepGlyphs.test.tsx` | 6 テスト（純粋インライン、eggplant の状態フック `data-part`、burrata の温かい輪郭とクリーム色、2 つが別の絵、**他のファイルから import されていないこと**） |
| `docs/reports/screenshots/herb-svg-prep/` | `prep-before-after-composite.png`（焼成後／溶けたチーズ上 × カラー／グレースケール）、`prep-sheet-{raw,baked,melt}[-gray].png`（17.6／26／33.6／64px、DPR3） |
| `docs/reports/data/TETO_ICONS-PREP-20261106_metrics.json` | 見える面積・グレー面積（css px²）。再現用 `..._capture.cjs.txt` |
| `docs/reports/data/TETO_ICONS-PREP-20261106_herb-wiring-simulation.patch.txt` | ハーブ 4 種の配線を試した差分（§5） |

ハーブ 4 種の SVG 原本は別セッション／`claude/herb-icons-compare-docs-8auzii`（`c9351e4`）のものを**読み取り専用**で使った（このブランチにはコピーしていない）。

## 3. 小サイズの視認性（iPhone 想定、Chromium・DPR3。実機 HV ではない）

指標: 背景との差が大きい画素の面積（見える面積）と、そのうち明度差 15 超（グレー面積、色を落としても残る）。css px²、トレイ 26px と RESULT 17.6px、**SVG は 1em のまま測定**（実際は 1.2em になるので、実機はこれより少し大きい）。比較は現行の絵文字。

| 食材 | 焼成後（グレー面積）SVG／絵文字 | 溶けたチーズ上（グレー面積）SVG／絵文字 | RESULT 17.6px の所見 |
|---|---|---|---|
| rosemary B | **362**／44 | 380／287 | 形が残る（172 見える面積） |
| artichoke A2 | **318**／44 | 308／288 | 断面の淡い芯が識別点。縮小で縁が細る |
| oregano B | **210**／120 | 237／199 | 面積は最小（101）。**17.6px では緑の塊**、粒の質感は消える |
| spinach A2 | **340**／120 | 397／199 | 2 枚の葉と淡い縁・葉脈が残り最も強い |
| eggplant A | 369／374 | **263**／385 | 溶けたチーズ上で現行絵文字より小さい（輪郭が薄紫でチーズの白に近い面） |
| burrata C | 283／397（🧀） | **129**／477 | **溶けたチーズ上で最弱**（mozzarella 参照 92 と同程度）。茶の輪郭で辛うじて残る |

読み取り:
- ハーブ 4 種は焼成後のグレー面積が現行絵文字を**すべて上回る**（R2 レポートの懸念「spinach は絵文字に届かない」は、明るい緑の絵文字との比較では、焼成後のグレー面積では当たらない。焼成後の絵文字が茶色いフィルタで暗く沈むため）。ただし**絵文字はフィルタ前の平坦な描画**で測っており、実ゲームのベイクフィルタ適用後の比較は実装後の HV で行う。
- 要注意は **oregano の 17.6px（RESULT）** と **burrata の溶けたチーズ上**。後者は、白いチーズ類との区別が D5 の HV 項目。burrata は輪郭の濃さを上げる（`#85694a` → やや濃い茶、2.4 → 2.8）か、1.35em にする案が候補（新しい Owner 判断）。
- 画像はすべて Chromium。**iPhone Safari の実機での確認は未実施（Owner HV）。**

## 4. eggplant／burrata の準備と、残る確認

- eggplant: 既存の参照 SVG をそのまま変換。焼成・揚げ状態は `claude/eggplant-ingredient-svg-13rbjw` に CSS 変数仕様があるが、Fry G2 が HOLD のためコンポーネントは状態なしの A 案のみ。`data-part` は残してあり、状態 CSS を後から当てられる。
- burrata: 食材自体が未追加（Batch 19 = B PR）。コンポーネントは先行して用意しただけで、`pieceVisual` 用の ID（`burrata-split` 案）は B PR で追加する。

## 5. 統合時に必要な変更（claim 解放・Owner の明示 GO の後。今は不可）

ハーブ 4 種の配線を作業ツリーで試した（別セッションの `herbGlyphs.tsx` を一時的に置き、**試行後に全て元に戻した**）。差分は `..._herb-wiring-simulation.patch.txt`。

1. **`src/data/ingredients.ts`**: `DedicatedIngredientVisual` に 4 つの id（`rosemary-sprigs`／`oregano-pile`／`spinach-leaves`／`artichoke-quarter`）。4 食材の行に `pieceVisual`。id・emoji・color・family・サイズクラスは変更しない。
2. **`src/components/IngredientGlyph.tsx`**: `VISUAL_VIEWBOX`（64×64）と描画の分岐を追加。
3. **`src/App.css`**: 既存の「ハーブ群 1.2em」の共有ルール（cilantro-leaf のあるセレクタ群）に 4 クラスを追加するだけ（占有 1em の負マージンは共有）。
4. **`src/components/IngredientGlyph.test.tsx`**: `ALL_DEDICATED` に 4 行を足す（#733 方式）。識別テストを追加。
5. **見落としやすい点: `src/data/__golden__/lateCatalog.offSurface.json` の `ingredients.sha256` の再生成が必要**（`lateCatalog.offGolden.test.ts` が、食材行の `pieceVisual` 追加で失敗する。過去の #701・#718 と同じ作法。診断: 差分が 4 行の `pieceVisual` だけであることをダイジェスト再生成前に確認する）。試行では `9d51832c…` → `01424e9e…` で通った。
6. eggplant を配線する場合は Fry 側の判断（G2）が先。burrata は B PR（食材追加）に含める。**merge 順は、ハーブ（A）→ Batch 19（B）を推奨**（`ingredients.ts`・`IngredientGlyph.tsx` を共有）。
7. 配線 PR の完了条件: 390×844 動画（repo に含めない）、390×844・360×800 の before/after、トレイ 26px／ピザ上／焼成後／RESULT の実寸 HV（D4）。
8. **claim の整理**: (a) #748 の claim は解放待ち（Batch 19 の `dependsOn` 用）。(b) `sh894e` 側の `herbGlyphs/**` をそのまま使うか、このブランチの `prepGlyphs` を併合するかは、配線 PR の担当が決める。**この 2 つが同じ SVG 変換を二重に持たないよう、配線 PR では 1 つに統一**する。

## 6. 検証

- `vitest run src/components/prepGlyphs`: 6/6 pass。`tsc -b`: エラーなし。
- 配線シミュレーション: `tsc -b` クリーン、`IngredientGlyph.test.tsx`・`src/data` pass（golden 再生成後）。`vitest run src/components src/data`: **150 files / 2946 tests pass**（8 skipped）。**全 Vitest・build・E2E・WebKit は未実行**（未配線のため。配線 PR で実施）。
- 触れていない: 保存・採点・ID・emoji・Research・ladder・Production・共有 Preview、他セッションの claim。

## 7. ステータス

- 完了: Fresh Audit、重複の回避、eggplant／burrata の未配線コンポーネントとテスト、ハーブ＋新 2 種の小サイズ比較、配線差分の実証（golden の発見を含む）。
- 未完了／Owner 判断: oregano の RESULT 17.6px と burrata の溶けたチーズ上の見え方の改善（任意）、iPhone Safari 実機 HV、実装 GO、#748 claim の解放。
- UI は変更していないため HV 動画の対象外（HV Policy §2 の未配線・docs のみ）。


> 2026-11-06 追記: `src/components/prepGlyphs/**` は、ハーブ配線 PR（#779）の範囲を保つため、そのブランチのコミットでは削除した。このレポートのコードはコミット `7f75050` に保持されている（復元: `git checkout 7f75050 -- src/components/prepGlyphs`）。
