# Content Master Plan 追補 — 実装開始条件の解消 Result（#780）

2026-11-08 / 基準 `origin/main` = `348b1e4`。ブランチ `claude/teto-pizza-content-master-plan-k8jmjv`。管理対象は不変: **食材 170／レシピ 177／調理法 27 候補。無断除外なし。** PR・merge・Production ON・共有 Preview 更新はしていない。

## A. 実装成果（コード・データ・資料）
| # | 成果 | ファイル |
|---|---|---|
| 1 | 台帳の**誤り訂正**（機械検出）: buffalo-chicken・detroit-style・hot-honey-pepperoni は焼成後に「ソース」を要求するが FINISH はトッピング専用 → 新工程キー `POSTBAKE_SAUCE`（M7 = MB-08 DRIZZLE）。判断済みで昇格可能 8→7、工程待ち 43→45、レシピバッチ 17→18、標準の全完了日 12-01→12-02、遅延 2027-02-27→02-28。検査 41 件 PASS | `docs/reports/TETO_CONTENT-MASTER_LEDGER_*.md`、`data/TETO_CONTENT-MASTER_*`（再生成）、主レポートに訂正注記 |
| 2 | D-ING-1 設計案（5 案比較、推奨 = 同乗解放、影響範囲、段階 R0〜R3） | `docs/design/TETO_DING1_INGREDIENT-FIRST_DESIGN_2026-11-08.md` |
| 3 | 重複 26 品＋例外 22 品の全量収録の扱い（X1 工程差分離 20／X2 品ごとの例外 22／X3 工程差なし 6）、全件表と再現スクリプト | `docs/reports/TETO_DUP-FULL-INCLUSION_Plan_2026-11-08.md`、`data/TETO_DUP-FULL-INCLUSION_*` |
| 4 | RB-01 の Q-1〜Q-5 一括提示（変更対象・変更前後・数量・描画・既存 17 レシピへの影響） | `docs/reports/TETO_B21-RB01_Q1-Q5_Decision-Package_2026-11-08.md` |

D-ING-1 の要点【実測】: ラダーは「クレジット済みレシピ発見数 ≥ step」で進み、スラックは 81−78−2=1 で最小値ちょうど。食材だけの step は届かない閾値になり、スラックを 0 にしてテストが落ちる。よって step を増やす案は成立せず、**新 step を増やさず既存の追加 step に相乗りさせる案 D**（`UNUSED_MATERIAL` だけを期限つき登録簿で緩和）を推奨。先行幅は「宿主レシピの 1 列車前」まで。完全な独立は別の解放権威（案 E、OD-REC04-1 の変更）が必要。

重複の要点【実測】: 26 品のうち 20 品は証跡のある工程差で識別軸を分離でき、工程の出荷待ちで収録できる。工程差が無い 6 品（sfincione・pizza-baiana・keema-pizza・pizza-chilena・philly-cheesesteak-pizza・hokkaido-cheese-pizza）だけ Owner の 3 択（バリエーション収録／区別要素の追加／新識別軸）が要る。

## B. #792 の claim release 可否【実測】
- #792 は merge 済み（`348b1e4`）。#790 には、実装 session（`…2mqx12Yxf3c5WuVLh`）の claim の **release が既に投稿済み**（コメント 6724920776、17:48Z。もう一方の `…1AJW3sF49Uzak3yaN` も 12:05Z に release 済み）。したがって**可否の判断は不要・追加の release 投稿はしない**（二重投稿は他 session の領域を侵さないために避けた）。Issue #790 自体は open のまま（クローズは Owner 判断）。
- 先行して書かれた効率台帳（別 session）の「release 未確認」は、この投稿により解消済み。

## C. 着手した実装作業と、しなかった理由
- **専用 SVG は着手しなかった。** 別 session（`session_016YrGi1RVoi7RJtRnB3cKLU`）が #417 に claim（コメント 6724929630、`src/components/stagedGlyphs/**`、B21 = cheddar・lettuce・tortilla-chips・cabbage・bonito-flakes、B22 = fennel・orange・carrot・red-cabbage・sunflower-seeds・radicchio・truffle・brie）を出し、稼働中。重複制作を避けた。
- 未 claim の SVG 候補（衝突なし）: B23 デザート 6（apple・banana・chocolate・graham-cracker・marshmallow・powdered-sugar）。**Owner が指示すれば別名前空間（例 `src/components/dessertGlyphs/**`）で未配線のまま制作する。**
- HOT ファイルの実装（RB-01）は Q-1〜Q-5 未承認のため開始しない。

## D. 工数記録（Owner プロンプト・トークン・並行セッション）
| 項目 | 値 | 出典 |
|---|---|---|
| 本 session の Owner プロンプト | 3 回（計画作成／本追補／「再開」） | 【実測】 |
| 本 session の使用量（追補作業の途中時点） | output 105,457／cache 読込 10.87M／約 3.33 USD | 【実測】`get_session` の usage（直近の取得値。以降の分は未反映） |
| Codex のトークン | **未取得**（GitHub・session ログに無い）。レビュー回数で代替: 本追補では Codex 依頼なし | 【未取得】 |
| 並行セッション | 稼働中 2（本 session ＋「食材全量追加計画」）。直近 24 時間で TETO 関連の完了／待機 session 多数。同一対象の重複（B19・B20-A）を過去に 2 回記録 | 【実測】`list_sessions` |
| 食材ライン側の予測（別 session の台帳） | Owner プロンプト 標準 133（楽観 74／悲観 223）。Claude 標準 output 約 20M | 引用・再検証なし（`claude/teto-pizza-ingredients-plan-fhmqdh`） |

### 3 ライン残り工数の更新（単位数は実測、1 単位あたりは別台帳の仮定を引用）
| ライン | 残り | 本追補での変化 | 残りの Owner 判断（プロンプトの核） |
|---|---|---|---|
| ① 食材 | 70（バッチ 9） | 単独追加は案 D の R0〜R3（PR 約 3＋利用側）。SVG は別 session が 13／63 を着手 | D-ING-1a〜d、アイコン方針、I-1／I-2 |
| ② レシピ | 84（バッチ 18） | RB-02 は 5 品へ縮小（-1）。M7 の 3 品が工程待ち（+2）。重複 48 品の扱いが X1/X2/X3 に分解され、Owner の回答単位が 22 品別＋6 品の 3 択に確定 | Q-1〜Q-5、D-DUP-1a〜d、D-1／D-2／D-3／D-6 |
| ③ 調理法 | 採用の未完 12＋M7 の位置づけ | MB-08 が 3 品を解放する工程に格上げ | 採否未決定 6、本番 ON、M2／M4／M6 の設計 Issue |

## E. Owner 判断待ち（実装しないもの）
Q-1〜Q-5（RB-01）／D-ING-1a〜d／D-DUP-1a〜d／D-ICON-1／M7（焼成後ソース）の工程位置づけと M-0 順への追加／SVG B23 の着手可否。**判断待ちと実装成果は上記 A〜C のとおり分離済み。**
