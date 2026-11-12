# TETO Train Kit R-1 — 既存テストの固定値を「凍結基準＋承認済みスペック」から導出する Result（#780）

2026-11-12 / ブランチ `claude/train-kit-r1-derived-expectations-780`（main `6df4748`＝#823 の Squash merge 後の上）。#823（Train Kit 本体）は merge 済みで、本 PR は R-1 固有の差分だけ。
Owner の条件付き実装 GO（2026-11-12）に基づく第 1 弾。claim: #780 のコメント 6823639362。

凡例: 【実測】この環境で測った値、【推論】実測からの解釈。

**本書は実装承認・merge 承認ではない。** merge・Production ON・共有 Preview 更新はしていない。既存 Gate の意味・検証範囲・独立性は維持し、テストの skip・timeout 延長・アサーションの緩和はしていない。

---

## 1. 何を直したか

列車が着地するたびに、次の種類の既存テストが機械的に落ち、人が数字を書き換えていた【実測: #823 の T24 試験で 37 ファイル／95 件、過去 4 バッチで 33〜55 ファイル／回】。

| 種類 | 例 | 以前 | 今回 |
|---|---|---|---|
| 総数 | 台帳（recipes / credited / ingredients / toppings / ladder steps / chapter sizes / Lunch Rush pool / 棚の分布） | 手書きの数字ブロック | 合成した期待値と完全一致 |
| late の step 番号 | `stepOf(salmon-roe) == 75`、`late.map(step) == [75…89]` | 手書き（ordinary を足すたび +1） | `COMPOSED.stepOfMaterial / lateSteps` |
| 床値 | `LATE_ENTITLEMENT_FLOORS` の全体一致（9 か所に同じ 32 項目） | 手書きのコピー | `COMPOSED.floors` |
| 末尾からの位置 | `steps.at(-9)`、`slice(-8, -2)` | 末尾基準（列車が増えるとずれる） | キー recipe で検索＋合成した番号。先頭基準の凍結位置（`indexOf(step) == 69`）は定数のまま |
| 総数の重複 | `toHaveLength(74)` が 8 ファイル | 手書き | 合成した長さ |
| ショップ行 | `EXPECTED_OFFERS` の late 行と、着地済み食材の行 | 手書き（step 番号は late なので毎回ずれる） | late 行の step は合成、着地済み食材の行は着地済みスペックから生成 |

## 2. 設計 — なぜ回帰検出能力が落ちないか

```
期待値  =  凍結基準  ⊕  着地済みスペック   ──完全一致で比較──▶  実カタログ（実装）
```

- **凍結基準** `src/logic/catalog/testSupport/frozenBaseline.json`: B23 直前（`577dcfd~1`）の出荷済みカタログを `node tools/train-kit/cli.mjs freeze` で**一度だけ**記録した履歴（101 レシピ・116 食材・ordinary 73＋late 13 step・床値 27・チャプター [6,12,19,64]・Lunch Rush プール 25）。現在のビルドの測定ではない。
- **着地済みスペック** `src/trainKit/landed/*.json`: Owner が承認した記述（`apply` が書く）。`seq` で着地順、`floors` に着地時の床値を持つ。
- 期待値の合成（`composedCatalog.ts`）は**カタログのモジュールを import しない**（`src/` を走査する既存 Gate の対象外であり、「実装から逆算」が構造上できない）。
- 比較は**完全一致**。レシピ・食材・family・ladder の並びと番号・床値・チャプター・プールのどれかが実装と記録でずれれば、`catalogComposition.test.ts`（新設、唯一の突き合わせ箇所）か歴史的テストが落ちる。手書きの数字と検出力は同じで、消えるのは列車ごとの全ファイル編集だけ。
- **導出しないもの（意図的）**: Research の非正準差分の ID 別承認、重複 Gate の例外（OD-B18-3 など）、既存食材のパック変更（`EXPECTED_OFFERS` の k）。これらは**Owner の承認そのものが内容**であり、実装から逆算すると承認が要らなくなる。列車の PR で手で書く記録として残る（§4）。
- 信頼の前提: 凍結基準が誤っていれば誤りが凍結される（従来の手書き数字と同じ）。`freeze` を再実行すれば JSON の差分がレビューに出る。着地済みスペックが Owner の承認パケットと一致するかは、列車の PR（承認スペック → `scaffold` → 実装スペック）で確認する。

## 3. 変更ファイル

新規: `src/logic/catalog/testSupport/{composedCatalog.ts, composedForBuild.ts, composedCatalog.test.ts, frozenBaseline.json}`、`src/logic/catalog/catalogComposition.test.ts`、`tools/train-kit/{freeze.mjs, mutation.mjs, mutations.json}`、本書、`docs/reports/data/TETO_TRAIN-KIT-R1/**`。
変更（#823 の名前空間）: `tools/train-kit/{cli.mjs, README.md, lib/{implSpec,extract}.ts}`、`src/trainKit/{trainKit.run.test.ts, trainContract.test.ts, landed/*.json}`（`seq`・`chapter`・`freeze` 用の dump 項目）。
変更（既存テスト 17 本、**表明の種類は変えず、固定値の出どころだけを合成に**）: `src/data/catalogLedger.test.ts`、`src/data/expansionBatch{11.s1,12b,13,14,16,17,18,19,20,21,22}.test.ts`、`src/data/lateCatalog.{bbq,late4}.test.ts`、`src/state/materialEntitlement.{batch6,lateFloor}.test.ts`、`src/logic/materialShop.test.ts`。
**カタログ・HOT・golden・`src/data/staged/**`・workflow・タイムアウト値は変更していない。**

## 4. 検証【実測】

### 4.1 変異テスト（回帰検出能力の証明）
`node tools/train-kit/cli.mjs mutation`: カタログの実ソースに 20 種類の現実的な回帰（ladder の入れ替え・削除・材料変更、床値の変更・削除・追加、family・サイズ・分類の変更、レシピの数量・クレジット変更、未承認食材の追加 など、`tools/train-kit/mutations.json`）を 1 つずつ加え、**同じ変異**を ① 旧テスト（main）と ② 新テスト（R-1）の 2 つの作業コピーで、変換した 17 ファイル（新は＋`catalogComposition.test.ts`・`composedCatalog.test.ts`）に対して実行。無変異の対照は両方成功。

| | 検出 |
|---|---|
| 旧テスト（手書き） | **17 / 20** |
| 新テスト（合成） | **18 / 20** |
| 旧が検出し新が見逃した | **0** |
| 新だけが検出 | 1（M20: 着地済み late step の材料の並び替え） |
| 新旧とも見逃し | 2（M11: 食材のサイズ分類、M13: NO_SAUCE レシピへのソース追加。変換対象外のテストが担当する領域で、対象 17 ファイルの検出範囲を変えていない） |

証跡: `docs/reports/data/TETO_TRAIN-KIT-R1/mutation.result.json`（各変異の検出ファイル・失敗メッセージ・終了コード）。
**ハーネスの信頼性**: 最初の実行は旧・新を並行して走らせ、負荷によるタイムアウトを検出と数えたため結果が不安定だった（M11・M13 が「検出」と出た）。単体で再現して原因を確認し、(1) 旧・新を直列に実行、(2) タイムアウトのみの失敗は検出と数えず 1 回やり直す、(3) 終了コードが非 0 でタイムアウトのみでなければ検出とする、に直して再実行した。上の表は直列版の結果。

### 4.2 未出荷の列車での試験（T24: 7 品・食材 9 種、使い捨てワークツリー）
- 変換した 18 ファイルの失敗: **88 件（17 ファイル）→ 13 件（7 ファイル）**。残りはすべて Owner の承認記録: Research の ID 別承認（batch 18・19・20・21・22）、重複 Gate の例外（batch 18）、既存食材のパック変更（mussel の k、batch 11.s1 と `materialShop`）。
- `catalogComposition.test.ts`・`catalogLedger.test.ts`・`materialEntitlement.*`・`lateCatalog.*`・batch 12b・13・14・16・17 は**編集なしで合格**。
- 追従スイープ全体（`sweep --min 2`）: TEST 37 ファイル／95 件 → **26 ファイル／38 件**（うち staged 4 ファイルは T-FX の領域）。TYPE 1・GOLDEN 8 は不変。証跡: `docs/reports/data/TETO_TRAIN-KIT-R1/t24-trial-after-r1.sweep.txt`。

### 4.3 通常の検証
- `tsc -b` 0 エラー、oxlint 指摘 0（既存の警告 2 件のみ）。
- 変換した 18 ファイル: 594 件合格（Pinsa あり）。`TETO_PINSA_OFF=1` では 593 件合格・1 件失敗。**この 1 件（`expansionBatch22.test.ts` の Research 35 ID）は R-1 なしの #823 の HEAD でも同じように失敗する既存の事象**で、今回の変更とは無関係（未修正・報告のみ）。
- 新規 `catalogComposition.test.ts`（Pinsa あり・なしの両方で合格）、`composedCatalog.test.ts`（合成の算術を合成データで検証、4 件）、kit の node テスト（mutation の適用規則）。
- 全 Vitest: 本 PR の本文に結果を記載。

## 5. 残作業（第 2 弾）と効果の見積もり

| 内容 | 件数 | 備考 |
|---|---|---|
| 件数・集合・表の追従（`recipes.test`、`lunchRush.exclusion`、`progression`、`catalogShelf`、`largeCatalogFixtures`、`referencePizza.test`、`hint5Ladder.baseCompat`、`cookingProfiles`、`researchLabels.batch8a`、`matcher` ほか） | 約 15 ファイル | 同じ合成（集合・分布・件数）で導出できる見込み。件数系は `COMPOSED.byShelf` などを使える。母集団依存のもの（hint5 の件数）は別の導出が要る |
| `discoveryLadder.test.ts` の橋渡し許可リスト | 1 | 列車の HV シード 1 ファイルを許可リストに足す行。`apply` の配線に入れられる（Gate の許可リストの意味は不変） |
| golden 8、`deductionGuard` の測定値 | 9 | 生成物。再生成の手順は README |
| Research の承認表・重複例外・パック変更 | 7（第 1 弾の対象内） | 導出しない（§2）。`plan` の検証パケットから ID 別承認表を転記する支援は可能 |
| staged（T-FX の領域） | 4 | T-FX の claim 解除後 |

【推論】第 2 弾までで、1 列車あたりの手作業は「承認記録の転記（Research・重複・パック）と golden の再生成」に絞られる見込み。

## 6. Result Report（四項目）
- **完了**: 凍結基準・合成・突き合わせテスト、既存テスト 17 本の変換、変異テスト 20 件（旧 17／新 18、喪失 0）、T24 試験（88→13）、README・ハーネスの単体テスト。
- **未完了**: 第 2 弾（§5）。Codex レビュー。独立レビュー（別コンテキスト・読み取り専用、Codex ではない）は `NO BLOCKING ISSUES`（指摘 4 件はすべて非ブロッキング。うち「着地済み step の star gate を見ていない」は `catalogComposition.test.ts` を直して反映）。
- **ブロッカー**: Owner の merge 判断（Final Gate 後）。
- **次の行動**: Draft PR で CI・独立レビュー・Codex を実施し、Owner の判断を待つ。
