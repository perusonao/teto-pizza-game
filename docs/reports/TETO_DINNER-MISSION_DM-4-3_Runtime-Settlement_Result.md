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

**storage の破損による保存の停止**

- 当初は、storage 側の破損で session の保存が reload まで止まりうる設計だった。
- review #1 / #2 の対応で解消した（§9）。拒否された write は 1 回だけ起き、memory 側を reconcile したあとの保存は通常どおり進む。

**2 つの tab での同時 clear**

- `clears` の max merge（DM-4-2 #3）により、2 つの tab で同時に clear すると 1 回分が失われうる。
- 支払いへの影響はない。

## 9. Independent review（`21a898a`、PR #281）

`/code-review high` で 8 件の指摘が出た。

| # | 指摘 | 判断 | 対応 |
|---|---|---|---|
| 1 | `requireDinnerRecords` と records の全体 map を毎回渡しているので、1 件の拒否で session の全保存が止まる | **妥当（P2）** | 下の reconcile を追加した。拒否された write は 1 回で済み、次の保存（拒否された record を含まない）は通る |
| 2 | persist の結果（拒否）を無視しているので、memory 上は SETTLED のまま、保存されていない Pitz を使えてしまう | **妥当（P2）** | App は拒否されたら `DINNER_RECORDS_REFUSED` を dispatch する。reducer は次のことを行う: その mission を blocked にする、in-memory の record を外す、未保存の settlement の Pitz を戻す、settlement を BLOCKED にする。冪等で、他の mission には影響しない |
| 3 | first-clear の判定が mount 時に hydrate した record なので、2 つの tab で初回が二重に払われうる | **exploit ではない（記録のみ）** | `pitzBalance` は絶対値で保存され、last-writer-wins。そのため 2 つの tab が両方 FIRST_CLEAR を選んでも、最終的な増分は初回 1 回分になる（もう一方の tab の支払いは失われるだけで、二重にはならない）。既存の multi-tab の非目標（E22）。`firstClearRewarded` は OR merge で保持される |
| 4 | `settledRunKey: null` 固定では、DM-4-1 の ALREADY_SETTLED backstop が使われない | **妥当（P3）** | `session.settlement?.runKey` を authority に渡すようにした。ALREADY_SETTLED なら state を変えない |
| 5 | 全件ではなく、settlement の差分だけを gate すべき | #1 / #2 で解消 | 拒否 → reconcile の設計で、停止は 1 回の write に限られる |
| 6 | `ProgressionCarry` の object literal が 6 か所にコピーされている | **妥当（P3）** | 6 か所を `carryOf(state)` に置き換えた。新しい必須 field の落とし漏れの危険を直接減らす（全遷移の test と mutant G7 / G11 / G12 で固定） |
| 7 | 保存のたびに records を再 merge する | P3 | records は数件なので、コストは無視できる。変更しない |
| 8 | Human Verification を対象外にしている | **対象外を維持（理由つき）** | Policy §2 の「原則不要」には「見た目 / 操作が変化しない」変更が含まれる。DM-4-3 は UI を変えず、production の payout は 0 で、player が見る・操作するものは何も変わらない。Acceptance Criteria は保存の内容で、E2E が save を読んで検証している。報酬の表示が入る DM-4-4 で HV を行う。**Owner が必要と判断すれば、Preview で追加撮影する** |

**追加した test（3 件）:**

- 拒否 → reconcile: payout が戻り、mission が blocked になり、record が外れる。次の保存は通り、在庫は保存され、壊れた record は verbatim に残る。
- 拒否が冪等であること。
- 別の mission の拒否は、その mission だけを block すること。
- あわせて、App が拒否時に dispatch することを source で固定した。

**Mutation（review 対応後、追加分）:**

| mutant | 結果 |
|---|---|
| V1: payout を戻さない | DETECTED |
| V2: block しない | DETECTED |
| V3: record を外さない | DETECTED |
| V4: 無関係な settlement まで relabel する | DETECTED |
| V5: action を無視する | DETECTED |
| V6: App が dispatch しない | DETECTED |
| 再確認: G1 / G4 / G7 | DETECTED |

**Verification（review 対応後）:**

| check | result |
|---|---|
| full Vitest | 202 files、**4331 passed / 1 skipped** |
| `tsc -b` | clean |
| `oxlint` | 0 / 0 |
| build | success |
| E2E（Chromium 390×844 と 360×800） | `dinner-settlement-dm4-3`、`dinner-mission`、`save-dinner-records-dm4-2`、`lunch-rush-material-shortage`、`free-cooking-phase3-2`: **40 passed** |

