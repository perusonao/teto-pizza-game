# Dinner Mission DM-2 — Runtime Integration: Result

- **Audited main:** `f59b5ed8b4ebba0c7b7c7c6f486b57f825aef63a`（Merge PR #237, DM-1）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`（最新の main から作り直した）
- **Authority:** `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md` §17（Owner Decisions）と DM-2 の指示

> この節（§3 Integration Map）は **実装より前に** 書いて commit した。残りの節は実装後に追記する。

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
