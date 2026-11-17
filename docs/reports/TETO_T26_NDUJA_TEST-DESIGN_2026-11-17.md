# T26 / Batch 26 — nduja の配置とテスト設計、競合の再検査（docs-only・設計のみ）

日付: 2026-11-17 · Issue #866 (Refs #780) · 基準 main `a5583622292ff6203b8c979f4c410389dbc05d15`
性質: 設計と測定の記録。実装・apply・claim 取得（T26 本体）・merge・Production ON・共有 Preview 更新はしない。
本書は実装許可でも merge 許可でもない。

## 1. 前提（Owner 判断の記録、再質問しない）

| 判断 | 内容 | 出どころ |
|---|---|---|
| D-T26-NDUJA-PLACEMENT | `nduja` は柔らかいペースト状の肉トッピング。**小さな別々のかたまり（dollop）を生地に散らす**。連続した全面スプレッド操作ではない。在庫単位 `use` は変えない | #866 Owner decision lock 2026-11-17 |
| D-T26-CLAIMS | #815 HOT・R-1・T-FX は**各保有者本人**の release を待つ。第三者は変更・短縮・削除・奪取しない。merge 済み／期限間近は release の証明にならない | 同上 |
| T26 構成 | nashville: chicken 2 / honey 1 / mozzarella 3 / pickles 2（`ladderCredit:false`、`ladderStep:null`）。nduja-pizza: honey 1 / mozzarella 3 / nduja 2。nduja は新規 topping / meat、通常 ladder key、Shop pack 20。pickles pack 10→20 | Owner Follow-up 2026-11-10 |

`ingredient_master_catalog.json` の `placementType: spread` は設計スナップショットで、上の判断により実装では `scatter` にする（`mayo` が同じ形で「台帳は spread、実装は別」と `catalogShelf.test.ts` に固定されている前例がある）。

## 2. 競合の再検査（2026-11-17、Train Kit `claims` と同じ規則）

編集予定は `plan` の claim-files（apply 12 ファイル編集＋4 生成＋追従テスト 62＝計 78 パス）。#780 / #795 の claim ブロックを機械抽出して照合した。

| claim | 保有 | 期限 | release 記録 | 重なり |
|---|---|---|---|---|
| #815 B23-b HOT | `…P6p2E3` | 2026-11-18 | **なし**（#780・#866・#815 の全コメントを確認） | HOT。`src/data/*` 等 39+ |
| R-1 | `…25Zvtn` | 2026-11-26 | **なし** | `src/trainKit/landed/t26.json`、`catalogLedger.test.ts`、`expansionBatch*.test.ts` ほか 10+ |
| T-FX | `…8LF145` | 2026-11-21 | **なし** | `src/data/staged/**` 7+ |
| #834 MID_BAKE Lab（#795 c2） | `…3VFaBPeRU1CP45Cae:c2` | 2026-11-19 | 解除なし（#834 の merge/close まで保持） | `src/preview/previewIsolation.gate.test.ts`。#866 `6923575924` で意味的・機械的に競合なしと保有者が回答済み。両方の追加行を保持 |

結論: **4 件とも未解除**。`claims` の結果は conflicts 4。78 パスのうち 50 が blocked、28 が claim と重ならない（ただしそれらは `apply` が同時に生成・追従するファイルで、apply は不可分なので一部だけ先に適用できない）。T26 本体の編集は開始しない。

## 3. 競合に触れない準備（実施済み／可能）

| 項目 | 状態 |
|---|---|
| 承認スペックの再 preflight | STOP 0 / 正準 0 / 非正準 11（承認表 9 ID＋T24 追補 2 ID に完全一致、表外 0）。Research letters の最大ずれは `pesto-noci-pizza` の +2 |
| scaffold → `apply --dry-run` → `plan`（scratch のみ、repo 無変更） | 成功（12 edited + 4 generated、HV シナリオ 1）。TODO の著作値は仮置きで検証 |
| 仮置きした著作値（**PROVISIONAL、Owner の確認が要る**） | nduja: `emoji` 🧨（text fallback。`🟥` は pomegranate と重複で G18 により不可）、`color #b3321f`、`sizeClass s`、family `meat`。説明文・注文セリフは Anti-Oracle（数量・タイミング・手順なし）。`sauceProfile` は scaffold が導出した honey / PAINT（両レシピで honey が唯一のソース。pesto-noci の honey＝焼成前の第 2 ソース層という前例どおりか Owner に確認） |
| 専用 SVG（`nduja-dollops`）の置き場 | `src/components/stagedGlyphs/**` は現在どの claim とも重ならない。ただし絵そのものは Owner/HV の判断領域なので本書では作らない |

## 4. nduja のテスト設計（実装 PR で書くもの。値は承認スペックから導く）

| # | 観点 | 検証内容 | 置き場（claim 状態） |
|---|---|---|---|
| N1 | 配置の種別 | `placement: "scatter"`（`spread` ではない）。`isSqueezeIngredientId("nduja") === false`（mayo の stroke 操作に載せない）。マスター台帳の `spread` との差を `catalogShelf.test.ts` に固定（mayo と同形） | ingredients.ts は HOT 保有中。テストは `catalogShelf.test.ts`（claim なし） |
| N2 | 選択アイコン vs ピザ上の見た目 | トレイ chip の絵と、置いた後の `pieceVisual` が同じ専用 SVG 系列（`nduja-dollops`）を使い、emoji は表示されない（`IngredientGlyph` が `.emoji` を読む唯一の場所という既存 Gate を保つ）。絵文字 🧨 は text fallback のみ | `StagedGlyphs.test.tsx`（現在 claim なし）／`IngredientGlyph.test.tsx`（B23-b HOT 保有中） |
| N3 | 小さな別々のかたまり | 1 回のタップ = 1 ピース。1 ピースは決定的な小さなかたまりとして描かれ、同じピース ID なら毎回同じ見た目。2 ピース置くと 2 か所に離れて描かれ、全面を塗る連続形状にならない | `PizzaVisualPieces` 系のレンダラ検査（`PizzaVisualPieces.tsx` は claim なし） |
| N4 | 数え方・消費 | 1 ピース = `use` 1。在庫はちょうど 1 減る（二重消費なし）。在庫 0 は置けない。単位 `use` が変わらない。スコアはピースのアンカー（x/y）だけを読む | 既存の reducer／scoring テストは変更しない。nduja 専用の新規テストを `src/logic/nduja/**`（新規・claim なし）に置く案もあるが、Owner の確認後 |
| N5 | レシピ判定 | nduja-pizza: nduja 2 / mozzarella 3 / honey 1 で ORIGINAL 判定。nduja を sausage に替えたら別レシピ扱い（重複 Gate 0 を維持）。nashville は nduja を使わない | `recipes.test.ts`／`referencePizza.test.ts`（追従） |
| N6 | 保存・図鑑 | `schemaVersion` 2 のまま。nduja を知るビルドは所持・在庫を保持し読み込みで書き込まない。知らない旧ビルドは nduja だけ落とし他を保持（既知の制約 #668）。Dex／ladder の key step が 1 つ増える（`nduja-pizza` が key。nashville は key にならない） | 既存の persistence／discoveryLadder 系テスト（追従） |
| N7 | Research／Hint | 正準 0。非正準 11 ID は承認表に完全一致（表外は STOP）。Hint 5.0: nashville = SAUCE→CHEESE→STRUCTURE→SUB_CLASS×2、nduja-pizza = SAUCE→CHEESE→STRUCTURE→SUB_CLASS。nduja は meat（`other` でない） | `expansionBatch*.test.ts`（R-1 保有中）、golden（追従） |
| N8 | Shop | nduja の pack 20（k=2）。pickles pack 10→20 は `APPROVED_PACK_CHANGES` に承認記録として追加（導出しない） | `materialShop.test.ts`（追従、`LANDED_SHOP_CONTRACT` は手書き） |
| N9 | 追従の固定 | `expansionBatch18.test.ts:213`（nashville／nduja は未出荷、の固定）を Owner 判断 26-2・C-3 を根拠に更新。Gate の緩和ではない | R-1 保有中 |
| N10 | HV | 生成される HV seed `t26HvSeeds.ts` と `e2e/t26.spec.ts`。390×844 の iPhone Safari HV 動画（Owner に直接）と before/after スクショ（`docs/reports/screenshots/t26/`）。ピザ上に小さな別々のかたまりが見えること、トレイの絵との整合を確認項目に入れる | `t26HvSeeds*`・`e2e/t26.spec.ts`・screenshots は claim なし |

## 5. 実数（確認済み main `a5583622`、算術ではなく実カタログ）

| ライン | 実装済み | 目標 | 残 | T26 着地後（予定、未実装） |
|---|---:|---:|---:|---:|
| レシピ | 116 | 177 | 61 | 118 |
| 食材 | 137 | 170 | 33 | 138（nduja） |
| 調理法・工程 | 7 IMPLEMENTED | 27 | 20 未完了 | 7（不変） |

工程は #867 の最新分類（IMPLEMENTED 7 / PARTIAL 10 / UNIMPLEMENTED 1 / HOLD 1 / ADOPTION_UNDECIDED 6 / DUPLICATE 2）が正本（台帳 CSV は 7/7/4/1/6/2 のまま古い）。**予定の増分を実装済みに数えない。**

## 6. 次の作業

1. 各保有者本人の release（または期限の自然失効＋Session Operations に従う確認）→ 最新 main で `CLAUDE.md`・`PROJECT_HANDOFF.md`・preflight・`claims` を再実行し、STOP 0・重なり 0 を証明。
2. 重なり 0 で初めて T26 の claim を取得 → 著作値（絵・色・説明・注文セリフ・honey の sauceProfile）の Owner 確認 → `apply` → `sweep` → テスト → E2E → Draft PR。
3. それまでの待ち時間は、claim の無い範囲（本書、N2/N3 のレンダラ設計、HV の確認項目、工程ライン #867/#841/#860）で進める。
