# Batch 25 — 最新 main 基準の統合候補（読み取り調査の結果と計画）

調査日: 2026-11-16。**読み取り専用**（git の merge-tree による書き込みなしの再現と、GitHub の読み取り API のみ）。merge・rebase・force push・Production ON・共有 Preview 更新はしていません。#862・#860・#841 には触れていません（変更ファイルの重なりも無し）。
基準: `origin/main` = `17603034`（#861、CI のみ。`dba7d733` から 1 コミット先）。

## 1. PR #856／#857／#858 の最新状態
| PR | HEAD | base（PR に記録） | mergeable | CI（HEAD の check runs） |
|---|---|---|---|---|
| #856 I-7 yogurt runtime | `0f3f9a23` | `dba7d733` | **clean** | **11/11 成功**（build 約 28 分、WebKit 6 シャード、Layout、classify） |
| #857 T25 content | `dabfa4c3` | `dba7d733` | unstable（競合なし。CI 失敗のため） | **build 失敗**、WebKit 6 シャードのうち **390×844 shard 1/3 と 360×800 shard 1/3 の 2 シャードが失敗**（残り 4 シャードは成功）、WebKit Gate 失敗 |
| #858 train-kit 修正 | `871616c4` | `dba7d733` | **dirty（競合）** | **check run 0 件**（競合のため CI が起動していない） |
3 本とも Draft／HOLD。前回の確認から HEAD は変わっていません。

## 2. #857 の CI 失敗の原因（ログで確認）
### 2-1. `build`（全 Vitest）の失敗
PR の HEAD は、T25 の実装コミットだけで、**sweep の追従（件数・位置・golden・allowlist）が一切入っていない**ため、全 Vitest が既存バッチのテストで失敗しています。#857 の本文にも「full Vitest は統合後に」とあります。失敗の種類は、私たちが分類したものと同一です（ログで確認した失敗）:
- 件数・位置: `catalogShelf`（sauce 25）、`largeCatalogFixtures`、`researchLabels.batch8a`（84）、`hint5Ladder.baseCompat`（91 ほか）、`selectableHint`（swedish-kebab が 3 段階）、`lateAxis`、`stagedWhatIf.research19`（25）。
- manifest／台帳: `recipeBatch.validator`（8 件。`NO_IDENTITY`／`LADDER_NOT_APPENDED`）、`stagedPromotion.firstTrain`（late の末尾オフセット）。
- staged／golden: `stagedSaveSafety`（asparagus）、`stagedWhatIf.hint`、`stagedRejudge`、`stagedOwnerDecisions`、`stagedCatalog`、`hint5Ladder.alphaReport`／`golden55`、`deductionHint.audit`。
- allowlist／技法: `dexView`、`runtime`、`techniques`（late-addition）、`finishCatalogGuards`（banh-mi は POST_BAKE なし）、`deductionProduction.gate`、`hint5Production.gate`。
- pizza-salad の 2 ソース: `researchResultRows`、`sauceKinds.research`。
- LEGACY 件数: `deductionGuard.gate`（291 → 325）。
- Owner 判断が要るもの: `matcher`（M-2）、`expansionBatch22`（ΔE と Jaccard）。
→ **コード側の不具合ではなく、追従の未実施**。私たちのブランチで全て解消済み（最新は保存済みブランチ `623e2792`）。

### 2-2. WebKit の失敗（390×844 と 360×800 で同じ 3 本）
他の 157 本の E2E は成功しています。失敗は旧バッチの E2E 3 本だけです:
| E2E | 期待 | 実際 | 原因 |
|---|---|---|---|
| `e2e/b22.spec.ts:156`（buffalo-chicken） | `？？？ピザ（バッファローソース）` | `？？？ピザ A（バッファローソース）` | buffalo-cauliflower が同じ cohort に入り、cohort の letter「A」が付く。Research 決定表の「buffalo-chicken: none→A」（D-2 条件付き）と一致する**承認済みの変化** |
| `e2e/b23b.spec.ts:133`（nutella） | step 94 | 95 | ordinary step 81 の追加による既存 late の +1 移動 |
| `e2e/b23b.spec.ts:133`（smore） | step 95 | 96 | 同上 |
**私たちのブランチには、この 3 本の修正が入っていません**（E2E は 160 本あり、私たちが更新・追加したのは T25 関連だけ＝`t25i7` の再生成と `t25i7-yogurt-gestures` の追加。旧バッチを含む全 E2E を一度も実行していなかった**検証漏れ**）。統合前に必ず直す必要があります。

## 3. #858 の競合の原因
- 競合は **`tools/train-kit/lib/codegen.ts` の 1 ファイルだけ**（#861 とは無関係。#858 が記録している base `dba7d733` に対しても同じ）。
- 原因: #858 は #854 の**スカッシュ前のコミット（`1e2d95f8`）**を含む。main には #854 がスカッシュで入っており（`dba7d733`）、内容は `1e2d95f8` と**完全に同一**（差分なし）だが、git はこれを「適用済み」と認識できず、隣接行で `insertBeforeObjectInArray` の追加と衝突する。
- 確認: `1e2d95f8` を土台にした 3-way（`--merge-base=1e2d95f8`）では**衝突 0**。つまり #858 の実体は 2 コミット（`45c68521`、`871616c4`）だけで、これを最新 main に載せれば競合しない。
- 追加の注意: #858 の `src/trainKit/codegen.test.ts` に**型エラー 2 件**（readonly の kit を変更）がある。vitest は通るが `tsc -b`（CI の build）では失敗する。私たちのブランチで修正済み（`79369cf5`）。#858 を単独で CI に通すには、この修正が必要。

## 4. 最新 main への統合の実現性（書き込みなしの再現）
| 対象 → 最新 main | 結果 |
|---|---|
| #856 → main | 競合 0 |
| #857 → main | 競合 0 |
| #857 を #856 の上に（#856 の 2 コミットは #857 に同内容で入っている） | 競合 0 |
| #858 の 2 コミットを #857 の上に（`1e2d95f8` を土台） | 競合 0、ファイルの重なりなし |
| 保存済みブランチ `623e2792` → main | 競合 0（#861 の CI 3 ファイルはそのまま残る） |
他の Draft PR との重なり: #862（`ci.yml`、`test-ci-docs-only.sh`）、#860（`stepOrder.*`）、#841（CI 3 ファイルと step-order の docs）。**Batch 25 の変更ファイルとは重ならない**。ただし #862 の `workflow_dispatch`（指定 SHA の CI）は未 merge のため、今は使えない。

## 5. 統合順序と修正計画（計画のみ・未実施）
内容の正本は、保存済みブランチ `623e2792`（私のブランチ `49fa5aec` を含み、M-2 の Owner 決定 B25-M2-D1〜D4 と検証証跡が追加されている）。
1. **土台**: `origin/main` `17603034`。
2. **#856**: そのまま（競合 0、CI 全成功）。
3. **#858**: `1e2d95f8` を除いた 2 コミット + 型エラー修正（`79369cf5`）。
4. **#857**: T25 の実装 5 コミット（#856 と同内容の 2 コミットは重複なので除く）。
5. **追従と修正**（保存済みブランチの全 sweep・C-1・D・C-2/C-3・T-1/2/3・B-1/B-2・M-2・golden・docs）。
6. **新規の修正（私たちのブランチに無いもの）**: 旧バッチ E2E 3 本の更新（上表。期待値の更新のみで、基準の緩和ではない。b22 は letter「A」を明記、b23b は 95／96）。
7. **全 E2E の実行**（Chromium 390×844・360×800、WebKit 同 2 サイズ。160 本全て）と、全 Vitest、型チェック、lint、build。
8. 同一 SHA での CI／WebKit（PR の check runs）と、その SHA での独立 Codex 再レビュー。
9. iPhone 実機 HV（動画は Owner に直接）。

### 統合方式の選択肢（Owner 判断）
| 方式 | 内容 | 長所・短所 |
|---|---|---|
| **A（推奨）** | 最新 main から**新しい統合候補ブランチ**を作り、新しい Draft／HOLD の PR を 1 本立てる（既存の #856・#857・#858 は触らない） | 既存 PR の履歴を書き換えない（force push 不要）。同一 SHA の CI／WebKit が取れる。PR の作成には Owner の明示依頼が必要 |
| B | 既存 PR のブランチを更新（#857 は追加コミットの push、#858 は main を merge してコンフリクトを解消した merge コミットを push。force push は使わない） | 既存 PR に履歴が残る。#858 の履歴が merge コミット入りになり、#856→#858→#857 の依存を 3 PR それぞれの CI で見るのは難しい |
| C | #856→#858→#857 の順に、それぞれ main へ（Owner 承認後に） | 小さく分割できる。ただし #857 は #858 の仕様（late order の位置）と sweep の追従が同時に要り、単独では GREEN にならない |

## 6. 残るブロッカー（Final Gate）
- 同一 SHA の CI／WebKit GREEN（現状、#857 は失敗、#858 は未実行）。
- 旧バッチ E2E 3 本の修正と、全 E2E の実行（未実施）。
- 保存済みブランチの記録: 全 Vitest で `DexOverlay.discovery.test.tsx` が 30 秒のタイムアウトで 1 件失敗（単独再実行は 5/5 PASS。負荷依存のタイムアウトの疑い）。CI で再現するか要確認。
- L-2 の最終確認: 決定表 L-2 は「6 レシピ統合後に全 step・既存 late の移動・同時 unlock・canonical 0 を再測定し、予期しない変化は再 HOLD」。実測（ordinary 81、late 97〜101、既存 late +1、step 98 で 2 食材、canonical 0、non-canonical 42）は不変条件と一致。**Owner の最終確認が必要**。
- 独立 Codex の最終 SHA での再レビュー（Issue #780 の既存コメントは固定 SHA の 12 ファイル 580/580 PASS で、全 Vitest の独立再現は未達）。
- iPhone 実機 HV、専用 Preview の Batch 25 用ブランチ（共有 Preview は触らない）。

## 7. Owner 判断が必要な事項
1. 統合方式（A／B／C）。A の場合、新しい Draft／HOLD PR の作成の明示依頼。
2. 旧バッチ E2E 3 本の期待値更新（b22 の letter「A」、b23b の 95／96）を、承認済みの変化の追従として行ってよいか。
3. L-2 の最終確認（上記の実測値）。
4. `DexOverlay.discovery` の 30 秒タイムアウトの扱い（CI で再現した場合に、テストのタイムアウトを延ばすのは「緩和」にあたるため、原因調査を先にするか）。

## 8. 必要なプロンプト往復（見込み）
| 回 | 内容 |
|---|---|
| 1 | あなたから: 上の 1〜4 の判断 |
| 2 | 統合候補の作成（main の上へ）、旧 E2E 3 本の修正、全 Vitest・全 E2E（Chromium・WebKit）・型・lint・build をローカルで実行、push |
| 3 | PR 作成後の同一 SHA の CI／WebKit の確認と、指摘の修正 |
| 4 | 別セッションの独立 Codex 再レビュー（最終 SHA）と、指摘の修正 |
| 5 | Owner の iPhone 実機 HV の結果の反映と、最終判断 |
合計 5 往復。判断 1〜4 が遅れる、または CI で想定外の失敗が出ると増えます。
