# Dinner Mission DM-3R-1 — Result Detection / Quality Pure Logic: Result

- **Issue:** #248（DM-3R-1 専用。Duplicate Gate では該当する Issue / open PR は無かった）
- **Branch:** `claude/dinner-dm-3r1-result-detection-x0ka4o`（fresh な `origin/main` `3f084b3` から）
- **Authority:** Owner Decisions OD-R1〜OD-R8、`docs/reports/TETO_DINNER-MISSION_DM-3_HUMAN-REVIEW_REDESIGN.md`（`claude/dinner-mission-dm3-redesign-audit` の `fe221af`）§4〜§8・§16、DM-1 / DM-2 Result Report
- **種別:** pure logic のみ。UI / runtime wiring / PR #243 / H3-3（PR #247）には触れていない
- **新規 visual screenshot:** 不要（pure logic のみ。CLAUDE.md の Human Verification 対象外）

## 1. Audited main

| 対象 | 状態（作業開始時に GitHub で fresh check） |
|---|---|
| `origin/main` | `3f084b3f683df0896d7d750c6b4aa7df120cc1fe`（Merge PR #246, DM-3R-0） |
| Issue #245 / PR #246 | CLOSED / MERGED |
| PR #243（Dinner DM-3） | OPEN、head `fd4c28baef2ebd4d78617595683253467a20bb7c`。read-only で設計比較のみ。branch へ取り込んでいない、push していない |
| PR #247（Hint 3.0 H3-3） | OPEN、head `854bed5`。一切触れていない |
| 作業 branch | `origin/main` と同一 SHA から開始 |

## 2. Integration Map（実装前の監査）

### 2.1 main 上の既存 authority

| 部品 | 場所 | 内容 | DM-3R-1 での扱い |
|---|---|---|---|
| `signatureOfPizza` | `src/logic/discovery/signature.ts` | 組成（材料集合 + ソースベース + identity 次元）。bake 値・CUT・配置は identity に含まない | **そのまま再利用** |
| `matchDiscovery` | `src/logic/discovery/matcher.ts` | 完全一致のみ。0 / 1 / 複数 → NO_MATCH / UNIQUE_MATCH / AMBIGUOUS。候補は sort 済み | **そのまま再利用**（Dinner matcher は作らない） |
| `RECIPE_DISCOVERY_CATALOG` | `src/data/discoveryCatalog.ts` | 25 recipe の target | 既定 catalog（テスト用に注入可能） |
| `evaluateDiscovery` | 同 matcher | NEW_DISCOVERY / ALREADY_DISCOVERED | **使わない**（Discovery の意味を持ち込まない） |
| `resolveFreeCookPizza` | `src/logic/discovery/freeCook.ts` | 汎用窓での完成判定 → 一致 → `"recipe"` policy gate | **参考のみ**。汎用窓が target 窓とずれる（§9） |
| `evaluateFreeCookCompletion` | 同上 | 「ピザか」（item あり + 焼き帯） | **再利用**。窓を引数で渡せるよう最小拡張（§18） |
| `evaluatePizzaCompletion` | `src/logic/completionGate.ts` | recipe の Completion Gate | **そのまま再利用**（policy は `completionPolicyForRound({roundKind:"DINNER"})` = `"order"`） |
| `computeScoringV2` + `toLegacyScoreBreakdown` | `src/logic/scoringV2/` | total と ★（`capStarsForBake` 込み） | **そのまま再利用**（Dinner 独自の ★ 式なし） |
| `getCookingProfile` / `postBakeSteps` | `src/data/cookingProfiles.ts` | recipe ごとの POST_BAKE 工程（CUT） | **そのまま再利用** |
| `consumePizzaInventory` | `src/state/inventory.ts` | CONFIRM_BAKE の唯一の消費 authority | **そのまま再利用**（全 category で消費） |
| `remainingTargetIds` / `remainingTargetShortages` / `isDinnerClockExpired` | `src/mission/dinner/dinnerRun.ts`（DM-1） | 残り target と post-bake 在庫の実行可能性、締切 | **そのまま再利用** |
| `dinnerRunReducer` の `RESOLVE_ATTEMPT` | 同上 | 宣言 target の PASS/FAILED → CLEAR 優先 → INFEASIBLE | 規則を踏襲（parity test で pin、§15） |
| START_BAKE / CONFIRM_BAKE / CONFIRM_MAKING_STEP（CUT） | `src/state/gameReducer.ts` | START_BAKE は phase 遷移のみ。CONFIRM_BAKE で score / gate / 消費。CUT は score に影響しない（`cutState` は別） | 変更しない（wiring は DM-3R-2） |
| DM-2 runtime（`dinnerGuardedReducer`） | 同上 | `activeRecipeId` の target を guided 調理 → RESOLVE_ATTEMPT | 変更しない |

### 2.2 PR #243 との比較（read-only）

PR #243 の `src/state/dinnerView.ts` は Mission Select / Detail / Board 用の view model で、結果判定の logic は持たない（判定は main の DM-2 `RESOLVE_ATTEMPT` のまま）。DM-3R-1 のモジュールはそれと独立しており、PR #243 の code は一行も取り込んでいない。

### 2.3 新しいモジュールの位置

`src/mission/dinner/dinnerResultDetection.ts`（pure）。runtime はまだ import しない。

```
PREPARE（自由に作る） ──START_BAKE──▶ Stage A: planDinnerBake(pizza)
                                           ├─ identity（内部）
                                           ├─ bakeWindow（recipe / generic）
                                           └─ postBakeSteps / cutRequired
                                      dinnerBakePlanView(plan) ← BAKE / CUT UI が読んでよいのはここだけ
BAKE ──CONFIRM_BAKE──▶ (CUT 必要なら CUT) ──▶ Stage B: resolveDinnerAttempt({...})
                                           ├─ classification（6 category、内部）
                                           ├─ postConsumptionInventory（consumePizzaInventory）
                                           ├─ remainingShortages
                                           └─ run（CLEAR / INFEASIBLE / PLAYING）
                                      dinnerAttemptView(classification, dex) ← 結果 panel が読んでよいのはここだけ
```

## 3. Matcher reuse

- identity は `resolveDinnerIdentity(pizza, catalog = RECIPE_DISCOVERY_CATALOG)` = `matchDiscovery(signatureOfPizza(pizza), catalog)` の薄い写像のみ。
- 新しい recipe matcher、ingredient-only fallback、部分一致は一切ない。
- `evaluateDiscovery` を使わないので、Dex の発見状態が identity に影響しない（Dinner は Discovery mode ではない）。

## 4. Ambiguity audit

- 現行 runtime の 25 recipe（`RECIPES.length === 25`、catalog も 25）について、`items` + `sauceBase` の組は **25 通りすべて異なる**（同一 signature 0 組）。
- 各 recipe の Reference pizza は自分自身に `UNIQUE_MATCH` する（25/25）。
- test 32 で pin。catalog に recipe が追加されて衝突が生じれば、この test が落ちる。
- 将来の衝突への安全性（test 9 / 33）: `AMBIGUOUS` は `{ kind: "AMBIGUOUS" }` のまま返し、どの候補も選ばない。clone を catalog の先頭に置いても末尾に置いても、結果は ORIGINAL（`AMBIGUOUS_IDENTITY`）、progress なし、汎用窓、CUT なし。

## 5. Two-stage resolution

| Stage | API | 時点 | 決めるもの | 決めないもの |
|---|---|---|---|---|
| A | `planDinnerBake(pizza, catalog?)` | START_BAKE（組成確定） | identity 候補、bake 窓、POST_BAKE 工程 / CUT 要否 | progress、名前表示、品質 |
| A (view) | `dinnerBakePlanView(plan)` | BAKE / CUT 中 | `bakeTarget`、`postBakeSteps`、`cutRequired` のみ | identity・recipe id・名前（test で全 25 recipe を sweep） |
| B | `resolveDinnerAttempt(input)` | BAKE 後、または CUT 後 | 7 段（identity → target → duplicate → gate → quality → progress → feasibility） | Dex / Pitz / Discovery |

- identity は組成のみから決まるので、Stage B は完成したピザで Stage A を再計算する（bake 値 null / 0 / 100 で plan が同一であることを test で pin）。
- CUT が必要な identity で `cutCompleted: false` なら `REJECTED: CUT_PENDING`（何も消費しない）。

## 6. Result union

`DinnerAttemptClassification`（`category` で判別）:

| category | 条件 | progress | 保持するもの |
|---|---|---|---|
| `INVALID_PIZZA` | 生地だけ、または Stage A の窓の許容帯の外（生焼け / 焦げ） | なし | `PizzaCompletionFailed` |
| `DUPLICATE_TARGET` | identity が完了済み target（品質は見ない） | なし | `recipeId` |
| `QUALITY_FAIL` | identity が未完了 target、かつ gate FAIL または ★ < S | なし | `recipeId`、`failure` |
| `TARGET_PASS` | identity が未完了 target、gate PASS、★ ≥ S | **+1** | `recipeId`、`stars`、`totalScore`、`minimumStars` |
| `NON_TARGET` | identity が発見済みの target 外 recipe | なし | `recipeId` |
| `ORIGINAL` | 一致なし / AMBIGUOUS / 未発見の target 外 recipe | なし | `reason`（`NO_MATCH` / `AMBIGUOUS_IDENTITY` / `UNDISCOVERED_RECIPE`）、未発見時のみ `internalRecipeId` |

判定順は上から（INVALID → DUPLICATE → QUALITY / PASS → NON_TARGET → ORIGINAL）。

**外側の結果（category ではない補助）:** `DinnerAttemptResult` = `RESOLVED` | `TIME_UP` | `REJECTED`。
- `TIME_UP`: DM-1 と同じく締切（`now >= endsAt`）が優先。run は FAILED(TIME_UP)、何も消費しない（DM-2 の CONFIRM_BAKE も締切後は焼かない）。
- `REJECTED`（`RUN_NOT_PLAYING` / `NOT_BAKED` / `CUT_PENDING` / `INVALID_MINIMUM_STARS` / `INVALID_TIME`）: 呼び出しの前提違反。解決も消費もしない。
- これらは「1 枚のピザの結果」ではなく「まだ / もう判定できない」ことを表すので、6 category とは別の層にした。

## 7. Completion Gate

- 判定は既存 `evaluatePizzaCompletion(recipe, pizza, "order")`。policy は `completionPolicyForRound({ roundKind: "DINNER" })` から取得（DM-2 の Dinner authority と同じ。test 4 は `"recipe"` だと PASS するケースで pin）。
- **Gate FAIL の扱い（監査で決定）:** 組成の失敗（材料なし・数量不足・ソース不足）は **QUALITY_FAIL の family** に入れ、`failure.kind: "COMPLETION_GATE"` で pure reason を区別する（★ 不足は `"BELOW_MINIMUM_STARS"`）。理由: どちらも「その target の組成には一致したが、target として認められない」で、progress・在庫・再挑戦の扱いが完全に同じ。表示文言は UI（DM-3R-2）が `failure.kind` / `reason` から作る。
- **焼きの失敗は INVALID_PIZZA:** Free Cooking の既存 authority（生焼け・焦げ・空は「ピザではない」）に合わせた。Stage A の窓で判定するので、一致した recipe の gate の bake 判定と同じ境界になる（許容帯 = 窓幅 × 0.5 の margin）。そのため target の gate が bake で落ちることはない。

## 8. Quality threshold injection

- `minimumStars: QualityStars` は **必須入力**。既定値も production 定数も追加していない（OD-R2、S は DM-5 で決める）。
- 1〜5 の整数以外（0, 6, 3.5, NaN, undefined）は `REJECTED: INVALID_MINIMUM_STARS`。
- ★ は `toLegacyScoreBreakdown(computeScoringV2(recipe, pizza), bakeResult, recipe.bakeTarget).stars`（CONFIRM_BAKE と同じ呼び方、bake cap 込み）。test では同じ関数で期待値を作り、S = 1..5 × 複数ピザで `pass ⇔ ★ ≥ S` を pin（test 34）。境界: ★4（焼きが perfect 外）は S=4 で PASS、S=5 で QUALITY_FAIL（test 2 / 3）。

## 9. Bake-window selection

| identity | 窓 | 根拠 |
|---|---|---|
| `RECIPE`（UNIQUE_MATCH） | その recipe の `bakeTarget` | test 14（DM-A / DM-B の 6 target 全部） |
| `NONE` / `AMBIGUOUS` / recipe 不明 | `FREE_COOK_BAKE_TARGET`（58〜78） | test 15 / 33 |

実例（test 14 / 15）:
- bismarck（55〜75、帯 45〜85）を 86 で焼く → 汎用帯（48〜88）なら通るが、**INVALID_PIZZA（OVERBAKED）**。
- margherita（60〜80、帯 50〜90）を 89.5 で焼く → 汎用帯なら落ちるが、**TARGET_PASS**。
- 一致なしのピザは 86 で ORIGINAL、89.5 で INVALID_PIZZA（汎用帯）。

## 10. CUT selection

- `postBakeSteps(getCookingProfile(recipeId))` をそのまま使う。DM-A / DM-B の 6 target はすべて CUT 対象（`["CUT"]`）。
- 25 recipe 中、CUT なしは `new-haven-apizza` のみ → `cutRequired: false`、`cutCompleted: false` でも解決できる（test 17）。
- 一致なし / AMBIGUOUS は CUT なし（今の Free Cooking と同じ）。
- CUT は Scoring 2.0 / Completion Gate に影響しない（`cutState` は `PizzaState` の外）ので、CUT の役割は「結果の確定時点」を決めることだけ。

## 11. Privacy

- Dex は **読むだけ**（表示の可否）。書き込み、Discovery 評価、NEW 演出、Pitz は一切ない（test 29 / 30: 凍結した Dex が不変、結果 JSON に `NEW_DISCOVERY` / `lastDiscovery` / `pitz` が出ない、module の import に Dex writer / Pitz / gameReducer / persistence / lunchRush がない）。
- `dinnerAttemptView(classification, dex)` が presentation-safe な層:
  - ORIGINAL は `{ category: "ORIGINAL" }` のみ（reason・候補・近さを出さない = near-miss leak なし）。
  - 名前を出すのは target と発見済み recipe だけ。名前付き category でも recipe が未発見なら ORIGINAL に落とす（fail closed）。
  - INVALID_PIZZA は `reason` のコードのみ。
- privacy sweep（test 31）: DM-A / DM-B × 25 recipe × {適正焼き, 生焼け} で、view の JSON に未発見 recipe の id・名前が一度も出ない。
- Stage A の view も identity を持たない（test: 25 recipe で id・名前が出ない）。BAKE 中に名前を出す authority は作っていない（OD-R6）。

## 12. Nested targets

| 入力 | identity | 結果 | test |
|---|---|---|---|
| DM-A: breakfast − bacon | bismarck | 未完了なら QUALITY_FAIL（mozzarella 2 < 3、`"order"`）、完了済みなら DUPLICATE_TARGET | 10 |
| DM-A: bismarck の Reference | bismarck | TARGET_PASS（breakfast は未完了のまま） | 10 |
| DM-A: bismarck + bacon 3 | breakfast-pizza | breakfast として判定 | 11 |
| DM-A: breakfast の Reference | breakfast-pizza | TARGET_PASS | 11 |
| DM-B: parmigiana − parmigiano | melanzane-pizza | TARGET_PASS（melanzane）。parmigiana は未完了のまま | 12 |
| DM-B: margherita + eggplant 3 | melanzane-pizza | melanzane として判定 | 12 |
| DM-B: parmigiana の Reference | parmigiana-pizza | TARGET_PASS（melanzane ではない） | 13 |
| DM-B: melanzane 完了後に melanzane | melanzane-pizza | DUPLICATE_TARGET（parmigiana へ昇格しない） | 追加 |

API に intent / 宣言の入力は存在しない（OD-R1 / OD-R3）。

## 13. Inventory consumption

- 入力は `preConsumptionInventory`、出力の `postConsumptionInventory = consumePizzaInventory(pizza, preConsumptionInventory)`。**全 category で同じ**（refund なし）。
- test 18〜22 + INVALID_PIZZA + 未発見 ORIGINAL: 7 ケースすべてで `postConsumptionInventory` が消費後の値と一致し、元の在庫と異なる。
- REJECTED / TIME_UP は消費しない（CONFIRM_BAKE が受理されないのと同じ）。
- OD-R5（全 OWNED 材料の tray）は runtime の話なので DM-3R-2。ここでは任意の owned 集合と在庫で pure に検証した。

## 14. Feasibility

- 解決後、毎回 `remainingTargetShortages(next, { ownedIngredientIds, inventory: postConsumptionInventory })`（DM-1 authority）で残り target を再評価。
- 実例（すべて pin）:
  - test 23: DM-A 最小在庫で bismarck PASS → egg 1、残り実行可能 → PLAYING。
  - test 24: DM-A で funghi + egg（ORIGINAL）→ mushroom 0 / egg 1 → INFEASIBLE。
  - test 25: DM-A で bismarck PASS → bismarck DUPLICATE → egg 0 → breakfast 不可 → **INFEASIBLE**（`{egg, need 1, have 0, [breakfast-pizza]}`）。
  - test 26: DM-B で melanzane PASS → melanzane DUPLICATE → eggplant 0 → parmigiana 不可 → **INFEASIBLE**。
  - test 27: DM-B で melanzane QUALITY_FAIL（S=5、★4）→ eggplant 3 → melanzane + parmigiana に 6 必要 → **INFEASIBLE**。

## 15. CLEAR precedence

- DM-1 `RESOLVE_ATTEMPT` と同じ: 残り target が 0 になれば **CLEAR が先**（在庫チェックはしない。作るものが残っていない）。
- test 28: 最後の breakfast で egg / bacon が 0 になっても CLEARED、`clearMs = now − startedAt`、shortages 空。
- parity test: DM-1 の `SELECT_TARGET` + `RESOLVE_ATTEMPT` に同じ target・同じ post-bake 在庫を与えた結果と、status / completedRecipeIds / outcome が一致（PASS・CLEAR・QUALITY_FAIL→INFEASIBLE・PASS の 4 シナリオ）。
- `attempts` のログ形式は DM-3R-2 で決める（分類を含む新しい attempt 型が必要）ので、この slice では run の `attempts` を変えず、分類は結果として返す。

## 16. Mutation tests

`src/mission/dinner/dinnerResultDetection.ts` に 1 つずつ変異を入れ、focused test（47 件）を実行。全 19 件を検出（module は毎回元に戻した）。

| 変異 | 結果 |
|---|---|
| intent-based result（残り target の上位集合を「狙った」とみなす） | DETECTED（6 failed） |
| first-match ambiguity | DETECTED（2） |
| generic bake window always | DETECTED（1） |
| skip CUT | DETECTED（1） |
| quality `>=` → `>` | DETECTED（2） |
| quality `>= S−1` | DETECTED（4） |
| duplicate increments | DETECTED（2） |
| non-target increments | DETECTED（1） |
| quality fail increments | DETECTED（3） |
| refund inventory（PASS 以外は返却） | DETECTED（10） |
| skip feasibility after failure | DETECTED（5） |
| leak undiscovered identity（分類で Dex を見ない） | DETECTED（2） |
| leak undiscovered identity（view が internal id を出す） | DETECTED（2） |
| leak undiscovered identity（view が発見チェックをしない） | DETECTED（1） |
| 追加: Completion Gate policy `"recipe"` | DETECTED（2） |
| 追加: INVALID_PIZZA 判定を省略 | DETECTED（4） |
| 追加: duplicate 判定を品質の後に | DETECTED（6） |
| 追加: 締切を無視 | DETECTED（1） |
| 追加: BAKE view が identity を出す | DETECTED（1） |

## 17. Regression

- Focused（新規）: `src/mission/dinner/dinnerResultDetection.test.ts` **47 passed**。
- 指定 regression 34 files（Free Cooking matcher / Discovery / signature、`gameReducer.freeCook` / `.discovery`、Completion Gate、Scoring 2.0、CUT、inventory / 消費、DM-1、DM-2 `gameReducer.dinner`、recipe-set feasibility、Lunch Rush `lunchRush` / `missionScoring` / `missionShortage`、Scoring 2.0 authority）: **1089 passed / 1 skipped**。
- Full Vitest: **184 files、3931 passed / 1 skipped**（main 時点 3884 + 新規 47）。
- `evaluateFreeCookCompletion` の既定引数は汎用窓で、既定経路は同じ sentinel オブジェクトを使う（byte-identical）。既存の Free Cooking / Discovery test は無変更で PASS。
- PR #243 の未 merge code の runtime regression test は対象外（指示どおり）。

## 18. Changed files

| file | 内容 |
|---|---|
| `src/mission/dinner/dinnerResultDetection.ts` | **新規**。Stage A / B、6 category、view 2 種 |
| `src/mission/dinner/dinnerResultDetection.test.ts` | **新規**。47 tests |
| `src/logic/discovery/freeCook.ts` | `evaluateFreeCookCompletion(pizza, bakeTarget = FREE_COOK_BAKE_TARGET)`。**必要性:** 「ピザか」の判定を Stage A の窓で行うため。複製すると Free Cooking と Dinner で「空 / 生焼け / 焦げ」の定義が分岐するので、既存関数に窓を渡せるようにした。既定値で従来と同一 |
| `src/mission/dinner/dinnerRun.test.ts` | Dinner module の architecture pin（file 一覧）に新 module を追加。import 制約（Dex writer / Lunch Rush / gameReducer / persistence なし）は新 module にも適用される |
| `docs/reports/TETO_DINNER-MISSION_DM-3R-1_RESULT-DETECTION_Result.md` | この report |

## 19. Scope

- 変更なし: GameScreen、target thumbnail、Dinner HUD、timer、App navigation、Dinner cooking runtime（`gameReducer` / `dinnerRun` の reducer / DM-2 guard）、save schema、PR #243、PR #247 / H3-3、DM-4 報酬、DM-5 調整値。
- production 定数の追加なし（S は注入）。
- merge / auto-merge なし。DM-3R-2 に進んでいない。

## 20. CI

- ローカル: focused 47 passed、full Vitest 3931 passed / 1 skipped、`tsc -b` clean、`oxlint` 0 warnings、`vite build` 成功。
- GitHub CI（PR #249、head `da1727c`）: **全 9 check success** — `build`、`classify`、`layout-chromium`、`Layout Contract Gate`、`webkit webkit-360x800 shard 1/2・2/2`、`webkit webkit-390x844 shard 1/2・2/2`、`WebKit Gate`。
- この CI 記録の commit は docs のみ（code 変更なし）。

## 21. DM-3R-2 integration map

| 場所 | 変更 | 使う API |
|---|---|---|
| Dinner round の生成 | target ごとの guided round → **free round**（`FREE_COOK` 系 tray、Discovery / Dex / Hint / Pitz は Dinner guard で無効のまま） | — |
| `START_BAKE`（Dinner） | `planDinnerBake(state.pizza)` を round に保存。BAKE gauge と `cookingProfile` の POST_BAKE を `dinnerBakePlanView(plan)` から設定 | Stage A |
| `CONFIRM_BAKE`（Dinner） | 焼き判定の窓は plan の窓。消費は今の `consumePizzaInventory` のまま（1 回）。CUT が不要なら、ここで Stage B | Stage B（`preConsumptionInventory = state.inventory`、`postConsumptionInventory` と reducer の消費結果が一致することを parity test で固定） |
| 最後の `CONFIRM_MAKING_STEP`（CUT） | CUT 後に Stage B（`cutCompleted: true`） | Stage B |
| `DinnerRunState` / `DinnerRunAction` | `activeRecipeId` / `SELECT_TARGET` / `CANCEL_TARGET` を削除、`attempts` を分類付きに拡張。`RESOLVE_ATTEMPT` を Stage B の結果（`run`）の採用に置き換え | Stage B の `run` |
| 結果 panel | `dinnerAttemptView(classification, dex)` だけを読む。文言は UI 側 | view |
| S（`minimumStars`） | DM-5 まで DEV / Preview 注入（OD-DM3-1 の duration 注入と同じ扱い）。production 値は DM-5 | 入力 |
| E2E | redesign §14 の E-R1〜E-R9 | — |

## 22. Residual risks

1. **S が未決定:** production で `minimumStars` をどこから渡すかは DM-3R-2 / DM-5 の Owner 判断。値がないと Stage B は `REJECTED` になる（安全側だが、wiring 時に必ず供給すること）。
2. **Stage A と Stage B の一致:** 両方とも組成だけから identity を出すので一致する（test で pin）。ただし DM-3R-2 で BAKE 後に組成を変える操作を追加すると崩れる。現行 runtime では BAKE / CUT は `toppings` / `sauceIds` を変えない。
3. **attempt ログ:** この slice は run の `attempts` を更新しない。DM-3R-2 で分類付きの attempt 型に拡張するまで、runtime に wiring しないこと。
4. **二重消費（DM-3R-2 で最も危険）:** Stage B は `preConsumptionInventory`（CONFIRM_BAKE 前の在庫）から自分で消費を計算する。CUT 確定時点の `state.inventory` は CONFIRM_BAKE で既に減っているので、それを渡すと二重に減る。§23.3 で名前・doc comment・実 reducer との parity test の 3 か所に pin 済み。
5. **将来の catalog 衝突:** 衝突時は ORIGINAL（progress なし）で安全だが、target 自体が衝突すると mission が CLEAR 不能になる。test 32 が先に落ちるので、recipe 追加時に mission 側の見直しが必要。
6. **近さの情報:** `QUALITY_FAIL` の `COMPLETION_GATE` は target の材料 id を view に含む。target は発見済み（unlock 条件）なので leak ではないが、view は Dex で再確認している（fail closed）。

## 23. Owner Review 承認後の pre-merge 統合（DM-3R-1 FINAL GATE PASS → OWNER MERGE APPROVED）

§1〜§22 は `da1727c`（code）/ `453ba58`（docs）時点の記録。以下は Owner 承認後、merge 前に行ったこと。

### 23.1 Fresh gate

- `origin/main` は `3f084b3` → **`8692013`**（Merge PR #247、Discovery Hint 3.0 H3-3）に進んでいた。
- PR #249 は OPEN、HEAD `453ba58`、未解決 review thread 0、全 9 check success（`da1727c`）。

### 23.2 Latest main の取り込み

- file の重なり: **なし**（H3-3 は HintSheet / discoveryHint / gameReducer の hint 購入 / App / e2e のみ。DM-3R-1 の 5 file と交差しない）。
- 意味の重なり: H3-3 の diff は matcher・signature・`freeCook.ts`・Completion Gate・Scoring 2.0・inventory・Dex・`roundKind`・Dinner module を**一切変更していない**（該当 path の diff は 0 行）。gameReducer の変更は hint 購入のみで、CONFIRM_BAKE / START_BAKE / 消費 / Dinner guard には触れていない。新 action `PURCHASE_SELECTABLE_HINT` は `DINNER_BLOCKED_ACTIONS` に入っている（Dinner 中は拒否）。
- merge commit `74c977f`（rebase / force-push なし）。conflict なし。

### 23.3 Inventory の pre-consumption contract（誤配線対策）

Owner Review の指摘どおり、`inventoryBeforeBake` という名前は「CUT 確定時の `state.inventory`（消費済み）」を渡しやすいと判断し、最小変更で 3 か所に pin した:

1. **API 名:** 入力 `inventoryBeforeBake` → **`preConsumptionInventory`**、出力 `inventoryAfter` → **`postConsumptionInventory`**（ロジック変更なし）。
2. **doc comment:** 入力の型に「CONFIRM_BAKE dispatch 時の `state.inventory`。CUT 確定時の在庫を渡すと二重消費」と明記。
3. **test:** `inventory contract: PRE-consumption stock in, consumed exactly once` — 実際の `gameReducer`（guided round の START_BAKE → CONFIRM_BAKE）で funghi / bismarck / melanzane を焼き、`postConsumptionInventory` が reducer の消費後在庫と**完全一致**すること、さらに消費後在庫を誤って渡すと**一致しなくなる**（二重消費が検出できる）ことを pin。

### 23.4 `evaluateFreeCookCompletion` 拡張の focused regression

- 追加 test: 25 recipe × bake {0, 40, 47.9, 48, 68, 88, 88.1, 100, null} と空の生地で、引数省略と `FREE_COOK_BAKE_TARGET` 明示が完全に同じ結果（既定経路は同じ sentinel オブジェクトを使うので byte-identical）。
- recipe 窓を渡すと bake 帯だけが動き、空ピザの規則は変わらない（bismarck @86: 省略 PASS / bismarck 窓 OVERBAKED、空ピザは MISSING_REQUIRED_INGREDIENT）。
- 既存 caller（`resolveFreeCookPizza`、gameReducer の Free Cooking 経路）は引数なしのまま。CUT semantics は無関係（POST_BAKE は cooking profile 側）。

### 23.5 Final gate（merge 済み tree、`74c977f` + この commit）

- Focused `dinnerResultDetection.test.ts`: **50 passed**（47 + contract 1 + extension 2）。Dinner module 全体 101 passed。
- Mutation: **19/19 DETECTED**（final code で再実行。refund は 11 failed で検出）。
- Regression 36 files（§17 の一式 + H3-3 の `gameReducer.selectableHint` + `lunchRushScoring`）: **1151 passed / 1 skipped**。
- Full Vitest: **185 files、3983 passed / 1 skipped**。
- `tsc -b` clean、`oxlint` 0、`vite build` 成功。
- GitHub CI: push 後の exact HEAD で確認（final report に記録）。
