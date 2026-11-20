# Expansion Batch 24 (T24-R1) — Result Report

- 日付: 2026-11-13 / Issue: #780 / branch: `claude/t24-implementation-780`（Draft PR、merge は Owner 承認待ち）
- 基準: main `9b91c6d`（#846 merge 後。カタログは B23-b 後と同一: レシピ 104／食材 122）
- 仕様: Owner 承認済みパケット `docs/reports/data/TETO_T24-T26_PREP/T24-R1.{spec,preflight}.md`（2026-11-10 の判断と 2026-11-13 の確認）。**承認の範囲を超える変更はしていない**（下記 §6）
- 暫定仕様: 原典 pizzadb.jp は未確認。仕様値は GAMEPLAY ASSUMPTION（既存バッチと同じ扱い）

> **この文書の読み方（2026-11-16 追記）**: **§1〜§7 は merge 前（PR #848 の Draft 中、2026-11-13 時点）の記録で、履歴として原文のまま残す。** 冒頭の「Draft PR、merge は Owner 承認待ち」「iPhone Safari 実機 HV は未実施」「CI は PR に記録」「全 Vitest の修正後の全件は未再実行」などは**当時の状態であり、現在の状態ではない**。#848 は 2026-11-14 に Owner が merge 済みで、**現在の確定結果は末尾の「§8 merge 後の確定記録」が正**。§1〜§7 の数値・設計の記述（件数、ladder、Gate、Owner に戻した事項）は merge 後も変わっていない（§8 で確認した範囲）。

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
| 全 Vitest（ローカル） | 1 回目: 13 件失敗（9 ファイル）→ 追従で解消。2 回目: 12,432 件合格・1 件失敗（Reference の並び: `requiredIngredients` を並べ替えた後に `referencePizza.ts` を再生成していなかった）→ 正しい並びで `apply` し直した結果と突き合わせ、`referencePizza.ts` のみ差し替えて解消。**修正後の全件の再実行はしていない**（修正後は、関連 105 ファイル 1,631 件が合格。全件は CI が authority） |
| E2E（Chromium、`e2e/t24.spec.ts`、390×844＋360×800） | **12/12 合格**（6 レシピ × 2 プロファイル。Shop NEW → 購入 → 図鑑の Research 入口（漏れなし）→ ソース → Reference の位置に具材 → 焼き → 新発見 → 図鑑） |
| iPhone Safari 実機 HV | **未実施**（PR 専用ページの公開は Owner の指示後） |
| CI（PR #848） | 最終 HEAD の結果を PR に記録（この報告の commit で CI が走り直すため、ここには書かない） |
| 独立レビュー（別コンテキスト・読み取り専用、Codex ではない。HEAD `864abebf`） | **NO BLOCKING ISSUES**（範囲・Gate の非緩和・承認記録・件数・floor の主張を確認。78 ファイル 1,463 件合格。E2E の 12/12 と「測定 42 ID」は再実行していない）。軽微 4 点は §6-5 に記録 |
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
5. 独立レビューの軽微指摘（対応は不要と判断、記録のみ）: ① `discoveryCatalog.test` の `BATCH24_PHASE2_NOT_IN_PHASE2_MATRIX` は B22／B23 の先例どおり、6 件の Phase-2 行との比較を飛ばす（6 件は 172 行の matrix 由来で、`matcher.test` の ownerApproved が BLOCKED 行だけを扱う）。② Research の形の検査は「ID × 形（最初の文字／A〜B または 1 つ後ろ／A〜C または 2 つ後ろ）」で、**ID ごとの stage（共有材料）までは検査しない**（承認の単位は stage を含むが、パケットの上界は決定的で、表の外の ID は検査で落ちる）。③ 具材 4 色・サイズ・絵文字は実装者の選択（上記）。④ `mussel` のパック変更は `LANDED_SHOP_CONTRACT` に行が無い既存食材なので `APPROVED_PACK_CHANGES`（空のまま）ではなく、`EXPECTED_OFFERS` の行を手書きで更新した（#833 の契約表の対象外）

## 7. 次の依存条件

| 項目 | 条件 |
|---|---|
| Draft 解除・merge | Owner 承認。CI・独立レビュー・iPhone Safari HV（PR 専用ページの公開は Owner の指示後）の結果を見て判断 |
| T25-R2c | T24 出荷後の preflight 再測定（追補の確認）と、Owner／独立監査による HOLD 解除。`chicken-tikka-pizza` は HOLD のまま |
| T26 | T25 の後。`nduja`（170 番目）はこの列車の実装でカタログに登録 |
| 台帳 | T24 の merge 後に再生成（別 docs PR）。生成器の固定値は staged 67／39＋予約 1 になる |
| `targets.json` の notes | #833 の claim 保有者に依頼済み（私は編集していない） |

## 8. merge 後の確定記録（2026-11-16 追記、docs のみ）

§1〜§7 は merge 前の履歴。以下は GitHub の実測（PR のコメント・check runs・Actions の run）と、Owner が #848・#780 に記録した結果に基づく。**私が再実行したものは無く、Owner の HV は Owner の記録の引用**。

### 8-1. merge の事実

| 項目 | 内容 |
|---|---|
| PR #848 | Owner が Squash merge（2026-11-14 16:34:06Z）。merge commit `3c5b433a8041faa3317979fe4c11418d240b6b17` |
| PR の最終 HEAD | `7551608a117ad7a074bec1665388975d41530c0f`（Owner の HV の対象と一致） |
| PR の commit | 4 件: `325f5317`（実装）、`864abebf`（main の取り込み）、`52ff050e`（本書 §1〜§7 の docs）、`7551608a`（`test(b23b): derive late steps after T24`、makiya0403）。最後の 1 件は commit の題（`derive late steps after T24`）から、§4 の B23／B23-b の late step の固定値（+6）を導出に置き換えるテストの変更と読める（**差分は精査していない**）。§4 の該当の記述はこの commit で置き換わった可能性がある |
| 関連 | #846（台帳同期、main `9b91c6d`）と #804（M7 設計、main `53a5caf`、2026-11-14 01:56Z）も Owner が merge 済み。#804 の merge は #846 の後で、Owner の順序承認どおり |
| merge 時点の main の題 | squash commit の題に merge 前の `[Draft・merge は Owner 承認待ち]` が残っている（PR のタイトルをそのまま使ったため）。**状態は merge 済み**。PR の本文の一部（「HV 未実施」）も古いままで、Owner のコメント 6880676911 に「本文の修正は未実施」と記録されている |

### 8-2. 最終 HEAD の検証【実測】

| 項目 | 結果 |
|---|---|
| CI | **11/11 success**（build〔run 43538750182〕、classify、Layout Contract Gate、layout-chromium、WebKit 390×844／360×800 各 3 shard、WebKit Gate〔run 43538750053〕） |
| Codex レビュー | completed、`has_any_findings=false`、`has_unresolved_findings=false`、**対象 commit `7551608`＝最終 HEAD**（summary コメント 6880696611）。docs のみの追加（`52ff050e`）より後の commit（`7551608a`）をレビューしており、**レビュー証跡は最終 HEAD に有効**（Codex の GitHub submitted review は 0 件で、summary と区別される） |
| 未解決レビュースレッド | 0 |
| Owner HV | 下記 8-3 |

### 8-3. iPhone Safari HV（Owner、2026-11-14〜15）

- 環境: PR 専用 Preview `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-848-7551608/`（badge `PR#848 · 7551608`、HEAD と一致）
- **結果: 6 レシピの「発見・図鑑登録」6/6 PASS**（Owner の最終集計コメント 6880652736）: ディアボラ No.52（64 点）、フルッティディマーレ No.53（74 点）、ペルーアヒアマリージョ No.54（61 点）、南アフリカボアヴォース No.55（73 点）、タイチキン No.56（78 点）、北京ダック No.57（78 点）
- **範囲の限定（明記）**: この 6/6 は Owner の提供した**完成画面のスクリーンショットと図鑑登録メッセージを根拠にした「発見・図鑑登録」の確認**で、Shop NEW の表示、調理中の全操作、別サイズ（360×800）のレイアウト、step 79／80 の同時解禁の画面、保存の分離を**個別に検証したものではない**（Owner の記録にも同様の限定がある）。完成画面に大きなレイアウト崩れはなかったと記録されている
- 具材の視認性（§6-3 の具材 4 色の確認項目）: Owner は色の良否を独立に判定しておらず、完成ピザ上の食材の**見た目の改善候補**として記録した（下記 8-5）。色の変更はしていない（承認済みのソース 4 色も不変）

### 8-4. merge 後の main【実測】

| 項目 | 結果 |
|---|---|
| Deploy to GitHub Pages #558（run 43616314861、head `3c5b433`） | success（Owner の画面確認も #780 に記録） |
| E2E WebKit (Cooking UI 1-Screen) #1628（run 43616314876、head `3c5b433`） | success（Owner の画面では一時「実行中」と記録され、その後 Actions の実行履歴で success を確認） |
| 手動の Production ON・再 deploy・共有 Preview 更新 | **なし**（merge 時点も、本追記の時点も） |
| PR 専用 Preview の撤去 | **未確認**（Owner の記録では「未実施・Owner の別承認待ち」。現在の状態は私は確認していない） |
| main の HEAD（本追記の作成時） | `17603034`（#861）。#848 以降の main の Deploy・E2E WebKit も success |

### 8-5. 未解決事項・継続課題

1. **step 79／80 の同時解禁**（§6-1）: Owner 方針（2026-11-16）は「進行・Research・既存 late 互換に問題がないことを確認したうえで許容」。回帰テストは main にある — `src/dev/discoveryProgressionModel.test.ts`（multi-recipe unlock の期待値に `79, 80`、原因を B21 の late 食材の固定 floor〔79／80〕との一致としてコメント）と `src/dev/DiscoveryProgressionInspector.test.tsx`（`LATE_FLOOR_MULTI` ＋ 4）。進行・Research は `src/data/expansionBatch24.test.ts`（正準順 0、承認 43 ID の範囲、step 75〜80 の導出）と既存の late 系テストが CI 11/11 で成功。**同時解禁そのものの iPhone 実機での確認は未実施**（8-3）
2. **見た目・絵文字（暫定）**: squid 🐙、cucumber 🥝 は暫定表現として **#824（完成ピザ上の食材の見た目）** に改善課題として記録済み（食材別の配置方法は #825）。Owner 方針により、Gate で無断変更しない。HV で挙がった候補: サラミピカンテ（さくらんぼに見える）、イカ（タコに見える）、チキン（骨付き肉）、ブラックオリーブ、玉ねぎ（丸ごと）、パクチー、きゅうり（キウイ）、北京ダック（カモ）、青ねぎ
3. **台帳**: T24 の merge 後の再生成・T25-R2c の再測定は別の docs PR（#853、HOLD・Owner 判断待ち）で扱う。本書は編集しない
4. **PR #848 の本文・タイトルの古い記述**と、merge commit の題の `[Draft…]`: 履歴は書き換えない（force-push しない）。正は本節と Owner のコメント（6880676911、6880732902）
5. **私の記録の訂正**: §3 の「全 Vitest（ローカル）」と「CI」「独立レビュー」の欄、§7 の「Draft・merge 待ち」は merge 前の記述で、確定結果は 8-2 を参照

### 8-6. Gate 判定（記録）

**T24（#848）は Owner の最終承認で merge 済み。Final Gate の再実施は不要**（Owner 判断、2026-11-16）。この追記 PR 自体の merge は Owner の別承認待ち。
