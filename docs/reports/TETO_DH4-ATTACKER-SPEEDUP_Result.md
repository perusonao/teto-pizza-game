# DH4「独立攻撃者」テストの高速化 — Result Report（Issue #687）

基準 `origin/main` = `f243c52`。設計: `docs/design/TETO_DH4-ATTACKER-SPEEDUP_DESIGN_2026-10-27.md`（Owner 承認 2026-10-27）。**merge は Owner の最終承認後。**
**挙動は不変の純関数の内部最適化のみ。** timeout・retry・skip・既存 assertion・探索範囲・既存テストファイルは変更していない（#684 のテストファイル、#679、#686 のブランチにも触れていない）。

## 1. 変更

| ファイル | 内容 |
|---|---|
| `src/logic/discovery/deductionGuard.ts` | A: `ingredientKeyStep` をカタログ由来の定数表に（`INGREDIENTS` の長さが変わったら作り直す＝`ingredientCategoryIndex` と同じ規則。カタログ外 id は表に入れず都度計算）。C: `byCatalogOrder` を「カタログ id 列を Set でフィルタ」に（カタログ外 id・重複があれば従来の sort に戻る）。B: `partitionAllowsDh41` / `dh41Answer` で `ownedCatalogIds` の検証をループ外で 1 回に |
| `src/logic/discovery/deductionHint.ts` | B: 検証済み owned を受ける `attributeAnswerForCleanOwned`（`attributeAnswerForReserve` と同一結果。既存の公開 API は不変） |
| `src/logic/discovery/deductionGuard.speedup.test.ts`（新規 4 件） | 既存 gate が見ない性質を固定: H がカタログ順であること、カタログ外 id・重複を含む owned でも clean な owned と同じ H、key step の絞り込みが元の計算と一致、`attributeAnswerForCleanOwned` ＝ `attributeAnswerForReserve` |
| docs | 本書、設計書（`b1283f3`）、PR-2 の設計 Gate（同ブランチの先行コミット） |

**B は WeakMap 等の memo ではなく hoist。** 結果の保持は無く、「call 間で結果を保持しない」を守る。D（H の 1 回計算）は 40 秒以内を達成したため実施しない。E は実施しない。

## 2. 実測（同一サンドボックス、単独実行）

| テスト | 変更前（main） | 変更後 |
|---|---|---|
| 独立攻撃者（`deductionProduction.gate`） | **91.3 秒** | **31.0 / 31.2 秒（2 回）**／ gate 2 ファイル並列時 29.5 秒（目標 40 秒以内を達成、timeout 120 秒の約 26%） |
| 参考（変更前の並列実行値） | 112.4 秒 | |
| `deductionGuard.gate` の最重 3 本 | 87 / 90 / 52 秒（並列） | 41.1 / 26.9 / 17.5 秒（並列） |

PR-2 仮データでの見込み: 約 +28%（設計書 §8.2 の増分）で約 40 秒。余裕は十分。**PR-2 実データでの再測定は PR-2 側で行う。**

## 3. 同値性の検証

- **GATE_STATES 全件（5,808 状態）の一括比較。** 変更前と変更後で、各状態の `hypotheticalReserves` / `privacyPartitionUniverse` / `strictAnswerForParts` / `partitionAllowsDh41` / `guardedAnswerForParts` / `toppingClauseAllowedForParts` / `endgameAttack`（全 prior・候補・leak）と、**全カタログ 77 食材それぞれを reserve にした仮説 parts での guarded answer・clause・H**を JSON で書き出し、`cmp` で**バイト一致**（md5 `54beb446…` 同一）。比較用スクリプトはテストに残していない（一回限り）。
- **敵対的入力**（カタログ外 id・空文字・重複・逆順・key が未知）約 4,000 ケースで、変更前後の guard（旧ファイルを一時コピー）を比較し完全一致。
- 一時ファイルは全て削除済み。

## 4. mutation 検証

| 変異 | gate 2 ファイル（30 件） | 結果 |
|---|---|---|
| M1 `partitionAllowsDh41` を常に true | 11 失敗 | 検出 |
| M2 `toppingClauseAllowedForParts` を常に true | 13 失敗 | 検出 |
| M3 key step 表を常に 0（最適化の誤り） | 8 失敗 | 検出 |
| M4 `byCatalogOrder` が末尾を落とす | 6 失敗 | 検出 |
| M5 `byCatalogOrder` が逆順 | **30 通過（gate は H の順序を見ない）** | **新規テストが検出（2 失敗）**。M3 も新規テストが検出 |

M5 は既存 gate の盲点（順序）で、今回追加した 4 件のテストが埋める。既存 assertion は 1 行も変えていない。

## 5. その他の検証

| 項目 | 結果 |
|---|---|
| `tsc -b`、oxlint（`src/logic/discovery`） | 通過 |
| Vitest 全体（Pinsa ON） | 9,880 passed / 3 failed（後述）/ 13 skipped / 2 todo |
| Pinsa OFF（`TETO_PINSA_OFF=1`）の pinsaGate・lateCatalog.pinsa・pinsa.production・DH4 gate 2 ファイル・新規・guard / hint 単体 | 8 files / 120 passed。ON でも pinsa 3 ファイル 32 passed |
| 関連 6 ファイル（futureCategory / guard / hint / timing / audit） | 通過（設計時の実験で確認、最終コードでは gate と全体で確認） |

全体の失敗 3 件は**サンドボックスの負荷による timeout**で、本変更と無関係と読める:
- `gameReducer.deductionHint.test.ts`「technique ledger never changes…」: 5,000ms の既定 timeout。**変更前の main でも同じく 5,174ms で失敗**（変更後 5,426ms）。
- `App.allOwnedTray.test.tsx`: 5,000ms。単独再実行で通過。
- `researchAttempt.sim.test.ts`: 600,000ms の timeout（#686 の本文にも同じ超過の記録がある。deduction 系を import しない）。単独再実行も 9 分 30 秒で打ち切り。**変更前での比較は未実施。**
CI の結果で最終確認する。

## 6. 注意・残課題

- 製品コード（privacy guard の周辺）の変更なので、Owner の最終承認と Codex レビューを経る。実行時の挙動は不変（同値性 §3）。
- `keyStepTable` は `INGREDIENTS` の**長さ**で作り直す（既存の `ingredientCategoryIndex` と同じ割り切り）。長さを変えずに食材の `unlockCondition` を差し替えるテストの mock があれば表が古くなる。現在そのようなテストは無い（全体 Vitest 通過）。
- PR-2 の実データでの時間の再測定、D・E（未実施）、全体 Vitest の CI 値は未確認。
- #684 のテスト（全探索）は本変更の恩恵を受ける見込みだが、その実行時間は未計測。
