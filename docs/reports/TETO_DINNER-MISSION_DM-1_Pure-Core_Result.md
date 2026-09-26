# Dinner Mission DM-1 — Pure Core: Implementation Result（Issue #236）

- **Base main:** `42feec70f4e2b659c590b1c236116c0bf579200a`（Merge PR #235）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`
- **Design / authority:** `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md`
  - Fresh Design: `623b7b6`
  - §17 Owner Decisions: `742ab6b`。実装より前に commit して authority を固定した
- **Implementation commit:** `6e0b73e`
- **Scope:** pure core のみ。App、UI、timer、Pitz、save には配線していない

## 1. What changed

| ファイル | 内容 |
|---|---|
| `src/state/recipeDiscoveryState.ts` | 1 枚分の必要量の規則を `finiteRequirementNeed(ingredient, minCount)` として切り出した（scatter は `max(1,minCount)`、sauce は 1）。`recipeStockShortage` はこの関数を呼ぶだけになり、**挙動は変わらない** |
| `src/state/recipeSetFeasibility.ts`（新規） | `recipeFiniteNeed` / `aggregateFiniteNeed` / `recipeSetStockShortage` / `isRecipeSetCookable` |
| `src/mission/dinner/dinnerMission.ts`（新規） | `DinnerMissionDefinition`、DM-A / DM-B の定義、`validateDinnerMissions`、`resolveDinnerTargets`、unlock の導出（`dinnerMissionUnlock` / `isDinnerMissionUnlocked`） |
| `src/mission/dinner/dinnerRun.ts`（新規） | `DinnerRunState`、START gate（`dinnerStartBlock` / `startDinnerRun`）、`dinnerRunReducer`、残り target の判定、`dinnerProgress`（HUD 用の 1/4） |
| `src/mission/dinner/dinnerReward.ts`（新規） | tier（GOLD / SILVER / BRONZE）、reward table の shape、`dinnerClearTier`、`quoteDinnerReward`。Phase 1 の table は数値を持たない（untuned） |
| test 4 ファイル（新規） | §5 を参照 |

## 2. DM-A / DM-B definitions

| | DM-A (`dm-a`) | DM-B (`dm-b`) |
|---|---|---|
| targets | margherita / bismarck / breakfast-pizza / funghi | margherita / funghi / melanzane-pizza / parmigiana-pizza |
| 集合の必要量（`RECIPES` から導出） | egg 2, bacon 3, mushroom 3 | mushroom 3, eggplant 6, parmigiano 2 |
| 共有する有限素材 | egg（bismarck 1 + breakfast-pizza 1） | eggplant（melanzane 3 + parmigiana 3） |
| unlock | `ALL_TARGETS_DISCOVERED` | 同じ |
| timeLimit | `seconds: null`（DM-5 で決める） | 同じ |
| reward | `dinner-phase1-untuned` | 同じ |
| title | 「ディナーミッション 1」（仮） | 「ディナーミッション 2」（仮） |

- 定義は recipe id だけを持ち、必要量は再定義していない。必要量が Fresh Design §9 の数値と一致することを test で固定した。
- 両方とも Shop の 1 pack で完走できることも test で固定した。
- この確認を runtime の validator に入れると、material Shop layer の importer allowlist（`discoveryLadder.test.ts`）に抵触する。そのため test 側に置いた。

## 3. Feasibility algorithm

```
need(m) = Σ_{r ∈ set} finiteRequirementNeed(m, r)   （starter は数えない。未知 id は 1）
have(m) = 所有していれば inventory[m] ?? 0、していなければ 0
set が完走可能 ⇔ 全ての m で need(m) ≤ have(m)
```

- 必要量は固定で、代替素材も無い。そのため、この判定は完走可能性を過不足なく表し、作る順番にも依存しない（DM-A の 24 通りの順番すべてで test した）。
- 集合は multiset として扱う（同じ recipe が 2 回あれば必要量も 2 倍）。Dinner の定義では重複した target を validator が拒否する。
- run の中では、**pizza の結果（PASS / FAILED）を確定するたびに**、残りの target を **消費後の在庫** で再判定する。完走できなければ、その場で `FAILED / INFEASIBLE` にして、不足リストを outcome に残す。
- 置きすぎは予防しない（OD-DM-3）。

run の遷移:

| action | 効果 |
|---|---|
| `SELECT_TARGET` | 残っている target だけを選べる。すでに選択中なら無視する |
| `CANCEL_TARGET` | 選択を解除する。消費は bake 時にしか起きないので、他は何も変わらない。UI で提供するかは DM-2/3 で決める |
| `RESOLVE_ATTEMPT {completion, stock}` | 選択中の target についてだけ処理する。PASS なら完成にする。最後の target なら CLEARED。そうでなければ残りを再判定する（不能なら INFEASIBLE） |
| `TICK` | `now ≥ endsAt` なら `TIME_UP` |
| `ABANDON` | reload / HOME を表す。`ABANDONED` にする |

- 期限の判定は、どの action よりも先に行う。期限の時刻以降に確定した pizza は数えない（Lunch Rush と同じ規則）。
- 終了した run は、どの action も無視する。

## 4. Lunch Rush parity と分離

- **parity:** 全 25 recipe × 6 つの在庫シナリオ（満タン / 空 / ちょうど / 1 つ不足 / starter だけ所有 / 所有リストが空）で、次の 2 つを確認した。
  - `isRecipeCookable(r) === isRecipeSetCookable([r])`
  - 不足リスト（`ingredientId, need, have`）が一致すること
- 実データには無い端のケース（sauce の minCount 2、scatter の minCount 0）と、未知の ingredient id でも一致を確認した。
- **mutation check:** `usableStock` の所有チェックを外す、または sauce の規則を minCount に変えると、parity test が失敗することを確認した。
- **Lunch Rush regression:** 関連する 6 ファイル（`lunchRush.test.ts`、`gameReducer.missionShortage.test.ts`、`recipeDiscoveryState.test.ts`、`MissionShortagePanel` / `MissionResultOverlay` の component test、`App.test.tsx`）の 151 件がすべて PASS した。
- **分離:** Dinner の 3 モジュールは、`lunchRush`、`gameReducer`、`persistence`、`registerScoreToDex` を import しない。モジュールのソースを読む test で固定した。Lunch Rush の `MissionState` / `missionRunReducer` / `isMissionRound` にも手を入れていない。
- **Dex:** run の遷移は Dex を受け取らない（unlock の判定で START 時に読むだけ）。CLEAR した run と FAILED になった run の後でも、frozen の Dex が変わっていないことを test で確認した（OD-DM-11。#234 の挙動はコピーしていない）。

## 5. Tests

| ファイル | 件数 | 主な内容（Fresh Design §12 の ID） |
|---|---:|---|
| `src/state/recipeSetFeasibility.test.ts` | 15 | runtime の事実（egg / ham / olive-oil / pesto は有限、mozzarella は starter）、parity、共有 egg（単独なら可、集合だと不可 / ちょうどで可）、ham 3→4、olive-oil、pesto、starter のみ（F）、未所有、未知 id、重複、空集合、順番に依存しないこと |
| `src/mission/dinner/dinnerMission.test.ts` | 13 | 定義が有効、DM-A / DM-B の集合の必要量、1 pack で足りること、validator（未知 target、重複、件数、タイトルに recipe 名、id や order の重複、時間、table）、unlock（A / B、「あと 1」、未発見の identity が出ないこと、`discovered:false` は数えない、Dex を書かないこと） |
| `src/mission/dinner/dinnerRun.test.ts` | 23 | START gate（A / C / D / E、時間なし）、G、H（24 通りの順番）、I（実際の `consumePizzaInventory` での消費）、J、K（egg の置きすぎ → 即 INFEASIBLE）、余裕のある置きすぎ、関係ない素材の置きすぎ、最後の 1 枚、O（FAILED でも消費は残る → 再挑戦 / 即 INFEASIBLE）、L（TICK / 期限後の確定）、Q/R（ABANDON）、P（target 外、完成済み、二重の選択、違う結果は無視）、CANCEL、終了後の action は無視、Dex と Lunch Rush からの分離 |
| `src/mission/dinner/dinnerReward.test.ts` | 15 | untuned の table（tier も Pitz も無し）、FAILED は 0、tier は ★ ではないこと、境界（N: ±1ms、7 ケース）、初回と repeat の schedule、BRONZE より遅い clear、table の validation |
| **DM-1 合計** | **66** | |

Fresh Design §12 のうち、S / T / U / V / W / Y は UI、E2E、save の話なので、DM-3 / DM-4 で扱う。

## 6. Final Gate（ローカル、exact HEAD）

| Gate | 結果 |
|---|---|
| full Vitest | **176 files / 3702 passed**, 1 skipped（既存）, 0 failed（main の 3636 に DM-1 の 66 を足した数） |
| typecheck（`tsc -b`） | PASS |
| lint（`oxlint`） | PASS（exit 0） |
| build（`npm run build`） | PASS |
| Human Verification | 不要。UI を変えていない（DM-1 は pure core、Owner の指示どおり） |
| CI（`CI` / `E2E WebKit` → `WebKit Gate`） | PR の exact HEAD で確認する |

実装途中で既存の boundary test（`discoveryLadder.test.ts` の「material Shop layer の importer allowlist」）が失敗した。allowlist を広げると境界が緩むので、1 pack の確認を runtime の validator から test に移した。

## 7. Scope verification

`git diff 42feec7 -- src` で確認した。変更は §1 の 9 ファイルだけ。

- 既存ファイルの変更は `recipeDiscoveryState.ts` だけで、中身は関数の切り出し。
- 次のものは変更していない:
  - UI（HOME / Select / cooking）、App の routing、timer の配線
  - Pitz の払い出し、save schema、`dinnerMissionRecords`
  - Shop、pack、price、starter のルール
  - recipe / ingredient catalog、Discovery の matcher、Hint Economy
  - Lunch Rush の挙動、#234、Cooking Steps、Cutting、monetization

## 8. Residual risks

| # | リスク | 扱い |
|---|---|---|
| R-1 | 在庫の緊張が弱い（pack 10 × k） | OD-DM-16 に従い Phase 1 では受け入れる。DM-5 で計測する |
| R-2 | `RESOLVE_ATTEMPT` に渡す `stock` を、`CONFIRM_BAKE` の後の在庫と一致させる必要がある。DM-2 の配線でずれると判定を誤る | DM-2 で `CONFIRM_BAKE` と同じ state から渡し、reducer / App test で固定する |
| R-3 | `CANCEL_TARGET` を UI で提供するかどうか | DM-2 / DM-3 で決める（pure 側は、在庫が変わらない安全な遷移として用意しただけ） |
| R-4 | time limit と reward の数値が未定なので、`startDinnerRun` には duration を明示的に渡す必要がある | DM-5 まで。DM-2 は dev 用の固定値か URL override で配線する |
| R-5 | Dinner の Dex 登録（OD-DM-11） | #234 と一緒に決める。DM-1 の構造はどちらになっても対応できる |
| R-6 | mission のタイトルは仮 | UI の phase で決める。validator が recipe 名の混入を防ぐ |

## 9. Next: DM-2 plan（未着手）

1. **round/mode authority:** `GameState` に Dinner round を明示する（例: `roundKind` または `dinnerRound: {missionId, targetRecipeId} | null`）。`isMissionRound` には手を入れない。
2. **Dinner round への入口:** `SELECT_TARGET` → guided PREPARE（`canStartGuidedRound` を backstop にする）。Free Cooking と target 外の recipe は reducer で拒否する。
3. **完成判定:** Completion の policy を `"order"` にする。FREE の Pitz、CT1 / CT2、`REGISTER_TO_DEX`、Lunch Rush の `MISSION_*` が Dinner round では動かないことを reducer で保証する。
4. **bake の後:** `CONFIRM_BAKE` で消費した後の在庫を `RESOLVE_ATTEMPT` に渡し、INFEASIBLE / CLEARED / 継続を判定する。FAILED の path で Dex が変わらないこと（#234 を持ち込まないこと）を test で固定する。
5. **App:** Dinner run の reducer と壁時計の TICK、HOME / reload での ABANDON（confirm つき）、mission 中は Shop に入れないこと。
6. **Lunch Rush の回帰:** 既存の suite に加え、同じ state で Lunch Rush と Dinner が干渉しないことを確認する test。
7. UI（DM-3）、保存と報酬（DM-4）、数値の決定（DM-5）は、それぞれ別の phase で扱う。
