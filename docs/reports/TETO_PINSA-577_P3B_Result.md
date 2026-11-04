# Pinsa Romana P3-b（#577）— データ・公開ゲート・ON/OFF 検証（本番では不活性）

Status: **実装済み。`PINSA_PRODUCTION = false`（本番では Pinsa は存在しない）。公開は別途 Owner 承認が必要。merge も Owner 最終承認待ち。**
基準 `main` = `a9d87c0`（#655 merge 後）。決定の出典: `docs/decisions/TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（L1 / D1〜D8）、`TETO_PINSA-577_Q7_COHORT-LETTER_2026-10-23.md`（Q7）、`docs/design/TETO_PINSA-577_P3B_IMPLEMENTATION-PLAN_2026-10-23.md`、#577 の Owner コメント。

## 公開ゲート（Owner 案 A）
E5 で後乗せカタログ（`LATE_CATALOG_PRODUCTION`）が本番 ON になったため、`LATE_RECIPES` に行を足すだけでは Pinsa が出荷される。そこで **Pinsa 専用のビルド時リテラル** `src/data/pinsaGate.ts` の `PINSA_PRODUCTION`（初期値 `false`）を設けた。
- false の間、レシピ・注文・発見 target id が実行時に存在しない（`lateCatalog.ts` の `activeLate`）。型キーの表（`RecipeSauceProfiles` / `recipeHintRoles` / `referencePizza`）は `RecipeId` を網羅するため行を持つが、読み手は隠す（`isGatedOffRecipeId` / `isInactiveLateRecipeId`、`getReferencePizza` / `listReferencePizzas`）。
- 後乗せカタログ自体が OFF なら、Pinsa のゲートが ON でも Pinsa は出ない（ゲートは後乗せスイッチを迂回できない。テストで固定）。
- ikura（E5）、Grandma Pizza、jamon-serrano-pizza の挙動・データは不変（ON でも jamon の target・レシピは byte 一致）。

## 変更
| ファイル | 内容 |
|---|---|
| `src/data/pinsaGate.ts`（新規） | ゲート。`PINSA_PRODUCTION = false` |
| `src/data/lateCatalog.ts` | `pinsa-romana`（L1 / D4 / R2。4 食材、ルッコラのみ `POST_BAKE`、`doughKind`、`ladderCredit:false`、`lunchRush:false`、CUT なし）、order、target id `pinsa-romana-pizzadb-p9`。`LATE_LADDER_STEPS` は不変（D6）。`ALL_LATE_RECIPE_IDS` / `isGatedOffRecipeId` |
| `src/data/{recipeSauceProfiles,recipeHintRoles,referencePizza}.ts` | 行の追加（tomato-sauce PAINT / key-free / 8 スロット Reference。ルッコラ位置は jamon と同じ暫定＝R4 は実機 HV で調整） |
| テスト | `pinsaGate.test.ts`（OFF の漏えい検査）、`lateCatalog.pinsa.test.ts`（ON のデータ・validator 変異・L1 判定表・Q7・技法）、`state/pinsa.onBuild.test.ts`（実 reducer の Guided / Free / FINISH / 保存往復） |
| テスト支援 | `techniqueAllowlists.ts` に `DOUGH_PINSA_ROMANA_RECIPE_IDS`（ゲート連動の共有 1 か所）、`lateIds.ts`、`recipeBatchManifest.ts` の `PINSA_ROMANA_BATCH`（`acceptedLetterShifts: { jamon-serrano-pizza: "-->B" }` のみ。validator 本体は無変更） |

## UI / HV
ゲートが閉じている本番ではプレイヤーに見える変更が無い（Policy §2: 本番 OFF で不可視の変更は HV 不要）。ON の HV（iPhone Safari 実機）と原典確認は**公開前の別 Gate**。

## 公開時（`PINSA_PRODUCTION = true`）に更新が要る既存テスト
ON で全体を流したときの差分は、件数・名前を固定した pin と、Pinsa を知らない進行シミュレーションに限られる。公開 PR で再導出して更新する（緩和・skip・閾値変更はしない）。
- 件数 pin: `catalogLedger`、`discoveryExpansion2.wave2`、`discoveryExpansion3.pestoTrapanese`、`originalResultCopy`、`dinnerResultDetection`、`recipeChapters`（章 4 の total）、`discoveryProgressionModel` / `DiscoveryProgressionInspector`、`lateCatalog.test` / `lateAxis` / `e5.ikuraProduction`（「後乗せは ikura のみ」「末尾は ikura」）
- Pinsa 前提の pin: `doughKind`（inert）、`doughAxis`、`doughLateMatrix`、`doughPrivacy`、`techniques*` / `runtime` / `dexView` / `doughSwitch`（「どの target も技法を要求しない」）、`hint5Ladder.*`（golden・key-free 母集団 40 → 41）、`researchLabels.batch8a`、`ladderReachability.starGate`
- 進行シミュレーション: `discoveryHintEconomy.sim` / `hint5Economy.sim`（「Dex 39: pool candidate pinsa-romana not discovered」）、`researchAttempt.sim` / `replayAudit`（「Dex 40: pinsa-romana stuck (no information)」）、`discoveryHint.walk`。ハーネスは「材料集合 = 答え」で焼くため、jamon と同じ材料集合の Pinsa（生地チップ＋後乗せが必要）を解けない。公開前に、Pinsa を専用の枝として扱うか Owner が方針を決める。
