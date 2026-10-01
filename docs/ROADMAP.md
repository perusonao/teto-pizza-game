# Teto Pizza Game — ROADMAP（現在の優先順位・active lane・next slice）

> **DRAFT（初稿）。** この文書は audit branch 上の提案で、main にはまだ無い。Owner が採用を決めるまで、`PROJECT_HANDOFF.md` と Issue #22 は変更しない。
>
> **この文書の役割は「いま何を優先し、次に何をするか」だけ。** architecture と運用の引き継ぎは `docs/PROJECT_HANDOFF.md`、GitHub 上の短い索引は Issue #22、各 slice の要件と受け入れ条件は個別 Issue、監査と証拠は `docs/reports/` が持つ。**この優先順位を他のファイルに全文コピーしない**（リンクする）。
>
> **Fresh GitHub / main の状態がこの文書より優先される。** 古くなったら、この文書を直す PR を出す。

- **Last updated:** 2026-10-01
- **Audited main:** `a0201e35473ea0f7d27bf9d1c054587b4cfe23e2`（2026-10-01 に PR-1/2/3 の merge を反映）（この時点から main が進んでいたら、先に fetch して差分を確認する）
- **Owner Direction 記録:** `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`

## 1. Owner Direction（要約）

1. **Recipe Discovery を、現在の最優先 product lane にする。** 中心体験は「新しいレシピを自分で推理して発見する」。
2. 曖昧な「近い / 遠い」を Discovery の中心情報にしない。key-topping（キートッピング）は Discovery Hint authority から廃止する方向。
3. ヒントは sauce/base・cheese・材料数・材料分類（・実装済みなら technique）から、**レシピの構造に応じて**構成する。sauce なし / cheese なし / 特殊工程へ拡張できる形にする。
4. Trial Notebook は履歴ではなく、次の試作を考える実験ノートにする。
5. 「1 unlock = ちょうど 1 レシピ」を必須にしない。複数の未知レシピへ枝分かれする Discovery を作る。**ただし候補レシピ名を並べる選択式にはしない。**
6. Discovery の基盤を整えたら、代表的な新食材・新レシピを小さな Expansion Pack として足し、Discovery → Expansion を vertical slice で繰り返す。
7. CUT-S2 は凍結。CUT の将来の目的は、standalone の CUT score ではなく、総合 pizza score の quality component への統合。
8. trajectory / CUT-S3 は現在の最優先ではない。
9. Large Catalog は Recipe Expansion を支える lane だが、Discovery の設計を止めない。
10. Dough Guide Leak Fix（PR #321）は独立した Gate lane。

## 2. 優先順位と lane

| P | Lane | 状態（main `a0201e3` 時点） | 次の slice | blocker | 並行 |
|---|---|---|---|---|---|
| **P0** | **Recipe Discovery 3.0** | **S0 / S1 / S2 Gate COMPLETE。PR-1 #322 MERGED（`ae62bb6`）、PR-2 #323 MERGED（`500fca7`）、PR-3 #324 MERGED（`a0201e3`）。Discovery foundation for first branching = COMPLETE**（main `a0201e3`、post-merge Deploy / WebKit green。#324 の WebKit は 1 件の browser-closed で attempt 1 が失敗し、再実行で green） | **Pre-PR4 Gate**（production 実装なし。25→26 の scratch dry-run） | Pre-PR4 Gate の結果、OD-D3-24 | — |
| **P0** | **Discovery Minimum Loop**（attempt → 行動につながる情報 → Notebook → Hint → retry → Discovery → Dex） | attempt・near/far（互換）・Hint 5.0（production ON）・Notebook の記録と重複通知（P3-3b）・Dex は main。Notebook 一覧、差分 / 整合表示は無い | S2 の後に Notebook 一覧（P3-3c）と差分 / 整合表示 | OD-D3-7（near/far の再評価）、OD-D3-8（あと少しの再現） | S2 と並行可 |
| P0 | ↳ **S2 first branching validation**（brazilian-calabresa、pool = 2） | PR-1 / 2 / 3 は MERGED。**PR-4 = still NO-GO**（Pre-PR4 Gate 待ち。brazilian-calabresa は未追加） | Pre-PR4 Gate → PR-4（または 4a / 4b） | OD-D3-24（quantity / bake / placement は未決）、pool > 1 のテスト基盤の実測 | — |
| P1 | **Unlock / Discovery Density** | W1 の ladder（24 step）は 1:1 で凍結。互換性の境界として維持 | post-W1 レシピで branching。ladder 加速の解決方式を決める | OD-D3-17 | 測定のみ並行可 |
| P1 | **Large Catalog** | LC-R3 / R5-b は main。R5-c〜e-h は休眠。PR #319（R6-b）が open | PR #319 の review、R6-c の準備 | hand capacity 9 / 12 は未決（R6 の Human Feel） | 並行可 |
| P1 | **Cooking Steps / Techniques foundation** | TQ-1A/1B/1C は main（inert）。TQ-1D 未着手。Cooking Steps の設計は PR #295（未 merge） | PR #295 の review、CS-1b の再開判断 | PR #295 の Owner review、OD-D3-12 | 並行可 |
| P1 | **Recipe Expansion Pack 1** | 案のみ（`docs/reports/TETO_DISCOVERY-3_FRESH-AUDIT.md` §8） | brazilian-calabresa（S2）から。新食材は taxonomy の決定後 | P0 の S1 / S2、OD-D3-11、taxonomy（PR #296 は authority ではない） | S2 と同じ slice で開始 |
| 反復 | Discovery 改善 → Expansion → Discovery 改善 → … | — | 各回で S1 の計測を回す | — | — |
| 低 | CUT total-score integration | CUT-S2 は凍結（専用 branch に記録） | なし | Owner 方針（凍結） | 着手しない |
| 低 | trajectory / CUT-S3 | CUT-S2 の HV の持ち越し項目 | なし | 凍結 | 着手しない |
| 低 | BAKE feel | M3A は merge 済み | なし | 優先度外 | — |
| 低 | Dinner expansion | DM-4-3 まで main。親 #257 | なし | 優先度外 | — |
| **独立** | **PR #321 Dough Guide Leak Fix** | open。Owner HV PASS の記載あり。CI の WebKit 待ち | Owner の merge 判断のみ | — | 完全に独立 |
| 独立 | Large Catalog の既存 open PR（#319） | open | review | — | 独立 |

## 3. Discovery 3.0 の進め方

```
S0 Owner Decisions（完了）
 → S1 Measurement / Migration Gate（完了）
 → S2 Implementation Gate（完了）
 → PR-1 oracle の無効化 #322 （MERGED）┐
   PR-2 O3（ladderCredit） #323 （MERGED）  ├ 並行可 → PR-4 brazilian-calabresa の追加（NO-GO、Pre-PR4 Gate 待ち）
   PR-3 key-free Hint #324      （MERGED）  ┘
 → 以降、Discovery 改善 ↔ Expansion Pack を縦に反復
```

- **S0:** `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`（採用済みの決定と未決）。
- **S1:** 計測・migration 評価・再現テストの gate（完了）。production の挙動は変えない。
- **S2:** 実装前の gate を済ませ、4 PR に分割した（Gate レポート §12）。**1 つの巨大な PR にしない。**
- **Discovery Minimum Loop** は、S2 で pool = 2 が成立した後に Notebook と feedback を仕上げる順序で進める。

## 4. 凍結・保留

| 対象 | 状態 | 再開の条件 |
|---|---|---|
| CUT-S2（Shadow 評価） | **凍結**。`claude/cut-scoring-audit-drh1e2` に記録（Owner HV PASS、tolerance 決定、trajectory の再 HV 項目） | Owner が CUT の総合 score への統合を優先に上げたとき。統合の形は「quality component」（standalone の CUT score は product goal にしない） |
| trajectory / CUT-S3 | 保留 | CUT-S2 の再開後 |
| Issue #288（CUT skill score） | open。本文は「独立表示」案を含み、最新方針と合わない（更新案: proposal §3） | Owner 承認後に本文を更新 |
| Hint 5.0 の KEY_TOPPING | production ON のまま。廃止は migration を伴う | S1 の migration 評価と Owner の決定 |
| near/far（P2） | production で稼働（互換）。再評価の対象 | S1 の漏洩量の評価 |
| 「図鑑のピザまであと少し」 | production で稼働（互換）。oracle の疑いあり | S1 の browser 再現テスト |
| no-sauce の production レシピ / Hint の technique 情報 | TQ-1D が前提。P4-SAUCE は予約 | OD-D3-12 |
| multi-spread / late-add | 機構がどの lane にも無い（late-add / post-bake は PR #295 の設計対象） | PR #295 の review 後に lane を決める |

## 5. main にない authority の索引

main にはないが、決定や設計を含む場所。**どれも merge するまで main の authority ではない。**

| 場所 | 内容 | 扱い |
|---|---|---|
| PR #295 | Cooking Steps の設計、Owner Decisions（OD-CS-1 = A、OD-CS-2 = B、OD-CS-9、OD-CS-20）、CS-1a | open。Owner review まで merge しない |
| PR #296 / #293 / #255 | 172 レシピの taxonomy / HCG | open。自身が「authority ではない」と明記 |
| `claude/cut-scoring-audit-drh1e2` | CUT-S2 の記録 | PR なし。凍結 |
| PR #321 | Dough Guide Leak Fix | open。独立 Gate |
| PR #319 | LC-R6-b（Preview 用 Hand 活性化の基盤） | open |
| `claude/recipe-discovery-3-audit-t823yu` | Discovery 3.0 の audit / decision / 本 ROADMAP の初稿 | audit branch |
| `claude/cooking-techniques-design-n0qfwj`（`ab77b82`） | 172 行の technique audit | design archive |

## 6. 新セッションの読み順

1. `git fetch origin main`、open PR / Issue を確認する。fresh の状態が文書より優先される。
2. `CLAUDE.md` → **この文書**。
3. 取り組む lane の節を `docs/PROJECT_HANDOFF.md` で読む（Hint 5.0 / Large Catalog / Techniques など）。
4. その lane の最新の Result / Audit report と、個別 Issue の受け入れ条件を読む。
5. UI / UX / gameplay を変えるなら `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う。

## 7. この文書の更新ルール

- lane を閉じる、または優先順位を変える PR は、この文書の該当行を更新する。
- 状態欄には、**根拠（SHA・PR・report）を書く**。根拠のない「完了」を書かない。
- 設計の詳細・Owner Decision の本文は、この文書に書かず、decision / report にリンクする。
