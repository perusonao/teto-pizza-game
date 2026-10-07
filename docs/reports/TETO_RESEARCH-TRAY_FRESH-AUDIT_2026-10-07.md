# Research Tray — Fresh Audit（READ-ONLY / docs-only）

- Audited main: **`b67723bf2f2c6ebd53da59525cf5be563836a3b3`**（`origin/main`、PR #409 merge、2026-10-07）
- Branch: `claude/research-tray-fresh-audit-c4sjgq`（本ファイル 1 つだけを追加。production code 変更なし）
- 手法: 静的読解のみ（`node_modules` なし。test / build / CI / Preview は実行していない）。
- 並行作業の保護: PR #410（head `c6e3a11`）は **checkout / merge / rebase / push していない**。diff の読み取り（`git diff origin/main...c6e3a11 --name-only`）のみ。Final Gate の判定はしていない。
- 用語: repo に「Research tray」という名称は無い（grep 0 件）。本書は **Research 2.0 の研究記録面（Research Board / ×ledger / FAILED 記録 / Trial Notebook）と、Research が使う Cooking Tray（FREE_COOK と同じ tray）** を指すものとして監査した。

## 0. 結論

| 項目 | 結果 |
|---|---|
| Research 2.0 Phase 0〜4 | **すべて main に実装済み**（#402 / S1〜S3 `3ceb7d1` / S4 `c967c23`＝#405 / FAILED `fbbed9c`）。 |
| 最大の問題 | **docs が実装に追従していない**。Owner Decisions は Phase 2〜4 を「未実装」、PROJECT_HANDOFF は Research 2.0 を addendum 5 の「Phase 1 / PR pending」で止まっており、S1〜S4・FAILED の Result Report が存在しない。コード上の「UNWIRED」コメントも古い。 |
| production の不具合 | 静的読解の範囲では **発見なし**（P0/P1 なし）。 |
| 次の最小スライス | **docs-only の Research 2.0 Status Sync**（Result Report 追加 + 状態表の更新）。 |
| PR #410 待ちの間に進めて安全か | **安全**（ただし HANDOFF の addendum 追記だけは #410 merge 後に回す。§5）。 |

## 1. 現在地（実装済み / 未実装）

| 領域 | 状態 | 根拠（main） |
|---|---|---|
| Stable Research Identity（D+ Cohort Letter, OD-R2-1〜5） | 実装済み | `researchEntry.ts` `researchEntryLabel`（唯一の label authority）。letter は導出のみ・save しない。 |
| ×ledger `researchExclusions`（OD-R1-2, INV-B1/B2/B9） | 実装済み | `src/state/researchExclusions.ts`、`persistence.ts`（top-level 加算 key、schemaVersion 2 のまま、空なら書かない、専用 cap 256 ids / 512 recipes）。`researchResultRows` が `persistExclusionIds` を出し、RESULT 表示と同一入力。 |
| Board read model（OD-R1-1/3/4, INV-B3/B4/B7） | 実装済み | `src/logic/discovery/researchBoard.ts`（○ / × / △ のみ。件数・Technique・残り候補は型として表現不能）。import 境界は `researchBoard.gate.test.ts` で固定。 |
| Board UI（Phase 3 / S4） | 実装済み（**現在の Research Target 1 件のみ**） | `ResearchBoardPanel.tsx`、`TrialNotebookSheet` 上部。OD-RBF-1 は (A)「現在の研究対象のみ」で実装。footer（session-only 注記）は履歴の直下に分離済み（OD-RBF-2 / C-1 解消）。 |
| FAILED 記録（Phase 4, OD-R3-1〜3） | 実装済み | `gameReducer.ts` `CONFIRM_BAKE` 非 MATCHED 分岐（`hasPlacedIngredient` かつ FAILED → `researchAttemptResult` + `recordFailedResearchAttempt`）。在庫消費・Technique / Dex / Pitz 非付与は従来どおり。テスト: `gameReducer.failedResearch.test.ts`、`e2e/research-failed-trial.spec.ts`。 |
| DEV State Editor の ledger 保持（OD-RBF-3 既定） | 実装済み（保持のみ） | `saveMerge.ts` が stored ledger を verbatim 持ち回る（`saveMerge.researchExclusions.test.ts`）。preset への × 追加は未実施（Owner 判断事項のまま）。 |
| Research が使う Cooking Tray | 変更なし・整合 | FREE_COOK と同一。#408 で全 owned 一覧（食材庫廃止）。Research / Board は hand に依存しない（`TETO_ALL-OWNED-COOKING-TRAY_Result.md` §1-6）。 |
| 未実装 | Board の複数 target 表示（OD-RBF-1 の B 案）、× 入り DEV preset（OD-RBF-3）、Issue #358（Discovery 3.2: 選択 LOCK / 未使用 bake 確認 / Research context 維持 / 発見 CTA 整理）、53 / 172 population 前の Research identifier Fresh Gate（Owner §7） | |

## 2. 発見した問題

| # | 区分 | 内容 | 影響 |
|---|---|---|---|
| F-1 | docs STALE | `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md` の status 欄・§2 の実装 Phase 欄・§8 の表が Phase 2〜4 を「未実装」、Phase 0/1 を「本 PR」と記載。実際は全 Phase が main に存在。§6 の「Phase 2 まで × は session のみ」も現行挙動ではない（× は ledger に保存される）。 | 次セッションが「未実装」と誤認して重複実装する恐れ。 |
| F-2 | docs 欠落 | `PROJECT_HANDOFF.md` に Research 2.0 Phase 2〜4 の addendum が無い（addendum 5 は「PR pending Final Gate」「Phase 1 (this PR)」のまま）。S1〜S3 / S4 / FAILED の Result Report ファイルも無い（`research-board-s4*` の screenshots だけが存在）。 | SSOT が実装状態と不一致。Fresh Audit・Final Gate の根拠が commit message のみ。 |
| F-3 | docs STALE | `docs/reports/TETO_RESEARCH-BOARD_IMPLEMENTATION-READINESS_Fresh-Audit.md` は「Phase 3 = HOLD / OD-RBF-1/2 待ち」のまま（結果的に A 案で解決済み）。履歴文書なので書き換えず、新しい Result からの参照で足りる。 | 軽微。 |
| F-4 | code コメント STALE | `researchBoard.ts` 冒頭 「UNWIRED: no reducer, UI, save or Notebook reads this module yet (… Phase 3 / S4)」は S4 で配線済み。`researchResultRows.ts` / `researchResultFeedback.ts` も「UNWIRED … (S2 / S4 / S5 wire it)」のまま。 | 読み手を誤誘導（挙動への影響なし）。コメントのみ修正で済む。 |
| F-5 | 命名 | `e2e/support/handPick.ts`（`chipOnTrayOrPin`）は食材庫廃止後も名前だけ残る。中身は tray の page 送りで正しく動く。 | 軽微。rename は 17 spec に波及するので今は不要。 |
| F-6 | 固定値の確認 | Research 系テストの数値 pin を確認: `researchCohortLetter.test.ts` の 28 / 27 は合成 clone の件数、`persistence.researchExclusions.test.ts` の 172 は cap 検証用の合成値で、現行 catalog 件数に依存しない。stale な固定値は**見つからず**。 | 問題なし。 |
| F-7 | 事前通知 | 今後 recipe が増えるため Owner §7 の trigger（53 / 172 population、既存 cohort への追加）に近づく。現在 33 recipes。PR #410 の 3 recipe は ladder step 30〜32 で、それぞれ新規の単独 unlock 材料（pine-nuts / prosciutto-crudo / green-pepper）→ **既存 cohort の letter を動かさない**（`recipeBatch.validator.test.ts` が cohort identity を検査）。 | #410 自体は §7 に抵触しない。**次以降の batch** が既存材料を最後の unlock にする場合のみ Fresh Gate が必要。 |

privacy / contract の再確認（読解範囲）: label は unlock 名 + letter のみ（INV-B7）、Board にカテゴリ結論・「なし」・Technique・件数が出ない型（INV-B3/B4）、× は `discoveryHintFacts` に入らない（INV-B9）、schema bump なし。違反は見つからなかった。

## 3. 次の実装候補（依存順）

| 順 | 候補 | 種別 | 依存 | 備考 |
|---|---|---|---|---|
| 1 | **Research 2.0 Status Sync**: Result Report（Phase 2 S1〜S3 / S4 / Phase 4）追加、Owner Decisions の status / §2 / §8 / §6 の更新、`UNWIRED` コメント 3〜4 箇所の修正（comment-only） | docs（+ comment-only） | なし | HV 不要（UI/UX/gameplay 変更なし。ただし src を触る場合は comment-only を diff で明示）。 |
| 2 | PROJECT_HANDOFF の Research 2.0 addendum（Phase 2〜4 と本 audit の要約） | docs | 1 | #410 が HANDOFF を触る可能性があるため **#410 merge 後**。 |
| 3 | OD-RBF-3: × 入り DEV preset | devtools（Owner 判断） | Owner 回答 | `presets.ts` は ladder 長に連動する preset を含むため #410 merge 後の方が安全。 |
| 4 | Board の複数 target 表示（OD-RBF-1 B 案）／ Issue #358 | UI / gameplay | Owner 判断 + HV | HV 動画（390×844）必須。今は着手しない。 |
| 5 | 53 / 172 population 前の Research identifier Fresh Gate | docs（Gate） | 次 batch の設計 | 既存 cohort に追加する batch の前に。 |

## 4. PR #410 との競合可能性

PR #410（head `c6e3a11`）の変更ファイル: `src/data/{discoveryCatalog,discoveryLadder,ingredientTaxonomy,ingredients,orders,recipeHintRoles,recipeSauceProfiles,recipes,referencePizza}.ts`、`docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`、および catalog 件数に追従するテスト / e2e（計 50 ファイル）。

| 候補 | 触るファイル | #410 との重なり |
|---|---|---|
| 1 Status Sync | `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`、新規 `docs/reports/TETO_RESEARCH-2.0_*_Result.md`、`src/logic/discovery/{researchBoard,researchResultRows,researchResultFeedback}.ts`（コメントのみ） | **なし**（#410 の変更ファイルと交差しない） |
| 2 HANDOFF addendum | `docs/PROJECT_HANDOFF.md` | 現時点の #410 diff には無いが、#410 が Final 時に追記する可能性あり → **merge 後に回す** |
| 3 preset | `src/devtools/presets*.ts` | #410 は未変更。ただし ladder 長を参照する preset / test が連鎖し得る → merge 後 |
| 4 UI | `TrialNotebookSheet` / `GameScreen` / `App.css` | 重ならないが HV / Owner 判断が必要で、#410 の待ち時間で閉じない |

## 5. 提案と安全性

- **提案する次の 1 スライス: Research 2.0 Status Sync（docs-only + comment-only）**。main に何の挙動変更も入れず、SSOT を実装に一致させる。
- **#410 の CI 待ち中に進めて安全か: 安全。** 変更ファイルは #410 と交差せず、catalog / ladder / save schema に触れない。注意点: (a) 新ブランチは origin/main から切り #410 のブランチには触れない、(b) PROJECT_HANDOFF の addendum は #410 merge 後、(c) Result Report の件数表現は「現在の catalog」ではなく導出元を引用し、`33 recipes` のような固定値を書かない（#410 で 36 になる）。
- 本セッションでは実装を開始していない。着手には Owner の GO が必要。
