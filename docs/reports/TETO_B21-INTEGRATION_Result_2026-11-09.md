# B21 統合整理 Result Report — PR #797／#798／#799 の範囲・依存・統合順、CI／Codex、専用 Preview、実画面、件数・工数・次の計画（#780、docs-only）

2026-11-09 / `origin/main` = `348b1e48`（変更なし）。**#797・#798・#799 はすべて Draft・HOLD のまま。merge・Production ON・共有 Preview の更新はしていない。** 凡例: 【実測】取得した値、【推論】解釈、【未確認】確認できていない。

## 1. PR の範囲・依存・統合順【実測】

| PR | 中身 | HEAD | 状態 |
|---|---|---|---|
| **#797**（別 session） | B21／B22 の新食材 13 種の専用 SVG（**未配線**）、食材全量計画・台帳・Q 一覧の docs（10 ファイル） | `880fd9a5` | CI 全通過（6 件中 success 4・skipped 2）、Codex 指摘なし。**#798／#799 と変更ファイルの重なりなし** |
| **#799**（別 session） | **B21 のコード正本**: late カタログに 2 レシピ・6 食材、golden・pin・staged の最小編集、`expansionBatch21.test.ts`、E2E、**lettuce／cabbage の専用 SVG の配線**（`IngredientGlyph.tsx`・`ingredients.ts` の `pieceVisual`）。**#797 の `stagedGlyphs/**` のコピーを含む** | `ce22ad9e` | CI 実行中。Codex は前 HEAD `dacbfefc` で指摘なし |
| **#798**（本 session） | 当初は B21 のコードも含んでいたが、**二重実装の解消のためコードを取り除いた**（`a3e37f6f`）。残り: 計画・台帳・Q 一覧・重複／D-ING-1／M7 の設計、デザート 6 種の未配線 SVG、本書（29 ファイル、`src` は `dessertGlyphs/` のみ） | `a3e37f6f` | CI 実行中 |

- **二重実装の実測:** 当初の #798 と #799 は変更ファイル **50 本が共通、マージで 59 箇所が衝突**した（同じ B21 のコード）。#799 の作成者 session は同じ Owner 判断を受けて今も #799 に lettuce／cabbage の SVG 配線を進めていたため、Owner の「同じ変更を二重に実装しない」に従い **#798 側からコードを撤去**し、#799 に集約した（履歴には `8694b3f4`、差分は `docs/reports/data/TETO_B21-CODE_798-original.patch` として保存）。#799 の作成者 session へは `send_message` で連絡済み（範囲・Owner 判断の差分・提案する順序）。
- **現在の衝突検査（`merge-tree`）:** #798×#799 = 0 件、#798×#797 = 0 件。#799 は #797 の `stagedGlyphs/**` を取り込んで持っているため、**#797 を先に merge する必要がある**（同一内容なら競合しないが、#799 は `StagedGlyphs.test.tsx` を変更しているので、#797 の merge 後に #799 を main へ rebase して差分を確認すること）。
- **統合順（提案。merge は Owner のみ）:** ① #797（未配線グリフ・docs） → ② #799（B21 のコード＋配線。#797 を取り込んだ main へ rebase、最新 HEAD で CI・Codex・iPhone HV） → ③ #798（docs・台帳・デザート SVG。いつでも可、順序依存なし）。#798 の先頭コミット `8694b3f4` を取り込む必要はない。

## 2. Owner 判断（2026-11-09）の反映状況

| # | Owner 判断 | 反映先・状況【実測】 |
|---|---|---|
| 1 | Q-2 の追加 4 ID（#799 の報告では 10 文字列）を、報告された変更前後に限定して承認 | #799 `ce22ad9e` が「追加 4 ID の承認」を反映（コミットメッセージ）。承認対象は **#799 が Owner に報告した 10 文字列**（本番 ladder の 40 本シード標本: pesto-burrata-pizza `H->I`・`I->J`・`J->K`・`K->L`／pizza-feta-eliniki `H->I`・`I->J`・`J->K`／potato-mayo-pizza `B->C`／wasabi-beef-pizza `C->D`・`D->E`）。**本書や #798 の旧測定の 6 文字列（既定の乱数 10 本）はその部分集合**で、承認範囲ではない（標本の違い）。他の変化・新 ID・正準順の変化は引き続き停止条件 |
| 2 | lettuce・cabbage は専用 SVG を採用 | #799 で配線済み（`lettuce-leaf`／`cabbage-shreds`、絵文字は隠れたフォールバックに）。#797 は未配線のまま。**配線は #799 だけ**（#798 には配線を入れていない） |
| 3 | tortilla-chips family = vegetable、cheddar サイズ = l | tortilla-chips は #799 に反映済み。**cheddar のサイズは #799 の最新 HEAD でも `m` のまま**【実測】（Owner 追認は `l`）。#799 の作成者 session へ連絡済み。#798 の旧コードは `l` だった |

## 3. CI・Codex・既知の P2【実測】
- #799 の既知の P2（「絵文字は実際に表示される」）: 指摘は正しく、コメント・PR 本文を訂正した上で再レビューが指摘なし（HEAD `dacbfefc`）。**スレッドは「outdated」だが resolve はされていない**。その後 lettuce／cabbage が SVG になり、表示される絵文字は 4 種（cheddar・tortilla-chips・okonomiyaki-sauce・bonito-flakes）に減った。実質は解消、スレッドの resolve は #799 の担当／Owner。
- 最新 HEAD の CI は実行中（#798 `a3e37f6f`・#799 `ce22ad9e`）。#798 には `@codex review` を依頼済み（コメント 6732377705）。結果は PR に記録される（本書の更新はしない: HEAD が変わり CI・Codex の対象が崩れるため）。

## 4. 専用 Preview（iPhone Safari HV）— **現時点では公開できない。Owner 判断が必要**【実測＋推論】
**使える仕組み:** preview リポジトリ（`teto-pizza-game-preview`）の `main` に PR 用ページの workflow（`pr-page.yml`、B19 で実績あり）がある。共有 `site/` を上書きせず、`pr/pr-<PR番号>-<sha7>/` に別ページを足す（保存キーは別名、本番／Firebase へ触れない）。B19 のページは撤去済み。
**公開できない理由:**
1. B21 の新食材は late step 79／80（クレジット済み発見数 79 以上）でしか買えず、**素のページでは手では到達できない**。B19／B18 のように、ページを開くだけで専用のセーブを書く **HV 用シード（`?hv=b21-taco`／`?hv=b21-okonomiyaki`）が #799 にない**。
2. シードは `src/preview/**` の変更で、PR の HEAD より先の commit（`source_sha`）として公開する前例（B19）はあるが、**#799 は別 session のブランチ**で、私は触れない。
**準備したもの:** #799 `dacbfefc` 上で検証済みのシードの patch（`docs/reports/data/TETO_B21-HV-SEED_on-799.patch`、222 行）。`b21HvSeeds.ts`＋テスト、`hvSeeds.ts` の配線、`previewIsolation.gate.test.ts` への追加。`tsc` エラー 0、`src/preview` のテスト 243 件合格（B18 のシードと同じ作り）。**#799 の最新 `ce22ad9e` にも `git apply --check` が通る**。
**必要な Owner 判断（推奨つき）:**
| ID | 判断 | 推奨 |
|---|---|---|
| P-1 | シードの置き場所: ①#799 の作成者 session に上記 patch を #799 へ取り込ませる ②`source_sha` 用の別ブランチに私が push（ブランチ追加の許可が要る） | ① |
| P-2 | 公開手順の承認: preview の Actions → *Publish / remove a PR-scoped preview page* を Owner が dispatch（B19 と同じ。私は dispatch しない）。入力: `action=deploy` / `pr_number=799` / `sha=<#799 の最新 HEAD>` / `source_sha=<シード入りの commit>` / `confirm=pr-799-<source_sha 先頭 7 桁>` | 承認（#799 の HEAD が確定した後） |
| P-3 | 公開 URL（予定）: `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-799-<7桁>/?hv=b21-taco`／`…?hv=b21-okonomiyaki`（確認後は `action=remove` で撤去） | — |
共有 Preview は一切更新しない。同一 origin（github.io）を共有する条件付き受容は B19 と同じ。

## 5. 実画面（Chromium 自動撮影、#799 `ce22ad9e`）
`docs/reports/screenshots/b21-final-view/b21-sheet-390x844.png`／`b21-sheet-360x800.png`（各 6 コマ: レタスの Shop NEW・タコの具材・タコの仕上げ・キャベツの Shop NEW・お好み焼きの具材・お好み焼きの仕上げ）。**390×844 と 360×800 の両方で E2E 4 本（taco／okonomiyaki × 2 画面）合格**。動画（390×844）はユーザーへ直接送付済み（リポジトリには入れていない）。判定: レタス（葉）・キャベツ（細切り）の SVG は一目で識別できる。**要改善**: cheddar（🔶）・tortilla-chips（🔺）・okonomiyaki-sauce（🍶）・bonito-flakes（🪶）は絵文字のまま。**実機 iPhone Safari の HV は未実施（未確認）**。

## 6. 件数 — main 出荷済み と PR 上の実装済みを分けて記録

| ライン | 全対象 | **main 出荷済み** | **PR 上の実装済み（未 merge）** | 実装済み合計 | 残り（PR 実装後） | 残り（main 基準） |
|---|---|---|---|---|---|---|
| 食材 | 170 | **100** | +6（#799: cheddar・lettuce・tortilla-chips・okonomiyaki-sauce・cabbage・bonito-flakes） | 106 | 64 | 70 |
| レシピ | 177 | **93** | +2（#799: taco-pizza・okonomiyaki-style-pizza） | 95 | 82 | 84 |
| 調理法 | 27 候補（採用 19） | **7** | 0（M7 は設計のみ） | 7 | 採用の未完 12 | 12 |
| 参考（カタログ外・未配線） | — | — | 専用 SVG 19 種: #797 の 13 種（うち lettuce／cabbage の 2 種は #799 で配線）＋#798 のデザート 6 種 | — | — | — |

## 7. Owner プロンプト・使用量・並行セッション【実測】
| 項目 | 値 |
|---|---|
| Owner プロンプト（本 session） | **5 回**（計画／追補／「再開」／B21 承認／本回の判断） |
| Claude（本 session、`get_session` の累計） | output **288,110**、cache 読込 **127.75M**、約 **21.80 USD**。他 session の長い会話ログを読んだ分を含む |
| Claude（別 session「食材全量追加計画」、04:17 時点） | output **284,844**、cache 読込 **94.05M**、約 **20.14 USD** |
| Codex | 使用量は**未取得**（GitHub・session ログに無い）。#798 の `a3e37f6f` へレビュー依頼 1 回。直近のレビュー応答は約 2 分 |
| 並行セッション | **稼働中 2**（本 session ＋ #797／#799 の session）。同じ Owner 判断を 2 session が受け、B21 のコードを重複実装した（今回で解消）。再発防止: B21 のコード・配線・HV シードは #799 の session、計画・台帳・デザート・M7・HV 環境の調査は本 session |

## 8. 次の実装計画（食材・レシピ・工程）

| 順 | 内容 | 前提・Owner 判断 | 担当（案） |
|---|---|---|---|
| 1 | **B21 の確定**: #797 → #799（cheddar `l` の反映、最新 HEAD の CI・Codex）→ HV シード（P-1／P-2）→ iPhone HV → Owner の merge 判断 | P-1〜P-3、cheddar `l` | #799 の session |
| 2 | **RB-02（5 品）の先行調査**（Owner Q-5）: pizza-finocchi-salad・pizza-cavolo-carote・speck-e-brie。実装は別承認 | 下の調査結果 | 本 session |
| 3 | 食材: 新規 **fennel・orange**（finocchi）／**carrot・red-cabbage・sunflower-seeds**（cavolo）／**brie**（speck、cheese）。SVG は #797 の 13 種に fennel・orange・carrot・red-cabbage・sunflower-seeds・brie が含まれる（未配線）。配線は RB-02 の PR で | RB-02 の実装承認 | #797 と RB-02 の PR |
| 4 | レシピ: RB-02 の 3 品（＋radicchio-noci・black-truffle は truffle の形と balsamic の扱い待ち）。buffalo-chicken・hot-honey-pepperoni・detroit は M7 待ち | 下記 | 本 session |
| 5 | 工程: **M7**（`docs/design/TETO_M7_POSTBAKE-SAUCE_DESIGN_2026-11-09.md`）は DRIZZLE（PR #776／#746）の Owner ゲート後。**D-ING-1 の同乗解放**（`docs/design/TETO_DING1_…`）の R0 判断。PREP／FRY／STEAM／DRIZZLE の本番 ON 判断 | Owner | — |
| 6 | デザート 6 種の SVG（#798）は配線を宿主レシピの列車に合わせる（宿主は D-1／D-2 待ち） | — | — |

**RB-02 先行調査の結果**（staged の golden と #799 のデータから【実測】）:
| レシピ | 重複ゲート | Research 昇格停止（D-6） | 新食材 | 気づいた点（Owner 判断の材料） |
|---|---|---|---|---|
| pizza-finocchi-salad | 出荷済み・候補ともヒット 0 | 対象外 | fennel・orange | **D-5 で orange は後乗せ**になるため late カタログ（POST_BAKE 必須）。staged の材料に `olive-oil` があるが、ソース欄は「なし」＝**ソースの扱いが矛盾**（olive-oil は sauce 区分。PAINT_TEMPORARY か、NO_SAUCE で材料から外すか） |
| pizza-cavolo-carote | 同上 0 | 対象外 | carrot・red-cabbage・sunflower-seeds | lemon・red-cabbage が D-5 で後乗せ。同じく `olive-oil` の扱いが矛盾 |
| speck-e-brie（→`speck-e-brie`） | 同上 0 | 対象外 | brie（チーズ） | 後乗せなし＝**通常カタログ**（通常 step 72、`recipes.ts`・`ingredients.ts`・`discoveryLadder.ts` の HOT 編集、late の step は動く）。ID 改名（D-4）の整合確認が先 |
いずれも Research の正準順の変化・重複は 0（staged の測定）。**実装前に必ず最新 main で再測定**（B21 の経験: 本番ラダーの標本で承認表に無い変化が出る）。

## 9. 未実施・注意
- 私の旧 B21 実装のテスト・Research の 3 層測定（承認表の再現・本番ラダーでの追加 6 文字列）は `8694b3f4` と `TETO_EXPANSION-BATCH-21_Result.md` に残る。#799 側の最終 Research 固定は #799 の作成者 session の確認事項。
- 実機 iPhone Safari の HV、Playwright の WebKit 自動撮影（CI の WebKit Gate は #798／#799 で実行中）は未確認。
- B21 の原典（pizzadb.jp）は全値が未確認のまま。
