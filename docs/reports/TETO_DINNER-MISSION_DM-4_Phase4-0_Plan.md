# Dinner Mission DM-4 Phase 4-0 — Plan / Owner Decisions SSOT

- **Parent Issue:** #257（DM-4 / DM-5 の親 Issue。Phase 4-0 で作成）
- **Audited main:** `51e0923`（Merge PR #252, DM-3R-2）。Fresh fetch で確認した（§1）
- **Branch:** `claude/dinner-mission-dm4-dm5-audit-0dotex`（docs / data / tools のみ）
- **前段の文書:** `docs/reports/TETO_DINNER-MISSION_DM4-DM5_Fresh-Audit.md`（証拠の区分は §4）
- **この文書の位置づけ:** DM-4 / DM-5 の **Owner Decision の SSOT**。
  - Phase 0 §17（OD-DM-1〜18）と DM-3 Redesign（OD-R1〜R10）を前提とし、それらを上書きしない。
  - Fresh Audit §8 の旧 OD 番号とは対応しない。§3 の番号が正式である。
- **STOP 判定:** **A. DM-4 PHASE 4-0 COMPLETE — DM-4-1 READY**（§14）

**この Phase で行っていないこと:**

- DM-4 の production 実装、DM-5 の production 値の確定、production deploy
- Scoring 2.0 の変更
- #256、#234、DH4 への変更

---

## 1. Fresh GitHub state（2026-09-27）

| 項目 | 状態 |
|---|---|
| `origin/main` | `51e0923` = Merge PR #252（DM-3R-2）。第 1 親は `5a33d85`、第 2 親は PR head の `d11858a`。`d11858a..51e0923` の tree 差分は空（merge commit だけ） |
| post-merge CI（`51e0923`） | `E2E WebKit (Cooking UI 1-Screen)` run 36323626051 = **success**。`Deploy to GitHub Pages` run 36323626139 = **success** |
| PR #252 / Issue #250 | MERGED / CLOSED。**「PR #252 の merge」は hard blocker から外した** |
| main の Dinner runtime | ・CLEAR が起きるのは `dinnerResolve`（`src/state/gameReducer.ts`）だけ。`resolveDinnerAttempt` → `dinnerRunReducer` の `RESOLVE_ATTEMPT` が CLEARED を返す<br>・`DINNER_TICK` が作れるのは TIME_UP だけ。ABANDON は `DINNER_CONFIRM_ABANDON` だけが作る<br>・`DINNER_START` は `state.dinner === null` のときだけ受け付ける |
| main の報酬 / 記録 | ・`dinnerReward.ts` は shape だけ。table は `dinner-phase1-untuned`（thresholds / pitz は `null`）<br>・`DinnerResultOverlay` には報酬の行が無い（"No reward row until DM-4"）<br>・save に Dinner の key は無い |
| production の START | 開けられない（`timeLimit.seconds` と `quality.minimumStars` が `null`）。DEV / Preview だけ `?dinnerDuration` / `?dinnerMinStars` を読む |
| Preview | 専用の repo（`perusonao/teto-pizza-game-preview`）。save の key は `teto-pizza-preview-save-v1`（`SAVE_STORAGE_KEY`）。この session の GitHub scope の外 |
| open のまま | #234（Dex semantics）、#256（CUT）、#242 / PR #243（旧 DM-3。superseded にするかは Owner が決める）、#38、#224 |

## 2. Duplicate Gate と Issue

- 検索した範囲:
  - open / closed の Issue と PR（"DM-4"、"DM-5"、"Dinner reward"、"dinnerMissionRecords"、"Human Timing"）
  - 2026-09-26 以降の open Issue
  - open の Dinner PR
- **既存の DM-4 / DM-5 の Issue / PR は無かった。**
- 作成した Issue: **#257**「Dinner Mission DM-4 / DM-5: reward settlement, record persistence, clock hardening, Human Timing Gate (parent)」。
  - slice ごとの子 Issue は、各 slice に着手するときに作る（空の Issue を先に量産しない）。

---

## 3. Owner Decisions（2026-09-27 — AUTHORITY）

| OD | 決定 | この文書での反映先 |
|---|---|---|
| **OD-DM4-1** | ・RW-B を基準にする。初回を厚くし、上限は 250 Pitz 程度（上限の候補）<br>・repeat は少額にし、周回しても Lunch Rush の Pitz/分を超えない<br>・**正確な table は DM-4 の pure layer に直書きしない。外部の authority / input として扱う** | §8（table を入力として扱う方式と、経済の不変条件の validator） |
| **OD-DM4-2** | FAILED / TIME_UP / ABANDON は **Pitz 0**。途中報酬なし。完成した枚数に応じた Pitz も今回は導入しない | §7、§9（E10、E11） |
| **OD-DM4-3** | CLEAR が成立する **同じ authoritative な reducer 遷移** で、exactly once 精算する。UI 表示、RESULT の再表示、reload、retry を根拠に付与することは禁止。double reward / replay を重点的にテストする | §7、§9 |
| **OD-DM4-4** | Dinner の記録を永続化する（最低限 cleared / bestClearTime / bestTier）。save の forward-compat を保ち、未知の mission id を壊さない | §6 |
| **OD-DM4-5** | Dinner は当面 Dex を書き換えない。#234 が決まるまで、Dinner の結果から timesMade / bestScore / discovery などを更新しない | §5（DM-4-D は DEFERRED）、§9（E20） |
| **OD-DM4-6** | 時計を戻して tier / best time を不正に得られる X5 を、**実在する弱点として正式に記録する**。DM-4 全体は block しない。DM-4-5 として独立した slice を設計し、production で報酬を有効にする前の Fresh Gate で、どこまで必須かを再評価する | §10 |
| **OD-DM5-1** | minimumStars は暫定で **S=3**。理由: sauce が score の 52% を占め、★4 / ★5 はソースの操作に強く依存する。S=3 なら品質条件として機能しつつ、sauce の技量テストに偏りすぎない。初期の production 候補で、Human Timing / Quality HV の後に再評価できる | §11 |
| **OD-DM5-2** | 制限時間は **T-1 を Human Validation の baseline にする**（暫定: DM-A 320 s / DM-B 355 s）。**最終の production authority ではない。** 実際の人のプレイを測って検証してから確定する | §11 |
| **OD-DM5-3** | Gold / Silver / Bronze は Human Timing の測定後に決める。320 / 355 s だけから機械的に決めない。experienced / normal / beginner をそれぞれ複数 run 測り、ミスと retry を含む実プレイの分布を見る | §11 |
| **OD-DM5-4** | speed と quality の trade-off が弱いことを正式に記録する（sauce 52%、窓の中なら bake の差は小さい、押し続けるソースが tap 連打より速く高品質になりうる）。**Dinner のために Scoring 2.0 は変更しない。** 将来の Scoring / Cooking UX の課題として分ける | §12 |
| **OD-DM5-5** | production の START を開けるのは、DM-4 の runtime reward / record settlement の後。報酬も記録も無い production Dinner を先に公開しない | §5（DM-5-2 の依存関係） |
| **OD-DM5-6** | Human Timing Gate を必須にする。Preview で DM-A / DM-B を実際にプレイし、次を記録する: total clear time、pizza ごとの時間、retry の回数、最終の ★、QUALITY_FAIL の回数、TIME_UP、device / viewport。Owner がすべてのサンプルを取る必要は無いが、**Owner の iPhone 実機のデータは必ず含める** | §11 |

未決の Owner Decision は §13 にまとめた。いずれも DM-4-1 の着手は block しない。

---

## 4. 証拠の区分（混同しない）

| 区分 | 内容 | 状態 |
|---|---|---|
| **AUTOMATED** | 144 / 144 の scripted run（Chromium、390×844 / 360×800、PR #252 head `d11858a`。この head は main `51e0923` の第 2 親で、tree は同じ）。★ と操作の努力の関係、操作回数、UI の遅延の下限 | 保持する: `docs/reports/data/TETO_DINNER-MISSION_DM4-DM5_measure.jsonl` |
| **MODEL** | 人の操作時間を KLM / Fitts で仮定したもの（`tools/dinner-dm5/dm5_balance_model.py` の `PROFILES`）。T-1 / T-2 / T-3 と、DM-A 320 s / DM-B 355 s はこの model から出た値 | **仮定。人で検証していない** |
| **HUMAN** | Preview を人がプレイしたときの時間と品質の分布 | **まだ無い**。DM-5-1 で集める（§11） |

**320 / 355 s は「人で検証済み」ではない。** Human Validation の baseline（OD-DM5-2）として使うだけである。

---

## 5. DM-4 / DM-5 の slice 計画（確定）

| Slice | 内容 | 変更する層 | 依存 | HV | Rollback の境界 |
|---|---|---|---|---|---|
| **DM-4-1** | Pure: reward / tier / record の logic（§6、§7、§8 の pure 部分）。table は常に引数で受け取る | `src/mission/dinner/` の新規 module と `dinnerReward.ts` への追加。**unwired**（reducer / save / UI からは参照しない） | なし（**READY**） | 不要 | revert すれば module ごと消える。runtime、save、UI への影響はゼロ |
| **DM-4-2** | Persistence: `dinnerMissionRecords` の load、sanitize、`persistProgress`、forward-compat | `src/state/persistence.ts`（`KNOWN_SAVE_KEYS`、sanitize、payload） | DM-4-1（型と sanitize） | 不要 | revert しても安全。古い build は未知の top-level key を `extractForwardCompatExtras` で保持する。書かれた記録は、再 deploy のときにそのまま読み直される |
| **DM-4-3** | Runtime: `dinnerResolve` の CLEAR 遷移で精算する。`session.settlement` を追加し、Pitz と記録を同じ state step で更新する | `src/state/gameReducer.ts`、`dinnerSession.ts`、App の persist の依存配列 | DM-4-1、DM-4-2 | 不要（UI は変えない。Preview でだけ到達できる） | production の START は閉じたままなので、production への影響は無い。revert すると Preview で報酬が出なくなるだけ |
| **DM-4-4** | UI: CLEAR overlay の報酬の内訳、NEW BEST、tier の badge（★ ではない記号）、Select / Detail に best tier と best time | component、CSS | DM-4-3 | **必要**（390×844 の動画と before/after のスクリーンショット。HV Policy） | UI の revert で済む。表示は `session.settlement` と records を読むだけなので、報酬の計算には影響しない |
| **DM-4-5** | Clock hardening: tamper-resistant な経過時間（§10） | `dinnerRun.ts` の clock、`useDinnerRuntime.ts`、Dinner action の `now` の供給元 | なし（4-1〜4-4 と独立。4-3 より後に入れると衝突が少ない） | 必要（Preview で background / lock 時の挙動を確認する） | revert すれば `Date.now()` の壁時計に戻る。production の記録は DM-5-2 まで存在しないので、migration は要らない |
| DM-4-D | Dex との統合 | reducer | #234 の決着 | ― | **DEFERRED**（OD-DM4-5） |
| **DM-5-1** | Human Timing の測定（Preview） | docs / data / tools。Preview repo の setup helper（本体の src は変えない） | Preview の deploy（Preview Slot Gate）。DM-4 とは独立 | ―（測定そのもの） | data の追加だけ |
| **DM-5-2** | 最終値の authority: `timeLimit.seconds`、`quality.minimumStars`、tier thresholds、reward table の値。production の START を開ける | mission data と reward table の data | **DM-4-3 が merge 済み**（OD-DM5-5）、DM-5-1 の Gate が PASS、**Reward-Enable Fresh Gate**（DM-4-5 が必須かの判断を含む。§10）、DM-4-4（報酬 UI）が merge 済み | 必要 | 値を `null` に戻せば START は再び閉じる。**一方向の部分:** すでに付与した Pitz と記録は取り消さない（記録は forward-compat で残る） |

**順序:**

```
DM-4-1 → DM-4-2 → DM-4-3 → DM-4-4 ─┐
DM-4-5 （独立。4-3 の後が望ましい） ─┼─→ Reward-Enable Fresh Gate → DM-5-2
DM-5-1 （Preview。今すぐ開始できる）─┘
```

---

## 6. Save schema proposal（DM-4-2）

```ts
// save v2 に新しい top-level key を追加する。schemaVersion は 2 のまま（bump しない。EP4 / I4b / HE / H3-2 と同じ前例）
dinnerMissionRecords: Record<string /* missionId */, DinnerMissionRecord>;

interface DinnerMissionRecord {
  /** この record を最後に書いたときの mission revision（§6.2）。 */
  revision: number;            // 1 以上の整数
  /** CLEAR の回数。cleared ⇔ clears > 0（OD-DM4-4 の cleared）。 */
  clears: number;              // 0 以上の整数
  /** 最速の clear（ms）。単調に減少する。未 clear なら null（OD-DM4-4 の bestClearTime）。 */
  bestClearMs: number | null;  // 0 より大きい有限の数、または null
  /** 最良の tier。単調に改善する（GOLD > SILVER > BRONZE）。null は tier なしの clear か、未 clear（OD-DM4-4 の bestTier）。 */
  bestTier: "GOLD" | "SILVER" | "BRONZE" | null;
  /** 初回 clear の schedule で支払った（Pitz が付与された）かどうか。一度 true になったら戻らない。 */
  firstClearRewarded: boolean;
}
```

### 6.1 設計の根拠

- **`cleared` を独立した field にしない理由:** `clears > 0` から導出できるので、二重に持つと矛盾しうる。
- **`firstClearRewarded` を `clears > 0` と分ける理由:** 報酬 table が未調整（`pitz: null`）の build で clear しても、初回報酬の権利を消費しないようにするため（§7 の規則 R5）。
  - production では START が DM-5-2 まで閉じている。したがって、この分離が実際に効くのは Preview と revision 変更の場合だけ。
  - それでも不変条件として明示しておく。
- **`missionBest` は再利用しない。** LR の ranking 用で、単調増加の数値 1 つしか持てない。
- **Attempt log（run の中の各ピザ）は保存しない**（PR #252 の authority のまま。session 限り）。
- **FAILED の回数も保存しない**（OD-DM4-2 で失敗系は 0 とし、記録の最低限にも含まれていないため）。必要になれば、後から field を足すだけで済む。

### 6.2 revision が変わったとき（U-1。§13）

- DM-4-1 の既定は **V-1**（Fresh Audit の推奨）とする。
  - `firstClearRewarded` と `clears` は保持する。
  - `bestClearMs` と `bestTier` はリセットする（条件が違う記録は比べられない）。
  - `revision` を更新する。
- production に記録が生まれるのは DM-5-2 の後。したがって DM-5-2 までは、Owner の判断で既定を V-2（すべて保持）に変えても、影響はゼロ。

### 6.3 Sanitize と forward-compat

| 入力 | 扱い |
|---|---|
| key が無い / object でない | `{}` |
| 既知の mission id で、record が壊れている | その record を捨てる（`{}` 扱い） |
| 既知の mission id で、field が 1 つ壊れている | record 全体を捨てる。部分的な修復はしない。`firstClearRewarded` を推測して true / false にすると、二重付与や付与漏れの原因になるため |
| **未知の mission id**（将来の build のもの） | forward-compat の id pattern（`^[a-z0-9][a-z0-9_-]{0,63}$`）に合えば、**record を生のまま保持** し、書き戻す（この build は読まない） |
| `__proto__` などの危険な key | 捨てる（既存の `extractForwardCompatExtras` と同じ） |
| 古い build が新しい build の save を読む | 未知の top-level key として、`extractForwardCompatExtras` の `topLevel` に入って保持される（main で確認済み）。**DM-4-2 で e2e を追加して固定する**（`save-forward-compat-3-4b.spec.ts` と同じ方式） |
| 新しい build が古い save（key が無い）を読む | `{}`。migration は不要 |

### 6.4 書き込みの原子性

- `persistProgress` の payload と、その `useEffect` の依存配列に `dinnerMissionRecords` を加える。
- 精算では `pitzBalance` と `dinnerMissionRecords` が **同じ reducer の戻り値** で変わる。そのため effect は 1 回走り、`writeSave` も 1 回になる。

---

## 7. Exactly-once settlement の state machine（DM-4-1 は pure、DM-4-3 は runtime）

```
            DINNER_START (state.dinner === null のときだけ)
                    │   session = { run: PLAYING, runId, settlement: null, … }
                    ▼
              ┌──────────┐  RESOLVE_ATTEMPT（最後の target 以外）
              │ PLAYING  │◄──────────────────────────────┐
              └──────────┘                               │
   TICK ≥ endsAt │  │ CONFIRM_ABANDON   │ RESOLVE_ATTEMPT│ → remaining が不能
                 ▼  ▼                   ▼                ▼
        FAILED(TIME_UP) FAILED(ABANDONED)  FAILED(INFEASIBLE)      ← Pitz 0 / records 変更なし / Dex 変更なし
                                                                     （OD-DM4-2、OD-DM4-5）
              │ RESOLVE_ATTEMPT が最後の target を完成（deadline 前）
              ▼
        ┌─────────────────────────────────────────────────────────────┐
        │ CLEARED  ＝ 精算はこの遷移の中だけで行う（dinnerResolve）       │
        │   settlement = settleDinnerRun(record, run, table)（pure）    │
        │   state.pitzBalance += settlement.pitz                        │
        │   state.dinnerMissionRecords[missionId] = settlement.record   │
        │   session.settlement = { runId, pitz, isFirstClear, … }       │
        └─────────────────────────────────────────────────────────────┘
              │ DINNER_EXIT（session と settlement は破棄。records と Pitz は残る）
              ▼
         state.dinner = null → retry は新しい DINNER_START（新しい runId）
```

### 7.1 規則

| # | 規則 | 根拠 / 実装上の担保 |
|---|---|---|
| R1 | 精算は **`session.run.status === "PLAYING"` かつ `result.run.status === "CLEARED"`** になる遷移でだけ行う | CLEARED を作るのは `RESOLVE_ATTEMPT` だけ（main で確認済み）。`dinnerRunReducer` は PLAYING 以外では何もしない（terminal は吸収状態） |
| R2 | **backstop:** `session.settlement !== null` なら、二度と精算しない | 同じ transition が再び評価されても no-op になる（mutation test で検出する） |
| R3 | UI は `session.settlement` と records を **読むだけ**。計算もしないし、dispatch もしない | 報酬に関わる action を UI に持たせない。CLAIM action は作らない（OD-DM4-3） |
| R4 | FAILED 系（TIME_UP / ABANDONED / INFEASIBLE）と、途中までの完成は 0 Pitz。records も変わらない | OD-DM4-2。`settleDinnerRun` は CLEAR 以外では `null` を返す |
| R5 | table の `pitz` が `null`（未調整）なら、支払いは 0。`firstClearRewarded` は変えない。`clears` と best は記録する | 未調整の build で、初回報酬の権利を消費しないため |
| R6 | 初回かどうかは永続化された `firstClearRewarded` で決める。run や UI の状態は使わない | reload や retry で初回報酬を再度受け取れない |
| R7 | deadline が優先する: 最後のピザの確定が `now ≥ endsAt` なら TIME_UP になり、精算しない | main の `dinnerRunReducer` の既存の規則（R20）。そのまま引き継ぐ |
| R8 | Dex、FREE Pitz、CT2 には触れない | OD-DM4-5、OD-DM-18。既存の R23 / R24 を CLEAR の精算の経路まで広げて固定する |
| R9 | 精算の中で Pitz と records を同じ state にし、1 回の `writeSave` で保存する | §6.4 |

### 7.2 DM-4-1 の pure API（案。名前は実装時に調整してよい）

```ts
// src/mission/dinner/dinnerRecords.ts（新規）
export interface DinnerMissionRecord { revision; clears; bestClearMs; bestTier; firstClearRewarded }
export function emptyDinnerRecord(revision: number): DinnerMissionRecord;
export function sanitizeDinnerMissionRecord(raw: unknown): DinnerMissionRecord | null;
export function compareTier(a: DinnerClearTier | null, b: DinnerClearTier | null): number;

export interface DinnerSettlement {
  record: DinnerMissionRecord;        // 新しい record
  pitz: number;                       // 0 以上の整数（table が未調整なら 0）
  quote: Extract<DinnerRewardQuote, { kind: "CLEAR" }>;
  isFirstClear: boolean;              // 初回の schedule を使ったか
  newBestTime: boolean;
  newBestTier: boolean;
}
/** CLEAR 以外は null（OD-DM4-2）。table は常に引数（OD-DM4-1: 直書き禁止）。 */
export function settleDinnerRun(input: {
  record: DinnerMissionRecord | undefined;
  missionRevision: number;
  outcome: DinnerRunOutcome;
  table: DinnerRewardTable;
}): DinnerSettlement | null;
```

---

## 8. 報酬 table を外部の authority / input として扱う方式（OD-DM4-1）

- **DM-4-1 の pure layer は数値を持たない。**
  - `settleDinnerRun` と `quoteDinnerReward` は `DinnerRewardTable` を引数で受け取る。
  - test は注入した table（RW-B の形をした fixture）で行う。
- **production の table:**
  - DM-5-2 までは既存の `dinner-phase1-untuned`（`pitz: null`）だけ。
  - DM-5-2 で、Human Timing の結果から決めた値を data として 1 か所に追加する。場所は mission の `reward.tableId` が参照する table の data module で、DM-5-2 で確定する。
- **経済の不変条件の validator**（DM-4-1 に pure 関数として追加し、DM-5-2 で production の table に適用する）:

```ts
validateDinnerRewardEconomy(table, {
  maxFirstClearPitz,        // 上限の候補 250（OD-DM4-1）。入力として渡す
  lunchRushPitzPerMinute,   // economy.ts の既存の export から導出する: (BASE + 50 + 50) / 3 = 46.7
  fastestHumanClearMs,      // DM-5-1 の実測（experienced の最速の clear）
}): string[]
```

検査する項目:

| # | 不変条件 |
|---|---|
| I1 | `firstClear.clear + max(firstClear.tierBonus) ≤ maxFirstClearPitz` |
| I2 | `(repeatClear.clear + max(repeatClear.tierBonus)) / (fastestHumanClearMs / 60000) ≤ lunchRushPitzPerMinute`。周回しても LR の Pitz/分を超えない |
| I3 | `repeatClear.clear + max(repeatClear.tierBonus) < firstClear.clear + max(firstClear.tierBonus)`。初回を厚く、repeat を少額にする |
| I4 | tier bonus が単調（GOLD ≥ SILVER ≥ BRONZE ≥ 0）で、整数であること（既存の `validateDinnerRewardTable` に追加する） |

- `tools/dinner-dm5/dm5_human_timing_summary.py` は、実測から I2 の上限（`repeatPayoutCapPitz`）を出力する。
  - 例: 最速の experienced の clear が 80 s なら、repeat の最大は 62 Pitz。

---

## 9. Exploit / adversarial test matrix

層の略号: P = pure（DM-4-1）、S = persistence（DM-4-2）、R = reducer（DM-4-3）、A = App / hook、E = E2E（Chromium と WebKit）、M = mutation（検出されることを確認する）。

| ID | 攻撃 / 状況 | 期待 | 層 | slice |
|---|---|---|---|---|
| E01 | 通常の CLEAR | Pitz がちょうど 1 回加算される。records が 1 回更新される（clears +1） | P, R | 4-1 / 4-3 |
| E02 | CLEAR の後に、同じ `CONFIRM_MAKING_STEP` / `CONFIRM_BAKE` を再び dispatch する（replay） | 状態が変わらない（Pitz、records、settlement とも） | R | 4-3 |
| E03 | CLEAR の後の `DINNER_TICK`（期限の前でも後でも） | 変わらない | R | 4-3 |
| E04 | CLEAR overlay の再描画、StrictMode での effect の二重実行、overlay の開閉 | Pitz が 1 回だけ付く（UI には報酬の action が無い） | A | 4-3 / 4-4 |
| E05 | 最後のピザで CUT の確定を二度押しする（高速な二重 dispatch） | 精算は 1 回 | R, E | 4-3 |
| E06 | CLEAR → `DINNER_EXIT` → retry（新しい run）→ CLEAR | 2 回目は repeat の schedule になる。初回報酬は再度付かない。旧 run が再度精算されることはない | R, A, E | 4-3 |
| E07 | CLEAR の後に reload する | save の Pitz は「前 + payout」で、records もある。load 時に精算は起きない | E | 4-3 |
| E08 | run の途中で reload する | Pitz も records も変わらない。消費した在庫は残る（OD-DM-7） | E | 4-3 |
| E09 | 最後のピザの確定が `now == endsAt` | TIME_UP になり、Pitz 0、records は変わらない | P, R | 4-3 |
| E10 | TIME_UP / INFEASIBLE / ABANDONED | Pitz 0、records は変わらない、Dex も変わらない | P, R | 4-1 / 4-3 |
| E11 | 3/4 まで完成したところで TIME_UP | Pitz 0（完成した枚数に応じた報酬は無い） | P, R | 4-1 / 4-3 |
| E12 | 未調整の table（`pitz: null`）で CLEAR | Pitz 0、`firstClearRewarded` は false のまま、`clears` +1、best は更新される（R5） | P | 4-1 |
| E13 | revision が違う record | V-1: 初回の受取は保持し、best はリセットする | P | 4-1 |
| E14 | 遅い clear / 低い tier | `bestClearMs` と `bestTier` は悪化しない（単調） | P | 4-1 |
| E15 | 壊れた `dinnerMissionRecords`（型違い、負数、NaN、`__proto__`） | 壊れた record を捨て、他の record は無事 | S | 4-2 |
| E16 | 未知の mission id の record | そのまま保持され、書き戻される | S | 4-2 |
| E17 | 新しい build → 古い build → 新しい build の往復 | 記録が消えない | E | 4-2 |
| E18 | 端末の時計を戻す（Date.now が逆行する） | 経過時間は monotonic な側を使う（§10）。tier / best time を不正に得られない | P, R, A | 4-5 |
| E19 | 画面ロック / background（monotonic な時計が止まる） | 経過時間は wall の側を使う。時計を止めて時間を稼ぐことはできない | P, A, E | 4-5 |
| E20 | Dinner のすべての経路（CLEAR の精算を含む） | Dex（timesMade、bestScore、discovery）が変わらない | R | 4-3 |
| E21 | Dinner の round | FREE Pitz / CT2 は付かず、精算が唯一の Pitz の源になる | R | 4-3 |
| E22 | 2 つの tab | last-writer-wins。Pitz が増える方向の二重付与は起きない（後から書いた tab の state は先の tab の報酬を含まない）。**既存の性質で、非目標として文書化するだけ** | doc | ― |
| E23 | mission に値がある（DM-5-2 後）のに `?dinnerDuration` / `?dinnerMinStars` を付ける | mission の値が優先される（override は Preview でだけ、しかも mission が `null` のときだけ効く） | A | 5-2 |
| E24 | Persist の payload | 精算の後の 1 回の `writeSave` に、Pitz と records が両方入っている | S, A | 4-2 / 4-3 |

**Mutation（DM-4-3 で DETECTED を確認する）:**

- `session.settlement` の guard を外す
- FAILED でも精算する
- 精算を effect / UI の側に移す
- persist の payload から records を落とす
- `firstClearRewarded` を保存しない
- 未調整の table で `firstClearRewarded = true` にする
- deadline の検査を精算の後ろに回す

---

## 10. Clock hardening（DM-4-5）と、その依存関係

**弱点（X5、OD-DM4-6 で正式に記録した）:**

- Dinner の run は `Date.now()`（壁時計）で `startedAt`、`endsAt`、`clearMs` を決める。
- run の途中で端末の時計を戻すと、残り時間が増え、clear time が短くなる。その結果、tier と best time を不正に得られる。
- LR にも同じ性質がある。

**設計（案）:**

- run の開始時に、wall（`Date.now()`）と monotonic（`performance.now()`）の 2 つを記録する。
- 経過時間 = `max(wallNow − wallStart, monoNow − monoStart)`（0 以上に clamp する）。

| 状況 | wall の差分 | monotonic の差分 | max が選ぶもの |
|---|---|---|---|
| 時計を戻す | 小さくなる | 正しい | monotonic が勝つ → 不正は無効 |
| 画面ロック / suspend（iOS で monotonic が止まる場合） | 進む | 止まる | wall が勝つ → 時計を止めて時間を稼げない |
| 時計を進める | 大きくなる | 正しい | wall（プレイヤーが損をするだけ） |

- run は保存されない（OD-DM-7）。page の寿命の中の monotonic な値で足りる。永続化も migration も不要。
- **変更の範囲:** `DinnerClock` の型（mono を追加）、`dinnerRemainingMs` / `isDinnerClockExpired`、`useDinnerRuntime` の clock の供給、Dinner action の `now`。
- **依存関係:** 4-1〜4-4 とは独立（精算は `outcome.clearMs` を読むだけなので、clock の実装には依存しない）。
- **Gate:** 「**Reward-Enable Fresh Gate**」（DM-5-2 の直前）で、次のどちらかを Owner が判断する（U-5）。
  - (a) DM-4-5 を必須にする
  - (b) tier bonus が小さい（I2 で上限が決まる）ので受け入れる
- **production の記録が生まれるのは DM-5-2 の後。** したがって、DM-4-5 がそれより後に入っても、古い記録を修正する必要は無い。

---

## 11. DM-5 Human Timing protocol と Preview measurement plan（OD-DM5-1 / 2 / 3 / 6）

### 11.1 測る値（OD-DM5-6）と取り方（本体のコードは変えない）

| 値 | 取り方 |
|---|---|
| total clear time | CLEAR overlay の「クリアタイム m:ss」（1 s 単位。main で確認済み） |
| pizza ごとの時間 | 各ピザの結果画面に出る HUD の ⏱（残り時間）を読み、前の値との差を取る。最後のピザは overlay の clear time から求める |
| retry の回数 | 同じ tester × mission の run 番号（`attempt_index`） |
| 最終の ★ | 結果パネルの「★n ターゲットクリア」、または QUALITY_FAIL の「★n（合格は★3以上）」 |
| QUALITY_FAIL の回数 | 結果の category |
| TIME_UP | overlay の「時間切れ！」 |
| device / viewport | 機種、OS / browser、画面の拡大表示の設定、CSS viewport（分かれば） |

- 記録のしかた: iOS の画面収録（動画は commit しない。Owner に直接渡す）から、2 つの sheet に書き写す。
  - `docs/reports/data/TETO_DINNER-MISSION_DM5_human-timing_runs.template.csv`（run ごと）
  - `docs/reports/data/TETO_DINNER-MISSION_DM5_human-timing_pizzas.template.csv`（ピザごと）
- 集計: `tools/dinner-dm5/dm5_human_timing_summary.py`（`--self-test` は synthetic な行だけで検証するもので、測定データではない）。

### 11.2 条件

| 項目 | 値 |
|---|---|
| build | main（`51e0923` 以降）の Preview（badge で SHA を確認する）。DM-4 の報酬は不要（時間と品質だけを測る） |
| 主な条件（baseline、OD-DM5-2） | DM-A: `?dinnerDuration=320&dinnerMinStars=3`<br>DM-B: `?dinnerDuration=355&dinnerMinStars=3` |
| 補助の条件（beginner のみ） | `?dinnerDuration=900&dinnerMinStars=3`。打ち切られない分布（p90）を見るため。sheet の `duration_param_s` で区別する |
| save | Preview 専用の setup helper で用意する（DM-3R-2 の `dm3r2-setup.html` と同じ方式。Preview の key だけに書き、backup / restore できるもの）。DM-A / DM-B の target を発見済みにし、各素材を pack 1 つ分用意する |
| 指示 | 操作の説明はしない。目的だけ伝える（「4 種類のピザを時間内に作る」）。ミスはそのまま記録する |

### 11.3 参加者（OD-DM5-3）

| profile | 定義 | 最低限の数 |
|---|---|---|
| experienced | Owner、または Dinner を 5 run 以上遊んだ人 | mission ごとに CLEAR 3 run 以上 |
| normal | 通常の調理（FREE）は遊んだことがあり、Dinner は 1〜4 run の人 | mission ごとに CLEAR 3 run 以上 |
| beginner / first-time | Dinner を初めて遊ぶ人。**最初の run は必ず記録する**（first contact） | mission ごとに 3 run 以上（TIME_UP も含む） |
| **Owner の iPhone** | 必須（OD-DM5-6） | どれかの profile で 1 run 以上 |

- tester id は仮名にする。個人情報は commit しない。

### 11.4 Preview の測定手順

1. **P1:** Preview Slot Gate を確認する。main の SHA を Preview repo に deploy し、badge で SHA を確かめる。
2. **P2:** setup helper を置く（Preview repo だけ）。DM-A / DM-B の seed を作る。
3. **P3:** Owner が各 mission を 1 run ずつ試し、sheet の記入の流れを確認する。
4. **P4:** 本番の測定 session（§11.3 の数）。
5. **P5:** sheet（CSV）と summary の JSON を `docs/reports/data/` に commit する。動画は commit しない。
6. **P6:** DM-5-2 の Decision Brief を作る。
   - 実測の分布、TC-1 / TC-2 の tier 候補、baseline（320 / 355）での TIME_UP の割合、S=3 での QUALITY_FAIL の割合、I2 の repeat 上限を示す。
   - それをもとに Owner が最終値を決める。

### 11.5 Gate（DM-5-2 に進む最低条件）

- profile × mission ごとに CLEAR が 3 run 以上ある。
- Owner の iPhone の run がある（summary の `gatePass`）。
- Owner が分布を review している。
- **320 / 355 s を最終値にするかどうかは、この Gate の後に決める。**

---

## 12. 正式記録: speed と quality の trade-off（OD-DM5-4）

AUTOMATED の実測（Fresh Audit §6.1）で、次のことが分かっている。

- ★ は主にソースで決まる（Scoring 2.0 の重みは sauce 52 / pieces 16 / recipe 12 / bake 20）。
- bake は窓の中なら差が出ない。
- 押し続けるソース（約 2.6 s）は、tap 連打より速く、しかも ★ が高い。
- 塗りすぎ（4.0 s）は ★4 で頭打ちになる。

**扱い:**

- Dinner のために Scoring 2.0 は変えない。
- 将来の Scoring / Cooking UX の課題として分ける（関係する Issue: #176 Scoring 3.0、#37）。
- Dinner 側では S=3（OD-DM5-1）で、sauce の技量テストに偏らないようにしている。

---

## 13. 未決の Owner Decision（どれも DM-4-1 の着手は block しない）

| # | 論点 | 既定 / 推奨 | 必要になる時点 |
|---|---|---|---|
| U-1 | revision が変わったときの records（V-1 / V-2 / V-3） | 既定は **V-1**（production に記録が無いので、DM-5-2 までは影響ゼロで変更できる） | DM-4-2 の merge 前 |
| U-2 | tier の記号（🥇🥈🥉 / 金・銀・銅の皿 / 文字だけ） | 🥇🥈🥉（★ と混同しない。OD-DM-10） | DM-4-4 |
| U-3 | 報酬の正確な値（RW-B の枠の中）と table の置き場所 | Human Timing の後に I1〜I4 を満たす値を選ぶ | DM-5-2 |
| U-4 | tier の閾値の規則（TC-1 / TC-2 / 別の規則）と、最終の制限時間 | 実測の後に決める（OD-DM5-3） | DM-5-2 |
| U-5 | Reward-Enable Fresh Gate で DM-4-5 を必須にするか | Gate で判断する（OD-DM4-6） | DM-5-2 の前 |
| U-6 | #242 / PR #243（旧 DM-3）を superseded として close するか | Owner の判断（PR #252 が置き換え済み） | いつでも |
| U-7 | Human Timing の補助の条件（900 s）を使うか / beginner の人数 | 使う（p90 を見るため）/ 最低 1 人、できれば 2 人 | DM-5-1 |

---

## 14. DM-4-1 の開始可否と STOP 判定

- **DM-4-1 は READY。**
  - 依存は無い（pure、unwired。table は注入する）。
  - 必要な authority は確定している: OD-DM4-1 / 2 / 3 / 4 / 5 と、§6〜§9 の仕様。
  - 未決の U-1 は既定 V-1 で実装し、DM-4-2 の merge 前なら変更できる。
- **DM-5-1 も並行して開始できる**（Preview の deploy と setup helper が前提）。
- DM-4-2 → 4-3 → 4-4 は、それぞれ前の slice の merge が前提。DM-5-2 は §5 の依存関係に従う。

**A. DM-4 PHASE 4-0 COMPLETE — DM-4-1 READY**
