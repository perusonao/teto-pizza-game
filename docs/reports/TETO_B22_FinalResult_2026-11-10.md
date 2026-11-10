# B22（#807）結果レポート — merge 後の main・Deploy・HV ページ削除・台帳・累計（2026-11-10、docs のみ、Refs #780）

基準: main `d3d4ec05`（#807 の squash merge、2026-11-10 02:24:49 UTC、Owner のアカウントが実施）。凡例: 【実測】Actions・コード・台帳の読取り、【未確認】測っていない。承認の時系列は `TETO_B22_ApprovalPacket_2026-11-10.md` の付録 A。

## 1. Owner 判断（確定）
Research 非正準 35 ID（承認パケット §2、`jamon-serrano-pizza` は対象外）／`resultNearMiss` テストの 6 分割／iPhone Safari HV 6/6 PASS（備考なし）／#807 の squash merge、すべて承認済み。PR 上の承認の記録は merge の後になった（付録 A）。

## 2. merge 後の main【実測】
| 項目 | 結果 |
|---|---|
| Deploy to GitHub Pages（run 42742587915） | 1 回目: build は成功、`deploy-pages` が「Deployment failed, try again later.」で失敗（Pages の `deployment_queued` が約 45 秒続いた後の失敗。アプリのビルドではない）。**失敗 job を 1 回再実行して成功**（02:41:51）。原因の詳細は未確認（GitHub Pages 側の一時的な失敗と見られるが、確定ではない） |
| E2E WebKit（run 42742588075） | **全体が成功**（attempt 1、02:47:59 完了）: classify、layout-chromium、Layout Contract Gate、WebKit 6 shard（390×844・360×800 の各 3）、WebKit Gate。失敗・再実行なし。記録の作成時（02:45 頃）は 1 shard が実行中だったため、完了後に更新した |
| iPhone HV ページ `pr/pr-807-eb37889/` の削除 | Owner の許可で `remove` を実行。run 42744296774 の validate・publish・live 検証が成功。**「`pr/<slug>/` 以外が staged されていない」ことを証明するステップも成功**（削除対象以外の差分なし）。Production・共有 Preview は変更していない |

## 3. 台帳（#810、main `d3d4ec05` 基準で再生成）【実測】
機械検査は 41 件すべて PASS（生成器の固定値を算出値にし、late の 1 行形式の食材と、B22 で出荷された `black-truffle-pizza` の matrix 別名を追加）。

| 区分 | 出荷済み | 候補（未出荷） | 総数 |
|---|---|---|---|
| レシピ | **101** | 76 | 177 |
| 食材 | **116** | 54（新規 47＋別名／統合の暫定 7） | 170 |
| 調理法・工程 | 実装済み 7 | 未出荷 20（下表） | 27 |

## 4. 調理法・工程 27 候補の状態【実測：台帳の methods】
**「実装済み」は本番で使える。「未配線」は純粋ロジックやラボはあるが本番では OFF／未接続。** 先の報告の「調理法 0/27」は「このプログラムで追加した調理法」の数え方で、台帳の 27 行には元から実装済みの 7 行が含まれる。台帳の数え方を正とする。

| 状態 | 数 | 内訳 |
|---|---|---|
| **実装済み（本番）** | 7 | T-NOSAUCE、T-TRAY、T-DOUGH-PINSA、T-LATE、M-SEAR（`SEAR_EXPERIENCE_PRODUCTION=true`）、M-SQUEEZE、M-CUT |
| **一部実装・未配線／OFF** | 7 | M-PREP（merge 済み、`PREP_EXPERIENCE_PRODUCTION=false`、Preview opt-in のみ）、M-FRY（F1 の純粋ロジック merge 済み、`FRY_EXPERIENCE_PRODUCTION=false`、UI なし）、M-STEAM（S1/S2 merge 済み、`STEAM_EXPERIENCE_PRODUCTION=false`、S3 UI は PR open）、M-DRIZZLE（D1 の純粋ロジック merge 済み・未配線・本番 OFF）、M-ENCLOSE（FOLD+SEAL のロジック PR #785 が Draft・HOLD・未 merge）、M-DOUGH-KINDS（pinsa が 1 種目として出荷済み、他は設計 HOLD）、M-MULTI3（2 層まで出荷済み、3 層目は設計のみ） |
| 未実装 | 4 | M-PAN、M-SHAPE、M-MIDBAKE、M-STEP-ORDER |
| 保留（HOLD） | 1 | M-ZONED |
| 採否未定 | 6 | M-LAMINATE、M-SERVE-FOLD、M-BOIL、M-CRACK、M-CHOP、M-MIX |
| 重複（別名） | 2 | M-SPRINKLE、M-ARRANGE |
- M7（焼成後のソース）の対象レシピは 2 品: `hot-honey-pepperoni`（初号機）・`detroit-style-pizza`。`buffalo-chicken` は B22 で焼成前の PAINT として出荷され、M7 から外れた。
- B22 の増分に工程の追加は無い（既存の PAINT・scatter・後乗せのみ）。

## 5. 累計・今回の増分・残数（目標 170 食材／177 レシピ／27 調理法、縮小なし）
| 区分 | B22 前 | 今回の増分（B22） | 現在 | 残り | 進捗 |
|---|---|---|---|---|---|
| 食材 | 106 | +10 | **116** | 54 | 68.2% |
| レシピ | 95 | +6 | **101** | 76 | 57.1% |
| 調理法・工程（実装済み） | 7 | +0 | **7** | 20（未実装 4・採否未定 6・保留 1・一部実装 7・重複 2） | 25.9% |
プログラムの開始時（B21 前）からの累計の増分: 食材 +16（B21 の 6＋B22 の 10）、レシピ +8（B21 の 2＋B22 の 6）、調理法 +0。

## 6. 次の作業
1. （完了）main の E2E WebKit は全体が成功。Deploy は再実行 1 回で成功。
2. 台帳 #810 と承認の記録（本 PR）を Owner が確認して merge。#804（M7 台帳）と #810 は同じ台帳ファイルを触るため、後から merge する側が生成器を再実行する。
3. D-ING-1（#805）の Owner 判断 4 項目。R1 の実装は決定後に別 PR（ladder のスナップショットは B22 後の main から生成）。
4. B23 の準備（残 76 レシピ・54 食材）。着手は Owner の指示と claim の後。
5. テスト性能（#811）、WebKit の flake（#394・#806）は別タスクとして継続。
