# 並列開発計画 Rev 3 — 実行結果と更新（docs-only）

2026-11-06、main `3a41bb6`。claim の変更・既存 PR への push・merge・Production ON・共有 Preview 更新・Batch 19 の実装は**していません**。Rev 2 = `..._REV2_2026-11-06.md`。

## 1. 各セッションの成果物

| 枠 | 成果物 | 状態 |
|---|---|---|
| S2（#772） | `TETO_CONTENT-POOL_S2_Result.md`、`data/TETO_CONTENT-POOL_jaccard.{py,json}`、`..._jaccard_matrix-candidates.json` | 完了（静的測定。実装前に実コードで再測定） |
| S6（#773） | `TETO_NEW-PROCESS_S6_Comparison.md` | 完了（採点つき比較、推奨 1 案） |
| S3（#417） | `src/components/herbGlyphs/`（未配線の 4 コンポーネント＋テスト 7）、SVG 原本、before/after モック、`TETO_HERB-GLYPHS_S3_Result.md` | 完了（配線は #748 解放後） |
| S4（#738） | `TETO_STEAM-738_H11_ReHV_Plan.md`（H11 修正は #738 に既存。ローカルのマージ検証・再 HV 範囲） | 完了（#738 へは push していない） |
| #774 未決 7 項目 | 本書 §3 | 整理済み |
| claim | #772・#773・#417 に新規ファイルのみの claim を投稿（#748・#749・#726 は不変） | 完了 |

## 2. #748 claim の解放依頼の状況（重複コメントは投稿しない）

依頼は既に投稿済み: #748 コメント 6687040558（2026-11-06T14:21Z、Batch 19 開始前の claim 確認）。その後の応答コメントは**ありません**。保有セッション（`session_013m8Cb66Bu5f1XXHC2xCiLL`）は IDLE（最終更新 11-05）。**追加のコメントは投稿しません。** 次の手段は Owner の判断（保有セッションを再開して解放を投稿させる／Owner が失効を宣言）で、私は claim を変更できません。

## 3. #774 Batch 19 — 未決 7 項目（SSOT: Prep Rev 5＋R2 決定記録、main）

SSOT で決定済みの事項（D1〜D9・Q1〜Q4、R2 D1〜D9）は再質問しない。未決は次の 7 件だけ:

| # | 未決事項 | SSOT 上の位置づけ | 推奨 | 解消の条件 |
|---|---|---|---|---|
| 1 | Owner の明示 GO（Q3） | Prep §7.0 S-7（必須） | #2・#3 が揃ってから | 全体のクリティカルパス |
| 2 | #748 claim（〜11-19）の解放 | R2 §2.2 の 2 番、Prep §7.0 | 保有セッションに解放を投稿させる。応答がなければ Owner が失効を宣言 | 依頼済み（§2）。応答待ち |
| 3 | ハーブ PR と B19 の merge 順 | R2 §3「順序は実装時に宣言」、Prep §8.3 D5 の推奨はハーブ先 | **ハーブ先**（`IngredientGlyph.tsx`・`ingredients.ts` を共有） | Owner の承認（#774 に一言） |
| 4 | 将来の burrata-pizza（matrix 行 117） | Audit §4.4、C2（5 件目で再判断） | B19 では足さない。別 Issue | B19 スコープ外 |
| 5 | 非正準 Research ラベル差分の個別承認の運用 | Q2・P2・AC-8 | 差分の件数が出てから | 実装後 Phase 3 |
| 6 | HV 用 seed の要否と方式 | Audit §10 の 9 | Phase 5 で提案（別オリジン優先、共有 Preview 上書きなし） | Phase 5 |
| 7 | WebKit 間欠失敗の受容方針（#394・#680） | Audit §10 の 5。B18 の前例は「PASS 扱いにしない」 | 同じ（赤は原因を分ける） | CI 時 |

**開始してはいけない状態:** #748 の claim 未解放、ハーブ PR 未 merge、Owner の GO 未取得。いずれも未成立のため**実装は未開始**。

## 4. S5（FRY F2）— 継続可否（変更なし）

保有セッション（`session_013m8Cb49gBq9AcNooPFsNsB`、#749 claim 〜11-18）は IDLE・完了。F2 の HOLD 条件（#738 merge、eggplant の絵、F2 の GO）は未成立。**今は継続不可**。条件が揃ったら保有セッションの再開が最短。

## 5. 実装可能になった食材数・レシピ数（正直な数）

| 区分 | 食材 | レシピ | 条件 |
|---|---|---|---|
| **今すぐ実装可能（規則上・技術上、Owner の GO なしで）** | **0** | **0** | なし |
| **GO と claim 解放後に実装可能（承認済み仕様あり）** | 1（burrata） | 2（pesto-burrata・crudaiola） | #774 の条件 |
| Owner 判断後に実装可能になる見込み | honey・walnut（pesto-noci 用）／その他は工程が先 | teriyaki（B20 案 A）、pesto-noci（B20 案 B） | S2 §5・§6 |
| 工程の決定後（DOUGH_VARIANT 3 値目） | manakish 用 2、poutine 用 3 ほか | piadina ほか最大 9 | S6 §1 |

**進捗:** 追加食材数 0/8｜追加レシピ数 0/20｜追加調理方法数 0/2｜実装中: #738（Owner 実機 HV 待ち）、#755 系 Draft、#753/#751｜HOLD: Batch 19（#774）、FRY F2｜merge 済み（起点以降）: なし。

## 6. 残るブロッカー

1. #748 claim の解放（依頼済み・応答なし）。
2. Batch 19 の GO。
3. ハーブ配線 PR（`ingredients.ts`）が #748 の解放待ち。
4. #738 の Owner 実機 HV（H11 修正は入っており、実機確認待ち）、保有者の main 取り込み push の承認、#726 claim（〜11-10）の更新。
5. **新工程の決定（S6 の推奨 A: DOUGH_VARIANT、Gate G5〜G8）**。これがレシピ・食材の上限を決める。
6. 「既存食材だけ」で足せるレシピはほぼ残っていない（S2 §1）。目標の 20 は新食材・新工程と一体でしか届かない。

## 7. 更新した最短 merge 順

1. docs: #753、本ブランチの docs（Owner が PR 化を指示した場合）。
2. #748 の解放 → ハーブ配線 PR（S3）→ merge。
3. Owner の GO → B19（burrata＋2 レシピ）→ merge。【食材 +1・レシピ +2】
4. #738：保有者の取り込み push（承認）→ CI → Owner の実機 HV → merge。【調理方法は数えない（本番 OFF）】
5. S6 の Owner 決定（A または B）→ 該当工程の Gate。
6. B20（teriyaki または honey＋walnut＋pesto-noci）。
7. S5 FRY F2。
