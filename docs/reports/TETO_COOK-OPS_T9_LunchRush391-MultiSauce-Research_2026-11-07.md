# T9 — Lunch Rush（PR #391 を含む）と複数ソースの採点・保存への影響（読み取り調査）

Status: **docs-only の調査。コード・テスト・既存 docs の変更なし。共有 Preview 未更新。PR・merge・Production ON なし。#391 への書き込みなし（読み取りのみ）。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06` / Issue #784 / claim: #784 コメント 6706450380（`TETO_COOK-OPS_T9_*`）。
根拠: Owner 決定 #784 コメント 6706418089（Lunch Rush #391 と複数ソースの採点・保存への影響を docs-only で調査）。前回 `TETO_COOK-OPS_T9_SA-Impact-Plan_Stars-LunchRush-MultiSauce_2026-11-07.md` の Q3・Q4 の未確認を解消する。

## 0. 結論（先に）

1. **前回の記述の訂正**: Impact Plan §2 Q4 は「複数ソースの本番 recipe は現行では無い見込み」と書いたが**誤り**。**`grandma-pizza`（グランマピザ）が `RECIPES` に実在**する（tomato-sauce＋olive-oil の 2 ソース、四角い天板、`ladderCredit: false`、**`lunchRush: false`**）。主ソース（tomato-sauce）が Reference 対象で、副ソース（olive-oil）は**「使った／使わない」だけ**で採点される。
2. **Lunch Rush の本番の採点は v1**（`lunch-rush-v1`、180 秒）。run のスコア＝`served×100 + Σ品質`。**品質（0〜100）はクライアントが報告する値で、サーバーは再計算できない**（範囲チェックのみ）。したがって**入力方式（スタンプ等）が品質や所要時間を押し上げても、サーバーは検知できない**。LR では**品質より「速さ（1 皿あたりの秒数→served の数）」の効果のほうが大きい可能性**がある（後述）。
3. **PR #391（Lunch Rush v2 PR-A）は 2026-10-04 から更新のない open PR**（インフラのみ。ゲームは変更せず、本番クライアントは v1 を送り続ける）。v2 は**ソースと無関係**（`wrongIngredientTypes` による係数 1／0.8／0.64）。**S-A とは直接衝突しない**が、v2 の採点は同じ `qualityTotal` を使うため、**品質が押し上がる入力は v2 でも同様に効く**。
4. **複数ソースで S-A を使うと、reducer が上限超過のバッチを丸ごと拒否する**ことが分かった（`exceedsSauceCaps`: 1 種 1.0・全体 2.0）。自然ジェスチャは tick ごとに残量を見る（`getHeadroom`）ので超えないが、**スタンプは自前で残量を守る必要がある**（M1 は単一ソースの上限 1.0 のみ考慮）。
5. **四角い天板（grandma-pizza）ではソース成分の採点が丸い生地と違う**（`sauceMetricsForPan`／`sauceTargetForPan`）。S-A の配置・R の測定（丸い生地を前提）は**そのまま使えない**。

## 1. Lunch Rush の現行の採点【コード実測・main `06cfc06`】

| 項目 | 内容 | 出所 |
|---|---|---|
| ルールセット | `LUNCH_RUSH_RULESET_VERSION = "lunch-rush-v1"`、`DURATION_SECONDS = 180` | `src/shared/lunchRushScoring.ts:50-58` |
| 1 皿の品質 | `MIN_QUALITY_TOTAL=0`／`MAX_QUALITY_TOTAL=100`。`isValidLunchRushServeRecord` が範囲・型を検証。**値そのものはクライアント報告** | 同 :60-85 |
| run のスコア | `calculateLunchRushMissionScore(serves)`: PASS だけ数え、`score = round(servedCount×100 + totalQualityScore)`。FAILED は 0 | 同 :95-115 |
| 上限 | `MIN_SECONDS_PER_SERVE = 2`→`MAX_SERVES_PER_RUN = 90`（180÷2）。`MAX_SERVES_ARRAY_LENGTH = 200`（ペイロード防御）。**「判断で置いた値で実測ではない」とコードのコメントに明記** | 同 :117-135 |
| 品質の出所 | `finalizeRound` → `computeScoringV2` → `toLegacyScoreBreakdown` の `score.total`。LR の 1 皿の品質＝`state.score.total` | `src/state/finalizeRound.ts:126-127`、`App.tsx`（serve） |
| ラウンド種別 | `RoundKind = GUIDED／FREE_COOK／LUNCH_RUSH／DINNER`。**LR のソース工程も同じ `PizzaStage` を使う**（入力方式の分岐は無い） | `src/state/roundKind.ts` |
| LR に出す recipe | recipe ごとの `lunchRush: boolean`（例: `grandma-pizza`・`curry-pizza-japan` は `false`） | `src/data/recipes.ts` |

**含意（S-A）**:
- 品質の押し上げ（M1 の合成で「自然ジェスチャとの差 約 11 点」→ total で約 5.7）は、**LR では 1 皿あたり +5.7 点**。served の 100 点に比べて小さい（約 5.7%）。
- **より大きいのは時間**: 1 皿あたりの所要時間が短くなれば、180 秒の中で served が増える。**served 1 皿＝100 点超**なので、**スタンプでソース工程が数秒短くなる効果は、品質差よりも run スコアに効く可能性**がある。ソース工程の所要時間（自然ジェスチャは最大約 2.5 秒の連続噴出＋移動）と、スタンプの所要時間（5〜9 回のタップ）の比較は**未測定**。
- サーバー側の防御は「範囲と上限のみ」。**S-A を LR に出すなら、公平性は採点・入力の設計側で担保する必要がある**（サーバーでは守れない）。

## 2. PR #391（Lunch Rush v2 PR-A）【GitHub の記録を読んだ】

| 項目 | 内容 |
|---|---|
| 状態 | open・非 draft・`mergeable_state: unknown`。**作成・最終更新ともに 2026-10-04**（約 34 日、更新なし）。1 コミット、9 ファイル、+722／−16、base `c62db170`（#389 の後） |
| 変更ファイル | `src/shared/lunchRushScoring.ts(.test)`、`src/shared/lunchRushPeriodIds.ts(.test)`、`functions/src/submitLunchRushScore.ts(.test)`、`functions/src/periodIds.test.ts`、`firestore.rules.test.ts`、`docs/reports/TETO_LUNCH-RUSH-V2_PR-A_Infrastructure_Result.md` |
| 内容 | インフラ／サーバー互換のみ。**ゲームの変更なし。本番クライアントは `lunch-rush-v1` を送り、v1 の週間ボードを読む**。v2: `lunch-rush-v2` の識別、`servedValue = (100 + qualityTotal) × factor[w]`（factor 1.00／0.80／0.64、`w` は誤った素材の種類数。**w≥3 は Completion Gate FAILED**）、期間 ID `weekly_v2_*`／`monthly_v2_*`／`all_v2`、サーバーが v1・v2 の両方を受理 |
| ロールアウト | Owner のゲート付き（merge → Firebase Production の verify → functions デプロイ → v1・v2 の受理確認 → PR-B（ゲーム側）。**PR-B はこのリポジトリに無い**） |
| 競合 | 当時の main（`c62db170`）が base。**現在の main とのマージ可否は確認できない**（この環境の履歴が浅く merge-base が計算できない。`mergeable_state` も unknown）。main の `lunchRushScoring.ts` は v1 のまま存在する【実測】 |
| S-A との関係 | **ソース・Reference・Scoring 2.0 には触れない**。S-A と同じファイルを変更しない。v2 の `wrongIngredientTypes` は素材の種類の誤りで、ソースの塗りは無関係 |

**注意**: PR #391 の**中身（差分）は読んでいない**（PR 本文・ファイル一覧・状態のみ）。LR の採点に触れる測定や PR の再開は、Owner が #391 の扱い（再開／閉じる／更新）を決めてから。

## 3. 複数ソースの採点・保存【コード実測】

### 3.1 採点

| 項目 | 内容 | 出所 |
|---|---|---|
| 参照ソース | `recipeSauceProfiles.ts` の**主ソースのみ**（grandma-pizza は tomato-sauce）。**副ソース（olive-oil）は採点対象のプロファイルを持たず、「使った／使わない」で採点** | `recipeSauceProfiles.ts:374`、`recipes.ts`（grandma-pizza のコメント） |
| ソース成分が読む deposit | `sauceOwnDeposits(pizza, referenceSauce.ingredientId)`＝**主ソースの deposit だけ** | `scoringV2/index.ts:357` |
| 四角い天板 | `sauceMetricsForPan(pan, deposits)`／`sauceTargetForPan(pan, referenceSauce)`＝**天板（pan `tray`）では丸い生地とは別の指標・目標**で採点 | `scoringV2/index.ts:354-358` |
| 重み | 通常と同じ（標準プロファイル）。ただし副ソースは成分点に入らないので、**副ソースへのスタンプは成分点を変えない** | 同 |

### 3.2 保存・上限

| 項目 | 内容 | 出所 |
|---|---|---|
| 刻印 | 2 種目のソースが入ると、**すべての deposit に `ingredientId` を刻印**（以前の deposit も遡って）。1 種だけなら刻印なし | `state/sauceLedger.ts`（`planSauceCommit`） |
| 上限 | 1 種 1.0（`SAUCE_MAX_QUANTITY`）、全体 2.0（`SAUCE_TOTAL_MAX_QUANTITY`）。**`exceedsSauceCaps` を満たさないバッチは reducer が丸ごと拒否**（2 種以上のときのみ。1 種のときは分配器の上限だけ） | `sauceLedger.ts`、`gameReducer.ts` `COMMIT_SAUCE_DISPENSE` |
| ジャーナル | `pendingRound` に deposit（`ingredientId` 付き）が入る。上限 64KiB。M1 の実測: 単一ソースの 49〜50 deposit で約 2.8〜3.4KB（約 69 B／deposit）。**刻印付きは 1 件あたり増える**（`"ingredientId":"…"` で数十 B。**見積もり**: 2 種で計 100 deposit なら約 10KB 前後、上限の約 15%。実測ではない） | `state/pendingRound.ts` |
| 油の重なり | 油をソースの上に重ねるときの描画の係数 `SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3`（見た目のみ。Design-Lock／S1 Result） | Design-Lock |

### 3.3 S-A への含意

- **主ソースへのスタンプ**: 単一ソースと同じ（M1 の結果が当てはまる。ただし**丸い生地の場合**）。
- **副ソース（olive-oil）へのスタンプ**: 成分点に入らない（presence のみ）。スタンプが 1 回でも載れば「使った」。**ゲームバランスへの影響は小さい**が、**上限（1.0／2.0）を守る**必要がある。
- **上限の扱い**: スタンプの deposit 集合を作るとき、**その種類の残量（`sauceHeadroom`）で打ち切る**必要がある。超過したバッチは reducer が**丸ごと拒否**する（部分適用されない）ので、**スタンプが無反応に見える失敗**になりうる。UI は残量を見て最後のスタンプを調整する、または事前に無効化する設計が要る。
- **四角い天板**: grandma-pizza の採点は丸い生地と別の指標・目標。**M1 の格子（丸い生地の座標・半径）は使えない**。S-A を天板に出すか、天板用に別測定をするかは**別の判断**。
- **LR 除外**: grandma-pizza は `lunchRush: false`（複数ソースの LR 除外方針が recipe データに反映済み）。複数ソース×LR の相互作用は**現状 0**。

## 4. 未確認事項

- PR #391 の差分の中身、現行 main との競合。
- LR 1 皿の実際の所要時間の分布と、ソース工程が占める割合（時間効果の見積もり）。
- 複数ソースのジャーナルの実測サイズ（見積もりのみ）。
- 四角い天板でのスタンプの座標・採点（未測定）。
- LR で S-A を無効にする設計の有無（`PizzaStage` は共通で、入力方式の分岐は見つけていない）。

## 5. 推奨する次工程（docs のみ）

1. **LR の「時間効果」の見積もり**: ソース工程の所要（自然 vs スタンプ）の比較を、純粋計算ではなく**実機の観察（M2 の O1）で時間も記録**して補う。
2. **S-A の「LR では無効」を設計案に含める**（複数ソースの Design-Lock の先例に倣う）。Owner 判断。
3. **#391 の扱い**を Owner が決める（再開／閉じる）。S-A の判断は #391 に依存しない。
4. 複数ソース用の測定（M1 を 2 種・上限・刻印付きに拡張）は、S-A の方針が決まってから（新規テストが要る場合は承認が必要）。
5. 四角い天板での S-A の要否は、Owner が決める（天板用の別測定が前提）。

## 6. Owner 判断事項

1. S-A を Lunch Rush では無効にする方針を、設計の前提としてよいか（品質より時間の効果が大きい可能性）。
2. PR #391 の扱い（再開・閉じる・現状維持）。本調査は書き込みなし。
3. 四角い天板（grandma-pizza）での S-A の扱い（対象外／別測定）。
4. 複数ソースの上限超過時の挙動（バッチ拒否）を、S-A の UI 設計の制約として記録してよいか。

---
_docs-only の読み取り調査。#391 の差分・LR の所要時間・複数ソースの実測は未確認。_
