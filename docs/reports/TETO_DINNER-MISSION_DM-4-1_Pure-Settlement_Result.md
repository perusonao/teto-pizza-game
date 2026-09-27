# Dinner Mission DM-4-1 — Pure Settlement Layer: Result

- **Issue:** #258（DM-4-1）。親は #257
- **Branch:** `claude/dinner-mission-dm4-1-pure-0dotex`。fresh な `origin/main` `51e0923` から作った
- **Authority:** `docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md`（Phase 4-0 commit `cbeaae4`）
  - §3: OD-DM4-1〜6、OD-DM5-1〜6
  - §6: record
  - §7: exactly-once
  - §8: table は input、経済の不変条件
  - §9: exploit matrix
- **Type:** pure logic だけ。**unwired。** UI、gameplay、save の変更はない。そのため Human Verification の対象外（HV Policy）。

## 1. 変更したもの

| file | 変更 |
|---|---|
| `src/mission/dinner/dinnerSettlement.ts`（新規） | 下の表を参照 |
| `src/mission/dinner/dinnerSettlement.test.ts`（新規） | 82 tests |
| `src/mission/dinner/dinnerRun.test.ts` | 既存の「Dinner modules import no Dex writer / Lunch Rush / gameReducer / persistence」guard の file allowlist に `dinnerSettlement.ts` を追加した。追加によって、その guard が新しい module にも適用される |

`dinnerSettlement.ts` の中身:

| 名前 | 役割 |
|---|---|
| `DinnerMissionRecord` と `dinnerMissionRecordProblems` / `isValidDinnerMissionRecord` / `emptyDinnerMissionRecord` | record の型と検証 |
| `isBetterDinnerTier` | tier の比較（厳密に良いときだけ true） |
| `DinnerRevisionPolicy`（V-1 `KEEP_REWARD_RESET_BESTS` が既定、V-2 `KEEP_ALL`）と `dinnerRecordForRevision` | mission revision が変わったときの扱い |
| `dinnerRunKey` | run を一意に識別する key |
| `decideDinnerSettlement` | 1 つの run に対する精算の判定（`SETTLE` / `NO_SETTLEMENT`） |
| `validateDinnerRewardEconomy` | 経済の不変条件 I1〜I4（制限値はすべて入力） |

**変更していないもの:**

- persistence / save、reducer / runtime、UI / CSS、E2E
- Dex、Scoring 2.0、mission data（`timeLimit` / `minimumStars` は `null` のまま）、`dinner-phase1-untuned` table
- #256、DH4

production の bundle にこの module は含まれていない。どこからも import されていないので、tree-shake で落ちる。

## 2. 判定の規則（`decideDinnerSettlement`）

| 入力 | 結果 |
|---|---|
| CLEARED でない run（FAILED の TIME_UP / INFEASIBLE / ABANDONED、PLAYING、status と outcome が矛盾するもの） | `NO_SETTLEMENT / NOT_CLEARED`。Pitz を返さず、record も返さない（OD-DM4-2）。table / mission / record の有無に関係なく最初に判定する |
| 形が壊れている、または食い違う入力（clearMs が不正、未知の mission、run と mission の id / revision の不一致、clock の破損、壊れた record） | `NO_SETTLEMENT / INVALID_INPUT`（fail closed）。**壊れた record を黙って作り直すことはしない**（作り直すと初回報酬を二重に払いうる。壊れた save をどう扱うかは DM-4-2 が決める） |
| `settledRunKey === dinnerRunKey(run)` | `NO_SETTLEMENT / ALREADY_SETTLED`（OD-DM4-3 の backstop） |
| CLEAR で、table が使える | `SETTLE`: `FIRST_CLEAR` か `REPEAT_CLEAR`。どちらかは永続化された `firstClearRewarded` だけで決める |
| CLEAR で、table が無い / 未調整（`pitz: null`）/ 不正 / 構造が壊れている | `SETTLE`: `UNAVAILABLE`、pitz 0。**初回報酬の権利は消費しない。** clear 自体と best は記録する。理由は `tableProblems` に入れる |

record の更新: `clears` は +1、`bestClearMs` は厳密に短いときだけ、`bestTier` は厳密に良いときだけ更新する。`firstClearRewarded` は、実際に支払ったときだけ true になる。

## 3. Tests（`dinnerSettlement.test.ts`、82 件）

依頼された最低限の項目と、Phase 4-0 の E-ID の対応:

| 項目 | test |
|---|---|
| first clear / repeat clear | E01、E06、「永続化された flag だけで schedule が決まる」 |
| worse / better time | E14（等しい時間は best にならない） |
| worse / better tier | 7 通りの表と、tier と time の独立性 |
| 閾値の境界ちょうど | 0 / 90 000 / 90 001 / 150 000 / 150 001 / 300 000 / 300 001 ms |
| failed / time-up / abandon が 0 | E10、E11（3/4 で TIME_UP）、PLAYING、実際の `dinnerRunReducer` から作った run |
| deadline ちょうど | E09（`now == endsAt` は TIME_UP） |
| table が使えない | E12（7 種類: undefined、null、出荷中の untuned、thresholds だけ、閾値の順序が逆、負の額、構造の破損）と、権利が次の支払いまで残ること |
| 同じ入力の replay | E02、E03、E05 のモデル。backstop、5 run の連鎖で `[250, 60, 60, 60, 60]` |
| malformed input | 15 通り + run の欠落 + 矛盾した run の 4 通り |
| 未知の mission / revision | unknown mission、stale revision、newer record、V-1 / V-2 |
| Dex を変更しない | import の scan（Dinner の pure module だけ）と、出力に Dex の field が無いこと。既存の guard（`dinnerRun.test.ts`）も新しい module に適用される |
| 決定性 | 同じ入力 × 20 回で出力が同じ。deep-freeze した入力が変わらない |
| production の値を持たない | source の scan（250 / 320 / 355、schedule / threshold の literal が無い）と、出荷中の mission / table がまだ `null` であること |
| 経済の不変条件 | I1〜I4 と、不正な制限値 / 壊れた table |

- Pitz の額と閾値は、すべて **test fixture**（RW-B の形をした値）。production の値ではない。
- pure layer の対象外にした E-ID（配線や保存が必要なもの）:
  - DM-4-2: E15、E16、E17、E24
  - DM-4-3: E04、E07、E08、E20、E21 の runtime 部分
  - DM-4-5: E18、E19
  - DM-5-2: E23

## 4. Mutation / adversarial

`dinnerSettlement.ts` に mutant を 1 つずつ入れて `dinnerSettlement.test.ts` を走らせ、元に戻した（`cmp` で byte 単位に一致することを確認した）。

| mutant | 結果 |
|---|---|
| M1: status の検査を外す（FAILED の run も精算する） | 最初は **SURVIVED**。status と outcome が矛盾する run を使う adversarial test を追加したあとは DETECTED（2） |
| M1b: outcome の検査を外す | DETECTED（1） |
| M2: ALREADY_SETTLED の guard を外す | DETECTED（2） |
| M3: 支払っていない clear で初回報酬の権利を消費する | DETECTED（8） |
| M4: 常に初回扱い（reload で再び支払う） | DETECTED（5） |
| M5 / M6: best time / best tier を無条件に上書きする | DETECTED（2 / 5） |
| M7: clears を増やさない | DETECTED（14） |
| M8: 等しい時間を new best にする | DETECTED（1） |
| M9: tier の比較を厳密でなくする | DETECTED（2） |
| M10: 壊れた record を受け入れる | DETECTED（7） |
| M11: 不正な table を使える扱いにする | DETECTED（4） |
| M12: revision policy を無視する | DETECTED（1） |
| M13: tier bonus を落とす | DETECTED（11） |
| M14: stale な revision を受け入れる | DETECTED（1） |
| M15: 負 / 非有限の clearMs を受け入れる | DETECTED（5） |
| M16: I2（LR の Pitz/分）の検査を外す | DETECTED（1） |

**最終結果: 18 / 18 が DETECTED。**

## 5. Verification

| check | result |
|---|---|
| focused（`src/mission/dinner`） | 5 files、186 passed |
| full Vitest | **193 files、4160 passed / 1 skipped**（既存の skip） |
| `tsc -b` | clean |
| `oxlint` | 0 warnings / 0 errors |
| `npm run build` | success（`dist` に `dinnerSettlement` は含まれない。unwired） |

## 6. DM-4-2 以降への申し送り

- **U-1:** 既定は V-1。DM-4-2 で永続化する前なら、Owner の判断で V-2（`KEEP_ALL`）に変えられる。policy は引数なので、変更は既定値 1 か所で済む。
- **壊れた record:** pure layer は fail closed（INVALID_INPUT）。DM-4-2 の sanitize は、壊れた record を「捨てる（= 初回をもう一度払いうる）」か「保持して精算を止める」かを決める必要がある。改ざんされた local save の信頼度は、もともと低い。
- **DM-4-3:** `dinnerResolve` の CLEAR 遷移で `decideDinnerSettlement` を 1 回呼ぶ。`SETTLE` のときだけ、Pitz と record と `session.settlement` を同じ state で更新する。table は `getDinnerRewardTable(mission.reward.tableId)` から取り、DM-5-2 までは untuned（0 Pitz）。
- **DM-5-2:** production の table に `validateDinnerRewardEconomy` を適用する。limits は、上限の候補、`economy.ts` から導出した LR の Pitz/分、DM-5-1 で実測した最速の clear。
