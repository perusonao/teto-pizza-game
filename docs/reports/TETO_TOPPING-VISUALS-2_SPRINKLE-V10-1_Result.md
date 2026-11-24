# V10-1 単独試験 Result Report — 薄片の縁のぼかし 0.4 CSS px（試験ブランチ、#875 には未反映）

状態: **試験ブランチのみ。** #875 の head（F3 `6e4bf54e`）、PR 専用 Preview、merge、Draft、Production、共有 Preview は未変更。F3 の正式採用は HOLD のまま。
承認: [#875 comment 7116322259](https://github.com/perusonao/teto-pizza-game/pull/875#issuecomment-7116322259)（V10-1 単独のみ。V10-2 / V10-3 / F1・F2 混合 / 色相補正は未承認・HOLD）。
試験ブランチ: `claude/pr-875-v10-1-blur-trial`、対象 HEAD `96a7f481f74357f4ce87e8e62377e9e3dcfd4ffa`（基点 = #875 head `6e4bf54e`）。

## 1. 変更内容（最小差分・3 ファイル +19/−1）
| ファイル | 内容 |
|---|---|
| `src/components/placedVisuals/ParmigianoShavings.tsx` | 外側の `<svg>` に `style={{ filter: "blur(0.4px)" }}` を 1 つ（定数 `EDGE_BLUR_CSS_PX = 0.4`）。**`id` / `<defs>` / gradient / `url()` 参照は新設・変更なし。** 子要素（`<g>` / `<path>`）には何も付けない |
| `…/ParmigianoShavings.test.tsx` | ブラーが `filter: blur(0.4px);` 1 つだけ・子要素に `style` / `filter` なし、を固定 |
| `e2e/topping-visuals-parmigiano.spec.ts` | 置いた全 svg の computed `filter` が `blur(0.4px)` であることを追加（既存の検証は緩めていない） |

**適用範囲（全利用箇所を調査）**: `ParmigianoShavings` はレジストリ経由でしか描かれず、`IngredientPieceVisual` が `surface="placed"`（既定）のときだけ呼ぶ。呼び出し元は **`PizzaStage.tsx`（ピザ上のトッピング。配置・焼成後・RESULT・CUT で当該要素を描く場合）と `PostBakePiece.tsx`（焼成後に載せる片）のみ**。トレイのチップ・ドラッグ preview（`IngredientTray`）・在庫（`InventoryOverlay`）・Dex／レシピカードのサムネイル（`PizzaThumbnail`）・Reference（`PizzaVisualPieces`）はすべて `surface="selection"` を明示しており（アーキテクチャテストで固定）、**ブラーは掛からない**。つまり Owner の方針「食材選択アイコンではなくピザ上の削り片に限定」を満たす。**（先の版の「トレイ／サムネイルにも掛かる」という記述は誤りで、独立レビューの推測を未確認のまま載せたもの。訂正する。）** 焼成時のラッパーのフィルタ（`.pizza-cheese` の `cheeseStyle`）とは別の、内側のフィルタとして入れ子になる（衝突しない）。**描画の決定性・配置・片数・在庫・Undo・採点・保存・`PizzaStage.tsx`・`App.css`・`ingredients.ts` は未編集。**
ブラーを SVG 子要素ではなく外側 svg に置いたのは、Safari が SVG 内部要素への CSS フィルタを不安定に扱うため（推論）。

## 2. Style Lock 確認
Style Lock V2 §2 は `id` / gradient / `<defs>` を禁じるが、`filter` / `blur` には言及しない（grep で確認）。CSS の `blur()` 関数は要素参照ではないので **違反なし**。ただし `IngredientPieceVisual.architecture.test.ts` はソース文字列を走査するため、最初の版では**説明コメントに `url(#` と `<defs` の文字列を書いたことでこのガードが失敗**した（独立レビューが検出、P1）。コメントの言い換えのみで修正（`96a7f481`、動作変更なし、ガードのテストは無変更）。

## 3. Chromium 比較（F3 vs V10-1、同一ページ・同一配置、変数はブラーのみ）
方法: Chromium 390×844（DPR 1）。同じ 4 タップ（皿の座標 %: (50,30)・(28,62)・(72,62)・(51,50)。(51,50) は白いモッツァレラの上）を置き、`filter:none !important` の差し込みだけで F3 / V10-1 を切り替えて撮影。比較用に parmigiano を非表示にした背景も撮影し、背景との Lab ΔE から測定。焼成後は RESULT で 4 秒待って安定を確認（F3 の連続 2 撮影は画素差 0）。
指標: ink = ΔE≥2 の画素数／明瞭率 = ink のうち ΔE≥10 の割合／縁の勾配 = ink 境界の ΔE の勾配（低いほど縁がやわらかい）。**領域 `白地` `ソース地` は、生地円の半径×0.55 の正方形で切った近似**（モッツァレラ・ソース・他の片が混ざる）。

| 場面 | 指標 | F3 | V10-1 | 差 |
|---|---|---|---|---|
| 配置時・全体 | 縁の勾配 / 明瞭率 / 平均ΔE / ink | 19.7 / 79.1% / 31.2 / 3,876 | 15.7 / 77.0% / 28.9 / 4,187 | 縁 −20%、明瞭 −2.1pt、ink +8% |
| 焼成後・全体 | 同上 | 20.4 / 72.3% / 32.0 / 3,096 | 15.6 / 69.3% / 29.3 / 3,376 | 縁 −24%、明瞭 −3.0pt、ink +9% |
| 焼成後・白地（近似） | 同上 | 18.9 / 69.9% / 30.2 / 2,540 | 14.7 / 66.9% / 27.7 / 2,765 | 縁 −22%、明瞭 −3.0pt |
| 焼成後・ソース地（近似） | 同上 | 17.3 / 68.7% / 29.1 / 1,459 | 13.4 / 64.8% / 26.8 / 1,580 | 縁 −22%、明瞭 −3.9pt |
| 外周 4 タップ（配置時） | 同上 | 19.8 / 77.9% / 30.0 / 4,025 | 15.8 / 76.0% / 27.7 / 4,355 | 縁 −20%、明瞭 −1.9pt |

読み方: 縁のやわらかさは 約 −20〜24%、**明瞭率の低下は 約 2〜4pt（消える崖はない）**。ink は 約 8〜9% 増える（ぼかしで縁が広がる）。#7105920044 の E1（0.4px）の傾向と同じ方向（私の測定法は別で、数値は直接比較しない）。**この指標は知覚そのものではない。「木片・短冊」に見えるかどうかは、形そのもの（V10-3 の領域）が主因の可能性が高く、ブラーだけで解消する保証はない。**
目視（`docs/reports/screenshots/topping-visuals-2/sprinkle-v10-1/board-*.png`）: 3 倍拡大で縁がやわらかくなるが、片の輪郭と形は読める。ピンボケとまではいかない（0.4px）。

## 4. 性能（Chromium・ヘッドレス、25 個を置いた場合）
| 指標 | F3 | V10-1 |
|---|---|---|
| ステージの再ラスタ（screenshot 20 回）中央値 / p90 | 97 ms / 102 ms | 98 ms / 123 ms |
| rAF 間隔（2.5 秒）中央値 / p95 | 16.7 ms / 16.7 ms | 16.7 ms / 16.7 ms |
差は計測のゆれ内（p90 は 1 回のゆれの可能性。再現確認はしていない）。**iPhone 実機の負荷は未測定**（Safari で多数の `blur()` 付き svg を置いた場合のコストは実機 HV で確認が必要）。

## 5. 検証結果（対象 HEAD `96a7f481`）
| 項目 | 結果 |
|---|---|
| `tsc -b` / `oxlint` | クリーン（最初の実装時。コメント修正後は焦点テストのみ再実行） |
| 焦点テスト（placedVisuals＋IngredientPieceVisual＋**architecture**） | 5 files・57 tests passed |
| E2E（Chromium 390×844・360×800、parmigiano spec） | 4/4 通過（computed `filter` の検証を含む） |
| **WebKit（`workflow_dispatch`、run [45286724978](https://github.com/perusonao/teto-pizza-game/actions/runs/45286724978)、HEAD `96a7f481`）** | **全 10 job success**（classify・layout-chromium・WebKit 6 シャード・Layout Contract Gate・WebKit Gate）。各シャードの Playwright 実行は 13〜20 分で、skip・緩和なし。修正前の HEAD `9c27f13e` の run 45286454474 は、コメント修正のためキャンセルして再実行（失敗ではない） |
| 全 Vitest（ローカル `--shard=N/6`） | **失敗 0。687 files passed・3 skipped、12,785 tests passed・20 skipped・2 todo**（1/6: 1,814、2/6: 1,720・2 todo、3/6: 2,229・4 skipped、4/6: 2,343、5/6: 2,859・7 skipped、6/6: 1,820・9 skipped）。実行ツリーは `96a7f481`（以後の差分は docs のみ）。F3（#7102552423）の 12,784 に対し +1 は、追加した単体テスト 1 件 |
| 独立レビュー（別コンテキストの読み取り専用エージェント。Codex は未実施） | **1 回目（`9c27f13e`）: NO-GO**（P1: コメントのリテラルでガード失敗）→ 修正。**2 回目（コード同一の HEAD `0ae3e3a3`、最新の docs-only HEAD は `bda66183`）: GO-with-notes、P0〜P2 なし。** Style Lock V2 適合、ガード・契約テスト 57 件通過、既存テストの緩和なし、全呼び出し元を表にして確認（§1）。P3: E2E は computed style のみで画素の確認なし／BAKE 中のブラーと焼成フィルタの重なりのちらつきは未確認 |

## 6. 副作用・リスク・未確認
- **WebKit の実描画は未確認**: CI が確認したのは computed style の適用とテストの通過で、**実機 iPhone Safari での見え方・負荷・DPR 3 でのにじみは未確認**（画像・数値は Chromium）。
- ブラーの 0.4 CSS px は DPR によって物理画素では 0.8〜1.2px 相当になる。実機で「ぼけすぎ」の可能性（#7105920044 の 0.8px 案はピンボケ判定）。
- 縁を広げる分 ink が約 9% 増え、淡い焼成後の白地で明瞭率が約 3pt 下がる。消える崖ではない。
- **CUT**: 切り口をまたぐ片も、同じ `IngredientPieceVisual`（`surface="placed"`）で描かれるためブラーが掛かる（PostBakePiece と `pizza-topping-half` の経路）。**CUT の実画面は測っていない（未確認）。**
- 四角パン・焼きすぎ・Dex／サムネイルの実画面は未確認。Owner Gate は read-only token が無く（401）判定は未取得。
- 測定に使った一時の playwright 設定・スペック・解析スクリプトは `docs/reports/data/TETO_SPRINKLE-V10-1/*.txt` に保存（テスト実行の対象外）。

## 7. 戻し方・次の判断
- 試験ブランチは #875 から独立。V10-1 を #875 に反映するかは **Owner の別承認**（反映時は PR 専用 Preview の入れ替えが必要。公開枠 5 件のため `pr-875-6e4bf54` を置き換える）。
- 取り消しは、コードは 2 コミット（`80674a4e` と e2e の `9c27f13e`）と文言修正（`96a7f481`）の revert。
- V10-2（焼成時の減衰）・V10-3（形状）は未着手・HOLD。

## 8. 実機 HV に進めるか（担当の報告）
- **コード・CI・レビューは許容範囲**: 独立レビュー（最新コードで）GO-with-notes・P0〜P2 なし、WebKit 10/10、全 Vitest 失敗 0、適用範囲はピザ上の削り片のみ（範囲外への影響なし → **修正不要、試験ブランチに追加のコード変更なし**）。
- **実機 HV に進める条件は満たしたと判断**。ただし進めるには #875 とは別に **試験ブランチ用の PR 専用 Preview が必要**で、公開枠 5 件のため既存ページの置き換えが要る。これは未承認（本担当は Preview を更新していない）。**Owner の判断待ち**: ①実機 HV 用に PR 専用 Preview を試験ブランチ HEAD で公開してよいか、置き換えるページ（例 `pr-875-6e4bf54`）の指定 ②HV の確認項目: 縁の見え方（ぼけすぎ／ちょうどよい）、「木片・短冊」の印象が変わるか、焼成後の白地・ソース地での視認、BAKE 中のちらつき・多数配置時の負荷。
- 未確認（実機でしか判断できない）: iPhone Safari での `blur()` の見え方と負荷、DPR 3 でのにじみ、CUT、四角パン、焼きすぎ。
