# Dinner Mission DM-4-3 — Runtime Settlement Wiring: Result

- **Issue:** #280（DM-4-3）。親は #257
- **Branch:** `claude/dinner-mission-dm4-3-settle-0dotex`。fresh な `origin/main` `8a8ce48`（PR #276 DM-4-2 の merge。post-merge の WebKit と Pages は success）から作った
- **Authority:**
  - DM-4-1 `decideDinnerSettlement`（#258）
  - DM-4-2 `dinnerRecordForSettlement` / `persistProgress`（#274）
  - Phase 4-0 Plan §7
  - Owner の DM-4-3 指示（2026-09-28）
- **Type:** runtime（reducer と App の保存 effect）。UI の変更はない。production の報酬は 0 のまま。そのため Human Verification の対象外（UI / gameplay 表示の変化がない）。
- **新しい reward policy は作っていない。** 報酬、first-clear、tier、record の判断は、すべて DM-4-1 / DM-4-2 に委ねている。

## 1. 配線

```
DINNER_START ── session.rewardTable = getDinnerRewardTable(mission.reward.tableId)   (run の間は固定)
             └─ session.settlement = null
 … pizza ごとに resolve …
dinnerResolve ── result.run が CLEARED、かつ session.run が PLAYING だったとき「だけ」
             └─ dinnerSettle(state)
                  ├─ session.settlement が既にある → 何もしない（backstop）
                  ├─ dinnerRecordForSettlement(records, missionId)
                  │     └─ blocked → settlement = BLOCKED（Pitz 0、records は同じ object のまま）
                  ├─ decideDinnerSettlement({ run, mission, record, table: session.rewardTable })
                  │     ├─ NO_SETTLEMENT → settlement = REFUSED（Pitz 0、record なし）
                  │     └─ SETTLE → 同じ state step で次を更新する
                  │           pitzBalance += decision.pitz
                  │           dinnerMissionRecordsState.records[missionId] = decision.record
                  │           settlement = SETTLED{ runKey, pitz, schedule, tier, clearMs, newBest… }
App の保存 effect ── persistProgress({ …, dinnerMissionRecordUpdates: records, requireDinnerRecords: true })
                     → Pitz と record を 1 回の writeSave で書く。record が拒否されたら何も書かない
```

- **CLEARED を作れるのは `dinnerResolve` だけ。** TICK が作れるのは TIME_UP、ABANDON が作れるのは ABANDONED だけ。したがって FAILED / TIME_UP / ABANDON は精算点に到達しない（0 Pitz）。
- **`GameState.dinnerMissionRecordsState`（新設）**
  - save から hydrate する（blocked な mission も含む）。
  - `ProgressionCarry` の **必須** field にして、すべての round 遷移で carry される。
    - FREE、guided、Free Cooking、Lunch Rush、DINNER_EXIT のすべて。
    - 必須なので、carry を作る箇所を tsc がすべて検査する。
  - これを変えるのは CLEAR の精算だけ。
- **`DinnerSession` に追加したもの**
  - `rewardTable`（START の時点で解決し、run 中は変わらない）
  - `settlement`（UI は読むだけ。DM-4-4 で表示する）
- **`persistProgress` の `requireDinnerRecords`（opt-in。DM-4-2 の既定の挙動は変えていない）**
  - record の更新が 1 件でも拒否されたら、**何も書かない**。Pitz も書かない。
  - 拒否が起きるのは、session の実行中に storage 側でその mission の record が壊れた場合だけ。
  - その結果、payout が record なしで保存されることはない。

## 2. Economy Safety（配線の完成と balance の有効化を分ける）

- production の mission は、出荷中の `dinner-phase1-untuned` table を参照する（`thresholds` / `pitz` は `null`）。
  - production で START できるのは DM-5-2 以降。
  - Preview で CLEAR しても、次のようになる。
    - `SETTLED / UNAVAILABLE / 0 Pitz`
    - clear は記録する（clears、best time）
    - **first-clear の権利は消費しない**（`firstClearRewarded: false` のまま）
- 報酬の値、閾値、320 / 355 s は、どこにも入れていない。
  - test で使う tuned な table は **test fixture** で、session に直接注入している。

## 3. Atomicity / Replay Gate（必須の 20 項目）

test は `src/state/gameReducer.dinnerSettlement.test.ts`（28 件）。E2E は `e2e/dinner-settlement-dm4-3.spec.ts`。

| # | 項目 | 担保 |
|---|---|---|
| 1 | CLEAR の settlement は 1 回だけ | 「first clear」。settlement は PLAYING→CLEARED の遷移でだけ走る |
| 2 | React の rerender で二重に精算しない | 精算は reducer の遷移の中だけで、effect では払わない。保存は絶対値なので、「同じ state を 5 回 persist しても write は 1 回、Pitz は 2 倍にならない」 |
| 3 | RESULT の再表示で二重に精算しない | 精算後の state に 9 種類の action（TICK、CONFIRM、START_BAKE、NEXT_PIZZA、ABANDON、REGISTER_TO_DEX…）を流しても、Pitz、records、settlement が不変 |
| 4 | HOME → 再訪で二重に精算しない | DINNER_EXIT で session は破棄され、records と Pitz は carry される。旧 run を再び精算する経路はない |
| 5 | reload で二重に精算しない | 保存 → hydrate → `dinner = null`（精算は起きない）→ 次の clear は REPEAT |
| 6 | 同じ run key の replay を拒否 | settlement は `runKey` を持つ。最後の遷移を精算後の state に replay しても、state は同じ object のまま |
| 7 | Pitz だけ増えて record の保存に失敗、を作らない | storage 側で record が壊れた場合、`requireDinnerRecords` により **write 0**（Pitz も書かない） |
| 8 | record だけ保存されて Pitz が増えない、を作らない | Pitz と record は同じ reducer step で変わり、1 回の write で保存される（write 回数 = 1 を assert） |
| 9 | blocked な mission は 0 payout、上書きなし | BLOCKED。records は同じ object のまま。壊れた record は verbatim に保存され、他の進捗（在庫の消費）は保存される。E2E でも確認した |
| 10 | 他の mission は通常どおり精算できる | dm-b が壊れていても dm-a は SETTLED |
| 11 | table が unavailable なら 0 payout、first-clear の権利は保持 | 出荷中の untuned table、`null` table、その後の tuned な clear が FIRST_CLEAR になること。E2E（production と同じ table）でも確認した |
| 12 | first clear → repeat clear | FIRST_CLEAR 250 → REPEAT 45 / 60（fixture の額） |
| 13 | 速い / 遅い best time | best が更新される / 保持される |
| 14 | 良い / 悪い tier | GOLD に改善される / SILVER を保持する |
| 15 | revision の遷移（V-1） | 別の revision の record: first-clear と clears は保持し、best はリセットして REPEAT |
| 16 | 不正 / 矛盾した CLEAR を拒否 | revision の不一致で REFUSED（0 Pitz、record なし）。形の不正は DM-4-1 の 28 件が担保する |
| 17 | TIME_UP の境界 | deadline ちょうどの解決は TIME_UP で、精算しない。1 ms 前は CLEAR |
| 18 | deadline と clock の整合 | `clearMs = endedAt − startedAt`（1 ms 前の境界で確認）。DM-4-1 の clock 検証とあわせて担保 |
| 19 | Full Reset 後の既存仕様 | save を消去すると records は空になる（既存の reset 契約） |
| 20 | 既存 save との互換 | Dinner の key が無い save は空として hydrate する。clear するまで key を書かない |

**追加で確認したこと:**

- INFEASIBLE / ABANDONED は精算しない。
- records は 7 種類の round 遷移（PLAY_AGAIN、SELECT_RECIPE、RETRY、START_FREE_COOK、Lunch Rush…）で同じ object のまま残る。
- 精算しても Dex、discovery、hint、Shop の entitlement、owned は変わらない（`lastPitzCredit` / `lastEfficiencyCredit` / `lastDiscovery` は null）。
- 決定性がある。
- App の保存 effect が records、atomic flag、依存配列、hydration を持っていることを source の test で固定した。

## 4. Mutation

各 mutant を入れて、`gameReducer.dinnerSettlement.test.ts` を実行し、元に戻した（完全一致を確認した）。

| mutant | 結果 |
|---|---|
| G1: CLEAR で精算しない | DETECTED（17） |
| G4: blocked を無視する（record なし = 初回として扱う） | DETECTED（3） |
| G5: Pitz を加算しない | DETECTED（5） |
| G6: record を保存しない | DETECTED（10） |
| G7: `carryOf` が records を落とす | DETECTED（10） |
| G8: START で table を解決しない | DETECTED（1） |
| G9: hydration が records を無視する | DETECTED（8） |
| G10: REFUSED なのに支払う | DETECTED（1） |
| G11: Lunch Rush の carry が records を落とす | DETECTED（1） |
| G12: PLAY_AGAIN の carry が records を落とす | DETECTED（1） |
| P1: atomic flag を無視する | DETECTED（1） |
| A1: App が atomic flag を渡さない | DETECTED（1） |
| A2: App が records を渡さない | DETECTED（1） |
| A3: records が変わっても effect が再実行されない | DETECTED（1） |
| G2: PLAYING の前提を外す | **equivalent** |
| G3: settled の backstop を外す | **equivalent** |

**G2 / G3 が equivalent である理由:**

- run が PLAYING でなくなると、Dinner の guard（`dinnerGuardedReducer`）がすべての調理 action を拒否する（既存の R-freeze test）。
- したがって、精算済みの run で `dinnerResolve` に入ることはない。
- 2 つとも defense-in-depth として残している。

**結果: 14 / 14 の非 equivalent mutant が DETECTED。**

## 5. 既存 test の更新

- `persistence.dinnerMissionRecords.test.ts` の 2 つの境界 test を DM-4-3 の allowlist に更新した。
  - 更新前: DM-4-2 時点の「まだ配線しない」
  - records-save module を import してよいもの: persistence と reducer
  - `dinnerMissionRecordUpdates` を渡してよいもの: App だけ
- 削除した test はない。

## 6. Verification

| check | result |
|---|---|
| focused（`gameReducer.dinnerSettlement`） | 28 passed |
| full Vitest | **202 files、4329 passed / 1 skipped**（既存の skip） |
| `tsc -b` | clean |
| `oxlint` | 0 / 0 |
| build | success |
| E2E（Chromium 390×844 と 360×800） | 新しい spec、`dinner-mission`（DM-3R-2 の全件）、`save-dinner-records-dm4-2`: **30 passed** |
| WebKit CI | PR の exact head で確認する |

## 7. 変更していないもの

- DM-4-1 / DM-4-2 の authority（`dinnerSettlement.ts`、`dinnerMissionRecordsSave.ts` の判断）
- UI / CSS
- 報酬の値、閾値
- clock
- Dex、Scoring、Hint、Shop

## 8. 残るリスク（P3）

**storage の破損で保存が止まる場合がある**

- session の実行中に、storage 側で record が壊れることがある（別の build / 手動の改変）。
- その場合、`requireDinnerRecords` により、その session の保存は reload まで止まる（fail-closed）。
- reload すると、その mission は blocked になり、他の進捗の保存は再開する。
- 通常の操作では起きない。この build は壊れた record を書かないし、blocked な mission は memory 上でも精算しない。

**2 つの tab での同時 clear**

- `clears` の max merge（DM-4-2 #3）により、2 つの tab で同時に clear すると 1 回分が失われうる。
- 支払いへの影響はない。
