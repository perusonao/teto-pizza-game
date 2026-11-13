# Expansion Batch 24 (T24-R1) — Result Report

- 日付: 2026-11-13 / Issue: #780 / branch: `claude/t24-implementation-780`（Draft PR、merge は Owner 承認待ち）
- 基準: main `9b91c6d`（#846 merge 後。カタログは B23-b 後と同一: レシピ 104／食材 122）
- 仕様: Owner 承認済みパケット `docs/reports/data/TETO_T24-T26_PREP/T24-R1.{spec,preflight}.md`（2026-11-10 の判断と 2026-11-13 の確認）。**承認の範囲を超える変更はしていない**（下記 §6）
- 暫定仕様: 原典 pizzadb.jp は未確認。仕様値は GAMEPLAY ASSUMPTION（既存バッチと同じ扱い）

## 1. 追加したもの

| | 内容 |
|---|---|
| レシピ 6（通常） | `diavola-pizza`、`frutti-di-mare`（staged 名 `frutti-di-mare-pizzadb` から出荷前に改名、Owner 承認）、`peruvian-aji-amarillo`、`south-african-boerewors`、`thai-chicken-pizza`、`peking-duck-pizza` |
| 食材 8 | ソース: `aji-amarillo`、`chutney`、`peanut-sauce`、`sweet-bean-sauce`／具材: `cucumber`（野菜 s）、`peking-duck`（肉 m）、`spicy-salami`（肉 m）、`squid`（魚介 s） |
| ladder | 通常 step 75〜80 を追加（導出順: 75 spicy-salami→diavola、76 squid→frutti-di-mare、77 aji-amarillo→peruvian、78 chutney→boerewors、79 peanut-sauce→thai、80 cucumber＋peking-duck＋sweet-bean-sauce→peking-duck）。**星ゲートなし**。late の step は +6（89→95）、late の floor は不変 |
| ショップ | 新食材は ladder 解放で購入可能（T4: 初回 120／補充 60 Pitz）。`mussel` のパック 10→20（価格不変、Owner 承認済み） |
| その他の生成物 | HV シード `?hv=t24-*`（Preview 限定）、E2E `e2e/t24.spec.ts`、着地スペック `src/trainKit/landed/t24.json`、承認記録テスト `src/data/expansionBatch24.test.ts` |

## 2. 件数・残数・進捗率

| ライン | 着地前 | 今回 | 現在 | 目標 | 残り | 進捗率 |
|---|---:|---:|---:|---:|---:|---:|
| レシピ | 104 | +6 | **110** | 177 | 67 | 62.1% |
| 食材 | 122 | +8 | **130** | 170 | 40（staged 39＋nduja 予約 1） | 76.5% |
| 調理法・工程 | 7（実装済み） | 0 | 7 | 27 | 20 | 25.9% |

staged の件数は 73→67 レシピ、47→39 食材（`nduja` は staged に追加していない）。台帳の再生成は別の docs PR（§9）。

## 3. 検証【実測】

| 検証 | 結果 |
|---|---|
| `tsc -b` | 0 エラー |
| `oxlint` | 新規の指摘なし（既存の warning のみ） |
| 全 Vitest（ローカル、最終版） | RESULT_VITEST |
| E2E（Chromium、`e2e/t24.spec.ts`、390×844＋360×800） | **12/12 合格**（6 レシピ × 2 プロファイル。Shop NEW → 購入 → 図鑑の Research 入口（漏れなし）→ ソース → Reference の位置に具材 → 焼き → 新発見 → 図鑑） |
| iPhone Safari 実機 HV | **未実施**（PR 専用ページの公開は Owner の指示後） |
| CI（PR） | RESULT_CI |
| 独立レビュー（別コンテキスト・読み取り専用、Codex ではない） | RESULT_REVIEW |
| スクリーンショット | `docs/reports/screenshots/t24/`（111 枚、390×844・360×800）。動画は Owner へ直接（リポジトリには入れない、HV Policy） |

ローカルの E2E は、サンドボックスの Chromium（`/opt/pw-browsers`）を使う**未コミットのローカル設定**で実行した（リポジトリの `playwright.config.ts` は変更していない）。

## 4. 既存テストの追従（sweep の TYPE／TEST／GOLDEN）

`sweep` の追従リストは TYPE 1／TEST 25 ファイル／GOLDEN 8。すべて「承認済みスペックから導ける値」への更新か、手書きの承認記録で、**期待値を実装に合わせて緩めたものはない**（skip・timeout 延長・アサーションの緩和なし）。

- 件数・集合: `recipes.test`、`lunchRush.exclusion`、`progression`、`referencePizza.test`（ソース 4 種）、`catalogShelf`／`largeCatalogFixtures`（sauce 19→23）、`hint5Ladder.baseCompat`（key-free 79→85: sauce＋cheese 45、sauce のみ 12）、`researchLabels.batch8a`（credited 83、通常 step 80、通常レシピ 94）、`selectableHint`（diavola は 3 ingredient の 3 段階）、`cookingProfiles`（steps 表・CUT なし）、`discoveryCatalog`（172 行由来で Phase-2 に行が無い 6 件）
- ladder: 凍結 1〜74 を維持し、新しい 75〜80 だけを REC-04 規則で導出（`discoveryLadder.test`／`appendOnly`）。**authored の並びが導出順と食い違ったため、スペックのレシピ順を導出順にして `apply` をやり直した**
- 後続バッチの除外: B18／B20／B21／B22／B23-b の Research 前後比較は、以前のバッチと同じ方式で T24 を「後のバッチ」として除外（各バッチの承認値は不変）。着地済み manifest の `followedBy` に T24 を追記し、`B24_BATCH` を追加
- ショップ: `LANDED_SHOP_CONTRACT` に T24 の 8 行（手書き）、`mussel` は承認済みパック変更として手書き（#833 の契約表の方式）
- 後続の late step: B23／B23-b の step 番号の固定値を +6（`86/87/88/89` → `92/93/94/95`、ordinary 74→80、合計 89→95）
- staged: 出荷した 6 レシピ・8 食材を staged から外した（生成器 `TETO_FULL-EXPANSION-177_stage-gen.py.txt` の IN_FLIGHT／RESERVED に追記し再生成、73→67／47→39）。golden は各 suite の更新手段で再生成
- golden: Hint 5.0 ladder `hint5.ladders55.json` は**挿入のみ**（削除 0、+1,269 行）。`alphaFamilyOnly` は新 6 品の追加と、family の増加による**既存の導出値の変化**（ikura-salmon、eggplant-dengaku、wasabi-beef、tarako-cream、taco、okonomiyaki、pizza-finocchi-salad、pizza-cavolo-carote、pizza-radicchio-noci、black-truffle の 10 件）。DH4-1 の監査 JSON は category／family／group の件数の増加のみ

## 5. Gate の確認（承認の範囲内か）

- **Research（Owner 個別承認、パケット §4）**: 正準順の変化 **0**（テストで固定）。非正準は承認済み **43 ID**（形は ID ごと: 新しい最初の文字のみ 18／A〜B または 1 つ後ろ 22／A〜C または 2 つ後ろ 3）。測定（seed 付き 40 順序）は 42 ID で、**承認外の ID は 0**（承認は決定的な上界のため、サンプル監査が少なく見えるのは想定内）。`expansionBatch24.test.ts` が、承認表の手書き記録と、各変化の形を検査する
- **重複 Gate（D-1 の例外、パケット §3）**: 事前検査と同じ定義を手書きで再実装し、旗が立つ相手が**承認済みの相手と完全一致**であることを固定（diavola: bismarck／funghi／margherita／pepperoni／salsiccia、frutti-di-mare: pescatore、boerewors: polish-kielbasa／spanish-chorizo-pizza、thai: bbq-chicken-pizza／reina-pepiada-pizza）。グローバルな 0.4 の指針は変えていない
- **Hint 5.0**: `deductionProduction.gate`／`hint5Production.gate` の本体は不変で成功。key-free の先頭 rung は SAUCE（ソースあり）。`requiredIngredients` は「ソース → チーズ → 具材」の順（旧 H4 が伏せる材料と Rule W の予約材料が一致するための既存の規則。**scaffold はアルファベット順で出力するので、実装者が並べ替える**）
- **保存**: `schemaVersion` は 2 のまま、移行なし。新しい id の追加のみ
- **G18（絵文字の一意）**: 既存の全ゲートが成功

## 6. 実装中に Owner へ戻すべき事項（承認の外）

1. **step 79／80 の同時解禁（既知の副作用）**: B21 の late 食材の floor（cheddar／lettuce／tortilla-chips＝79、okonomiyaki-sauce／cabbage／bonito-flakes＝80）は**固定**で動かないため、新しい通常 step 79 は `thai-chicken-pizza` と `taco-pizza` を、step 80 は `peking-duck-pizza` と `okonomiyaki-style-pizza` を**同時に**解禁する（Batch 14 の step 66 と bbq-sauce と同じ種類の副作用）。承認パケットには明記がなかったため、測定値として Result に記録する。望ましくない場合は、T24 の step 順や floor の扱いを Owner が決める
2. **絵文字（暫定）**: `squid` は 🦑 を Batch 8b のテストが「却下済みの初稿の絵文字」として禁止しているため、フォールバックは 🐙。`cucumber` は 🥒 が `zucchini` で使用済みのため 🥝（**キウイに見える**。専用 SVG が出るまでの暫定で、iPhone HV で判断してほしい）。他は aji-amarillo 🟨、chutney 🥭、peanut-sauce 🥄、sweet-bean-sauce 🟪、peking-duck 🦆、spicy-salami 🍒。専用 SVG は T25/T26 の SVG ライン（別 claim）の対象で、未配線の `squid` の候補は #818
3. **色（HV で最終判断）**: 承認済みの暫定色 4 ソース（aji-amarillo `#ffe60f`、peanut-sauce `#faa078`、chutney `#876e00`、sweet-bean-sauce `#50001e`）。具材 4 種は実装 PR で決める項目で、cucumber `#7fae5a`、peking-duck `#a6542b`、spicy-salami `#b3261e`、squid `#e8dccb`
4. 説明文・注文セリフは実装者の著作（Anti-Oracle の検査に合格。数量・手順なし）

## 7. 次の依存条件

| 項目 | 条件 |
|---|---|
| Draft 解除・merge | Owner 承認。CI・独立レビュー・iPhone Safari HV（PR 専用ページの公開は Owner の指示後）の結果を見て判断 |
| T25-R2c | T24 出荷後の preflight 再測定（追補の確認）と、Owner／独立監査による HOLD 解除。`chicken-tikka-pizza` は HOLD のまま |
| T26 | T25 の後。`nduja`（170 番目）はこの列車の実装でカタログに登録 |
| 台帳 | T24 の merge 後に再生成（別 docs PR）。生成器の固定値は staged 67／39＋予約 1 になる |
| `targets.json` の notes | #833 の claim 保有者に依頼済み（私は編集していない） |
