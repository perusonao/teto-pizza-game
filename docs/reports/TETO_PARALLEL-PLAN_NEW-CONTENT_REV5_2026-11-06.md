# 並列開発計画 Rev 5 — 実装中心への移行（実装 PR の予定・開始条件）

2026-11-06、main `ed159e9`。merge・Production ON・共有 Preview 更新・他セッションの claim 変更・claim 競合中のカタログ編集は**していない**。

## 0. Fresh Audit で判明した新しい状況（重要）

| 対象 | 状況 | 本計画への影響 |
|---|---|---|
| **#773（新工程比較）** | **3 セッションの claim が同じ枠に重なっている**: C1＝本セッション（`session_013m8Cb6ytubmsQ6BE4u2aec`）、C2＝`session_016YrGhzbsrVhiNzbpNMvk6k`（統合判断書 `TETO_NEW-PROCESS_INTEGRATED-DECISION_773.md`）、C3＝`session_016YrGbyeQ9FbHW8BswNtjKa`（調整案 `TETO_CLAIM-RECONCILIATION_773_2026-11-06.md`）。主担当の選択は Owner 判断待ち | **本セッションは #773 の追加作業を止める**。Owner が主担当を決めたら、本セッションの #773 claim を自分で release する（自分の claim なので可） |
| **#577（DOUGH_VARIANT）** | C2 のセッションが **PD-1a**（`isDoughKind` を `DOUGH_KINDS` 参照にする語彙の一般化のみ、値は追加しない）を claim（`doughKind.ts`・`doughKind.test.ts`、〜11-20）。Owner 承認済み（統合判断書 §4.3・§4.4） | **DOUGH_VARIANT の最初の実装 PR は PD-1a で確定済み**。本セッションは重複して作らない（§5） |
| **#726／#738** | 別セッション（`session_013m8Cb3UeRV2Cw1f2vLVaHm`）が Owner の明示指示で、元の claim と同じ session ID で claim を**代行更新**（〜11-13）し、`78de12a` を push | #748 にも同じ「代行」の前例が使える（§1 の経路 B） |
| **#748** | release 投稿なし（最新は解放依頼 6687040558） | §1 |

## 1. #748 claim 解放の経路（最短順）

保有セッション: `session_013m8Cb66Bu5f1XXHC2xCiLL`（「TETO Pizza Game コンテンツ拡張」、IDLE、接続なし、別セッションからのメッセージ受信は可能）。既存の依頼コメント（6687040558）に**重複コメントはしない**。

| 経路 | 手順 | 所要 | 備考 |
|---|---|---|---|
| **A（推奨・最短）** | Owner が Claude アプリで「TETO Pizza Game コンテンツ拡張」セッションを開き、下の文を送る | 1 操作 | 保有者自身が release を投稿する正規の手順 |
| B（代行） | Owner が本セッション（または別セッション）に「#748 の claim を同じ session ID で release として代行投稿してよい」と明示指示 → 指示されたセッションが release ブロックを 1 件投稿 | 1 指示 | #726 の代行更新（6688326470）と同じ前例。**明示指示があるまで投稿しない** |
| C（Owner 宣言） | Owner が #748 に「この claim は失効」と書く | 1 コメント | 保有者を介さない |
| D（待つ） | 期限 2026-11-19T00:00Z の自然失効 | 約 12 日 | 非推奨 |

**経路 A で送る文（コピペ用）:**
```
#748 の claim（session_013m8Cb66Bu5f1XXHC2xCiLL、branch claude/teto-pizza-game-content-9ctr2x、期限 2026-11-19）は、PR #759 が merge 済みで役目を終えました。
#748 に、同じ session と issue で "released": true の teto-claim:v1 ブロックを 1 件だけ投稿してください（files は従来のまま）。
既存の解放依頼コメント（6687040558）への返信として短く 1 件だけにしてください。コード・PR・他の claim は変更しないでください。
```

**経路 B の release ブロック（Owner の明示指示があった場合のみ投稿する。今は投稿しない）:**
```
<!-- teto-claim:v1 {"session":"session_013m8Cb66Bu5f1XXHC2xCiLL","issue":748,"pr":759,"branch":"claude/teto-pizza-game-content-9ctr2x","files":[],"dependsOn":[],"released":true} -->
```

## 2. 実装 PR の予定（順序つき）

| # | PR | 担当 | 開始条件 | 追加される数 |
|---|---|---|---|---|
| 1 | **ハーブ 4 種 配線 PR**（#417、`TETO_HERB-GLYPHS_Wiring-PR-Plan.md`、patch 検証済み） | S3（本セッション） | #748 解放、新 claim、Owner GO | 0（絵の改善） |
| 2 | **Batch 19**（#774、burrata＋2 レシピ） | S1 | §3 のチェックリスト | 食材 1・レシピ 2 |
| 3 | **PR-B20-0 walnut SVG**（未配線） | S3 | **なし（#748 と無関係に先行可）**。Owner の着手 OK | 0 |
| 4 | **Batch 20-A**（食材 PR → レシピ PR、または 1 PR） | S1 | B19 merge、B20 Issue と claim、Owner GO | 食材 2・レシピ 1 |
| 5 | **PD-1a**（#577、語彙の一般化） | **C2 のセッション（claim 済み）** | Owner 承認済み | 0（準備） |
| 6 | PD-1b／PD-1c／PD-2／piadina | #577 の担当 | G5〜G8 の Owner 判断（§5） | 工程 1（別管理）・レシピ 1 |
| — | #738 STEAM | 保有者 | CI 完了 → Owner iPhone HV → merge 承認 | 調理方法は本番 ON（通常プレイで使用可能）で 1 |
| — | late | 設計のみ | — | 0 |
| — | FRY F2 | HOLD 維持 | #738 merge・eggplant 絵・F2 GO | 0 |

## 3. Batch 19（#774）実装開始チェックリスト

- [ ] **C1** #748 の claim が解放されている（§1）
- [ ] **C2** ハーブ配線 PR（§2 #1）が **merge 済み**（Owner 方針: ハーブ統合前の B19 実装は禁止）
- [ ] **C3** B19 の新 claim が成立（#774 に投稿。files: `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`referencePizza.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`orders.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`IngredientGlyph.tsx`・golden・`expansionBatch19.test.ts`・`e2e/b19.spec.ts`・Result。HOT（`recipes.ts`・`App.css`）は merge 順を明記）
- [ ] **C4** 最新 main・open PR・claim の再確認（SESSION-OPERATIONS §1、Duplicate Gate）
- [ ] **C5** Owner の明示 GO（Q3）
- [ ] **C6** burrata の候補 SVG（`claude/burrata-preflight-docs-8auzii` `d39a680`、案 C）が取得できることを確認
- [x] **C7** #759 merge（Q4）・#760・#761・#765 merge
- [x] **C8** 決定済み事項（Prep Rev 5 の D1〜D9・Q1〜Q4、R2 決定）を再質問しない

C1〜C5 がすべて揃うまで実装しない。

## 4. Batch 20-A

引き渡し仕様: `TETO_CONTENT-POOL_B20A_Implementation-Spec.md`（PR 分割、食材・レシピの暫定仕様、受入条件 AC-1〜7、Owner 判断 3 件）。Research の非正準順の変化（一時測定で 9 件）は 1 件ずつ Owner 承認。

## 5. DOUGH_VARIANT — 最初の実装 PR の範囲（確定）

**PD-1a（C2 のセッションが claim 済み・Owner 承認済み）**: `isDoughKind` を `DOUGH_KINDS` 参照にし、コメントを現況に直す。**値・挙動は変えない、3 値目は追加しない**。本セッションは同じ作業をしない。

piadina 1 レシピまでの G5〜G8 を最小化する案（本セッションの提案。#577・#773 の主担当が採否を決める）:

| Gate | 最小化の方法 | piadina までに要る Owner 判断 |
|---|---|---|
| G5 Anti-Oracle | チップは「ふつう／ほかの生地」の 2 個のまま（案 B）。開く条件は「いずれかの生地技法の affordance」 | D-P1 = B（1 問） |
| G6 保存互換 | 3 値目は**選択できるようになるまで保存されない**ので、PD-1b（値の追加、未選択・不活性）までは影響なし。公開時は (b)（#666 merge 済みで条件充足） | D-P4 = (b)（1 問） |
| G7 工程 | 案 P（全て焼成前、late と独立） | D-P3 = P（1 問） |
| G8 原典 | B16〜B19 と同じ「暫定・原典未確認」 | 暫定承認（1 問） |

→ **Owner の 4 問の回答で G5〜G8 をまとめて解除できる**。

## 6. #738 STEAM（新 HEAD `78de12a`）

Codex: **主要な指摘なし**（`78de12a`、コメント 6688513577、summary の `has_unresolved_findings:false`）。CI: classify・Layout Contract Gate・layout-chromium・**WebKit 6 shard・WebKit Gate すべて success**、build も **success**。**CI・Codex とも GREEN** → 次は Owner の iPhone HV（H11 を含む、`TETO_STEAM-738_H11_ReHV_Plan.md` §4）。旧 HEAD の検証は繰り返していない。

## 7. 追加可能な数（Rev 5 時点）

| 区分 | 食材 | レシピ | 工程（別管理） | 調理方法 |
|---|---|---|---|---|
| 今すぐ（条件なし） | 0 | 0 | 0 | 0 |
| #748 解放＋ハーブ配線 merge＋新 claim＋GO 後（B19） | **1** | **2** | 0 | 0 |
| B19 merge＋B20 GO 後（B20-A） | **+2（計 3）** | **+1（計 3）** | 0 | 0 |
| G5〜G8 の 4 問の回答後（PD-1a→1b→2→piadina） | 0 | **+1（計 4）** | **1** | 0 |
| #738 merge＋本番 ON（別承認） | — | — | — | **1** |

**進捗:** 追加食材数 0/8｜追加レシピ数 0/20｜追加調理方法数 0/2｜新工程 0｜実装中: #738（CI・Codex GREEN、Owner iPhone HV 待ち）、PD-1a（別セッション）｜HOLD: B19、B20-A、FRY F2、late 実装｜merge 済み（起点以降）: #753（docs）。
