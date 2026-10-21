# FINISH FIN-E1 — 後乗せレシピの安全ガード整備（テスト・検証コードのみ、本番では不活性、#294 / TQ-2 #604）

base `main` `8fc56e0`（FIN-D #603 merge 後）。Owner 承認: FIN-E を E1〜E5 に分割、**今回は E1 のみ**。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` 無変更）。
新食材・新レシピ・本番データの追加なし。reducer・`finishEngine`・UI・CSS・save・共有 Preview・#518・#581 / #478 / #584 は無変更。TQ-2 Issue は **#604** を起票（既存 Issue との Duplicate Gate 済み）。

## Duplicate Gate

- open PR 24 件を確認。FINISH のカタログガード・`recipeBatchValidator`・合成カタログを触る PR / Issue / claim なし。
- 重なりうるもの: #584（Batch 8c）は `recipeBatch.validator.test.ts` / `recipeBatchManifest.ts` / `lunchRush.exclusion.test.ts` / `cookingProfiles.test.ts` / `catalogLedger.test.ts` / `recipes.ts` を触る。本 PR はそれらを**一切編集せず**（検証ロジックは `testSupport/recipeBatchValidator.ts`、テストは新規ファイル）、`CatalogView` の新フィールドは optional のため #584 の view 構築とも衝突しない。#581 / #478 は無関係。
- TQ-2 Issue: 「TQ-2 / 後乗せ技法 / late-addition / 調理法」で検索し既存なし（TQ-1A〜1D は closed）→ #604 を起票（親 #294、本文に決定済み事項・未決定事項・E1〜E5 の順序）。

## 変更

| ファイル | 内容 |
|---|---|
| `src/logic/catalog/testSupport/recipeBatchValidator.ts` | (1) `WIRED_STEPS` に FINISH を追加（配線済みだが後乗せレシピ限定）。(2) `validateFinishCatalog` を追加し `validateCatalogTables` から呼ぶ。(3) `CatalogView` に optional の `dinnerTargetIds` / `referencePieceCount`（`productionCatalogView` が実データで埋める） |
| `src/logic/catalog/testSupport/syntheticLateCatalog.ts`（新規・test support） | 後乗せレシピ 1 件を足した合成カタログ（既存食材のみ、`RECIPES` には入れない。TQ-1C の前例） |
| `src/logic/catalog/finishCatalogGuards.test.ts`（新規 19 件） | 下表のガードが「本番では空振り」「合成カタログでは効く」ことを固定 |

### 追加したガード（`validateFinishCatalog`）

| ガード | 検出するもの |
|---|---|
| `FINISH_WITHOUT_LATE` / `LATE_WITHOUT_FINISH` | プロファイルの FINISH と後乗せ要件の不整合（どちらの向きも） |
| `LATE_WITH_CUT` / `TAB_CEILING` | FINISH + CUT = 7 タブ（OD-CS-9 a）、およびカタログ全体のタブ上限 |
| `LATE_IN_LUNCH_RUSH` | 後乗せレシピが `lunchRush:false` を付け忘れた（プールは opt-in が既定で、FINISH は Lunch Rush では走らない） |
| `LATE_IN_DINNER` | Dinner ミッションが後乗せレシピを対象にした（UD-I。構造検証 `validateDinnerMissions` は通ってしまうことをテストで明示） |
| `LATE_NOT_TOPPING` | 後乗せ食材が scatter のトッピングでない（FINISH はトッピング専用、液体は #579） |
| `LATE_BOTH_PHASES` | 同じ食材を焼成前と後の両方で要求（2 つの piece 集合を区別できない） |
| `LATE_NO_REFERENCE` | Reference が無い、または後乗せ食材の Reference piece が要求数に満たない（Scoring 2.0 が読む） |

在庫: 後乗せ食材の在庫 0 / 要求数未満は着手不可（`isRecipeCookable`）、未所持は在庫があっても不可、FINISH の配置は在庫ちょうどまで（焼成前 piece は二重に数えない）を固定。

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | PASS |
| oxlint | 新規警告なし（既存警告のみ） |
| vitest 全体 | 493 files PASS / 1 skipped、9101 tests PASS（2 skipped, 6 todo は既存）。FIN-D 時点の 9082 から +19 |
| ミューテーション | `WIRED_STEPS` から FINISH を外す → 「合成の正常レシピが通る」が落ちる。`LATE_IN_LUNCH_RUSH` を無効化 → そのテストが落ちる |
| 本番不変 | 既存の `validateCatalogTables(productionCatalogView())` が空のまま。全 `RECIPES` で後乗せ要件 0・FINISH 0・タブ上限内。`finishD2Inert` / `finishEngine` / `gameReducer.finish` は無変更で PASS |
| e2e / HV | 不要（テスト・検証コードのみ。見た目・操作は変化しない。HV Policy §2） |

## E1 の範囲外（残り）

- E2: 識別（`late` 軸の観測・`LATE_ADDITION`・技法「後乗せ」・near-miss・Hint gate 再監査）→ #604。
- E3: Free Cooking 仕上げタブ（UD-B）。E4: データ（bbq-sauce / cilantro / ladder / レシピ / Reference / アイコン）と有効化 OFF ゲートの設計。E5: 有効化と実機 HV。

## 残ブロッカー（Owner 判断・次の PR）

1. **識別**: 発見カタログは必須食材の集合だけで識別し `late` 軸は固定。後乗せレシピを足す前に E2 が必要（Free Cooking で焼成前配置が一致してしまう）。
2. UD-G（技法の名称・なぞかけ・Dex 文言。仮称は「後乗せ」）、UD-F（新素材の価格・星条件）。
3. 有効化 OFF ゲートの方式（データ層で非表示 / フラグ）。E4 の前に決定が必要。
4. FINISH + CUT は 7 タブで不可（CS-4 が先）。後乗せレシピは CUT なしに限る。
5. 焼成前に後乗せ食材を置くと在庫だけ消費される仕様の可否。
6. 四角天板 × FINISH は未検証（D2-2a が範囲外と明記）。

## Final Gate（PR 作成時点）

required CI（WebKit shard 含む）・Codex レビュー・未解決スレッド・mergeability は PR 作成後に確認して別途報告する。merge は Owner の明示承認を待つ。
