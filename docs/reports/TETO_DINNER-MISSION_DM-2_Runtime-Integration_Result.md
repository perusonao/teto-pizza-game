# Dinner Mission DM-2 — Runtime Integration: Result

- **Audited main:** `f59b5ed8b4ebba0c7b7c7c6f486b57f825aef63a`（Merge PR #237, DM-1）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`（最新の main から作り直した）
- **Authority:** `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md` §17（Owner Decisions）と DM-2 の指示
- **Issue:** #239（DM-2 専用。Duplicate Gate では該当する Issue も open PR も無かった）
- **PR:** §19 を参照
- **Commits:** `f6cd5f2`（Integration Map。実装前に commit）、`5106934`（実装と test）、この Result Report

## 1. Audited main SHA

`f59b5ed8b4ebba0c7b7c7c6f486b57f825aef63a`。作業開始時に GitHub で確認した。

- PR #237 は MERGED、#236 は CLOSED、#234 は OPEN
- open PR に Dinner 関連のものは無い

## 2. Issue / PR

- Issue #239
- PR は §19 を参照（OPEN、auto-merge しない）

> §3 Integration Map は **実装より前に** 書いて commit した（`f6cd5f2`）。§4 以降は実装後に書いた。

## 3. Integration Map（実装前の監査結果）

### 3.1 現在の runtime（`f59b5ed`）

| 領域 | 現状 | Dinner への影響 |
|---|---|---|
| round の状態 | `GameState` は 1 round 分。round の種類は `isMissionRound`（Lunch Rush）と `freeCook`（Free Cooking）の 2 つの boolean で表している | Dinner をこのどちらかに乗せると、Lunch Rush や Free Cooking の分岐（下記）がすべて Dinner にも効いてしまう |
| `isMissionRound` の分岐 | `BEGIN_PREPARE`（開始条件と CT1）、`CONFIRM_BAKE`（completion policy が `"order"` / `"recipe"`）、`REGISTER_TO_DEX`（discovery と FREE Pitz の抑止）、CT2、`MISSION_SKIP_ORDER`、`GameScreen` の shortage panel、App（`REGISTER_TO_DEX` の自動 dispatch、skip） | Dinner に必要なのは `"order"` policy だけ。他の分岐は Lunch Rush 固有のもの |
| round の開始 | `buildOrderState` が全ての round を作る。`startPreparingRecipe` は `SELECT_RECIPE` と `RETRY_SAME_RECIPE` から、`nextMissionOrderState` は `MISSION_*` から、`nextOrderState` は `PLAY_AGAIN` と初期状態から呼ばれる | Dinner の round も `buildOrderState` を通せば、pizza / score / cut / hint の reset が同じになる |
| 在庫の消費 | `CONFIRM_BAKE` だけが消費する（`consumePizzaInventory`、置いた数と sauce 1 単位）。`phase !== "BAKE"` の guard で exactly-once になっている | **Dinner の判定は、この遷移より後の `state.inventory` を読む必要がある** |
| RESULT への遷移 | CUT の無い recipe は `CONFIRM_BAKE` で直接 RESULT になる。CUT のある recipe（New Haven 以外の 24 件）は `CONFIRM_BAKE` → `POST_BAKE`(CUT) → `CONFIRM_MAKING_STEP`（最後の step）→ RESULT | 完成が確定するのは RESULT に入った瞬間。CUT の有無で遷移する action が違う |
| completion | `CONFIRM_BAKE` で `evaluatePizzaCompletion(recipe, pizza, policy)` を計算する。Lunch Rush は `"order"`（minCount を要求）、それ以外は `"recipe"`（1 個でよい） | Dinner は `"order"` にする |
| Dex / discovery / FREE Pitz | `REGISTER_TO_DEX`（RESULT のとき）。App が `CONFIRM_BAKE` / 最後の `CONFIRM_MAKING_STEP` の直後に `!isMissionRound` なら自動 dispatch する。Lunch Rush は `MISSION_NEXT_ORDER` で Dex を更新する（#234） | Dinner の round では **どちらも動かしてはいけない** |
| Lunch Rush の run | App の `useReducer(missionRunReducer)`。壁時計の TICK（250ms）、reward は `CLAIM_MISSION_REWARD` | Dinner とは state を共有しない |
| HOME | `handleGoHome`: 進行中なら `window.confirm` → `PLAY_AGAIN` か `EXIT_TO_FREE` | Dinner 用の分岐が必要 |
| Shop | `PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT`。App の `setShopOpen(true)` は HOME / Pizza Select / GAME / Dex から呼ばれる | Dinner 中は reducer で拒否し、App でも開かせない |
| reload | `createInitialGameState` が保存された進行状況から round を作り直す。run 系の state は保存されない | Dinner run も保存しないので、reload すれば消える |

### 3.2 接続方針

1. **round の種類を明示する。** `GameState.roundKind: "GUIDED" | "FREE_COOK" | "LUNCH_RUSH" | "DINNER"` を追加し、`buildOrderState` で必ず設定する。predicate（`isDinnerRound` / `isLunchRushRound` / `isFreeCookingRound` / `isGuidedRound` / `completionPolicyForRound`）は新しいモジュール `src/state/roundKind.ts` に置く。`isMissionRound` と `freeCook` は Lunch Rush / Free Cooking の既存コードのために残し、それぞれ `roundKind` と常に一致することを invariant test で固定する。**Dinner の判定には `isMissionRound` を使わない。**
2. **Dinner の session は `GameState.dinner` に置く**（`{ run: DinnerRunState, abandonRequested }` または `null`）。DM-1 の `dinnerRunReducer` をそのまま使う。Lunch Rush のように App の別 reducer にしないのは、在庫の消費と Dinner の判定を **同じ reducer 遷移** で行うため。
3. **判定のタイミング:** Dinner の round が RESULT に入る遷移（CUT なしは `CONFIRM_BAKE`、CUT ありは最後の `CONFIRM_MAKING_STEP`）の中で `RESOLVE_ATTEMPT` を適用する。渡す在庫は **その遷移で消費した後の `inventory`**。これで pre-bake の在庫を渡す経路がコード上存在しなくなり、App での組み立ても不要になる。
4. **Dinner の action:** `DINNER_START` / `DINNER_SELECT_TARGET` / `DINNER_CANCEL_TARGET` / `DINNER_RETURN_TO_TARGETS` / `DINNER_TICK` / `DINNER_REQUEST_ABANDON` / `DINNER_CANCEL_ABANDON` / `DINNER_CONFIRM_ABANDON` / `DINNER_EXIT`。
5. **Dinner 中の guard:** `dinner !== null` の間は、他の round を始める action（`BEGIN_PREPARE`、`SELECT_RECIPE`、`START_FREE_COOK`、`RETRY_SAME_RECIPE`、`PLAY_AGAIN`、`MISSION_*`）、`REGISTER_TO_DEX`、Pitz を動かす action（`PURCHASE_INGREDIENT`、`RESTOCK_INGREDIENT`、`PURCHASE_DISCOVERY_HINT`、`CLAIM_MISSION_REWARD`）をすべて reducer で拒否する。
6. **App:** Dinner の runtime を `useDinnerRuntime` hook にまとめる（TICK の interval、HOME での abandon の確認、開始）。App に入れるのは、この hook の呼び出し、`REGISTER_TO_DEX` を自動 dispatch する条件の predicate 化、Shop と Lunch Rush の開始 guard だけ。**Dinner の UI（入口、target 一覧、結果画面）は DM-3 で作る。** DM-2 では production UI から Dinner に入る経路が無いので、既存画面の見た目は変わらない。
7. **制限時間:** `DINNER_START` に `durationMs` を渡す。production に仮の秒数は置かない。mission の `timeLimit.seconds` が `null` で duration も渡されなければ、開始を拒否する（DM-1 の `NO_TIME_LIMIT`）。

## 4. Explicit round authority

- `src/state/roundKind.ts`:
  - `RoundKind = "GUIDED" | "FREE_COOK" | "LUNCH_RUSH" | "DINNER"`
  - predicate: `isDinnerRound` / `isLunchRushRound` / `isFreeCookingRound` / `isGuidedRound` / `registersToDexAtResult` / `completionPolicyForRound` / `roundKindFor`
- `GameState.roundKind` は `buildOrderState` だけが設定する。全ての round はここを通る。
- invariant（`roundKind.test.ts` と random walk で固定）:
  - `isMissionRound ⇔ LUNCH_RUSH`
  - `freeCook ⇔ FREE_COOK`
  - `dinner !== null ⇔ DINNER`
- **Dinner の判定に `isMissionRound` は使っていない。**
- Lunch Rush の既存コードは `isMissionRound` を読んだまま、1 行も分岐を変えていない。
  - completion policy は `state.isMissionRound ? "order" : completionPolicyForRound(state)` とした。Lunch Rush 側の式は以前とまったく同じ。
  - 実装の途中で、`isMissionRound: true` だけを直接書き換えた既存 test（`gameReducer.partialQuantity.test.ts`）がこの点を検出した。Lunch Rush 側を `roundKind` に切り替えると、手で組み立てた state で挙動が変わる。そのため Lunch Rush 側は旧 flag のまま残した。

## 5. Dinner start contract（`DINNER_START {missionId, now, durationMs?}`）

開始できるのは、次をすべて満たすときだけ:

- `dinner === null`（run が 1 つも無い）
- Lunch Rush の round ではない
- `getDinnerMission` で mission が見つかる
- DM-1 の `startDinnerRun` が ok を返す（mission 定義が valid、全 target が DISCOVERED、全体の必要量が在庫で足りる、duration がある）

どれかを満たさなければ、同じ state をそのまま返す（fail closed）。

- 開始すると、target 選択の round（phase ORDER、roundKind DINNER）になる。
- **制限時間は `durationMs` で注入する。** mission の `timeLimit.seconds` は DM-5 まで `null` なので、duration を渡さない開始は拒否される。production に仮の秒数は置いていない。

## 6. Target selection contract

- `DINNER_SELECT_TARGET`
  - target 選択の round（ORDER、選択中の target 無し）からだけ受け付ける。
  - DM-1 の run が受け付ける target（残っている target）だけを選べる。対象外、完了済み、未知の id は拒否する。
  - LK-8 の backstop として `canStartGuidedRound` も満たす必要がある。
  - 選ぶと、その recipe の guided PREPARE round になる（`buildOrderState` → `startPreparing`）。Cooking Time は動かさない。
- `DINNER_CANCEL_TARGET`: PREPARE のときだけ。選択を解除して target 選択に戻る。在庫、完了、報酬は変わらない。
- `DINNER_RETURN_TO_TARGETS`: 判定済みの RESULT から target 選択に戻る。run が PLAYING のときだけ。
- Dinner 中は、他の round を始める action（`BEGIN_PREPARE` / `SELECT_RECIPE` / `START_FREE_COOK` / `RETRY_SAME_RECIPE` / `PLAY_AGAIN` / `MISSION_*`）をすべて拒否する。そのため Free Cooking にも切り替えられない。
- pizza を変える action（sauce / topping / dough / reset / step / bake / cut）は、PLAYING の run で、今作っている target の round に対してだけ受け付ける。

## 7. Inventory timing proof

- 判定（`RESOLVE_ATTEMPT`）は、Dinner の round が **RESULT に入る遷移の中** で行う。
  - CUT の無い recipe: `CONFIRM_BAKE`
  - CUT のある recipe: 最後の `CONFIRM_MAKING_STEP`
- 渡す在庫は、その遷移が返す state の `inventory`。
  - CUT なしの場合は、`consumePizzaInventory` を適用した直後の値になる。
  - CUT ありの場合は、`CONFIRM_BAKE` の時点で消費済みの値になる。
- App が在庫を組み立てて渡す経路は無い。

pinned tests（`gameReducer.dinner.test.ts`）:

| ケース | 内容 | 結果 |
|---|---|---|
| A | egg 2、bismarck で 1 個使う → 消費後 1 | PLAYING のまま |
| B | bismarck に egg を 2 個置く → 消費後 0 | breakfast-pizza が作れなくなり、即 INFEASIBLE（`have: 0`） |
| C | egg 3、品質 FAILED で 1 個消費 | target は未完了のまま、再挑戦して完了できる |
| D | egg 2、品質 FAILED で 1 個消費 | INFEASIBLE（`have: 1` は消費後の値。消費前の 2 なら可能と判定されていた） |
| CUT | `CONFIRM_BAKE` の時点では消費済みだが未判定。CUT の confirm で判定される | 期待どおり |
| CUT なし | New Haven に parmigiano を置きすぎる | 同じ `CONFIRM_BAKE` の中で、parmigiana-pizza が作れないと判定（INFEASIBLE） |

**mutation check:** 判定に渡す在庫を遷移前のものに変えると、CUT なしのケースが失敗することを確認した。CUT ありの経路は、判定の時点で round の在庫がすでに消費後なので、構造的に消費前の在庫が渡らない。

## 8. FAILED semantics

| 理由 | 起きる条件 |
|---|---|
| `INFEASIBLE` | 判定の時点で、残りの target を消費後の在庫で作れない（置きすぎ、品質 FAILED の消費） |
| `TIME_UP` | TICK が期限に達した。期限以降の `CONFIRM_BAKE` は **焼かず、消費もしない**。RESULT に入る遷移も期限で止まる |
| `ABANDONED` | HOME を確認した |

- 品質 FAILED（Completion Gate FAILED）の pizza は完成として扱わない。在庫の消費は残る。
- FAILED になった後の run は、action を受け付けない（terminal）。`DINNER_EXIT` で通常の round に戻る。

## 9. CLEAR semantics

- 最後の target が PASS したら CLEARED になる。`outcome: {kind: "CLEAR", clearMs, endedAt}`。
- 24 通りのうち 3 つの順番で確認した（random walk でも確認している）。
- reward の計算（DM-1 の `quoteDinnerReward`）は、DM-4 で表示と払い出しに使う。DM-2 では Pitz を動かさない。

## 10. Timer semantics

- Dinner の時計は `run.clock`（DM-1）が持ち、壁時計で判定する。
- `useDinnerRuntime` が PLAYING の間だけ 250ms ごとに `DINNER_TICK` を dispatch する。終了すると止まる（test で確認）。
- Lunch Rush の `missionNow` / `missionRunReducer` とは state を共有しない。
- 時計を必要とする遷移（`CONFIRM_BAKE`、RESULT に入る confirm、select / cancel / return）は、`now` で期限を確認してから動く。`now` の無い `CONFIRM_BAKE` は拒否する。

## 11. HOME / reload semantics

- HOME（`handleGoHome`）で Dinner session があるとき:
  - PLAYING なら `DINNER_REQUEST_ABANDON` を dispatch して確認を出す。
    - cancel: `DINNER_CANCEL_ABANDON`。run はそのまま続く。
    - confirm: `DINNER_CONFIRM_ABANDON`（ABANDONED、報酬なし）→ `DINNER_EXIT` → HOME。
  - 終了済みなら、確認せずに exit して HOME に戻る。
- 確認は DM-2 では既存の `window.confirm` を使う。最終的な modal は DM-3 で作る。
- reload: `GameState.dinner` / `roundKind` は保存の対象外（`persistProgress` は field を明示して保存している）。
  - reload 後は run が無い。
  - 消費した在庫は保存されている（test で保存内容を確認した）。

## 12. Shop guard

- reducer: Dinner session 中は `PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT` を拒否する（補充で feasibility を回復させることはできない）。
- App: `openShop()` で、HOME / Pizza Select / GAME / Dex からの Shop を開かせない。
- Lunch Rush の開始（`startMission` / `handleStartLunchRush`）も Dinner 中は拒否する。

## 13. Dex isolation

Dinner の round では次をすべて行わない:
- discovery
- Dex の timesMade / bestScore / bestStars の更新
- `justDiscovered` / `lastDiscovery` の更新

仕組み:
- `REGISTER_TO_DEX` は Dinner 中はガードで拒否し、case の中でも `isDinnerRound` を backstop にしている。
- App も Dinner の round では自動 dispatch しない。
- `MISSION_NEXT_ORDER`（#234 の経路）も拒否する。

CLEAR の run、FAILED の run、random walk の全ステップで、Dex の JSON が変わらないことを確認した。

## 14. Pitz / reward isolation

- FREE Pitz（`lastPitzCredit`）、手際ボーナス（`lastEfficiencyCredit`。Cooking Time は null）、初発見 bonus、Lunch Rush の `CLAIM_MISSION_REWARD`、hint の購入は、Dinner 中は発生しない。
- Dinner の報酬も払い出さない（DM-4）。
- random walk の全ステップで `pitzBalance` が変わらないことを確認した。

## 15. CUT integration

- Dinner 専用の CUT の規則は作っていない。既存の cooking profile どおりに動く。
  - CUT のある recipe: BAKE → POST_BAKE(CUT) → 最後の confirm で RESULT。そこで判定する。
  - New Haven: `CONFIRM_BAKE` で RESULT に入り、そこで判定する。
- 両方の経路を test で固定した。

## 16. Lunch Rush regression

- 分岐は変えていない（§4）。
- 次の既存 test がすべて PASS した:
  - `lunchRush.test.ts`
  - `gameReducer.missionShortage.test.ts`（skip / SOLD OUT / zero-cookable）
  - `gameReducer.partialQuantity.test.ts`（order policy）
  - `App.test.tsx`（timer / RESULT / ranking の submit / reward）
  - `MissionResultOverlay.test.tsx`
  - 上の 5 ファイルで 229 件
- Chromium E2E の `lunch-rush-*`、Layout Contract の LC-3 / LC-3b も PASS（§19）。
- Dinner 中は `MISSION_*` / `CLAIM_MISSION_REWARD` を拒否し、Dinner の round は `missionSoldOutRecipeIds` を持たない。

## 17. Free / Discovery regression

- 次の既存 test（18 ファイル / 377 件）が PASS した:
  - Free Cooking（`gameReducer.freeCook`、`FreeCook.ui`）
  - Discovery（`gameReducer.discovery`、`logic/discovery/*`、`discoveryHint*`）
  - inventory（`inventoryConsumption`、`restock`、`inventory`、`recipeDiscoveryState`、`recipeSetFeasibility`）
- exit した後、Free Cooking と guided round が以前どおり始まること（Cooking Time も動くこと）を test で確認した。

## 18. Tests

| ファイル | 件数 | 内容（DM-2 test 項目の番号） |
|---|---:|---|
| `src/state/gameReducer.dinner.test.ts`（新規） | 39 | 1〜46（47〜49 は E2E / CI で確認）と seeded random walk の invariant（150 seed × 25 step） |
| `src/state/roundKind.test.ts`（新規） | 6 | predicate、legacy flag への写像、既存の全 round 経路と Dinner の開始で `roundKind` と flag が一致すること（2 段の組み合わせ） |
| `src/state/useDinnerRuntime.test.tsx`（新規） | 6 | duration の注入、壁時計の TICK → TIME_UP と停止（18）、HOME の cancel / confirm（20 / 21）、終了済みの run の exit、Lunch Rush の state に触れないこと（37） |
| `src/mission/dinner/dinnerRun.test.ts`（更新） | ― | Dinner モジュールのファイル一覧に `dinnerSession.ts` を追加しただけ |
| **DM-2 で追加した test** | **51** | |

random walk で確認している invariant（全 step で検査）:

- completed ∩ remaining = ∅
- completed ∪ remaining = target 集合
- CLEARED ⇔ remaining が空
- terminal の run は PLAYING に戻らない
- 有限在庫は増えない（Shop は拒否される）
- Pitz と Dex は変わらない
- round kind は常に DINNER

mutation check（どれも一時的に変更して、失敗することを確認した）:

| 変更 | 検出した test |
|---|---|
| 判定に消費前の在庫を渡す | CUT なしの test が失敗 |
| Dinner の completion policy を `"recipe"` にする | 12 / 13 が失敗 |
| `REGISTER_TO_DEX` の guard を外す | 29〜34 と random walk が失敗 |

## 19. CI

ローカル（exact HEAD `5106934` のコード）:

| Gate | 結果 |
|---|---|
| full Vitest | **179 files / 3754 passed**, 1 skipped（既存）, 0 failed（main の 3703 に DM-2 の 51 を足した数） |
| typecheck（`tsc -b`） | PASS |
| lint（`oxlint`） | PASS（exit 0） |
| build | PASS |
| Chromium E2E（`iphone-390x844` / `iphone-360x800`）と Layout Contract（`layout-chromium`、7 profile） | **161 passed**, 19 skipped（既存の 1 幅 1 回の guard）, 0 failed。LC-0〜LC-5（LC-2b New Haven、LC-3 / LC-3b Lunch Rush、LC-4 HOME を含む）がすべて PASS |
| Lunch Rush / App / partial quantity の regression | 5 ファイル / 229 件 PASS |
| Free / Discovery / inventory の regression | 18 ファイル / 377 件 PASS |

PR の CI（`build`、`E2E WebKit` → `WebKit Gate`、`Layout Contract Gate`）は、PR を作成した後に exact HEAD で確認して追記する。

## 20. Changed files

| ファイル | 種類 |
|---|---|
| `src/state/roundKind.ts` | 新規: round authority |
| `src/mission/dinner/dinnerSession.ts` | 新規: `DinnerSession` の型 |
| `src/state/useDinnerRuntime.ts` | 新規: App 側の runtime hook |
| `src/state/gameReducer.ts` | `roundKind` / `dinner` の field、`DinnerAction`、`buildOrderState` の引数、completion policy、`REGISTER_TO_DEX` の backstop、Dinner の層（`dinnerActionReducer` / `dinnerGuardedReducer`）、`gameReducer` を wrapper にしたこと |
| `src/App.tsx` | hook の呼び出し、`REGISTER_TO_DEX` の自動 dispatch の条件、HOME の分岐、`openShop`、Lunch Rush 開始の guard |
| 新しい test 3 ファイルと `dinnerRun.test.ts` の 1 行 | test |
| `docs/reports/TETO_DINNER-MISSION_DM-2_Runtime-Integration_Result.md` | この report |

## 21. Scope verification

- **Dinner の UI は作っていない。** production UI から Dinner に入る経路は無い（DM-3）。
- 既存画面の見た目は変わっていない。Layout Contract と E2E が同じ結果で PASS しているので、before / after の screenshot は不要と判断した。
- 次のものは変更していない:
  - reward の払い出し、tier の数値、save schema、best time / clear count の保存
  - ranking、Shop / economy / pack size、recipe / ingredient catalog
  - Hint 3.0、#234、Cooking Steps、Cutting
- `git diff f59b5ed -- src` の範囲は §20 のファイルだけ。

## 22. Residual risks

| # | リスク | 扱い |
|---|---|---|
| R-1 | GameScreen は Dinner の target 選択 round（phase ORDER）を、通常の ORDER 画面として描画してしまう（「ピザを作る！」は `BEGIN_PREPARE` なので拒否される） | production からは到達できない。DM-3 で target 一覧の画面に置き換える |
| R-2 | HOME の確認は `window.confirm` のまま | DM-3 で modal にする。reducer 側の契約（request / cancel / confirm）はできている |
| R-3 | 期限を過ぎた後の `CONFIRM_BAKE` は焼かないので、BAKE 画面のまま止まる | run は FAILED(TIME_UP) になる。DM-3 の FAILED 画面で exit させる |
| R-4 | 在庫の緊張が弱い（OD-DM-16） | DM-5 で計測する |
| R-5 | Dinner の Dex 登録（OD-DM-11）は #234 とともに未決 | DM-2 では一切登録しない。どちらに決まっても `REGISTER_TO_DEX` 側の 1 か所で変えられる |
| R-6 | `isMissionRound` と `roundKind` の二重管理 | `buildOrderState` だけが両方を設定する。invariant test で固定した。Lunch Rush を `roundKind` に寄せる整理は、別の task にするのが安全 |

## 23. DM-3 plan（未着手）

1. HOME の Dinner カードと Mission Select（unlock の表示と「あと N 種類」、未発見の identity を出さないこと、START の gate と不足の表示、Shop への導線）
2. Mission Detail（target、制限時間、集合の在庫チェック表）
3. Target Board（`dinner.run.activeRecipeId === null` のとき。✓ / ○、選択、キャンセル）
4. HUD（timer と completed / total。Lunch Rush の HUD とは別 component か、props を一般化する）
5. 判定後のパネル（「ターゲット一覧へ」= `DINNER_RETURN_TO_TARGETS`）、CLEAR / FAILED 画面（`DINNER_EXIT`）、HOME の確認 modal
6. E2E（390×844 / 360×800、CUT あり / New Haven）、Layout Contract の追加、WebKit、Human Verification 動画と before / after の screenshot
