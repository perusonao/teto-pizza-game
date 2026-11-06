# #773 の claim 重複と成果物の比較・release 依頼案（docs-only）

作成: 2026-11-06 / 基準 `main` = `ed159e9` / ブランチ `claude/teto-pizza-issue-773-nlyntr` / Refs #773
性質: 確認と文案のみ。**他セッションの claim は変更していない**（投稿・編集・解除なし）。release 依頼は**文案**で、投稿していない。
「推奨」は助言であり Owner Decision ではない。

## 0. 結論（先に）

1. **#773 には有効な claim が 3 件あり、全て同じ S6 の枠。** うち 2 件は同じ内容の比較書をそれぞれ別ブランチに push 済み。**成果物は 3 つに分かれている**（C1 は 54 行、C2 は 187 行、C3＝本セッションは Owner 方針の元になった比較書）。
2. **訂正（本セッションの誤り）:** 本セッションの claim コメント（#773、15:31Z）に「先行 claim のブランチ・PR は見つからず」と書いたが、**ブランチは実在した**（`claude/teto-pizza-parallel-plan-sh894e`、`83c066f`）。確認したのは open PR だけで、ブランチを確認していなかった。事実の誤りであり、#773 に訂正コメントを投稿する（§5）。
3. **主担当の一本化案（助言）:** 案 X = C3 を主担当にして S6 の成果物を 1 本に絞る（C2 は release、C1 は S6 分だけ縮小）。案 Y = C1 を主担当にして C3・C2 が release する。どちらでも**最終選択は Owner**。本セッション（C3）が当事者で、利益相反があるため、案 Y も同じ重みで併記する。
4. **claim 競合が解消するまで、#773 の範囲の新規ファイル追加・実装は止める。** 本セッションは本書と後続 2 本（D1 仕様、#577 解放条件）の docs で最後にし、以降の追加は Owner の選択を待つ（後続 2 本は `#773` の glob 外で、#579・#577 に紐づく別トピック）。

## 1. #773 の claim 一覧（全て Owner アカウントの投稿で有効）

| 記号 | session | 投稿 | branch（push 済み head） | claim の `files` | 期限 |
|---|---|---|---|---|---|
| C1 | `session_013m8Cb6ytubmsQ6BE4u2aec` | 2026-11-06 15:17Z | `claude/teto-pizza-parallel-plan-sh894e`（`83c066f`） | `docs/reports/TETO_NEW-PROCESS_*`（glob） | 11/20 |
| C2 | `session_016YrGhzbsrVhiNzbpNMvk6k` | 15:30Z | `claude/teto-pizza-issue-773-61yp79`（`f9b1ab6`） | `docs/reports/TETO_NEW-PROCESS_CANDIDATE-COMPARISON_773.md` | 11/20 |
| C3（本セッション） | `session_016YrGbyeQ9FbHW8BswNtjKa` | 15:31Z | `claude/teto-pizza-issue-773-nlyntr` | `docs/reports/TETO_NEW-PROCESS_Candidate-Comparison_2026-11-06.md` | 11/20 |

- C1 の glob は C2・C3 のファイルを**包含**する（同じ名前空間）。ファイル名は異なるため、同一ファイルの編集競合は無いが、**同じ成果物を 3 本作った重複**になっている。
- PR は 3 つとも未作成。open PR との HOT ファイル重なりは無い（全て docs-only）。
- C1 のブランチには S6 の比較書 1 本のほかに、並列計画 Rev 1〜3、S2 候補プール、S3 ハーブ SVG／未配線コンポーネント（`src/components/herbGlyphs/*`）、S4 の H11 再 HV 計画など**計 17 ファイル**がある【実測】。#773 の claim の範囲は S6 の比較書だけで、他は別 Issue（#772・#417 など）の claim と読める。**未確認**: それらの claim 全文は読んでいない。

## 2. 成果物の比較

| 項目 | C1 `TETO_NEW-PROCESS_S6_Comparison.md` | C2 `..._CANDIDATE-COMPARISON_773.md` | C3 `..._Candidate-Comparison_2026-11-06.md` |
|---|---|---|---|
| 規模 | 54 行 | 187 行 | 約 200 行 |
| 推奨 | **A: DOUGH_VARIANT 3 値目**（15 点、次点 FRY・PREP 13、late 12）。ゲーム性重視なら B（late） | **A: Dough Kind（ピアディーナ）**（59 点）。ミニゲーム重視なら ZONED・炒め | **DRIZZLE**（59 点）。DOUGH_VARIANT（61 点）は新工程でないとして除外 |
| 解放数の根拠 | `CONTENT-POOL_S2` の静的ゲート（Jaccard ≤ 0.4 など）通過行。DOUGH 9 行 | 新食材 0・ブロッカー 0 の「clean」。DOUGH 単独 5 行＋複合 5 行 | 新食材 0・非 BLOCKED。DOUGH 5 行 |
| 未出荷行数 | 記載なし | 94（概算） | 約 94（概算）。C2 と一致 |
| DRIZZLE の必須行 | 7 行（late 系の再掲） | 0（価値監査どおり） | 0 |
| ZONED | 0 行（`quattro-stagioni` は `funghi` を内包し `capricciosa` と Jaccard 0.71 で禁止） | 1 行（clean） | 1 行（READY） |
| 新規 Issue | 作らない | 作らない（#577 に紐づけ） | 作らない（#579 に紐づけ） |
| 受入条件・Issue 案 | 次タスクの表のみ | PD-1 の Issue 案と受入条件 8 項目 | D1 の Issue 案と受入条件（本日の D1 仕様で確定版へ） |
| 固有の価値 | 並列計画との整合、「数え方」3 案 | PD-1〜4 の PR 分割、感度分析 | DRIZZLE の設計、#579 の 3 ゲート |

**一致している事実:** 未出荷 94 行／DRIZZLE が必須の行は 0／FRY・STEAM・MULTI_SAUCE・PAN_BAKE は既存の追跡に任せる／新規 Issue は作らない／新食材 0 で解放できる DOUGH 行は 5 行前後。
**食い違い（Owner 方針で整理済みの点を除く）:**
- 推奨が割れた（A ×2、DRIZZLE ×1）。**Owner は 2026-11-06 に DRIZZLE を第一候補、DOUGH_VARIANT は新工程の数に含めずレシピ拡張として別進行と決定**した。C1・C2 の推奨 A は、この決定と食い違う（本書の主担当選定後、その成果物に決定の注記が要る）。
- ZONED の解放数（C1 は 0、C2・C3 は 1）。C1 の「`funghi` を内包し `capricciosa` と Jaccard 0.71」は、C3 の §4 が見ていない識別面の制約である。**C3 の「quattro-stagioni 1 行」は「識別の近さで禁止の可能性あり」と読み替える**（本セッションでは Jaccard を再計算していない＝未確認）。
- DOUGH の解放数（C1 は 9 行、C2・C3 は 5 行）。C1 は食材追加が要る行（manakish・poutine ほか）と BLOCKED 行を含む。基準が違うだけで矛盾ではない。

## 3. 一本化の選択肢と推奨

| 案 | 主担当 | release する側 | 利点 | 懸念 |
|---|---|---|---|---|
| **X（助言）** | **C3** | C2 は全面 release。C1 は `TETO_NEW-PROCESS_*` の claim を S6 の比較書の分だけ外す（他の Issue の claim は触らない） | Owner 方針と成果物が一致。D1 仕様・#577 条件（後続 2 本）が同じブランチにある。DRIZZLE 前提の Issue 案と受入条件が最も詳しい | 本セッションが当事者（利益相反）。C1 の S6 比較書（A 推奨）は main に入れない扱いになる |
| Y | C1 | C2・C3 が release | 先着で、広い glob と並列計画を持つ。計画書全体との整合 | S6 比較書が A 推奨で、Owner 決定（DRIZZLE）と食い違うため、C1 が改稿する必要がある。D1 仕様・#577 条件の docs の居場所が別に要る |

- どちらの案でも、**C1・C2 の比較書は削除せず、ブランチに残して参考資料とする**（本セッションはそれらを編集しない）。
- 一本化後、主担当は PR を 1 本だけ作る（docs-only）。merge は Owner 承認。
- Owner 判断（O-C1）: **X か Y か、または別の担当**。助言は X。ただし利益相反があるため、Owner が C1・C2 の担当に確認してよい。

## 4. release 依頼の文案（投稿していない。投稿は各 session 本人か Owner）

### 4.1 案 X で C2 に依頼する文（#773 コメントとして）
> S6 の比較書が 3 セッションで重複しています。Owner が主担当を `session_016YrGbyeQ9FbHW8BswNtjKa`（branch `claude/teto-pizza-issue-773-nlyntr`）にした場合、`session_016YrGhzbsrVhiNzbpNMvk6k` の claim の release をお願いします。ブランチ `claude/teto-pizza-issue-773-61yp79` は削除せず、参考資料として残してください。release 後に追加のファイル・PR は作らないでください。
>
> ```
> <!-- teto-claim:v1 {"session":"session_016YrGhzbsrVhiNzbpNMvk6k","issue":773,"pr":null,"branch":"claude/teto-pizza-issue-773-61yp79","files":[],"released":true} -->
> ```
> （上は例示のコードフェンス内で、そのままでは有効にならない。本人が `<!-- ... -->` を fence の外に書いて投稿する。）

### 4.2 案 X で C1 に依頼する文
> `session_013m8Cb6ytubmsQ6BE4u2aec` の #773 claim（`docs/reports/TETO_NEW-PROCESS_*`）は、S6 の比較書の分を主担当（C3）に引き継いだ形で、ファイル範囲から `TETO_NEW-PROCESS_S6_Comparison.md` を外して再投稿するか、release をお願いします（同じ session + issue の新しいブロックで更新）。並列計画（Rev 1〜3）など他の Issue の claim は対象外です。`TETO_NEW-PROCESS_S6_Comparison.md` は削除せず、Owner の決定（DRIZZLE 第一候補、DOUGH_VARIANT は別進行）の注記を付けるかどうかは担当にお任せします。

### 4.3 案 Y で C3（本セッション）が自分の claim を release する文（Owner が Y を選んだ場合のみ、本セッションが投稿できる）
> 本セッションの #773 claim（`session_016YrGbyeQ9FbHW8BswNtjKa`、branch `claude/teto-pizza-issue-773-nlyntr`）を release します。成果物は branch に残します（PR なし）。後続の D1 仕様（#579）と #577 解放条件は別ファイルで、引き継ぎ先の担当が参照できます。

### 4.4 応答がない場合
SESSION-OPERATIONS §1 の期限は最長 14 日（11/20）。C1・C2 が IDLE の場合は、Owner が「失効」を宣言するか、保有セッションを再開して release を投稿させる。**本セッションは他者の claim を変更できない**。

## 5. 本セッションがやること・やらないこと

- 投稿する（自分のコメントの訂正）: #773 に「先行ブランチは実在した」「claim が 3 件」「一本化は Owner 判断待ち」を 1 件。
- 投稿しない: C1・C2 への release 依頼（Owner の選択後。文案は上）。
- 開始しない: #773 の範囲の追加の新規ファイル、D1 を含む実装。
