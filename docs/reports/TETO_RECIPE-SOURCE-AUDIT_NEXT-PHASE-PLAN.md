# レシピ原典監査 — 次段階の調査計画（docs-only、原典確認は未実施）

> **位置付け**: 本書は調査**計画**であり、原典を確認した結果ではない。独立確認済みの一次資料は **0 件**。
> `src/**`・レシピ・172 マトリクス／生成器／生成物・master evidence・PR #584 / #587 / #612 / #614 / #615 は変更していない。
> 推測による `postBakeFinish` の変更はしていない。merge・共有 Preview 更新・本番 FINISH 有効化もしていない。

作成: 2026-10-21 / 基準 main `e3a7537` / ブランチ `claude/recipe-source-audit-plan-tggnb0`
HV: UI/UX/gameplay 変更なし（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` の対象外）。

## 0. 結論

| 項目 | 結果 |
|---|---|
| pizzadb.jp への到達 | **不可**（`curl` で `CONNECT tunnel failed, response 403`、2026-10-21 23:2x UTC）。個別ページ取得 **0 件**。§7 の URL・引用・取得日時の記録は「なし」 |
| 件数の食い違い | #612 は「比較表のみ 45」、#614 は「44」。**main の matrix で数え直すと比較表のみ 45 件が正**（§2）。#614 は `brazilian-calabresa` を「172 行なし」と誤分類している |
| 172 行に対応する出荷済みレシピ | **47**（比較表のみ 45 ＋ 個別ページ由来 2）。残り 14 は原型（172 行なし）。61 = 47 + 14 |
| 監査優先順位 | P1 13 / P2 2 / P3 10 / P4 20（計 45）。§3 |
| 確認済み | **0**。中継証跡は 2 レシピ（ikura-salmon、shirasu-pizza）のみで、いずれも独立確認なし |

## 1. Duplicate Gate（2026-10-21 実施）

| 対象 | 状態 | 本計画との関係 |
|---|---|---|
| #587 | open、base 旧 main `5997157` | `MASTER-EVIDENCE.json` に `sourceTimingEvidence`（ChatGPT 取得 2026-10-20、独立再確認なし）。**ファイル非重複**。本計画は master evidence に触れない |
| #612 | open、Codex 指摘なし（`f65e5e0`） | 比較表のみ 45 件の「未確認」整理。**証跡の整理は #612 が先行**。本計画は新規の `data` JSON を作らず、その 45 行 JSON（`TETO_RECIPE-SOURCE-AUDIT_45-ROWS.json`）を参照する |
| #614 | open、Codex レビュー実行中（`430f354`） | ikura 行を `LATE_ADDITION` へ訂正し matrix・下流生成物を再生成、別の監査表を追加。**#612 とは件数・優先度が食い違う**（§2）。本計画はどちらも変更しない |
| #615 | open | FIN-E4 後乗せカタログ基盤（データなし）。§6 の実装影響の前提 |
| #584 | open、HOLD | 変更しない |
| 他の open PR | #581 / #540 / #478 / #468 ほか | レシピ原典監査と無関係（ファイル非重複） |
| open Issue / claim | claim ブロックの検索は GitHub 上で未実施 | 追跡 Issue は #527 / #611 のまま。着手前に Owner Gate（`TETO_SESSION-OPERATIONS_1.0.md` §2）で再確認 |

結論: 本計画の新規ファイルはこの 1 件のみで、既存 PR と**ファイル衝突なし**。#612 / #614 のどちらを先に取り込むかは Owner 判断（§8）。

## 2. 件数の突き合わせ（現行 main の数値差）

main の `GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行）と `src/data/recipes.ts`（61 id）で再計算した。

| 区分 | 件数 | 備考 |
|---|---|---|
| 出荷済みレシピ | 61 | `src/data/recipes.ts` |
| 原型（172 行なし） | 14 | bismarck, breakfast-pizza, capricciosa, fugazza, funghi, genovese, margherita, marinara, meat-lovers, napoletana, pepperoni, pizza-bianca, quattro-formaggi, salsiccia |
| 172 行あり | **47** | |
| └ 比較表のみ（`comparison_table_sample`） | **45** | 監査対象 |
| └ 個別ページ由来（`individual_profile_page`） | 2 | `hawaiian`（id 一致）、`pizza-bianca-ricotta`（行 `bianca-pizzadb-row`、材料 4 種の一致による対応） |

### 数値差の説明
| 差 | 原因 |
|---|---|
| #612 = 45 vs #614 = 44 | #614 の表に **`brazilian-calabresa` がない**。#614 は「172 行なし（原型 14 + brazilian-calabresa）」とするが、main の matrix には `brazilian-calabresa-pizzadb-p10`（`canonicalCandidateId: brazilian-calabresa`、比較表由来）がある。#614 の「対応 46 行」は 45 + 2 − 1 の取りこぼしで、正しくは 47 行 |
| `pizza-bianca-ricotta` | matrix 行の `canonicalCandidateId` は `bianca`（id 不一致）。#612 は id 照合のため対象外に落ち、#614 は材料一致で個別ページ由来として扱った。**#614 の扱いが妥当**（行の材料は mozzarella / olive-oil / ricotta / rosemary で出荷レシピと一致）。ただし id では結べないため、alias 対応であることを明記して持ち回る |
| 優先 高：#612 = 25 vs #614 = 14 | #612 は乾燥ハーブ（oregano・rosemary）と卵も「仕上げ系」に含める。#614 は生ハーブ・柑橘・生ハム・オリーブオイル・粉チーズ中心。**どちらも根拠ではなく確認順の仮説**。本書は §3 で両者を統合して再段階化した |
| #614 `pizza-feta-eliniki` を「低」 | olive-oil を含むため、本書は P1 に上げる |
| #614 の matrix 変更（FULL 101→100 など） | **main には未反映**。main の ikura 行は今も `FULL`。数値は #614 を取り込むまで main と一致しない |

> #614 の `brazilian-calabresa` 取りこぼしは、PR 本文（「対応のない 15」）と監査表 JSON（46 エントリ）の両方にある。**#614 の修正は本計画では行わない**（変更禁止）。Owner / #614 担当への連絡事項（§8）。

## 3. 比較表のみの 45 行 — 監査優先順位

優先度は「現実の調理で仕上げ（焼成後）に載せられやすい材料を含むか」の**仮説**で、原典の根拠ではない。分類（matrix・ゲーム）は変えない。

| 優先 | 件数 | 基準 |
|---|---|---|
| P1 | 13 | 依頼で指定された素材（バジル・大葉・ルッコラ・生ハム・オリーブオイル）を含む行、および #587 で部分証跡のある shirasu |
| P2 | 2 | 柑橘・粉チーズなど他の仕上げ素材 |
| P3 | 10 | 乾燥ハーブ（焼成前に載せることも多い）と卵（割り入れの時機が分かれる） |
| P4 | 20 | 仮説上の仕上げ素材なし。サンプル確認（§4 の注） |

### P1（13）
| # | recipe | 比較表の材料 | 仕上げ素材（仮説） | matrix 分類 | 備考 |
|---|---|---|---|---|---|
| 1 | `rucola-e-grana` | arugula, grana-padano, prosciutto-crudo | ルッコラ・生ハム・粉チーズ | CURRENT_ENGINE | 3 素材。最優先 |
| 2 | `jamon-serrano-pizza` | arugula, mozzarella, prosciutto-crudo | ルッコラ・生ハム | CURRENT_ENGINE | |
| 3 | `california-style-pizza` | arugula, avocado, fresh-tomato, goat-cheese | ルッコラ | DATA_ONLY | |
| 4 | `prosciutto-funghi` | mozzarella, mushroom, prosciutto-crudo | 生ハム | CURRENT_ENGINE | |
| 5 | `shirasu-pizza` | lemon, mozzarella, shiso, whitebait | 大葉・レモン | DATA_ONLY | #587 の中継証跡あり（§5）。**ladder step 54 で出荷済み** |
| 6 | `pesto-caprese` | basil, fresh-tomato, mozzarella | バジル | CURRENT_ENGINE | |
| 7 | `melanzane-pizza` | basil, eggplant, mozzarella | バジル | CURRENT_ENGINE | |
| 8 | `parmigiana-pizza` | basil, eggplant, mozzarella, parmigiano | バジル・粉チーズ | CURRENT_ENGINE | |
| 9 | `baba-ganoush-pizza` | eggplant, olive-oil, parsley, pine-nuts | オリーブオイル・パセリ | CURRENT_ENGINE | |
| 10 | `vongole` | clam, garlic, olive-oil, parsley | オリーブオイル・パセリ | DATA_ONLY | |
| 11 | `new-haven-apizza` | clam, garlic, olive-oil, parmigiano | オリーブオイル・粉チーズ | CURRENT_ENGINE | |
| 12 | `eggplant-ricotta-pizza` | eggplant, mint, olive-oil, ricotta | ミント・オリーブオイル | DATA_ONLY | 出荷側は olive-oil が `PAINT_TEMPORARY`（Batch 7a）。後乗せの油とソース層の油を区別して読む（§4） |
| 13 | `pizza-feta-eliniki` | black-olive, feta, fresh-tomato, olive-oil, oregano | オリーブオイル・オレガノ | DATA_ONLY | #614 では「低」。本書で引き上げ |

### P2（2）
`pesto-salmone`（cream-cheese, lemon, salmon — レモン）、`spinach-artichoke-pizza`（artichoke, cream-cheese, mozzarella, parmigiano, spinach — 粉チーズ）。

### P3（10）
オレガノ: `calabresa-argentina`, `chilean-napolitana`, `frango-catupiry`, `ratatouille-pizza`, `brazilian-calabresa` / ローズマリー: `new-zealand-lamb-pizza`, `porchetta-pizza` / 卵: `aussie`, `full-english-pizza`, `pizza-portuguesa`。

### P4（20）
`bacalhau`, `bambino`, `brazilian-catupiry-corn-pizza`, `jalapeno-popper-pizza`, `palmito-pizza`, `pesto-gamberi`, `pesto-patate`, `pesto-pollo`, `pesto-tonno`, `pesto-trapanese`, `pesto-vegetariana`, `pizza-moscow`, `pizza-overload`, `polish-kielbasa`, `puttanesca-pizza`, `salsiccia-e-friarielli`, `spanish-chorizo-pizza`, `tonno-e-cipolla`, `vegan-cashew-cheese-pizza`, `veggie-supreme-pizza`。
注: ペスト系 7 行のペストは焼成前提と仮定されているが未確認。P1 の確認時に 1 件（`pesto-pollo` 推奨）だけ「ペストを焼成後に垂らすか」を見て、家族単位の扱いを決める。生トマト（`fresh-tomato`）の時機も P1 確認の副次項目として記録する。

### 追加の再走査（監査表で「再確認せず」とされた 2 行）
`hawaiian`、`pizza-bianca-ricotta`（olive-oil・rosemary を含む）は個別ページ由来だが、**後乗せ記述の有無は未走査**（#614 §3）。P1 の後に、すでにある原典記録を読み直して `postBake` 記述の有無だけ確認する（新規取得は不要な場合がある）。

## 4. 原典確認チェックリストと判断基準

各レシピで、個別ページ（URL は比較表のリンクから特定。**slug を推測しない**）に対して次を行う。

1. ページ URL、取得者、取得日時（UTC）、取得方法（直接取得／Owner の端末／中継）を記録する。
2. 材料ごとに、**短い原文引用**と位置（本文／質問箱／写真キャプション）を記録し、次のいずれかに分類する。

| 区分 | 採用する条件（すべて原文に基づく） |
|---|---|
| 焼成前 | 「載せて焼く」「生地にのせ…焼く」など、焼成前に置くことが読み取れる |
| 焼成中 | 焼成途中での追加（「途中で」「焼成末期に」）が明記 |
| 焼成後 | 「焼き上がり後」「焼成後に載せ」など、焼成後に置くことが明記 |
| 加熱済み（別調理） | 別途加熱してから載せる |
| 記載なし | 時機の記述がない。**推測で埋めない** |

3. 判断基準（誤読しやすい点）:
   - 「仕上げに〜」「〜を絞る／かける」は**動作の記述**。その材料の時機とは同一視せず、そのまま引用して「記載なし」または「要判断」とする（shirasu のレモンが該当）。
   - 「仕上げ**数分前**にのせる」は焼成末期の可能性があり、**焼成後と断定しない**（shirasu のしらす）。
   - オリーブオイル: ソース層に塗る（焼成前）のか、焼成後に回しかけるのかを区別する。ゲームの `PAINT_TEMPORARY` は前者の表現。
   - 複数方式の併記（サーモン「載せて焼く」と「別に加熱」）は単一の時機に潰さず、そのまま併記する。
   - 比較表の材料一覧に無い材料が個別ページにあれば別途記録する（材料集合の差分）。
   - 画像の説明や引用の無い要約だけでは「確認済み」にしない。
4. 「焼成後」が明記された材料があるときだけ `LATE_ADDITION` の根拠候補とする。「記載なし」は分類を変えない。
5. 分類の変更は matrix 側（`ROW_MECHANIC_EVIDENCE`）とゲーム側（`applicationPhase`）で**別の判断**にする。

## 5. 証跡の区分（確認済み／未確認）

| 区分 | 定義 | 件数 |
|---|---|---|
| A. 独立確認済みの一次資料 | Claude Code または Owner が個別ページを自ら取得し、原文・取得日時を記録 | **0** |
| B1. ChatGPT 中継 | ChatGPT が 2026-10-20 に取得（#584 コメント・#587）。短い引用以外は要約。独立再取得なし | ikura-salmon（引用 1）、shirasu-pizza（引用 2） |
| B2. Owner 申告（#614 本文） | 「Owner 確認 2026-10-21」。ikura のサーモンは加熱、いくらと大葉は焼成後。**原文の逐語記録・取得者の再取得ログは本リポジトリに見当たらない** | ikura-salmon |
| C. 比較表のみ | 材料一覧のみ。時機の情報なし | 45 |
| D. 未確認 | 上記のいずれでも工程が分かっていない | 45（B1 の 2 件も工程全体は未確認） |

B1 / B2 は A ではない。B1 と B2 は同じ事実（ikura のいくら・大葉が焼成後）を指しているように見えるが、取得経路が別か同一かは記録から分からない。**独立した 2 件とは数えない**。

| レシピ | 中継された内容 | 状態 |
|---|---|---|
| `ikura-salmon-pizza`（#584、main 未出荷、HOLD） | いくらと大葉は焼成後。サーモンは両方式（#587）／加熱（#614）。クリームチーズは時機の記載なし | 未確認（中継）。#614 は matrix を訂正済み（未 merge）。表現が「両方式」と「十分に加熱」で異なる点は要約の差で、原文で確定する |
| `shirasu-pizza` | レモン「仕上げにレモンを絞る」（動作）。しらす「仕上げ数分前にのせる」（焼成後と断定できず）。大葉は指定なし | 未確認（中継）。現行分類の変更根拠なし。維持 |

## 6. 原典確認後の実装影響の分類

原典確認の結果ごとに、触れる範囲を次の段階に分ける。いずれも**別 PR・別の Owner 判断**で、本計画では実施しない。

| 結果 | matrix | 生成器・下流 | 分類（taxonomy） | ゲーム実装 |
|---|---|---|---|---|
| I0. 全材料「焼成前」または「記載なし」 | 変更なし | なし | なし | なし |
| I1. 焼成後が明記（出荷済みレシピ） | `ROW_MECHANIC_EVIDENCE` に 1 件追加。行は FULL/PARTIAL 変更 | `tools/progression2_mechanic_matrix.py` を再生成し、下流（phase2 / phase34 / DH4-2 / RT01）も再生成。`--check` / `--check-runtime` | 通常は影響なし（材料の family は変わらない） | **別判断**。出荷済みの `applicationPhase: POST_BAKE` 化は FINISH が本番 OFF のため発見・進行に影響（#615 参照）。既存セーブの Dex・Research の cohort・Hint 5.0 ladder golden への影響を先に確認 |
| I2. 焼成後が明記（未出荷・HOLD の #584 ikura） | #614 が訂正済み | 同上 | 影響なし | #584 の再設計は #615（後乗せカタログ基盤）の上で別 PR。ladder step は main で採番 |
| I3. 焼成中・焼成末期 | 現行の `LATE_ADDITION` モード（`post_bake`）に当てはまらない可能性。新モードの要否は設計判断 | 新モードなら生成器の拡張 | なし | 仕様追加。Owner Decision が必要 |
| I4. 方式が複数併記（サーモン等） | 採用する方式を Owner が決める。既定は焼成前維持 | なし | なし | なし |
| I5. 材料集合が比較表と異なる | `ingredients` の訂正は master evidence 側の変更。172 の同一性（collision）に影響し得る | 重複解析・deadlock 解析の再実行 | family・Research cohort が動く可能性 | 出荷済みレシピなら cohort letter 変更の再監査 |

共通の注意: 出荷済みレシピを後乗せ化すると、FINISH OFF の本番では完成できなくなる（#615 の実験: 全 Vitest 23 件失敗、うち 8 件は進行不能）。`postBakeFinish` の matrix 訂正（データ）と `applicationPhase`（ゲーム）は**分離**し、前者のみを先に行える。

## 7. 取得結果（URL・引用・取得日時）

**なし。** `https://pizzadb.jp/pizzas/ikura-salmon/` への接続を 2026-10-21 に試行したが、プロキシが CONNECT を拒否した（HTTP 403）。他の個別ページも同一ホストのため到達できない。取得できていないものを、引用や要約で埋めていない。

## 8. 次の調査担当への引き継ぎ表

確認担当は pizzadb.jp に到達できる環境（Owner の端末、または到達可能なセッション）が必要。各行は取得後に「URL／引用／取得者／取得日時（UTC）／独立確認の有無」を記入する。

| 順 | recipe | 確認する素材 | 現行 matrix | 現状 | 確認先 |
|---|---|---|---|---|---|
| 1 | `ikura-salmon-pizza` | 全文（サーモン方式、クリームチーズ、分量、焼成時間） | #614 で訂正済み（未 merge） | B1 + B2、未確認 | `https://pizzadb.jp/pizzas/ikura-salmon/` |
| 2 | `shirasu-pizza` | 大葉、レモン、しらす、モッツァレラの時機と前後の原文 | 後乗せなし | B1 部分 | `https://pizzadb.jp/pizzas/shirasu-pizza/` |
| 3–7 | `rucola-e-grana`, `jamon-serrano-pizza`, `california-style-pizza`, `prosciutto-funghi`, `pesto-caprese` | ルッコラ・生ハム・バジル・粉チーズ | 後乗せなし | 未確認 | slug は比較表 `https://pizzadb.jp/compare/world-pizzas/` から特定（リポジトリに記録なし） |
| 8–13 | `melanzane-pizza`, `parmigiana-pizza`, `baba-ganoush-pizza`, `vongole`, `new-haven-apizza`, `eggplant-ricotta-pizza`, `pizza-feta-eliniki` | バジル・オリーブオイル（塗る／回しかけ）・パセリ・ミント・粉チーズ | 後乗せなし | 未確認 | 同上 |
| 14–15 | `pesto-salmone`, `spinach-artichoke-pizza` | レモン・粉チーズ | 後乗せなし | 未確認 | 同上 |
| 16–25 | P3 の 10 行 | オレガノ・ローズマリー・卵 | 後乗せなし | 未確認 | 同上 |
| 26 | `pesto-pollo`（サンプル） | ペストの時機 | 後乗せなし | 未確認 | 同上 |
| 27–28 | `hawaiian`, `pizza-bianca-ricotta` | 後乗せ記述の有無（既存記録の読み直し） | 後乗せなし | 個別ページ由来、未走査 | 既存記録 |
| 29– | P4 の残り 19 行 | 時機の一括確認 | 後乗せなし | 未確認 | 同上 |

### Owner / 他 PR 担当への連絡事項（本計画では変更しない）
1. #614: `brazilian-calabresa` を「172 行なし」とした誤り。比較表のみの対象は 45 件（44 ではない）。監査表 JSON に追加が必要。
2. #612 と #614 の優先度基準の差（§2）を、どちらかに統一するか。
3. #587 → #612 / #614 の取り込み順。matrix の ikura 訂正は #614 がすでに含む。#612 の「#587 取り込み後に再生成」という想定と順序が食い違うため、先に取り込む PR を決める。
4. #614 の Codex レビューは実行中（`430f354`、本書作成時点）。
5. `pizza-bianca-ricotta` のように id で結べない行の alias 対応表を、監査 JSON に持たせるか。

## 9. 本書が確認できていないこと
- 個別ページの内容（上記のとおり 0 件）。
- 各 PR の CI の最終状態（#614 は Codex 実行中、#615 は `mergeable_state: unstable`）。
- GitHub 上の claim ブロックの網羅的な検索。
- #614 の diff 内容の検算（matrix 集計の増減 FULL 101→100 など）。PR 本文の記載を引用しただけ。
