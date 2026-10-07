# Research 2.0 Phase 2 / S4 / FAILED — Result Report（Status Sync・事後記録）

- Base main: **`2c9dc2811c87c06128f183f089d9fc13bc388ace`**（PR #410 merge 後）。実装コミット自体は下表のとおり、それ以前に main へ入っている。
- 性格: **docs-only の事後記録**。本書の作成時点で Research の runtime 挙動・catalog・ladder・save schema は変更していない（同 PR の src 差分は stale な `UNWIRED` コメントの修正のみ）。
- authority: [`TETO_RESEARCH-2.0_OWNER-DECISIONS.md`](../decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md)（OD-R1-1〜4 / OD-R3-1〜3 / INV-B1〜B9）、[`TETO_ANTI-ORACLE-CONTRACT_2.1.md`](../decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md)。
- 根拠: [`TETO_RESEARCH-TRAY_FRESH-AUDIT_2026-10-07.md`](./TETO_RESEARCH-TRAY_FRESH-AUDIT_2026-10-07.md)（実コードの静的読解）。下記は commit message と main のコードから確認できる事実のみを記す。
- 本書は件数（recipe / ingredient / ladder step）を固定値で書かない。必要なら `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` から導出すること。

## 1. 実装済みの範囲

| 区分 | main 上の commit | 内容 |
|---|---|---|
| Phase 0 / 1 | #402（`a0bc900`） | Owner Decisions + Stable Research Identity（D+ Cohort Letter）。`researchEntryLabel` が唯一の label authority。詳細は [`TETO_RESEARCH-2.0_PHASE0-1_Result.md`](./TETO_RESEARCH-2.0_PHASE0-1_Result.md)。 |
| Phase 2 S1〜S3 | `3ceb7d1` | S1 Board read model、S2 ×ledger の保存、S3 RESULT の NEGATIVE row からの書き込み + state / App 配線 + DEV State Editor の ledger 保持。 |
| Phase 3 / S4 | #405（`c967c23`、仕上げ `218b56a` / `668d6ac`、merge `6826b89`） | Trial Notebook sheet 上部の Board section。 |
| Phase 4 FAILED | `fbbed9c` | bake-FAILED の Research trial が ○× を開示し、Notebook に記録し、ledger に書く。 |

## 2. Phase 2（S1〜S3）

- **S1 `src/logic/discovery/researchBoard.ts`**: Board read model。入力は開示済み情報のみ（Dex、`ownedIngredientIds`、保存済み `discoveryHintFacts`、保存済み `researchExclusions`）。出力は ✓ 確定 / ✗ 除外 / △ 購入済み class・総数。試行回数・最終試作・Technique・残り候補・件数・カテゴリ結論は**型として表現できない**（group は 1 行以上を持つ tuple 型）。Hint 層 / Technique / Trial Notebook を import しない（`researchBoard.gate.test.ts` で固定）。現行 recipe 定義と矛盾する stale な × は**表示時に静かに外し**、保存値は書き換えない。
- **S2 `src/state/researchExclusions.ts` + `persistence.ts`**: top-level 加算 key `researchExclusions: { [recipeId]: string[] }`（値は bare な ingredient id）。`schemaVersion` は 2 のまま・migration なし。recipe ごとの集合 union（削除しない）、**専用 cap**（recipe あたり id 数と recipe 数。`MAX_STORED_HINT_FACTS_PER_RECIPE` は流用しない）、**空なら key を書かない**、未知 id / 未知 key は forward-compat で持ち回る、全リセットで消える。`discoveryHintFacts` には × を入れない（INV-B9）。
- **S3 `gameReducer.ts` / `researchResultRows.ts`**: `researchResultRows` が `persistExclusionIds` を返し、書き込みは RESULT に表示された NEGATIVE row と**同一入力**（INV-B1）。`researchAttemptResult` が `researchExclusions` を返し、REGISTER_TO_DEX の ORIGINAL 系分岐で state に反映、`App.tsx` が `persistProgress` へ渡す。DEV State Editor（`saveMerge.ts`）は stored ledger を `preserveUnknown` と独立に verbatim で持ち回る（`saveMerge.researchExclusions.test.ts`）。
- テスト: `researchBoard.test.ts` / `researchBoard.gate.test.ts` / `persistence.researchExclusions.test.ts` / `gameReducer.researchExclusions.test.ts` / `saveMerge.researchExclusions.test.ts` ほか。

## 3. Phase 3 / S4（Board UI）

- `ResearchBoardPanel.tsx` + `researchBoardCopy.ts` が S1 の read model を描画するだけの純 view（dispatch・保存なし）。`GameScreen.tsx` が `researchBoardOf` で組み立て、`HintSheet` 経由で `TrialNotebookSheet` 上部に置く。
- **対象は現在の Research Target 1 件のみ**（Readiness Audit の OD-RBF-1 = A 案）。複数 target の一覧は未実装。
- Board は保存された情報であることを caption で明示し、session-only の試作履歴とは別 section。session-only の注記は**試作履歴の直下**に分離（Readiness Audit の C-1 / OD-RBF-2 の解消）。Notebook が空でも Board は表示される。
- 見出しは `researchLabelJa`（label authority）をそのまま使い、Board 専用の識別子・並び・件数を持たない（INV-B7）。カテゴリ結論・「なし」・Technique は DOM / aria に出ない（INV-B3 / B4）。
- テスト: `ResearchBoardPanel.test.tsx`、`researchBoard.gate.test.ts`（S4 で拡張）、`e2e/discovery-research-result.spec.ts`。360×800 / 390×844 の screenshots は `docs/reports/screenshots/research-board-s4*/`。

## 4. Phase 4（FAILED, OD-R3-1〜3）

- 位置: `gameReducer.ts` の `CONFIRM_BAKE` 非 MATCHED 分岐（BAKE→RESULT は 1 回きり）。`freeCook.kind === "FAILED"` かつ `hasPlacedIngredient(pizza)` のとき、ORIGINAL と**同一の** `researchAttemptResult`（membership ○×）を使い、`recordFailedResearchAttempt`（`trialRecord.ts`、同一 fingerprint / feedback / `#n` model）で Notebook に記録し、`discoveryHintFacts` / `researchExclusions` / `lastResearchRows` を state に反映する。
- 材料ゼロの空 pizza は何も開示・記録しない。**在庫は従来どおり消費**（OD-R3-2）。**Technique・recipe 発見・Dex・Pitz は付与しない**（FAILED は登録分岐に到達しない）。
- UI: `ResultPanel.tsx` の FAILED カードが、Research 中のとき ORIGINAL と同じ ○× panel・「研究中」label・重複通知・「試作ノート」入口を出す。それ以外の FAILED カードは変更なし。
- テスト: `gameReducer.failedResearch.test.ts`、`trialRecord.gate.test.ts`（拡張）、`e2e/research-failed-trial.spec.ts`。

## 5. 未実装 / 残件（本 PR の範囲外）

| 項目 | 状態 |
|---|---|
| Board の複数 target 表示（OD-RBF-1 の B 案） | Owner 判断 + Human Verification が必要 |
| × 入り DEV preset（OD-RBF-3） | Owner 判断。現状は実プレイで × を出す |
| Issue #358（Discovery 3.2） | 未着手 |
| 53 / 172 population 前の Research identifier Fresh Gate（Owner Decisions §7） | 別 Gate。既存 cohort に recipe を足す batch の前に必要 |
| `PROJECT_HANDOFF.md` の Research 2.0 Phase 2〜4 addendum | #410 merge 後に同期する follow-up（本 PR では触れない） |
| `e2e/support/handPick.ts` の名称（食材庫廃止後も名前だけ残る） | 軽微。rename は多数の spec に波及するため保留 |

## 6. 本 PR（Status Sync）の差分

- 追加: 本書、Fresh Audit report。
- 更新: `TETO_RESEARCH-2.0_OWNER-DECISIONS.md`（status / §2 の Phase 列 / §5 / §6 の状態列 / §8 を実状態へ）。
- コメントのみ: `researchBoard.ts` / `researchResultRows.ts` / `researchResultFeedback.ts` / `researchEntry.ts` の `UNWIRED` 記述を配線済みの実態へ。
- 変更なし: runtime・catalog・recipe・ingredient・ladder・save schema・`PROJECT_HANDOFF.md`。UI/UX/gameplay の変更ではないため Human Verification video は対象外。
