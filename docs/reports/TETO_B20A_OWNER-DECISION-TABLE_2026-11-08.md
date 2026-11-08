# B20-A Owner 判断表 — pesto-noci-pizza ＋ honey・walnut（docs-only、Refs #780 #772 #417）

2026-11-08、基準 main **`4ba0559`**（#783 Batch 19・#788・#789 merge 済み）。branch `claude/teto-pizza-b20-a-m48qbl`。
**新規ファイル 1 本のみ。`src/`・`e2e/`・CSS・golden・HOT ファイル・既存 docs は変更なし。実装・merge・Production ON・共有 Preview 更新なし。** HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
凡例: 【実測】今回 `4ba0559` で一時テストを実行して得た値（テストはコミットしていない）、【先行】既存資料、【推論】。「推奨」は助言で Owner 決定ではない。

## 0. 結論

1. **B20-A の正式範囲は「新レシピ 1（`pesto-noci-pizza`）＋新食材 2（honey・walnut）」**（#780 Owner 決定 6703581170・6706077215）。正式な「新レシピ 10 品」は repo・Issue に存在しない【実測】。
2. **「10 レシピ」の承認対象は、pesto-noci の追加で非正準順の Research ラベルが変わる既存 10 レシピ**【実測】。B19 前の 9 件（T5 先行測定）に、B19 で出荷された `pesto-burrata-pizza` が加わった。**正準順の変化は 0 件**（停止条件に当たらない）。
3. 重複ゲートはクリーン【実測】: 最大 Jaccard 0.167（genovese）、同一・部分集合・上位集合・1 材料差 0。mozzarella を足した場合も 0.333 でクリーン、影響レシピは同じ 10 件。
4. 開始前の阻害要因は**内容ではなく claim**: B19（#774）・ハーブ配線（#417／#778）の HOT ファイル claim が merge 後も未 release（§4）。

## 1. 測定条件【実測】

- 母集団: `RECIPES`（92、Pinsa 開）。pesto-noci = pesto 1／honey 1／gorgonzola 2／walnut 3（T5・Implementation-Spec の暫定値）。
- honey（sauce・spread）・walnut（topping・scatter）をテスト内の module mock で追加。ladder は `pesto-burrata-pizza` の step（70）の直後に honey＋walnut の 1 step（**71**）を挿入。
- Research は `researchLetterChangesAcrossOrders`（B18／B19 と同じシナリオ、乱数順 40）。

## 2. Research ラベル — 10 レシピの分類（B20A-LD-01〜10）

正準順の変化は全 10 件とも **0**。以下は非正準順（獲得順の組み合わせ）だけで起きる変化。

| ID | レシピ | 非正準順の変化 | 典型例 | 分類 | 推奨 |
|---|---|---|---|---|---|
| B20A-LD-01 | pesto-caprese | `-→A` のみ | 両レシピの材料だけを持ち pesto を最後に取得 | **一括承認可能** | 承認（単独コホートに A が付くだけ） |
| B20A-LD-02 | pesto-tonno | `-→A` のみ | 同上 | **一括承認可能** | 承認 |
| B20A-LD-03 | pesto-vegetariana | `-→A` のみ | 同上 | **一括承認可能** | 承認 |
| B20A-LD-04 | quattro-formaggi | `-→A` のみ | gorgonzola を最後に取得 | **一括承認可能** | 承認 |
| B20A-LD-05 | genovese | `-→B`・`A→B`・`B→C`・`C→D`・`E→F`・`G→H` | pesto を最後に取得 | **個別判断必要** | 個別確認（初期の基本レシピで `A→B` を含む） |
| B20A-LD-06 | pesto-patate | `-→B`・`B→C`・`D→E`・`E→F`・`G→H`・`H→I`・`I→J` | ladder 全材料、pesto 最後 | **個別判断必要** | 個別確認（変化幅が最大） |
| B20A-LD-07 | pesto-salmone | `-→B`・`B→C`・`C→D`・`D→E`・`F→G`・`H→I` | 同上 | **個別判断必要** | 個別確認 |
| B20A-LD-08 | pesto-pollo | `B→C`・`C→D`・`D→E`・`F→G` | 同上 | **個別判断必要** | 個別確認 |
| B20A-LD-09 | pesto-trapanese | `B→C`・`C→D`・`D→E`・`E→F` | 同上 | **個別判断必要** | 個別確認 |
| B20A-LD-10 | pesto-burrata-pizza | `B→C`・`C→D`・`G→H`・`I→J`・`J→K` | 同上 | **個別判断必要** | 個別確認（B19 で出荷、承認済み 20 件の範囲外の新規対象） |

- **依存待ち: 0 件**（10 件とも測定済み・main 上の出荷レシピ）。ただし実装 PR の正式測定（`expansionBatch20.test.ts`）で件数が変わったら、本表は無効とし再提出する。
- B19 の承認（PR #783 コメント 6704906797）は B19 の 20 件に限定されるため、本 10 件には適用されない。

## 3. 内容の判断（実装前、まとめて 1 回）

| # | 判断 | 推奨 | 根拠 |
|---|---|---|---|
| B20A-D1 | honey は焼成前の第 2 ソース層（spread） | 承認 | B19（pesto＋olive-oil）と同型。DRIZZLE は本番 OFF（#579） |
| B20A-D2 | mozzarella を足さない | 承認 | 原典の行に無い。足しても重複・Research 影響は同じ（§0-3） |
| B20A-D3 | walnut の Hint 5.0 family は暫定 `spice` | 実装 PR で AC-3（SAUCE か CHEESE の有料 1 段で pesto 系と区別）を測ってから確定 | Hint 5.0 は今回**未測定** |
| B20A-D4 | walnut SVG（#777、PROVISIONAL）を採用し外線を維持 | 承認 | 生くるみ×焼成チーズの塗りコントラスト 1.10、外線で成立【先行】 |
| B20A-D5 | 食材とレシピを 1 PR（ladder step 71 ＋ key レシピ） | 承認 | B13〜B19 と同じ。レシピの無い step を作らない |
| B20A-D6 | B20-A 用の新 Issue と新 claim で開始 | 承認 | claim は session＋issue 単位。#780 は T2／T5／T-FX が共有 |
| B20A-D7 | §2 の 10 件の承認方法（LD-01〜04 一括、LD-05〜10 個別） | 承認 | 正準順 0 のため停止条件外 |

暫定値（原典 pizzadb.jp 未確認・GAMEPLAY ASSUMPTION）: 個数（pesto 1／honey 1／gorgonzola 2／walnut 3）、焼き窓 58–78、honey 色 `#e8a93a`、名前「ペスト・ノーチピザ」「はちみつ」「くるみ」。

## 4. 開始条件と阻害要因

| 条件 | 状態【実測】 | 解消方法 |
|---|---|---|
| B19（#774）merge | 済（`44460cb`） | — |
| walnut SVG | 済（#777、未配線） | 配線は B20-A PR で |
| ハーブ配線 | 済（#778、`06cfc06`） | — |
| B19 T1 の claim（#774 6691358861、6701234362。`ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`IngredientGlyph.tsx`・`App.css`・golden ほか） | **未 release**（期限 11-20） | 保有セッションが release、または Owner が失効を宣言 |
| ハーブ配線の claim（#417 6689676327、PR #778。`ingredients.ts`・`IngredientGlyph.tsx`・`App.css` ほか） | **未 release**（期限 11-20） | 同上 |
| Owner の B20A-D1〜D7 | 未 | 本表 |

## 5. 実装 PR で必ず再測定するもの

Duplicate Gate、Research（正準順 0・非正準順の全件）、Hint 5.0（AC-3）、golden（挿入のみ）、保存・Dex・在庫不変、390×844／360×800 の 1 画面 UX（トレイ名の幅）、HV 動画（repo 外）。
