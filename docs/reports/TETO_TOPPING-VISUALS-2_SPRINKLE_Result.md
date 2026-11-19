# Topping Visuals 2.0 / #825 — parmigiano SPRINKLE Pilot（Result Report）

> **更新あり**: 描画（片数・形・箱 60px・寄せの上限 18 単位・E2E の範囲）は rev. 3 で置き換わった。現行の仕様は [`TETO_TOPPING-VISUALS-2_SPRINKLE-V3_Result.md`](TETO_TOPPING-VISUALS-2_SPRINKLE-V3_Result.md)（9〜11 片・箱 96px・寄せ 40 単位・外周タップの E2E 追加）。本書は ddc2413 時点の記録として残す。

状態: **実装済み・ローカル検証済み・Draft/HOLD。** merge・Production ON・共有 Preview 更新は未承認。実機 iPhone HV は Owner。
基準 main `6954a874b3464f2c0bb0a7c56820aa58436cd442`。**`Depends-on: #874`**（`placedVisuals/` が main に無いため #874 の head `8dfb99ea` の上に重ねる。#874 が先に merge されたら base を main に付け替える）。
根拠: Owner 判断 [#825 comment 6994235351](https://github.com/perusonao/teto-pizza-game/issues/825#issuecomment-6994235351)（PLACE → SPRINKLE、タップ基本、輪状・同一スタンプを避ける、ゲームルールの無断変更禁止）、[#476 の決定](https://github.com/perusonao/teto-pizza-game/issues/476#issuecomment-6110360145)（座標・最小距離 9%・採点・保存・在庫は不変）、claim [#825 comment 6994513148](https://github.com/perusonao/teto-pizza-game/issues/825#issuecomment-6994513148)。

## 1. Fresh Audit（読み取り、実装前）

### 1.1 既存の配置契約（コードで確認）
| 項目 | 現状（`gameReducer.ts` `PLACE_TOPPING`、`pizzaState.ts`） | SPRINKLE での扱い |
|---|---|---|
| 1 タップ | `PLACE_TOPPING` 1 回 = `pizza.toppings` に 1 件（`{id, ingredientId, x, y}`、FINISH では `stage`、squeeze は `trail`） | **不変**（1 タップ = 1 件） |
| 数え方・採点 | 件数で recipe の `minCount`・Reference Pieces を評価 | **不変** |
| 在庫 | 配置時は `canPlaceIngredient` の判定のみ（消費は `CONFIRM_BAKE`、1 件 = 1 単位） | **不変** |
| UNDO | `UNDO_LAST_PLACEMENT` が直近 1 件を削除 | **不変** |
| 最小距離 | `MIN_TOPPING_DISTANCE = 9`（%）、`findOpenSpot` が螺旋で押し出し／`rejected` | **不変**（#476 D4） |
| 保存 | 配置途中のピザは `pendingRound.ts`（`journalPizza`／`pizzaFromJournal`）が `{id, ingredientId, x, y, stage?}` として保存・復元する（`persistence.ts` の同一 setItem）。形式・座標の意味は変えない | **不変**（id が保たれるので、復元したピザは同じ散布を再描画する。既存の配置途中のピザも新しい描画になるだけ） |
| 描画の識別子 | `PizzaStage` が各ピースを `<span data-topping-id left top>` で描く。CUT の半分も同じ `data-topping-id` | 散布の種（seed）に利用（種は id のみ。`left`/`top` は外周の寄せにだけ使う） |
| 操作案内・配置回数 | 変更なし | 変更なし |

### 1.2 選んだ設計と、選ばなかった案
- **採用（A: 描画のみ）**: 1 件のトッピングを、その id を種にした**ピースごとに異なる広範囲の散布**（薄い削り片 10〜14 片 + 欠片 3〜5）として描く。上の契約は全て不変なので、**ゲームルールの変更は 0**。Owner の「1 タップで周辺の広めの範囲に複数の薄い削り片を不規則に散らす」は見た目として満たす。
- **不採用（B: 1 タップで複数件を置く）**: 件数・在庫消費・採点（`minCount`・Reference Pieces）・UNDO の単位・配置回数が全て変わる**ルール変更**。#825 の「ゲームルールの無断変更禁止」に該当するため、Owner の決定表扱い（§6）。
- **不採用（C: `PizzaStage.tsx` に seed を渡す）**: ホットファイルで、#738 が同じ呼び出し箇所を編集中。代わりに散布コンポーネントがステージの `[data-topping-id]` ラッパーから id と位置（`left`/`top`）を**読む**（`PizzaStage.tsx`・`App.css`・`ingredients.ts` は未編集）。

### 1.3 競合・claim
live claim（#780 の 69 コメント機械抽出で 8 件、ほか #866・#417・#749・#824・#476・#825）に予定ファイルと重なるものなし。open PR で `placedVisuals/`・`IngredientPieceVisual` を触るのは #874 のみ（土台）。T26（#866）は `IngredientGlyph.tsx`・`ingredients.ts`・`stagedGlyphs/**` が対象で重ならない。**Owner Gate スクリプトは手動監査での代替（スクリプトの判定ではない）**。

## 2. 実装
| ファイル | 内容 |
|---|---|
| `placedVisuals/sprinkleLayout.ts`（新規、純関数） | `sprinkleLayout(id)`: FNV-1a + mulberry32 の決定的な乱数で、円盤内に一様（輪ではない）・最小間隔 6.2 の 10〜14 片、長さ 6〜15、全厚 ≤ 長さの 0.34、向き ±90°、塗り 3 種、欠片 3〜5。`sprinkleShift(x%, y%)`: 外周付近のタップで散布の場を中心側へ最大 18 単位寄せ、ピザの外にはみ出さない（ピースの座標そのものは動かさない） |
| `placedVisuals/ParmigianoSprinkle.tsx`（新規） | `[data-topping-id]` から id・位置を 1 度だけ読み（`useLayoutEffect`）、`sprinkleLayout`／`sprinkleShift` で描く。ステージ外は固定の 1 レイアウト |
| `placedVisuals/ParmigianoShavings.tsx`・`parmigianoShavingsData.ts` | 描画部品を共有（`shavings`／`chips`／`shift`／`groundShadow` を受ける）。小さな削り片は輪郭・ハイライトを細く。既定（固定 6 片）は #874 と同じ |
| `placedVisuals/registry.ts` | parmigiano → `ParmigianoSprinkle`、箱の大きさ 60px（`placedBoxPx`） |
| `IngredientPieceVisual.tsx` | placed かつ登録ありのとき `--cheese-glyph-size: 60px` を wrapper に設定（selection・他のチーズは既定のまま） |
| テスト | `sprinkleLayout.test.ts`、`ParmigianoSprinkle.test.tsx`、`gameReducer.sprinkleContract.test.ts`（契約）、`IngredientPieceVisual.test.tsx`・`IngredientPieceVisual.architecture.test.ts`（追加・svg 属性の検査対象を `<svg` を描くファイルに限定）、`e2e/topping-visuals-parmigiano.spec.ts`（書き換え） |

**変更していない**: `PizzaStage.tsx`・`App.css`・`ingredients.ts`・`recipes.ts`・採点・保存・在庫・UNDO・Fry・他食材・`surface` の呼び出し 5 件（選択アイコン・Reference・Dex は不変）。

## 3. テスト（ローカル）
| 区分 | 結果 |
|---|---|
| `tsc -b`／`oxlint`（変更ファイル） | エラー・警告なし |
| focused（placedVisuals・`IngredientPieceVisual`・architecture・`PizzaVisualPieces`・`IngredientGlyph`・fry architecture・契約テスト） | 全通過（件数は PR コメント参照） |
| E2E（Chromium、390×844・360×800） | `topping-visuals-parmigiano` 通過: 3 タップで 3 件（1 タップ = 1 件）、各ピース 8 片以上、3 つの散布が全て異なる、箱が 40px 以上、chip は CSS の板のまま、UNDO で 1 件戻り再配置できる、3 タップ位置（外周ではない）で削り片の中心がステージの円の内側、焼成後 RESULT でも配置直後と同一の 3 つの散布（markup 一致） |
| 契約テスト（`gameReducer.sprinkleContract.test.ts`） | 1 タップ = 4 フィールドの 1 件、在庫 2 で 3 タップ目は拒否（1 タップ = 在庫 1 単位）、最小距離 9 は不変（重なりは押し出し）、UNDO は直近 1 件のみ・在庫は焼成まで不変 |
| 全 Vitest・CI・WebKit | PR #（本 PR）のコメントに記録 |

## 4. 見た目（同倍率の before / after）
`docs/reports/screenshots/topping-visuals-2/sprinkle/`（Chromium、DPR 2。左 = 8dfb99e／右 = 散布。Owner が置いた 3 か所と外周 4 か所、配置直後・焼成後 RESULT、390×844・360×800）。
- **所見**: 8dfb99e は 3 か所が同じ輪状の小さな模様。散布版は、3 か所それぞれが**広い範囲に不規則に散らばった薄い削り片**で、輪状・同一スタンプではない。焼成後の RESULT でも消えず、同じ散り方が保たれる。外周タップ（上・右・左上・下）でも散布はピザの内側に収まる。
- **正直な課題**: 実寸では削り片が細く小さく、**米粒のように見える可能性**がある。焼成後はモッツァレラの溶けた白い塊の近くで淡く、コントラストが下がる。「薄い削りチーズを散らしたように見えるか」は **Owner の実機 iPhone Safari HV の判断**（Chromium の画像は代用にならない）。調整の余地: 削り片の太さ・色の濃さ・散布の広さ・片数（いずれも描画のみ）。

## 5. 制約・既知の限界
- **はみ出しは完全には防げない（独立レビュー P2）**: 外周（距離 48%）のタップでは寄せの上限 18 単位（約 5.6%）のため、最遠の削り片の先端が円を最大 約 4% 超える（≒ 数 px、クラスト側）。寄せは回転（wrapper −18° ＋ ピース回転 ±14°）後の座標系で効くため、内向き成分が最大で約 0.85 に減る。ステージ寸法 300px 前提の換算。E2E の円内チェックは外周タップを含まない。調整案（寄せ上限の拡大・回転の打ち消し・外周タップの E2E）は HV 後の S3 に含める。
- 散布は描画のみで、ピースの座標は変えない。外周では場を中心側へ寄せる（最大 18 単位）ため、見た目の中心はタップ位置からわずかにずれうる。正方形パンの角（円の外側）では寄せの上限で一部はみ出す可能性がある（今回の対象はまず丸ピザ。四角パンでの確認は未実施）。
- `PizzaStage` のラッパー構造（`data-topping-id`・`left`/`top`）に依存する。構造が変わったときは固定の 1 レイアウトにフォールバックする（描画は壊れない）。
- Reference・Dex・選択アイコンは従来の板のまま（`surface="selection"`、#874 のテストで固定）。散布を Reference に反映するかは別判断。
- 未撮影・未確認: 焼きすぎ、CUT、WebKit、実機、四角パン。

## 6. Owner 判断が要る点（推奨つき）
| ID | 論点 | 推奨 |
|---|---|---|
| S1 | 1 タップで複数件を置く（案 B）。件数・在庫・採点・UNDO が変わる | 採用しない（今回の描画のみで HV）。必要なら別 Gate で決定表 |
| S2 | 散布を Reference 見本にも反映するか | 反映しない（golden 不変）。別 Gate |
| S3 | 削り片の太さ・色・片数・広さ（HV 後に調整） | HV の結果で決める |
| S4 | 他のチーズ・粉もの（paprika-powder 等）への横展開 | #825 の台帳で別 PR |

## 7. 次のプロンプト往復の見積り
- 本 PR の仕上げ（CI・WebKit・独立レビュー・PR 専用 Preview）: **約 2〜3 往復**。
- Owner の iPhone HV 後の見た目調整（S3）と再 Preview: **約 2〜4 往復**。
- 案 B（1 タップ複数件）を採る場合: 決定表 1 往復 + 契約テストの再設計と実装 **約 5〜8 往復**。
